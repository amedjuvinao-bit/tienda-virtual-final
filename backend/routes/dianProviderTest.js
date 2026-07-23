// backend/routes/dianProviderTest.js
const express = require('express');
const rateLimit = require('express-rate-limit');
const requireAdmin = require('../middleware/requireAdmin');
const requirePermission = require('../middleware/requirePermission');
const {
  testFactusConnectionWithIdentity,
} = require('../services/billingConnectionOrchestrationService');
const {
  hydrateBillingPayload,
} = require('../services/billingFiscalCompatibilityService');
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

router.post('/test-provider', connectionTestLimiter, async (req, res) => {
  try {
    const hydratedPayload = await hydrateBillingPayload(req.body || {});
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
    const status = Number(error?.status || error?.statusCode || 500);
    const safeStatus = status >= 400 && status <= 599 ? status : 500;

    console.error('[dianProviderTest][Factus]', {
      code: error?.code || 'FACTUS_CONNECTION_TEST_ERROR',
      status: safeStatus,
      message: error?.message || 'Error no identificado',
    });

    return res.status(safeStatus).json({
      ok: false,
      error: error?.code || 'FACTUS_CONNECTION_TEST_ERROR',
      message:
        error instanceof BillingConfigurationError
          ? error.message
          : 'No fue posible verificar la conexión con Factus.',
      details:
        error instanceof BillingConfigurationError && Array.isArray(error.details)
          ? error.details
          : [],
    });
  }
});

module.exports = router;
