'use strict';

const crypto = require('crypto');

const ACCESS_TOKEN_VERSION = 1;
const DEFAULT_ACCESS_TTL_MS = 24 * 60 * 60 * 1000;
const SAFE_PAYMENT_ACCESS_ERROR = Object.freeze({
  ok: false,
  error: 'PAYMENT_ACCESS_NOT_FOUND',
  message: 'No fue posible acceder al pago solicitado.',
});

function cleanText(value, max = 300) {
  return String(value || '').trim().slice(0, max);
}

function idValue(value) {
  if (!value) return '';
  if (typeof value === 'object') return String(value._id || value.id || value);
  return String(value);
}

function isValidObjectIdText(value) {
  return /^[a-f\d]{24}$/i.test(cleanText(value, 40));
}

function isValidSessionId(value) {
  const sessionId = cleanText(value, 180);
  return /^[A-Za-z0-9._:-]{8,160}$/.test(sessionId);
}

function isValidTransactionId(value) {
  const transactionId = cleanText(value, 140);
  return /^[A-Za-z0-9_-]{8,120}$/.test(transactionId);
}

function toBase64Url(value) {
  return Buffer.from(value).toString('base64url');
}

function fromBase64Url(value) {
  return Buffer.from(String(value || ''), 'base64url').toString('utf8');
}

function hashSessionId(sessionId) {
  return crypto.createHash('sha256').update(String(sessionId)).digest('hex');
}

function signPayload(payloadPart, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(payloadPart)
    .digest('base64url');
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ''));
  const rightBuffer = Buffer.from(String(right || ''));
  if (!leftBuffer.length || leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function getPaymentAccessSecret(env = process.env) {
  const secret = cleanText(
    env.ORDER_PAYMENT_ACCESS_SECRET || env.JWT_SECRET,
    1000
  );
  if (secret.length < 32) {
    const error = new Error(
      'ORDER_PAYMENT_ACCESS_SECRET o JWT_SECRET debe tener al menos 32 caracteres.'
    );
    error.code = 'PAYMENT_ACCESS_SECRET_MISCONFIGURED';
    throw error;
  }
  return secret;
}

function createGuestOrderAccessToken({
  orderId,
  sessionId,
  secret,
  now = Date.now(),
  ttlMs = DEFAULT_ACCESS_TTL_MS,
} = {}) {
  const safeOrderId = cleanText(orderId, 40).toLowerCase();
  const safeSessionId = cleanText(sessionId, 180);
  if (!isValidObjectIdText(safeOrderId) || !isValidSessionId(safeSessionId)) {
    throw new TypeError('Orden o sesion invalidas para emitir acceso de pago.');
  }
  if (cleanText(secret, 1000).length < 32) {
    throw new TypeError('El secreto de acceso de pago no es valido.');
  }

  const issuedAt = Math.floor(Number(now));
  const expiresAt = issuedAt + Math.max(60_000, Number(ttlMs || 0));
  const payload = {
    v: ACCESS_TOKEN_VERSION,
    oid: safeOrderId,
    sid: hashSessionId(safeSessionId),
    iat: issuedAt,
    exp: expiresAt,
  };
  const payloadPart = toBase64Url(JSON.stringify(payload));
  return `${payloadPart}.${signPayload(payloadPart, secret)}`;
}

function verifyGuestOrderAccessToken({
  token,
  sessionId,
  secret,
  now = Date.now(),
} = {}) {
  const safeToken = cleanText(token, 1200);
  const safeSessionId = cleanText(sessionId, 180);
  if (!safeToken || !isValidSessionId(safeSessionId)) {
    return { valid: false, reason: 'INVALID_CREDENTIALS' };
  }

  const parts = safeToken.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { valid: false, reason: 'INVALID_CREDENTIALS' };
  }

  const expectedSignature = signPayload(parts[0], secret);
  if (!safeEqual(expectedSignature, parts[1])) {
    return { valid: false, reason: 'INVALID_CREDENTIALS' };
  }

  let payload;
  try {
    payload = JSON.parse(fromBase64Url(parts[0]));
  } catch {
    return { valid: false, reason: 'INVALID_CREDENTIALS' };
  }

  if (
    Number(payload?.v) !== ACCESS_TOKEN_VERSION ||
    !isValidObjectIdText(payload?.oid) ||
    !Number.isFinite(Number(payload?.iat)) ||
    !Number.isFinite(Number(payload?.exp)) ||
    Number(payload.iat) > Number(now) + 60_000 ||
    Number(payload.exp) <= Number(now) ||
    !safeEqual(payload.sid, hashSessionId(safeSessionId))
  ) {
    return { valid: false, reason: 'INVALID_CREDENTIALS' };
  }

  return {
    valid: true,
    orderId: String(payload.oid).toLowerCase(),
    issuedAt: new Date(Number(payload.iat)),
    expiresAt: new Date(Number(payload.exp)),
  };
}

