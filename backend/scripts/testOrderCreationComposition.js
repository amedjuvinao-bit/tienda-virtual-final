/* eslint-disable no-console */
'use strict';

const assert = require('assert');
const ordersRouter = require('../routes/orders');
const {
  createOrderRateLimit,
} = require('../middleware/orderCreationRateLimit');
const {
  buildOrderCreationFingerprintPayload,
  buildOrderCreationResult,
  canonicalizeCart,
  deriveIdempotencyKey,
  orderNeedsElectronicDelivery,
} = require('../lib/orders/orderCreationPayload');
const {
  sendOrderCreationError,
} = require('../lib/orders/orderCreationHttp');
const {
  ORDER_CREATION_ENDPOINT,
  canReuseMutableOrderData,
  inspectExistingIdempotency,
  isDuplicateKeyError,
  isDuplicateOrderNumberError,
  isIdempotencyRecordStale,
  syncExistingOrderForRetry,
} = require('../services/orderCreationIdempotencyService');

let passed = 0;

function ok(message) {
  passed += 1;
  console.log(`OK ${passed}: ${message}`);
}

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    status(value) {
      this.statusCode = value;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    },
  };
}

function validateRouteComposition() {
  const layer = ordersRouter.stack.find(
    (candidate) =>
      candidate.route?.path === '/' && candidate.route?.methods?.post === true
  );

  assert(layer, 'No existe POST /api/orders.');
  assert.deepStrictEqual(
    layer.route.stack.map((item) => item.handle.name),
    ['orderCreationRateLimit', 'requireAuthorizedOrderCart', 'createOrder']
  );
  ok('POST /api/orders conserva rate limit, autorización y handler en orden');
}

function validateInjectableRateLimit() {
  let currentTime = 1_000;
  const bucket = new Map();
  const middleware = createOrderRateLimit({
    windowMs: 500,
    maxHits: 1,
    bucket,
    now: () => currentTime,
  });
  const request = {
    ip: '198.51.100.10',
    headers: {},
    connection: {},
  };

  let nextCalls = 0;
  middleware(request, createResponse(), () => {
    nextCalls += 1;
  });
  assert.strictEqual(nextCalls, 1);

  const blocked = createResponse();
  middleware(request, blocked, () => {
    nextCalls += 1;
  });
  assert.strictEqual(blocked.statusCode, 429);
  assert.strictEqual(nextCalls, 1);

  currentTime += 501;
  middleware(request, createResponse(), () => {
    nextCalls += 1;
  });
  assert.strictEqual(nextCalls, 2);
  ok('el limitador es determinista, inyectable y reinicia su ventana');
}

function validateBoundedRateLimitStorage() {
  let currentTime = 2_000;
  const bucket = new Map();
  const middleware = createOrderRateLimit({
    windowMs: 500,
    maxHits: 10,
    maxTrackedClients: 2,
    cleanupIntervalHits: 100,
    bucket,
    now: () => currentTime,
  });
  const hit = (ip) => middleware(
    { ip, headers: {}, connection: {} },
    createResponse(),
    () => {}
  );

  hit('198.51.100.1');
  hit('198.51.100.2');
  hit('198.51.100.3');
  assert.strictEqual(bucket.size, 2);
  assert.strictEqual(bucket.has('198.51.100.1'), false);

  currentTime += 501;
  hit('198.51.100.4');
  assert.strictEqual(bucket.size, 1);
  assert.strictEqual(bucket.has('198.51.100.4'), true);
  ok('el almacenamiento local expira entradas y tiene un límite de memoria');
}

