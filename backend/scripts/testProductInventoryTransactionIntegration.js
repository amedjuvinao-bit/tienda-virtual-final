/* eslint-disable no-console */

'use strict';

require('dotenv').config({
  path: require('path').join(__dirname, '..', '.env'),
  quiet: true,
});

const mongoose = require('mongoose');

const Product = require('../models/Product');
const Branch = require('../models/Branch');
const InventoryStock = require('../models/InventoryStock');
const InventoryMovement = require('../models/InventoryMovement');
const {
  saveProductWithInventoryTransaction,
} = require('../services/productInventoryPersistenceService');

const RUN_ID = Math.random()
  .toString(36)
  .slice(2, 10)
  .toUpperCase();
const SUCCESS_SKU = `TX-PROD-${RUN_ID}`;
const ROLLBACK_SKU = `TX-ROLL-${RUN_ID}`;
const BASE_TITLE = `Producto transaccional ${RUN_ID}`;
const UPDATED_TITLE = `Producto transaccional actualizado ${RUN_ID}`;

let passed = 0;
let createdBranchId = null;
const productIds = new Set();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function ok(message) {
  passed += 1;
  console.log(`OK  ${message}`);
}

function getMongoUri() {
  return (
    process.env.PRODUCTS_TEST_MONGO_URI ||
    process.env.MONGODB_URI ||
    ''
  ).trim();
}

async function ensureBranch() {
  const existing = await Branch.findOne({
    deletedAt: null,
    active: true,
    status: 'active',
  })
    .sort({
      isMain: -1,
      isDefaultForOnlineOrders: -1,
      createdAt: 1,
    })
    .lean();

  if (existing?._id) return existing;

  const branch = await Branch.create({
    name: `Sede transaccional ${RUN_ID}`,
    code: `TX${RUN_ID}`.slice(0, 40),
    type: 'store',
    status: 'active',
    active: true,
    isMain: true,
    isDefaultForOnlineOrders: true,
    notes: 'Sede temporal de prueba Producto–Inventario.',
  });

  createdBranchId = branch._id;
  return branch.toObject();
}

function buildProduct({
  sku,
  title,
  color = 'Azul',
  size = 'Única',
  stock = 4,
}) {
  return new Product({
    sku,
    title,
    description:
      'Producto temporal para validar atomicidad entre catálogo e inventario.',
    productType: 'physical',
    unitOfMeasure: 'unit',
    trackInventory: true,
    allowBackorder: false,
    variantPreset: 'generic',
    variantAxes: [
      {
        key: 'presentacion',
        label: 'Presentación',
        values: [size],
      },
      {
        key: 'color',
        label: 'Color',
        values: [color],
      },
    ],
    category: 'Pruebas transaccionales',
    categories: ['Pruebas transaccionales'],
    price: 100000,
    cost: 45000,
    averageCost: 45000,
    reorderPoint: 1,
    reorderQty: 4,
    sizes: [size],
    colors: [color],
    inventory: [{ size, color, stock }],
    variants: [
      {
        size,
        color,
        label: `${size} / ${color}`,
        sku: `${sku}-BASE`,
        price: 100000,
        cost: 45000,
        initialStock: stock,
        active: true,
      },
    ],
    stock,
    active: true,
    visible: true,
  });
}

function injectStockSaveFailure(productId, predicate) {
  const originalSave = InventoryStock.prototype.save;

  InventoryStock.prototype.save = async function injectedSave(
    ...args
  ) {
    if (
      String(this.product || '') === String(productId) &&
      predicate(this)
    ) {
      throw new Error(
        'Fallo controlado de InventoryStock para probar rollback.'
      );
    }

    return originalSave.apply(this, args);
  };

  return () => {
    InventoryStock.prototype.save = originalSave;
  };
}

async function expectFailure(work) {
  try {
    await work();
  } catch (error) {
    assert(
      String(error?.message || '').includes(
        'Fallo controlado de InventoryStock'
      ),
      `Falló por una causa inesperada: ${error?.message || error}`
    );
    return error;
  }

  throw new Error(
    'La operación devolvió éxito aunque InventoryStock falló.'
  );
}

async function cleanup({ removeBranch = true } = {}) {
  const ids = [...productIds];

  if (ids.length) {
    await InventoryMovement.deleteMany({
      sourceModel: 'Product',
      sourceId: { $in: ids },
    });
    await InventoryStock.deleteMany({
      product: { $in: ids },
    });
    await Product.deleteMany({ _id: { $in: ids } });
  }

  await Product.deleteMany({
    sku: { $in: [SUCCESS_SKU, ROLLBACK_SKU] },
  });

  if (removeBranch && createdBranchId) {
    await Branch.deleteOne({ _id: createdBranchId });
    createdBranchId = null;
  }
}

