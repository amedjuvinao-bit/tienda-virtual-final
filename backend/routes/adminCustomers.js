// backend/routes/adminCustomers.js

const express = require('express');
const mongoose = require('mongoose');

const requireAdmin = require('../middleware/requireAdmin');
const requirePermission = require('../middleware/requirePermission');
const Customer = require('../models/Customer');
const CustomerFollowUp = require('../models/CustomerFollowUp');
const CustomerAuditEvent = require('../models/CustomerAuditEvent');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const AdminUser = require('../models/AdminUser');
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
  buildScopedFollowUpFilter,
  resolveCustomerWriteBranch,
} = require('../services/customerAdminScopeService');
const {
  buildScopedOrderFilter,
  canAdminSeeAllBranches,
} = require('../services/orderAdminScopeService');
const {
  buildCustomerOrdersFilter,
} = require('../services/customerOrderIdentityFilter');
const { loadCustomer360 } = require('../services/customer360');
const {
  resolveAssignableCrmAdmin,
  serializeCrmAdmin,
} = require('../services/customerCrmAdminService');
const {
  emptyCustomerCommercialMetrics,
  loadCustomerCommercialMetrics,
} = require('../services/customerCommercialMetricsService');
const {
  ABANDONED_WINDOW_MS,
  isValidEmail,
} = require('../services/cartAdminOperationsService');
const {
  buildAuditChanges,
  canViewSensitiveCustomerData,
  getCustomerRetentionDays,
  protectCustomerData,
  recordCustomerAuditEvent,
  serializeAuditEvent,
  verifyCustomerAuditChain,
} = require('../services/customerPrivacyService');

const router = express.Router();

function escapeRegex(value) {
  return cleanText(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toPositiveInt(value, fallback = 20, max = 100) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return fallback;
  return Math.min(Math.floor(number), max);
}

const CRM_STAGES = new Set([
  'prospect',
  'new',
  'active',
  'loyal',
  'at_risk',
  'inactive',
  'won_back',
]);
const CRM_PRIORITIES = new Set(['low', 'normal', 'high', 'vip']);
const CUSTOMER_SOURCES = new Set(['all', 'pos', 'web', 'admin', 'import', 'system']);
const CUSTOMER_STATUSES = new Set(['all', 'active', 'inactive', 'blocked']);
const CUSTOMER_SEGMENTS = new Set([
  'all',
  'with-purchases',
  'without-purchases',
  'with-email',
  'without-email',
  'vip',
  'recurrent',
  'at-risk',
  'inactive-customers',
  'high-return',
  'high-value',
  'abandoned-cart',
]);

function parseOptionalDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
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
    marketingConsent: raw.marketingConsent || {},
    notes: raw.notes || '',
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    crmStage: raw.crmStage || 'new',
    crmPriority: raw.crmPriority || 'normal',
    crmOwnerAdmin: serializeCrmAdmin(raw.crmOwnerAdmin),
    crmNextReviewAt: raw.crmNextReviewAt || null,
    crmLastContactAt: raw.crmLastContactAt || null,
    crmLastContactType: raw.crmLastContactType || '',
    crmUpdatedAt: raw.crmUpdatedAt || null,
    privacyStatus: raw.privacyStatus || 'active',
    retentionHoldUntil: raw.retentionHoldUntil || null,
    retentionHoldReason: raw.retentionHoldReason || '',
    anonymizedAt: raw.anonymizedAt || null,
    defaultBranch: raw.defaultBranch ? String(raw.defaultBranch) : null,
    branchIds: Array.isArray(raw.branchIds)
      ? raw.branchIds.map((branchId) => String(branchId))
      : [],
    stats: options.stats || raw.stats || {},
    createdAt: raw.createdAt || null,
    updatedAt: raw.updatedAt || null,
  };
}

const CUSTOMER_NON_SENSITIVE_UPDATE_FIELDS = new Set([
  'status',
  'tags',
  'crmStage',
  'crmPriority',
  'crmOwnerAdmin',
  'crmNextReviewAt',
  'crm',
]);

function serializeProtectedCustomer(customer, options = {}, canViewSensitive = false) {
  return protectCustomerData(
    serializeCustomer(customer, options),
    canViewSensitive
  );
}

function protectedCustomerUpdateBody(body = {}, canViewSensitive = false) {
  if (canViewSensitive) return body;
  return Object.entries(body || {}).reduce((safe, [key, value]) => {
    if (CUSTOMER_NON_SENSITIVE_UPDATE_FIELDS.has(key)) safe[key] = value;
    return safe;
  }, {});
}

