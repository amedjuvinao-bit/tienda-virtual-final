'use strict';

const AdminAuditLog = require('../models/AdminAuditLog');
const AdminLoginAudit = require('../models/AdminLoginAudit');
const AdminSession = require('../models/AdminSession');
const { buildTwoFactorPolicy } = require('./adminTwoFactorPolicy');

const LOGIN_REASON_LABELS = {
  db_login_success: 'Acceso correcto con contraseña',
  password_verified_2fa_required: 'Contraseña correcta; segundo factor pendiente',
  two_factor_totp_login_success: 'Acceso correcto con autenticador',
  two_factor_recovery_login_success: 'Acceso con código de recuperación',
  invalid_password: 'Contraseña incorrecta',
  invalid_credentials: 'Credenciales incorrectas',
  max_attempts_reached: 'Máximo de intentos alcanzado',
  too_many_failed_attempts: 'Acceso bloqueado por demasiados intentos',
  account_locked: 'Cuenta temporalmente bloqueada',
};

function describeUserAgent(value = '') {
  const userAgent = String(value || '');
  let browser = 'Navegador desconocido';
  let operatingSystem = 'Sistema desconocido';
  let deviceType = 'Computador';

  if (/Edg\//i.test(userAgent)) browser = 'Microsoft Edge';
  else if (/OPR\//i.test(userAgent)) browser = 'Opera';
  else if (/Chrome\//i.test(userAgent)) browser = 'Google Chrome';
  else if (/Firefox\//i.test(userAgent)) browser = 'Mozilla Firefox';
  else if (/Safari\//i.test(userAgent)) browser = 'Safari';

  if (/Windows NT/i.test(userAgent)) operatingSystem = 'Windows';
  else if (/Android/i.test(userAgent)) operatingSystem = 'Android';
  else if (/iPhone|iPad|iPod/i.test(userAgent)) operatingSystem = 'iOS';
  else if (/Mac OS X/i.test(userAgent)) operatingSystem = 'macOS';
  else if (/Linux/i.test(userAgent)) operatingSystem = 'Linux';

  if (/iPad|Tablet/i.test(userAgent)) deviceType = 'Tableta';
  else if (/Mobile|Android|iPhone|iPod/i.test(userAgent)) deviceType = 'Teléfono';

  return {
    browser,
    operatingSystem,
    deviceType,
    label: `${browser} · ${operatingSystem}`,
  };
}

function isSessionActive(session, now = new Date()) {
  return Boolean(
    !session?.revokedAt &&
      new Date(session?.expiresAt || 0) > now &&
      new Date(session?.idleExpiresAt || 0) > now
  );
}

function serializeSession(session, currentSessionId, now = new Date()) {
  const detected = describeUserAgent(session?.userAgent);
  const active = isSessionActive(session, now);
  const isCurrent = String(session?.sessionId || '') === String(currentSessionId || '');

  return {
    id: String(session?._id || ''),
    isCurrent,
    active,
    status: active ? 'active' : session?.revokedAt ? 'revoked' : 'expired',
    device: {
      label: session?.deviceLabel || detected.label,
      browser: session?.browser || detected.browser,
      operatingSystem: session?.operatingSystem || detected.operatingSystem,
      type: session?.deviceType || detected.deviceType,
      known: Boolean(session?.deviceIdHash),
    },
    ip: session?.lastIp || session?.createdIp || '',
    createdIp: session?.createdIp || '',
    createdAt: session?.createdAt || null,
    lastSeenAt: session?.lastSeenAt || null,
    idleExpiresAt: session?.idleExpiresAt || null,
    expiresAt: session?.expiresAt || null,
    revokedAt: session?.revokedAt || null,
    revokeReason: session?.revokeReason || '',
    riskLevel: session?.riskLevel || 'low',
    riskSignals: Array.isArray(session?.riskSignals) ? session.riskSignals : [],
  };
}

function serializeLoginActivity(log) {
  const status = log?.status || 'error';
  return {
    id: `login:${log?._id || ''}`,
    type: 'login',
    occurredAt: log?.createdAt || null,
    status,
    title: status === 'success' ? 'Inicio de sesión correcto' : 'Intento de acceso',
    detail: LOGIN_REASON_LABELS[log?.reason] || log?.reason || 'Evento de acceso',
    ip: log?.ip || '',
    severity: status === 'blocked' ? 'high' : status === 'failed' ? 'medium' : 'low',
  };
}

function serializeSecurityAudit(log) {
  return {
    id: `audit:${log?._id || ''}`,
    type: 'security',
    occurredAt: log?.createdAt || null,
    status: log?.success === false ? 'failed' : 'success',
    title: log?.description || 'Cambio de seguridad',
    detail: log?.action || log?.permission || '',
    ip: log?.ip || '',
    severity: log?.success === false ? 'medium' : 'low',
  };
}

function sessionAlerts(sessions = []) {
  return sessions.flatMap((session) => {
    const alerts = [];
    if (session.active && session.riskSignals.includes('new_device')) {
      alerts.push({
        id: `new-device:${session.id}`,
        severity: 'medium',
        title: 'Nuevo dispositivo detectado',
        detail: `${session.device.label} inició una sesión desde ${session.ip || 'una IP no identificada'}.`,
        occurredAt: session.createdAt,
        sessionId: session.id,
      });
    }
    if (session.riskSignals.includes('ip_changed')) {
      alerts.push({
        id: `ip-change:${session.id}`,
        severity: 'medium',
        title: 'Cambio de red detectado',
        detail: `La sesión de ${session.device.label} cambió de dirección IP.`,
        occurredAt: session.lastSeenAt,
        sessionId: session.id,
      });
    }
    if (session.revokeReason === 'refresh_token_reuse') {
      alerts.push({
        id: `token-reuse:${session.id}`,
        severity: 'high',
        title: 'Reutilización de credencial bloqueada',
        detail: 'El servidor revocó una sesión porque detectó reutilización del token de renovación.',
        occurredAt: session.revokedAt,
        sessionId: session.id,
      });
    }
    return alerts;
  });
}

async function getAdminSecurityCenter({ adminUser, currentSessionId }) {
  const now = new Date();
  const since24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const userId = adminUser?._id;
  const username = String(adminUser?.username || '').toLowerCase();

  const [sessionDocs, loginLogs, securityLogs] = await Promise.all([
    AdminSession.find({ adminUser: userId })
      .select('+sessionId +deviceIdHash')
      .sort({ lastSeenAt: -1 })
      .limit(30)
      .lean(),
    AdminLoginAudit.find({ username })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean(),
    AdminAuditLog.find({
      adminUserId: userId,
      module: 'seguridad',
    })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean(),
  ]);

  const sessions = sessionDocs.map((session) =>
    serializeSession(session, currentSessionId, now)
  );
  const activeSessions = sessions.filter((session) => session.active);
  const recentFailures = loginLogs.filter(
    (log) =>
      ['failed', 'blocked', 'error'].includes(log.status) &&
      new Date(log.createdAt) >= since24Hours
  );
  const alerts = [
    ...sessionAlerts(sessions),
    ...recentFailures.slice(0, 5).map((log) => ({
      id: `login-alert:${log._id}`,
      severity: log.status === 'blocked' ? 'high' : 'medium',
      title: log.status === 'blocked' ? 'Intento de acceso bloqueado' : 'Intento de acceso fallido',
      detail: `${LOGIN_REASON_LABELS[log.reason] || log.reason || 'Credenciales rechazadas'} desde ${log.ip || 'una IP no identificada'}.`,
      occurredAt: log.createdAt,
    })),
  ]
    .sort((left, right) => new Date(right.occurredAt || 0) - new Date(left.occurredAt || 0))
    .slice(0, 12);

  const activity = [
    ...loginLogs.map(serializeLoginActivity),
    ...securityLogs.map(serializeSecurityAudit),
  ]
    .sort((left, right) => new Date(right.occurredAt || 0) - new Date(left.occurredAt || 0))
    .slice(0, 30);

  const knownDeviceKeys = new Set(
    sessionDocs
      .map((session) => session.deviceIdHash || '')
      .filter(Boolean)
  );

  return {
    policy: buildTwoFactorPolicy(adminUser),
    summary: {
      activeSessions: activeSessions.length,
      knownDevices: knownDeviceKeys.size,
      failedAttempts24Hours: recentFailures.length,
      pendingAlerts: alerts.filter((alert) => ['medium', 'high'].includes(alert.severity)).length,
    },
    sessions,
    alerts,
    activity,
  };
}

module.exports = {
  describeUserAgent,
  getAdminSecurityCenter,
  isSessionActive,
  serializeSession,
};
