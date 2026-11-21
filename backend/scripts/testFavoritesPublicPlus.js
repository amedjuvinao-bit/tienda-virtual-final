'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  writeFavoriteList,
  favoriteRevision,
} = require('../services/favoriteWriteService');
const {
  canonicalizeFavoriteItems,
  buildFavoriteDetail,
} = require('../services/favoriteOperationsService');
const copy = (value) =>
  value == null ? value : JSON.parse(JSON.stringify(value));
const query = (value) => ({
  select() {
    return this;
  },
  lean() {
    return this;
  },
  exec: async () => copy(value),
});
const a = {
  productId: '68a4a78a59706e44cade0316',
  variantKey: 'default__default',
  title: 'A',
  price: 100,
};
const b = { ...a, productId: '68a4a78a59706e44cade0317', title: 'B' };
function database(initial) {
  let value = copy(initial),
    sequence = 1;
  const matches = (filter) =>
    value &&
    Object.entries(filter).every(
      ([key, v]) => String(value[key]) === String(v)
    );
  return {
    findOne: () => query(value),
    async create(doc) {
      if (value) throw { code: 11000 };
      value = { ...copy(doc), _id: `doc-${++sequence}`, __v: 0 };
      return copy(value);
    },
    findOneAndUpdate(filter, update) {
      return {
        exec: async () => {
          if (!matches(filter)) return null;
          value = { ...value, ...copy(update.$set), __v: value.__v + 1 };
          return copy(value);
        },
      };
    },
    deleteOne(filter) {
      return {
        exec: async () => {
          if (!matches(filter)) return { deletedCount: 0 };
          value = null;
          return { deletedCount: 1 };
        },
      };
    },
    current: () => copy(value),
  };
}
const canonicalize = async (items) => items;
test('CAS rejects a delayed writer after another tab saves', async () => {
  const db = database({ _id: 'doc', sessionId: 'session', __v: 0, items: [a] });
  const results = await Promise.allSettled([
    writeFavoriteList(
      { sessionId: 'session', items: [a, b], revision: 'doc:0' },
      { FavoriteModel: db, canonicalize }
    ),
    writeFavoriteList(
      { sessionId: 'session', items: [], revision: 'doc:0' },
      { FavoriteModel: db, canonicalize }
    ),
  ]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(
    results.find((r) => r.status === 'rejected').reason.code,
    'FAVORITE_WRITE_CONFLICT'
  );
  assert.equal(db.current().items.length, 2);
});
test('two first writers cannot create duplicate sessions or overwrite each other', async () => {
  const db = database(null);
  const results = await Promise.allSettled(
    [a, b].map((item) =>
      writeFavoriteList(
        { sessionId: 'session', items: [item], revision: null },
        { FavoriteModel: db, canonicalize }
      )
    )
  );
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(results.find((r) => r.status === 'rejected').reason.status, 409);
});
test('deletion and recreation never reuse a stale revision', async () => {
  const db = database({ _id: 'doc', sessionId: 'session', __v: 0, items: [a] });
  await writeFavoriteList(
    { sessionId: 'session', items: [], revision: 'doc:0' },
    { FavoriteModel: db, canonicalize }
  );
  const created = await writeFavoriteList(
    { sessionId: 'session', items: [b], revision: null },
    { FavoriteModel: db, canonicalize }
  );
  assert.notEqual(favoriteRevision(created), 'doc:0');
  await assert.rejects(
    writeFavoriteList(
      { sessionId: 'session', items: [a], revision: 'doc:0' },
      { FavoriteModel: db, canonicalize }
    ),
    { code: 'FAVORITE_WRITE_CONFLICT' }
  );
});
test('missing revision and oversized lists fail before database writes', async () => {
  const db = database(null);
  await assert.rejects(
    writeFavoriteList(
      { sessionId: 's', items: [] },
      { FavoriteModel: db, canonicalize }
    ),
    { status: 428 }
  );
  await assert.rejects(
    writeFavoriteList(
      { sessionId: 's', items: Array(201).fill(a), revision: null },
      { FavoriteModel: db, canonicalize }
    ),
    { status: 400 }
  );
  assert.equal(db.current(), null);
});
test('keeps an existing discontinued product, but never accepts a new fabricated snapshot', async () => {
  const items = await canonicalizeFavoriteItems([a, b], {
    ProductModel: { find: () => query([]) },
    previousItems: [a],
  });
  assert.deepEqual(items, [a]);
});
test('a product favorite without a variant remains valid and asks for options', async () => {
  const product = {
    _id: a.productId,
    title: 'Producto configurable',
    price: 125,
    image: '/real.webp',
    variants: [{ variantKey: 'm__red', size: 'm', color: 'red', active: true }],
  };
  const ProductModel = { find: () => query([product]) };
  const canonical = await canonicalizeFavoriteItems([a], { ProductModel });
  assert.equal(canonical.length, 1);
  assert.equal(canonical[0].variantKey, 'default__default');
  const detail = await buildFavoriteDetail(
    { items: canonical },
    {
      ProductModel,
      canonicalValidationService: {
        validateItems: async () => ({
          items: [{ valid: false, invalidReason: 'INVALID_VARIANT' }],
        }),
      },
    }
  );
  assert.equal(detail.items[0].current.requiresSelection, true);
  assert.equal(detail.items[0].current.price, 125);
  assert.equal(detail.items[0].current.image, '/real.webp');
});

test('HTTP owner routes distinguish an empty list from invalid credentials and reject stale writes', async () => {
  const express = require('express');
  const Favorite = require('../models/Favorite');
  const Product = require('../models/Product');
  const operations = require('../services/favoriteOperationsService');
  const previousSecret = process.env.FAVORITE_ACCESS_SECRET;
  process.env.FAVORITE_ACCESS_SECRET =
    'favorites-public-plus-test-secret-1234567890123456789';
  const original = {
    findOne: Favorite.findOne,
    findOneAndUpdate: Favorite.findOneAndUpdate,
    create: Favorite.create,
    deleteOne: Favorite.deleteOne,
    find: Product.find,
    detail: operations.buildFavoriteDetail,
  };
  let db = database(null);
  Favorite.findOne = (...args) => db.findOne(...args);
  Favorite.findOneAndUpdate = (...args) => db.findOneAndUpdate(...args);
  Favorite.create = (...args) => db.create(...args);
  Favorite.deleteOne = (...args) => db.deleteOne(...args);
  Product.find = () =>
    query([
      {
        _id: a.productId,
        title: 'Oficial',
        price: 120,
        variants: [],
        active: true,
        visible: true,
      },
    ]);
  operations.buildFavoriteDetail = async (row) => ({
    ...row,
    items: row.items,
  });
  delete require.cache[require.resolve('../routes/favoriteRoutes')];
  const app = express();
  app.use(express.json());
  app.use('/api/favorites', require('../routes/favoriteRoutes'));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/favorites`;
  try {
    const issued = await (
      await fetch(base + '/access', { method: 'POST' })
    ).json();
    const headers = {
      'Content-Type': 'application/json',
      'X-Favorite-Session-Id': issued.sessionId,
      'X-Favorite-Access-Token': issued.favoriteAccessToken,
    };
    let res = await fetch(base + '/' + issued.sessionId, { headers });
    assert.equal(res.status, 200);
    assert.equal((await res.json()).revision, null);
    res = await fetch(base + '/' + issued.sessionId);
    assert.equal(res.status, 404);
    const anonymous = await res.json();
    res = await fetch(base + '/' + issued.sessionId, {
      headers: { ...headers, 'X-Favorite-Access-Token': 'tampered' },
    });
    assert.equal(res.status, 404);
    assert.deepEqual(await res.json(), anonymous);
    res = await fetch(base + '/' + issued.sessionId, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ items: [a] }),
    });
    assert.equal(res.status, 428);
    res = await fetch(base + '/' + issued.sessionId, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ items: [{ ...a, price: 1 }], revision: null }),
    });
    assert.equal(res.status, 200);
    const saved = (await res.json()).favorites;
    assert.equal(saved.items[0].price, 120);
    assert.match(saved.revision, /doc-/);
    res = await fetch(base + '/' + issued.sessionId, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ items: [], revision: null }),
    });
    assert.equal(res.status, 409);
    assert.equal(db.current().items.length, 1);
    res = await fetch(base + '/' + issued.sessionId, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ items: [], revision: saved.revision }),
    });
    assert.equal(res.status, 200);
    assert.equal(db.current(), null);
    res = await fetch(base + '/' + issued.sessionId, { headers });
    assert.equal(res.status, 200);
    assert.deepEqual((await res.json()).items, []);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    Object.assign(Favorite, {
      findOne: original.findOne,
      findOneAndUpdate: original.findOneAndUpdate,
      create: original.create,
      deleteOne: original.deleteOne,
    });
    Product.find = original.find;
    operations.buildFavoriteDetail = original.detail;
    if (previousSecret === undefined) delete process.env.FAVORITE_ACCESS_SECRET;
    else process.env.FAVORITE_ACCESS_SECRET = previousSecret;
    delete require.cache[require.resolve('../routes/favoriteRoutes')];
  }
});
