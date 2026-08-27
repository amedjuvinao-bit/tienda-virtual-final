'use strict';

const path = require('path');

require('dotenv').config({
  path: path.resolve(__dirname, '..', '.env'),
  override: false,
  quiet: true,
});

const mongoose = require('mongoose');
const {
  OrderActivityIndexMigrationError,
  assertOrderActivityIndexMigrationSafety,
  createMongoOrderActivityIndexRepository,
  migrationPlan,
  runOrderActivityIndexMigration,
} = require('../services/orderActivityIndexMigrationService');

const APPLY_FLAG = '--apply-order-activity-index-migration';
const PRODUCTION_FLAG = '--allow-production-order-activity-index-migration';

function parseArguments(argv = []) {
  const options = { apply: false, allowProduction: false };
  for (const argument of argv) {
    if (argument === APPLY_FLAG) {
      options.apply = true;
      continue;
    }
    if (argument === PRODUCTION_FLAG) {
      options.allowProduction = true;
      continue;
    }
    throw new OrderActivityIndexMigrationError(
      'UNKNOWN_ORDER_ACTIVITY_INDEX_ARGUMENT',
      `Argumento no permitido: ${String(argument || '(vacío)')}`
    );
  }
  return options;
}

function requireMongoUri(value) {
  const uri = String(value || '').trim();
  if (!/^mongodb(?:\+srv)?:\/\//i.test(uri)) {
    throw new OrderActivityIndexMigrationError(
      'ORDER_ACTIVITY_INDEX_MONGODB_URI_REQUIRED',
      'MONGODB_URI debe estar configurada para aplicar la migración.'
    );
  }
  return uri;
}

async function main(
  argv = process.argv.slice(2),
  {
    nodeEnv = process.env.NODE_ENV,
    mongoUri = process.env.MONGODB_URI,
    mongooseInstance = mongoose,
    writeOutput = (value) => process.stdout.write(value),
  } = {}
) {
  const options = parseArguments(argv);
  if (!options.apply) {
    const result = {
      ...migrationPlan({ ...options, nodeEnv }),
      status: 'planned',
      mutations: 0,
    };
    writeOutput(`${JSON.stringify(result, null, 2)}\n`);
    return result;
  }

  assertOrderActivityIndexMigrationSafety({ ...options, nodeEnv });
  const uri = requireMongoUri(mongoUri);
  await mongooseInstance.connect(uri, {
    autoIndex: false,
    serverSelectionTimeoutMS: 10_000,
  });
  try {
    const repository = createMongoOrderActivityIndexRepository(
      mongooseInstance.connection
    );
    const result = await runOrderActivityIndexMigration({
      ...options,
      nodeEnv,
      repository,
    });
    writeOutput(`${JSON.stringify(result, null, 2)}\n`);
    return result;
  } finally {
    await mongooseInstance.disconnect();
  }
}

if (require.main === module) {
  main().catch(async (error) => {
    const result = {
      ok: false,
      code: error?.code || 'ORDER_ACTIVITY_INDEX_MIGRATION_FAILED',
      message:
        error instanceof OrderActivityIndexMigrationError
          ? error.message
          : 'La migración de índices de actividad no pudo completarse.',
    };
    process.stderr.write(`${JSON.stringify(result)}\n`);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect().catch(() => null);
    }
    process.exitCode = 1;
  });
}

module.exports = {
  APPLY_FLAG,
  PRODUCTION_FLAG,
  main,
  parseArguments,
  requireMongoUri,
};
