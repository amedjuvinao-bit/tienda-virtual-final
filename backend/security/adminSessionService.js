'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const AdminSession = require('../models/AdminSession');
const { describeUserAgent } = require('./adminSecurityCenterService');

const ACCESS_COOKIE_BASE = 'rb_admin_access';
const REFRESH_COOKIE_BASE = 'rb_admin_refresh';
const TWO_FACTOR_COOKIE_BASE = 'rb_admin_2fa';
const DEVICE_COOKIE_BASE = 'rb_admin_device';
const JWT_ISSUER = 'tienda-virtual-backend';
const JWT_AUDIENCE = 'tienda-virtual-admin';
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function boundedNumber(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function getConfig() {
  const production = process.env.NODE_ENV === 'production';
  const configuredSameSite = String(
    process.env.ADMIN_COOKIE_SAME_SITE || ''
  ).trim().toLowerCase();
  const sameSite = ['strict', 'lax', 'none'].includes(configuredSameSite)
    ? configuredSameSite
    : production
      ? 'none'
      : 'lax';
  const secure =
    production ||
    sameSite === 'none' ||
    String(process.env.ADMIN_COOKIE_SECURE || '').toLowerCase() === 'true';

  return {
    production,
    secure,
    sameSite,
    accessMinutes: boundedNumber(
      process.env.ADMIN_ACCESS_TOKEN_MINUTES,
      15,
      5,
      60
    ),
    idleHours: boundedNumber(
      process.env.ADMIN_SESSION_IDLE_HOURS,
      12,
      1,
      168
    ),
    absoluteHours: boundedNumber(
      process.env.ADMIN_SESSION_ABSOLUTE_HOURS,
      168,
      2,
      720
    ),
  };
}

function getCookieNames() {
  const { secure } = getConfig();
  return {
    access: secure ? `__Host-${ACCESS_COOKIE_BASE}` : ACCESS_COOKIE_BASE,
    refresh: secure ? `__Secure-${REFRESH_COOKIE_BASE}` : REFRESH_COOKIE_BASE,
    twoFactor: secure
      ? `__Secure-${TWO_FACTOR_COOKIE_BASE}`
      : TWO_FACTOR_COOKIE_BASE,
    device: secure ? `__Host-${DEVICE_COOKIE_BASE}` : DEVICE_COOKIE_BASE,
  };
}

function parseCookies(cookieHeader = '') {
  return String(cookieHeader || '')
    .split(';')
    .reduce((cookies, part) => {
      const separator = part.indexOf('=');
      if (separator <= 0) return cookies;
      const name = part.slice(0, separator).trim();
      const value = part.slice(separator + 1).trim();
      if (!name) return cookies;
      try {
        cookies[name] = decodeURIComponent(value);
      } catch {
        cookies[name] = value;
      }
      return cookies;
    }, {});
}

function parseBearer(authHeader = '') {
  const [type, value] = String(authHeader || '').split(' ');
  return type?.toLowerCase() === 'bearer' && value ? value.trim() : '';
}

function getAccessCredential(req) {
  const cookies = parseCookies(req?.headers?.cookie || '');
  const names = getCookieNames();
  const cookieToken =
    cookies[names.access] ||
    cookies[ACCESS_COOKIE_BASE] ||
    cookies[`__Host-${ACCESS_COOKIE_BASE}`] ||
    '';

  if (cookieToken) return { token: cookieToken, source: 'cookie' };

  const bearer = parseBearer(req?.headers?.authorization || '');
  const headerToken = String(req?.headers?.['x-admin-token'] || '').trim();
  const token = bearer || headerToken;
  return { token, source: token ? 'header' : '' };
}

function getRefreshToken(req) {
  const cookies = parseCookies(req?.headers?.cookie || '');
  const names = getCookieNames();
  return (
    cookies[names.refresh] ||
    cookies[REFRESH_COOKIE_BASE] ||
    cookies[`__Secure-${REFRESH_COOKIE_BASE}`] ||
    ''
  );
}

function getTwoFactorChallengeToken(req) {
  const cookies = parseCookies(req?.headers?.cookie || '');
  const names = getCookieNames();
  return (
    cookies[names.twoFactor] ||
    cookies[TWO_FACTOR_COOKIE_BASE] ||
    cookies[`__Secure-${TWO_FACTOR_COOKIE_BASE}`] ||
    ''
  );
}

function getDeviceToken(req) {
  const cookies = parseCookies(req?.headers?.cookie || '');
  const names = getCookieNames();
  const token =
    cookies[names.device] ||
    cookies[DEVICE_COOKIE_BASE] ||
    cookies[`__Host-${DEVICE_COOKIE_BASE}`] ||
    '';

  return /^[A-Za-z0-9_-]{32,160}$/.test(token) ? token : '';
}

function hashToken(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function createOpaqueRefreshToken(sessionId) {
  return `${sessionId}.${crypto.randomBytes(48).toString('base64url')}`;
}

function getRefreshSessionId(refreshToken) {
  const [sessionId, secret, extra] = String(refreshToken || '').split('.');
  if (!sessionId || !secret || extra) return '';
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(sessionId)) return '';
  if (!/^[A-Za-z0-9_-]{40,150}$/.test(secret)) return '';
  return sessionId;
}

function getClientIp(req) {
  const forwarded = req?.headers?.['x-forwarded-for'];
  if (forwarded) return String(forwarded).split(',')[0].trim().slice(0, 160);
  return String(req?.ip || req?.socket?.remoteAddress || 'unknown').slice(0, 160);
}

function getUserAgent(req) {
  return String(req?.headers?.['user-agent'] || '').slice(0, 500);
}

function buildCookieOptions({ maxAge, path }) {
  const { secure, sameSite } = getConfig();
  return {
    httpOnly: true,
    secure,
    sameSite,
    path,
    maxAge,
  };
}

function setSessionCookies(res, { accessToken, refreshToken, expiresAt }) {
  const config = getConfig();
  const names = getCookieNames();
  const now = Date.now();
  const absoluteRemaining = Math.max(0, new Date(expiresAt).getTime() - now);
  const accessMaxAge = config.accessMinutes * 60 * 1000;

  res.cookie(
    names.access,
    accessToken,
    buildCookieOptions({ maxAge: accessMaxAge, path: '/' })
  );
  res.cookie(
    names.refresh,
    refreshToken,
    buildCookieOptions({ maxAge: absoluteRemaining, path: '/api/admin/auth' })
  );
}

function clearSessionCookies(res) {
  const names = getCookieNames();
  res.clearCookie(names.access, buildCookieOptions({ maxAge: 0, path: '/' }));
  res.clearCookie(
    names.refresh,
    buildCookieOptions({ maxAge: 0, path: '/api/admin/auth' })
  );
}

function setTwoFactorChallengeCookie(res, token, maxAge = 5 * 60 * 1000) {
  const names = getCookieNames();
  res.cookie(
    names.twoFactor,
    token,
    buildCookieOptions({ maxAge, path: '/api/admin/auth/2fa' })
  );
}

function clearTwoFactorChallengeCookie(res) {
  const names = getCookieNames();
  res.clearCookie(
    names.twoFactor,
    buildCookieOptions({ maxAge: 0, path: '/api/admin/auth/2fa' })
  );
}

function setDeviceCookie(res, token) {
  const names = getCookieNames();
  res.cookie(
    names.device,
    token,
    buildCookieOptions({ maxAge: 365 * 24 * 60 * 60 * 1000, path: '/' })
  );
}

function signAccessToken(payload, sessionId) {
  const { accessMinutes } = getConfig();
  return jwt.sign(
    {
      ...payload,
      sessionId,
    },
    process.env.JWT_SECRET,
    {
      algorithm: 'HS256',
      audience: JWT_AUDIENCE,
      issuer: JWT_ISSUER,
      expiresIn: `${accessMinutes}m`,
      jwtid: crypto.randomUUID(),
    }
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET, {
    algorithms: ['HS256'],
    audience: JWT_AUDIENCE,
    issuer: JWT_ISSUER,
  });
}

async function startAdminSession({
  req,
  res,
  tokenPayload,
  adminUserId = null,
  authType = 'db',
  username,
  tokenVersion = 0,
}) {
  const config = getConfig();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + config.absoluteHours * 60 * 60 * 1000);
  const idleExpiresAt = new Date(
    Math.min(
      expiresAt.getTime(),
      now.getTime() + config.idleHours * 60 * 60 * 1000
    )
  );
  const sessionId = crypto.randomBytes(24).toString('base64url');
  const refreshToken = createOpaqueRefreshToken(sessionId);
  const existingDeviceToken = getDeviceToken(req);
  const deviceToken = existingDeviceToken || crypto.randomBytes(32).toString('base64url');
  const deviceIdHash = hashToken(`admin-device:${deviceToken}`);
  const clientIp = getClientIp(req);
  const userAgent = getUserAgent(req);
  const device = describeUserAgent(userAgent);
  const previousDeviceSession = adminUserId
    ? await AdminSession.findOne({ adminUser: adminUserId, deviceIdHash })
        .select('+deviceIdHash')
        .sort({ createdAt: -1 })
        .lean()
    : null;
  const riskSignals = [];

  if (!previousDeviceSession) riskSignals.push('new_device');
  if (
    previousDeviceSession?.lastIp &&
    previousDeviceSession.lastIp !== clientIp
  ) {
    riskSignals.push('ip_changed');
  }

  const session = await AdminSession.create({
    sessionId,
    adminUser: adminUserId || null,
    authType,
    username,
    tokenVersion: Number(tokenVersion || 0),
    refreshTokenHash: hashToken(refreshToken),
    createdIp: clientIp,
    lastIp: clientIp,
    userAgent,
    deviceIdHash,
    deviceLabel: device.label,
    browser: device.browser,
    operatingSystem: device.operatingSystem,
    deviceType: device.deviceType,
    riskLevel: riskSignals.length ? 'medium' : 'low',
    riskSignals,
    lastSeenAt: now,
    idleExpiresAt,
    expiresAt,
  });
  const accessToken = signAccessToken(tokenPayload, sessionId);

  setSessionCookies(res, { accessToken, refreshToken, expiresAt });
  setDeviceCookie(res, deviceToken);

  return {
    session,
    expiresAt,
    accessExpiresInSeconds: config.accessMinutes * 60,
  };
}

