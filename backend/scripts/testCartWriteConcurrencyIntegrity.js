'use strict';

const assert = require('node:assert/strict');
const express = require('express');
const mongoose = require('mongoose');

const SECRET = 'cart-concurrency-secret-123456789012345678901234567890';
const PRODUCT_A = '68a4a78a59706e44cade0316';
const PRODUCT_B = '68a4a78a59706e44cade0317';
const PRODUCT_C = '68a4a78a59706e44cade0318';

const checks = [];
async function check(name, callback) {
  assert.equal(mongoose.connection.readyState, 0, 'MongoDB debe permanecer desconectado');
  await callback();
  assert.equal(mongoose.connection.readyState, 0, 'MongoDB debe permanecer desconectado');
  checks.push(name);
  console.log(`OK ${checks.length}: ${name}`);
}

function item(productId, quantity = 1, variantKey = 'default__default') {
  return {
    productId,
    _id: productId,
    title: `Producto ${productId.slice(-2)}`,
    qty: quantity,
    quantity,
    price: 10000,
    size: variantKey === '4__royalblue' ? '4' : '',
    color: variantKey === '4__royalblue' ? 'royalblue' : '',
    variantId: variantKey,
    variantKey,
  };
}

function matches(record, filter = {}) {
  return Object.entries(filter).every(([key, expected]) => {
    const actual = record?.[key];
    if (key === 'updatedAt') {
      return new Date(actual).getTime() === new Date(expected).getTime();
    }
    return String(actual ?? '') === String(expected ?? '');
  });
}

