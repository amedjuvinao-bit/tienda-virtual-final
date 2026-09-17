'use strict';

const crypto = require('crypto');

const MailSettings = require('../models/MailSettings');
const SiteSettings = require('../models/SiteSettings');
const { encryptText } = require('../lib/mail/encryption');
const { sendTestMail } = require('../lib/mail/mailer');

const PROVIDERS = Object.freeze({
  gmail: {
    label: 'Gmail',
    description: 'Cuenta de Google con contraseña de aplicación.',
    smtpHost: 'smtp.gmail.com',
    smtpPort: 465,
    smtpSecurity: 'ssl',
  },
  outlook: {
    label: 'Outlook / Microsoft 365',
    description: 'Cuenta de Microsoft con acceso SMTP habilitado.',
    smtpHost: 'smtp.office365.com',
    smtpPort: 587,
    smtpSecurity: 'starttls',
  },
  zoho: {
    label: 'Zoho Mail',
    description: 'Cuenta de Zoho con acceso SMTP habilitado.',
    smtpHost: 'smtp.zoho.com',
    smtpPort: 465,
    smtpSecurity: 'ssl',
  },
  smtp: {
    label: 'Otro correo',
    description: 'Correo corporativo de Hostinger, cPanel u otro proveedor.',
    smtpHost: '',
    smtpPort: 465,
    smtpSecurity: 'ssl',
  },
});

const SECURITY_TYPES = Object.freeze({
  ssl: { label: 'SSL / TLS', description: 'Conexión segura, normalmente puerto 465.' },
  starttls: { label: 'STARTTLS', description: 'Conexión segura, normalmente puerto 587.' },
  none: { label: 'Sin cifrado', description: 'Solo para redes privadas controladas.' },
});

class MailSettingsError extends Error {
  constructor(message, code, status = 400, details = []) {
    super(message);
    this.name = 'MailSettingsError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function cleanText(value, maxLength = 180) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function normalizeEmail(value) {
  return cleanText(value, 180).toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ''));
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function revisionNumber(value) {
  const revision = Number(value);
  return Number.isInteger(revision) && revision >= 0 ? revision : 0;
}

function buildMeta() {
  return {
    providers: Object.entries(PROVIDERS).map(([value, provider]) => ({
      value,
      label: provider.label,
      description: provider.description,
    })),
    securityTypes: Object.entries(SECURITY_TYPES).map(([value, security]) => ({
      value,
      label: security.label,
      description: security.description,
    })),
    presetDefaults: Object.fromEntries(
      Object.entries(PROVIDERS).map(([value, provider]) => [value, {
        smtpHost: provider.smtpHost,
        smtpPort: provider.smtpPort,
        smtpSecurity: provider.smtpSecurity,
      }])
    ),
  };
}

function normalizeMailSettings(input = {}) {
  const requestedProvider = cleanText(input.provider).toLowerCase();
  const provider = Object.hasOwn(PROVIDERS, requestedProvider) ? requestedProvider : 'smtp';
  const preset = PROVIDERS[provider];
  const requestedSecurity = cleanText(input.smtpSecurity).toLowerCase();
  const smtpSecurity = Object.hasOwn(SECURITY_TYPES, requestedSecurity)
    ? requestedSecurity
    : 'ssl';
  const rawPort = Number(input.smtpPort);

  return {
    provider,
    fromEmail: normalizeEmail(input.fromEmail),
    replyToEmail: normalizeEmail(input.replyToEmail),
    smtpHost: provider === 'smtp'
      ? cleanText(input.smtpHost).toLowerCase()
      : preset.smtpHost,
    smtpPort: provider === 'smtp' && Number.isInteger(rawPort)
      ? rawPort
      : preset.smtpPort,
    smtpSecurity: provider === 'smtp' ? smtpSecurity : preset.smtpSecurity,
    smtpUser: cleanText(input.smtpUser),
    testEmail: normalizeEmail(input.testEmail),
  };
}

function getStoredValue(settings, key) {
  if (!settings) return '';
  return typeof settings.get === 'function' ? settings.get(key) : settings[key];
}

