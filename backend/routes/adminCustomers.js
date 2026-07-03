// backend/routes/adminCustomers.js

const express = require('express');
const mongoose = require('mongoose');

const requireAdmin = require('../middleware/requireAdmin');
const requirePermission = require('../middleware/requirePermission');
const Customer = require('../models/Customer');

const router = express.Router();

function cleanText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function cleanLower(value) {
  return cleanText(value).toLowerCase();
}

function escapeRegex(value) {
  return cleanText(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toPositiveInt(value, fallback = 20, max = 100) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return fallback;
  return Math.min(Math.floor(number), max);
}

function getAdminId(req) {
  const adminId = req.adminUserId || req.adminProfile?.id || null;
  return adminId && mongoose.Types.ObjectId.isValid(String(adminId)) ? adminId : null;
}

function serializeCustomer(customer = {}) {
  const raw = typeof customer.toSafeObject === 'function'
    ? customer.toSafeObject()
    : typeof customer.toObject === 'function'
      ? customer.toObject({ virtuals: true })
      : customer;

  return {
    id: String(raw._id || raw.id || ''),
    customerCode: raw.customerCode || '',
    firstName: raw.firstName || '',
    lastName: raw.lastName || '',
    fullName: raw.fullName || raw.displayName || '',
    displayName: raw.displayName || raw.fullName || '',
    phone: raw.phone || '',
    email: raw.email || '',
    documentType: raw.documentType || '',
    documentNumber: raw.documentNumber || '',
    address: raw.address || '',
    city: raw.city || '',
    department: raw.department || '',
    country: raw.country || 'CO',
    postalCode: raw.postalCode || '',
    source: raw.source || 'admin',
    status: raw.status || 'active',
    active: raw.active !== false,
    acceptsMarketing: raw.acceptsMarketing === true,
    notes: raw.notes || '',
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    stats: raw.stats || {},
    createdAt: raw.createdAt || null,
    updatedAt: raw.updatedAt || null,
  };
}

function buildCustomerPayload(body = {}, req, isCreate = false) {
  const source = cleanLower(body.source || (isCreate ? 'admin' : ''));
  const status = cleanLower(body.status || '');
  const payload = {
    firstName: cleanText(body.firstName),
    lastName: cleanText(body.lastName),
    fullName: cleanText(body.fullName || body.name || `${cleanText(body.firstName)} ${cleanText(body.lastName)}`),
    displayName: cleanText(body.displayName || body.fullName || body.name),
    phone: cleanText(body.phone || body.cellphone || body.mobile),
    email: cleanLower(body.email),
    documentType: cleanText(body.documentType),
    documentNumber: cleanText(body.documentNumber || body.document || body.identification),
    address: cleanText(body.address),
    city: cleanText(body.city),
    department: cleanText(body.department),
    country: cleanText(body.country || 'CO'),
    postalCode: cleanText(body.postalCode),
    acceptsMarketing: body.acceptsMarketing === true,
    notes: cleanText(body.notes),
    tags: Array.isArray(body.tags) ? body.tags : [],
  };

  if (source) payload.source = source;
  if (status) payload.status = status;

  if (isCreate) {
    payload.createdByAdmin = getAdminId(req);
  } else {
    payload.updatedByAdmin = getAdminId(req);
  }

  return payload;
}

function buildCustomerFilter(query = {}) {
  const filter = {
    deletedAt: null,
  };

  const q = cleanText(query.q || '').slice(0, 120);
  const status = cleanLower(query.status || '');
  const source = cleanLower(query.source || '');

  if (status && status !== 'all') filter.status = status;
  if (source && source !== 'all') filter.source = source;

  if (q) {
    const regex = new RegExp(escapeRegex(q), 'i');
    filter.$or = [
      { fullName: regex },
      { displayName: regex },
      { phone: regex },
      { email: regex },
      { documentNumber: regex },
      { customerCode: regex },
    ];
  }

  return { filter, q };
}

function sendError(res, error) {
  const status = Number(error?.statusCode || error?.status || 500);

  if (status >= 500) {
    console.error('[adminCustomersRoutes] Error:', error);
  }

  return res.status(status).json({
    ok: false,
    error: error?.code || 'CUSTOMERS_ROUTE_ERROR',
    message: error?.message || 'No se pudo procesar la solicitud de clientes.',
    details: error?.details || {},
  });
}

function createRouteError(message, code, statusCode = 400, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  error.details = details;
  return error;
}

async function loadCustomer(customerId) {
  if (!customerId || !mongoose.Types.ObjectId.isValid(String(customerId))) {
    throw createRouteError('Cliente no válido.', 'CUSTOMER_INVALID_ID', 400, { customerId });
  }

  const customer = await Customer.findOne({
    _id: customerId,
    deletedAt: null,
  });

  if (!customer) {
    throw createRouteError('Cliente no encontrado.', 'CUSTOMER_NOT_FOUND', 404, { customerId });
  }

  return customer;
}

router.use(requireAdmin);

router.get('/', requirePermission('customers:view'), async (req, res) => {
  try {
    const page = toPositiveInt(req.query.page, 1, 5000);
    const limit = toPositiveInt(req.query.limit, 20, 100);
    const skip = (page - 1) * limit;
    const { filter, q } = buildCustomerFilter(req.query);

    const [customers, total] = await Promise.all([
      Customer.find(filter)
        .sort(q ? { fullName: 1 } : { updatedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Customer.countDocuments(filter),
    ]);

    return res.json({
      ok: true,
      customers: customers.map(serializeCustomer),
      total,
      page,
      limit,
      pages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/', requirePermission('customers:create'), async (req, res) => {
  try {
    const payload = buildCustomerPayload(req.body || {}, req, true);
    const customer = await Customer.create(payload);

    return res.status(201).json({
      ok: true,
      customer: serializeCustomer(customer),
    });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/:id', requirePermission('customers:view'), async (req, res) => {
  try {
    const customer = await loadCustomer(req.params.id);

    return res.json({
      ok: true,
      customer: serializeCustomer(customer),
    });
  } catch (error) {
    return sendError(res, error);
  }
});

router.put('/:id', requirePermission('customers:update'), async (req, res) => {
  try {
    const customer = await loadCustomer(req.params.id);
    const payload = buildCustomerPayload(req.body || {}, req, false);

    Object.entries(payload).forEach(([key, value]) => {
      if (value !== undefined) customer[key] = value;
    });

    await customer.save();

    return res.json({
      ok: true,
      customer: serializeCustomer(customer),
    });
  } catch (error) {
    return sendError(res, error);
  }
});

module.exports = router;
