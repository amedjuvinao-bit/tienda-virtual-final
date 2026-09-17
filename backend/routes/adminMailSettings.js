'use strict';

const express = require('express');

const requireAdmin = require('../middleware/requireAdmin');
const requirePermission = require('../middleware/requirePermission');
const {
  MailSettingsError,
  getMailSettings,
  testMailSettings,
  updateMailSettings,
} = require('../services/mailSettingsService');

const router = express.Router();

function actorFromRequest(req) {
  return req.adminUsername || req.adminUserId || 'admin';
}

function sendMailSettingsError(res, error) {
  if (!(error instanceof MailSettingsError)) return false;
  res.status(error.status || 400).json({
    ok: false,
    error: error.code || 'MAIL_SETTINGS_ERROR',
    message: error.message,
    details: Array.isArray(error.details) ? error.details : [],
  });
  return true;
}

function unexpectedMessage(error, fallback) {
  const message = String(error?.message || '');
  if (/MAIL_ENCRYPTION_KEY|cifrad|decrypt|auth/i.test(message)) {
    return 'No fue posible proteger la clave de correo. Contacta al soporte técnico.';
  }
  return fallback;
}

router.get(
  '/',
  requireAdmin,
  requirePermission('settings:mail'),
  async (_req, res, next) => {
    try {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      return res.json(await getMailSettings());
    } catch (error) {
      if (sendMailSettingsError(res, error)) return undefined;
      error.message = unexpectedMessage(error, 'No se pudo cargar la configuración de correo.');
      return next(error);
    }
  }
);

router.put(
  '/',
  requireAdmin,
  requirePermission('settings:mail'),
  async (req, res) => {
    try {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      return res.json(await updateMailSettings(req.body || {}, {
        actor: actorFromRequest(req),
      }));
    } catch (error) {
      if (sendMailSettingsError(res, error)) return undefined;
      return res.status(422).json({
        ok: false,
        error: 'MAIL_SETTINGS_SAVE_ERROR',
        message: unexpectedMessage(error, 'No se pudo guardar la configuración de correo.'),
        details: [],
      });
    }
  }
);

router.post(
  '/test',
  requireAdmin,
  requirePermission('settings:mail_test'),
  async (req, res, next) => {
    try {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      return res.json(await testMailSettings(req.body || {}, {
        actor: actorFromRequest(req),
      }));
    } catch (error) {
      if (sendMailSettingsError(res, error)) return undefined;
      return next(error);
    }
  }
);

module.exports = router;
module.exports.actorFromRequest = actorFromRequest;
module.exports.sendMailSettingsError = sendMailSettingsError;
