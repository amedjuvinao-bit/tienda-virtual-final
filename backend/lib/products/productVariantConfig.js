// backend/lib/products/productVariantConfig.js

const {
  assertVariantIdentity,
  buildVariantKey,
  canonicalizeVariantKey,
  normalizeVariantKey,
  parseVariantKey,
  resolveVariantIdentity,
} = require('../../../shared/variantKeyAuthority.cjs');

function cleanText(value, max = 300) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function cleanLower(value, max = 300) {
  return cleanText(value, max).toLowerCase();
}

function cleanUpper(value, max = 300) {
  return cleanText(value, max).toUpperCase();
}

function normalizeAttributeKey(value) {
  return cleanText(value, 80)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
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

function isHexColor(value) {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(value || '').trim());
}

function normalizeHexColor(value) {
  const raw = String(value || '').trim();
  if (!isHexColor(raw)) return '';
  if (raw.length === 4) return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`.toLowerCase();
  return raw.toLowerCase();
}

function hexToRgb(value) {
  const hex = normalizeHexColor(value).replace('#', '');
  if (!hex) return null;
  const int = Number.parseInt(hex, 16);
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
}

function rgbToHsl({ r, g, b }) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return { h: h * 60, s, l };
}

const NAMED_COLOR_LABELS = {
  black: 'Negro',
  white: 'Blanco',
  red: 'Rojo',
  blue: 'Azul',
  yellow: 'Amarillo',
  green: 'Verde',
  pink: 'Rosado',
  hotpink: 'Fucsia',
  fuchsia: 'Fucsia',
  crimson: 'Rojo intenso',
  salmon: 'Salmón',
  skyblue: 'Celeste',
  royalblue: 'Azul rey',
  navy: 'Azul marino',
  teal: 'Verde azulado',
  turquoise: 'Turquesa',
  seagreen: 'Verde mar',
  limegreen: 'Verde lima',
  olive: 'Oliva',
  khaki: 'Caqui',
  coral: 'Coral',
  chocolate: 'Chocolate',
  sienna: 'Marrón',
  gray: 'Gris',
  grey: 'Gris',
  lightgray: 'Gris claro',
  gold: 'Dorado',
  purple: 'Morado',
  lilac: 'Lila',
  beige: 'Beige',
  brown: 'Café',
  orange: 'Naranja',
};

const HEX_COLOR_LABELS = {
  '#000000': 'Negro',
  '#ffffff': 'Blanco',
  '#ff0000': 'Rojo',
  '#0000ff': 'Azul',
  '#ffff00': 'Amarillo',
  '#008000': 'Verde',
  '#ffc0cb': 'Rosado',
  '#ff69b4': 'Fucsia',
  '#d4af37': 'Dorado',
  '#f5f5dc': 'Beige',
  '#a52a2a': 'Café',
  '#ffa500': 'Naranja',
  '#808080': 'Gris',
  '#87ceeb': 'Celeste',
  '#ffcdd2': 'Rosado claro',
  '#f8bbd0': 'Rosa suave',
  '#e1bee7': 'Lila claro',
  '#d1c4e9': 'Lavanda',
  '#c5cae9': 'Azul lavanda',
  '#bbdefb': 'Azul claro',
  '#b2ebf2': 'Celeste claro',
  '#b2dfdb': 'Turquesa claro',
  '#c8e6c9': 'Verde claro',
  '#dcedc8': 'Verde pastel',
  '#fff9c4': 'Amarillo claro',
  '#ffe0b2': 'Durazno claro',
  '#ffccbc': 'Salmón claro',
  '#d7ccc8': 'Arena',
  '#f48fb1': 'Rosado intenso',
  '#ce93d8': 'Morado claro',
  '#9fa8da': 'Azul violeta',
  '#90caf9': 'Azul cielo',
  '#80deea': 'Celeste',
  '#80cbc4': 'Turquesa',
  '#a5d6a7': 'Verde menta',
  '#e6ee9c': 'Lima claro',
  '#ffe082': 'Amarillo dorado',
  '#ffab91': 'Coral claro',
};

function approximateColorName(value) {
  const rgb = hexToRgb(value);
  if (!rgb) return '';
  const { h, s, l } = rgbToHsl(rgb);
  if (l <= 0.12) return 'Negro';
  if (l >= 0.92 && s <= 0.16) return 'Blanco';
  if (s <= 0.12) return l < 0.55 ? 'Gris oscuro' : 'Gris claro';
  const tone = l >= 0.78 ? ' claro' : l <= 0.32 ? ' oscuro' : '';
  if (h < 15 || h >= 345) return `Rojo${tone}`;
  if (h < 35) return `Naranja${tone}`;
  if (h < 55) return `Dorado${tone}`;
  if (h < 70) return `Amarillo${tone}`;
  if (h < 155) return `Verde${tone}`;
  if (h < 185) return `Turquesa${tone}`;
  if (h < 210) return `Celeste${tone}`;
  if (h < 250) return `Azul${tone}`;
  if (h < 285) return `Morado${tone}`;
  if (h < 325) return `Rosado${tone}`;
  return `Fucsia${tone}`;
}

function getColorDisplayName(value) {
  const raw = cleanText(value, 120);
  if (!raw) return '';
  const lower = raw.toLowerCase();
  if (NAMED_COLOR_LABELS[lower]) return NAMED_COLOR_LABELS[lower];
  const hex = normalizeHexColor(raw);
  if (hex) return HEX_COLOR_LABELS[hex] || approximateColorName(hex) || 'Color personalizado';
  return raw.charAt(0).toUpperCase() + raw.slice(1);
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
  const out = [];
  const seen = new Set();

  for (const attribute of toPlainArray(attributes)) {
    const attr = toPlainObject(attribute) || {};
    const label = cleanText(
      attr?.label || attr?.name || attr?.key || '',
      120
    );
    const key = normalizeAttributeKey(
      attr?.key || attr?.name || label
    );
    const value = cleanText(attr?.value || '', 160);

    if (!key || !value || seen.has(key)) continue;

    seen.add(key);
    out.push({
      key,
      label: label || key,
      value,
    });

    if (out.length >= 4) break;
  }

  return out;
}

function findAttributeValue(attributes = [], aliases = []) {
  const aliasSet = new Set(aliases.map(normalizeAttributeKey));
  const match = normalizeAttributes(attributes).find((attribute) =>
    aliasSet.has(attribute.key)
  );
  return cleanText(match?.value || '', 160);
}

function buildVariantLabel(variant = {}) {
  const plainVariant = toPlainObject(variant) || {};
  const attributes = normalizeAttributes(plainVariant.attributes);
  const size = cleanText(plainVariant.size, 80);
  const colorLabel = getColorDisplayName(plainVariant.color);

  const label = cleanText(plainVariant.label, 160).replace(
    /#(?:[0-9a-f]{6}|[0-9a-f]{3})(?![0-9a-f])/gi,
    (value) => getColorDisplayName(value)
  );
  if (label && label !== 'Variante general') return label;

  if (attributes.length) {
    return (
      attributes
        .map((attribute) =>
          attribute.key === 'color'
            ? getColorDisplayName(attribute.value)
            : attribute.value
        )
        .filter(Boolean)
        .join(' / ') || 'Variante general'
    );
  }

  const parts = [size, colorLabel].filter(Boolean);
  if (parts.length) return parts.join(' / ');

  return 'Variante general';
}

function normalizeVariantInput(variant = {}, product = {}) {
  const plainVariant = toPlainObject(variant) || {};
  const plainProduct = toPlainObject(product) || {};
  const attributes = normalizeAttributes(plainVariant.attributes);
  const colorFromAttributes = findAttributeValue(attributes, [
    'color',
    'colour',
    'tono',
  ]);
  const firstNonColorAttribute = attributes.find(
    (attribute) => !['color', 'colour', 'tono'].includes(attribute.key)
  );
  const size = cleanText(
    plainVariant.size ||
      plainVariant.talla ||
      plainVariant.attribute ||
      firstNonColorAttribute?.value ||
      '',
    80
  );
  const color = cleanText(
    plainVariant.color ||
      plainVariant.colour ||
      plainVariant.visualAttribute ||
      colorFromAttributes ||
      '',
    120
  );
  const identity = resolveVariantIdentity({
    variantKey: plainVariant.variantKey,
    size,
    color,
    attributes,
  });
  const variantKey = identity.variantKey;
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
    label: buildVariantLabel({
      ...plainVariant,
      size: identity.size,
      color: identity.color,
      attributes: identity.attributes,
    }),
    size: identity.size,
    color: identity.color,
    attributes: identity.attributes,
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
    const key = normalized.variantKey;
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
  const variants = normalizeProductVariants(
    plainProduct.variants || [],
    plainProduct
  ).filter((variant) => variant.active !== false);
  if (!variants.length) return null;

  const selectorIdentity = resolveVariantIdentity({
    variantKey: selector.variantKey,
    size: selector.size,
    color: selector.color,
    attributes: selector.attributes || selector.variantAttributes || [],
  });
  const desiredKey = selector.variantKey
    ? selectorIdentity.variantKey
    : '';
  if (desiredKey) {
    const byKey = variants.find((variant) => cleanLower(variant.variantKey, 180) === desiredKey);
    if (byKey) return byKey;
  }

  const selectorKey = buildVariantKey(
    selectorIdentity.size,
    selectorIdentity.color
  );
  const dynamicSelectorKey = selectorIdentity.variantKey;
  const byAttributes = variants.find(
    (variant) => variant.variantKey === dynamicSelectorKey
  );
  if (byAttributes) return byAttributes;

  return variants.find((variant) => variant.variantKey === selectorKey) || null;
}

function resolveVariantCommercialSnapshot(product = {}, selector = {}) {
  const plainProduct = toPlainObject(product) || {};
  const variant = findProductVariant(plainProduct, selector);
  const basePrice = cleanMoney(plainProduct.price, 0);
  const baseCost = cleanMoney(plainProduct.averageCost || plainProduct.cost || 0, 0);

  if (!variant) {
    const selectorIdentity = resolveVariantIdentity({
      variantKey: selector.variantKey,
      size: selector.size,
      color: selector.color,
      attributes: selector.attributes || selector.variantAttributes || [],
    });

    return {
      variant: null,
      variantKey: selectorIdentity.variantKey,
      variantLabel: '',
      variantAttributes: normalizeAttributes(
        selector.attributes || selector.variantAttributes || []
      ),
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
    variantLabel: variant.label,
    variantAttributes: normalizeAttributes(variant.attributes),
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
  normalizeAttributeKey,
  buildVariantKey,
  canonicalizeVariantKey,
  normalizeVariantKey,
  parseVariantKey,
  resolveVariantIdentity,
  assertVariantIdentity,
  getColorDisplayName,
  normalizeStringArray,
  normalizeAttributes,
  buildVariantLabel,
  normalizeProductVariants,
  findProductVariant,
  resolveVariantCommercialSnapshot,
};
