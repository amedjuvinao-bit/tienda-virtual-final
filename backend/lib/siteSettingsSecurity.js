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

function stripProtectedWriteFields(flatSet = {}) {
  const safeSet = {};

  for (const [path, value] of Object.entries(flatSet || {})) {
    const hasInternalSegment = String(path || '')
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