async function hasCustomerPermission(req, permission) {
  return requirePermission.hasEffectivePermission(req, permission);
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

  const requestedStage = cleanLower(body.crmStage || body.crm?.stage);
  const requestedPriority = cleanLower(body.crmPriority || body.crm?.priority);
  if (isCreate || requestedStage) {
    payload.crmStage = CRM_STAGES.has(requestedStage)
      ? requestedStage
      : isCreate
        ? 'new'
        : undefined;
  }
  if (isCreate || requestedPriority) {
    payload.crmPriority = CRM_PRIORITIES.has(requestedPriority)
      ? requestedPriority
      : isCreate
        ? 'normal'
        : undefined;
  }
  if (
    Object.prototype.hasOwnProperty.call(body, 'crmNextReviewAt') ||
    Object.prototype.hasOwnProperty.call(body.crm || {}, 'nextReviewAt')
  ) {
    payload.crmNextReviewAt = parseOptionalDate(
      body.crmNextReviewAt ?? body.crm?.nextReviewAt
    );
  }

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
    'vip',
    'recurrent',
    'recurrentes',
    'at-risk',
    'at_risk',
    'en-riesgo',
    'inactive-customers',
    'inactivos',
    'high-return',
    'alta-devolucion',
    'high-value',
    'ticket-alto',
    'abandoned-cart',
    'carrito-abandonado',
  ].includes(cleanSegment);
}

function isAbandonedCartSegment(segment) {
  return ['abandoned-cart', 'carrito-abandonado'].includes(cleanLower(segment));
}

function isAdvancedCommercialSegment(segment) {
  return [
    'vip',
    'recurrent',
    'recurrentes',
    'at-risk',
    'at_risk',
    'en-riesgo',
    'inactive-customers',
    'inactivos',
    'high-return',
    'alta-devolucion',
    'high-value',
    'ticket-alto',
  ].includes(cleanLower(segment));
}

