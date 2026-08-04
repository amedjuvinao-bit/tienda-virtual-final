'use strict';

const {
  buildProductCodeKeys,
  normalizeBarcodeKey,
  normalizeSkuValue,
} = require('./productInputValidationService');
const {
  PRODUCT_COMMERCIAL_CODE_UNIQUE_INDEXES,
} = require('../lib/products/productCommercialCodeIndexDefinitions');

const WRITE_MODES = new Set(['backfill', 'create-indexes']);
const ALLOWED_MODES = new Set(['audit', 'backfill', 'create-indexes', 'verify']);

const INDEX_DEFINITIONS = PRODUCT_COMMERCIAL_CODE_UNIQUE_INDEXES;

class ProductCodeMigrationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ProductCodeMigrationError';
    this.code = code;
  }
}

function cleanText(value, max = 300) {
  return String(value ?? '')
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, max);
}

function stableObject(value) {
  if (Array.isArray(value)) return value.map(stableObject);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value)
    .sort()
    .reduce((out, key) => {
      out[key] = stableObject(value[key]);
      return out;
    }, {});
}

function stableJson(value) {
  return JSON.stringify(stableObject(value));
}

function arraysEqual(left, right) {
  return (
    Array.isArray(left) &&
    Array.isArray(right) &&
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function normalizeDocumentId(value) {
  return cleanText(value, 160);
}

function validateStoredKeyField(document, field, invalidEntries) {
  if (!Object.prototype.hasOwnProperty.call(document, field)) return;
  const value = document[field];
  if (value == null) return;
  if (
    !Array.isArray(value) ||
    value.some((entry) => typeof entry !== 'string' || !entry.trim())
  ) {
    invalidEntries.push({
      field,
      code: 'INVALID_STORED_KEY_ARRAY',
    });
  }
}

function addOccurrence({
  occurrences,
  invalidEntries,
  type,
  productId,
  productTitle,
  location,
  source,
  originalValue,
}) {
  if (originalValue == null || originalValue === '') return;
  if (typeof originalValue !== 'string') {
    invalidEntries.push({
      field: location,
      code: 'COMMERCIAL_CODE_MUST_BE_STRING',
    });
    return;
  }
  if (!originalValue.trim()) return;
  const normalizedKey = type === 'sku'
    ? normalizeSkuValue(originalValue)
    : normalizeBarcodeKey(originalValue);
  if (!normalizedKey) return;
  occurrences.push({
    type,
    productId,
    productTitle,
    location,
    source,
    originalValue,
    normalizedKey,
  });
}

function analyzeProductDocument(document = {}) {
  const productId = normalizeDocumentId(document._id);
  const productTitle = cleanText(document.title, 240);
  const occurrences = [];
  const invalidEntries = [];

  if (!productId) {
    invalidEntries.push({ field: '_id', code: 'PRODUCT_ID_REQUIRED' });
  }
  if (!productTitle) {
    invalidEntries.push({ field: 'title', code: 'PRODUCT_TITLE_REQUIRED' });
  }
  if (
    document.variants != null &&
    !Array.isArray(document.variants)
  ) {
    invalidEntries.push({ field: 'variants', code: 'VARIANTS_MUST_BE_ARRAY' });
  }
  validateStoredKeyField(document, 'skuKeys', invalidEntries);
  validateStoredKeyField(document, 'barcodeKeys', invalidEntries);

  addOccurrence({
    occurrences,
    invalidEntries,
    type: 'sku',
    productId,
    productTitle,
    location: 'sku',
    source: 'product',
    originalValue: document.sku,
  });
  addOccurrence({
    occurrences,
    invalidEntries,
    type: 'barcode',
    productId,
    productTitle,
    location: 'barcode',
    source: 'product',
    originalValue: document.barcode,
  });

  const variants = Array.isArray(document.variants) ? document.variants : [];
  variants.forEach((variant, index) => {
    if (!variant || typeof variant !== 'object' || Array.isArray(variant)) {
      invalidEntries.push({
        field: `variants.${index}`,
        code: 'VARIANT_MUST_BE_OBJECT',
      });
      return;
    }
    addOccurrence({
      occurrences,
      invalidEntries,
      type: 'sku',
      productId,
      productTitle,
      location: `variants.${index}.sku`,
      source: 'variant',
      originalValue: variant.sku,
    });
    addOccurrence({
      occurrences,
      invalidEntries,
      type: 'barcode',
      productId,
      productTitle,
      location: `variants.${index}.barcode`,
      source: 'variant',
      originalValue: variant.barcode,
    });
  });

  const calculated = buildProductCodeKeys({
    sku: document.sku,
    barcode: document.barcode,
    variants,
  });
  const storedSkuKeys = Array.isArray(document.skuKeys)
    ? document.skuKeys
    : [];
  const storedBarcodeKeys = Array.isArray(document.barcodeKeys)
    ? document.barcodeKeys
    : [];
  const skuKeysMatch = arraysEqual(storedSkuKeys, calculated.skuKeys);
  const barcodeKeysMatch = arraysEqual(
    storedBarcodeKeys,
    calculated.barcodeKeys
  );

  return {
    documentId: document._id,
    productId,
    productTitle,
    occurrences,
    invalidEntries,
    calculated,
    stored: {
      skuKeys: storedSkuKeys,
      barcodeKeys: storedBarcodeKeys,
    },
    matchesStoredKeys: skuKeysMatch && barcodeKeysMatch,
    mismatchedFields: [
      ...(!skuKeysMatch ? ['skuKeys'] : []),
      ...(!barcodeKeysMatch ? ['barcodeKeys'] : []),
    ],
    document,
  };
}

function occurrenceSort(left, right) {
  return [
    left.productId.localeCompare(right.productId),
    left.location.localeCompare(right.location),
    left.originalValue.localeCompare(right.originalValue),
  ].find((value) => value !== 0) || 0;
}

function buildConflict(type, normalizedKey, kind, occurrences) {
  return {
    type,
    normalizedKey,
    kind,
    occurrences: [...occurrences].sort(occurrenceSort).map((occurrence) => ({
      _id: occurrence.productId,
      productName: occurrence.productTitle,
      location: occurrence.location,
      originalValue: occurrence.originalValue,
      normalizedKey: occurrence.normalizedKey,
    })),
  };
}

function detectConflicts(occurrences = []) {
  const groups = new Map();
  for (const occurrence of occurrences) {
    const mapKey = `${occurrence.type}\u0000${occurrence.normalizedKey}`;
    if (!groups.has(mapKey)) groups.set(mapKey, []);
    groups.get(mapKey).push(occurrence);
  }

  const conflicts = [];
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const type = group[0].type;
    const normalizedKey = group[0].normalizedKey;
    const byProduct = new Map();
    for (const occurrence of group) {
      if (!byProduct.has(occurrence.productId)) {
        byProduct.set(occurrence.productId, []);
      }
      byProduct.get(occurrence.productId).push(occurrence);
    }
    for (const sameProduct of byProduct.values()) {
      if (sameProduct.length > 1) {
        conflicts.push(
          buildConflict(type, normalizedKey, 'within-product', sameProduct)
        );
      }
    }
    if (byProduct.size < 2) continue;

    const productOccurrences = group.filter(
      (occurrence) => occurrence.source === 'product'
    );
    const variantOccurrences = group.filter(
      (occurrence) => occurrence.source === 'variant'
    );
    const distinctProductCount = (items) => new Set(
      items.map((item) => item.productId)
    ).size;

    if (distinctProductCount(productOccurrences) > 1) {
      conflicts.push(
        buildConflict(
          type,
          normalizedKey,
          'product-product',
          productOccurrences
        )
      );
    }
    const mixed = group.filter((left) =>
      group.some((right) =>
        left.productId !== right.productId && left.source !== right.source
      )
    );
    if (mixed.length) {
      conflicts.push(
        buildConflict(type, normalizedKey, 'product-variant', mixed)
      );
    }
    if (distinctProductCount(variantOccurrences) > 1) {
      conflicts.push(
        buildConflict(
          type,
          normalizedKey,
          'variant-variant',
          variantOccurrences
        )
      );
    }
  }

  return conflicts.sort((left, right) =>
    [
      left.type.localeCompare(right.type),
      left.normalizedKey.localeCompare(right.normalizedKey),
      left.kind.localeCompare(right.kind),
    ].find((value) => value !== 0) || 0
  );
}

async function collectDocuments(repository) {
  if (!repository || typeof repository.scanProducts !== 'function') {
    throw new ProductCodeMigrationError(
      'MIGRATION_REPOSITORY_REQUIRED',
      'No se proporciono un repositorio de migracion valido.'
    );
  }
  const products = [];
  for await (const document of repository.scanProducts()) {
    products.push(analyzeProductDocument(document));
  }
  products.sort((left, right) => left.productId.localeCompare(right.productId));
  return products;
}

function publicAuditReport(state) {
  return {
    mode: 'audit',
    readOnly: true,
    productsScanned: state.products.length,
    occurrencesScanned: state.occurrences.length,
    conflictCount: state.conflicts.length,
    conflicts: state.conflicts,
    invalidDocumentCount: state.invalidDocuments.length,
    invalidDocuments: state.invalidDocuments,
    backfillRequiredCount: state.backfillRequired.length,
    backfillRequired: state.backfillRequired,
  };
}

async function buildAuditState(repository) {
  const products = await collectDocuments(repository);
  const occurrences = products.flatMap((product) => product.occurrences);
  const invalidDocuments = products
    .filter((product) => product.invalidEntries.length)
    .map((product) => ({
      _id: product.productId,
      productName: product.productTitle,
      errors: product.invalidEntries,
    }));
  const backfillRequired = products
    .filter((product) => !product.matchesStoredKeys)
    .map((product) => ({
      _id: product.productId,
      productName: product.productTitle,
      fields: product.mismatchedFields,
    }));
  return {
    products,
    occurrences,
    conflicts: detectConflicts(occurrences),
    invalidDocuments,
    backfillRequired,
  };
}

async function auditProductCommercialCodes({ repository }) {
  return publicAuditReport(await buildAuditState(repository));
}

function ensureCleanAudit(state, code, action) {
  if (state.conflicts.length) {
    throw new ProductCodeMigrationError(
      code,
      `${action} se bloqueo porque existen conflictos de SKU o codigo de barras.`
    );
  }
  if (state.invalidDocuments.length) {
    throw new ProductCodeMigrationError(
      code,
      `${action} se bloqueo porque existen documentos invalidos.`
    );
  }
}

function buildBackfillOperation(product) {
  const $set = {};
  const $unset = {};
  for (const field of ['skuKeys', 'barcodeKeys']) {
    const values = product.calculated[field];
    if (values.length) $set[field] = values;
    else $unset[field] = '';
  }
  const source = product.document || {};
  const filter = { _id: product.documentId };
  for (const field of [
    'sku',
    'barcode',
    'variants',
    'skuKeys',
    'barcodeKeys',
  ]) {
    filter[field] = Object.prototype.hasOwnProperty.call(source, field)
      ? source[field]
      : { $exists: false };
  }
  return {
    documentId: product.documentId,
    productId: product.productId,
    filter,
    update: {
      ...(Object.keys($set).length ? { $set } : {}),
      ...(Object.keys($unset).length ? { $unset } : {}),
    },
  };
}

async function backfillProductCommercialCodeKeys({
  repository,
  batchSize = 100,
}) {
  const size = Number(batchSize);
  if (!Number.isInteger(size) || size < 1 || size > 1000) {
    throw new ProductCodeMigrationError(
      'INVALID_BATCH_SIZE',
      'El tamano de lote debe ser un entero entre 1 y 1000.'
    );
  }
  if (typeof repository?.writeKeyBatch !== 'function') {
    throw new ProductCodeMigrationError(
      'MIGRATION_WRITER_REQUIRED',
      'El repositorio no permite ejecutar el backfill.'
    );
  }
  const state = await buildAuditState(repository);
  ensureCleanAudit(state, 'BACKFILL_BLOCKED', 'El backfill');
  const pending = state.products.filter((product) => !product.matchesStoredKeys);
  let batchesWritten = 0;
  for (let offset = 0; offset < pending.length; offset += size) {
    const operations = pending
      .slice(offset, offset + size)
      .map(buildBackfillOperation);
    if (!operations.length) continue;
    await repository.writeKeyBatch(operations);
    batchesWritten += 1;
  }
  return {
    mode: 'backfill',
    productsScanned: state.products.length,
    productsChanged: pending.length,
    batchesWritten,
    idempotent: pending.length === 0,
  };
}

function isCompatibleIndex(existing, definition) {
  return Boolean(
    existing &&
    existing.name === definition.name &&
    stableJson(existing.key) === stableJson(definition.key) &&
    existing.unique === true &&
    stableJson(existing.partialFilterExpression) ===
      stableJson(definition.partialFilterExpression)
  );
}

function inspectApprovedIndexes(indexes = []) {
  return INDEX_DEFINITIONS.map((definition) => {
    const existing = indexes.find((index) => index.name === definition.name);
    return {
      name: definition.name,
      present: Boolean(existing),
      compatible: existing ? isCompatibleIndex(existing, definition) : false,
      ready: existing ? isCompatibleIndex(existing, definition) : false,
      definition,
    };
  });
}

async function verifyProductCommercialCodeMigration({ repository }) {
  const state = await buildAuditState(repository);
  const indexes = typeof repository?.listIndexes === 'function'
    ? await repository.listIndexes()
    : [];
  const indexStatus = inspectApprovedIndexes(indexes);
  return {
    mode: 'verify',
    readOnly: true,
    ...publicAuditReport(state),
    mode: 'verify',
    storedKeysMatch: state.backfillRequired.length === 0,
    indexes: indexStatus,
    verified: (
      state.conflicts.length === 0 &&
      state.invalidDocuments.length === 0 &&
      state.backfillRequired.length === 0 &&
      indexStatus.every((index) => index.ready)
    ),
  };
}

async function createApprovedProductCommercialCodeIndexes({ repository }) {
  if (
    typeof repository?.listIndexes !== 'function' ||
    typeof repository?.createIndex !== 'function'
  ) {
    throw new ProductCodeMigrationError(
      'INDEX_REPOSITORY_REQUIRED',
      'El repositorio no permite administrar los indices aprobados.'
    );
  }
  const state = await buildAuditState(repository);
  ensureCleanAudit(state, 'INDEX_CREATION_BLOCKED', 'La creacion de indices');
  if (state.backfillRequired.length) {
    throw new ProductCodeMigrationError(
      'INDEX_CREATION_BLOCKED',
      'La creacion de indices se bloqueo porque el backfill no esta completo.'
    );
  }

  const before = inspectApprovedIndexes(await repository.listIndexes());
  const incompatible = before.find((index) => index.present && !index.compatible);
  if (incompatible) {
    throw new ProductCodeMigrationError(
      'INCOMPATIBLE_EXISTING_INDEX',
      'Existe un indice aprobado con una definicion incompatible.'
    );
  }

  const created = [];
  for (const status of before) {
    if (status.present) continue;
    const definition = status.definition;
    await repository.createIndex(definition.key, {
      name: definition.name,
      unique: definition.unique,
      partialFilterExpression: definition.partialFilterExpression,
    });
    created.push(definition.name);
  }

  const after = inspectApprovedIndexes(await repository.listIndexes());
  if (!after.every((index) => index.ready)) {
    throw new ProductCodeMigrationError(
      'INDEX_VERIFICATION_FAILED',
      'No fue posible verificar los indices aprobados despues de crearlos.'
    );
  }
  return {
    mode: 'create-indexes',
    created,
    alreadyPresent: before
      .filter((index) => index.present)
      .map((index) => index.name),
    indexes: after,
  };
}

function assertMigrationMode(mode) {
  const normalized = cleanText(mode || 'audit', 40).toLowerCase();
  if (!ALLOWED_MODES.has(normalized)) {
    throw new ProductCodeMigrationError(
      'INVALID_MIGRATION_MODE',
      'El modo solicitado no esta permitido.'
    );
  }
  return normalized;
}

function assertWriteSafety({
  mode,
  apply = false,
  confirmDatabase = '',
  databaseName = '',
  nodeEnv = process.env.NODE_ENV,
  allowProduction = false,
}) {
  const normalizedMode = assertMigrationMode(mode);
  if (!WRITE_MODES.has(normalizedMode)) return normalizedMode;
  if (apply !== true) {
    throw new ProductCodeMigrationError(
      'EXPLICIT_APPLY_REQUIRED',
      'Los modos de escritura requieren la bandera explicita --apply.'
    );
  }
  const expected = cleanText(databaseName, 160);
  const confirmation = cleanText(confirmDatabase, 160);
  if (!expected || confirmation !== expected) {
    throw new ProductCodeMigrationError(
      'DATABASE_CONFIRMATION_MISMATCH',
      'La confirmacion exacta del nombre de la base no coincide.'
    );
  }
  if (
    cleanText(nodeEnv, 40).toLowerCase() === 'production' &&
    allowProduction !== true
  ) {
    throw new ProductCodeMigrationError(
      'PRODUCTION_MIGRATION_CONFIRMATION_REQUIRED',
      'Produccion requiere la bandera adicional --allow-production-migration.'
    );
  }
  return normalizedMode;
}

async function runProductCommercialCodeMigration({
  mode = 'audit',
  repository,
  batchSize = 100,
}) {
  const normalizedMode = assertMigrationMode(mode);
  if (normalizedMode === 'audit') {
    return auditProductCommercialCodes({ repository });
  }
  if (normalizedMode === 'backfill') {
    return backfillProductCommercialCodeKeys({ repository, batchSize });
  }
  if (normalizedMode === 'create-indexes') {
    return createApprovedProductCommercialCodeIndexes({ repository });
  }
  return verifyProductCommercialCodeMigration({ repository });
}

module.exports = {
  ALLOWED_MODES,
  INDEX_DEFINITIONS,
  ProductCodeMigrationError,
  analyzeProductDocument,
  assertMigrationMode,
  assertWriteSafety,
  auditProductCommercialCodes,
  backfillProductCommercialCodeKeys,
  createApprovedProductCommercialCodeIndexes,
  detectConflicts,
  inspectApprovedIndexes,
  isCompatibleIndex,
  runProductCommercialCodeMigration,
  verifyProductCommercialCodeMigration,
};
