// backend/middleware/requirePermission.js
/**
 * Middleware modular para permisos administrativos.
 *
 * Debe usarse DESPUÉS de requireAdmin.
 *
 * Ejemplos:
 *
 * const requireAdmin = require('../middleware/requireAdmin');
 * const requirePermission = require('../middleware/requirePermission');
 *
 * router.get(
 *   '/admin',
 *   requireAdmin,
 *   requirePermission('orders:view'),
 *   controller
 * );
 *
 * router.post(
 *   '/admin',
 *   requireAdmin,
 *   requirePermission.any(['orders:create', 'pos:create']),
 *   controller
 * );
 */

const AdminRole = require('../models/AdminRole');

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizePermission(value) {
  return normalizeText(value).toLowerCase().replace(/\s+/g, ':');
}

function normalizeRole(value) {
  return normalizeText(value).toLowerCase();
}

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null) return [];
  return [value];
}

function uniqueCleanPermissions(permissions = []) {
  const seen = new Set();
  const result = [];

  for (const item of toArray(permissions)) {
    const permission = normalizePermission(item);

    if (!permission) continue;
    if (seen.has(permission)) continue;

    seen.add(permission);
    result.push(permission);
  }

  return result;
}

function isLegacyAdmin(req) {
  return req.adminAuthType === 'legacy';
}

function isOwner(req) {
  return normalizeRole(req.adminRole) === 'owner';
}

function isAdmin(req) {
  return normalizeRole(req.adminRole) === 'admin';
}

function hasWildcardPermission(permissionSet, permission) {
  if (permissionSet.has('*')) return true;

  const cleanPermission = normalizePermission(permission);

  if (!cleanPermission) return false;

  if (permissionSet.has(cleanPermission)) return true;

  const [moduleName] = cleanPermission.split(':');

  if (moduleName && permissionSet.has(`${moduleName}:*`)) return true;

  return false;
}

async function loadRolePermissions(req) {
  const adminRole = normalizeRole(req.adminRole);

  if (!adminRole) return [];

  if (req.adminRolePermissionsLoaded) {
    return req.adminRolePermissions || [];
  }

  req.adminRolePermissionsLoaded = true;
  req.adminRolePermissions = [];

  try {
    let roleDoc = null;

    if (req.adminUserDoc?.roleRef) {
      roleDoc = await AdminRole.findOne({
        _id: req.adminUserDoc.roleRef,
        deletedAt: null,
        active: true,
        status: 'active',
      }).lean();
    }

    if (!roleDoc && adminRole) {
      roleDoc = await AdminRole.findOne({
        code: adminRole,
        deletedAt: null,
        active: true,
        status: 'active',
      }).lean();
    }

    req.adminRolePermissions = uniqueCleanPermissions(roleDoc?.permissions || []);

    return req.adminRolePermissions;
  } catch (error) {
    console.error('[requirePermission] Error cargando permisos del rol:', error.message);

    return [];
  }
}

async function getEffectivePermissions(req) {
  if (req.adminEffectivePermissionsLoaded) {
    return req.adminEffectivePermissions || [];
  }

  const directPermissions = uniqueCleanPermissions(req.adminPermissions || []);
  const rolePermissions = await loadRolePermissions(req);
  const userHasRoleRef = Boolean(req.adminUserDoc?.roleRef);

  const effectivePermissions = userHasRoleRef
    ? rolePermissions
    : uniqueCleanPermissions([
        ...directPermissions,
        ...rolePermissions,
      ]);

  req.adminEffectivePermissionsLoaded = true;
  req.adminEffectivePermissions = effectivePermissions;

  return effectivePermissions;
}

function reject(res, status, error, message, extra = {}) {
  return res.status(status).json({
    ok: false,
    error,
    message,
    ...extra,
  });
}

function resolveRequiredPermissions(requiredPermissions) {
  const permissions = uniqueCleanPermissions(requiredPermissions);

  if (!permissions.length) {
    throw new Error(
      'requirePermission necesita al menos un permiso. Ejemplo: requirePermission("orders:view")'
    );
  }

  return permissions;
}

function requirePermission(requiredPermissions, options = {}) {
  const permissions = resolveRequiredPermissions(requiredPermissions);

  const mode = options.mode === 'any' ? 'any' : 'all';
  const allowOwner = options.allowOwner !== false;
  const allowLegacyAdmin = options.allowLegacyAdmin !== false;

  return async function requirePermissionMiddleware(req, res, next) {
    try {
      if (req.method === 'OPTIONS') return next();

      if (!req.adminUser && !req.adminUserId && !req.adminRole) {
        return reject(
          res,
          401,
          'UNAUTHORIZED',
          'Primero debes usar requireAdmin antes de requirePermission.'
        );
      }

      if (allowLegacyAdmin && isLegacyAdmin(req)) {
        return next();
      }

      if (allowOwner && isOwner(req)) {
        return next();
      }

      const effectivePermissions = await getEffectivePermissions(req);
      const permissionSet = new Set(effectivePermissions);

      const allowed =
        mode === 'any'
          ? permissions.some((permission) =>
              hasWildcardPermission(permissionSet, permission)
            )
          : permissions.every((permission) =>
              hasWildcardPermission(permissionSet, permission)
            );

      if (!allowed) {
        return reject(
          res,
          403,
          'FORBIDDEN',
          'No tienes permisos suficientes para realizar esta acción.',
          {
            requiredPermissions: permissions,
            mode,
          }
        );
      }

      return next();
    } catch (error) {
      console.error('[requirePermission] Error:', error.message);

      return reject(
        res,
        500,
        'PERMISSION_ERROR',
        'Error validando permisos administrativos.'
      );
    }
  };
}

