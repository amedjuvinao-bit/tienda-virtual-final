'use strict';

// backend/services/couponService.js
const mongoose = require('mongoose');
const Coupon = require('../models/Coupon');
const CouponRedemption = require('../models/CouponRedemption');

const COUPON_TYPES = Coupon.COUPON_TYPES || ['percentage', 'fixed', 'free_shipping'];
const COUPON_STATUS = Coupon.COUPON_STATUS || ['draft', 'active', 'inactive', 'expired'];
const COUPON_APPLIES_TO = Coupon.COUPON_APPLIES_TO || ['all', 'products', 'categories'];
const COUPON_EFFECTIVE_STATUS = [
  'active',
  'scheduled',
  'exhausted',
  'expired',
  'inactive',
  'draft',
];

function createServiceError(message, status = 400, code = 'COUPON_ERROR') {
  const error = new Error(message);
  error.status = status;
  error.statusCode = status;
  error.code = code;
  return error;
}

function trimSafe(value, max = 500) {
  return String(value || '').trim().slice(0, max);
}

function normalizeCode(value) {
  return trimSafe(value, 40).toUpperCase().replace(/\s+/g, '');
}

function normalizeLower(value) {
  return trimSafe(value, 120).toLowerCase();
}

function numberSafe(value, fallback = 0) {
  if (value === '' || value === null || value === undefined) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function moneySafe(value, fallback = 0) {
  return Math.max(0, numberSafe(value, fallback));
}

function roundMoney(value, fallback = 0) {
  return Math.round(moneySafe(value, fallback) * 100) / 100;
}

function strictNumber(
  value,
  {
    field = 'valor',
    code = 'COUPON_NUMBER_INVALID',
    nullable = false,
    integer = false,
    min = 0,
  } = {}
) {
  if (value === '' || value === null || value === undefined) {
    return nullable ? null : min;
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || (integer && !Number.isInteger(number))) {
    const requirement = integer
      ? `un número entero mayor o igual a ${min}`
      : `un número mayor o igual a ${min}`;
    throw createServiceError(
      `${field} debe ser ${requirement}.`,
      400,
      code
    );
  }
  return number;
}

function optionalMoney(value, field, code) {
  return strictNumber(value, { field, code, nullable: true, min: 0 });
}

function optionalPositiveMoney(value, field, code) {
  const number = optionalMoney(value, field, code);
  if (number === null) return null;
  if (number <= 0) {
    throw createServiceError(`${field} debe ser mayor que cero.`, 400, code);
  }
  return number;
}

function optionalPositiveInteger(value, field, code) {
  return strictNumber(value, {
    field,
    code,
    nullable: true,
    integer: true,
    min: 1,
  });
}

function optionalDate(value, field, code) {
  if (value === '' || value === null || value === undefined) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw createServiceError(`${field} no contiene una fecha válida.`, 400, code);
  }
  return date;
}

function normalizeStringArray(values = []) {
  if (!Array.isArray(values)) return [];
  const seen = new Set();
  const result = [];

  values.forEach((value) => {
    const text = trimSafe(value, 120);
    if (!text) return;
    const key = normalizeLower(text);
    if (seen.has(key)) return;
    seen.add(key);
    result.push(text);
  });

  return result;
}

function normalizeObjectIdArray(values = [], field = 'identificadores') {
  if (values === null || values === undefined || values === '') return [];
  if (!Array.isArray(values)) {
    throw createServiceError(
      `${field} debe enviarse como una lista.`,
      400,
      'COUPON_OBJECT_ID_LIST_INVALID'
    );
  }
  const seen = new Set();
  const result = [];

  values.forEach((value) => {
    const raw = typeof value === 'object' ? value?._id || value?.id : value;
    const text = trimSafe(raw, 80);
    if (!mongoose.Types.ObjectId.isValid(text)) {
      throw createServiceError(
        `${field} contiene un identificador inválido.`,
        400,
        'COUPON_OBJECT_ID_INVALID'
      );
    }
    const key = String(text);
    if (seen.has(key)) return;
    seen.add(key);
    result.push(new mongoose.Types.ObjectId(text));
  });

  return result;
}

function normalizeActor(actor = {}) {
  const source = actor && typeof actor === 'object' ? actor : {};
  const snapshot = source.snapshot && typeof source.snapshot === 'object' ? source.snapshot : {};
  const adminUserId = source.adminUserId || source._id || snapshot.adminUserId || null;

  return {
    adminUserId: mongoose.Types.ObjectId.isValid(String(adminUserId || ''))
      ? new mongoose.Types.ObjectId(String(adminUserId))
      : null,
    username: trimSafe(snapshot.username || source.username, 120),
    displayName: trimSafe(snapshot.displayName || source.displayName, 160),
    role: trimSafe(snapshot.adminRole || snapshot.role || source.role, 80),
  };
}

function arraysOverlap(left = [], right = [], normalizer = (value) => String(value)) {
  const values = new Set(left.map(normalizer));
  return right.some((value) => values.has(normalizer(value)));
}

