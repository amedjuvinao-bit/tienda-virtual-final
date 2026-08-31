'use strict';

function cleanText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function cleanLower(value) {
  return cleanText(value).toLowerCase();
}

function idValue(value) {
  if (!value) return '';
  if (typeof value === 'object') {
    return String(value._id || value.id || value);
  }
  return String(value);
}

function toQuantity(value) {
  const quantity = Math.floor(Number(value || 0));
  return Number.isFinite(quantity) ? Math.max(0, quantity) : 0;
}

function asPlain(value) {
  if (!value) return {};
  return typeof value.toObject === 'function'
    ? value.toObject({ depopulate: true })
    : value;
}

module.exports = {
  cleanText,
  cleanLower,
  idValue,
  toQuantity,
  asPlain,
};