async function main() {
  const cartModelPath = require.resolve('../models/Cart');
  const cartRoutePath = require.resolve('../routes/cartRoutes');
  require('../models/Cart');
  const originalCartModel = require.cache[cartModelPath].exports;
  const previousSecret = process.env.CART_ACCESS_SECRET;
  const records = new Map();
  let clock = Date.parse('2030-01-01T00:00:00.000Z');

  class MemoryCart {
    constructor(data = {}) {
      Object.assign(this, data);
      this.createdAt = this.createdAt || new Date(clock);
      this.updatedAt = this.updatedAt || new Date(clock);
    }

    toObject() {
      return {
        ...this,
        items: (this.items || []).map((entry) => ({ ...entry })),
      };
    }

    async save() {
      clock += 1;
      this.updatedAt = new Date(clock);
      records.set(String(this.sessionId), this);
      return this;
    }

    static findOne(filter = {}) {
      const query = {
        select() { return query; },
        lean() { return query; },
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
    app.locals.cartCanonicalValidationService = {
      async validateItems(items = [], { mode = 'soft' } = {}) {
        const canonicalItems = items.map((entry) => ({
          ...entry,
          productId: entry.productId || entry._id,
          valid: true,
          purchasable: true,
          availableStock: 999,
        }));
        return {
          ok: true,
          mode,
          items: canonicalItems,
          invalidItems: [],
          adjustments: [],
        };
      },
    };
    app.use('/api/cart', cartRouter);
    server = await new Promise((resolve) => {
      const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    });
    const base = `http://127.0.0.1:${server.address().port}/api/cart`;

    const request = async (path, { method = 'GET', headers = {}, body } = {}) => {
      const response = await fetch(`${base}${path}`, {
        method,
        headers: {
          'content-type': 'application/json',
          ...headers,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return { status: response.status, body: await response.json() };
    };

    const created = await request('', { method: 'POST', body: { items: [] } });
    assert.equal(created.status, 201);
    const sessionId = created.body.sessionId;
    const accessHeaders = {
      'X-Session-Id': sessionId,
      'X-Cart-Access-Token': created.body.cartAccessToken,
    };
    let version = created.body.version;

    await check('lectura y creacion entregan una version vigente', async () => {
      assert.equal(typeof version, 'string');
      const read = await request(`/${encodeURIComponent(sessionId)}`, {
        headers: accessHeaders,
      });
      assert.equal(read.status, 200);
      assert.equal(read.body.version, version);
    });

    await check('escritura con version actual es aprobada', async () => {
      const result = await request(`/${encodeURIComponent(sessionId)}`, {
        method: 'PUT',
        headers: { ...accessHeaders, 'If-Match-Updated-At': version },
        body: { items: [item(PRODUCT_A, 1, '4__royalblue')] },
      });
      assert.equal(result.status, 200);
      assert.notEqual(result.body.version, version);
      assert.equal(result.body.cart.items[0].variantKey, '4__royalblue');
      version = result.body.version;
    });

    await check('encabezado de version ausente es rechazado', async () => {
      const result = await request(`/${encodeURIComponent(sessionId)}`, {
        method: 'PUT',
        headers: accessHeaders,
        body: { items: [] },
      });
      assert.equal(result.status, 428);
      assert.equal(result.body.error, 'CART_VERSION_REQUIRED');
    });

    await check('encabezado de version invalido es rechazado', async () => {
      const result = await request(`/${encodeURIComponent(sessionId)}`, {
        method: 'PUT',
        headers: { ...accessHeaders, 'If-Match-Updated-At': 'ayer' },
        body: { items: [] },
      });
      assert.equal(result.status, 428);
      assert.equal(result.body.error, 'CART_VERSION_INVALID');
    });

    await check('dos clientes con la misma version aplican solamente la primera escritura', async () => {
      const sharedVersion = version;
      const first = await request(`/${encodeURIComponent(sessionId)}`, {
        method: 'PUT',
        headers: { ...accessHeaders, 'If-Match-Updated-At': sharedVersion },
        body: { items: [item(PRODUCT_A, 1, '4__royalblue'), item(PRODUCT_B)] },
      });
      const second = await request(`/${encodeURIComponent(sessionId)}`, {
        method: 'PUT',
        headers: { ...accessHeaders, 'If-Match-Updated-At': sharedVersion },
        body: { items: [item(PRODUCT_A, 1, '4__royalblue'), item(PRODUCT_C)] },
      });
      assert.equal(first.status, 200);
      assert.equal(second.status, 409);
      assert.equal(second.body.error, 'CART_WRITE_CONFLICT');
      assert.deepEqual(
        second.body.cart.items.map((entry) => String(entry.productId || entry._id)),
        [PRODUCT_A, PRODUCT_B]
      );
      version = first.body.version;
    });

    await check('la segunda escritura no sobrescribe la primera', async () => {
      const read = await request(`/${encodeURIComponent(sessionId)}`, { headers: accessHeaders });
      assert.equal(read.status, 200);
      assert.deepEqual(
        read.body.items.map((entry) => String(entry.productId || entry._id)),
        [PRODUCT_A, PRODUCT_B]
      );
      assert.equal(read.body.version, version);
    });

    await check('recarga y reintento conserva productos de ambas pestanas', async () => {
      const read = await request(`/${encodeURIComponent(sessionId)}`, { headers: accessHeaders });
      const merged = [...read.body.items, item(PRODUCT_C)];
      const retried = await request(`/${encodeURIComponent(sessionId)}`, {
        method: 'PUT',
        headers: { ...accessHeaders, 'If-Match-Updated-At': read.body.version },
        body: { items: merged },
      });
      assert.equal(retried.status, 200);
      assert.deepEqual(
        retried.body.cart.items.map((entry) => String(entry.productId || entry._id)),
        [PRODUCT_A, PRODUCT_B, PRODUCT_C]
      );
      version = retried.body.version;
    });

    await check('dos aumentos concurrentes terminan con cantidad acumulada correcta', async () => {
      const baseItems = [item(PRODUCT_A, 1, '4__royalblue')];
      let reset = await request(`/${encodeURIComponent(sessionId)}`, {
        method: 'PUT',
        headers: { ...accessHeaders, 'If-Match-Updated-At': version },
        body: { items: baseItems },
      });
      const sharedVersion = reset.body.version;
      const first = await request(`/${encodeURIComponent(sessionId)}`, {
        method: 'PUT',
        headers: { ...accessHeaders, 'If-Match-Updated-At': sharedVersion },
        body: { items: [item(PRODUCT_A, 2, '4__royalblue')] },
      });
      const conflicted = await request(`/${encodeURIComponent(sessionId)}`, {
        method: 'PUT',
        headers: { ...accessHeaders, 'If-Match-Updated-At': sharedVersion },
        body: { items: [item(PRODUCT_A, 2, '4__royalblue')] },
      });
      assert.equal(conflicted.status, 409);
      const currentQuantity = Number(conflicted.body.cart.items[0].qty);
      const retry = await request(`/${encodeURIComponent(sessionId)}`, {
        method: 'PUT',
        headers: { ...accessHeaders, 'If-Match-Updated-At': conflicted.body.version },
        body: { items: [item(PRODUCT_A, currentQuantity + 1, '4__royalblue')] },
      });
      assert.equal(first.status, 200);
      assert.equal(retry.status, 200);
      assert.equal(Number(retry.body.cart.items[0].qty), 3);
      assert.equal(retry.body.cart.items[0].variantKey, '4__royalblue');
      version = retry.body.version;
    });

    await check('credenciales incorrectas no revelan version ni carrito', async () => {
      const result = await request(`/${encodeURIComponent(sessionId)}`, {
        method: 'PUT',
        headers: {
          'X-Session-Id': sessionId,
          'X-Cart-Access-Token': `ct1_${'x'.repeat(43)}`,
        },
        body: { items: [] },
      });
      assert.equal(result.status, 404);
      assert.equal(result.body.error, 'CART_ACCESS_NOT_FOUND');
      assert.equal(result.body.version, undefined);
      assert.equal(result.body.cart, undefined);
    });

    await check('eliminacion tambien exige y compara la version atomicamente', async () => {
      const missing = await request(`/${encodeURIComponent(sessionId)}`, {
        method: 'DELETE',
        headers: accessHeaders,
      });
      assert.equal(missing.status, 428);
      const stale = await request(`/${encodeURIComponent(sessionId)}`, {
        method: 'DELETE',
        headers: { ...accessHeaders, 'If-Match-Updated-At': '2030-01-01T00:00:00.000Z' },
      });
      assert.equal(stale.status, 409);
      const stillThere = await request(`/${encodeURIComponent(sessionId)}`, { headers: accessHeaders });
      assert.equal(stillThere.status, 200);
    });

    await check('las pruebas de carrito no crean orden, reserva, pago ni factura', async () => {
      assert.equal(records.size, 1);
      assert.equal(mongoose.connection.readyState, 0);
    });
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    require.cache[cartModelPath].exports = originalCartModel;
    delete require.cache[cartRoutePath];
    if (previousSecret === undefined) delete process.env.CART_ACCESS_SECRET;
    else process.env.CART_ACCESS_SECRET = previousSecret;
  }

  console.log(`\nRESULTADO: ${checks.length}/${checks.length} pruebas aprobadas.`);
  console.log('MongoDB permanecio desconectado; no se contactaron servicios externos.');
}

main().catch((error) => {
  console.error(error?.stack || error?.message || error);
  process.exitCode = 1;
});
