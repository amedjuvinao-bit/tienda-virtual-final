'use strict';

require('dotenv').config({ quiet: true });

const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const BASE_URL = 'http://localhost:5000';

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    confirmDatabase: '',
    confirmHttpWrites: false,
    productId: '',
  };
  for (const argument of argv) {
    if (argument.startsWith('--confirm-database=')) {
      options.confirmDatabase = argument.slice(19);
    } else if (argument === '--confirm-http-writes') {
      options.confirmHttpWrites = true;
    } else if (argument.startsWith('--product-id=')) {
      options.productId = argument.slice(13);
    } else {
      throw new Error(`ARGUMENT_NOT_ALLOWED:${argument}`);
    }
  }
  if (!options.confirmHttpWrites) throw new Error('HTTP_WRITES_CONFIRMATION_REQUIRED');
  return options;
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function refId(value) {
  return String(value?._id || value?.id || value || '').trim();
}

function normalizeVariantForPayload(variant = {}, index = 0) {
  return {
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
    originalPrice:
      variant.originalPrice == null ? null : Number(variant.originalPrice),
    image: variant.image || '',
    images: array(variant.images).slice(0, 8),
    initialStock: Math.max(0, Math.floor(Number(variant.initialStock || 0))),
    active: variant.active !== false,
    sortOrder: Number(variant.sortOrder ?? index),
  };
}

function buildReplacePayload(product = {}) {
  const payload = {
    sku: product.sku || '',
    title: product.title || '',
    price: Number(product.price),
    description: product.description || '',
    image: product.image || '',
    images: array(product.images).slice(0, 5),
    active: product.active !== false,
    category: String(product.category || '').trim(),
    categories: array(product.categories),
    primaryCategoryId: refId(product.primaryCategoryRef) || null,
    categoryIds: array(product.categoryRefs).map(refId).filter(Boolean),
    collectionIds: array(product.collectionRefs).map(refId).filter(Boolean),
    productType: product.productType || 'physical',
    unitOfMeasure: product.unitOfMeasure || 'unit',
    trackInventory: product.trackInventory !== false,
    allowBackorder: product.allowBackorder === true,
    variantPreset: product.variantPreset || 'none',
    variantAxes: array(product.variantAxes),
    colors: array(product.colors),
    sizes: array(product.sizes),
    inventory: array(product.inventory).map((row) => ({
      size: row.size || '',
      color: row.color || '',
      stock: Math.max(0, Math.floor(Number(row.stock || 0))),
    })),
    variants: array(product.variants).map(normalizeVariantForPayload),
    reorderPoint: Math.max(0, Number(product.reorderPoint || 0)),
    reorderQty: Math.max(0, Number(product.reorderQty || 0)),
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
      key: field.key || field.label || '',
      label: field.label || '',
      group: field.group || 'General',
      type: field.type || 'text',
      value: field.value ?? '',
      public: field.public !== false,
      sortOrder: index,
    })),
    digitalDelivery:
      product.productType === 'digital' ? product.digitalDelivery || {} : {},
    serviceDelivery:
      product.productType === 'service' ? product.serviceDelivery || {} : {},
    bundleComponents:
      product.productType === 'bundle'
        ? array(product.bundleComponents).map((component) => ({
            product: refId(component.product),
            variantKey: component.variantKey || 'default__default',
            quantity: Math.max(1, Math.floor(Number(component.quantity || 1))),
          }))
        : [],
    notes: product.notes || '',
  };
  if (payload.trackInventory && Number(product.stock) > 0) {
    payload.stock = Math.max(0, Math.floor(Number(product.stock)));
  }
  return payload;
}

function canonicalCommercialProjection(product = {}) {
  return {
    sku: product.sku || '',
    barcode: product.barcode || '',
    title: product.title || '',
    price: Number(product.price || 0),
    originalPrice: product.originalPrice == null ? null : Number(product.originalPrice),
    description: product.description || '',
    image: product.image || '',
    images: array(product.images),
    active: product.active !== false,
    visible: product.visible !== false,
    category: product.category || '',
    categories: array(product.categories),
    productType: product.productType || 'physical',
    unitOfMeasure: product.unitOfMeasure || 'unit',
    trackInventory: product.trackInventory !== false,
    allowBackorder: product.allowBackorder === true,
    variantPreset: product.variantPreset || 'none',
    variantAxes: array(product.variantAxes).map((axis) => ({
      key: axis.key, label: axis.label, values: array(axis.values),
    })),
    colors: array(product.colors),
    sizes: array(product.sizes),
    inventory: array(product.inventory).map((row) => ({
      size: row.size || '', color: row.color || '', stock: Number(row.stock || 0),
    })),
    variants: array(product.variants).map((variant) => ({
      variantKey: variant.variantKey,
      label: variant.label || '',
      size: variant.size || '',
      color: variant.color || '',
      attributes: array(variant.attributes).map((attribute) => ({
        key: attribute.key, label: attribute.label, value: attribute.value,
      })),
      sku: variant.sku || '',
      barcode: variant.barcode || '',
      price: variant.price == null ? null : Number(variant.price),
      cost: variant.cost == null ? null : Number(variant.cost),
      originalPrice:
        variant.originalPrice == null ? null : Number(variant.originalPrice),
      image: variant.image || '',
      images: array(variant.images),
      initialStock: Number(variant.initialStock || 0),
      active: variant.active !== false,
      sortOrder: Number(variant.sortOrder || 0),
    })),
    bundleComponents: array(product.bundleComponents).map((component) => ({
      product: refId(component.product),
      variantKey: component.variantKey || 'default__default',
      quantity: Number(component.quantity || 1),
    })),
    digitalDelivery: product.digitalDelivery || {},
    serviceDelivery: product.serviceDelivery || {},
    brand: product.brand || '',
    season: product.season || '',
    supplier: { name: product.supplier?.name || '' },
    tags: array(product.tags),
    seo: product.seo || {},
    commercialFields: array(product.commercialFields).map((field) => ({
      key: field.key, label: field.label, group: field.group, type: field.type,
      value: field.value, public: field.public !== false,
    })),
    notes: product.notes || '',
  };
}

