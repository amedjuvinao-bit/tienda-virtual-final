'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const OrderRefund = require('../models/OrderRefund');
const IdempotencyKey = require('../models/IdempotencyKey');
const ShippingOperation = require('../models/ShippingOperation');
const {
  ORDER_REFUND_INDEX_DEFINITIONS,
} = require('../models/orderRefundIndexDefinitions');
const {
  IDEMPOTENCY_KEY_INDEX_DEFINITIONS,
} = require('../models/idempotencyKeyIndexDefinitions');
const {
  SHIPPING_OPERATION_INDEX_DEFINITIONS,
} = require('../models/shippingOperationIndexDefinitions');
const orderRefundMigration = require('./migrateOrderRefundIndexes');
const idempotencyMigration = require('./migrateIdempotencyKeyIndexes');
const shippingMigration = require('./migrateShippingOperationIndexes');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function schemaDefinitionsByName(Model, expectedDefinitions) {
  const expectedNames = new Set(
    expectedDefinitions.map((definition) => definition.options.name)
  );
  return Model.schema.indexes()
    .map(([key, options]) => ({
      key: clone(key),
      options: Object.fromEntries(
        Object.entries(options)
          .filter(([name]) => name !== 'background')
          .map(([name, value]) => [name, clone(value)])
      ),
    }))
    .filter((definition) => expectedNames.has(definition.options.name));
}

class FakeCollection {
  constructor(initialIndexes = [{ name: '_id_', key: { _id: 1 } }]) {
    this.indexes = clone(initialIndexes);
    this.createCalls = [];
    this.listCalls = 0;
  }

  listIndexes() {
    this.listCalls += 1;
    return { toArray: async () => clone(this.indexes) };
  }

  async createIndex(key, options) {
    const call = { key: clone(key), options: clone(options) };
    this.createCalls.push(call);
    this.indexes.push({
      name: options.name,
      key: clone(key),
      ...clone(options),
      v: 2,
    });
    return options.name;
  }
}

class MissingCollection extends FakeCollection {
  listIndexes() {
    this.listCalls += 1;
    const error = new Error('namespace does not exist');
    error.code = 26;
    error.codeName = 'NamespaceNotFound';
    throw error;
  }
}

function fakeMongoose(collection, expectedCollection) {
  const state = { connections: 0, disconnections: 0 };
  return {
    state,
    connection: {
      collection(name) {
        assert.equal(name, expectedCollection);
        return collection;
      },
    },
    async connect(uri, options) {
      state.connections += 1;
      assert.equal(uri, 'mongodb://localhost:27017/index_migration_test');
      assert.deepEqual(options, {
        autoIndex: false,
        serverSelectionTimeoutMS: 10_000,
      });
    },
    async disconnect() {
      state.disconnections += 1;
    },
  };
}

const CASES = [
  {
    label: 'OrderRefund',
    Model: OrderRefund,
    definitions: ORDER_REFUND_INDEX_DEFINITIONS,
    migration: orderRefundMigration,
    collection: 'orderrefunds',
    expectedNames: [
      'refundNumber_1',
      'order_1_idempotencyKey_1',
      'order_1_status_1_createdAt_1',
      'order_1_items.orderItemId_1_status_1',
      'reconciliation.state_1_reconciliation.lastReconciledAt_-1',
    ],
  },
  {
    label: 'IdempotencyKey',
    Model: IdempotencyKey,
    definitions: IDEMPOTENCY_KEY_INDEX_DEFINITIONS,
    migration: idempotencyMigration,
    collection: 'idempotency_keys',
    expectedNames: ['key_1_endpoint_1', 'ttl_createdAt_48h', 'status_1'],
  },
  {
    label: 'ShippingOperation',
    Model: ShippingOperation,
    definitions: SHIPPING_OPERATION_INDEX_DEFINITIONS,
    migration: shippingMigration,
    collection: 'shippingoperations',
    expectedNames: [
      'idempotencyKey_1',
      'order_1_shipmentId_1_createdAt_-1',
      'status_1',
      'returnCase_1_createdAt_-1',
      'returnCase_1_activeLock_1',
    ],
  },
];

let passed = 0;
function ok(message) {
  passed += 1;
  console.log(`OK ${passed}: ${message}`);
}

