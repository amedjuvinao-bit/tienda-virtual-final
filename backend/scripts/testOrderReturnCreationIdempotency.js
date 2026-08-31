'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const OrderReturn = require('../models/OrderReturn');
const {
  createOrderReturn,
} = require('../services/orderReturns/creation');
const {
  buildReturnEligibility,
  normalizeReturnRequest,
} = require('../services/orderReturns/eligibility');
const {
  buildReturnCreationIdempotency,
  canonicalReturnCreationPayload,
  createReturnCreationIdempotencyService,
  evaluateExistingReturnCreation,
  normalizeExplicitIdempotencyKey,
} = require('../services/orderReturns/idempotency');

const tests = [];

function test(name, callback) {
  tests.push({ name, callback });
}

function buildOrder() {
  return {
    _id: new mongoose.Types.ObjectId('64e000000000000000000001'),
    orderNumber: 'ORD-IDEMP-RMA',
    customer: {
      customerId: new mongoose.Types.ObjectId('64e000000000000000000002'),
      email: 'cliente@example.com',
    },
    items: [
      {
        _id: new mongoose.Types.ObjectId('64e000000000000000000011'),
        product: new mongoose.Types.ObjectId('64e000000000000000000021'),
        title: 'Producto A',
        productType: 'physical',
        variantKey: 'm__negro',
        size: 'M',
        color: 'Negro',
        quantity: 3,
        unitPrice: 100000,
      },
      {
        _id: new mongoose.Types.ObjectId('64e000000000000000000012'),
        product: new mongoose.Types.ObjectId('64e000000000000000000022'),
        title: 'Producto B',
        productType: 'physical',
        variantKey: 'l__azul',
        size: 'L',
        color: 'Azul',
        quantity: 2,
        unitPrice: 80000,
      },
    ],
  };
}

function baseRequest(order = buildOrder()) {
  return {
    order,
    actor: {
      id: new mongoose.Types.ObjectId('64e000000000000000000030'),
      displayName: 'Administradora',
      role: 'manager',
    },
    idempotencyKey: 'rma-request-0001',
    items: [
      {
        orderItemId: String(order.items[0]._id),
        quantity: 1,
        reasonCode: 'wrong_size',
        reasonText: '  La talla no sirve  ',
      },
      {
        orderItemId: String(order.items[1]._id),
        quantity: 1,
        reasonCode: 'damaged',
        reasonText: 'Caja golpeada',
      },
    ],
    requestedResolution: 'refund',
    reasonSummary: '  Solicitud doble producto  ',
    requestSource: 'admin',
  };
}

function buildInjectedTransaction(existing) {
  let insideTransaction = false;
  let ended = false;
  let inspectedInsideTransaction = false;
  const order = buildOrder();
  const session = {
    async withTransaction(callback) {
      insideTransaction = true;
      try {
        await callback();
      } finally {
        insideTransaction = false;
      }
    },
    async endSession() {
      ended = true;
    },
  };
  const OrderModel = {
    findOne() {
      return {
        async session(observedSession) {
          assert.strictEqual(observedSession, session);
          return order;
        },
      };
    },
    async updateOne() {
      throw new Error('ORDER_UPDATE_MUST_NOT_RUN_ON_IDEMPOTENT_REPLAY');
    },
  };
  const returnCreationIdempotencyService = {
    async inspect({ descriptor, session: observedSession }) {
      assert.strictEqual(observedSession, session);
      inspectedInsideTransaction = insideTransaction;
      return evaluateExistingReturnCreation(existing, descriptor);
    },
  };

  return {
    OrderModel,
    order,
    returnCreationIdempotencyService,
    session,
    wasEnded: () => ended,
    wasInspectedInsideTransaction: () => inspectedInsideTransaction,
  };
}

