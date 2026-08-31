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

function cleanText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function cleanLower(value) {
  return cleanText(value).toLowerCase();
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

function buildFollowUpPayload(body = {}) {
  const type = cleanLower(body.type || 'note');
  const status = cleanLower(body.status || 'pending');

  return {
    type: Object.prototype.hasOwnProperty.call(FOLLOW_UP_TYPES, type) ? type : 'note',
    status: Object.prototype.hasOwnProperty.call(FOLLOW_UP_STATUSES, status) ? status : 'pending',
    note: cleanText(body.note || body.message || body.comment),
    nextAction: cleanText(body.nextAction),
    dueAt: parseDueAt(body.dueAt),
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

function serializeFollowUp(followUp = {}) {
  const raw = typeof followUp.toSafeObject === 'function'
    ? followUp.toSafeObject()
    : typeof followUp.toObject === 'function'
      ? followUp.toObject({ virtuals: true })
      : followUp;

  return {
    id: String(raw._id || raw.id || ''),
    customerId: String(raw.customer || raw.customerId || ''),
    type: raw.type || 'note',
    typeLabel: FOLLOW_UP_TYPES[raw.type] || 'Nota interna',
    status: raw.status || 'pending',
    statusLabel: FOLLOW_UP_STATUSES[raw.status] || 'Pendiente',
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

router.use(requireAdmin);

router.get('/:customerId', requirePermission('customers:view'), async (req, res) => {
  try {
    const customer = await loadCustomer(req, req.params.customerId);
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

    return res.json({
      ok: true,
      customerId: String(customer._id),
      followUps: followUps.map(serializeFollowUp),
    });
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/:customerId', requirePermission('customers:update'), async (req, res) => {
  try {
    const customer = await loadCustomer(req, req.params.customerId);
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
    const followUp = await CustomerFollowUp.create({
      ...payload,
      customer: customer._id,
      branch: branchId || null,
      createdByAdmin: adminId,
      updatedByAdmin: adminId,
      assignedToAdmin: adminId,
    });
    await followUp.populate([
      { path: 'createdByAdmin', select: 'username displayName firstName lastName role' },
      { path: 'updatedByAdmin', select: 'username displayName firstName lastName role' },
      { path: 'assignedToAdmin', select: 'username displayName firstName lastName role' },
    ]);

    return res.status(201).json({
      ok: true,
      followUp: serializeFollowUp(followUp),
    });
  } catch (error) {
    return sendError(res, error);
  }
});

router.put('/:customerId/:followUpId', requirePermission('customers:update'), async (req, res) => {
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

    const payload = buildFollowUpPayload(req.body || {});

    if (!payload.note) {
      throw createRouteError('Debes escribir una nota de seguimiento.', 'FOLLOW_UP_NOTE_REQUIRED', 400);
    }

    Object.entries(payload).forEach(([key, value]) => {
      followUp[key] = value;
    });

    followUp.updatedByAdmin = getAdminId(req);
    await followUp.save();
    await followUp.populate([
      { path: 'createdByAdmin', select: 'username displayName firstName lastName role' },
      { path: 'updatedByAdmin', select: 'username displayName firstName lastName role' },
      { path: 'assignedToAdmin', select: 'username displayName firstName lastName role' },
    ]);

    return res.json({
      ok: true,
      followUp: serializeFollowUp(followUp),
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

    followUp.deletedAt = new Date();
    followUp.updatedByAdmin = getAdminId(req);
    await followUp.save();

    return res.json({ ok: true });
  } catch (error) {
    return sendError(res, error);
  }
});

module.exports = router;
