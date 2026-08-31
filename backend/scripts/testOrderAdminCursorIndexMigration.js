'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Order = require('../models/Order');
const {
  APPLY_FLAG,
  PRODUCTION_CONFIRMATION_FLAG,
  cloneDefinition,
  createOrderAdminCursorIndex,
  runMigration,
} = require('./migrateOrderAdminCursorIndex');

class FakeCollection {
  constructor() {
    this.calls = [];
    this.indexes = new Map();
  }

  async createIndex(key, options) {
    const next = {
      key: JSON.parse(JSON.stringify(key)),
      options: JSON.parse(JSON.stringify(options)),
    };
    const previous = this.indexes.get(options.name);
    if (previous) assert.deepEqual(next, previous);
    this.calls.push(next);
    this.indexes.set(options.name, next);
    return options.name;
  }
}

async function run() {
  const checks = [];
  const ok = (message) => {
    checks.push(message);
    console.log(`OK ${checks.length}: ${message}`);
  };

  const definition = cloneDefinition();
  assert.deepEqual(definition, {
    key: { createdAt: -1, _id: -1 },
    options: { name: 'orders_admin_created_at_id_desc' },
  });
  const declaredIndexes = Order.schema.indexes();
  assert.equal(
    declaredIndexes.some(
      ([keys, options]) =>
        keys.createdAt === -1 &&
        keys._id === -1 &&
        Object.keys(keys).length === 2 &&
        options.name === definition.options.name
    ),
    true
  );
  assert.equal(
    declaredIndexes.some(
      ([keys]) => keys.createdAt === -1 && Object.keys(keys).length === 1
    ),
    false
  );
  assert.ok(declaredIndexes.length <= 45);
  ok('Order declara el índice exacto sin conservar el prefijo simple redundante');

  let connections = 0;
  const dryRun = await runMigration({
    argv: [],
    nodeEnv: 'production',
    mongooseAdapter: {
      connect: async () => {
        connections += 1;
      },
    },
  });
  assert.equal(dryRun.mode, 'dry-run');
  assert.deepEqual(dryRun.index, definition);
  assert.equal(connections, 0);
  ok('dry-run es predeterminado y no abre MongoDB');

  await assert.rejects(
    () =>
      runMigration({
        argv: [APPLY_FLAG],
        nodeEnv: 'production',
        mongooseAdapter: {
          connect: async () => {
            connections += 1;
          },
        },
      }),
    (error) =>
      error.code === 'ORDER_ADMIN_CURSOR_INDEX_PRODUCTION_CONFIRMATION_REQUIRED'
  );
  assert.equal(connections, 0);
  ok('producción exige apply y una segunda confirmación antes de conectar');

  const collection = new FakeCollection();
  let disconnects = 0;
  const adapter = {
    connection: {
      collection(name) {
        assert.equal(name, 'orders');
        return collection;
      },
    },
    async connect(_uri, options) {
      connections += 1;
      assert.equal(options.autoIndex, false);
    },
    async disconnect() {
      disconnects += 1;
    },
  };
  const applied = await runMigration({
    argv: [APPLY_FLAG, PRODUCTION_CONFIRMATION_FLAG],
    nodeEnv: 'production',
    mongoUri: 'mongodb://fixture/orders',
    mongooseAdapter: adapter,
  });
  assert.equal(applied.mode, 'apply');
  assert.equal(collection.calls.length, 1);
  assert.deepEqual(collection.calls[0], definition);
  assert.equal(disconnects, 1);
  ok('apply usa collection.createIndex con la definición compartida exacta');

  await createOrderAdminCursorIndex(collection);
  assert.equal(collection.calls.length, 2);
  assert.equal(collection.indexes.size, 1);
  ok('repetir la migración es idempotente');

  const source = fs.readFileSync(
    path.join(__dirname, 'migrateOrderAdminCursorIndex.js'),
    'utf8'
  );
  assert.equal(source.includes('.syncIndexes('), false);
  assert.equal(source.includes('.dropIndex('), false);
  assert.equal(source.includes('.dropIndexes('), false);
  assert.equal(source.includes('.delete'), false);
  ok('la migración nunca sincroniza, elimina ni reemplaza índices o datos');

  console.log(`RESULTADO: ${checks.length}/${checks.length} controles aprobados.`);
}

run().catch((error) => {
  console.error('FAIL migración de índice cursor de Órdenes');
  console.error(error);
  process.exitCode = 1;
});
