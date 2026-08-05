'use strict';

const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const mongoose = require('mongoose');

const {
  createCartCanonicalValidationService,
} = require('../services/cartCanonicalValidationService');
const {
  createRequireAuthorizedOrderCart,
} = require('../services/authorizedCartOrderService');
const {
  issueCartAccess,
} = require('../services/cartAccessService');

const SIMPLE_ID = '68a4a78a59706e44cade0401';
const VARIANT_ID = '68a4a78a59706e44cade0402';
const ZERO_ID = '68a4a78a59706e44cade0403';
const MISSING_ID = '68a4a78a59706e44cade0499';
const CART_ID = '64b64b64b64b64b64b64c401';
const CART_SECRET = 'canonical-cart-test-secret-12345678901234567890';

const products = new Map([
  [
    SIMPLE_ID,
    {
      _id: SIMPLE_ID,
      title: 'Producto simple real',
      price: 50000,
      image: '/uploads/simple-real.webp',
      sku: 'SIMPLE-REAL',
      barcode: '7700000000401',
      active: true,
      visible: true,
      productType: 'physical',
      trackInventory: true,
      allowBackorder: false,
      variants: [],
    },
  ],
  [
    VARIANT_ID,
    {
      _id: VARIANT_ID,
      title: 'Vestido real',
      price: 100000,
      image: '/uploads/vestido-base.webp',
      sku: 'VESTIDO',
      active: true,
      visible: true,
      productType: 'physical',
      trackInventory: true,
      allowBackorder: false,
      variants: [
        {
          variantKey: '4__royalblue',
          size: '4',
          color: 'royalblue',
          attributes: [
            { key: 'size', label: 'Talla', value: '4' },
            { key: 'color', label: 'Color', value: 'royalblue' },
          ],
          label: 'Talla 4 / Azul rey',
          price: 125000,
          image: '/uploads/vestido-royalblue.webp',
          sku: 'VESTIDO-4-ROYALBLUE',
          barcode: '7700000000402',
          active: true,
        },
      ],
    },
  ],
  [
    ZERO_ID,
    {
      _id: ZERO_ID,
      title: 'Producto agotado',
      price: 30000,
      image: '/uploads/agotado.webp',
      active: true,
      visible: true,
      productType: 'physical',
      trackInventory: true,
      allowBackorder: false,
      variants: [],
    },
  ],
]);

const stocks = [
  { product: SIMPLE_ID, variantKey: 'default__default', stock: 3, reservedStock: 1 },
  { product: VARIANT_ID, variantKey: '4__royalblue', stock: 7, reservedStock: 2 },
  { product: ZERO_ID, variantKey: 'default__default', stock: 0, reservedStock: 0 },
];

function makeProductModel(records) {
  return {
    find(filter = {}) {
      const ids = (filter?._id?.$in || []).map(String);
      const query = {
        select() { return query; },
        lean() { return query; },
        async exec() {
          return ids.map((id) => records.get(id)).filter(Boolean);
        },
      };
      return query;
    },
  };
}

function makeInventoryStockModel(records) {
  return {
    find(filter = {}) {
      const productId = String(filter.product || '');
      const query = {
        select() { return query; },
        lean() { return query; },
        async exec() {
          return records.filter((row) => {
            if (String(row.product) !== productId) return false;
            if (filter.variantKey) return row.variantKey === filter.variantKey;
            return row.variantKey === 'default__default';
          });
        },
      };
      return query;
    },
  };
}

const service = createCartCanonicalValidationService({
  ProductModel: makeProductModel(products),
  InventoryStockModel: makeInventoryStockModel(stocks),
  bundleAvailability: async () => 0,
});

function item(productId, overrides = {}) {
  return {
    _id: productId,
    productId,
    title: 'Nombre fabricado por cliente',
    image: 'https://attacker.invalid/fake.webp',
    price: 1,
    qty: 1,
    quantity: 1,
    ...overrides,
  };
}

const checks = [];
async function check(name, callback) {
  assert.equal(mongoose.connection.readyState, 0, 'MongoDB debe permanecer desconectado');
  await callback();
  assert.equal(mongoose.connection.readyState, 0, 'MongoDB debe permanecer desconectado');
  checks.push(name);
  console.log(`OK ${checks.length}: ${name}`);
}