test('el hash canónico no depende del orden de las líneas ni de espacios accidentales', () => {
  const order = buildOrder();
  const first = buildReturnCreationIdempotency(baseRequest(order));
  const second = buildReturnCreationIdempotency({
    ...baseRequest(order),
    items: [...baseRequest(order).items]
      .reverse()
      .map((item) => ({ ...item, reasonText: ` ${item.reasonText} ` })),
    reasonSummary: 'Solicitud doble producto',
  });

  assert.strictEqual(first.requestHash, second.requestHash);
  assert.deepStrictEqual(first.canonicalPayload, second.canonicalPayload);
});

test('un cambio económico o de resolución cambia el hash', () => {
  const request = baseRequest();
  const original = buildReturnCreationIdempotency(request);
  const changedQuantity = buildReturnCreationIdempotency({
    ...request,
    items: [{ ...request.items[0], quantity: 2 }],
  });
  const changedResolution = buildReturnCreationIdempotency({
    ...request,
    requestedResolution: 'exchange',
  });

  assert.notStrictEqual(original.requestHash, changedQuantity.requestHash);
  assert.notStrictEqual(original.requestHash, changedResolution.requestHash);
});

test('la clave queda aislada por orden y actor o cliente', () => {
  const request = baseRequest();
  const admin = buildReturnCreationIdempotency(request);
  const anotherAdmin = buildReturnCreationIdempotency({
    ...request,
    actor: {
      ...request.actor,
      id: new mongoose.Types.ObjectId('64e000000000000000000031'),
    },
  });
  const customer = buildReturnCreationIdempotency({
    ...request,
    actor: { displayName: 'Cliente', role: 'customer' },
    customerSnapshot: {
      customer: request.order.customer.customerId,
      email: request.order.customer.email,
    },
    requestSource: 'customer',
  });

  assert.notStrictEqual(admin.scope, anotherAdmin.scope);
  assert.notStrictEqual(admin.scope, customer.scope);
  assert.match(admin.scope, /^admin:[a-f0-9]{48}$/);
  assert.match(customer.scope, /^customer:[a-f0-9]{48}$/);
  assert(!admin.scope.includes('Administradora'));
  assert(!customer.scope.includes('cliente@example.com'));
});

test('la creación exige una clave explícita por acción', () => {
  assert.throws(
    () =>
      buildReturnCreationIdempotency({
        ...baseRequest(),
        idempotencyKey: '',
      }),
    (error) =>
      error?.code === 'RETURN_IDEMPOTENCY_KEY_REQUIRED' &&
      error?.statusCode === 400
  );
});

test('una clave explícita inválida falla antes de persistir', () => {
  assert.throws(
    () => normalizeExplicitIdempotencyKey('corta'),
    (error) =>
      error?.code === 'RETURN_IDEMPOTENCY_KEY_INVALID' &&
      error?.statusCode === 400
  );
  assert.strictEqual(
    normalizeExplicitIdempotencyKey('RMA.client_retry-001'),
    'RMA.client_retry-001'
  );
});

test('mismo scope, key y hash reutiliza el RMA aunque la línea tenga varias unidades', () => {
  const descriptor = buildReturnCreationIdempotency({
    ...baseRequest(),
    items: [{ ...baseRequest().items[0], quantity: 1 }],
  });
  const existing = {
    _id: new mongoose.Types.ObjectId(),
    order: baseRequest().order._id,
    creationIdempotencyScope: descriptor.scope,
    creationIdempotencyKey: descriptor.key,
    creationRequestHash: descriptor.requestHash,
    items: [{ requestedQuantity: 1, purchasedQuantity: 3 }],
  };

  const decision = evaluateExistingReturnCreation(existing, descriptor);
  assert.strictEqual(decision.action, 'reuse');
  assert.strictEqual(decision.returnCase, existing);
});

test('misma key con payload diferente devuelve conflicto determinista', () => {
  const descriptor = buildReturnCreationIdempotency(baseRequest());
  assert.throws(
    () =>
      evaluateExistingReturnCreation(
        { creationRequestHash: '0'.repeat(64) },
        descriptor
      ),
    (error) =>
      error?.code === 'RETURN_IDEMPOTENCY_KEY_REUSED' &&
      error?.statusCode === 409
  );
});

