'use strict';

require('dotenv').config({ quiet: true });

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { EJSON } = require('bson');

const {
  buildLegacyProductVariantMigrationPlan,
} = require('../services/legacyProductVariantMigrationService');

const ALLOWED_MODES = new Set(['audit', 'backup', 'apply', 'verify']);

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    mode: 'audit',
    confirmDatabase: '',
    backupFile: '',
    confirmApply: false,
  };
  for (const argument of argv) {
    if (argument.startsWith('--mode=')) options.mode = argument.slice(7);
    else if (argument.startsWith('--confirm-database=')) {
      options.confirmDatabase = argument.slice(19);
    } else if (argument.startsWith('--backup-file=')) {
      options.backupFile = argument.slice(14);
    } else if (argument === '--confirm-apply') {
      options.confirmApply = true;
    } else {
      throw new Error(`ARGUMENT_NOT_ALLOWED:${argument}`);
    }
  }
  if (!ALLOWED_MODES.has(options.mode)) throw new Error('MODE_NOT_ALLOWED');
  return options;
}

function assertDatabase(databaseName, options) {
  if (!databaseName) throw new Error('DATABASE_NAME_MISSING');
  if (
    ['backup', 'apply'].includes(options.mode) &&
    options.confirmDatabase !== databaseName
  ) {
    throw new Error('DATABASE_CONFIRMATION_MISMATCH');
  }
  if (options.mode === 'apply' && !options.confirmApply) {
    throw new Error('APPLY_CONFIRMATION_REQUIRED');
  }
}

function defaultBackupPath(databaseName) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return path.join(
    __dirname,
    '..',
    'backups',
    `legacy-product-variants-${databaseName}-${stamp}.ejson`
  );
}

function safeBackupPath(value, databaseName) {
  const root = path.resolve(__dirname, '..', 'backups');
  const target = path.resolve(value || defaultBackupPath(databaseName));
  if (!target.startsWith(`${root}${path.sep}`)) {
    throw new Error('BACKUP_PATH_OUTSIDE_APPROVED_DIRECTORY');
  }
  return { root, target };
}

function hashBackupPayload(payload) {
  return crypto.createHash('sha256').update(payload).digest('hex');
}

async function loadCollections(db) {
  const [products, inventoryStocks] = await Promise.all([
    db.collection('products').find({}).sort({ _id: 1 }).toArray(),
    db.collection('inventorystocks').find({}).sort({ _id: 1 }).toArray(),
  ]);
  return { products, inventoryStocks };
}

function createBackupDocument(databaseName, collections) {
  return {
    format: 'legacy-product-variant-backup-v1',
    database: databaseName,
    createdAt: new Date(),
    counts: {
      products: collections.products.length,
      inventoryStocks: collections.inventoryStocks.length,
    },
    collections,
  };
}

function writeBackup(databaseName, collections, requestedPath) {
  const { root, target } = safeBackupPath(requestedPath, databaseName);
  fs.mkdirSync(root, { recursive: true });
  const serialized = EJSON.stringify(
    createBackupDocument(databaseName, collections),
    { relaxed: false, indent: 2 }
  );
  fs.writeFileSync(target, serialized, { encoding: 'utf8', flag: 'wx' });
  return {
    path: target,
    sha256: hashBackupPayload(serialized),
    bytes: Buffer.byteLength(serialized),
  };
}

function validateBackup(filePath, databaseName, collections) {
  if (!filePath) throw new Error('BACKUP_FILE_REQUIRED');
  const { target } = safeBackupPath(filePath, databaseName);
  const serialized = fs.readFileSync(target, 'utf8');
  const backup = EJSON.parse(serialized);
  if (backup?.format !== 'legacy-product-variant-backup-v1') {
    throw new Error('BACKUP_FORMAT_INVALID');
  }
  if (backup.database !== databaseName) {
    throw new Error('BACKUP_DATABASE_MISMATCH');
  }
  if (
    Number(backup.counts?.products) !== collections.products.length ||
    Number(backup.counts?.inventoryStocks) !== collections.inventoryStocks.length
  ) {
    throw new Error('BACKUP_COUNTS_MISMATCH');
  }
  return {
    path: target,
    sha256: hashBackupPayload(serialized),
  };
}

