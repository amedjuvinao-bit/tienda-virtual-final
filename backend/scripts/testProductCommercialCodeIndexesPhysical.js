'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');

require('dotenv').config({ path: '.env', quiet: true });

const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const InventoryMovement = require('../models/InventoryMovement');
const InventoryStock = require('../models/InventoryStock');
const Product = require('../models/Product');
const productRoutes = require('../routes/productRoutes');
const {
  mapProductWriteError,
} = require('../services/productInputValidationService');

function parseArguments(argv = []) {
  const options = {
    applyTestRecords: false,
    confirmDatabase: '',
  };
  for (const argument of argv) {
    if (argument === '--apply-test-records') {
      options.applyTestRecords = true;
      continue;
    }
    if (argument.startsWith('--confirm-database=')) {
      options.confirmDatabase = argument.slice('--confirm-database='.length);
      continue;
    }
    throw new Error('STAGE9_UNKNOWN_ARGUMENT');
  }
  return options;
}

function databaseNameFromUri(uri) {
  const value = String(uri || '').trim();
  if (!/^mongodb(?:\+srv)?:\/\//i.test(value)) {
    throw new Error('STAGE9_TEST_MONGODB_URI_REQUIRED');
  }
  const parsed = new URL(value);
  return decodeURIComponent(
    (parsed.pathname || '').replace(/^\//, '').split('/')[0] || ''
  );
}

function assertSafety(options, configuredDatabaseName) {
  assert.equal(
    options.applyTestRecords,
    true,
    'STAGE9_EXPLICIT_TEST_WRITE_REQUIRED'
  );
  assert.ok(configuredDatabaseName, 'STAGE9_DATABASE_NAME_REQUIRED');
  assert.equal(
    options.confirmDatabase,
    configuredDatabaseName,
    'STAGE9_DATABASE_CONFIRMATION_MISMATCH'
  );
  assert.equal(
    configuredDatabaseName,
    'tienda_virtual',
    'STAGE9_UNAUTHORIZED_DATABASE'
  );
}

function uniqueText(runId, suffix) {
  return `${runId}-${suffix}`.toUpperCase();
}

function simplePayload(runId, suffix, overrides = {}) {
  return {
    title: `STAGE9 ${runId} ${suffix}`,
    price: 19000,
    sku: uniqueText(runId, `SKU-${suffix}`),
    productType: 'physical',
    trackInventory: false,
    stock: 0,
    active: false,
    notes: `STAGE9_TEST_RUN:${runId}`,
    variants: [],
    ...overrides,
  };
}

function variantPayload(runId) {
  return {
    title: `STAGE9 ${runId} VARIANT ROYALBLUE`,
    price: 29000,
    sku: uniqueText(runId, 'SKU-VARIANT-ROOT'),
    barcode: uniqueText(runId, 'BARCODE-VARIANT-ROOT'),
    productType: 'physical',
    trackInventory: true,
    stock: 0,
    active: false,
    notes: `STAGE9_TEST_RUN:${runId}`,
    variants: [
      {
        variantKey: '4__royalblue',
        size: '4',
        color: 'royalblue',
        label: 'Talla 4 - Azul rey',
        sku: uniqueText(runId, 'SKU-4-ROYALBLUE'),
        barcode: uniqueText(runId, 'BARCODE-4-ROYALBLUE'),
        price: 29000,
        initialStock: 0,
        active: true,
      },
    ],
  };
}

async function startTestHttpServer() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '256kb' }));
  app.use('/api/products', productRoutes);
  const server = await new Promise((resolve, reject) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    instance.once('error', reject);
  });
  return server;
}

async function requestJson({ server, token, method, path, body }) {
  const address = server.address();
  const response = await fetch(
    `http://127.0.0.1:${address.port}${path}`,
    {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    }
  );
  const text = await response.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = {};
  }
  return { status: response.status, body: json };
}

function assertConcurrentHttpConflict(results, expectedCode) {
  const statuses = results.map((result) => result.status).sort();
  assert.deepEqual(statuses, [201, 409]);
  const rejected = results.find((result) => result.status === 409);
  assert.equal(rejected.body?.error, expectedCode);
  assert.equal(Object.hasOwn(rejected.body || {}, 'stack'), false);
  return {
    statuses,
    rejectedCode: rejected.body.error,
  };
}

