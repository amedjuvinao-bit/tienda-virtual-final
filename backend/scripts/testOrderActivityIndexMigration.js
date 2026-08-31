'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const OrderEvent = require('../models/OrderEvent');
const OrderNote = require('../models/OrderNote');
const {
  orderActivityIndexDefinitions,
} = require('../models/orderActivityIndexDefinitions');
const {
  createMongoOrderActivityIndexRepository,
  runOrderActivityIndexMigration,
} = require('../services/orderActivityIndexMigrationService');
const {
  APPLY_FLAG,
  PRODUCTION_FLAG,
  main,
  parseArguments,
} = require('./migrateOrderActivityIndexes');

const tests = [];

function test(name, callback) {
  tests.push({ name, callback });
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createFakeDatabase(initial = {}) {
  const collections = new Map();
  const createCalls = [];

  for (const [name, indexes] of Object.entries(initial)) {
    collections.set(name, clone(indexes));
  }

  return {
    createCalls,
    indexes(name) {
      return collections.get(name) || [];
    },
    collection(name) {
      if (!collections.has(name)) collections.set(name, []);
      const indexes = collections.get(name);
      return {
        listIndexes() {
          return { toArray: async () => clone(indexes) };
        },
        async createIndex(key, options) {
          const call = {
            collection: name,
            key: clone(key),
            options: clone(options),
          };
          createCalls.push(call);
          indexes.push({ key: clone(key), ...clone(options), v: 2 });
          return options.name;
        },
      };
    },
  };
}

function createFakeMongoose(database) {
  let connections = 0;
  let disconnections = 0;
  return {
    connection: database,
    async connect(uri, options) {
      connections += 1;
      assert.strictEqual(uri, 'mongodb://localhost:27017/order_activity_test');
      assert.deepStrictEqual(options, {
        autoIndex: false,
        serverSelectionTimeoutMS: 10_000,
      });
    },
    async disconnect() {
      disconnections += 1;
    },
    connectionCount: () => connections,
    disconnectionCount: () => disconnections,
  };
}

function modelIndexWithoutMongooseDefaults(model, name) {
  const index = model.schema.indexes().find(([, options]) => options.name === name);
  assert(index, `No se encontró ${name} en el schema.`);
  const { background: _mongooseDefault, ...options } = index[1];
  return { key: index[0], options };
}

test('sin confirmación muestra ambos índices y no se conecta', async () => {
  const database = createFakeDatabase();
  const mongooseInstance = createFakeMongoose(database);
  let output = '';
  const result = await main([], {
    nodeEnv: 'production',
    mongoUri: '',
    mongooseInstance,
    writeOutput: (value) => {
      output += value;
    },
  });

  assert.strictEqual(result.status, 'planned');
  assert.strictEqual(result.appliesChanges, false);
  assert.strictEqual(result.indexes.length, 2);
  assert.deepStrictEqual(result.destructiveOperations, []);
  assert.strictEqual(result.confirmations.productionRequired, true);
  assert.strictEqual(mongooseInstance.connectionCount(), 0);
  assert.strictEqual(database.createCalls.length, 0);
  assert.match(output, /order_events_order_recent/);
  assert.match(output, /order_notes_order_pinned_recent/);
});

test('producción exige el segundo flag antes de conectarse', async () => {
  const database = createFakeDatabase();
  const mongooseInstance = createFakeMongoose(database);

  await assert.rejects(
    () =>
      main([APPLY_FLAG], {
        nodeEnv: 'production',
        mongoUri: 'mongodb://localhost:27017/order_activity_test',
        mongooseInstance,
        writeOutput: () => {},
      }),
    (error) =>
      error?.code ===
      'PRODUCTION_ORDER_ACTIVITY_INDEX_CONFIRMATION_REQUIRED'
  );
  assert.strictEqual(mongooseInstance.connectionCount(), 0);
  assert.strictEqual(database.createCalls.length, 0);
});

test('acepta únicamente los flags explícitos de actividad', () => {
  assert.deepStrictEqual(parseArguments([APPLY_FLAG]), {
    apply: true,
    allowProduction: false,
  });
  assert.deepStrictEqual(parseArguments([APPLY_FLAG, PRODUCTION_FLAG]), {
    apply: true,
    allowProduction: true,
  });
  assert.throws(
    () => parseArguments(['--apply']),
    (error) => error?.code === 'UNKNOWN_ORDER_ACTIVITY_INDEX_ARGUMENT'
  );
});

test('createIndex recibe las dos definiciones canónicas exactas', async () => {
  const definitions = orderActivityIndexDefinitions();
  const database = createFakeDatabase({
    order_events: [{ name: '_id_', key: { _id: 1 } }],
    order_notes: [{ name: '_id_', key: { _id: 1 } }],
  });
  const repository = createMongoOrderActivityIndexRepository(database);
  const result = await runOrderActivityIndexMigration({
    repository,
    apply: true,
    nodeEnv: 'test',
  });

  assert.strictEqual(result.status, 'created');
  assert.strictEqual(result.mutations, 2);
  assert.deepStrictEqual(
    database.createCalls,
    definitions.map((definition) => ({
      collection: definition.collection,
      key: definition.key,
      options: definition.options,
    }))
  );
  assert.deepStrictEqual(
    modelIndexWithoutMongooseDefaults(
      OrderEvent,
      'order_events_order_recent'
    ),
    { key: definitions[0].key, options: definitions[0].options }
  );
  assert.deepStrictEqual(
    modelIndexWithoutMongooseDefaults(
      OrderNote,
      'order_notes_order_pinned_recent'
    ),
    { key: definitions[1].key, options: definitions[1].options }
  );
});

test('la segunda aplicación es idempotente', async () => {
  const database = createFakeDatabase({
    order_events: [{ name: '_id_', key: { _id: 1 } }],
    order_notes: [{ name: '_id_', key: { _id: 1 } }],
  });
  const repository = createMongoOrderActivityIndexRepository(database);
  const first = await runOrderActivityIndexMigration({
    repository,
    apply: true,
    nodeEnv: 'test',
  });
  const second = await runOrderActivityIndexMigration({
    repository,
    apply: true,
    nodeEnv: 'test',
  });

  assert.strictEqual(first.mutations, 2);
  assert.strictEqual(second.status, 'already_present');
  assert.strictEqual(second.mutations, 0);
  assert.strictEqual(database.createCalls.length, 2);
});

test('si un índice ya existe crea únicamente el faltante', async () => {
  const [eventDefinition, noteDefinition] = orderActivityIndexDefinitions();
  const database = createFakeDatabase({
    order_events: [
      { key: eventDefinition.key, ...eventDefinition.options, v: 2 },
    ],
    order_notes: [{ name: '_id_', key: { _id: 1 } }],
  });
  const repository = createMongoOrderActivityIndexRepository(database);
  const result = await runOrderActivityIndexMigration({
    repository,
    apply: true,
    nodeEnv: 'test',
  });

  assert.strictEqual(result.mutations, 1);
  assert.deepStrictEqual(database.createCalls, [
    {
      collection: noteDefinition.collection,
      key: noteDefinition.key,
      options: noteDefinition.options,
    },
  ]);
});

test('preflight incompatible detiene todo antes de cualquier createIndex', async () => {
  const [eventDefinition] = orderActivityIndexDefinitions();
  const database = createFakeDatabase({
    order_events: [
      {
        key: eventDefinition.key,
        ...eventDefinition.options,
        unique: true,
      },
    ],
    order_notes: [{ name: '_id_', key: { _id: 1 } }],
  });
  const repository = createMongoOrderActivityIndexRepository(database);

  await assert.rejects(
    () =>
      runOrderActivityIndexMigration({
        repository,
        apply: true,
        nodeEnv: 'test',
      }),
    (error) => error?.code === 'ORDER_ACTIVITY_INDEX_CONFLICT'
  );
  assert.strictEqual(database.createCalls.length, 0);
  assert.strictEqual(database.indexes('order_notes').length, 1);
});

test('no contiene syncIndexes ni operaciones destructivas', () => {
  const source = [
    '../services/orderActivityIndexMigrationService.js',
    './migrateOrderActivityIndexes.js',
  ]
    .map((file) => fs.readFileSync(path.resolve(__dirname, file), 'utf8'))
    .join('\n');
  assert(!source.includes('syncIndexes'));
  assert(!/\.(dropIndex|dropIndexes|deleteMany|deleteOne)\s*\(/.test(source));
});

(async () => {
  let passed = 0;
  for (const entry of tests) {
    try {
      await entry.callback();
      passed += 1;
      console.log(`OK ${passed}: ${entry.name}`);
    } catch (error) {
      console.error(`FAIL: ${entry.name}`);
      console.error(error);
      process.exitCode = 1;
    }
  }
  console.log(`\nMigración índices de actividad: ${passed}/${tests.length}.`);
})();
