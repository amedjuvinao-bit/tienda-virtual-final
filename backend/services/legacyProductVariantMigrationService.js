'use strict';

const {
  DEFAULT_VARIANT_KEY,
  canonicalizeColorValue,
  normalizeCanonicalAttributes,
  resolveVariantIdentity,
} = require('../../shared/variantKeyAuthority.cjs');

function text(value) {
  return String(value || '').trim();
}

function plain(value) {
  if (!value || typeof value !== 'object') return value;
  return typeof value.toObject === 'function'
    ? value.toObject({ depopulate: true, virtuals: false })
    : { ...value };
}

function comparable(value) {
  return JSON.stringify(value, (_key, entry) => {
    if (entry && typeof entry === 'object' && entry._bsontype === 'ObjectId') {
      return String(entry);
    }
    return entry;
  });
}

function same(left, right) {
  return comparable(left) === comparable(right);
}

function canonicalAttributeKey(attribute = {}) {
  return normalizeCanonicalAttributes([attribute])[0]?.key || '';
}

function preserveAttributeMetadata(rawAttributes = [], canonicalAttributes = []) {
  const source = Array.isArray(rawAttributes) ? rawAttributes.map(plain) : [];
  const byKey = new Map();
  source.forEach((attribute) => {
    const key = canonicalAttributeKey(attribute);
    if (key && !byKey.has(key)) byKey.set(key, attribute);
  });

  return canonicalAttributes.map((attribute) => {
    const original = byKey.get(attribute.key) || {};
    return {
      ...original,
      key: attribute.key,
      label: text(original.label || original.name || attribute.label || attribute.key),
      value: attribute.value,
    };
  });
}

function normalizeExistingVariant(rawVariant = {}) {
  const variant = plain(rawVariant) || {};
  const rawAttributes = Array.isArray(variant.attributes)
    ? variant.attributes
    : Array.isArray(variant.variantAttributes)
      ? variant.variantAttributes
      : [];
  const identity = resolveVariantIdentity({
    size: variant.size,
    color: variant.color,
    attributes: rawAttributes,
  });

  return {
    value: {
      ...variant,
      variantKey: identity.variantKey,
      size: identity.size,
      color: identity.color,
      attributes: preserveAttributeMetadata(
        rawAttributes,
        identity.attributes
      ),
    },
    fromKey: text(variant.variantKey),
    toKey: identity.variantKey,
  };
}

function normalizeLegacyInventoryRow(rawRow = {}) {
  const row = plain(rawRow) || {};
  const rawAttributes = Array.isArray(row.attributes)
    ? row.attributes
    : [];
  const identity = resolveVariantIdentity({
    size: row.size,
    color: row.color,
    attributes: rawAttributes,
  });
  const next = {
    ...row,
    size: identity.size,
    color: identity.color,
  };

  if (Object.prototype.hasOwnProperty.call(row, 'variantKey')) {
    next.variantKey = identity.variantKey;
  }
  if (rawAttributes.length) {
    next.attributes = preserveAttributeMetadata(
      rawAttributes,
      identity.attributes
    );
  }

  return next;
}

function normalizeProductColors(colors = []) {
  if (!Array.isArray(colors)) return [];
  const result = [];
  const seen = new Set();
  for (const color of colors) {
    const canonical = canonicalizeColorValue(color);
    if (!canonical || seen.has(canonical)) continue;
    seen.add(canonical);
    result.push(canonical);
  }
  return result;
}

