'use strict';

const crypto = require('crypto');
const mongoose = require('mongoose');

const { getCartAccessSecret } = require('../cartAccessService');
const {
  STORE_CREDIT_ACCESS_TTL_MS,
  STORE_CREDIT_ACCESS_VERSION,
} = require('./constants');
const {
  cleanText,
  cleanUpper,
  idValue,
} = require('./normalization');

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ''));
  const rightBuffer = Buffer.from(String(right || ''));
  return Boolean(
    leftBuffer.length &&
      leftBuffer.length === rightBuffer.length &&
      crypto.timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function encodePayload(payload) {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

function decodePayload(value) {
  try {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

function signAccessPayload(encoded, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(`store-credit-access:v${STORE_CREDIT_ACCESS_VERSION}|${encoded}`)
    .digest('base64url');
}

function customerAccessFingerprint(customerId, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(`store-credit-customer|${idValue(customerId)}`)
    .digest('base64url');
}

function issueStoreCreditAccess(
  { customerId, sessionId, currency = 'COP', expiresAt } = {},
  { secret = getCartAccessSecret() } = {}
) {
  const customer = idValue(customerId);
  const safeSessionId = cleanText(sessionId, 120);
  const expiry = new Date(expiresAt || Date.now() + STORE_CREDIT_ACCESS_TTL_MS);
  if (
    !mongoose.Types.ObjectId.isValid(customer) ||
    !safeSessionId ||
    Number.isNaN(expiry.getTime())
  ) {
    throw new TypeError('No fue posible autorizar la consulta del saldo.');
  }
  const encoded = encodePayload({
    v: STORE_CREDIT_ACCESS_VERSION,
    customer: customerAccessFingerprint(customer, secret),
    sessionId: safeSessionId,
    currency: cleanUpper(currency || 'COP', 12) || 'COP',
    expiresAt: expiry.toISOString(),
  });
  return `sc1_${encoded}.${signAccessPayload(encoded, secret)}`;
}

function verifyStoreCreditAccess(
  token,
  { customerId, sessionId, currency = 'COP', now = new Date() } = {},
  { secret = getCartAccessSecret() } = {}
) {
  const match = /^sc1_([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec(
    cleanText(token, 2000)
  );
  if (!match) return { valid: false, reason: 'format' };
  const payload = decodePayload(match[1]);
  const expiresAt = new Date(payload?.expiresAt || 0);
  const valid = Boolean(
    payload?.v === STORE_CREDIT_ACCESS_VERSION &&
      safeEqual(
        payload?.customer,
        customerAccessFingerprint(customerId, secret)
      ) &&
      cleanText(payload.sessionId, 120) === cleanText(sessionId, 120) &&
      cleanUpper(payload.currency, 12) === cleanUpper(currency || 'COP', 12) &&
      !Number.isNaN(expiresAt.getTime()) &&
      expiresAt > new Date(now) &&
      safeEqual(match[2], signAccessPayload(match[1], secret))
  );
  return { valid, reason: valid ? '' : 'invalid', payload: valid ? payload : null };
}

module.exports = {
  issueStoreCreditAccess,
  verifyStoreCreditAccess,
};