function validatePurePayloadHelpers() {
  const firstCart = [
    {
      productId: '64b000000000000000000002',
      variantKey: 'B',
      price: 20,
      quantity: 1,
    },
    {
      productId: '64b000000000000000000001',
      variantKey: 'A',
      price: 10,
      quantity: 2,
    },
  ];
  const secondCart = [...firstCart].reverse();
  const base = {
    sessionId: 'session-composition-test',
    cart: firstCart,
    subtotal: 40,
    shipping: 0,
    total: 40,
    customer: { email: 'buyer@example.invalid' },
  };

  assert.deepStrictEqual(canonicalizeCart(firstCart), canonicalizeCart(secondCart));
  assert.strictEqual(
    deriveIdempotencyKey(base),
    deriveIdempotencyKey({ ...base, cart: secondCart })
  );
  assert.strictEqual(
    orderNeedsElectronicDelivery([{ productType: 'physical' }]),
    false
  );
  assert.strictEqual(
    orderNeedsElectronicDelivery([
      {
        productType: 'bundle',
        fulfillmentSnapshot: {
          bundle: { components: [{ productType: 'digital' }] },
        },
      },
    ]),
    true
  );

  const response = buildOrderCreationResult({
    _id: 'order-1',
    orderNumber: '000001',
    total: 100,
    payment: { amount: 25, currency: 'COP' },
    storeCredit: { applied: true, amount: 75, status: 'reserved' },
  });
  assert.strictEqual(response.amountDue, 25);
  assert.deepStrictEqual(response.storeCredit, {
    applied: true,
    amount: 75,
    currency: 'COP',
    status: 'reserved',
  });
  ok('los helpers puros estabilizan idempotencia, entrega y respuesta pública');
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function richCreationPayload() {
  return {
    sessionId: 'session-contract-1',
    cart: [
      {
        productId: '64b000000000000000000001',
        variantKey: 'talla:8|color:azul',
        variantAttributes: [
          { key: 'color', value: 'Azul' },
          { key: 'talla', value: '8' },
        ],
        price: 125000,
        quantity: 1,
      },
    ],
    subtotal: 125000,
    shipping: 15000,
    total: 140000,
    couponCode: 'BIENVENIDA',
    customer: {
      name: 'María',
      lastname: 'Pérez',
      id: '1010123456',
      documentType: 'CC',
      emailOrPhone: 'maria@example.com',
      email: 'maria@example.com',
      phone: '3001234567',
      address: 'Calle 10 # 20-30',
      city: 'Bogotá',
      municipalityId: '11001',
      postalCode: '110111',
      country: 'Colombia',
      countryCode: 'CO',
      department: 'Bogotá D.C.',
      departmentCode: '11',
      deliveryType: 'envio',
      wantsNewsletter: false,
    },
    billing: {
      useSameAddress: false,
      personType: 'juridica',
      documentType: 'NIT',
      documentNumber: '900123456',
      dv: '7',
      businessName: 'Compras Ejemplo SAS',
      email: 'facturas@example.com',
      address: 'Carrera 7 # 80-10',
      city: 'Bogotá',
      municipalityCode: '11001',
      department: 'Bogotá D.C.',
      departmentCode: '11',
      postalCode: '110221',
      phone: '6015555555',
      country: 'Colombia',
      countryCode: 'CO',
      tributeCode: 'ZZ',
    },
    payment: {
      active: true,
      provider: 'wompi',
      providerLabel: 'Wompi',
      mode: 'sandbox',
      currency: 'COP',
      checkoutLabel: 'Pago seguro',
      enableWebhook: true,
      status: 'pending_gateway',
    },
    storeCredit: {
      apply: true,
      amount: 30000,
      accessToken: 'sc1_SECRET_ACCESS_TOKEN.signature',
    },
    tags: ['vip', 'web'],
  };
}

function validateContractFingerprintIdentity() {
  const cleaned = richCreationPayload();
  const rawBody = {
    branchId: '64b0000000000000000000aa',
    source: 'online',
    paymentReference: 'ORDER-REF-1',
    paymentTransactionId: 'TX-1',
    payment: {
      apiKey: 'RAW_PAYMENT_SECRET',
    },
    adminToken: 'RAW_ADMIN_SECRET',
  };
  const original = deriveIdempotencyKey(cleaned, rawBody);
  const expectConflictFingerprint = (label, mutateCleaned, mutateRaw) => {
    const nextCleaned = clone(cleaned);
    const nextRaw = clone(rawBody);
    if (mutateCleaned) mutateCleaned(nextCleaned);
    if (mutateRaw) mutateRaw(nextRaw);
    assert.notStrictEqual(
      deriveIdempotencyKey(nextCleaned, nextRaw),
      original,
      `${label} no cambió la huella contractual`
    );
  };

  expectConflictFingerprint('dirección de entrega', (value) => {
    value.customer.address = 'Calle 99 # 1-02';
  });
  expectConflictFingerprint('tipo de entrega', (value) => {
    value.customer.deliveryType = 'retiro';
  });
  expectConflictFingerprint('documento del cliente', (value) => {
    value.customer.id = '1099999999';
  });
  expectConflictFingerprint('documento fiscal', (value) => {
    value.billing.documentNumber = '901999999';
  });
  expectConflictFingerprint('dirección fiscal', (value) => {
    value.billing.address = 'Avenida 1 # 2-03';
  });
  expectConflictFingerprint('municipio fiscal', (value) => {
    value.billing.municipalityCode = '05001';
  });
  expectConflictFingerprint('proveedor de pago', (value) => {
    value.payment.provider = 'payu';
  });
  expectConflictFingerprint('moneda de pago', (value) => {
    value.payment.currency = 'USD';
  });
  expectConflictFingerprint('saldo a favor', (value) => {
    value.storeCredit.amount = 20000;
  });
  expectConflictFingerprint('variante', (value) => {
    value.cart[0].variantAttributes[0].value = 'Negro';
  });
  expectConflictFingerprint('cupón', (value) => {
    value.couponCode = 'OTRO';
  });
  expectConflictFingerprint('etiquetas', (value) => {
    value.tags = ['mayorista'];
  });
  expectConflictFingerprint('sede', null, (value) => {
    value.branchId = '64b0000000000000000000bb';
  });
  expectConflictFingerprint('origen', null, (value) => {
    value.source = 'pos';
  });
  expectConflictFingerprint('referencia de pago', null, (value) => {
    value.paymentReference = 'ORDER-REF-2';
  });
  expectConflictFingerprint('transacción de pago', null, (value) => {
    value.paymentTransactionId = 'TX-2';
  });

  const sameContract = clone(cleaned);
  sameContract.customer.email = '  MARIA@EXAMPLE.COM ';
  sameContract.billing.countryCode = ' co ';
  sameContract.tags.reverse();
  const sameRaw = clone(rawBody);
  sameRaw.branchId = ' 64B0000000000000000000AA ';
  assert.strictEqual(
    deriveIdempotencyKey(sameContract, sameRaw),
    original,
    'la normalización superficial debe conservar la huella'
  );

  const differentSecrets = clone(cleaned);
  differentSecrets.storeCredit.accessToken = 'sc1_OTHER_SECRET.signature';
  differentSecrets.internalSecret = 'DO_NOT_HASH';
  const differentRawSecrets = clone(rawBody);
  differentRawSecrets.payment.apiKey = 'OTHER_PAYMENT_SECRET';
  differentRawSecrets.adminToken = 'OTHER_ADMIN_SECRET';
  assert.strictEqual(
    deriveIdempotencyKey(differentSecrets, differentRawSecrets),
    original,
    'los secretos de autorización no deben redefinir la orden'
  );
  const serializedFingerprintPayload = JSON.stringify(
    buildOrderCreationFingerprintPayload(cleaned, rawBody)
  );
  for (const forbidden of [
    'SECRET_ACCESS_TOKEN',
    'RAW_PAYMENT_SECRET',
    'RAW_ADMIN_SECRET',
    'accessToken',
    'apiKey',
    'adminToken',
  ]) {
    assert.strictEqual(serializedFingerprintPayload.includes(forbidden), false);
  }
  assert.match(original, /^[a-f0-9]{64}$/);
  ok('la huella cubre la identidad contractual sin incorporar secretos');
}

async function validateReplayIsImmutable() {
  const stored = {
    _id: 'order-original',
    sessionId: 'session-original',
    customer: { address: 'Dirección original' },
    billing: { documentNumber: '900123456' },
    payment: { provider: 'wompi' },
    saveCalls: 0,
    async save() {
      this.saveCalls += 1;
    },
    toObject() {
      return clone(this);
    },
  };
  const OrderModel = {
    findById() {
      return {
        session: async () => stored,
      };
    },
  };
  const replay = await syncExistingOrderForRetry(
    stored._id,
    {
      sessionId: 'session-attacker',
      customer: { address: 'Dirección cambiada' },
      billing: { documentNumber: '999999999' },
      payment: { provider: 'payu' },
    },
    { OrderModel }
  );
  assert.strictEqual(replay.sessionId, 'session-original');
  assert.strictEqual(replay.customer.address, 'Dirección original');
  assert.strictEqual(replay.billing.documentNumber, '900123456');
  assert.strictEqual(replay.payment.provider, 'wompi');
  assert.strictEqual(stored.saveCalls, 0);
  ok('un replay devuelve la fotografía original y nunca muta la orden');
}

async function validateConcurrentIdempotencyInspection() {
  const modelFor = (record) => ({
    async findOne() {
      return record;
    },
    async deleteOne() {
      throw new Error('no debe eliminarse');
    },
  });
  const completed = await inspectExistingIdempotency(
    { key: 'checkout-key-1', requestHash: 'hash-a' },
    {
      IdempotencyModel: modelFor({
        status: 'completed',
        requestHash: 'hash-a',
        orderId: 'order-1',
      }),
    }
  );
  assert.deepStrictEqual(completed, { action: 'reuse', orderId: 'order-1' });

  const inProgress = await inspectExistingIdempotency(
    { key: 'checkout-key-1', requestHash: 'hash-a' },
    {
      IdempotencyModel: modelFor({
        status: 'processing',
        requestHash: 'hash-a',
        updatedAt: new Date(),
      }),
    }
  );
  assert.deepStrictEqual(inProgress, { action: 'in_progress' });

  const conflicting = await inspectExistingIdempotency(
    { key: 'checkout-key-1', requestHash: 'hash-b' },
    {
      IdempotencyModel: modelFor({
        status: 'processing',
        requestHash: 'hash-a',
        updatedAt: new Date(),
      }),
    }
  );
  assert.strictEqual(conflicting.action, 'conflict');
  ok('replay y solicitud concurrente distinguen payload idéntico y conflictivo');
}

function validateIdempotencyRules() {
  assert.strictEqual(ORDER_CREATION_ENDPOINT, 'POST /orders');
  assert.strictEqual(
    canReuseMutableOrderData({ status: 'pending', payment: { status: 'pending' } }),
    true
  );
  assert.strictEqual(
    canReuseMutableOrderData({ status: 'paid', payment: { status: 'paid' } }),
    false
  );
  assert.strictEqual(
    isIdempotencyRecordStale({
      updatedAt: new Date(Date.now() - 3 * 60 * 1000),
    }),
    true
  );
  assert.strictEqual(isDuplicateKeyError({ code: 11000 }), true);
  assert.strictEqual(
    isDuplicateOrderNumberError({
      code: 11000,
      keyPattern: { orderNumber: 1 },
    }),
    true
  );
  ok('la política de reintento distingue mutabilidad, caducidad y duplicados');
}

function validateHttpErrorMapping() {
  const cartResponse = createResponse();
  sendOrderCreationError(cartResponse, { code: 'CART_ACCESS_ALREADY_USED' });
  assert.strictEqual(cartResponse.statusCode, 404);
  assert.strictEqual(cartResponse.body.error, 'CART_ACCESS_NOT_FOUND');

  const stockResponse = createResponse();
  sendOrderCreationError(
    stockResponse,
    Object.assign(new Error('stock'), { code: 'INSUFFICIENT_STOCK' })
  );
  assert.strictEqual(stockResponse.statusCode, 409);
  assert.strictEqual(stockResponse.body.code, 'INSUFFICIENT_STOCK');

  const concurrentStockResponse = createResponse();
  sendOrderCreationError(concurrentStockResponse, {
    code: 'CONCURRENT_STOCK_CHANGE',
    statusCode: 409,
  });
  assert.strictEqual(concurrentStockResponse.statusCode, 409);
  assert.strictEqual(
    concurrentStockResponse.body.code,
    'CONCURRENT_STOCK_CHANGE'
  );

  const invalidProductResponse = createResponse();
  sendOrderCreationError(invalidProductResponse, {
    code: 'PRODUCT_NOT_AVAILABLE',
    statusCode: 400,
    message: 'Producto no disponible.',
  });
  assert.strictEqual(invalidProductResponse.statusCode, 400);
  assert.strictEqual(
    invalidProductResponse.body.code,
    'PRODUCT_NOT_AVAILABLE'
  );

  const couponResponse = createResponse();
  sendOrderCreationError(
    couponResponse,
    Object.assign(new Error('cupón'), { code: 'COUPON_INVALID' })
  );
  assert.strictEqual(couponResponse.statusCode, 422);
  assert.strictEqual(couponResponse.body.error, 'COUPON_INVALID');

  const storeCreditResponse = createResponse();
  sendOrderCreationError(
    storeCreditResponse,
    Object.assign(new Error('saldo'), {
      code: 'STORE_CREDIT_BALANCE_CHANGED',
    })
  );
  assert.strictEqual(storeCreditResponse.statusCode, 409);
  assert.strictEqual(
    storeCreditResponse.body.error,
    'STORE_CREDIT_BALANCE_CHANGED'
  );

  const orderNumberResponse = createResponse();
  sendOrderCreationError(orderNumberResponse, {
    code: 11000,
    keyPattern: { orderNumber: 1 },
  });
  assert.strictEqual(orderNumberResponse.statusCode, 409);
  assert.strictEqual(orderNumberResponse.body.code, 'ORDER_NUMBER_DUP');

  const idempotencyResponse = createResponse();
  sendOrderCreationError(idempotencyResponse, { code: 11000 });
  assert.strictEqual(idempotencyResponse.statusCode, 409);
  assert.strictEqual(
    idempotencyResponse.body.error,
    'IDEMPOTENCY_CONFLICT'
  );

  const inProgressResponse = createResponse();
  sendOrderCreationError(inProgressResponse, {
    code: 'IDEMPOTENT_IN_PROGRESS',
  });
  assert.strictEqual(inProgressResponse.statusCode, 409);
  assert.strictEqual(
    inProgressResponse.body.error,
    'IDEMPOTENT_IN_PROGRESS'
  );

  const genericResponse = createResponse();
  sendOrderCreationError(genericResponse, new Error('interno'));
  assert.strictEqual(genericResponse.statusCode, 500);
  assert.strictEqual(genericResponse.body.error, 'Error al guardar la orden');
  ok(
    'el presentador HTTP conserva carrito, stock, cupón, saldo e idempotencia'
  );
}

async function main() {
  validateRouteComposition();
  validateInjectableRateLimit();
  validateBoundedRateLimitStorage();
  validatePurePayloadHelpers();
  validateContractFingerprintIdentity();
  validateIdempotencyRules();
  await validateReplayIsImmutable();
  await validateConcurrentIdempotencyInspection();
  validateHttpErrorMapping();
  console.log(`\nComposición de creación de órdenes: ${passed}/${passed} controles.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