function buildCustomerFilter(query = {}, options = {}) {
  const filter = {
    deletedAt: null,
  };

  const q = cleanText(query.q || '').slice(0, 120);
  const status = cleanLower(query.status || '');
  const source = cleanLower(query.source || '');
  const segment = cleanLower(query.segment || '');
  const crmStage = cleanLower(query.crmStage || query.stage || '');
  const crmPriority = cleanLower(query.crmPriority || query.priority || '');

  if (status && status !== 'all') filter.status = status;
  if (source && source !== 'all') filter.source = source;
  if (crmStage && crmStage !== 'all' && CRM_STAGES.has(crmStage)) {
    filter.crmStage = crmStage;
  }
  if (
    crmPriority &&
    crmPriority !== 'all' &&
    CRM_PRIORITIES.has(crmPriority)
  ) {
    filter.crmPriority = crmPriority;
  }

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
        ...(options.canViewSensitive && normalizedPhone
          ? [{ normalizedPhone: new RegExp(`^${escapeRegex(normalizedPhone)}`) }]
          : []),
        ...(options.canViewSensitive && normalizedEmail
          ? [{ normalizedEmail: new RegExp(`^${escapeRegex(normalizedEmail)}`) }]
          : []),
        ...(options.canViewSensitive && normalizedDocument
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
  if (!isPurchaseSegment(segment)) return filter;

  if (isAbandonedCartSegment(segment)) {
    if (!canAdminSeeAllBranches(req)) {
      throw createRouteError(
        'El segmento de carritos abandonados requiere alcance global porque el carrito web todavía no pertenece a una sede.',
        'CUSTOMER_ABANDONED_CART_GLOBAL_SCOPE_REQUIRED',
        403
      );
    }

    const abandonedBoundary = new Date(Date.now() - ABANDONED_WINDOW_MS);
    const emails = await Cart.distinct('userEmail', {
      convertedOrderId: null,
      userEmail: { $type: 'string', $ne: '' },
      items: { $elemMatch: { qty: { $gt: 0 } } },
      $or: [
        { lastCustomerActivityAt: { $lte: abandonedBoundary } },
        {
          $and: [
            {
              $or: [
                { lastCustomerActivityAt: null },
                { lastCustomerActivityAt: { $exists: false } },
              ],
            },
            { updatedAt: { $lte: abandonedBoundary } },
          ],
        },
      ],
    });
    const normalizedEmails = [...new Set(
      emails
        .map((email) => cleanLower(email, 180))
        .filter((email) => isValidEmail(email))
    )];
    filter.normalizedEmail = { $in: normalizedEmails };
    return filter;
  }

  if (isAdvancedCommercialSegment(segment)) {
    const candidateIds = await Customer.distinct('_id', filter);
    const metrics = await loadCustomerCommercialMetrics(req, candidateIds);
    const now = Date.now();
    const selected = [...metrics.entries()]
      .filter(([, item]) => {
        const key = cleanLower(segment);
        const lastPurchaseTime = item.lastPurchaseAt
          ? new Date(item.lastPurchaseAt).getTime()
          : 0;
        const daysSincePurchase = lastPurchaseTime
          ? (now - lastPurchaseTime) / 86400000
          : Number.POSITIVE_INFINITY;

        if (key === 'vip') {
          return item.netSpent >= 1000000 || item.ordersCount >= 8;
        }
        if (['recurrent', 'recurrentes'].includes(key)) {
          return item.ordersCount >= 2;
        }
        if (['at-risk', 'at_risk', 'en-riesgo'].includes(key)) {
          return item.ordersCount > 0 && daysSincePurchase >= 90 && daysSincePurchase < 180;
        }
        if (['inactive-customers', 'inactivos'].includes(key)) {
          return item.ordersCount > 0 && daysSincePurchase >= 180;
        }
        if (['high-return', 'alta-devolucion'].includes(key)) {
          return item.ordersCount >= 2 && item.returnRate >= 30;
        }
        if (['high-value', 'ticket-alto'].includes(key)) {
          return item.averageTicket >= 300000;
        }
        return false;
      })
      .map(([customerId]) => new mongoose.Types.ObjectId(customerId));
    filter._id = { $in: selected };
    return filter;
  }

  if (access.mode === 'all') return filter;

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

function normalizeSavedCustomerFilters(input = {}) {
  const source = cleanLower(input.source || 'all');
  const status = cleanLower(input.status || 'active');
  const segment = cleanLower(input.segment || 'all');
  const crmStage = cleanLower(input.crmStage || 'all');
  const crmPriority = cleanLower(input.crmPriority || 'all');
  const crmOwner = cleanText(input.crmOwner || 'all');

  if (!CUSTOMER_SOURCES.has(source)) {
    throw createRouteError('El origen del segmento no es válido.', 'CUSTOMER_SAVED_SEGMENT_FILTER_INVALID', 400);
  }
  if (!CUSTOMER_STATUSES.has(status)) {
    throw createRouteError('El estado del segmento no es válido.', 'CUSTOMER_SAVED_SEGMENT_FILTER_INVALID', 400);
  }
  if (!CUSTOMER_SEGMENTS.has(segment)) {
    throw createRouteError('El segmento comercial no es válido.', 'CUSTOMER_SAVED_SEGMENT_FILTER_INVALID', 400);
  }
  if (crmStage !== 'all' && !CRM_STAGES.has(crmStage)) {
    throw createRouteError('La etapa CRM del segmento no es válida.', 'CUSTOMER_SAVED_SEGMENT_FILTER_INVALID', 400);
  }
  if (crmPriority !== 'all' && !CRM_PRIORITIES.has(crmPriority)) {
    throw createRouteError('La prioridad CRM del segmento no es válida.', 'CUSTOMER_SAVED_SEGMENT_FILTER_INVALID', 400);
  }
  if (
    !['all', 'me'].includes(crmOwner) &&
    !mongoose.Types.ObjectId.isValid(String(crmOwner))
  ) {
    throw createRouteError('El responsable CRM del segmento no es válido.', 'CUSTOMER_SAVED_SEGMENT_FILTER_INVALID', 400);
  }

  return { source, status, segment, crmStage, crmPriority, crmOwner };
}

function serializeSavedCustomerSegment(segment = {}) {
  const raw = typeof segment.toObject === 'function' ? segment.toObject() : segment;
  return {
    id: String(raw._id || raw.id || ''),
    name: raw.name || '',
    filters: raw.filters || {},
    createdAt: raw.createdAt || null,
    updatedAt: raw.updatedAt || null,
  };
}

async function loadCurrentAdminForSegments(req) {
  const adminId = getAdminId(req);
  if (!adminId) {
    throw createRouteError(
      'No se pudo identificar al administrador.',
      'CUSTOMER_SAVED_SEGMENT_ADMIN_REQUIRED',
      401
    );
  }
  const admin = await AdminUser.findOne({ _id: adminId, deletedAt: null });
  if (!admin) {
    throw createRouteError(
      'El administrador ya no está disponible.',
      'CUSTOMER_SAVED_SEGMENT_ADMIN_NOT_FOUND',
      404
    );
  }
  return admin;
}

async function loadScopedCustomerStats(req, customerIds = [], access = {}) {
  if (!customerIds.length) return new Map();
  return loadCustomerCommercialMetrics(req, customerIds);
}

function emptyCustomerStats() {
  return emptyCustomerCommercialMetrics();
}

async function buildCustomersSummary(
  req,
  scopedFilter = {},
  access = {},
  canViewSensitive = false
) {
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
      ? serializeProtectedCustomer(newestCustomer, {
          stats:
            scopedStatsMap?.get(String(newestCustomer._id)) ||
            emptyCustomerStats(),
        }, canViewSensitive)
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
  const customer = await Customer.findOne(access.filter).populate(
    'crmOwnerAdmin',
    'username displayName firstName lastName role branches defaultBranch'
  );

  if (!customer) {
    throw createRouteError('Cliente no encontrado.', 'CUSTOMER_NOT_FOUND', 404, { customerId });
  }

  return customer;
}

async function assessCustomerRetention(req, customer) {
  const orderAccess = buildScopedOrderFilter(
    req,
    buildCustomerOrdersFilter(customer),
    {
      requestedBranchId: req.query?.branchId || '',
      requireWholeOrder: true,
    }
  );
  assertScopeAccess(orderAccess);
  const latestOrder = await Order.findOne(orderAccess.filter)
    .sort({ createdAt: -1, _id: -1 })
    .select('_id orderNumber createdAt')
    .lean();
  const retentionDays = getCustomerRetentionDays();
  const baseDate = new Date(latestOrder?.createdAt || customer.createdAt || Date.now());
  const policyUntil = new Date(baseDate.getTime() + retentionDays * 86400000);
  const explicitHold = customer.retentionHoldUntil
    ? new Date(customer.retentionHoldUntil)
    : null;
  const retentionUntil = explicitHold && explicitHold > policyUntil
    ? explicitHold
    : policyUntil;
  const alreadyAnonymized = customer.privacyStatus === 'anonymized';

  return {
    retentionDays,
    lastOrder: latestOrder
      ? {
          id: String(latestOrder._id),
          orderNumber: latestOrder.orderNumber || '',
          createdAt: latestOrder.createdAt || null,
        }
      : null,
    policyBaseAt: baseDate,
    policyUntil,
    explicitHoldUntil: explicitHold,
    retentionUntil,
    eligibleForAnonymization:
      !alreadyAnonymized && Date.now() >= retentionUntil.getTime(),
    alreadyAnonymized,
  };
}

router.use(requireAdmin);

router.get('/segments/saved', requirePermission('customers:view'), async (req, res) => {
  try {
    const admin = await loadCurrentAdminForSegments(req);
    const segments = (admin.customerSavedSegments || [])
      .slice()
      .sort((left, right) => String(left.name || '').localeCompare(String(right.name || ''), 'es'))
      .map(serializeSavedCustomerSegment);
    return res.json({ ok: true, segments });
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/segments/saved', requirePermission('customers:view'), async (req, res) => {
  try {
    const admin = await loadCurrentAdminForSegments(req);
    const name = cleanText(req.body?.name || '').slice(0, 80);
    const normalizedName = cleanLower(name);
    if (name.length < 3) {
      throw createRouteError(
        'El nombre del segmento debe tener al menos 3 caracteres.',
        'CUSTOMER_SAVED_SEGMENT_NAME_REQUIRED',
        400
      );
    }
    if ((admin.customerSavedSegments || []).length >= 20) {
      throw createRouteError(
        'Alcanzaste el límite de 20 segmentos guardados.',
        'CUSTOMER_SAVED_SEGMENT_LIMIT',
        409
      );
    }
    if ((admin.customerSavedSegments || []).some((item) => item.normalizedName === normalizedName)) {
      throw createRouteError(
        'Ya tienes un segmento guardado con ese nombre.',
        'CUSTOMER_SAVED_SEGMENT_DUPLICATE',
        409
      );
    }

    admin.customerSavedSegments.push({
      name,
      normalizedName,
      filters: normalizeSavedCustomerFilters(req.body?.filters || {}),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await admin.save();
    const segment = admin.customerSavedSegments[admin.customerSavedSegments.length - 1];
    return res.status(201).json({
      ok: true,
      segment: serializeSavedCustomerSegment(segment),
    });
  } catch (error) {
    return sendError(res, error);
  }
});

router.put('/segments/saved/:segmentId', requirePermission('customers:view'), async (req, res) => {
  try {
    const admin = await loadCurrentAdminForSegments(req);
    const segment = admin.customerSavedSegments?.id(req.params.segmentId);
    if (!segment) {
      throw createRouteError('Segmento guardado no encontrado.', 'CUSTOMER_SAVED_SEGMENT_NOT_FOUND', 404);
    }
    const name = cleanText(req.body?.name || segment.name).slice(0, 80);
    const normalizedName = cleanLower(name);
    if (name.length < 3) {
      throw createRouteError(
        'El nombre del segmento debe tener al menos 3 caracteres.',
        'CUSTOMER_SAVED_SEGMENT_NAME_REQUIRED',
        400
      );
    }
    const duplicate = (admin.customerSavedSegments || []).some(
      (item) => String(item._id) !== String(segment._id) && item.normalizedName === normalizedName
    );
    if (duplicate) {
      throw createRouteError(
        'Ya tienes un segmento guardado con ese nombre.',
        'CUSTOMER_SAVED_SEGMENT_DUPLICATE',
        409
      );
    }
    segment.name = name;
    segment.normalizedName = normalizedName;
    segment.filters = normalizeSavedCustomerFilters(req.body?.filters || segment.filters || {});
    segment.updatedAt = new Date();
    await admin.save();
    return res.json({ ok: true, segment: serializeSavedCustomerSegment(segment) });
  } catch (error) {
    return sendError(res, error);
  }
});

router.delete('/segments/saved/:segmentId', requirePermission('customers:view'), async (req, res) => {
  try {
    const admin = await loadCurrentAdminForSegments(req);
    const segment = admin.customerSavedSegments?.id(req.params.segmentId);
    if (!segment) {
      throw createRouteError('Segmento guardado no encontrado.', 'CUSTOMER_SAVED_SEGMENT_NOT_FOUND', 404);
    }
    segment.deleteOne();
    await admin.save();
    return res.json({ ok: true, deletedId: String(req.params.segmentId) });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/', requirePermission('customers:view'), async (req, res) => {
  try {
    const canViewSensitive = await canViewSensitiveCustomerData(req);
    const page = toPositiveInt(req.query.page, 1, 5000);
    const limit = toPositiveInt(req.query.limit, 20, 100);
    const skip = (page - 1) * limit;
    const baseAccess = assertScopeAccess(buildScopedCustomerFilter(req, {}));
    const built = buildCustomerFilter(req.query, {
      deferPurchaseSegment: baseAccess.mode !== 'all',
      canViewSensitive,
    });
    const access = assertScopeAccess(buildScopedCustomerFilter(req, built.filter));
    const requestedOwner = cleanText(req.query.crmOwner || '');
    if (requestedOwner && requestedOwner !== 'all') {
      const ownerId = requestedOwner === 'me' ? getAdminId(req) : requestedOwner;
      if (!ownerId || !mongoose.Types.ObjectId.isValid(String(ownerId))) {
        throw createRouteError(
          'El filtro de responsable CRM no es válido.',
          'CUSTOMER_CRM_OWNER_FILTER_INVALID',
          400
        );
      }
      access.filter.crmOwnerAdmin = new mongoose.Types.ObjectId(String(ownerId));
    }
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
        .limit(limit)
        .populate(
          'crmOwnerAdmin',
          'username displayName firstName lastName role branches defaultBranch'
        ),
      Customer.countDocuments(filter),
      buildCustomersSummary(
        req,
        summaryAccess.filter,
        summaryAccess,
        canViewSensitive
      ),
    ]);
    const scopedStats = await loadScopedCustomerStats(
      req,
      customers.map((customer) => customer._id),
      access
    );

    return res.json({
      ok: true,
      customers: customers.map((customer) =>
        serializeProtectedCustomer(customer, {
          stats:
            scopedStats?.get(String(customer._id)) ||
            emptyCustomerStats(),
        }, canViewSensitive)
      ),
      summary,
      total,
      page,
      limit,
      pages: Math.max(1, Math.ceil(total / limit)),
      access: {
        mode: access.mode,
        branchIds: access.branchIds,
        sensitive: canViewSensitive,
        masked: !canViewSensitive,
      },
      filters: {
        segment: segment || 'all',
        source: cleanLower(req.query.source || 'all') || 'all',
        status: cleanLower(req.query.status || 'active') || 'active',
        crmStage: cleanLower(req.query.crmStage || 'all') || 'all',
        crmPriority: cleanLower(req.query.crmPriority || 'all') || 'all',
        crmOwner: cleanText(req.query.crmOwner || 'all') || 'all',
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/', requirePermission('customers:create'), async (req, res) => {
  try {
    const canViewSensitive = await canViewSensitiveCustomerData(req);
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
    const requestedOwner = req.body?.crmOwnerAdmin ?? req.body?.crm?.ownerAdmin;
    payload.crmOwnerAdmin = await resolveAssignableCrmAdmin(
      req,
      requestedOwner || getAdminId(req),
      { branchId: writeAccess.branchId, allowUnassigned: true }
    );
    payload.crmUpdatedAt = new Date();
    await assertCustomerIsUnique(payload, null, {
      exposeExistingCustomer: canAdminSeeAllBranches(req),
    });
    const customer = await Customer.create(payload);
    await customer.populate(
      'crmOwnerAdmin',
      'username displayName firstName lastName role branches defaultBranch'
    );
    const createdSnapshot = serializeCustomer(customer);
    await recordCustomerAuditEvent({
      req,
      customer,
      eventType: 'created',
      action: 'Cliente creado',
      changes: buildAuditChanges({}, createdSnapshot, [
        'fullName',
        'phone',
        'email',
        'documentNumber',
        'address',
        'fiscalProfile',
        'crmStage',
        'crmPriority',
        'crmOwnerAdmin',
      ]),
      metadata: { source: customer.source || 'admin' },
    });

    return res.status(201).json({
      ok: true,
      customer: protectCustomerData(createdSnapshot, canViewSensitive),
      access: { sensitive: canViewSensitive, masked: !canViewSensitive },
    });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/:id/privacy', requirePermission('customers:audit'), async (req, res) => {
  try {
    const customer = await loadCustomer(req, req.params.id);
    const retention = await assessCustomerRetention(req, customer);
    const [canViewSensitive, canExport, canConsent, hasAnonymizePermission] = await Promise.all([
      canViewSensitiveCustomerData(req),
      hasCustomerPermission(req, 'customers:export'),
      hasCustomerPermission(req, 'customers:consent'),
      hasCustomerPermission(req, 'customers:anonymize'),
    ]);
    const canAnonymize = canViewSensitive && hasAnonymizePermission;
    const consentSnapshot = serializeCustomer(customer).marketingConsent || {};
    await recordCustomerAuditEvent({
      req,
      customer,
      eventType: 'retention_reviewed',
      action: 'Política de conservación consultada',
      metadata: {
        eligibleForAnonymization: retention.eligibleForAnonymization,
        retentionDays: retention.retentionDays,
      },
    });
    return res.json({
      ok: true,
      customerId: String(customer._id),
      privacy: {
        status: customer.privacyStatus || 'active',
        anonymizedAt: customer.anonymizedAt || null,
        retentionHoldUntil: customer.retentionHoldUntil || null,
        retentionHoldReason: canViewSensitive
          ? customer.retentionHoldReason || ''
          : customer.retentionHoldReason
            ? '[MOTIVO PROTEGIDO]'
            : '',
        retention,
        confirmationPhrase: canAnonymize
          ? `ANONIMIZAR ${customer.customerCode}`
          : '',
      },
      consent: protectCustomerData(
        { marketingConsent: consentSnapshot },
        canViewSensitive
      ).marketingConsent,
      access: {
        sensitive: canViewSensitive,
        export: canExport && canViewSensitive,
        consent: canConsent,
        anonymize: canAnonymize,
        audit: true,
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/:id/audit', requirePermission('customers:audit'), async (req, res) => {
  try {
    const customer = await loadCustomer(req, req.params.id);
    const limit = toPositiveInt(req.query.limit, 100, 250);
    const [total, recentEvents] = await Promise.all([
      CustomerAuditEvent.countDocuments({ customer: customer._id }),
      CustomerAuditEvent.find({ customer: customer._id })
        .sort({ createdAt: -1, _id: -1 })
        .limit(limit)
        .populate('actorAdmin', 'username displayName firstName lastName role'),
    ]);
    const chronological = recentEvents.slice().reverse();
    const integrityVerified = verifyCustomerAuditChain(
      chronological,
      chronological[0]?.previousHash || ''
    );
    await recordCustomerAuditEvent({
      req,
      customer,
      eventType: 'viewed',
      action: 'Historial de auditoría consultado',
      metadata: { eventsReturned: chronological.length, integrityVerified },
    });
    return res.json({
      ok: true,
      customerId: String(customer._id),
      integrityVerified,
      coverage: {
        total,
        loaded: recentEvents.length,
        truncated: total > recentEvents.length,
      },
      events: recentEvents.map(serializeAuditEvent),
    });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get(
  '/:id/export',
  requirePermission(['customers:export', 'customers:sensitive']),
  async (req, res) => {
    try {
      const customer = await loadCustomer(req, req.params.id);
      const followUpAccess = assertScopeAccess(buildScopedFollowUpFilter(req, {
        customer: customer._id,
        deletedAt: null,
      }));
      const [orders, followUps, retention] = await Promise.all([
        loadCustomerOrders(req, customer, 30),
        CustomerFollowUp.find(followUpAccess.filter)
          .sort({ createdAt: -1 })
          .limit(250)
          .lean(),
        assessCustomerRetention(req, customer),
      ]);
      await recordCustomerAuditEvent({
        req,
        customer,
        eventType: 'exported',
        action: 'Expediente personal exportado',
        metadata: {
          ordersReturned: orders.length,
          followUpsReturned: followUps.length,
        },
      });
      const exportedAt = new Date();
      const filename = `cliente-${customer.customerCode || customer._id}-${exportedAt.toISOString().slice(0, 10)}.json`;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.json({
        ok: true,
        exportedAt,
        customer: serializeCustomer(customer),
        orders,
        followUps: followUps.map((item) => ({
          id: String(item._id),
          type: item.type,
          status: item.status,
          priority: item.priority,
          note: item.note,
          nextAction: item.nextAction,
          dueAt: item.dueAt,
          doneAt: item.doneAt,
          createdAt: item.createdAt,
        })),
        retention,
        coverage: {
          ordersLimit: 30,
          followUpsLimit: 250,
          mayBeTruncated: orders.length === 30 || followUps.length === 250,
        },
      });
    } catch (error) {
      return sendError(res, error);
    }
  }
);

router.post('/:id/consent', requirePermission('customers:consent'), async (req, res) => {
  try {
    const customer = await loadCustomer(req, req.params.id);
    const status = cleanLower(req.body?.status || '');
    const source = cleanLower(req.body?.source || 'admin');
    const proofReference = cleanText(req.body?.proofReference || '').slice(0, 240);
    const note = cleanText(req.body?.note || '').slice(0, 500);
    const allowedStatuses = new Set(['granted', 'withdrawn']);
    const allowedSources = new Set([
      'admin',
      'web',
      'pos',
      'whatsapp',
      'phone',
      'email',
      'paper',
      'import',
    ]);
    if (!allowedStatuses.has(status)) {
      throw createRouteError(
        'El consentimiento debe quedar otorgado o retirado.',
        'CUSTOMER_CONSENT_STATUS_INVALID',
        400
      );
    }
    if (!allowedSources.has(source)) {
      throw createRouteError('El origen del consentimiento no es válido.', 'CUSTOMER_CONSENT_SOURCE_INVALID', 400);
    }
    if (status === 'granted' && proofReference.length < 3) {
      throw createRouteError(
        'Debes registrar una referencia de evidencia para otorgar el consentimiento.',
        'CUSTOMER_CONSENT_PROOF_REQUIRED',
        400
      );
    }

    const before = serializeCustomer(customer);
    const recordedAt = new Date();
    const history = Array.isArray(customer.marketingConsent?.history)
      ? customer.marketingConsent.history
      : [];
    history.push({
      status,
      source,
      proofReference,
      note,
      recordedAt,
      recordedByAdmin: getAdminId(req),
    });
    customer.marketingConsent = {
      status,
      source,
      proofReference,
      updatedAt: recordedAt,
      updatedByAdmin: getAdminId(req),
      history: history.slice(-50),
    };
    customer.acceptsMarketing = status === 'granted';
    customer.updatedByAdmin = getAdminId(req);
    await customer.save();
    const after = serializeCustomer(customer);
    await recordCustomerAuditEvent({
      req,
      customer,
      eventType: 'consent_changed',
      action: status === 'granted'
        ? 'Consentimiento comercial otorgado'
        : 'Consentimiento comercial retirado',
      changes: buildAuditChanges(before, after, [
        'acceptsMarketing',
        'marketingConsent.status',
        'marketingConsent.source',
        'marketingConsent.proofReference',
      ]),
      metadata: { status, source },
    });
    const canViewSensitive = await canViewSensitiveCustomerData(req);
    return res.json({
      ok: true,
      customer: protectCustomerData(after, canViewSensitive),
      access: { sensitive: canViewSensitive, masked: !canViewSensitive },
    });
  } catch (error) {
    return sendError(res, error);
  }
});

router.post(
  '/:id/anonymize',
  requirePermission(['customers:anonymize', 'customers:sensitive']),
  async (req, res) => {
    try {
      const customer = await loadCustomer(req, req.params.id);
      const retention = await assessCustomerRetention(req, customer);
      const expectedConfirmation = `ANONIMIZAR ${customer.customerCode}`;
      if (cleanText(req.body?.confirmation) !== expectedConfirmation) {
        throw createRouteError(
          `Escribe exactamente "${expectedConfirmation}" para confirmar.`,
          'CUSTOMER_ANONYMIZATION_CONFIRMATION_REQUIRED',
          400
        );
      }
      if (!retention.eligibleForAnonymization) {
        throw createRouteError(
          'El cliente todavía está protegido por la política de conservación o ya fue anonimizado.',
          'CUSTOMER_ANONYMIZATION_RETENTION_HOLD',
          409,
          { retentionUntil: retention.retentionUntil }
        );
      }

      const before = serializeCustomer(customer);
      const anonymizedAt = new Date();
      const anonymousSuffix = String(customer._id).slice(-6).toUpperCase();
      customer.firstName = '';
      customer.lastName = '';
      customer.fullName = `Cliente anonimizado ${anonymousSuffix}`;
      customer.displayName = customer.fullName;
      customer.phone = '';
      customer.email = '';
      customer.documentType = '';
      customer.documentNumber = '';
      customer.address = '';
      customer.city = '';
      customer.department = '';
      customer.postalCode = '';
      customer.addresses = [];
      customer.fiscalProfile = {};
      customer.notes = '';
      customer.tags = [];
      customer.status = 'inactive';
      customer.crmStage = 'inactive';
      customer.crmPriority = 'low';
      customer.crmOwnerAdmin = null;
      customer.crmNextReviewAt = null;
      customer.marketingConsent = {
        status: 'withdrawn',
        source: 'anonymization',
        proofReference: '',
        updatedAt: anonymizedAt,
        updatedByAdmin: getAdminId(req),
        history: [],
      };
      customer.acceptsMarketing = false;
      customer.privacyStatus = 'anonymized';
      customer.anonymizedAt = anonymizedAt;
      customer.anonymizedByAdmin = getAdminId(req);
      customer.updatedByAdmin = getAdminId(req);
      await customer.save();
      await CustomerFollowUp.updateMany(
        { customer: customer._id, deletedAt: null },
        {
          $set: {
            note: '[ANONIMIZADO]',
            nextAction: '',
            deletedAt: anonymizedAt,
            updatedByAdmin: getAdminId(req),
          },
        }
      );
      const after = serializeCustomer(customer);
      await recordCustomerAuditEvent({
        req,
        customer,
        eventType: 'anonymized',
        action: 'Ficha maestra del cliente anonimizada',
        changes: buildAuditChanges(before, after, [
          'fullName',
          'phone',
          'email',
          'documentNumber',
          'address',
          'fiscalProfile',
          'notes',
          'status',
          'privacyStatus',
        ]),
        metadata: {
          relatedOrdersRetained: true,
          retentionDays: retention.retentionDays,
        },
      });
      return res.json({
        ok: true,
        customer: after,
        privacy: {
          status: 'anonymized',
          anonymizedAt,
          relatedOrdersRetained: true,
        },
      });
    } catch (error) {
      return sendError(res, error);
    }
  }
);

router.get('/:id/360', requirePermission('customers:view'), async (req, res) => {
  try {
    const customer = await loadCustomer(req, req.params.id);
    const canViewSensitive = await canViewSensitiveCustomerData(req);
    const detail = await loadCustomer360({
      req,
      customer,
      orderLimit: req.query.historyLimit || 100,
    });
    if (!canViewSensitive && Array.isArray(detail.carts)) {
      detail.carts = detail.carts.map((cart) => ({
        ...cart,
        customerEmail: protectCustomerData(
          { email: cart.customerEmail || '' },
          false
        ).email,
      }));
    }
    await recordCustomerAuditEvent({
      req,
      customer,
      eventType: 'viewed',
      action: 'Ficha 360 del cliente consultada',
      metadata: { section: 'customer_360' },
    });

    return res.json({
      ok: true,
      customerId: String(customer._id),
      dataProtection: { sensitive: canViewSensitive, masked: !canViewSensitive },
      ...detail,
    });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/:id', requirePermission('customers:view'), async (req, res) => {
  try {
    const customer = await loadCustomer(req, req.params.id);
    const [canViewSensitive, canAudit, canExport, canConsent, hasAnonymizePermission] =
      await Promise.all([
        canViewSensitiveCustomerData(req),
        hasCustomerPermission(req, 'customers:audit'),
        hasCustomerPermission(req, 'customers:export'),
        hasCustomerPermission(req, 'customers:consent'),
        hasCustomerPermission(req, 'customers:anonymize'),
      ]);
    const canAnonymize = canViewSensitive && hasAnonymizePermission;
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
    await recordCustomerAuditEvent({
      req,
      customer,
      eventType: 'viewed',
      action: 'Ficha del cliente consultada',
      metadata: { section: 'customer_detail' },
    });

    return res.json({
      ok: true,
      customer: serializeProtectedCustomer(customer, {
        stats:
          scopedStats?.get(String(customer._id)) ||
          emptyCustomerStats(),
      }, canViewSensitive),
      recentOrders,
      access: {
        mode: detailAccess.mode,
        branchIds: detailAccess.branchIds,
        sensitive: canViewSensitive,
        masked: !canViewSensitive,
        audit: canAudit,
        export: canExport && canViewSensitive,
        consent: canConsent,
        anonymize: canAnonymize,
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
});

router.put('/:id', requirePermission('customers:update'), async (req, res) => {
  try {
    const customer = await loadCustomer(req, req.params.id);
    const canViewSensitive = await canViewSensitiveCustomerData(req);
    const current = serializeCustomer(customer);
    const originalBody = req.body || {};
    const body = protectedCustomerUpdateBody(originalBody, canViewSensitive);
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
    const crmStageWasSent =
      Object.prototype.hasOwnProperty.call(body, 'crmStage') ||
      Object.prototype.hasOwnProperty.call(body.crm || {}, 'stage');
    const crmPriorityWasSent =
      Object.prototype.hasOwnProperty.call(body, 'crmPriority') ||
      Object.prototype.hasOwnProperty.call(body.crm || {}, 'priority');
    const crmReviewWasSent =
      Object.prototype.hasOwnProperty.call(body, 'crmNextReviewAt') ||
      Object.prototype.hasOwnProperty.call(body.crm || {}, 'nextReviewAt');
    if (!crmStageWasSent) delete payload.crmStage;
    if (!crmPriorityWasSent) delete payload.crmPriority;
    if (!crmReviewWasSent) delete payload.crmNextReviewAt;
    await assertCustomerIsUnique(payload, customer._id, {
      exposeExistingCustomer: canAdminSeeAllBranches(req),
    });

    const ownerWasSent =
      Object.prototype.hasOwnProperty.call(body, 'crmOwnerAdmin') ||
      Object.prototype.hasOwnProperty.call(body.crm || {}, 'ownerAdmin');
    if (ownerWasSent) {
      payload.crmOwnerAdmin = await resolveAssignableCrmAdmin(
        req,
        body.crmOwnerAdmin ?? body.crm?.ownerAdmin,
        {
          branchId: customer.defaultBranch || '',
          allowUnassigned: true,
        }
      );
    }
    if (
      ownerWasSent ||
      payload.crmStage !== undefined ||
      payload.crmPriority !== undefined ||
      payload.crmNextReviewAt !== undefined
    ) {
      payload.crmUpdatedAt = new Date();
    }

    Object.entries(payload).forEach(([key, value]) => {
      if (value !== undefined) customer[key] = value;
    });

    await customer.save();
    await customer.populate(
      'crmOwnerAdmin',
      'username displayName firstName lastName role branches defaultBranch'
    );
    const detailAccess = assertScopeAccess(
      buildScopedCustomerFilter(req, { _id: customer._id, deletedAt: null })
    );
    const scopedStats = await loadScopedCustomerStats(
      req,
      [customer._id],
      detailAccess
    );
    const updatedSnapshot = serializeCustomer(customer, {
      stats:
        scopedStats?.get(String(customer._id)) ||
        emptyCustomerStats(),
    });
    const requestedPaths = Object.keys(body).flatMap((key) => {
      if (key === 'fiscalProfile') {
        return Object.keys(body.fiscalProfile || {}).map((field) => `fiscalProfile.${field}`);
      }
      if (key === 'crm') {
        return ['crmStage', 'crmPriority', 'crmOwnerAdmin', 'crmNextReviewAt'];
      }
      return [key];
    });
    await recordCustomerAuditEvent({
      req,
      customer,
      eventType: 'updated',
      action: 'Ficha del cliente actualizada',
      changes: buildAuditChanges(current, updatedSnapshot, requestedPaths),
      metadata: {
        sensitiveAccess: canViewSensitive,
        protectedFieldsIgnored: Math.max(
          0,
          Object.keys(originalBody).length - Object.keys(body).length
        ),
      },
    });

    return res.json({
      ok: true,
      customer: protectCustomerData(updatedSnapshot, canViewSensitive),
      access: {
        sensitive: canViewSensitive,
        masked: !canViewSensitive,
        protectedFieldsIgnored: canViewSensitive
          ? []
          : Object.keys(originalBody).filter(
              (key) => !CUSTOMER_NON_SENSITIVE_UPDATE_FIELDS.has(key)
            ),
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
});

module.exports = router;
