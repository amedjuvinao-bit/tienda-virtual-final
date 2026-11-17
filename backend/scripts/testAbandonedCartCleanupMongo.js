'use strict';

const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const mongoose = require('mongoose');
const { env } = require('../config/env');
const Cart = require('../models/Cart');
const Order = require('../models/Order');
const {
  RETENTION_DAYS,
  buildCartRetentionPreview,
  buildEligibleCartPipeline,
} = require('./previewAbandonedCartRetention');
const {
  cleanupEligibleCarts,
  deleteEligibleCart,
} = require('./cleanupAbandonedCarts');

async function testCartCleanup({ client, carts, orders }) {
  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;
  const expired = new Date(now.getTime() - (RETENTION_DAYS + 1) * dayMs);
  const future = new Date(now.getTime() + dayMs);
  const fixtures = [
    ['vencido', {}],
    ['reciente', { lastCustomerActivityAt: now }],
    ['convertido', { convertedOrderId: new mongoose.Types.ObjectId() }],
    ['pedido-existente', {}],
    ['enlace-vigente', { recoveryAccess: { expiresAt: future } }],
    ['recuperacion-en-curso', { recoveryEmailLockUntil: future }],
    ['reactivado-despues', {}],
    ['pedido-nuevo', {}],
    ['enlace-nuevo', {}],
  ];

  await carts.insertMany(fixtures.map(([sessionId, fields]) => ({
    sessionId,
    items: [{ qty: 1 }],
    lastCustomerActivityAt: expired,
    ...fields,
  })));
  await orders.insertOne({ sessionId: 'pedido-existente' });

  const [preview] = await carts.aggregate(
    buildCartRetentionPreview(now, orders.collectionName)
  ).toArray();
  assert.equal(preview?.eligibleCarts, 4);

  const candidates = await carts.aggregate(
    buildEligibleCartPipeline(now, orders.collectionName)
  ).toArray();
  const expectedInitial = ['enlace-nuevo', 'pedido-nuevo', 'reactivado-despues', 'vencido'];
  assert.deepEqual(candidates.map(({ sessionId }) => sessionId).sort(), expectedInitial);
  console.log('OK 01 La simulación identifica los cuatro carritos elegibles en MongoDB.');

  await carts.updateOne({ sessionId: 'reactivado-despues' }, {
    $set: { lastCustomerActivityAt: now },
  });
  await orders.insertOne({ sessionId: 'pedido-nuevo' });
  await carts.updateOne({ sessionId: 'enlace-nuevo' }, {
    $set: { recoveryAccess: { expiresAt: future } },
  });

  await client.withSession(async (session) => {
    for (const candidate of candidates.filter(({ sessionId }) => sessionId !== 'vencido')) {
      const deleted = await deleteEligibleCart(candidate, { carts, orders, session });
      assert.equal(deleted, 0, candidate.sessionId);
    }
  });
  console.log('OK 02 Una reactivación, un pedido o un enlace posterior impiden el borrado.');

  const report = { checkedCarts: 0, deletedCarts: 0 };
  await cleanupEligibleCarts({ client, carts, orders, report });
  assert.deepEqual(report, { checkedCarts: 1, deletedCarts: 1 });
  const remaining = await carts.find({}, { projection: { sessionId: 1 } }).toArray();
  assert.deepEqual(
    remaining.map(({ sessionId }) => sessionId).sort(),
    fixtures.map(([sessionId]) => sessionId).filter((id) => id !== 'vencido').sort()
  );
  assert.equal(await orders.countDocuments(), 2);
  console.log('OK 03 La limpieza borra un carrito y conserva los demás carritos y pedidos.');

  const repeated = { checkedCarts: 0, deletedCarts: 0 };
  await cleanupEligibleCarts({ client, carts, orders, report: repeated });
  assert.deepEqual(repeated, { checkedCarts: 0, deletedCarts: 0 });
  console.log('OK 04 Repetir la limpieza devuelve cero candidatos y cero borrados.');
}

async function main() {
  const mongoUri = process.env.CART_CLEANUP_TEST_MONGO_URI || env.mongoUri;
  if (!mongoUri) {
    console.error('Configura CART_CLEANUP_TEST_MONGO_URI o la conexión de MongoDB del backend.');
    process.exitCode = 1;
    return;
  }

  try {
    await mongoose.connect(mongoUri, {
      autoCreate: false,
      autoIndex: false,
      serverSelectionTimeoutMS: 10_000,
    });

    const client = mongoose.connection.getClient();
    const db = client.db(`cart_cleanup_test_${randomBytes(8).toString('hex')}`);
    let carts;
    let orders;
    try {
      carts = await db.createCollection(Cart.collection.name);
      orders = await db.createCollection(Order.collection.name);
      await testCartCleanup({ client, carts, orders });
    } finally {
      await Promise.all([orders?.drop(), carts?.drop()]);
    }
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    if (error.code === 'ERR_ASSERTION') console.error(error);
    else console.error('No se completó la prueba con MongoDB.', error.code || error.name);
    process.exitCode = 1;
  });
}
