'use strict';

const assert = require('assert/strict');
const {
  buildLegacyProductVariantMigrationPlan,
} = require('../services/legacyProductVariantMigrationService');

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`OK ${passed}: ${name}`);
}

function product(id, overrides = {}) {
  return {
    _id: id,
    title: `Producto ${id}`,
    colors: [],
    inventory: [],
    variants: [],
    bundleComponents: [],
    ...overrides,
  };
}

const legacyVariant = {
  variantKey: '4__azul rey',
  label: 'Talla 4 / Azul rey',
  size: '4',
  color: 'Azul rey',
  attributes: [],
  sku: 'VESTIDO-4-AZUL',
  barcode: '770000000001',
  price: 100,
  image: 'https://example.test/vestido.jpg',
  initialStock: 2,
};

check('normaliza sin inventar ni eliminar variantes', () => {
  const plan = buildLegacyProductVariantMigrationPlan({
    products: [product('p1', { variants: [legacyVariant] })],
    inventoryStocks: [],
  });
  assert.equal(plan.productUpdates.length, 1);
  const [variant] = plan.productUpdates[0].set.variants;
  assert.equal(variant.variantKey, '4__royalblue');
  assert.equal(variant.color, 'royalblue');
  assert.equal(variant.label, legacyVariant.label);
  assert.equal(variant.sku, legacyVariant.sku);
  assert.equal(variant.barcode, legacyVariant.barcode);
  assert.equal(variant.image, legacyVariant.image);
  assert.equal(variant.initialStock, 2);
  assert.equal(plan.productUpdates[0].set.variants.length, 1);
});

check('preserva etiquetas visibles de atributos', () => {
  const plan = buildLegacyProductVariantMigrationPlan({
    products: [product('p1', {
      variants: [{
        variantKey: 'v2__color=azul__talla=4',
        color: 'Azul',
        attributes: [
          { key: 'color', label: 'Color visible', value: 'Azul' },
          { key: 'talla', label: 'Talla visible', value: '4' },
        ],
      }],
    })],
    inventoryStocks: [],
  });
  const attributes = plan.productUpdates[0].set.variants[0].attributes;
  assert.equal(attributes[0].label, 'Color visible');
  assert.equal(attributes[0].value, 'blue');
  assert.equal(attributes[1].label, 'Talla visible');
});

check('actualiza referencias de combos al mismo variantKey', () => {
  const target = product('p1', { variants: [legacyVariant] });
  const owner = product('p2', {
    bundleComponents: [{ product: 'p1', variantKey: '4__azul rey', quantity: 1 }],
  });
  const plan = buildLegacyProductVariantMigrationPlan({
    products: [target, owner],
    inventoryStocks: [],
  });
  const ownerUpdate = plan.productUpdates.find((entry) => entry.productId === 'p2');
  assert.equal(ownerUpdate.set.bundleComponents[0].variantKey, '4__royalblue');
});

check('fusiona filas equivalentes conservando el stock total', () => {
  const now = new Date('2026-08-03T00:00:00.000Z');
  const plan = buildLegacyProductVariantMigrationPlan({
    products: [product('p1', { variants: [legacyVariant] })],
    inventoryStocks: [
      {
        _id: 's1', branch: 'b1', product: 'p1', variantKey: '4__azul rey',
        variant: { size: '4', color: 'Azul rey', attributes: [] },
        stock: 2, reservedStock: 1, availableStock: 1, active: false, deletedAt: null,
      },
      {
        _id: 's2', branch: 'b1', product: 'p1', variantKey: '4__royalblue',
        variant: { size: '4', color: 'royalblue', attributes: [] },
        stock: 3, reservedStock: 0, availableStock: 3, active: true, deletedAt: null,
      },
    ],
    now,
  });
  const survivor = plan.inventoryStockUpdates.find((entry) => entry.action === 'MERGE_SURVIVOR');
  const retired = plan.inventoryStockUpdates.find((entry) => entry.action === 'RETIRE_DUPLICATE');
  assert.equal(survivor.stockId, 's2');
  assert.equal(survivor.set.stock, 5);
  assert.equal(survivor.set.reservedStock, 1);
  assert.equal(survivor.set.availableStock, 4);
  assert.equal(retired.stockId, 's1');
  assert.equal(retired.set.stock, 0);
  assert.equal(String(retired.set.deletedAt), String(now));
});

check('la segunda ejecución es idempotente', () => {
  const canonicalProduct = product('p1', {
    colors: ['royalblue'],
    variants: [{ ...legacyVariant, variantKey: '4__royalblue', color: 'royalblue' }],
  });
  const canonicalStock = {
    _id: 's1', branch: 'b1', product: 'p1', variantKey: '4__royalblue',
    variant: { size: '4', color: 'royalblue', attributes: [] },
    stock: 2, reservedStock: 0, availableStock: 2, active: true, deletedAt: null,
  };
  const plan = buildLegacyProductVariantMigrationPlan({
    products: [canonicalProduct], inventoryStocks: [canonicalStock],
  });
  assert.equal(plan.summary.productsToUpdate, 0);
  assert.equal(plan.summary.inventoryStocksToUpdate, 0);
});

check('bloquea variantes que colisionan al canonizar', () => {
  const plan = buildLegacyProductVariantMigrationPlan({
    products: [product('p1', {
      variants: [legacyVariant, { ...legacyVariant, variantKey: '4__royalblue', color: 'royalblue' }],
    })],
    inventoryStocks: [],
  });
  assert.equal(plan.summary.blockingConflicts, 1);
});

console.log(`RESULTADO: ${passed}/${passed} pruebas aprobadas; MongoDB no conectado.`);
