'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');
const express = require('express');

const Cart = require('../models/Cart');
const {
  SAFE_CART_ACCESS_ERROR,
  getCartAccessFromRequest,
  getCartAccessSecret,
  hashCartAccessToken,
  issueCartAccess,
  rotateCartAccess,
  stripCartSecrets,
  verifyCartAccess,
} = require('../services/cartAccessService');
const {
  createGuestOrderAccessToken,
} = require('../services/publicPaymentAccessService');
const {
  readCheckoutComposition,
} = require('./lib/readCheckoutComposition');

const SECRET = 'cart-access-test-secret-only-12345678901234567890';
const CART_A_ID = '64b64b64b64b64b64b64c001';
const CART_B_ID = '64b64b64b64b64b64b64c002';
const ORDER_ID = '64b64b64b64b64b64b64d001';
const PRODUCT_ID = '68a4a78a59706e44cade0316';

const routeSource = fs.readFileSync(
  path.join(__dirname, '..', 'routes', 'cartRoutes.js'),
  'utf8'
);
const cartContextSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'frontend', 'src', 'context', 'CartContext.jsx'),
  'utf8'
);
const checkoutSource = readCheckoutComposition();
const frontendAccessSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'frontend', 'src', 'utils', 'cartAccess.js'),
  'utf8'
);
const sessionSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'frontend', 'src', 'utils', 'getSessionId.js'),
  'utf8'
);

const checks = [];
async function check(name, callback) {
  assert.equal(mongoose.connection.readyState, 0, 'MongoDB debe permanecer desconectado');
  await callback();
  assert.equal(mongoose.connection.readyState, 0, 'MongoDB debe permanecer desconectado');
  checks.push(name);
  console.log(`OK ${checks.length}: ${name}`);
}

function cartRecord(id, access, overrides = {}) {
  return {
    _id: id,
    sessionId: access.sessionId,
    accessTokenHash: access.tokenHash,
    accessVersion: access.version,
    items: [],
    ...overrides,
  };
}

function routeSlice(method, route, nextMarker) {
  const start = routeSource.indexOf(`router.${method}('${route}'`);
  assert(start >= 0, `${method.toUpperCase()} ${route} no existe`);
  const end = nextMarker ? routeSource.indexOf(nextMarker, start + 1) : routeSource.length;
  return routeSource.slice(start, end > start ? end : routeSource.length);
}