async function assertPhysicalIndexConcurrency({
  collection,
  runId,
  field,
  expectedCode,
}) {
  const sharedKey = uniqueText(runId, `PHYSICAL-${field}`);
  const documents = [0, 1].map((index) => ({
    title: `STAGE9 ${runId} PHYSICAL ${field} ${index}`,
    slug: `${runId.toLowerCase()}-physical-${field.toLowerCase()}-${index}`,
    price: 1000,
    productType: 'physical',
    trackInventory: false,
    active: false,
    visible: false,
    notes: `STAGE9_TEST_RUN:${runId}`,
    [field]: [sharedKey],
  }));
  const settled = await Promise.allSettled(
    documents.map((document) => collection.insertOne(document))
  );
  const fulfilled = settled.filter((entry) => entry.status === 'fulfilled');
  const rejected = settled.filter((entry) => entry.status === 'rejected');
  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);
  assert.equal(Number(rejected[0].reason?.code), 11000);
  const mapped = mapProductWriteError(rejected[0].reason);
  assert.equal(mapped?.status, 409);
  assert.equal(mapped?.body?.error, expectedCode);
  return {
    attempts: 2,
    completed: 1,
    rejected: 1,
    rejectedStatus: mapped.status,
    rejectedCode: mapped.body.error,
  };
}

