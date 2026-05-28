// backend/routes/adminUsers.js

const express = require('express');
const mongoose = require('mongoose');

const requireAdmin = require('../middleware/requireAdmin');
const requirePermission = require('../middleware/requirePermission');

const AdminUser = require('../models/AdminUser');
const AdminRole = require('../models/AdminRole');
const Branch = require('../models/Branch');

const router = express.Router();

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const VALID_SORT_FIELDS = new Set([
  'createdAt',
  'updatedAt',
  'username',
  'displayName',
  'email',
  'role',
  'status',
  'lastLoginAt',
]);

function cleanText(value, fallback = '') {
  const text = String(value || '').trim().replace(/\s+/g, ' ');
  return text || fallback;
}

function cleanLower(value, fallback = '') {
  return cleanText(value, fallback).toLowerCase();
}

function parseBoolean(value, fallback = null) {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return fallback;
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isValidObjectId(value) {
  return mongoose.Types.ObjectId.isValid(String(value || ''));
}

function toObjectId(value) {
  if (!isValidObjectId(value)) return null;
  return new mongoose.Types.ObjectId(String(value));
}

function parsePagination(query = {}) {
  const page = Math.max(Number(query.page || DEFAULT_PAGE), 1);
  const rawLimit = Math.max(Number(query.limit || DEFAULT_LIMIT), 1);
  const limit = Math.min(rawLimit, MAX_LIMIT);
  const skip = (page - 1) * limit;

  return {
    page,
    limit,
    skip,
  };
}

function parseSort(query = {}) {
  const rawSort = cleanText(query.sort || '-createdAt');

  let direction = -1;
  let field = rawSort;

  if (rawSort.startsWith('-')) {
    field = rawSort.slice(1);
    direction = -1;
  } else if (rawSort.startsWith('+')) {
    field = rawSort.slice(1);
    direction = 1;
  }

  if (!VALID_SORT_FIELDS.has(field)) {
    return { createdAt: -1 };
  }

  return { [field]: direction };
}

function normalizePermissions(input) {
  return AdminUser.normalizePermissions(input);
}

function getCurrentAdminId(req) {
  return req.adminUserId && isValidObjectId(req.adminUserId)
    ? toObjectId(req.adminUserId)
    : null;
}

function isOwnerRole(role) {
  return cleanLower(role) === 'owner';
}

function isCurrentAdminOwner(req) {
  return cleanLower(req.adminRole) === 'owner';
}

function buildUserPublicResponse(user) {
  if (!user) return null;

  if (typeof user.toSafeObject === 'function') {
    return user.toSafeObject();
  }

  const plain = user.toObject ? user.toObject({ virtuals: true }) : { ...user };

  delete plain.passwordHash;
  delete plain.twoFactorSecret;
  delete plain.failedLoginAttempts;
  delete plain.lockedUntil;
  delete plain.lastLoginIp;
  delete plain.lastUserAgent;
  delete plain.tokenVersion;
  delete plain.__v;

  return plain;
}

function sendError(res, status, message, extra = {}) {
  return res.status(status).json({
    ok: false,
    message,
    ...extra,
  });
}

async function countActiveOwners(excludeUserId = null) {
  const filter = {
    deletedAt: null,
    active: true,
    status: 'active',
    role: 'owner',
  };

  if (excludeUserId && isValidObjectId(excludeUserId)) {
    filter._id = { $ne: toObjectId(excludeUserId) };
  }

  return AdminUser.countDocuments(filter);
}

async function resolveRole({ role, roleRef }) {
  let roleDoc = null;

  if (roleRef && isValidObjectId(roleRef)) {
    roleDoc = await AdminRole.findOne({
      _id: roleRef,
      deletedAt: null,
      active: true,
      status: 'active',
    });
  }

  if (!roleDoc && role) {
    roleDoc = await AdminRole.findOne({
      code: cleanLower(role),
      deletedAt: null,
      active: true,
      status: 'active',
    });
  }

  if (!roleDoc) {
    roleDoc = await AdminRole.findOne({
      code: 'seller',
      deletedAt: null,
      active: true,
      status: 'active',
    });
  }

  return roleDoc;
}

async function getDefaultBranch() {
  return (
    (await Branch.findOne({
      deletedAt: null,
      active: true,
      status: 'active',
      isMain: true,
    })) ||
    (await Branch.findOne({
      deletedAt: null,
      active: true,
      status: 'active',
      code: 'PRINCIPAL',
    })) ||
    (await Branch.findOne({
      deletedAt: null,
      active: true,
      status: 'active',
    }))
  );
}

function normalizeBranchInput(input) {
  if (!input) return [];

  if (Array.isArray(input)) return input;

  return [input];
}

async function buildAssignedBranches(input, fallbackBranch = null) {
  const rawBranches = normalizeBranchInput(input);

  const branchIds = rawBranches
    .map((item) => {
      if (typeof item === 'string') return item;
      if (item?.branch) return item.branch;
      if (item?._id) return item._id;
      if (item?.id) return item.id;
      return '';
    })
    .filter((id) => isValidObjectId(id));

  let uniqueBranchIds = [...new Set(branchIds.map((id) => String(id)))];

  if (!uniqueBranchIds.length && fallbackBranch?._id) {
    uniqueBranchIds = [String(fallbackBranch._id)];
  }

  if (!uniqueBranchIds.length) return [];

  const branches = await Branch.find({
    _id: { $in: uniqueBranchIds.map((id) => toObjectId(id)) },
    deletedAt: null,
    active: true,
    status: 'active',
  }).lean();

  const branchMap = new Map(
    branches.map((branch) => [String(branch._id), branch])
  );

  const assigned = [];

  uniqueBranchIds.forEach((branchId, index) => {
    const branch = branchMap.get(String(branchId));

    if (!branch) return;

    const raw = rawBranches.find((item) => {
      const itemId =
        typeof item === 'string'
          ? item
          : item?.branch || item?._id || item?.id || '';

      return String(itemId) === String(branchId);
    });

    assigned.push({
      branch: branch._id,
      branchName: branch.name,
      branchCode: branch.code,
      isDefault: raw?.isDefault === true || index === 0,
      canSell: raw?.canSell !== false,
      canManageInventory: raw?.canManageInventory === true,
      canInvoice: raw?.canInvoice === true,
    });
  });

  if (assigned.length) {
    let hasDefault = false;

    assigned.forEach((item) => {
      if (item.isDefault && !hasDefault) {
        hasDefault = true;
      } else if (item.isDefault && hasDefault) {
        item.isDefault = false;
      }
    });

    if (!hasDefault) {
      assigned[0].isDefault = true;
    }
  }

  return assigned;
}

function getDefaultBranchFromAssigned(assignedBranches = []) {
  const selected =
    assignedBranches.find((item) => item.isDefault) || assignedBranches[0];

  return selected?.branch || null;
}

async function ensureCanManageTargetUser(req, targetUser, action = 'update') {
  if (!targetUser) {
    return {
      ok: false,
      status: 404,
      message: 'Usuario administrativo no encontrado.',
    };
  }

  const currentAdminId = String(req.adminUserId || '');
  const targetUserId = String(targetUser._id || '');

  if (action !== 'view' && currentAdminId && currentAdminId === targetUserId) {
    if (['disable', 'delete', 'change-role'].includes(action)) {
      return {
        ok: false,
        status: 400,
        message: 'No puedes aplicar esta acción sobre tu propio usuario.',
      };
    }
  }

  if (isOwnerRole(targetUser.role) && !isCurrentAdminOwner(req)) {
    return {
      ok: false,
      status: 403,
      message: 'Solo el propietario puede modificar otro usuario propietario.',
    };
  }

  return {
    ok: true,
  };
}

async function ensureNotLastOwner(targetUser) {
  if (!targetUser || !isOwnerRole(targetUser.role)) {
    return {
      ok: true,
    };
  }

  const ownersLeft = await countActiveOwners(targetUser._id);

  if (ownersLeft <= 0) {
    return {
      ok: false,
      status: 400,
      message: 'No puedes dejar el sistema sin un propietario activo.',
    };
  }

  return {
    ok: true,
  };
}

function buildListFilter(query = {}) {
  const filter = {
    deletedAt: null,
  };

  const q = cleanText(query.q || query.search || '');

  if (q) {
    const regex = new RegExp(escapeRegex(q), 'i');

    filter.$or = [
      { username: regex },
      { email: regex },
      { firstName: regex },
      { lastName: regex },
      { displayName: regex },
      { documentNumber: regex },
      { phone: regex },
    ];
  }

  const role = cleanLower(query.role || '');

  if (role && role !== 'all') {
    filter.role = role;
  }

  const status = cleanLower(query.status || '');

  if (status && status !== 'all') {
    filter.status = status;
  }

  const active = parseBoolean(query.active, null);

  if (active !== null) {
    filter.active = active;
  }

  const branchId = cleanText(query.branchId || '');

  if (branchId && isValidObjectId(branchId)) {
    filter['branches.branch'] = toObjectId(branchId);
  }

  return filter;
}

/* ============================
 * META
 * ============================ */

router.get(
  '/meta',
  requireAdmin,
  requirePermission('admin-users:view'),
  async (_req, res) => {
    try {
      const [roles, branches] = await Promise.all([
        AdminRole.find({
          deletedAt: null,
          active: true,
          status: 'active',
        })
          .sort({ level: 1, name: 1 })
          .lean(),

        Branch.find({
          deletedAt: null,
          active: true,
          status: 'active',
        })
          .sort({ isMain: -1, name: 1 })
          .lean(),
      ]);

      return res.json({
        ok: true,
        data: {
          roles,
          branches,
          permissions: AdminRole.getAvailablePermissions(),
          userRoles: AdminUser.getRoles(),
          userStatuses: AdminUser.getStatuses(),
        },
      });
    } catch (error) {
      console.error('❌ Error obteniendo meta admin users:', error.message);

      return sendError(res, 500, 'Error obteniendo información base.');
    }
  }
);

/* ============================
 * LISTAR USUARIOS
 * ============================ */

router.get(
  '/',
  requireAdmin,
  requirePermission('admin-users:view'),
  async (req, res) => {
    try {
      const filter = buildListFilter(req.query);
      const sort = parseSort(req.query);
      const { page, limit, skip } = parsePagination(req.query);

      const [total, users] = await Promise.all([
        AdminUser.countDocuments(filter),

        AdminUser.find(filter)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .populate('roleRef', 'name code level scope')
          .populate('defaultBranch', 'name code type')
          .lean({ virtuals: true }),
      ]);

      return res.json({
        ok: true,
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1),
        data: users,
      });
    } catch (error) {
      console.error('❌ Error listando usuarios admin:', error.message);

      return sendError(res, 500, 'Error listando usuarios administrativos.');
    }
  }
);