test('una key distinta representa otra acción legítima y conserva la validación de capacidad', async () => {
  const order = buildOrder();
  order.status = 'delivered';
  order.createdAt = new Date('2026-08-20T12:00:00.000Z');
  const first = buildReturnCreationIdempotency(baseRequest(order));
  const second = buildReturnCreationIdempotency({
    ...baseRequest(order),
    idempotencyKey: 'rma-request-0002',
  });
  let observedFilter = null;
  const service = createReturnCreationIdempotencyService({
    OrderReturnModel: {
      findOne(filter) {
        observedFilter = filter;
        return { exec: async () => null };
      },
    },
  });

  const decision = await service.inspect({
    orderId: order._id,
    descriptor: second,
  });

  assert.strictEqual(first.scope, second.scope);
  assert.strictEqual(first.requestHash, second.requestHash);
  assert.notStrictEqual(first.key, second.key);
  assert.strictEqual(decision.action, 'continue');
  assert.strictEqual(observedFilter.creationIdempotencyKey, second.key);

  const firstLineId = String(order.items[0]._id);
  const eligibility = buildReturnEligibility(
    order,
    new Map([[firstLineId, 1]]),
    new Date('2026-08-21T12:00:00.000Z'),
    { windowDays: 30, allowedResolutions: ['refund'] }
  );
  const secondRequest = normalizeReturnRequest(
    order,
    [
      {
        orderItemId: firstLineId,
        quantity: 1,
        reasonCode: 'wrong_size',
      },
    ],
    eligibility,
    { requestedResolution: 'refund' }
  );
  assert.strictEqual(
    eligibility.find((item) => item.orderItemId === firstLineId)
      ?.availableQuantity,
    2
  );
  assert.strictEqual(secondRequest[0].requestedQuantity, 1);
});

test('el inspector admite un modelo inyectado y propaga la sesión', async () => {
  const descriptor = buildReturnCreationIdempotency(baseRequest());
  const session = { name: 'fake-session' };
  let observedFilter = null;
  let observedSession = null;
  const existing = { creationRequestHash: descriptor.requestHash };
  const fakeModel = {
    findOne(filter) {
      observedFilter = filter;
      return {
        session(value) {
          observedSession = value;
          return this;
        },
        exec: async () => existing,
      };
    },
  };
  const service = createReturnCreationIdempotencyService({
    OrderReturnModel: fakeModel,
  });
  const decision = await service.inspect({
    orderId: baseRequest().order._id,
    descriptor,
    session,
  });

  assert.strictEqual(decision.action, 'reuse');
  assert.strictEqual(observedSession, session);
  assert.strictEqual(observedFilter.creationIdempotencyScope, descriptor.scope);
  assert.strictEqual(observedFilter.creationIdempotencyKey, descriptor.key);
});

test('mismo key y payload hace replay dentro de la transacción sin consumir capacidad', async () => {
  const order = buildOrder();
  const request = baseRequest(order);
  const descriptor = buildReturnCreationIdempotency(request);
  const existing = {
    _id: new mongoose.Types.ObjectId('64e000000000000000000090'),
    returnNumber: 'RMA-ORD-IDEMP-RMA-EXISTING',
    order: order._id,
    orderNumber: order.orderNumber,
    status: 'requested',
    revision: 0,
    creationRequestHash: descriptor.requestHash,
    items: [{ requestedQuantity: 1, purchasedQuantity: 3 }],
  };
  const injected = buildInjectedTransaction(existing);

  const result = await createOrderReturn(
    {
      orderFilter: { _id: order._id },
      items: request.items,
      requestedResolution: request.requestedResolution,
      reasonSummary: request.reasonSummary,
      actor: request.actor,
      requestSource: request.requestSource,
      idempotencyKey: request.idempotencyKey,
    },
    {
      OrderModel: injected.OrderModel,
      startSession: async () => injected.session,
      returnCreationIdempotencyService:
        injected.returnCreationIdempotencyService,
    }
  );

  assert.strictEqual(result._id, existing._id);
  assert.strictEqual(result.idempotent, true);
  assert.strictEqual(injected.wasInspectedInsideTransaction(), true);
  assert.strictEqual(injected.wasEnded(), true);
});

