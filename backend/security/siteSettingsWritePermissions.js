'use strict';

const {
  canonicalPermission,
} = require('./adminPermissionCatalog');

const SUPPORTED_TOP_LEVEL_KEYS = new Set([
  'theme',
  'menus',
  'admin',
  'loginAdmin',
  'billing',
  'store',
]);

const OPERATIONAL_THEME_GLOBAL_PERMISSIONS = Object.freeze({
  payments: 'settings:payments',
  envios: 'settings:shipping',
});

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function addPermission(target, permission) {
  const canonical = canonicalPermission(permission);
  if (canonical && !target.includes(canonical)) target.push(canonical);
}

function resolveThemePermissions(theme, permissions) {
  if (!isPlainObject(theme)) return;

  const themeKeys = Object.keys(theme);
  const hasAppearanceFields = themeKeys.some((key) => key !== 'global');
  const global = isPlainObject(theme.global) ? theme.global : {};
  const globalKeys = Object.keys(global);

  if (
    hasAppearanceFields ||
    globalKeys.some((key) => !hasOwn(OPERATIONAL_THEME_GLOBAL_PERMISSIONS, key))
  ) {
    addPermission(permissions, 'appearance:update');
  }

  for (const [key, permission] of Object.entries(
    OPERATIONAL_THEME_GLOBAL_PERMISSIONS
  )) {
    if (hasOwn(global, key)) addPermission(permissions, permission);
  }
}

function resolveSiteSettingsWritePermissions(body = {}) {
  if (!isPlainObject(body)) return [];

  const permissions = [];

  if (hasOwn(body, 'store')) addPermission(permissions, 'settings:store');
  if (hasOwn(body, 'admin')) addPermission(permissions, 'settings:panel');
  if (hasOwn(body, 'loginAdmin')) addPermission(permissions, 'settings:login');
  if (hasOwn(body, 'billing')) addPermission(permissions, 'billing:settings');
  if (hasOwn(body, 'menus')) addPermission(permissions, 'appearance:menus');
  if (hasOwn(body, 'theme')) resolveThemePermissions(body.theme, permissions);

  return permissions;
}

function getUnsupportedSiteSettingsKeys(body = {}) {
  if (!isPlainObject(body)) return [];

  return Object.keys(body).filter((key) => !SUPPORTED_TOP_LEVEL_KEYS.has(key));
}

module.exports = {
  SUPPORTED_TOP_LEVEL_KEYS,
  getUnsupportedSiteSettingsKeys,
  resolveSiteSettingsWritePermissions,
};
