// backend/routes/adminCustomerFollowUps.js

const express = require('express');
const mongoose = require('mongoose');

const requireAdmin = require('../middleware/requireAdmin');
const requirePermission = require('../middleware/requirePermission');
const Customer = require('../models/Customer');
const CustomerFollowUp = require('../models/CustomerFollowUp');

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

async function loadCustomer(customerId) {
  if (!customerId || !mongoose.Types.ObjectId.isValid(String(customerId))) {
    throw createRouteError('Cliente no válido.', 'CUSTOMER_INVALID_ID', 400, { customerId });
  }

  const customer = await Customer.findOne({ _id: customerId, deletedAt: null });

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
    dueAt: raw.dueAt || null,
    doneAt: raw.doneAt || null,
    createdAt: raw.createdAt || null,
    updatedAt: raw.updatedAt || null,
  };
}

router.use(requireAdmin);

router.get('/:customerId', requirePermission('customers:view'), async (req, res) => {
  try {
    const customer = await loadCustomer(req.params.customerId);
    const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 50);
    const status = cleanLower(req.query.status || 'all');
    const filter = {
      customer: customer._id,
      deletedAt: null,
    };

    if (status && status !== 'all') {
      filter.status = status;
    }

    const followUps = await CustomerFollowUp.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit);

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
    const customer = await loadCustomer(req.params.customerId);
    const payload = buildFollowUpPayload(req.body || {});

    if (!payload.note) {
      throw createRouteError('Debes escribir una nota de seguimiento.', 'FOLLOW_UP_NOTE_REQUIRED', 400);
    }

    const followUp = await CustomerFollowUp.create({
      ...payload,
      customer: customer._id,
      createdByAdmin: getAdminId(req),
      updatedByAdmin: getAdminId(req),
    });

    customer.notes = payload.note;
    customer.updatedByAdmin = getAdminId(req);
    await customer.save();

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
    const customer = await loadCustomer(req.params.customerId);

    if (!mongoose.Types.ObjectId.isValid(String(req.params.followUpId))) {
      throw createRouteError('Seguimiento no válido.', 'FOLLOW_UP_INVALID_ID', 400);
    }

    const followUp = await CustomerFollowUp.findOne({
      _id: req.params.followUpId,
      customer: customer._id,
      deletedAt: null,
    });

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
    const customer = await loadCustomer(req.params.customerId);

    if (!mongoose.Types.ObjectId.isValid(String(req.params.followUpId))) {
      throw createRouteError('Seguimiento no válido.', 'FOLLOW_UP_INVALID_ID', 400);
    }

    const followUp = await CustomerFollowUp.findOne({
      _id: req.params.followUpId,
      customer: customer._id,
      deletedAt: null,
    });

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
