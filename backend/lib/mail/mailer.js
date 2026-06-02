// backend/lib/mail/mailer.js

const nodemailer = require('nodemailer');

const MailSettings = require('../../models/MailSettings');
const { decryptText } = require('./encryption');

const MAIL_SETTINGS_KEY = 'main';

function normalizeText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function normalizeEmail(value) {
  return normalizeText(value).toLowerCase();
}

function getBooleanSecureValue(security) {
  return security === 'ssl';
}

function getRequireTlsValue(security) {
  return security === 'starttls';
}

async function getMailSettingsWithSecret() {
  let settings = await MailSettings.findOne({ key: MAIL_SETTINGS_KEY }).select(
    '+smtpPasswordEncrypted +passwordUpdatedAt'
  );

  if (!settings) {
    settings = await MailSettings.create({
      key: MAIL_SETTINGS_KEY,
      provider: 'smtp',
      enabled: false,
    });
  }

  return settings;
}

function validateMailSettings(settings) {
  if (!settings) {
    throw new Error('No existe configuración de correo.');
  }

  if (!settings.enabled) {
    throw new Error('La configuración de correo está desactivada.');
  }

  if (!settings.fromEmail) {
    throw new Error('Falta configurar el correo remitente.');
  }

  if (!settings.smtpHost) {
    throw new Error('Falta configurar el servidor SMTP.');
  }

  if (!settings.smtpPort) {
    throw new Error('Falta configurar el puerto SMTP.');
  }

  if (!settings.smtpUser) {
    throw new Error('Falta configurar el usuario SMTP.');
  }

  if (!settings.smtpPasswordEncrypted) {
    throw new Error('Falta configurar la clave SMTP.');
  }
}

function buildTransportOptions(settings) {
  const smtpPassword = decryptText(settings.smtpPasswordEncrypted);

  if (!smtpPassword) {
    throw new Error('No se pudo obtener la clave SMTP.');
  }

  const security = settings.smtpSecurity || 'ssl';

  return {
    host: settings.smtpHost,
    port: Number(settings.smtpPort || 465),
    secure: getBooleanSecureValue(security),
    requireTLS: getRequireTlsValue(security),
    auth: {
      user: settings.smtpUser,
      pass: smtpPassword,
    },
  };
}

function buildFromAddress(settings) {
  const fromName = normalizeText(settings.fromName);
  const fromEmail = normalizeEmail(settings.fromEmail);

  if (fromName) {
    return `"${fromName}" <${fromEmail}>`;
  }

  return fromEmail;
}

async function createMailTransporter() {
  const settings = await getMailSettingsWithSecret();

  validateMailSettings(settings);

  const transportOptions = buildTransportOptions(settings);
  const transporter = nodemailer.createTransport(transportOptions);

  return {
    settings,
    transporter,
  };
}

async function verifyMailTransporter() {
  const { transporter } = await createMailTransporter();

  await transporter.verify();

  return true;
}

async function sendMail({
  to,
  subject,
  text = '',
  html = '',
  replyTo = '',
  attachments = [],
}) {
  const cleanTo = normalizeEmail(to);
  const cleanSubject = normalizeText(subject);

  if (!cleanTo) {
    throw new Error('Falta el destinatario del correo.');
  }

  if (!cleanSubject) {
    throw new Error('Falta el asunto del correo.');
  }

  if (!text && !html) {
    throw new Error('Falta el contenido del correo.');
  }

  const { settings, transporter } = await createMailTransporter();

  const message = {
    from: buildFromAddress(settings),
    to: cleanTo,
    subject: cleanSubject,
    text,
    html,
    attachments,
  };

  const finalReplyTo = normalizeEmail(replyTo || settings.replyToEmail);

  if (finalReplyTo) {
    message.replyTo = finalReplyTo;
  }

  return transporter.sendMail(message);
}

module.exports = {
  getMailSettingsWithSecret,
  createMailTransporter,
  verifyMailTransporter,
  sendMail,
};