async function run() {
  const mongoUri = getMongoUri();
  assert(
    mongoUri,
    'PRODUCTS_TEST_MONGO_URI o MONGODB_URI no está configurado.'
  );

  await mongoose.connect(mongoUri);
  ok('Conexión a MongoDB transaccional activa');

  await cleanup({ removeBranch: false });
  await ensureBranch();
  ok('Existe una sede activa para el inventario');

  const product = buildProduct({
    sku: SUCCESS_SKU,
    title: BASE_TITLE,
  });
  productIds.add(product._id);

  const saved = await saveProductWithInventoryTransaction(
    product,
    { variantsAuthoritative: true }
  );
  assert(saved?._id, 'No se confirmó el producto inicial.');
  ok('La creación confirma Product e InventoryStock juntos');

  let stockRows = await InventoryStock.find({
    product: product._id,
    deletedAt: null,
  }).lean();
  assert(
    stockRows.length === 1 &&
      Number(stockRows[0].stock || 0) === 4,
    'El inventario inicial no quedó completo.'
  );
  ok('La existencia inicial quedó en InventoryStock');

  const initialMovement = await InventoryMovement.findOne({
    sourceModel: 'Product',
    sourceId: product._id,
    type: 'initial_stock',
  }).lean();
  assert(
    initialMovement &&
      Number(initialMovement.quantity || 0) === 4,
    'El movimiento inicial no quedó dentro de la creación.'
  );
  ok('El kardex inicial quedó confirmado con el producto');

  let updateDoc = await Product.findById(product._id);
  updateDoc.title = UPDATED_TITLE;
  updateDoc.sizes = ['Única', 'Grande'];
  updateDoc.colors = ['Azul', 'Falla'];
  updateDoc.inventory = [
    { size: 'Única', color: 'Azul', stock: 4 },
    { size: 'Grande', color: 'Falla', stock: 3 },
  ];
  updateDoc.variants = [
    ...updateDoc.variants.map((variant) =>
      variant.toObject
        ? variant.toObject()
        : { ...variant }
    ),
    {
      size: 'Grande',
      color: 'Falla',
      label: 'Grande / Falla',
      sku: `${SUCCESS_SKU}-FAIL`,
      price: 125000,
      cost: 60000,
      initialStock: 3,
      active: true,
    },
  ];

  const restoreEditSave = injectStockSaveFailure(
    product._id,
    (row) => String(row?.variant?.color || '') === 'Falla'
  );

  try {
    await expectFailure(() =>
      saveProductWithInventoryTransaction(updateDoc, {
        variantsAuthoritative: true,
      })
    );
  } finally {
    restoreEditSave();
  }
  ok('La API interna rechaza la edición si falla InventoryStock');

  const afterFailedEdit = await Product.findById(
    product._id
  ).lean();
  assert(
    afterFailedEdit?.title === BASE_TITLE &&
      afterFailedEdit.variants.length === 1,
    'Product conservó cambios parciales después del fallo.'
  );
  ok('El fallo revierte completamente la edición de Product');

  stockRows = await InventoryStock.find({
    product: product._id,
    deletedAt: null,
  }).lean();
  assert(
    stockRows.length === 1 &&
      stockRows[0].productSnapshot?.title === BASE_TITLE &&
      String(stockRows[0].variant?.color || '') === 'Azul',
    'InventoryStock conservó filas o snapshots parciales.'
  );
  ok('El fallo revierte filas y snapshots de InventoryStock');

  updateDoc = await Product.findById(product._id);
  updateDoc.title = UPDATED_TITLE;
  const updated = await saveProductWithInventoryTransaction(
    updateDoc,
    { variantsAuthoritative: true }
  );
  assert(updated?.title === UPDATED_TITLE);

  const updatedStock = await InventoryStock.findOne({
    product: product._id,
    active: true,
    deletedAt: null,
  }).lean();
  assert(
    updatedStock?.productSnapshot?.title === UPDATED_TITLE,
    'El reintento no sincronizó el snapshot comercial.'
  );
  ok('Un reintento válido confirma producto e inventario');

  const rollbackProduct = buildProduct({
    sku: ROLLBACK_SKU,
    title: `Producto que debe revertirse ${RUN_ID}`,
    color: 'Falla creación',
    stock: 7,
  });
  productIds.add(rollbackProduct._id);

  const restoreCreateSave = injectStockSaveFailure(
    rollbackProduct._id,
    () => true
  );

  try {
    await expectFailure(() =>
      saveProductWithInventoryTransaction(
        rollbackProduct,
        { variantsAuthoritative: true }
      )
    );
  } finally {
    restoreCreateSave();
  }
  ok('La creación rechaza el éxito si falla InventoryStock');

  const orphanProduct = await Product.findOne({
    sku: ROLLBACK_SKU,
  }).lean();
  assert(
    !orphanProduct,
    'Quedó un Product huérfano tras abortar la creación.'
  );
  ok('La creación fallida no deja un Product huérfano');

  const [orphanStock, orphanMovement] = await Promise.all([
    InventoryStock.findOne({
      product: rollbackProduct._id,
    }).lean(),
    InventoryMovement.findOne({
      sourceModel: 'Product',
      sourceId: rollbackProduct._id,
    }).lean(),
  ]);
  assert(
    !orphanStock && !orphanMovement,
    'La creación fallida dejó inventario o kardex huérfano.'
  );
  ok('La creación fallida no deja inventario ni kardex huérfanos');

  console.log(
    `\nTransacción Producto–Inventario: ${passed}/12 verificaciones aprobadas.`
  );
}

run()
  .catch((error) => {
    console.error(`FAIL ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      if (mongoose.connection.readyState === 1) {
        await cleanup();
      }
    } catch (error) {
      console.error(`WARN No se completó la limpieza: ${error.message}`);
    }

    await mongoose.disconnect().catch(() => {});
  });
