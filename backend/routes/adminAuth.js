// backend/routes/adminAuth.js

const express = require('express');
const bcrypt = require('bcryptjs');
const QRCode = require('qrcode');
const mongoose = require('mongoose');

const AdminAuditLog = require('../models/AdminAuditLog');
const AdminLoginAudit = require('../models/AdminLoginAudit');
const AdminSecurityAlert = require('../models/AdminSecurityAlert');
const AdminUser = require('../models/AdminUser');
const requireAdmin = require('../middleware/requireAdmin');
const requirePermission = require('../middleware/requirePermission');
const { sendMail } = require('../lib/mail/mailer');
const {
  isLegacyAdminAuthEnabled,
} = require('../security/legacyAdminAuthPolicy');
const {
  clearSessionCookies,
  clearTwoFactorChallengeCookie,
  getAccessCredential,
  getRefreshToken,
  issueRotatedSession,
  loadActiveSession,
  requireTrustedAdminOrigin,
  revokeAllUserSessions,
  revokeOtherUserSessions,
  revokeRequestSession,
  revokeUserSessionByRecordId,
  rotateRefreshToken,
  startAdminSession,
  verifyAccessToken,
} = require('../security/adminSessionService');
const {
  getAdminSecurityCenter,
} = require('../security/adminSecurityCenterService');
const {
  recordLoginAlert,
  recordTwoFactorChangeAlert,
} = require('../security/adminSecurityAlertService');
const {
  buildTwoFactorPolicy,
} = require('../security/adminTwoFactorPolicy');
const {
  cancelLoginChallenge,
  createLoginChallenge,
  verifyLoginChallenge,
} = require('../security/adminTwoFactorService');
const {
  buildTotpUri,
  decryptTwoFactorSecret,
  encryptTwoFactorSecret,
  generateRecoveryCodes,
  generateTotpSecret,
  hashRecoveryCode,
  verifyTotp,
} = require('../security/adminTwoFactorCrypto');

const router = express.Router();

const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;
const JWT_SECRET = process.env.JWT_SECRET;

const FRONTEND_ADMIN_URL =
  process.env.ADMIN_PASSWORD_RESET_URL ||
  process.env.FRONTEND_ADMIN_URL ||
  process.env.ADMIN_FRONTEND_URL ||
  process.env.FRONTEND_URL ||
  'http://localhost:5173';

console.log('🔗 URL recuperación admin:', FRONTEND_ADMIN_URL);

const PASSWORD_RESET_MINUTES = Number(process.env.ADMIN_PASSWORD_RESET_MINUTES || 30);

const PASSWORD_RESET_REQUEST_COOLDOWN_MS =
  Number(process.env.ADMIN_PASSWORD_RESET_REQUEST_COOLDOWN_MINUTES || 2) *
  60 *
  1000;

const PASSWORD_RESET_REQUEST_WINDOW_MS =
  Number(process.env.ADMIN_PASSWORD_RESET_REQUEST_WINDOW_MINUTES || 60) *
  60 *
  1000;

const PASSWORD_RESET_REQUEST_MAX_PER_LOGIN = Number(
  process.env.ADMIN_PASSWORD_RESET_REQUEST_MAX_PER_LOGIN || 5
);

const PASSWORD_RESET_REQUEST_MAX_PER_IP = Number(
  process.env.ADMIN_PASSWORD_RESET_REQUEST_MAX_PER_IP || 10
);

const passwordResetAttempts = new Map();

const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCK_TIME_MS = 10 * 60 * 1000;
const loginAttempts = new Map();

function isJwtConfigured() {
  return Boolean(JWT_SECRET);
}

function isLegacyAdminConfigured() {
  return Boolean(
    isLegacyAdminAuthEnabled() &&
      ADMIN_USER &&
      ADMIN_PASSWORD_HASH &&
      JWT_SECRET
  );
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];

  if (forwarded) return String(forwarded).split(',')[0].trim();

  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function getUserAgent(req) {
  return String(req.headers['user-agent'] || '').slice(0, 500);
}

