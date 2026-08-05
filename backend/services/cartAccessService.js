'use strict';

const crypto = require('crypto');

const CART_ACCESS_VERSION = 1;
const CART_RECOVERY_VERSION = 1;
const SAFE_CART_ACCESS_ERROR = Object.freeze({
  ok: false,
  error: 'CART_ACCESS_NOT_FOUND',
  message: 'No fue posible acceder al carrito solicitado.',
});

function cleanText(value, max = 1000) {
  return String(value || '').trim().slice(0, max);
}

function idValue(value) {
  if (!value) return '';
  if (typeof value === 'object') return String(value._id || value.id || value);
  return String(value);
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ''));
  const rightBuffer = Buffer.from(String(right || ''));
  if (!leftBuffer.length || leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function isValidCartSessionId(value) {
  return /^cart_[A-Za-z0-9_-]{32,100}$/.test(cleanText(value, 120));
}

function isValidCartAccessToken(value) {
  return /^ct1_[A-Za-z0-9_-]{40,100}$/.test(cleanText(value, 140));
}

function getCartAccessSecret(env = process.env) {
  const dedicatedSecret = cleanText(env.CART_ACCESS_SECRET, 1000);
  if (cleanText(env.NODE_ENV, 40).toLowerCase() === 'production' && !dedicatedSecret) {
    const error = new Error('CART_ACCESS_SECRET es obligatorio en producción.');
    error.code = 'CART_ACCESS_SECRET_MISCONFIGURED';
    throw error;
  }
  const secret = dedicatedSecret || cleanText(env.JWT_SECRET, 1000);
  if (secret.length < 32) {
    const error = new Error(
      'CART_ACCESS_SECRET o JWT_SECRET debe tener al menos 32 caracteres.'
    );
    error.code = 'CART_ACCESS_SECRET_MISCONFIGURED';
    throw error;
  }
  return secret;
}

function generateCartSessionId(randomBytes = crypto.randomBytes) {
  return `cart_${randomBytes(24).toString('base64url')}`;
}

function generateCartAccessToken(randomBytes = crypto.randomBytes) {
  return `ct1_${randomBytes(32).toString('base64url')}`;
}

function generateCartRecoveryToken(randomBytes = crypto.randomBytes) {
  return `cr1_${randomBytes(32).toString('base64url')}`;
}

function hashCartAccessToken({ cartId, sessionId, token, secret } = {}) {
  const safeCartId = idValue(cartId).toLowerCase();
  const safeSessionId = cleanText(sessionId, 120);
  const safeToken = cleanText(token, 140);
  const safeSecret = cleanText(secret, 1000);
  if (
    !/^[a-f\d]{24}$/i.test(safeCartId) ||
    !isValidCartSessionId(safeSessionId) ||
    !isValidCartAccessToken(safeToken) ||
    safeSecret.length < 32
  ) {
    throw new TypeError('No fue posible crear la prueba de acceso del carrito.');
  }

  return crypto
    .createHmac('sha256', safeSecret)
    .update(
      `cart-access:v${CART_ACCESS_VERSION}|${safeCartId}|${safeSessionId}|${safeToken}`
    )
    .digest('hex');
}

function issueCartAccess({ cartId, secret, randomBytes = crypto.randomBytes } = {}) {
  const sessionId = generateCartSessionId(randomBytes);
  const token = generateCartAccessToken(randomBytes);
  const tokenHash = hashCartAccessToken({ cartId, sessionId, token, secret });
  return { sessionId, token, tokenHash, version: CART_ACCESS_VERSION };
}

function rotateCartAccess({ cartId, sessionId, secret, randomBytes = crypto.randomBytes } = {}) {
  const token = generateCartAccessToken(randomBytes);
  const tokenHash = hashCartAccessToken({ cartId, sessionId, token, secret });
  return { sessionId, token, tokenHash, version: CART_ACCESS_VERSION };
}

function recoverySignature({ cartId, sessionId, token, expiresAt, secret } = {}) {
  const safeCartId = idValue(cartId).toLowerCase();
  const safeSessionId = cleanText(sessionId, 120);
  const safeToken = cleanText(token, 140);
  const expiry = new Date(expiresAt);
  const safeSecret = cleanText(secret, 1000);
  if (
    !/^[a-f\d]{24}$/i.test(safeCartId) ||
    !isValidCartSessionId(safeSessionId) ||
    !/^cr1_[A-Za-z0-9_-]{40,100}$/.test(safeToken) ||
    Number.isNaN(expiry.getTime()) ||
    safeSecret.length < 32
  ) {
    throw new TypeError('No fue posible firmar la recuperacion del carrito.');
  }
  return crypto
    .createHmac('sha256', safeSecret)
    .update(
      `cart-recovery:v${CART_RECOVERY_VERSION}|${safeCartId}|${safeSessionId}|${safeToken}|${expiry.toISOString()}`
    )
    .digest('base64url');
}

function issueCartRecoveryAccess({
  cartId,
  sessionId,
  expiresAt,
  secret,
  randomBytes = crypto.randomBytes,
} = {}) {
  const token = generateCartRecoveryToken(randomBytes);
  const signature = recoverySignature({ cartId, sessionId, token, expiresAt, secret });
  const credential = `${token}.${signature}`;
  return {
    credential,
    tokenHash: crypto.createHash('sha256').update(credential).digest('hex'),
    expiresAt: new Date(expiresAt),
  };
}

function verifyCartRecoveryAccess({
  cart,
  sessionId,
  credential,
  secret,
  now = new Date(),
} = {}) {
  const [token, signature, extra] = cleanText(credential, 300).split('.');
  const expiresAt = new Date(cart?.recoveryAccess?.expiresAt || 0);
  if (
    extra ||
    !token ||
    !signature ||
    !cart ||
    cleanText(cart.sessionId, 120) !== cleanText(sessionId, 120) ||
    cart.recoveryAccess?.usedAt ||
    Number.isNaN(expiresAt.getTime()) ||
    expiresAt <= now
  ) {
    return false;
  }
  let expected;
  try {
    expected = recoverySignature({
      cartId: cart._id,
      sessionId,
      token,
      expiresAt,
      secret,
    });
  } catch {
    return false;
  }
  const credentialHash = crypto
    .createHash('sha256')
    .update(cleanText(credential, 300))
    .digest('hex');
  return safeEqual(signature, expected) &&
    safeEqual(credentialHash, cart.recoveryAccess?.tokenHash);
}

function verifyCartAccess({ cart, sessionId, token, secret } = {}) {
  const storedSessionId = cleanText(cart?.sessionId, 120);
  const storedHash = cleanText(cart?.accessTokenHash, 128);
  const safeSessionId = cleanText(sessionId, 120);
  const safeToken = cleanText(token, 140);

  if (
    !cart ||
    Number(cart.accessVersion || 0) !== CART_ACCESS_VERSION ||
    !storedHash ||
    !isValidCartSessionId(safeSessionId) ||
    !isValidCartAccessToken(safeToken) ||
    !safeEqual(storedSessionId, safeSessionId)
  ) {
    return false;
  }

  let expected;
  try {
    expected = hashCartAccessToken({
      cartId: cart._id,
      sessionId: safeSessionId,
      token: safeToken,
      secret,
    });
  } catch {
    return false;
  }
  return safeEqual(storedHash, expected);
}

function getCartAccessFromRequest(req = {}) {
  return {
    sessionId: cleanText(req?.headers?.['x-session-id'], 120),
    token: cleanText(req?.headers?.['x-cart-access-token'], 140),
  };
}

function stripCartSecrets(value) {
  if (!value) return value;
  const plain = typeof value.toObject === 'function'
    ? value.toObject({ virtuals: true })
    : { ...value };
  delete plain.accessTokenHash;
  delete plain.accessToken;
  delete plain.cartAccessToken;
  delete plain.accessVersion;
  delete plain.accessIssuedAt;
  if (plain.recoveryAccess) {
    delete plain.recoveryAccess.tokenHash;
  }
  return plain;
}

module.exports = {
  CART_ACCESS_VERSION,
  CART_RECOVERY_VERSION,
  SAFE_CART_ACCESS_ERROR,
  generateCartAccessToken,
  generateCartSessionId,
  generateCartRecoveryToken,
  getCartAccessFromRequest,
  getCartAccessSecret,
  hashCartAccessToken,
  isValidCartAccessToken,
  isValidCartSessionId,
  issueCartAccess,
  issueCartRecoveryAccess,
  rotateCartAccess,
  stripCartSecrets,
  verifyCartAccess,
  verifyCartRecoveryAccess,
};