async function cleanupRun(runMarker) {
  const products = await Product.collection
    .find({ notes: runMarker }, { projection: { _id: 1 } })
    .toArray();
  const productIds = products.map((product) => product._id);
  const movementResult = productIds.length
    ? await InventoryMovement.collection.deleteMany({
        sourceModel: 'Product',
        sourceId: { $in: productIds },
      })
    : { deletedCount: 0 };
  const stockResult = productIds.length
    ? await InventoryStock.collection.deleteMany({
        product: { $in: productIds },
      })
    : { deletedCount: 0 };
  const productResult = await Product.collection.deleteMany({
    notes: runMarker,
  });
  const remaining = await Product.collection.countDocuments({
    notes: runMarker,
  });
  assert.equal(remaining, 0);
  return {
    productsDeleted: Number(productResult.deletedCount || 0),
    inventoryStocksDeleted: Number(stockResult.deletedCount || 0),
    inventoryMovementsDeleted: Number(movementResult.deletedCount || 0),
    remainingTestProducts: remaining,
  };
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArguments(argv);
  const uri = process.env.MONGODB_URI;
  const databaseName = databaseNameFromUri(uri);
  assertSafety(options, databaseName);
  assert.ok(process.env.JWT_SECRET, 'STAGE9_JWT_SECRET_REQUIRED');

  const runId = `S9${Date.now().toString(36)}${crypto
    .randomBytes(4)
    .toString('hex')}`;
  const runMarker = `STAGE9_TEST_RUN:${runId}`;
  let server = null;
  let result = null;
  let cleanup = null;

  try {
    await mongoose.connect(uri, {
      autoIndex: false,
      serverSelectionTimeoutMS: 10_000,
    });
    assert.equal(
      mongoose.connection.name,
      options.confirmDatabase,
      'STAGE9_CONNECTED_DATABASE_MISMATCH'
    );

    const token = jwt.sign(
      { role: 'admin', username: 'stage9-index-test' },
      process.env.JWT_SECRET,
      { expiresIn: '10m' }
    );
    server = await startTestHttpServer();

    const sharedSku = uniqueText(runId, 'HTTP-SHARED-SKU');
    const skuHttpResults = await Promise.all([
      requestJson({
        server,
        token,
        method: 'POST',
        path: '/api/products',
        body: simplePayload(runId, 'HTTP-SKU-A', { sku: sharedSku }),
      }),
      requestJson({
        server,
        token,
        method: 'POST',
        path: '/api/products',
        body: simplePayload(runId, 'HTTP-SKU-B', { sku: sharedSku }),
      }),
    ]);
    const skuHttpConcurrency = assertConcurrentHttpConflict(
      skuHttpResults,
      'PRODUCT_SKU_CONFLICT'
    );

    const sharedBarcode = uniqueText(runId, 'HTTP-SHARED-BARCODE');
    const barcodeHttpResults = await Promise.all([
      requestJson({
        server,
        token,
        method: 'POST',
        path: '/api/products',
        body: simplePayload(runId, 'HTTP-BARCODE-A', {
          barcode: sharedBarcode,
        }),
      }),
      requestJson({
        server,
        token,
        method: 'POST',
        path: '/api/products',
        body: simplePayload(runId, 'HTTP-BARCODE-B', {
          barcode: sharedBarcode,
        }),
      }),
    ]);
    const barcodeHttpConcurrency = assertConcurrentHttpConflict(
      barcodeHttpResults,
      'PRODUCT_BARCODE_CONFLICT'
    );

    const simpleCreate = await requestJson({
      server,
      token,
      method: 'POST',
      path: '/api/products',
      body: simplePayload(runId, 'SIMPLE-CREATE-EDIT', {
        barcode: uniqueText(runId, 'BARCODE-SIMPLE'),
      }),
    });
    assert.equal(simpleCreate.status, 201);
    const simpleId = String(simpleCreate.body?._id || '');
    assert.match(simpleId, /^[0-9a-f]{24}$/i);
    const simpleEdit = await requestJson({
      server,
      token,
      method: 'PUT',
      path: `/api/products/${simpleId}`,
      body: {
        title: `STAGE9 ${runId} SIMPLE EDITED`,
        price: 21000,
        notes: runMarker,
      },
    });
    assert.equal(simpleEdit.status, 200);
    assert.equal(Number(simpleEdit.body?.price), 21000);

    const variantCreate = await requestJson({
      server,
      token,
      method: 'POST',
      path: '/api/products',
      body: variantPayload(runId),
    });
    assert.equal(variantCreate.status, 201);
    const variantId = String(variantCreate.body?._id || '');
    assert.match(variantId, /^[0-9a-f]{24}$/i);
    const variantEdit = await requestJson({
      server,
      token,
      method: 'PUT',
      path: `/api/products/${variantId}`,
      body: {
        title: `STAGE9 ${runId} VARIANT EDITED`,
        price: 31000,
        notes: runMarker,
      },
    });
    assert.equal(variantEdit.status, 200);
    const persistedVariant = await Product.findById(variantId)
      .select('+skuKeys +barcodeKeys')
      .lean();
    assert.equal(persistedVariant?.variants?.[0]?.variantKey, '4__royalblue');
    const variantStock = await InventoryStock.findOne({
      product: variantId,
      variantKey: '4__royalblue',
    }).lean();
    assert.ok(variantStock);
    assert.equal(variantStock.variantKey, '4__royalblue');

    const optionalDocuments = [0, 1].map((index) => ({
      title: `STAGE9 ${runId} OPTIONAL CODES ${index}`,
      slug: `${runId.toLowerCase()}-optional-codes-${index}`,
      price: 1000,
      productType: 'physical',
      trackInventory: false,
      active: false,
      visible: false,
      notes: runMarker,
    }));
    const optionalInsert = await Product.collection.insertMany(
      optionalDocuments,
      { ordered: true }
    );
    assert.equal(optionalInsert.insertedCount, 2);
    const optionalIds = Object.values(optionalInsert.insertedIds || {});
    const optionalEdit = await Product.collection.updateOne(
      {
        _id: optionalIds[0],
        notes: runMarker,
        sku: { $exists: false },
        barcode: { $exists: false },
      },
      {
        $set: {
          title: `STAGE9 ${runId} OPTIONAL CODES EDITED`,
          price: 1100,
        },
      }
    );
    assert.equal(optionalEdit.matchedCount, 1);
    assert.equal(optionalEdit.modifiedCount, 1);

    const physicalSkuConcurrency = await assertPhysicalIndexConcurrency({
      collection: Product.collection,
      runId,
      field: 'skuKeys',
      expectedCode: 'PRODUCT_SKU_CONFLICT',
    });
    const physicalBarcodeConcurrency = await assertPhysicalIndexConcurrency({
      collection: Product.collection,
      runId,
      field: 'barcodeKeys',
      expectedCode: 'PRODUCT_BARCODE_CONFLICT',
    });

    result = {
      ok: true,
      databaseName: mongoose.connection.name,
      classification: 'AUTHORIZED_TEST_DATABASE',
      httpConcurrency: {
        sku: skuHttpConcurrency,
        barcode: barcodeHttpConcurrency,
      },
      physicalIndexConcurrency: {
        skuKeys: physicalSkuConcurrency,
        barcodeKeys: physicalBarcodeConcurrency,
      },
      realOperations: {
        simpleCreated: true,
        simpleEdited: true,
        variantCreated: true,
        variantEdited: true,
        exactVariantKey: persistedVariant.variants[0].variantKey,
        inventoryVariantKey: variantStock.variantKey,
        productsWithoutInputCodesInserted: optionalInsert.insertedCount,
        productsWithoutInputCodesEdited: optionalEdit.modifiedCount,
      },
    };
  } finally {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    if (mongoose.connection.readyState !== 0) {
      cleanup = await cleanupRun(runMarker).catch((error) => ({
        cleanupError: error.message,
      }));
      await mongoose.disconnect().catch(() => null);
    }
  }

  assert.ok(result, 'STAGE9_TEST_RESULT_REQUIRED');
  assert.equal(cleanup?.remainingTestProducts, 0);
  process.stdout.write(
    `${JSON.stringify({ ...result, cleanup }, null, 2)}\n`
  );
}

if (require.main === module) {
  main().catch(async (error) => {
    process.stderr.write(
      `${JSON.stringify({
        ok: false,
        code: error?.code || error?.name || 'STAGE9_PHYSICAL_TEST_FAILED',
        message: String(error?.message || 'La prueba fisica no pudo completarse.').slice(0, 300),
      })}\n`
    );
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect().catch(() => null);
    }
    process.exitCode = 1;
  });
}

module.exports = {
  assertSafety,
  databaseNameFromUri,
  main,
  parseArguments,
};