function normalizeLogin(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

router.use(requireTrustedAdminOrigin);

function buildAdminResetPasswordUrl(rawToken) {
  const baseUrl = String(FRONTEND_ADMIN_URL || 'http://localhost:5173').replace(/\/+$/, '');
  const cleanToken = encodeURIComponent(String(rawToken || '').trim());

  return `${baseUrl}/admin/reset-password?token=${cleanToken}`;
}

async function saveLoginAudit(req, { username = '', adminUserId = null, status, reason = '' }) {
  try {
    const audit = await AdminLoginAudit.create({
      adminUserId,
      username,
      ip: getClientIp(req),
      status,
      reason,
      userAgent: getUserAgent(req),
    });
    if (['failed', 'blocked'].includes(status)) {
      const adminUser = username
        ? await AdminUser.findOne({ username: normalizeLogin(username), deletedAt: null })
            .select('_id username')
            .lean()
        : null;
      await recordLoginAlert({ audit, adminUser });
    }
  } catch (error) {
    console.error('❌ Error guardando auditoría login:', error.message);
  }
}

async function saveTwoFactorAudit(req, authResult, {
  action,
  success,
  description,
  permission = 'seguridad:2fa',
  metadata = {},
  errorMessage = '',
  statusCode = success ? 200 : 400,
}) {
  try {
    const audit = await AdminAuditLog.create({
      action,
      permission,
      module: 'seguridad',
      description,
      method: req.method,
      path: req.originalUrl || req.path,
      routePattern: req.route?.path || '',
      adminUserId: authResult?.adminUser?._id || null,
      adminUsername: authResult?.adminUser?.username || '',
      adminRole: authResult?.adminUser?.role || '',
      statusCode,
      success,
      ip: getClientIp(req),
      userAgent: getUserAgent(req),
      requestId: String(req.headers['x-request-id'] || '').slice(0, 120),
      metadata,
      errorMessage,
    });
    await recordTwoFactorChangeAlert({ audit, adminUser: authResult?.adminUser });
  } catch (error) {
    console.error('❌ Error guardando auditoría 2FA:', error.message);
  }
}

function getAttemptKey(req, username) {
  return `${getClientIp(req)}:${normalizeLogin(username)}`;
}

function getAttemptState(key) {
  const current = loginAttempts.get(key);

  if (!current) {
    return {
      count: 0,
      lockedUntil: 0,
    };
  }

  if (current.lockedUntil && current.lockedUntil <= Date.now()) {
    loginAttempts.delete(key);

    return {
      count: 0,
      lockedUntil: 0,
    };
  }

  return current;
}

function registerFailedAttempt(key) {
  const current = getAttemptState(key);
  const nextCount = Number(current.count || 0) + 1;

  const nextState = {
    count: nextCount,
    lockedUntil:
      nextCount >= MAX_LOGIN_ATTEMPTS ? Date.now() + LOGIN_LOCK_TIME_MS : 0,
  };

  loginAttempts.set(key, nextState);

  return nextState;
}

function clearAttempts(key) {
  loginAttempts.delete(key);
}

function getLockResponse(seconds) {
  return {
    ok: false,
    message: `Demasiados intentos fallidos. Intenta nuevamente en ${seconds} segundos.`,
    retryAfterSeconds: seconds,
  };
}

function getPasswordResetAttemptKey(type, value) {
  return `password-reset:${type}:${String(value || '').trim().toLowerCase()}`;
}

function getPasswordResetAttemptState(key) {
  const current = passwordResetAttempts.get(key);

  if (!current) {
    return {
      count: 0,
      windowStartedAt: 0,
      lastRequestedAt: 0,
    };
  }

  if (
    current.windowStartedAt &&
    Date.now() - current.windowStartedAt >= PASSWORD_RESET_REQUEST_WINDOW_MS
  ) {
    passwordResetAttempts.delete(key);

    return {
      count: 0,
      windowStartedAt: 0,
      lastRequestedAt: 0,
    };
  }

  return current;
}

function checkPasswordResetAttemptLimit(req, login) {
  const ip = getClientIp(req);
  const cleanLogin = normalizeLogin(login);

  const loginKey = getPasswordResetAttemptKey('login', cleanLogin);
  const ipKey = getPasswordResetAttemptKey('ip', ip);

  const loginState = getPasswordResetAttemptState(loginKey);
  const ipState = getPasswordResetAttemptState(ipKey);

  if (
    loginState.lastRequestedAt &&
    Date.now() - loginState.lastRequestedAt < PASSWORD_RESET_REQUEST_COOLDOWN_MS
  ) {
    const retryAfterMs =
      PASSWORD_RESET_REQUEST_COOLDOWN_MS -
      (Date.now() - loginState.lastRequestedAt);

    const seconds = Math.max(1, Math.ceil(retryAfterMs / 1000));

    return {
      allowed: false,
      reason: 'password_reset_cooldown',
      retryAfterSeconds: seconds,
      message: `Por seguridad, espera ${seconds} segundos antes de solicitar otro enlace.`,
    };
  }

  if (loginState.count >= PASSWORD_RESET_REQUEST_MAX_PER_LOGIN) {
    const retryAfterMs =
      PASSWORD_RESET_REQUEST_WINDOW_MS - (Date.now() - loginState.windowStartedAt);

    const seconds = Math.max(1, Math.ceil(retryAfterMs / 1000));

    return {
      allowed: false,
      reason: 'password_reset_login_limit',
      retryAfterSeconds: seconds,
      message: `Has solicitado demasiados enlaces. Intenta nuevamente en ${seconds} segundos.`,
    };
  }

  if (ipState.count >= PASSWORD_RESET_REQUEST_MAX_PER_IP) {
    const retryAfterMs =
      PASSWORD_RESET_REQUEST_WINDOW_MS - (Date.now() - ipState.windowStartedAt);

    const seconds = Math.max(1, Math.ceil(retryAfterMs / 1000));

    return {
      allowed: false,
      reason: 'password_reset_ip_limit',
      retryAfterSeconds: seconds,
      message: `Demasiadas solicitudes desde esta conexión. Intenta nuevamente en ${seconds} segundos.`,
    };
  }

  return {
    allowed: true,
    reason: '',
    retryAfterSeconds: 0,
    message: '',
  };
}

function registerPasswordResetAttempt(req, login) {
  const ip = getClientIp(req);
  const cleanLogin = normalizeLogin(login);

  const keys = [
    getPasswordResetAttemptKey('login', cleanLogin),
    getPasswordResetAttemptKey('ip', ip),
  ];

  keys.forEach((key) => {
    const current = getPasswordResetAttemptState(key);
    const now = Date.now();

    if (!current.windowStartedAt) {
      passwordResetAttempts.set(key, {
        count: 1,
        windowStartedAt: now,
        lastRequestedAt: now,
      });

      return;
    }

    passwordResetAttempts.set(key, {
      count: Number(current.count || 0) + 1,
      windowStartedAt: current.windowStartedAt,
      lastRequestedAt: now,
    });
  });
}

function buildDbTokenPayload(adminUser) {
  return {
    // Se conserva role: "admin" para no romper middleware/frontend actuales.
    role: 'admin',

    authType: 'db',
    adminUserId: String(adminUser._id),
    username: adminUser.username,

    // Rol real del nuevo sistema.
    adminRole: adminUser.role,
    actualRole: adminUser.role,

    roleRef: adminUser.roleRef ? String(adminUser.roleRef) : null,
    defaultBranch: adminUser.defaultBranch ? String(adminUser.defaultBranch) : null,
    tokenVersion: Number(adminUser.tokenVersion || 0),
  };
}

function buildLegacyTokenPayload(username) {
  return {
    role: 'admin',
    authType: 'legacy',
    username,
    adminRole: 'admin',
    actualRole: 'admin',
  };
}

function normalizePermissionList(input) {
  if (!Array.isArray(input)) return [];

  const seen = new Set();
  const permissions = [];

  input.forEach((item) => {
    const permission = String(item || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ':');

    if (!permission) return;
    if (seen.has(permission)) return;

    seen.add(permission);
    permissions.push(permission);
  });

  return permissions;
}

function getMergedAdminPermissions(adminUser) {
  const rolePermissions = normalizePermissionList(
    adminUser?.roleRef?.permissions
  );

  if (rolePermissions.length > 0) {
    return rolePermissions;
  }

  return normalizePermissionList(adminUser?.permissions);
}

function buildUserResponseFromDb(adminUser) {
  const safeUser =
    typeof adminUser.toSafeObject === 'function'
      ? adminUser.toSafeObject()
      : adminUser.toObject();

  const effectivePermissions = getMergedAdminPermissions(adminUser);
  const twoFactorPolicy = buildTwoFactorPolicy(adminUser);

  safeUser.permissions = effectivePermissions;

  return {
    id: String(adminUser._id),
    username: adminUser.username,

    // Compatibilidad con el sistema actual.
    role: 'admin',

    // Rol real del nuevo sistema.
    adminRole: adminUser.role,
    actualRole: adminUser.role,

    roleRef: adminUser.roleRef || null,
    permissions: effectivePermissions,
    branches: Array.isArray(adminUser.branches) ? adminUser.branches : [],
    defaultBranch: adminUser.defaultBranch || null,

    displayName: adminUser.displayName || adminUser.username,
    fullName: adminUser.fullName || adminUser.displayName || adminUser.username,
    email: adminUser.email || '',
    status: adminUser.status,
    active: adminUser.active,
    mustChangePassword: Boolean(adminUser.mustChangePassword),
    twoFactorEnabled: Boolean(adminUser.twoFactorEnabled),
    twoFactorRequired: twoFactorPolicy.required,
    twoFactorSetupRequired: !twoFactorPolicy.compliant,
    twoFactorPolicyMisconfigured: twoFactorPolicy.misconfigured,

    profile: safeUser,
  };
}

function buildUserResponseFromLegacy(username) {
  return {
    username,
    role: 'admin',
    adminRole: 'admin',
    actualRole: 'admin',
    permissions: [],
    branches: [],
    defaultBranch: null,
    displayName: username,
    fullName: username,
    email: '',
    status: 'active',
    active: true,
    mustChangePassword: false,
    twoFactorEnabled: false,
    twoFactorRequired: false,
    twoFactorSetupRequired: false,
    twoFactorPolicyMisconfigured: false,
  };
}

function validateRequiredPasswordChangePayload({
  currentPassword,
  newPassword,
  confirmPassword,
}) {
  if (!currentPassword) {
    return 'Debes escribir la contraseña temporal actual.';
  }

  if (!newPassword) {
    return 'Debes escribir la nueva contraseña.';
  }

  const passwordPolicyError = AdminUser.getPasswordPolicyError(newPassword);

  if (passwordPolicyError) {
    return passwordPolicyError;
  }

  if (!confirmPassword) {
    return 'Debes confirmar la nueva contraseña.';
  }

  if (String(newPassword) !== String(confirmPassword)) {
    return 'La confirmación de contraseña no coincide.';
  }

  if (String(currentPassword) === String(newPassword)) {
    return 'La nueva contraseña debe ser diferente a la contraseña temporal.';
  }

  return '';
}

function validateResetPasswordPayload({ token, newPassword, confirmPassword }) {
  if (!token) {
    return 'Token de recuperación requerido.';
  }

  if (!newPassword) {
    return 'Debes escribir la nueva contraseña.';
  }

  const passwordPolicyError = AdminUser.getPasswordPolicyError(newPassword);

  if (passwordPolicyError) {
    return passwordPolicyError;
  }

  if (!confirmPassword) {
    return 'Debes confirmar la nueva contraseña.';
  }

  if (String(newPassword) !== String(confirmPassword)) {
    return 'La confirmación de contraseña no coincide.';
  }

  return '';
}

async function findAdminUserForToken(decoded) {
  if (!decoded?.adminUserId) return null;

  return AdminUser.findOne({
  _id: decoded.adminUserId,
  deletedAt: null,
  })
    .select('+tokenVersion +failedLoginAttempts +lockedUntil')
    .populate('roleRef', 'name code level scope permissions');
}

async function findAdminUserForPasswordChange(decoded) {
  if (!decoded?.adminUserId) return null;

  return AdminUser.findOne({
    _id: decoded.adminUserId,
    deletedAt: null,
  }).select('+passwordHash +tokenVersion +failedLoginAttempts +lockedUntil');
}

async function findAdminUserForTwoFactor(decoded) {
  if (!decoded?.adminUserId) return null;

  return AdminUser.findOne({
    _id: decoded.adminUserId,
    deletedAt: null,
  }).select(
    '+passwordHash +twoFactorSecret +twoFactorPendingSecret +twoFactorPendingExpiresAt +twoFactorPendingAttempts +twoFactorRecoveryCodeHashes +twoFactorManagementFailedAttempts +twoFactorManagementLockedUntil +tokenVersion'
  );
}

const TWO_FACTOR_MANAGEMENT_MAX_ATTEMPTS = 5;
const TWO_FACTOR_MANAGEMENT_LOCK_MS = 10 * 60 * 1000;

function getTwoFactorManagementLock(adminUser) {
  const lockedUntil = adminUser?.twoFactorManagementLockedUntil;
  if (!lockedUntil || new Date(lockedUntil).getTime() <= Date.now()) return null;
  return {
    reason: 'management_locked',
    retryAfterSeconds: Math.max(
      1,
      Math.ceil((new Date(lockedUntil).getTime() - Date.now()) / 1000)
    ),
  };
}

async function registerTwoFactorManagementFailure(adminUser) {
  const attempts = Number(adminUser.twoFactorManagementFailedAttempts || 0) + 1;
  adminUser.twoFactorManagementFailedAttempts = attempts;
  if (attempts >= TWO_FACTOR_MANAGEMENT_MAX_ATTEMPTS) {
    adminUser.twoFactorManagementLockedUntil = new Date(
      Date.now() + TWO_FACTOR_MANAGEMENT_LOCK_MS
    );
  }
  await adminUser.save({ validateBeforeSave: false });
  return getTwoFactorManagementLock(adminUser);
}

async function clearTwoFactorManagementFailures(adminUser) {
  if (
    Number(adminUser.twoFactorManagementFailedAttempts || 0) === 0 &&
    !adminUser.twoFactorManagementLockedUntil
  ) {
    return;
  }
  adminUser.twoFactorManagementFailedAttempts = 0;
  adminUser.twoFactorManagementLockedUntil = null;
  await adminUser.save({ validateBeforeSave: false });
}

async function verifyTwoFactorManagementCredentials(adminUser, {
  currentPassword,
  code,
  allowRecovery = true,
  consumeRecovery = true,
}) {
  const currentLock = getTwoFactorManagementLock(adminUser);
  if (currentLock) return { ok: false, ...currentLock };

  if (!currentPassword || !(await adminUser.comparePassword(currentPassword))) {
    const lock = await registerTwoFactorManagementFailure(adminUser);
    return { ok: false, reason: 'invalid_password', ...(lock || {}) };
  }
  if (!adminUser.twoFactorEnabled || !adminUser.twoFactorSecret) {
    return { ok: false, reason: 'two_factor_disabled' };
  }

  let secret;
  try {
    secret = decryptTwoFactorSecret(adminUser.twoFactorSecret);
  } catch {
    return { ok: false, reason: 'invalid_secret' };
  }

  if (verifyTotp(secret, code)) {
    await clearTwoFactorManagementFailures(adminUser);
    return { ok: true, recoveryCodeUsed: false };
  }

  if (!allowRecovery) {
    const lock = await registerTwoFactorManagementFailure(adminUser);
    return { ok: false, reason: 'invalid_code', ...(lock || {}) };
  }
  const recoveryHash = hashRecoveryCode(code);
  if (!recoveryHash) {
    const lock = await registerTwoFactorManagementFailure(adminUser);
    return { ok: false, reason: 'invalid_code', ...(lock || {}) };
  }

  const hasRecoveryCode = (adminUser.twoFactorRecoveryCodeHashes || []).includes(
    recoveryHash
  );
  if (!hasRecoveryCode) {
    const lock = await registerTwoFactorManagementFailure(adminUser);
    return { ok: false, reason: 'invalid_code', ...(lock || {}) };
  }

  await clearTwoFactorManagementFailures(adminUser);

  if (consumeRecovery) {
    const update = await AdminUser.updateOne(
      { _id: adminUser._id, twoFactorRecoveryCodeHashes: recoveryHash },
      {
        $pull: { twoFactorRecoveryCodeHashes: recoveryHash },
        $set: { twoFactorLastUsedAt: new Date() },
      }
    );
    if (!update.modifiedCount) return { ok: false, reason: 'recovery_code_used' };
  }

  return { ok: true, recoveryCodeUsed: true };
}

async function verifySecurityActionCredentials(adminUser, {
  currentPassword,
  code,
}) {
  if (adminUser?.twoFactorEnabled) {
    return verifyTwoFactorManagementCredentials(adminUser, {
      currentPassword,
      code,
    });
  }

  const currentLock = getTwoFactorManagementLock(adminUser);
  if (currentLock) return { ok: false, ...currentLock };

  if (!currentPassword || !(await adminUser.comparePassword(currentPassword))) {
    const lock = await registerTwoFactorManagementFailure(adminUser);
    return { ok: false, reason: 'invalid_password', ...(lock || {}) };
  }

  await clearTwoFactorManagementFailures(adminUser);
  return { ok: true, recoveryCodeUsed: false };
}

async function findAdminUserForPasswordResetRequest(login) {
  const cleanLogin = normalizeLogin(login);

  if (!cleanLogin) return null;

  const selectFields =
    typeof AdminUser.getPasswordResetRequestSelect === 'function'
      ? AdminUser.getPasswordResetRequestSelect()
      : '+passwordResetTokenHash +passwordResetExpiresAt +passwordResetUsedAt +tokenVersion';

  return AdminUser.findOne({
    deletedAt: null,
    $or: [{ username: cleanLogin }, { email: cleanLogin }],
  }).select(selectFields);
}

async function verifyAdminToken(req) {
  if (!isJwtConfigured()) {
    return {
      ok: false,
      status: 500,
      message: 'JWT_SECRET no configurado.',
    };
  }

  const { token } = getAccessCredential(req);

  if (!token) {
    return {
      ok: false,
      status: 401,
      message: 'Token no enviado.',
    };
  }

  try {
    const decoded = verifyAccessToken(token);
    const adminSession = await loadActiveSession(decoded, { req });

    if (!adminSession) {
      return {
        ok: false,
        status: 401,
        message: 'La sesión expiró o fue revocada. Inicia sesión nuevamente.',
      };
    }

    if (decoded.authType === 'db' || decoded.adminUserId) {
      const adminUser = await findAdminUserForToken(decoded);

      if (!adminUser) {
        return {
          ok: false,
          status: 401,
          message: 'Usuario administrativo no encontrado.',
        };
      }

      if (typeof adminUser.releaseExpiredLoginLock === 'function') {
        await adminUser.releaseExpiredLoginLock();
      }

      if (typeof adminUser.isAccountLocked === 'function' && adminUser.isAccountLocked()) {
        return {
          ok: false,
          status: 423,
          message: 'Usuario administrativo bloqueado temporalmente.',
        };
      }

      if (adminUser.deletedAt || adminUser.active !== true || adminUser.status !== 'active') {
        return {
          ok: false,
          status: 403,
          message: 'Usuario administrativo inactivo o bloqueado.',
        };
      }

      const currentTokenVersion = Number(adminUser.tokenVersion || 0);
      const decodedTokenVersion = Number(decoded.tokenVersion || 0);

      if (currentTokenVersion !== decodedTokenVersion) {
        return {
          ok: false,
          status: 401,
          message: 'La sesión ya no es válida. Inicia sesión nuevamente.',
        };
      }

      return {
        ok: true,
        decoded,
        adminSession,
        adminUser,
        user: buildUserResponseFromDb(adminUser),
      };
    }

    if (decoded.role !== 'admin') {
      return {
        ok: false,
        status: 403,
        message: 'Token sin permisos administrativos.',
      };
    }

    if (!isLegacyAdminAuthEnabled()) {
      return {
        ok: false,
        status: 403,
        message: 'La autenticación administrativa heredada está deshabilitada.',
      };
    }

    return {
      ok: true,
      decoded,
      adminSession,
      adminUser: null,
      user: buildUserResponseFromLegacy(decoded.username),
    };
  } catch {
    return {
      ok: false,
      status: 401,
      message: 'Token inválido o expirado.',
    };
  }
}

async function loginWithDatabaseUser(req, { cleanUsername, cleanPassword }) {
  const adminUser = await AdminUser.findByLogin(cleanUsername);
  if (adminUser) {
    await adminUser.populate('roleRef', 'name code level scope permissions');
  }

  if (!adminUser) {
    return {
      ok: false,
      found: false,
    };
  }

  if (adminUser.deletedAt) {
    return {
      ok: false,
      found: true,
      status: 403,
      reason: 'user_deleted',
      message: 'Usuario administrativo no disponible.',
    };
  }

  if (typeof adminUser.releaseExpiredLoginLock === 'function') {
    await adminUser.releaseExpiredLoginLock();
  }

  if (adminUser.isAccountLocked()) {
    const seconds = Math.ceil(
      (adminUser.lockedUntil.getTime() - Date.now()) / 1000
    );

    return {
      ok: false,
      found: true,
      status: 423,
      reason: 'account_locked',
      message: `Usuario bloqueado temporalmente. Intenta nuevamente en ${seconds} segundos.`,
      retryAfterSeconds: seconds,
    };
  }

  if (adminUser.active !== true || adminUser.status !== 'active') {
    return {
      ok: false,
      found: true,
      status: 403,
      reason: 'user_inactive',
      message: 'Usuario administrativo inactivo o bloqueado.',
    };
  }

  const isPasswordValid = await adminUser.comparePassword(cleanPassword);

  if (!isPasswordValid) {
    await adminUser.registerFailedLogin();

    return {
      ok: false,
      found: true,
      status: 401,
      reason: 'invalid_password',
      message: 'Credenciales inválidas.',
    };
  }

  return {
    ok: true,
    found: true,
    adminUser,
    user: buildUserResponseFromDb(adminUser),
  };
}

async function loginWithLegacyEnv({ cleanUsername, cleanPassword }) {
  if (!isLegacyAdminConfigured()) {
    return {
      ok: false,
      found: false,
    };
  }

  const isUserValid = cleanUsername === ADMIN_USER;
  const isPasswordValid = isUserValid
    ? await bcrypt.compare(cleanPassword, ADMIN_PASSWORD_HASH)
    : false;

  if (!isUserValid || !isPasswordValid) {
    return {
      ok: false,
      found: true,
      status: 401,
      reason: 'invalid_legacy_credentials',
      message: 'Credenciales inválidas.',
    };
  }

  return {
    ok: true,
    found: true,
    user: buildUserResponseFromLegacy(cleanUsername),
  };
}

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  const cleanUsername = String(username || '').trim();
  const cleanPassword = String(password || '');

  try {
    if (!isJwtConfigured()) {
      await saveLoginAudit(req, {
        username: cleanUsername,
        status: 'error',
        reason: 'jwt_secret_not_configured',
      });

      return res.status(500).json({
        ok: false,
        message: 'JWT_SECRET no configurado en el servidor.',
      });
    }

    const attemptKey = getAttemptKey(req, cleanUsername);
    const attemptState = getAttemptState(attemptKey);

    if (attemptState.lockedUntil > Date.now()) {
      const seconds = Math.ceil((attemptState.lockedUntil - Date.now()) / 1000);

      await saveLoginAudit(req, {
        username: cleanUsername,
        status: 'blocked',
        reason: 'too_many_failed_attempts',
      });

      return res.status(429).json(getLockResponse(seconds));
    }

    if (!cleanUsername || !cleanPassword) {
      registerFailedAttempt(attemptKey);

      await saveLoginAudit(req, {
        username: cleanUsername,
        status: 'failed',
        reason: 'missing_credentials',
      });

      return res.status(400).json({
        ok: false,
        message: 'Credenciales requeridas.',
      });
    }

    const dbLoginResult = await loginWithDatabaseUser(req, {
      cleanUsername,
      cleanPassword,
    });

    if (dbLoginResult.ok) {
      clearAttempts(attemptKey);

      if (dbLoginResult.adminUser.twoFactorEnabled === true) {
        dbLoginResult.adminUser.failedLoginAttempts = 0;
        dbLoginResult.adminUser.lockedUntil = null;
        await dbLoginResult.adminUser.save({ validateBeforeSave: false });

        const challenge = await createLoginChallenge(
          req,
          res,
          dbLoginResult.adminUser
        );

        await saveLoginAudit(req, {
          adminUserId: dbLoginResult.adminUser._id,
          username: dbLoginResult.user.username,
          status: 'pending',
          reason: 'password_verified_2fa_required',
        });

        return res.status(202).json({
          ok: true,
          requiresTwoFactor: true,
          message: 'Escribe el código de tu aplicación de autenticación.',
          challenge: {
            expiresAt: challenge.expiresAt,
            maxAttempts: challenge.maxAttempts,
          },
          user: {
            username: dbLoginResult.user.username,
            displayName: dbLoginResult.user.displayName,
          },
        });
      }

      await dbLoginResult.adminUser.resetLoginSecurity({
        ip: getClientIp(req),
        userAgent: getUserAgent(req),
      });
      clearTwoFactorChallengeCookie(res);

      const sessionResult = await startAdminSession({
        req,
        res,
        tokenPayload: buildDbTokenPayload(dbLoginResult.adminUser),
        adminUserId: dbLoginResult.adminUser._id,
        authType: 'db',
        username: dbLoginResult.adminUser.username,
        tokenVersion: dbLoginResult.adminUser.tokenVersion,
      });

      await saveLoginAudit(req, {
        adminUserId: dbLoginResult.adminUser._id,
        username: dbLoginResult.user.username,
        status: 'success',
        reason: 'db_login_success',
      });

      return res.json({
        ok: true,
        message: 'Login exitoso.',
        user: dbLoginResult.user,
        session: {
          expiresAt: sessionResult.expiresAt,
          accessExpiresInSeconds: sessionResult.accessExpiresInSeconds,
        },
      });
    }

    if (dbLoginResult.found) {
      const failedState = registerFailedAttempt(attemptKey);

      await saveLoginAudit(req, {
        username: cleanUsername,
        status:
          dbLoginResult.status === 423 || failedState.lockedUntil > Date.now()
            ? 'blocked'
            : 'failed',
        reason: dbLoginResult.reason || 'db_login_failed',
      });

      if (failedState.lockedUntil > Date.now()) {
        const seconds = Math.ceil((failedState.lockedUntil - Date.now()) / 1000);

        return res.status(429).json(getLockResponse(seconds));
      }

      return res.status(dbLoginResult.status || 401).json({
        ok: false,
        message: dbLoginResult.message || 'Credenciales inválidas.',
        retryAfterSeconds: dbLoginResult.retryAfterSeconds,
      });
    }

    const legacyLoginResult = await loginWithLegacyEnv({
      cleanUsername,
      cleanPassword,
    });

    if (legacyLoginResult.ok) {
      clearAttempts(attemptKey);
      clearTwoFactorChallengeCookie(res);

      const sessionResult = await startAdminSession({
        req,
        res,
        tokenPayload: buildLegacyTokenPayload(cleanUsername),
        authType: 'legacy',
        username: cleanUsername,
        tokenVersion: 0,
      });

      await saveLoginAudit(req, {
        username: cleanUsername,
        status: 'success',
        reason: 'legacy_login_success',
      });

      return res.json({
        ok: true,
        message: 'Login exitoso.',
        user: legacyLoginResult.user,
        session: {
          expiresAt: sessionResult.expiresAt,
          accessExpiresInSeconds: sessionResult.accessExpiresInSeconds,
        },
      });
    }

    const failedState = registerFailedAttempt(attemptKey);

    if (failedState.lockedUntil > Date.now()) {
      const seconds = Math.ceil((failedState.lockedUntil - Date.now()) / 1000);

      await saveLoginAudit(req, {
        username: cleanUsername,
        status: 'blocked',
        reason: 'max_attempts_reached',
      });

      return res.status(429).json(getLockResponse(seconds));
    }

    await saveLoginAudit(req, {
      username: cleanUsername,
      status: 'failed',
      reason: 'invalid_credentials',
    });

    return res.status(401).json({
      ok: false,
      message: 'Credenciales inválidas.',
    });
  } catch (error) {
    console.error('❌ Error en login admin:', error.message);

    await saveLoginAudit(req, {
      username: cleanUsername,
      status: 'error',
      reason: 'internal_server_error',
    });

    return res.status(500).json({
      ok: false,
      message: 'Error interno al iniciar sesión.',
    });
  }
});

