'use strict';

const express = require('express');

const requireAdmin = require('../middleware/requireAdmin');
const requirePermission = require('../middleware/requirePermission');
const {
  activateShippingProvider,
  disableShippingProvider,
  getShippingSettingsView,
  registerShippingWebhook,
  testShippingConnection,
  updateShippingSettings,
} = require('../services/shippingConfigurationService');

const router = express.Router();

router.use(requireAdmin, requirePermission('settings:shipping'));

function actor(req) {
  return req.adminUserId || req.user?._id || req.user?.id || null;
}

function sendError(res, error) {
  return res.status(error?.statusCode || error?.status || 500).json({
    ok: false,
    error: error?.code || 'SHIPPING_SETTINGS_ERROR',
    message:
      error?.message ||
      'No fue posible administrar la configuración de transportadoras.',
    details: error?.details || undefined,
  });
}

router.get('/', async (_req, res) => {
  try {
    return res.json({ ok: true, ...(await getShippingSettingsView()) });
  } catch (error) {
    return sendError(res, error);
  }
});

router.put('/', async (req, res) => {
  try {
    const result = await updateShippingSettings(req.body || {}, actor(req));
    return res.json({
      ok: true,
      message: 'Configuración guardada. La operación manual continúa activa hasta aprobar y activar la conexión.',
      ...result,
    });
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/test', async (req, res) => {
  try {
    const result = await testShippingConnection(actor(req));
    return res.json({
      ok: true,
      message: result.settings?.lastTestMessage || 'Conexión aprobada.',
      ...result,
    });
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/webhook/register', async (req, res) => {
  try {
    const result = await registerShippingWebhook(actor(req));
    return res.status(201).json({
      ok: true,
      message: 'Webhook firmado de seguimiento registrado en Envia.',
      ...result,
    });
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/activate', async (req, res) => {
  try {
    const result = await activateShippingProvider(
      { confirmProduction: req.body?.confirmProduction === true },
      actor(req)
    );
    return res.json({
      ok: true,
      message: `Envia ${result.settings?.enviaMode === 'production' ? 'Producción' : 'Sandbox'} quedó activo como proveedor predeterminado.`,
      ...result,
    });
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/disable', async (req, res) => {
  try {
    const result = await disableShippingProvider(actor(req));
    return res.json({
      ok: true,
      message: 'Envia fue desactivado. La operación manual continúa disponible.',
      ...result,
    });
  } catch (error) {
    return sendError(res, error);
  }
});

module.exports = router;