function cleanCouponPayload(body = {}) {
  const source = body && typeof body === 'object' ? body : {};
  const payload = {};

  const code = normalizeCode(source.code);
  if (!code) throw createServiceError('El código del cupón es obligatorio.', 400, 'COUPON_CODE_REQUIRED');
  if (code.length < 3) throw createServiceError('El código del cupón debe tener mínimo 3 caracteres.', 400, 'COUPON_CODE_TOO_SHORT');
  payload.code = code;
  payload.name = trimSafe(source.name, 120);
  payload.description = trimSafe(source.description, 500);

  const type = trimSafe(source.type || 'percentage', 40).toLowerCase();
  if (!COUPON_TYPES.includes(type)) {
    throw createServiceError('Tipo de cupón inválido.', 400, 'COUPON_TYPE_INVALID');
  }
  payload.type = type;

  const value = strictNumber(source.value, {
    field: 'El valor del cupón',
    code: 'COUPON_VALUE_INVALID',
    min: 0,
  });
  if (type === 'percentage' && value > 100) {
    throw createServiceError('El porcentaje del cupón no puede superar 100%.', 400, 'COUPON_PERCENTAGE_TOO_HIGH');
  }
  if (type !== 'free_shipping' && value <= 0) {
    throw createServiceError('El valor del cupón debe ser mayor que cero.', 400, 'COUPON_VALUE_REQUIRED');
  }
  payload.value = type === 'free_shipping' ? 0 : value;
  payload.maxDiscountAmount = type === 'percentage'
    ? optionalPositiveMoney(
        source.maxDiscountAmount,
        'El tope de descuento',
        'COUPON_MAX_DISCOUNT_INVALID'
      )
    : null;
  payload.minSubtotal = strictNumber(source.minSubtotal, {
    field: 'La compra mínima',
    code: 'COUPON_MIN_SUBTOTAL_INVALID',
    min: 0,
  });

  const status = trimSafe(source.status || 'active', 40).toLowerCase();
  if (!COUPON_STATUS.includes(status)) {
    throw createServiceError('Estado de cupón inválido.', 400, 'COUPON_STATUS_INVALID');
  }
  payload.status = status;
  payload.active = status === 'active';
  payload.startsAt = optionalDate(
    source.startsAt,
    'La fecha inicial',
    'COUPON_START_DATE_INVALID'
  );
  payload.endsAt = optionalDate(
    source.endsAt,
    'La fecha final',
    'COUPON_END_DATE_INVALID'
  );

  if (payload.startsAt && payload.endsAt && payload.endsAt <= payload.startsAt) {
    throw createServiceError('La fecha final debe ser posterior a la fecha inicial.', 400, 'COUPON_DATE_RANGE_INVALID');
  }

  payload.usageLimit = optionalPositiveInteger(
    source.usageLimit,
    'El límite total de usos',
    'COUPON_USAGE_LIMIT_INVALID'
  );
  payload.perCustomerLimit = optionalPositiveInteger(
    source.perCustomerLimit,
    'El límite por cliente',
    'COUPON_CUSTOMER_LIMIT_INVALID'
  );

  const appliesTo = trimSafe(source.appliesTo || 'all', 40).toLowerCase();
  if (!COUPON_APPLIES_TO.includes(appliesTo)) {
    throw createServiceError('Regla de aplicación inválida.', 400, 'COUPON_APPLIES_TO_INVALID');
  }
  payload.appliesTo = appliesTo;
  payload.productIds = normalizeObjectIdArray(source.productIds, 'Los productos incluidos');
  payload.excludedProductIds = normalizeObjectIdArray(source.excludedProductIds, 'Los productos excluidos');
  payload.categories = normalizeStringArray(source.categories);
  payload.excludedCategories = normalizeStringArray(source.excludedCategories);
  payload.customerIds = normalizeObjectIdArray(source.customerIds, 'Los clientes permitidos');

  if (appliesTo === 'products' && payload.productIds.length === 0) {
    throw createServiceError(
      'Debes seleccionar al menos un producto para este cupón.',
      400,
      'COUPON_PRODUCTS_REQUIRED'
    );
  }
  if (appliesTo === 'categories' && payload.categories.length === 0) {
    throw createServiceError(
      'Debes seleccionar al menos una categoría para este cupón.',
      400,
      'COUPON_CATEGORIES_REQUIRED'
    );
  }
  if (arraysOverlap(payload.productIds, payload.excludedProductIds, String)) {
    throw createServiceError(
      'Un producto no puede estar incluido y excluido al mismo tiempo.',
      400,
      'COUPON_PRODUCT_RULE_CONFLICT'
    );
  }
  if (arraysOverlap(payload.categories, payload.excludedCategories, normalizeLower)) {
    throw createServiceError(
      'Una categoría no puede estar incluida y excluida al mismo tiempo.',
      400,
      'COUPON_CATEGORY_RULE_CONFLICT'
    );
  }

  payload.newCustomersOnly = source.newCustomersOnly === true;
  if (payload.customerIds.length > 0 || payload.newCustomersOnly) {
    throw createServiceError(
      'Las reglas por cliente estarán disponibles cuando exista identificación autoritativa en checkout.',
      409,
      'COUPON_CUSTOMER_RULES_NOT_AVAILABLE'
    );
  }
  payload.tags = normalizeStringArray(source.tags);
  payload.internalNotes = trimSafe(source.internalNotes, 1000);

  return payload;
}

