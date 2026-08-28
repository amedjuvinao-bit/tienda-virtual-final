'use strict';

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const fs = require('node:fs');
const path = require('node:path');

const OrderReturn = require('../models/OrderReturn');
const ShippingOperation = require('../models/ShippingOperation');

const {
  generateOrderReturnLabel,
} = require('../services/orderReturnShippingService');
const {
  assertHandoffCompatible,
  assertJourneyNotDelivered,
} = require('../services/orderReturnShipping/handoffAndTracking');
const {
  buildReturnShipmentPayload,
} = require('../services/orderReturnShipping/payload');
const {
  applyReturnTrackingUpdate,
} = require('../services/orderReturnShipping/state');
const {
  assertManualReturnTransitAllowed,
  assertReturnShippingCancelled,
} = require('../services/orderReturns/validation');
const {
  processShippingWebhookEvent,
} = require('../services/shippingWebhookProcessingService');

const tests = [];
function test(name, callback) {
  tests.push({ name, callback });
}

function fixture() {
  const orderId = new mongoose.Types.ObjectId();
  const returnId = new mongoose.Types.ObjectId();
  const branchId = new mongoose.Types.ObjectId();
  const order = {
    _id: orderId,
    orderNumber: '000777',
    total: 120000,
    payment: { currency: 'COP' },
    branch: branchId,
    inventoryAllocations: [],
    fulfillment: { shipments: [] },
    customer: {
      name: 'Ana',
      lastname: 'Pérez',
      email: 'ana@example.com',
      phone: '3001234567',
      address: 'Calle 10 # 20-30',
      city: '11001000',
      departmentCode: '11',
      countryCode: 'CO',
    },
  };
  const returnCase = {
    _id: returnId,
    order: orderId,
    returnNumber: 'RMA-000777-A1',
    status: 'authorized',
    revision: 4,
    inTransitAt: null,
    policySnapshot: { returnShippingPaidBy: 'store' },
    items: [{ unitAmount: 120000, authorizedQuantity: 1 }],
    shipping: {
      method: 'pending',
      integration: { status: 'manual' },
      packages: [],
    },
  };
  const destination = {
    _id: branchId,
    name: 'Sede Principal',
    code: 'MAIN',
    active: true,
    status: 'active',
    deletedAt: null,
    contact: { phone: '6015550101', email: 'sede@example.com' },
    address: {
      country: 'Colombia',
      department: 'Bogotá',
      departmentCode: '11',
      city: '11001000',
      addressLine: 'Carrera 7 # 80-10',
    },
  };
  const packages = [{
    code: 'RET-1',
    weightGrams: 900,
    lengthCm: 30,
    widthCm: 20,
    heightCm: 12,
  }];
  return { order, returnCase, destination, packages };
}

test('el payload invierte la ruta y nunca confunde cliente con sede', () => {
  const data = fixture();
  const built = buildReturnShipmentPayload(data);
  assert.equal(built.payload.origin.name, 'Ana Pérez');
  assert.equal(built.payload.origin.street, 'Calle 10 # 20-30');
  assert.equal(built.payload.destination.name, 'Sede Principal');
  assert.equal(built.payload.destination.street, 'Carrera 7 # 80-10');
  assert.equal(built.payload.packages[0].weight, 0.9);
});

test('modelo, índices, rutas y CI conservan el contrato de Producción', () => {
  assert.ok(OrderReturn.schema.path('shipping.integration.provider'));
  assert.ok(OrderReturn.schema.path('shipping.originSnapshot.addressLine'));
  assert.ok(OrderReturn.schema.path('shipping.awaitingWarehouseReceipt'));
  assert.deepEqual(ShippingOperation.schema.path('scope').enumValues, ['outbound', 'return']);
  assert.ok(OrderReturn.schema.indexes().some(
    ([, options]) => options.name === 'order_return_shipping_tracking_lookup'
  ));
  assert.ok(ShippingOperation.schema.indexes().some(
    ([, options]) => options.name === 'returnCase_1_createdAt_-1'
  ));
  const activeLockIndex = ShippingOperation.schema.indexes().find(
    ([, options]) => options.name === 'returnCase_1_activeLock_1'
  );
  assert.equal(activeLockIndex?.[1]?.unique, true);
  assert.equal(
    activeLockIndex?.[1]?.partialFilterExpression?.activeLock,
    true
  );
  const root = path.resolve(__dirname, '..', '..');
  const routes = fs.readFileSync(path.join(root, 'backend/routes/orderReturnRoutes.js'), 'utf8');
  const workflow = fs.readFileSync(path.join(root, '.github/workflows/orders-ci.yml'), 'utf8');
  [
    '/shipping/rates',
    '/shipping/label',
    '/shipping/tracking/sync',
    '/shipping/pickup',
    '/shipping/handoff/dropoff',
    '/shipping/label/cancel',
  ].forEach((endpoint) => assert.ok(routes.includes(endpoint)));
  assert.ok(workflow.includes('test:orders-return-shipping'));
});