async function runCase(entry) {
  const plan = entry.migration.buildMigrationPlan();
  assert.deepEqual(plan, clone(entry.definitions));
  assert.deepEqual(
    plan.map((definition) => definition.options.name),
    entry.expectedNames
  );
  assert.deepEqual(
    schemaDefinitionsByName(entry.Model, entry.definitions),
    plan
  );

  let dryConnections = 0;
  const dryRun = await entry.migration.runMigration({
    argv: [],
    nodeEnv: 'production',
    mongooseAdapter: {
      async connect() {
        dryConnections += 1;
      },
    },
  });
  assert.equal(dryRun.mode, 'dry-run');
  assert.equal(dryRun.mutations, 0);
  assert.deepEqual(dryRun.destructiveOperations, []);
  assert.equal(dryConnections, 0);

  assert.deepEqual(entry.migration.parseArguments([entry.migration.APPLY_FLAG]), {
    apply: true,
    confirmProduction: false,
  });
  assert.throws(
    () => entry.migration.parseArguments(['--unknown']),
    (error) => error.code.endsWith('_UNKNOWN_ARGUMENT')
  );
  await assert.rejects(
    () => entry.migration.runMigration({
      argv: [entry.migration.APPLY_FLAG],
      nodeEnv: 'production',
      mongoUri: 'mongodb://localhost:27017/index_migration_test',
      mongooseAdapter: { connect: async () => { dryConnections += 1; } },
    }),
    (error) => error.code.endsWith('_PRODUCTION_CONFIRMATION_REQUIRED')
  );
  assert.equal(dryConnections, 0);

  const collection = new FakeCollection();
  const adapter = fakeMongoose(collection, entry.collection);
  const applyArguments = [
    entry.migration.APPLY_FLAG,
    entry.migration.PRODUCTION_CONFIRMATION_FLAG,
  ];
  const first = await entry.migration.runMigration({
    argv: applyArguments,
    nodeEnv: 'production',
    mongoUri: 'mongodb://localhost:27017/index_migration_test',
    mongooseAdapter: adapter,
  });
  assert.equal(first.status, 'created');
  assert.equal(first.mutations, plan.length);
  assert.deepEqual(collection.createCalls, plan);
  assert.equal(collection.listCalls, 1);

  const second = await entry.migration.runMigration({
    argv: applyArguments,
    nodeEnv: 'production',
    mongoUri: 'mongodb://localhost:27017/index_migration_test',
    mongooseAdapter: adapter,
  });
  assert.equal(second.status, 'already_present');
  assert.equal(second.mutations, 0);
  assert.equal(collection.createCalls.length, plan.length);
  assert.equal(collection.listCalls, 2);
  assert.equal(adapter.state.connections, 2);
  assert.equal(adapter.state.disconnections, 2);

  const conflicting = clone(plan[plan.length - 1]);
  const conflictCollection = new FakeCollection([
    { name: '_id_', key: { _id: 1 } },
    {
      name: conflicting.options.name,
      key: conflicting.key,
      unique: !Boolean(conflicting.options.unique),
      ...(conflicting.options.expireAfterSeconds !== undefined
        ? { expireAfterSeconds: conflicting.options.expireAfterSeconds + 1 }
        : {}),
    },
  ]);
  await assert.rejects(
    () => entry.migration.createIndexes(conflictCollection),
    (error) => error.code.endsWith('_CONFLICT')
  );
  assert.equal(conflictCollection.createCalls.length, 0);

  const missingCollection = new MissingCollection([]);
  const firstCollectionCreation = await entry.migration.createIndexes(
    missingCollection
  );
  assert.equal(firstCollectionCreation.status, 'created');
  assert.deepEqual(missingCollection.createCalls, plan);
}

async function run() {
  for (const entry of CASES) {
    await runCase(entry);
    ok(`${entry.label} comparte plan canónico, dry-run, preflight e idempotencia`);
  }

  const ttl = IDEMPOTENCY_KEY_INDEX_DEFINITIONS.find(
    (definition) => definition.options.name === 'ttl_createdAt_48h'
  );
  assert.deepEqual(ttl.key, { createdAt: 1 });
  assert.equal(ttl.options.expireAfterSeconds, 172800);
  assert.equal(ORDER_REFUND_INDEX_DEFINITIONS[0].options.unique, true);
  assert.equal(ORDER_REFUND_INDEX_DEFINITIONS[1].options.unique, true);
  assert.equal(SHIPPING_OPERATION_INDEX_DEFINITIONS[0].options.unique, true);
  ok('unicidad y TTL críticos permanecen explícitos en el plan');

  const migrationSources = [
    '../services/indexMigrations/canonicalIndexMigration.js',
    './migrateOrderRefundIndexes.js',
    './migrateIdempotencyKeyIndexes.js',
    './migrateShippingOperationIndexes.js',
  ].map((file) => fs.readFileSync(path.resolve(__dirname, file), 'utf8'));
  const joinedSource = migrationSources.join('\n');
  assert.equal(joinedSource.includes('.syncIndexes('), false);
  assert.equal(joinedSource.includes('.dropIndex('), false);
  assert.equal(joinedSource.includes('.dropIndexes('), false);
  assert.equal(joinedSource.includes('.deleteOne('), false);
  assert.equal(joinedSource.includes('.deleteMany('), false);
  assert.equal(joinedSource.includes('findOneAndDelete('), false);
  assert.equal(joinedSource.includes('.renameCollection('), false);
  assert.equal(joinedSource.includes('.replaceOne('), false);
  assert.equal(joinedSource.includes('findOneAndReplace('), false);
  ok('las migraciones no sincronizan, borran, renombran ni reemplazan datos');

  console.log(`\nMigraciones de índices críticos: ${passed}/${passed} controles aprobados.`);
}

run().catch((error) => {
  console.error('\nFAIL migraciones de índices críticos de Órdenes');
  console.error(error);
  process.exitCode = 1;
});
