'use strict';

const express = require('express');
const SiteSettings = require('../models/SiteSettings');
const requireAdmin = require('../middleware/requireAdmin');
const requirePermission = require('../middleware/requirePermission');
const {
  getAdminSettingsWithBillingReadiness,
  updateBillingConfigurationWithReadiness,
} = require('../services/billingConnectionOrchestrationService');
const {
  ensureStoredFiscalInfoCompatibility,
  hydrateBillingConfiguration,
} = require('../services/billingFiscalCompatibilityService');
const {
  assertProductionNumberingRangesReady,
  readNumberingRangeSnapshot,
  reconcileNumberingRangeSnapshot,
} = require('../services/billingNumberingRangePersistenceService');
const {
  BillingConfigurationError,
  PRODUCTION_MODE,
  normalizeMode,
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

function preserveSynchronizedRangeIds(billing = {}) {
  const source = billing && typeof billing === 'object' ? billing : {};
  const resolution =
    source.dianResolution && typeof source.dianResolution === 'object'
      ? source.dianResolution
      : {};
  const provider =
    source.electronicProvider && typeof source.electronicProvider === 'object'
      ? source.electronicProvider
      : {};
  const invoiceRangeId = Number(
    provider.numberingRangeId || resolution.numberingRangeId || 0
  );
  const creditNoteRangeId = Number(
    provider.creditNoteNumberingRangeId ||
      resolution.creditNoteNumberingRangeId ||
      0
  );

  return {
    ...source,
    electronicProvider: {
      ...provider,
      numberingRangeId:
        Number.isInteger(invoiceRangeId) && invoiceRangeId > 0
          ? invoiceRangeId
          : 0,
      creditNoteNumberingRangeId:
        Number.isInteger(creditNoteRangeId) && creditNoteRangeId > 0
          ? creditNoteRangeId
          : 0,
    },
  };
}

async function assertDedicatedFirstProductionActivation(incomingBilling = {}) {
  const stored = await SiteSettings.findOne()
    .select('billing.dian.mode')
    .lean();
  const storedMode = normalizeMode(stored?.billing?.dian?.mode);
  const requestedMode = normalizeMode(
    incomingBilling?.dian?.mode ?? stored?.billing?.dian?.mode
  );

  if (requestedMode === PRODUCTION_MODE && storedMode !== PRODUCTION_MODE) {
    throw new BillingConfigurationError(
      'La primera activación de Producción debe realizarse con el botón “Validar todo y activar producción”.',
      'BILLING_PRODUCTION_DEDICATED_ACTIVATION_REQUIRED',
      409,
      ['usar el flujo de activación productiva por cliente']
    );
  }
}

// Intercepta la lectura administrativa antes del router genérico para migrar
// credenciales antiguas, normalizar datos fiscales históricos, ocultar secretos
// y calcular el estado real de producción.
router.get(
  '/admin',
  requireAdmin,
  requirePermission('settings:view'),
  async (_req, res) => {
    try {
      await ensureStoredFiscalInfoCompatibility();
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

        await assertDedicatedFirstProductionActivation(body.billing);
        const rangeSnapshot = await readNumberingRangeSnapshot();
        const hydratedBilling = await hydrateBillingConfiguration(
          preserveSynchronizedRangeIds(body.billing)
        );
        await assertProductionNumberingRangesReady(hydratedBilling);
        await updateBillingConfigurationWithReadiness(hydratedBilling, {
          adminUser: currentAdmin(req),
        });
        await reconcileNumberingRangeSnapshot(rangeSnapshot);
        const settings = await getAdminSettingsWithBillingReadiness();

        return res.json(settings);
      } catch (error) {
        return sendConfigurationError(res, error);
      }
    })
  );
});

module.exports = router;