function stable(value) {
  return JSON.stringify(value);
}

async function inventoryTotals(db, productId) {
  const [totals = {}] = await db.collection('inventorystocks').aggregate([
    { $match: { product: new mongoose.Types.ObjectId(productId), deletedAt: null } },
    { $group: {
      _id: null,
      stock: { $sum: '$stock' },
      reservedStock: { $sum: '$reservedStock' },
      availableStock: { $sum: '$availableStock' },
      rows: { $sum: 1 },
    } },
  ]).toArray();
  return {
    stock: Number(totals.stock || 0),
    reservedStock: Number(totals.reservedStock || 0),
    availableStock: Number(totals.availableStock || 0),
    rows: Number(totals.rows || 0),
  };
}

async function requestJson(path, { token, method = 'GET', body } = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
}

async function main() {
  const options = parseArgs();
  await mongoose.connect(process.env.MONGODB_URI, {
    autoIndex: false,
    serverSelectionTimeoutMS: 10_000,
  });
  if (mongoose.connection.name !== options.confirmDatabase) {
    throw new Error('DATABASE_CONFIRMATION_MISMATCH');
  }
  const db = mongoose.connection.db;
  const productFilter = options.productId
    ? { _id: new mongoose.Types.ObjectId(options.productId) }
    : {};
  const documents = await db.collection('products')
    .find(productFilter)
    .sort({ _id: 1 })
    .toArray();
  const mongoTotal = await db.collection('products').countDocuments({});
  const token = jwt.sign(
    { role: 'admin', username: 'all-product-edit-verifier' },
    process.env.JWT_SECRET,
    { expiresIn: '30m' }
  );
  const results = [];

  for (const document of documents) {
    const productId = String(document._id);
    const firstGet = await requestJson(`/api/products/admin/${productId}`, { token });
    if (firstGet.status !== 200) {
      results.push({ productId, title: document.title, get: firstGet.status, result: 'GET_FAILED' });
      continue;
    }
    const before = firstGet.data;
    const beforeProjection = canonicalCommercialProjection(before);
    const beforeInventory = await inventoryTotals(db, productId);
    const put = await requestJson(`/api/products/${productId}?mode=replace`, {
      token,
      method: 'PUT',
      body: buildReplacePayload(before),
    });
    const reload = await requestJson(`/api/products/admin/${productId}`, { token });
    const afterProjection = reload.status === 200
      ? canonicalCommercialProjection(reload.data)
      : null;
    const afterInventory = await inventoryTotals(db, productId);
    const changedFields = afterProjection
      ? Object.keys(beforeProjection).filter(
          (field) => stable(beforeProjection[field]) !== stable(afterProjection[field])
        )
      : ['RELOAD_FAILED'];
    const inventoryPreserved = stable(beforeInventory) === stable(afterInventory);
    const shouldBePublic =
      document.active === true && document.visible !== false && document.archivedAt == null;
    const publicGet = await requestJson(`/api/products/${productId}`);
    const expectedPublicStatus = shouldBePublic ? 200 : 404;

    results.push({
      productId,
      title: document.title || '',
      get: firstGet.status,
      put: put.status,
      reload: reload.status,
      publicGet: publicGet.status,
      expectedPublicStatus,
      variantsBefore: array(before.variants).length,
      variantsAfter: array(reload.data?.variants).length,
      changedFields,
      inventoryBefore: beforeInventory,
      inventoryAfter: afterInventory,
      inventoryPreserved,
      result:
        put.status === 200 &&
        reload.status === 200 &&
        changedFields.length === 0 &&
        inventoryPreserved &&
        publicGet.status === expectedPublicStatus
          ? 'OK'
          : 'FAILED',
      error: put.status === 200
        ? null
        : {
            code: put.data?.error || put.data?.code || null,
            message: put.data?.message || null,
            errors: Array.isArray(put.data?.errors) ? put.data.errors : [],
          },
    });
  }

  const [adminList, publicList] = await Promise.all([
    requestJson('/api/products/admin/list?page=1&limit=100&status=all&sort=createdAt', { token }),
    requestJson('/api/products?page=1&limit=100&sort=createdAt'),
  ]);
  const failed = results.filter((result) => result.result !== 'OK');
  console.log(JSON.stringify({
    ok: failed.length === 0,
    database: mongoose.connection.name,
    mongoTotal,
    verified: results.length,
    passed: results.length - failed.length,
    failed: failed.length,
    adminApi: {
      status: adminList.status,
      total: adminList.data?.pagination?.totalProducts,
      returned: adminList.data?.products?.length,
    },
    publicApi: {
      status: publicList.status,
      total: publicList.data?.pagination?.totalProducts,
      returned: publicList.data?.products?.length,
    },
    results,
  }, null, 2));
  if (failed.length) process.exitCode = 2;
}

main()
  .catch((error) => {
    console.error(JSON.stringify({ ok: false, error: error.message }));
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
