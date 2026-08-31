// backend/routes/adminCustomers.js

const express = require('express');
const mongoose = require('mongoose');

const requireAdmin = require('../middleware/requireAdmin');
const requirePermission = require('../middleware/requirePermission');
const Customer = require('../models/Customer');
const Order = require('../models/Order');
const {
  buildCustomerIdentity,
  cleanLower,
  cleanPhone,
  cleanText,
  cleanUpper,
  duplicateFieldFromError,
  isMongoDuplicateKeyError,
  normalizeDocumentNumber,
  normalizePhone,
} = require('../lib/customers/customerIdentity');
const {
  buildScopedCustomerFilter,
  resolveCustomerWriteBranch,
} = require('../services/customerAdminScopeService');
const {
  buildScopedOrderFilter,
  canAdminSeeAllBranches,
} = require('../services/orderAdminScopeService');

const router = express.Router();

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

function serializeCustomer(customer = {}, options = {}) {
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
    addresses: Array.isArray(raw.addresses) ? raw.addresses : [],
    fiscalProfile: raw.fiscalProfile || {},
    source: raw.source || 'admin',
    status: raw.status || 'active',
    active: raw.active !== false,
    acceptsMarketing: raw.acceptsMarketing === true,
    notes: raw.notes || '',
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    defaultBranch: raw.defaultBranch ? String(raw.defaultBranch) : null,
    branchIds: Array.isArray(raw.branchIds)
      ? raw.branchIds.map((branchId) => String(branchId))
      : [],
    stats: options.stats || raw.stats || {},
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
    addresses: Array.isArray(body.addresses) ? body.addresses : [],
    fiscalProfile: {
      personType: cleanLower(body.fiscalProfile?.personType || body.personType),
      businessName: cleanText(body.fiscalProfile?.businessName || body.businessName),
      verificationDigit: cleanText(
        body.fiscalProfile?.verificationDigit || body.fiscalProfile?.dv || body.dv
      )
        .replace(/\D/g, '')
        .slice(0, 1),
      municipalityCode: cleanText(
        body.fiscalProfile?.municipalityCode ||
          body.fiscalProfile?.cityCode ||
          body.municipalityCode ||
          body.cityCode
      ),
      departmentCode: cleanText(
        body.fiscalProfile?.departmentCode || body.departmentCode
      ),
      countryCode: cleanUpper(
        body.fiscalProfile?.countryCode || body.countryCode || body.country || 'CO'
      ),
      tributeCode: cleanUpper(
        body.fiscalProfile?.tributeCode || body.tributeCode || 'ZZ'
      ),
      taxRegime: cleanText(
        body.fiscalProfile?.taxRegime || body.taxRegime
      ),
      taxResponsibilities: Array.isArray(
        body.fiscalProfile?.taxResponsibilities
      )
        ? body.fiscalProfile.taxResponsibilities
        : [],
    },
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

function buildDuplicateFilters(payload = {}) {
  const identity = buildCustomerIdentity(payload);
  const filters = [];

  if (identity.normalizedDocument) {
    filters.push({
      key: 'document',
      label: 'documento',
      value: identity.normalizedDocument,
      query: {
        normalizedDocument: identity.normalizedDocument,
        ...(identity.documentType ? { documentType: identity.documentType } : {}),
      },
    });
  }

  if (identity.normalizedPhone) {
    filters.push({
      key: 'phone',
      label: 'celular',
      value: identity.normalizedPhone,
      query: { normalizedPhone: identity.normalizedPhone },
    });
  }

  if (identity.normalizedEmail) {
    filters.push({
      key: 'email',
      label: 'correo',
      value: identity.normalizedEmail,
      query: { normalizedEmail: identity.normalizedEmail },
    });
  }

  return filters;
}

async function findCustomerDuplicate(payload = {}, excludeId = null) {
  const filters = buildDuplicateFilters(payload);
  const requestedIdentity = buildCustomerIdentity(payload);
  if (!filters.length) return null;

  const base = {
    deletedAt: null,
    ...(excludeId && mongoose.Types.ObjectId.isValid(String(excludeId))
      ? { _id: { $ne: excludeId } }
      : {}),
  };

  const existingCustomers = await Customer.find({
    ...base,
    $or: filters.map((filter) => filter.query),
  })
    .sort({ updatedAt: -1, createdAt: -1 })
    .limit(10);

  if (!existingCustomers.length) return null;

  const conflicts = [];

  existingCustomers.forEach((customer) => {
    const raw = typeof customer.toObject === 'function' ? customer.toObject() : customer;

    filters.forEach((filter) => {
      if (filter.key === 'document') {
        const sameDocument =
          cleanUpper(raw.documentType) === requestedIdentity.documentType &&
          raw.normalizedDocument === filter.value;
        if (sameDocument) conflicts.push({ field: 'documentNumber', label: 'documento', value: raw.documentNumber || filter.value });
      }

      if (filter.key === 'phone' && raw.normalizedPhone === filter.value) {
        conflicts.push({ field: 'phone', label: 'celular', value: raw.phone || filter.value });
      }

      if (filter.key === 'email' && raw.normalizedEmail === filter.value) {
        conflicts.push({ field: 'email', label: 'correo', value: raw.email || filter.value });
      }
    });
  });

  const uniqueConflicts = Array.from(
    new Map(conflicts.map((item) => [`${item.field}:${item.value}`, item])).values()
  );

  if (!uniqueConflicts.length) return null;

  return {
    customer: existingCustomers[0],
    conflicts: uniqueConflicts,
  };
}

async function assertCustomerIsUnique(
  payload = {},
  excludeId = null,
  { exposeExistingCustomer = false } = {}
) {
  const duplicate = await findCustomerDuplicate(payload, excludeId);
  if (!duplicate) return;

  const fields = duplicate.conflicts.map((item) => item.label).join(', ');
  const customer = serializeCustomer(duplicate.customer);
  const message = exposeExistingCustomer
    ? `Ya existe un cliente registrado con el mismo ${fields}. Revisa el cliente ${customer.customerCode || customer.fullName}.`
    : `Ya existe un cliente registrado con el mismo ${fields}. Solicita a un administrador autorizado que revise la ficha existente.`;

  throw createRouteError(
    message,
    'CUSTOMER_DUPLICATE',
    409,
    {
      conflicts: duplicate.conflicts,
      ...(exposeExistingCustomer ? { existingCustomer: customer } : {}),
    }
  );
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

function isPurchaseSegment(segment) {
  const cleanSegment = cleanLower(segment);
  return [
    'with-purchases',
    'with_purchases',
    'buyers',
    'compradores',
    'without-purchases',
    'without_purchases',
    'no-purchases',
    'sin-compras',
  ].includes(cleanSegment);
}

function buildCustomerFilter(query = {}, options = {}) {
  const filter = {
    deletedAt: null,
  };

  const q = cleanText(query.q || '').slice(0, 120);
  const status = cleanLower(query.status || '');
  const source = cleanLower(query.source || '');
  const segment = cleanLower(query.segment || '');

  if (status && status !== 'all') filter.status = status;
  if (source && source !== 'all') filter.source = source;

  if (!(options.deferPurchaseSegment && isPurchaseSegment(segment))) {
    applyCustomerSegment(filter, segment);
  }

  if (q) {
    const nameRegex = new RegExp(escapeRegex(q), 'i');
    const normalizedEmail = cleanLower(q, 180);
    const normalizedPhone = normalizePhone(q);
    const normalizedDocument = normalizeDocumentNumber(q, 'OTHER');
    const customerCode = cleanUpper(q, 80);
    const searchFilter = {
      $or: [
        { fullName: nameRegex },
        { displayName: nameRegex },
        ...(normalizedPhone
          ? [{ normalizedPhone: new RegExp(`^${escapeRegex(normalizedPhone)}`) }]
          : []),
        ...(normalizedEmail
          ? [{ normalizedEmail: new RegExp(`^${escapeRegex(normalizedEmail)}`) }]
          : []),
        ...(normalizedDocument
          ? [{ normalizedDocument: new RegExp(`^${escapeRegex(normalizedDocument)}`) }]
          : []),
        ...(customerCode
          ? [{ customerCode: new RegExp(`^${escapeRegex(customerCode)}`) }]
          : []),
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
  const normalizedPhone = normalizePhone(phone, {
    defaultCountry: raw.country || 'CO',
  });
  const normalizedDoc = normalizeDocumentNumber(doc, raw.documentType);

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

async function loadCustomerOrders(req, customer, limit = 10) {
  const access = buildScopedOrderFilter(
    req,
    buildCustomerOrdersFilter(customer),
    { requestedBranchId: req.query?.branchId || '' }
  );

  if (!access.ok) {
    throw createRouteError(
      access.message,
      access.error,
      access.status,
      { branchIds: access.branchIds || [] }
    );
  }

  const orders = await Order.find(access.filter)
    .sort({ createdAt: -1 })
    .limit(toPositiveInt(limit, 10, 30))
    .lean();

  return orders.map(serializeCustomerOrder);
}

function buildConfirmedOrderFilter(customerIds = null) {
  return {
    ...(Array.isArray(customerIds)
      ? {
          'customer.customerId': {
            $in: customerIds.map(
              (id) => new mongoose.Types.ObjectId(String(id))
            ),
          },
        }
      : { 'customer.customerId': { $ne: null } }),
    $or: [
      { 'payment.status': 'paid' },
      { status: { $in: ['paid', 'shipped', 'delivered', 'refunded'] } },
    ],
  };
}

async function applyScopedPurchaseSegment(req, filter, segment, access) {
  if (access.mode === 'all' || !isPurchaseSegment(segment)) return filter;

  const orderAccess = buildScopedOrderFilter(
    req,
    buildConfirmedOrderFilter(),
    { requestedBranchId: req.query?.branchId || '' }
  );
  assertScopeAccess(orderAccess);
  const purchasingCustomerIds = await Order.distinct(
    'customer.customerId',
    orderAccess.filter
  );
  const withoutPurchases = [
    'without-purchases',
    'without_purchases',
    'no-purchases',
    'sin-compras',
  ].includes(cleanLower(segment));

  filter._id = withoutPurchases
    ? { $nin: purchasingCustomerIds }
    : { $in: purchasingCustomerIds };
  return filter;
}

async function loadScopedCustomerStats(req, customerIds = [], access = {}) {
  if (access.mode === 'all' || !customerIds.length) return null;

  const orderAccess = buildScopedOrderFilter(
    req,
    buildConfirmedOrderFilter(customerIds),
    { requestedBranchId: req.query?.branchId || '' }
  );
  assertScopeAccess(orderAccess);

  const rows = await Order.aggregate([
    { $match: orderAccess.filter },
    { $sort: { createdAt: 1, _id: 1 } },
    {
      $group: {
        _id: '$customer.customerId',
        ordersCount: { $sum: 1 },
        posOrdersCount: {
          $sum: { $cond: [{ $eq: ['$source', 'pos'] }, 1, 0] },
        },
        webOrdersCount: {
          $sum: { $cond: [{ $eq: ['$source', 'pos'] }, 0, 1] },
        },
        totalSpent: { $sum: { $ifNull: ['$total', 0] } },
        firstPurchaseAt: {
          $first: { $ifNull: ['$payment.paidAt', '$createdAt'] },
        },
        lastPurchaseAt: {
          $last: { $ifNull: ['$payment.paidAt', '$createdAt'] },
        },
        lastOrder: { $last: '$_id' },
        lastOrderNumber: { $last: '$orderNumber' },
      },
    },
  ]);

  return new Map(
    rows.map((row) => [
      String(row._id),
      {
        ordersCount: Number(row.ordersCount || 0),
        posOrdersCount: Number(row.posOrdersCount || 0),
        webOrdersCount: Number(row.webOrdersCount || 0),
        totalSpent: Number(row.totalSpent || 0),
        firstPurchaseAt: row.firstPurchaseAt || null,
        lastPurchaseAt: row.lastPurchaseAt || null,
        lastOrder: row.lastOrder || null,
        lastOrderNumber: row.lastOrderNumber || '',
      },
    ])
  );
}

function emptyCustomerStats() {
  return {
    ordersCount: 0,
    posOrdersCount: 0,
    webOrdersCount: 0,
    totalSpent: 0,
    firstPurchaseAt: null,
    lastPurchaseAt: null,
    lastOrder: null,
    lastOrderNumber: '',
  };
}

async function buildCustomersSummary(req, scopedFilter = {}, access = {}) {
  const base = { ...scopedFilter, deletedAt: null, status: 'active' };
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

  let moneyStats = totalSpentAgg?.[0] || {};
  let scopedWithPurchases = withPurchases;
  let scopedWithoutPurchases = withoutPurchases;
  let scopedStatsMap = null;

  if (access.mode !== 'all') {
    const customerIds = await Customer.distinct('_id', base);
    scopedStatsMap = await loadScopedCustomerStats(req, customerIds, access);
    const scopedStats = [...(scopedStatsMap?.values() || [])];
    scopedWithPurchases = scopedStats.length;
    scopedWithoutPurchases = Math.max(0, totalCustomers - scopedWithPurchases);
    moneyStats = scopedStats.reduce(
      (totals, stats) => ({
        totalSpent: totals.totalSpent + Number(stats.totalSpent || 0),
        totalOrders: totals.totalOrders + Number(stats.ordersCount || 0),
        posOrders: totals.posOrders + Number(stats.posOrdersCount || 0),
        webOrders: totals.webOrders + Number(stats.webOrdersCount || 0),
      }),
      { totalSpent: 0, totalOrders: 0, posOrders: 0, webOrders: 0 }
    );
  }

  return {
    totalCustomers,
    posCustomers,
    webCustomers,
    adminCustomers,
    withPurchases: scopedWithPurchases,
    withoutPurchases: scopedWithoutPurchases,
    withEmail,
    withoutEmail,
    totalSpent: Number(moneyStats.totalSpent || 0),
    totalOrders: Number(moneyStats.totalOrders || 0),
    posOrders: Number(moneyStats.posOrders || 0),
    webOrders: Number(moneyStats.webOrders || 0),
    newestCustomer: newestCustomer
      ? serializeCustomer(newestCustomer, {
          stats:
            scopedStatsMap?.get(String(newestCustomer._id)) ||
            (access.mode === 'all' ? undefined : emptyCustomerStats()),
        })
      : null,
  };
}

function sendError(res, error) {
  const safeError = isMongoDuplicateKeyError(error)
    ? createRouteError(
        'Otro proceso registró esa identidad al mismo tiempo. Actualiza el listado y revisa la ficha existente.',
        'CUSTOMER_DUPLICATE',
        409,
        { field: duplicateFieldFromError(error) }
      )
    : error;
  const status = Number(safeError?.statusCode || safeError?.status || 500);

  if (status >= 500) {
    console.error('[adminCustomersRoutes] Error:', safeError);
  }

  return res.status(status).json({
    ok: false,
    error: safeError?.code || 'CUSTOMERS_ROUTE_ERROR',
    message: safeError?.message || 'No se pudo procesar la solicitud de clientes.',
    details: safeError?.details || {},
  });
}

function createRouteError(message, code, statusCode = 400, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  error.details = details;
  return error;
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

router.use(requireAdmin);

router.get('/', requirePermission('customers:view'), async (req, res) => {
  try {
    const page = toPositiveInt(req.query.page, 1, 5000);
    const limit = toPositiveInt(req.query.limit, 20, 100);
    const skip = (page - 1) * limit;
    const baseAccess = assertScopeAccess(buildScopedCustomerFilter(req, {}));
    const built = buildCustomerFilter(req.query, {
      deferPurchaseSegment: baseAccess.mode !== 'all',
    });
    const access = assertScopeAccess(buildScopedCustomerFilter(req, built.filter));
    await applyScopedPurchaseSegment(req, access.filter, built.segment, access);
    const summaryAccess = assertScopeAccess(
      buildScopedCustomerFilter(req, { deletedAt: null })
    );
    const { q, segment } = built;
    const filter = access.filter;

    const [customers, total, summary] = await Promise.all([
      Customer.find(filter)
        .sort(q ? { fullName: 1 } : { updatedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Customer.countDocuments(filter),
      buildCustomersSummary(req, summaryAccess.filter, summaryAccess),
    ]);
    const scopedStats = await loadScopedCustomerStats(
      req,
      customers.map((customer) => customer._id),
      access
    );

    return res.json({
      ok: true,
      customers: customers.map((customer) =>
        serializeCustomer(customer, {
          stats:
            scopedStats?.get(String(customer._id)) ||
            (access.mode === 'all' ? undefined : emptyCustomerStats()),
        })
      ),
      summary,
      total,
      page,
      limit,
      pages: Math.max(1, Math.ceil(total / limit)),
      access: {
        mode: access.mode,
        branchIds: access.branchIds,
      },
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
    const writeAccess = assertScopeAccess(
      resolveCustomerWriteBranch(
        req,
        req.body?.branchId || req.body?.defaultBranch
      )
    );
    if (writeAccess.branchId) {
      payload.defaultBranch = writeAccess.branchId;
      payload.branchIds = [writeAccess.branchId];
    }
    await assertCustomerIsUnique(payload, null, {
      exposeExistingCustomer: canAdminSeeAllBranches(req),
    });
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
    const customer = await loadCustomer(req, req.params.id);
    const recentOrders = await loadCustomerOrders(
      req,
      customer,
      req.query.ordersLimit || 10
    );
    const detailAccess = assertScopeAccess(
      buildScopedCustomerFilter(req, { _id: customer._id, deletedAt: null })
    );
    const scopedStats = await loadScopedCustomerStats(
      req,
      [customer._id],
      detailAccess
    );

    return res.json({
      ok: true,
      customer: serializeCustomer(customer, {
        stats:
          scopedStats?.get(String(customer._id)) ||
          (detailAccess.mode === 'all' ? undefined : emptyCustomerStats()),
      }),
      recentOrders,
    });
  } catch (error) {
    return sendError(res, error);
  }
});

router.put('/:id', requirePermission('customers:update'), async (req, res) => {
  try {
    const customer = await loadCustomer(req, req.params.id);
    const current = serializeCustomer(customer);
    const body = req.body || {};
    const payload = buildCustomerPayload(
      {
        ...current,
        ...body,
        fiscalProfile: {
          ...(current.fiscalProfile || {}),
          ...(body.fiscalProfile || {}),
        },
        addresses:
          body.addresses !== undefined ? body.addresses : current.addresses,
        tags: body.tags !== undefined ? body.tags : current.tags,
      },
      req,
      false
    );
    await assertCustomerIsUnique(payload, customer._id, {
      exposeExistingCustomer: canAdminSeeAllBranches(req),
    });

    Object.entries(payload).forEach(([key, value]) => {
      if (value !== undefined) customer[key] = value;
    });

    await customer.save();
    const detailAccess = assertScopeAccess(
      buildScopedCustomerFilter(req, { _id: customer._id, deletedAt: null })
    );
    const scopedStats = await loadScopedCustomerStats(
      req,
      [customer._id],
      detailAccess
    );

    return res.json({
      ok: true,
      customer: serializeCustomer(customer, {
        stats:
          scopedStats?.get(String(customer._id)) ||
          (detailAccess.mode === 'all' ? undefined : emptyCustomerStats()),
      }),
    });
  } catch (error) {
    return sendError(res, error);
  }
});

module.exports = router;