/* ============================
 * DETALLE DE USUARIO
 * ============================ */

router.get(
  '/:id',
  requireAdmin,
  requirePermission('admin-users:view'),
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!isValidObjectId(id)) {
        return sendError(res, 400, 'ID de usuario inválido.');
      }

      const user = await AdminUser.findOne({
        _id: toObjectId(id),
        deletedAt: null,
      })
        .populate('roleRef', 'name code level scope permissions')
        .populate('defaultBranch', 'name code type')
        .lean({ virtuals: true });

      if (!user) {
        return sendError(res, 404, 'Usuario administrativo no encontrado.');
      }

      return res.json({
        ok: true,
        data: user,
      });
    } catch (error) {
      console.error('❌ Error obteniendo usuario admin:', error.message);

      return sendError(res, 500, 'Error obteniendo usuario administrativo.');
    }
  }
);

/* ============================
 * CREAR USUARIO
 * ============================ */

router.post(
  '/',
  requireAdmin,
  requirePermission('admin-users:create'),
  async (req, res) => {
    try {
      const body = req.body || {};

      const username = cleanLower(body.username);
      const email = cleanLower(body.email);

      if (!username) {
        return sendError(res, 400, 'El usuario es obligatorio.');
      }

      if (!body.password) {
        return sendError(res, 400, 'La contraseña inicial es obligatoria.');
      }

      const roleDoc = await resolveRole({
        role: body.role || 'seller',
        roleRef: body.roleRef,
      });

      if (!roleDoc) {
        return sendError(res, 400, 'Rol administrativo inválido.');
      }

      if (isOwnerRole(roleDoc.code) && !isCurrentAdminOwner(req)) {
        return sendError(
          res,
          403,
          'Solo el propietario puede crear usuarios propietarios.'
        );
      }

      const duplicatedUser = await AdminUser.findOne({
        deletedAt: null,
        $or: [
          { username },
          ...(email ? [{ email }] : []),
        ],
      }).lean();

      if (duplicatedUser) {
        return sendError(
          res,
          409,
          'Ya existe un usuario administrativo con ese usuario o correo.'
        );
      }

      const fallbackBranch = await getDefaultBranch();
      const assignedBranches = await buildAssignedBranches(
        body.branches || body.branchIds || body.defaultBranch,
        fallbackBranch
      );

      const user = new AdminUser({
        firstName: cleanText(body.firstName),
        lastName: cleanText(body.lastName),
        displayName: cleanText(body.displayName),
        username,
        email,
        phone: cleanText(body.phone),
        documentType: cleanText(body.documentType).toUpperCase(),
        documentNumber: cleanText(body.documentNumber),

        role: roleDoc.code,
        roleRef: roleDoc._id,
        permissions:
          Array.isArray(body.permissions) && body.permissions.length
            ? normalizePermissions(body.permissions)
            : normalizePermissions(roleDoc.permissions || []),

        branches: assignedBranches,
        defaultBranch: getDefaultBranchFromAssigned(assignedBranches),

        status: cleanLower(body.status || 'active'),
        active: body.active !== false,

        mustChangePassword: body.mustChangePassword !== false,
        emailVerified: body.emailVerified === true,

        notes: cleanText(body.notes),
        createdBy: getCurrentAdminId(req),
        updatedBy: getCurrentAdminId(req),
      });

      await user.setPassword(body.password);

      user.mustChangePassword = body.mustChangePassword !== false;

      await user.save();

      return res.status(201).json({
        ok: true,
        message: 'Usuario administrativo creado correctamente.',
        data: buildUserPublicResponse(user),
      });
    } catch (error) {
      console.error('❌ Error creando usuario admin:', error.message);

      if (error?.code === 11000) {
        return sendError(
          res,
          409,
          'Ya existe un usuario administrativo con esos datos.'
        );
      }

      return sendError(
        res,
        500,
        error.message || 'Error creando usuario administrativo.'
      );
    }
  }
);

