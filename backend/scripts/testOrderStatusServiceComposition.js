/* eslint-disable no-console */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const service = require('../services/orderStatusTransitionService');

const ROOT = path.resolve(__dirname, '..', '..');
const MODULE_PATHS = [
  'backend/services/orderStatus/stateMachine.js',
  'backend/services/orderStatus/operationalValidation.js',
  'backend/services/orderStatus/operationalEffects.js',
  'backend/services/orderStatus/singleTransition.js',
  'backend/services/orderStatus/bulkTransition.js',
];
const EXPECTED_EXPORTS = [
  'MAX_BULK_ORDERS',
  'normalizeOrderStatus',
  'getAllowedOrderStatuses',
  'validateOrderStatusTransition',
  'needsOperationalReconciliation',
  'transitionOrderStatus',
  'processBulkOrderStatusTransitions',
  'createTransitionError',
];

let passed = 0;

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function ok(label) {
  passed += 1;
  console.log(`OK  ${label}`);
}

async function main() {
  const facade = read(
    'backend/services/orderStatusTransitionService.js'
  );
  const modules = Object.fromEntries(
    MODULE_PATHS.map((modulePath) => [modulePath, read(modulePath)])
  );

  assert.deepStrictEqual(Object.keys(service), EXPECTED_EXPORTS);
  assert.strictEqual(service.MAX_BULK_ORDERS, 100);
  EXPECTED_EXPORTS.slice(1).forEach((name) => {
    assert.strictEqual(typeof service[name], 'function', `${name} no es función`);
  });
  ok('la fachada conserva exactamente el contrato público anterior');

  [
    './orderStatus/stateMachine',
    './orderStatus/operationalValidation',
    './orderStatus/singleTransition',
    './orderStatus/bulkTransition',
  ].forEach((dependency) => {
    assert.ok(facade.includes(`require('${dependency}')`), dependency);
  });
  assert.ok(!facade.includes("require('mongoose')"));
  assert.ok(!facade.includes("require('../models/Order')"));
  ok('la fachada solo compone módulos internos y no ejecuta negocio');

  Object.entries(modules).forEach(([modulePath, source]) => {
    const lineCount = source.split(/\r?\n/).length;
    assert.ok(
      lineCount < 600,
      `${modulePath} excede el límite modular: ${lineCount}`
    );
  });
  assert.ok(facade.split(/\r?\n/).length < 100);
  ok('ningún módulo de estados supera 600 líneas');

  const validationSource =
    modules['backend/services/orderStatus/operationalValidation.js'];
  assert.ok(validationSource.includes('ORDER_REFUND_REQUIRED'));
  assert.ok(validationSource.includes('ORDER_LOGISTICS_DISPATCH_REQUIRED'));
  assert.ok(validationSource.includes('ORDER_LOGISTICS_DELIVERY_REQUIRED'));
  assert.ok(validationSource.includes('ORDER_FULFILLMENT_INCOMPLETE'));
  ok('las reglas operativas quedaron aisladas y conservan sus bloqueos');

  const effectsSource =
    modules['backend/services/orderStatus/operationalEffects.js'];
  const singleSource =
    modules['backend/services/orderStatus/singleTransition.js'];
  assert.ok(effectsSource.includes('applyReservationToOrderDocument'));
  assert.ok(effectsSource.includes('advanceOrderInventoryAllocations'));
  assert.ok(singleSource.includes('confirmInventoryReservation'));
  assert.ok(singleSource.includes('releaseInventoryReservation'));
  assert.ok(singleSource.includes('processOrderFulfillmentAfterPayment'));
  assert.ok(singleSource.includes('session.withTransaction'));
  assert.ok(singleSource.includes('ordered: true'));
  ok('inventario, fulfillment y atomicidad mantienen sus autoridades');

  assert.deepStrictEqual(service.getAllowedOrderStatuses(), [
    'pending',
    'processing',
    'paid',
    'failed',
    'shipped',
    'delivered',
    'cancelled',
    'refunded',
  ]);
  assert.strictEqual(service.normalizeOrderStatus('entregada'), 'delivered');
  assert.strictEqual(service.normalizeOrderStatus('canceled'), 'cancelled');
  assert.strictEqual(service.normalizeOrderStatus('desconocido'), '');
  ok('alias, estados permitidos y normalización permanecen estables');

  assert.throws(
    () =>
      service.validateOrderStatusTransition(
        { status: 'pending', payment: { status: 'pending_manual' } },
        'paid'
      ),
    (error) =>
      error?.code === 'ORDER_PAYMENT_CONFIRMATION_REQUIRED' &&
      error?.statusCode === 409
  );
  assert.doesNotThrow(() =>
    service.validateOrderStatusTransition(
      { status: 'pending', payment: { status: 'paid' } },
      'paid'
    )
  );
  assert.throws(
    () =>
      service.validateOrderStatusTransition(
        { status: 'paid', payment: { status: 'paid' } },
        'cancelled'
      ),
    (error) =>
      error?.code === 'ORDER_REFUND_REQUIRED' &&
      error?.statusCode === 409
  );
  assert.throws(
    () =>
      service.validateOrderStatusTransition(
        {
          status: 'paid',
          payment: { status: 'paid' },
          items: [{ productType: 'digital' }],
        },
        'shipped'
      ),
    (error) => error?.code === 'ORDER_SHIPMENT_NOT_REQUIRED'
  );
  ok('pago, devolución y envío conservan fronteras financieras explícitas');

  assert.strictEqual(
    service.needsOperationalReconciliation(
      {
        status: 'paid',
        payment: { status: 'pending_manual' },
        inventoryControl: {
          reservationRequired: true,
          discountedAtCheckout: false,
        },
        items: [],
      },
      'paid'
    ),
    true
  );
  assert.strictEqual(
    service.needsOperationalReconciliation(
      {
        status: 'paid',
        payment: { status: 'paid' },
        inventoryControl: { reservationRequired: false },
        items: [],
      },
      'paid'
    ),
    false
  );
  ok('la conciliación operativa conserva su comportamiento');

  await assert.rejects(
    service.processBulkOrderStatusTransitions({
      orderIds: [],
      status: 'paid',
    }),
    (error) => error?.code === 'IDS_REQUIRED' && error?.statusCode === 400
  );
  await assert.rejects(
    service.processBulkOrderStatusTransitions({
      orderIds: ['identificador-invalido'],
      status: 'paid',
    }),
    (error) =>
      error?.code === 'INVALID_ORDER_IDS' && error?.statusCode === 400
  );
  ok('la entrada masiva mantiene límites y validación antes de persistir');

  console.log(
    `\nComposición del servicio de estados: ${passed}/${passed} verificaciones aprobadas.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
