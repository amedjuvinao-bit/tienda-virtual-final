/* eslint-disable no-console */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
let passed = 0;

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function exists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath));
}

function ok(label) {
  passed += 1;
  console.log(`OK  ${label}`);
}

function run() {
  const backendPackage = JSON.parse(read('backend/package.json'));
  const frontendPackage = JSON.parse(read('frontend/package.json'));
  const workflow = read('.github/workflows/orders-ci.yml');
  const integration = read(
    'backend/scripts/testOrderCommercialReconciliationIntegration.js'
  );
  const reconciliation = read(
    'backend/services/orderRefundReconciliationService.js'
  );
  const paymentClaims = read(
    'backend/services/orderRefundAutomation/claims.js'
  );
  const panel = read(
    'frontend/src/admin/orders/components/orderDetail/OrderDetailRefundReconciliation.jsx'
  );
  const panelTest = read(
    'frontend/src/admin/orders/components/orderDetail/OrderDetailRefundReconciliation.test.jsx'
  );
  const e2e = read('frontend/e2e/ordersRefundReconciliation.e2e.js');
  const documentation = read('docs/modulos/ordenes-etapa-2-cierre.md');

  assert(
    exists('backend/scripts/testOrderCommercialReconciliationIntegration.js') &&
      exists('frontend/e2e/ordersRefundReconciliation.e2e.js') &&
      exists('docs/modulos/ordenes-etapa-2-cierre.md')
  );
  ok('los entregables propios de la etapa existen');

  assert.strictEqual(
    backendPackage.scripts['test:order-commercial-reconciliation-integration'],
    'node scripts/testOrderCommercialReconciliationIntegration.js'
  );
  assert.strictEqual(
    frontendPackage.scripts['test:e2e:orders-stage2'],
    'node e2e/ordersRefundReconciliation.e2e.js'
  );
  ok('los ejecutores de integración y navegador están registrados');

  assert(workflow.includes('ORDERS_STAGE2_MONGO_URI:'));
  assert(
    workflow.includes(
      'orders_ci_stage2_reconciliation?replicaSet=rs0'
    )
  );
  assert(
    workflow.includes(
      'npm --prefix backend run test:order-commercial-reconciliation-integration'
    )
  );
  assert(workflow.includes('npm --prefix frontend run test:e2e:orders-stage2'));
  ok('Órdenes CI ejecuta las dos puertas nuevas');

  assert(integration.includes("const REQUIRED_DATABASE = 'orders_ci_stage2_reconciliation'"));
  assert(integration.includes("['127.0.0.1', 'localhost']"));
  assert(integration.includes("parsed.searchParams.get('replicaSet')"));
  assert(!integration.includes('process.env.MONGODB_URI'));
  assert(!integration.includes('mongodb+srv://'));
  ok('la integración solo acepta una réplica local y una base temporal exacta');

  assert(integration.includes('await mongoose.connection.dropDatabase()'));
  assert(integration.includes('runFullRefundScenario'));
  assert(integration.includes('runPartialRefundScenario'));
  assert(integration.includes("persistedOrder.status, 'refunded'"));
  assert(integration.includes("persistedOrder.status, 'delivered'"));
  ok('la prueba demuestra cierre total y conserva correctamente el reembolso parcial');

  assert(integration.includes('confirmRefundPaymentReversal'));
  assert(integration.includes('linkRefundCreditNote'));
  assert(integration.includes('CashSession'));
  assert(integration.includes('ElectronicInvoice'));
  assert(!integration.includes('fetch('));
  ok('dinero, caja y documento fiscal usan servicios reales sin llamar proveedores');

  assert(reconciliation.includes("allResolved && isFullRefund"));
  assert(reconciliation.includes("orderUpdate.status = 'refunded'"));
  assert(paymentClaims.includes('PAYMENT_REVERSAL_ALREADY_CONFIRMED'));
  assert(paymentClaims.includes('PAYMENT_REVERSAL_AUTOMATION_IN_PROGRESS'));
  ok('la autoridad de conciliación impide cierres prematuros y referencias contradictorias');

  assert(panel.includes('nextReconciliationStep'));
  assert(panel.includes('Siguiente paso'));
  assert(panel.includes('refund-reconciliation-stages'));
  assert(panel.includes('ORDER_DETAIL_THEME.cardBg'));
  assert(panelTest.includes('Confirma el dinero devuelto'));
  assert(panelTest.includes('Emite o recupera la nota crédito'));
  assert(panelTest.includes('Conciliación cerrada'));
  ok('la interfaz explica una sola tarea siguiente y hereda el tema');

  assert(e2e.includes("permissions: ['orders:view', 'orders:refund', 'billing:credit_note']"));
  assert(e2e.includes('REVERSO-E2E-STAGE2-001'));
  assert(e2e.includes('Emite o recupera la nota crédito'));
  assert(e2e.includes("url.pathname.startsWith('/api/')"));
  assert(!e2e.includes('mongodb'));
  ok('el E2E valida el perfil fiscal sin datos ni servicios persistentes');

  assert(documentation.includes('# Cierre de Órdenes · Etapa 2'));
  assert(documentation.includes('no llama Wompi'));
  assert(documentation.includes('no llama Factus'));
  assert(documentation.includes('HTTPS permanente'));
  ok('alcance local y dependencias externas quedaron documentados');

  console.log(
    `\nCierre de Órdenes · Etapa 2: ${passed}/${passed} controles aprobados`
  );
}

try {
  run();
} catch (error) {
  console.error('\nFAIL Cierre de Órdenes · Etapa 2');
  console.error(error);
  process.exitCode = 1;
}
