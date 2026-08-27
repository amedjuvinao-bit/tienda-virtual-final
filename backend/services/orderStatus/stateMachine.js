'use strict';

const MAX_BULK_ORDERS = 100;

const STATUS_ALIASES = new Map([
  ['pendiente', 'pending'],
  ['pending', 'pending'],
  ['procesando', 'processing'],
  ['processing', 'processing'],
  ['pagado', 'paid'],
  ['paid', 'paid'],
  ['fallido', 'failed'],
  ['rechazado', 'failed'],
  ['failed', 'failed'],
  ['enviado', 'shipped'],
  ['shipped', 'shipped'],
  ['entregado', 'delivered'],
  ['entregada', 'delivered'],
  ['delivered', 'delivered'],
  ['cancelado', 'cancelled'],
  ['cancelada', 'cancelled'],
  ['cancelled', 'cancelled'],
  ['canceled', 'cancelled'],
  ['reembolsado', 'refunded'],
  ['reembolsada', 'refunded'],
  ['refunded', 'refunded'],
]);

const ALLOWED_TRANSITIONS = new Map([
  ['pending', new Set(['processing', 'paid', 'cancelled', 'failed'])],
  ['processing', new Set(['pending', 'paid', 'cancelled', 'failed'])],
  ['paid', new Set(['shipped', 'delivered'])],
  ['shipped', new Set(['delivered'])],
  ['delivered', new Set()],
  ['cancelled', new Set()],
  ['failed', new Set()],
  ['refunded', new Set()],
]);

function cleanText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function createTransitionError(
  message,
  code,
  statusCode = 409,
  details = {}
) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  error.details = details;
  return error;
}

function normalizeOrderStatus(value) {
  return STATUS_ALIASES.get(cleanText(value).toLowerCase()) || '';
}

function normalizeCurrentStatus(value) {
  const normalized = normalizeOrderStatus(value);
  return normalized || cleanText(value).toLowerCase();
}

function getAllowedOrderStatuses() {
  return Array.from(new Set(STATUS_ALIASES.values()));
}

module.exports = {
  MAX_BULK_ORDERS,
  ALLOWED_TRANSITIONS,
  cleanText,
  createTransitionError,
  normalizeOrderStatus,
  normalizeCurrentStatus,
  getAllowedOrderStatuses,
};