test('una devolución internacional se bloquea en vez de inventar aduanas', () => {
  const data = fixture();
  data.order.customer.countryCode = 'US';
  assert.throws(
    () => buildReturnShipmentPayload(data),
    (error) => error?.code === 'RETURN_SHIPPING_INTERNATIONAL_MANUAL_REQUIRED'
  );
});

test('Delivered solo deja el RMA en tránsito y pendiente de recepción física', () => {
  const { returnCase } = fixture();
  const state = applyReturnTrackingUpdate(
    returnCase,
    { status: 'Delivered', description: 'Entregado en la sede' },
    { provider: 'envia', source: 'webhook', receivedAt: new Date('2026-08-28T12:00:00Z') }
  );
  assert.equal(state.stage, 'delivered');
  assert.equal(state.status, 'in_transit');
  assert.equal(state.shipping.awaitingWarehouseReceipt, true);
  assert.equal(returnCase.status, 'authorized');
});

test('un RMA no puede cancelarse dejando una guía externa activa', () => {
  const { returnCase } = fixture();
  returnCase.shipping = {
    carrierName: 'coordinadora',
    trackingNumber: 'RET-ACTIVE-1',
    labelUrl: 'https://labels.example/RET-ACTIVE-1.pdf',
    integration: { provider: 'envia', status: 'label_generated' },
  };
  assert.throws(
    () => assertReturnShippingCancelled(returnCase),
    (error) => error?.code === 'RETURN_SHIPPING_LABEL_CANCELLATION_REQUIRED'
  );
  returnCase.shipping.integration.status = 'cancelled';
  assert.doesNotThrow(() => assertReturnShippingCancelled(returnCase));
});

test('un operador no puede maquillar manualmente el tránsito de una guía integrada', () => {
  const { returnCase } = fixture();
  returnCase.shipping.integration = {
    provider: 'envia',
    status: 'label_generated',
  };
  assert.throws(
    () => assertManualReturnTransitAllowed(returnCase),
    (error) => error?.code === 'RETURN_SHIPPING_PROVIDER_TRACKING_REQUIRED'
  );
  returnCase.shipping.integration.provider = 'manual';
  assert.doesNotThrow(() => assertManualReturnTransitAllowed(returnCase));
});

test('recolección, entrega en punto y llegada a sede no pueden contradecirse', () => {
  const { returnCase } = fixture();
  returnCase.shipping.integration = {
    provider: 'envia',
    status: 'pickup_scheduled',
    handoffMode: 'pickup',
    pickup: { status: 'scheduled' },
  };
  assert.throws(
    () => assertHandoffCompatible(returnCase, 'dropoff'),
    (error) => error?.code === 'RETURN_SHIPPING_HANDOFF_CONFLICT'
  );
  returnCase.shipping.integration = {
    provider: 'envia',
    status: 'label_generated',
    handoffMode: 'dropoff',
    pickup: { status: 'not_requested' },
  };
  assert.throws(
    () => assertHandoffCompatible(returnCase, 'pickup'),
    (error) => error?.code === 'RETURN_SHIPPING_HANDOFF_CONFLICT'
  );
  returnCase.shipping.carrierDeliveredAt = new Date();
  assert.throws(
    () => assertJourneyNotDelivered(returnCase, 'cancelar la guía'),
    (error) => error?.code === 'RETURN_SHIPPING_ALREADY_DELIVERED'
  );
});

