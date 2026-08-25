'use strict';

const crypto = require('crypto');

const ACCESS_VERSION = 1;
const DEFAULT_TTL_MS = 400 * 24 * 60 * 60 * 1000;
const SAFE_RETURN_ACCESS_ERROR = Object.freeze({
  ok: false,
  error: 'RETURN_ACCESS_NOT_FOUND',
  message: 'No fue posible acceder a la devolución solicitada.',
});

function cleanText(value, maximum = 1400) {
  return String(value || '').trim().slice(0, maximum);
}

function idValue(value) {
  if (!value) return '';
  if (typeof value === 'object') return String(value._id || value.id || value);
  return String(value);
}

function isObjectId(value) {
  return /^[a-f\d]{24}$/i.test(cleanText(value, 40));
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return Boolean(a.length && a.length === b.length && crypto.timingSafeEqual(a, b));
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function customerAccessIdentity(order = {}) {
  const customer = order.customer || {};
  return [
    idValue(order._id).toLowerCase(),
    cleanText(order.sessionId, 180),
    cleanText(customer.email || customer.emailOrPhone, 220).toLowerCase(),
    cleanText(customer.phone, 80),
    cleanText(order.createdAt, 80),
  ].join('|');
}

function getOrderReturnAccessSecret(env = process.env) {
  const secret = cleanText(
    env.ORDER_RETURN_ACCESS_SECRET ||
      env.ORDER_PAYMENT_ACCESS_SECRET ||
      env.JWT_SECRET,
    1200
  );
  if (secret.length < 32) {
    const error = new Error(
      'ORDER_RETURN_ACCESS_SECRET, ORDER_PAYMENT_ACCESS_SECRET o JWT_SECRET debe tener al menos 32 caracteres.'
    );
    error.code = 'RETURN_ACCESS_SECRET_MISCONFIGURED';
    throw error;
  }
  return secret;
}

function sign(payloadPart, secret) {
  return crypto.createHmac('sha256', secret).update(payloadPart).digest('base64url');
}

function issueOrderReturnAccess({ order, secret, now = Date.now(), ttlMs = DEFAULT_TTL_MS } = {}) {
  const orderId = idValue(order?._id).toLowerCase();
  if (!isObjectId(orderId) || !customerAccessIdentity(order)) {
    throw new TypeError('La orden no permite emitir acceso de devoluciones.');
  }
  const issuedAt = Math.floor(Number(now));
  const expiresAt = issuedAt + Math.max(60_000, Number(ttlMs || DEFAULT_TTL_MS));
  const payload = {
    v: ACCESS_VERSION,
    oid: orderId,
    own: sha256(customerAccessIdentity(order)),
    iat: issuedAt,
    exp: expiresAt,
  };
  const payloadPart = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return {
    orderId,
    token: `${payloadPart}.${sign(payloadPart, secret)}`,
    expiresAt: new Date(expiresAt).toISOString(),
  };
}

function verifyOrderReturnAccess({ token, order, secret, now = Date.now() } = {}) {
  const safeToken = cleanText(token, 1400);
  const parts = safeToken.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { valid: false, reason: 'INVALID_CREDENTIALS' };
  }
  if (!safeEqual(sign(parts[0], secret), parts[1])) {
    return { valid: false, reason: 'INVALID_CREDENTIALS' };
  }
  let payload;
  try {
    payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
  } catch {
    return { valid: false, reason: 'INVALID_CREDENTIALS' };
  }
  if (
    Number(payload?.v) !== ACCESS_VERSION ||
    !isObjectId(payload?.oid) ||
    !Number.isFinite(Number(payload?.iat)) ||
    !Number.isFinite(Number(payload?.exp)) ||
    Number(payload.iat) > Number(now) + 60_000 ||
    Number(payload.exp) <= Number(now) ||
    !safeEqual(payload.oid, idValue(order?._id).toLowerCase()) ||
    !safeEqual(payload.own, sha256(customerAccessIdentity(order)))
  ) {
    return { valid: false, reason: 'INVALID_CREDENTIALS' };
  }
  return {
    valid: true,
    orderId: payload.oid,
    issuedAt: new Date(Number(payload.iat)),
    expiresAt: new Date(Number(payload.exp)),
  };
}

async function resolveAuthorizedPublicReturnOrder({ req, OrderModel, orderId = '' } = {}) {
  const requestedOrderId = cleanText(orderId, 40).toLowerCase();
  if (!isObjectId(requestedOrderId) || !OrderModel?.findById) return { allowed: false };
  let query = OrderModel.findById(requestedOrderId);
  if (typeof query?.lean === 'function') query = query.lean();
  const order = typeof query?.exec === 'function' ? await query.exec() : await query;
  if (!order) return { allowed: false };
  const token = cleanText(req?.headers?.['x-order-return-token'], 1400);
  const verification = verifyOrderReturnAccess({
    token,
    order,
    secret: getOrderReturnAccessSecret(),
  });
  return verification.valid ? { allowed: true, order, verification } : { allowed: false };
}

module.exports = {
  DEFAULT_TTL_MS,
  SAFE_RETURN_ACCESS_ERROR,
  customerAccessIdentity,
  getOrderReturnAccessSecret,
  issueOrderReturnAccess,
  resolveAuthorizedPublicReturnOrder,
  verifyOrderReturnAccess,
};
