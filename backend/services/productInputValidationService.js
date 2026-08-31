'use strict';

const {
  canonicalizeColorValue,
  resolveVariantIdentity,
} = require('../../shared/variantKeyAuthority.cjs');
const {
  normalizeProductType,
  shouldTrackInventory,
} = require('../lib/products/productUniversalConfig');
const {
  validateProductCustoms,
} = require('../lib/products/productCustomsConfig');

const MAX_VARIANTS = 300;

class ProductInputValidationError extends Error {
  constructor(errors = []) {
    super('La información del producto no es válida.');
    this.name = 'ProductInputValidationError';
    this.code = 'PRODUCT_VALIDATION_FAILED';
    this.status = 400;
    this.errors = errors.map(({ field, code, message }) => ({
      field,
      code,
      message,
    }));
  }
}

class ProductCommercialCodeConflictError extends Error {
  constructor(type = 'sku') {
    const isBarcode = type === 'barcode';
    super(
      isBarcode
        ? 'El código de barras ya está asignado.'
        : 'El SKU ya está asignado.'
    );
    this.name = 'ProductCommercialCodeConflictError';
    this.code = isBarcode
      ? 'PRODUCT_BARCODE_CONFLICT'
      : 'PRODUCT_SKU_CONFLICT';
    this.status = 409;
    this.type = isBarcode ? 'barcode' : 'sku';
  }
}

function hasOwn(value, key) {
  return Boolean(
    value && Object.prototype.hasOwnProperty.call(value, key)
  );
}

function toPlain(value) {
  if (!value || typeof value !== 'object') return {};
  return typeof value.toObject === 'function'
    ? value.toObject({ depopulate: true, virtuals: false })
    : { ...value };
}

function cleanText(value, max = 300) {
  return String(value ?? '')
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, max);
}

function normalizeSkuValue(value) {
  return cleanText(value, 100).toUpperCase();
}

function normalizeBarcodeValue(value) {
  return cleanText(value, 120);
}

function normalizeBarcodeKey(value) {
  return normalizeBarcodeValue(value).toLowerCase();
}

function validateCommercialCodeFormat(value, { field, type, errors }) {
  const raw = String(value ?? '').normalize('NFKC').trim();
  if (!raw) return;
  const maximum = type === 'sku' ? 100 : 120;
  const pattern = type === 'sku'
    ? /^[A-Za-z0-9][A-Za-z0-9._:/+-]*$/
    : /^[A-Za-z0-9][A-Za-z0-9._:/+-]*$/;
  if (raw.length > maximum || !pattern.test(raw)) {
    pushError(
      errors,
      field,
      type === 'sku' ? 'INVALID_SKU' : 'INVALID_BARCODE',
      type === 'sku'
        ? 'El SKU contiene caracteres o una longitud no permitidos.'
        : 'El código de barras contiene caracteres o una longitud no permitidos.'
    );
  }
}

