'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const facade = require('../services/orderShippingIntegrationService');
const payloadService = require('../services/shippingPayloadService');
const addressResolution = require('../services/orderShipping/addressResolution');
const labelOperations = require('../services/orderShipping/labelOperations');
const pickupOperations = require('../services/orderShipping/pickupOperations');
const pickupPayloads = require('../services/orderShipping/pickupPayloads');
const rateOperations = require('../services/orderShipping/rateOperations');
const providerAdapter = require('../services/orderShipping/providerAdapter');
const trackingOperations = require('../services/orderShipping/trackingOperations');
const {
  operationRequestHash,
  reserveOperation,
  stableHash,
} = require('../services/orderShipping/idempotencyState');

const expectedExports = [
  'buildEnviaShipmentPayload',
  'normalizeRate',
  'normalizeGeneratedLabel',
  'resolveColombiaAddresses',
  'resolveShippingAddresses',
  'pickupOnGeneratePayload',
  'buildStandalonePickupPayload',
  'quoteOrderShipment',
  'generateOrderShipmentLabel',
  'syncOrderShipmentTracking',
  'testOrderShipmentWebhook',
  'scheduleOrderShipmentPickup',
  'confirmOrderShipmentDropoff',
  'cancelOrderShipmentLabel',
];

const checks = [];
function ok(message) {
  checks.push(message);
  console.log(`OK  ${message}`);
}

assert.deepStrictEqual(Object.keys(facade), expectedExports);
ok('la fachada conserva el contrato público y el orden histórico de exportaciones');

assert.strictEqual(facade.buildEnviaShipmentPayload, payloadService.buildEnviaShipmentPayload);
assert.strictEqual(facade.normalizeRate, payloadService.normalizeRate);
assert.strictEqual(facade.normalizeGeneratedLabel, payloadService.normalizeGeneratedLabel);
ok('payloads y normalizadores siguen usando la autoridad canónica existente');

assert.strictEqual(facade.resolveShippingAddresses, addressResolution.resolveShippingAddresses);
assert.strictEqual(facade.resolveColombiaAddresses, facade.resolveShippingAddresses);
ok('la resolución internacional y el alias colombiano conservan la misma función');

assert.strictEqual(facade.quoteOrderShipment, rateOperations.quoteOrderShipment);
assert.strictEqual(facade.generateOrderShipmentLabel, labelOperations.generateOrderShipmentLabel);
assert.strictEqual(facade.cancelOrderShipmentLabel, labelOperations.cancelOrderShipmentLabel);
ok('cotización y ciclo de guías delegan en operaciones especializadas');

assert.strictEqual(facade.scheduleOrderShipmentPickup, pickupOperations.scheduleOrderShipmentPickup);
assert.strictEqual(facade.confirmOrderShipmentDropoff, pickupOperations.confirmOrderShipmentDropoff);
assert.strictEqual(facade.syncOrderShipmentTracking, trackingOperations.syncOrderShipmentTracking);
assert.strictEqual(facade.testOrderShipmentWebhook, trackingOperations.testOrderShipmentWebhook);
ok('recolección, entrega, tracking y webhook conservan referencias estables');

assert.strictEqual(trackingOperations.sandboxWebhookTestStatus(), 'Shipped');
assert.strictEqual(trackingOperations.sandboxWebhookTestStatus('Delivered'), 'Delivered');
assert.throws(
  () => trackingOperations.sandboxWebhookTestStatus('Canceled'),
  (error) => error.code === 'SHIPPING_WEBHOOK_TEST_STATUS_INVALID'
);
ok('las pruebas de una orden solo permiten los eventos Sandbox de envío y entrega');

async function validateProductionWebhookTestBlock() {
  await assert.rejects(
    () => trackingOperations.testOrderShipmentWebhook(
      { webhookStatus: 'Delivered' },
      { provider: { configured: true, mode: 'production' } }
    ),
    (error) => error.code === 'SHIPPING_WEBHOOK_TEST_SANDBOX_ONLY'
  );
  ok('el backend bloquea la simulación de entrega cuando Envia está en producción');
}

assert.strictEqual(facade.pickupOnGeneratePayload, pickupPayloads.pickupOnGeneratePayload);
assert.strictEqual(facade.buildStandalonePickupPayload, pickupPayloads.buildStandalonePickupPayload);
ok('los payloads de recolección permanecen disponibles desde la fachada');

