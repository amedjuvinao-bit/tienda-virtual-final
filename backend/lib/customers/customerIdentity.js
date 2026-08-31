'use strict';

const DOCUMENT_TYPES = Object.freeze([
  'CC',
  'CE',
  'NIT',
  'TI',
  'PP',
  'PPT',
  'RC',
  'DNI',
  'OTHER',
  '',
]);

const NUMERIC_DOCUMENT_TYPES = new Set(['CC', 'CE', 'NIT', 'TI', 'RC']);

function cleanText(value, max = 250) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, max);
}

function cleanLower(value, max = 250) {
  return cleanText(value, max).toLowerCase();
}

function cleanUpper(value, max = 80) {
  return cleanText(value, max).toUpperCase();
}

function onlyDigits(value) {
  return cleanText(value, 80).replace(/\D/g, '');
}

function cleanPhone(value) {
  const text = cleanText(value, 80);
  const hasLeadingPlus = text.startsWith('+');
  const digits = text.replace(/\D/g, '');
  return `${hasLeadingPlus ? '+' : ''}${digits}`;
}

function normalizePhone(value, { defaultCountry = 'CO' } = {}) {
  const cleaned = cleanPhone(value);
  let digits = cleaned.replace(/\D/g, '');

  if (digits.startsWith('00')) digits = digits.slice(2);
  if (!digits) return '';

  const country = cleanUpper(defaultCountry, 2);

  if (country === 'CO') {
    if (digits.length === 10) return `+57${digits}`;
    if (digits.length === 12 && digits.startsWith('57')) return `+${digits}`;
  }

  if (cleaned.startsWith('+') && digits.length >= 8 && digits.length <= 15) {
    return `+${digits}`;
  }

  return digits;
}

function normalizeEmail(value) {
  return cleanLower(value, 180);
}

function normalizeDocumentType(value) {
  const normalized = cleanUpper(value, 40);
  const aliases = {
    CEDULA: 'CC',
    'CÉDULA': 'CC',
    'CEDULA DE CIUDADANIA': 'CC',
    'CÉDULA DE CIUDADANÍA': 'CC',
    PASAPORTE: 'PP',
    'PERMISO POR PROTECCION TEMPORAL': 'PPT',
    'PERMISO POR PROTECCIÓN TEMPORAL': 'PPT',
  };
  const resolved = aliases[normalized] || normalized;

  if (!resolved) return '';
  return DOCUMENT_TYPES.includes(resolved) ? resolved : 'OTHER';
}

function normalizeDocumentNumber(value, documentType = '') {
  const type = normalizeDocumentType(documentType);
  const text = cleanUpper(value, 80);

  if (!text) return '';
  if (NUMERIC_DOCUMENT_TYPES.has(type)) return onlyDigits(text);

  return text.replace(/[^A-Z0-9]/g, '');
}

function buildCustomerIdentity(payload = {}) {
  const documentType = normalizeDocumentType(payload.documentType);

  return {
    normalizedPhone: normalizePhone(
      payload.phone || payload.normalizedPhone,
      { defaultCountry: payload.country || 'CO' }
    ),
    normalizedEmail: normalizeEmail(
      payload.email || payload.normalizedEmail
    ),
    documentType,
    normalizedDocument: normalizeDocumentNumber(
      payload.documentNumber || payload.normalizedDocument,
      documentType
    ),
  };
}

function isMongoDuplicateKeyError(error) {
  return Number(error?.code) === 11000 || error?.codeName === 'DuplicateKey';
}

function isActiveMongoTransaction(session) {
  return Boolean(
    session &&
      typeof session.inTransaction === 'function' &&
      session.inTransaction()
  );
}

function duplicateFieldFromError(error = {}) {
  const key = Object.keys(error?.keyPattern || error?.keyValue || {})[0] || '';

  if (key === 'normalizedPhone') return 'phone';
  if (key === 'normalizedEmail') return 'email';
  if (key === 'normalizedDocument' || key === 'documentType') {
    return 'documentNumber';
  }
  if (key === 'customerCode') return 'customerCode';
  return 'identity';
}

module.exports = {
  DOCUMENT_TYPES,
  buildCustomerIdentity,
  cleanLower,
  cleanPhone,
  cleanText,
  cleanUpper,
  duplicateFieldFromError,
  isActiveMongoTransaction,
  isMongoDuplicateKeyError,
  normalizeDocumentNumber,
  normalizeDocumentType,
  normalizeEmail,
  normalizePhone,
  onlyDigits,
};
