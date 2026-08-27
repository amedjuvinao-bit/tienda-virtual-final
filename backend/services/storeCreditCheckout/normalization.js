'use strict';

function cleanText(value, maximum = 500) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maximum);
}

function cleanLower(value, maximum = 500) {
  return cleanText(value, maximum).toLowerCase();
}

function cleanUpper(value, maximum = 500) {
  return cleanText(value, maximum).toUpperCase();
}

function onlyDigits(value) {
  return cleanText(value, 100).replace(/\D/g, '');
}

function cleanPhone(value) {
  return cleanText(value, 100).replace(/[^0-9+]/g, '');
}

function cleanMoney(value) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.max(0, Math.round((number + Number.EPSILON) * 100) / 100)
    : 0;
}

function idValue(value) {
  if (!value) return '';
  if (typeof value === 'object') return String(value._id || value.id || value);
  return String(value);
}

function customerKey(customerId) {
  return `customer:${idValue(customerId)}`;
}

function storeCreditError(message, code, statusCode = 409, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  error.details = details;
  return error;
}

module.exports = {
  cleanLower,
  cleanMoney,
  cleanPhone,
  cleanText,
  cleanUpper,
  customerKey,
  idValue,
  onlyDigits,
  storeCreditError,
};