async function validateOptionalCarrierCapabilities() {
  let calls = 0;
  const unresolved = await providerAdapter.resolveCarrierActions(
    {
      async getCarrierActions() {
        calls += 1;
        throw Object.assign(new Error('Not Found'), {
          code: 'SHIPPING_PROVIDER_HTTP_ERROR',
          details: { providerStatus: 404 },
        });
      },
    },
    'fedex',
    { optional: true }
  );
  assert.deepStrictEqual(unresolved, []);
  assert.strictEqual(calls, 1);

  const knownUnavailable = await providerAdapter.resolveCarrierActions(
    {
      async getCarrierActions() {
        calls += 1;
        throw new Error('No debe repetirse la consulta');
      },
    },
    'fedex',
    { carrierActions: [], carrierActionsResolved: false, optional: true }
  );
  assert.deepStrictEqual(knownUnavailable, []);
  assert.strictEqual(calls, 1);

  const persisted = providerAdapter.persistedCarrierCapability({
    carrierActions: ['pickup', 'PICKUP'],
    selectedRate: { carrierId: 77 },
  }, { countryCode: 'co' });
  assert.deepStrictEqual(persisted, {
    carrierActions: ['pickup'],
    carrierActionsResolved: true,
    carrierId: '77',
    countryCode: 'CO',
  });
  const reused = await providerAdapter.resolveCarrierActions(
    {
      async getCarrierActions() {
        calls += 1;
        throw new Error('La guía no debe perder la capacidad ya confirmada');
      },
    },
    'interrapidisimo',
    persisted
  );
  assert.deepStrictEqual(reused, ['pickup']);
  assert.strictEqual(calls, 1);
  ok('un fallo de capacidades opcionales no bloquea la creación de la guía');
  ok('la recolección reutiliza la capacidad confirmada al generar la guía');
}

assert.strictEqual(
  stableHash({ carrier: 'envia', values: { b: 2, a: 1 } }),
  stableHash({ values: { a: 1, b: 2 }, carrier: 'envia' })
);
assert.notStrictEqual(
  stableHash({ carrier: 'envia', amount: 1 }),
  stableHash({ carrier: 'envia', amount: 2 })
);
ok('la huella idempotente es estable por contenido y distingue solicitudes diferentes');

function createOperationModel() {
  const rows = new Map();
  let sequence = 0;

  function document(data) {
    return {
      _id: data._id || `shipping-operation-${++sequence}`,
      attempts: 1,
      error: {},
      result: null,
      ...data,
      async save() {
        rows.set(this.idempotencyKey, this);
        return this;
      },
    };
  }

  return {
    rows,
    async findOne(filter) {
      return rows.get(filter.idempotencyKey) || null;
    },
    async create(data) {
      if (rows.has(data.idempotencyKey)) {
        throw Object.assign(new Error('duplicate'), { code: 11000 });
      }
      const created = document(data);
      rows.set(data.idempotencyKey, created);
      return created;
    },
    insert(data) {
      const created = document(data);
      rows.set(data.idempotencyKey, created);
      return created;
    },
  };
}

function operationInput(overrides = {}) {
  return {
    order: { _id: 'order-a' },
    shipment: { _id: 'shipment-a' },
    provider: { key: 'envia', mode: 'sandbox' },
    type: 'generate_label',
    idempotencyKey: 'shipping-key-0001',
    requestPayload: { carrier: 'coordinadora', packages: [{ weight: 1 }] },
    ...overrides,
  };
}

function expectLogisticsCode(promise, expectedCode) {
  return assert.rejects(promise, (error) => error?.code === expectedCode);
}

async function validateScopedShippingFingerprint() {
  const base = operationInput();
  const baseHash = operationRequestHash(base);
  const variants = [
    ['orderId', { order: { _id: 'order-b' } }],
    ['shipmentId', { shipment: { _id: 'shipment-b' } }],
    ['provider', { provider: { key: 'otro', mode: 'sandbox' } }],
    ['provider mode', { provider: { key: 'envia', mode: 'production' } }],
    ['operation type', { type: 'cancel_label' }],
    ['payload', { requestPayload: { carrier: 'coordinadora', packages: [{ weight: 2 }] } }],
  ];
  for (const [field, override] of variants) {
    assert.notStrictEqual(
      operationRequestHash(operationInput(override)),
      baseHash,
      `${field} no quedó ligado a la huella`
    );
  }
  ok('la huella liga orden, envío, proveedor, modo, operación y payload');
}