function serializeCoupon(coupon) {
  const plain = coupon?.toObject ? coupon.toObject() : { ...(coupon || {}) };
  const now = new Date();
  const startsAt = plain.startsAt ? new Date(plain.startsAt) : null;
  const endsAt = plain.endsAt ? new Date(plain.endsAt) : null;
  const usageLimit = plain.usageLimit === null || plain.usageLimit === undefined ? null : Number(plain.usageLimit);
  const usageCount = Number(plain.usageCount || 0);

  const effectiveStatus = (() => {
    if (plain.deletedAt) return 'deleted';
    if (plain.status === 'draft') return 'draft';
    if (plain.status === 'expired' || (endsAt && endsAt <= now)) return 'expired';
    if (plain.active === false || plain.status === 'inactive') return 'inactive';
    if (startsAt && startsAt > now) return 'scheduled';
    if (usageLimit !== null && usageLimit > 0 && usageCount >= usageLimit) return 'exhausted';
    return 'active';
  })();

  return {
    ...plain,
    effectiveStatus,
    usageCount,
    remainingUses:
      usageLimit !== null && usageLimit > 0
        ? Math.max(0, usageLimit - usageCount)
        : null,
  };
}

function serializePublicCoupon(coupon) {
  const plain = serializeCoupon(coupon);
  return {
    code: plain.code || '',
    name: plain.name || '',
    type: plain.type || '',
    value: Number(plain.value || 0),
    minSubtotal: Number(plain.minSubtotal || 0),
    maxDiscountAmount:
      plain.maxDiscountAmount === null || plain.maxDiscountAmount === undefined
        ? null
        : Number(plain.maxDiscountAmount),
    effectiveStatus: plain.effectiveStatus || '',
    startsAt: plain.startsAt || null,
    endsAt: plain.endsAt || null,
  };
}

function serializePublicValidation(validation = {}) {
  const source = validation && typeof validation === 'object' ? validation : {};
  const safe = {
    valid: source.valid === true,
    code: trimSafe(source.code, 80),
    message: trimSafe(source.message, 500),
  };

  if (source.coupon) safe.coupon = serializePublicCoupon(source.coupon);
  if (source.discount && typeof source.discount === 'object') {
    safe.discount = {
      eligibleSubtotal: roundMoney(source.discount.eligibleSubtotal),
      discountAmount: roundMoney(source.discount.discountAmount),
      shippingDiscountAmount: roundMoney(source.discount.shippingDiscountAmount),
      totalDiscountAmount: roundMoney(source.discount.totalDiscountAmount),
      message: trimSafe(source.discount.message, 500),
    };
  }
  if (source.totals && typeof source.totals === 'object') {
    safe.totals = {
      subtotal: roundMoney(source.totals.subtotal),
      shippingAmount: roundMoney(source.totals.shippingAmount),
      discountAmount: roundMoney(source.totals.discountAmount),
      shippingDiscountAmount: roundMoney(source.totals.shippingDiscountAmount),
      totalDiscountAmount: roundMoney(source.totals.totalDiscountAmount),
      totalAfterDiscount: roundMoney(source.totals.totalAfterDiscount),
    };
  }
  return safe;
}

function buildEffectiveStatusFilter(status, now = new Date()) {
  const normalized = trimSafe(status, 40).toLowerCase();
  if (!COUPON_EFFECTIVE_STATUS.includes(normalized)) return null;

  const activeState = [
    { active: { $ne: false } },
    { status: { $in: ['active', null] } },
  ];
  const notExpired = {
    $or: [
      { endsAt: null },
      { endsAt: { $exists: false } },
      { endsAt: { $gt: now } },
    ],
  };
  const alreadyStarted = {
    $or: [
      { startsAt: null },
      { startsAt: { $exists: false } },
      { startsAt: { $lte: now } },
    ],
  };
  const hasRemainingUses = {
    $or: [
      { usageLimit: null },
      { usageLimit: { $exists: false } },
      { usageLimit: { $lte: 0 } },
      {
        $expr: {
          $lt: [
            { $ifNull: ['$usageCount', 0] },
            { $ifNull: ['$usageLimit', 0] },
          ],
        },
      },
    ],
  };

  if (normalized === 'draft') return { status: 'draft' };
  if (normalized === 'expired') {
    return {
      status: { $ne: 'draft' },
      $or: [{ status: 'expired' }, { endsAt: { $lte: now } }],
    };
  }
  if (normalized === 'inactive') {
    return {
      status: { $nin: ['draft', 'expired'] },
      ...notExpired,
      $and: [
        { $or: [{ active: false }, { status: 'inactive' }] },
      ],
    };
  }
  if (normalized === 'scheduled') {
    return {
      $and: [...activeState, notExpired, { startsAt: { $gt: now } }],
    };
  }
  if (normalized === 'exhausted') {
    return {
      $and: [
        ...activeState,
        notExpired,
        alreadyStarted,
        { usageLimit: { $gt: 0 } },
        {
          $expr: {
            $gte: [
              { $ifNull: ['$usageCount', 0] },
              '$usageLimit',
            ],
          },
        },
      ],
    };
  }
  return {
    $and: [...activeState, notExpired, alreadyStarted, hasRemainingUses],
  };
}

