'use strict';

const DEFAULT_REQUIRED_ROLES = ['owner', 'admin'];

function normalizeRole(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, '-');
}

function getRequiredTwoFactorRoles(value = process.env.ADMIN_2FA_REQUIRED_ROLES) {
  const configured = String(value || '').trim();

  if (!configured) return [...DEFAULT_REQUIRED_ROLES];
  if (['none', 'off', 'disabled'].includes(configured.toLowerCase())) return [];

  return Array.from(
    new Set(
      configured
        .split(',')
        .map(normalizeRole)
        .filter(Boolean)
    )
  );
}

function isTwoFactorRequiredForRole(role, value) {
  return getRequiredTwoFactorRoles(value).includes(normalizeRole(role));
}

function isTwoFactorEnforcementReady() {
  const key = String(
    process.env.ADMIN_2FA_ENCRYPTION_KEY ||
      process.env.INTEGRATIONS_ENCRYPTION_KEY ||
      ''
  ).trim();
  return key.length >= 32;
}

function buildTwoFactorPolicy(adminUser, value) {
  const role = normalizeRole(adminUser?.role);
  const enabled = Boolean(adminUser?.twoFactorEnabled);
  const requiredRoles = getRequiredTwoFactorRoles(value);
  const configuredRequired = requiredRoles.includes(role);
  const enforcementReady = isTwoFactorEnforcementReady();
  const required = configuredRequired && enforcementReady;

  return {
    role,
    enabled,
    required,
    compliant: !required || enabled,
    requiredRoles,
    configuredRequired,
    enforcementReady,
    misconfigured: configuredRequired && !enforcementReady,
  };
}

function isTwoFactorBootstrapRequest(req) {
  const path = String(req?.originalUrl || req?.url || '')
    .split('?')[0]
    .replace(/\/+$/, '');

  return [
    '/api/admin/auth/2fa/status',
    '/api/admin/auth/2fa/setup',
    '/api/admin/auth/2fa/confirm',
    '/api/admin/auth/2fa/reconfigure',
    '/api/admin/auth/2fa/reconfigure/confirm',
    '/api/admin/auth/security-center',
    '/api/admin/auth/sessions/revoke-others',
    '/api/admin/auth/logout',
    '/api/admin/auth/logout-all',
    '/api/admin/auth/verify',
  ].some((allowedPath) => path === allowedPath || path.startsWith('/api/admin/auth/sessions/'));
}

module.exports = {
  DEFAULT_REQUIRED_ROLES,
  buildTwoFactorPolicy,
  getRequiredTwoFactorRoles,
  isTwoFactorBootstrapRequest,
  isTwoFactorEnforcementReady,
  isTwoFactorRequiredForRole,
  normalizeRole,
};