/* ============================
 * ACTUALIZAR USUARIO
 * ============================ */

router.put(
  '/:id',
  requireAdmin,
  requirePermission('admin-users:update'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const body = req.body || {};

      if (!isValidObjectId(id)) {
        return sendError(res, 400, 'ID de usuario inválido.');
      }

      const user = await AdminUser.findOne({
        _id: toObjectId(id),
        deletedAt: null,
      });

      const allowed = await ensureCanManageTargetUser(req, user, 'update');

      if (!allowed.ok) {
        return sendError(res, allowed.status, allowed.message);
      }

      const requestedRole = body.role || body.roleRef ? body.role : null;
      const requestedRoleRef = body.roleRef || null;

      let roleDoc = null;
      let roleChanged = false;

      if (requestedRole || requestedRoleRef) {
        roleDoc = await resolveRole({
          role: requestedRole || user.role,
          roleRef: requestedRoleRef,
        });

        if (!roleDoc) {
          return sendError(res, 400, 'Rol administrativo inválido.');
        }

        if (isOwnerRole(roleDoc.code) && !isCurrentAdminOwner(req)) {
          return sendError(
            res,
            403,
            'Solo el propietario puede asignar el rol propietario.'
          );
        }

        if (String(roleDoc.code) !== String(user.role)) {
          const roleAllowed = await ensureCanManageTargetUser(
            req,
            user,
            'change-role'
          );

          if (!roleAllowed.ok) {
            return sendError(res, roleAllowed.status, roleAllowed.message);
          }

          const lastOwnerCheck = await ensureNotLastOwner(user);

          if (!lastOwnerCheck.ok) {
            return sendError(
              res,
              lastOwnerCheck.status,
              lastOwnerCheck.message
            );
          }

          roleChanged = true;
        }
      }

      if (body.username !== undefined) {
        const username = cleanLower(body.username);

        if (!username) {
          return sendError(res, 400, 'El usuario no puede quedar vacío.');
        }

        user.username = username;
      }

      if (body.email !== undefined) {
        user.email = cleanLower(body.email);
      }

      user.firstName =
        body.firstName !== undefined ? cleanText(body.firstName) : user.firstName;

      user.lastName =
        body.lastName !== undefined ? cleanText(body.lastName) : user.lastName;

      user.displayName =
        body.displayName !== undefined
          ? cleanText(body.displayName)
          : user.displayName;

      user.phone =
        body.phone !== undefined ? cleanText(body.phone) : user.phone;

      user.documentType =
        body.documentType !== undefined
          ? cleanText(body.documentType).toUpperCase()
          : user.documentType;

      user.documentNumber =
        body.documentNumber !== undefined
          ? cleanText(body.documentNumber)
          : user.documentNumber;

      user.notes =
        body.notes !== undefined ? cleanText(body.notes) : user.notes;

      if (roleDoc) {
        user.role = roleDoc.code;
        user.roleRef = roleDoc._id;

        if (roleChanged && body.permissions === undefined) {
          user.permissions = normalizePermissions(roleDoc.permissions || []);
        }
      }

      if (body.permissions !== undefined) {
        user.permissions = normalizePermissions(body.permissions);
      }

      if (
        body.branches !== undefined ||
        body.branchIds !== undefined ||
        body.defaultBranch !== undefined
      ) {
        const fallbackBranch = await getDefaultBranch();

        const assignedBranches = await buildAssignedBranches(
          body.branches || body.branchIds || body.defaultBranch,
          fallbackBranch
        );

        user.branches = assignedBranches;
        user.defaultBranch = getDefaultBranchFromAssigned(assignedBranches);
      }

      if (body.status !== undefined || body.active !== undefined) {
        const statusAction =
          body.active === false || cleanLower(body.status) !== 'active'
            ? 'disable'
            : 'update';

        const statusAllowed = await ensureCanManageTargetUser(
          req,
          user,
          statusAction
        );

        if (!statusAllowed.ok) {
          return sendError(res, statusAllowed.status, statusAllowed.message);
        }

        if (body.active === false || cleanLower(body.status) !== 'active') {
          const lastOwnerCheck = await ensureNotLastOwner(user);

          if (!lastOwnerCheck.ok) {
            return sendError(
              res,
              lastOwnerCheck.status,
              lastOwnerCheck.message
            );
          }
        }

        if (body.status !== undefined) {
          user.status = cleanLower(body.status);
        }

        if (body.active !== undefined) {
          user.active = body.active === true;
        }
      }

      user.emailVerified =
        body.emailVerified !== undefined
          ? body.emailVerified === true
          : user.emailVerified;

      user.mustChangePassword =
        body.mustChangePassword !== undefined
          ? body.mustChangePassword === true
          : user.mustChangePassword;

      user.updatedBy = getCurrentAdminId(req);

      await user.save();

      const savedUser = await AdminUser.findById(user._id)
        .populate('roleRef', 'name code level scope')
        .populate('defaultBranch', 'name code type');

      return res.json({
        ok: true,
        message: 'Usuario administrativo actualizado correctamente.',
        data: buildUserPublicResponse(savedUser),
      });
    } catch (error) {
      console.error('❌ Error actualizando usuario admin:', error.message);

      if (error?.code === 11000) {
        return sendError(
          res,
          409,
          'Ya existe un usuario administrativo con ese usuario o correo.'
        );
      }

      return sendError(
        res,
        500,
        error.message || 'Error actualizando usuario administrativo.'
      );
    }
  }
);