function validateCouponStatus(coupon, now = new Date()) {
  if (!coupon || coupon.deletedAt) {
    return { ok: false, code: 'COUPON_NOT_FOUND', message: 'Cupón no encontrado.' };
  }

  if (coupon.active === false || coupon.status === 'inactive') {
    return { ok: false, code: 'COUPON_INACTIVE', message: 'El cupón está inactivo.' };
  }

  if (coupon.status === 'draft') {
    return { ok: false, code: 'COUPON_DRAFT', message: 'El cupón aún está en borrador.' };
  }

  if (coupon.status === 'expired') {
    return { ok: false, code: 'COUPON_EXPIRED', message: 'El cupón ya venció.' };
  }

  if (coupon.startsAt && new Date(coupon.startsAt) > now) {
    return { ok: false, code: 'COUPON_NOT_STARTED', message: 'El cupón todavía no está vigente.' };
  }

  if (coupon.endsAt && new Date(coupon.endsAt) <= now) {
    return { ok: false, code: 'COUPON_EXPIRED', message: 'El cupón ya venció.' };
  }

  const usageLimit = coupon.usageLimit === null || coupon.usageLimit === undefined ? null : Number(coupon.usageLimit);
  if (usageLimit !== null && usageLimit > 0 && Number(coupon.usageCount || 0) >= usageLimit) {
    return { ok: false, code: 'COUPON_USAGE_LIMIT_REACHED', message: 'El cupón ya alcanzó su límite de usos.' };
  }

  return { ok: true };
}

function getItemProductId(item) {
  const raw = item?.productId || item?.product || item?._id || item?.id || '';
  if (raw && typeof raw === 'object') return String(raw._id || raw.id || '').trim();
  return String(raw || '').trim();
}

function getItemCategories(item) {
  const categories = [];
  if (item?.category) categories.push(item.category);
  if (Array.isArray(item?.categories)) categories.push(...item.categories);
  if (item?.product?.category) categories.push(item.product.category);
  if (Array.isArray(item?.product?.categories)) categories.push(...item.product.categories);
  return categories.map(normalizeLower).filter(Boolean);
}

function getItemLineTotal(item) {
  const explicit = numberSafe(item?.lineTotal ?? item?.total ?? item?.subtotal, NaN);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;

  const qty = Math.max(0, numberSafe(item?.quantity ?? item?.qty, 0));
  const price = moneySafe(item?.price ?? item?.unitPrice ?? item?.product?.price, 0);
  return qty * price;
}

function isItemEligibleForCoupon(coupon = {}, item = {}) {
  const appliesTo = coupon.appliesTo || 'all';
  const productId = getItemProductId(item);
  const categories = getItemCategories(item);
  const allowedProductIds = new Set((coupon.productIds || []).map(String));
  const excludedProductIds = new Set((coupon.excludedProductIds || []).map(String));
  const allowedCategories = new Set((coupon.categories || []).map(normalizeLower));
  const excludedCategories = new Set((coupon.excludedCategories || []).map(normalizeLower));

  if (productId && excludedProductIds.has(productId)) return false;
  if (categories.some((category) => excludedCategories.has(category))) return false;

  if (appliesTo === 'products') {
    return allowedProductIds.size > 0 && Boolean(productId && allowedProductIds.has(productId));
  }

  if (appliesTo === 'categories') {
    return allowedCategories.size > 0 && categories.some((category) => allowedCategories.has(category));
  }

  return true;
}

function calculateEligibleSubtotal(coupon, items = [], fallbackSubtotal = 0) {
  const appliesTo = coupon.appliesTo || 'all';
  const subtotal = moneySafe(fallbackSubtotal, 0);
  const hasExclusions =
    (coupon.excludedProductIds || []).length > 0 ||
    (coupon.excludedCategories || []).length > 0;

  if (appliesTo === 'all' && !hasExclusions) {
    return subtotal;
  }
  if (!Array.isArray(items) || items.length === 0) return 0;

  return items.reduce((sum, item) => {
    return isItemEligibleForCoupon(coupon, item) ? sum + getItemLineTotal(item) : sum;
  }, 0);
}

