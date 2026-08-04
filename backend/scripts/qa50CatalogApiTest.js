'use strict';

/* eslint-disable no-console */

require('dotenv').config({ quiet: true });

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { EJSON } = require('bson');
const { PNG } = require('pngjs');
const QRCode = require('qrcode');

const Product = require('../models/Product');
const {
  validateAndNormalizeProductInput,
} = require('../services/productInputValidationService');
const {
  assertVariantIdentity,
} = require('../../shared/variantKeyAuthority.cjs');
const {
  BATCH_ID,
  PRODUCT_COUNT,
  PRODUCT_CODES,
  TYPE_DISTRIBUTION,
  buildQa50Definitions,
  validateQa50Definitions,
  requiredMediaRoles,
} = require('./qa50CatalogFixtureFactory');

const API_BASE_URL = String(
  process.env.QA50_API_BASE_URL || 'http://localhost:5000'
).replace(/\/$/, '');
const REPORT_DIR = path.join(__dirname, '..', 'reports', 'qa50-catalog-v1');
const MEDIA_DIR = path.join(__dirname, '..', 'tmp', 'qa50-catalog-v1');
const BASELINE_FILE = path.join(REPORT_DIR, 'baseline.json');
const STATE_FILE = path.join(REPORT_DIR, 'state.json');
const DRY_RUN_REPORT = path.join(REPORT_DIR, 'dry-run.json');
const APPLY_REPORT = path.join(REPORT_DIR, 'apply.json');
const VERIFY_REPORT = path.join(REPORT_DIR, 'verify.json');
const VERIFY_CSV_REPORT = path.join(REPORT_DIR, 'verify.csv');
const VERIFICATION_NOTE = `Verificado por ${BATCH_ID}`;
const SAFE_DATABASE_PATTERN = /^(?!.*(?:prod|production|live)).+/i;

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    mode: '',
    confirmDatabase: '',
    confirmTestDatabase: '',
    confirmApply: false,
    confirmCleanup: '',
  };
  for (const argument of argv) {
    if (['--dry-run', '--apply', '--verify', '--cleanup'].includes(argument)) {
      if (options.mode) throw new Error('QA50_EXACTLY_ONE_MODE_REQUIRED');
      options.mode = argument.slice(2);
    } else if (argument.startsWith('--confirm-database=')) {
      options.confirmDatabase = argument.slice(19);
    } else if (argument.startsWith('--confirm-test-database=')) {
      options.confirmTestDatabase = argument.slice(24);
    } else if (argument === '--confirm-apply') {
      options.confirmApply = true;
    } else if (argument.startsWith('--confirm-cleanup=')) {
      options.confirmCleanup = argument.slice(18);
    } else {
      throw new Error(`QA50_ARGUMENT_NOT_ALLOWED:${argument}`);
    }
  }
  if (!options.mode) throw new Error('QA50_MODE_REQUIRED');
  return options;
}

function ensureDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true });
}

function readJson(filePath, fallback = null) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function stableObject(value) {
  if (Array.isArray(value)) return value.map(stableObject);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableObject(value[key])])
    );
  }
  return value;
}