test('mismo key y payload diferente produce 409 dentro de la transacción', async () => {
  const order = buildOrder();
  const originalRequest = baseRequest(order);
  const descriptor = buildReturnCreationIdempotency(originalRequest);
  const injected = buildInjectedTransaction({
    _id: new mongoose.Types.ObjectId('64e000000000000000000091'),
    creationRequestHash: descriptor.requestHash,
  });

  await assert.rejects(
    () =>
      createOrderReturn(
        {
          orderFilter: { _id: order._id },
          items: [{ ...originalRequest.items[0], quantity: 2 }],
          requestedResolution: originalRequest.requestedResolution,
          reasonSummary: originalRequest.reasonSummary,
          actor: originalRequest.actor,
          requestSource: originalRequest.requestSource,
          idempotencyKey: originalRequest.idempotencyKey,
        },
        {
          OrderModel: injected.OrderModel,
          startSession: async () => injected.session,
          returnCreationIdempotencyService:
            injected.returnCreationIdempotencyService,
        }
      ),
    (error) =>
      error?.code === 'RETURN_IDEMPOTENCY_KEY_REUSED' &&
      error?.statusCode === 409
  );
  assert.strictEqual(injected.wasInspectedInsideTransaction(), true);
  assert.strictEqual(injected.wasEnded(), true);
});

test('el modelo tiene un índice único y parcial por orden, scope y key', () => {
  const index = OrderReturn.schema.indexes().find(
    ([, options]) => options.name === 'order_return_creation_idempotency_unique'
  );
  assert(index);
  assert.strictEqual(index[1].unique, true);
  assert.deepStrictEqual(index[0], {
    order: 1,
    creationIdempotencyScope: 1,
    creationIdempotencyKey: 1,
  });
  assert.deepStrictEqual(index[1].partialFilterExpression, {
    creationIdempotencyScope: { $type: 'string' },
    creationIdempotencyKey: { $type: 'string' },
  });
});

test('admin y autoservicio aceptan Idempotency-Key y responden replay con 200', () => {
  const shared = fs.readFileSync(
    path.resolve(__dirname, '../controllers/orderReturns/shared.js'),
    'utf8'
  );
  const creationControllers = [
    '../controllers/orderReturns/adminController.js',
    '../controllers/orderReturns/customerController.js',
  ]
    .map((relativePath) =>
      fs.readFileSync(path.resolve(__dirname, relativePath), 'utf8')
    )
    .join('\n');
  assert(shared.includes("req.headers?.['idempotency-key']"));
  assert(shared.includes("req.headers?.['x-idempotency-key']"));
  assert(shared.includes('req.body?.idempotencyKey'));
  assert.strictEqual(
    (creationControllers.match(/returnCase\.idempotent \? 200 : 201/g) || [])
      .length,
    2
  );
});

test('la carga canónica consolida cantidades repetidas de una misma línea', () => {
  const order = buildOrder();
  const payload = canonicalReturnCreationPayload({
    order,
    items: [
      {
        orderItemId: String(order.items[0]._id),
        quantity: 1,
        reasonCode: 'wrong_size',
      },
      {
        orderItemId: String(order.items[0]._id),
        quantity: 1,
        reasonCode: 'wrong_size',
      },
    ],
  });
  assert.strictEqual(payload.items.length, 1);
  assert.strictEqual(payload.items[0].quantity, 2);
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
    }
  }
  console.log(`\nIdempotencia de creación RMA: ${passed}/${tests.length}.`);
})();