function calculateDiscount(coupon, { subtotal = 0, shippingAmount = 0, items = [] } = {}) {
  const eligibleSubtotal = calculateEligibleSubtotal(coupon, items, subtotal);
  const safeSubtotal = moneySafe(subtotal, 0);
  const safeShipping = moneySafe(shippingAmount, 0);

  if (eligibleSubtotal <= 0) {
    return {
      eligibleSubtotal,
      discountAmount: 0,
      shippingDiscountAmount: 0,
      totalDiscountAmount: 0,
      message: 'El cupón no aplica a los productos del carrito.',
    };
  }

  let discountAmount = 0;
  let shippingDiscountAmount = 0;

  if (coupon.type === 'percentage') {
    discountAmount = eligibleSubtotal * (Number(coupon.value || 0) / 100);
  }

  if (coupon.type === 'fixed') {
    discountAmount = Math.min(Number(coupon.value || 0), eligibleSubtotal);
  }

  if (coupon.type === 'free_shipping') {
    shippingDiscountAmount = safeShipping;
  }

  if (coupon.maxDiscountAmount !== null && coupon.maxDiscountAmount !== undefined && coupon.type === 'percentage') {
    discountAmount = Math.min(discountAmount, Number(coupon.maxDiscountAmount || 0));
  }

  discountAmount = Math.min(roundMoney(discountAmount), roundMoney(safeSubtotal));
  shippingDiscountAmount = Math.min(
    roundMoney(shippingDiscountAmount),
    roundMoney(safeShipping)
  );

  return {
    eligibleSubtotal: roundMoney(eligibleSubtotal),
    discountAmount,
    shippingDiscountAmount,
    totalDiscountAmount: roundMoney(discountAmount + shippingDiscountAmount),
    message: '',
  };
}

async function ensurePerCustomerLimit(
  coupon,
  { customerId = '', customerEmail = '' } = {},
  options = {}
) {
  const limit = Number(coupon.perCustomerLimit || 0);
  if (!Number.isFinite(limit) || limit <= 0) return { ok: true };

  const consumingStatuses = ['reserved', 'applied'];
  const filters = [{ coupon: coupon._id, status: { $in: consumingStatuses } }];
  const customerObjectId = mongoose.Types.ObjectId.isValid(String(customerId || ''))
    ? new mongoose.Types.ObjectId(String(customerId))
    : null;
  const email = normalizeLower(customerEmail);

  if (customerObjectId) filters.push({ customer: customerObjectId });
  if (email) filters.push({ customerEmail: email });

  if (filters.length === 1) return { ok: true };

  const query = {
    $and: [
      { coupon: coupon._id, status: { $in: consumingStatuses } },
      { $or: filters.slice(1) },
    ],
  };

  let countQuery = CouponRedemption.countDocuments(query);
  if (options.session && typeof countQuery.session === 'function') {
    countQuery = countQuery.session(options.session);
  }
  const count = await countQuery;

  if (count >= limit) {
    return {
      ok: false,
      code: 'COUPON_CUSTOMER_LIMIT_REACHED',
      message: 'Este cliente ya alcanzó el límite de uso del cupón.',
    };
  }

  return { ok: true };
}

async function listCoupons(params = {}) {
  const page = Math.max(1, numberSafe(params.page, 1));
  const limit = Math.min(100, Math.max(1, numberSafe(params.limit, 20)));
  const skip = (page - 1) * limit;
  const filter = { deletedAt: null };

  const q = trimSafe(params.q || params.search, 80);
  if (q) {
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ code: regex }, { name: regex }, { description: regex }];
  }

  const type = trimSafe(params.type, 40).toLowerCase();
  if (COUPON_TYPES.includes(type)) filter.type = type;

  const effectiveStatus = trimSafe(params.effectiveStatus, 40).toLowerCase();
  const effectiveStatusFilter = buildEffectiveStatusFilter(effectiveStatus);
  if (effectiveStatusFilter) {
    filter.$and = [
      ...(Array.isArray(filter.$and) ? filter.$and : []),
      effectiveStatusFilter,
    ];
  } else {
    const status = trimSafe(params.status, 40).toLowerCase();
    if (COUPON_STATUS.includes(status)) filter.status = status;
  }

  if (params.active === 'true') filter.active = true;
  if (params.active === 'false') filter.active = false;

  const [total, rows] = await Promise.all([
    Coupon.countDocuments(filter),
    Coupon.find(filter).sort({ createdAt: -1, code: 1 }).skip(skip).limit(limit),
  ]);

  return {
    rows: rows.map(serializeCoupon),
    total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(total / limit)),
  };
}

async function getCouponById(id) {
  if (!mongoose.Types.ObjectId.isValid(String(id || ''))) {
    throw createServiceError('Cupón no encontrado.', 404, 'COUPON_NOT_FOUND');
  }

  const coupon = await Coupon.findOne({ _id: id, deletedAt: null });
  if (!coupon) throw createServiceError('Cupón no encontrado.', 404, 'COUPON_NOT_FOUND');
  return serializeCoupon(coupon);
}

async function createCoupon(body = {}, actor = {}) {
  const payload = cleanCouponPayload(body);
  payload.createdBy = normalizeActor(actor);
  payload.updatedBy = normalizeActor(actor);

  try {
    const coupon = await Coupon.create(payload);
    return serializeCoupon(coupon);
  } catch (error) {
    if (error?.code === 11000) {
      throw createServiceError('Ya existe un cupón con ese código.', 409, 'COUPON_CODE_DUPLICATED');
    }
    throw error;
  }
}

