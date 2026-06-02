// backend/routes/adminAuth.js

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const AdminLoginAudit = require('../models/AdminLoginAudit');
const AdminUser = require('../models/AdminUser');
const { sendMail } = require('../lib/mail/mailer');

const router = express.Router();

const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '2h';

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
const MIN_PASSWORD_LENGTH = 8;
const loginAttempts = new Map();

function isJwtConfigured() {
  return Boolean(JWT_SECRET);
}

function isLegacyAdminConfigured() {
  return Boolean(ADMIN_USER && ADMIN_PASSWORD_HASH && JWT_SECRET);
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

function getBearerToken(req) {
  const authHeader = req.headers.authorization || '';

  if (authHeader.startsWith('Bearer ')) {
    return authHeader.replace('Bearer ', '').trim();
  }

  return String(req.headers['x-admin-token'] || '').trim();
}

function buildAdminResetPasswordUrl(rawToken) {
  const baseUrl = String(FRONTEND_ADMIN_URL || 'http://localhost:5173').replace(/\/+$/, '');
  const cleanToken = encodeURIComponent(String(rawToken || '').trim());

  return `${baseUrl}/admin/reset-password?token=${cleanToken}`;
}

async function saveLoginAudit(req, { username = '', status, reason = '' }) {
  try {
    await AdminLoginAudit.create({
      username,
      ip: getClientIp(req),
      status,
      reason,
      userAgent: getUserAgent(req),
    });
  } catch (error) {
    console.error('❌ Error guardando auditoría login:', error.message);
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

function buildUserResponseFromDb(adminUser) {
  const safeUser =
    typeof adminUser.toSafeObject === 'function'
      ? adminUser.toSafeObject()
      : adminUser.toObject();

  return {
    id: String(adminUser._id),
    username: adminUser.username,

    // Compatibilidad con el sistema actual.
    role: 'admin',

    // Rol real del nuevo sistema.
    adminRole: adminUser.role,
    actualRole: adminUser.role,

    roleRef: adminUser.roleRef || null,
    permissions: Array.isArray(adminUser.permissions) ? adminUser.permissions : [],
    branches: Array.isArray(adminUser.branches) ? adminUser.branches : [],
    defaultBranch: adminUser.defaultBranch || null,

    displayName: adminUser.displayName || adminUser.username,
    fullName: adminUser.fullName || adminUser.displayName || adminUser.username,
    email: adminUser.email || '',
    status: adminUser.status,
    active: adminUser.active,
    mustChangePassword: Boolean(adminUser.mustChangePassword),

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

  if (String(newPassword).length < MIN_PASSWORD_LENGTH) {
    return `La nueva contraseña debe tener mínimo ${MIN_PASSWORD_LENGTH} caracteres.`;
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

  if (String(newPassword).length < 10) {
    return 'La nueva contraseña debe tener mínimo 10 caracteres.';
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
  }).select('+tokenVersion');
}

async function findAdminUserForPasswordChange(decoded) {
  if (!decoded?.adminUserId) return null;

  return AdminUser.findOne({
    _id: decoded.adminUserId,
    deletedAt: null,
  }).select('+passwordHash +tokenVersion');
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

  const token = getBearerToken(req);

  if (!token) {
    return {
      ok: false,
      status: 401,
      message: 'Token no enviado.',
    };
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    if (decoded.authType === 'db' || decoded.adminUserId) {
      const adminUser = await findAdminUserForToken(decoded);

      if (!adminUser) {
        return {
          ok: false,
          status: 401,
          message: 'Usuario administrativo no encontrado.',
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

    return {
      ok: true,
      decoded,
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

  if (adminUser.active !== true || adminUser.status !== 'active') {
    return {
      ok: false,
      found: true,
      status: 403,
      reason: 'user_inactive',
      message: 'Usuario administrativo inactivo o bloqueado.',
    };
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

  await adminUser.resetLoginSecurity({
    ip: getClientIp(req),
    userAgent: getUserAgent(req),
  });

  const token = jwt.sign(buildDbTokenPayload(adminUser), JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });

  return {
    ok: true,
    found: true,
    token,
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

  const token = jwt.sign(buildLegacyTokenPayload(cleanUsername), JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });

  return {
    ok: true,
    found: true,
    token,
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

      await saveLoginAudit(req, {
        username: dbLoginResult.user.username,
        status: 'success',
        reason: 'db_login_success',
      });

      return res.json({
        ok: true,
        message: 'Login exitoso.',
        token: dbLoginResult.token,
        user: dbLoginResult.user,
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

      await saveLoginAudit(req, {
        username: cleanUsername,
        status: 'success',
        reason: 'legacy_login_success',
      });

      return res.json({
        ok: true,
        message: 'Login exitoso.',
        token: legacyLoginResult.token,
        user: legacyLoginResult.user,
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

    const loginToken = jwt.sign(buildDbTokenPayload(adminUser), JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });

    await saveLoginAudit(req, {
      username: adminUser.username,
      status: 'success',
      reason: 'reset_password_success',
    });

    return res.json({
      ok: true,
      message: 'Contraseña actualizada correctamente.',
      token: loginToken,
      user: buildUserResponseFromDb(adminUser),
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

    adminUser.passwordHash = await bcrypt.hash(newPassword, 12);
    adminUser.mustChangePassword = false;
    adminUser.passwordChangedAt = new Date();
    adminUser.failedLoginAttempts = 0;
    adminUser.lockedUntil = null;
    adminUser.tokenVersion = Number(adminUser.tokenVersion || 0) + 1;
    adminUser.updatedBy = adminUser._id;

    await adminUser.save();

    const token = jwt.sign(buildDbTokenPayload(adminUser), JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });

    await saveLoginAudit(req, {
      username: adminUser.username,
      status: 'success',
      reason: 'required_password_change_success',
    });

    return res.json({
      ok: true,
      message: 'Contraseña actualizada correctamente.',
      token,
      user: buildUserResponseFromDb(adminUser),
    });
  } catch (error) {
    console.error('❌ Error en cambio obligatorio de contraseña:', error.message);

    return res.status(500).json({
      ok: false,
      message: 'Error interno al cambiar la contraseña.',
    });
  }
});

router.get('/verify', async (req, res) => {
  const result = await verifyAdminToken(req);

  if (!result.ok) {
    return res.status(result.status || 401).json({
      ok: false,
      message: result.message,
    });
  }

  return res.json({
    ok: true,
    user: result.user,
  });
});

router.get('/logs', async (req, res) => {
  try {
    const authResult = await verifyAdminToken(req);

    if (!authResult.ok) {
      return res.status(authResult.status || 401).json({
        ok: false,
        message: authResult.message,
      });
    }

    const adminRole = authResult.user?.adminRole || authResult.user?.actualRole || 'admin';

    if (!['owner', 'admin'].includes(adminRole)) {
      return res.status(403).json({
        ok: false,
        message: 'No tienes permisos para consultar logs administrativos.',
      });
    }

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