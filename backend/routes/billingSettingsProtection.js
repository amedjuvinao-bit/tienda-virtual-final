'use strict';

const express = require('express');
const requireAdmin = require('../middleware/requireAdmin');
const requirePermission = require('../middleware/requirePermission');
const {
  getAdminSettingsWithBillingReadiness,
  updateBillingConfigurationWithReadiness,
} = require('../services/billingConnectionOrchestrationService');
const {
  BillingConfigurationError,
} = require('../lib/billing/billingConfigurationSecurity');

const router = express.Router();

function currentAdmin(req) {
  return (
    req.adminUsername ||
    req.user?.username ||
    req.user?.email ||
    req.adminUserId ||
    'admin'
  );
}

function sendConfigurationError(res, error) {
  const status = Number(error?.status || error?.statusCode || 500);
  const safeStatus = status >= 400 && status <= 599 ? status : 500;

  return res.status(safeStatus).json({
    ok: false,
    error: error?.code || 'BILLING_CONFIGURATION_ERROR',
    message:
      error instanceof BillingConfigurationError
        ? error.message
        : 'No fue posible procesar la configuración de facturación.',
    details:
      error instanceof BillingConfigurationError && Array.isArray(error.details)
        ? error.details
        : [],
  });
}

// Intercepta la lectura administrativa antes del router genérico para migrar
// credenciales antiguas, ocultar secretos y calcular el estado real de producción.
router.get(
  '/admin',
  requireAdmin,
  requirePermission('settings:view'),
  async (_req, res) => {
    try {
      const settings = await getAdminSettingsWithBillingReadiness();
      return res.json(settings);
    } catch (error) {
      return sendConfigurationError(res, error);
    }
  }
);

// Esta ruta se monta antes de siteSettings. Solo intercepta actualizaciones que
// contienen billing; las demás configuraciones continúan hacia el router general.
router.put('/', (req, res, next) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  if (!Object.prototype.hasOwnProperty.call(body, 'billing')) return next();

  return requireAdmin(req, res, () =>
    requirePermission('billing:settings')(req, res, async () => {
      try {
        const extraKeys = Object.keys(body).filter(
          (key) => !['billing'].includes(key)
        );

        if (extraKeys.length) {
          throw new BillingConfigurationError(
            'La configuración de facturación debe guardarse por separado de otros ajustes del sitio.',
            'BILLING_MIXED_UPDATE_NOT_ALLOWED',
            400,
            extraKeys
          );
        }

        const settings = await updateBillingConfigurationWithReadiness(
          body.billing,
          {
            adminUser: currentAdmin(req),
          }
        );

        return res.json(settings);
      } catch (error) {
        return sendConfigurationError(res, error);
      }
    })
  );
});

module.exports = router;