function buildProductKeyMaps(products = []) {
  const maps = new Map();
  const normalizedVariants = new Map();
  const collisions = [];

  for (const rawProduct of products) {
    const product = plain(rawProduct) || {};
    const productId = text(product._id);
    const keyMap = new Map();
    const nextVariants = [];
    const canonicalOwners = new Map();

    for (const rawVariant of product.variants || []) {
      const normalized = normalizeExistingVariant(rawVariant);
      const currentOwner = canonicalOwners.get(normalized.toKey);
      if (currentOwner) {
        collisions.push({
          type: 'PRODUCT_VARIANT_COLLISION',
          productId,
          title: text(product.title),
          canonicalVariantKey: normalized.toKey,
          sourceVariantKeys: [currentOwner, normalized.fromKey],
        });
      } else {
        canonicalOwners.set(normalized.toKey, normalized.fromKey);
      }
      keyMap.set(normalized.fromKey, normalized.toKey);
      nextVariants.push(normalized.value);
    }

    maps.set(productId, keyMap);
    normalizedVariants.set(productId, nextVariants);
  }

  return { maps, normalizedVariants, collisions };
}

function normalizeBundleComponents(components = [], keyMaps = new Map()) {
  if (!Array.isArray(components)) return [];
  return components.map((rawComponent) => {
    const component = plain(rawComponent) || {};
    const productId = text(component.product || component.productId);
    const currentKey = text(component.variantKey) || DEFAULT_VARIANT_KEY;
    const mappedKey = keyMaps.get(productId)?.get(currentKey) || currentKey;
    return mappedKey === currentKey
      ? component
      : { ...component, variantKey: mappedKey };
  });
}

function buildProductPlan(products = []) {
  const source = products.map(plain);
  const { maps, normalizedVariants, collisions } = buildProductKeyMaps(source);
  const updates = [];
  const reports = [];

  for (const product of source) {
    const productId = text(product._id);
    const next = {
      variants: normalizedVariants.get(productId) || [],
      inventory: Array.isArray(product.inventory)
        ? product.inventory.map(normalizeLegacyInventoryRow)
        : [],
      colors: normalizeProductColors(product.colors),
      bundleComponents: normalizeBundleComponents(
        product.bundleComponents,
        maps
      ),
    };
    const changedFields = Object.keys(next).filter(
      (field) => !same(product[field] || [], next[field])
    );

    if (changedFields.length) {
      updates.push({
        _id: product._id,
        productId,
        title: text(product.title),
        set: Object.fromEntries(
          changedFields.map((field) => [field, next[field]])
        ),
        changedFields,
      });
    }

    reports.push({
      productId,
      title: text(product.title),
      variants: Array.isArray(product.variants) ? product.variants.length : 0,
      changedFields,
      status: changedFields.length ? 'NEEDS_MIGRATION' : 'CANONICAL',
    });
  }

  return { keyMaps: maps, updates, reports, collisions };
}

function normalizeStockVariant(rawStock = {}, keyMaps = new Map()) {
  const stock = plain(rawStock) || {};
  const productId = text(stock.product);
  const rawVariant = plain(stock.variant) || {};
  const rawAttributes = Array.isArray(rawVariant.attributes)
    ? rawVariant.attributes
    : [];
  const identity = resolveVariantIdentity({
    size: rawVariant.size,
    color: rawVariant.color,
    attributes: rawAttributes,
  });
  const mappedKey = keyMaps
    .get(productId)
    ?.get(text(stock.variantKey));
  const variantKey = mappedKey || identity.variantKey;
  const variant = {
    ...rawVariant,
    size: identity.size,
    color: identity.color,
    attributes: preserveAttributeMetadata(
      rawAttributes,
      identity.attributes
    ),
  };
  return { variantKey, variant };
}

function chooseStockSurvivor(entries) {
  return [...entries].sort((left, right) => {
    const leftCanonical = left.row.variantKey === left.normalized.variantKey ? 1 : 0;
    const rightCanonical = right.row.variantKey === right.normalized.variantKey ? 1 : 0;
    if (leftCanonical !== rightCanonical) return rightCanonical - leftCanonical;
    const leftActive = left.row.active !== false ? 1 : 0;
    const rightActive = right.row.active !== false ? 1 : 0;
    if (leftActive !== rightActive) return rightActive - leftActive;
    return text(left.row._id).localeCompare(text(right.row._id));
  })[0];
}