function uniqueNonEmpty(values = [], normalize = cleanText) {
  const out = [];
  const seen = new Set();
  for (const value of values) {
    const normalized = normalize(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

function findDuplicate(values = [], normalize = cleanText) {
  const seen = new Set();
  for (const value of values) {
    const normalized = normalize(value);
    if (!normalized) continue;
    if (seen.has(normalized)) return true;
    seen.add(normalized);
  }
  return false;
}

function buildProductCodeKeys(product = {}) {
  const variants = Array.isArray(product.variants)
    ? product.variants
    : [];
  return {
    skuKeys: uniqueNonEmpty(
      [product.sku, ...variants.map((variant) => variant?.sku)],
      normalizeSkuValue
    ),
    barcodeKeys: uniqueNonEmpty(
      [
        product.barcode,
        ...variants.map((variant) => variant?.barcode),
      ],
      normalizeBarcodeKey
    ),
  };
}

function pushError(errors, field, code, message) {
  errors.push({ field, code, message });
}

function normalizeFiniteNumber(
  value,
  {
    field,
    errors,
    integer = false,
    min = 0,
    max = Number.POSITIVE_INFINITY,
    nullable = false,
  }
) {
  if (nullable && (value === null || value === undefined || value === '')) {
    return null;
  }
  if (value === null || value === undefined || value === '') {
    pushError(errors, field, 'REQUIRED', `${field} es obligatorio.`);
    return 0;
  }
  const number = Number(value);
  if (
    !Number.isFinite(number) ||
    number < min ||
    number > max ||
    (integer && !Number.isInteger(number))
  ) {
    pushError(
      errors,
      field,
      integer ? 'NON_NEGATIVE_INTEGER_REQUIRED' : 'INVALID_NUMBER',
      integer
        ? `${field} debe ser un entero no negativo.`
        : `${field} debe ser un número válido entre ${min} y ${max}.`
    );
    return 0;
  }
  return integer ? number : Math.round(number);
}

function normalizedToken(value) {
  return cleanText(value, 160)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function validateCanonicalColor(value, field, errors) {
  const raw = normalizedToken(value);
  if (!raw) return '';
  const canonical = canonicalizeColorValue(value);
  if (canonical !== raw) {
    pushError(
      errors,
      field,
      'CANONICAL_VALUE_REQUIRED',
      'El color debe usar su valor canónico interno, no la etiqueta visible.'
    );
  }
  return canonical;
}

function normalizeInventoryRows(rows, errors) {
  if (!Array.isArray(rows)) {
    pushError(errors, 'inventory', 'ARRAY_REQUIRED', 'inventory debe ser una lista.');
    return [];
  }
  const seen = new Set();
  return rows.map((row, index) => {
    const size = cleanText(row?.size, 80);
    const color = validateCanonicalColor(
      row?.color,
      `inventory.${index}.color`,
      errors
    );
    const stock = normalizeFiniteNumber(row?.stock, {
      field: `inventory.${index}.stock`,
      errors,
      integer: true,
    });
    if (!size && !color) {
      pushError(
        errors,
        `inventory.${index}`,
        'INVENTORY_VARIANT_REQUIRED',
        'La fila de inventario debe identificar una talla o color.'
      );
    }
    const key = `${size.toLowerCase()}__${color}`;
    if (seen.has(key)) {
      pushError(
        errors,
        `inventory.${index}`,
        'DUPLICATE_INVENTORY_COMBINATION',
        'La combinación de inventario está repetida.'
      );
    }
    seen.add(key);
    return { size, color, stock };
  });
}

function normalizeVariantRows(rows, baseProduct, errors) {
  if (!Array.isArray(rows)) {
    pushError(errors, 'variants', 'ARRAY_REQUIRED', 'variants debe ser una lista.');
    return [];
  }
  if (rows.length > MAX_VARIANTS) {
    pushError(
      errors,
      'variants',
      'TOO_MANY_VARIANTS',
      `El producto admite máximo ${MAX_VARIANTS} variantes.`
    );
  }

  const normalized = [];
  const seenKeys = new Set();
  for (const [index, raw] of rows.slice(0, MAX_VARIANTS).entries()) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      pushError(errors, `variants.${index}`, 'OBJECT_REQUIRED', 'La variante no es válida.');
      continue;
    }
    const size = cleanText(raw.size, 80);
    const color = validateCanonicalColor(
      raw.color,
      `variants.${index}.color`,
      errors
    );
    const attributes = Array.isArray(raw.attributes)
      ? raw.attributes.map((attribute, attributeIndex) => {
          const key = cleanText(
            attribute?.key || attribute?.name || attribute?.label,
            80
          );
          const label = cleanText(
            attribute?.label || attribute?.name || attribute?.key,
            120
          );
          let value = cleanText(attribute?.value, 160);
          if (['color', 'colour', 'tono'].includes(normalizedToken(key))) {
            value = validateCanonicalColor(
              value,
              `variants.${index}.attributes.${attributeIndex}.value`,
              errors
            );
          }
          return { key, label, value };
        })
      : [];

    let identity;
    try {
      identity = resolveVariantIdentity(
        {
          variantKey: raw.variantKey,
          size,
          color,
          attributes,
        },
        { strict: Boolean(cleanText(raw.variantKey, 180)) }
      );
    } catch {
      pushError(
        errors,
        `variants.${index}.variantKey`,
        'VARIANT_KEY_MISMATCH',
        'variantKey no corresponde con los valores canónicos de la variante.'
      );
      continue;
    }

    if (seenKeys.has(identity.variantKey)) {
      pushError(
        errors,
        `variants.${index}.variantKey`,
        'DUPLICATE_VARIANT_COMBINATION',
        'La combinación de variante está repetida.'
      );
    }
    seenKeys.add(identity.variantKey);

    const effectivePrice = raw.price == null || raw.price === ''
      ? Number(baseProduct.price || 0)
      : normalizeFiniteNumber(raw.price, {
          field: `variants.${index}.price`,
          errors,
          nullable: true,
        });
    const originalPrice = normalizeFiniteNumber(raw.originalPrice, {
      field: `variants.${index}.originalPrice`,
      errors,
      nullable: true,
    });
    if (originalPrice != null && originalPrice > 0 && originalPrice < effectivePrice) {
      pushError(
        errors,
        `variants.${index}.originalPrice`,
        'INVALID_DISCOUNT',
        'El precio original no puede ser menor que el precio de venta.'
      );
    }

    normalized.push({
      ...raw,
      variantKey: identity.variantKey,
      size: identity.size,
      color: identity.color,
      attributes: identity.attributes,
      sku: normalizeSkuValue(raw.sku),
      barcode: normalizeBarcodeValue(raw.barcode),
      price: raw.price == null || raw.price === '' ? null : effectivePrice,
      cost: normalizeFiniteNumber(raw.cost, {
        field: `variants.${index}.cost`,
        errors,
        nullable: true,
      }),
      originalPrice,
      initialStock: normalizeFiniteNumber(raw.initialStock ?? 0, {
        field: `variants.${index}.initialStock`,
        errors,
        integer: true,
      }),
      sortOrder: normalizeFiniteNumber(raw.sortOrder ?? index, {
        field: `variants.${index}.sortOrder`,
        errors,
        integer: true,
      }),
      active: raw.active !== false,
    });
    validateCommercialCodeFormat(raw.sku, {
      field: `variants.${index}.sku`,
      type: 'sku',
      errors,
    });
    validateCommercialCodeFormat(raw.barcode, {
      field: `variants.${index}.barcode`,
      type: 'barcode',
      errors,
    });
  }
  return normalized;
}

async function defaultConflictLookup({ ProductModel, type, keys, excludeId }) {
  if (!ProductModel || !keys.length) return false;
  const isBarcode = type === 'barcode';
  const keyField = isBarcode ? 'barcodeKeys' : 'skuKeys';
  const rootField = isBarcode ? 'barcode' : 'sku';
  const variantField = isBarcode ? 'variants.barcode' : 'variants.sku';
  const filter = {
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    $or: [
      { [keyField]: { $in: keys } },
      { [rootField]: { $in: keys } },
      { [variantField]: { $in: keys } },
    ],
  };
  let query = ProductModel.findOne(filter).select('_id').lean();
  if (typeof query?.collation === 'function') {
    query = query.collation({ locale: 'en', strength: 2 });
  }
  return Boolean(await query);
}

async function validateAndNormalizeProductInput(
  input = {},
  {
    mode = 'create',
    existingProduct = null,
    ProductModel = null,
    conflictLookup = null,
  } = {}
) {
  const payload = input && typeof input === 'object' && !Array.isArray(input)
    ? { ...input }
    : {};
  const existing = toPlain(existingProduct);
  const effective = mode === 'update' ? { ...existing, ...payload } : { ...payload };
  const errors = [];

  const title = cleanText(effective.title, 240);
  if (!title) {
    pushError(errors, 'title', 'REQUIRED', 'El nombre del producto es obligatorio.');
  }
  if (mode === 'create' || hasOwn(payload, 'title')) payload.title = title;

  const price = normalizeFiniteNumber(effective.price, {
    field: 'price',
    errors,
  });
  if (mode === 'create' || hasOwn(payload, 'price')) payload.price = price;

  for (const field of ['originalPrice', 'cost', 'averageCost', 'weightGrams']) {
    if (hasOwn(payload, field)) {
      payload[field] = normalizeFiniteNumber(payload[field], {
        field,
        errors,
        nullable: field === 'originalPrice',
      });
    }
  }
  const effectiveOriginalPrice = hasOwn(payload, 'originalPrice')
    ? payload.originalPrice
    : existing.originalPrice;
  if (
    effectiveOriginalPrice != null &&
    Number(effectiveOriginalPrice) > 0 &&
    Number(effectiveOriginalPrice) < price
  ) {
    pushError(
      errors,
      'originalPrice',
      'INVALID_DISCOUNT',
      'El precio original no puede ser menor que el precio de venta.'
    );
  }

  for (const field of ['taxRate', 'discountRate', 'discountPercent']) {
    if (hasOwn(payload, field)) {
      payload[field] = normalizeFiniteNumber(payload[field], {
        field,
        errors,
        min: 0,
        max: 100,
      });
    }
  }

  for (const field of ['stock', 'reorderPoint', 'reorderQty']) {
    if (hasOwn(payload, field)) {
      payload[field] = normalizeFiniteNumber(payload[field], {
        field,
        errors,
        integer: true,
      });
    }
  }

  if (hasOwn(payload, 'dimensionsCm')) {
    const dimensions = payload.dimensionsCm || {};
    payload.dimensionsCm = {};
    for (const axis of ['l', 'w', 'h']) {
      payload.dimensionsCm[axis] = normalizeFiniteNumber(dimensions[axis] ?? 0, {
        field: `dimensionsCm.${axis}`,
        errors,
      });
    }
  }

  if (hasOwn(payload, 'customs')) {
    const validatedCustoms = validateProductCustoms(payload.customs);
    payload.customs = validatedCustoms.customs;
    errors.push(...validatedCustoms.errors);
  }

  if (hasOwn(payload, 'sku')) {
    validateCommercialCodeFormat(payload.sku, {
      field: 'sku',
      type: 'sku',
      errors,
    });
    payload.sku = normalizeSkuValue(payload.sku);
  }
  if (hasOwn(payload, 'barcode')) {
    validateCommercialCodeFormat(payload.barcode, {
      field: 'barcode',
      type: 'barcode',
      errors,
    });
    payload.barcode = normalizeBarcodeValue(payload.barcode);
  }

  const requestedTrackInventory =
    effective.trackInventory === false || effective.trackInventory === 'false'
      ? false
      : effective.trackInventory === true || effective.trackInventory === 'true'
        ? true
        : undefined;
  const trackInventory = shouldTrackInventory(
    normalizeProductType(effective.productType),
    requestedTrackInventory
  );
  if (hasOwn(payload, 'inventory')) {
    payload.inventory = normalizeInventoryRows(payload.inventory, errors);
  }
  if (hasOwn(payload, 'variants')) {
    payload.variants = normalizeVariantRows(
      payload.variants,
      { ...existing, ...payload, price },
      errors
    );
  }

  const effectiveVariants = hasOwn(payload, 'variants')
    ? payload.variants
    : Array.isArray(existing.variants) ? existing.variants : [];
  const effectiveInventory = hasOwn(payload, 'inventory')
    ? payload.inventory
    : Array.isArray(existing.inventory) ? existing.inventory : [];
  if (!trackInventory && (effectiveVariants.length || effectiveInventory.length)) {
    pushError(
      errors,
      'trackInventory',
      'INVENTORY_CONFIGURATION_CONFLICT',
      'Un producto sin control de inventario no puede guardar variantes ni existencias.'
    );
  }

  if (trackInventory && hasOwn(payload, 'variants') && payload.variants.length) {
    payload.stock = payload.variants
      .filter((variant) => variant.active !== false)
      .reduce((sum, variant) => sum + Number(variant.initialStock || 0), 0);
  }

  const effectiveForCodes = {
    ...existing,
    ...payload,
    sku: hasOwn(payload, 'sku')
      ? payload.sku
      : normalizeSkuValue(existing.sku),
    barcode: hasOwn(payload, 'barcode')
      ? payload.barcode
      : normalizeBarcodeValue(existing.barcode),
    variants: effectiveVariants,
  };
  const rawSkuValues = [
    effectiveForCodes.sku,
    ...effectiveVariants.map((variant) => variant?.sku),
  ];
  const rawBarcodeValues = [
    effectiveForCodes.barcode,
    ...effectiveVariants.map((variant) => variant?.barcode),
  ];
  if (findDuplicate(rawSkuValues, normalizeSkuValue)) {
    pushError(errors, 'variants', 'DUPLICATE_SKU', 'Los SKU del producto deben ser únicos.');
  }
  if (findDuplicate(rawBarcodeValues, normalizeBarcodeKey)) {
    pushError(
      errors,
      'variants',
      'DUPLICATE_BARCODE',
      'Los códigos de barras del producto deben ser únicos.'
    );
  }

  if (errors.length) throw new ProductInputValidationError(errors);

  const keys = buildProductCodeKeys(effectiveForCodes);
  const lookup = conflictLookup || ((args) => defaultConflictLookup({ ...args, ProductModel }));
  const excludeId = existingProduct?._id || existing._id || null;
  if (keys.skuKeys.length && await lookup({ type: 'sku', keys: keys.skuKeys, excludeId })) {
    throw new ProductCommercialCodeConflictError('sku');
  }
  if (
    keys.barcodeKeys.length &&
    await lookup({ type: 'barcode', keys: keys.barcodeKeys, excludeId })
  ) {
    throw new ProductCommercialCodeConflictError('barcode');
  }

  return { payload, effective: effectiveForCodes, ...keys };
}

function mapProductWriteError(error) {
  if (
    error instanceof ProductInputValidationError ||
    error instanceof ProductCommercialCodeConflictError
  ) {
    return {
      status: error.status,
      body: {
        ok: false,
        error: error.code,
        message: error.message,
        ...(error.errors ? { errors: error.errors } : {}),
      },
    };
  }

  if (Number(error?.code) === 11000) {
    const indexName = cleanText(error?.index || error?.constraint || error?.message, 500).toLowerCase();
    const pattern = error?.keyPattern || {};
    if (pattern.sku || pattern.skuKeys || indexName.includes('sku')) {
      return {
        status: 409,
        body: {
          ok: false,
          error: 'PRODUCT_SKU_CONFLICT',
          message: 'El SKU ya está asignado.',
        },
      };
    }
    if (pattern.barcode || pattern.barcodeKeys || indexName.includes('barcode')) {
      return {
        status: 409,
        body: {
          ok: false,
          error: 'PRODUCT_BARCODE_CONFLICT',
          message: 'El código de barras ya está asignado.',
        },
      };
    }
    if (pattern.slug || indexName.includes('slug')) {
      return {
        status: 409,
        body: {
          ok: false,
          error: 'PRODUCT_SLUG_CONFLICT',
          message: 'Ya existe un producto con la misma dirección pública.',
        },
      };
    }
  }

  if (error?.name === 'ValidationError') {
    const validationKinds = new Set(
      Object.values(error?.errors || {})
        .map((entry) => cleanText(entry?.kind, 120).toUpperCase())
        .filter(Boolean)
    );
    if (validationKinds.has('PRODUCT_SKU_CONFLICT')) {
      return {
        status: 409,
        body: {
          ok: false,
          error: 'PRODUCT_SKU_CONFLICT',
          message: 'El SKU ya está asignado.',
        },
      };
    }
    if (validationKinds.has('PRODUCT_BARCODE_CONFLICT')) {
      return {
        status: 409,
        body: {
          ok: false,
          error: 'PRODUCT_BARCODE_CONFLICT',
          message: 'El código de barras ya está asignado.',
        },
      };
    }

    return {
      status: 400,
      body: {
        ok: false,
        error: 'PRODUCT_VALIDATION_FAILED',
        message: 'La información del producto no es válida.',
      },
    };
  }
  return null;
}

module.exports = {
  ProductCommercialCodeConflictError,
  ProductInputValidationError,
  buildProductCodeKeys,
  mapProductWriteError,
  normalizeBarcodeKey,
  normalizeBarcodeValue,
  normalizeSkuValue,
  validateAndNormalizeProductInput,
};
