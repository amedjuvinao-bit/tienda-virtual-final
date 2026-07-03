// backend/scripts/seedAdminPosStock.js

require('dotenv').config();

const mongoose = require('mongoose');
const Branch = require('../models/Branch');
const Product = require('../models/Product');
const InventoryStock = require('../models/InventoryStock');

const DEFAULT_QTY = 10;

function fail(message) {
  throw new Error(message);
}

function toQty(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return DEFAULT_QTY;
  return Math.max(1, Math.floor(number));
}

function clean(value) {
  return String(value || '').trim();
}

function upper(value) {
  return clean(value).toUpperCase();
}

function getImage(product = {}) {
  if (product.image) return product.image;
  if (Array.isArray(product.images) && product.images.length > 0) return product.images[0] || '';
  return '';
}

function getVariant(product = {}) {
  if (Array.isArray(product.inventory)) {
    const variant = product.inventory.find((item) => clean(item?.size) || clean(item?.color));
    if (variant) {
      return {
        size: clean(variant.size),
        color: clean(variant.color),
        sku: upper(product.sku),
        barcode: clean(product.barcode),
      };
    }
  }

  return {
    size: clean(Array.isArray(product.sizes) ? product.sizes[0] : ''),
    color: clean(Array.isArray(product.colors) ? product.colors[0] : ''),
    sku: upper(product.sku),
    barcode: clean(product.barcode),
  };
}

async function findBranch() {
  const branch = await Branch.findOne({
    deletedAt: null,
    active: true,
    status: 'active',
    'settings.allowPosSales': true,
  }).sort({ isMain: -1, isDefaultForOnlineOrders: -1, name: 1 });

  if (!branch) fail('No hay sede POS activa.');
  return branch;
}

async function findProductFromExistingStock(branch) {
  const rows = await InventoryStock.find({
    branch: branch._id,
    active: true,
    deletedAt: null,
  }).limit(100);

  for (const row of rows) {
    const product = await Product.findOne({
      _id: row.product,
      active: { $ne: false },
      visible: { $ne: false },
      price: { $gt: 0 },
    });

    if (product) return { product, row };
  }

  return null;
}

async function findProductWithoutStock() {
  const product = await Product.findOne({
    active: { $ne: false },
    visible: { $ne: false },
    price: { $gt: 0 },
  }).sort({ updatedAt: -1 });

  if (!product) fail('No hay producto activo, visible y con precio para preparar stock.');
  return product;
}

async function syncProductStock(productId) {
  const rows = await InventoryStock.find({
    product: productId,
    active: true,
    deletedAt: null,
  }).select('stock').lean();

  const totalStock = rows.reduce((sum, row) => sum + Number(row.stock || 0), 0);
  await Product.findByIdAndUpdate(productId, { $set: { stock: totalStock } });

  return totalStock;
}

async function main() {
  const qty = toQty(process.argv[2] || process.env.POS_TEST_STOCK_QTY);

  if (!process.env.MONGODB_URI) fail('Falta MONGODB_URI en backend/.env.');

  await mongoose.connect(process.env.MONGODB_URI);

  const branch = await findBranch();
  const selected = await findProductFromExistingStock(branch);
  const product = selected?.product || await findProductWithoutStock();

  let row = selected?.row || null;

  if (!row) {
    row = new InventoryStock({
      branch: branch._id,
      branchSnapshot: {
        name: branch.name,
        code: branch.code,
        type: branch.type,
      },
      product: product._id,
      productSnapshot: {
        title: product.title,
        sku: product.sku,
        image: getImage(product),
        category: product.category,
      },
      variant: getVariant(product),
      stock: qty,
      reservedStock: 0,
      active: true,
      deletedAt: null,
      lastMovementAt: new Date(),
      notes: 'Stock de prueba para POS',
    });
  } else {
    const reserved = Number(row.reservedStock || 0);
    row.stock = reserved + qty;
    row.availableStock = qty;
    row.active = true;
    row.deletedAt = null;
    row.lastMovementAt = new Date();
    row.notes = 'Stock de prueba para POS';
  }

  await row.save();
  const totalProductStock = await syncProductStock(product._id);

  console.log('Stock POS preparado correctamente.');
  console.log('Sede:', branch.name);
  console.log('Producto:', product.title);
  console.log('SKU:', product.sku || 'Sin SKU');
  console.log('Variante:', `${row.variant?.size || 'Sin talla'} / ${row.variant?.color || 'Sin color'}`);
  console.log('Stock disponible POS:', row.availableStock);
  console.log('Stock total producto:', totalProductStock);
}

main()
  .catch((error) => {
    console.error('Error preparando stock POS:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
