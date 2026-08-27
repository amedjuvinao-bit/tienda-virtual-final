'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Order = require('../models/Order');

const ROOT = path.resolve(__dirname, '..', '..');

const FACADE_LIMITS = {
  'backend/models/Order.js': 100,
  'backend/routes/orders.js': 400,
  'backend/routes/payments.js': 250,
  'backend/routes/payuProductionWebhook.js': 100,
  'backend/routes/orderEmailRoutes.js': 180,
  'backend/routes/orderCustomerNotificationRoutes.js': 180,
  'backend/controllers/payu/payuWebhookController.js': 200,
  'backend/controllers/orderReturnController.js': 100,
  'backend/services/orderAdminQueryService.js': 100,
  'backend/services/storeCreditCheckoutService.js': 100,
  'backend/services/orderLogisticsService.js': 100,
  'backend/services/orderRefundService.js': 100,
  'backend/services/orderRefunds/refundInventoryService.js': 100,
  'backend/services/orderReturnService.js': 100,
  'backend/services/orderShippingIntegrationService.js': 100,
  'backend/services/orderStatusTransitionService.js': 100,
  'backend/services/orderFulfillmentService.js': 100,
  'backend/services/inventoryReservationService.js': 100,
  'backend/services/orderInventoryAllocationService.js': 60,
  'backend/services/orderOperationalMonitoringService.js': 100,
  'backend/services/orderRefundAutomationService.js': 100,
  'backend/services/orderCreationPostCommitService.js': 450,
  'backend/services/customerOrderLinkService.js': 100,
  'backend/services/orderPostCommitOutboxWorkerService.js': 300,
  'backend/services/wompiInvoiceSchedulingService.js': 250,
  'backend/services/paymentAttemptService.js': 100,
  'backend/services/manualPaymentConfirmationService.js': 100,
  'backend/services/paymentInventoryFailureService.js': 100,
  'backend/services/wompiWebhookIntegrityService.js': 100,
  'backend/services/wompiWebhookApprovedProcessor.js': 100,
  'backend/services/wompiWebhookOrderService.js': 100,
};

const ORDER_REFUND_INVENTORY_LIMITS = {
  'backend/services/orderRefunds/refundInventoryAllocationService.js': 300,
  'backend/services/orderRefunds/refundInventoryDemandService.js': 300,
  'backend/services/orderRefunds/refundInventoryRestorationService.js': 300,
};

const ADMIN_ORDER_OUTPUT_LIMITS = {
  'backend/services/orderBranchPresentationScopeService.js': 120,
  'backend/services/orderAdminQuery/listProjection.js': 180,
  'backend/services/orderAdminQuery/listPresentation.js': 250,
};

const ORDER_RETURN_CONTROLLER_LIMITS = {
  'backend/controllers/orderReturns/adminController.js': 250,
  'backend/controllers/orderReturns/customerController.js': 150,
  'backend/controllers/orderReturns/customerLabelController.js': 120,
  'backend/controllers/orderReturns/policyController.js': 60,
  'backend/controllers/orderReturns/shared.js': 150,
};

const STORE_CREDIT_CHECKOUT_LIMITS = {
  'backend/services/storeCreditCheckout/access.js': 150,
  'backend/services/storeCreditCheckout/constants.js': 50,
  'backend/services/storeCreditCheckout/expiration.js': 100,
  'backend/services/storeCreditCheckout/normalization.js': 100,
  'backend/services/storeCreditCheckout/preview.js': 120,
  'backend/services/storeCreditCheckout/reservation.js': 225,
  'backend/services/storeCreditCheckout/usageLifecycle.js': 175,
};

