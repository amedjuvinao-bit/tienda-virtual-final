// backend/scripts/testInventoryRealExamples.js

const path = require('path');
const mongoose = require('mongoose');

require('dotenv').config({
  path: path.join(__dirname, '..', '.env'),
  quiet: true,
});

const Product = require('../models/Product');
const Branch = require('../models/Branch');
const InventoryStock = require('../models/InventoryStock');
const InventoryMovement = require('../models/InventoryMovement');
const { createInventoryMovement } = require('../services/inventoryService');

const PRODUCT_NAME = 'Vestido Girasoles Lila';
const MAIN_BRANCH_NAME = 'Sede Principal';
const WAREHOUSE_BRANCH_NAME = 'Bodega Principal';

const TEST_SIZE = '4';
const TEST_COLOR = 'royalblue';

const TEST_REFERENCE = `TEST-INVENTORY-REAL-${Date.now()}`;

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatNumber(value) {
  return new Intl.NumberFormat('es-CO').format(Number(value || 0));
}

function printTitle(title) {
  console.log('\n============================================================');
  console.log(title);
  console.log('============================================================');
}

function printStep(title) {
  console.log('\n------------------------------------------------------------');
  console.log(title);
  console.log('------------------------------------------------------------');
}

async function findProductByName(name) {
  const product = await Product.findOne({
    title: new RegExp(escapeRegex(name), 'i'),
    deletedAt: { $in: [null, undefined] },
  }).lean();

  if (!product) {
    const examples = await Product.find({})
      .select('title sku')
      .limit(10)
      .lean();

    console.log('\nProductos encontrados como ejemplo:');
    examples.forEach((item, index) => {
      console.log(`${index + 1}. ${item.title} | SKU: ${item.sku || 'Sin SKU'}`);
    });

    throw new Error(`No encontré el producto: ${name}`);
  }

  return product;
}

async function findBranchByName(name) {
  const branch = await Branch.findOne({
    name: new RegExp(`^${escapeRegex(name)}$`, 'i'),
    deletedAt: null,
  }).lean();

  if (!branch) {
    const examples = await Branch.find({
      deletedAt: null,
    })
      .select('name code type status active')
      .limit(20)
      .lean();

    console.log('\nSedes encontradas como ejemplo:');
    examples.forEach((item, index) => {
      console.log(
        `${index + 1}. ${item.name} | Código: ${item.code || 'Sin código'} | Tipo: ${
          item.type || 'Sin tipo'
        } | Estado: ${item.status || 'Sin estado'} | Activa: ${item.active}`
      );
    });

    throw new Error(`No encontré la sede o bodega: ${name}`);
  }

  if (!branch.active || branch.status !== 'active') {
    throw new Error(
      `La sede "${name}" existe, pero no está activa. active=${branch.active}, status=${branch.status}`
    );
  }

  return branch;
}

async function printStockForProduct(product) {
  const rows = await InventoryStock.find({
    product: product._id,
    deletedAt: null,
  })
    .populate('branch', 'name code type status active')
    .sort({
      'branchSnapshot.name': 1,
      'variant.size': 1,
      'variant.color': 1,
    })
    .lean();

  console.log('\nSTOCK ACTUAL DEL PRODUCTO');
  console.log(`Producto: ${product.title}`);
  console.log(`SKU: ${product.sku || 'Sin SKU'}`);

  if (rows.length === 0) {
    console.log('Este producto todavía no tiene stock por sedes.');
    return;
  }

  rows.forEach((row, index) => {
    const branchName =
      row?.branch?.name ||
      row?.branchSnapshot?.name ||
      'Sede no definida';

    const size = row?.variant?.size || '—';
    const color = row?.variant?.color || '—';

    console.log(
      `${index + 1}. ${branchName} | Talla: ${size} | Color: ${color} | Stock: ${formatNumber(
        row.stock
      )} | Disponible: ${formatNumber(row.availableStock)} | Reservado: ${formatNumber(
        row.reservedStock
      )}`
    );
  });
}

async function printMovements(referencePrefix) {
  const movements = await InventoryMovement.find({
    reference: new RegExp(escapeRegex(referencePrefix), 'i'),
    deletedAt: null,
  })
    .populate('branchFrom', 'name code type')
    .populate('branchTo', 'name code type')
    .populate('product', 'title sku')
    .sort({ createdAt: 1 })
    .lean();

  console.log('\nMOVIMIENTOS CREADOS EN ESTA PRUEBA');

  if (movements.length === 0) {
    console.log('No se encontraron movimientos con esta referencia.');
    return;
  }

  movements.forEach((movement, index) => {
    const productName =
      movement?.product?.title ||
      movement?.productSnapshot?.title ||
      'Producto sin nombre';

    const fromName =
      movement?.branchFrom?.name ||
      movement?.branchFromSnapshot?.name ||
      '—';

    const toName =
      movement?.branchTo?.name ||
      movement?.branchToSnapshot?.name ||
      '—';

    console.log(
      `${index + 1}. ${movement.movementNumber} | Tipo: ${movement.type} | Dirección: ${
        movement.direction
      } | Producto: ${productName} | Origen: ${fromName} | Destino: ${toName} | Cantidad: ${formatNumber(
        movement.quantity
      )} | Estado: ${movement.status} | Ref: ${movement.reference}`
    );
  });
}