/* ============================
 * CAMBIAR ESTADO
 * ============================ */

router.patch(
  '/:id/status',
  requireAdmin,
  requirePermission('admin-users:disable'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { status, active } = req.body || {};

      if (!isValidObjectId(id)) {
        return sendError(res, 400, 'ID de usuario inválido.');
      }

      const user = await AdminUser.findOne({
        _id: toObjectId(id),
        deletedAt: null,
      });

      const allowed = await ensureCanManageTargetUser(req, user, 'disable');

      if (!allowed.ok) {
        return sendError(res, allowed.status, allowed.message);
      }

      const lastOwnerCheck = await ensureNotLastOwner(user);

      if (!lastOwnerCheck.ok) {
        return sendError(res, lastOwnerCheck.status, lastOwnerCheck.message);
      }

      if (status !== undefined) {
        user.status = cleanLower(status);
      }

      if (active !== undefined) {
        user.active = active === true;
      }

      user.updatedBy = getCurrentAdminId(req);

      await user.invalidateSessions();
      await user.save();

      return res.json({
        ok: true,
        message: 'Estado del usuario actualizado correctamente.',
        data: buildUserPublicResponse(user),
      });
    } catch (error) {
      console.error('❌ Error cambiando estado usuario admin:', error.message);

      return sendError(
        res,
        500,
        error.message || 'Error cambiando estado del usuario.'
      );
    }
  }
);