async function loadActiveSession(decoded, { touch = true, req = null } = {}) {
  if (!decoded?.sessionId) return null;

  const now = new Date();
  const session = await AdminSession.findOne({
    sessionId: decoded.sessionId,
    revokedAt: null,
    expiresAt: { $gt: now },
    idleExpiresAt: { $gt: now },
  }).select('+sessionId');

  if (!session) return null;
  if (session.authType !== decoded.authType) return null;
  if (session.username !== String(decoded.username || '').toLowerCase()) return null;
  if (Number(session.tokenVersion || 0) !== Number(decoded.tokenVersion || 0)) return null;
  if (
    session.authType === 'db' &&
    String(session.adminUser || '') !== String(decoded.adminUserId || '')
  ) {
    return null;
  }

  if (touch && now.getTime() - new Date(session.lastSeenAt).getTime() >= 5 * 60 * 1000) {
    const config = getConfig();
    const idleExpiresAt = new Date(
      Math.min(
        new Date(session.expiresAt).getTime(),
        now.getTime() + config.idleHours * 60 * 60 * 1000
      )
    );
    const currentIp = req ? getClientIp(req) : session.lastIp;
    const ipChanged = Boolean(session.lastIp && currentIp && session.lastIp !== currentIp);
    await AdminSession.updateOne(
      { _id: session._id, revokedAt: null },
      {
        $set: {
          lastSeenAt: now,
          idleExpiresAt,
          lastIp: currentIp,
          ...(ipChanged ? { riskLevel: 'medium' } : {}),
        },
        ...(ipChanged ? { $addToSet: { riskSignals: 'ip_changed' } } : {}),
      }
    );
    session.lastSeenAt = now;
    session.idleExpiresAt = idleExpiresAt;
    session.lastIp = currentIp;
    if (ipChanged) {
      session.riskLevel = 'medium';
      session.riskSignals = Array.from(
        new Set([...(session.riskSignals || []), 'ip_changed'])
      );
    }
  }

  return session;
}