function hasStoredPassword(settings) {
  return Boolean(
    getStoredValue(settings, 'smtpPasswordEncrypted') ||
    getStoredValue(settings, 'hasSmtpPassword')
  );
}

function configurationFingerprint(settings) {
  const normalized = normalizeMailSettings(settings);
  const payload = {
    provider: normalized.provider,
    fromEmail: normalized.fromEmail,
    replyToEmail: normalized.replyToEmail,
    smtpHost: normalized.smtpHost,
    smtpPort: normalized.smtpPort,
    smtpSecurity: normalized.smtpSecurity,
    smtpUser: normalized.smtpUser,
    hasPassword: hasStoredPassword(settings),
  };
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

async function getStoreIdentity(SiteSettingsModel = SiteSettings) {
  const settings = await SiteSettingsModel.findOne()
    .select('store.name store.businessName store.email store.supportEmail')
    .lean();
  const store = settings?.store || {};
  return {
    name: cleanText(store.name, 120),
    businessName: cleanText(store.businessName, 180),
    email: normalizeEmail(store.email),
    supportEmail: normalizeEmail(store.supportEmail),
  };
}

function validateConnection(settings) {
  const normalized = normalizeMailSettings(settings);
  const details = [];

  if (!isValidEmail(normalized.fromEmail)) {
    details.push({ field: 'fromEmail', message: 'Escribe un correo remitente válido.' });
  }
  if (normalized.replyToEmail && !isValidEmail(normalized.replyToEmail)) {
    details.push({ field: 'replyToEmail', message: 'Escribe un correo de respuesta válido.' });
  }
  if (!normalized.smtpHost) {
    details.push({ field: 'smtpHost', message: 'Escribe el servidor indicado por tu proveedor.' });
  }
  if (!Number.isInteger(normalized.smtpPort) || normalized.smtpPort < 1 || normalized.smtpPort > 65535) {
    details.push({ field: 'smtpPort', message: 'El puerto debe estar entre 1 y 65535.' });
  }
  if (!normalized.smtpUser) {
    details.push({ field: 'smtpUser', message: 'Escribe el usuario de la cuenta de correo.' });
  }
  if (!hasStoredPassword(settings)) {
    details.push({ field: 'smtpPassword', message: 'Guarda la clave o contraseña de aplicación.' });
  }

  return details;
}

function buildReadiness(settings, store = {}) {
  const details = validateConnection(settings);
  const fingerprint = configurationFingerprint(settings);
  const storedFingerprint = getStoredValue(settings, 'lastTestFingerprint');
  const tested = (
    getStoredValue(settings, 'lastTestStatus') === 'success' &&
    (!storedFingerprint || storedFingerprint === fingerprint)
  );
  const checks = [
    { key: 'identity', label: 'Nombre de la tienda', ready: Boolean(cleanText(store.name)) },
    { key: 'sender', label: 'Correo remitente', ready: !details.some((item) => item.field === 'fromEmail') },
    { key: 'server', label: 'Servidor de correo', ready: !details.some((item) => ['smtpHost', 'smtpPort'].includes(item.field)) },
    { key: 'credentials', label: 'Acceso protegido', ready: !details.some((item) => ['smtpUser', 'smtpPassword'].includes(item.field)) },
    { key: 'test', label: 'Prueba recibida', ready: tested },
  ];
  const completed = checks.filter((check) => check.ready).length;

  return {
    ready: checks.every((check) => check.ready),
    canTest: details.length === 0,
    tested,
    active: Boolean(getStoredValue(settings, 'enabled') && tested),
    completed,
    required: checks.length,
    checks,
    missing: details,
  };
}

function safeSettings(settings) {
  if (!settings) return {};
  if (typeof settings.toSafeObject === 'function') return settings.toSafeObject();
  const clone = { ...settings };
  delete clone.smtpPasswordEncrypted;
  delete clone.passwordUpdatedAt;
  delete clone.lastTestFingerprint;
  delete clone.__v;
  clone.hasSmtpPassword = hasStoredPassword(settings);
  return clone;
}

function buildMailSettingsResponse(settings, store) {
  const safe = safeSettings(settings);
  safe.fromName = cleanText(store?.name) || cleanText(safe.fromName);
  return {
    ok: true,
    settings: safe,
    store,
    readiness: buildReadiness(settings, store),
    revision: revisionNumber(getStoredValue(settings, 'revision')),
    updatedAt: getStoredValue(settings, 'updatedAt') || null,
    updatedBy: getStoredValue(settings, 'updatedBy') || null,
    meta: buildMeta(),
  };
}

async function getMailSettings(options = {}) {
  const MailSettingsModel = options.MailSettingsModel || MailSettings;
  const SiteSettingsModel = options.SiteSettingsModel || SiteSettings;
  const [settings, store] = await Promise.all([
    MailSettingsModel.getSingleton(),
    getStoreIdentity(SiteSettingsModel),
  ]);
  return buildMailSettingsResponse(settings, store);
}

function assertRevision(inputRevision, settings) {
  const expected = Number(inputRevision);
  const current = revisionNumber(getStoredValue(settings, 'revision'));
  if (!Number.isInteger(expected) || expected < 0 || expected !== current) {
    throw new MailSettingsError(
      'La configuración cambió en otra sesión. Recarga antes de continuar.',
      'MAIL_SETTINGS_CONFLICT',
      409,
      [{ currentRevision: current }]
    );
  }
}

function applyNormalizedSettings(settings, normalized, storeName) {
  settings.provider = normalized.provider;
  settings.fromName = cleanText(storeName, 120);
  settings.fromEmail = normalized.fromEmail;
  settings.replyToEmail = normalized.replyToEmail;
  settings.smtpHost = normalized.smtpHost;
  settings.smtpPort = normalized.smtpPort;
  settings.smtpSecurity = normalized.smtpSecurity;
  settings.smtpUser = normalized.smtpUser;
  settings.testEmail = normalized.testEmail;
}

async function saveSettings(settings) {
  try {
    await settings.save();
  } catch (error) {
    if (error?.name === 'VersionError') {
      throw new MailSettingsError(
        'La configuración cambió en otra sesión. Recarga antes de continuar.',
        'MAIL_SETTINGS_CONFLICT',
        409
      );
    }
    throw error;
  }
}

async function updateMailSettings(input = {}, options = {}) {
  const MailSettingsModel = options.MailSettingsModel || MailSettings;
  const SiteSettingsModel = options.SiteSettingsModel || SiteSettings;
  const settings = await MailSettingsModel.getSingleton();
  assertRevision(input.revision, settings);

  const store = await getStoreIdentity(SiteSettingsModel);
  const normalized = normalizeMailSettings(input.settings || input);
  const previousFingerprint = configurationFingerprint(settings);
  applyNormalizedSettings(settings, normalized, store.name);

  const smtpPassword = String(input.settings?.smtpPassword ?? input.smtpPassword ?? '');
  const clearPassword = (input.settings?.clearSmtpPassword ?? input.clearSmtpPassword) === true;
  let passwordChanged = false;

  if (smtpPassword.trim()) {
    settings.smtpPasswordEncrypted = encryptText(smtpPassword);
    settings.passwordUpdatedAt = new Date();
    settings.hasSmtpPassword = true;
    passwordChanged = true;
  } else if (clearPassword) {
    settings.smtpPasswordEncrypted = '';
    settings.passwordUpdatedAt = null;
    settings.hasSmtpPassword = false;
    passwordChanged = true;
  }

  const nextFingerprint = configurationFingerprint(settings);
  const connectionChanged = passwordChanged || previousFingerprint !== nextFingerprint;

  if (connectionChanged) {
    settings.enabled = false;
    settings.lastTestStatus = 'none';
    settings.lastTestMessage = '';
    settings.lastTestAt = null;
    settings.lastTestFingerprint = '';
  } else if (input.enabled === true || input.settings?.enabled === true) {
    if (settings.lastTestStatus === 'success' && !settings.lastTestFingerprint) {
      settings.lastTestFingerprint = nextFingerprint;
    }
    const readiness = buildReadiness(settings, store);
    if (!readiness.tested) {
      throw new MailSettingsError(
        'Envía y recibe una prueba antes de activar los correos automáticos.',
        'MAIL_TEST_REQUIRED',
        422
      );
    }
    settings.enabled = true;
  } else if (input.enabled === false || input.settings?.enabled === false) {
    settings.enabled = false;
  }

  settings.revision = revisionNumber(settings.revision) + 1;
  settings.updatedBy = options.actor || null;
  await saveSettings(settings);

  const response = buildMailSettingsResponse(settings, store);
  response.message = connectionChanged
    ? 'Cambios guardados. Envía una prueba para comprobar la conexión.'
    : settings.enabled
      ? 'Los correos automáticos quedaron activos.'
      : 'Configuración de correo guardada.';
  return response;
}

function friendlyDeliveryError() {
  return 'No se pudo entregar el correo. Revisa el usuario, la clave y los permisos de la cuenta.';
}

async function testMailSettings(input = {}, options = {}) {
  const MailSettingsModel = options.MailSettingsModel || MailSettings;
  const SiteSettingsModel = options.SiteSettingsModel || SiteSettings;
  const sendTestMailFn = options.sendTestMailFn || sendTestMail;
  const settings = await MailSettingsModel.getSingleton();
  assertRevision(input.revision, settings);
  const store = await getStoreIdentity(SiteSettingsModel);
  const details = validateConnection(settings);
  const testEmail = normalizeEmail(input.testEmail || settings.testEmail || settings.fromEmail);

  if (!isValidEmail(testEmail)) {
    details.push({ field: 'testEmail', message: 'Escribe el correo donde recibirás la prueba.' });
  }
  if (details.length) {
    throw new MailSettingsError(
      'Completa los datos marcados antes de enviar la prueba.',
      'MAIL_SETTINGS_INCOMPLETE',
      422,
      details
    );
  }

  try {
    await sendTestMailFn({
      to: testEmail,
      subject: `Prueba de correo de ${store.name || 'tu tienda'}`,
      text: `La conexión de correo de ${store.name || 'tu tienda'} funciona correctamente.`,
      html: `<div style="font-family:Arial,sans-serif;color:#222;line-height:1.6"><h2>Correo conectado</h2><p>La conexión de correo de <strong>${escapeHtml(cleanText(store.name)) || 'tu tienda'}</strong> funciona correctamente.</p></div>`,
    });
  } catch (error) {
    settings.enabled = false;
    settings.lastTestStatus = 'error';
    settings.lastTestMessage = friendlyDeliveryError();
    settings.lastTestAt = new Date();
    settings.lastTestFingerprint = '';
    settings.revision = revisionNumber(settings.revision) + 1;
    settings.updatedBy = options.actor || null;
    await saveSettings(settings);
    throw new MailSettingsError(
      friendlyDeliveryError(),
      'MAIL_TEST_FAILED',
      422,
      [],
    );
  }

  settings.testEmail = testEmail;
  settings.lastTestStatus = 'success';
  settings.lastTestMessage = `Prueba recibida en ${testEmail}.`;
  settings.lastTestAt = new Date();
  settings.lastTestFingerprint = configurationFingerprint(settings);
  settings.revision = revisionNumber(settings.revision) + 1;
  settings.updatedBy = options.actor || null;
  await saveSettings(settings);
  const response = buildMailSettingsResponse(settings, store);
  response.message = settings.lastTestMessage;
  return response;
}

module.exports = {
  MailSettingsError,
  PROVIDERS,
  SECURITY_TYPES,
  buildMailSettingsResponse,
  buildMeta,
  buildReadiness,
  configurationFingerprint,
  getMailSettings,
  getStoreIdentity,
  normalizeMailSettings,
  testMailSettings,
  updateMailSettings,
  validateConnection,
};
