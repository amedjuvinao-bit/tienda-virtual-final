'use strict';

const mongoose = require('mongoose');
const { env } = require('../config/env');
const {
  FINANCE_BUDGET_INDEX_DEFINITIONS,
  FINANCE_COST_CENTER_INDEX_DEFINITIONS,
  FINANCE_EXPENSE_BUDGET_INDEX_DEFINITIONS,
} = require('../models/financeBudgetIndexDefinitions');
const {
  applyCanonicalIndexes,
} = require('../services/indexMigrations/canonicalIndexMigration');

const APPLY_FLAG = '--apply-finance-budget-index-migration';
const PRODUCTION_CONFIRMATION_FLAG =
  '--confirm-production-finance-budget-index-migration';
const CODE_PREFIX = 'FINANCE_BUDGET_INDEX_MIGRATION';

const COLLECTIONS = Object.freeze([
  Object.freeze({
    collection: 'financecostcenters',
    definitions: FINANCE_COST_CENTER_INDEX_DEFINITIONS,
  }),
  Object.freeze({
    collection: 'financebudgets',
    definitions: FINANCE_BUDGET_INDEX_DEFINITIONS,
  }),
  Object.freeze({
    collection: 'financeexpenses',
    definitions: FINANCE_EXPENSE_BUDGET_INDEX_DEFINITIONS,
  }),
]);

function parseArguments(argv = []) {
  const allowed = new Set([APPLY_FLAG, PRODUCTION_CONFIRMATION_FLAG]);
  const unknown = argv.find((argument) => !allowed.has(argument));
  if (unknown) {
    const error = new Error('Se recibió un argumento no permitido para la migración.');
    error.code = `${CODE_PREFIX}_UNKNOWN_ARGUMENT`;
    throw error;
  }
  return {
    apply: argv.includes(APPLY_FLAG),
    confirmProduction: argv.includes(PRODUCTION_CONFIRMATION_FLAG),
  };
}

function assertWriteAuthorization({ apply, confirmProduction, nodeEnv } = {}) {
  if (!apply) return;
  if (
    String(nodeEnv || '').trim().toLowerCase() === 'production' &&
    !confirmProduction
  ) {
    const error = new Error(
      `En producción también se requiere ${PRODUCTION_CONFIRMATION_FLAG}.`
    );
    error.code = `${CODE_PREFIX}_PRODUCTION_CONFIRMATION_REQUIRED`;
    throw error;
  }
}

function buildMigrationPlan() {
  return COLLECTIONS.map(({ collection, definitions }) => ({
    collection,
    indexCount: definitions.length,
    indexes: definitions.map((definition) => ({
      key: { ...definition.key },
      options: { ...definition.options },
    })),
  }));
}

async function main(
  argv = process.argv.slice(2),
  {
    nodeEnv = env.nodeEnv,
    mongoUri = env.mongoUri,
    mongooseAdapter = mongoose,
    writeOutput = (value) => process.stdout.write(value),
  } = {}
) {
  const options = parseArguments(argv);
  assertWriteAuthorization({ ...options, nodeEnv });
  const collections = buildMigrationPlan();
  const base = {
    ok: true,
    mode: options.apply ? 'apply' : 'dry-run',
    collectionCount: collections.length,
    indexCount: collections.reduce((sum, item) => sum + item.indexCount, 0),
    collections,
    destructiveOperations: [],
  };
  if (!options.apply) {
    const result = { ...base, mutations: 0 };
    writeOutput(`${JSON.stringify(result, null, 2)}\n`);
    return result;
  }

  if (!/^mongodb(?:\+srv)?:\/\//i.test(String(mongoUri || '').trim())) {
    const error = new Error('MONGODB_URI debe estar configurada para aplicar la migración.');
    error.code = `${CODE_PREFIX}_MONGODB_URI_REQUIRED`;
    throw error;
  }

  await mongooseAdapter.connect(mongoUri, {
    autoIndex: false,
    serverSelectionTimeoutMS: 10_000,
  });
  try {
    const outcomes = [];
    for (const item of COLLECTIONS) {
      const outcome = await applyCanonicalIndexes({
        collection: mongooseAdapter.connection.collection(item.collection),
        definitions: item.definitions,
        codePrefix: CODE_PREFIX,
      });
      outcomes.push({ collection: item.collection, ...outcome });
    }
    const result = {
      ...base,
      outcomes,
      mutations: outcomes.reduce((sum, item) => sum + item.mutations, 0),
      status: outcomes.every((item) => item.status === 'already_present')
        ? 'already_present'
        : 'created',
    };
    writeOutput(`${JSON.stringify(result, null, 2)}\n`);
    return result;
  } finally {
    await mongooseAdapter.disconnect();
  }
}

function safeError(error) {
  return {
    code: error?.code || `${CODE_PREFIX}_FAILED`,
    message: error?.code
      ? error.message
      : 'No fue posible completar la migración de índices presupuestales.',
    ...(error?.details ? { details: error.details } : {}),
  };
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
  assertWriteAuthorization,
  buildMigrationPlan,
  main,
  parseArguments,
  safeError,
};
