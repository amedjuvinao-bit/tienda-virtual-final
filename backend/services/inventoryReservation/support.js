const mongoose = require('mongoose');

const { PAYMENT_FAILURE_RELEASE_PREFIX } = require('./constants');

function createServiceError(message, code, details = {}, statusCode = 400) {
  const error = new Error(message);

  error.code = code;
  error.details = details;
  error.statusCode = statusCode;

  return error;
}

function cleanText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function cleanUpper(value) {
  return cleanText(value).toUpperCase();
}

function normalizePaymentReferenceIdentity(value = '') {
  const reference = cleanUpper(value);
  if (!reference) return '';
  return reference.includes('__TRY__')
    ? reference.split('__TRY__')[0]
    : reference;
}

function encodeReleaseIdentity(value = '') {
  return encodeURIComponent(cleanText(value));
}

function decodeReleaseIdentity(value = '') {
  try {
    return decodeURIComponent(String(value || ''));
  } catch (_error) {
    return '';
  }
}

function buildPaymentFailureReleaseReason({
  provider = '',
  paymentStatus = '',
  orderNumber = '',
  paymentReference = '',
  paymentTransactionId = '',
} = {}) {
  const safeProvider = cleanText(provider).toLowerCase();
  const safeStatus = cleanText(paymentStatus).toLowerCase();
  const safeOrderNumber = cleanText(orderNumber);
  const safeReference = cleanText(paymentReference);
  const safeTransactionId = cleanText(paymentTransactionId);
  const canonicalReference = normalizePaymentReferenceIdentity(safeReference);
  const expectedCanonicalReference = normalizePaymentReferenceIdentity(
    `ORDER-${safeOrderNumber}`
  );

  if (!['failed', 'cancelled'].includes(safeStatus)) {
    throw createServiceError(
      'El estado no autoriza una liberacion por fallo de pago.',
      'INVALID_PAYMENT_FAILURE_RELEASE_STATUS',
      { paymentStatus: safeStatus },
      409
    );
  }
  if (
    !safeProvider ||
    !safeOrderNumber ||
    !safeReference ||
    !safeTransactionId ||
    canonicalReference !== expectedCanonicalReference
  ) {
    throw createServiceError(
      'La liberacion requiere una identidad de pago persistible y coherente.',
      'PAYMENT_FAILURE_RELEASE_IDENTITY_REQUIRED',
      {
        provider: safeProvider,
        orderNumber: safeOrderNumber,
        canonicalReference,
      },
      409
    );
  }

  return [
    PAYMENT_FAILURE_RELEASE_PREFIX,
    'operation=inventory_release',
    `provider=${encodeReleaseIdentity(safeProvider)}`,
    `status=${encodeReleaseIdentity(safeStatus)}`,
    `order=${encodeReleaseIdentity(safeOrderNumber)}`,
    `reference=${encodeReleaseIdentity(safeReference)}`,
    `canonicalReference=${encodeReleaseIdentity(canonicalReference)}`,
    `transaction=${encodeReleaseIdentity(safeTransactionId)}`,
  ].join('|');
}

function parsePaymentFailureReleaseReason(value = '') {
  const source = cleanText(value);
  const parts = source.split('|');
  if (parts.shift() !== PAYMENT_FAILURE_RELEASE_PREFIX) return null;

  const result = {};
  for (const part of parts) {
    const separator = part.indexOf('=');
    if (separator <= 0) return null;
    result[part.slice(0, separator)] = decodeReleaseIdentity(
      part.slice(separator + 1)
    );
  }

  if (
    !['failed', 'cancelled'].includes(result.status) ||
    result.operation !== 'inventory_release' ||
    !result.provider ||
    !result.order ||
    !result.reference ||
    !result.canonicalReference ||
    !result.transaction
  ) {
    return null;
  }
  return result;
}

function getObjectIdValue(value) {
  if (!value) return '';

  if (typeof value === 'object') {
    return String(value._id || value.id || value);
  }

  return String(value);
}

function isValidObjectId(value) {
  return mongoose.Types.ObjectId.isValid(String(value || ''));
}

function toObjectId(value, fieldName = 'id') {
  const cleanValue = getObjectIdValue(value);

  if (!isValidObjectId(cleanValue)) {
    throw createServiceError(
      `El campo ${fieldName} no tiene un ObjectId válido.`,
      'INVALID_OBJECT_ID',
      {
        field: fieldName,
        value: cleanValue,
      },
      400
    );
  }

  return new mongoose.Types.ObjectId(cleanValue);
}

function toNumber(value, defaultValue = 0) {
  const number = Number(value);

  if (!Number.isFinite(number)) return defaultValue;

  return number;
}

async function withTransaction(work, externalSession = null) {
  if (externalSession) {
    return work(externalSession);
  }

  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      result = await work(session);
    });

    return result;
  } finally {
    await session.endSession();
  }
}

module.exports = {
  buildPaymentFailureReleaseReason,
  cleanText,
  cleanUpper,
  createServiceError,
  getObjectIdValue,
  isValidObjectId,
  normalizePaymentReferenceIdentity,
  parsePaymentFailureReleaseReason,
  toNumber,
  toObjectId,
  withTransaction,
};
