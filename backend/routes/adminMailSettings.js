// backend/routes/adminMailSettings.js

const express = require('express');

const router = express.Router();

const requireAdmin = require('../middleware/requireAdmin');
const MailSettings = require('../models/MailSettings');
const { encryptText } = require('../lib/mail/encryption');
const { sendMail } = require('../lib/mail/mailer');

function normalizeText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function normalizeEmail(value) {
  return normalizeText(value).toLowerCase();
}

function canManageMailSettings(req) {
  const role = String(req.adminRole || '').toLowerCase();
  const permissions = Array.isArray(req.adminPermissions)
    ? req.adminPermissions
    : [];

  return (
    role === 'owner' ||
    role === 'admin' ||
    permissions.includes('settings:mail') ||
    permissions.includes('settings:manage') ||
    permissions.includes('admin:settings')
  );
}

function rejectForbidden(res) {
  return res.status(403).json({
    ok: false,
    error: 'FORBIDDEN',
    message: 'No tienes permisos para administrar la configuración de correo.',
  });
}

function buildMeta() {
  return {
    providers: [
      {
        value: 'gmail',
        label: 'Gmail',
        description: 'Usa smtp.gmail.com con contraseña de aplicación.',
      },
      {
        value: 'outlook',
        label: 'Outlook / Microsoft 365',
        description: 'Usa smtp.office365.com con STARTTLS.',
      },
      {
        value: 'zoho',
        label: 'Zoho Mail',
        description: 'Usa smtp.zoho.com.',
      },
      {
        value: 'smtp',
        label: 'SMTP personalizado',
        description: 'Para Hostinger, GoDaddy, cPanel u otro correo corporativo.',
      },
    ],

    securityTypes: [
      {
        value: 'ssl',
        label: 'SSL / TLS',
        description: 'Normalmente puerto 465.',
      },
      {
        value: 'starttls',
        label: 'STARTTLS',
        description: 'Normalmente puerto 587.',
      },
      {
        value: 'none',
        label: 'Sin cifrado',
        description: 'No recomendado para producción.',
      },
    ],

    presetDefaults: {
      gmail: {
        smtpHost: 'smtp.gmail.com',
        smtpPort: 465,
        smtpSecurity: 'ssl',
      },
      outlook: {
        smtpHost: 'smtp.office365.com',
        smtpPort: 587,
        smtpSecurity: 'starttls',
      },
      zoho: {
        smtpHost: 'smtp.zoho.com',
        smtpPort: 465,
        smtpSecurity: 'ssl',
      },
      smtp: {
        smtpHost: '',
        smtpPort: 465,
        smtpSecurity: 'ssl',
      },
    },
  };
}

function sanitizeUpdateBody(body = {}) {
  const provider = normalizeText(body.provider || 'smtp').toLowerCase();

  const smtpPortNumber = Number(body.smtpPort || 465);

  return {
    enabled: Boolean(body.enabled),
    provider,
    fromName: normalizeText(body.fromName),
    fromEmail: normalizeEmail(body.fromEmail),
    replyToEmail: normalizeEmail(body.replyToEmail),
    smtpHost: normalizeText(body.smtpHost).toLowerCase(),
    smtpPort: Number.isFinite(smtpPortNumber) ? smtpPortNumber : 465,
    smtpSecurity: normalizeText(body.smtpSecurity || 'ssl').toLowerCase(),
    smtpUser: normalizeText(body.smtpUser),
    testEmail: normalizeEmail(body.testEmail),
  };
}

router.get('/', requireAdmin, async (req, res) => {
  try {
    if (!canManageMailSettings(req)) {
      return rejectForbidden(res);
    }

    const settings = await MailSettings.getSingleton();

    return res.json({
      ok: true,
      settings: settings.toSafeObject(),
      meta: buildMeta(),
    });
  } catch (error) {
    console.error('[adminMailSettings][GET /]', error);

    return res.status(500).json({
      ok: false,
      error: 'MAIL_SETTINGS_GET_ERROR',
      message: error.message || 'No se pudo obtener la configuración de correo.',
    });
  }
});