/* ============================
 * RESETEAR CONTRASEÑA
 * ============================ */

router.patch(
  '/:id/password',
  requireAdmin,
  requirePermission('admin-users:update'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { password, mustChangePassword = true } = req.body || {};

      if (!isValidObjectId(id)) {
        return sendError(res, 400, 'ID de usuario inválido.');
      }

      if (!password) {
        return sendError(res, 400, 'La nueva contraseña es obligatoria.');
      }

      const user = await AdminUser.findOne({
        _id: toObjectId(id),
        deletedAt: null,
      }).select('+tokenVersion');

      const allowed = await ensureCanManageTargetUser(req, user, 'update');

      if (!allowed.ok) {
        return sendError(res, allowed.status, allowed.message);
      }

      await user.setPassword(password);

      user.mustChangePassword = mustChangePassword === true;
      user.updatedBy = getCurrentAdminId(req);

      await user.save();

      return res.json({
        ok: true,
        message: 'Contraseña actualizada correctamente.',
        data: buildUserPublicResponse(user),
      });
    } catch (error) {
      console.error('❌ Error reseteando contraseña admin:', error.message);

      return sendError(
        res,
        500,
        error.message || 'Error actualizando contraseña.'
      );
    }
  }
);

/* ============================
 * ELIMINAR USUARIO
 * ============================ */

