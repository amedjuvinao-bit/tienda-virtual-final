'use strict';

const express = require('express');

const requireAdmin = require('../middleware/requireAdmin');
const requirePermission = require('../middleware/requirePermission');
const {
  StoreSettingsError,
  getStoreSettings,
  updateStoreSettings,
} = require('../services/storeSettingsService');

const router = express.Router();

function actorFromRequest(req) {
  return req.adminUsername || req.adminUserId || 'admin';
}

function sendStoreSettingsError(res, error) {
  if (!(error instanceof StoreSettingsError)) return false;

  res.status(error.status || 400).json({
    ok: false,
    error: error.code || 'STORE_SETTINGS_ERROR',
    message: error.message,
    details: Array.isArray(error.details) ? error.details : [],
  });
  return true;
}

router.get(
  '/',
  requireAdmin,
  requirePermission('settings:store'),
  async (_req, res, next) => {
    try {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      return res.json(await getStoreSettings());
    } catch (error) {
      if (sendStoreSettingsError(res, error)) return undefined;
      return next(error);
    }
  }
);

router.put(
  '/',
  requireAdmin,
  requirePermission('settings:store'),
  async (req, res, next) => {
    try {
      const result = await updateStoreSettings(req.body, {
        actor: actorFromRequest(req),
      });
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      return res.json(result);
    } catch (error) {
      if (sendStoreSettingsError(res, error)) return undefined;
      return next(error);
    }
  }
);

module.exports = router;
module.exports.actorFromRequest = actorFromRequest;
module.exports.sendStoreSettingsError = sendStoreSettingsError;