function buildInventoryStockPlan(stocks = [], keyMaps = new Map(), now = new Date()) {
  const entries = stocks.map((rawStock) => {
    const row = plain(rawStock) || {};
    return { row, normalized: normalizeStockVariant(row, keyMaps) };
  });
  const liveGroups = new Map();

  entries
    .filter(({ row }) => row.deletedAt == null)
    .forEach((entry) => {
      const key = [
        text(entry.row.branch),
        text(entry.row.product),
        entry.normalized.variantKey,
      ].join('|');
      if (!liveGroups.has(key)) liveGroups.set(key, []);
      liveGroups.get(key).push(entry);
    });

  const updates = [];
  const collisions = [];
  for (const [groupKey, group] of liveGroups.entries()) {
    const survivor = chooseStockSurvivor(group);
    if (group.length === 1) {
      const set = {};
      if (survivor.row.variantKey !== survivor.normalized.variantKey) {
        set.variantKey = survivor.normalized.variantKey;
      }
      if (!same(survivor.row.variant || {}, survivor.normalized.variant)) {
        set.variant = survivor.normalized.variant;
      }
      if (Object.keys(set).length) {
        updates.push({
          _id: survivor.row._id,
          stockId: text(survivor.row._id),
          action: 'NORMALIZE',
          set,
        });
      }
      continue;
    }

    const totalStock = group.reduce(
      (sum, entry) => sum + Math.max(0, Number(entry.row.stock || 0)),
      0
    );
    const totalReserved = group.reduce(
      (sum, entry) => sum + Math.max(0, Number(entry.row.reservedStock || 0)),
      0
    );
    const survivorSet = {
      variantKey: survivor.normalized.variantKey,
      variant: survivor.normalized.variant,
      stock: totalStock,
      reservedStock: totalReserved,
      availableStock: Math.max(0, totalStock - totalReserved),
      active: group.some((entry) => entry.row.active !== false),
    };
    updates.push({
      _id: survivor.row._id,
      stockId: text(survivor.row._id),
      action: 'MERGE_SURVIVOR',
      set: survivorSet,
    });

    const retired = group.filter(
      (entry) => text(entry.row._id) !== text(survivor.row._id)
    );
    for (const entry of retired) {
      updates.push({
        _id: entry.row._id,
        stockId: text(entry.row._id),
        action: 'RETIRE_DUPLICATE',
        set: {
          active: false,
          deletedAt: now,
          stock: 0,
          reservedStock: 0,
          availableStock: 0,
        },
      });
    }
    collisions.push({
      type: 'INVENTORY_STOCK_EQUIVALENT_ROWS',
      groupKey,
      survivorId: text(survivor.row._id),
      retiredIds: retired.map((entry) => text(entry.row._id)),
      totalStock,
      totalReserved,
    });
  }

  return { updates, collisions };
}

function buildLegacyProductVariantMigrationPlan({
  products = [],
  inventoryStocks = [],
  now = new Date(),
} = {}) {
  const productPlan = buildProductPlan(products);
  const stockPlan = buildInventoryStockPlan(
    inventoryStocks,
    productPlan.keyMaps,
    now
  );
  return {
    productUpdates: productPlan.updates,
    productReports: productPlan.reports,
    inventoryStockUpdates: stockPlan.updates,
    collisions: [
      ...productPlan.collisions,
      ...stockPlan.collisions,
    ],
    blockingConflicts: productPlan.collisions,
    summary: {
      totalProducts: products.length,
      productsToUpdate: productPlan.updates.length,
      canonicalProducts: productPlan.reports.filter(
        (report) => report.status === 'CANONICAL'
      ).length,
      inventoryStocksTotal: inventoryStocks.length,
      inventoryStocksToUpdate: stockPlan.updates.length,
      equivalentStockGroups: stockPlan.collisions.length,
      blockingConflicts: productPlan.collisions.length,
    },
  };
}

module.exports = {
  buildLegacyProductVariantMigrationPlan,
  normalizeExistingVariant,
  normalizeLegacyInventoryRow,
  normalizeProductColors,
};
