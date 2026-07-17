// backend/lib/products/productVariantConfig.js

function cleanText(value, max = 300) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function cleanLower(value, max = 300) {
  return cleanText(value, max).toLowerCase();
}

function cleanUpper(value, max = 300) {
  return cleanText(value, max).toUpperCase();
}

function cleanMoney(value, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return Math.max(0, Number(fallback || 0));
  return Math.max(0, Math.round(number));
}

function toPlainObject(value) {
  if (!value || typeof value !== 'object') return value;
  if (typeof value.toObject === 'function') {
    return value.toObject({ depopulate: true, virtuals: false });
  }
  return value;
}

function toPlainArray(value) {
  if (Array.isArray(value)) return value.map(toPlainObject);

  if (value && typeof value.toObject === 'function') {
    const plain = value.toObject({ depopulate: true, virtuals: false });
    if (Array.isArray(plain)) return plain.map(toPlainObject);
  }

  if (value && typeof value[Symbol.iterator] === 'function') {
    return Array.from(value).map(toPlainObject);
  }

  return [];
}

function buildVariantKey(size = '', color = '') {
  const cleanSize = cleanLower(size, 80);
  const cleanColor = cleanLower(color, 120);
  const key = `${cleanSize}__${cleanColor}`;
  return !key || key === '__' ? 'default__default' : key;
}

function normalizeStringArray(items, max = Infinity) {
  const list = toPlainArray(items);
  if (!list.length) return [];

  const out = [];
  const seen = new Set();

  for (const item of list) {
    const value = cleanText(
      typeof item === 'string' ? item : item?.url || item?.src || item?.value || '',
      1000
    );
    if (!value) continue;

    const key = value.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    out.push(value);
    if (out.length >= max) break;
  }

  return out;
}

function normalizeAttributes(attributes = []) {
  return toPlainArray(attributes)
    .map((attribute) => {
      const attr = toPlainObject(attribute) || {};
      const key = cleanLower(attr?.key || attr?.name || '', 80);
      const label = cleanText(attr?.label || attr?.name || attr?.key || '', 120);
      const value = cleanText(attr?.value || '', 160);

      if (!key && !label && !value) return null;

      return {
        key: key || cleanLower(label, 80),
        label: label || key,
        value,
      };
    })
    .filter(Boolean);
}

function buildVariantLabel(variant = {}) {
  const plainVariant = toPlainObject(variant) || {};
  const parts = [
    cleanText(plainVariant.label, 160),
    cleanText(plainVariant.size, 80),
    cleanText(plainVariant.color, 120),
  ].filter(Boolean);

  if (parts.length) return parts[0] || parts.slice(1).join(' / ');

  const attrParts = normalizeAttributes(plainVariant.attributes)
    .map((attribute) => attribute.value || attribute.label)
    .filter(Boolean);

  return attrParts.join(' / ') || 'Variante general';
}

function normalizeVariantInput(variant = {}, product = {}) {
  const plainVariant = toPlainObject(variant) || {};
  const plainProduct = toPlainObject(product) || {};
  const size = cleanText(plainVariant.size || plainVariant.talla || plainVariant.attribute || '', 80);
  const color = cleanText(plainVariant.color || plainVariant.colour || plainVariant.visualAttribute || '', 120);
  const variantKey = cleanLower(plainVariant.variantKey || buildVariantKey(size, color), 180);
  const images = normalizeStringArray(plainVariant.images || plainVariant.gallery || [], 8);
  const image = cleanText(plainVariant.image || images[0] || '', 1000);
  const price = plainVariant.price === '' || plainVariant.price === null || plainVariant.price === undefined
    ? null
    : cleanMoney(plainVariant.price, plainProduct.price || 0);
  const cost = plainVariant.cost === '' || plainVariant.cost === null || plainVariant.cost === undefined
    ? null
    : cleanMoney(plainVariant.cost, plainProduct.cost || plainProduct.averageCost || 0);
  const originalPrice = plainVariant.originalPrice === '' || plainVariant.originalPrice === null || plainVariant.originalPrice === undefined
    ? null
    : cleanMoney(plainVariant.originalPrice, 0);
  const initialStock = cleanMoney(plainVariant.initialStock ?? plainVariant.stock ?? 0, 0);

  return {
    variantKey,
    label: cleanText(plainVariant.label || buildVariantLabel({ ...plainVariant, size, color }), 160),
    size,
    color,
    attributes: normalizeAttributes(plainVariant.attributes),
    sku: cleanUpper(plainVariant.sku || plainVariant.variantSku || '', 100),
    barcode: cleanText(plainVariant.barcode || plainVariant.variantBarcode || '', 120),
    price,
    cost,
    originalPrice,
    image,
    images,
    active: plainVariant.active !== false,
    sortOrder: Math.max(0, Math.floor(Number(plainVariant.sortOrder || 0))),
    initialStock,
  };
}

