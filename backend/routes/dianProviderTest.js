// backend/routes/dianProviderTest.js
const express = require('express');
const requireAdmin = require('../middleware/requireAdmin');
const requirePermission = require('../middleware/requirePermission');
const {
  testFactusConnection,
} = require('../services/billingConfigurationService');
const {
  BillingConfigurationError,
} = require('../lib/billing/billingConfigurationSecurity');

const router = express.Router();

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

router.post('/test-provider', async (req, res) => {
  try {
    const result = await testFactusConnection(req.body || {}, {
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