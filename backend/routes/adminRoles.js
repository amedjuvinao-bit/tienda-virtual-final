// backend/routes/adminRoles.js

const express = require('express');
const mongoose = require('mongoose');

const requireAdmin = require('../middleware/requireAdmin');
const requirePermission = require('../middleware/requirePermission');

const AdminRole = require('../models/AdminRole');
const AdminUser = require('../models/AdminUser');

const router = express.Router();

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const VALID_SORT_FIELDS = new Set([
  'createdAt',
  'updatedAt',
  'name',
  'code',
  'level',
  'scope',
  'status',
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

function getCurrentAdminId(req) {
  return req.adminUserId && isValidObjectId(req.adminUserId)
    ? toObjectId(req.adminUserId)
    : null;
}

function isCurrentAdminOwner(req) {
  return cleanLower(req.adminRole) === 'owner';
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
  const rawSort = cleanText(query.sort || 'level');

  let direction = 1;
  let field = rawSort;

  if (rawSort.startsWith('-')) {
    field = rawSort.slice(1);
    direction = -1;
  } else if (rawSort.startsWith('+')) {
    field = rawSort.slice(1);
    direction = 1;
  }

  if (!VALID_SORT_FIELDS.has(field)) {
    return { level: 1, name: 1 };
  }

  return { [field]: direction, name: 1 };
}

function sendError(res, status, message, extra = {}) {
  return res.status(status).json({
    ok: false,
    message,
    ...extra,
  });
}

function normalizePermissions(input) {
  return AdminRole.normalizePermissions(input);
}

function normalizeRoleCode(input) {
  return AdminRole.normalizeCode(input);
}

function buildListFilter(query = {}) {
  const filter = {
    deletedAt: null,
  };

  const q = cleanText(query.q || query.search || '');

  if (q) {
    const regex = new RegExp(escapeRegex(q), 'i');

    filter.$or = [
      { name: regex },
      { code: regex },
      { description: regex },
      { notes: regex },
    ];
  }

  const scope = cleanLower(query.scope || '');

  if (scope && scope !== 'all') {
    filter.scope = scope;
  }

  const status = cleanLower(query.status || '');

  if (status && status !== 'all') {
    filter.status = status;
  }

  const active = parseBoolean(query.active, null);

  if (active !== null) {
    filter.active = active;
  }

  const isSystem = parseBoolean(query.isSystem, null);

  if (isSystem !== null) {
    filter.isSystem = isSystem;
  }

  const isDefault = parseBoolean(query.isDefault, null);

  if (isDefault !== null) {
    filter.isDefault = isDefault;
  }

  return filter;
}

function buildRolePublicResponse(role) {
  if (!role) return null;

  if (typeof role.toSafeObject === 'function') {
    return role.toSafeObject();
  }

  const plain = role.toObject ? role.toObject({ virtuals: true }) : { ...role };

  delete plain.__v;

  return plain;
}

async function countUsersWithRole(roleIdOrCode) {
  const filter = {
    deletedAt: null,
  };

  if (isValidObjectId(roleIdOrCode)) {
    filter.roleRef = toObjectId(roleIdOrCode);
  } else {
    filter.role = cleanLower(roleIdOrCode);
  }

  return AdminUser.countDocuments(filter);
}

async function ensureCanManageRole(req, role, action = 'update') {
  if (!role) {
    return {
      ok: false,
      status: 404,
      message: 'Rol administrativo no encontrado.',
    };
  }

  const isOwner = isCurrentAdminOwner(req);
  const targetCode = cleanLower(role.code);

  if (targetCode === 'owner' && !isOwner) {
    return {
      ok: false,
      status: 403,
      message: 'Solo el propietario puede modificar el rol Propietario.',
    };
  }

  if (role.isSystem && !isOwner) {
    return {
      ok: false,
      status: 403,
      message: 'Solo el propietario puede modificar roles del sistema.',
    };
  }

  if (action === 'delete' && role.isSystem) {
    return {
      ok: false,
      status: 400,
      message: 'Los roles del sistema no se pueden eliminar.',
    };
  }

  if (action === 'disable' && role.isDefault) {
    return {
      ok: false,
      status: 400,
      message: 'No se puede desactivar el rol predeterminado.',
    };
  }

  return {
    ok: true,
  };
}

async function ensureRoleCanBeDisabledOrDeleted(role) {
  const usersCount = await countUsersWithRole(role._id);

  if (usersCount > 0) {
    return {
      ok: false,
      status: 400,
      message:
        'No puedes desactivar o eliminar este rol porque tiene usuarios asignados.',
      usersCount,
    };
  }

  return {
    ok: true,
  };
}

function validateRolePayload(body = {}, { isCreate = false } = {}) {
  const errors = [];

  const name = cleanText(body.name);
  const code = normalizeRoleCode(body.code || body.name);

  if (isCreate && !name) {
    errors.push('El nombre del rol es obligatorio.');
  }

  if (isCreate && !code) {
    errors.push('El código del rol es obligatorio.');
  }

  if (code && code.length < 2) {
    errors.push('El código del rol debe tener mínimo 2 caracteres.');
  }

  if (code && !/^[a-z0-9._-]+$/.test(code)) {
    errors.push(
      'El código del rol solo puede contener letras, números, punto, guion y guion bajo.'
    );
  }

  if (body.level !== undefined) {
    const level = Number(body.level);

    if (!Number.isFinite(level) || level < 1 || level > 100) {
      errors.push('El nivel del rol debe estar entre 1 y 100.');
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

/* ============================
 * META
 * ============================ */

router.get(
  '/meta',
  requireAdmin,
  requirePermission('roles:view'),
  async (_req, res) => {
    try {
      return res.json({
        ok: true,
        data: {
          permissions: AdminRole.getAvailablePermissions(),
          scopes: ['global', 'branch', 'own'],
          statuses: ['active', 'inactive'],
        },
      });
    } catch (error) {
      console.error('❌ Error obteniendo meta roles:', error.message);

      return sendError(res, 500, 'Error obteniendo información base de roles.');
    }
  }
);

/* ============================
 * LISTAR ROLES
 * ============================ */

router.get(
  '/',
  requireAdmin,
  requirePermission('roles:view'),
  async (req, res) => {
    try {
      const filter = buildListFilter(req.query);
      const sort = parseSort(req.query);
      const { page, limit, skip } = parsePagination(req.query);

      const [total, roles] = await Promise.all([
        AdminRole.countDocuments(filter),

        AdminRole.find(filter)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean({ virtuals: true }),
      ]);

      return res.json({
        ok: true,
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1),
        data: roles,
      });
    } catch (error) {
      console.error('❌ Error listando roles admin:', error.message);

      return sendError(res, 500, 'Error listando roles administrativos.');
    }
  }
);

/* ============================
 * DETALLE DE ROL
 * ============================ */

router.get(
  '/:id',
  requireAdmin,
  requirePermission('roles:view'),
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!isValidObjectId(id)) {
        return sendError(res, 400, 'ID de rol inválido.');
      }

      const role = await AdminRole.findOne({
        _id: toObjectId(id),
        deletedAt: null,
      }).lean({ virtuals: true });

      if (!role) {
        return sendError(res, 404, 'Rol administrativo no encontrado.');
      }

      const usersCount = await countUsersWithRole(role._id);

      return res.json({
        ok: true,
        data: {
          ...role,
          usersCount,
        },
      });
    } catch (error) {
      console.error('❌ Error obteniendo rol admin:', error.message);

      return sendError(res, 500, 'Error obteniendo rol administrativo.');
    }
  }
);

/* ============================
 * CREAR ROL
 * ============================ */

router.post(
  '/',
  requireAdmin,
  requirePermission('roles:create'),
  async (req, res) => {
    try {
      const body = req.body || {};

      const validation = validateRolePayload(body, { isCreate: true });

      if (!validation.ok) {
        return sendError(res, 400, 'Datos inválidos para crear el rol.', {
          errors: validation.errors,
        });
      }

      const code = normalizeRoleCode(body.code || body.name);

      const duplicatedRole = await AdminRole.findOne({
        deletedAt: null,
        code,
      }).lean();

      if (duplicatedRole) {
        return sendError(res, 409, 'Ya existe un rol con ese código.');
      }

      const permissions = normalizePermissions(body.permissions || []);

      const role = new AdminRole({
        name: cleanText(body.name),
        code,
        description: cleanText(body.description),
        permissions,
        scope: cleanLower(body.scope || 'branch'),
        level: Number(body.level || 50),
        status: cleanLower(body.status || 'active'),
        active: body.active !== false,
        isSystem: false,
        isDefault: body.isDefault === true,
        color: cleanText(body.color),
        icon: cleanText(body.icon),
        notes: cleanText(body.notes),
        createdBy: getCurrentAdminId(req),
        updatedBy: getCurrentAdminId(req),
      });

      if (role.isDefault) {
        await AdminRole.updateMany(
          {
            deletedAt: null,
            isDefault: true,
          },
          {
            $set: {
              isDefault: false,
            },
          }
        );
      }

      await role.save();

      return res.status(201).json({
        ok: true,
        message: 'Rol administrativo creado correctamente.',
        data: buildRolePublicResponse(role),
      });
    } catch (error) {
      console.error('❌ Error creando rol admin:', error.message);

      if (error?.code === 11000) {
        return sendError(res, 409, 'Ya existe un rol con ese código.');
      }

      return sendError(res, 500, error.message || 'Error creando rol.');
    }
  }
);

/* ============================
 * ACTUALIZAR ROL
 * ============================ */

router.put(
  '/:id',
  requireAdmin,
  requirePermission('roles:update'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const body = req.body || {};

      if (!isValidObjectId(id)) {
        return sendError(res, 400, 'ID de rol inválido.');
      }

      const role = await AdminRole.findOne({
        _id: toObjectId(id),
        deletedAt: null,
      });

      const allowed = await ensureCanManageRole(req, role, 'update');

      if (!allowed.ok) {
        return sendError(res, allowed.status, allowed.message);
      }

      const validation = validateRolePayload(body, { isCreate: false });

      if (!validation.ok) {
        return sendError(res, 400, 'Datos inválidos para actualizar el rol.', {
          errors: validation.errors,
        });
      }

      if (body.code !== undefined) {
        if (role.isSystem) {
          return sendError(
            res,
            400,
            'No se puede cambiar el código de un rol del sistema.'
          );
        }

        const newCode = normalizeRoleCode(body.code);

        const duplicatedRole = await AdminRole.findOne({
          _id: { $ne: role._id },
          deletedAt: null,
          code: newCode,
        }).lean();

        if (duplicatedRole) {
          return sendError(res, 409, 'Ya existe otro rol con ese código.');
        }

        role.code = newCode;
      }

      if (body.name !== undefined) {
        role.name = cleanText(body.name);
      }

      if (body.description !== undefined) {
        role.description = cleanText(body.description);
      }

      if (body.permissions !== undefined) {
        role.permissions = normalizePermissions(body.permissions);
      }

      if (body.scope !== undefined) {
        role.scope = cleanLower(body.scope);
      }

      if (body.level !== undefined) {
        role.level = Number(body.level);
      }

      if (body.status !== undefined || body.active !== undefined) {
        const action =
          body.active === false || cleanLower(body.status) !== 'active'
            ? 'disable'
            : 'update';

        const statusAllowed = await ensureCanManageRole(req, role, action);

        if (!statusAllowed.ok) {
          return sendError(
            res,
            statusAllowed.status,
            statusAllowed.message
          );
        }

        if (body.active === false || cleanLower(body.status) !== 'active') {
          const usageAllowed = await ensureRoleCanBeDisabledOrDeleted(role);

          if (!usageAllowed.ok) {
            return sendError(res, usageAllowed.status, usageAllowed.message, {
              usersCount: usageAllowed.usersCount,
            });
          }
        }

        if (body.status !== undefined) {
          role.status = cleanLower(body.status);
        }

        if (body.active !== undefined) {
          role.active = body.active === true;
        }
      }

      if (body.isDefault !== undefined) {
        role.isDefault = body.isDefault === true;

        if (role.isDefault) {
          await AdminRole.updateMany(
            {
              _id: { $ne: role._id },
              deletedAt: null,
              isDefault: true,
            },
            {
              $set: {
                isDefault: false,
              },
            }
          );
        }
      }

      if (body.color !== undefined) {
        role.color = cleanText(body.color);
      }

      if (body.icon !== undefined) {
        role.icon = cleanText(body.icon);
      }

      if (body.notes !== undefined) {
        role.notes = cleanText(body.notes);
      }

      role.updatedBy = getCurrentAdminId(req);

      await role.save();

      return res.json({
        ok: true,
        message: 'Rol administrativo actualizado correctamente.',
        data: buildRolePublicResponse(role),
      });
    } catch (error) {
      console.error('❌ Error actualizando rol admin:', error.message);

      if (error?.code === 11000) {
        return sendError(res, 409, 'Ya existe otro rol con ese código.');
      }

      return sendError(res, 500, error.message || 'Error actualizando rol.');
    }
  }
);