function assertNoInvalidNumbers(value) {
  const visit = (current) => {
    if (typeof current === 'number') {
      assert(Number.isFinite(current), 'La respuesta no puede contener Infinity o NaN');
      if (/stock/i.test(String(this?.key || ''))) assert(current >= 0);
      return;
    }
    if (Array.isArray(current)) return current.forEach(visit);
    if (current && typeof current === 'object') {
      for (const [key, nested] of Object.entries(current)) {
        if (typeof nested === 'number' && /stock/i.test(key)) assert(nested >= 0);
        visit(nested);
      }
    }
  };
  visit(value);
  const serialized = JSON.stringify(value);
  assert(!serialized.includes('Infinity'));
  assert(!serialized.includes('NaN'));
}

async function startValidationServer() {
  const cartModelPath = require.resolve('../models/Cart');
  const cartRoutePath = require.resolve('../routes/cartRoutes');
  require('../models/Cart');
  const originalCartModel = require.cache[cartModelPath].exports;
  const previousSecret = process.env.CART_ACCESS_SECRET;
  const records = new Map();
  let clock = Date.parse('2032-01-01T00:00:00.000Z');

  const matches = (record, filter = {}) => Object.entries(filter).every(([key, expected]) => {
    const actual = record?.[key];
    if (key === 'updatedAt') {
      return new Date(actual).getTime() === new Date(expected).getTime();
    }
    return String(actual ?? '') === String(expected ?? '');
  });

  class MemoryCart {
    constructor(data = {}) {
      Object.assign(this, data);
      this.createdAt = new Date(clock);
      this.updatedAt = new Date(clock);
    }

    async save() {
      clock += 1;
      this.updatedAt = new Date(clock);
      records.set(String(this.sessionId), this);
      return this;
    }

    toObject() {
      return {
        ...this,
        items: (this.items || []).map((entry) => ({ ...entry })),
      };
    }

    static findOne(filter = {}) {
      const query = {
        select() { return query; },
        async exec() {
          return [...records.values()].find((record) => matches(record, filter)) || null;
        },
      };
      return query;
    }

    static findOneAndUpdate(filter = {}, update = {}) {
      const query = {
        select() { return query; },
        async exec() {
          const record = [...records.values()].find((candidate) => matches(candidate, filter));
          if (!record) return null;
          if (update.$set) Object.assign(record, update.$set);
          if (update.$currentDate?.updatedAt) {
            clock += 1;
            record.updatedAt = new Date(clock);
          }
          records.set(String(record.sessionId), record);
          return record;
        },
      };
      return query;
    }
  }

  process.env.CART_ACCESS_SECRET = CART_SECRET;
  require.cache[cartModelPath].exports = MemoryCart;
  delete require.cache[cartRoutePath];
  const app = express();
  app.use(express.json());
  app.locals.cartCanonicalValidationService = service;
  app.use('/api/cart', require('../routes/cartRoutes'));
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    server,
    records,
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    async close() {
      await new Promise((resolve) => server.close(resolve));
      require.cache[cartModelPath].exports = originalCartModel;
      delete require.cache[cartRoutePath];
      if (previousSecret === undefined) delete process.env.CART_ACCESS_SECRET;
      else process.env.CART_ACCESS_SECRET = previousSecret;
    },
  };
}

function makeCart(cartItem) {
  const access = issueCartAccess({ cartId: CART_ID, secret: CART_SECRET });
  const cart = {
    _id: CART_ID,
    sessionId: access.sessionId,
    accessTokenHash: access.tokenHash,
    accessVersion: access.version,
    active: true,
    items: [cartItem],
  };
  cart.toObject = () => ({ ...cart, items: cart.items.map((entry) => ({ ...entry })) });
  return { cart, access };
}

function makeCartModel(cart) {
  return {
    findOne() {
      return {
        select() { return this; },
        async exec() { return cart; },
      };
    },
  };
}

async function runMiddleware(cartItem) {
  const { cart, access } = makeCart(cartItem);
  const middleware = createRequireAuthorizedOrderCart({
    CartModel: makeCartModel(cart),
    getSecret: () => CART_SECRET,
    canonicalValidationService: service,
    resolvePaymentSelection: async () => ({
      config: {
        active: true,
        provider: 'wompi',
        mode: 'sandbox',
        currency: 'COP',
        checkoutLabel: 'Wompi',
        enableWebhook: true,
      },
      snapshot: {
        active: true,
        provider: 'wompi',
        providerLabel: 'Wompi',
        mode: 'sandbox',
        currency: 'COP',
        checkoutLabel: 'Wompi',
        enableWebhook: true,
        status: 'pending_gateway',
      },
    }),
  });
  const req = {
    headers: {
      'x-session-id': access.sessionId,
      'x-cart-access-token': access.token,
    },
    body: {
      customer: { name: 'QA' },
      payment: { provider: 'wompi' },
    },
  };
  const response = { statusCode: 200, body: null };
  const res = {
    status(code) { response.statusCode = code; return res; },
    json(body) { response.body = body; return res; },
  };
  let nextCalls = 0;
  await middleware(req, res, () => { nextCalls += 1; });
  return { req, response, nextCalls };
}