router.post('/2fa/verify', async (req, res) => {
  const code = String(req.body?.code || '').trim();

  try {
    if (!code) {
      return res.status(400).json({
        ok: false,
        message: 'Escribe el código de autenticación o un código de recuperación.',
      });
    }

    const verification = await verifyLoginChallenge(req, res, code);

    if (!verification.ok) {
      const expiredReasons = new Set([
        'missing_challenge',
        'invalid_challenge',
        'challenge_expired',
        'challenge_consumed',
        'attempts_exhausted',
        'user_invalid',
        'secret_invalid',
        'recovery_code_used',
      ]);
      const challengeEnded = expiredReasons.has(verification.reason);

      await saveLoginAudit(req, {
        username: verification.username || '',
        status: challengeEnded ? 'blocked' : 'failed',
        reason: `two_factor_${verification.reason || 'verification_failed'}`,
      });

      return res.status(challengeEnded ? 401 : 400).json({
        ok: false,
        challengeEnded,
        remainingAttempts: verification.remainingAttempts,
        message: challengeEnded
          ? 'El desafío de seguridad terminó. Inicia sesión nuevamente.'
          : `Código incorrecto. Te quedan ${verification.remainingAttempts} intento(s).`,
      });
    }

    const { adminUser } = verification;
    await adminUser.resetLoginSecurity({
      ip: getClientIp(req),
      userAgent: getUserAgent(req),
    });

    const sessionResult = await startAdminSession({
      req,
      res,
      tokenPayload: buildDbTokenPayload(adminUser),
      adminUserId: adminUser._id,
      authType: 'db',
      username: adminUser.username,
      tokenVersion: adminUser.tokenVersion,
    });

    await saveLoginAudit(req, {
      adminUserId: adminUser._id,
      username: adminUser.username,
      status: 'success',
      reason: verification.recoveryCodeUsed
        ? 'two_factor_recovery_login_success'
        : 'two_factor_totp_login_success',
    });

    return res.json({
      ok: true,
      message: 'Segundo factor verificado.',
      recoveryCodeUsed: verification.recoveryCodeUsed,
      user: buildUserResponseFromDb(adminUser),
      session: {
        expiresAt: sessionResult.expiresAt,
        accessExpiresInSeconds: sessionResult.accessExpiresInSeconds,
      },
    });
  } catch (error) {
    console.error('❌ Error verificando segundo factor:', error.message);
    clearTwoFactorChallengeCookie(res);
    return res.status(500).json({
      ok: false,
      message: 'No se pudo verificar el segundo factor.',
    });
  }
});

