'use strict';

// backend/services/couponService.js
const mongoose = require('mongoose');
const Coupon = require('../models/Coupon');
const CouponRedemption = require('../models/CouponRedemption');

const COUPON_TYPES = Coupon.COUPON_TYPES || ['percentage', 'fixed', 'free_shipping'];
const COUPON_STATUS = Coupon.COUPON_STATUS || ['draft', 'active', 'inactive', 'expired'];
const COUPON_APPLIES_TO = Coupon.COUPON_APPLIES_TO || ['all', 'products', 'categories'];

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

function optionalMoney(value) {
  if (value === '' || value === null || value === undefined) return null;
  return moneySafe(value, 0);
}

function optionalDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
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

function normalizeObjectIdArray(values = []) {
  if (!Array.isArray(values)) return [];
  const seen = new Set();
  const result = [];

  values.forEach((value) => {
    const raw = typeof value === 'object' ? value?._id || value?.id : value;
    const text = trimSafe(raw, 80);
    if (!mongoose.Types.ObjectId.isValid(text)) return;
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

function cleanCouponPayload(body = {}, { partial = false } = {}) {
  const source = body && typeof body === 'object' ? body : {};
  const payload = {};

  if (!partial || source.code !== undefined) {
    const code = normalizeCode(source.code);
    if (!code) throw createServiceError('El código del cupón es obligatorio.', 400, 'COUPON_CODE_REQUIRED');
    if (code.length < 3) throw createServiceError('El código del cupón debe tener mínimo 3 caracteres.', 400, 'COUPON_CODE_TOO_SHORT');
    payload.code = code;
  }

  if (!partial || source.name !== undefined) payload.name = trimSafe(source.name, 120);
  if (!partial || source.description !== undefined) payload.description = trimSafe(source.description, 500);

  if (!partial || source.type !== undefined) {
    const type = trimSafe(source.type || 'percentage', 40).toLowerCase();
    if (!COUPON_TYPES.includes(type)) {
      throw createServiceError('Tipo de cupón inválido.', 400, 'COUPON_TYPE_INVALID');
    }
    payload.type = type;
  }

  if (!partial || source.value !== undefined) {
    const typeForValue = payload.type || trimSafe(source.type || 'percentage', 40).toLowerCase();
    const value = moneySafe(source.value, 0);
    if (typeForValue === 'percentage' && value > 100) {
      throw createServiceError('El porcentaje del cupón no puede superar 100%.', 400, 'COUPON_PERCENTAGE_TOO_HIGH');
    }
    if (typeForValue !== 'free_shipping' && value <= 0) {
      throw createServiceError('El valor del cupón debe ser mayor que cero.', 400, 'COUPON_VALUE_REQUIRED');
    }
    payload.value = typeForValue === 'free_shipping' ? 0 : value;
  }

  if (!partial || source.maxDiscountAmount !== undefined) payload.maxDiscountAmount = optionalMoney(source.maxDiscountAmount);
  if (!partial || source.minSubtotal !== undefined) payload.minSubtotal = moneySafe(source.minSubtotal, 0);

  if (!partial || source.status !== undefined) {
    const status = trimSafe(source.status || 'active', 40).toLowerCase();
    if (!COUPON_STATUS.includes(status)) {
      throw createServiceError('Estado de cupón inválido.', 400, 'COUPON_STATUS_INVALID');
    }
    payload.status = status;
  }

  if (!partial || source.active !== undefined) payload.active = source.active !== false;
  if (!partial || source.startsAt !== undefined) payload.startsAt = optionalDate(source.startsAt);
  if (!partial || source.endsAt !== undefined) payload.endsAt = optionalDate(source.endsAt);

  if (payload.startsAt && payload.endsAt && payload.endsAt < payload.startsAt) {
    throw createServiceError('La fecha final no puede ser anterior a la fecha inicial.', 400, 'COUPON_DATE_RANGE_INVALID');
  }

  if (!partial || source.usageLimit !== undefined) payload.usageLimit = optionalMoney(source.usageLimit);
  if (!partial || source.perCustomerLimit !== undefined) payload.perCustomerLimit = optionalMoney(source.perCustomerLimit);

  if (!partial || source.appliesTo !== undefined) {
    const appliesTo = trimSafe(source.appliesTo || 'all', 40).toLowerCase();
    if (!COUPON_APPLIES_TO.includes(appliesTo)) {
      throw createServiceError('Regla de aplicación inválida.', 400, 'COUPON_APPLIES_TO_INVALID');
    }
    payload.appliesTo = appliesTo;
  }

  if (!partial || source.productIds !== undefined) payload.productIds = normalizeObjectIdArray(source.productIds);
  if (!partial || source.excludedProductIds !== undefined) payload.excludedProductIds = normalizeObjectIdArray(source.excludedProductIds);
  if (!partial || source.categories !== undefined) payload.categories = normalizeStringArray(source.categories);
  if (!partial || source.excludedCategories !== undefined) payload.excludedCategories = normalizeStringArray(source.excludedCategories);
  if (!partial || source.customerIds !== undefined) payload.customerIds = normalizeObjectIdArray(source.customerIds);

  if (!partial || source.newCustomersOnly !== undefined) payload.newCustomersOnly = source.newCustomersOnly === true;
  if (!partial || source.tags !== undefined) payload.tags = normalizeStringArray(source.tags);
  if (!partial || source.internalNotes !== undefined) payload.internalNotes = trimSafe(source.internalNotes, 1000);

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
    if (plain.active === false || plain.status === 'inactive') return 'inactive';
    if (plain.status === 'draft') return 'draft';
    if (startsAt && startsAt > now) return 'scheduled';
    if (endsAt && endsAt < now) return 'expired';
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

  if (coupon.endsAt && new Date(coupon.endsAt) < now) {
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
    return allowedProductIds.size === 0 || Boolean(productId && allowedProductIds.has(productId));
  }

  if (appliesTo === 'categories') {
    return allowedCategories.size === 0 || categories.some((category) => allowedCategories.has(category));
  }

  return true;
}

function calculateEligibleSubtotal(coupon, items = [], fallbackSubtotal = 0) {
  const appliesTo = coupon.appliesTo || 'all';
  const subtotal = moneySafe(fallbackSubtotal, 0);

  if (!Array.isArray(items) || items.length === 0 || appliesTo === 'all') {
    return subtotal;
  }

  return items.reduce((sum, item) => {
    return isItemEligibleForCoupon(coupon, item) ? sum + getItemLineTotal(item) : sum;
  }, 0);
}

function calculateDiscount(coupon, { subtotal = 0, shippingAmount = 0, items = [] } = {}) {
  const eligibleSubtotal = calculateEligibleSubtotal(coupon, items, subtotal);
  const safeSubtotal = moneySafe(subtotal, 0);
  const safeShipping = moneySafe(shippingAmount, 0);

  if (coupon.type !== 'free_shipping' && eligibleSubtotal <= 0) {
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

  const filters = [{ coupon: coupon._id, status: 'applied' }];
  const customerObjectId = mongoose.Types.ObjectId.isValid(String(customerId || ''))
    ? new mongoose.Types.ObjectId(String(customerId))
    : null;
  const email = normalizeLower(customerEmail);

  if (customerObjectId) filters.push({ customer: customerObjectId });
  if (email) filters.push({ customerEmail: email });

  if (filters.length === 1) return { ok: true };

  const query = {
    $and: [
      { coupon: coupon._id, status: 'applied' },
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

  const status = trimSafe(params.status, 40).toLowerCase();
  if (COUPON_STATUS.includes(status)) filter.status = status;

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
  const payload = cleanCouponPayload(body, { partial: false });
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

  const payload = cleanCouponPayload(body, { partial: true });
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
  if (coupon.type !== 'free_shipping' && discount.discountAmount <= 0) {
    return {
      valid: false,
      code: 'COUPON_NOT_APPLICABLE_TO_CART',
      message: discount.message || 'El cupón no aplica para este carrito.',
      coupon: serializeCoupon(coupon),
      discount,
    };
  }

  if (coupon.type === 'free_shipping' && shippingAmount <= 0) {
    return {
      valid: false,
      code: 'COUPON_FREE_SHIPPING_WITHOUT_SHIPPING',
      message: 'El cupón es de envío gratis, pero el pedido no tiene valor de envío para descontar.',
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
    status: 'applied',
    meta: discountData,
  };

  const session = options.session || null;
  const redemption = await CouponRedemption.create([redemptionPayload], { session }).then((rows) => rows[0]);

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
    throw createServiceError(
      'El cupón dejó de estar disponible antes de finalizar la orden.',
      409,
      'COUPON_USAGE_LIMIT_REACHED'
    );
  }

  return redemption?.toObject ? redemption.toObject() : redemption;
}

module.exports = {
  normalizeCode,
  serializeCoupon,
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
};
