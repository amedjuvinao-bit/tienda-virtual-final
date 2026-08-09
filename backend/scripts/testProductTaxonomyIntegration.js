/* eslint-disable no-console */

'use strict';

const assert = require('assert');
const mongoose = require('mongoose');

const Product = require('../models/Product');
const ProductTaxonomy = require('../models/ProductTaxonomy');
const {
  listAdminProducts,
} = require('../services/adminProductCatalogService');
const {
  ProductTaxonomyInputError,
  archiveProductTaxonomy,
  createProductTaxonomy,
  listProductTaxonomies,
  resolveProductTaxonomyPayload,
  updateProductTaxonomy,
} = require('../services/productTaxonomyService');
const {
  serializePublicProduct,
} = require('../lib/products/productPublicView');

const MONGO_URI =
  process.env.PRODUCTS_TEST_MONGO_URI ||
  process.env.MONGODB_URI ||
  '';
const RUN_ID = Math.random()
  .toString(36)
  .slice(2, 9)
  .toUpperCase();
const PREFIX = `ITEM4-${RUN_ID}`;

let productId = null;
let taxonomyIds = [];
let passed = 0;

function ok(label) {
  passed += 1;
  console.log(`OK  ${label}`);
}

async function cleanup() {
  if (productId) {
    await Product.deleteOne({ _id: productId });
  }

  if (taxonomyIds.length) {
    await ProductTaxonomy.deleteMany({
      _id: { $in: taxonomyIds },
    });
  }
}

async function run() {
  assert(
    MONGO_URI,
    'PRODUCTS_TEST_MONGO_URI/MONGODB_URI no está configurado.'
  );

  await mongoose.connect(MONGO_URI);

  try {
    await cleanup();

    const root = await createProductTaxonomy({
      kind: 'category',
      name: `${PREFIX} Ropa`,
    });
    const child = await createProductTaxonomy({
      kind: 'category',
      name: `${PREFIX} Camisas`,
      parent: root._id,
    });
    const collection = await createProductTaxonomy({
      kind: 'collection',
      name: `${PREFIX} Verano`,
    });
    taxonomyIds = [root._id, child._id, collection._id];
    ok('Categoría, subcategoría y colección creadas');

    const catalog = await listProductTaxonomies();
    const childView = catalog.categories.find(
      (item) => item._id === String(child._id)
    );

    assert(childView);
    assert.strictEqual(
      childView.path,
      `${PREFIX} Ropa / ${PREFIX} Camisas`
    );
    ok('Jerarquía serializada con ruta completa');

    await assert.rejects(
      () =>
        updateProductTaxonomy(root._id, {
          parent: child._id,
        }),
      (error) =>
        error instanceof ProductTaxonomyInputError
    );
    ok('La jerarquía rechaza ciclos entre categorías');

    const taxonomyPayload =
      await resolveProductTaxonomyPayload({
        primaryCategoryId: child._id,
        categoryIds: [root._id, child._id],
        collectionIds: [collection._id],
      });

    assert.strictEqual(
      String(taxonomyPayload.primaryCategoryRef),
      String(child._id)
    );
    assert.deepStrictEqual(taxonomyPayload.categories, [
      `${PREFIX} Ropa`,
      `${PREFIX} Camisas`,
    ]);
    ok('Selección validada y compatible con categorías heredadas');

    const product = new Product({
      sku: `${PREFIX}-SKU`,
      slug: `${PREFIX.toLowerCase()}-producto`,
      title: `${PREFIX} Producto`,
      description: 'Producto de integración del ítem 4.',
      price: 120000,
      cost: 60000,
      productType: 'service',
      trackInventory: false,
      active: true,
      visible: true,
      category: taxonomyPayload.category,
      categories: taxonomyPayload.categories,
      primaryCategoryRef:
        taxonomyPayload.primaryCategoryRef,
      categoryRefs: taxonomyPayload.categoryRefs,
      collectionRefs: taxonomyPayload.collectionRefs,
      tags: ['Destacado', 'Regalo'],
      seo: {
        title: `${PREFIX} SEO`,
        description: 'Descripción SEO de integración.',
        keywords: ['prueba', 'producto'],
      },
      commercialFields: [
        {
          label: 'Material',
          key: 'material',
          value: 'Algodón',
          public: true,
        },
        {
          label: 'Margen interno',
          key: 'margen-interno',
          value: '50',
          public: false,
        },
      ],
    });
    await product.save();
    productId = product._id;
    ok('Producto guardado con taxonomía, SEO y campos extensibles');

    const filtered = await listAdminProducts({
      categoryId: child._id,
      collectionId: collection._id,
      tag: 'destacado',
      q: 'Algodón',
      limit: 20,
    });

    assert.strictEqual(filtered.pagination.totalProducts, 1);
    assert.strictEqual(
      String(filtered.products[0]._id),
      String(product._id)
    );
    ok('Filtros administrativos usan taxonomía, etiquetas y campos');

    const populated = await Product.findById(product._id)
      .populate([
        {
          path: 'primaryCategoryRef',
          select: 'kind name slug',
        },
        {
          path: 'categoryRefs',
          select: 'kind name slug',
        },
        {
          path: 'collectionRefs',
          select: 'kind name slug',
        },
      ])
      .lean();
    const publicProduct = serializePublicProduct(populated);

    assert.strictEqual(
      publicProduct.taxonomy.primaryCategory.name,
      `${PREFIX} Camisas`
    );
    assert.strictEqual(publicProduct.commercialFields.length, 1);
    assert.strictEqual(
      publicProduct.commercialFields[0].label,
      'Material'
    );
    assert.strictEqual(publicProduct.cost, undefined);
    ok('Respuesta pública estructurada sin campos internos');

    const renamed = await updateProductTaxonomy(child._id, {
      name: `${PREFIX} Camisas Premium`,
    });
    const renamedProduct = await Product.findById(product._id).lean();

    assert.strictEqual(
      renamed.name,
      `${PREFIX} Camisas Premium`
    );
    assert.strictEqual(
      renamedProduct.category,
      `${PREFIX} Camisas Premium`
    );
    assert(
      renamedProduct.categories.includes(
        `${PREFIX} Camisas Premium`
      )
    );
    ok('Renombrar categoría actualiza la compatibilidad del producto');

    await assert.rejects(
      () => archiveProductTaxonomy(collection._id),
      (error) =>
        error instanceof ProductTaxonomyInputError &&
        error.status === 409
    );
    ok('No se retira una clasificación todavía asociada');

    await Product.deleteOne({ _id: product._id });
    productId = null;
    const archivedCollection =
      await archiveProductTaxonomy(collection._id);

    assert(archivedCollection.archivedAt);
    ok('Clasificación sin relaciones se retira lógicamente');

    console.log(
      `\nProductos taxonomía MongoDB: ${passed}/${passed} OK`
    );
  } finally {
    await cleanup();
    await mongoose.disconnect();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