router.post('/2fa/cancel', async (req, res) => {
  try {
    await cancelLoginChallenge(req, res);
  } catch (error) {
    console.error('❌ Error cancelando desafío 2FA:', error.message);
    clearTwoFactorChallengeCookie(res);
  }
  return res.json({ ok: true });
});

router.get('/2fa/status', requireAdmin, async (req, res) => {
  try {
    const adminUser = await findAdminUserForTwoFactor({
      adminUserId: req.adminUserId,
    });
    if (!adminUser) {
      return res.status(404).json({ ok: false, message: 'Usuario no encontrado.' });
    }

    const pendingActive = Boolean(
      adminUser.twoFactorPendingSecret &&
        adminUser.twoFactorPendingExpiresAt &&
        new Date(adminUser.twoFactorPendingExpiresAt).getTime() > Date.now()
    );
    const policy = buildTwoFactorPolicy(adminUser);
    const isOwner = String(adminUser.role || '').trim().toLowerCase() === 'owner';

    return res.json({
      ok: true,
      twoFactor: {
        enabled: Boolean(adminUser.twoFactorEnabled),
        enabledAt: adminUser.twoFactorEnabledAt || null,
        lastUsedAt: adminUser.twoFactorLastUsedAt || null,
        recoveryCodesRemaining: (adminUser.twoFactorRecoveryCodeHashes || []).length,
        setupPending: pendingActive,
        requirement: policy.requirement,
        requirementSource: policy.requirementSource,
        required: policy.required,
        compliant: policy.compliant,
        requiredRoles: policy.requiredRoles,
        configuredRequired: policy.configuredRequired,
        enforcementReady: policy.enforcementReady,
        misconfigured: policy.misconfigured,
        canSelfActivate: isOwner || policy.configuredRequired,
        canSelfDisable: isOwner && !policy.required,
        managedByOwner: !isOwner,
      },
    });
  } catch (error) {
    console.error('❌ Error consultando estado 2FA:', error.message);
    return res.status(500).json({ ok: false, message: 'No se pudo consultar el 2FA.' });
  }
});

router.post('/2fa/setup', requireAdmin, async (req, res) => {
  let authResult;
  try {
    const adminUser = await findAdminUserForTwoFactor({
      adminUserId: req.adminUserId,
    });
    authResult = { adminUser };
    if (!adminUser) {
      return res.status(404).json({ ok: false, message: 'Usuario no encontrado.' });
    }
    if (adminUser.twoFactorEnabled) {
      return res.status(409).json({ ok: false, message: 'El segundo factor ya está activo.' });
    }
    const policy = buildTwoFactorPolicy(adminUser);
    const isOwner = String(adminUser.role || '').trim().toLowerCase() === 'owner';
    if (!isOwner && !policy.configuredRequired) {
      await saveTwoFactorAudit(req, authResult, {
        action: '2fa.setup.blocked_by_owner_policy',
        success: false,
        description: 'La política del propietario impidió activar el segundo factor.',
        statusCode: 403,
      });
      return res.status(403).json({
        ok: false,
        message: 'Solo el propietario puede habilitar el 2FA para tu usuario.',
      });
    }

    const currentLock = getTwoFactorManagementLock(adminUser);
    if (currentLock) {
      return res.status(429).json({
        ok: false,
        retryAfterSeconds: currentLock.retryAfterSeconds,
        message: `Demasiados intentos. Intenta nuevamente en ${currentLock.retryAfterSeconds} segundos.`,
      });
    }

    const currentPassword = String(req.body?.currentPassword || '');
    if (!currentPassword || !(await adminUser.comparePassword(currentPassword))) {
      const lock = await registerTwoFactorManagementFailure(adminUser);
      await saveTwoFactorAudit(req, authResult, {
        action: '2fa.setup.request',
        success: false,
        description: 'Contraseña inválida al iniciar configuración 2FA.',
        statusCode: lock ? 429 : 403,
      });
      return res.status(lock ? 429 : 403).json({
        ok: false,
        retryAfterSeconds: lock?.retryAfterSeconds,
        message: lock
          ? `Demasiados intentos. Intenta nuevamente en ${lock.retryAfterSeconds} segundos.`
          : 'La contraseña actual no es válida.',
      });
    }

    await clearTwoFactorManagementFailures(adminUser);

    const secret = generateTotpSecret();
    const issuer = String(process.env.ADMIN_2FA_ISSUER || 'Tienda Virtual').trim();
    const otpauthUrl = buildTotpUri({
      secret,
      username: adminUser.email || adminUser.username,
      issuer,
    });
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 280,
    });

    adminUser.twoFactorPendingSecret = encryptTwoFactorSecret(secret);
    adminUser.twoFactorPendingExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    adminUser.twoFactorPendingAttempts = 0;
    await adminUser.save({ validateBeforeSave: false });

    await saveTwoFactorAudit(req, authResult, {
      action: '2fa.setup.request',
      success: true,
      description: 'Configuración 2FA iniciada.',
    });

    return res.json({
      ok: true,
      setup: {
        qrCodeDataUrl,
        manualSecret: secret,
        expiresAt: adminUser.twoFactorPendingExpiresAt,
        issuer,
      },
    });
  } catch (error) {
    console.error('❌ Error iniciando configuración 2FA:', error.message);
    await saveTwoFactorAudit(req, authResult, {
      action: '2fa.setup.request',
      success: false,
      description: 'Error al iniciar configuración 2FA.',
      errorMessage: error.message,
      statusCode: error.code === 'ADMIN_2FA_KEY_MISSING' ? 503 : 500,
    });
    const misconfigured = error.code === 'ADMIN_2FA_KEY_MISSING';
    return res.status(misconfigured ? 503 : 500).json({
      ok: false,
      message: misconfigured
        ? 'El servidor aún no tiene configurada la clave segura para 2FA.'
        : 'No se pudo iniciar la configuración 2FA.',
    });
  }
});

router.post('/2fa/confirm', requireAdmin, async (req, res) => {
  let authResult;
  try {
    const adminUser = await findAdminUserForTwoFactor({
      adminUserId: req.adminUserId,
    });
    authResult = { adminUser };
    if (!adminUser) {
      return res.status(404).json({ ok: false, message: 'Usuario no encontrado.' });
    }
    if (adminUser.twoFactorEnabled) {
      return res.status(409).json({ ok: false, message: 'El segundo factor ya está activo.' });
    }
    const policy = buildTwoFactorPolicy(adminUser);
    const isOwner = String(adminUser.role || '').trim().toLowerCase() === 'owner';
    if (!isOwner && !policy.configuredRequired) {
      adminUser.twoFactorPendingSecret = '';
      adminUser.twoFactorPendingExpiresAt = null;
      adminUser.twoFactorPendingAttempts = 0;
      await adminUser.save({ validateBeforeSave: false });
      return res.status(403).json({
        ok: false,
        message: 'El propietario ya no autoriza activar el 2FA para tu usuario.',
      });
    }
    if (
      !adminUser.twoFactorPendingSecret ||
      !adminUser.twoFactorPendingExpiresAt ||
      new Date(adminUser.twoFactorPendingExpiresAt).getTime() <= Date.now()
    ) {
      adminUser.twoFactorPendingSecret = '';
      adminUser.twoFactorPendingExpiresAt = null;
      adminUser.twoFactorPendingAttempts = 0;
      await adminUser.save({ validateBeforeSave: false });
      return res.status(400).json({
        ok: false,
        setupExpired: true,
        message: 'La configuración venció. Iníciala nuevamente.',
      });
    }

    const secret = decryptTwoFactorSecret(adminUser.twoFactorPendingSecret);
    const code = String(req.body?.code || '').trim();
    if (!verifyTotp(secret, code)) {
      adminUser.twoFactorPendingAttempts = Math.min(
        5,
        Number(adminUser.twoFactorPendingAttempts || 0) + 1
      );
      const remainingAttempts = Math.max(0, 5 - adminUser.twoFactorPendingAttempts);
      if (remainingAttempts === 0) {
        adminUser.twoFactorPendingSecret = '';
        adminUser.twoFactorPendingExpiresAt = null;
      }
      await adminUser.save({ validateBeforeSave: false });

      await saveTwoFactorAudit(req, authResult, {
        action: '2fa.setup.confirm',
        success: false,
        description: 'Código inválido al confirmar configuración 2FA.',
        metadata: { remainingAttempts },
        statusCode: 400,
      });

      return res.status(400).json({
        ok: false,
        setupExpired: remainingAttempts === 0,
        remainingAttempts,
        message:
          remainingAttempts === 0
            ? 'Se agotaron los intentos. Inicia la configuración nuevamente.'
            : `Código incorrecto. Te quedan ${remainingAttempts} intento(s).`,
      });
    }

    const recoveryCodes = generateRecoveryCodes(10);
    adminUser.twoFactorSecret = adminUser.twoFactorPendingSecret;
    adminUser.twoFactorPendingSecret = '';
    adminUser.twoFactorPendingExpiresAt = null;
    adminUser.twoFactorPendingAttempts = 0;
    adminUser.twoFactorRecoveryCodeHashes = recoveryCodes.map(hashRecoveryCode);
    adminUser.twoFactorEnabled = true;
    adminUser.twoFactorEnabledAt = new Date();
    adminUser.twoFactorLastUsedAt = new Date();
    await adminUser.save({ validateBeforeSave: false });

    await revokeOtherUserSessions(
      adminUser._id,
      req.adminSessionId,
      'two_factor_enabled'
    );
    await saveTwoFactorAudit(req, authResult, {
      action: '2fa.setup.confirm',
      success: true,
      description: 'Segundo factor habilitado.',
      metadata: { recoveryCodesGenerated: recoveryCodes.length },
    });

    return res.json({
      ok: true,
      message: 'Segundo factor activado correctamente.',
      recoveryCodes,
      twoFactor: {
        enabled: true,
        enabledAt: adminUser.twoFactorEnabledAt,
        recoveryCodesRemaining: recoveryCodes.length,
      },
    });
  } catch (error) {
    console.error('❌ Error confirmando configuración 2FA:', error.message);
    return res.status(500).json({ ok: false, message: 'No se pudo activar el 2FA.' });
  }
});

