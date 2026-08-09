// backend/scripts/testProductInventorySyncModule.js
/* eslint-disable no-console */

require('dotenv').config({
  path: require('path').join(__dirname, '..', '.env'),
  quiet: true,
});

const mongoose = require('mongoose');

const Product = require('../models/Product');
const Branch = require('../models/Branch');
const InventoryStock = require('../models/InventoryStock');
const InventoryMovement = require('../models/InventoryMovement');

const RUN_ID = Math.random().toString(36).slice(2, 9).toUpperCase();
const TEST_SKU = `SYNC-${RUN_ID}`;

const results = {
  ok: 0,
  warn: 0,
  fail: 0,
};

function ok(message) {
  results.ok += 1;
  console.log(`OK  ${message}`);
}

function warn(message) {
  results.warn += 1;
  console.warn(`WARN ${message}`);
}

function fail(message, error = null) {
  results.fail += 1;
  console.error(`FAIL ${message}`);
  if (error?.message) console.error(`     ${error.message}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function connectDb() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI no esta configurado en backend/.env');
  }

  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.MONGODB_URI);
  }

  ok('Conexion a MongoDB activa');
}

async function ensureBranch() {
  let branch = await Branch.findOne({
    deletedAt: null,
    active: true,
    status: 'active',
  })
    .sort({ isMain: -1, isDefaultForOnlineOrders: -1, createdAt: 1 })
    .exec();

  if (branch) {
    ok(`Sede activa encontrada: ${branch.name}`);
    return branch;
  }

  branch = new Branch({
    name: 'Sede Principal',
    code: `SYNC-${RUN_ID}`,
    type: 'store',
    status: 'active',
    active: true,
    isMain: true,
    isDefaultForOnlineOrders: true,
    notes: `Creada por prueba producto inventario ${RUN_ID}`,
  });

  await branch.save();
  warn('No habia sedes activas. Se creo una sede temporal para la prueba.');
  return branch;
}

async function cleanup(productId = null) {
  if (productId) {
    await InventoryMovement.deleteMany({ sourceModel: 'Product', sourceId: productId });
    await InventoryStock.deleteMany({ product: productId });
    await Product.deleteOne({ _id: productId });
  }

  await Product.deleteMany({ sku: TEST_SKU });
}

async function waitForHook() {
  await new Promise((resolve) => setTimeout(resolve, 250));
}

async function main() {
  console.log('\n=== Prueba Producto + Inventario real ===');
  console.log(`Run ID: ${RUN_ID}`);

  let product = null;

  try {
    await connectDb();
    await ensureBranch();
    await cleanup();

    product = new Product({
      sku: TEST_SKU,
      title: `Producto Sync Inventario ${RUN_ID}`,
      description: 'Producto temporal para validar sincronizacion profesional con InventoryStock.',
      productType: 'physical',
      unitOfMeasure: 'unit',
      trackInventory: true,
      allowBackorder: false,
      variantPreset: 'generic',
      variantAxes: [
        { key: 'presentacion', label: 'Presentacion', values: ['Universal'] },
        { key: 'color', label: 'Color', values: ['#000000'] },
      ],
      category: 'Pruebas inventario',
      categories: ['Pruebas inventario'],
      price: 100000,
      cost: 40000,
      averageCost: 40000,
      reorderPoint: 2,
      reorderQty: 6,
      colors: ['#000000'],
      sizes: ['Universal'],
      inventory: [
        { size: 'Universal', color: '#000000', stock: 4 },
      ],
      active: true,
    });

    await product.save();
    await waitForHook();
    ok('Producto temporal creado');

    let rows = await InventoryStock.find({ product: product._id, deletedAt: null }).lean();
    assert(rows.length >= 1, 'No se creo InventoryStock para el producto.');
    assert(rows.some((row) => Number(row.stock || 0) === 4), 'El stock inicial no quedo en InventoryStock.');
    ok('Crear producto genera InventoryStock con stock inicial');

    let movement = await InventoryMovement.findOne({
      product: product._id,
      type: 'initial_stock',
      status: 'posted',
      sourceModel: 'Product',
    }).lean();
    assert(movement, 'No se creo movimiento initial_stock.');
    assert(Number(movement.quantity || 0) === 4, 'El movimiento initial_stock no tiene la cantidad esperada.');
    ok('Crear producto genera movimiento inicial de inventario');

    let savedProduct = await Product.findById(product._id).lean();
    assert(Number(savedProduct.stock || 0) === 4, 'Product.stock no quedo sincronizado con InventoryStock.');
    ok('Product.stock queda sincronizado con InventoryStock');

    product.title = `Producto Sync Inventario Editado ${RUN_ID}`;
    product.cost = 45000;
    product.inventory = [
      { size: 'Universal', color: '#000000', stock: 999 },
      { size: 'Nueva variante', color: '#ffffff', stock: 12 },
    ];
    product.sizes = ['Universal', 'Nueva variante'];
    product.colors = ['#000000', '#ffffff'];

    await product.save();
    await waitForHook();
    ok('Producto temporal editado');

    rows = await InventoryStock.find({ product: product._id, deletedAt: null }).lean();
    const originalRow = rows.find((row) => String(row?.variant?.size || '').toLowerCase() === 'universal');
    const newRow = rows.find((row) => String(row?.variant?.size || '').toLowerCase() === 'nueva variante');

    assert(originalRow, 'No existe la variante original en InventoryStock.');
    assert(Number(originalRow.stock || 0) === 4, 'Editar producto sobrescribio el stock real existente.');
    ok('Editar producto no sobrescribe stock real existente');

    assert(newRow, 'No se creo fila para la nueva variante.');
    assert(Number(newRow.stock || 0) === 0, 'La nueva variante no debe entrar con stock automatico si ya existia inventario.');
    ok('Editar producto crea variante nueva sin mover stock');

    savedProduct = await Product.findById(product._id).lean();
    assert(Number(savedProduct.stock || 0) === 4, 'Product.stock no se resincronizo despues de editar.');
    ok('Despues de editar, Product.stock sigue reflejando inventario real');

    product = await Product.findById(product._id);
    product.inventory = [
      { size: 'Universal', color: '#000000', stock: 4 },
    ];
    product.sizes = ['Universal'];
    product.colors = ['#000000'];
    product.$locals = product.$locals || {};
    product.$locals.variantsAuthoritative = true;
    await product.save();
    await waitForHook();

    rows = await InventoryStock.find({
      product: product._id,
      deletedAt: null,
    }).lean();
    const retiredRow = rows.find(
      (row) =>
        String(row?.variant?.size || '').toLowerCase() ===
        'nueva variante'
    );
    assert(retiredRow, 'La existencia retirada fue borrada.');
    assert(
      retiredRow.active === false,
      'La existencia retirada siguio activa.'
    );
    ok('Retirar variante conserva historial y desactiva InventoryStock');

    product.trackInventory = false;
    product.inventory = [];
    product.sizes = [];
    await product.save();
    await waitForHook();

    rows = await InventoryStock.find({ product: product._id, deletedAt: null }).lean();
    assert(rows.every((row) => row.active === false), 'Desactivar control de inventario no desactivo las filas InventoryStock.');
    ok('Desactivar control de inventario no borra historial y desactiva stock operativo');

    savedProduct = await Product.findById(product._id).lean();
    assert(Number(savedProduct.stock || 0) === 0, 'Producto sin inventario debe quedar con stock heredado en cero.');
    ok('Producto sin control de inventario queda con stock heredado en cero');
  } catch (error) {
    fail('Error inesperado en prueba Producto + Inventario', error);
  } finally {
    await cleanup(product?._id);
    ok('Limpieza final de datos temporales');

    console.log('\n=== Resultado final ===');
    console.log(`OK: ${results.ok}`);
    console.log(`WARN: ${results.warn}`);
    console.log(`FAIL: ${results.fail}`);

    await mongoose.disconnect();

    if (results.fail > 0) process.exit(1);
  }
}

main();
