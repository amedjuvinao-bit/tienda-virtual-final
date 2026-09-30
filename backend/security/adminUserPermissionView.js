'use strict';

const { canonicalPermission } = require('./adminPermissionCatalog');

function normalizePermissions(input) {
  if (!Array.isArray(input)) return [];
  return [...new Set(input.map(canonicalPermission).filter(Boolean))];
}

function getAdminUserPermissionView(adminUser) {
  const referencedRole = adminUser?.roleRef;
  const hasRoleReference = Boolean(referencedRole || adminUser?.populated?.('roleRef'));
  if (!hasRoleReference) {
    return { roleRef: null, permissions: normalizePermissions(adminUser?.permissions) };
  }

  const activeRole = referencedRole &&
    referencedRole.active === true && referencedRole.status === 'active' &&
    !referencedRole.deletedAt && Array.isArray(referencedRole.permissions)
    ? referencedRole : null;

  return {
    roleRef: activeRole,
    permissions: normalizePermissions(activeRole?.permissions),
  };
}

module.exports = { getAdminUserPermissionView };