router.post('/2fa/reconfigure', requireAdmin, async (req, res) => {
  let authResult;
  try {
    const adminUser = await findAdminUserForTwoFactor({
      adminUserId: req.adminUserId,
    });
    authResult = { adminUser };
    if (!adminUser) {
      return res.status(404).json({ ok: false, message: 'Usuario no encontrado.' });
    }
    if (!adminUser.twoFactorEnabled || !adminUser.twoFactorSecret) {
      return res.status(409).json({
        ok: false,
        message: 'Activa primero el segundo factor antes de cambiar la aplicación.',
      });
    }

    const verification = await verifyTwoFactorManagementCredentials(adminUser, {
      currentPassword: String(req.body?.currentPassword || ''),
      code: String(req.body?.code || ''),
    });
    if (!verification.ok) {
      await saveTwoFactorAudit(req, authResult, {
        action: '2fa.reconfigure.request',
        success: false,
        description: 'Credenciales inválidas al iniciar el cambio de aplicación 2FA.',
        statusCode: verification.retryAfterSeconds ? 429 : 403,
      });
      return res.status(verification.retryAfterSeconds ? 429 : 403).json({
        ok: false,
        retryAfterSeconds: verification.retryAfterSeconds,
        message: verification.retryAfterSeconds
          ? `Demasiados intentos. Intenta nuevamente en ${verification.retryAfterSeconds} segundos.`
          : 'La contraseña o el código de seguridad actual no son válidos.',
      });
    }

    const secret = generateTotpSecret();
    const issuer = String(process.env.ADMIN_2FA_ISSUER || 'Tienda Virtual').trim();
    const otpauthUrl = buildTotpUri({
      secret,
      username: adminUser.email || adminUser.username,
      issuer,
    });
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 280,
    });

    adminUser.twoFactorPendingSecret = encryptTwoFactorSecret(secret);
    adminUser.twoFactorPendingExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    adminUser.twoFactorPendingAttempts = 0;
    await adminUser.save({ validateBeforeSave: false });

    await saveTwoFactorAudit(req, authResult, {
      action: '2fa.reconfigure.request',
      success: true,
      description: 'Cambio de aplicación 2FA autorizado e iniciado.',
      metadata: { recoveryCodeUsed: verification.recoveryCodeUsed },
    });

    return res.json({
      ok: true,
      message: 'Escanea el nuevo código QR. La aplicación anterior seguirá activa hasta confirmar.',
      setup: {
        qrCodeDataUrl,
        manualSecret: secret,
        expiresAt: adminUser.twoFactorPendingExpiresAt,
        issuer,
      },
    });
  } catch (error) {
    console.error('❌ Error iniciando cambio de aplicación 2FA:', error.message);
    await saveTwoFactorAudit(req, authResult, {
      action: '2fa.reconfigure.request',
      success: false,
      description: 'Error al iniciar el cambio de aplicación 2FA.',
      errorMessage: error.message,
      statusCode: error.code === 'ADMIN_2FA_KEY_MISSING' ? 503 : 500,
    });
    const misconfigured = error.code === 'ADMIN_2FA_KEY_MISSING';
    return res.status(misconfigured ? 503 : 500).json({
      ok: false,
      message: misconfigured
        ? 'El servidor aún no tiene configurada la clave segura para 2FA.'
        : 'No se pudo iniciar el cambio de aplicación 2FA.',
    });
  }
});

router.post('/2fa/reconfigure/confirm', requireAdmin, async (req, res) => {
  let authResult;
  try {
    const adminUser = await findAdminUserForTwoFactor({
      adminUserId: req.adminUserId,
    });
    authResult = { adminUser };
    if (!adminUser) {
      return res.status(404).json({ ok: false, message: 'Usuario no encontrado.' });
    }
    if (!adminUser.twoFactorEnabled || !adminUser.twoFactorSecret) {
      return res.status(409).json({
        ok: false,
        message: 'El segundo factor actual ya no está activo.',
      });
    }
    if (
      !adminUser.twoFactorPendingSecret ||
      !adminUser.twoFactorPendingExpiresAt ||
      new Date(adminUser.twoFactorPendingExpiresAt).getTime() <= Date.now()
    ) {
      adminUser.twoFactorPendingSecret = '';
      adminUser.twoFactorPendingExpiresAt = null;
      adminUser.twoFactorPendingAttempts = 0;
      await adminUser.save({ validateBeforeSave: false });
      return res.status(400).json({
        ok: false,
        setupExpired: true,
        message: 'El cambio venció. La aplicación anterior continúa activa.',
      });
    }

    const pendingSecret = decryptTwoFactorSecret(adminUser.twoFactorPendingSecret);
    const code = String(req.body?.code || '').trim();
    if (!verifyTotp(pendingSecret, code)) {
      adminUser.twoFactorPendingAttempts = Math.min(
        5,
        Number(adminUser.twoFactorPendingAttempts || 0) + 1
      );
      const remainingAttempts = Math.max(0, 5 - adminUser.twoFactorPendingAttempts);
      if (remainingAttempts === 0) {
        adminUser.twoFactorPendingSecret = '';
        adminUser.twoFactorPendingExpiresAt = null;
      }
      await adminUser.save({ validateBeforeSave: false });

      await saveTwoFactorAudit(req, authResult, {
        action: '2fa.reconfigure.confirm',
        success: false,
        description: 'Código nuevo inválido al cambiar la aplicación 2FA.',
        metadata: { remainingAttempts },
        statusCode: 400,
      });

      return res.status(400).json({
        ok: false,
        setupExpired: remainingAttempts === 0,
        remainingAttempts,
        message:
          remainingAttempts === 0
            ? 'Se agotaron los intentos. La aplicación anterior continúa activa.'
            : `Código nuevo incorrecto. Te quedan ${remainingAttempts} intento(s).`,
      });
    }

    const recoveryCodes = generateRecoveryCodes(10);
    adminUser.twoFactorSecret = adminUser.twoFactorPendingSecret;
    adminUser.twoFactorPendingSecret = '';
    adminUser.twoFactorPendingExpiresAt = null;
    adminUser.twoFactorPendingAttempts = 0;
    adminUser.twoFactorRecoveryCodeHashes = recoveryCodes.map(hashRecoveryCode);
    adminUser.twoFactorLastUsedAt = new Date();
    await adminUser.save({ validateBeforeSave: false });

    await revokeOtherUserSessions(
      adminUser._id,
      req.adminSessionId,
      'two_factor_reconfigured'
    );
    await saveTwoFactorAudit(req, authResult, {
      action: '2fa.reconfigure.confirm',
      success: true,
      description: 'Aplicación 2FA cambiada de forma segura.',
      metadata: { recoveryCodesGenerated: recoveryCodes.length },
    });

    return res.json({
      ok: true,
      message: 'Aplicación 2FA cambiada correctamente. Guarda los nuevos códigos.',
      recoveryCodes,
      twoFactor: {
        enabled: true,
        enabledAt: adminUser.twoFactorEnabledAt,
        lastUsedAt: adminUser.twoFactorLastUsedAt,
        recoveryCodesRemaining: recoveryCodes.length,
        setupPending: false,
      },
    });
  } catch (error) {
    console.error('❌ Error confirmando cambio de aplicación 2FA:', error.message);
    await saveTwoFactorAudit(req, authResult, {
      action: '2fa.reconfigure.confirm',
      success: false,
      description: 'Error al confirmar el cambio de aplicación 2FA.',
      errorMessage: error.message,
      statusCode: 500,
    });
    return res.status(500).json({
      ok: false,
      message: 'No se pudo confirmar el cambio. La aplicación anterior continúa activa.',
    });
  }
});

router.post('/2fa/recovery-codes', requireAdmin, async (req, res) => {
  let authResult;
  try {
    const adminUser = await findAdminUserForTwoFactor({
      adminUserId: req.adminUserId,
    });
    authResult = { adminUser };
    if (!adminUser) {
      return res.status(404).json({ ok: false, message: 'Usuario no encontrado.' });
    }

    const verification = await verifyTwoFactorManagementCredentials(adminUser, {
      currentPassword: String(req.body?.currentPassword || ''),
      code: String(req.body?.code || ''),
    });
    if (!verification.ok) {
      await saveTwoFactorAudit(req, authResult, {
        action: '2fa.recovery_codes.regenerate',
        success: false,
        description: 'Credenciales inválidas al regenerar códigos de recuperación.',
        statusCode: verification.retryAfterSeconds ? 429 : 403,
      });
      return res.status(verification.retryAfterSeconds ? 429 : 403).json({
        ok: false,
        retryAfterSeconds: verification.retryAfterSeconds,
        message: verification.retryAfterSeconds
          ? `Demasiados intentos. Intenta nuevamente en ${verification.retryAfterSeconds} segundos.`
          : 'La contraseña o el código de seguridad no son válidos.',
      });
    }

    const recoveryCodes = generateRecoveryCodes(10);
    adminUser.twoFactorRecoveryCodeHashes = recoveryCodes.map(hashRecoveryCode);
    await adminUser.save({ validateBeforeSave: false });
    await revokeOtherUserSessions(
      adminUser._id,
      req.adminSessionId,
      'two_factor_recovery_codes_regenerated'
    );
    await saveTwoFactorAudit(req, authResult, {
      action: '2fa.recovery_codes.regenerate',
      success: true,
      description: 'Códigos de recuperación regenerados.',
      metadata: { recoveryCodeUsed: verification.recoveryCodeUsed },
    });

    return res.json({
      ok: true,
      message: 'Códigos de recuperación regenerados.',
      recoveryCodes,
    });
  } catch (error) {
    console.error('❌ Error regenerando códigos 2FA:', error.message);
    return res.status(500).json({ ok: false, message: 'No se pudieron regenerar los códigos.' });
  }
});

