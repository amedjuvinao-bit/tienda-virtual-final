'use strict';

const Cart = require('../models/Cart');

const ACTIVE_WINDOW_MS = 30 * 60 * 1000;
const ABANDONED_WINDOW_MS = 24 * 60 * 60 * 1000;
const HIGH_VALUE_THRESHOLD = 500000;
const ALLOWED_LIMITS = new Set([10, 20, 50, 100]);
const ALLOWED_LIFECYCLES = new Set([
  'empty',
  'active',
  'inactive',
  'abandoned',
  'recoverable',
  'converted',
]);
const ALLOWED_SORTS = new Set([
  'recent_activity',
  'oldest_activity',
  'highest_value',
  'highest_quantity',
]);
const ALLOWED_VIEWS = new Set([
  'all',
  'active',
  'abandoned',
  'recoverable',
  'high_value',
  'empty',
  'converted',
]);

function clean(value, max = 500) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function escapeRegex(value) {
  return clean(value, 120).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(value, 180).toLowerCase());
}

function safeDate(value, field) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const error = new TypeError(`${field} no contiene una fecha valida.`);
    error.code = 'CART_ADMIN_FILTER_INVALID';
    throw error;
  }
  return date;
}

function optionalNumber(value, field, { integer = false, min = 0 } = {}) {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || (integer && !Number.isInteger(number))) {
    const error = new TypeError(`${field} contiene un valor invalido.`);
    error.code = 'CART_ADMIN_FILTER_INVALID';
    throw error;
  }
  return number;
}

function itemQuantity(item = {}) {
  const quantity = Number(item.qty ?? item.quantity ?? 0);
  return Number.isFinite(quantity) ? Math.max(0, Math.floor(quantity)) : 0;
}

function itemPrice(item = {}) {
  const price = Number(item.price || 0);
  return Number.isFinite(price) ? Math.max(0, price) : 0;
}

function getCartMetrics(cart = {}) {
  const items = Array.isArray(cart.items) ? cart.items : [];
  const validItems = items.filter((item) => itemQuantity(item) > 0);
  return {
    differentProducts: validItems.length,
    totalUnits: validItems.reduce((total, item) => total + itemQuantity(item), 0),
    subtotal: validItems.reduce(
      (total, item) => total + itemQuantity(item) * itemPrice(item),
      0
    ),
    recoveryAttemptsCount: Array.isArray(cart.recoveryAttempts)
      ? cart.recoveryAttempts.length
      : 0,
  };
}

function classifyCartLifecycle(cart = {}, now = new Date()) {
  const metrics = getCartMetrics(cart);
  if (cart.convertedOrderId) return 'converted';
  if (metrics.totalUnits <= 0) return 'empty';

  const sourceDate = cart.lastCustomerActivityAt || cart.updatedAt || cart.createdAt;
  const activityAt = new Date(sourceDate || 0);
  const ageMs = Math.max(0, now.getTime() - activityAt.getTime());

  if (ageMs < ACTIVE_WINDOW_MS) return 'active';
  if (ageMs < ABANDONED_WINDOW_MS) return 'inactive';
  return isValidEmail(cart.userEmail) ? 'recoverable' : 'abandoned';
}

