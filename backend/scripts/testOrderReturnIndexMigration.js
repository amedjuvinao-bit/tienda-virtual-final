'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
  orderReturnCreationIdempotencyIndexDefinition,
} = require('../models/orderReturnIndexDefinitions');
const OrderReturn = require('../models/OrderReturn');
const {
  createMongoOrderReturnIndexRepository,
  runOrderReturnIndexMigration,
} = require('../services/orderReturns/indexMigration');
const {
  APPLY_FLAG,
  PRODUCTION_FLAG,
  main,
  parseArguments,
} = require('./migrateOrderReturnIndexes');

const tests = [];

function test(name, callback) {
  tests.push({ name, callback });
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createFakeCollection(initialIndexes = []) {
  const indexes = clone(initialIndexes);
  const createCalls = [];
  return {
    createCalls,
    indexes,
    listIndexes() {
      return { toArray: async () => clone(indexes) };
    },
    async createIndex(key, options) {
      createCalls.push({ key: clone(key), options: clone(options) });
      indexes.push({ key: clone(key), ...clone(options), v: 2 });
      return options.name;
    },
  };
}

function createFakeMongoose(collection) {
  let connections = 0;
  let disconnections = 0;
  return {
    connection: {
      collection(name) {
        assert.strictEqual(name, 'orderreturns');
        return collection;
      },
    },
    async connect(uri, options) {
      connections += 1;
      assert.strictEqual(uri, 'mongodb://localhost:27017/order_return_test');
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

test('sin confirmación solo muestra el plan y no se conecta', async () => {
  const collection = createFakeCollection();
  const mongooseInstance = createFakeMongoose(collection);
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
  assert.deepStrictEqual(result.destructiveOperations, []);
  assert.strictEqual(result.confirmations.productionRequired, true);
  assert.strictEqual(mongooseInstance.connectionCount(), 0);
  assert.strictEqual(collection.createCalls.length, 0);
  assert.match(output, /"status": "planned"/);
});

test('producción exige la segunda confirmación antes de conectarse', async () => {
  const collection = createFakeCollection();
  const mongooseInstance = createFakeMongoose(collection);

  await assert.rejects(
    () =>
      main([APPLY_FLAG], {
        nodeEnv: 'production',
        mongoUri: 'mongodb://localhost:27017/order_return_test',
        mongooseInstance,
        writeOutput: () => {},
      }),
    (error) =>
      error?.code ===
      'PRODUCTION_ORDER_RETURN_INDEX_CONFIRMATION_REQUIRED'
  );
  assert.strictEqual(mongooseInstance.connectionCount(), 0);
  assert.strictEqual(collection.createCalls.length, 0);
});

test('la aplicación exige flags exactos y rechaza argumentos desconocidos', () => {
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
    (error) => error?.code === 'UNKNOWN_ORDER_RETURN_INDEX_ARGUMENT'
  );
});

test('createIndex recibe exactamente la clave y opciones declaradas por el modelo', async () => {
  const collection = createFakeCollection([{ name: '_id_', key: { _id: 1 } }]);
  const repository = createMongoOrderReturnIndexRepository(collection);
  const result = await runOrderReturnIndexMigration({
    repository,
    apply: true,
    nodeEnv: 'test',
  });
  const definition = orderReturnCreationIdempotencyIndexDefinition();

  assert.strictEqual(result.status, 'created');
  assert.strictEqual(result.mutations, 1);
  assert.deepStrictEqual(collection.createCalls, [definition]);
  const schemaIndex = OrderReturn.schema.indexes().find(
    ([, options]) => options.name === definition.options.name
  );
  assert.deepStrictEqual(schemaIndex[0], definition.key);
  const { background: _mongooseDefault, ...schemaOptions } = schemaIndex[1];
  assert.deepStrictEqual(schemaOptions, definition.options);
});

test('una segunda aplicación es idempotente y no vuelve a crear el índice', async () => {
  const collection = createFakeCollection([{ name: '_id_', key: { _id: 1 } }]);
  const repository = createMongoOrderReturnIndexRepository(collection);
  const first = await runOrderReturnIndexMigration({
    repository,
    apply: true,
    nodeEnv: 'test',
  });
  const second = await runOrderReturnIndexMigration({
    repository,
    apply: true,
    nodeEnv: 'test',
  });

  assert.strictEqual(first.status, 'created');
  assert.strictEqual(second.status, 'already_present');
  assert.strictEqual(second.mutations, 0);
  assert.strictEqual(collection.createCalls.length, 1);
});

test('un índice incompatible detiene la migración sin borrar ni reemplazar', async () => {
  const definition = orderReturnCreationIdempotencyIndexDefinition();
  const collection = createFakeCollection([
    {
      name: definition.options.name,
      key: definition.key,
      unique: false,
      partialFilterExpression: definition.options.partialFilterExpression,
    },
  ]);
  const repository = createMongoOrderReturnIndexRepository(collection);

  await assert.rejects(
    () =>
      runOrderReturnIndexMigration({
        repository,
        apply: true,
        nodeEnv: 'test',
      }),
    (error) => error?.code === 'ORDER_RETURN_INDEX_CONFLICT'
  );
  assert.strictEqual(collection.createCalls.length, 0);
  assert.strictEqual(collection.indexes.length, 1);
});

test('la implementación no contiene operaciones destructivas ni syncIndexes', () => {
  const source = [
    '../services/orderReturns/indexMigration.js',
    './migrateOrderReturnIndexes.js',
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
  console.log(`\nMigración índice RMA: ${passed}/${tests.length}.`);
})();
