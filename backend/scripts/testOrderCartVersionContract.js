/* eslint-disable no-console */
'use strict';

const assert = require('node:assert/strict');

const {
  createRequireAuthorizedOrderCart,
} = require('../services/authorizedCartOrderService');
const {
  markCartConverted,
} = require('../services/cartAdminOperationsService');
const {
  assertOrderCartSnapshot,
} = require('../services/orderCreationTransactionService');
const {
  createOrderCartSnapshotFingerprint,
} = require('../services/orderCartSnapshotService');
const {
  issueCartAccess,
} = require('../services/cartAccessService');
const {
  sendOrderCreationError,
} = require('../lib/orders/orderCreationHttp');

const CART_ID = '64b000000000000000000401';
const ORDER_ID = '64b000000000000000000402';
const PRODUCT_ID = '64b000000000000000000403';
const SECRET = 'order-cart-version-contract-secret-12345678901234567890';
const VERSION = new Date('2030-01-01T00:00:00.123Z');

let passed = 0;

function ok(message) {
  passed += 1;
  console.log(`OK ${passed}: ${message}`);
}

function canonicalItem(overrides = {}) {
  return {
    _id: PRODUCT_ID,
    productId: PRODUCT_ID,
    title: 'Producto real',
    image: '/producto.webp',
    price: 125000,
    qty: 2,
    quantity: 2,
    color: 'azul',
    size: 'm',
    variantId: 'm__azul',
    variantKey: 'm__azul',
    variantAttributes: [
      { key: 'talla', value: 'M' },
      { key: 'color', value: 'Azul' },
    ],
    productType: 'physical',
    requiresShipping: true,
    valid: true,
    purchasable: true,
    ...overrides,
  };
}

function createCart() {
  const access = issueCartAccess({ cartId: CART_ID, secret: SECRET });
  const storedItem = canonicalItem();
  const cart = {
    _id: CART_ID,
    sessionId: access.sessionId,
    accessTokenHash: access.tokenHash,
    accessVersion: access.version,
    accessIssuedAt: new Date('2030-01-01T00:00:00.000Z'),
    updatedAt: VERSION,
    active: true,
    convertedOrderId: null,
    items: [storedItem],
  };
  cart.toObject = () => ({
    ...cart,
    items: cart.items.map((item) => ({ ...item })),
  });
  return { cart, access };
}

function fakeCartModel(cart) {
  return {
    findOne({ sessionId }) {
      const query = {
        select() {
          return query;
        },
        async exec() {
          return sessionId === cart.sessionId ? cart : null;
        },
      };
      return query;
    },
  };
}

function responseDouble() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

async function runMiddleware({
  headers = {},
  validatedItem = canonicalItem(),
} = {}) {
  const { cart, access } = createCart();
  const fingerprint = createOrderCartSnapshotFingerprint([canonicalItem()]);
  const req = {
    headers: {
      'x-session-id': access.sessionId,
      'x-cart-access-token': access.token,
      'if-match-updated-at': VERSION.toISOString(),
      'x-cart-snapshot-fingerprint': fingerprint,
      'idempotency-key': 'order-cart-version-contract',
      ...headers,
    },
    body: {
      customer: { name: 'Cliente' },
      payment: { provider: 'wompi' },
    },
  };
  const res = responseDouble();
  let nextCalls = 0;
  const middleware = createRequireAuthorizedOrderCart({
    CartModel: fakeCartModel(cart),
    getSecret: () => SECRET,
    canonicalValidationService: {
      async validateItems() {
        return {
          ok: true,
          items: [validatedItem],
          invalidItems: [],
        };
      },
    },
    resolvePaymentSelection: async () => ({
      config: { provider: 'wompi' },
      snapshot: {
        active: true,
        provider: 'wompi',
        mode: 'sandbox',
        currency: 'COP',
        status: 'pending_gateway',
      },
    }),
    now: () => new Date('2030-01-01T01:00:00.000Z'),
  });

  await middleware(req, res, () => {
    nextCalls += 1;
  });
  return { cart, req, res, nextCalls };
}

