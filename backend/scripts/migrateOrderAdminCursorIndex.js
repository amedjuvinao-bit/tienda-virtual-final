'use strict';

const mongoose = require('mongoose');
const { env } = require('../config/env');
const {
  ORDER_ADMIN_CURSOR_INDEX_DEFINITION,
} = require('../models/order/orderAdminIndexDefinitions');

const APPLY_FLAG = '--apply-order-admin-cursor-index-migration';
const PRODUCTION_CONFIRMATION_FLAG =
  '--confirm-production-order-admin-cursor-index-migration';

class OrderAdminCursorIndexMigrationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'OrderAdminCursorIndexMigrationError';
    this.code = code;
  }
}

function cloneDefinition() {
  return {
    key: { ...ORDER_ADMIN_CURSOR_INDEX_DEFINITION.key },
    options: { ...ORDER_ADMIN_CURSOR_INDEX_DEFINITION.options },
  };
}

function parseArguments(argv = []) {
  const allowed = new Set([APPLY_FLAG, PRODUCTION_CONFIRMATION_FLAG]);
  if (argv.some((argument) => !allowed.has(argument))) {
    throw new OrderAdminCursorIndexMigrationError(
      'ORDER_ADMIN_CURSOR_INDEX_MIGRATION_UNKNOWN_ARGUMENT',
      'Se recibió un argumento no permitido para la migración del índice.'
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
    throw new OrderAdminCursorIndexMigrationError(
      'ORDER_ADMIN_CURSOR_INDEX_PRODUCTION_CONFIRMATION_REQUIRED',
      `En producción también se requiere ${PRODUCTION_CONFIRMATION_FLAG}.`
    );
  }
}

async function createOrderAdminCursorIndex(collection) {
  if (!collection || typeof collection.createIndex !== 'function') {
    throw new TypeError('ORDER_COLLECTION_REQUIRED');
  }
  const definition = cloneDefinition();
  return collection.createIndex(definition.key, definition.options);
}

function safeError(error) {
  if (error instanceof OrderAdminCursorIndexMigrationError) {
    return { code: error.code, message: error.message };
  }
  return {
    code: 'ORDER_ADMIN_CURSOR_INDEX_MIGRATION_FAILED',
    message: 'No fue posible crear el índice de paginación de Órdenes.',
  };
}

async function runMigration({
  argv = process.argv.slice(2),
  nodeEnv = env.nodeEnv,
  mongoUri = env.mongoUri,
  mongooseAdapter = mongoose,
} = {}) {
  const options = parseArguments(argv);
  const index = cloneDefinition();
  assertWriteAuthorization({ ...options, nodeEnv });
  if (!options.apply) {
    return {
      ok: true,
      mode: 'dry-run',
      collection: 'orders',
      index,
    };
  }

  await mongooseAdapter.connect(mongoUri, {
    autoIndex: false,
    serverSelectionTimeoutMS: 10_000,
  });
  try {
    const collection = mongooseAdapter.connection.collection('orders');
    const created = await createOrderAdminCursorIndex(collection);
    return {
      ok: true,
      mode: 'apply',
      collection: 'orders',
      index,
      created: created || index.options.name,
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
  OrderAdminCursorIndexMigrationError,
  assertWriteAuthorization,
  cloneDefinition,
  createOrderAdminCursorIndex,
  parseArguments,
  runMigration,
  safeError,
};