const WOMPI_WEBHOOK_MODULE_LIMITS = {
  'backend/services/wompiWebhookApproved/dependencies.js': 100,
  'backend/services/wompiWebhookApproved/factory.js': 150,
  'backend/services/wompiWebhookApproved/initialTransaction.js': 250,
  'backend/services/wompiWebhookApproved/inventoryFailure.js': 175,
  'backend/services/wompiWebhookApproved/inventoryRetry.js': 200,
  'backend/services/wompiWebhookApproved/postCommitResult.js': 100,
  'backend/services/wompiWebhookOrder/approved.js': 100,
  'backend/services/wompiWebhookOrder/dependencies.js': 175,
  'backend/services/wompiWebhookOrder/factory.js': 75,
  'backend/services/wompiWebhookOrder/nonApproved.js': 375,
  'backend/services/wompiWebhookOrder/orderTransaction.js': 100,
};

const FRONTEND_LIMITS = {
  'frontend/src/admin/OrdersAdmin.jsx': 500,
  'frontend/src/pages/CheckoutPage.jsx': 100,
  'frontend/src/pages/GraciasPage.jsx': 100,
  'frontend/src/pages/OrderReturnsPage.jsx': 450,
  'frontend/src/admin/orders/components/OrderDetailModal.jsx': 350,
  'frontend/src/admin/orders/components/OrdersFilters.jsx': 250,
  'frontend/src/admin/orders/components/orderDetail/OrderDetailActionToolbar.jsx': 180,
  'frontend/src/admin/orders/components/orderDetail/OrderDetailCustomerBilling.jsx': 250,
  'frontend/src/admin/orders/components/orderDetail/OrderDetailPaymentPanel.jsx': 250,
  'frontend/src/admin/orders/components/orderDetail/OrderManualPaymentConfirmationCard.jsx': 250,
  'frontend/src/admin/orders/components/orderDetail/hooks/useOrderManualPaymentConfirmation.js': 180,
  'frontend/src/admin/orders/components/orderDetail/manualPaymentConfirmationModel.js': 180,
  'frontend/src/admin/orders/components/orderDetail/OrderDetailLogisticsPanel.jsx': 300,
  'frontend/src/admin/orders/components/orderDetail/OrderLogisticsShipmentCard.jsx': 250,
  'frontend/src/admin/orders/components/orderDetail/OrderDetailReturnsPanel.jsx': 300,
  'frontend/src/admin/orders/components/orderDetail/OrderDetailSummaryRail.jsx': 220,
  'frontend/src/admin/orders/components/orderDetail/OrderDetailStoryOverview.jsx': 400,
  'frontend/src/admin/orders/components/orderDetail/orderStoryViewModel.js': 120,
  'frontend/src/admin/orders/electronicInvoice/InvoiceSummaryTab.jsx': 250,
  'frontend/src/admin/orders/electronicInvoice/InvoiceCustomerBillingSection.jsx': 250,
  'frontend/src/admin/orders/electronicInvoice/InvoiceSummaryPresentation.jsx': 250,
  'frontend/src/admin/orders/electronicInvoice/useInvoiceCustomerBilling.js': 150,
};

const MODULAR_ROOTS = [
  'backend/services/indexMigrations',
  'backend/services/storeCreditCheckout',
  'backend/services/wompiWebhookApproved',
  'backend/services/wompiWebhookOrder',
  'backend/services/orderAdminQuery',
  'backend/services/orderFulfillment',
  'backend/services/orderLogistics',
  'backend/services/orderRefunds',
  'backend/services/orderReturns',
  'backend/services/orderShipping',
  'backend/services/orderStatus',
  'backend/services/inventoryReservation',
  'backend/services/orderInventoryAllocation',
  'backend/services/orderOperationalMonitoring',
  'backend/services/orderRefundAutomation',
  'backend/services/manualPaymentConfirmation',
  'backend/services/paymentAttempts',
  'backend/services/paymentInventoryFailure',
  'backend/services/payu',
  'backend/services/customerOrderLink',
];

const ORDER_DOMAIN_ROOTS = [
  ...MODULAR_ROOTS,
  'backend/models/order',
  'backend/controllers/orderReturns',
  'backend/controllers/payu',
  'backend/lib/orders',
  'backend/lib/payments',
];

