// backend/middleware/requireAdmin.js
/**
 * Middleware de protección para rutas admin.
 *
 * Funciona con:
 * 1. Login nuevo desde MongoDB usando AdminUser.
 * 2. Login viejo por variables de entorno, mientras terminamos la migración.
 *
 * Valida:
 * - JWT_SECRET configurado.
 * - Token de acceso recibido en cookie HttpOnly (Bearer queda solo para
 *   integraciones controladas y siempre debe pertenecer a una sesión real).
 * - Token con role: "admin".
 * - Usuario real activo, no eliminado, no bloqueado.
 * - tokenVersion para invalidar sesiones antiguas.
 *
 * Propaga:
 * - req.adminUser
 * - req.adminUsername
 * - req.adminUserId
 * - req.adminRole
 * - req.adminAuthType
 * - req.adminPermissions
 * - req.adminBranches
 * - req.adminDefaultBranch
 * - req.adminUserDoc
 */

const jwt = require('jsonwebtoken');
const AdminUser = require('../models/AdminUser');
const {
  isLegacyAdminAuthEnabled,
} = require('../security/legacyAdminAuthPolicy');
const {
  getAccessCredential,
  isTrustedRequestOrigin,
  loadActiveSession,
  verifyAccessToken,
} = require('../security/adminSessionService');

function getJwtSecret() {
  return process.env.JWT_SECRET;
}

function isDbToken(decoded) {
  return Boolean(decoded?.authType === 'db' || decoded?.adminUserId);
}

function isLegacyToken(decoded) {
  return Boolean(decoded?.role === 'admin' && !decoded?.adminUserId);
}