router.post('/2fa/disable', requireAdmin, async (req, res) => {
  let authResult;
  try {
    const adminUser = await findAdminUserForTwoFactor({
      adminUserId: req.adminUserId,
    });
    authResult = { adminUser };
    if (!adminUser) {
      return res.status(404).json({ ok: false, message: 'Usuario no encontrado.' });
    }

    const isOwner = String(adminUser.role || '').trim().toLowerCase() === 'owner';
    if (!isOwner) {
      await saveTwoFactorAudit(req, authResult, {
        action: '2fa.disable.blocked_by_owner_policy',
        success: false,
        description: 'Un usuario sin rol propietario intentó desactivar el segundo factor.',
        statusCode: 403,
      });
      return res.status(403).json({
        ok: false,
        message: 'Solo el propietario puede desactivar el 2FA de los usuarios.',
      });
    }

    const policy = buildTwoFactorPolicy(adminUser);
    if (policy.required) {
      await saveTwoFactorAudit(req, authResult, {
        action: '2fa.disable.blocked_by_policy',
        success: false,
        description: 'La política impidió desactivar el segundo factor.',
        statusCode: 409,
      });
      return res.status(409).json({
        ok: false,
        message: 'Tu perfil exige autenticación en dos pasos y no permite desactivarla.',
      });
    }

    const verification = await verifyTwoFactorManagementCredentials(adminUser, {
      currentPassword: String(req.body?.currentPassword || ''),
      code: String(req.body?.code || ''),
    });
    if (!verification.ok) {
      await saveTwoFactorAudit(req, authResult, {
        action: '2fa.disable',
        success: false,
        description: 'Credenciales inválidas al desactivar el segundo factor.',
        statusCode: verification.retryAfterSeconds ? 429 : 403,
      });
      return res.status(verification.retryAfterSeconds ? 429 : 403).json({
        ok: false,
        retryAfterSeconds: verification.retryAfterSeconds,
        message: verification.retryAfterSeconds
          ? `Demasiados intentos. Intenta nuevamente en ${verification.retryAfterSeconds} segundos.`
          : 'La contraseña o el código de seguridad no son válidos.',
      });
    }

    adminUser.twoFactorEnabled = false;
    adminUser.twoFactorSecret = '';
    adminUser.twoFactorPendingSecret = '';
    adminUser.twoFactorPendingExpiresAt = null;
    adminUser.twoFactorPendingAttempts = 0;
    adminUser.twoFactorRecoveryCodeHashes = [];
    adminUser.twoFactorEnabledAt = null;
    adminUser.twoFactorLastUsedAt = null;
    await adminUser.save({ validateBeforeSave: false });

    await revokeOtherUserSessions(
      adminUser._id,
      req.adminSessionId,
      'two_factor_disabled'
    );
    await saveTwoFactorAudit(req, authResult, {
      action: '2fa.disable',
      success: true,
      description: 'Segundo factor desactivado.',
      metadata: { recoveryCodeUsed: verification.recoveryCodeUsed },
    });

    return res.json({
      ok: true,
      message: 'Segundo factor desactivado.',
      twoFactor: { enabled: false, recoveryCodesRemaining: 0 },
    });
  } catch (error) {
    console.error('❌ Error desactivando 2FA:', error.message);
    return res.status(500).json({ ok: false, message: 'No se pudo desactivar el 2FA.' });
  }
});

router.post('/forgot-password', async (req, res) => {
  const cleanLogin = normalizeLogin(
    req.body?.login || req.body?.email || req.body?.username
  );

  const genericMessage =
    'Si existe un usuario administrativo activo con ese correo, enviaremos un enlace de recuperación.';

  try {
    if (!cleanLogin) {
      return res.status(400).json({
        ok: false,
        message: 'Debes escribir tu usuario o correo electrónico.',
      });
    }

    const requestLimit = checkPasswordResetAttemptLimit(req, cleanLogin);

    if (!requestLimit.allowed) {
      await saveLoginAudit(req, {
        username: cleanLogin,
        status: 'blocked',
        reason: requestLimit.reason,
      });

      return res.status(429).json({
        ok: false,
        message: requestLimit.message,
        retryAfterSeconds: requestLimit.retryAfterSeconds,
      });
    }

    const adminUser = await findAdminUserForPasswordResetRequest(cleanLogin);

    if (
      !adminUser ||
      adminUser.deletedAt ||
      adminUser.active !== true ||
      adminUser.status !== 'active' ||
      !adminUser.email
    ) {
      await saveLoginAudit(req, {
        username: cleanLogin,
        status: 'failed',
        reason: 'forgot_password_user_not_available',
      });

      registerPasswordResetAttempt(req, cleanLogin);

      return res.json({
        ok: true,
        message: genericMessage,
      });
    }

    if (
      typeof adminUser.getPasswordResetRequestLimitStatus === 'function' &&
      typeof adminUser.registerPasswordResetRequest === 'function'
    ) {
      const dbRequestLimit = adminUser.getPasswordResetRequestLimitStatus();

      if (!dbRequestLimit.allowed) {
        await saveLoginAudit(req, {
          username: adminUser.username,
          status: 'blocked',
          reason: dbRequestLimit.reason || 'password_reset_db_limit',
        });

        return res.status(429).json({
          ok: false,
          message: dbRequestLimit.message,
          retryAfterSeconds: dbRequestLimit.retryAfterSeconds,
        });
      }

      adminUser.registerPasswordResetRequest();
    }

    registerPasswordResetAttempt(req, cleanLogin);

    const rawToken = adminUser.createPasswordResetToken({
      minutes: PASSWORD_RESET_MINUTES,
    });

    await adminUser.save();

    const resetUrl = buildAdminResetPasswordUrl(rawToken);
    const safeName = escapeHtml(
      adminUser.displayName || adminUser.fullName || adminUser.username
    );

    await sendMail({
      to: adminUser.email,
      subject: 'Recuperación de contraseña - Panel administrativo',
      text: [
        `Hola ${adminUser.displayName || adminUser.username}.`,
        '',
        'Recibimos una solicitud para recuperar el acceso al panel administrativo.',
        `Abre este enlace para crear una nueva contraseña: ${resetUrl}`,
        '',
        `Este enlace vence en ${PASSWORD_RESET_MINUTES} minutos.`,
        '',
        'Si no solicitaste este cambio, puedes ignorar este mensaje.',
      ].join('\n'),
      html: `
        <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
          <h2 style="margin: 0 0 12px;">Recuperación de contraseña</h2>
          <p>Hola <strong>${safeName}</strong>.</p>
          <p>Recibimos una solicitud para recuperar el acceso al panel administrativo.</p>
          <p>
            <a
              href="${escapeHtml(resetUrl)}"
              style="display:inline-block;padding:12px 18px;border-radius:12px;background:#ec4899;color:#ffffff;text-decoration:none;font-weight:bold;"
            >
              Crear nueva contraseña
            </a>
          </p>
          <p>Este enlace vence en <strong>${PASSWORD_RESET_MINUTES} minutos</strong>.</p>
          <p style="font-size:13px;color:#666;">
            Si no solicitaste este cambio, puedes ignorar este mensaje.
          </p>
        </div>
      `,
    });

    await saveLoginAudit(req, {
      username: adminUser.username,
      status: 'success',
      reason: 'forgot_password_email_sent',
    });

    return res.json({
      ok: true,
      message: genericMessage,
    });
  } catch (error) {
    console.error('❌ Error en recuperación de contraseña admin:', error.message);

    await saveLoginAudit(req, {
      username: cleanLogin,
      status: 'error',
      reason: 'forgot_password_internal_error',
    });

    return res.status(500).json({
      ok: false,
      message: 'No se pudo procesar la recuperación de contraseña.',
    });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const token = String(req.body?.token || '').trim();
    const newPassword = String(req.body?.newPassword || '');
    const confirmPassword = String(req.body?.confirmPassword || '');

    const validationError = validateResetPasswordPayload({
      token,
      newPassword,
      confirmPassword,
    });

    if (validationError) {
      return res.status(400).json({
        ok: false,
        message: validationError,
      });
    }

    const adminUser = await AdminUser.findByPasswordResetToken(token);

    if (!adminUser || !adminUser.isPasswordResetTokenValid(token)) {
      await saveLoginAudit(req, {
        username: '',
        status: 'failed',
        reason: 'reset_password_invalid_or_expired_token',
      });

      return res.status(400).json({
        ok: false,
        message: 'El enlace de recuperación no es válido o ya venció.',
      });
    }

    const isSamePassword = await bcrypt.compare(newPassword, adminUser.passwordHash);

    if (isSamePassword) {
      return res.status(400).json({
        ok: false,
        message: 'La nueva contraseña debe ser diferente a la contraseña anterior.',
      });
    }

    await adminUser.setPassword(newPassword);

    adminUser.mustChangePassword = false;
    adminUser.failedLoginAttempts = 0;
    adminUser.lockedUntil = null;
    adminUser.status = 'active';
    adminUser.active = true;
    adminUser.updatedBy = adminUser._id;

    adminUser.clearPasswordResetToken({ markAsUsed: true });

    await adminUser.save();
    await adminUser.populate('roleRef', 'name code level scope permissions');
    await revokeAllUserSessions(adminUser._id, 'password_reset');

    if (adminUser.twoFactorEnabled === true) {
      clearSessionCookies(res);
      clearTwoFactorChallengeCookie(res);

      await saveLoginAudit(req, {
        adminUserId: adminUser._id,
        username: adminUser.username,
        status: 'success',
        reason: 'reset_password_success_2fa_login_required',
      });

      return res.json({
        ok: true,
        message: 'Contraseña actualizada. Inicia sesión y confirma tu segundo factor.',
        requiresLogin: true,
        requiresTwoFactorOnNextLogin: true,
      });
    }

    clearTwoFactorChallengeCookie(res);
    const sessionResult = await startAdminSession({
      req,
      res,
      tokenPayload: buildDbTokenPayload(adminUser),
      adminUserId: adminUser._id,
      authType: 'db',
      username: adminUser.username,
      tokenVersion: adminUser.tokenVersion,
    });

    await saveLoginAudit(req, {
      adminUserId: adminUser._id,
      username: adminUser.username,
      status: 'success',
      reason: 'reset_password_success',
    });

    return res.json({
      ok: true,
      message: 'Contraseña actualizada correctamente.',
      user: buildUserResponseFromDb(adminUser),
      session: {
        expiresAt: sessionResult.expiresAt,
        accessExpiresInSeconds: sessionResult.accessExpiresInSeconds,
      },
    });
  } catch (error) {
    console.error('❌ Error restableciendo contraseña admin:', error.message);

    return res.status(500).json({
      ok: false,
      message: error.message || 'No se pudo restablecer la contraseña.',
    });
  }
});