const ORDER_MODEL_MODULE_LINE_LIMIT = 450;
const MODULE_LINE_LIMIT = 500;
const CONTROLLER_LINE_LIMIT = 500;

function absolute(relativePath) {
  return path.join(ROOT, relativePath);
}

function read(relativePath) {
  return fs.readFileSync(absolute(relativePath), 'utf8');
}

function lineCount(source) {
  return source.split(/\r?\n/).length;
}

function walk(relativeRoot, extensions = new Set(['.js'])) {
  const output = [];
  const rootPath = absolute(relativeRoot);

  for (const entry of fs.readdirSync(rootPath, { withFileTypes: true })) {
    const relativePath = path.posix.join(relativeRoot, entry.name);
    if (entry.isDirectory()) {
      output.push(...walk(relativePath, extensions));
    } else if (extensions.has(path.extname(entry.name))) {
      output.push(relativePath);
    }
  }

  return output;
}

function assertLineLimits(entries) {
  for (const [relativePath, maximum] of Object.entries(entries)) {
    const total = lineCount(read(relativePath));
    assert.ok(
      total <= maximum,
      `${relativePath} tiene ${total} líneas; el límite arquitectónico es ${maximum}`
    );
  }
}

function resolveLocalRequire(fromRelativePath, request) {
  if (!request.startsWith('.')) return null;

  const base = path.resolve(path.dirname(absolute(fromRelativePath)), request);
  const candidates = [base, `${base}.js`, path.join(base, 'index.js')];
  const resolved = candidates.find(
    (candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile()
  );
  if (!resolved || !resolved.startsWith(ROOT)) return null;

  return path.relative(ROOT, resolved).split(path.sep).join('/');
}

function localDependencies(relativePath) {
  const dependencies = [];
  const requirePattern = /require\(\s*['"]([^'"]+)['"]\s*\)/g;
  const source = read(relativePath)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  let match;

  while ((match = requirePattern.exec(source))) {
    const dependency = resolveLocalRequire(relativePath, match[1]);
    if (dependency) dependencies.push(dependency);
  }

  return dependencies;
}

function assertNoCycles(entryPoints, allowedFiles) {
  const visiting = new Set();
  const visited = new Set();

  function visit(relativePath, chain) {
    if (visiting.has(relativePath)) {
      const start = chain.indexOf(relativePath);
      const cycle = [...chain.slice(start), relativePath].join(' -> ');
      assert.fail(`Dependencia circular detectada: ${cycle}`);
    }
    if (visited.has(relativePath)) return;

    visiting.add(relativePath);
    const nextChain = [...chain, relativePath];
    for (const dependency of localDependencies(relativePath)) {
      if (allowedFiles.has(dependency)) visit(dependency, nextChain);
    }
    visiting.delete(relativePath);
    visited.add(relativePath);
  }

  entryPoints.forEach((entryPoint) => visit(entryPoint, []));
}

function assertCanonicalModel(modelName, expectedPath) {
  const productionFiles = [
    ...walk('backend/controllers'),
    ...walk('backend/models'),
    ...walk('backend/routes'),
    ...walk('backend/services'),
  ];
  const modelPattern = new RegExp(`mongoose\\.model\\(\\s*['"]${modelName}['"]`);
  const definitions = productionFiles.filter((file) => modelPattern.test(read(file)));

  assert.deepStrictEqual(
    definitions,
    [expectedPath],
    `${modelName} debe tener una sola definición canónica`
  );
}

function assertNoRedundantOrderIndexPrefixes() {
  const indexes = Order.schema.indexes();
  assert.ok(
    indexes.length <= 45,
    `Order declara ${indexes.length} índices; el límite preventivo es 45`
  );

  for (const [candidateKeys, candidateOptions] of indexes) {
    const candidateEntries = Object.entries(candidateKeys);
    if (
      candidateEntries.length !== 1 ||
      candidateOptions.unique ||
      candidateOptions.sparse ||
      candidateOptions.partialFilterExpression
    ) {
      continue;
    }

    const redundant = indexes.some(([compoundKeys, compoundOptions]) => {
      const compoundEntries = Object.entries(compoundKeys);
      if (
        compoundEntries.length <= candidateEntries.length ||
        compoundOptions.sparse ||
        compoundOptions.partialFilterExpression
      ) {
        return false;
      }
      return candidateEntries.every(
        ([field, direction], index) =>
          compoundEntries[index]?.[0] === field &&
          compoundEntries[index]?.[1] === direction
      );
    });

    assert.strictEqual(
      redundant,
      false,
      `Índice simple redundante: ${JSON.stringify(candidateKeys)}`
    );
  }
}

function main() {
  assertLineLimits(FACADE_LIMITS);
  assertLineLimits(ORDER_REFUND_INVENTORY_LIMITS);
  assertLineLimits(ADMIN_ORDER_OUTPUT_LIMITS);
  assertLineLimits(ORDER_RETURN_CONTROLLER_LIMITS);
  assertLineLimits(STORE_CREDIT_CHECKOUT_LIMITS);
  assertLineLimits(WOMPI_WEBHOOK_MODULE_LIMITS);
  console.log(
    'OK  Rutas, fachadas, devoluciones, saldo a favor y reposición por reembolso mantienen tamaños acotados'
  );

  assertLineLimits(FRONTEND_LIMITS);
  console.log('OK  Los contenedores React críticos permanecen dentro de límites explícitos');

  const orderModelFiles = walk('backend/models/order');
  orderModelFiles.forEach((file) => {
    const total = lineCount(read(file));
    assert.ok(
      total <= ORDER_MODEL_MODULE_LINE_LIMIT,
      `${file} tiene ${total} líneas; divídelo antes de superar ${ORDER_MODEL_MODULE_LINE_LIMIT}`
    );
  });
  console.log('OK  Los internos del modelo Order permanecen por debajo de 450 líneas');

  const implementationFiles = Array.from(
    new Set(ORDER_DOMAIN_ROOTS.flatMap((root) => walk(root)))
  );
  assert.ok(
    implementationFiles.length >= 150,
    `El ratchet cubre solo ${implementationFiles.length} módulos; se esperaba al menos 150`
  );
  implementationFiles.forEach((file) => {
    const total = lineCount(read(file));
    assert.ok(
      total <= MODULE_LINE_LIMIT,
      `${file} tiene ${total} líneas; divídelo antes de superar ${MODULE_LINE_LIMIT}`
    );
  });
  console.log(
    `OK  ${implementationFiles.length} módulos internos del dominio mantienen cohesión y tamaño acotado`
  );

  const adminOrderFrontendFiles = walk(
    'frontend/src/admin/orders',
    new Set(['.js', '.jsx'])
  ).filter((file) => !/\.test\.(?:js|jsx)$/.test(file));
  assert.ok(
    adminOrderFrontendFiles.length >= 117,
    `El ratchet cubre solo ${adminOrderFrontendFiles.length} módulos administrativos; se esperaban al menos 117`
  );
  adminOrderFrontendFiles.forEach((file) => {
    const total = lineCount(read(file));
    assert.ok(
      total <= 500,
      `${file} tiene ${total} líneas; divídelo antes de superar 500`
    );
  });
  console.log(
    `OK  ${adminOrderFrontendFiles.length} módulos administrativos React permanecen bajo 500 líneas`
  );

  const checkoutFiles = walk(
    'frontend/src/checkout/page',
    new Set(['.js', '.jsx'])
  ).filter((file) => !/\.test\.(?:js|jsx)$/.test(file));
  checkoutFiles.forEach((file) => {
    const total = lineCount(read(file));
    assert.ok(
      total <= 450,
      `${file} tiene ${total} líneas; divídelo antes de superar 450`
    );
  });
  console.log('OK  Checkout conserva un orquestador mínimo y módulos acotados');

  const thanksFiles = walk(
    'frontend/src/pages/gracias',
    new Set(['.js', '.jsx'])
  ).filter((file) => !/\.test\.(?:js|jsx)$/.test(file));
  thanksFiles.forEach((file) => {
    const total = lineCount(read(file));
    assert.ok(
      total <= 350,
      `${file} tiene ${total} líneas; divídelo antes de superar 350`
    );
  });
  console.log('OK  Gracias separa verificación, presentación y estilos en módulos acotados');

  const orderControllers = walk('backend/controllers').filter((file) =>
    /\/(order|payment|wompi)/i.test(file)
  );
  orderControllers.forEach((file) => {
    const total = lineCount(read(file));
    assert.ok(
      total <= CONTROLLER_LINE_LIMIT,
      `${file} tiene ${total} líneas; el controlador debe delegar lógica de dominio`
    );
  });
  console.log('OK  Los controladores de Órdenes y pagos delegan la lógica extensa');

  const ordersRoute = read('backend/routes/orders.js');
  assert.ok(!ordersRoute.includes("require('../models/Order')"));
  assert.ok(!ordersRoute.includes('mongoose.startSession'));
  assert.ok(!/router\.(get|post|patch|put|delete)\([^\n]*async\s*\(/.test(ordersRoute));
  assert.ok(
    ordersRoute.includes("router.post('/', rateLimit, requireAuthorizedOrderCart, createOrder)")
  );
  console.log('OK  La ruta principal solo compone middleware y controladores');

  const backendEntry = read('backend/index.js');
  assert.ok(backendEntry.includes('require.resolve(relPath)'));
  [
    './routes/orders',
    './routes/payments',
    './routes/payuProductionWebhook',
    './services/inventoryReservationService',
    './services/storeCreditCheckoutService',
    './services/orderPostCommitOutboxWorkerService',
  ].forEach((criticalPath) => {
    assert.ok(
      backendEntry.includes(`requireCritical('${criticalPath}')`),
      `${criticalPath} debe fallar rápido durante el arranque`
    );
  });
  console.log('OK  El backend falla rápido si Órdenes o pagos no pueden cargarse');

  assertCanonicalModel('OrderEvent', 'backend/models/OrderEvent.js');
  assertCanonicalModel('OrderNote', 'backend/models/OrderNote.js');
  assertCanonicalModel('PaymentAttempt', 'backend/models/PaymentAttempt.js');
  assertCanonicalModel(
    'ManualPaymentConfirmation',
    'backend/models/ManualPaymentConfirmation.js'
  );
  console.log('OK  Eventos, notas e intentos/evidencias de pago tienen definición canónica');

  assertNoRedundantOrderIndexPrefixes();
  console.log('OK  Order conserva margen de índices y no duplica prefijos compuestos');

  const architectureGraphFiles = new Set([
    ...Object.keys(FACADE_LIMITS),
    ...implementationFiles,
    ...orderControllers,
    'backend/models/OrderEvent.js',
    'backend/models/OrderNote.js',
    'backend/models/PaymentAttempt.js',
    'backend/models/ManualPaymentConfirmation.js',
  ]);
  assertNoCycles([
    'backend/models/Order.js',
    'backend/routes/orders.js',
    'backend/routes/payments.js',
    'backend/routes/payuProductionWebhook.js',
  ], architectureGraphFiles);
  console.log('OK  El grafo CommonJS del módulo no contiene dependencias circulares');

  assert.ok(fs.existsSync(absolute('docs/modulos/ordenes-arquitectura.md')));
  console.log('OK  Las fronteras e invariantes están documentados');

  console.log('\nArquitectura modular de Órdenes: 12 controles superados.');
}

try {
  main();
} catch (error) {
  console.error('\nFALLO arquitectura modular de Órdenes:', error.message);
  process.exitCode = 1;
}