/* ============================
 * CAMBIAR ESTADO
 * ============================ */

router.patch(
  '/:id/status',
  requireAdmin,
  requirePermission('roles:disable'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { status, active } = req.body || {};

      if (!isValidObjectId(id)) {
        return sendError(res, 400, 'ID de rol inválido.');
      }

      const role = await AdminRole.findOne({
        _id: toObjectId(id),
        deletedAt: null,
      });

      const allowed = await ensureCanManageRole(req, role, 'disable');

      if (!allowed.ok) {
        return sendError(res, allowed.status, allowed.message);
      }

      const usageAllowed = await ensureRoleCanBeDisabledOrDeleted(role);

      if (!usageAllowed.ok) {
        return sendError(res, usageAllowed.status, usageAllowed.message, {
          usersCount: usageAllowed.usersCount,
        });
      }

      if (status !== undefined) {
        role.status = cleanLower(status);
      }

      if (active !== undefined) {
        role.active = active === true;
      }

      role.updatedBy = getCurrentAdminId(req);

      await role.save();

      return res.json({
        ok: true,
        message: 'Estado del rol actualizado correctamente.',
        data: buildRolePublicResponse(role),
      });
    } catch (error) {
      console.error('❌ Error cambiando estado rol admin:', error.message);

      return sendError(
        res,
        500,
        error.message || 'Error cambiando estado del rol.'
      );
    }
  }
);

