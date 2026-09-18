'use strict';

const crypto = require('crypto');
const mongoose = require('mongoose');

const AdminSecurityAlert = require('../models/AdminSecurityAlert');
const AdminUser = require('../models/AdminUser');
const { sendMail } = require('../lib/mail/mailer');

const LOGIN_WINDOW_MS = 15 * 60 * 1000;

function cleanText(value, max = 500) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function hashFingerprint(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function loginFingerprint({ type, username, ip, occurredAt }) {
  const bucket = Math.floor(new Date(occurredAt || Date.now()).getTime() / LOGIN_WINDOW_MS);
  return hashFingerprint(`${type}:${String(username || '').toLowerCase()}:${ip}:${bucket}`);
}

async function notifyOwners(alert) {
  const now = new Date();
  const retryAfter = new Date(now.getTime() - 30 * 60 * 1000);
  const staleProcessing = new Date(now.getTime() - 10 * 60 * 1000);
  const claimed = await AdminSecurityAlert.updateOne(
    {
      _id: alert._id,
      $or: [
        { notificationStatus: 'pending' },
        { notificationStatus: 'failed', notificationAttemptedAt: { $lt: retryAfter } },
        { notificationStatus: 'processing', notificationAttemptedAt: { $lt: staleProcessing } },
      ],
    },
    {
      $set: {
        notificationStatus: 'processing',
        notificationAttemptedAt: new Date(),
      },
      $inc: { notificationAttempts: 1 },
    }
  );
  if (!claimed.modifiedCount) return;

  try {
    const owners = await AdminUser.find({
      role: 'owner',
      active: true,
      status: 'active',
      emailVerified: true,
      email: { $type: 'string', $ne: '' },
      deletedAt: null,
    })
      .select('email')
      .lean();
    const recipients = Array.from(
      new Set(owners.map((owner) => String(owner.email || '').trim().toLowerCase()).filter(Boolean))
    );

    if (!recipients.length) {
      await AdminSecurityAlert.updateOne(
        { _id: alert._id },
        {
          $set: {
            notificationStatus: 'skipped',
            notificationError: 'No hay un correo verificado de owner disponible.',
          },
        }
      );
      return;
    }

    const occurredAt = new Date(alert.lastOccurredAt || Date.now()).toLocaleString('es-CO');
    const subject = `[Seguridad ${String(alert.severity || '').toUpperCase()}] ${alert.title}`;
    const text = [
      'Se detectó un evento de seguridad en el panel administrativo.',
      `Evento: ${alert.title}`,
      `Usuario: ${alert.username || 'no identificado'}`,
      `Fecha: ${occurredAt}`,
      `IP: ${alert.ip || 'no identificada'}`,
      '',
      'Revisa el Centro de Seguridad del panel. Este correo no contiene códigos, contraseñas ni tokens.',
    ].join('\n');
    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#172033">
        <h2>${escapeHtml(alert.title)}</h2>
        <p>Se detectó un evento de seguridad en el panel administrativo.</p>
        <ul>
          <li><strong>Usuario:</strong> ${escapeHtml(alert.username || 'no identificado')}</li>
          <li><strong>Fecha:</strong> ${escapeHtml(occurredAt)}</li>
          <li><strong>IP:</strong> ${escapeHtml(alert.ip || 'no identificada')}</li>
        </ul>
        <p>Revisa el Centro de Seguridad del panel. Este correo no contiene códigos, contraseñas ni tokens.</p>
      </div>`;

    await sendMail({ to: recipients.join(', '), subject, text, html });
    await AdminSecurityAlert.updateOne(
      { _id: alert._id },
      {
        $set: {
          notificationStatus: 'sent',
          notificationRecipients: recipients,
          notifiedAt: new Date(),
          notificationError: '',
        },
      }
    );
  } catch (error) {
    await AdminSecurityAlert.updateOne(
      { _id: alert._id },
      {
        $set: {
          notificationStatus: 'failed',
          notificationError: cleanText(error.message, 300),
        },
      }
    ).catch(() => {});
    console.error('❌ No se pudo notificar alerta de seguridad:', error.message);
  }
}

async function recordSecurityAlert(input) {
  try {
    if (mongoose.connection.readyState !== 1) return null;
    const occurredAt = input.occurredAt ? new Date(input.occurredAt) : new Date();
    const fingerprint = cleanText(input.fingerprint, 240);
    if (!fingerprint || !input.type || !input.title || !input.detail) return null;

    const alert = await AdminSecurityAlert.findOneAndUpdate(
      { fingerprint },
      {
        $setOnInsert: {
          fingerprint,
          type: input.type,
          severity: input.severity || 'medium',
          status: 'open',
          adminUser: input.adminUser || null,
          username: cleanText(input.username, 160).toLowerCase(),
          adminSession: input.adminSession || null,
          sourceId: cleanText(input.sourceId, 160),
          title: cleanText(input.title, 180),
          detail: cleanText(input.detail, 800),
          ip: cleanText(input.ip, 160),
          userAgent: cleanText(input.userAgent, 500),
          metadata: input.metadata || {},
          firstOccurredAt: occurredAt,
          notificationStatus: 'pending',
        },
        $set: { lastOccurredAt: occurredAt },
        $inc: { occurrenceCount: 1 },
      },
      { new: true, upsert: true, setDefaultsOnInsert: false }
    );

    setImmediate(() => {
      void notifyOwners(alert).catch((error) => {
        console.error('❌ No se pudo procesar notificación de seguridad:', error.message);
      });
    });
    return alert;
  } catch (error) {
    console.error('❌ No se pudo registrar alerta de seguridad:', error.message);
    return null;
  }
}

async function recordLoginAlert({ audit, adminUser = null }) {
  if (!audit || !['failed', 'blocked'].includes(audit.status)) return null;
  const blocked = audit.status === 'blocked';
  const type = blocked ? 'login_blocked' : 'login_failure';
  return recordSecurityAlert({
    fingerprint: loginFingerprint({
      type,
      username: adminUser ? audit.username : 'unknown-user',
      ip: audit.ip,
      occurredAt: audit.createdAt,
    }),
    type,
    severity: blocked ? 'high' : 'medium',
    adminUser: adminUser?._id || null,
    username: audit.username,
    sourceId: audit._id,
    title: blocked ? 'Intentos de acceso bloqueados' : 'Intento de acceso rechazado',
    detail: blocked
      ? 'El servidor bloqueó temporalmente nuevos intentos por superar el límite permitido.'
      : 'El servidor rechazó credenciales administrativas desde esta dirección IP.',
    ip: audit.ip,
    userAgent: audit.userAgent,
    occurredAt: audit.createdAt,
    metadata: { reason: audit.reason },
  });
}

async function recordSessionRiskAlerts(session, eventTypes = []) {
  if (!session?._id) return [];
  const types = Array.from(new Set(eventTypes.filter(Boolean)));
  const definitions = {
    new_device: {
      severity: 'medium',
      title: 'Nuevo dispositivo detectado',
      detail: `Se abrió una sesión desde ${session.deviceLabel || 'un dispositivo nuevo'}.`,
    },
    ip_changed: {
      severity: 'medium',
      title: 'Cambio de red detectado',
      detail: 'Una sesión administrativa cambió de dirección IP durante su uso.',
    },
    refresh_token_reuse: {
      severity: 'high',
      title: 'Reutilización de credencial bloqueada',
      detail: 'El servidor revocó una sesión por reutilización de un token de renovación.',
    },
  };

  return Promise.all(
    types.filter((type) => definitions[type]).map((type) =>
      recordSecurityAlert({
        fingerprint: hashFingerprint(`${type}:${session._id}`),
        type,
        severity: definitions[type].severity,
        adminUser: session.adminUser || null,
        username: session.username,
        adminSession: session._id,
        sourceId: session._id,
        title: definitions[type].title,
        detail: definitions[type].detail,
        ip: session.lastIp || session.createdIp,
        userAgent: session.userAgent,
        occurredAt: type === 'new_device' ? session.createdAt : new Date(),
      })
    )
  );
}

async function recordTwoFactorChangeAlert({ audit, adminUser }) {
  if (!audit?.success || !adminUser?._id) return null;
  const sensitiveActions = new Set([
    '2fa.setup.confirm',
    '2fa.reconfigure.confirm',
    '2fa.recovery_codes.regenerate',
    '2fa.disable',
    '2fa.owner.require',
    '2fa.owner.disable',
    '2fa.owner.reset',
  ]);
  if (!sensitiveActions.has(audit.action)) return null;

  const severity = /disable|reset|optional/.test(audit.action) ? 'high' : 'medium';
  return recordSecurityAlert({
    fingerprint: hashFingerprint(`two_factor_changed:${audit._id}`),
    type: 'two_factor_changed',
    severity,
    adminUser: adminUser._id,
    username: adminUser.username,
    sourceId: audit._id,
    title: 'Configuración de 2FA modificada',
    detail: audit.description || 'Se modificó la autenticación en dos pasos.',
    ip: audit.ip,
    userAgent: audit.userAgent,
    occurredAt: audit.createdAt,
    metadata: { action: audit.action },
  });
}

module.exports = {
  hashFingerprint,
  loginFingerprint,
  recordLoginAlert,
  recordSecurityAlert,
  recordSessionRiskAlerts,
  recordTwoFactorChangeAlert,
};
