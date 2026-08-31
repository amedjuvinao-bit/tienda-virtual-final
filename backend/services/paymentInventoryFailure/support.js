'use strict';

function cleanText(value, max = 300) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function idValue(value) {
  if (!value) return '';
  if (typeof value === 'object') return String(value._id || value.id || value);
  return String(value);
}

function toQuantity(value) {
  const quantity = Math.floor(Number(value || 0));
  return Number.isFinite(quantity) ? Math.max(0, quantity) : 0;
}

module.exports = {
  cleanText,
  idValue,
  toQuantity,
};
