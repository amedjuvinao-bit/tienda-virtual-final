'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');
const {
  INDEX_DEFINITIONS,
  ProductCodeMigrationError,
  assertWriteSafety,
  auditProductCommercialCodes,
  backfillProductCommercialCodeKeys,
  createApprovedProductCommercialCodeIndexes,
  inspectApprovedIndexes,
  verifyProductCommercialCodeMigration,
} = require('../services/productCommercialCodeIndexMigrationService');
const {
  getMongooseIndexPolicy,
} = require('../config/mongooseIndexPolicy');
const {
  parseArguments,
  safeMigrationError,
} = require('./migrateProductCommercialCodeIndexes');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

class MemoryRepository {
  constructor(documents = [], indexes = []) {
    this.documents = clone(documents);
    this.indexes = clone([
      { name: '_id_', key: { _id: 1 }, unique: true },
      ...indexes,
    ]);
    this.writeCalls = [];
    this.createIndexCalls = [];
  }

  async *scanProducts() {
    for (const document of [...this.documents].sort((left, right) =>
      String(left._id).localeCompare(String(right._id))
    )) {
      yield clone(document);
    }
  }

  async writeKeyBatch(operations) {
    this.writeCalls.push(clone(operations));
    for (const operation of operations) {
      const document = this.documents.find(
        (row) => String(row._id) === String(operation.documentId)
      );
      assert.ok(document, 'El backfill debe apuntar al documento original.');
      for (const [field, value] of Object.entries(operation.update.$set || {})) {
        document[field] = clone(value);
      }
      for (const field of Object.keys(operation.update.$unset || {})) {
        delete document[field];
      }
    }
  }

  async listIndexes() {
    return clone(this.indexes);
  }

  async createIndex(key, options) {
    this.createIndexCalls.push({ key: clone(key), options: clone(options) });
    this.indexes.push({ key: clone(key), ...clone(options) });
    return options.name;
  }
}

function product(overrides = {}) {
  return {
    _id: overrides._id || 'p1',
    title: overrides.title || 'Vestido',
    sku: 'VESTIDO-BASE',
    barcode: null,
    variants: [],
    ...overrides,
  };
}

function approvedIndexes() {
  return INDEX_DEFINITIONS.map((definition) => clone(definition));
}

async function expectCode(promiseFactory, code) {
  await assert.rejects(promiseFactory, (error) => {
    assert.ok(error instanceof ProductCodeMigrationError);
    assert.equal(error.code, code);
    return true;
  });
}

