'use strict';

const assert = require('node:assert/strict');

const Order = require('../models/Order');
const {
  ORDER_POST_COMMIT_INDEX_DEFINITIONS,
} = require('../models/order/orderPostCommitIndexDefinitions');
const {
  createOrderCreationPostCommitService,
} = require('../services/orderCreationPostCommitService');
const {
  buildOutboxCandidateFilter,
  createOrderPostCommitOutboxWorker,
} = require('../services/orderPostCommitOutboxWorkerService');
const migration = require('./migrateOrderPostCommitOutboxIndexes');

let passed = 0;

function ok(message) {
  passed += 1;
  console.log(`OK ${passed}: ${message}`);
}

function getPath(target, path) {
  return path.split('.').reduce((value, part) => value?.[part], target);
}

function setPath(target, path, value) {
  const parts = path.split('.');
  let cursor = target;
  for (const part of parts.slice(0, -1)) {
    cursor[part] = cursor[part] || {};
    cursor = cursor[part];
  }
  cursor[parts.at(-1)] = value;
}

function matchesValue(value, condition) {
  if (condition && typeof condition === 'object' && !Array.isArray(condition)) {
    if ('$in' in condition) return condition.$in.includes(value);
    if ('$nin' in condition) return !condition.$nin.includes(value);
    if ('$exists' in condition) {
      return condition.$exists ? value !== undefined : value === undefined;
    }
    if ('$lt' in condition) return new Date(value) < new Date(condition.$lt);
  }
  return String(value) === String(condition);
}

function matchesFilter(target, filter = {}) {
  return Object.entries(filter).every(([key, condition]) => {
    if (key === '$or') {
      return condition.some((candidate) => matchesFilter(target, candidate));
    }
    if (key === '$expr') {
      return condition.$and.every((expression) => {
        const [left, right] = expression.$eq;
        const resolve = (operand) =>
          typeof operand === 'string' && operand.startsWith('$')
            ? getPath(target, operand.slice(1))
            : operand;
        return resolve(left) === resolve(right);
      });
    }
    return matchesValue(getPath(target, key), condition);
  });
}

function applySet(target, update = {}) {
  for (const [path, value] of Object.entries(update.$set || {})) {
    setPath(target, path, value);
  }
}

function paidState(overrides = {}) {
  return {
    _id: '507f1f77bcf86cd799439099',
    updatedAt: new Date('2026-08-27T09:00:00.000Z'),
    payment: {
      status: 'paid',
      provider: 'wompi',
      transactionId: 'tx-outbox-1',
    },
    paymentProcessing: {
      provider: 'wompi',
      approvedTransactionId: 'tx-outbox-1',
      inventory: { status: 'confirmed' },
      fulfillment: { status: 'pending', claimId: '', claimedAt: null },
      invoice: { status: 'pending', claimId: '', claimedAt: null },
    },
    ...overrides,
  };
}

function createSharedOrderModel(state) {
  return {
    find(filter) {
      let limit = 25;
      const query = {
        sort() {
          return query;
        },
        limit(value) {
          limit = value;
          return query;
        },
        select() {
          return query;
        },
        lean() {
          return query;
        },
        async exec() {
          return matchesFilter(state, filter) ? [state].slice(0, limit) : [];
        },
      };
      return query;
    },
    async findOneAndUpdate(filter, update) {
      if (!matchesFilter(state, filter)) return null;
      applySet(state, update);
      return state;
    },
    async updateOne(filter, update) {
      if (!matchesFilter(state, filter)) {
        return { matchedCount: 0, modifiedCount: 0 };
      }
      applySet(state, update);
      return { matchedCount: 1, modifiedCount: 1 };
    },
  };
}

async function testCandidateFilter() {
  const staleBefore = new Date('2026-08-27T10:00:00.000Z');
  const filter = buildOutboxCandidateFilter({ staleBefore });
  assert.equal(filter['payment.status'], 'paid');
  assert.deepEqual(filter['paymentProcessing.inventory.status'].$in, [
    'confirmed',
    'not_required',
  ]);
  assert.deepEqual(filter.$expr, {
    $and: [
      { $eq: ['$paymentProcessing.provider', '$payment.provider'] },
      {
        $eq: [
          '$paymentProcessing.approvedTransactionId',
          '$payment.transactionId',
        ],
      },
    ],
  });
  assert.equal(filter.$or.length, 2);
  assert.equal(
    filter.$or[0].$or[2]['paymentProcessing.fulfillment.status'],
    'processing'
  );
  assert.equal(
    filter.$or[1].$or[2]['paymentProcessing.invoice.status'],
    'scheduling'
  );
  ok('el escáner incluye pendientes, fallidos y leases vencidos tras la barrera de inventario');
}

