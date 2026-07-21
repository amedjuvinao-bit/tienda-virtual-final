// backend/routes/dianProviderTest.js
const express = require('express');
const requireAdmin = require('../middleware/requireAdmin');
const requirePermission = require('../middleware/requirePermission');

const router = express.Router();

router.use(requireAdmin);
router.use(requirePermission('billing:settings'));

function trimSafe(value, max = 300) {
  return String(value || '').trim().slice(0, max);
}

router.post('/test-provider', async (req, res) => {
  try {
    const providerConfig =
      req.body?.providerConfig && typeof req.body.providerConfig === 'object'
        ? req.body.providerConfig
        : {};

    const provider = trimSafe(providerConfig.provider || req.body?.provider, 80).toLowerCase();

    if (!provider) {
      return res.status(400).json({
        ok: false,
        error: 'PROVIDER_REQUIRED',
        message: 'Debes seleccionar un proveedor de facturación electrónica.',
      });
    }

    if (provider === 'mock') {
      return res.json({
        ok: true,
        provider,
        status: 'mock_ready',
        message: 'Modo pruebas activo. No se requiere conexión externa.',
      });
    }

    if (provider === 'factus') {
      const required = ['apiUrl', 'clientId', 'clientSecret', 'username', 'password'];

      const missing = required.filter((field) => !trimSafe(providerConfig[field], 500));

      if (missing.length) {
        return res.status(422).json({
          ok: false,
          provider,
          error: 'FACTUS_CONFIG_INCOMPLETE',
          message: `Faltan campos obligatorios para Factus: ${missing.join(', ')}.`,
          missing,
        });
      }

      return res.json({
        ok: true,
        provider,
        status: 'config_ready',
        message:
          'Configuración Factus completa a nivel de campos. La autenticación real se conectará en el siguiente paso.',
      });
    }

    if (provider === 'dian') {
      const required = ['softwareId', 'softwarePin', 'technicalKey'];

      const missing = required.filter((field) => !trimSafe(providerConfig[field], 500));

      if (missing.length) {
        return res.status(422).json({
          ok: false,
          provider,
          error: 'DIAN_DIRECT_CONFIG_INCOMPLETE',
          message: `Faltan campos obligatorios para DIAN directa: ${missing.join(', ')}.`,
          missing,
        });
      }

      return res.json({
        ok: true,
        provider,
        status: 'config_ready',
        message:
          'Configuración DIAN directa completa a nivel de campos. La conexión real directa se implementará después.',
      });
    }

    return res.status(501).json({
      ok: false,
      provider,
      error: 'PROVIDER_TEST_NOT_IMPLEMENTED',
      message: `La prueba de conexión para ${provider} todavía no está implementada.`,
    });
  } catch (error) {
    console.error('POST /dian-provider/test-provider', error);

    return res.status(500).json({
      ok: false,
      error: 'DIAN_PROVIDER_TEST_ERROR',
      message: error.message || 'No se pudo probar el proveedor.',
    });
  }
});

module.exports = router;
