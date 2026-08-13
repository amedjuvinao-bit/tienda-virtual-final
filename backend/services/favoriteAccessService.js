'use strict';

const crypto = require('crypto');

const FAVORITE_ACCESS_VERSION = 1;
const SAFE_FAVORITE_ACCESS_ERROR = Object.freeze({
  ok: false,
  error: 'FAVORITE_ACCESS_NOT_FOUND',
  message: 'No fue posible acceder a los favoritos solicitados.',
});

function clean(value, max = 1000) {
  return String(value || '').trim().slice(0, max);
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ''));
  const rightBuffer = Buffer.from(String(right || ''));
  return Boolean(
    leftBuffer.length &&
      leftBuffer.length === rightBuffer.length &&
      crypto.timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function getFavoriteAccessSecret(env = process.env) {
  const secret =
    clean(env.FAVORITE_ACCESS_SECRET) ||
    clean(env.CART_ACCESS_SECRET) ||
    clean(env.JWT_SECRET);
  if (secret.length < 32) {
    const error = new Error(
      'FAVORITE_ACCESS_SECRET, CART_ACCESS_SECRET o JWT_SECRET debe tener al menos 32 caracteres.'
    );
    error.code = 'FAVORITE_ACCESS_SECRET_MISCONFIGURED';
    throw error;
  }
  return secret;
}

function isValidFavoriteSessionId(value) {
  return /^fav_[A-Za-z0-9_-]{32,100}$/.test(clean(value, 120));
}

function isValidFavoriteAccessToken(value) {
  return /^ft1_[A-Za-z0-9_-]{40,100}\.[A-Za-z0-9_-]{40,100}$/.test(
    clean(value, 240)
  );
}

function signature({ sessionId, nonce, secret }) {
  return crypto
    .createHmac('sha256', secret)
    .update(`favorite-access:v${FAVORITE_ACCESS_VERSION}|${sessionId}|${nonce}`)
    .digest('base64url');
}

function issueFavoriteAccess({ secret, randomBytes = crypto.randomBytes } = {}) {
  const sessionId = `fav_${randomBytes(24).toString('base64url')}`;
  const nonce = randomBytes(32).toString('base64url');
  const token = `ft1_${nonce}.${signature({ sessionId, nonce, secret })}`;
  return { sessionId, token, version: FAVORITE_ACCESS_VERSION };
}

function verifyFavoriteAccess({ sessionId, token, secret } = {}) {
  const safeSessionId = clean(sessionId, 120);
  const safeToken = clean(token, 240);
  if (
    !isValidFavoriteSessionId(safeSessionId) ||
    !isValidFavoriteAccessToken(safeToken) ||
    clean(secret).length < 32
  ) {
    return false;
  }
  const [prefixedNonce, receivedSignature, extra] = safeToken.split('.');
  if (extra || !receivedSignature) return false;
  const nonce = prefixedNonce.replace(/^ft1_/, '');
  const expected = signature({ sessionId: safeSessionId, nonce, secret });
  return safeEqual(receivedSignature, expected);
}

function getFavoriteAccessFromRequest(req = {}) {
  return {
    sessionId: clean(req?.headers?.['x-favorite-session-id'], 120),
    token: clean(req?.headers?.['x-favorite-access-token'], 240),
  };
}

module.exports = {
  FAVORITE_ACCESS_VERSION,
  SAFE_FAVORITE_ACCESS_ERROR,
  getFavoriteAccessFromRequest,
  getFavoriteAccessSecret,
  isValidFavoriteAccessToken,
  isValidFavoriteSessionId,
  issueFavoriteAccess,
  verifyFavoriteAccess,
};