async function testInvalidIdentitiesCannotStarveValidCandidates() {
  const invalidOrders = Array.from({ length: 30 }, (_, index) =>
    paidState({
      _id: `invalid-${String(index).padStart(2, '0')}`,
      paymentProcessing: {
        provider: 'wompi',
        approvedTransactionId: `wrong-${index}`,
        inventory: { status: 'confirmed' },
        fulfillment: { status: 'pending' },
        invoice: { status: 'pending' },
      },
    })
  );
  const validOrder = paidState({ _id: 'valid-after-invalid-batch' });
  const states = [...invalidOrders, validOrder];
  const processed = [];
  const OrderModel = {
    find(filter) {
      let limit = 25;
      const query = {
        sort() {
          return query;
        },
        limit(value) {
          limit = value;
          return query;
        },
        select() {
          return query;
        },
        lean() {
          return query;
        },
        async exec() {
          return states.filter((state) => matchesFilter(state, filter)).slice(0, limit);
        },
      };
      return query;
    },
  };
  const worker = createOrderPostCommitOutboxWorker({
    OrderModel,
    batchSize: 25,
    effectProcessor: async ({ orderId }) => {
      processed.push(String(orderId));
      return { retryable: false };
    },
    logger: { error() {}, info() {} },
  });

  const result = await worker.runOnce();
  assert.deepEqual(processed, ['valid-after-invalid-batch']);
  assert.equal(result.scanned, 1);
  assert.equal(result.invalid, 0);
  assert.equal(result.completed, 1);
  ok('más de un lote de identidades incompatibles no puede dejar sin turno a una orden válida');
}

async function testTwoWorkersShareAtomicClaims() {
  const state = paidState();
  const OrderModel = createSharedOrderModel(state);
  let fulfillmentCalls = 0;
  let invoiceCalls = 0;
  let releaseFulfillment;
  let fulfillmentStarted;
  const started = new Promise((resolve) => {
    fulfillmentStarted = resolve;
  });
  const release = new Promise((resolve) => {
    releaseFulfillment = resolve;
  });
  let claimSequence = 0;
  const effects = createOrderCreationPostCommitService({
    OrderModel,
    fulfillmentProcessor: async () => {
      fulfillmentCalls += 1;
      fulfillmentStarted();
      await release;
      return { notified: true };
    },
    invoiceExecutor: async () => {
      invoiceCalls += 1;
      return { outcome: 'performed', performed: true };
    },
    randomUUID: () => `claim-${++claimSequence}`,
    logger: { error() {}, info() {} },
  });
  const options = {
    OrderModel,
    effectProcessor: effects.processPaidOrderEffects,
    now: () => new Date('2026-08-27T12:00:00.000Z'),
    logger: { error() {}, info() {} },
  };
  const workerA = createOrderPostCommitOutboxWorker(options);
  const workerB = createOrderPostCommitOutboxWorker(options);

  const first = workerA.runOnce();
  await started;
  const second = await workerB.runOnce();
  releaseFulfillment();
  await first;

  assert.equal(fulfillmentCalls, 1);
  assert.equal(invoiceCalls, 1);
  assert.equal(state.paymentProcessing.fulfillment.status, 'completed');
  assert.equal(state.paymentProcessing.invoice.status, 'scheduled');
  assert.equal(second.deferred, 1);
  const final = await workerB.runOnce();
  assert.equal(final.scanned, 0);
  ok('dos réplicas escanean la misma orden pero cada efecto externo se ejecuta una sola vez');
}

async function testCrashLeaseRecovery() {
  const now = new Date('2026-08-27T12:00:00.000Z');
  const stale = new Date(now.getTime() - 11 * 60 * 1000);
  const state = paidState({
    paymentProcessing: {
      provider: 'wompi',
      approvedTransactionId: 'tx-outbox-1',
      inventory: { status: 'confirmed' },
      fulfillment: {
        status: 'processing',
        claimId: 'crashed-fulfillment',
        claimedAt: stale,
      },
      invoice: {
        status: 'scheduling',
        claimId: 'crashed-invoice',
        claimedAt: stale,
      },
    },
  });
  const OrderModel = createSharedOrderModel(state);
  const calls = { fulfillment: 0, invoice: 0 };
  let sequence = 0;
  const effects = createOrderCreationPostCommitService({
    OrderModel,
    fulfillmentProcessor: async () => {
      calls.fulfillment += 1;
      return { notified: true, reused: true };
    },
    invoiceExecutor: async () => {
      calls.invoice += 1;
      return {
        outcome: 'performed',
        performed: true,
        reused: true,
        reasonCode: 'INVOICE_REUSED',
      };
    },
    now: () => now,
    randomUUID: () => `recovery-${++sequence}`,
    logger: { error() {}, info() {} },
  });
  const worker = createOrderPostCommitOutboxWorker({
    OrderModel,
    effectProcessor: effects.processPaidOrderEffects,
    now: () => now,
    logger: { error() {}, info() {} },
  });
  const result = await worker.runOnce();
  assert.deepEqual(calls, { fulfillment: 1, invoice: 1 });
  assert.equal(result.completed, 1);
  assert.equal(state.paymentProcessing.fulfillment.status, 'completed');
  assert.equal(state.paymentProcessing.invoice.status, 'scheduled');
  ok('el worker recupera ambos leases después del crash sin cambiar la identidad financiera');
}

