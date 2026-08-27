'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ManualPaymentConfirmation = require('../models/ManualPaymentConfirmation');
const {
  MANUAL_PAYMENT_CONFIRMATION_INDEX_DEFINITIONS,
} = require('../services/manualPaymentConfirmation/indexDefinitions');
const {
  APPLY_FLAG,
  PRODUCTION_CONFIRMATION_FLAG,
  buildMigrationPlan,
  createManualPaymentConfirmationIndexes,
  parseArguments,
  runMigration,
} = require('./migrateManualPaymentConfirmationIndexes');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

class FakeCollection {
  constructor() {
    this.calls = [];
    this.indexes = new Map();
  }

  async createIndex(key, options) {
    const definition = { key: clone(key), options: clone(options) };
    const previous = this.indexes.get(options.name);
    if (previous) assert.deepEqual(definition, previous);
    this.calls.push(definition);
    this.indexes.set(options.name, definition);
    return options.name;
  }
}

async function main() {
  const checks = [];
  const ok = (label) => {
    checks.push(label);
    console.log(`OK ${checks.length}: ${label}`);
  };

  const plan = buildMigrationPlan();
  assert.deepEqual(plan, clone(MANUAL_PAYMENT_CONFIRMATION_INDEX_DEFINITIONS));
  assert.deepEqual(
    plan.map((definition) => definition.options.name),
    [
      'manual_payment_confirmation_order_unique',
      'manual_payment_confirmation_reference_unique',
      'manual_payment_confirmation_recent',
    ]
  );
  assert.equal(plan[0].options.unique, true);
  assert.equal(plan[1].options.unique, true);
  assert.deepEqual(plan[0].key, { order: 1 });
  assert.deepEqual(plan[1].key, { provider: 1, referenceKey: 1 });
  assert.deepEqual(
    ManualPaymentConfirmation.schema.indexes().map(([key, options]) => ({
      key,
      options: Object.fromEntries(
        Object.entries(options).filter(([name]) => name !== 'background')
      ),
    })),
    plan
  );
  ok('modelo y migración comparten exactamente los índices canónicos');

  let connected = 0;
  const dryAdapter = {
    async connect() {
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
  ok('dry-run predeterminado no conecta ni escribe');

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
      error?.code ===
      'MANUAL_PAYMENT_INDEX_MIGRATION_PRODUCTION_CONFIRMATION_REQUIRED'
  );
  assert.equal(connected, 0);
  ok('producción exige apply y segunda confirmación antes de conectar');

  const collection = new FakeCollection();
  let disconnected = 0;
  const applyAdapter = {
    connection: {
      collection(name) {
        assert.equal(name, 'manual_payment_confirmations');
        return collection;
      },
    },
    async connect(_uri, options) {
      connected += 1;
      assert.equal(options.autoIndex, false);
    },
    async disconnect() {
      disconnected += 1;
    },
  };
  const applied = await runMigration({
    argv: [APPLY_FLAG, PRODUCTION_CONFIRMATION_FLAG],
    nodeEnv: 'production',
    mongoUri: 'mongodb://fixture/manual-payment-evidence',
    mongooseAdapter: applyAdapter,
  });
  assert.equal(applied.mode, 'apply');
  assert.deepEqual(collection.calls, plan);
  assert.equal(disconnected, 1);
  ok('apply usa createIndex con la colección y definiciones exactas');

  await createManualPaymentConfirmationIndexes(collection);
  assert.equal(collection.calls.length, plan.length * 2);
  assert.equal(collection.indexes.size, plan.length);
  ok('repetir la migración conserva los mismos índices por nombre');

  assert.throws(
    () => parseArguments(['--unknown']),
    (error) => error?.code === 'MANUAL_PAYMENT_INDEX_MIGRATION_UNKNOWN_ARGUMENT'
  );
  const source = fs.readFileSync(
    path.join(__dirname, 'migrateManualPaymentConfirmationIndexes.js'),
    'utf8'
  );
  ['.syncIndexes(', '.dropIndex(', '.dropIndexes(', '.delete'].forEach(
    (forbidden) => assert.equal(source.includes(forbidden), false, forbidden)
  );
  ok('argumentos desconocidos y operaciones destructivas quedan bloqueados');

  console.log(`RESULTADO: ${checks.length}/${checks.length} controles aprobados.`);
}

main().catch((error) => {
  console.error('FAIL migración de índices de evidencia manual');
  console.error(error);
  process.exitCode = 1;
});
