'use strict';

const assert = require('assert');
const mongoose = require('mongoose');
const {
  BATCH_ID,
  PRODUCT_CODES,
  PRODUCT_COUNT,
  TYPE_DISTRIBUTION,
  CATEGORY_NAMES,
  COLLECTION_NAMES,
  buildQa50Definitions,
  validateQa50Definitions,
  requiredMediaRoles,
} = require('./qa50CatalogFixtureFactory');
const {
  assertVariantIdentity,
  resolveVariantIdentity,
} = require('../../shared/variantKeyAuthority.cjs');

const tests = [];
const test = (name, run) => tests.push({ name, run });

function taxonomyFixture() {
  const categoryNames = [...new Set(Object.values(CATEGORY_NAMES))];
  const collectionNames = [...new Set(Object.values(COLLECTION_NAMES))];
  return {
    categories: categoryNames.map((name) => ({
      _id: new mongoose.Types.ObjectId(),
      name,
      active: true,
    })),
    collections: collectionNames.map((name) => ({
      _id: new mongoose.Types.ObjectId(),
      name,
      active: true,
    })),
  };
}

const taxonomy = taxonomyFixture();
const products = buildQa50Definitions({ taxonomy });

test('genera exactamente 50 productos y QA50-001..QA50-050', () => {
  assert.strictEqual(products.length, PRODUCT_COUNT);
  assert.deepStrictEqual(products.map((product) => product.sku), PRODUCT_CODES);
});

test('representa todas las clases reales con la distribucion declarada', () => {
  const actual = products.reduce((counts, product) => {
    counts[product.productType] = (counts[product.productType] || 0) + 1;
    return counts;
  }, {});
  assert.deepStrictEqual(actual, TYPE_DISTRIBUTION);
});

test('cada registro conserva el identificador exacto del lote', () => {
  products.forEach((product) => assert(product.tags.includes(BATCH_ID)));
});

test('incluye productos sin variantes y con uno a cuatro atributos', () => {
  const axisCounts = new Set(products.map((product) => product.variantAxes.length));
  [0, 1, 2, 3, 4].forEach((count) => assert(axisCounts.has(count)));
});

test('cada combinacion declarada usa la autoridad central sin expansion', () => {
  for (const product of products) {
    const keys = new Set();
    for (const variant of product.variants) {
      assertVariantIdentity(variant);
      const rebuilt = resolveVariantIdentity({ attributes: variant.attributes });
      assert.strictEqual(rebuilt.variantKey, variant.variantKey);
      assert(!keys.has(variant.variantKey));
      keys.add(variant.variantKey);
    }
    assert.strictEqual(keys.size, product.variants.length);
  }
});

test('SKU y codigos de barras no se repiten', () => {
  const skus = products.flatMap((product) => [
    product.sku,
    ...product.variants.map((variant) => variant.sku),
  ]).filter(Boolean);
  const barcodes = products.flatMap((product) => [
    product.barcode,
    ...product.variants.map((variant) => variant.barcode),
  ]).filter(Boolean);
  assert.strictEqual(new Set(skus).size, skus.length);
  assert.strictEqual(new Set(barcodes).size, barcodes.length);
});

test('cada producto exige portada y dos imagenes de galeria', () => {
  for (const product of products) {
    const roles = requiredMediaRoles(product);
    assert(roles.includes('cover'));
    assert(roles.includes('gallery-1'));
    assert(roles.includes('gallery-2'));
    assert.strictEqual(roles.length, 3 + product.variants.length);
  }
});

test('productos no inventariables no declaran stock ni variantes', () => {
  for (const product of products.filter((item) => ['digital', 'service', 'bundle'].includes(item.productType))) {
    assert.strictEqual(product.trackInventory, false);
    assert.deepStrictEqual(product.variants, []);
  }
});

test('la validacion integral del fixture no reporta errores', () => {
  const result = validateQa50Definitions(products);
  assert.strictEqual(result.ok, true, result.errors.join('\n'));
  assert.deepStrictEqual(result.typeCounts, TYPE_DISTRIBUTION);
});

test('el generador es determinista e idempotente', () => {
  const again = buildQa50Definitions({ taxonomy });
  assert.deepStrictEqual(again, products);
});

(async () => {
  let passed = 0;
  for (const entry of tests) {
    try {
      await entry.run();
      passed += 1;
      console.log(`PASS ${entry.name}`);
    } catch (error) {
      console.error(`FAIL ${entry.name}: ${error.message}`);
      process.exitCode = 1;
    }
  }
  assert.strictEqual(mongoose.connection.readyState, 0, 'MongoDB debe permanecer desconectado');
  console.log(`${passed}/${tests.length} QA50 fixture checks passed; MongoDB disconnected`);
})();