/* ============================
 * ELIMINAR ROL
 * ============================ */

router.delete(
  '/:id',
  requireAdmin,
  requirePermission('roles:disable'),
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!isValidObjectId(id)) {
        return sendError(res, 400, 'ID de rol inválido.');
      }

      const role = await AdminRole.findOne({
        _id: toObjectId(id),
        deletedAt: null,
      });

      const allowed = await ensureCanManageRole(req, role, 'delete');

      if (!allowed.ok) {
        return sendError(res, allowed.status, allowed.message);
      }

      const usageAllowed = await ensureRoleCanBeDisabledOrDeleted(role);

      if (!usageAllowed.ok) {
        return sendError(res, usageAllowed.status, usageAllowed.message, {
          usersCount: usageAllowed.usersCount,
        });
      }

      role.deletedAt = new Date();
      role.deletedBy = getCurrentAdminId(req);
      role.active = false;
      role.status = 'inactive';
      role.updatedBy = getCurrentAdminId(req);

      await role.save();

      return res.json({
        ok: true,
        message: 'Rol administrativo eliminado correctamente.',
      });
    } catch (error) {
      console.error('❌ Error eliminando rol admin:', error.message);

      return sendError(res, 500, error.message || 'Error eliminando rol.');
    }
  }
);

module.exports = router;