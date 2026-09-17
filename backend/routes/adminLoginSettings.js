'use strict';

const express = require('express');

const requireAdmin = require('../middleware/requireAdmin');
const requirePermission = require('../middleware/requirePermission');
const {
  LoginSettingsError,
  getLoginSettings,
  updateLoginSettings,
} = require('../services/loginSettingsService');

const router = express.Router();

function sendError(res, error) {
  if (error instanceof LoginSettingsError) {
    return res.status(error.status || 400).json({
      ok: false,
      error: error.code,
      message: error.message,
      details: error.details || [],
    });
  }

  return res.status(500).json({
    ok: false,
    error: 'LOGIN_SETTINGS_ERROR',
    message: 'No fue posible administrar el diseño del acceso.',
    details: [],
  });
}

router.use(requireAdmin, requirePermission('settings:login'));

router.get('/', async (_req, res) => {
  try {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    return res.json(await getLoginSettings());
  } catch (error) {
    return sendError(res, error);
  }
});

router.put('/', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    return res.json(await updateLoginSettings(req.body || {}, {
      actor: req.adminUsername || req.adminUserId || 'admin',
    }));
  } catch (error) {
    return sendError(res, error);
  }
});

module.exports = router;
module.exports.sendError = sendError;
