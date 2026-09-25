const { canonicalPermission } = require('./adminPermissionCatalog');

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);

function requiredUserWritePermissions(method, body = {}) {
  const creating = String(method || '').toUpperCase() === 'POST';
  const required = [creating ? 'admin-users:create' : 'admin-users:update'];

  if (creating || [
    'role', 'roleRef', 'permissions', 'branches', 'branchIds', 'defaultBranch',
  ].some((key) => hasOwn(body, key))) {
    required.push('admin-users:assign_role');
  }

  if (!creating && ['status', 'active'].some((key) => hasOwn(body, key))) {
    required.push('admin-users:disable');
  }

  if (!creating && hasOwn(body, 'mustChangePassword')) {
    required.push('admin-users:password');
  }

  return required;
}

function canGrantRole({ actorCode, actorRole, targetRole, actorPermissions = [] }) {
  const actor = String(actorCode || '').toLowerCase();
  const target = String(targetRole?.code || '').toLowerCase();

  if (actor === 'owner') return true;
  if (target === 'owner') return false;
  if (actor === 'admin') return true;
  if (!actorRole || !targetRole) return false;

  const actorLevel = Number(actorRole.level);
  const targetLevel = Number(targetRole.level);
  if (!Number.isFinite(actorLevel) || !Number.isFinite(targetLevel)) return false;
  if (targetLevel < actorLevel) return false;
  if (actorRole.scope !== 'global' && targetRole.scope === 'global') return false;

  const available = new Set(actorPermissions.map(canonicalPermission));
  return (targetRole.permissions || []).every((rawPermission) => {
    const permission = canonicalPermission(rawPermission);
    const moduleName = permission.split(':')[0];
    return available.has('*') || available.has(permission) || available.has(`${moduleName}:*`);
  });
}

function canAssignBranches({ actorCode, actorBranches = [], assignedBranches = [] }) {
  const actor = String(actorCode || '').toLowerCase();
  if (actor === 'owner' || actor === 'admin') return true;

  const authorized = new Set(actorBranches.map((item) => String(item.branch || '')));
  return assignedBranches.length > 0 && assignedBranches.every(
    (item) => authorized.has(String(item.branch))
  );
}

function canAccessUserScope({ actorCode, actorBranches = [], targetBranches = [], viewOnly = false }) {
  const actor = String(actorCode || '').toLowerCase();
  if (actor === 'owner' || actor === 'admin') return true;

  const authorized = new Set(actorBranches.map((item) => String(item.branch || '')));
  if (!targetBranches.length) return false;
  return viewOnly
    ? targetBranches.some((item) => authorized.has(String(item.branch)))
    : targetBranches.every((item) => authorized.has(String(item.branch)));
}

module.exports = {
  requiredUserWritePermissions, canGrantRole, canAssignBranches, canAccessUserScope,
};
