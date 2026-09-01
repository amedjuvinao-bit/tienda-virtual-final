// backend/routes/adminCustomerFollowUps.js

const express = require('express');
const mongoose = require('mongoose');

const requireAdmin = require('../middleware/requireAdmin');
const requirePermission = require('../middleware/requirePermission');
const Customer = require('../models/Customer');
const CustomerFollowUp = require('../models/CustomerFollowUp');
const {
  buildScopedCustomerFilter,
  buildScopedFollowUpFilter,
  resolveCustomerWriteBranch,
} = require('../services/customerAdminScopeService');
const {
  asAdminId,
  listAssignableCrmAdmins,
  resolveAssignableCrmAdmin,
} = require('../services/customerCrmAdminService');
const {
  buildAuditChanges,
  canViewSensitiveCustomerData,
  protectCustomerData,
  recordCustomerAuditEvent,
} = require('../services/customerPrivacyService');

const router = express.Router();

const FOLLOW_UP_TYPES = {
  note: 'Nota interna',
  whatsapp: 'WhatsApp',
  call: 'Llamada',
  payment: 'Pago pendiente',
  size_request: 'Solicitud de talla',
  reminder: 'Recordatorio',
  complaint: 'Reclamo',
  task: 'Tarea',
  other: 'Otro',
};

const FOLLOW_UP_STATUSES = {
  pending: 'Pendiente',
  done: 'Realizado',
  cancelled: 'Cancelado',
};

const FOLLOW_UP_PRIORITIES = {
  low: 'Baja',
  normal: 'Normal',
  high: 'Alta',
  urgent: 'Urgente',
};

function cleanText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function cleanLower(value) {
  return cleanText(value).toLowerCase();
}

function toPositiveInt(value, fallback = 20, max = 100) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return fallback;
  return Math.min(Math.floor(number), max);
}

