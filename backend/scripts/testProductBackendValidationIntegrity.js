'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');

const Product = require('../models/Product');
const {
  ProductCommercialCodeConflictError,
  ProductInputValidationError,
  mapProductWriteError,
  validateAndNormalizeProductInput,
} = require('../services/productInputValidationService');
const {
  normalizeVariantRows,
} = require('../services/productInventorySyncService');

const PRODUCT_ID = '68a4a78a59706e44cade0316';
const OTHER_PRODUCT_ID = '68a4a78a59706e44cade0317';
const checks = [];

async function check(name, callback) {
  assert.equal(mongoose.connection.readyState, 0, 'MongoDB debe estar desconectado');
  await callback();
  assert.equal(mongoose.connection.readyState, 0, 'MongoDB debe seguir desconectado');
  checks.push(name);
  console.log(`OK ${checks.length}: ${name}`);
}

const noConflict = async () => false;

function simpleProduct(overrides = {}) {
  return {
    title: 'Vestido sencillo',
    price: 120000,
    sku: 'VESTIDO-SIMPLE-001',
    barcode: '770123400001',
    productType: 'physical',
    trackInventory: true,
    stock: 4,
    variants: [],
    ...overrides,
  };
}

function variantProduct(overrides = {}) {
  return {
    title: 'Vestido por variantes',
    price: 150000,
    sku: 'VESTIDO-VARIANTES-001',
    productType: 'physical',
    trackInventory: true,
    stock: 2,
    variants: [
      {
        variantKey: '4__royalblue',
        size: '4',
        color: 'royalblue',
        label: 'Talla 4 · Azul rey',
        sku: 'VESTIDO-4-ROYALBLUE',
        barcode: '770123400004',
        price: 150000,
        originalPrice: 180000,
        initialStock: 2,
        active: true,
      },
    ],
    ...overrides,
  };
}

async function expectValidationError(payload, expectedCode) {
  let caught;
  try {
    await validateAndNormalizeProductInput(payload, {
      mode: 'create',
      conflictLookup: noConflict,
    });
  } catch (error) {
    caught = error;
  }
  assert(caught instanceof ProductInputValidationError);
  assert(
    caught.errors.some((entry) => entry.code === expectedCode),
    `No apareció ${expectedCode}: ${JSON.stringify(caught.errors)}`
  );
}