requirePermission.any = function requireAnyPermission(requiredPermissions, options = {}) {
  return requirePermission(requiredPermissions, {
    ...options,
    mode: 'any',
  });
};

requirePermission.all = function requireAllPermissions(requiredPermissions, options = {}) {
  return requirePermission(requiredPermissions, {
    ...options,
    mode: 'all',
  });
};

requirePermission.role = function requireRole(requiredRoles = [], options = {}) {
  const roles = toArray(requiredRoles)
    .map((role) => normalizeRole(role))
    .filter(Boolean);

  const allowOwner = options.allowOwner !== false;
  const allowLegacyAdmin = options.allowLegacyAdmin !== false;

  if (!roles.length) {
    throw new Error(
      'requirePermission.role necesita al menos un rol. Ejemplo: requirePermission.role("admin")'
    );
  }

  return function requireRoleMiddleware(req, res, next) {
    try {
      if (req.method === 'OPTIONS') return next();

      if (!req.adminUser && !req.adminUserId && !req.adminRole) {
        return reject(
          res,
          401,
          'UNAUTHORIZED',
          'Primero debes usar requireAdmin antes de requirePermission.role.'
        );
      }

      if (allowLegacyAdmin && isLegacyAdmin(req)) {
        return next();
      }

      if (allowOwner && isOwner(req)) {
        return next();
      }

      const currentRole = normalizeRole(req.adminRole);

      if (!roles.includes(currentRole)) {
        return reject(
          res,
          403,
          'FORBIDDEN',
          'Tu rol no tiene autorización para realizar esta acción.',
          {
            requiredRoles: roles,
            currentRole,
          }
        );
      }

      return next();
    } catch (error) {
      console.error('[requirePermission.role] Error:', error.message);

      return reject(
        res,
        500,
        'ROLE_PERMISSION_ERROR',
        'Error validando rol administrativo.'
      );
    }
  };
};

requirePermission.ownerOnly = function requireOwnerOnly() {
  return function requireOwnerOnlyMiddleware(req, res, next) {
    try {
      if (req.method === 'OPTIONS') return next();

      if (!req.adminUser && !req.adminUserId && !req.adminRole) {
        return reject(
          res,
          401,
          'UNAUTHORIZED',
          'Primero debes usar requireAdmin antes de requirePermission.ownerOnly.'
        );
      }

      if (!isOwner(req)) {
        return reject(
          res,
          403,
          'FORBIDDEN',
          'Solo el propietario puede realizar esta acción.'
        );
      }

      return next();
    } catch (error) {
      console.error('[requirePermission.ownerOnly] Error:', error.message);

      return reject(
        res,
        500,
        'OWNER_PERMISSION_ERROR',
        'Error validando permisos de propietario.'
      );
    }
  };
};

requirePermission.adminOrOwner = function requireAdminOrOwner() {
  return function requireAdminOrOwnerMiddleware(req, res, next) {
    try {
      if (req.method === 'OPTIONS') return next();

      if (!req.adminUser && !req.adminUserId && !req.adminRole) {
        return reject(
          res,
          401,
          'UNAUTHORIZED',
          'Primero debes usar requireAdmin antes de requirePermission.adminOrOwner.'
        );
      }

      if (isLegacyAdmin(req) || isOwner(req) || isAdmin(req)) {
        return next();
      }

      return reject(
        res,
        403,
        'FORBIDDEN',
        'Solo propietario o administrador pueden realizar esta acción.'
      );
    } catch (error) {
      console.error('[requirePermission.adminOrOwner] Error:', error.message);

      return reject(
        res,
        500,
        'ADMIN_PERMISSION_ERROR',
        'Error validando permisos administrativos.'
      );
    }
  };
};

requirePermission.branchAccess = function requireBranchAccess(getBranchId) {
  return function requireBranchAccessMiddleware(req, res, next) {
    try {
      if (req.method === 'OPTIONS') return next();

      if (!req.adminUser && !req.adminUserId && !req.adminRole) {
        return reject(
          res,
          401,
          'UNAUTHORIZED',
          'Primero debes usar requireAdmin antes de requirePermission.branchAccess.'
        );
      }

      if (isLegacyAdmin(req) || isOwner(req) || isAdmin(req)) {
        return next();
      }

      const branchId =
        typeof getBranchId === 'function'
          ? getBranchId(req)
          : req.params.branchId ||
            req.params.id ||
            req.body?.branchId ||
            req.query?.branchId ||
            req.adminDefaultBranch;

      const cleanBranchId = String(branchId || '');

      if (!cleanBranchId) {
        return reject(
          res,
          400,
          'BRANCH_REQUIRED',
          'No se pudo determinar la sede para validar el acceso.'
        );
      }

      const branches = Array.isArray(req.adminBranches) ? req.adminBranches : [];

      const hasAccess = branches.some((item) => {
        const itemBranchId = String(item?.branch || item?._id || '');

        return itemBranchId === cleanBranchId;
      });

      if (!hasAccess) {
        return reject(
          res,
          403,
          'FORBIDDEN',
          'No tienes acceso a esta sede.',
          {
            branchId: cleanBranchId,
          }
        );
      }

      return next();
    } catch (error) {
      console.error('[requirePermission.branchAccess] Error:', error.message);

      return reject(
        res,
        500,
        'BRANCH_PERMISSION_ERROR',
        'Error validando acceso a sede.'
      );
    }
  };
};

requirePermission.getEffectivePermissions = getEffectivePermissions;
requirePermission.normalizePermission = normalizePermission;

module.exports = requirePermission;