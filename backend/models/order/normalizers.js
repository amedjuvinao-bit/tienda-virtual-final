const {
  normalizeCanonicalAttributes: normalizeAttributes,
  resolveVariantIdentity,
} = require('../../../shared/variantKeyAuthority.cjs');
const {
  MAX_TAGS,
  MAX_TAG_LENGTH,
  MIN_TAG_LENGTH,
} = require('./constants');

function normalizeTag(tag) {
  return String(tag || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizeTags(input) {
  const tags = Array.isArray(input) ? input : String(input || '').split(',');
  const cleaned = tags
    .map((tag) => normalizeTag(tag))
    .filter(
      (tag) => tag.length >= MIN_TAG_LENGTH && tag.length <= MAX_TAG_LENGTH
    );

  const seen = new Set();
  const unique = [];
  for (const tag of cleaned) {
    if (!seen.has(tag)) {
      seen.add(tag);
      unique.push(tag);
    }
  }
  return unique.slice(0, MAX_TAGS);
}

const toNum = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

function cleanText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function cleanUpper(value) {
  return cleanText(value).toUpperCase();
}

function cleanLower(value) {
  return cleanText(value).toLowerCase();
}

function cleanMoney(value) {
  return Math.max(0, Number(value || 0));
}

function cleanQty(value) {
  return Math.max(1, Math.floor(Number(value || 0)));
}

function applyCanonicalVariantIdentity(item) {
  if (!item || typeof item !== 'object') return item;
  const visibleColor = cleanText(item.colorLabel || item.color);
  const identity = resolveVariantIdentity({
    variantKey: item.variantKey || item.variantId,
    size: item.size,
    color: item.color,
    attributes: item.variantAttributes || [],
  });
  item.variantKey = identity.variantKey;
  item.variantId = identity.variantKey;
  item.size = identity.size;
  item.color = identity.color;
  item.colorLabel = visibleColor;
  item.variantAttributes = identity.attributes;
  return item;
}

module.exports = {
  applyCanonicalVariantIdentity,
  cleanLower,
  cleanMoney,
  cleanQty,
  cleanText,
  cleanUpper,
  normalizeAttributes,
  normalizeTag,
  normalizeTags,
  toNum,
};
