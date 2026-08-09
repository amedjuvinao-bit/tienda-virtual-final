'use strict';

const COMMERCIAL_FIELD_TYPES = Object.freeze([
  'text',
  'number',
  'boolean',
  'date',
  'url',
]);

function cleanText(value, maximum = 240) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, maximum);
}

function cleanMultiline(value, maximum = 1000) {
  return String(value || '')
    .trim()
    .replace(/\r\n/g, '\n')
    .slice(0, maximum);
}

function slugify(value, maximum = 120) {
  return cleanText(value, maximum * 2)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maximum);
}

function normalizeStringArray(values, maximum = 30, itemMaximum = 80) {
  if (!Array.isArray(values)) return [];

  const normalized = [];
  const seen = new Set();

  for (const item of values) {
    const value = cleanText(item, itemMaximum);
    const key = value.toLowerCase();

    if (!value || seen.has(key)) continue;
    seen.add(key);
    normalized.push(value);

    if (normalized.length >= maximum) break;
  }

  return normalized;
}

function normalizeSeo(value = {}, fallback = {}) {
  const source =
    value && typeof value === 'object' && !Array.isArray(value)
      ? value
      : {};

  return {
    title: cleanText(source.title, 70),
    description: cleanMultiline(source.description, 320),
    keywords: normalizeStringArray(source.keywords, 15, 60),
    image: cleanText(source.image, 1000),
    canonicalUrl: cleanText(source.canonicalUrl, 1000),
    noIndex: source.noIndex === true,
    fallbackTitle: cleanText(fallback.title, 70),
    fallbackDescription: cleanMultiline(
      fallback.description,
      320
    ),
    fallbackImage: cleanText(fallback.image, 1000),
  };
}

function normalizeCommercialFieldType(value) {
  const normalized = cleanText(value, 20).toLowerCase();

  return COMMERCIAL_FIELD_TYPES.includes(normalized)
    ? normalized
    : 'text';
}

function normalizeCommercialFieldValue(type, value) {
  if (type === 'boolean') {
    return value === true || String(value).toLowerCase() === 'true'
      ? 'true'
      : 'false';
  }

  if (type === 'number') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? String(parsed) : '';
  }

  return cleanMultiline(value, type === 'text' ? 1000 : 500);
}

function normalizeCommercialFields(values, maximum = 30) {
  if (!Array.isArray(values)) return [];

  const normalized = [];
  const seen = new Set();

  for (const raw of values) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      continue;
    }

    const label = cleanText(raw.label, 120);
    const key = slugify(raw.key || label, 80);
    const group = cleanText(raw.group || 'General', 80);
    const type = normalizeCommercialFieldType(raw.type);
    const value = normalizeCommercialFieldValue(type, raw.value);
    const identity = `${group.toLowerCase()}::${key}`;

    if (!label || !key || seen.has(identity)) continue;
    seen.add(identity);

    normalized.push({
      key,
      label,
      group,
      type,
      value,
      public: raw.public !== false,
      sortOrder: normalized.length,
    });

    if (normalized.length >= maximum) break;
  }

  return normalized;
}

module.exports = {
  COMMERCIAL_FIELD_TYPES,
  cleanMultiline,
  cleanText,
  normalizeCommercialFields,
  normalizeSeo,
  normalizeStringArray,
  slugify,
};
