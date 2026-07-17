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

function buildVariantKey(size = '', color = '') {
  const cleanSize = cleanLower(size, 80);
  const cleanColor = cleanLower(color, 120);
  const key = `${cleanSize}__${cleanColor}`;
  return !key || key === '__' ? 'default__default' : key;
}

function normalizeStringArray(items, max = Infinity) {
  if (!Array.isArray(items)) return [];

  const out = [];
  const seen = new Set();

  for (const item of items) {
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
  if (!Array.isArray(attributes)) return [];

  return attributes
    .map((attribute) => {
      const key = cleanLower(attribute?.key || attribute?.name || '', 80);
      const label = cleanText(attribute?.label || attribute?.name || attribute?.key || '', 120);
      const value = cleanText(attribute?.value || '', 160);

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
  const parts = [
    cleanText(variant.label, 160),
    cleanText(variant.size, 80),
    cleanText(variant.color, 120),
  ].filter(Boolean);

  if (parts.length) return parts[0] || parts.slice(1).join(' / ');

  const attrParts = normalizeAttributes(variant.attributes)
    .map((attribute) => attribute.value || attribute.label)
    .filter(Boolean);

  return attrParts.join(' / ') || 'Variante general';
}

function normalizeVariantInput(variant = {}, product = {}) {
  const size = cleanText(variant.size || variant.talla || variant.attribute || '', 80);
  const color = cleanText(variant.color || variant.colour || variant.visualAttribute || '', 120);
  const variantKey = cleanLower(variant.variantKey || buildVariantKey(size, color), 180);
  const images = normalizeStringArray(variant.images || variant.gallery || [], 8);
  const image = cleanText(variant.image || images[0] || '', 1000);
  const price = variant.price === '' || variant.price === null || variant.price === undefined
    ? null
    : cleanMoney(variant.price, product.price || 0);
  const cost = variant.cost === '' || variant.cost === null || variant.cost === undefined
    ? null
    : cleanMoney(variant.cost, product.cost || product.averageCost || 0);
  const originalPrice = variant.originalPrice === '' || variant.originalPrice === null || variant.originalPrice === undefined
    ? null
    : cleanMoney(variant.originalPrice, 0);
  const initialStock = cleanMoney(variant.initialStock ?? variant.stock ?? 0, 0);

  return {
    variantKey,
    label: cleanText(variant.label || buildVariantLabel({ ...variant, size, color }), 160),
    size,
    color,
    attributes: normalizeAttributes(variant.attributes),
    sku: cleanUpper(variant.sku || variant.variantSku || '', 100),
    barcode: cleanText(variant.barcode || variant.variantBarcode || '', 120),
    price,
    cost,
    originalPrice,
    image,
    images,
    active: variant.active !== false,
    sortOrder: Math.max(0, Math.floor(Number(variant.sortOrder || 0))),
    initialStock,
  };
}

function buildVariantsFromLegacy(product = {}) {
  const rows = [];

  const inventory = Array.isArray(product.inventory) ? product.inventory : [];
  inventory.forEach((row) => {
    const size = cleanText(row?.size, 80);
    const color = cleanText(row?.color, 120);
    if (!size && !color) return;

    rows.push({
      size,
      color,
      initialStock: cleanMoney(row?.stock, 0),
      active: true,
    });
  });

  if (!rows.length) {
    const sizes = Array.isArray(product.sizes) ? product.sizes.map((size) => cleanText(size, 80)).filter(Boolean) : [];
    const colors = Array.isArray(product.colors) ? product.colors.map((color) => cleanText(color, 120)).filter(Boolean) : [];

    if (sizes.length && colors.length) {
      sizes.forEach((size) => colors.forEach((color) => rows.push({ size, color, initialStock: 0, active: true })));
    } else if (sizes.length) {
      sizes.forEach((size) => rows.push({ size, color: '', initialStock: 0, active: true }));
    } else if (colors.length) {
      colors.forEach((color) => rows.push({ size: '', color, initialStock: 0, active: true }));
    }
  }

  if (!rows.length && cleanMoney(product.stock, 0) > 0) {
    rows.push({ size: '', color: '', initialStock: cleanMoney(product.stock, 0), active: true });
  }

  return rows;
}

function normalizeProductVariants(variants = [], product = {}) {
  const source = Array.isArray(variants) && variants.length ? variants : buildVariantsFromLegacy(product);
  const out = [];
  const seen = new Set();

  source.forEach((variant, index) => {
    const normalized = normalizeVariantInput({ ...variant, sortOrder: variant?.sortOrder ?? index }, product);
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
  const variants = normalizeProductVariants(product.variants || [], product);
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
  const variant = findProductVariant(product, selector);
  const basePrice = cleanMoney(product.price, 0);
  const baseCost = cleanMoney(product.averageCost || product.cost || 0, 0);

  if (!variant) {
    return {
      variant: null,
      variantKey: buildVariantKey(selector.size || '', selector.color || ''),
      price: basePrice,
      cost: baseCost,
      sku: cleanUpper(product.sku || '', 100),
      barcode: cleanText(product.barcode || '', 120),
      image: cleanText(product.image || '', 1000),
      images: normalizeStringArray(product.images || [], 8),
    };
  }

  return {
    variant,
    variantKey: variant.variantKey,
    price: variant.price != null ? cleanMoney(variant.price, basePrice) : basePrice,
    cost: variant.cost != null ? cleanMoney(variant.cost, baseCost) : baseCost,
    sku: cleanUpper(variant.sku || product.sku || '', 100),
    barcode: cleanText(variant.barcode || product.barcode || '', 120),
    image: cleanText(variant.image || product.image || '', 1000),
    images: normalizeStringArray(
      Array.isArray(variant.images) && variant.images.length ? variant.images : product.images || [],
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
