// backend/routes/adminCustomers.js

const express = require('express');
const mongoose = require('mongoose');

const requireAdmin = require('../middleware/requireAdmin');
const requirePermission = require('../middleware/requirePermission');
const Customer = require('../models/Customer');
const Order = require('../models/Order');

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

function onlyDigits(value) {
  return cleanText(value).replace(/\D/g, '');
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

function serializeCustomerOrder(order = {}) {
  const raw = typeof order.toObject === 'function' ? order.toObject({ virtuals: true }) : order;

  return {
    id: String(raw._id || raw.id || ''),
    orderNumber: raw.orderNumber || '',
    source: raw.source || '',
    channel: raw.channel || '',
    saleType: raw.saleType || '',
    status: raw.status || '',
    fulfillmentStatus: raw.fulfillmentStatus || '',
    total: Number(raw.total || 0),
    subtotal: Number(raw.subtotal || 0),
    createdAt: raw.createdAt || null,
    paidAt: raw.payment?.paidAt || null,
    paymentMethod: raw.payment?.method || raw.payment?.methodType || '',
    paymentLabel: raw.payment?.methodLabel || raw.payment?.method || '',
    branch: raw.branchSnapshot || {},
    receiptNumber: raw.pos?.receiptNumber || '',
    invoiceNumber: raw.electronicInvoice?.number || raw.invoice?.number || raw.billing?.invoiceNumber || '',
    itemsCount: Number(raw.summary?.totalItems || raw.summary?.itemsCount || (Array.isArray(raw.items) ? raw.items.length : 0)),
    items: Array.isArray(raw.items)
      ? raw.items.slice(0, 6).map((item) => ({
          title: item.title || '',
          quantity: Number(item.quantity || item.qty || 0),
          size: item.size || '',
          color: item.color || '',
          unitPrice: Number(item.unitPrice || item.price || 0),
        }))
      : [],
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

function applyCustomerSegment(filter, segment) {
  const cleanSegment = cleanLower(segment);

  if (!cleanSegment || cleanSegment === 'all') return filter;

  if (['with-purchases', 'with_purchases', 'buyers', 'compradores'].includes(cleanSegment)) {
    filter['stats.ordersCount'] = { $gt: 0 };
    return filter;
  }

  if (['without-purchases', 'without_purchases', 'no-purchases', 'sin-compras'].includes(cleanSegment)) {
    filter.$and = [
      ...(Array.isArray(filter.$and) ? filter.$and : []),
      {
        $or: [
          { 'stats.ordersCount': { $exists: false } },
          { 'stats.ordersCount': { $lte: 0 } },
        ],
      },
    ];
    return filter;
  }

  if (['with-email', 'with_email', 'con-correo'].includes(cleanSegment)) {
    filter.email = { $exists: true, $ne: '' };
    return filter;
  }

  if (['without-email', 'without_email', 'sin-correo'].includes(cleanSegment)) {
    filter.$and = [
      ...(Array.isArray(filter.$and) ? filter.$and : []),
      {
        $or: [
          { email: { $exists: false } },
          { email: '' },
        ],
      },
    ];
    return filter;
  }

  return filter;
}

function buildCustomerFilter(query = {}) {
  const filter = {
    deletedAt: null,
  };

  const q = cleanText(query.q || '').slice(0, 120);
  const status = cleanLower(query.status || '');
  const source = cleanLower(query.source || '');
  const segment = cleanLower(query.segment || '');

  if (status && status !== 'all') filter.status = status;
  if (source && source !== 'all') filter.source = source;

  applyCustomerSegment(filter, segment);

  if (q) {
    const regex = new RegExp(escapeRegex(q), 'i');
    const searchFilter = {
      $or: [
        { fullName: regex },
        { displayName: regex },
        { phone: regex },
        { email: regex },
        { documentNumber: regex },
        { customerCode: regex },
      ],
    };

    filter.$and = [
      ...(Array.isArray(filter.$and) ? filter.$and : []),
      searchFilter,
    ];
  }

  return { filter, q, segment };
}

function buildCustomerOrdersFilter(customer = {}) {
  const raw = typeof customer.toObject === 'function' ? customer.toObject() : customer;
  const filters = [];
  const id = String(raw._id || raw.id || '');
  const email = cleanLower(raw.email || '');
  const phone = cleanText(raw.phone || '');
  const doc = cleanText(raw.documentNumber || '');
  const normalizedPhone = onlyDigits(phone);
  const normalizedDoc = onlyDigits(doc);

  if (id) filters.push({ 'customer.customerId': id });
  if (email) filters.push({ 'customer.email': email }, { 'billing.email': email });
  if (phone) filters.push({ 'customer.phone': phone }, { 'billing.phone': phone });
  if (normalizedPhone && normalizedPhone !== phone) filters.push({ 'customer.phone': normalizedPhone }, { 'billing.phone': normalizedPhone });
  if (doc) filters.push({ 'customer.id': doc }, { 'billing.id': doc });
  if (normalizedDoc && normalizedDoc !== doc) filters.push({ 'customer.id': normalizedDoc }, { 'billing.id': normalizedDoc });

  if (raw.stats?.lastOrder && mongoose.Types.ObjectId.isValid(String(raw.stats.lastOrder))) {
    filters.push({ _id: raw.stats.lastOrder });
  }

  return filters.length > 0 ? { $or: filters } : { _id: null };
}

async function loadCustomerOrders(customer, limit = 10) {
  const orders = await Order.find(buildCustomerOrdersFilter(customer))
    .sort({ createdAt: -1 })
    .limit(toPositiveInt(limit, 10, 30))
    .lean();

  return orders.map(serializeCustomerOrder);
}

async function buildCustomersSummary() {
  const base = { deletedAt: null, status: 'active' };
  const withoutPurchasesFilter = {
    ...base,
    $or: [
      { 'stats.ordersCount': { $exists: false } },
      { 'stats.ordersCount': { $lte: 0 } },
    ],
  };
  const withoutEmailFilter = {
    ...base,
    $or: [
      { email: { $exists: false } },
      { email: '' },
    ],
  };

  const [
    totalCustomers,
    posCustomers,
    webCustomers,
    adminCustomers,
    withPurchases,
    withoutPurchases,
    withEmail,
    withoutEmail,
    totalSpentAgg,
    newestCustomer,
  ] = await Promise.all([
    Customer.countDocuments(base),
    Customer.countDocuments({ ...base, source: 'pos' }),
    Customer.countDocuments({ ...base, source: 'web' }),
    Customer.countDocuments({ ...base, source: 'admin' }),
    Customer.countDocuments({ ...base, 'stats.ordersCount': { $gt: 0 } }),
    Customer.countDocuments(withoutPurchasesFilter),
    Customer.countDocuments({ ...base, email: { $exists: true, $ne: '' } }),
    Customer.countDocuments(withoutEmailFilter),
    Customer.aggregate([
      { $match: base },
      {
        $group: {
          _id: null,
          totalSpent: { $sum: { $ifNull: ['$stats.totalSpent', 0] } },
          totalOrders: { $sum: { $ifNull: ['$stats.ordersCount', 0] } },
          posOrders: { $sum: { $ifNull: ['$stats.posOrdersCount', 0] } },
          webOrders: { $sum: { $ifNull: ['$stats.webOrdersCount', 0] } },
        },
      },
    ]),
    Customer.findOne(base).sort({ createdAt: -1 }),
  ]);

  const moneyStats = totalSpentAgg?.[0] || {};

  return {
    totalCustomers,
    posCustomers,
    webCustomers,
    adminCustomers,
    withPurchases,
    withoutPurchases,
    withEmail,
    withoutEmail,
    totalSpent: Number(moneyStats.totalSpent || 0),
    totalOrders: Number(moneyStats.totalOrders || 0),
    posOrders: Number(moneyStats.posOrders || 0),
    webOrders: Number(moneyStats.webOrders || 0),
    newestCustomer: newestCustomer ? serializeCustomer(newestCustomer) : null,
  };
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
    const { filter, q, segment } = buildCustomerFilter(req.query);

    const [customers, total, summary] = await Promise.all([
      Customer.find(filter)
        .sort(q ? { fullName: 1 } : { updatedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Customer.countDocuments(filter),
      buildCustomersSummary(),
    ]);

    return res.json({
      ok: true,
      customers: customers.map(serializeCustomer),
      summary,
      total,
      page,
      limit,
      pages: Math.max(1, Math.ceil(total / limit)),
      filters: {
        segment: segment || 'all',
        source: cleanLower(req.query.source || 'all') || 'all',
        status: cleanLower(req.query.status || 'active') || 'active',
      },
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
    const recentOrders = await loadCustomerOrders(customer, req.query.ordersLimit || 10);

    return res.json({
      ok: true,
      customer: serializeCustomer(customer),
      recentOrders,
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
