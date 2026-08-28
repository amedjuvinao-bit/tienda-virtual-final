'use strict';

const express = require('express');

const requireAdmin = require('../middleware/requireAdmin');
const requirePermission = require('../middleware/requirePermission');
const {
  activateShippingProvider,
  confirmShippingWebhook,
  disableShippingProvider,
  getShippingSettingsView,
  requestShippingWebhookProof,
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

router.post('/webhook/confirm', async (req, res) => {
  try {
    const result = await confirmShippingWebhook(actor(req));
    return res.json({
      ok: true,
      message: 'Registro anotado. Solicita ahora la prueba oficial de Envia desde este panel.',
      ...result,
    });
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/webhook/test', async (req, res) => {
  try {
    const result = await requestShippingWebhookProof(
      {
        carrier: req.body?.carrier,
        trackingNumber: req.body?.trackingNumber,
      },
      actor(req)
    );
    return res.json({
      ok: true,
      message: 'Prueba oficial solicitada a Envia. El panel se aprobará cuando llegue el POST autenticado.',
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
