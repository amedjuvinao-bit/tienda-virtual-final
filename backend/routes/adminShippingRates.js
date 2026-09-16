'use strict';

const express = require('express');
const requireAdmin = require('../middleware/requireAdmin');
const requirePermission = require('../middleware/requirePermission');
const {
  ShippingRatesError,
  getShippingRates,
  updateShippingRates,
} = require('../services/shippingRatesService');

const router = express.Router();

function actorFromRequest(req) {
  return req.adminUsername || req.adminUserId || req.user?._id || req.user?.id || 'admin';
}

function sendShippingRatesError(res, error) {
  if (!(error instanceof ShippingRatesError)) return false;
  res.status(error.status || 400).json({
    ok: false,
    error: error.code || 'SHIPPING_RATES_ERROR',
    message: error.message,
    details: Array.isArray(error.details) ? error.details : [],
  });
  return true;
}

router.use(requireAdmin, requirePermission('settings:shipping'));

router.get('/', async (_req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    return res.json(await getShippingRates());
  } catch (error) {
    if (sendShippingRatesError(res, error)) return undefined;
    return next(error);
  }
});

router.put('/', async (req, res, next) => {
  try {
    const result = await updateShippingRates(req.body || {}, {
      actor: actorFromRequest(req),
    });
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    return res.json({
      ...result,
      message: 'Las tarifas de envío quedaron guardadas y sincronizadas con el checkout.',
    });
  } catch (error) {
    if (sendShippingRatesError(res, error)) return undefined;
    return next(error);
  }
});

module.exports = router;
module.exports.actorFromRequest = actorFromRequest;
module.exports.sendShippingRatesError = sendShippingRatesError;
