'use strict';

const crypto = require('crypto');
const {
  canonicalizeVariantKey,
} = require('../products/productVariantConfig');
const { resolveProductId } = require('./orderRouteUtils');

function buildOrderCreationResult(order, extra = {}) {
  const storeCreditIsApplied =
    order?.storeCredit?.applied === true &&
    order?.storeCredit?.status !== 'released';
  const storeCredit = storeCreditIsApplied
    ? {
        applied: true,
        amount: Number(order.storeCredit.amount || 0),
        currency: order.storeCredit.currency || order?.payment?.currency || 'COP',
        status: order.storeCredit.status || 'reserved',
      }
    : {
        applied: false,
        amount: 0,
        status: order?.storeCredit?.status || 'none',
      };

  return {
    _id: order?._id,
    orderNumber: order?.orderNumber,
    subtotal: Number(order?.subtotal || 0),
    discount: order?.discount || null,
    coupon: order?.coupon || null,
    pricing: order?.pricing || null,
    taxes: order?.taxes || null,
    shipping: Number(order?.shipping || 0),
    total: Number(order?.total || 0),
    amountDue: Number(order?.payment?.amount ?? order?.total ?? 0),
    storeCredit,
    ...extra,
  };
}

function getOrderCustomerEmail(orderData = {}) {
  return String(
    orderData?.billing?.email ||
      orderData?.customer?.email ||
      orderData?.customer?.emailOrPhone ||
      ''
  )
    .trim()
    .toLowerCase();
}

function isValidDeliveryEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    String(value || '').trim().toLowerCase()
  );
}

function orderNeedsElectronicDelivery(items = []) {
  return (Array.isArray(items) ? items : []).some((item) => {
    const productType = String(item?.productType || '')
      .trim()
      .toLowerCase();

    if (['digital', 'service'].includes(productType)) return true;
    if (productType !== 'bundle') return false;

    return (item?.fulfillmentSnapshot?.bundle?.components || []).some(
      (component) =>
        ['digital', 'service'].includes(
          String(component?.productType || '')
            .trim()
            .toLowerCase()
        )
    );
  });
}

function buildOrderCouponSnapshot(quote = {}) {
  const validation = quote.couponValidation;
  if (!validation?.valid) return undefined;

  const coupon = validation.coupon || {};
  const pricing = quote.pricing || {};

  return {
    coupon: coupon._id || coupon.id || null,
    redemption: null,
    code: coupon.code || quote.couponCode || '',
    type: coupon.type || '',
    value: Number(coupon.value || 0),
    name: coupon.name || '',
    discountAmount: Number(pricing.productDiscount || 0),
    shippingDiscountAmount: Number(pricing.shippingDiscount || 0),
    totalDiscountAmount: Number(pricing.totalDiscount || 0),
    originalShippingAmount: Number(pricing.originalShipping || 0),
    finalShippingAmount: Number(pricing.shipping || 0),
    status: 'applied',
    message: validation.message || 'Cupón aplicado correctamente.',
    appliedAt: new Date(),
  };
}

function buildOrderDiscountSnapshot(quote = {}) {
  const validation = quote.couponValidation;
  const pricing = quote.pricing || {};
  const coupon = validation?.coupon || {};
  const amount = Number(pricing.productDiscount || 0);

  if (!validation?.valid || Number(pricing.totalDiscount || 0) <= 0) {
    return { type: 'none', value: 0, amount: 0, reason: '' };
  }

  return {
    type: coupon.type === 'percentage' ? 'percent' : 'amount',
    value: Number(coupon.value || 0),
    amount,
    reason:
      Number(pricing.shippingDiscount || 0) > 0 && amount <= 0
        ? `Cupón ${coupon.code || quote.couponCode || ''} - envío gratis`
        : `Cupón ${coupon.code || quote.couponCode || ''}`,
  };
}

function buildPricingSnapshot(pricing = {}) {
  return {
    version: Number(pricing.version || 2),
    currency: pricing.currency || 'COP',
    subtotal: Number(pricing.subtotal || 0),
    productDiscount: Number(pricing.productDiscount || 0),
    subtotalAfterDiscount: Number(pricing.subtotalAfterDiscount || 0),
    originalShipping: Number(pricing.originalShipping || 0),
    shippingDiscount: Number(pricing.shippingDiscount || 0),
    shipping: Number(pricing.shipping || 0),
    totalDiscount: Number(pricing.totalDiscount || 0),
    taxableBase: Number(
      pricing.tax?.taxableBase || pricing.subtotalAfterDiscount || 0
    ),
    taxAmount: Number(pricing.tax?.amount || 0),
    total: Number(pricing.total || 0),
  };
}

