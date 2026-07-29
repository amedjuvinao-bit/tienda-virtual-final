// backend/lib/products/productUniversalConfig.js

const PRODUCT_TYPES = Object.freeze({
  PHYSICAL: 'physical',
  DIGITAL: 'digital',
  SERVICE: 'service',
  BUNDLE: 'bundle',
  CUSTOM: 'custom',
});

const PRODUCT_TYPE_VALUES = Object.freeze(Object.values(PRODUCT_TYPES));

const UNIT_OF_MEASURE_VALUES = Object.freeze([
  'unit',
  'kg',
  'g',
  'lb',
  'l',
  'ml',
  'm',
  'cm',
  'package',
  'box',
  'hour',
  'service',
  'license',
]);

const VARIANT_PRESETS = Object.freeze({
  none: {
    label: 'Sin variantes',
    axes: [],
  },
  fashion: {
    label: 'Moda / ropa',
    axes: ['Talla', 'Color'],
  },
  footwear: {
    label: 'Calzado',
    axes: ['Talla', 'Color'],
  },
  beauty: {
    label: 'Belleza / cosmética',
    axes: ['Tono', 'Presentación'],
  },
  food: {
    label: 'Alimentos',
    axes: ['Sabor', 'Presentación'],
  },
  tech: {
    label: 'Tecnología',
    axes: ['Capacidad', 'Color'],
  },
  home: {
    label: 'Hogar',
    axes: ['Medida', 'Color'],
  },
  parts: {
    label: 'Repuestos',
    axes: ['Referencia', 'Compatibilidad'],
  },
  custom: {
    label: 'Personalizado',
    axes: [],
  },
});

function cleanText(value, fallback = '') {
  const text = String(value || '').trim().replace(/\s+/g, ' ');
  return text || fallback;
}

function cleanLower(value, fallback = '') {
  return cleanText(value, fallback).toLowerCase();
}

function normalizeProductType(value) {
  const type = cleanLower(value, PRODUCT_TYPES.PHYSICAL);
  return PRODUCT_TYPE_VALUES.includes(type) ? type : PRODUCT_TYPES.PHYSICAL;
}

function normalizeUnitOfMeasure(value) {
  const unit = cleanLower(value, 'unit');
  return UNIT_OF_MEASURE_VALUES.includes(unit) ? unit : 'unit';
}

function normalizeVariantPreset(value) {
  const preset = cleanLower(value, 'none');
  return Object.prototype.hasOwnProperty.call(VARIANT_PRESETS, preset)
    ? preset
    : 'none';
}

function normalizeVariantAxes(input, fallbackPreset = 'none') {
  const preset = normalizeVariantPreset(fallbackPreset);
  const fallbackAxes = VARIANT_PRESETS[preset]?.axes || [];
  const source = Array.isArray(input) && input.length ? input : fallbackAxes;

  const axes = [];
  const seen = new Set();

  for (const item of source) {
    const label = typeof item === 'string' ? item : item?.label || item?.name || '';
    const cleanLabel = cleanText(label).slice(0, 40);
    if (!cleanLabel) continue;

    const key = cleanLabel.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    axes.push({
      key,
      label: cleanLabel,
      values: Array.isArray(item?.values)
        ? item.values
            .map((value) => cleanText(value).slice(0, 80))
            .filter(Boolean)
            .slice(0, 80)
        : [],
    });

    if (axes.length >= 4) break;
  }

  return axes;
}

function shouldTrackInventory(productType, explicitValue) {
  const type = normalizeProductType(productType);

  // Digitales, servicios y combos compuestos no manejan una existencia
  // propia. En los combos se reservan sus componentes físicos.
  if (
    type === PRODUCT_TYPES.DIGITAL ||
    type === PRODUCT_TYPES.SERVICE ||
    type === PRODUCT_TYPES.BUNDLE
  ) {
    return false;
  }

  if (typeof explicitValue === 'boolean') return explicitValue;

  return type === PRODUCT_TYPES.PHYSICAL || type === PRODUCT_TYPES.CUSTOM;
}

function buildSkuPrefix(value) {
  const normalized = cleanText(value, 'OT')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .trim()
    .toUpperCase();

  if (!normalized) return 'OT';

  const words = normalized.split(/\s+/).filter(Boolean);
  const fromWords = words
    .slice(0, 3)
    .map((word) => word[0])
    .join('');

  const prefix = (fromWords || normalized.slice(0, 3) || 'OT').slice(0, 3);
  return prefix.padEnd(2, 'X');
}

module.exports = {
  PRODUCT_TYPES,
  PRODUCT_TYPE_VALUES,
  UNIT_OF_MEASURE_VALUES,
  VARIANT_PRESETS,
  normalizeProductType,
  normalizeUnitOfMeasure,
  normalizeVariantPreset,
  normalizeVariantAxes,
  shouldTrackInventory,
  buildSkuPrefix,
};
