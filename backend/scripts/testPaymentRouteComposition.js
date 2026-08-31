'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  findAdminRoutePermission,
} = require('../security/adminRoutePermissionMap');

const paymentsRouter = require('../routes/payments');
const payuRouter = require('../routes/payuProductionWebhook');
const wompiWebhookIntegrity = require('../services/wompiWebhookIntegrityService');

function routeLayers(router) {
  return router.stack.filter((layer) => layer.route);
}

function matchingRoutes(router, method, routePath) {
  return routeLayers(router).filter(
    (layer) =>
      layer.route.path === routePath && layer.route.methods?.[method] === true
  );
}

function assertRoute(router, method, routePath, handlerCount) {
  const matches = matchingRoutes(router, method, routePath);
  assert.equal(matches.length, 1, `${method.toUpperCase()} ${routePath}`);
  assert.equal(
    matches[0].route.stack.length,
    handlerCount,
    `${method.toUpperCase()} ${routePath} middleware`
  );
}

function main() {
  const checks = [];
  const ok = (message) => {
    checks.push(message);
    console.log(`OK ${checks.length}: ${message}`);
  };

  const expectedPaymentRoutes = [
    ['get', '/public-config', 1],
    ['post', '/wompi/checkout-data', 1],
    ['get', '/wompi/transaction/:transactionId', 1],
    ['post', '/admin/wompi/test-merchant', 3],
    ['post', '/wompi/webhook', 1],
    ['post', '/admin/delete-factus-invoice/:orderId', 3],
    ['post', '/admin/create-credit-note/:orderId', 3],
    ['post', '/admin/retry-electronic-invoice/:orderId', 3],
  ];

  expectedPaymentRoutes.forEach(([method, routePath, handlers]) =>
    assertRoute(paymentsRouter, method, routePath, handlers)
  );
  assert.equal(routeLayers(paymentsRouter).length, expectedPaymentRoutes.length);
  ok('payments expone únicamente sus ocho rutas cohesionadas');

  assert.equal(matchingRoutes(paymentsRouter, 'post', '/payu/checkout-data').length, 0);
  assert.equal(matchingRoutes(paymentsRouter, 'post', '/payu/webhook').length, 0);
  assertRoute(payuRouter, 'post', '/payu/checkout-data', 1);
  assertRoute(payuRouter, 'post', '/payu/webhook', 2);
  ok('PayU tiene una sola implementación: payuProductionWebhook');

  const indexSource = fs.readFileSync(
    path.join(__dirname, '..', 'index.js'),
    'utf8'
  );
  const payuImport = indexSource.indexOf(
    "const payuRoutes = requireCritical('./routes/payuProductionWebhook')"
  );
  const paymentsImport = indexSource.indexOf(
    "const paymentRoutes = requireCritical('./routes/payments')"
  );
  const payuMount = indexSource.indexOf(
    "if (payuRoutes) app.use('/api/payments', payuRoutes)"
  );
  const paymentsMount = indexSource.indexOf(
    "if (paymentRoutes) app.use('/api/payments', paymentRoutes)"
  );
  assert(payuImport >= 0 && paymentsImport > payuImport);
  assert(payuMount >= 0 && paymentsMount > payuMount);
  ok('index monta la autoridad PayU y después el compositor general');

  const integrityServiceFiles = [
    'wompiWebhookIntegrityService.js',
    'wompiWebhookApprovalEvidence.js',
    'wompiWebhookPaymentState.js',
    'wompiWebhookApprovedProcessor.js',
  ];
  integrityServiceFiles.forEach((fileName) => {
    const source = fs.readFileSync(
      path.join(__dirname, '..', 'services', fileName),
      'utf8'
    );
    assert(
      source.split(/\r?\n/).length < 600,
      `${fileName} debe permanecer por debajo de 600 líneas`
    );
  });
  assert.deepEqual(Object.keys(wompiWebhookIntegrity).sort(), [
    'CANONICAL_ELECTRONIC_INVOICE_STATUSES',
    'INVENTORY_EXCEPTION_PREFIX',
    'applyApprovedPaymentFact',
    'createWompiWebhookIntegrityService',
    'findCanonicalElectronicInvoice',
    'getCanonicalPaymentApprovalEvidence',
    'isApprovedPayment',
    'isRetryableInventoryApprovalError',
    'markInventoryConfirmationException',
    'markInventoryConfirmed',
    'resolveMonotonicWompiTransition',
  ].sort());
  ok('la integridad Wompi conserva su fachada y módulos cohesionados');

  const permissions = [
    ['/api/payments/admin/wompi/test-merchant', 'settings:payments'],
    ['/api/payments/admin/delete-factus-invoice/507f1f77bcf86cd799439011', 'billing:retry'],
    ['/api/payments/admin/create-credit-note/507f1f77bcf86cd799439011', 'billing:credit_note'],
    ['/api/payments/admin/retry-electronic-invoice/507f1f77bcf86cd799439011', 'billing:retry'],
  ];
  permissions.forEach(([url, permission]) => {
    const rule = findAdminRoutePermission('POST', url);
    assert.equal(rule?.knownPermission, true, url);
    assert.equal(rule?.permission, permission, url);
  });
  const wompiMerchantTestRule = findAdminRoutePermission(
    'POST',
    '/api/payments/admin/wompi/test-merchant'
  );
  assert.equal(wompiMerchantTestRule?.audit, true);
  assert.equal(wompiMerchantTestRule?.sensitive, true);
  ok('Wompi y las tres operaciones fiscales conservan permisos granulares');

  console.log(`RESULTADO: ${checks.length}/${checks.length} controles aprobados.`);
}

main();