router.post('/change-password-required', async (req, res) => {
  try {
    const authResult = await verifyAdminToken(req);

    if (!authResult.ok) {
      return res.status(authResult.status || 401).json({
        ok: false,
        message: authResult.message,
      });
    }

    if (!authResult.decoded?.adminUserId) {
      return res.status(400).json({
        ok: false,
        message: 'El cambio obligatorio de contraseña solo aplica para usuarios administrativos registrados en base de datos.',
      });
    }

    const adminUser = await findAdminUserForPasswordChange(authResult.decoded);

    if (!adminUser) {
      return res.status(404).json({
        ok: false,
        message: 'Usuario administrativo no encontrado.',
      });
    }

    if (adminUser.deletedAt || adminUser.active !== true || adminUser.status !== 'active') {
      return res.status(403).json({
        ok: false,
        message: 'Usuario administrativo inactivo o bloqueado.',
      });
    }

    if (adminUser.mustChangePassword !== true) {
      return res.status(400).json({
        ok: false,
        message: 'Este usuario no tiene cambio obligatorio de contraseña pendiente.',
      });
    }

    const currentPassword = String(req.body?.currentPassword || '');
    const newPassword = String(req.body?.newPassword || '');
    const confirmPassword = String(req.body?.confirmPassword || '');

    const validationError = validateRequiredPasswordChangePayload({
      currentPassword,
      newPassword,
      confirmPassword,
    });

    if (validationError) {
      return res.status(400).json({
        ok: false,
        message: validationError,
      });
    }

    const isCurrentPasswordValid = await adminUser.comparePassword(currentPassword);

    if (!isCurrentPasswordValid) {
      await saveLoginAudit(req, {
        username: adminUser.username,
        status: 'failed',
        reason: 'required_password_change_invalid_current_password',
      });

      return res.status(401).json({
        ok: false,
        message: 'La contraseña temporal actual no es válida.',
      });
    }

    const isSamePassword = await bcrypt.compare(newPassword, adminUser.passwordHash);

    if (isSamePassword) {
      return res.status(400).json({
        ok: false,
        message: 'La nueva contraseña debe ser diferente a la contraseña temporal.',
      });
    }

    await adminUser.setPassword(newPassword);
    adminUser.failedLoginAttempts = 0;
    adminUser.lockedUntil = null;
    adminUser.updatedBy = adminUser._id;

    await adminUser.save();
    await adminUser.populate('roleRef', 'name code level scope permissions');
    await revokeAllUserSessions(adminUser._id, 'required_password_changed');
    const sessionResult = await startAdminSession({
      req,
      res,
      tokenPayload: buildDbTokenPayload(adminUser),
      adminUserId: adminUser._id,
      authType: 'db',
      username: adminUser.username,
      tokenVersion: adminUser.tokenVersion,
    });

    await saveLoginAudit(req, {
      adminUserId: adminUser._id,
      username: adminUser.username,
      status: 'success',
      reason: 'required_password_change_success',
    });

    return res.json({
      ok: true,
      message: 'Contraseña actualizada correctamente.',
      user: buildUserResponseFromDb(adminUser),
      session: {
        expiresAt: sessionResult.expiresAt,
        accessExpiresInSeconds: sessionResult.accessExpiresInSeconds,
      },
    });
  } catch (error) {
    console.error('❌ Error en cambio obligatorio de contraseña:', error.message);

    return res.status(500).json({
      ok: false,
      message: 'Error interno al cambiar la contraseña.',
    });
  }
});

async function resolveRotatedAdminIdentity(req, refreshResult) {
  const { session, refreshToken } = refreshResult;

  if (session.authType === 'db') {
    const adminUser = await findAdminUserForToken({
      adminUserId: session.adminUser,
    });

    const invalidUser =
      !adminUser ||
      adminUser.deletedAt ||
      adminUser.active !== true ||
      adminUser.status !== 'active' ||
      Number(adminUser.tokenVersion || 0) !== Number(session.tokenVersion || 0);

    if (invalidUser) {
      await revokeRequestSession(req, 'user_invalid_or_security_changed');
      return {
        ok: false,
        message: 'La sesión ya no es válida. Inicia sesión nuevamente.',
      };
    }

    return {
      ok: true,
      session,
      refreshToken,
      tokenPayload: buildDbTokenPayload(adminUser),
      user: buildUserResponseFromDb(adminUser),
    };
  }

  if (!isLegacyAdminAuthEnabled()) {
    await revokeRequestSession(req, 'legacy_auth_disabled');
    return {
      ok: false,
      message: 'La autenticación administrativa heredada está deshabilitada.',
    };
  }

  return {
    ok: true,
    session,
    refreshToken,
    tokenPayload: buildLegacyTokenPayload(session.username),
    user: buildUserResponseFromLegacy(session.username),
  };
}

async function issueResolvedAdminSession(res, identity) {
  await issueRotatedSession(res, {
    session: identity.session,
    refreshToken: identity.refreshToken,
    tokenPayload: identity.tokenPayload,
  });
}

router.post('/refresh', async (req, res) => {
  try {
    const refreshResult = await rotateRefreshToken(req);

    if (!refreshResult.ok) {
      if (refreshResult.retryable) {
        return res.status(409).json({
          ok: false,
          code: 'SESSION_REFRESH_IN_PROGRESS',
          message: 'La sesión ya fue renovada en otra pestaña. Reintentando.',
        });
      }
      clearSessionCookies(res);
      return res.status(401).json({
        ok: false,
        message: 'La sesión expiró o fue revocada. Inicia sesión nuevamente.',
      });
    }

    const identity = await resolveRotatedAdminIdentity(req, refreshResult);
    if (!identity.ok) {
      clearSessionCookies(res);
      return res.status(401).json({ ok: false, message: identity.message });
    }

    await issueResolvedAdminSession(res, identity);

    return res.json({ ok: true, user: identity.user });
  } catch (error) {
    console.error('❌ Error renovando sesión admin:', error.message);
    clearSessionCookies(res);
    return res.status(401).json({
      ok: false,
      message: 'No se pudo renovar la sesión administrativa.',
    });
  }
});

router.post('/logout', async (req, res) => {
  try {
    await revokeRequestSession(req, 'logout');
    clearSessionCookies(res);
    clearTwoFactorChallengeCookie(res);
    return res.json({ ok: true, message: 'Sesión cerrada correctamente.' });
  } catch (error) {
    console.error('❌ Error revocando sesión admin:', error.message);
    // Conservar la cookie HttpOnly permite reintentar la revocación real.
    // El cliente bloquea el acceso al panel hasta recibir una confirmación.
    return res.status(503).json({ ok: false, message: 'No se pudo confirmar el cierre de sesión. Intenta nuevamente.' });
  }
});

router.post('/logout-all', requireAdmin, async (req, res) => {
  if (req.adminUserId) {
    await revokeAllUserSessions(req.adminUserId, 'logout_all');
  } else {
    await revokeRequestSession(req, 'logout_all');
  }
  clearSessionCookies(res);
  clearTwoFactorChallengeCookie(res);
  return res.json({ ok: true, message: 'Todas las sesiones fueron cerradas.' });
});

router.get('/security-center', requireAdmin, async (req, res) => {
  try {
    const adminUser = await findAdminUserForTwoFactor({
      adminUserId: req.adminUserId,
    });
    if (!adminUser) {
      return res.status(404).json({ ok: false, message: 'Usuario no encontrado.' });
    }

    const security = await getAdminSecurityCenter({
      adminUser,
      currentSessionId: req.adminSessionId,
    });
    return res.json({ ok: true, security });
  } catch (error) {
    console.error('❌ Error consultando centro de seguridad:', error.message);
    return res.status(500).json({
      ok: false,
      message: 'No se pudo consultar el centro de seguridad.',
    });
  }
});

async function findAccessibleSecurityAlert(alertId, adminUser) {
  if (!mongoose.isValidObjectId(alertId) || !adminUser?._id) return null;
  const isOwner = String(adminUser.role || '').toLowerCase() === 'owner';
  const filter = { _id: alertId };
  if (!isOwner) {
    filter.$or = [
      { adminUser: adminUser._id },
      { adminUser: null, username: String(adminUser.username || '').toLowerCase() },
    ];
  }
  return AdminSecurityAlert.findOne(filter)
    .populate('adminUser', 'username role active status')
    .populate('adminSession', '+sessionId revokedAt expiresAt idleExpiresAt');
}

router.patch('/security-alerts/:alertId/review', requireAdmin, async (req, res) => {
  try {
    const adminUser = await findAdminUserForTwoFactor({ adminUserId: req.adminUserId });
    if (!adminUser) {
      return res.status(404).json({ ok: false, message: 'Usuario no encontrado.' });
    }
    const alert = await findAccessibleSecurityAlert(req.params.alertId, adminUser);
    if (!alert) {
      return res.status(404).json({ ok: false, message: 'Alerta no encontrada.' });
    }

    if (alert.status === 'open') {
      alert.status = 'reviewed';
      alert.reviewedAt = new Date();
      alert.reviewedBy = adminUser._id;
      await alert.save();
    }
    await saveTwoFactorAudit(req, { adminUser }, {
      action: 'security_alert.reviewed',
      permission: 'seguridad:alertas',
      success: true,
      description: 'Alerta de seguridad marcada como revisada.',
      metadata: { alertId: String(alert._id), alertType: alert.type },
    });

    return res.json({ ok: true, message: 'Alerta marcada como revisada.' });
  } catch (error) {
    console.error('❌ Error revisando alerta de seguridad:', error.message);
    return res.status(500).json({ ok: false, message: 'No se pudo revisar la alerta.' });
  }
});