function getValidSource(value, hasAdminUser = false) {
  const source = String(value || '').trim().toLowerCase();

  if (
    hasAdminUser &&
    ['admin', 'pos', 'manual', 'import', 'system'].includes(source)
  ) {
    return source;
  }

  return 'online';
}

function buildAdminSnapshot(req) {
  return {
    username: String(req.adminUsername || req.user?.username || '')
      .trim()
      .toLowerCase(),
    displayName: String(
      req.adminDisplayName ||
        req.user?.displayName ||
        req.user?.fullName ||
        req.adminUsername ||
        ''
    ).trim(),
    role: String(req.adminRole || req.user?.role || '').trim().toLowerCase(),
    adminRole: String(req.adminRole || req.user?.adminRole || '')
      .trim()
      .toLowerCase(),
  };
}

function canonicalVariantKeyOrRaw(value) {
  const raw = String(value || '').trim().toLowerCase();
  return canonicalizeVariantKey(raw) || raw;
}

function canonicalText(value, { casing = 'preserve' } = {}) {
  const normalized = String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ');

  if (casing === 'lower') return normalized.toLowerCase();
  if (casing === 'upper') return normalized.toUpperCase();
  return normalized;
}

function canonicalBoolean(value) {
  return value === true;
}

function canonicalNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function canonicalAttributes(attributes = []) {
  return (Array.isArray(attributes) ? attributes : [])
    .map((attribute) => ({
      key: canonicalText(attribute?.key || attribute?.name, {
        casing: 'lower',
      }),
      value: canonicalText(attribute?.value, { casing: 'lower' }),
    }))
    .filter((attribute) => attribute.key && attribute.value)
    .sort((left, right) => {
      const leftKey = `${left.key}|${left.value}`;
      const rightKey = `${right.key}|${right.value}`;
      return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
    });
}

function canonicalizeCart(cart) {
  return (Array.isArray(cart) ? cart : [])
    .map((item) => ({
      productId: String(resolveProductId(item) || ''),
      title: String(item?.title || ''),
      color: String(item?.color || ''),
      size: String(item?.size || ''),
      variantKey: canonicalVariantKeyOrRaw(
        item?.variantKey ||
          item?.variantId ||
          item?.selectedVariantKey ||
          item?.selectedVariantId ||
          ''
      ),
      variantAttributes: canonicalAttributes(item?.variantAttributes),
      price:
        Number(item?.price ?? item?.unitPrice ?? item?.priceNumber ?? 0) || 0,
      quantity: Number(item?.quantity ?? item?.qty ?? 0) || 0,
    }))
    .filter((item) => item.productId && item.quantity > 0 && item.price >= 0)
    .sort((left, right) => {
      const leftKey = `${left.productId}|${left.variantKey}|${left.color.toLowerCase()}|${left.size.toLowerCase()}|${JSON.stringify(left.variantAttributes)}|${left.price}|${left.quantity}`;
      const rightKey = `${right.productId}|${right.variantKey}|${right.color.toLowerCase()}|${right.size.toLowerCase()}|${JSON.stringify(right.variantAttributes)}|${right.price}|${right.quantity}`;
      return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
    });
}

function canonicalCustomer(customer = {}) {
  return {
    name: canonicalText(customer.name),
    lastname: canonicalText(customer.lastname),
    id: canonicalText(customer.id, { casing: 'upper' }),
    documentType: canonicalText(customer.documentType, { casing: 'upper' }),
    emailOrPhone: canonicalText(customer.emailOrPhone, { casing: 'lower' }),
    email: canonicalText(customer.email, { casing: 'lower' }),
    phone: canonicalText(customer.phone),
    address: canonicalText(customer.address),
    city: canonicalText(customer.city),
    municipalityId: canonicalText(customer.municipalityId, {
      casing: 'upper',
    }),
    postalCode: canonicalText(customer.postalCode, { casing: 'upper' }),
    country: canonicalText(customer.country, { casing: 'upper' }),
    countryCode: canonicalText(customer.countryCode, { casing: 'upper' }),
    department: canonicalText(customer.department, { casing: 'upper' }),
    departmentCode: canonicalText(customer.departmentCode, {
      casing: 'upper',
    }),
    deliveryType: canonicalText(customer.deliveryType, { casing: 'lower' }),
    wantsNewsletter: canonicalBoolean(customer.wantsNewsletter),
  };
}