async function main() {
  assert.equal(mongoose.connection.readyState, 0);

  await check('producto simple válido conserva precio, stock y códigos normalizados', async () => {
    const result = await validateAndNormalizeProductInput(simpleProduct(), {
      mode: 'create',
      conflictLookup: noConflict,
    });
    assert.equal(result.payload.title, 'Vestido sencillo');
    assert.equal(result.payload.price, 120000);
    assert.equal(result.payload.stock, 4);
    assert.deepEqual(result.skuKeys, ['VESTIDO-SIMPLE-001']);
    assert.deepEqual(result.barcodeKeys, ['770123400001']);
  });

  await check('producto con variantes válido usa valores canónicos', async () => {
    const result = await validateAndNormalizeProductInput(variantProduct(), {
      mode: 'create',
      conflictLookup: noConflict,
    });
    assert.equal(result.payload.variants.length, 1);
    assert.equal(result.payload.variants[0].color, 'royalblue');
    assert.equal(result.payload.stock, 2);
  });

  await check('conserva exactamente 4__royalblue', async () => {
    const result = await validateAndNormalizeProductInput(variantProduct(), {
      mode: 'create',
      conflictLookup: noConflict,
    });
    assert.equal(result.payload.variants[0].variantKey, '4__royalblue');
  });

  await check('rechaza precios y descuentos inválidos', async () => {
    await expectValidationError(simpleProduct({ price: -1 }), 'INVALID_NUMBER');
    await expectValidationError(
      simpleProduct({ price: 120000, originalPrice: 100000 }),
      'INVALID_DISCOUNT'
    );
    await expectValidationError(
      simpleProduct({ discountPercent: 101 }),
      'INVALID_NUMBER'
    );
  });

  await check('rechaza stock y cantidades no enteras o negativas', async () => {
    await expectValidationError(simpleProduct({ stock: 1.5 }), 'NON_NEGATIVE_INTEGER_REQUIRED');
    await expectValidationError(
      variantProduct({
        variants: [{
          variantKey: '4__royalblue',
          size: '4',
          color: 'royalblue',
          initialStock: -1,
        }],
      }),
      'NON_NEGATIVE_INTEGER_REQUIRED'
    );
  });

  await check('rechaza variantes repetidas e incoherentes', async () => {
    await expectValidationError(
      variantProduct({
        variants: [
          { size: '4', color: 'royalblue', initialStock: 1 },
          { size: '4', color: 'royalblue', initialStock: 1 },
        ],
      }),
      'DUPLICATE_VARIANT_COMBINATION'
    );
    await expectValidationError(
      variantProduct({ trackInventory: false }),
      'INVENTORY_CONFIGURATION_CONFLICT'
    );
  });

  await check('rechaza etiquetas visibles como valores canónicos', async () => {
    await expectValidationError(
      variantProduct({
        variants: [{
          variantKey: '4__royalblue',
          size: '4',
          color: 'Azul rey',
          initialStock: 1,
        }],
      }),
      'CANONICAL_VALUE_REQUIRED'
    );
  });

  await check('reproduce el payload heredado rechazado al editar', async () => {
    const legacyPayload = variantProduct({
      variants: [
        {
          variantKey:
            'v2__capacidad=256gb__color=azul__conectividad=5g__ram=12gb',
          size: '256GB',
          color: 'Azul',
          attributes: [
            { key: 'capacidad', label: 'Capacidad', value: '256GB' },
            { key: 'ram', label: 'RAM', value: '12GB' },
            { key: 'color', label: 'Color', value: 'Azul' },
            { key: 'conectividad', label: 'Conectividad', value: '5G' },
          ],
        },
        {
          variantKey:
            'v2__capacidad=512gb__color=negro__conectividad=esim%20%2b%205g__ram=16gb',
          size: '512GB',
          color: 'Negro',
          attributes: [
            { key: 'capacidad', label: 'Capacidad', value: '512GB' },
            { key: 'ram', label: 'RAM', value: '16GB' },
            { key: 'color', label: 'Color', value: 'Negro' },
            { key: 'conectividad', label: 'Conectividad', value: 'eSIM + 5G' },
          ],
        },
      ],
    });
    let caught;
    try {
      await validateAndNormalizeProductInput(legacyPayload, {
        mode: 'update',
        existingProduct: { _id: PRODUCT_ID, ...legacyPayload },
        conflictLookup: noConflict,
      });
    } catch (error) {
      caught = error;
    }

    assert(caught instanceof ProductInputValidationError);
    assert.deepEqual(
      caught.errors.map(({ field, code }) => ({ field, code })),
      [
        { field: 'variants.0.color', code: 'CANONICAL_VALUE_REQUIRED' },
        { field: 'variants.0.attributes.2.value', code: 'CANONICAL_VALUE_REQUIRED' },
        { field: 'variants.0.variantKey', code: 'VARIANT_KEY_MISMATCH' },
        { field: 'variants.1.color', code: 'CANONICAL_VALUE_REQUIRED' },
        { field: 'variants.1.attributes.2.value', code: 'CANONICAL_VALUE_REQUIRED' },
        { field: 'variants.1.variantKey', code: 'VARIANT_KEY_MISMATCH' },
      ]
    );
  });

  await check('SKU duplicado al crear devuelve conflicto controlado', async () => {
    await assert.rejects(
      validateAndNormalizeProductInput(simpleProduct({ sku: 'SKU-DUPLICADO' }), {
        mode: 'create',
        conflictLookup: async ({ type, keys, excludeId }) =>
          type === 'sku' && keys.includes('SKU-DUPLICADO') && !excludeId,
      }),
      (error) =>
        error instanceof ProductCommercialCodeConflictError &&
        error.code === 'PRODUCT_SKU_CONFLICT'
    );
  });

  await check('SKU duplicado al editar excluye el producto propio', async () => {
    const existing = { _id: PRODUCT_ID, ...simpleProduct() };
    await assert.rejects(
      validateAndNormalizeProductInput({ sku: 'SKU-OTRO' }, {
        mode: 'update',
        existingProduct: existing,
        conflictLookup: async ({ type, keys, excludeId }) =>
          type === 'sku' && keys.includes('SKU-OTRO') && String(excludeId) === PRODUCT_ID,
      }),
      (error) => error.code === 'PRODUCT_SKU_CONFLICT'
    );
  });

  await check('código de barras duplicado se rechaza al crear y editar', async () => {
    const lookup = async ({ type, keys }) =>
      type === 'barcode' && keys.includes('barcode-duplicado');
    await assert.rejects(
      validateAndNormalizeProductInput(
        simpleProduct({ barcode: 'BARCODE-DUPLICADO' }),
        { mode: 'create', conflictLookup: lookup }
      ),
      (error) => error.code === 'PRODUCT_BARCODE_CONFLICT'
    );
    await assert.rejects(
      validateAndNormalizeProductInput(
        { barcode: 'barcode-duplicado' },
        {
          mode: 'update',
          existingProduct: { _id: PRODUCT_ID, ...simpleProduct() },
          conflictLookup: lookup,
        }
      ),
      (error) => error.code === 'PRODUCT_BARCODE_CONFLICT'
    );
  });

  await check('editar el mismo producto no produce conflicto falso', async () => {
    let observedExclude = '';
    const result = await validateAndNormalizeProductInput(
      { sku: ' vestido-simple-001 ', barcode: '770123400001' },
      {
        mode: 'update',
        existingProduct: { _id: PRODUCT_ID, ...simpleProduct() },
        conflictLookup: async ({ excludeId }) => {
          observedExclude = String(excludeId || '');
          return false;
        },
      }
    );
    assert.equal(observedExclude, PRODUCT_ID);
    assert.equal(result.payload.sku, 'VESTIDO-SIMPLE-001');
  });

  await check('varios productos sin SKU ni barcode no generan conflicto vacío', async () => {
    let calls = 0;
    for (const title of ['Producto vacío A', 'Producto vacío B']) {
      const result = await validateAndNormalizeProductInput(
        { title, price: 1000, sku: '', barcode: '', variants: [] },
        {
          mode: 'create',
          conflictLookup: async () => { calls += 1; return true; },
        }
      );
      assert.deepEqual(result.skuKeys, []);
      assert.deepEqual(result.barcodeKeys, []);
    }
    assert.equal(calls, 0);
  });

  await check('normaliza de la misma forma antes de comparar y guardar', async () => {
    const result = await validateAndNormalizeProductInput(
      simpleProduct({ sku: '  vestido-abc-01 ', barcode: '  AbC-001  ' }),
      { mode: 'create', conflictLookup: noConflict }
    );
    assert.equal(result.payload.sku, 'VESTIDO-ABC-01');
    assert.equal(result.payload.barcode, 'AbC-001');
    assert.deepEqual(result.skuKeys, ['VESTIDO-ABC-01']);
    assert.deepEqual(result.barcodeKeys, ['abc-001']);
  });

  await check('E11000 se convierte en HTTP 409 sin información interna', () => {
    for (const [key, expected] of [
      ['skuKeys', 'PRODUCT_SKU_CONFLICT'],
      ['barcodeKeys', 'PRODUCT_BARCODE_CONFLICT'],
    ]) {
      const mapped = mapProductWriteError({
        code: 11000,
        keyPattern: { [key]: 1 },
        keyValue: { [key]: 'SECRETO-NO-DEBE-SALIR' },
        message: 'E11000 collection: produccion.products index interno',
        stack: 'ruta/interna/model.js:99',
      });
      assert.equal(mapped.status, 409);
      assert.equal(mapped.body.error, expected);
      const serialized = JSON.stringify(mapped.body);
      for (const forbidden of ['SECRETO', 'collection', 'index', 'ruta/interna', 'E11000']) {
        assert(!serialized.includes(forbidden));
      }
    }
  });

  await check('índices únicos parciales cubren concurrencia y campos opcionales', () => {
    const indexes = Product.schema.indexes();
    for (const [field, name] of [
      ['skuKeys', 'uniq_product_sku_keys'],
      ['barcodeKeys', 'uniq_product_barcode_keys'],
    ]) {
      const entry = indexes.find(([keys, options]) => keys[field] === 1 && options.name === name);
      assert(entry, name);
      assert.equal(entry[1].unique, true);
      assert.deepEqual(entry[1].partialFilterExpression, {
        [field]: { $type: 'string' },
      });
    }
  });

  await check('sincronización de inventario conserva variante y códigos normalizados', async () => {
    const validated = await validateAndNormalizeProductInput(variantProduct(), {
      mode: 'create',
      conflictLookup: noConflict,
    });
    const rows = normalizeVariantRows(
      { _id: OTHER_PRODUCT_ID, trackInventory: true, variants: validated.payload.variants },
      { variantsAuthoritative: true }
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].variantKey, '4__royalblue');
    assert.equal(rows[0].sku, 'VESTIDO-4-ROYALBLUE');
    assert.equal(rows[0].barcode, '770123400004');
  });

  await check('crear, editar y ruta especializada usan la misma autoridad', () => {
    const productsRoute = fs.readFileSync(
      path.join(__dirname, '..', 'routes', 'productRoutes.js'),
      'utf8'
    );
    const variantsRoute = fs.readFileSync(
      path.join(__dirname, '..', 'routes', 'adminProductVariants.js'),
      'utf8'
    );
    assert.equal(
      (productsRoute.match(/validateAndNormalizeProductInput\(/g) || []).length,
      2
    );
    assert(variantsRoute.includes('validateAndNormalizeProductInput('));
    assert(productsRoute.includes('mapProductWriteError(error)'));
    assert(variantsRoute.includes('mapProductWriteError(error)'));
  });

  console.log(`\nRESULTADO: ${checks.length}/${checks.length} pruebas aprobadas.`);
  console.log('MongoDB readyState:', mongoose.connection.readyState);
}

main().catch((error) => {
  console.error('FALLO testProductBackendValidationIntegrity:', error.message);
  process.exitCode = 1;
});
