'use strict';

require('dotenv').config({ quiet: true });

const fs = require('fs');
const mongoose = require('mongoose');
const { EJSON } = require('bson');
const {
  buildLegacyProductVariantMigrationPlan,
} = require('../services/legacyProductVariantMigrationService');

const AFFECTED_PRODUCT_IDS = Object.freeze([
  '68a3f2651ac7b28bef91f845',
  '68a4a78a59706e44cade0316',
  '68a4cd205aa0cee56f9977b8',
  '68a4e7bf1137c6e9120df0ae',
  '68a62e6e2705a006a538fff2',
  '69b34cf1f2ea55862e7e71d4',
  '69dedf6392f35322409f21c8',
  '69ea8e627664910eeae77e56',
]);
const EXPECTED_EXTRA_STOCK_ROWS = 86;
const EXPECTED_EXTRA_MOVEMENTS = 37;

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    confirmDatabase: '',
    backupFile: '',
    confirmRestore: false,
  };
  for (const argument of argv) {
    if (argument.startsWith('--confirm-database=')) {
      options.confirmDatabase = argument.slice(19);
    } else if (argument.startsWith('--backup-file=')) {
      options.backupFile = argument.slice(14);
    } else if (argument === '--confirm-restore') {
      options.confirmRestore = true;
    } else {
      throw new Error(`ARGUMENT_NOT_ALLOWED:${argument}`);
    }
  }
  if (!options.confirmRestore) throw new Error('RESTORE_CONFIRMATION_REQUIRED');
  if (!options.backupFile) throw new Error('BACKUP_FILE_REQUIRED');
  return options;
}

function clone(value) {
  return EJSON.parse(EJSON.stringify(value, { relaxed: false }));
}

function applySet(target, set = {}) {
  for (const [field, value] of Object.entries(set)) {
    target[field] = clone(value);
  }
}

async function main() {
  const options = parseArgs();
  const backup = EJSON.parse(fs.readFileSync(options.backupFile, 'utf8'));
  if (backup?.format !== 'legacy-product-variant-backup-v1') {
    throw new Error('BACKUP_FORMAT_INVALID');
  }
  if (backup.database !== options.confirmDatabase) {
    throw new Error('BACKUP_DATABASE_MISMATCH');
  }

  await mongoose.connect(process.env.MONGODB_URI, {
    autoIndex: false,
    serverSelectionTimeoutMS: 10_000,
  });
  if (mongoose.connection.name !== options.confirmDatabase) {
    throw new Error('DATABASE_CONFIRMATION_MISMATCH');
  }

  const db = mongoose.connection.db;
  const affectedSet = new Set(AFFECTED_PRODUCT_IDS);
  const affectedObjectIds = AFFECTED_PRODUCT_IDS.map(
    (id) => new mongoose.Types.ObjectId(id)
  );
  const backupProducts = backup.collections.products;
  const backupStocks = backup.collections.inventoryStocks;
  const backupStockIds = new Set(backupStocks.map((row) => String(row._id)));
  const expectedProducts = new Map(
    backupProducts
      .filter((product) => affectedSet.has(String(product._id)))
      .map((product) => [String(product._id), clone(product)])
  );
  const expectedStocks = new Map(
    backupStocks
      .filter((stock) => affectedSet.has(String(stock.product)))
      .map((stock) => [String(stock._id), clone(stock)])
  );

  const canonicalPlan = buildLegacyProductVariantMigrationPlan({
    products: backupProducts,
    inventoryStocks: backupStocks,
    now: new Date(backup.createdAt),
  });
  for (const update of canonicalPlan.productUpdates) {
    const target = expectedProducts.get(update.productId);
    if (target) applySet(target, update.set);
  }
  for (const update of canonicalPlan.inventoryStockUpdates) {
    const target = expectedStocks.get(update.stockId);
    if (target) applySet(target, update.set);
  }

  if (expectedProducts.size !== AFFECTED_PRODUCT_IDS.length) {
    throw new Error('BACKUP_AFFECTED_PRODUCTS_INCOMPLETE');
  }

  const currentStocks = await db.collection('inventorystocks').find({
    product: { $in: affectedObjectIds },
  }).toArray();
  const extraStocks = currentStocks.filter(
    (stock) => !backupStockIds.has(String(stock._id))
  );
  if (extraStocks.length !== EXPECTED_EXTRA_STOCK_ROWS) {
    throw new Error(
      `UNEXPECTED_EXTRA_STOCK_COUNT:${extraStocks.length}`
    );
  }
  const createdTimes = extraStocks.map((stock) => new Date(stock.createdAt).getTime());
  const start = new Date(Math.min(...createdTimes) - 1_000);
  const end = new Date(Math.max(...createdTimes) + 5_000);
  const movements = await db.collection('inventorymovements').find({
    product: { $in: affectedObjectIds },
    type: 'initial_stock',
    reason: 'Carga inicial desde catálogo de productos',
    createdBy: null,
    createdAt: { $gte: start, $lte: end },
  }).toArray();
  if (movements.length !== EXPECTED_EXTRA_MOVEMENTS) {
    throw new Error(
      `UNEXPECTED_EXTRA_MOVEMENT_COUNT:${movements.length}`
    );
  }

  const session = mongoose.connection.client.startSession();
  try {
    await session.withTransaction(async () => {
      for (const product of expectedProducts.values()) {
        const result = await db.collection('products').replaceOne(
          { _id: product._id },
          product,
          { session }
        );
        if (result.matchedCount !== 1) throw new Error('PRODUCT_RESTORE_MISSED');
      }
      for (const stock of expectedStocks.values()) {
        const result = await db.collection('inventorystocks').replaceOne(
          { _id: stock._id },
          stock,
          { session }
        );
        if (result.matchedCount !== 1) throw new Error('STOCK_RESTORE_MISSED');
      }
      await db.collection('inventorymovements').deleteMany(
        { _id: { $in: movements.map((movement) => movement._id) } },
        { session }
      );
      await db.collection('inventorystocks').deleteMany(
        { _id: { $in: extraStocks.map((stock) => stock._id) } },
        { session }
      );
    });
  } finally {
    await session.endSession();
  }

  const [remainingExtraStocks, remainingExtraMovements, restoredProducts] =
    await Promise.all([
      db.collection('inventorystocks').countDocuments({
        _id: { $in: extraStocks.map((stock) => stock._id) },
      }),
      db.collection('inventorymovements').countDocuments({
        _id: { $in: movements.map((movement) => movement._id) },
      }),
      db.collection('products').find({
        _id: { $in: affectedObjectIds },
      }).toArray(),
    ]);
  const nonEmptyVariants = restoredProducts.filter(
    (product) => Array.isArray(product.variants) && product.variants.length > 0
  );
  if (remainingExtraStocks || remainingExtraMovements || nonEmptyVariants.length) {
    throw new Error('RESTORE_POSTCHECK_FAILED');
  }

  console.log(JSON.stringify({
    ok: true,
    database: mongoose.connection.name,
    productsRestored: restoredProducts.length,
    stockRowsRestored: expectedStocks.size,
    generatedStockRowsRemoved: extraStocks.length,
    generatedMovementsRemoved: movements.length,
    remainingGeneratedStockRows: remainingExtraStocks,
    remainingGeneratedMovements: remainingExtraMovements,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(JSON.stringify({ ok: false, error: error.message }));
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