function parseAdminCartQuery(query = {}) {
  const page = optionalNumber(query.page ?? 1, 'page', { integer: true, min: 1 });
  const limit = optionalNumber(query.limit ?? 20, 'limit', { integer: true, min: 1 });
  if (!ALLOWED_LIMITS.has(limit)) {
    const error = new TypeError('limit debe ser 10, 20, 50 o 100.');
    error.code = 'CART_ADMIN_FILTER_INVALID';
    throw error;
  }
  const view = clean(query.view || 'all', 30).toLowerCase();
  if (!ALLOWED_VIEWS.has(view)) {
    const error = new TypeError('La vista solicitada no es valida.');
    error.code = 'CART_ADMIN_FILTER_INVALID';
    throw error;
  }

  const lifecycle = clean(query.lifecycle || query.status, 30).toLowerCase();
  if (lifecycle && !ALLOWED_LIFECYCLES.has(lifecycle)) {
    const error = new TypeError('El estado solicitado no es valido.');
    error.code = 'CART_ADMIN_FILTER_INVALID';
    throw error;
  }

  const sort = clean(query.sort || 'recent_activity', 40).toLowerCase();
  if (!ALLOWED_SORTS.has(sort)) {
    const error = new TypeError('El orden solicitado no es valido.');
    error.code = 'CART_ADMIN_FILTER_INVALID';
    throw error;
  }

  const customerType = clean(query.customerType, 20).toLowerCase();
  if (customerType && !['identified', 'guest'].includes(customerType)) {
    const error = new TypeError('El tipo de cliente no es valido.');
    error.code = 'CART_ADMIN_FILTER_INVALID';
    throw error;
  }

  const recoverable = clean(query.recoverable, 10).toLowerCase();
  if (recoverable && !['yes', 'no'].includes(recoverable)) {
    const error = new TypeError('El filtro recuperable no es valido.');
    error.code = 'CART_ADMIN_FILTER_INVALID';
    throw error;
  }

  const recoveryAttempts = clean(query.recoveryAttempts, 10).toLowerCase();
  if (recoveryAttempts && !['with', 'without'].includes(recoveryAttempts)) {
    const error = new TypeError('El filtro de intentos no es valido.');
    error.code = 'CART_ADMIN_FILTER_INVALID';
    throw error;
  }

  const dateFrom = safeDate(query.dateFrom, 'dateFrom');
  const rawDateTo = safeDate(query.dateTo, 'dateTo');
  const dateTo = rawDateTo
    ? new Date(rawDateTo.getFullYear(), rawDateTo.getMonth(), rawDateTo.getDate(), 23, 59, 59, 999)
    : null;
  if (dateFrom && dateTo && dateFrom > dateTo) {
    const error = new TypeError('El rango de fechas no es valido.');
    error.code = 'CART_ADMIN_FILTER_INVALID';
    throw error;
  }

  const minSubtotal = optionalNumber(query.minSubtotal, 'minSubtotal');
  const maxSubtotal = optionalNumber(query.maxSubtotal, 'maxSubtotal');
  const minUnits = optionalNumber(query.minUnits, 'minUnits', { integer: true });
  const maxUnits = optionalNumber(query.maxUnits, 'maxUnits', { integer: true });
  if (
    (minSubtotal !== null && maxSubtotal !== null && minSubtotal > maxSubtotal) ||
    (minUnits !== null && maxUnits !== null && minUnits > maxUnits)
  ) {
    const error = new TypeError('El rango numerico no es valido.');
    error.code = 'CART_ADMIN_FILTER_INVALID';
    throw error;
  }

  return {
    page,
    limit,
    q: clean(query.q, 120),
    view,
    lifecycle,
    customerType,
    recoverable,
    dateFrom,
    dateTo,
    minSubtotal,
    maxSubtotal,
    minUnits,
    maxUnits,
    recoveryAttempts,
    sort,
  };
}

function derivedStages(now = new Date()) {
  const activeBoundary = new Date(now.getTime() - ACTIVE_WINDOW_MS);
  const abandonedBoundary = new Date(now.getTime() - ABANDONED_WINDOW_MS);
  return [
    {
      $set: {
        activityAt: { $ifNull: ['$lastCustomerActivityAt', '$updatedAt'] },
        differentProducts: {
          $size: {
            $filter: {
              input: { $ifNull: ['$items', []] },
              as: 'item',
              cond: { $gt: [{ $ifNull: ['$$item.qty', 0] }, 0] },
            },
          },
        },
        totalUnits: {
          $sum: {
            $map: {
              input: { $ifNull: ['$items', []] },
              as: 'item',
              in: { $max: [0, { $ifNull: ['$$item.qty', 0] }] },
            },
          },
        },
        subtotal: {
          $sum: {
            $map: {
              input: { $ifNull: ['$items', []] },
              as: 'item',
              in: {
                $multiply: [
                  { $max: [0, { $ifNull: ['$$item.qty', 0] }] },
                  { $max: [0, { $ifNull: ['$$item.price', 0] }] },
                ],
              },
            },
          },
        },
        recoveryAttemptsCount: { $size: { $ifNull: ['$recoveryAttempts', []] } },
        identified: {
          $or: [
            { $gt: [{ $strLenCP: { $ifNull: ['$userId', ''] } }, 0] },
            { $gt: [{ $strLenCP: { $ifNull: ['$userName', ''] } }, 0] },
            { $gt: [{ $strLenCP: { $ifNull: ['$userEmail', ''] } }, 0] },
          ],
        },
        hasValidEmail: {
          $regexMatch: {
            input: { $ifNull: ['$userEmail', ''] },
            regex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
          },
        },
      },
    },
    {
      $set: {
        lifecycle: {
          $switch: {
            branches: [
              { case: { $ne: [{ $ifNull: ['$convertedOrderId', null] }, null] }, then: 'converted' },
              { case: { $lte: ['$totalUnits', 0] }, then: 'empty' },
              { case: { $gt: ['$activityAt', activeBoundary] }, then: 'active' },
              { case: { $gt: ['$activityAt', abandonedBoundary] }, then: 'inactive' },
              { case: '$hasValidEmail', then: 'recoverable' },
            ],
            default: 'abandoned',
          },
        },
      },
    },
  ];
}