router.post('/security-alerts/:alertId/respond', requireAdmin, async (req, res) => {
  const allowedActions = new Set(['resolve', 'revoke_session', 'revoke_all', 'block_user']);
  const responseAction = String(req.body?.action || '').trim().toLowerCase();
  const reason = normalizeText(req.body?.reason).slice(0, 500);
  let authResult;

  try {
    if (!allowedActions.has(responseAction)) {
      return res.status(400).json({ ok: false, message: 'La acción de respuesta no es válida.' });
    }
    if (reason.length < 8) {
      return res.status(400).json({
        ok: false,
        message: 'Describe el motivo de la respuesta con al menos 8 caracteres.',
      });
    }

    const adminUser = await findAdminUserForTwoFactor({ adminUserId: req.adminUserId });
    authResult = { adminUser };
    if (!adminUser) {
      return res.status(404).json({ ok: false, message: 'Usuario no encontrado.' });
    }
    const alert = await findAccessibleSecurityAlert(req.params.alertId, adminUser);
    if (!alert) {
      return res.status(404).json({ ok: false, message: 'Alerta no encontrada.' });
    }
    if (alert.status === 'resolved') {
      return res.status(409).json({ ok: false, message: 'La alerta ya fue resuelta.' });
    }

    const verification = await verifySecurityActionCredentials(adminUser, {
      currentPassword: String(req.body?.currentPassword || ''),
      code: String(req.body?.code || ''),
    });
    if (!verification.ok) {
      await saveTwoFactorAudit(req, authResult, {
        action: 'security_alert.response.denied',
        permission: 'seguridad:alertas',
        success: false,
        description: 'Credenciales rechazadas al responder una alerta de seguridad.',
        statusCode: verification.retryAfterSeconds ? 429 : 403,
        metadata: { alertId: String(alert._id), responseAction },
      });
      return res.status(verification.retryAfterSeconds ? 429 : 403).json({
        ok: false,
        retryAfterSeconds: verification.retryAfterSeconds,
        message: verification.retryAfterSeconds
          ? `Demasiados intentos. Intenta nuevamente en ${verification.retryAfterSeconds} segundos.`
          : 'La contraseña o el código de seguridad no son válidos.',
      });
    }

    const isOwner = String(adminUser.role || '').toLowerCase() === 'owner';
    const targetUser = alert.adminUser;
    const targetUserId = targetUser?._id || targetUser || null;
    const isOwnAlert = String(targetUserId || '') === String(adminUser._id);
    let currentSessionRevoked = false;

    if (responseAction === 'revoke_session') {
      if (!targetUserId || !alert.adminSession?._id) {
        return res.status(409).json({ ok: false, message: 'La alerta no tiene una sesión activa asociada.' });
      }
      const revoked = await revokeUserSessionByRecordId(
        targetUserId,
        alert.adminSession._id,
        'security_alert_response'
      );
      if (!revoked) {
        return res.status(409).json({ ok: false, message: 'La sesión ya no está activa.' });
      }
      currentSessionRevoked = String(revoked.sessionId || '') === String(req.adminSessionId || '');
    } else if (responseAction === 'revoke_all') {
      if (!targetUserId || (!isOwner && !isOwnAlert)) {
        return res.status(403).json({ ok: false, message: 'No puedes cerrar las sesiones de este usuario.' });
      }
      await revokeAllUserSessions(targetUserId, 'security_alert_response_all');
      currentSessionRevoked = isOwnAlert;
    } else if (responseAction === 'block_user') {
      if (!isOwner || !targetUserId || isOwnAlert || targetUser?.role === 'owner') {
        return res.status(403).json({
          ok: false,
          message: 'Solo el owner puede bloquear desde una alerta a un usuario que no sea owner.',
        });
      }
      const blockedUser = await AdminUser.updateOne(
        { _id: targetUserId, role: { $ne: 'owner' } },
        { $set: { active: false, status: 'blocked' }, $inc: { tokenVersion: 1 } }
      );
      if (!blockedUser.modifiedCount) {
        return res.status(409).json({
          ok: false,
          message: 'El usuario ya cambió o no puede bloquearse desde esta alerta.',
        });
      }
      await revokeAllUserSessions(targetUserId, 'security_alert_user_blocked');
    }

    const now = new Date();
    alert.status = 'resolved';
    alert.reviewedAt = alert.reviewedAt || now;
    alert.reviewedBy = alert.reviewedBy || adminUser._id;
    alert.resolvedAt = now;
    alert.resolvedBy = adminUser._id;
    alert.resolutionAction = responseAction;
    alert.resolutionReason = reason;
    await alert.save();

    if (currentSessionRevoked) clearSessionCookies(res);
    await saveTwoFactorAudit(req, authResult, {
      action: `security_alert.response.${responseAction}`,
      permission: 'seguridad:alertas',
      success: true,
      description: 'Se ejecutó una respuesta sobre una alerta de seguridad.',
      metadata: {
        alertId: String(alert._id),
        alertType: alert.type,
        responseAction,
        targetUsername: alert.username,
        recoveryCodeUsed: verification.recoveryCodeUsed,
      },
    });

    return res.json({
      ok: true,
      currentSessionRevoked,
      message: responseAction === 'resolve'
        ? 'Alerta resuelta y registrada.'
        : 'Respuesta de seguridad ejecutada y alerta resuelta.',
    });
  } catch (error) {
    console.error('❌ Error respondiendo alerta de seguridad:', error.message);
    return res.status(500).json({ ok: false, message: 'No se pudo responder la alerta.' });
  }
});

router.post('/sessions/revoke-others', requireAdmin, async (req, res) => {
  let authResult;
  try {
    const adminUser = await findAdminUserForTwoFactor({
      adminUserId: req.adminUserId,
    });
    authResult = { adminUser };
    if (!adminUser) {
      return res.status(404).json({ ok: false, message: 'Usuario no encontrado.' });
    }

    const verification = await verifySecurityActionCredentials(adminUser, {
      currentPassword: String(req.body?.currentPassword || ''),
      code: String(req.body?.code || ''),
    });
    if (!verification.ok) {
      await saveTwoFactorAudit(req, authResult, {
        action: 'sessions.revoke_others.denied',
        permission: 'seguridad:sesiones',
        success: false,
        description: 'Credenciales rechazadas al intentar cerrar otras sesiones.',
        statusCode: verification.retryAfterSeconds ? 429 : 403,
      });
      return res.status(verification.retryAfterSeconds ? 429 : 403).json({
        ok: false,
        retryAfterSeconds: verification.retryAfterSeconds,
        message: verification.retryAfterSeconds
          ? `Demasiados intentos. Intenta nuevamente en ${verification.retryAfterSeconds} segundos.`
          : 'La contraseña o el código de seguridad no son válidos.',
      });
    }

    await revokeOtherUserSessions(
      adminUser._id,
      req.adminSessionId,
      'security_center_revoke_others'
    );
    await saveTwoFactorAudit(req, authResult, {
      action: 'sessions.revoke_others',
      permission: 'seguridad:sesiones',
      success: true,
      description: 'Se cerraron las demás sesiones administrativas.',
      metadata: { recoveryCodeUsed: verification.recoveryCodeUsed },
    });

    return res.json({ ok: true, message: 'Las demás sesiones fueron cerradas.' });
  } catch (error) {
    console.error('❌ Error cerrando otras sesiones:', error.message);
    return res.status(500).json({ ok: false, message: 'No se pudieron cerrar las sesiones.' });
  }
});

router.post('/sessions/revoke-all', requireAdmin, async (req, res) => {
  let authResult;
  try {
    const adminUser = await findAdminUserForTwoFactor({
      adminUserId: req.adminUserId,
    });
    authResult = { adminUser };
    if (!adminUser) {
      return res.status(404).json({ ok: false, message: 'Usuario no encontrado.' });
    }

    const verification = await verifySecurityActionCredentials(adminUser, {
      currentPassword: String(req.body?.currentPassword || ''),
      code: String(req.body?.code || ''),
    });
    if (!verification.ok) {
      await saveTwoFactorAudit(req, authResult, {
        action: 'sessions.revoke_all.denied',
        permission: 'seguridad:sesiones',
        success: false,
        description: 'Credenciales rechazadas al intentar cerrar todas las sesiones.',
        statusCode: verification.retryAfterSeconds ? 429 : 403,
      });
      return res.status(verification.retryAfterSeconds ? 429 : 403).json({
        ok: false,
        retryAfterSeconds: verification.retryAfterSeconds,
        message: verification.retryAfterSeconds
          ? `Demasiados intentos. Intenta nuevamente en ${verification.retryAfterSeconds} segundos.`
          : 'La contraseña o el código de seguridad no son válidos.',
      });
    }

    await revokeAllUserSessions(adminUser._id, 'security_center_revoke_all');
    clearSessionCookies(res);
    await saveTwoFactorAudit(req, authResult, {
      action: 'sessions.revoke_all',
      permission: 'seguridad:sesiones',
      success: true,
      description: 'Se cerraron todas las sesiones administrativas.',
      metadata: { recoveryCodeUsed: verification.recoveryCodeUsed },
    });

    return res.json({
      ok: true,
      currentSessionRevoked: true,
      message: 'Todas las sesiones fueron cerradas.',
    });
  } catch (error) {
    console.error('❌ Error cerrando todas las sesiones:', error.message);
    return res.status(500).json({ ok: false, message: 'No se pudieron cerrar las sesiones.' });
  }
});

router.post('/sessions/:sessionRecordId/revoke', requireAdmin, async (req, res) => {
  let authResult;
  try {
    const recordId = String(req.params.sessionRecordId || '');
    if (!mongoose.isValidObjectId(recordId)) {
      return res.status(400).json({ ok: false, message: 'La sesión indicada no es válida.' });
    }

    const adminUser = await findAdminUserForTwoFactor({
      adminUserId: req.adminUserId,
    });
    authResult = { adminUser };
    if (!adminUser) {
      return res.status(404).json({ ok: false, message: 'Usuario no encontrado.' });
    }

    const verification = await verifySecurityActionCredentials(adminUser, {
      currentPassword: String(req.body?.currentPassword || ''),
      code: String(req.body?.code || ''),
    });
    if (!verification.ok) {
      await saveTwoFactorAudit(req, authResult, {
        action: 'sessions.revoke_one.denied',
        permission: 'seguridad:sesiones',
        success: false,
        description: 'Credenciales rechazadas al intentar cerrar una sesión.',
        statusCode: verification.retryAfterSeconds ? 429 : 403,
      });
      return res.status(verification.retryAfterSeconds ? 429 : 403).json({
        ok: false,
        retryAfterSeconds: verification.retryAfterSeconds,
        message: verification.retryAfterSeconds
          ? `Demasiados intentos. Intenta nuevamente en ${verification.retryAfterSeconds} segundos.`
          : 'La contraseña o el código de seguridad no son válidos.',
      });
    }

    const revokedSession = await revokeUserSessionByRecordId(
      adminUser._id,
      recordId,
      'security_center_revoke'
    );
    if (!revokedSession) {
      return res.status(404).json({ ok: false, message: 'La sesión ya no está activa.' });
    }

    const currentSessionRevoked =
      String(revokedSession.sessionId || '') === String(req.adminSessionId || '');
    if (currentSessionRevoked) clearSessionCookies(res);

    await saveTwoFactorAudit(req, authResult, {
      action: 'sessions.revoke_one',
      permission: 'seguridad:sesiones',
      success: true,
      description: currentSessionRevoked
        ? 'Se cerró la sesión administrativa actual.'
        : 'Se cerró una sesión administrativa desde el centro de seguridad.',
      metadata: {
        currentSessionRevoked,
        recoveryCodeUsed: verification.recoveryCodeUsed,
      },
    });

    return res.json({
      ok: true,
      currentSessionRevoked,
      message: 'Sesión cerrada correctamente.',
    });
  } catch (error) {
    console.error('❌ Error revocando sesión:', error.message);
    return res.status(500).json({ ok: false, message: 'No se pudo cerrar la sesión.' });
  }
});

router.get('/verify', async (req, res) => {
  const result = await verifyAdminToken(req);

  if (result.ok) {
    return res.json({
      ok: true,
      authenticated: true,
      user: result.user,
    });
  }

  if (Number(result.status || 401) >= 500) {
    return res.status(result.status || 401).json({
      ok: false,
      message: result.message,
    });
  }

  if (!getRefreshToken(req)) {
    clearSessionCookies(res);
    return res.json({ ok: true, authenticated: false, user: null });
  }

  try {
    const refreshResult = await rotateRefreshToken(req);

    if (!refreshResult.ok) {
      if (refreshResult.retryable) {
        return res.json({
          ok: true,
          authenticated: false,
          retryable: true,
          user: null,
        });
      }

      clearSessionCookies(res);
      return res.json({ ok: true, authenticated: false, user: null });
    }

    const identity = await resolveRotatedAdminIdentity(req, refreshResult);
    if (!identity.ok) {
      clearSessionCookies(res);
      return res.json({ ok: true, authenticated: false, user: null });
    }

    await issueResolvedAdminSession(res, identity);
    return res.json({
      ok: true,
      authenticated: true,
      refreshed: true,
      user: identity.user,
    });
  } catch (error) {
    console.error('❌ Error verificando sesión admin:', error.message);
    clearSessionCookies(res);
    return res.json({ ok: true, authenticated: false, user: null });
  }
});

router.get('/logs', requireAdmin, requirePermission('logs:view'), async (req, res) => {
  try {
    const logs = await AdminLoginAudit.find()
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return res.json({
      ok: true,
      data: logs,
    });
  } catch (error) {
    console.error('❌ Error obteniendo logs admin:', error.message);

    return res.status(500).json({
      ok: false,
      message: 'Error obteniendo logs.',
    });
  }
});

module.exports = router;