async function updateCoupon(id, body = {}, actor = {}) {
  if (!mongoose.Types.ObjectId.isValid(String(id || ''))) {
    throw createServiceError('Cupón no encontrado.', 404, 'COUPON_NOT_FOUND');
  }

  const current = await Coupon.findOne({ _id: id, deletedAt: null });
  if (!current) throw createServiceError('Cupón no encontrado.', 404, 'COUPON_NOT_FOUND');

  const patch = body && typeof body === 'object' ? body : {};
  const merged = { ...current.toObject(), ...patch };
  for (const field of ['usageLimit', 'perCustomerLimit', 'maxDiscountAmount']) {
    if (!Object.prototype.hasOwnProperty.call(patch, field) && Number(merged[field]) === 0) {
      merged[field] = null;
    }
  }
  const payload = cleanCouponPayload(merged);
  payload.updatedBy = normalizeActor(actor);

  try {
    const coupon = await Coupon.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: payload },
      { new: true, runValidators: true }
    );

    if (!coupon) throw createServiceError('Cupón no encontrado.', 404, 'COUPON_NOT_FOUND');
    return serializeCoupon(coupon);
  } catch (error) {
    if (error?.code === 11000) {
      throw createServiceError('Ya existe un cupón con ese código.', 409, 'COUPON_CODE_DUPLICATED');
    }
    throw error;
  }
}

async function setCouponStatus(id, body = {}, actor = {}) {
  const status = trimSafe(body.status || '', 40).toLowerCase();
  const patch = {};

  if (status) {
    if (!COUPON_STATUS.includes(status)) {
      throw createServiceError('Estado de cupón inválido.', 400, 'COUPON_STATUS_INVALID');
    }
    patch.status = status;
    patch.active = status === 'active';
  }

  if (body.active !== undefined) {
    patch.active = body.active === true;
    if (patch.active && !status) patch.status = 'active';
    if (!patch.active && !status) patch.status = 'inactive';
  }

  if (!Object.keys(patch).length) {
    throw createServiceError('No se envió ningún cambio de estado.', 400, 'COUPON_STATUS_PATCH_EMPTY');
  }

  if (patch.active === true || patch.status === 'active') {
    if (!mongoose.Types.ObjectId.isValid(String(id || ''))) {
      throw createServiceError('Cupón no encontrado.', 404, 'COUPON_NOT_FOUND');
    }
    const coupon = await Coupon.findOne({ _id: id, deletedAt: null }).lean();
    if (!coupon) throw createServiceError('Cupón no encontrado.', 404, 'COUPON_NOT_FOUND');
    if (coupon.endsAt && new Date(coupon.endsAt) <= new Date()) {
      throw createServiceError(
        'Actualiza primero la fecha de vencimiento para reactivar este cupón.',
        409,
        'COUPON_REACTIVATION_REQUIRES_END_DATE'
      );
    }
    const usageLimit = Number(coupon.usageLimit || 0);
    if (usageLimit > 0 && Number(coupon.usageCount || 0) >= usageLimit) {
      throw createServiceError(
        'Aumenta primero el límite de usos para reactivar este cupón.',
        409,
        'COUPON_REACTIVATION_REQUIRES_USAGE_LIMIT'
      );
    }
  }

  return updateCoupon(id, patch, actor);
}

async function deleteCoupon(id, actor = {}) {
  if (!mongoose.Types.ObjectId.isValid(String(id || ''))) {
    throw createServiceError('Cupón no encontrado.', 404, 'COUPON_NOT_FOUND');
  }

  const coupon = await Coupon.findOneAndUpdate(
    { _id: id, deletedAt: null },
    {
      $set: {
        active: false,
        status: 'inactive',
        deletedAt: new Date(),
        deletedBy: normalizeActor(actor),
        updatedBy: normalizeActor(actor),
      },
    },
    { new: true }
  );

  if (!coupon) throw createServiceError('Cupón no encontrado.', 404, 'COUPON_NOT_FOUND');
  return serializeCoupon(coupon);
}