function buildFilterMatch(filters) {
  const match = {};
  if (filters.q) {
    const regex = new RegExp(escapeRegex(filters.q), 'i');
    match.$or = [
      { sessionId: regex },
      { userName: regex },
      { userEmail: regex },
      { 'items.title': regex },
    ];
  }
  if (filters.lifecycle) match.lifecycle = filters.lifecycle;
  if (filters.customerType) match.identified = filters.customerType === 'identified';
  if (filters.recoverable) {
    match.lifecycle = filters.recoverable === 'yes'
      ? 'recoverable'
      : { $ne: 'recoverable' };
  }
  if (filters.dateFrom || filters.dateTo) {
    match.activityAt = {};
    if (filters.dateFrom) match.activityAt.$gte = filters.dateFrom;
    if (filters.dateTo) match.activityAt.$lte = filters.dateTo;
  }
  if (filters.minSubtotal !== null || filters.maxSubtotal !== null) {
    match.subtotal = {};
    if (filters.minSubtotal !== null) match.subtotal.$gte = filters.minSubtotal;
    if (filters.maxSubtotal !== null) match.subtotal.$lte = filters.maxSubtotal;
  }
  if (filters.minUnits !== null || filters.maxUnits !== null) {
    match.totalUnits = {};
    if (filters.minUnits !== null) match.totalUnits.$gte = filters.minUnits;
    if (filters.maxUnits !== null) match.totalUnits.$lte = filters.maxUnits;
  }
  if (filters.recoveryAttempts === 'with') match.recoveryAttemptsCount = { $gt: 0 };
  if (filters.recoveryAttempts === 'without') match.recoveryAttemptsCount = 0;

  const view = filters.view;
  if (view === 'active') match.lifecycle = 'active';
  if (view === 'abandoned') match.lifecycle = { $in: ['abandoned', 'recoverable'] };
  if (view === 'recoverable') match.lifecycle = 'recoverable';
  if (view === 'empty') match.lifecycle = 'empty';
  if (view === 'converted') match.lifecycle = 'converted';
  if (view === 'high_value') match.subtotal = { $gte: HIGH_VALUE_THRESHOLD };
  return match;
}

function buildSort(sort) {
  const options = {
    recent_activity: { activityAt: -1, _id: 1 },
    oldest_activity: { activityAt: 1, _id: 1 },
    highest_value: { subtotal: -1, activityAt: -1, _id: 1 },
    highest_quantity: { totalUnits: -1, activityAt: -1, _id: 1 },
  };
  return options[sort] || options.recent_activity;
}

function publicProjection() {
  return {
    accessTokenHash: 0,
    accessVersion: 0,
    accessIssuedAt: 0,
    recoveryAccess: 0,
    recoveryAttempts: 0,
    adminNotes: 0,
    recoveryEmailLockUntil: 0,
    recoveryEmailLockKeyHash: 0,
    items: 0,
  };
}

async function listAdminCarts(query = {}, { CartModel = Cart, now = new Date() } = {}) {
  const filters = parseAdminCartQuery(query);
  const pipeline = [
    ...derivedStages(now),
    { $match: buildFilterMatch(filters) },
    { $sort: buildSort(filters.sort) },
    {
      $facet: {
        data: [
          { $skip: (filters.page - 1) * filters.limit },
          { $limit: filters.limit },
          { $project: publicProjection() },
        ],
        metadata: [{ $count: 'total' }],
      },
    },
  ];
  const [result = {}] = await CartModel.aggregate(pipeline);
  const total = Number(result.metadata?.[0]?.total || 0);
  return {
    page: filters.page,
    limit: filters.limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / filters.limit)),
    data: result.data || [],
    highValueThreshold: HIGH_VALUE_THRESHOLD,
  };
}

async function getAdminCartSummary(query = {}, { CartModel = Cart, now = new Date() } = {}) {
  const filters = parseAdminCartQuery({ ...query, page: 1, limit: 20 });
  const match = buildFilterMatch({ ...filters, view: 'all' });
  const [summary = {}] = await CartModel.aggregate([
    ...derivedStages(now),
    { $match: match },
    {
      $group: {
        _id: null,
        cartsWithProducts: { $sum: { $cond: [{ $gt: ['$totalUnits', 0] }, 1, 0] } },
        active: { $sum: { $cond: [{ $eq: ['$lifecycle', 'active'] }, 1, 0] } },
        abandoned: {
          $sum: { $cond: [{ $in: ['$lifecycle', ['abandoned', 'recoverable']] }, 1, 0] },
        },
        recoverable: { $sum: { $cond: [{ $eq: ['$lifecycle', 'recoverable'] }, 1, 0] } },
        abandonedValue: {
          $sum: {
            $cond: [
              { $in: ['$lifecycle', ['abandoned', 'recoverable']] },
              '$subtotal',
              0,
            ],
          },
        },
        cartsValue: { $sum: { $cond: [{ $gt: ['$totalUnits', 0] }, '$subtotal', 0] } },
      },
    },
  ]);
  const cartsWithProducts = Number(summary.cartsWithProducts || 0);
  return {
    cartsWithProducts,
    active: Number(summary.active || 0),
    abandoned: Number(summary.abandoned || 0),
    recoverable: Number(summary.recoverable || 0),
    abandonedValue: Number(summary.abandonedValue || 0),
    averageCartValue: cartsWithProducts
      ? Number(summary.cartsValue || 0) / cartsWithProducts
      : 0,
  };
}

