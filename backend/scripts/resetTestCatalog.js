'use strict';

require('dotenv').config({
  path: require('path').join(__dirname, '..', '.env'),
  quiet: true,
});

const path = require('path');
const { spawnSync } = require('child_process');
const mongoose = require('mongoose');

const Product = require('../models/Product');
const InventoryStock = require('../models/InventoryStock');
const InventoryMovement = require('../models/InventoryMovement');
const InventoryReservation = require('../models/InventoryReservation');
const Cart = require('../models/Cart');
const Favorite = require('../models/Favorite');

const CONFIRMATION = '--confirm-test-catalog-reset';

function assertSafeExecution(argv = process.argv.slice(2)) {
  if (!argv.includes(CONFIRMATION)) {
    throw new Error('TEST_CATALOG_RESET_CONFIRMATION_REQUIRED');
  }
  if (argv.some((argument) => argument !== CONFIRMATION)) {
    throw new Error('TEST_CATALOG_RESET_ARGUMENT_NOT_ALLOWED');
  }
  if (String(process.env.NODE_ENV || '').trim().toLowerCase() === 'production') {
    throw new Error('TEST_CATALOG_RESET_BLOCKED_IN_PRODUCTION');
  }
  if (!String(process.env.MONGODB_URI || '').trim()) {
    throw new Error('MONGODB_URI_MISSING');
  }
}

async function resetTestCatalog() {
  assertSafeExecution();
  await mongoose.connect(process.env.MONGODB_URI, {
    autoIndex: false,
    serverSelectionTimeoutMS: 10_000,
  });
  const databaseName = mongoose.connection.name || '';

  const before = {
    products: await Product.countDocuments({}),
    inventoryStocks: await InventoryStock.countDocuments({}),
    inventoryMovements: await InventoryMovement.countDocuments({}),
    inventoryReservations: await InventoryReservation.countDocuments({}),
    carts: await Cart.countDocuments({}),
    favorites: await Favorite.countDocuments({}),
  };

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await InventoryReservation.deleteMany({}, { session });
      await InventoryMovement.deleteMany({}, { session });
      await InventoryStock.deleteMany({}, { session });
      await Cart.deleteMany({}, { session });
      await Favorite.deleteMany({}, { session });
      await Product.deleteMany({}, { session });
    });
  } finally {
    await session.endSession();
    await mongoose.disconnect();
  }

  console.log(JSON.stringify({
    ok: true,
    action: 'test_catalog_cleared',
    database: databaseName,
    deleted: before,
  }, null, 2));

  const seed = spawnSync(
    process.execPath,
    [path.join(__dirname, 'seedDemonstrationProducts.js')],
    {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit',
      env: {
        ...process.env,
        PRODUCT_TEST_SKIP_ADMIN_ENDPOINT: '1',
      },
    }
  );
  if (seed.error) throw seed.error;
  if (seed.status !== 0) throw new Error('DEMONSTRATION_CATALOG_RESEED_FAILED');
}

if (require.main === module) {
  resetTestCatalog().catch(async (error) => {
    await mongoose.disconnect().catch(() => {});
    console.error(JSON.stringify({ ok: false, error: error.message }));
    process.exitCode = 1;
  });
}

module.exports = {
  CONFIRMATION,
  assertSafeExecution,
  resetTestCatalog,
};