async function applyPlan(db, plan) {
  if (plan.blockingConflicts.length) {
    throw new Error('BLOCKING_PRODUCT_VARIANT_COLLISIONS');
  }
  const session = mongoose.connection.client.startSession();
  try {
    await session.withTransaction(async () => {
      for (const update of plan.productUpdates) {
        const result = await db.collection('products').updateOne(
          { _id: update._id },
          { $set: { ...update.set, updatedAt: new Date() } },
          { session }
        );
        if (result.matchedCount !== 1) throw new Error('PRODUCT_UPDATE_MISSED');
      }
      for (const update of plan.inventoryStockUpdates) {
        const result = await db.collection('inventorystocks').updateOne(
          { _id: update._id },
          { $set: { ...update.set, updatedAt: new Date() } },
          { session }
        );
        if (result.matchedCount !== 1) throw new Error('STOCK_UPDATE_MISSED');
      }
    });
  } finally {
    await session.endSession();
  }
  return {
    productsUpdated: plan.productUpdates.length,
    inventoryStocksUpdated: plan.inventoryStockUpdates.length,
  };
}

async function main() {
  const options = parseArgs();
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI_MISSING');
  await mongoose.connect(process.env.MONGODB_URI, {
    autoIndex: false,
    serverSelectionTimeoutMS: 10_000,
  });
  const databaseName = mongoose.connection.name;
  assertDatabase(databaseName, options);
  const collections = await loadCollections(mongoose.connection.db);
  const plan = buildLegacyProductVariantMigrationPlan(collections);

  if (options.mode === 'backup') {
    const backup = writeBackup(
      databaseName,
      collections,
      options.backupFile
    );
    console.log(JSON.stringify({
      ok: true,
      mode: options.mode,
      database: databaseName,
      counts: {
        products: collections.products.length,
        inventoryStocks: collections.inventoryStocks.length,
      },
      backup,
      dryRunSummary: plan.summary,
    }, null, 2));
    return;
  }

  if (options.mode === 'apply') {
    const backup = validateBackup(
      options.backupFile,
      databaseName,
      collections
    );
    const applied = await applyPlan(mongoose.connection.db, plan);
    const afterCollections = await loadCollections(mongoose.connection.db);
    const after = buildLegacyProductVariantMigrationPlan(afterCollections);
    if (
      after.summary.productsToUpdate !== 0 ||
      after.summary.inventoryStocksToUpdate !== 0 ||
      after.summary.blockingConflicts !== 0
    ) {
      throw new Error('POST_APPLY_VERIFICATION_FAILED');
    }
    console.log(JSON.stringify({
      ok: true,
      mode: options.mode,
      database: databaseName,
      backup,
      before: plan.summary,
      applied,
      after: after.summary,
      productReports: plan.productReports,
      equivalentStockGroups: plan.collisions.filter(
        (entry) => entry.type === 'INVENTORY_STOCK_EQUIVALENT_ROWS'
      ),
    }, null, 2));
    return;
  }

  const ok =
    options.mode === 'audit' ||
    (plan.summary.productsToUpdate === 0 &&
      plan.summary.inventoryStocksToUpdate === 0 &&
      plan.summary.blockingConflicts === 0);
  console.log(JSON.stringify({
    ok,
    mode: options.mode,
    database: databaseName,
    dryRun: true,
    summary: plan.summary,
    productReports: plan.productReports,
    collisions: plan.collisions,
  }, null, 2));
  if (!ok) process.exitCode = 2;
}

main()
  .catch((error) => {
    console.error(JSON.stringify({
      ok: false,
      error: error.message,
    }));
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