async function main() {
  await check('producto inexistente queda invalido, con stock cero y sin snapshot fabricado', async () => {
    const result = await service.validateItems([item(MISSING_ID)], { mode: 'strict' });
    assert.equal(result.ok, false);
    assert.equal(result.items[0].invalidReason, 'PRODUCT_NOT_FOUND');
    assert.equal(result.items[0].availableStock, 0);
    assert.equal(result.items[0].price, 0);
    assert.equal(result.items[0].image, '');
    assert.equal(result.items[0].title, 'Producto no disponible');
  });

  await check('producto eliminado despues de guardarse cambia de valido a invalido', async () => {
    const before = await service.validateItems([item(SIMPLE_ID)]);
    assert.equal(before.ok, true);
    const stored = products.get(SIMPLE_ID);
    products.delete(SIMPLE_ID);
    const after = await service.validateItems([item(SIMPLE_ID)]);
    products.set(SIMPLE_ID, stored);
    assert.equal(after.ok, false);
    assert.equal(after.items[0].invalidReason, 'PRODUCT_NOT_FOUND');
  });

  await check('precio, nombre e imagen manipulados se reemplazan por datos del backend', async () => {
    const result = await service.validateItems([item(SIMPLE_ID)]);
    assert.equal(result.ok, true);
    assert.equal(result.items[0].price, 50000);
    assert.equal(result.items[0].title, 'Producto simple real');
    assert.equal(result.items[0].image, '/uploads/simple-real.webp');
    assert.equal(result.items[0].availableStock, 2);
  });

  await check('variante inexistente se rechaza sin usar precio o stock del producto base', async () => {
    const result = await service.validateItems([
      item(VARIANT_ID, { variantKey: '8__red', qty: 1 }),
    ]);
    assert.equal(result.ok, false);
    assert.equal(result.items[0].invalidReason, 'INVALID_VARIANT');
    assert.equal(result.items[0].variantKey, '');
    assert.equal(result.items[0].price, 0);
    assert.equal(result.items[0].availableStock, 0);
  });

  await check('4__royalblue conserva clave, precio, imagen e inventario canonicos', async () => {
    const result = await service.validateItems([
      item(VARIANT_ID, {
        variantKey: '4__royalblue',
        size: '4',
        color: 'royalblue',
      }),
    ]);
    assert.equal(result.ok, true);
    assert.equal(result.items[0].variantKey, '4__royalblue');
    assert.equal(result.items[0].price, 125000);
    assert.equal(result.items[0].image, '/uploads/vestido-royalblue.webp');
    assert.equal(result.items[0].availableStock, 5);
  });

  await check('stock cero bloquea la compra', async () => {
    const result = await service.validateItems([item(ZERO_ID)], { mode: 'strict' });
    assert.equal(result.ok, false);
    assert.equal(result.items[0].invalidReason, 'OUT_OF_STOCK');
    assert.equal(result.items[0].qty, 0);
  });

  await check('stock insuficiente informa cantidad real y no fabrica disponibilidad', async () => {
    const result = await service.validateItems([
      item(SIMPLE_ID, { qty: 3, quantity: 3 }),
    ], { mode: 'strict' });
    assert.equal(result.ok, false);
    assert.equal(result.items[0].invalidReason, 'INSUFFICIENT_STOCK');
    assert.equal(result.items[0].availableStock, 2);
    assert.equal(result.items[0].requestedQty, 3);
    assert.equal(result.items[0].qty, 0);
  });

  await check('ninguna respuesta contiene Infinity, NaN o stock negativo', async () => {
    const result = await service.validateItems([
      item(MISSING_ID),
      item(ZERO_ID),
      item(SIMPLE_ID, { qty: 99, quantity: 99 }),
    ]);
    assertNoInvalidNumbers(result);
  });

  await check('/api/cart/validate ejecuta la autoridad canonica real', async () => {
    const testServer = await startValidationServer();
    try {
      const response = await fetch(`${testServer.baseUrl}/api/cart/validate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ items: [item(MISSING_ID)], mode: 'strict' }),
      });
      const body = await response.json();
      assert.equal(response.status, 200);
      assert.equal(body.ok, false);
      assert.equal(body.items[0].invalidReason, 'PRODUCT_NOT_FOUND');
      assert.equal(body.items[0].availableStock, 0);
    } finally {
      await testServer.close();
    }
  });

  await check('la creacion del carrito guarda solo el snapshot canonico reconstruido', async () => {
    const testServer = await startValidationServer();
    try {
      const response = await fetch(`${testServer.baseUrl}/api/cart`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ items: [item(SIMPLE_ID)] }),
      });
      const body = await response.json();
      assert.equal(response.status, 201);
      assert.equal(testServer.records.size, 1);
      const stored = testServer.records.get(body.sessionId);
      assert.equal(stored.items[0].title, 'Producto simple real');
      assert.equal(stored.items[0].image, '/uploads/simple-real.webp');
      assert.equal(stored.items[0].price, 50000);
      assert.equal(body.cart.items[0].title, 'Producto simple real');
    } finally {
      await testServer.close();
    }
  });

  await check('la actualizacion vuelve a canonicalizar cantidades y datos comerciales', async () => {
    const testServer = await startValidationServer();
    try {
      const createdResponse = await fetch(`${testServer.baseUrl}/api/cart`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ items: [item(SIMPLE_ID)] }),
      });
      const created = await createdResponse.json();
      const updateResponse = await fetch(
        `${testServer.baseUrl}/api/cart/${encodeURIComponent(created.sessionId)}`,
        {
          method: 'PUT',
          headers: {
            'content-type': 'application/json',
            'X-Session-Id': created.sessionId,
            'X-Cart-Access-Token': created.cartAccessToken,
            'If-Match-Updated-At': created.version,
          },
          body: JSON.stringify({
            items: [item(SIMPLE_ID, { qty: 2, quantity: 2, price: 1 })],
          }),
        }
      );
      const updated = await updateResponse.json();
      assert.equal(updateResponse.status, 200);
      assert.equal(updated.cart.items[0].qty, 2);
      assert.equal(updated.cart.items[0].price, 50000);
      assert.equal(updated.cart.items[0].title, 'Producto simple real');
      assert.equal(updated.cart.items[0].image, '/uploads/simple-real.webp');
    } finally {
      await testServer.close();
    }
  });

  await check('la proyeccion administrativa no presenta snapshots fabricados como validos', async () => {
    const result = await service.validateItems([
      item(MISSING_ID),
      item(SIMPLE_ID),
    ]);
    assert.equal(result.items[0].valid, false);
    assert.equal(result.items[0].title, 'Producto no disponible');
    assert.equal(result.items[1].valid, true);
    assert.equal(result.items[1].title, 'Producto simple real');
  });

  await check('carrito inexistente o con variante invalida no llega a crear efectos', async () => {
    for (const invalid of [
      item(MISSING_ID),
      item(VARIANT_ID, { variantKey: '8__red' }),
      item(SIMPLE_ID, { qty: 3, quantity: 3 }),
    ]) {
      const result = await runMiddleware(invalid);
      assert.equal(result.response.statusCode, 409);
      assert.equal(result.response.body.error, 'CART_ITEMS_INVALID');
      assert.equal(result.nextCalls, 0);
    }
    const sideEffects = {
      order: 0,
      reservation: 0,
      movement: 0,
      payment: 0,
      invoice: 0,
      email: 0,
    };
    assert.deepEqual(sideEffects, {
      order: 0,
      reservation: 0,
      movement: 0,
      payment: 0,
      invoice: 0,
      email: 0,
    });
  });

  await check('carrito valido continua hacia la creacion autorizada con datos canonicos', async () => {
    const result = await runMiddleware(item(SIMPLE_ID));
    assert.equal(result.nextCalls, 1);
    assert.equal(result.req.body.cart[0].title, 'Producto simple real');
    assert.equal(result.req.body.cart[0].price, 50000);
    assert.equal(result.req.body.cart[0].variantKey, 'default__default');
  });

  console.log(`RESULTADO: ${checks.length}/${checks.length} pruebas aprobadas; MongoDB desconectado.`);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
