'use strict';

const mongoose = require('mongoose');
const { env } = require('../config/env');
const {
  ProductCodeMigrationError,
  assertMigrationMode,
  assertWriteSafety,
  runProductCommercialCodeMigration,
} = require('../services/productCommercialCodeIndexMigrationService');

function parseArguments(argv = []) {
  const options = {
    mode: 'audit',
    apply: false,
    allowProduction: false,
    confirmDatabase: '',
    batchSize: 100,
  };
  for (const argument of argv) {
    if (!argument.startsWith('--') && options.mode === 'audit') {
      options.mode = argument;
      continue;
    }
    if (argument === '--apply') {
      options.apply = true;
      continue;
    }
    if (argument === '--allow-production-migration') {
      options.allowProduction = true;
      continue;
    }
    if (argument.startsWith('--mode=')) {
      options.mode = argument.slice('--mode='.length);
      continue;
    }
    if (argument.startsWith('--confirm-database=')) {
      options.confirmDatabase = argument.slice('--confirm-database='.length);
      continue;
    }
    if (argument.startsWith('--batch-size=')) {
      options.batchSize = Number(argument.slice('--batch-size='.length));
      continue;
    }
    throw new ProductCodeMigrationError(
      'UNKNOWN_MIGRATION_ARGUMENT',
      'Se recibio un argumento de migracion no permitido.'
    );
  }
  options.mode = assertMigrationMode(options.mode);
  if (
    !Number.isInteger(options.batchSize) ||
    options.batchSize < 1 ||
    options.batchSize > 1000
  ) {
    throw new ProductCodeMigrationError(
      'INVALID_BATCH_SIZE',
      'El tamano de lote debe ser un entero entre 1 y 1000.'
    );
  }
  return options;
}

function extractDatabaseNameFromMongoUri(uri) {
  const value = String(uri || '').trim();
  if (!/^mongodb(\+srv)?:\/\//i.test(value)) {
    throw new ProductCodeMigrationError(
      'MONGODB_CONFIGURATION_REQUIRED',
      'No existe una configuracion MongoDB valida para la migracion.'
    );
  }
  const withoutQuery = value.split('?')[0];
  const slash = withoutQuery.lastIndexOf('/');
  if (slash < 0 || slash === withoutQuery.length - 1) {
    throw new ProductCodeMigrationError(
      'DATABASE_NAME_REQUIRED',
      'La configuracion MongoDB debe incluir un nombre de base explicito.'
    );
  }
  let databaseName = '';
  try {
    databaseName = decodeURIComponent(withoutQuery.slice(slash + 1)).trim();
  } catch {
    throw new ProductCodeMigrationError(
      'DATABASE_NAME_INVALID',
      'El nombre configurado para la base no es valido.'
    );
  }
  if (!databaseName || /[\\/]/.test(databaseName)) {
    throw new ProductCodeMigrationError(
      'DATABASE_NAME_INVALID',
      'El nombre configurado para la base no es valido.'
    );
  }
  return databaseName;
}

function createMongoProductRepository(collection, { batchSize = 100 } = {}) {
  return {
    async *scanProducts() {
      const cursor = collection
        .find(
          {},
          {
            projection: {
              _id: 1,
              title: 1,
              sku: 1,
              barcode: 1,
              variants: 1,
              skuKeys: 1,
              barcodeKeys: 1,
            },
          }
        )
        .sort({ _id: 1 })
        .batchSize(batchSize);
      for await (const document of cursor) yield document;
    },

    async writeKeyBatch(operations) {
      if (!operations.length) return;
      const result = await collection.bulkWrite(
        operations.map((operation) => ({
          updateOne: {
            filter: operation.filter,
            update: operation.update,
          },
        })),
        { ordered: true }
      );
      if (Number(result.matchedCount || 0) !== operations.length) {
        throw new ProductCodeMigrationError(
          'BACKFILL_CONCURRENT_MODIFICATION',
          'El backfill detecto una modificacion concurrente y se detuvo de forma segura.'
        );
      }
    },

    async listIndexes() {
      return collection.listIndexes().toArray();
    },

    async createIndex(key, options) {
      return collection.createIndex(key, options);
    },
  };
}

function safeMigrationError(error) {
  if (error instanceof ProductCodeMigrationError) {
    return { code: error.code, message: error.message };
  }
  return {
    code: 'PRODUCT_CODE_MIGRATION_FAILED',
    message: 'La migracion no pudo completarse. Revisa el entorno de forma segura.',
  };
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArguments(argv);
  const databaseName = extractDatabaseNameFromMongoUri(env.mongoUri);
  assertWriteSafety({
    ...options,
    databaseName,
    nodeEnv: env.nodeEnv,
  });

  await mongoose.connect(env.mongoUri, {
    autoIndex: false,
    serverSelectionTimeoutMS: 10_000,
  });
  try {
    assertWriteSafety({
      ...options,
      databaseName: mongoose.connection.name,
      nodeEnv: env.nodeEnv,
    });
    const repository = createMongoProductRepository(
      mongoose.connection.collection('products'),
      { batchSize: options.batchSize }
    );
    const result = await runProductCommercialCodeMigration({
      mode: options.mode,
      repository,
      batchSize: options.batchSize,
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return result;
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch(async (error) => {
    const safe = safeMigrationError(error);
    process.stderr.write(`${JSON.stringify({ ok: false, ...safe })}\n`);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect().catch(() => null);
    }
    process.exitCode = 1;
  });
}

module.exports = {
  createMongoProductRepository,
  extractDatabaseNameFromMongoUri,
  main,
  parseArguments,
  safeMigrationError,
};