async function runHttpRouteContract() {
  const cartModelPath = require.resolve('../models/Cart');
  const cartRoutePath = require.resolve('../routes/cartRoutes');
  const originalCartExports = require.cache[cartModelPath].exports;
  const previousSecret = process.env.CART_ACCESS_SECRET;
  const records = new Map();
  let memoryClock = Date.parse('2031-01-01T00:00:00.000Z');

  const matches = (record, filter = {}) => Object.entries(filter).every(([key, expected]) => {
    if (key === 'updatedAt') {
      return new Date(record?.updatedAt).getTime() === new Date(expected).getTime();
    }
    return String(record?.[key] ?? '') === String(expected ?? '');
  });

  class MemoryCart {
    constructor(data = {}) {
      Object.assign(this, data);
      this.createdAt = this.createdAt || new Date(memoryClock);
      this.updatedAt = this.updatedAt || new Date(memoryClock);
    }

    async save() {
      memoryClock += 1;
      this.updatedAt = new Date(memoryClock);
      records.set(String(this.sessionId), this);
      return this;
    }

    toObject() {
      return { ...this };
    }

    static findOne(filter = {}) {
      const query = {
        select() { return query; },
        lean() { return query; },
        exec: async () => [...records.values()].find((record) => matches(record, filter)) || null,
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
          memoryClock += 1;
          record.updatedAt = new Date(memoryClock);
          return record;
        },
      };
      return query;
    }

    static async findOneAndDelete(filter = {}) {
      const entry = [...records.entries()].find(([, record]) => matches(record, filter));
      if (!entry) return null;
      records.delete(entry[0]);
      return entry[1];
    }
  }

  let server;
  try {
    process.env.CART_ACCESS_SECRET = SECRET;
    require.cache[cartModelPath].exports = MemoryCart;
    delete require.cache[cartRoutePath];
    const cartRouter = require('../routes/cartRoutes');
    const app = express();
    app.use(express.json());
    app.use('/api/cart', cartRouter);
    server = await new Promise((resolve) => {
      const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    });
    const address = server.address();
    const base = `http://127.0.0.1:${address.port}/api/cart`;
    const request = async (url, options = {}) => {
      const response = await fetch(`${base}${url}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
      });
      return { status: response.status, body: await response.json() };
    };

    const created = await request('', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'elegido-por-cliente', items: [] }),
    });
    assert.equal(created.status, 201);
    assert.notEqual(created.body.sessionId, 'elegido-por-cliente');
    assert(created.body.cartAccessToken);
    assert(!JSON.stringify(created.body.cart).includes('accessTokenHash'));

    const sessionId = created.body.sessionId;
    const token = created.body.cartAccessToken;
    const safeHeaders = {
      'X-Session-Id': sessionId,
      'X-Cart-Access-Token': token,
    };
    const deniedVariants = [
      await request(`/${encodeURIComponent(sessionId)}`),
      await request(`/${encodeURIComponent(sessionId)}`, {
        headers: { 'X-Session-Id': sessionId },
      }),
      await request(`/${encodeURIComponent(sessionId)}`, {
        headers: { 'X-Cart-Access-Token': token },
      }),
      await request(`/${encodeURIComponent(sessionId)}`, {
        headers: { ...safeHeaders, 'X-Cart-Access-Token': 'ct1_invalidinvalidinvalidinvalidinvalidinvalidinvalid' },
      }),
      await request('/cart_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', {
        headers: safeHeaders,
      }),
    ];
    for (const denied of deniedVariants) {
      assert.equal(denied.status, 404);
      assert.deepEqual(denied.body, SAFE_CART_ACCESS_ERROR);
    }

    const read = await request(`/${encodeURIComponent(sessionId)}`, { headers: safeHeaders });
    assert.equal(read.status, 200);
    const updated = await request(`/${encodeURIComponent(sessionId)}`, {
      method: 'PUT',
      headers: {
        ...safeHeaders,
        'If-Match-Updated-At': read.body.version,
      },
      body: JSON.stringify({ items: [] }),
    });
    assert.equal(updated.status, 200);
    records.get(sessionId).items = [{ productId: PRODUCT_ID, qty: 1 }];
    const refreshed = await request(`/${encodeURIComponent(sessionId)}/access/refresh`, {
      method: 'POST',
      headers: safeHeaders,
    });
    assert.equal(refreshed.status, 200);
    assert.equal(refreshed.body.sessionId, sessionId);
    assert.notEqual(refreshed.body.cartAccessToken, token);
    const refreshedHeaders = {
      'X-Session-Id': sessionId,
      'X-Cart-Access-Token': refreshed.body.cartAccessToken,
    };
    const deniedOldToken = await request(`/${encodeURIComponent(sessionId)}`, {
      headers: safeHeaders,
    });
    assert.equal(deniedOldToken.status, 404);
    const deniedDelete = await request(`/${encodeURIComponent(sessionId)}`, {
      method: 'DELETE',
      headers: { 'X-Session-Id': sessionId },
    });
    assert.equal(deniedDelete.status, 404);
    const deleted = await request(`/${encodeURIComponent(sessionId)}`, {
      method: 'DELETE',
      headers: {
        ...refreshedHeaders,
        'If-Match-Updated-At': refreshed.body.version,
      },
    });
    assert.equal(deleted.status, 200);
    const afterDelete = await request(`/${encodeURIComponent(sessionId)}`, { headers: refreshedHeaders });
    assert.equal(afterDelete.status, 404);
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    require.cache[cartModelPath].exports = originalCartExports;
    delete require.cache[cartRoutePath];
    if (previousSecret === undefined) delete process.env.CART_ACCESS_SECRET;
    else process.env.CART_ACCESS_SECRET = previousSecret;
  }
}

async function main() {
  assert.equal(mongoose.connection.readyState, 0);

  const cartA = issueCartAccess({ cartId: CART_A_ID, secret: SECRET });
  const cartB = issueCartAccess({ cartId: CART_B_ID, secret: SECRET });
  const recordA = cartRecord(CART_A_ID, cartA);
  const recordB = cartRecord(CART_B_ID, cartB);

  await check('creación legítima emite una sola credencial y sesión generada por servidor', () => {
    assert.match(cartA.sessionId, /^cart_[A-Za-z0-9_-]{32,100}$/);
    assert.match(cartA.token, /^ct1_[A-Za-z0-9_-]{40,100}$/);
    assert.notEqual(cartA.sessionId, cartB.sessionId);
    assert.notEqual(cartA.token, cartB.token);
    const create = routeSlice('post', '/', "router.get('/admin'");
    assert(create.includes('new mongoose.Types.ObjectId()'));
    assert(create.includes('issueCartAccess({'));
    assert(!create.includes('findOne({ sessionId'));
    assert(!create.includes('req.body.sessionId'));
    assert.equal((routeSource.match(/cartAccessToken: access\.token/g) || []).length, 2);
    assert.throws(
      () => getCartAccessSecret({ NODE_ENV: 'production', JWT_SECRET: SECRET }),
      /CART_ACCESS_SECRET/
    );
    assert.equal(
      getCartAccessSecret({ NODE_ENV: 'production', CART_ACCESS_SECRET: SECRET }),
      SECRET
    );
  });

  await check('propietario invitado accede con sesión y token conjuntos', () => {
    assert.equal(
      verifyCartAccess({
        cart: recordA,
        sessionId: cartA.sessionId,
        token: cartA.token,
        secret: SECRET,
      }),
      true
    );
    assert.deepEqual(
      getCartAccessFromRequest({
        headers: {
          'x-session-id': cartA.sessionId,
          'x-cart-access-token': cartA.token,
        },
      }),
      { sessionId: cartA.sessionId, token: cartA.token }
    );
  });

  await check('sessionId aislado y token aislado no conceden acceso', () => {
    assert.equal(
      verifyCartAccess({ cart: recordA, sessionId: cartA.sessionId, secret: SECRET }),
      false
    );
    assert.equal(
      verifyCartAccess({ cart: recordA, token: cartA.token, secret: SECRET }),
      false
    );
  });

  await check('token de otro carrito es rechazado criptográficamente', () => {
    assert.equal(
      verifyCartAccess({
        cart: recordA,
        sessionId: cartA.sessionId,
        token: cartB.token,
        secret: SECRET,
      }),
      false
    );
    assert.equal(
      hashCartAccessToken({
        cartId: CART_A_ID,
        sessionId: cartA.sessionId,
        token: cartA.token,
        secret: SECRET,
      }),
      cartA.tokenHash
    );
  });

  await check('lectura, modificación, validación, renovación y eliminación comparten autorización', () => {
    const sections = [
      routeSlice('get', '/:sessionId', "router.put('/:sessionId'"),
      routeSlice('put', '/:sessionId', "router.delete('/:sessionId'"),
      routeSlice('delete', '/:sessionId', "router.post('/validate'"),
      routeSlice('post', '/validate', "router.post('/:sessionId/access/refresh'"),
      routeSlice('post', '/:sessionId/access/refresh', "router.post('/merge'"),
    ];
    for (const section of sections) {
      assert(section.includes('rateLimit'));
      assert(section.includes('loadAuthorizedCart(req, sessionId)'));
      assert(section.includes('sendCartAccessNotFound(res)'));
    }
    assert(!sections[1].includes('upsert: true'));
    assert(sections[4].includes('rotateCartAccess({'));
    assert(sections[4].includes('cart.convertedOrderId'));
  });

  await check('renovación conserva la sesión e invalida el token anterior', () => {
    const rotated = rotateCartAccess({
      cartId: CART_A_ID,
      sessionId: cartA.sessionId,
      secret: SECRET,
    });
    const rotatedRecord = cartRecord(CART_A_ID, rotated);
    assert.equal(rotated.sessionId, cartA.sessionId);
    assert.notEqual(rotated.token, cartA.token);
    assert.equal(
      verifyCartAccess({
        cart: rotatedRecord,
        sessionId: cartA.sessionId,
        token: cartA.token,
        secret: SECRET,
      }),
      false
    );
    assert.equal(
      verifyCartAccess({
        cart: rotatedRecord,
        sessionId: rotated.sessionId,
        token: rotated.token,
        secret: SECRET,
      }),
      true
    );
  });

  await check('no existe reemisión por id o sessionId para carritos existentes', () => {
    const postCreateEnd = routeSource.indexOf("router.get('/admin'");
    assert.equal(routeSource.indexOf('issueCartAccess({', postCreateEnd), -1);
    const merge = routeSlice('post', '/merge');
    assert(merge.includes('return sendCartAccessNotFound(res)'));
    assert(!merge.includes('Cart.findOne'));
  });

  await check('carrito ajeno, inexistente y credencial inválida son indistinguibles', () => {
    const results = [
      verifyCartAccess({ cart: recordB, sessionId: cartA.sessionId, token: cartA.token, secret: SECRET }),
      verifyCartAccess({ cart: null, sessionId: cartA.sessionId, token: cartA.token, secret: SECRET }),
      verifyCartAccess({ cart: recordA, sessionId: cartA.sessionId, token: 'invalido', secret: SECRET }),
    ];
    assert.deepEqual(results, [false, false, false]);
    assert.deepEqual(SAFE_CART_ACCESS_ERROR, {
      ok: false,
      error: 'CART_ACCESS_NOT_FOUND',
      message: 'No fue posible acceder al carrito solicitado.',
    });
  });

  await check('hash, respuestas y registros no exponen token ni datos personales', () => {
    const safe = stripCartSecrets({
      ...recordA,
      cartAccessToken: cartA.token,
      userEmail: 'persona@example.test',
    });
    assert(!JSON.stringify(safe).includes(cartA.token));
    assert(!Object.hasOwn(safe, 'accessTokenHash'));
    assert.equal(recordA.accessTokenHash.length, 64);
    assert(!routeSource.includes("console.log(req.body"));
    assert(!routeSource.includes("console.error(req.body"));
    assert(!routeSource.includes("console.log(req.headers"));
    assert(frontendAccessSource.includes("sessionStorage.setItem(CART_ACCESS_TOKEN_KEY"));
    assert(!frontendAccessSource.includes('localStorage.setItem(CART_ACCESS_TOKEN_KEY'));
    assert(frontendAccessSource.includes('preserveSessionId'));
  });

  await check('carrito conserva la variante canónica 4__royalblue', async () => {
    const doc = new Cart({
      _id: CART_A_ID,
      sessionId: cartA.sessionId,
      accessTokenHash: cartA.tokenHash,
      accessVersion: 1,
      items: [{
        _id: PRODUCT_ID,
        qty: 1,
        size: '4',
        color: 'royalblue',
        variantId: '4__royalblue',
        variantKey: '4__royalblue',
      }],
    });
    await doc.validate();
    assert.equal(doc.items[0].variantKey, '4__royalblue');
    assert.equal(doc.items[0].variantId, '4__royalblue');
  });

  await check('checkout y creación de orden usan el carrito legítimo sin mezclar credenciales', () => {
    assert(cartContextSource.includes(".post('/api/cart', { items })"));
    assert(cartContextSource.includes('ensureCartReady'));
    assert(checkoutSource.includes('await ensureCartReady()'));
    assert(checkoutSource.includes("validateCart('strict')"));
    assert(checkoutSource.includes('createOrderFromAuthorizedCart({'));
    assert(checkoutSource.includes('cartAccess,'));
    assert(!checkoutSource.includes("'X-Order-Access-Token': cartAccess"));
  });

  await check('credenciales de carrito y orden son incompatibles y están separadas', () => {
    const orderToken = createGuestOrderAccessToken({
      orderId: ORDER_ID,
      sessionId: cartA.sessionId,
      secret: SECRET,
      now: 1_800_000_000_000,
    });
    assert.equal(
      verifyCartAccess({
        cart: recordA,
        sessionId: cartA.sessionId,
        token: orderToken,
        secret: SECRET,
      }),
      false
    );
    assert(frontendAccessSource.includes("'X-Cart-Access-Token'"));
    assert(!frontendAccessSource.includes('X-Order-Access-Token'));
  });

  await check('identificadores heredados no se regeneran y el limitador cubre rutas públicas', () => {
    assert(!sessionSource.includes('Math.random'));
    assert(!sessionSource.includes("'sess_'"));
    assert(routeSource.includes("router.post('/', rateLimit"));
    assert(routeSource.includes("router.get('/:sessionId', rateLimit"));
    assert(routeSource.includes("router.put('/:sessionId', rateLimit"));
    assert(routeSource.includes("router.delete('/:sessionId', rateLimit"));
    assert(routeSource.includes("router.post('/validate', rateLimit"));
  });

  await check('contrato HTTP real protege crear, leer, modificar y eliminar sin MongoDB', async () => {
    await runHttpRouteContract();
  });

  console.log(`\nRESULTADO: ${checks.length}/${checks.length} pruebas aprobadas.`);
  console.log('MongoDB readyState:', mongoose.connection.readyState);
}

main().catch((error) => {
  console.error('FALLO testCartAccessIntegrity:', error.message);
  process.exitCode = 1;
});
