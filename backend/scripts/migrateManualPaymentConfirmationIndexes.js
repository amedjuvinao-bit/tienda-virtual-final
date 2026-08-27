'use strict';

const mongoose = require('mongoose');
const { env } = require('../config/env');
const {
  MANUAL_PAYMENT_CONFIRMATION_INDEX_DEFINITIONS,
} = require('../services/manualPaymentConfirmation/indexDefinitions');

const APPLY_FLAG = '--apply-manual-payment-confirmation-index-migration';
const PRODUCTION_CONFIRMATION_FLAG =
  '--confirm-production-manual-payment-confirmation-index-migration';

class ManualPaymentIndexMigrationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ManualPaymentIndexMigrationError';
    this.code = code;
  }
}

function cloneDefinition(definition) {
  return {
    key: { ...definition.key },
    options: { ...definition.options },
  };
}

function parseArguments(argv = []) {
  const allowed = new Set([APPLY_FLAG, PRODUCTION_CONFIRMATION_FLAG]);
  const unknown = argv.find((argument) => !allowed.has(argument));
  if (unknown) {
    throw new ManualPaymentIndexMigrationError(
      'MANUAL_PAYMENT_INDEX_MIGRATION_UNKNOWN_ARGUMENT',
      'Se recibió un argumento no permitido para la migración de evidencia manual.'
    );
  }
  return {
    apply: argv.includes(APPLY_FLAG),
    confirmProduction: argv.includes(PRODUCTION_CONFIRMATION_FLAG),
  };
}

function assertWriteAuthorization({ apply, confirmProduction, nodeEnv } = {}) {
  if (!apply) return;
  const production = String(nodeEnv || '').trim().toLowerCase() === 'production';
  if (production && !confirmProduction) {
    throw new ManualPaymentIndexMigrationError(
      'MANUAL_PAYMENT_INDEX_MIGRATION_PRODUCTION_CONFIRMATION_REQUIRED',
      `En producción también se requiere ${PRODUCTION_CONFIRMATION_FLAG}.`
    );
  }
}

function buildMigrationPlan() {
  return MANUAL_PAYMENT_CONFIRMATION_INDEX_DEFINITIONS.map(cloneDefinition);
}

async function createManualPaymentConfirmationIndexes(collection) {
  if (!collection || typeof collection.createIndex !== 'function') {
    throw new TypeError('MANUAL_PAYMENT_CONFIRMATION_COLLECTION_REQUIRED');
  }
  const created = [];
  for (const definition of buildMigrationPlan()) {
    const name = await collection.createIndex(
      definition.key,
      definition.options
    );
    created.push(name || definition.options.name);
  }
  return created;
}

function safeError(error) {
  if (error instanceof ManualPaymentIndexMigrationError) {
    return { code: error.code, message: error.message };
  }
  return {
    code: 'MANUAL_PAYMENT_INDEX_MIGRATION_FAILED',
    message: 'No fue posible crear los índices de evidencia de pago manual.',
  };
}

async function runMigration({
  argv = process.argv.slice(2),
  nodeEnv = env.nodeEnv,
  mongoUri = env.mongoUri,
  mongooseAdapter = mongoose,
} = {}) {
  const options = parseArguments(argv);
  const plan = buildMigrationPlan();
  assertWriteAuthorization({ ...options, nodeEnv });
  if (!options.apply) {
    return {
      ok: true,
      mode: 'dry-run',
      collection: 'manual_payment_confirmations',
      indexCount: plan.length,
      indexes: plan,
    };
  }

  await mongooseAdapter.connect(mongoUri, {
    autoIndex: false,
    serverSelectionTimeoutMS: 10_000,
  });
  try {
    const collection = mongooseAdapter.connection.collection(
      'manual_payment_confirmations'
    );
    const created = await createManualPaymentConfirmationIndexes(collection);
    return {
      ok: true,
      mode: 'apply',
      collection: 'manual_payment_confirmations',
      indexCount: plan.length,
      indexes: plan,
      created,
    };
  } finally {
    await mongooseAdapter.disconnect();
  }
}

async function main(argv = process.argv.slice(2)) {
  const result = await runMigration({ argv });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result;
}

if (require.main === module) {
  main().catch(async (error) => {
    process.stderr.write(`${JSON.stringify({ ok: false, ...safeError(error) })}\n`);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect().catch(() => null);
    }
    process.exitCode = 1;
  });
}

module.exports = {
  APPLY_FLAG,
  PRODUCTION_CONFIRMATION_FLAG,
  ManualPaymentIndexMigrationError,
  assertWriteAuthorization,
  buildMigrationPlan,
  createManualPaymentConfirmationIndexes,
  parseArguments,
  runMigration,
  safeError,
};
