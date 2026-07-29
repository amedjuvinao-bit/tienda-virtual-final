/* eslint-disable no-console */

const assert = require('assert');
const mongoose = require('mongoose');

const Product = require('../models/Product');
const InventoryStock = require('../models/InventoryStock');
const {
  listAdminProducts,
  updateProductsInBulk,
} = require('../services/adminProductCatalogService');
const {
  archiveProductsSafely,
} = require('../services/productArchiveService');

const MONGO_URI =
  process.env.PRODUCTS_TEST_MONGO_URI ||
  process.env.MONGODB_URI ||
  '';
const RUN_ID = Math.random()
  .toString(36)
  .slice(2, 9)
  .toUpperCase();
const CATEGORY = `ITEM3-${RUN_ID}`;
const PRODUCT_COUNT = 37;

let productIds = [];
let passed = 0;

function ok(label) {
  passed += 1;
  console.log(`OK  ${label}`);
}

async function cleanup() {
  if (productIds.length) {
    await InventoryStock.deleteMany({
      product: { $in: productIds },
    });
  }

  await Product.deleteMany({
    category: CATEGORY,
  });
}

async function seedCatalog() {
  const documents = Array.from(
    { length: PRODUCT_COUNT },
    (_, index) => {
      const number = String(index + 1).padStart(3, '0');

      return {
        sku: `${CATEGORY}-${number}`,
        slug: `${CATEGORY.toLowerCase()}-${number}`,
        title: `Producto ${CATEGORY} ${number}`,
        description: `Prueba de escala ${number}`,
        productType:
          index % 5 === 0 ? 'service' : 'physical',
        category: CATEGORY,
        categories: [CATEGORY],
        price: 10000 + index * 100,
        cost: 5000 + index * 50,
        stock: 0,
        trackInventory: true,
        reorderPoint: 0,
        active: index % 4 !== 0,
        visible: index % 4 !== 0,
        archivedAt: null,
      };
    }
  );

  const products = await Product.insertMany(documents);
  productIds = products.map((product) => product._id);
  const branchId = new mongoose.Types.ObjectId();
  const stockRows = products
    .slice(0, 12)
    .map((product, index) => {
      const stock = index + 1;

      return {
        branch: branchId,
        product: product._id,
        variantKey: 'default__default',
        stock,
        reservedStock: 0,
        availableStock: stock,
        reorderPoint: 3,
        active: true,
        deletedAt: null,
      };
    })
    .filter((row, index) => products[index].trackInventory === true);

  await InventoryStock.insertMany(stockRows);
}

async function run() {
  assert(
    MONGO_URI,
    'PRODUCTS_TEST_MONGO_URI/MONGODB_URI no está configurado.'
  );

  await mongoose.connect(MONGO_URI);

  try {
    await cleanup();
    await seedCatalog();
    ok(`${PRODUCT_COUNT} productos temporales creados`);

    const secondPage = await listAdminProducts({
      page: 2,
      limit: 10,
      sort: 'title',
    });

    assert.strictEqual(secondPage.pagination.page, 2);
    assert.strictEqual(secondPage.pagination.limit, 10);
    assert.strictEqual(secondPage.pagination.total, PRODUCT_COUNT);
    assert.strictEqual(secondPage.pagination.pages, 4);
    assert.strictEqual(secondPage.data.length, 10);
    assert.strictEqual(secondPage.summary.total, PRODUCT_COUNT);
    assert.strictEqual(secondPage.summary.stock, 60);
    assert.strictEqual(secondPage.data[0].sku, `${CATEGORY}-011`);
    ok('Paginación real y resumen global independientes de la página');

    const search = await listAdminProducts({
      q: `${CATEGORY}-005`,
      limit: 20,
    });

    assert.strictEqual(search.pagination.total, 1);
    assert.strictEqual(search.data[0].sku, `${CATEGORY}-005`);
    ok('Búsqueda de servidor por SKU');

    const inactive = await listAdminProducts({
      status: 'inactive',
      limit: 100,
    });
    const expectedInactive = Array.from(
      { length: PRODUCT_COUNT },
      (_, index) => index
    ).filter((index) => index % 4 === 0).length;

    assert.strictEqual(
      inactive.pagination.total,
      expectedInactive
    );
    assert(
      inactive.data.every((product) => product.active === false)
    );
    ok('Filtro de estado aplicado antes de paginar');

    const withStock = await listAdminProducts({
      inventory: 'with_stock',
      limit: 100,
      sort: '-stock',
    });
    const withoutStock = await listAdminProducts({
      inventory: 'without_stock',
      limit: 100,
    });
    const lowStock = await listAdminProducts({
      inventory: 'low_stock',
      limit: 100,
    });

    assert.strictEqual(withStock.pagination.total, 9);
    assert.strictEqual(
      withoutStock.pagination.total,
      20
    );
    assert.strictEqual(lowStock.pagination.total, 2);
    assert.strictEqual(
      withStock.data[0].inventorySummary.stock,
      12
    );
    ok('Filtros de inventario excluyen servicios sin existencia propia');

    const selected = productIds.slice(20, 23).map(String);
    const deactivated = await updateProductsInBulk({
      ids: selected,
      action: 'deactivate',
    });

    assert.strictEqual(deactivated.matched, 3);
    assert.strictEqual(
      await Product.countDocuments({
        _id: { $in: selected },
        active: false,
        visible: false,
      }),
      3
    );

    const published = await updateProductsInBulk({
      ids: selected,
      action: 'publish',
    });

    assert.strictEqual(published.matched, 3);
    assert.strictEqual(
      await Product.countDocuments({
        _id: { $in: selected },
        active: true,
        visible: true,
      }),
      3
    );

    await updateProductsInBulk({
      ids: [selected[0]],
      action: 'hide',
    });
    const hidden = await listAdminProducts({
      q: `${CATEGORY}-021`,
      status: 'hidden',
    });

    assert.strictEqual(hidden.pagination.total, 1);
    assert.strictEqual(hidden.data[0].active, true);
    assert.strictEqual(hidden.data[0].visible, false);

    await updateProductsInBulk({
      ids: [selected[0]],
      action: 'publish',
    });
    ok('Activación, publicación y ocultamiento masivos con validación');

    const archivedIds = productIds.slice(0, 2).map(String);
    const archived = await archiveProductsSafely({
      ids: archivedIds,
    });

    assert.strictEqual(archived.requested, 2);
    assert.strictEqual(archived.archivedCount, 2);
    assert.strictEqual(archived.failedCount, 0);
    assert.strictEqual(
      await Product.countDocuments({
        _id: { $in: archivedIds },
        archivedAt: { $ne: null },
        active: false,
        visible: false,
      }),
      2
    );
    assert.strictEqual(
      await InventoryStock.countDocuments({
        product: { $in: archivedIds },
        active: false,
      }),
      2
    );

    const afterArchive = await listAdminProducts({
      limit: 100,
    });
    assert.strictEqual(
      afterArchive.pagination.total,
      PRODUCT_COUNT - 2
    );
    ok('Retiro masivo conserva documentos y desactiva inventario');

    console.log(
      `\nProductos catálogo escalable: ${passed}/${passed} OK`
    );
  } finally {
    await cleanup();
    await mongoose.disconnect();
  }
}

run().catch((error) => {
  console.error('FAIL Productos catálogo escalable');
  console.error(error);
  process.exitCode = 1;
});