function buildSafeAdminUser(adminUser) {
  if (!adminUser) return null;

  if (typeof adminUser.toSafeObject === 'function') {
    return adminUser.toSafeObject();
  }

  const plain = adminUser.toObject ? adminUser.toObject() : { ...adminUser };

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

async function loadDbAdminUser(decoded) {
  if (!decoded?.adminUserId) return null;

  return AdminUser.findOne({
    _id: decoded.adminUserId,
    deletedAt: null,
  })
    .select(
      '+tokenVersion +failedLoginAttempts +lockedUntil'
    );
}

function attachLegacyAdmin(req, decoded) {
  const username = decoded?.username || 'admin';

  req.adminUser = username;
  req.adminUsername = username;
  req.adminUserId = null;

  req.adminRole = decoded?.adminRole || decoded?.actualRole || 'admin';
  req.adminJwtRole = decoded?.role || 'admin';
  req.adminAuthType = decoded?.authType || 'legacy';

  req.adminPermissions = [];
  req.adminBranches = [];
  req.adminDefaultBranch = null;

  req.adminUserDoc = null;
  req.adminProfile = {
    username,
    role: 'admin',
    adminRole: req.adminRole,
    actualRole: req.adminRole,
    permissions: [],
    branches: [],
    defaultBranch: null,
    active: true,
    status: 'active',
  };
}

function attachDbAdmin(req, adminUser, decoded) {
  const safeUser = buildSafeAdminUser(adminUser);

  req.adminUser = adminUser.username;
  req.adminUsername = adminUser.username;
  req.adminUserId = String(adminUser._id);

  req.adminRole = adminUser.role || decoded?.adminRole || decoded?.actualRole || 'admin';
  req.adminJwtRole = decoded?.role || 'admin';
  req.adminAuthType = 'db';

  req.adminPermissions = Array.isArray(adminUser.permissions)
    ? adminUser.permissions
    : [];

  req.adminBranches = Array.isArray(adminUser.branches)
    ? adminUser.branches
    : [];

  req.adminDefaultBranch = adminUser.defaultBranch || null;

  req.adminUserDoc = adminUser;
  req.adminProfile = {
    ...safeUser,
    id: String(adminUser._id),

    // Compatibilidad con frontend/rutas actuales.
    role: 'admin',

    // Rol real del sistema nuevo.
    adminRole: req.adminRole,
    actualRole: req.adminRole,

    permissions: req.adminPermissions,
    branches: req.adminBranches,
    defaultBranch: req.adminDefaultBranch,
  };
}

function reject(res, status, error, message) {
  return res.status(status).json({
    error,
    message,
  });
}

async function requireAdmin(req, res, next) {
  try {
    if (req.method === 'OPTIONS') return next();

    const jwtSecret = getJwtSecret();

    if (!jwtSecret) {
      console.error('[requireAdmin] JWT_SECRET no configurado');

      return reject(
        res,
        500,
        'SERVER_MISCONFIG',
        'JWT_SECRET no configurado.'
      );
    }

    const credential = getAccessCredential(req);
    const token = credential.token;

    if (!token) {
      return reject(
        res,
        401,
        'UNAUTHORIZED',
        'Token de administrador ausente.'
      );
    }

    if (credential.source === 'cookie' && !isTrustedRequestOrigin(req)) {
      return reject(
        res,
        403,
        'UNTRUSTED_ORIGIN',
        'Origen no autorizado para esta operación administrativa.'
      );
    }

    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (error) {
      if (credential.source !== 'header') {
        throw error;
      }
      decoded = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] });
    }

    if (decoded?.role !== 'admin') {
      return reject(
        res,
        403,
        'FORBIDDEN',
        'No tienes permisos de administrador.'
      );
    }

    if (isLegacyToken(decoded) && !isLegacyAdminAuthEnabled()) {
      return reject(
        res,
        403,
        'LEGACY_ADMIN_DISABLED',
        'La autenticación administrativa heredada está deshabilitada.'
      );
    }

    const explicitLegacyHeader =
      credential.source === 'header' &&
      isLegacyToken(decoded) &&
      isLegacyAdminAuthEnabled() &&
      !decoded.sessionId;
    const adminSession = explicitLegacyHeader
      ? null
      : await loadActiveSession(decoded, { req });

    if (!adminSession && !explicitLegacyHeader) {
      return reject(
        res,
        401,
        'SESSION_REVOKED',
        'La sesión expiró o fue revocada. Inicia sesión nuevamente.'
      );
    }

    req.adminSession = adminSession;
    req.adminSessionId = decoded.sessionId;

    if (isDbToken(decoded)) {
      const adminUser = await loadDbAdminUser(decoded);

      if (!adminUser) {
        return reject(
          res,
          401,
          'UNAUTHORIZED',
          'Usuario administrativo no encontrado.'
        );
      }

      if (adminUser.deletedAt) {
        return reject(
          res,
          403,
          'FORBIDDEN',
          'Usuario administrativo eliminado.'
        );
      }

      if (typeof adminUser.releaseExpiredLoginLock === 'function') {
        await adminUser.releaseExpiredLoginLock();
      }

      if (typeof adminUser.isAccountLocked === 'function' && adminUser.isAccountLocked()) {
        return reject(
          res,
          423,
          'LOCKED',
          'Usuario administrativo bloqueado temporalmente.'
        );
      }

      if (adminUser.active !== true || adminUser.status !== 'active') {
        return reject(
          res,
          403,
          'FORBIDDEN',
          'Usuario administrativo inactivo o bloqueado.'
        );
      }

      const currentTokenVersion = Number(adminUser.tokenVersion || 0);
      const decodedTokenVersion = Number(decoded.tokenVersion || 0);

      if (currentTokenVersion !== decodedTokenVersion) {
        return reject(
          res,
          401,
          'UNAUTHORIZED',
          'La sesión ya no es válida. Inicia sesión nuevamente.'
        );
      }

      if (adminUser.mustChangePassword === true) {
        return reject(
          res,
          403,
          'PASSWORD_CHANGE_REQUIRED',
          'Debes cambiar la contraseña temporal antes de acceder al panel administrativo.'
        );
      }

      attachDbAdmin(req, adminUser, decoded);

      return next();
    }

    if (isLegacyToken(decoded)) {
      if (!isLegacyAdminAuthEnabled()) {
        return reject(
          res,
          403,
          'LEGACY_ADMIN_DISABLED',
          'La autenticación administrativa heredada está deshabilitada.'
        );
      }

      attachLegacyAdmin(req, decoded);

      return next();
    }

    return reject(
      res,
      403,
      'FORBIDDEN',
      'Token administrativo no reconocido.'
    );
  } catch (error) {
    return reject(
      res,
      401,
      'UNAUTHORIZED',
      'Token de administrador inválido o expirado.'
    );
  }
}

module.exports = requireAdmin;
