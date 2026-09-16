'use strict';

const express = require('express');
const requireAdmin = require('../middleware/requireAdmin');
const requirePermission = require('../middleware/requirePermission');
const {
  PaymentSettingsError,
  getPaymentSettings,
  updatePaymentSettings,
} = require('../services/paymentSettingsService');

const router = express.Router();

function actorFromRequest(req) {
  return req.adminUsername || req.adminUserId || req.user?._id || req.user?.id || 'admin';
}

function sendPaymentSettingsError(res, error) {
  if (!(error instanceof PaymentSettingsError)) return false;
  res.status(error.status || 400).json({
    ok: false,
    error: error.code || 'PAYMENT_SETTINGS_ERROR',
    message: error.message,
    details: Array.isArray(error.details) ? error.details : [],
  });
  return true;
}

router.use(requireAdmin, requirePermission('settings:payments'));

router.get('/', async (_req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    return res.json(await getPaymentSettings());
  } catch (error) {
    if (sendPaymentSettingsError(res, error)) return undefined;
    return next(error);
  }
});

router.put('/', async (req, res, next) => {
  try {
    const result = await updatePaymentSettings(req.body || {}, {
      actor: actorFromRequest(req),
    });
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    return res.json({
      ...result,
      message: 'La configuración de pagos quedó guardada de forma segura.',
    });
  } catch (error) {
    if (sendPaymentSettingsError(res, error)) return undefined;
    return next(error);
  }
});

module.exports = router;
module.exports.actorFromRequest = actorFromRequest;
module.exports.sendPaymentSettingsError = sendPaymentSettingsError;
