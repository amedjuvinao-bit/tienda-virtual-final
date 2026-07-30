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

function ok(label) {
  passed += 1;
  console.log(`OK  ${label}`);
}

function includesAll(source, values, label) {
  const missing = values.filter((value) => !source.includes(value));
  assert.strictEqual(
    missing.length,
    0,
    `${label} no contiene: ${missing.join(', ')}`
  );
}

function run() {
  const packageJson = JSON.parse(read('backend/package.json'));
  const workflow = read('.github/workflows/products-ci.yml');
  const integration = read(
    'backend/scripts/testCompleteSaleIntegration.js'
  );
  const closure = read(
    'backend/scripts/testProductsFinalClosure.js'
  );

  assert(
    packageJson.scripts['test:complete-sale-contract']
  );
  assert(
    packageJson.scripts['test:complete-sale-integration']
  );
  ok('La prueba integral está registrada en backend');

  includesAll(
    integration,
    [
      "app.use('/api/orders', orderRoutes)",
      "app.use('/api/payments', paymentRoutes)",
      "saveProductWithInventoryTransaction",
      "createInventoryMovement",
    ],
    'Entrada real de la venta'
  );
  ok('El escenario usa catálogo, inventario y las rutas HTTP reales');

  includesAll(
    integration,
    [
      "'Idempotency-Key'",
      'WOMPI_AMOUNT_MISMATCH',
      '/api/payments/wompi/webhook',
      'buildWompiEventChecksum',
    ],
    'Protecciones de checkout y pago'
  );
  ok('La venta valida idempotencia, firma y valor de Wompi');

  includesAll(
    integration,
    [
      "status: 'shipped'",
      "status: 'delivered'",
      'processOrderRefund',
      'return_in',
    ],
    'Cierre operativo'
  );
  ok('Despacho, entrega y devolución forman parte del recorrido');

  includesAll(
    integration,
    [
      'inventoryAllocationSummary',
      'InventoryReservation',
      'sale_out',
      'returnedQuantity',
    ],
    'Trazabilidad'
  );
  ok('La prueba comprueba reserva, asignaciones y kardex');

  includesAll(
    workflow,
    [
      'Validar contrato de venta integral',
      'test:complete-sale-contract',
      'Validar venta integral completa',
      'test:complete-sale-integration',
    ],
    'Productos CI'
  );
  ok('Productos CI ejecuta el contrato y la integración');

  includesAll(
    workflow,
    [
      'PRODUCTS_TEST_MONGO_URI: mongodb://127.0.0.1:27017/productos_ci?replicaSet=rs0',
      'DIGITAL_DELIVERY_TOKEN_SECRET: products-ci-digital-delivery-secret',
      'PUBLIC_BACKEND_URL: https://backend.example',
    ],
    'Entorno de integración'
  );
  ok('El recorrido usa MongoDB transaccional y valores ficticios');

  includesAll(
    closure,
    [
      "'test:complete-sale-contract'",
      "'test:complete-sale-integration'",
    ],
    'Cierre de Productos'
  );
  ok('El cierre final exige conservar la prueba integral');

  console.log(
    `\nContrato de venta integral: ${passed}/8 verificaciones aprobadas.`
  );
}

try {
  run();
} catch (error) {
  console.error(
    '\nFALLO contrato de venta integral:',
    error.message
  );
  process.exitCode = 1;
}