async function validateCoupon(input = {}, options = {}) {
  const code = normalizeCode(input.code);
  if (!code) {
    return { valid: false, code: 'COUPON_CODE_REQUIRED', message: 'Debes ingresar un cupón.' };
  }

  let couponQuery = Coupon.findOne({ code, deletedAt: null });
  if (options.session && typeof couponQuery.session === 'function') {
    couponQuery = couponQuery.session(options.session);
  }
  const coupon = await couponQuery;
  const statusValidation = validateCouponStatus(coupon);
  if (!statusValidation.ok) return { valid: false, ...statusValidation };

  const subtotal = moneySafe(input.subtotal ?? input.cartSubtotal, 0);
  const shippingAmount = moneySafe(input.shippingAmount ?? input.shipping ?? input.deliveryAmount, 0);
  const items = Array.isArray(input.items) ? input.items : Array.isArray(input.cart) ? input.cart : [];

  if (subtotal < Number(coupon.minSubtotal || 0)) {
    return {
      valid: false,
      code: 'COUPON_MIN_SUBTOTAL_NOT_REACHED',
      message: `El pedido debe ser mínimo de $${Number(coupon.minSubtotal || 0).toLocaleString('es-CO')} para usar este cupón.`,
      coupon: serializeCoupon(coupon),
    };
  }

  const customerLimit = await ensurePerCustomerLimit(coupon, {
    customerId: input.customerId,
    customerEmail: input.customerEmail || input.email,
  }, options);

  if (!customerLimit.ok) {
    return { valid: false, ...customerLimit, coupon: serializeCoupon(coupon) };
  }

  const discount = calculateDiscount(coupon, { subtotal, shippingAmount, items });
  if (coupon.type === 'free_shipping' && shippingAmount <= 0) {
    return {
      valid: false,
      code: 'COUPON_FREE_SHIPPING_WITHOUT_SHIPPING',
      message: 'El cupón es de envío gratis, pero el pedido no tiene valor de envío para descontar.',
      coupon: serializeCoupon(coupon),
      discount,
    };
  }

  if (discount.totalDiscountAmount <= 0) {
    return {
      valid: false,
      code: 'COUPON_NOT_APPLICABLE_TO_CART',
      message: discount.message || 'El cupón no aplica para este carrito.',
      coupon: serializeCoupon(coupon),
      discount,
    };
  }

  return {
    valid: true,
    code: 'COUPON_VALID',
    message: 'Cupón aplicado correctamente.',
    coupon: serializeCoupon(coupon),
    discount,
    totals: {
      subtotal,
      shippingAmount,
      discountAmount: discount.discountAmount,
      shippingDiscountAmount: discount.shippingDiscountAmount,
      totalDiscountAmount: discount.totalDiscountAmount,
      totalAfterDiscount: roundMoney(
        Math.max(0, subtotal + shippingAmount - discount.totalDiscountAmount)
      ),
    },
  };
}

async function recordCouponRedemption({ couponId, code, orderId, orderNumber, customerId, customerEmail, sessionId, source, subtotal, shippingAmount, discount } = {}, options = {}) {
  if (!mongoose.Types.ObjectId.isValid(String(couponId || ''))) {
    throw createServiceError('Cupón inválido para registrar uso.', 400, 'COUPON_ID_INVALID');
  }

  const couponObjectId = new mongoose.Types.ObjectId(String(couponId));
  const customerObjectId = mongoose.Types.ObjectId.isValid(String(customerId || ''))
    ? new mongoose.Types.ObjectId(String(customerId))
    : null;
  const orderObjectId = mongoose.Types.ObjectId.isValid(String(orderId || ''))
    ? new mongoose.Types.ObjectId(String(orderId))
    : null;

  const discountData = discount && typeof discount === 'object' ? discount : {};
  const initialStatus = trimSafe(options.initialStatus, 20).toLowerCase() === 'applied'
    ? 'applied'
    : 'reserved';
  const redemptionPayload = {
    coupon: couponObjectId,
    code: normalizeCode(code),
    order: orderObjectId,
    orderNumber: trimSafe(orderNumber, 80),
    customer: customerObjectId,
    customerEmail: normalizeLower(customerEmail),
    sessionId: trimSafe(sessionId, 120),
    subtotal: moneySafe(subtotal, 0),
    shippingAmount: moneySafe(shippingAmount, 0),
    discountAmount: moneySafe(discountData.discountAmount, 0),
    shippingDiscountAmount: moneySafe(discountData.shippingDiscountAmount, 0),
    totalDiscountAmount: moneySafe(discountData.totalDiscountAmount, 0),
    source: ['checkout', 'admin', 'pos', 'manual'].includes(source) ? source : 'checkout',
    status: initialStatus,
    meta: discountData,
    reservedAt: new Date(),
    appliedAt: initialStatus === 'applied' ? new Date() : null,
    lifecycle: [{
      from: '',
      to: initialStatus,
      reason: initialStatus === 'applied'
        ? 'Orden creada con pago confirmado.'
        : 'Uso reservado durante la creación de la orden.',
      source: trimSafe(options.source || source || 'checkout', 60),
      at: new Date(),
    }],
  };

  const session = options.session || null;
  if (orderObjectId) {
    let existingQuery = CouponRedemption.findOne({
      coupon: couponObjectId,
      order: orderObjectId,
    });
    if (session && typeof existingQuery.session === 'function') {
      existingQuery = existingQuery.session(session);
    }
    const existing = await existingQuery;
    if (existing) return existing.toObject ? existing.toObject() : existing;
  }

  let redemption;
  try {
    redemption = await CouponRedemption.create([redemptionPayload], { session })
      .then((rows) => rows[0]);
  } catch (error) {
    if (error?.code === 11000 && orderObjectId) {
      let duplicateQuery = CouponRedemption.findOne({
        coupon: couponObjectId,
        order: orderObjectId,
      });
      if (session && typeof duplicateQuery.session === 'function') {
        duplicateQuery = duplicateQuery.session(session);
      }
      const duplicate = await duplicateQuery;
      if (duplicate) return duplicate.toObject ? duplicate.toObject() : duplicate;
    }
    throw error;
  }

  const usageUpdate = await Coupon.updateOne(
    {
      _id: couponObjectId,
      deletedAt: null,
      active: { $ne: false },
      status: { $in: ['active', null] },
      $or: [
        { usageLimit: null },
        { usageLimit: { $exists: false } },
        { usageLimit: { $lte: 0 } },
        {
          $expr: {
            $lt: [
              { $ifNull: ['$usageCount', 0] },
              { $ifNull: ['$usageLimit', 0] },
            ],
          },
        },
      ],
    },
    { $inc: { usageCount: 1 } },
    { session }
  );

  if (!usageUpdate.matchedCount) {
    await CouponRedemption.deleteOne({ _id: redemption._id }, { session });
    throw createServiceError(
      'El cupón dejó de estar disponible antes de finalizar la orden.',
      409,
      'COUPON_USAGE_LIMIT_REACHED'
    );
  }

  return redemption?.toObject ? redemption.toObject() : redemption;
}

