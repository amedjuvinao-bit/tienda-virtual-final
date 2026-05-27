// backend/routes/adminAuth.js

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const AdminLoginAudit = require('../models/AdminLoginAudit');
const AdminUser = require('../models/AdminUser');

const router = express.Router();

const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '2h';

const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCK_TIME_MS = 10 * 60 * 1000;
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

function getBearerToken(req) {
  const authHeader = req.headers.authorization || '';

  if (authHeader.startsWith('Bearer ')) {
    return authHeader.replace('Bearer ', '').trim();
  }

  return String(req.headers['x-admin-token'] || '').trim();
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

async function findAdminUserForToken(decoded) {
  if (!decoded?.adminUserId) return null;

  return AdminUser.findOne({
    _id: decoded.adminUserId,
    deletedAt: null,
  }).select('+tokenVersion');
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