router.delete(
  '/:id',
  requireAdmin,
  requirePermission('admin-users:disable'),
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!isValidObjectId(id)) {
        return sendError(res, 400, 'ID de usuario inválido.');
      }

      const user = await AdminUser.findOne({
        _id: toObjectId(id),
        deletedAt: null,
      }).select('+tokenVersion');

      const allowed = await ensureCanManageTargetUser(req, user, 'delete');

      if (!allowed.ok) {
        return sendError(res, allowed.status, allowed.message);
      }

      const lastOwnerCheck = await ensureNotLastOwner(user);

      if (!lastOwnerCheck.ok) {
        return sendError(res, lastOwnerCheck.status, lastOwnerCheck.message);
      }

      user.deletedAt = new Date();
      user.deletedBy = getCurrentAdminId(req);
      user.active = false;
      user.status = 'inactive';
      user.updatedBy = getCurrentAdminId(req);

      await user.invalidateSessions();
      await user.save();

      return res.json({
        ok: true,
        message: 'Usuario administrativo eliminado correctamente.',
      });
    } catch (error) {
      console.error('❌ Error eliminando usuario admin:', error.message);

      return sendError(
        res,
        500,
        error.message || 'Error eliminando usuario administrativo.'
      );
    }
  }
);

module.exports = router;