async function run() {
  assert.equal(mongoose.connection.readyState, 0);
  const checks = [];
  const test = async (name, fn) => {
    assert.equal(mongoose.connection.readyState, 0, 'MongoDB debe estar desconectado');
    await fn();
    assert.equal(mongoose.connection.readyState, 0, 'MongoDB debe seguir desconectado');
    checks.push(name);
    console.log(`OK ${checks.length} - ${name}`);
  };

  await test('audit es solo lectura y es el modo predeterminado', async () => {
    const repository = new MemoryRepository([product()]);
    const result = await auditProductCommercialCodes({ repository });
    assert.equal(result.readOnly, true);
    assert.equal(repository.writeCalls.length, 0);
    assert.equal(repository.createIndexCalls.length, 0);
    assert.equal(parseArguments([]).mode, 'audit');
  });

  await test('detecta conflicto producto contra producto', async () => {
    const repository = new MemoryRepository([
      product({ _id: 'p1', sku: 'SKU-REPETIDO' }),
      product({ _id: 'p2', sku: 'sku-repetido' }),
    ]);
    const result = await auditProductCommercialCodes({ repository });
    const conflict = result.conflicts.find((row) => row.kind === 'product-product');
    assert.ok(conflict);
    assert.deepEqual(Object.keys(conflict.occurrences[0]), [
      '_id',
      'productName',
      'location',
      'originalValue',
      'normalizedKey',
    ]);
  });

  await test('detecta conflicto producto contra variante', async () => {
    const repository = new MemoryRepository([
      product({ _id: 'p1', sku: 'SKU-COMPARTIDO' }),
      product({
        _id: 'p2',
        sku: 'SKU-P2',
        variants: [{ sku: 'sku-compartido', variantKey: '4__royalblue' }],
      }),
    ]);
    const result = await auditProductCommercialCodes({ repository });
    assert.ok(result.conflicts.some((row) => row.kind === 'product-variant'));
  });

  await test('detecta conflicto variante contra variante', async () => {
    const repository = new MemoryRepository([
      product({
        _id: 'p1',
        sku: 'SKU-P1',
        variants: [{ sku: 'VAR-001', variantKey: '4__royalblue' }],
      }),
      product({
        _id: 'p2',
        sku: 'SKU-P2',
        variants: [{ sku: 'var-001', variantKey: '6__black' }],
      }),
    ]);
    const result = await auditProductCommercialCodes({ repository });
    assert.ok(result.conflicts.some((row) => row.kind === 'variant-variant'));
  });

  await test('detecta duplicados dentro del mismo producto', async () => {
    const repository = new MemoryRepository([
      product({
        sku: 'SKU-UNO',
        variants: [{ sku: ' sku-uno ', variantKey: '4__royalblue' }],
      }),
    ]);
    const result = await auditProductCommercialCodes({ repository });
    assert.ok(result.conflicts.some((row) => row.kind === 'within-product'));
  });

  await test('detecta colisiones por NFKC, espacios y mayusculas', async () => {
    const repository = new MemoryRepository([
      product({ _id: 'p1', sku: 'ＡＢＣ   001' }),
      product({ _id: 'p2', sku: ' abc 001 ' }),
    ]);
    const result = await auditProductCommercialCodes({ repository });
    const conflict = result.conflicts.find(
      (row) => row.normalizedKey === 'ABC 001'
    );
    assert.ok(conflict);
    assert.equal(conflict.occurrences.length, 2);
  });

  await test('ignora valores opcionales vacios sin falsos conflictos', async () => {
    const repository = new MemoryRepository([
      product({ _id: 'p1', sku: '', barcode: null }),
      product({ _id: 'p2', sku: '   ', barcode: '' }),
    ]);
    const result = await auditProductCommercialCodes({ repository });
    assert.equal(result.conflictCount, 0);
    assert.equal(result.occurrencesScanned, 0);
  });

  await test('backfill completa productos simples y con variantes por lotes', async () => {
    const repository = new MemoryRepository([
      product({ _id: 'p1', sku: ' simple-01 ', barcode: 'ABC-01' }),
      product({
        _id: 'p2',
        sku: 'var-base',
        variants: [
          {
            sku: 'var-4-blue',
            barcode: 'BAR-4-BLUE',
            variantKey: '4__royalblue',
          },
        ],
      }),
    ]);
    const result = await backfillProductCommercialCodeKeys({
      repository,
      batchSize: 1,
    });
    assert.equal(result.productsChanged, 2);
    assert.equal(result.batchesWritten, 2);
    assert.deepEqual(repository.documents[0].skuKeys, ['SIMPLE-01']);
    assert.deepEqual(repository.documents[0].barcodeKeys, ['abc-01']);
    assert.deepEqual(repository.documents[1].skuKeys, ['VAR-BASE', 'VAR-4-BLUE']);
    assert.deepEqual(repository.documents[1].barcodeKeys, ['bar-4-blue']);
  });

  await test('backfill conserva exactamente variantKey 4__royalblue', async () => {
    const repository = new MemoryRepository([
      product({
        variants: [{ sku: 'ROYAL-4', variantKey: '4__royalblue' }],
      }),
    ]);
    await backfillProductCommercialCodeKeys({ repository });
    assert.equal(repository.documents[0].variants[0].variantKey, '4__royalblue');
    const writtenFields = Object.keys(repository.writeCalls[0][0].update.$set);
    assert.deepEqual(writtenFields, ['skuKeys']);
  });

  await test('segunda ejecucion de backfill es idempotente', async () => {
    const repository = new MemoryRepository([product({ sku: 'IDEM-01' })]);
    const first = await backfillProductCommercialCodeKeys({ repository });
    const second = await backfillProductCommercialCodeKeys({ repository });
    assert.equal(first.productsChanged, 1);
    assert.equal(second.productsChanged, 0);
    assert.equal(second.batchesWritten, 0);
    assert.equal(repository.writeCalls.length, 1);
  });

  await test('backfill se bloquea cuando existen conflictos', async () => {
    const repository = new MemoryRepository([
      product({ _id: 'p1', sku: 'DUP-01' }),
      product({ _id: 'p2', sku: 'dup-01' }),
    ]);
    await expectCode(
      () => backfillProductCommercialCodeKeys({ repository }),
      'BACKFILL_BLOCKED'
    );
    assert.equal(repository.writeCalls.length, 0);
  });

  await test('backfill se bloquea cuando existen documentos invalidos', async () => {
    const repository = new MemoryRepository([
      product({ variants: 'estructura-invalida' }),
    ]);
    await expectCode(
      () => backfillProductCommercialCodeKeys({ repository }),
      'BACKFILL_BLOCKED'
    );
    assert.equal(repository.writeCalls.length, 0);
  });

  await test('creacion de indices exige saneamiento y backfill completos', async () => {
    const repository = new MemoryRepository([product({ sku: 'PENDIENTE-01' })]);
    await expectCode(
      () => createApprovedProductCommercialCodeIndexes({ repository }),
      'INDEX_CREATION_BLOCKED'
    );
    assert.equal(repository.createIndexCalls.length, 0);
  });

  await test('crea exclusivamente las dos definiciones aprobadas y las verifica', async () => {
    const repository = new MemoryRepository([
      product({
        sku: 'LISTO-01',
        barcode: 'BAR-LISTO-01',
        skuKeys: ['LISTO-01'],
        barcodeKeys: ['bar-listo-01'],
      }),
    ]);
    const result = await createApprovedProductCommercialCodeIndexes({ repository });
    assert.deepEqual(result.created, [
      'uniq_product_sku_keys',
      'uniq_product_barcode_keys',
    ]);
    assert.equal(repository.createIndexCalls.length, 2);
    assert.deepEqual(
      repository.createIndexCalls.map((call) => ({
        key: call.key,
        ...call.options,
      })),
      approvedIndexes()
    );
    assert.ok(result.indexes.every((index) => index.ready));
  });

  await test('rechaza un indice existente con definicion incompatible', async () => {
    const repository = new MemoryRepository(
      [product({ sku: 'LISTO-02', skuKeys: ['LISTO-02'] })],
      [{
        name: 'uniq_product_sku_keys',
        key: { skuKeys: -1 },
        unique: true,
        partialFilterExpression: { skuKeys: { $type: 'string' } },
      }]
    );
    await expectCode(
      () => createApprovedProductCommercialCodeIndexes({ repository }),
      'INCOMPATIBLE_EXISTING_INDEX'
    );
    assert.equal(repository.createIndexCalls.length, 0);
  });

  await test('verify es solo lectura y comprueba datos e indices', async () => {
    const repository = new MemoryRepository(
      [product({ sku: 'VERIFY-01', skuKeys: ['VERIFY-01'] })],
      approvedIndexes()
    );
    const result = await verifyProductCommercialCodeMigration({ repository });
    assert.equal(result.readOnly, true);
    assert.equal(result.verified, true);
    assert.equal(repository.writeCalls.length, 0);
    assert.ok(inspectApprovedIndexes(repository.indexes).every((row) => row.ready));
  });

  await test('protege escrituras y ejecucion accidental sobre produccion', async () => {
    const base = {
      mode: 'backfill',
      databaseName: 'tienda_produccion',
      confirmDatabase: 'tienda_produccion',
      nodeEnv: 'production',
    };
    assert.throws(
      () => assertWriteSafety(base),
      (error) => error.code === 'EXPLICIT_APPLY_REQUIRED'
    );
    assert.throws(
      () => assertWriteSafety({ ...base, apply: true, confirmDatabase: 'otra' }),
      (error) => error.code === 'DATABASE_CONFIRMATION_MISMATCH'
    );
    assert.throws(
      () => assertWriteSafety({ ...base, apply: true }),
      (error) => error.code === 'PRODUCTION_MIGRATION_CONFIRMATION_REQUIRED'
    );
    assert.equal(
      assertWriteSafety({ ...base, apply: true, allowProduction: true }),
      'backfill'
    );
  });

  await test('errores seguros no exponen URI, credenciales ni secretos', async () => {
    const secret = 'mongodb://usuario:clave-ultrasecreta@host/base';
    const safe = safeMigrationError(new Error(secret));
    const serialized = JSON.stringify(safe);
    assert.ok(!serialized.includes('mongodb://'));
    assert.ok(!serialized.includes('clave-ultrasecreta'));
    assert.ok(!serialized.includes('usuario'));
  });

  await test('el informe de auditoria es deterministico', async () => {
    const rows = [
      product({ _id: 'p2', title: 'Segundo', sku: 'DET-01' }),
      product({ _id: 'p1', title: 'Primero', sku: 'det-01' }),
    ];
    const first = await auditProductCommercialCodes({
      repository: new MemoryRepository(rows),
    });
    const second = await auditProductCommercialCodes({
      repository: new MemoryRepository([...rows].reverse()),
    });
    assert.equal(JSON.stringify(first), JSON.stringify(second));
  });

  await test('autoIndex esta desactivado explicitamente en produccion', async () => {
    assert.deepEqual(getMongooseIndexPolicy({ nodeEnv: 'production' }), {
      autoIndex: false,
      production: true,
    });
    assert.equal(getMongooseIndexPolicy({ nodeEnv: 'development' }).autoIndex, true);
  });

  await test('el arranque y la migracion no usan syncIndexes', async () => {
    const backendRoot = path.join(__dirname, '..');
    const sources = [
      fs.readFileSync(path.join(backendRoot, 'index.js'), 'utf8'),
      fs.readFileSync(
        path.join(__dirname, 'migrateProductCommercialCodeIndexes.js'),
        'utf8'
      ),
    ].join('\n');
    assert.ok(!sources.includes('syncIndexes('));
    assert.match(sources, /autoIndex:\s*mongooseIndexPolicy\.autoIndex/);
    assert.match(sources, /autoIndex:\s*false/);
  });

  assert.equal(mongoose.connection.readyState, 0);
  console.log(`\nRESULTADO: ${checks.length}/${checks.length} pruebas aprobadas.`);
  console.log('MongoDB readyState:', mongoose.connection.readyState);
}

run().catch((error) => {
  console.error('FALLO SEGURO:', error?.code || error?.name || 'TEST_FAILED');
  process.exitCode = 1;
});