function escapeRegex(value) {
  return cleanText(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getAdminId(req) {
  const adminId = req.adminUserId || req.adminProfile?.id || null;
  return adminId && mongoose.Types.ObjectId.isValid(String(adminId)) ? adminId : null;
}

function createRouteError(message, code, statusCode = 400, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  error.details = details;
  return error;
}

function sendError(res, error) {
  const status = Number(error?.statusCode || error?.status || 500);

  if (status >= 500) {
    console.error('[adminCustomerFollowUpsRoutes] Error:', error);
  }

  return res.status(status).json({
    ok: false,
    error: error?.code || 'CUSTOMER_FOLLOW_UP_ROUTE_ERROR',
    message: error?.message || 'No se pudo procesar el seguimiento del cliente.',
    details: error?.details || {},
  });
}

function assertScopeAccess(access) {
  if (access?.ok) return access;
  throw createRouteError(
    access?.message || 'No tienes acceso a clientes de esa sede.',
    access?.error || 'CUSTOMER_BRANCH_FORBIDDEN',
    access?.status || 403,
    { branchIds: access?.branchIds || [] }
  );
}

async function loadCustomer(req, customerId) {
  if (!customerId || !mongoose.Types.ObjectId.isValid(String(customerId))) {
    throw createRouteError('Cliente no válido.', 'CUSTOMER_INVALID_ID', 400, { customerId });
  }

  const access = assertScopeAccess(
    buildScopedCustomerFilter(
      req,
      { _id: customerId, deletedAt: null },
      { requestedBranchId: req.query?.branchId }
    )
  );
  const customer = await Customer.findOne(access.filter);

  if (!customer) {
    throw createRouteError('Cliente no encontrado.', 'CUSTOMER_NOT_FOUND', 404, { customerId });
  }

  return customer;
}

function parseDueAt(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function buildFollowUpPayload(body = {}, current = {}) {
  const type = cleanLower(body.type ?? current.type ?? 'note');
  const status = cleanLower(body.status ?? current.status ?? 'pending');
  const priority = cleanLower(body.priority ?? current.priority ?? 'normal');
  const noteValue = body.note ?? body.message ?? body.comment ?? current.note;
  const hasDueAt = Object.prototype.hasOwnProperty.call(body, 'dueAt');

  return {
    type: Object.prototype.hasOwnProperty.call(FOLLOW_UP_TYPES, type) ? type : 'note',
    status: Object.prototype.hasOwnProperty.call(FOLLOW_UP_STATUSES, status) ? status : 'pending',
    priority: Object.prototype.hasOwnProperty.call(FOLLOW_UP_PRIORITIES, priority)
      ? priority
      : 'normal',
    note: cleanText(noteValue),
    nextAction: cleanText(body.nextAction ?? current.nextAction),
    dueAt: hasDueAt ? parseDueAt(body.dueAt) : current.dueAt || null,
  };
}

function serializeAdmin(admin) {
  if (!admin) return null;
  if (typeof admin !== 'object') return { id: String(admin), name: '' };

  const id = String(admin._id || admin.id || '');
  const name = cleanText(
    admin.displayName ||
      `${admin.firstName || ''} ${admin.lastName || ''}` ||
      admin.username
  );

  return {
    id,
    name: name || admin.username || '',
    username: admin.username || '',
    role: admin.role || '',
  };
}

function resolveFollowUpBranch(req, customer, requestedBranchId) {
  const access = assertScopeAccess(
    resolveCustomerWriteBranch(req, requestedBranchId)
  );
  const customerBranchIds = new Set(
    [
      ...(Array.isArray(customer.branchIds) ? customer.branchIds : []),
      customer.defaultBranch,
    ]
      .filter(Boolean)
      .map(String)
  );

  if (access.branchId && customerBranchIds.has(String(access.branchId))) {
    return access.branchId;
  }

  const allowedCustomerBranch = (access.branchIds || []).find((branchId) =>
    customerBranchIds.has(String(branchId))
  );

  return allowedCustomerBranch || String(customer.defaultBranch || '') || '';
}

function serializeFollowUp(followUp = {}, options = {}) {
  const raw = typeof followUp.toSafeObject === 'function'
    ? followUp.toSafeObject()
    : typeof followUp.toObject === 'function'
      ? followUp.toObject({ virtuals: true })
      : followUp;

  return {
    id: String(raw._id || raw.id || ''),
    customerId: String(
      raw.customer?._id || raw.customer?.id || raw.customer || raw.customerId || ''
    ),
    customer: raw.customer && typeof raw.customer === 'object'
      ? protectCustomerData({
          id: String(raw.customer._id || raw.customer.id || ''),
          customerCode: raw.customer.customerCode || '',
          fullName: raw.customer.fullName || raw.customer.displayName || '',
          phone: raw.customer.phone || '',
          email: raw.customer.email || '',
          crmStage: raw.customer.crmStage || 'new',
          crmPriority: raw.customer.crmPriority || 'normal',
        }, options.canViewSensitive === true)
      : null,
    type: raw.type || 'note',
    typeLabel: FOLLOW_UP_TYPES[raw.type] || 'Nota interna',
    status: raw.status || 'pending',
    statusLabel: FOLLOW_UP_STATUSES[raw.status] || 'Pendiente',
    priority: raw.priority || 'normal',
    priorityLabel: FOLLOW_UP_PRIORITIES[raw.priority] || 'Normal',
    note: raw.note || '',
    nextAction: raw.nextAction || '',
    branchId: raw.branch ? String(raw.branch) : null,
    createdByAdmin: serializeAdmin(raw.createdByAdmin),
    updatedByAdmin: serializeAdmin(raw.updatedByAdmin),
    assignedToAdmin: serializeAdmin(raw.assignedToAdmin),
    dueAt: raw.dueAt || null,
    doneAt: raw.doneAt || null,
    createdAt: raw.createdAt || null,
    updatedAt: raw.updatedAt || null,
  };
}

function bogotaDayRange(now = new Date()) {
  const offsetMs = 5 * 60 * 60 * 1000;
  const local = new Date(now.getTime() - offsetMs);
  const start = new Date(
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) +
      offsetMs
  );
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

function applyDueScope(filter, dueScope, range) {
  if (dueScope === 'overdue') filter.dueAt = { $lt: range.start };
  if (dueScope === 'today') filter.dueAt = { $gte: range.start, $lt: range.end };
  if (dueScope === 'upcoming') filter.dueAt = { $gte: range.end };
  if (dueScope === 'unscheduled') filter.dueAt = null;
  return filter;
}

async function resolveQueueCustomerIds(req, q, canViewSensitive = false) {
  const search = cleanText(q).slice(0, 120);
  if (!search) return null;

  const regex = new RegExp(escapeRegex(search), 'i');
  const customerAccess = assertScopeAccess(buildScopedCustomerFilter(req, {
    deletedAt: null,
    $or: [
      { fullName: regex },
      { displayName: regex },
      { customerCode: regex },
      ...(canViewSensitive
        ? [{ phone: regex }, { email: regex }, { documentNumber: regex }]
        : []),
    ],
  }));
  return Customer.find(customerAccess.filter).distinct('_id');
}

async function recordCompletedCustomerContact(customer, followUp, adminId) {
  if (!customer?._id || followUp?.status !== 'done') return;
  const contactAt = followUp.doneAt || new Date();
  await Customer.updateOne(
    { _id: customer._id, deletedAt: null },
    {
      $set: {
        crmLastContactAt: contactAt,
        crmLastContactType: followUp.type || 'other',
        crmUpdatedAt: new Date(),
        updatedByAdmin: adminId || null,
      },
    }
  );
}

router.use(requireAdmin);

router.get('/meta/assignees', requirePermission('customers:view'), async (req, res) => {
  try {
    const assignees = await listAssignableCrmAdmins(req, {
      branchId: req.query.branchId || '',
    });
    return res.json({ ok: true, assignees });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/queue', requirePermission('customers:view'), async (req, res) => {
  try {
    const canViewSensitive = await canViewSensitiveCustomerData(req);
    const page = toPositiveInt(req.query.page, 1, 5000);
    const limit = toPositiveInt(req.query.limit, 25, 100);
    const status = cleanLower(req.query.status || 'pending');
    const type = cleanLower(req.query.type || 'all');
    const priority = cleanLower(req.query.priority || 'all');
    const dueScope = cleanLower(req.query.dueScope || 'all');
    const assigned = cleanText(req.query.assignedTo || 'all');
    const customerIds = await resolveQueueCustomerIds(
      req,
      req.query.q,
      canViewSensitive
    );
    const filter = { deletedAt: null };

    if (status !== 'all' && FOLLOW_UP_STATUSES[status]) filter.status = status;
    if (type !== 'all' && FOLLOW_UP_TYPES[type]) filter.type = type;
    if (priority !== 'all' && FOLLOW_UP_PRIORITIES[priority]) {
      filter.priority = priority;
    }
    if (Array.isArray(customerIds)) filter.customer = { $in: customerIds };

    if (assigned === 'me') {
      const adminId = asAdminId(getAdminId(req));
      filter.assignedToAdmin = adminId
        ? new mongoose.Types.ObjectId(adminId)
        : null;
    } else if (assigned === 'unassigned') {
      filter.assignedToAdmin = null;
    } else if (assigned !== 'all') {
      const adminId = asAdminId(assigned);
      if (!adminId) {
        throw createRouteError(
          'El filtro de responsable no es válido.',
          'FOLLOW_UP_ASSIGNEE_FILTER_INVALID',
          400
        );
      }
      filter.assignedToAdmin = new mongoose.Types.ObjectId(adminId);
    }

    const access = assertScopeAccess(buildScopedFollowUpFilter(
      req,
      filter,
      { requestedBranchId: req.query.branchId }
    ));
    const range = bogotaDayRange();
    const summaryFilter = { ...access.filter, status: 'pending' };
    const queueFilter = applyDueScope({ ...access.filter }, dueScope, range);
    const skip = (page - 1) * limit;

    const [followUps, total, pending, overdue, today, upcoming, unscheduled] =
      await Promise.all([
        CustomerFollowUp.find(queueFilter)
          .sort({ priorityRank: -1, dueAt: 1, createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate(
            'customer',
            'customerCode fullName displayName phone email crmStage crmPriority'
          )
          .populate('createdByAdmin', 'username displayName firstName lastName role')
          .populate('updatedByAdmin', 'username displayName firstName lastName role')
          .populate('assignedToAdmin', 'username displayName firstName lastName role'),
        CustomerFollowUp.countDocuments(queueFilter),
        CustomerFollowUp.countDocuments(summaryFilter),
        CustomerFollowUp.countDocuments({
          ...summaryFilter,
          dueAt: { $lt: range.start },
        }),
        CustomerFollowUp.countDocuments({
          ...summaryFilter,
          dueAt: { $gte: range.start, $lt: range.end },
        }),
        CustomerFollowUp.countDocuments({
          ...summaryFilter,
          dueAt: { $gte: range.end },
        }),
        CustomerFollowUp.countDocuments({ ...summaryFilter, dueAt: null }),
      ]);

    return res.json({
      ok: true,
      followUps: followUps.map((followUp) =>
        serializeFollowUp(followUp, { canViewSensitive })
      ),
      summary: { pending, overdue, today, upcoming, unscheduled },
      total,
      page,
      limit,
      pages: Math.max(1, Math.ceil(total / limit)),
      filters: { status, type, priority, dueScope, assignedTo: assigned },
      access: { mode: access.mode, branchIds: access.branchIds },
      dataProtection: { sensitive: canViewSensitive, masked: !canViewSensitive },
    });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/:customerId', requirePermission('customers:view'), async (req, res) => {
  try {
    const customer = await loadCustomer(req, req.params.customerId);
    const canViewSensitive = await canViewSensitiveCustomerData(req);
    const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 50);
    const status = cleanLower(req.query.status || 'all');
    const filter = {
      customer: customer._id,
      deletedAt: null,
    };

    if (status && status !== 'all') {
      filter.status = status;
    }

    const access = assertScopeAccess(buildScopedFollowUpFilter(req, filter));
    const followUps = await CustomerFollowUp.find(access.filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('createdByAdmin', 'username displayName firstName lastName role')
      .populate('updatedByAdmin', 'username displayName firstName lastName role')
      .populate('assignedToAdmin', 'username displayName firstName lastName role');
    await recordCustomerAuditEvent({
      req,
      customer,
      eventType: 'viewed',
      action: 'Historial de seguimiento consultado',
      metadata: { followUpsReturned: followUps.length, status },
    });

    return res.json({
      ok: true,
      customerId: String(customer._id),
      followUps: followUps.map((followUp) =>
        serializeFollowUp(followUp, { canViewSensitive })
      ),
      dataProtection: { sensitive: canViewSensitive, masked: !canViewSensitive },
    });
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/:customerId', requirePermission('customers:update'), async (req, res) => {
  try {
    const customer = await loadCustomer(req, req.params.customerId);
    const canViewSensitive = await canViewSensitiveCustomerData(req);
    const payload = buildFollowUpPayload(req.body || {});

    if (!payload.note) {
      throw createRouteError('Debes escribir una nota de seguimiento.', 'FOLLOW_UP_NOTE_REQUIRED', 400);
    }

    const adminId = getAdminId(req);
    const branchId = resolveFollowUpBranch(
      req,
      customer,
      req.body?.branchId
    );
    const requestedAssignee = Object.prototype.hasOwnProperty.call(
      req.body || {},
      'assignedToAdmin'
    )
      ? req.body.assignedToAdmin
      : adminId;
    const assignedToAdmin = await resolveAssignableCrmAdmin(
      req,
      requestedAssignee,
      { branchId, allowUnassigned: true }
    );
    const followUp = await CustomerFollowUp.create({
      ...payload,
      customer: customer._id,
      branch: branchId || null,
      createdByAdmin: adminId,
      updatedByAdmin: adminId,
      assignedToAdmin,
    });
    await recordCompletedCustomerContact(customer, followUp, adminId);
    const createdSnapshot = followUp.toObject();
    await recordCustomerAuditEvent({
      req,
      customer,
      eventType: 'follow_up_created',
      action: 'Seguimiento CRM creado',
      changes: buildAuditChanges({}, { followUp: createdSnapshot }, [
        'followUp.type',
        'followUp.status',
        'followUp.priority',
        'followUp.note',
        'followUp.nextAction',
        'followUp.dueAt',
        'followUp.assignedToAdmin',
      ]),
      metadata: { followUpId: String(followUp._id) },
      branchId,
    });
    await followUp.populate([
      { path: 'createdByAdmin', select: 'username displayName firstName lastName role' },
      { path: 'updatedByAdmin', select: 'username displayName firstName lastName role' },
      { path: 'assignedToAdmin', select: 'username displayName firstName lastName role' },
    ]);

    return res.status(201).json({
      ok: true,
      followUp: serializeFollowUp(followUp, { canViewSensitive }),
    });
  } catch (error) {
    return sendError(res, error);
  }
});

router.put('/:customerId/:followUpId', requirePermission('customers:update'), async (req, res) => {
  try {
    const customer = await loadCustomer(req, req.params.customerId);
    const canViewSensitive = await canViewSensitiveCustomerData(req);

    if (!mongoose.Types.ObjectId.isValid(String(req.params.followUpId))) {
      throw createRouteError('Seguimiento no válido.', 'FOLLOW_UP_INVALID_ID', 400);
    }

    const access = assertScopeAccess(buildScopedFollowUpFilter(req, {
      _id: req.params.followUpId,
      customer: customer._id,
      deletedAt: null,
    }));
    const followUp = await CustomerFollowUp.findOne(access.filter);

    if (!followUp) {
      throw createRouteError('Seguimiento no encontrado.', 'FOLLOW_UP_NOT_FOUND', 404);
    }

    const before = followUp.toObject();

    const payload = buildFollowUpPayload(req.body || {}, followUp);

    if (!payload.note) {
      throw createRouteError('Debes escribir una nota de seguimiento.', 'FOLLOW_UP_NOTE_REQUIRED', 400);
    }

    Object.entries(payload).forEach(([key, value]) => {
      followUp[key] = value;
    });

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'assignedToAdmin')) {
      followUp.assignedToAdmin = await resolveAssignableCrmAdmin(
        req,
        req.body.assignedToAdmin,
        { branchId: followUp.branch, allowUnassigned: true }
      );
    }

    followUp.updatedByAdmin = getAdminId(req);
    await followUp.save();
    await recordCompletedCustomerContact(
      customer,
      followUp,
      followUp.updatedByAdmin
    );
    const after = followUp.toObject();
    await recordCustomerAuditEvent({
      req,
      customer,
      eventType: 'follow_up_updated',
      action: 'Seguimiento CRM actualizado',
      changes: buildAuditChanges(
        { followUp: before },
        { followUp: after },
        [
          'followUp.type',
          'followUp.status',
          'followUp.priority',
          'followUp.note',
          'followUp.nextAction',
          'followUp.dueAt',
          'followUp.assignedToAdmin',
        ]
      ),
      metadata: { followUpId: String(followUp._id) },
      branchId: followUp.branch,
    });
    await followUp.populate([
      { path: 'createdByAdmin', select: 'username displayName firstName lastName role' },
      { path: 'updatedByAdmin', select: 'username displayName firstName lastName role' },
      { path: 'assignedToAdmin', select: 'username displayName firstName lastName role' },
    ]);

    return res.json({
      ok: true,
      followUp: serializeFollowUp(followUp, { canViewSensitive }),
    });
  } catch (error) {
    return sendError(res, error);
  }
});

router.delete('/:customerId/:followUpId', requirePermission('customers:update'), async (req, res) => {
  try {
    const customer = await loadCustomer(req, req.params.customerId);

    if (!mongoose.Types.ObjectId.isValid(String(req.params.followUpId))) {
      throw createRouteError('Seguimiento no válido.', 'FOLLOW_UP_INVALID_ID', 400);
    }

    const access = assertScopeAccess(buildScopedFollowUpFilter(req, {
      _id: req.params.followUpId,
      customer: customer._id,
      deletedAt: null,
    }));
    const followUp = await CustomerFollowUp.findOne(access.filter);

    if (!followUp) {
      throw createRouteError('Seguimiento no encontrado.', 'FOLLOW_UP_NOT_FOUND', 404);
    }


    const before = followUp.toObject();

    followUp.deletedAt = new Date();
    followUp.updatedByAdmin = getAdminId(req);
    await followUp.save();
    await recordCustomerAuditEvent({
      req,
      customer,
      eventType: 'follow_up_deleted',
      action: 'Seguimiento CRM eliminado lógicamente',
      changes: buildAuditChanges(
        { followUp: before },
        { followUp: followUp.toObject() },
        ['followUp.deletedAt']
      ),
      metadata: { followUpId: String(followUp._id) },
      branchId: followUp.branch,
    });

    return res.json({ ok: true });
  } catch (error) {
    return sendError(res, error);
  }
});

module.exports = router;
