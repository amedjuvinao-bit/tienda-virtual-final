'use strict';

const crypto = require('crypto');
const {
  trimSafe,
} = require('../../services/paymentRouteConfigurationService');

const WOMPI_ENVIRONMENTS = Object.freeze({
  sandbox: 'https://sandbox.wompi.co/v1',
  production: 'https://production.wompi.co/v1',
});

function resolveWompiBaseUrl(mode) {
  return mode === 'production'
    ? WOMPI_ENVIRONMENTS.production
    : WOMPI_ENVIRONMENTS.sandbox;
}

function buildOrderReference(order) {
  const safeOrderNumber =
    trimSafe(order?.orderNumber, 60) || String(order?._id || '').slice(-12);
  return `ORDER-${safeOrderNumber}`;
}

function buildWompiReference(order) {
  const nonce = crypto.randomBytes(8).toString('hex');
  return `${buildOrderReference(order)}__TRY__${Date.now().toString(36)}-${nonce}`;
}

function amountToCents(amount) {
  const numeric = Number(amount || 0);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return Math.round(numeric * 100);
}

function buildIntegritySignature({
  reference,
  amountInCents,
  currency,
  integrityKey,
}) {
  const raw = `${reference}${amountInCents}${currency}${integrityKey}`;
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function buildRedirectUrl(_req, order) {
  const base =
    process.env.FRONTEND_URL ||
    process.env.PUBLIC_APP_URL ||
    'http://localhost:5173';

  const safeBase = String(base).replace(/\/+$/, '');
  const orderId = encodeURIComponent(String(order?._id || ''));
  const orderNumber = encodeURIComponent(String(order?.orderNumber || ''));

  return `${safeBase}/gracias?orderId=${orderId}&orderNumber=${orderNumber}`;
}

function extractOrderNumberFromWompiReference(reference) {
  const safe = trimSafe(reference, 200);
  if (!safe) return '';

  const normalized = safe.includes('__TRY__')
    ? safe.split('__TRY__')[0]
    : safe;
  const match = normalized.match(/^ORDER-(.+)$/i);

  return match?.[1] ? String(match[1]).trim() : '';
}

function parseWompiTransactionStatus(status) {
  const safe = trimSafe(status, 40).toUpperCase();

  if (safe === 'APPROVED') {
    return {
      paymentStatus: 'paid',
      orderStatus: 'paid',
      label: 'Pago aprobado',
    };
  }

  if (safe === 'DECLINED') {
    return {
      paymentStatus: 'failed',
      orderStatus: 'failed',
      label: 'Pago rechazado',
    };
  }

  if (safe === 'ERROR') {
    return {
      paymentStatus: 'failed',
      orderStatus: 'failed',
      label: 'Pago con error',
    };
  }

  if (safe === 'VOIDED') {
    return {
      paymentStatus: 'cancelled',
      orderStatus: 'cancelled',
      label: 'Pago anulado',
    };
  }

  if (safe === 'PENDING') {
    return {
      paymentStatus: 'pending_gateway',
      orderStatus: null,
      label: 'Pago pendiente',
    };
  }

  return {
    paymentStatus: 'pending_gateway',
    orderStatus: null,
    label: `Estado Wompi ${safe || 'UNKNOWN'}`,
  };
}

function getNestedValue(obj, path) {
  const safePath = String(path || '').trim();
  if (!safePath) return '';

  return safePath.split('.').reduce((acc, key) => {
    if (acc == null || typeof acc !== 'object') return undefined;
    return acc[key];
  }, obj);
}

function buildWompiEventChecksum(payload, eventSecret) {
  const signature =
    payload?.signature && typeof payload.signature === 'object'
      ? payload.signature
      : {};

  const properties = Array.isArray(signature.properties)
    ? signature.properties
    : [];
  const timestamp = payload?.timestamp;
  const propertiesConcat = properties
    .map((property) => getNestedValue(payload?.data || {}, property))
    .map((value) => (value === undefined || value === null ? '' : String(value)))
    .join('');
  const raw = `${propertiesConcat}${String(timestamp || '')}${String(
    eventSecret || ''
  )}`;

  return crypto.createHash('sha256').update(raw).digest('hex');
}

function getWompiProvidedChecksum(req, payload) {
  const headerChecksum = trimSafe(
    req.get('X-Event-Checksum') || req.get('x-event-checksum'),
    200
  );

  if (headerChecksum) return headerChecksum.toLowerCase();

  return trimSafe(payload?.signature?.checksum, 200).toLowerCase();
}

module.exports = {
  WOMPI_ENVIRONMENTS,
  amountToCents,
  buildIntegritySignature,
  buildRedirectUrl,
  buildWompiEventChecksum,
  buildWompiReference,
  extractOrderNumberFromWompiReference,
  getWompiProvidedChecksum,
  parseWompiTransactionStatus,
  resolveWompiBaseUrl,
};