function buildVariantsFromLegacy(product = {}) {
  const plainProduct = toPlainObject(product) || {};
  const rows = [];

  const inventory = toPlainArray(plainProduct.inventory);
  inventory.forEach((row) => {
    const plainRow = toPlainObject(row) || {};
    const size = cleanText(plainRow?.size, 80);
    const color = cleanText(plainRow?.color, 120);
    if (!size && !color) return;

    rows.push({
      size,
      color,
      initialStock: cleanMoney(plainRow?.stock, 0),
      active: true,
    });
  });

  if (!rows.length) {
    const sizes = toPlainArray(plainProduct.sizes).map((size) => cleanText(size, 80)).filter(Boolean);
    const colors = toPlainArray(plainProduct.colors).map((color) => cleanText(color, 120)).filter(Boolean);

    if (sizes.length && colors.length) {
      sizes.forEach((size) => colors.forEach((color) => rows.push({ size, color, initialStock: 0, active: true })));
    } else if (sizes.length) {
      sizes.forEach((size) => rows.push({ size, color: '', initialStock: 0, active: true }));
    } else if (colors.length) {
      colors.forEach((color) => rows.push({ size: '', color, initialStock: 0, active: true }));
    }
  }

  if (!rows.length && cleanMoney(plainProduct.stock, 0) > 0) {
    rows.push({ size: '', color: '', initialStock: cleanMoney(plainProduct.stock, 0), active: true });
  }

  return rows;
}

function normalizeProductVariants(variants = [], product = {}) {
  const variantList = toPlainArray(variants);
  const source = variantList.length ? variantList : buildVariantsFromLegacy(product);
  const out = [];
  const seen = new Set();

  source.forEach((variant, index) => {
    const plainVariant = toPlainObject(variant) || {};
    const normalized = normalizeVariantInput({ ...plainVariant, sortOrder: plainVariant?.sortOrder ?? index }, product);
    const key = normalized.variantKey || buildVariantKey(normalized.size, normalized.color);
    if (seen.has(key)) return;

    seen.add(key);
    out.push({
      ...normalized,
      variantKey: key,
      label: normalized.label || buildVariantLabel(normalized),
    });
  });

  return out.sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
}

function findProductVariant(product = {}, selector = {}) {
  const plainProduct = toPlainObject(product) || {};
  const variants = normalizeProductVariants(plainProduct.variants || [], plainProduct);
  if (!variants.length) return null;

  const desiredKey = cleanLower(selector.variantKey || '', 180);
  if (desiredKey) {
    const byKey = variants.find((variant) => cleanLower(variant.variantKey, 180) === desiredKey);
    if (byKey) return byKey;
  }

  const selectorKey = buildVariantKey(selector.size || '', selector.color || '');
  return variants.find((variant) => variant.variantKey === selectorKey) || null;
}

function resolveVariantCommercialSnapshot(product = {}, selector = {}) {
  const plainProduct = toPlainObject(product) || {};
  const variant = findProductVariant(plainProduct, selector);
  const basePrice = cleanMoney(plainProduct.price, 0);
  const baseCost = cleanMoney(plainProduct.averageCost || plainProduct.cost || 0, 0);

  if (!variant) {
    return {
      variant: null,
      variantKey: buildVariantKey(selector.size || '', selector.color || ''),
      price: basePrice,
      cost: baseCost,
      sku: cleanUpper(plainProduct.sku || '', 100),
      barcode: cleanText(plainProduct.barcode || '', 120),
      image: cleanText(plainProduct.image || '', 1000),
      images: normalizeStringArray(plainProduct.images || [], 8),
    };
  }

  return {
    variant,
    variantKey: variant.variantKey,
    price: variant.price != null ? cleanMoney(variant.price, basePrice) : basePrice,
    cost: variant.cost != null ? cleanMoney(variant.cost, baseCost) : baseCost,
    sku: cleanUpper(variant.sku || plainProduct.sku || '', 100),
    barcode: cleanText(variant.barcode || plainProduct.barcode || '', 120),
    image: cleanText(variant.image || plainProduct.image || '', 1000),
    images: normalizeStringArray(
      Array.isArray(variant.images) && variant.images.length ? variant.images : plainProduct.images || [],
      8
    ),
  };
}

module.exports = {
  cleanText,
  cleanLower,
  cleanUpper,
  cleanMoney,
  buildVariantKey,
  normalizeStringArray,
  normalizeAttributes,
  normalizeProductVariants,
  findProductVariant,
  resolveVariantCommercialSnapshot,
};