test('la generación persiste la respuesta externa antes de cerrar la idempotencia', async () => {
  const data = fixture();
  const operations = new Map();
  let generatedCalls = 0;
  let persistedShipping = null;
  let storedReturn = data.returnCase;
  let persistAttempts = 0;

  const OperationModel = {
    async findOne({ idempotencyKey }) {
      return operations.get(idempotencyKey) || null;
    },
    async create(value) {
      const operation = {
        ...value,
        _id: new mongoose.Types.ObjectId(),
        result: null,
        error: {},
        attempts: 1,
        async save() {
          operations.set(this.idempotencyKey, this);
          return this;
        },
      };
      operations.set(value.idempotencyKey, operation);
      return operation;
    },
  };
  const OrderModel = { findOne: async () => data.order };
  const OrderReturnModel = {
    findOne: async () => storedReturn,
    async findOneAndUpdate(_filter, update) {
      persistAttempts += 1;
      if (persistAttempts === 1) {
        storedReturn = { ...storedReturn, revision: storedReturn.revision + 1 };
        return null;
      }
      persistedShipping = update.$set.shipping;
      storedReturn = {
        ...storedReturn,
        ...update.$set,
        revision: storedReturn.revision + 1,
      };
      return storedReturn;
    },
  };
  const BranchModel = {
    findOne: () => ({ lean: async () => data.destination }),
  };
  const provider = {
    key: 'envia',
    mode: 'sandbox',
    configured: true,
    customsPolicy: {},
    async getCarrierActions() { return []; },
    async generateLabel() {
      generatedCalls += 1;
      return [{
        shipmentId: 'ENV-RETURN-1',
        trackingNumber: 'RET-TRACK-1',
        label: 'https://labels.example/return-1.pdf',
        trackUrl: 'https://track.example/RET-TRACK-1',
        carrier: 'coordinadora',
        service: 'standard',
        totalPrice: 18500,
        currency: 'COP',
      }];
    },
  };
  const dependencies = {
    BranchModel,
    OperationModel,
    OrderModel,
    OrderReturnModel,
    provider,
    getShippingProviderStatus: async () => ({ envia: { enabled: true, mode: 'sandbox' } }),
  };
  const input = {
    orderFilter: { _id: data.order._id },
    returnId: data.returnCase._id,
    expectedRevision: 4,
    destinationBranchId: data.destination._id,
    packages: data.packages,
    rate: {
      carrier: 'coordinadora',
      service: 'standard',
      totalPrice: 18500,
      currency: 'COP',
    },
    idempotencyKey: 'rma-label-idempotency-0001',
  };
  await assert.rejects(
    () => generateOrderReturnLabel(input, dependencies),
    (error) => error?.code === 'RETURN_REVISION_CONFLICT'
  );
  const pendingOperation = operations.get(input.idempotencyKey);
  assert.equal(pendingOperation.status, 'action_required');
  assert.equal(pendingOperation.result.generated.trackingNumber, 'RET-TRACK-1');

  input.expectedRevision = 5;
  const reconciled = await generateOrderReturnLabel(input, dependencies);
  const replay = await generateOrderReturnLabel(input, dependencies);

  assert.equal(generatedCalls, 1);
  assert.equal(reconciled.returnCase.shipping.trackingNumber, 'RET-TRACK-1');
  assert.equal(reconciled.replayed, true);
  assert.equal(replay.replayed, true);
  assert.equal(persistedShipping.destinationBranch.toString(), data.destination._id.toString());
  assert.equal(persistedShipping.originSnapshot.addressLine, 'Calle 10 # 20-30');
  assert.equal(persistedShipping.integration.providerShipmentId, 'ENV-RETURN-1');
  const operation = operations.get(input.idempotencyKey);
  assert.equal(operation.scope, 'return');
  assert.equal(operation.status, 'succeeded');
  assert.ok(operation.result.generated.labelUrl.startsWith('https://'));
});

test('el webhook firmado enruta una guía RMA sin tocar el despacho de venta', async () => {
  const data = fixture();
  data.returnCase.shipping = {
    carrierName: 'coordinadora',
    trackingNumber: 'RET-WEBHOOK-1',
    labelUrl: 'https://labels.example/RET-WEBHOOK-1.pdf',
    integration: {
      provider: 'envia',
      mode: 'sandbox',
      status: 'label_generated',
      providerShipmentId: 'ENV-RETURN-WEBHOOK-1',
    },
  };
  const event = {
    _id: new mongoose.Types.ObjectId(),
    provider: 'envia',
    eventId: 'evt-return-1',
    status: 'received',
    attempts: 0,
    payload: {
      data: {
        shipmentId: 'ENV-RETURN-WEBHOOK-1',
        trackingNumber: 'RET-WEBHOOK-1',
        status: 'Delivered',
        description: 'Entregado en sede',
      },
    },
    async save() { return this; },
  };
  let updatedReturn = data.returnCase;
  const EventModel = {
    async findOneAndUpdate() {
      event.status = 'processing';
      event.attempts += 1;
      return event;
    },
  };
  const OrderModel = {
    findOne: async () => null,
    findById: async () => data.order,
  };
  const OrderReturnModel = {
    findOne: async (filter) => {
      assert.equal(
        filter['shipping.integration.providerShipmentId'],
        'ENV-RETURN-WEBHOOK-1'
      );
      return updatedReturn;
    },
    async findOneAndUpdate(_filter, update) {
      updatedReturn = {
        ...updatedReturn,
        ...update.$set,
        revision: updatedReturn.revision + 1,
      };
      return updatedReturn;
    },
  };

  const result = await processShippingWebhookEvent(event._id, {
    EventModel,
    OrderModel,
    OrderReturnModel,
    now: new Date('2026-08-28T14:00:00Z'),
  });

  assert.equal(result.scope, 'return');
  assert.equal(result.stage, 'delivered');
  assert.equal(updatedReturn.status, 'in_transit');
  assert.equal(updatedReturn.shipping.awaitingWarehouseReceipt, true);
  assert.equal(event.status, 'processed');
  assert.equal(event.returnCase.toString(), data.returnCase._id.toString());
  assert.equal(event.shipmentId, null);
});

(async () => {
  let passed = 0;
  for (const entry of tests) {
    try {
      await entry.callback();
      passed += 1;
      console.log(`OK ${passed}: ${entry.name}`);
    } catch (error) {
      console.error(`FAIL: ${entry.name}`);
      console.error(error);
      process.exitCode = 1;
      break;
    }
  }
  console.log(`\nLogística inversa RMA: ${passed}/${tests.length}.`);
})();
