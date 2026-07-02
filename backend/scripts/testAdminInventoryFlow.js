// backend/scripts/testAdminInventoryFlow.js

const path = require('path');
const mongoose = require('mongoose');

require('dotenv').config({
  path: path.join(__dirname, '..', '.env'),
});

const Branch = require('../models/Branch');
const Product = require('../models/Product');
const InventoryStock = require('../models/InventoryStock');
const InventoryMovement = require('../models/InventoryMovement');
const {
  createInventoryMovement,
  getBranchStockSummary,
  syncProductTotalStock,
} = require('../services/inventoryService');

const TEST_REFERENCE = 'TEST-INVENTORY-SEDE-001';

function printTitle(title) {
  console.log('\n==================================================');
  console.log(title);
  console.log('==================================================');
}

function cleanText(value) {
  return String(value || '').trim();
}

async function findBranch() {
  const branch =
    (await Branch.findOne({
      deletedAt: null,
      active: true,
      status: 'active',
      isMain: true,
    }).lean()) ||
    (await Branch.findOne({
      deletedAt: null,
      active: true,
      status: 'active',
      isDefaultForOnlineOrders: true,
    }).lean()) ||
    (await Branch.findOne({
      deletedAt: null,
      active: true,
      status: 'active',
    }).lean());

  if (!branch) {
    throw new Error(
      'No hay sedes activas. Primero crea una sede activa desde Configuración > Sedes.'
    );
  }

  return branch;
}

async function findProduct() {
  const product =
    (await Product.findOne({
      deletedAt: null,
      active: true,
    }).lean()) ||
    (await Product.findOne({
      active: true,
    }).lean()) ||
    (await Product.findOne({}).lean());

  if (!product) {
    throw new Error(
      'No hay productos en la base de datos. Primero crea al menos un producto.'
    );
  }

  return product;
}

function getFirstVariant(product) {
  const inventory = Array.isArray(product?.inventory) ? product.inventory : [];

  const variant = inventory.find((item) => item?.size || item?.color) || null;

  if (variant) {
    return {
      size: cleanText(variant.size) || 'Única',
      color: cleanText(variant.color) || 'Sin color',
      sku: cleanText(variant.sku) || cleanText(product.sku),
      barcode: cleanText(variant.barcode) || cleanText(product.barcode),
    };
  }

  const sizes = Array.isArray(product?.sizes) ? product.sizes : [];
  const colors = Array.isArray(product?.colors) ? product.colors : [];

  return {
    size: cleanText(sizes[0]) || 'Única',
    color: cleanText(colors[0]?.name || colors[0]?.label || colors[0]) || 'Sin color',
    sku: cleanText(product.sku),
    barcode: cleanText(product.barcode),
  };
}

async function main() {
  printTitle('🧪 PRUEBA DE INVENTARIO POR SEDES');

  if (!process.env.MONGODB_URI) {
    throw new Error('No existe MONGODB_URI en backend/.env');
  }

  await mongoose.connect(process.env.MONGODB_URI);

  console.log('✅ Conectado a MongoDB Atlas');

  const branch = await findBranch();
  const product = await findProduct();
  const variant = getFirstVariant(product);

  console.log('\n📍 Sede usada:');
  console.log({
    id: String(branch._id),
    name: branch.name,
    code: branch.code,
    type: branch.type,
  });

  console.log('\n👗 Producto usado:');
  console.log({
    id: String(product._id),
    title: product.title,
    sku: product.sku,
  });

  console.log('\n🎨 Variante usada:');
  console.log(variant);

  const previousMovement = await InventoryMovement.findOne({
    reference: TEST_REFERENCE,
    deletedAt: null,
  }).lean();

  if (previousMovement) {
    console.log('\nℹ️ Ya existía un movimiento de prueba. No se crea otro para no duplicar stock.');
    console.log({
      movementNumber: previousMovement.movementNumber,
      reference: previousMovement.reference,
      quantity: previousMovement.quantity,
      status: previousMovement.status,
    });
  } else {
    printTitle('➕ CREANDO MOVIMIENTO DE ENTRADA');

    const movement = await createInventoryMovement(
      {
        type: 'initial_stock',
        productId: product._id,
        branchId: branch._id,
        quantity: 3,
        size: variant.size,
        color: variant.color,
        sku: variant.sku,
        barcode: variant.barcode,
        reason: 'Prueba inicial de inventario por sedes',
        notes: 'Movimiento generado por script testAdminInventoryFlow.js',
        reference: TEST_REFERENCE,
        postNow: true,
      },
      {
        adminId: null,
        postNow: true,
      }
    );

    console.log('✅ Movimiento creado correctamente');
    console.log({
      id: String(movement._id),
      movementNumber: movement.movementNumber,
      type: movement.type,
      direction: movement.direction,
      status: movement.status,
      quantity: movement.quantity,
      reference: movement.reference,
    });
  }

  printTitle('📦 CONSULTANDO STOCK ACTUAL');

  const stockRows = await InventoryStock.find({
    branch: branch._id,
    product: product._id,
    deletedAt: null,
  })
    .sort({
      'variant.size': 1,
      'variant.color': 1,
    })
    .lean();

  console.log(
    stockRows.map((row) => ({
      branch: row.branchSnapshot?.code || String(row.branch),
      product: row.productSnapshot?.title || String(row.product),
      size: row.variant?.size,
      color: row.variant?.color,
      variantKey: row.variantKey,
      stock: row.stock,
      reservedStock: row.reservedStock,
      availableStock: row.availableStock,
    }))
  );

  printTitle('📊 RESUMEN DE STOCK DE LA SEDE');

  const summary = await getBranchStockSummary(branch._id);

  console.log(summary.totals);

  const totalProductStock = await syncProductTotalStock(product._id);

  printTitle('🔄 STOCK TOTAL SINCRONIZADO EN PRODUCTO');

  console.log({
    productId: String(product._id),
    totalProductStock,
  });

  printTitle('✅ PRUEBA FINALIZADA CORRECTAMENTE');

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('\n❌ ERROR EN PRUEBA DE INVENTARIO');
  console.error(error);

  try {
    await mongoose.disconnect();
  } catch {
    // Ignorar error de desconexión.
  }

  process.exit(1);
});