'use strict';

const SENSITIVE_KEYS = new Set([
  'password',
  'certificatepassword',
  'certificatepath',
  'clientsecret',
  'secretkey',
  'webhooksecret',
  'privatekey',
  'integritykey',
  'accesstoken',
  'apikey',
  'apilogin',
  'softwarepin',
  'softwaresecuritycode',
  'technicalkey',
  'credentialfingerprint',
  'connectionfingerprint',
  'lastconnectionfingerprint',
  'numberingrangesfingerprint',
  'activationfingerprint',
]);

function clone(value) {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value));
}

function normalizeKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function isSensitiveKey(key) {
  return SENSITIVE_KEYS.has(normalizeKey(key));
}

function isSensitivePath(path) {
  const parts = String(path || '')
    .split('.')
    .filter(Boolean);

  return parts.some((part) => isSensitiveKey(part));
}

function hasConfiguredValue(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  return true;
}

function redactSecrets(value, path = '', credentialStatus = {}) {
  if (Array.isArray(value)) {
    return value.map((item, index) =>
      redactSecrets(item, path ? `${path}.${index}` : String(index), credentialStatus)
    );
  }

  if (!value || typeof value !== 'object') return value;

  const safe = {};

  for (const [key, itemValue] of Object.entries(value)) {
    const itemPath = path ? `${path}.${key}` : key;

    if (isSensitiveKey(key)) {
      credentialStatus[itemPath] = hasConfiguredValue(itemValue);
      continue;
    }

    safe[key] = redactSecrets(itemValue, itemPath, credentialStatus);
  }

  return safe;
}

function buildAdminSiteSettings(rawSettings) {
  const credentialStatus = {};
  const safe = redactSecrets(clone(rawSettings) || {}, '', credentialStatus);

  return {
    ...safe,
    _credentialStatus: credentialStatus,
  };
}

function buildPublicSiteSettings(rawSettings) {
  const safe = buildAdminSiteSettings(rawSettings);

  delete safe._credentialStatus;
  delete safe.billing;
  delete safe.updatedBy;
  delete safe.__v;

  if (safe?.theme?.global?.payments) {
    delete safe.theme.global.payments.credentials;
  }

  return safe;
}

function stripProtectedWriteFields(flatSet = {}, options = {}) {
  const safeSet = {};
  const allowBilling = options?.allowBilling === true;

  for (const [path, value] of Object.entries(flatSet || {})) {
    const normalizedPath = String(path || '');
    const isBillingPath =
      normalizedPath === 'billing' || normalizedPath.startsWith('billing.');

    if (isBillingPath && !allowBilling) {
      const error = new Error(
        'La configuración de facturación solo puede modificarse mediante la ruta fiscal protegida.'
      );
      error.code = 'BILLING_DEDICATED_ENDPOINT_REQUIRED';
      error.status = 409;
      throw error;
    }

    const hasInternalSegment = normalizedPath
      .split('.')
      .some((segment) => segment.startsWith('_'));

    if (hasInternalSegment) continue;

    if (
      isSensitivePath(path) &&
      (value === undefined || (typeof value === 'string' && value.trim() === ''))
    ) {
      continue;
    }

    safeSet[path] = value;
  }

  return safeSet;
}

module.exports = {
  buildAdminSiteSettings,
  buildPublicSiteSettings,
  isSensitiveKey,
  isSensitivePath,
  stripProtectedWriteFields,
};
