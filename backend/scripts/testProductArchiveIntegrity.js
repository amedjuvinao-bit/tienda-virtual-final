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
const {
  archiveProductSafely,
} = require('../services/productArchiveService');

const RUN_ID = Math.random()
  .toString(36)
  .slice(2, 9)
  .toUpperCase();
const TEST_SKU = `ARCH-${RUN_ID}`;
const TEST_BRANCH_CODE = `ARCH-${RUN_ID}`;

let passed = 0;

function ok(message) {
  passed += 1;
  console.log(`OK  ${message}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function cleanup(productId = null) {
  if (productId) {
    await InventoryMovement.deleteMany({
      sourceModel: 'Product',
      sourceId: productId,
    });
    await InventoryStock.deleteMany({ product: productId });
    await Product.deleteOne({ _id: productId });
  }

  await Product.deleteMany({ sku: TEST_SKU });
  await Branch.deleteMany({ code: TEST_BRANCH_CODE });
}

async function main() {
  const uri =
    process.env.PRODUCTS_TEST_MONGO_URI ||
    process.env.MONGODB_URI ||
    process.env.MONGO_URI;

  if (!uri) {
    throw new Error(
      'PRODUCTS_TEST_MONGO_URI/MONGODB_URI no está configurado.'
    );
  }

  let product = null;

  try {
    await mongoose.connect(uri);
    ok('Conexión temporal a MongoDB activa');
    await cleanup();

    await Branch.create({
      name: `Sede archivo ${RUN_ID}`,
      code: TEST_BRANCH_CODE,
      type: 'store',
      status: 'active',
      active: true,
      isMain: true,
      isDefaultForOnlineOrders: true,
    });
    ok('Sede temporal creada');

    product = new Product({
      sku: TEST_SKU,
      title: `Producto archivo ${RUN_ID}`,
      description: 'Producto temporal para validar archivo lógico.',
      image: 'https://example.com/imagen-conservada.jpg',
      productType: 'physical',
      trackInventory: true,
      category: 'Pruebas archivo',
      price: 85000,
      cost: 40000,
      variants: [
        {
          size: 'Única',
          color: 'Negro',
          sku: `${TEST_SKU}-NEG`,
          barcode: `770${RUN_ID}`,
          initialStock: 4,
          active: true,
        },
      ],
      inventory: [
        {
          size: 'Única',
          color: 'Negro',
          stock: 4,
        },
      ],
      active: true,
      visible: true,
    });
    product.$locals = product.$locals || {};
    product.$locals.variantsAuthoritative = true;
    await product.save();
    ok('Producto e inventario temporal creados');

    const stockBefore = await InventoryStock.find({
      product: product._id,
      deletedAt: null,
    }).lean();
    assert(
      stockBefore.length === 1 && stockBefore[0].active !== false,
      'El inventario inicial no quedó activo.'
    );
    ok('Existencia activa confirmada');

    const result = await archiveProductSafely({
      id: product._id,
    });
    assert(result?.archivedProduct, 'El servicio no archivó el producto.');
    ok('Servicio de archivo ejecutado');

    const archived = await Product.findById(product._id).lean();
    assert(archived, 'El producto fue borrado físicamente.');
    assert(archived.active === false, 'El producto archivado quedó activo.');
    assert(archived.visible === false, 'El producto archivado quedó visible.');
    assert(archived.archivedAt, 'Falta fecha de archivo.');
    assert(
      archived.image ===
        'https://example.com/imagen-conservada.jpg',
      'La imagen del producto fue eliminada.'
    );
    ok('Producto, historial e imagen se conservaron');

    const stockAfter = await InventoryStock.find({
      product: product._id,
      deletedAt: null,
    }).lean();
    assert(
      stockAfter.length === 1,
      'La existencia fue borrada físicamente.'
    );
    assert(
      stockAfter[0].active === false,
      'La existencia archivada siguió activa.'
    );
    assert(
      Number(stockAfter[0].stock || 0) === 4,
      'El archivo alteró el stock histórico.'
    );
    ok('Inventario histórico conservado e inactivo');

    console.log(
      `\nRESULTADO: ${passed}/${passed} controles aprobados`
    );
  } finally {
    await cleanup(product?._id);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
}

main().catch((error) => {
  console.error('FAIL Prueba de archivo lógico de Productos');
  console.error(error);
  process.exit(1);
});
