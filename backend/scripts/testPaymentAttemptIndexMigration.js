'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  APPLY_FLAG,
  PRODUCTION_CONFIRMATION_FLAG,
  buildMigrationPlan,
  createPaymentAttemptIndexes,
  parseArguments,
  runMigration,
} = require('./migratePaymentAttemptIndexes');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

class FakeCollection {
  constructor() {
    this.indexes = new Map();
    this.calls = [];
  }

  async createIndex(key, options) {
    this.calls.push({ key: clone(key), options: clone(options) });
    const previous = this.indexes.get(options.name);
    const next = { key: clone(key), options: clone(options) };
    if (previous) assert.deepEqual(next, previous);
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

  const plan = buildMigrationPlan();
  assert.equal(plan.length, 4);
  assert.deepEqual(
    plan.map((definition) => definition.options.name),
    [
      'payment_attempt_provider_reference_unique',
      'payment_attempt_one_active_per_order',
      'payment_attempt_order_recent',
      'payment_attempt_reconciliation_queue',
    ]
  );
  assert.equal(plan[0].options.unique, true);
  assert.equal(plan[1].options.unique, true);
  assert.deepEqual(plan[1].key, { order: 1, active: 1 });
  assert.deepEqual(plan[1].options.partialFilterExpression, { active: true });
  assert.deepEqual(plan[3].options.partialFilterExpression, {
    'reconciliation.required': true,
  });
  ok('el plan contiene exactamente los cuatro índices canónicos');

  let connected = 0;
  const dryAdapter = {
    connect: async () => {
      connected += 1;
    },
  };
  const dryRun = await runMigration({
    argv: [],
    nodeEnv: 'production',
    mongooseAdapter: dryAdapter,
  });
  assert.equal(dryRun.mode, 'dry-run');
  assert.equal(connected, 0);
  ok('dry-run es predeterminado y no abre conexión ni escribe');

  assert.deepEqual(parseArguments([APPLY_FLAG]), {
    apply: true,
    confirmProduction: false,
  });
  await assert.rejects(
    () =>
      runMigration({
        argv: [APPLY_FLAG],
        nodeEnv: 'production',
        mongooseAdapter: dryAdapter,
      }),
    (error) =>
      error.code ===
      'PAYMENT_ATTEMPT_INDEX_MIGRATION_PRODUCTION_CONFIRMATION_REQUIRED'
  );
  assert.equal(connected, 0);
  ok('producción exige los dos flags antes de conectar');

  const collection = new FakeCollection();
  let disconnected = 0;
  const applyAdapter = {
    connection: {
      collection(name) {
        assert.equal(name, 'payment_attempts');
        return collection;
      },
    },
    connect: async (_uri, options) => {
      connected += 1;
      assert.equal(options.autoIndex, false);
    },
    disconnect: async () => {
      disconnected += 1;
    },
  };
  const applied = await runMigration({
    argv: [APPLY_FLAG, PRODUCTION_CONFIRMATION_FLAG],
    nodeEnv: 'production',
    mongoUri: 'mongodb://fixture/payment-attempts',
    mongooseAdapter: applyAdapter,
  });
  assert.equal(applied.mode, 'apply');
  assert.equal(collection.calls.length, 4);
  assert.deepEqual(collection.calls, plan);
  assert.equal(disconnected, 1);
  ok('apply usa createIndex con claves y opciones exactas');

  await createPaymentAttemptIndexes(collection);
  assert.equal(collection.calls.length, 8);
  assert.equal(collection.indexes.size, 4);
  ok('una segunda ejecución conserva los mismos cuatro índices');

  const source = fs.readFileSync(
    path.join(__dirname, 'migratePaymentAttemptIndexes.js'),
    'utf8'
  );
  assert.equal(source.includes('.syncIndexes('), false);
  assert.equal(source.includes('.dropIndex('), false);
  assert.equal(source.includes('.dropIndexes('), false);
  assert.equal(source.includes('.delete'), false);
  ok('el script no sincroniza, elimina ni reemplaza índices o datos');

  console.log(`RESULTADO: ${checks.length}/${checks.length} controles aprobados.`);
}

run().catch((error) => {
  console.error('FAIL migración de índices PaymentAttempt');
  console.error(error);
  process.exitCode = 1;
});
