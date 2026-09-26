// backend/routes/adminUsers.js

const express = require('express');
const mongoose = require('mongoose');

const requireAdmin = require('../middleware/requireAdmin');
const requirePermission = require('../middleware/requirePermission');

const AdminAuditLog = require('../models/AdminAuditLog');
const AdminUser = require('../models/AdminUser');
const AdminRole = require('../models/AdminRole');
const Branch = require('../models/Branch');
const { saveRemovingOwner } = require('../security/adminLastOwnerGuard');
const {
  revokeAllUserSessions,
  revokeOtherUserSessions,
} = require('../security/adminSessionService');
const {
  decryptTwoFactorSecret,
  hashRecoveryCode,
  verifyTotp,
} = require('../security/adminTwoFactorCrypto');
const {
  buildTwoFactorPolicy,
} = require('../security/adminTwoFactorPolicy');
const {
  recordTwoFactorChangeAlert,
} = require('../security/adminSecurityAlertService');
const {
  requiredUserWritePermissions,
  canGrantRole,
  canAssignBranches,
  canAccessUserScope,
} = require('../security/adminUserWritePolicy');

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

function resolveUserStatus(body = {}) {
  const hasStatus = body.status !== undefined;
  const hasActive = body.active !== undefined;
  if (!hasStatus && !hasActive) return null;
  if (hasActive && typeof body.active !== 'boolean') {
    throw Object.assign(new Error('El estado de acceso no es válido.'), { status: 400 });
  }
  const status = hasStatus ? cleanLower(body.status) :
    body.active ? 'active' : 'inactive';
  if (!AdminUser.getStatuses().includes(status)) {
    throw Object.assign(new Error('Selecciona un estado de usuario válido.'), { status: 400 });
  }
  const active = status === 'active';
  if (hasActive && body.active !== active) {
    throw Object.assign(new Error('El estado y el acceso deben coincidir.'), { status: 400 });
  }
  return { status, active };
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
  const requestedPage = Number(query.page);
  const requestedLimit = Number(query.limit);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0
    ? requestedPage : DEFAULT_PAGE;
  const rawLimit = Number.isSafeInteger(requestedLimit) && requestedLimit > 0
    ? requestedLimit : DEFAULT_LIMIT;
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

function buildUserSecurityResponse(user) {
  const plain = buildUserPublicResponse(user);
  const policy = buildTwoFactorPolicy(user);
  return {
    ...plain,
    twoFactorEnabled: Boolean(user?.twoFactorEnabled),
    twoFactorRequired: policy.required,
    twoFactorSetupRequired: !policy.compliant,
    twoFactorRequirement: policy.requirement,
    twoFactorRequirementSource: policy.requirementSource,
  };
}

function sendError(res, status, message, extra = {}) {
  return res.status(status).json({
    ok: false,
    message,
    ...extra,
  });
}

const OWNER_TWO_FACTOR_MAX_ATTEMPTS = 5;
const OWNER_TWO_FACTOR_LOCK_MS = 10 * 60 * 1000;

function getClientIp(req) {
  return String(
    req.headers['x-forwarded-for'] || req.ip || req.socket?.remoteAddress || ''
  )
    .split(',')[0]
    .trim()
    .slice(0, 80);
}

function getUserAgent(req) {
  return String(req.headers['user-agent'] || '').trim().slice(0, 500);
}

async function saveOwnerTwoFactorAudit(req, actor, target, {
  action,
  success,
  description,
  reason = '',
  recoveryCodeUsed = false,
  statusCode = success ? 200 : 400,
}) {
  try {
    const audit = await AdminAuditLog.create({
      action,
      permission: 'seguridad:2fa:owner',
      module: 'seguridad',
      description,
      method: req.method,
      path: req.originalUrl || req.path,
      routePattern: req.route?.path || '',
      resourceId: String(target?._id || req.params?.id || ''),
      adminUserId: actor?._id || null,
      adminUsername: actor?.username || req.adminUsername || '',
      adminRole: actor?.role || req.adminRole || '',
      statusCode,
      success,
      ip: getClientIp(req),
      userAgent: getUserAgent(req),
      requestId: String(req.headers['x-request-id'] || '').slice(0, 120),
      metadata: {
        targetUserId: String(target?._id || req.params?.id || ''),
        targetUsername: target?.username || '',
        reason: cleanText(reason).slice(0, 500),
        recoveryCodeUsed,
      },
    });
    await recordTwoFactorChangeAlert({ audit, adminUser: target });
  } catch (error) {
    console.error('❌ Error guardando auditoría owner 2FA:', error.message);
  }
}

function getOwnerTwoFactorLock(owner) {
  const lockedUntil = owner?.twoFactorManagementLockedUntil;
  if (!lockedUntil || new Date(lockedUntil).getTime() <= Date.now()) return null;
  return Math.max(1, Math.ceil((new Date(lockedUntil).getTime() - Date.now()) / 1000));
}

async function registerOwnerTwoFactorFailure(owner) {
  owner.twoFactorManagementFailedAttempts =
    Number(owner.twoFactorManagementFailedAttempts || 0) + 1;
  if (owner.twoFactorManagementFailedAttempts >= OWNER_TWO_FACTOR_MAX_ATTEMPTS) {
    owner.twoFactorManagementLockedUntil = new Date(
      Date.now() + OWNER_TWO_FACTOR_LOCK_MS
    );
  }
  await owner.save({ validateBeforeSave: false });
  return getOwnerTwoFactorLock(owner);
}

async function clearOwnerTwoFactorFailures(owner) {
  if (
    Number(owner.twoFactorManagementFailedAttempts || 0) === 0 &&
    !owner.twoFactorManagementLockedUntil
  ) {
    return;
  }
  owner.twoFactorManagementFailedAttempts = 0;
  owner.twoFactorManagementLockedUntil = null;
  await owner.save({ validateBeforeSave: false });
}

async function verifyOwnerTwoFactorCredentials(owner, { currentPassword, code }) {
  const retryAfterSeconds = getOwnerTwoFactorLock(owner);
  if (retryAfterSeconds) {
    return { ok: false, retryAfterSeconds, reason: 'management_locked' };
  }

  if (!currentPassword || !(await owner.comparePassword(currentPassword))) {
    const retryAfter = await registerOwnerTwoFactorFailure(owner);
    return { ok: false, retryAfterSeconds: retryAfter, reason: 'invalid_password' };
  }

  if (!owner.twoFactorEnabled || !owner.twoFactorSecret) {
    await clearOwnerTwoFactorFailures(owner);
    return { ok: true, recoveryCodeUsed: false, twoFactorVerified: false };
  }

  let secret;
  try {
    secret = decryptTwoFactorSecret(owner.twoFactorSecret);
  } catch {
    return { ok: false, reason: 'invalid_secret' };
  }

  if (verifyTotp(secret, code)) {
    await clearOwnerTwoFactorFailures(owner);
    return { ok: true, recoveryCodeUsed: false, twoFactorVerified: true };
  }

  const recoveryHash = hashRecoveryCode(code);
  const hasRecoveryCode =
    recoveryHash &&
    (owner.twoFactorRecoveryCodeHashes || []).includes(recoveryHash);
  if (!hasRecoveryCode) {
    const retryAfter = await registerOwnerTwoFactorFailure(owner);
    return { ok: false, retryAfterSeconds: retryAfter, reason: 'invalid_code' };
  }

  await clearOwnerTwoFactorFailures(owner);
  const update = await AdminUser.updateOne(
    { _id: owner._id, twoFactorRecoveryCodeHashes: recoveryHash },
    {
      $pull: { twoFactorRecoveryCodeHashes: recoveryHash },
      $set: { twoFactorLastUsedAt: new Date() },
    }
  );
  if (!update.modifiedCount) {
    return { ok: false, reason: 'recovery_code_used' };
  }

  return { ok: true, recoveryCodeUsed: true, twoFactorVerified: true };
}

function clearUserTwoFactor(targetUser) {
  targetUser.twoFactorEnabled = false;
  targetUser.twoFactorSecret = '';
  targetUser.twoFactorPendingSecret = '';
  targetUser.twoFactorPendingExpiresAt = null;
  targetUser.twoFactorPendingAttempts = 0;
  targetUser.twoFactorRecoveryCodeHashes = [];
  targetUser.twoFactorEnabledAt = null;
  targetUser.twoFactorLastUsedAt = null;
  targetUser.twoFactorManagementFailedAttempts = 0;
  targetUser.twoFactorManagementLockedUntil = null;
}

async function setTemporaryPassword(
  user,
  password,
  { mustChangePassword = true } = {}
) {
  await user.setPassword(password, { mustChangePassword });
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

  return roleDoc;
}

async function ensureCanAssignRole(req, roleDoc) {
  if (isCurrentAdminOwner(req)) return { ok: true };

  const actorRoleFilter = {
    code: cleanLower(req.adminRole),
    deletedAt: null,
    active: true,
    status: 'active',
  };
  if (req.adminUserDoc?.roleRef) actorRoleFilter._id = req.adminUserDoc.roleRef;

  const actorRole = await AdminRole.findOne(actorRoleFilter).lean();
  const actorPermissions = await requirePermission.getEffectivePermissions(req);

  if (!canGrantRole({
    actorCode: req.adminRole,
    actorRole,
    targetRole: roleDoc,
    actorPermissions,
  })) {
    return {
      ok: false,
      status: 403,
      message: 'No puedes asignar un perfil con privilegios superiores a los tuyos.',
    };
  }

  return { ok: true };
}

function ensureCanAssignBranches(req, assignedBranches, currentBranches = []) {
  const allowed = canAssignBranches({
    actorCode: req.adminRole,
    actorBranches: req.adminBranches,
    assignedBranches,
    currentBranches,
  });

  return allowed
    ? { ok: true }
    : { ok: false, status: 403, message: 'No puedes asignar una sede fuera de tu alcance.' };
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

function branchInputId(item) {
  return typeof item === 'string' ? item : item?.branch?._id || item?.branch || item?._id || item?.id || '';
}

async function buildAssignedBranches(input, fallbackBranch = null, preferredDefault = null) {
  const rawBranches = normalizeBranchInput(input);

  const branchIds = rawBranches.map(branchInputId);
  if (branchIds.some((id) => !isValidObjectId(id))) {
    throw Object.assign(new Error('Selecciona sedes válidas.'), { status: 400 });
  }

  let uniqueBranchIds = [...new Set(branchIds.map((id) => String(id)))];

  if (!uniqueBranchIds.length && input == null && fallbackBranch?._id) {
    uniqueBranchIds = [String(fallbackBranch._id)];
  }

  if (!uniqueBranchIds.length) {
    throw Object.assign(new Error('Selecciona al menos una sede.'), { status: 400 });
  }

  const branches = await Branch.find({
    _id: { $in: uniqueBranchIds.map((id) => toObjectId(id)) },
    deletedAt: null,
    active: true,
    status: 'active',
  }).lean();

  const branchMap = new Map(
    branches.map((branch) => [String(branch._id), branch])
  );
  if (branchMap.size !== uniqueBranchIds.length) {
    throw Object.assign(new Error('Una de las sedes no está disponible.'), { status: 400 });
  }

  const requestedDefault = preferredDefault ? String(preferredDefault) :
    String(branchInputId(rawBranches.find((item) => item?.isDefault === true)) || uniqueBranchIds[0]);
  if (!uniqueBranchIds.includes(requestedDefault)) {
    throw Object.assign(new Error('La sede principal debe estar entre las sedes asignadas.'), { status: 400 });
  }

  const assigned = [];

  uniqueBranchIds.forEach((branchId) => {
    const branch = branchMap.get(String(branchId));

    if (!branch) return;

    const raw = rawBranches.find((item) => String(branchInputId(item)) === String(branchId));

    assigned.push({
      branch: branch._id,
      branchName: branch.name,
      branchCode: branch.code,
      isDefault: String(branchId) === requestedDefault,
      canSell: raw?.canSell !== false,
      canManageInventory: raw?.canManageInventory === true,
      canInvoice: raw?.canInvoice === true,
    });
  });

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

  if (!canAccessUserScope({
    actorCode: req.adminRole,
    actorBranches: req.adminBranches,
    targetBranches: targetUser.branches || [],
    viewOnly: action === 'view',
  })) {
    return {
      ok: false,
      status: 403,
      message: 'No tienes acceso al usuario en estas sedes.',
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

  const q = cleanText(query.q || query.search || '').slice(0, 120);

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
  async (req, res) => {
    try {
      const isGlobal = isCurrentAdminOwner(req) || cleanLower(req.adminRole) === 'admin';
      const authorizedBranches = (req.adminBranches || [])
        .map((item) => toObjectId(item.branch))
        .filter(Boolean);
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
          ...(!isGlobal ? { _id: { $in: authorizedBranches } } : {}),
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
      if (!isCurrentAdminOwner(req) && cleanLower(req.adminRole) !== 'admin') {
        const branchIds = (req.adminBranches || [])
          .map((item) => toObjectId(item.branch))
          .filter(Boolean);
        if (req.query.branchId &&
            !branchIds.some((id) => String(id) === String(req.query.branchId))) {
          return sendError(res, 403, 'No tienes acceso a esa sede.');
        }
        filter['branches.branch'] = req.query.branchId
          ? toObjectId(req.query.branchId)
          : { $in: branchIds };
      }
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
        data: users.map(buildUserSecurityResponse),
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

      const allowed = await ensureCanManageTargetUser(req, user, 'view');
      if (!allowed.ok) {
        return sendError(res, allowed.status, allowed.message);
      }

      return res.json({
        ok: true,
        data: buildUserSecurityResponse(user),
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
  requirePermission.all(requiredUserWritePermissions('POST')),
  async (req, res) => {
    try {
      const body = req.body || {};

      const username = cleanLower(body.username);
      const email = cleanLower(body.email);
      const temporaryPassword = String(body.password || '');

      if (!username) {
        return sendError(res, 400, 'El usuario es obligatorio.');
      }

      if (!temporaryPassword) {
        return sendError(res, 400, 'La contraseña inicial es obligatoria.');
      }

      const passwordPolicyError = AdminUser.getPasswordPolicyError(temporaryPassword);

      if (passwordPolicyError) {
        return sendError(res, 400, passwordPolicyError);
      }

      const roleDoc = await resolveRole({
        role: body.role || 'seller',
        roleRef: body.roleRef,
      });

      if (!roleDoc) {
        return sendError(res, 400, 'Rol administrativo inválido.');
      }

      if (body.permissions !== undefined) {
        return sendError(res, 400, 'Los permisos se asignan mediante el perfil, no desde el usuario.');
      }

      const roleAllowed = await ensureCanAssignRole(req, roleDoc);
      if (!roleAllowed.ok) {
        return sendError(res, roleAllowed.status, roleAllowed.message);
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
        fallbackBranch,
        body.defaultBranch
      );

      const branchesAllowed = ensureCanAssignBranches(req, assignedBranches);
      if (!branchesAllowed.ok) {
        return sendError(res, branchesAllowed.status, branchesAllowed.message);
      }

      const initialStatus = resolveUserStatus({
        status: body.status || 'active', active: body.active,
      });

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
        permissions: normalizePermissions(roleDoc.permissions || []),

        branches: assignedBranches,
        defaultBranch: getDefaultBranchFromAssigned(assignedBranches),

        status: initialStatus.status,
        active: initialStatus.active,

        mustChangePassword: body.mustChangePassword !== false,
        emailVerified: body.emailVerified === true,

        notes: cleanText(body.notes),
        createdBy: getCurrentAdminId(req),
        updatedBy: getCurrentAdminId(req),
      });

      await setTemporaryPassword(user, temporaryPassword, {
        mustChangePassword: body.mustChangePassword !== false,
      });

      await user.save();

      return res.status(201).json({
        ok: true,
        message: 'Usuario administrativo creado correctamente.',
        data: buildUserPublicResponse(user),
      });
    } catch (error) {
      if (error?.status === 400) return sendError(res, 400, error.message);

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
  (req, res, next) =>
    requirePermission.all(requiredUserWritePermissions('PUT', req.body))(req, res, next),
  async (req, res) => {
    try {
      const { id } = req.params;
      const body = req.body || {};

      if (body.permissions !== undefined) {
        return sendError(res, 400, 'Los permisos se asignan mediante el perfil, no desde el usuario.');
      }

      if (!isValidObjectId(id)) {
        return sendError(res, 400, 'ID de usuario inválido.');
      }

      const user = await AdminUser.findOne({
        _id: toObjectId(id),
        deletedAt: null,
      }).select('+tokenVersion');

      const wasActiveOwner = user && isOwnerRole(user.role) &&
        user.active === true && user.status === 'active';

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

        const roleAllowed = await ensureCanAssignRole(req, roleDoc);
        if (!roleAllowed.ok) {
          return sendError(res, roleAllowed.status, roleAllowed.message);
        }

        if (isOwnerRole(roleDoc.code) && !isCurrentAdminOwner(req)) {
          return sendError(
            res,
            403,
            'Solo el propietario puede asignar el rol propietario.'
          );
        }

        if (String(roleDoc.code) !== String(user.role) ||
            String(roleDoc._id) !== String(user.roleRef || '')) {
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

        if (roleChanged) {
          user.permissions = normalizePermissions(roleDoc.permissions || []);
        }
      }

      if (
        body.branches !== undefined ||
        body.branchIds !== undefined ||
        body.defaultBranch !== undefined
      ) {
        const fallbackBranch = await getDefaultBranch();

        const requestedBranches = body.branches !== undefined ? body.branches :
          body.branchIds !== undefined ? body.branchIds :
          user.branches?.length ? user.branches : body.defaultBranch;
        const assignedBranches = await buildAssignedBranches(
          requestedBranches,
          fallbackBranch,
          body.defaultBranch
        );

        const branchesAllowed = ensureCanAssignBranches(req, assignedBranches, user.branches || []);
        if (!branchesAllowed.ok) {
          return sendError(res, branchesAllowed.status, branchesAllowed.message);
        }

        user.branches = assignedBranches;
        user.defaultBranch = getDefaultBranchFromAssigned(assignedBranches);
      }

      const nextStatus = resolveUserStatus(body);
      if (nextStatus) {
        const disabling = !nextStatus.active;
        const statusAction = disabling ? 'disable' : 'update';

        const statusAllowed = await ensureCanManageTargetUser(
          req,
          user,
          statusAction
        );

        if (!statusAllowed.ok) {
          return sendError(res, statusAllowed.status, statusAllowed.message);
        }

        if (disabling) {
          const lastOwnerCheck = await ensureNotLastOwner(user);

          if (!lastOwnerCheck.ok) {
            return sendError(
              res,
              lastOwnerCheck.status,
              lastOwnerCheck.message
            );
          }
        }

        user.status = nextStatus.status;
        user.active = nextStatus.active;
        // Una decisión administrativa reemplaza cualquier bloqueo temporal previo.
        user.lockedUntil = null;
        user.failedLoginAttempts = 0;
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

      if (wasActiveOwner && (user.role !== 'owner' ||
          user.active !== true || user.status !== 'active')) {
        await saveRemovingOwner(user, { invalidateSessions: Boolean(nextStatus) });
      } else if (nextStatus) {
        await user.invalidateSessions();
      } else {
        await user.save();
      }

      const savedUser = await AdminUser.findById(user._id)
        .populate('roleRef', 'name code level scope')
        .populate('defaultBranch', 'name code type');

      return res.json({
        ok: true,
        message: 'Usuario administrativo actualizado correctamente.',
        data: buildUserPublicResponse(savedUser),
      });
    } catch (error) {
      if (error?.status === 400) return sendError(res, 400, error.message);

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
      const nextStatusInput = req.body || {};

      if (!isValidObjectId(id)) {
        return sendError(res, 400, 'ID de usuario inválido.');
      }

      const user = await AdminUser.findOne({
        _id: toObjectId(id),
        deletedAt: null,
      }).select('+tokenVersion');

      const wasActiveOwner = user && isOwnerRole(user.role) &&
        user.active === true && user.status === 'active';

      const allowed = await ensureCanManageTargetUser(req, user, 'disable');

      if (!allowed.ok) {
        return sendError(res, allowed.status, allowed.message);
      }

      const nextStatus = resolveUserStatus(nextStatusInput);
      if (!nextStatus) return sendError(res, 400, 'Indica el nuevo estado del usuario.');

      if (!nextStatus.active) {
        const lastOwnerCheck = await ensureNotLastOwner(user);
        if (!lastOwnerCheck.ok) {
          return sendError(res, lastOwnerCheck.status, lastOwnerCheck.message);
        }
      }

      user.status = nextStatus.status;
      user.active = nextStatus.active;
      // Sin esto, "activar" deja vigente el bloqueo por intentos fallidos.
      user.lockedUntil = null;
      user.failedLoginAttempts = 0;

      user.updatedBy = getCurrentAdminId(req);

      if (wasActiveOwner && !nextStatus.active) {
        await saveRemovingOwner(user);
      } else {
        await user.invalidateSessions();
      }

      return res.json({
        ok: true,
        message: 'Estado del usuario actualizado correctamente.',
        data: buildUserPublicResponse(user),
      });
    } catch (error) {
      if (error?.status === 400) return sendError(res, 400, error.message);

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
  requirePermission('admin-users:password'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { password, mustChangePassword = true } = req.body || {};
      const temporaryPassword = String(password || '');

      if (!isValidObjectId(id)) {
        return sendError(res, 400, 'ID de usuario inválido.');
      }

      if (!temporaryPassword) {
        return sendError(res, 400, 'La nueva contraseña es obligatoria.');
      }

      const passwordPolicyError = AdminUser.getPasswordPolicyError(temporaryPassword);

      if (passwordPolicyError) {
        return sendError(res, 400, passwordPolicyError);
      }

      const user = await AdminUser.findOne({
        _id: toObjectId(id),
        deletedAt: null,
      }).select('+tokenVersion');

      const allowed = await ensureCanManageTargetUser(req, user, 'update');

      if (!allowed.ok) {
        return sendError(res, allowed.status, allowed.message);
      }

      await setTemporaryPassword(user, temporaryPassword, {
        mustChangePassword: mustChangePassword === true,
      });
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
 * ADMINISTRAR 2FA (SOLO OWNER)
 * ============================ */

router.patch(
  '/:id/two-factor',
  requireAdmin,
  requirePermission.ownerOnly(),
  async (req, res) => {
    let actor = null;
    let targetUser = null;
    const action = cleanLower(req.body?.action);
    const reason = cleanText(req.body?.reason).slice(0, 500);

    try {
      const { id } = req.params;
      if (!isValidObjectId(id)) {
        return sendError(res, 400, 'ID de usuario inválido.');
      }
      if (!['require', 'reset', 'disable'].includes(action)) {
        return sendError(res, 400, 'Acción de seguridad 2FA inválida.');
      }
      if (reason.length < 3) {
        return sendError(res, 400, 'Escribe el motivo del cambio de seguridad.');
      }

      actor = await AdminUser.findOne({
        _id: getCurrentAdminId(req),
        deletedAt: null,
      }).select(
        '+passwordHash +twoFactorSecret +twoFactorRecoveryCodeHashes +twoFactorManagementFailedAttempts +twoFactorManagementLockedUntil +tokenVersion'
      );
      if (!actor || !isOwnerRole(actor.role)) {
        return sendError(res, 403, 'Solo el propietario puede administrar el 2FA.');
      }

      const isSelf = String(actor._id) === String(id);
      targetUser = isSelf
        ? actor
        : await AdminUser.findOne({ _id: toObjectId(id), deletedAt: null }).select(
            '+twoFactorSecret +twoFactorPendingSecret +twoFactorPendingExpiresAt +twoFactorPendingAttempts +twoFactorRecoveryCodeHashes +twoFactorManagementFailedAttempts +twoFactorManagementLockedUntil +tokenVersion'
          );
      if (!targetUser) {
        return sendError(res, 404, 'Usuario administrativo no encontrado.');
      }

      const verification = await verifyOwnerTwoFactorCredentials(actor, {
        currentPassword: String(req.body?.currentPassword || ''),
        code: String(req.body?.code || ''),
      });
      if (!verification.ok) {
        const status = verification.retryAfterSeconds ? 429 : 403;
        await saveOwnerTwoFactorAudit(req, actor, targetUser, {
          action: `2fa.owner.${action}`,
          success: false,
          description: 'Credenciales inválidas al administrar el 2FA de un usuario.',
          reason,
          statusCode: status,
        });
        return sendError(
          res,
          status,
          verification.retryAfterSeconds
            ? `Demasiados intentos. Intenta nuevamente en ${verification.retryAfterSeconds} segundos.`
            : 'La contraseña o el código de seguridad del propietario no son válidos.',
          { retryAfterSeconds: verification.retryAfterSeconds }
        );
      }

      if (!isSelf && !actor.twoFactorEnabled) {
        await saveOwnerTwoFactorAudit(req, actor, targetUser, {
          action: `2fa.owner.${action}`,
          success: false,
          description: 'El propietario intentó administrar otro usuario sin tener 2FA activo.',
          reason,
          statusCode: 409,
        });
        return sendError(
          res,
          409,
          'Activa primero tu propio 2FA para administrar la seguridad de otros usuarios.'
        );
      }

      if (action === 'require') {
        targetUser.twoFactorRequirement = 'required';
        if (!targetUser.twoFactorEnabled) {
          targetUser.twoFactorPendingSecret = '';
          targetUser.twoFactorPendingExpiresAt = null;
          targetUser.twoFactorPendingAttempts = 0;
        }
      } else if (action === 'reset') {
        clearUserTwoFactor(targetUser);
        targetUser.twoFactorRequirement = 'required';
      } else {
        clearUserTwoFactor(targetUser);
        targetUser.twoFactorRequirement = 'optional';
      }

      targetUser.twoFactorRequirementUpdatedAt = new Date();
      targetUser.twoFactorRequirementUpdatedBy = actor._id;
      targetUser.updatedBy = actor._id;
      await targetUser.save({ validateBeforeSave: false });

      const revokeReason = `two_factor_owner_${action}`;
      if (isSelf) {
        await revokeOtherUserSessions(targetUser._id, req.adminSessionId, revokeReason);
      } else {
        await revokeAllUserSessions(targetUser._id, revokeReason);
      }

      const descriptions = {
        require: targetUser.twoFactorEnabled
          ? 'El propietario estableció el 2FA como obligatorio para el usuario.'
          : 'El propietario exigió configurar 2FA en el siguiente acceso del usuario.',
        reset: 'El propietario restableció el 2FA y exigió una nueva vinculación.',
        disable: 'El propietario desactivó el 2FA y lo dejó como opcional.',
      };
      await saveOwnerTwoFactorAudit(req, actor, targetUser, {
        action: `2fa.owner.${action}`,
        success: true,
        description: descriptions[action],
        reason,
        recoveryCodeUsed: verification.recoveryCodeUsed,
      });

      const policy = buildTwoFactorPolicy(targetUser);
      return res.json({
        ok: true,
        message: descriptions[action],
        currentUserChanged: isSelf,
        data: {
          ...buildUserPublicResponse(targetUser),
          twoFactorRequired: policy.required,
          twoFactorSetupRequired: !policy.compliant,
          twoFactorRequirement: policy.requirement,
          twoFactorRequirementSource: policy.requirementSource,
        },
      });
    } catch (error) {
      console.error('❌ Error administrando 2FA por owner:', error.message);
      await saveOwnerTwoFactorAudit(req, actor, targetUser, {
        action: `2fa.owner.${action || 'unknown'}`,
        success: false,
        description: 'Error al administrar el 2FA de un usuario.',
        reason,
        statusCode: 500,
      });
      return sendError(res, 500, 'No se pudo actualizar la seguridad 2FA del usuario.');
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

      const wasActiveOwner = user && isOwnerRole(user.role) &&
        user.active === true && user.status === 'active';

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

      if (wasActiveOwner) {
        await saveRemovingOwner(user);
      } else {
        await user.invalidateSessions();
      }

      return res.json({
        ok: true,
        message: 'Usuario administrativo eliminado correctamente.',
      });
    } catch (error) {
      if (error?.status === 400) return sendError(res, 400, error.message);
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
