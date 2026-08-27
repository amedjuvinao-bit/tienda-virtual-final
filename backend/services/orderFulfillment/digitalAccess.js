'use strict';

const crypto = require('crypto');
const mongoose = require('mongoose');

const { clean } = require('./support');

function getFulfillmentSecret() {
  const secret = clean(
    process.env.DIGITAL_DELIVERY_TOKEN_SECRET ||
      process.env.JWT_SECRET ||
      process.env.ADMIN_JWT_SECRET,
    1000
  );

  if (secret) return secret;

  if (process.env.NODE_ENV === 'production') {
    const error = new Error(
      'Falta DIGITAL_DELIVERY_TOKEN_SECRET para habilitar descargas digitales.'
    );
    error.code = 'DIGITAL_DELIVERY_SECRET_MISSING';
    throw error;
  }

  return 'development-digital-delivery-secret';
}

function buildDigitalAccessToken({ orderId, orderItemId }) {
  return crypto
    .createHmac('sha256', getFulfillmentSecret())
    .update(`${orderId}:${orderItemId}`)
    .digest('base64url');
}

function hashAccessToken(token) {
  return crypto
    .createHash('sha256')
    .update(clean(token, 500))
    .digest('hex');
}

function buildDeterministicDeliveryId({ orderId, sourceKey }) {
  const hex = crypto
    .createHash('sha256')
    .update(`${orderId}:${sourceKey}`)
    .digest('hex')
    .slice(0, 24);
  return new mongoose.Types.ObjectId(hex);
}

function safeTokenMatch(actualToken, expectedHash) {
  const actualHash = hashAccessToken(actualToken);
  const expected = clean(expectedHash, 128);

  if (
    actualHash.length !== expected.length ||
    !actualHash ||
    !expected
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(actualHash, 'hex'),
    Buffer.from(expected, 'hex')
  );
}

function getPublicBackendUrl() {
  return clean(
    process.env.PUBLIC_BACKEND_URL ||
      process.env.BACKEND_PUBLIC_URL ||
      process.env.API_PUBLIC_URL ||
      'http://localhost:5000',
    1000
  ).replace(/\/+$/, '');
}

function buildDigitalAccessUrl({
  orderNumber,
  deliveryId,
  token,
}) {
  return (
    `${getPublicBackendUrl()}/api/digital-deliveries/` +
    `${encodeURIComponent(orderNumber)}/` +
    `${encodeURIComponent(deliveryId)}` +
    `?token=${encodeURIComponent(token)}`
  );
}

function getExpiryDate(accessDays, now = new Date()) {
  return new Date(
    now.getTime() +
      Math.max(1, Number(accessDays || 30)) * 24 * 60 * 60 * 1000
  );
}

module.exports = {
  buildDeterministicDeliveryId,
  buildDigitalAccessToken,
  buildDigitalAccessUrl,
  getExpiryDate,
  hashAccessToken,
  safeTokenMatch,
};