function issueGuestOrderAccess({
  orderId,
  sessionId,
  secret,
  now = Date.now(),
  ttlMs = DEFAULT_ACCESS_TTL_MS,
} = {}) {
  const token = createGuestOrderAccessToken({
    orderId,
    sessionId,
    secret,
    now,
    ttlMs,
  });
  const verification = verifyGuestOrderAccessToken({
    token,
    sessionId,
    secret,
    now,
  });
  if (!verification.valid) {
    throw new Error('No fue posible emitir el acceso publico de la orden.');
  }
  return {
    orderId: cleanText(orderId, 40).toLowerCase(),
    sessionId: cleanText(sessionId, 180),
    token,
    expiresAt: verification.expiresAt.toISOString(),
  };
}

function resolveAuthenticatedPaymentPrincipal(req = {}) {
  const adminId = idValue(req.adminUserId || req.adminUserDoc?._id);
  if (isValidObjectIdText(adminId)) {
    return { authenticated: true, type: 'admin', id: adminId.toLowerCase() };
  }

  return { authenticated: false, type: 'guest', id: '' };
}

function authorizeOrderPaymentAccess({
  order,
  principal,
  guestVerification,
  sessionId,
} = {}) {
  if (!order) return { allowed: false };

  if (principal?.authenticated === true && principal.type === 'admin') {
    const ownerId = idValue(order.createdByAdmin).toLowerCase();
    return {
      allowed: Boolean(ownerId && safeEqual(ownerId, principal.id)),
      mode: 'authenticated',
    };
  }

  const orderId = idValue(order._id).toLowerCase();
  const orderSessionId = cleanText(order.sessionId, 180);
  const safeSessionId = cleanText(sessionId, 180);
  const allowed = Boolean(
    guestVerification?.valid === true &&
      safeEqual(guestVerification.orderId, orderId) &&
      safeEqual(orderSessionId, safeSessionId)
  );

  return { allowed, mode: 'guest' };
}

function getGuestAccessFromRequest(req, secret) {
  const token = cleanText(req?.headers?.['x-order-access-token'], 1200);
  const sessionId = cleanText(
    req?.headers?.['x-session-id'] || req?.headers?.['X-Session-Id'],
    180
  );
  return {
    token,
    sessionId,
    verification: verifyGuestOrderAccessToken({ token, sessionId, secret }),
  };
}

async function resolveAuthorizedPublicPaymentOrder({
  req,
  OrderModel,
  orderId = '',
  getSecret = getPaymentAccessSecret,
} = {}) {
  const secret = getSecret();
  const guest = getGuestAccessFromRequest(req, secret);
  const tokenOrderId = cleanText(guest.verification?.orderId, 40).toLowerCase();
  const requestedOrderId = cleanText(orderId || tokenOrderId, 40).toLowerCase();

  if (
    guest.verification?.valid !== true ||
    !isValidObjectIdText(requestedOrderId) ||
    (orderId && !safeEqual(requestedOrderId, tokenOrderId)) ||
    !OrderModel ||
    typeof OrderModel.findById !== 'function'
  ) {
    return { allowed: false };
  }

  let query = OrderModel.findById(requestedOrderId);
  if (typeof query?.lean === 'function') query = query.lean();
  const order = typeof query?.exec === 'function' ? await query.exec() : await query;
  const authorization = authorizeOrderPaymentAccess({
    order,
    principal: resolveAuthenticatedPaymentPrincipal(req),
    guestVerification: guest.verification,
    sessionId: guest.sessionId,
  });

  if (!authorization.allowed) return { allowed: false };
  return {
    allowed: true,
    order,
    sessionId: guest.sessionId,
    verification: guest.verification,
  };
}

function extractWompiOrderNumber(reference) {
  const safeReference = cleanText(reference, 200);
  if (!safeReference) return '';
  const baseReference = safeReference.split('__TRY__')[0];
  const match = baseReference.match(/^ORDER-(.+)$/i);
  return cleanText(match?.[1], 80);
}