function redemptionLookup(order = {}) {
  const redemptionId = order?.coupon?.redemption;
  if (mongoose.Types.ObjectId.isValid(String(redemptionId || ''))) {
    return { _id: new mongoose.Types.ObjectId(String(redemptionId)) };
  }
  if (mongoose.Types.ObjectId.isValid(String(order?._id || ''))) {
    return { order: new mongoose.Types.ObjectId(String(order._id)) };
  }
  return null;
}

async function transitionOrderCouponRedemption(
  order,
  { to, reason = '', source = 'system' } = {},
  options = {}
) {
  const target = trimSafe(to, 20).toLowerCase();
  const allowed = ['applied', 'released', 'cancelled', 'refunded'];
  if (!allowed.includes(target)) {
    throw createServiceError('Estado de redención inválido.', 400, 'COUPON_REDEMPTION_STATUS_INVALID');
  }
  const lookup = redemptionLookup(order);
  if (!lookup) {
    return { changed: false, skipped: true, reason: 'order_without_coupon' };
  }

  const fromStatuses = target === 'applied'
    ? ['reserved']
    : target === 'refunded'
      ? ['applied']
      : ['reserved'];
  const now = options.now instanceof Date ? options.now : new Date();
  const safeReason = trimSafe(reason, 500);
  const safeSource = trimSafe(source, 60);
  const timestampField = {
    applied: 'appliedAt',
    released: 'releasedAt',
    cancelled: 'cancelledAt',
    refunded: 'refundedAt',
  }[target];
  const reasonField = {
    released: 'releaseReason',
    cancelled: 'cancelledReason',
    refunded: 'refundReason',
  }[target];
  const set = { status: target, [timestampField]: now };
  if (reasonField) set[reasonField] = safeReason;
  const lifecycleFrom = target === 'refunded' ? 'applied' : 'reserved';

  const session = options.session || null;
  const update = await CouponRedemption.findOneAndUpdate(
    { ...lookup, status: { $in: fromStatuses } },
    {
      $set: set,
      $push: {
        lifecycle: {
          from: lifecycleFrom,
          to: target,
          reason: safeReason,
          source: safeSource,
          at: now,
        },
      },
    },
    { new: true, session }
  );
  if (!update) {
    let currentQuery = CouponRedemption.findOne(lookup);
    if (session && typeof currentQuery.session === 'function') currentQuery = currentQuery.session(session);
    const current = await currentQuery;
    return {
      changed: false,
      duplicate: current?.status === target,
      status: current?.status || '',
      redemption: current || null,
    };
  }

  if (['released', 'cancelled', 'refunded'].includes(target)) {
    await Coupon.updateOne(
      { _id: update.coupon, usageCount: { $gt: 0 } },
      { $inc: { usageCount: -1 } },
      { session }
    );
  }
  return { changed: true, status: target, redemption: update };
}

async function reconcileOrderCouponForStatus(order, status, options = {}) {
  const normalized = trimSafe(status, 30).toLowerCase();
  if (normalized === 'paid') {
    return transitionOrderCouponRedemption(order, {
      to: 'applied',
      reason: options.reason || 'Pago confirmado.',
      source: options.source || 'payment',
    }, options);
  }
  if (normalized === 'failed') {
    return transitionOrderCouponRedemption(order, {
      to: 'released',
      reason: options.reason || 'Pago fallido; uso liberado.',
      source: options.source || 'payment',
    }, options);
  }
  if (['cancelled', 'canceled'].includes(normalized)) {
    return transitionOrderCouponRedemption(order, {
      to: 'cancelled',
      reason: options.reason || 'Orden cancelada; uso liberado.',
      source: options.source || 'order',
    }, options);
  }
  return { changed: false, skipped: true, reason: 'status_without_coupon_effect' };
}

module.exports = {
  normalizeCode,
  serializeCoupon,
  serializePublicCoupon,
  serializePublicValidation,
  buildEffectiveStatusFilter,
  isItemEligibleForCoupon,
  calculateEligibleSubtotal,
  calculateDiscount,
  validateCoupon,
  listCoupons,
  getCouponById,
  createCoupon,
  updateCoupon,
  setCouponStatus,
  deleteCoupon,
  recordCouponRedemption,
  transitionOrderCouponRedemption,
  reconcileOrderCouponForStatus,
  __test: {
    cleanCouponPayload,
  },
};