async function main() {
  const first = canonicalItem();
  const reordered = {
    ...canonicalItem(),
    variantAttributes: [...canonicalItem().variantAttributes].reverse(),
  };
  assert.equal(
    createOrderCartSnapshotFingerprint([first]),
    createOrderCartSnapshotFingerprint([reordered])
  );
  assert.notEqual(
    createOrderCartSnapshotFingerprint([first]),
    createOrderCartSnapshotFingerprint([canonicalItem({ quantity: 3, qty: 3 })])
  );
  assert.notEqual(
    createOrderCartSnapshotFingerprint([first]),
    createOrderCartSnapshotFingerprint([canonicalItem({ price: 125001 })])
  );
  ok('la huella es estable y cambia con cantidad o precio');

  const missingVersion = await runMiddleware({
    headers: { 'if-match-updated-at': '' },
  });
  assert.equal(missingVersion.res.statusCode, 428);
  assert.equal(missingVersion.res.body.error, 'CART_VERSION_REQUIRED');
  assert.equal(missingVersion.nextCalls, 0);
  ok('la creación exige una versión explícita del carrito');

  const missingSnapshot = await runMiddleware({
    headers: { 'x-cart-snapshot-fingerprint': '' },
  });
  assert.equal(missingSnapshot.res.statusCode, 428);
  assert.equal(missingSnapshot.res.body.error, 'CART_SNAPSHOT_REQUIRED');
  ok('la creación exige la huella emitida por la validación estricta');

  const stale = await runMiddleware({
    headers: { 'if-match-updated-at': '2029-12-31T23:59:59.999Z' },
  });
  assert.equal(stale.res.statusCode, 409);
  assert.equal(stale.res.body.error, 'CART_VERSION_CONFLICT');
  assert.equal(stale.nextCalls, 0);
  ok('una versión anterior se rechaza antes de crear efectos');

  const changedPrice = await runMiddleware({
    validatedItem: canonicalItem({ price: 130000 }),
  });
  assert.equal(changedPrice.res.statusCode, 409);
  assert.equal(changedPrice.res.body.error, 'CART_VERSION_CONFLICT');
  assert.equal(changedPrice.nextCalls, 0);
  ok('un cambio comercial invalida la huella aunque el carrito conserve fecha');

  const accepted = await runMiddleware();
  assert.equal(accepted.nextCalls, 1);
  assert.equal(accepted.req.body.cart[0].price, 125000);
  assert.equal(
    accepted.req.authorizedCartConversionAuthority.snapshotFingerprint,
    createOrderCartSnapshotFingerprint([canonicalItem()])
  );
  assert.equal(
    accepted.req.authorizedCartConversionAuthority.expectedUpdatedAt.toISOString(),
    VERSION.toISOString()
  );
  ok('la coincidencia exacta transporta autoridad privada a la transacción');

  assert.doesNotThrow(() =>
    assertOrderCartSnapshot(
      [canonicalItem()],
      accepted.req.authorizedCartConversionAuthority
    )
  );
  assert.throws(
    () =>
      assertOrderCartSnapshot(
        [canonicalItem({ quantity: 1, qty: 1 })],
        accepted.req.authorizedCartConversionAuthority
      ),
    (error) => error.code === 'CART_VERSION_CONFLICT'
  );
  ok('la transacción vuelve a comprobar la huella comercial');

  let capturedFilter = null;
  const CartModel = {
    updateOne(filter) {
      capturedFilter = filter;
      return Promise.resolve({ matchedCount: 1, modifiedCount: 1 });
    },
  };
  const conversion = await markCartConverted(
    {
      sessionId: accepted.cart.sessionId,
      orderId: ORDER_ID,
      authority: accepted.req.authorizedCartConversionAuthority,
    },
    { CartModel }
  );
  assert.equal(conversion.matchedCount, 1);
  assert.equal(String(capturedFilter._id), CART_ID);
  assert.equal(capturedFilter.updatedAt.toISOString(), VERSION.toISOString());
  assert.equal(capturedFilter.accessTokenHash, accepted.cart.accessTokenHash);
  assert.equal(capturedFilter.accessVersion, accepted.cart.accessVersion);
  assert.deepEqual(
    capturedFilter.items,
    accepted.req.authorizedCartConversionAuthority.items
  );
  ok('la conversión atómica compara documento, acceso, versión e items');

  const httpConflict = responseDouble();
  sendOrderCreationError(httpConflict, {
    code: 'CART_VERSION_CONFLICT',
    statusCode: 409,
  });
  assert.equal(httpConflict.statusCode, 409);
  assert.equal(httpConflict.body.error, 'CART_VERSION_CONFLICT');
  ok('el conflicto transaccional conserva una respuesta pública recuperable');

  console.log(`\nVersión carrito–orden: ${passed}/${passed} controles aprobados.`);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