async function createMovementExample({
  title,
  type,
  product,
  branchId,
  branchFrom,
  branchTo,
  quantity,
  reason,
  reference,
}) {
  printStep(title);

  const payload = {
    type,
    productId: product._id,
    size: TEST_SIZE,
    color: TEST_COLOR,
    quantity,
    reason,
    reference,
    notes: `Prueba automática real. Producto: ${product.title}. Talla: ${TEST_SIZE}. Color: ${TEST_COLOR}.`,
    postNow: true,
  };

  if (branchId) {
    payload.branchId = branchId;
  }

  if (branchFrom) {
    payload.branchFrom = branchFrom;
  }

  if (branchTo) {
    payload.branchTo = branchTo;
  }

  const movement = await createInventoryMovement(payload, {
    adminId: null,
    postNow: true,
  });

  console.log('Movimiento creado correctamente.');
  console.log(`Número: ${movement.movementNumber}`);
  console.log(`Tipo: ${movement.type}`);
  console.log(`Dirección: ${movement.direction}`);
  console.log(`Cantidad: ${movement.quantity}`);
  console.log(`Referencia: ${movement.reference}`);

  return movement;
}

async function main() {
  printTitle('PRUEBA REAL DE INVENTARIO POR SEDES');

  console.log('Este script crea movimientos reales en la base de datos.');
  console.log('Cada vez que lo ejecutes, el stock puede cambiar.');
  console.log(`Referencia base de esta prueba: ${TEST_REFERENCE}`);

  if (!process.env.MONGODB_URI) {
    throw new Error('No encontré MONGODB_URI en backend/.env');
  }

  await mongoose.connect(process.env.MONGODB_URI);

  console.log('\nConectado a MongoDB correctamente.');

  const product = await findProductByName(PRODUCT_NAME);
  const mainBranch = await findBranchByName(MAIN_BRANCH_NAME);
  const warehouseBranch = await findBranchByName(WAREHOUSE_BRANCH_NAME);

  printTitle('DATOS ENCONTRADOS');

  console.log(`Producto: ${product.title}`);
  console.log(`Producto ID: ${product._id}`);
  console.log(`SKU: ${product.sku || 'Sin SKU'}`);
  console.log(`Talla de prueba: ${TEST_SIZE}`);
  console.log(`Color de prueba: ${TEST_COLOR}`);

  console.log(`\nSede principal: ${mainBranch.name}`);
  console.log(`Sede principal ID: ${mainBranch._id}`);

  console.log(`\nBodega principal: ${warehouseBranch.name}`);
  console.log(`Bodega principal ID: ${warehouseBranch._id}`);

  printTitle('STOCK ANTES DE LA PRUEBA');
  await printStockForProduct(product);

  await createMovementExample({
    title: '1. Cargar stock inicial en Bodega Principal',
    type: 'initial_stock',
    product,
    branchId: warehouseBranch._id,
    quantity: 10,
    reason: 'Stock inicial de prueba en Bodega Principal',
    reference: `${TEST_REFERENCE}-01-INICIAL`,
  });

  await createMovementExample({
    title: '2. Ajuste positivo en Bodega Principal',
    type: 'adjustment_in',
    product,
    branchId: warehouseBranch._id,
    quantity: 2,
    reason: 'Ajuste positivo de prueba en Bodega Principal',
    reference: `${TEST_REFERENCE}-02-AJUSTE-IN`,
  });

  await createMovementExample({
    title: '3. Ajuste negativo en Bodega Principal',
    type: 'adjustment_out',
    product,
    branchId: warehouseBranch._id,
    quantity: 1,
    reason: 'Ajuste negativo de prueba en Bodega Principal',
    reference: `${TEST_REFERENCE}-03-AJUSTE-OUT`,
  });

  await createMovementExample({
    title: '4. Traslado desde Bodega Principal hacia Sede Principal',
    type: 'transfer',
    product,
    branchFrom: warehouseBranch._id,
    branchTo: mainBranch._id,
    quantity: 3,
    reason: 'Traslado de prueba desde Bodega Principal hacia Sede Principal',
    reference: `${TEST_REFERENCE}-04-TRASLADO`,
  });

  printTitle('STOCK DESPUÉS DE LA PRUEBA');
  await printStockForProduct(product);

  printTitle('HISTORIAL DE MOVIMIENTOS DE ESTA PRUEBA');
  await printMovements(TEST_REFERENCE);

  printTitle('EXPLICACIÓN SIMPLE DE LO QUE PASÓ');

  console.log('1. Stock inicial: Bodega Principal recibió 10 unidades.');
  console.log('2. Ajuste positivo: Bodega Principal recibió 2 unidades más.');
  console.log('3. Ajuste negativo: Bodega Principal perdió 1 unidad.');
  console.log('4. Traslado: salieron 3 unidades de Bodega Principal y entraron 3 a Sede Principal.');
  console.log('');
  console.log('Resultado neto de esta prueba:');
  console.log('- Bodega Principal aumenta 8 unidades netas.');
  console.log('- Sede Principal aumenta 3 unidades netas.');
  console.log('');
  console.log('Fórmula:');
  console.log('Bodega = +10 +2 -1 -3 = +8');
  console.log('Sede Principal = +3 por traslado');
}

main()
  .catch((error) => {
    console.error('\n❌ ERROR EN LA PRUEBA');
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
    console.log('\nConexión cerrada.');
  });