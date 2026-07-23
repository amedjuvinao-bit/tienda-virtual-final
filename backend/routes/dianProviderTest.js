// backend/routes/dianProviderTest.js
const express = require('express');
const rateLimit = require('express-rate-limit');
const requireAdmin = require('../middleware/requireAdmin');
const requirePermission = require('../middleware/requirePermission');
const {
  getAdminSettingsWithBillingReadiness,
  testFactusConnectionWithIdentity,
} = require('../services/billingConnectionOrchestrationService');
const {
  hydrateBillingPayload,
} = require('../services/billingFiscalCompatibilityService');
const {
  invalidateNumberingRangesIfContextChanged,
  listFactusNumberingRanges,
  saveFactusNumberingRangeSelection,
} = require('../services/billingNumberingRangeService');
const {
  BillingConfigurationError,
} = require('../lib/billing/billingConfigurationSecurity');

const router = express.Router();
const connectionTestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    error: 'FACTUS_CONNECTION_TEST_RATE_LIMIT',
    message: 'Se alcanzó el límite temporal de pruebas de conexión con Factus.',
  },
});
const numberingRangeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    error: 'FACTUS_NUMBERING_RANGE_RATE_LIMIT',
    message: 'Se alcanzó el límite temporal de consultas de rangos en Factus.',
  },
});

router.use(requireAdmin);
router.use(requirePermission('billing:settings'));

function currentAdmin(req) {
  return (
    req.adminUsername ||
    req.user?.username ||
    req.user?.email ||
    req.adminUserId ||
    'admin'
  );
}

function sendFactusError(res, error, fallbackCode, fallbackMessage) {
  const status = Number(error?.status || error?.statusCode || 500);
  const safeStatus = status >= 400 && status <= 599 ? status : 500;

  console.error('[dianProviderTest][Factus]', {
    code: error?.code || fallbackCode,
    status: safeStatus,
    message: error?.message || 'Error no identificado',
  });

  return res.status(safeStatus).json({
    ok: false,
    error: error?.code || fallbackCode,
    message:
      error instanceof BillingConfigurationError
        ? error.message
        : fallbackMessage,
    details:
      error instanceof BillingConfigurationError && Array.isArray(error.details)
        ? error.details
        : [],
  });
}

function safeResolution(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  const {
    technicalKey,
    softwarePin,
    certificatePath,
    certificatePassword,
    ...safe
  } = source;
  void technicalKey;
  void softwarePin;
  void certificatePath;
  void certificatePassword;
  return safe;
}

router.post('/test-provider', connectionTestLimiter, async (req, res) => {
  try {
    const hydratedPayload = await hydrateBillingPayload(req.body || {});
    await invalidateNumberingRangesIfContextChanged(hydratedPayload);
    const result = await testFactusConnectionWithIdentity(hydratedPayload, {
      adminUser: currentAdmin(req),
    });

    return res.json({
      ok: true,
      provider: result.provider,
      environment: result.environment,
      status: result.status,
      message: result.message,
      company: result.company,
      verifiedAt: result.verifiedAt,
      readiness: result.readiness,
    });
  } catch (error) {
    return sendFactusError(
      res,
      error,
      'FACTUS_CONNECTION_TEST_ERROR',
      'No fue posible verificar la conexión con Factus.'
    );
  }
});

router.get('/numbering-ranges', numberingRangeLimiter, async (_req, res) => {
  try {
    const result = await listFactusNumberingRanges();

    return res.json({
      ok: true,
      environment: result.environment,
      syncedAt: result.syncedAt,
      selected: result.selected,
      invoiceRanges: result.invoiceRanges,
      creditNoteRanges: result.creditNoteRanges,
      eligibleInvoiceRanges: result.eligibleInvoiceRanges,
      eligibleCreditNoteRanges: result.eligibleCreditNoteRanges,
    });
  } catch (error) {
    return sendFactusError(
      res,
      error,
      'FACTUS_NUMBERING_RANGE_LOOKUP_ERROR',
      'No fue posible consultar los rangos oficiales de Factus.'
    );
  }
});

router.put('/numbering-ranges', numberingRangeLimiter, async (req, res) => {
  try {
    const result = await saveFactusNumberingRangeSelection(
      {
        invoiceRangeId: req.body?.invoiceRangeId,
        creditNoteRangeId: req.body?.creditNoteRangeId,
      },
      currentAdmin(req)
    );
    const settings = await getAdminSettingsWithBillingReadiness();

    return res.json({
      ok: true,
      message: 'Rangos oficiales de Factus guardados correctamente.',
      environment: result.environment,
      syncedAt: result.syncedAt,
      invoiceRange: result.invoiceRange,
      creditNoteRange: result.creditNoteRange,
      dianResolution: safeResolution(result.dianResolution),
      settings,
    });
  } catch (error) {
    return sendFactusError(
      res,
      error,
      'FACTUS_NUMBERING_RANGE_SAVE_ERROR',
      'No fue posible guardar los rangos oficiales de Factus.'
    );
  }
});

module.exports = router;