async function rotateRefreshToken(req) {
  const presentedToken = getRefreshToken(req);
  const sessionId = getRefreshSessionId(presentedToken);
  if (!sessionId) return { ok: false, reason: 'missing_or_invalid_refresh' };

  const now = new Date();
  const nextRefreshToken = createOpaqueRefreshToken(sessionId);
  const currentHash = hashToken(presentedToken);
  const nextHash = hashToken(nextRefreshToken);
  const previousRefreshValidUntil = new Date(now.getTime() + 15 * 1000);
  const config = getConfig();
  const existing = await AdminSession.findOne({ sessionId })
    .select('+sessionId +refreshTokenHash');

  if (!existing) return { ok: false, reason: 'session_not_found' };
  if (
    existing.revokedAt ||
    new Date(existing.expiresAt) <= now ||
    new Date(existing.idleExpiresAt) <= now
  ) {
    return { ok: false, reason: 'session_expired' };
  }

  const idleExpiresAt = new Date(
    Math.min(
      new Date(existing.expiresAt).getTime(),
      now.getTime() + config.idleHours * 60 * 60 * 1000
    )
  );
  const session = await AdminSession.findOneAndUpdate(
    {
      _id: existing._id,
      refreshTokenHash: currentHash,
      revokedAt: null,
      expiresAt: { $gt: now },
      idleExpiresAt: { $gt: now },
    },
    {
      $set: {
        refreshTokenHash: nextHash,
        previousRefreshTokenHash: existing.refreshTokenHash,
        previousRefreshValidUntil,
        rotatedAt: now,
        lastSeenAt: now,
        lastIp: getClientIp(req),
        idleExpiresAt,
      },
    },
    { new: true }
  ).select('+sessionId');

  if (!session) {
    const latest = await AdminSession.findOne({ _id: existing._id })
      .select('+previousRefreshTokenHash +previousRefreshValidUntil');
    const isParallelRefresh =
      latest?.previousRefreshTokenHash === currentHash &&
      latest?.previousRefreshValidUntil &&
      new Date(latest.previousRefreshValidUntil) > now;

    if (isParallelRefresh) {
      return { ok: false, reason: 'refresh_already_rotated', retryable: true };
    }

    await AdminSession.updateOne(
      { _id: existing._id, revokedAt: null },
      { $set: { revokedAt: now, revokeReason: 'refresh_token_reuse' } }
    );
    return { ok: false, reason: 'refresh_token_reuse' };
  }

  return { ok: true, session, refreshToken: nextRefreshToken };
}