async function testLifecycleHasNoOrphanTimers() {
  const state = paidState();
  const OrderModel = createSharedOrderModel(state);
  let scheduled = 0;
  let cleared = 0;
  const timer = { unrefCalls: 0, unref() { this.unrefCalls += 1; } };
  const worker = createOrderPostCommitOutboxWorker({
    OrderModel,
    effectProcessor: async () => ({ retryable: false }),
    setIntervalFn(callback, interval) {
      scheduled += 1;
      assert.equal(typeof callback, 'function');
      assert.equal(interval, 1_000);
      return timer;
    },
    clearIntervalFn(value) {
      assert.equal(value, timer);
      cleared += 1;
    },
    intervalMs: 10,
    logger: { error() {}, info() {} },
  });
  assert.equal(worker.start({ runImmediately: false }), true);
  assert.equal(worker.start({ runImmediately: false }), false);
  assert.equal(scheduled, 1);
  assert.equal(timer.unrefCalls, 1);
  assert.equal(worker.stop(), true);
  assert.equal(worker.stop(), false);
  assert.equal(cleared, 1);
  ok('start/stop es idempotente, usa unref y no deja intervalos huérfanos en pruebas');
}

async function testIndexesAndMigration() {
  const schemaIndexes = new Map(
    Order.schema.indexes().map(([key, options]) => [options.name, key])
  );
  for (const definition of ORDER_POST_COMMIT_INDEX_DEFINITIONS) {
    assert.deepEqual(
      schemaIndexes.get(definition.options.name),
      { ...definition.key }
    );
  }
  const dryRun = await migration.runMigration({
    argv: [],
    nodeEnv: 'production',
  });
  assert.equal(dryRun.mode, 'dry-run');
  assert.equal(dryRun.mutations, 0);
  assert.deepEqual(dryRun.indexes, JSON.parse(JSON.stringify(ORDER_POST_COMMIT_INDEX_DEFINITIONS)));
  assert.throws(
    () => migration.parseArguments(['--unknown']),
    (error) => error.code === 'ORDER_POSTCOMMIT_INDEX_MIGRATION_UNKNOWN_ARGUMENT'
  );
  await assert.rejects(
    () =>
      migration.runMigration({
        argv: [migration.APPLY_FLAG],
        nodeEnv: 'production',
      }),
    (error) =>
      error.code ===
      'ORDER_POSTCOMMIT_INDEX_MIGRATION_PRODUCTION_CONFIRMATION_REQUIRED'
  );
  const createCalls = [];
  const adapter = {
    connection: {
      collection(name) {
        assert.equal(name, 'orders');
        return {
          listIndexes() {
            return { toArray: async () => [{ name: '_id_', key: { _id: 1 } }] };
          },
          async createIndex(key, options) {
            createCalls.push({ key, options });
            return options.name;
          },
        };
      },
    },
    async connect(uri, options) {
      assert.equal(uri, 'mongodb://localhost:27017/outbox_index_test');
      assert.deepEqual(options, {
        autoIndex: false,
        serverSelectionTimeoutMS: 10_000,
      });
    },
    async disconnect() {},
  };
  const applied = await migration.runMigration({
    argv: [migration.APPLY_FLAG, migration.PRODUCTION_CONFIRMATION_FLAG],
    nodeEnv: 'production',
    mongoUri: 'mongodb://localhost:27017/outbox_index_test',
    mongooseAdapter: adapter,
  });
  assert.equal(applied.status, 'created');
  assert.equal(applied.mutations, 2);
  assert.deepEqual(createCalls, dryRun.indexes);
  ok('los índices del outbox comparten definición canónica y migración segura en dry-run');
}

async function run() {
  await testCandidateFilter();
  await testInvalidIdentitiesCannotStarveValidCandidates();
  await testTwoWorkersShareAtomicClaims();
  await testCrashLeaseRecovery();
  await testLifecycleHasNoOrphanTimers();
  await testIndexesAndMigration();
  console.log(`\nOutbox post-pago: ${passed}/${passed} controles aprobados.`);
}

run().catch((error) => {
  console.error('\nFAIL outbox post-pago');
  console.error(error);
  process.exitCode = 1;
});