function isWompiTransactionOwnedByOrder({
  order,
  transaction,
  requestedTransactionId,
} = {}) {
  const requestedId = cleanText(requestedTransactionId, 120);
  const transactionId = cleanText(transaction?.id, 120);
  const storedTransactionId = cleanText(order?.payment?.transactionId, 120);
  const orderNumber = cleanText(order?.orderNumber, 80);
  const referenceOrderNumber = extractWompiOrderNumber(transaction?.reference);
  const expectedAmountInCents = Math.round(Number(order?.total || 0) * 100);
  const transactionAmountInCents = Number(transaction?.amount_in_cents || 0);
  const expectedCurrency = cleanText(order?.payment?.currency || 'COP', 12).toUpperCase();
  const transactionCurrency = cleanText(transaction?.currency, 12).toUpperCase();

  if (
    !order ||
    !isValidTransactionId(requestedId) ||
    !safeEqual(requestedId, transactionId) ||
    (storedTransactionId && !safeEqual(storedTransactionId, transactionId)) ||
    expectedAmountInCents <= 0 ||
    transactionAmountInCents !== expectedAmountInCents ||
    !safeEqual(expectedCurrency, transactionCurrency)
  ) {
    return false;
  }

  return Boolean(
    (storedTransactionId && safeEqual(storedTransactionId, transactionId)) ||
      (orderNumber && safeEqual(orderNumber, referenceOrderNumber))
  );
}

function buildPublicCheckoutResponse({
  payments,
  wompi,
  order,
  amountInCents,
  currency,
  reference,
  redirectUrl,
  signature,
  acceptance,
} = {}) {
  return {
    ok: true,
    provider: 'wompi',
    mode: cleanText(payments?.mode, 20),
    publicKey: cleanText(wompi?.publicKey, 300),
    currency: cleanText(currency, 12).toUpperCase(),
    amountInCents: Number(amountInCents || 0),
    reference: cleanText(reference, 200),
    redirectUrl: cleanText(redirectUrl, 1000),
    signature: cleanText(signature, 200),
    acceptanceToken: cleanText(acceptance?.acceptanceToken, 1000),
    personalDataAcceptanceToken: cleanText(
      acceptance?.personalDataAcceptanceToken,
      1000
    ),
    orderId: idValue(order?._id),
    orderNumber: cleanText(order?.orderNumber, 60),
  };
}

function buildPublicTransactionResponse({ order, transaction, mapped, payments } = {}) {
  return {
    ok: true,
    transactionId: cleanText(transaction?.id, 120),
    orderId: idValue(order?._id),
    orderNumber: cleanText(order?.orderNumber, 60),
    orderStatus: cleanText(order?.status, 40).toLowerCase(),
    paymentStatus: cleanText(
      order?.payment?.status || mapped?.paymentStatus,
      40
    ).toLowerCase(),
    wompiStatus: cleanText(transaction?.status, 40).toUpperCase(),
    amountInCents: Number(transaction?.amount_in_cents || 0),
    currency:
      cleanText(transaction?.currency, 12).toUpperCase() ||
      cleanText(payments?.currency, 12).toUpperCase() ||
      'COP',
  };
}

function buildPublicThanksResponse({ order } = {}) {
  const items = Array.isArray(order?.items)
    ? order.items
    : Array.isArray(order?.cart)
      ? order.cart
      : [];
  const totalItems = items.reduce(
    (sum, item) => sum + Math.max(0, Number(item?.quantity ?? item?.qty ?? 0)),
    0
  );
  const customer = order?.customer || {};

  return {
    ok: true,
    orderId: idValue(order?._id),
    orderNumber: cleanText(order?.orderNumber, 60),
    status: cleanText(order?.status, 40).toLowerCase(),
    subtotal: Number(order?.subtotal || 0),
    shipping: Number(order?.shipping || 0),
    total: Number(order?.total || 0),
    itemCount: Number(order?.summary?.totalItems || totalItems || 0),
    customerName: cleanText(
      [customer.name, customer.lastname].filter(Boolean).join(' '),
      160
    ),
    paymentProvider: cleanText(order?.payment?.provider, 40).toLowerCase(),
    paymentProviderLabel: cleanText(order?.payment?.providerLabel, 80),
    paymentStatus: cleanText(order?.payment?.status, 40).toLowerCase(),
    currency: cleanText(order?.payment?.currency || 'COP', 12).toUpperCase(),
    createdAt: order?.createdAt || null,
    updatedAt: order?.updatedAt || null,
  };
}

module.exports = {
  DEFAULT_ACCESS_TTL_MS,
  SAFE_PAYMENT_ACCESS_ERROR,
  authorizeOrderPaymentAccess,
  buildPublicCheckoutResponse,
  buildPublicThanksResponse,
  buildPublicTransactionResponse,
  createGuestOrderAccessToken,
  extractWompiOrderNumber,
  getGuestAccessFromRequest,
  getPaymentAccessSecret,
  isWompiTransactionOwnedByOrder,
  isValidObjectIdText,
  isValidSessionId,
  isValidTransactionId,
  issueGuestOrderAccess,
  resolveAuthenticatedPaymentPrincipal,
  resolveAuthorizedPublicPaymentOrder,
  verifyGuestOrderAccessToken,
};
