'use strict';

const {
  PERMANENT_PAYMENT_INVENTORY_CODES,
  RETRYABLE_MONGO_CODES,
  RETRYABLE_MONGO_LABELS,
  RETRYABLE_PAYMENT_INVENTORY_CODES,
} = require('./constants');

function getErrorLabels(error) {
  const labels = new Set();
  for (const label of Array.isArray(error?.errorLabels) ? error.errorLabels : []) {
    labels.add(String(label));
  }
  for (const label of RETRYABLE_MONGO_LABELS) {
    if (error?.hasErrorLabel?.(label) === true) labels.add(label);
  }
  return labels;
}

function isRetryablePaymentInventoryError(error, visited = new Set()) {
  if (!error || visited.has(error)) return false;
  if (typeof error === 'object') visited.add(error);
  if (error.retryable === true || Number(error.statusCode || 0) === 503) return true;

  const code = String(error.code || '').trim();
  const codeName = String(error.codeName || '').trim();
  if (RETRYABLE_PAYMENT_INVENTORY_CODES.has(code)) return true;
  if (RETRYABLE_MONGO_CODES.has(Number(error.code))) return true;
  if (codeName === 'WriteConflict' || code === 'WriteConflict') return true;
  if ([...getErrorLabels(error)].some((label) => RETRYABLE_MONGO_LABELS.has(label))) {
    return true;
  }
  return isRetryablePaymentInventoryError(error.cause, visited);
}

function isPermanentPaymentInventoryError(error, visited = new Set()) {
  if (!error || visited.has(error)) return false;
  if (typeof error === 'object') visited.add(error);
  if (PERMANENT_PAYMENT_INVENTORY_CODES.has(String(error.code || '').trim())) {
    return true;
  }
  return isPermanentPaymentInventoryError(error.cause, visited);
}

function asRetryablePaymentInventoryError(
  error,
  fallbackCode = 'PAYMENT_INVENTORY_RECOVERY_RETRYABLE'
) {
  const failure = error instanceof Error ? error : new Error(String(error || ''));
  if (!failure.code) failure.code = fallbackCode;
  failure.retryable = true;
  failure.statusCode = 503;
  return failure;
}

function createFailureError(
  message,
  code,
  details = {},
  { retryable = RETRYABLE_PAYMENT_INVENTORY_CODES.has(code), cause = null } = {}
) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  error.retryable = retryable === true;
  error.statusCode = retryable === true ? 503 : 409;
  if (cause) error.cause = cause;
  return error;
}

module.exports = {
  asRetryablePaymentInventoryError,
  createFailureError,
  isPermanentPaymentInventoryError,
  isRetryablePaymentInventoryError,
};
