// backend/routes/adminAuth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const AdminLoginAudit = require('../models/AdminLoginAudit');

const router = express.Router();

const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '2h';

const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCK_TIME_MS = 10 * 60 * 1000;
const loginAttempts = new Map();

function isConfigured() {
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
  return `${getClientIp(req)}:${String(username || '').toLowerCase().trim()}`;
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
  const nextCount = current.count + 1;

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

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  const cleanUsername = String(username || '').trim();
  const cleanPassword = String(password || '');

  try {
    if (!isConfigured()) {
      await saveLoginAudit(req, {
        username: cleanUsername,
        status: 'error',
        reason: 'admin_auth_not_configured',
      });

      return res.status(500).json({
        ok: false,
        message: 'Autenticación admin no configurada en el servidor.',
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

      return res.status(429).json({
        ok: false,
        message: `Demasiados intentos fallidos. Intenta nuevamente en ${seconds} segundos.`,
        retryAfterSeconds: seconds,
      });
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

    const isUserValid = cleanUsername === ADMIN_USER;
    const isPasswordValid = isUserValid
      ? await bcrypt.compare(cleanPassword, ADMIN_PASSWORD_HASH)
      : false;

    if (!isUserValid || !isPasswordValid) {
      const failedState = registerFailedAttempt(attemptKey);

      if (failedState.lockedUntil > Date.now()) {
        const seconds = Math.ceil((failedState.lockedUntil - Date.now()) / 1000);

        await saveLoginAudit(req, {
          username: cleanUsername,
          status: 'blocked',
          reason: 'max_attempts_reached',
        });

        return res.status(429).json({
          ok: false,
          message: `Demasiados intentos fallidos. Intenta nuevamente en ${seconds} segundos.`,
          retryAfterSeconds: seconds,
        });
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
    }

    clearAttempts(attemptKey);

    const token = jwt.sign(
      {
        role: 'admin',
        username: cleanUsername,
      },
      JWT_SECRET,
      {
        expiresIn: JWT_EXPIRES_IN,
      }
    );

    await saveLoginAudit(req, {
      username: cleanUsername,
      status: 'success',
      reason: 'login_success',
    });

    return res.json({
      ok: true,
      message: 'Login exitoso.',
      token,
      user: {
        username: cleanUsername,
        role: 'admin',
      },
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

router.get('/verify', (req, res) => {
  try {
    if (!JWT_SECRET) {
      return res.status(500).json({
        ok: false,
        message: 'JWT_SECRET no configurado.',
      });
    }

    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.replace('Bearer ', '')
      : req.headers['x-admin-token'];

    if (!token) {
      return res.status(401).json({
        ok: false,
        message: 'Token no enviado.',
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    return res.json({
      ok: true,
      user: {
        username: decoded.username,
        role: decoded.role,
      },
    });
  } catch {
    return res.status(401).json({
      ok: false,
      message: 'Token inválido o expirado.',
    });
  }
});

router.get('/logs', async (_req, res) => {
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