function canonicalBilling(billing = {}) {
  return {
    useSameAddress: billing.useSameAddress !== false,
    personType: canonicalText(billing.personType, { casing: 'lower' }),
    documentType: canonicalText(billing.documentType, { casing: 'upper' }),
    documentNumber: canonicalText(
      billing.documentNumber || billing.id,
      { casing: 'upper' }
    ),
    dv: canonicalText(billing.dv),
    firstName: canonicalText(billing.firstName || billing.name),
    lastName: canonicalText(billing.lastName || billing.lastname),
    businessName: canonicalText(billing.businessName),
    email: canonicalText(billing.email, { casing: 'lower' }),
    address: canonicalText(billing.address),
    extra: canonicalText(billing.extra),
    city: canonicalText(billing.city),
    municipalityCode: canonicalText(
      billing.municipalityCode || billing.cityCode,
      { casing: 'upper' }
    ),
    department: canonicalText(billing.department, { casing: 'upper' }),
    departmentCode: canonicalText(billing.departmentCode, {
      casing: 'upper',
    }),
    postalCode: canonicalText(billing.postalCode, { casing: 'upper' }),
    phone: canonicalText(billing.phone),
    country: canonicalText(billing.country, { casing: 'upper' }),
    countryCode: canonicalText(billing.countryCode, { casing: 'upper' }),
    tributeCode: canonicalText(billing.tributeCode, { casing: 'upper' }),
  };
}

function canonicalPayment(payment = {}) {
  return {
    active: payment.active !== false,
    provider: canonicalText(payment.provider, { casing: 'lower' }),
    providerLabel: canonicalText(payment.providerLabel),
    mode: canonicalText(payment.mode, { casing: 'lower' }),
    currency: canonicalText(payment.currency, { casing: 'upper' }),
    checkoutLabel: canonicalText(payment.checkoutLabel),
    enableWebhook: canonicalBoolean(payment.enableWebhook),
    status: canonicalText(payment.status, { casing: 'lower' }),
  };
}

function getRequestedBranch(rawBody = {}, cleaned = {}) {
  return canonicalText(
    rawBody.branch ||
      rawBody.branchId ||
      rawBody.defaultBranch ||
      cleaned.branch ||
      cleaned.branchId ||
      cleaned.defaultBranch,
    { casing: 'lower' }
  );
}

function getPaymentReference(rawBody = {}) {
  return canonicalText(
    rawBody.paymentReference ||
      rawBody.payment?.reference ||
      rawBody.payment?.transactionId
  );
}

function getPaymentTransactionId(rawBody = {}) {
  return canonicalText(
    rawBody.paymentTransactionId || rawBody.payment?.transactionId
  );
}

/**
 * Devuelve únicamente identidad contractual normalizada. Tokens de acceso,
 * credenciales y demás secretos deliberadamente no forman parte del objeto.
 */
function buildOrderCreationFingerprintPayload(cleaned = {}, rawBody = {}) {
  return {
    version: 2,
    sessionId: canonicalText(cleaned.sessionId),
    cart: canonicalizeCart(cleaned.cart),
    subtotal: canonicalNumber(cleaned.subtotal),
    shipping: canonicalNumber(cleaned.shipping),
    total: canonicalNumber(cleaned.total),
    couponCode: canonicalText(cleaned.couponCode, { casing: 'upper' }),
    customer: canonicalCustomer(cleaned.customer),
    billing: canonicalBilling(cleaned.billing),
    payment: canonicalPayment(cleaned.payment),
    storeCredit: {
      apply: cleaned.storeCredit?.apply === true,
      amount: canonicalNumber(cleaned.storeCredit?.amount),
    },
    tags: (Array.isArray(cleaned.tags) ? cleaned.tags : [])
      .map((tag) => canonicalText(tag, { casing: 'lower' }))
      .filter(Boolean)
      .sort(),
    branch: getRequestedBranch(rawBody, cleaned),
    source: canonicalText(rawBody.source || cleaned.source, {
      casing: 'lower',
    }),
    paymentReference: getPaymentReference(rawBody),
    paymentTransactionId: getPaymentTransactionId(rawBody),
  };
}

function deriveIdempotencyKey(cleaned, rawBody = {}) {
  const payload = buildOrderCreationFingerprintPayload(cleaned, rawBody);

  return crypto
    .createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex');
}

module.exports = {
  buildAdminSnapshot,
  buildOrderCouponSnapshot,
  buildOrderCreationResult,
  buildOrderCreationFingerprintPayload,
  buildOrderDiscountSnapshot,
  buildPricingSnapshot,
  canonicalizeCart,
  deriveIdempotencyKey,
  getOrderCustomerEmail,
  getValidSource,
  isValidDeliveryEmail,
  orderNeedsElectronicDelivery,
};