function stableJson(value) {
  return JSON.stringify(stableObject(value));
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sanitizeHost(value) {
  return String(value || '')
    .replace(/[^a-zA-Z0-9.-]/g, '')
    .slice(0, 160);
}

function assertSafeDatabase(options) {
  const database = mongoose.connection.name;
  const host = sanitizeHost(mongoose.connection.host);
  if (!database || options.confirmDatabase !== database) {
    throw new Error('QA50_DATABASE_CONFIRMATION_MISMATCH');
  }
  if (!SAFE_DATABASE_PATTERN.test(database) || process.env.NODE_ENV === 'production') {
    throw new Error('QA50_PRODUCTION_DATABASE_FORBIDDEN');
  }
  if (['apply', 'cleanup'].includes(options.mode)) {
    if (options.confirmTestDatabase !== database) {
      throw new Error('QA50_TEST_DATABASE_CONFIRMATION_REQUIRED');
    }
  }
  if (options.mode === 'apply' && !options.confirmApply) {
    throw new Error('QA50_APPLY_CONFIRMATION_REQUIRED');
  }
  if (options.mode === 'cleanup' && options.confirmCleanup !== BATCH_ID) {
    throw new Error('QA50_CLEANUP_CONFIRMATION_REQUIRED');
  }
  return { database, host, classification: 'test-authorized' };
}

function createAdminToken() {
  if (!process.env.JWT_SECRET) throw new Error('QA50_JWT_SECRET_MISSING');
  return jwt.sign(
    { role: 'admin', username: 'qa50-catalog-api-test' },
    process.env.JWT_SECRET,
    { expiresIn: '6h' }
  );
}

const httpJournal = [];

async function requestJson(route, {
  token = '',
  method = 'GET',
  body,
  headers = {},
  expected = null,
} = {}) {
  const response = await fetch(`${API_BASE_URL}${route}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json().catch(() => ({}));
  httpJournal.push({ method, route, status: response.status });
  if (expected != null && response.status !== expected) {
    const error = new Error(`QA50_HTTP_${response.status}:${method}:${route}`);
    error.status = response.status;
    error.publicBody = {
      error: data?.error || data?.code || '',
      message: data?.message || '',
      errors: Array.isArray(data?.errors) ? data.errors : [],
    };
    throw error;
  }
  return { status: response.status, data, headers: response.headers };
}

async function fetchTaxonomy(token) {
  const response = await requestJson('/api/products/admin/taxonomy', {
    token,
    expected: 200,
  });
  return {
    categories: Array.isArray(response.data?.categories) ? response.data.categories : [],
    collections: Array.isArray(response.data?.collections) ? response.data.collections : [],
  };
}

function exactBatchFilter() {
  return {
    sku: { $in: PRODUCT_CODES },
    tags: BATCH_ID,
    archivedAt: null,
  };
}

function exactCodeFilter() {
  return {
    sku: { $in: PRODUCT_CODES },
    archivedAt: null,
  };
}

async function findBatchDocuments() {
  return mongoose.connection.db
    .collection('products')
    .find(exactBatchFilter())
    .sort({ sku: 1 })
    .toArray();
}

async function assertNoForeignCodeCollision() {
  const documents = await mongoose.connection.db
    .collection('products')
    .find(exactCodeFilter(), { projection: { sku: 1, tags: 1, title: 1 } })
    .toArray();
  const foreign = documents.filter(
    (document) => !Array.isArray(document.tags) || !document.tags.includes(BATCH_ID)
  );
  if (foreign.length) {
    throw new Error(`QA50_FOREIGN_CODE_COLLISION:${foreign.map((item) => item.sku).join(',')}`);
  }
  const duplicates = documents.reduce((map, document) => {
    map.set(document.sku, Number(map.get(document.sku) || 0) + 1);
    return map;
  }, new Map());
  const duplicateCodes = Array.from(duplicates.entries())
    .filter(([, count]) => count > 1)
    .map(([code]) => code);
  if (duplicateCodes.length) {
    throw new Error(`QA50_DUPLICATE_BATCH_CODES:${duplicateCodes.join(',')}`);
  }
  return documents;
}

async function captureNonBatchSnapshot() {
  const db = mongoose.connection.db;
  const products = await db
    .collection('products')
    .find({ sku: { $nin: PRODUCT_CODES } })
    .sort({ _id: 1 })
    .toArray();
  const productIds = products.map((product) => product._id);
  const inventory = await db
    .collection('inventorystocks')
    .find({ product: { $in: productIds } })
    .sort({ _id: 1 })
    .toArray();
  const payload = EJSON.stringify({ products, inventory }, { relaxed: false });
  return {
    productCount: products.length,
    inventoryCount: inventory.length,
    hash: sha256(payload),
  };
}

async function totalProductCount() {
  return mongoose.connection.db.collection('products').countDocuments({ archivedAt: null });
}

function mediaFromProduct(product = {}) {
  const variants = {};
  for (const variant of Array.isArray(product.variants) ? product.variants : []) {
    if (variant?.variantKey && variant?.image) variants[variant.variantKey] = variant.image;
  }
  return {
    cover: product.image || '',
    gallery: Array.isArray(product.images) ? product.images.slice(0, 2) : [],
    variants,
  };
}

function mediaSeed(code, role) {
  return crypto.createHash('sha256').update(`${BATCH_ID}|${code}|${role}`).digest();
}

function setPixel(png, x, y, red, green, blue, alpha = 255) {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
  const offset = (png.width * y + x) << 2;
  png.data[offset] = red;
  png.data[offset + 1] = green;
  png.data[offset + 2] = blue;
  png.data[offset + 3] = alpha;
}

function fillRect(png, x, y, width, height, color) {
  for (let py = Math.max(0, y); py < Math.min(png.height, y + height); py += 1) {
    for (let px = Math.max(0, x); px < Math.min(png.width, x + width); px += 1) {
      setPixel(png, px, py, color[0], color[1], color[2], color[3] ?? 255);
    }
  }
}

function drawQaRaster(code, role, outputPath) {
  const width = 720;
  const height = 720;
  const png = new PNG({ width, height });
  const seed = mediaSeed(code, role);
  const base = [seed[0], seed[1], seed[2]];
  const accent = [seed[3], seed[4], seed[5]];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const mix = (x + y) / (width + height);
      const stripe = ((x * 3 + y * 5 + seed[6]) % 97) < 11 ? 24 : 0;
      setPixel(
        png,
        x,
        y,
        Math.min(255, Math.round(base[0] * (1 - mix) + accent[0] * mix) + stripe),
        Math.min(255, Math.round(base[1] * (1 - mix) + accent[1] * mix) + stripe),
        Math.min(255, Math.round(base[2] * (1 - mix) + accent[2] * mix) + stripe)
      );
    }
  }

  const panel = [255, 255, 255, 220];
  fillRect(png, 72, 72, 576, 420, panel);
  for (let index = 0; index < 8; index += 1) {
    const blockWidth = 55 + (seed[8 + index] % 80);
    const blockHeight = 40 + (seed[16 + index] % 110);
    const x = 105 + ((seed[24 + index] * 17) % 440);
    const y = 105 + ((seed[8 + index] * 13) % 290);
    fillRect(png, x, y, blockWidth, blockHeight, [
      (accent[0] + index * 17) % 256,
      (accent[1] + index * 29) % 256,
      (accent[2] + index * 41) % 256,
      255,
    ]);
  }

  const qr = QRCode.create(`${BATCH_ID}|${code}|${role}`, { errorCorrectionLevel: 'M' });
  const moduleSize = 4;
  const qrSize = qr.modules.size * moduleSize;
  const qrX = width - qrSize - 54;
  const qrY = height - qrSize - 54;
  fillRect(png, qrX - 12, qrY - 12, qrSize + 24, qrSize + 24, [255, 255, 255, 255]);
  for (let row = 0; row < qr.modules.size; row += 1) {
    for (let col = 0; col < qr.modules.size; col += 1) {
      if (qr.modules.get(row, col)) {
        fillRect(
          png,
          qrX + col * moduleSize,
          qrY + row * moduleSize,
          moduleSize,
          moduleSize,
          [20, 20, 24, 255]
        );
      }
    }
  }

  ensureDirectory(path.dirname(outputPath));
  fs.writeFileSync(outputPath, PNG.sync.write(png));
}

function safeRoleFileName(role) {
  return `${String(role).slice(0, 40).replace(/[^a-zA-Z0-9_-]+/g, '-')}-${sha256(role).slice(0, 10)}`;
}

function cloudinaryWebpUrl(value) {
  const parsed = new URL(value);
  parsed.pathname = parsed.pathname.replace('/image/upload/', '/image/upload/f_webp,q_auto/');
  parsed.pathname = parsed.pathname.replace(/\.[a-zA-Z0-9]+$/, '.webp');
  return parsed.toString();
}

async function uploadFiles(filePaths, token) {
  const form = new FormData();
  for (const filePath of filePaths) {
    const buffer = fs.readFileSync(filePath);
    form.append('files', new Blob([buffer], { type: 'image/png' }), path.basename(filePath));
  }
  const response = await fetch(`${API_BASE_URL}/api/uploads/many`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  const data = await response.json().catch(() => ({}));
  httpJournal.push({ method: 'POST', route: '/api/uploads/many', status: response.status });
  if (response.status !== 201 || !Array.isArray(data.urls) || data.urls.length !== filePaths.length) {
    const error = new Error(`QA50_UPLOAD_FAILED:${response.status}`);
    error.publicBody = { error: data?.error || '', message: data?.message || '' };
    throw error;
  }
  return data.urls.map(cloudinaryWebpUrl);
}

async function createAndUploadMedia(product, token) {
  const roles = requiredMediaRoles(product);
  const roleFiles = roles.map((role) => {
    const filePath = path.join(
      MEDIA_DIR,
      product.sku,
      `${product.sku}-${safeRoleFileName(role)}.png`
    );
    drawQaRaster(product.sku, role, filePath);
    return { role, filePath };
  });
  const uploaded = [];
  for (let index = 0; index < roleFiles.length; index += 5) {
    const chunk = roleFiles.slice(index, index + 5);
    const urls = await uploadFiles(chunk.map((entry) => entry.filePath), token);
    uploaded.push(...chunk.map((entry, offset) => ({ role: entry.role, url: urls[offset] })));
  }
  const byRole = Object.fromEntries(uploaded.map((entry) => [entry.role, entry.url]));
  const variants = {};
  for (const variant of product.variants || []) {
    variants[variant.variantKey] = byRole[`variant-${variant.variantKey}`];
  }
  return {
    cover: byRole.cover,
    gallery: [byRole['gallery-1'], byRole['gallery-2']],
    variants,
    generated: uploaded.length,
  };
}

async function validateMediaUrl(url) {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return {
      url,
      status: response.status,
      contentType: String(response.headers.get('content-type') || '').toLowerCase(),
      ok: response.ok && String(response.headers.get('content-type') || '').toLowerCase().startsWith('image/'),
    };
  } catch (error) {
    return { url, status: 0, contentType: '', ok: false, error: error.message };
  }
}

async function validateDefinitionsWithBackendAuthority(products, batchIds = []) {
  const validation = validateQa50Definitions(products);
  const errors = [...validation.errors];
  const excluded = batchIds.map((id) => new mongoose.Types.ObjectId(id));
  const conflictLookup = async ({ type, keys }) => {
    const field = type === 'sku' ? 'skuKeys' : 'barcodeKeys';
    const match = await Product.findOne({
      [field]: { $in: keys },
      ...(excluded.length ? { _id: { $nin: excluded } } : {}),
    }).select('_id').lean();
    return Boolean(match);
  };
  for (const product of products) {
    try {
      await validateAndNormalizeProductInput(product, {
        mode: 'create',
        ProductModel: Product,
        conflictLookup,
      });
    } catch (error) {
      errors.push(`${product.sku}:${error.code || error.name}:${error.message}`);
    }
  }
  return { ...validation, ok: errors.length === 0, errors };
}

function buildReplacePayload(product = {}) {
  const array = (value) => (Array.isArray(value) ? value : []);
  const refId = (value) => String(value?._id || value?.id || value || '').trim();
  return {
    sku: product.sku || '',
    title: product.title || '',
    price: Number(product.price || 0),
    originalPrice: product.originalPrice == null ? null : Number(product.originalPrice),
    description: product.description || '',
    image: product.image || '',
    images: array(product.images).slice(0, 5),
    active: product.active !== false,
    category: product.category || '',
    categories: array(product.categories),
    primaryCategoryId: refId(product.primaryCategoryRef) || null,
    categoryIds: array(product.categoryRefs).map(refId).filter(Boolean),
    collectionIds: array(product.collectionRefs).map(refId).filter(Boolean),
    productType: product.productType || 'physical',
    unitOfMeasure: product.unitOfMeasure || 'unit',
    trackInventory: product.trackInventory !== false,
    allowBackorder: product.allowBackorder === true,
    variantPreset: product.variantPreset || 'none',
    variantAxes: array(product.variantAxes).map((axis) => ({
      key: axis.key || '',
      label: axis.label || axis.key || '',
      values: array(axis.values),
    })),
    colors: array(product.colors),
    sizes: array(product.sizes),
    inventory: array(product.inventory).map((row) => ({
      size: row.size || '',
      color: row.color || '',
      stock: Math.max(0, Math.floor(Number(row.stock || 0))),
    })),
    variants: array(product.variants).map((variant, index) => ({
      variantKey: variant.variantKey || 'default__default',
      label: variant.label || '',
      size: variant.size || '',
      color: variant.color || '',
      attributes: array(variant.attributes).map((attribute) => ({
        key: attribute.key || '',
        label: attribute.label || attribute.key || '',
        value: attribute.value || '',
      })),
      sku: variant.sku || '',
      barcode: variant.barcode || '',
      price: variant.price == null ? null : Number(variant.price),
      cost: variant.cost == null ? null : Number(variant.cost),
      originalPrice: variant.originalPrice == null ? null : Number(variant.originalPrice),
      image: variant.image || '',
      images: array(variant.images).slice(0, 8),
      initialStock: Math.max(0, Math.floor(Number(variant.initialStock || 0))),
      active: variant.active !== false,
      sortOrder: Number(variant.sortOrder ?? index),
    })),
    stock: Math.max(0, Math.floor(Number(product.stock || 0))),
    reorderPoint: Math.max(0, Math.floor(Number(product.reorderPoint || 0))),
    reorderQty: Math.max(0, Math.floor(Number(product.reorderQty || 0))),
    warehouseLocation: product.warehouseLocation || '',
    weightGrams: Math.max(0, Number(product.weightGrams || 0)),
    dimensionsCm: {
      l: Math.max(0, Number(product.dimensionsCm?.l || 0)),
      w: Math.max(0, Number(product.dimensionsCm?.w || 0)),
      h: Math.max(0, Number(product.dimensionsCm?.h || 0)),
    },
    cost: Math.max(0, Number(product.cost || 0)),
    averageCost: Math.max(0, Number(product.averageCost || 0)),
    taxRate: Math.min(100, Math.max(0, Number(product.taxRate || 0))),
    taxIncluded: product.taxIncluded !== false,
    brand: product.brand || '',
    season: product.season || '',
    supplier: { name: product.supplier?.name || '' },
    barcode: product.barcode || '',
    tags: array(product.tags),
    seo: {
      title: product.seo?.title || '',
      description: product.seo?.description || '',
      keywords: array(product.seo?.keywords),
      image: product.seo?.image || '',
      canonicalUrl: product.seo?.canonicalUrl || '',
      noIndex: product.seo?.noIndex === true,
    },
    commercialFields: array(product.commercialFields).map((field, index) => ({
      key: field.key || '',
      label: field.label || '',
      group: field.group || 'General',
      type: field.type || 'text',
      value: field.value ?? '',
      public: field.public !== false,
      sortOrder: Number(field.sortOrder ?? index),
    })),
    digitalDelivery: product.productType === 'digital' ? product.digitalDelivery || {} : {},
    serviceDelivery: product.productType === 'service' ? product.serviceDelivery || {} : {},
    bundleComponents: product.productType === 'bundle'
      ? array(product.bundleComponents).map((component) => ({
          product: refId(component.product),
          variantKey: component.variantKey || 'default__default',
          quantity: Math.max(1, Math.floor(Number(component.quantity || 1))),
        }))
      : [],
    notes: product.notes || '',
  };
}

function immutableProjection(product = {}) {
  const clone = JSON.parse(JSON.stringify(product));
  for (const key of [
    '_id',
    'id',
    'createdAt',
    'updatedAt',
    '__v',
    'notes',
    'inventorySummary',
    'financialSummary',
  ]) delete clone[key];
  return clone;
}

async function loadExactAdminProducts(token) {
  // La búsqueda textual pública/administrativa no es una prueba de propiedad
  // del lote y puede no incluir SKU en todas las versiones. MongoDB se usa solo
  // para descubrir los _id del filtro exacto; cada producto se carga y valida
  // por el GET administrativo real antes de reanudar o verificar.
  const documents = await findBatchDocuments();
  const products = [];
  for (const document of documents) {
    const response = await requestJson(`/api/products/admin/${document._id}`, {
      token,
      expected: 200,
    });
    if (PRODUCT_CODES.includes(response.data?.sku)) products.push(response.data);
  }
  return products.sort((left, right) => left.sku.localeCompare(right.sku));
}

async function inventorySnapshot(productId) {
  const rows = await mongoose.connection.db
    .collection('inventorystocks')
    .find({
      product: new mongoose.Types.ObjectId(productId),
      deletedAt: null,
      active: { $ne: false },
    })
    .sort({ branch: 1, variantKey: 1 })
    .toArray();
  return {
    rows: rows.length,
    stock: rows.reduce((sum, row) => sum + Number(row.stock || 0), 0),
    reservedStock: rows.reduce((sum, row) => sum + Number(row.reservedStock || 0), 0),
    variantKeys: rows.map((row) => String(row.variantKey || '')).sort(),
  };
}

function expectedStock(product) {
  if (product.trackInventory === false) return 0;
  if (product.variants.length) {
    return product.variants.reduce((sum, variant) => sum + Number(variant.initialStock || 0), 0);
  }
  return Number(product.stock || 0);
}

async function reconcileInventoryThroughApi(product, expected, token) {
  if (expected.trackInventory === false) return 0;
  const rows = await mongoose.connection.db
    .collection('inventorystocks')
    .find({
      product: new mongoose.Types.ObjectId(product._id),
      deletedAt: null,
      active: { $ne: false },
    })
    .toArray();
  const expectedRows = expected.variants.length
    ? expected.variants.map((variant) => ({
        variantKey: variant.variantKey,
        quantity: Number(variant.initialStock || 0),
        variant,
      }))
    : [{
        variantKey: 'default__default',
        quantity: Number(expected.stock || 0),
        variant: { variantKey: 'default__default', attributes: [] },
      }];
  let movements = 0;
  for (const target of expectedRows) {
    const row = rows.find((item) => item.variantKey === target.variantKey);
    if (!row?.branch) throw new Error(`QA50_INVENTORY_ROW_MISSING:${expected.sku}:${target.variantKey}`);
    const current = Number(row.stock || 0);
    const difference = target.quantity - current;
    if (!difference) continue;
    const directionIn = difference > 0;
    await requestJson('/api/admin/inventory/movements', {
      token,
      method: 'POST',
      body: {
        type: directionIn ? 'adjustment_in' : 'adjustment_out',
        productId: String(product._id),
        [directionIn ? 'branchTo' : 'branchFrom']: String(row.branch),
        quantity: Math.abs(difference),
        variant: target.variant,
        variantKey: target.variantKey,
        reason: `Ajuste inicial automatizado del lote ${BATCH_ID}`,
        notes: `Restablece la cantidad declarada por ${expected.sku} sin escritura directa en MongoDB.`,
        reference: `${BATCH_ID}-${expected.sku}-${target.variantKey}`.slice(0, 120),
        postNow: true,
      },
      expected: 201,
    });
    movements += 1;
  }
  return movements;
}

async function verifyCartEligibility(product, expected, token) {
  let variant = null;
  if (expected.variants.length) {
    variant = expected.variants.find((entry) => Number(entry.initialStock || 0) > 0) || null;
    if (!variant) return { status: 'N/A_STOCK_ZERO', http: null, ok: true };
  } else if (expected.trackInventory !== false && Number(expected.stock || 0) <= 0) {
    return { status: 'N/A_STOCK_ZERO', http: null, ok: true };
  }
  const item = {
    _id: String(product._id),
    title: product.title,
    image: variant?.image || product.image,
    price: Number(variant?.price ?? product.price ?? 0),
    variantKey: variant?.variantKey || 'default__default',
    variantId: variant?.variantKey || 'default__default',
    variantAttributes: variant?.attributes || [],
    color: variant?.color || '',
    size: variant?.size || '',
    quantity: 1,
  };
  const response = await requestJson('/api/cart/validate', {
    token,
    method: 'POST',
    body: { items: [item], mode: 'strict' },
    expected: 200,
  });
  const items = Array.isArray(response.data?.items) ? response.data.items : [];
  return {
    status: response.data?.ok === true && items.length === 1 ? 'OK' : 'FAILED',
    http: response.status,
    ok: response.data?.ok === true && items.length === 1,
  };
}

function csvCell(value) {
  const text = value == null ? '' : typeof value === 'string' ? value : JSON.stringify(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function writeCsv(rows) {
  const columns = [
    'Código',
    'Producto',
    'Tipo',
    'Categoría',
    'Variantes esperadas',
    'Variantes guardadas',
    'Imágenes',
    'POST',
    'GET admin',
    'GET público',
    'PUT',
    'Recarga',
    'Carrito',
    'Resultado',
    'Error',
  ];
  const lines = [columns.map(csvCell).join(',')];
  for (const row of rows) {
    lines.push([
      row.code,
      row.product,
      row.type,
      row.category,
      row.expectedVariants,
      row.savedVariants,
      row.images,
      row.post,
      row.getAdmin,
      row.getPublic,
      row.put,
      row.reload,
      row.cart,
      row.result,
      row.error,
    ].map(csvCell).join(','));
  }
  ensureDirectory(path.dirname(VERIFY_CSV_REPORT));
  fs.writeFileSync(VERIFY_CSV_REPORT, `\uFEFF${lines.join('\n')}\n`, 'utf8');
}

async function dryRun({ safety, taxonomy, token }) {
  await assertNoForeignCodeCollision();
  const existingBatch = await findBatchDocuments();
  const initialCount = await totalProductCount();
  const nonBatch = await captureNonBatchSnapshot();
  const products = buildQa50Definitions({ taxonomy });
  const validation = await validateDefinitionsWithBackendAuthority(
    products,
    existingBatch.map((product) => String(product._id))
  );
  const cloudinaryProbe = await requestJson('/api/uploads', {
    token,
    method: 'POST',
  }).catch((error) => ({ status: error.status || 0, error: error.message }));
  // Sin archivo debe responder 400 cuando Cloudinary está configurado; 503 significa bloqueo real.
  const cloudinaryConfigured = cloudinaryProbe.status === 400;
  if (!validation.ok) throw new Error(`QA50_DRY_RUN_VALIDATION_FAILED:${validation.errors.join('|')}`);
  if (!cloudinaryConfigured) throw new Error(`QA50_CLOUDINARY_NOT_READY:${cloudinaryProbe.status}`);

  const baseline = {
    batchId: BATCH_ID,
    database: safety.database,
    host: safety.host,
    classification: safety.classification,
    createdAt: new Date().toISOString(),
    initialCount,
    existingBatchCount: existingBatch.length,
    nonBatch,
  };
  writeJson(BASELINE_FILE, baseline);
  const report = {
    ok: true,
    mode: 'dry-run',
    database: safety,
    databaseWrites: 0,
    initialCount,
    existingBatchCount: existingBatch.length,
    batchId: BATCH_ID,
    validation,
    cloudinaryConfigured,
    taxonomy: {
      categories: taxonomy.categories.length,
      collections: taxonomy.collections.length,
    },
    reports: { baseline: BASELINE_FILE, dryRun: DRY_RUN_REPORT },
  };
  writeJson(DRY_RUN_REPORT, report);
  console.log(JSON.stringify(report, null, 2));
}

async function applyBatch({ safety, taxonomy, token }) {
  const baseline = readJson(BASELINE_FILE);
  if (!baseline || baseline.batchId !== BATCH_ID || baseline.database !== safety.database) {
    throw new Error('QA50_DRY_RUN_BASELINE_REQUIRED');
  }
  await assertNoForeignCodeCollision();
  const nonBatchBefore = await captureNonBatchSnapshot();
  if (nonBatchBefore.hash !== baseline.nonBatch.hash || nonBatchBefore.productCount !== baseline.nonBatch.productCount) {
    throw new Error('QA50_BASELINE_CHANGED_BEFORE_APPLY');
  }

  const state = readJson(STATE_FILE, {
    batchId: BATCH_ID,
    database: safety.database,
    mediaByCode: {},
    productIdsByCode: {},
    creationByCode: {},
  });
  const existingProducts = await loadExactAdminProducts(token);
  for (const product of existingProducts) {
    state.productIdsByCode[product.sku] = String(product._id);
    state.mediaByCode[product.sku] = mediaFromProduct(product);
    state.creationByCode[product.sku] = state.creationByCode[product.sku] || {
      post: 201,
      action: 'existing-idempotent',
    };
  }

  let created = 0;
  let skipped = 0;
  let reconciled = 0;
  let reconciliationMovements = 0;
  let imagesUploaded = 0;
  for (const code of PRODUCT_CODES) {
    if (state.productIdsByCode[code]) {
      skipped += 1;
      continue;
    }
    const placeholderDefinitions = buildQa50Definitions({
      taxonomy,
      mediaByCode: state.mediaByCode,
      productIdsByCode: state.productIdsByCode,
    });
    const placeholder = placeholderDefinitions.find((product) => product.sku === code);
    const media = await createAndUploadMedia(placeholder, token);
    state.mediaByCode[code] = media;
    imagesUploaded += media.generated;

    const definitions = buildQa50Definitions({
      taxonomy,
      mediaByCode: state.mediaByCode,
      productIdsByCode: state.productIdsByCode,
    });
    const payload = definitions.find((product) => product.sku === code);
    const response = await requestJson('/api/products', {
      token,
      method: 'POST',
      body: payload,
      expected: 201,
    });
    state.productIdsByCode[code] = String(response.data?._id || response.data?.id || '');
    if (!state.productIdsByCode[code]) throw new Error(`QA50_CREATE_ID_MISSING:${code}`);
    state.creationByCode[code] = { post: response.status, action: 'created' };
    state.updatedAt = new Date().toISOString();
    writeJson(STATE_FILE, state);
    created += 1;
  }

  // Recuperación segura de una ejecución parcial o de un fallo general ya
  // corregido: nunca escribe en MongoDB. Solo repone por PUT el stock declarado
  // cuando la API creó el producto exacto pero no existe su inventario inicial.
  const createdOrLoaded = await loadExactAdminProducts(token);
  const loadedIds = Object.fromEntries(
    createdOrLoaded.map((product) => [product.sku, String(product._id)])
  );
  const loadedMedia = Object.fromEntries(
    createdOrLoaded.map((product) => [product.sku, mediaFromProduct(product)])
  );
  const expectedLoaded = buildQa50Definitions({
    taxonomy,
    mediaByCode: loadedMedia,
    productIdsByCode: loadedIds,
  });
  for (const expected of expectedLoaded) {
    if (expected.trackInventory === false) continue;
    const actual = createdOrLoaded.find((product) => product.sku === expected.sku);
    if (!actual) continue;
    const inventory = await inventorySnapshot(actual._id);
    if (
      inventory.stock === expectedStock(expected) &&
      inventory.rows === (expected.variants.length || 1)
    ) {
      continue;
    }
    if (inventory.rows !== (expected.variants.length || 1)) {
      const payload = buildReplacePayload(actual);
      payload.stock = expected.stock;
      payload.variants = expected.variants;
      await requestJson(`/api/products/${actual._id}?mode=replace`, {
        token,
        method: 'PUT',
        body: payload,
        expected: 200,
      });
    }
    reconciliationMovements += await reconcileInventoryThroughApi(actual, expected, token);
    const repaired = await inventorySnapshot(actual._id);
    if (
      repaired.stock !== expectedStock(expected) ||
      repaired.rows !== (expected.variants.length || 1)
    ) {
      throw new Error(`QA50_INVENTORY_RECONCILIATION_FAILED:${expected.sku}`);
    }
    reconciled += 1;
  }

  const finalProducts = await loadExactAdminProducts(token);
  const finalCount = await totalProductCount();
  const nonBatchAfter = await captureNonBatchSnapshot();
  const duplicates = PRODUCT_CODES.filter(
    (code) => finalProducts.filter((product) => product.sku === code).length !== 1
  );
  const badHttp = httpJournal.filter((entry) => [400, 409, 500].includes(entry.status));
  const ok =
    finalProducts.length === PRODUCT_COUNT &&
    duplicates.length === 0 &&
    finalCount === baseline.initialCount + PRODUCT_COUNT &&
    nonBatchAfter.hash === baseline.nonBatch.hash &&
    badHttp.length === 0;
  const report = {
    ok,
    mode: 'apply',
    database: safety,
    batchId: BATCH_ID,
    initialCount: baseline.initialCount,
    finalCount,
    created,
    skipped,
    reconciled,
    reconciliationMovements,
    imagesUploaded,
    batchCount: finalProducts.length,
    duplicates,
    nonBatchPreserved: nonBatchAfter.hash === baseline.nonBatch.hash,
    badHttp,
    stateFile: STATE_FILE,
  };
  writeJson(APPLY_REPORT, report);
  console.log(JSON.stringify(report, null, 2));
  if (!ok) process.exitCode = 2;
}

async function verifyCatalog({ safety, taxonomy, token }) {
  const baseline = readJson(BASELINE_FILE);
  const state = readJson(STATE_FILE);
  if (!baseline || !state) throw new Error('QA50_APPLY_STATE_REQUIRED');
  await assertNoForeignCodeCollision();
  const exactProducts = await loadExactAdminProducts(token);
  const productIdsByCode = Object.fromEntries(
    exactProducts.map((product) => [product.sku, String(product._id)])
  );
  const mediaByCode = Object.fromEntries(
    exactProducts.map((product) => [product.sku, mediaFromProduct(product)])
  );
  const expectedProducts = buildQa50Definitions({ taxonomy, mediaByCode, productIdsByCode });
  const validation = await validateDefinitionsWithBackendAuthority(
    expectedProducts,
    exactProducts.map((product) => String(product._id))
  );
  if (!validation.ok) throw new Error(`QA50_VERIFY_DEFINITION_INVALID:${validation.errors.join('|')}`);

  const rows = [];
  for (const expected of expectedProducts) {
    const code = expected.sku;
    const productId = productIdsByCode[code];
    const row = {
      code,
      product: expected.title,
      type: expected.productType,
      category: expected.category,
      expectedVariants: expected.variants.length,
      savedVariants: 0,
      images: 0,
      post: Number(state.creationByCode?.[code]?.post || 0),
      getAdmin: 0,
      getPublic: 0,
      put: 0,
      reload: 0,
      cart: '',
      result: 'FAILED',
      error: '',
    };
    try {
      if (!productId) throw new Error('PRODUCT_ID_MISSING');
      const adminGet = await requestJson(`/api/products/admin/${productId}`, {
        token,
        expected: 200,
      });
      row.getAdmin = adminGet.status;
      const before = adminGet.data;
      row.savedVariants = Array.isArray(before.variants) ? before.variants.length : 0;

      const publicGet = await requestJson(`/api/products/${productId}`, { expected: 200 });
      row.getPublic = publicGet.status;
      const search = await requestJson(
        `/api/products?page=1&limit=100&q=${encodeURIComponent(code)}&sort=createdAt`,
        { expected: 200 }
      );
      const searchMatches = (search.data?.products || []).filter((product) => product.sku === code);
      if (searchMatches.length !== 1) throw new Error(`PUBLIC_SEARCH_MATCHES:${searchMatches.length}`);

      const imageUrls = [
        before.image,
        ...(before.images || []),
        ...(before.variants || []).flatMap((variant) => [variant.image, ...(variant.images || [])]),
      ].filter(Boolean);
      const uniqueImageUrls = [...new Set(imageUrls)];
      row.images = uniqueImageUrls.length;
      if (!before.image || !Array.isArray(before.images) || before.images.length < 2) {
        throw new Error('PRODUCT_MEDIA_INCOMPLETE');
      }
      if (uniqueImageUrls.some((url) => !url.includes('/f_webp,q_auto/') || !url.endsWith('.webp'))) {
        throw new Error('PRODUCT_MEDIA_NOT_WEBP');
      }
      const imageChecks = await Promise.all(uniqueImageUrls.map(validateMediaUrl));
      const brokenImages = imageChecks.filter((check) => !check.ok);
      if (brokenImages.length) {
        throw new Error(`BROKEN_IMAGES:${brokenImages.map((item) => item.status).join(',')}`);
      }

      const savedVariants = Array.isArray(before.variants) ? before.variants : [];
      if (savedVariants.length !== expected.variants.length) {
        throw new Error(`VARIANT_COUNT:${savedVariants.length}/${expected.variants.length}`);
      }
      for (const expectedVariant of expected.variants) {
        assertVariantIdentity(expectedVariant);
        const saved = savedVariants.find((variant) => variant.variantKey === expectedVariant.variantKey);
        if (!saved) throw new Error(`VARIANT_MISSING:${expectedVariant.variantKey}`);
        assertVariantIdentity(saved);
        if (
          saved.sku !== expectedVariant.sku ||
          saved.barcode !== expectedVariant.barcode ||
          stableJson(saved.attributes || []) !== stableJson(expectedVariant.attributes || [])
        ) {
          throw new Error(`VARIANT_CONTENT_MISMATCH:${expectedVariant.variantKey}`);
        }
      }

      const inventory = await inventorySnapshot(productId);
      const expectedInventory = expectedStock(expected);
      if (inventory.stock !== expectedInventory || inventory.reservedStock !== 0) {
        throw new Error(`INVENTORY_MISMATCH:${inventory.stock}/${expectedInventory}`);
      }
      if (expected.variants.length) {
        const expectedKeys = expected.variants.map((variant) => variant.variantKey).sort();
        if (stableJson(inventory.variantKeys) !== stableJson(expectedKeys)) {
          throw new Error('INVENTORY_VARIANT_KEYS_MISMATCH');
        }
      }
      if (expected.trackInventory === false && inventory.rows !== 0) {
        throw new Error(`NON_INVENTORY_ROWS:${inventory.rows}`);
      }

      const beforeProjection = immutableProjection(before);
      const replacePayload = buildReplacePayload(before);
      replacePayload.notes = before.notes?.includes(VERIFICATION_NOTE)
        ? before.notes
        : `${before.notes || ''} | ${VERIFICATION_NOTE}`.trim();
      const put = await requestJson(`/api/products/${productId}?mode=replace`, {
        token,
        method: 'PUT',
        body: replacePayload,
        expected: 200,
      });
      row.put = put.status;
      const reload = await requestJson(`/api/products/admin/${productId}`, {
        token,
        expected: 200,
      });
      row.reload = reload.status;
      if (!String(reload.data?.notes || '').includes(VERIFICATION_NOTE)) {
        throw new Error('VERIFICATION_NOTE_NOT_SAVED');
      }
      const afterProjection = immutableProjection(reload.data);
      if (stableJson(beforeProjection) !== stableJson(afterProjection)) {
        throw new Error('UNEDITED_FIELDS_CHANGED');
      }
      if ((reload.data?.variants || []).length !== expected.variants.length) {
        throw new Error('VARIANT_COUNT_CHANGED_AFTER_PUT');
      }
      const inventoryAfter = await inventorySnapshot(productId);
      if (stableJson(inventory) !== stableJson(inventoryAfter)) {
        throw new Error('INVENTORY_CHANGED_AFTER_PUT');
      }

      const cart = await verifyCartEligibility(reload.data, expected, token);
      row.cart = cart.status;
      if (!cart.ok) throw new Error('CART_VALIDATION_FAILED');
      row.result = 'OK';
    } catch (error) {
      row.error = error.message;
    }
    rows.push(row);
  }

  const publicIds = new Set();
  let page = 1;
  let totalPages = 1;
  const pageResults = [];
  do {
    const response = await requestJson(`/api/products?page=${page}&limit=24&sort=-createdAt`, {
      expected: 200,
    });
    totalPages = Number(response.data?.pagination?.totalPages || 0);
    const pageProducts = Array.isArray(response.data?.products) ? response.data.products : [];
    pageProducts.forEach((product) => publicIds.add(String(product._id)));
    pageResults.push({ page, returned: pageProducts.length });
    page += 1;
  } while (page <= totalPages);

  const qaPublicMissing = PRODUCT_CODES.filter((code) => !publicIds.has(productIdsByCode[code]));
  const categoryChecks = [];
  for (const category of [...new Set(expectedProducts.map((product) => product.category))]) {
    const response = await requestJson(
      `/api/products?page=1&limit=100&category=${encodeURIComponent(category)}&sort=title`,
      { expected: 200 }
    );
    const expectedCodes = expectedProducts
      .filter((product) => product.category === category)
      .map((product) => product.sku);
    const returnedCodes = (response.data?.products || []).map((product) => product.sku);
    categoryChecks.push({
      category,
      expected: expectedCodes.length,
      found: expectedCodes.filter((code) => returnedCodes.includes(code)).length,
    });
  }
  const searchCheck = await requestJson(
    `/api/products?page=1&limit=100&q=${encodeURIComponent(BATCH_ID)}&sort=-title`,
    { expected: 200 }
  );
  // El lote vive en tags, campo que no participa en q. Se prueba el prefijo SKU real.
  const prefixSearch = await requestJson('/api/products?page=1&limit=100&q=QA50-&sort=-title', {
    expected: 200,
  });
  const nonBatchAfter = await captureNonBatchSnapshot();
  const finalCount = await totalProductCount();
  const finalAdmin = await loadExactAdminProducts(token);
  const failedRows = rows.filter((row) => row.result !== 'OK');
  const badHttp = httpJournal.filter((entry) => [400, 409, 500].includes(entry.status));
  const categoryFailures = categoryChecks.filter((item) => item.expected !== item.found);
  const ok =
    rows.length === PRODUCT_COUNT &&
    failedRows.length === 0 &&
    finalAdmin.length === PRODUCT_COUNT &&
    qaPublicMissing.length === 0 &&
    Number(prefixSearch.data?.pagination?.totalProducts || 0) === PRODUCT_COUNT &&
    finalCount === baseline.initialCount + PRODUCT_COUNT &&
    nonBatchAfter.hash === baseline.nonBatch.hash &&
    categoryFailures.length === 0 &&
    badHttp.length === 0;

  const report = {
    ok,
    mode: 'verify',
    database: safety,
    batchId: BATCH_ID,
    initialCount: baseline.initialCount,
    finalCount,
    expectedFinalCount: baseline.initialCount + PRODUCT_COUNT,
    distribution: TYPE_DISTRIBUTION,
    verified: rows.length,
    passed: rows.length - failedRows.length,
    failed: failedRows.length,
    nonBatchPreserved: nonBatchAfter.hash === baseline.nonBatch.hash,
    batchAdminCount: finalAdmin.length,
    batchPublicCount: PRODUCT_COUNT - qaPublicMissing.length,
    publicPagination: { totalPages, pages: pageResults },
    prefixSearchTotal: Number(prefixSearch.data?.pagination?.totalProducts || 0),
    tagSearchStatus: searchCheck.status,
    categoryChecks,
    categoryFailures,
    qaPublicMissing,
    badHttp,
    validation,
    rows,
    reports: { json: VERIFY_REPORT, csv: VERIFY_CSV_REPORT },
  };
  writeJson(VERIFY_REPORT, report);
  writeCsv(rows);
  console.log(JSON.stringify({
    ...report,
    rows: undefined,
  }, null, 2));
  if (!ok) process.exitCode = 2;
}

async function cleanupBatch({ safety, token }) {
  const documents = await findBatchDocuments();
  if (documents.length > PRODUCT_COUNT) throw new Error('QA50_CLEANUP_SCOPE_TOO_LARGE');
  for (const document of documents) {
    if (!PRODUCT_CODES.includes(document.sku) || !document.tags?.includes(BATCH_ID)) {
      throw new Error('QA50_CLEANUP_SCOPE_INVALID');
    }
  }
  const results = [];
  for (const document of documents) {
    const response = await requestJson(`/api/products/${document._id}`, {
      token,
      method: 'DELETE',
      expected: 200,
    });
    results.push({ sku: document.sku, id: String(document._id), status: response.status });
  }
  const report = {
    ok: results.length === documents.length,
    mode: 'cleanup',
    database: safety,
    batchId: BATCH_ID,
    archivedThroughOfficialApi: results.length,
    deleteManyUsed: false,
    results,
  };
  writeJson(path.join(REPORT_DIR, 'cleanup.json'), report);
  console.log(JSON.stringify(report, null, 2));
}

async function main() {
  const options = parseArgs();
  if (!process.env.MONGODB_URI) throw new Error('QA50_MONGODB_URI_MISSING');
  await mongoose.connect(process.env.MONGODB_URI, {
    autoIndex: false,
    serverSelectionTimeoutMS: 10_000,
  });
  const safety = assertSafeDatabase(options);
  console.log(JSON.stringify({
    event: 'QA50_DATABASE_CONFIRMED',
    database: safety.database,
    host: safety.host,
    classification: safety.classification,
  }));
  const token = createAdminToken();
  const taxonomy = await fetchTaxonomy(token);

  if (options.mode === 'dry-run') await dryRun({ safety, taxonomy, token });
  else if (options.mode === 'apply') await applyBatch({ safety, taxonomy, token });
  else if (options.mode === 'verify') await verifyCatalog({ safety, taxonomy, token });
  else if (options.mode === 'cleanup') await cleanupBatch({ safety, token });
}

main()
  .catch((error) => {
    console.error(JSON.stringify({
      ok: false,
      error: error.message,
      status: error.status || null,
      details: error.publicBody || null,
    }));
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