router.put('/', requireAdmin, async (req, res) => {
  try {
    if (!canManageMailSettings(req)) {
      return rejectForbidden(res);
    }

    const settings = await MailSettings.getSingleton();
    const cleanBody = sanitizeUpdateBody(req.body || {});

    settings.enabled = cleanBody.enabled;
    settings.provider = cleanBody.provider;
    settings.fromName = cleanBody.fromName;
    settings.fromEmail = cleanBody.fromEmail;
    settings.replyToEmail = cleanBody.replyToEmail;
    settings.smtpHost = cleanBody.smtpHost;
    settings.smtpPort = cleanBody.smtpPort;
    settings.smtpSecurity = cleanBody.smtpSecurity;
    settings.smtpUser = cleanBody.smtpUser;
    settings.testEmail = cleanBody.testEmail;
    settings.updatedBy = req.adminUserId || null;

    const smtpPassword = String(req.body?.smtpPassword || '');

    if (smtpPassword.trim()) {
      settings.smtpPasswordEncrypted = encryptText(smtpPassword);
      settings.passwordUpdatedAt = new Date();
      settings.hasSmtpPassword = true;
    }

    if (req.body?.clearSmtpPassword === true) {
      settings.smtpPasswordEncrypted = '';
      settings.passwordUpdatedAt = null;
      settings.hasSmtpPassword = false;
    }

    await settings.save();

    return res.json({
      ok: true,
      message: 'Configuración de correo guardada correctamente.',
      settings: settings.toSafeObject(),
      meta: buildMeta(),
    });
  } catch (error) {
    console.error('[adminMailSettings][PUT /]', error);

    return res.status(400).json({
      ok: false,
      error: 'MAIL_SETTINGS_SAVE_ERROR',
      message: error.message || 'No se pudo guardar la configuración de correo.',
    });
  }
});

router.post('/test', requireAdmin, async (req, res) => {
  try {
    if (!canManageMailSettings(req)) {
      return rejectForbidden(res);
    }

    const settings = await MailSettings.getSingleton();

    const testEmail = normalizeEmail(
      req.body?.testEmail || settings.testEmail || settings.fromEmail
    );

    if (!testEmail) {
      return res.status(400).json({
        ok: false,
        error: 'TEST_EMAIL_REQUIRED',
        message: 'Debes indicar un correo de prueba.',
      });
    }

    const now = new Date();

    await sendMail({
      to: testEmail,
      subject: 'Prueba de configuración de correo',
      text:
        'Este es un correo de prueba enviado desde el panel administrativo de la tienda virtual.',
      html: `
        <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
          <h2 style="margin: 0 0 12px;">Correo de prueba</h2>
          <p>Este mensaje confirma que la configuración de correo está funcionando correctamente.</p>
          <p><strong>Fecha:</strong> ${now.toLocaleString('es-CO')}</p>
        </div>
      `,
    });

    settings.testEmail = testEmail;
    settings.lastTestStatus = 'success';
    settings.lastTestMessage = `Correo de prueba enviado correctamente a ${testEmail}.`;
    settings.lastTestAt = now;
    settings.updatedBy = req.adminUserId || null;

    await settings.save();

    return res.json({
      ok: true,
      message: settings.lastTestMessage,
      settings: settings.toSafeObject(),
    });
  } catch (error) {
    console.error('[adminMailSettings][POST /test]', error);

    const settings = await MailSettings.getSingleton().catch(() => null);

    if (settings) {
      settings.lastTestStatus = 'error';
      settings.lastTestMessage =
        error.message || 'No se pudo enviar el correo de prueba.';
      settings.lastTestAt = new Date();
      settings.updatedBy = req.adminUserId || null;

      await settings.save().catch(() => null);
    }

    return res.status(400).json({
      ok: false,
      error: 'MAIL_TEST_ERROR',
      message: error.message || 'No se pudo enviar el correo de prueba.',
      settings: settings ? settings.toSafeObject() : null,
    });
  }
});

module.exports = router;