async function validateShippingReplayAndConflicts() {
  const OperationModel = createOperationModel();
  const input = operationInput();
  const first = await reserveOperation(input, { OperationModel });
  assert.strictEqual(first.replay, false);
  first.operation.status = 'succeeded';
  first.operation.result = { trackingNumber: 'TRACK-1' };
  await first.operation.save();

  const replay = await reserveOperation(input, { OperationModel });
  assert.strictEqual(replay.replay, true);
  assert.deepStrictEqual(replay.operation.result, { trackingNumber: 'TRACK-1' });

  for (const conflicting of [
    operationInput({ order: { _id: 'order-b' } }),
    operationInput({ shipment: { _id: 'shipment-b' } }),
    operationInput({ provider: { key: 'otro', mode: 'sandbox' } }),
    operationInput({ type: 'cancel_label' }),
  ]) {
    await expectLogisticsCode(
      reserveOperation(conflicting, { OperationModel }),
      'SHIPPING_IDEMPOTENCY_CONFLICT'
    );
  }
  ok('una clave solo reproduce la misma operación dentro del mismo alcance');
}

async function validateLegacyScopedCompatibility() {
  const OperationModel = createOperationModel();
  const input = operationInput({ idempotencyKey: 'shipping-legacy-0001' });
  OperationModel.insert({
    order: input.order._id,
    shipmentId: input.shipment._id,
    provider: input.provider.key,
    mode: input.provider.mode,
    type: input.type,
    idempotencyKey: input.idempotencyKey,
    requestHash: stableHash(input.requestPayload),
    status: 'succeeded',
    result: { legacy: true },
  });

  const replay = await reserveOperation(input, { OperationModel });
  assert.strictEqual(replay.replay, true);
  assert.deepStrictEqual(replay.operation.result, { legacy: true });
  await expectLogisticsCode(
    reserveOperation(
      { ...input, order: { _id: 'order-b' } },
      { OperationModel }
    ),
    'SHIPPING_IDEMPOTENCY_CONFLICT'
  );
  ok('las claves históricas válidas solo se aceptan si todo el alcance coincide');
}

async function validateConcurrentShippingReservation() {
  const OperationModel = createOperationModel();
  const input = operationInput({ idempotencyKey: 'shipping-race-0001' });
  const outcomes = await Promise.allSettled([
    reserveOperation(input, { OperationModel }),
    reserveOperation(input, { OperationModel }),
  ]);
  assert.strictEqual(
    outcomes.filter((outcome) => outcome.status === 'fulfilled').length,
    1
  );
  assert.strictEqual(
    outcomes.filter(
      (outcome) =>
        outcome.status === 'rejected' &&
        outcome.reason?.code === 'SHIPPING_OPERATION_ALREADY_EXISTS'
    ).length,
    1
  );
  assert.strictEqual(OperationModel.rows.size, 1);

  const conflictingModel = createOperationModel();
  const crossOperation = await Promise.allSettled([
    reserveOperation(input, { OperationModel: conflictingModel }),
    reserveOperation(
      { ...input, type: 'cancel_label' },
      { OperationModel: conflictingModel }
    ),
  ]);
  assert.strictEqual(
    crossOperation.filter((outcome) => outcome.status === 'fulfilled').length,
    1
  );
  assert.strictEqual(
    crossOperation.filter(
      (outcome) =>
        outcome.status === 'rejected' &&
        outcome.reason?.code === 'SHIPPING_IDEMPOTENCY_CONFLICT'
    ).length,
    1
  );
  ok('la concurrencia crea una sola operación y no cruza tipos de operación');
}

const servicesDir = path.join(__dirname, '..', 'services');
const moduleFiles = [
  path.join(servicesDir, 'orderShippingIntegrationService.js'),
  ...fs.readdirSync(path.join(servicesDir, 'orderShipping'))
    .filter((file) => file.endsWith('.js'))
    .map((file) => path.join(servicesDir, 'orderShipping', file)),
];
for (const file of moduleFiles) {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).length;
  assert.ok(lines <= 700, `${path.basename(file)} excede 700 líneas (${lines})`);
}
ok('la fachada y cada módulo especializado permanecen por debajo de 700 líneas');

async function main() {
  await validateOptionalCarrierCapabilities();
  await validateProductionWebhookTestBlock();
  await validateScopedShippingFingerprint();
  await validateShippingReplayAndConflicts();
  await validateLegacyScopedCompatibility();
  await validateConcurrentShippingReservation();
  console.log(`\nComposición de envíos de Órdenes: ${checks.length}/${checks.length} controles aprobados.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
