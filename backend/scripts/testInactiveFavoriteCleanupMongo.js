'use strict';

const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const mongoose = require('mongoose');
const { env } = require('../config/env');
const Favorite = require('../models/Favorite');
const {
  RETENTION_DAYS,
  buildFavoriteRetentionMatch,
} = require('./previewInactiveFavoriteRetention');
const {
  cleanupEligibleFavoriteLists,
  deleteEligibleFavoriteList,
} = require('./cleanupInactiveFavorites');

async function testFavoriteCleanup(favorites) {
  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;
  const expired = new Date(now.getTime() - (RETENTION_DAYS + 1) * dayMs);
  const cutoff = new Date(now.getTime() - RETENTION_DAYS * dayMs);
  const fixtures = [
    ['vencido', { lastCustomerActivityAt: expired, updatedAt: now }],
    ['limite-exacto', { lastCustomerActivityAt: cutoff }],
    ['anterior-con-actualizacion', { updatedAt: expired, createdAt: now }],
    ['anterior-con-creacion', { createdAt: expired }],
    ['anterior-con-nulos', { lastCustomerActivityAt: null, updatedAt: null, createdAt: expired }],
    ['reciente', { lastCustomerActivityAt: now, updatedAt: expired }],
    ['actualizacion-reciente', { updatedAt: now, createdAt: expired }],
    ['vacio', { items: [], lastCustomerActivityAt: expired }],
    ['sin-fechas', {}],
    ['fecha-invalida', { lastCustomerActivityAt: expired.toISOString(), updatedAt: expired }],
    ['reactivado-despues', { lastCustomerActivityAt: expired }],
    ['vaciado-despues', { lastCustomerActivityAt: expired }],
  ];
  const documents = fixtures.map(([name, fields]) => ({
    _id: new mongoose.Types.ObjectId(),
    sessionId: `favorite-cleanup-test-${name}`,
    items: [{ productId: 'producto-de-prueba' }],
    ...fields,
  }));
  const byName = new Map(fixtures.map(([name], index) => [name, documents[index]]));
  await favorites.insertMany(documents);

  const match = buildFavoriteRetentionMatch(cutoff);
  assert.equal(await favorites.countDocuments(match), 7);
  console.log('OK 01 El conteo incluye el límite de 30 días y las fechas de versiones anteriores.');

  for (const [name, update] of [
    ['reactivado-despues', { lastCustomerActivityAt: now }],
    ['vaciado-despues', { items: [] }],
  ]) {
    const candidate = byName.get(name);
    await favorites.updateOne({ _id: candidate._id }, { $set: update });
    assert.equal(await deleteEligibleFavoriteList(candidate, { favorites, cutoff }), 0);
  }
  console.log('OK 02 Una modificación posterior al conteo impide el borrado.');

  const report = { checkedFavoriteLists: 0, deletedFavoriteLists: 0 };
  await cleanupEligibleFavoriteLists({ favorites, report, now });
  assert.deepEqual(report, { checkedFavoriteLists: 5, deletedFavoriteLists: 5 });
  const expectedRemaining = [
    'actualizacion-reciente', 'fecha-invalida', 'reactivado-despues',
    'reciente', 'sin-fechas', 'vaciado-despues', 'vacio',
  ].map((name) => byName.get(name).sessionId).sort();
  const remaining = await favorites.find({}, { projection: { sessionId: 1 } }).toArray();
  assert.deepEqual(remaining.map((item) => item.sessionId).sort(), expectedRemaining);
  console.log('OK 03 La limpieza elimina los favoritos vencidos y conserva las demás listas.');

  const repeated = { checkedFavoriteLists: 0, deletedFavoriteLists: 0 };
  await cleanupEligibleFavoriteLists({ favorites, report: repeated, now });
  assert.deepEqual(repeated, { checkedFavoriteLists: 0, deletedFavoriteLists: 0 });
  console.log('OK 04 Repetir la limpieza devuelve cero candidatos y cero borrados.');
}

async function main() {
  const mongoUri = process.env.FAVORITE_CLEANUP_TEST_MONGO_URI || env.mongoUri;
  if (!mongoUri) {
    console.error('Configura FAVORITE_CLEANUP_TEST_MONGO_URI o la conexión de MongoDB del backend.');
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
    const db = client.db(`favorite_cleanup_test_${randomBytes(8).toString('hex')}`);
    let favorites;
    try {
      favorites = await db.createCollection(Favorite.collection.name);
      await testFavoriteCleanup(favorites);
    } finally {
      await favorites?.drop();
    }
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    if (error.code === 'ERR_ASSERTION') console.error(error);
    else console.error('No se completó la prueba de favoritos con MongoDB.', error.code || error.name);
    process.exitCode = 1;
  });
}