function csvCell(value) {
  const text = value instanceof Date ? value.toISOString() : String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function buildCartCsv(rows = []) {
  const columns = [
    'sessionId',
    'cliente',
    'correo',
    'tipo',
    'estado',
    'productos',
    'unidades',
    'subtotal',
    'ultimaActividad',
    'intentosRecuperacion',
    'ordenConvertida',
  ];
  const lines = [columns.map(csvCell).join(',')];
  for (const row of rows) {
    lines.push([
      row.sessionId,
      row.userName || '',
      row.userEmail || '',
      row.identified ? 'identificado' : 'invitado',
      row.lifecycle,
      row.differentProducts,
      row.totalUnits,
      row.subtotal,
      row.activityAt,
      row.recoveryAttemptsCount,
      row.convertedOrderId || '',
    ].map(csvCell).join(','));
  }
  return `\uFEFF${lines.join('\r\n')}`;
}

async function exportAdminCarts(query = {}, sessionIds = [], options = {}) {
  const { CartModel = Cart, now = new Date() } = options;
  const filters = parseAdminCartQuery({ ...query, page: 1, limit: 100 });
  const match = buildFilterMatch(filters);
  const cleanIds = Array.from(new Set(
    (Array.isArray(sessionIds) ? sessionIds : [])
      .map((value) => clean(value, 120))
      .filter(Boolean)
  )).slice(0, 500);
  if (cleanIds.length) match.sessionId = { $in: cleanIds };
  const rows = await CartModel.aggregate([
    ...derivedStages(now),
    { $match: match },
    { $sort: buildSort(filters.sort) },
    { $limit: 10000 },
    { $project: publicProjection() },
  ]);
  return buildCartCsv(rows);
}

async function markCartConverted(
  {
    sessionId,
    orderId,
    convertedAt = new Date(),
    authority = null,
  } = {},
  { CartModel = Cart, session = null } = {}
) {
  const safeSessionId = clean(sessionId, 120);
  if (!safeSessionId || !orderId) return { matchedCount: 0, modifiedCount: 0 };
  const filter = {
    sessionId: safeSessionId,
    $or: [
      { convertedOrderId: null },
      { convertedOrderId: { $exists: false } },
      { convertedOrderId: orderId },
    ],
  };

  if (authority) {
    const expectedUpdatedAt = new Date(authority.expectedUpdatedAt || 0);
    const safeCartId = authority.cartId;
    const safeTokenHash = clean(authority.accessTokenHash, 128);
    const accessVersion = Number(authority.accessVersion);
    if (
      !safeCartId ||
      !safeTokenHash ||
      !Number.isInteger(accessVersion) ||
      accessVersion <= 0 ||
      Number.isNaN(expectedUpdatedAt.getTime()) ||
      !Array.isArray(authority.items)
    ) {
      return { matchedCount: 0, modifiedCount: 0 };
    }
    filter._id = safeCartId;
    filter.accessTokenHash = safeTokenHash;
    filter.accessVersion = accessVersion;
    filter.updatedAt = expectedUpdatedAt;
    filter.items = authority.items;
  }

  const query = CartModel.updateOne(
    filter,
    {
      $set: {
        convertedOrderId: orderId,
        convertedAt,
        'recoveryAccess.usedAt': convertedAt,
      },
    }
  );
  return session && typeof query.session === 'function' ? query.session(session) : query;
}

module.exports = {
  ABANDONED_WINDOW_MS,
  ACTIVE_WINDOW_MS,
  HIGH_VALUE_THRESHOLD,
  buildCartCsv,
  buildFilterMatch,
  buildSort,
  classifyCartLifecycle,
  derivedStages,
  escapeRegex,
  exportAdminCarts,
  getAdminCartSummary,
  getCartMetrics,
  isValidEmail,
  listAdminCarts,
  markCartConverted,
  parseAdminCartQuery,
};