async function issueRotatedSession(res, { session, refreshToken, tokenPayload }) {
  const accessToken = signAccessToken(tokenPayload, session.sessionId);
  setSessionCookies(res, {
    accessToken,
    refreshToken,
    expiresAt: session.expiresAt,
  });
}

async function revokeSessionById(sessionId, reason = 'logout') {
  if (!sessionId) return;
  await AdminSession.updateOne(
    { sessionId, revokedAt: null },
    { $set: { revokedAt: new Date(), revokeReason: reason } }
  );
}

async function revokeUserSessionByRecordId(
  adminUserId,
  recordId,
  reason = 'user_security_center'
) {
  if (!adminUserId || !recordId) return null;
  return AdminSession.findOneAndUpdate(
    { _id: recordId, adminUser: adminUserId, revokedAt: null },
    { $set: { revokedAt: new Date(), revokeReason: reason } },
    { new: true }
  ).select('+sessionId');
}

async function revokeRequestSession(req, reason = 'logout') {
  const refreshSessionId = getRefreshSessionId(getRefreshToken(req));
  let accessSessionId = '';

  if (!refreshSessionId) {
    const { token } = getAccessCredential(req);
    if (token) {
      try {
        accessSessionId = verifyAccessToken(token)?.sessionId || '';
      } catch {
        accessSessionId = '';
      }
    }
  }

  await revokeSessionById(refreshSessionId || accessSessionId, reason);
}

async function revokeAllUserSessions(adminUserId, reason = 'security_change') {
  if (!adminUserId) return;
  await AdminSession.updateMany(
    { adminUser: adminUserId, revokedAt: null },
    { $set: { revokedAt: new Date(), revokeReason: reason } }
  );
}

async function revokeOtherUserSessions(
  adminUserId,
  keepSessionId,
  reason = 'security_change'
) {
  if (!adminUserId) return;
  const filter = { adminUser: adminUserId, revokedAt: null };
  if (keepSessionId) filter.sessionId = { $ne: keepSessionId };
  await AdminSession.updateMany(filter, {
    $set: { revokedAt: new Date(), revokeReason: reason },
  });
}

function normalizeOrigin(value) {
  try {
    return new URL(String(value || '').trim()).origin;
  } catch {
    return '';
  }
}

function isTrustedRequestOrigin(req) {
  if (!UNSAFE_METHODS.has(String(req?.method || '').toUpperCase())) return true;

  const origin = normalizeOrigin(req?.headers?.origin);
  if (!origin) return process.env.NODE_ENV !== 'production';

  const allowed = new Set(
    [
      process.env.FRONTEND_URL,
      process.env.CLIENT_URL,
      process.env.VITE_FRONTEND_URL,
      process.env.BACKEND_URL,
      process.env.API_URL,
      process.env.VITE_BACKEND_URL,
      process.env.NODE_ENV !== 'production' ? 'http://localhost:5173' : '',
      process.env.NODE_ENV !== 'production' ? 'http://127.0.0.1:5173' : '',
    ]
      .map(normalizeOrigin)
      .filter(Boolean)
  );

  return allowed.has(origin);
}

function requireTrustedAdminOrigin(req, res, next) {
  if (isTrustedRequestOrigin(req)) return next();
  return res.status(403).json({
    ok: false,
    error: 'UNTRUSTED_ORIGIN',
    message: 'Origen no autorizado para esta operación administrativa.',
  });
}

module.exports = {
  clearSessionCookies,
  clearTwoFactorChallengeCookie,
  getAccessCredential,
  getDeviceToken,
  getRefreshToken,
  getTwoFactorChallengeToken,
  isTrustedRequestOrigin,
  issueRotatedSession,
  loadActiveSession,
  requireTrustedAdminOrigin,
  revokeAllUserSessions,
  revokeOtherUserSessions,
  revokeRequestSession,
  revokeSessionById,
  revokeUserSessionByRecordId,
  rotateRefreshToken,
  signAccessToken,
  setTwoFactorChallengeCookie,
  startAdminSession,
  verifyAccessToken,
};
