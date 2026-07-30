'use strict';

const {
  normalizeAttributes,
} = require('./productVariantConfig');

const DIGITAL_DELIVERY_MODES = Object.freeze([
  'automatic',
  'manual',
]);

const SERVICE_FULFILLMENT_MODES = Object.freeze([
  'scheduled',
  'manual',
]);

const SERVICE_LOCATION_TYPES = Object.freeze([
  'online',
  'store',
  'customer',
]);

function cleanText(value, maximum = 500) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, maximum);
}

function cleanMultiline(value, maximum = 2000) {
  return String(value || '')
    .trim()
    .replace(/\r\n/g, '\n')
    .slice(0, maximum);
}

function cleanUrl(value, maximum = 2000) {
  const text = cleanText(value, maximum);
  if (!text) return '';

  try {
    const parsed = new URL(text);
    return ['http:', 'https:'].includes(parsed.protocol)
      ? parsed.toString()
      : '';
  } catch {
    return '';
  }
}

function clampInteger(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

function normalizeDigitalDelivery(value = {}) {
  const source =
    value && typeof value === 'object' && !Array.isArray(value)
      ? value
      : {};
  const deliveryMode = cleanText(source.deliveryMode, 20).toLowerCase();

  return {
    deliveryMode: DIGITAL_DELIVERY_MODES.includes(deliveryMode)
      ? deliveryMode
      : 'manual',
    assetUrl: cleanUrl(source.assetUrl),
    fileName: cleanText(source.fileName, 240),
    mimeType: cleanText(source.mimeType, 120).toLowerCase(),
    fileSizeBytes: Math.max(
      0,
      Math.floor(Number(source.fileSizeBytes || 0))
    ),
    downloadLimit: clampInteger(
      source.downloadLimit,
      3,
      1,
      100
    ),
    accessDays: clampInteger(source.accessDays, 30, 1, 3650),
    customerMessage: cleanMultiline(source.customerMessage, 2000),
  };
}

function normalizeServiceDelivery(value = {}) {
  const source =
    value && typeof value === 'object' && !Array.isArray(value)
      ? value
      : {};
  const fulfillmentMode = cleanText(
    source.fulfillmentMode,
    30
  ).toLowerCase();
  const locationType = cleanText(
    source.locationType,
    30
  ).toLowerCase();

  return {
    fulfillmentMode: SERVICE_FULFILLMENT_MODES.includes(
      fulfillmentMode
    )
      ? fulfillmentMode
      : 'manual',
    locationType: SERVICE_LOCATION_TYPES.includes(locationType)
      ? locationType
      : 'online',
    durationMinutes: clampInteger(
      source.durationMinutes,
      60,
      5,
      10080
    ),
    leadTimeHours: clampInteger(
      source.leadTimeHours,
      0,
      0,
      8760
    ),
    bookingUrl: cleanUrl(source.bookingUrl),
    customerInstructions: cleanMultiline(
      source.customerInstructions,
      2000
    ),
    internalInstructions: cleanMultiline(
      source.internalInstructions,
      2000
    ),
  };
}

function normalizeBundleComponents(values = [], maximum = 30) {
  if (!Array.isArray(values)) return [];

  const components = [];

  for (const value of values) {
    if (!value || typeof value !== 'object') continue;

    const product = cleanText(
      value.product || value.productId || value._id,
      80
    );
    const variantKey =
      cleanText(value.variantKey || 'default__default', 180)
        .toLowerCase() || 'default__default';
    if (!product) continue;

    components.push({
      product,
      variantKey,
      quantity: clampInteger(value.quantity, 1, 1, 9999),
      title: cleanText(value.title, 220),
      sku: cleanText(value.sku, 120).toUpperCase(),
      image: cleanText(value.image, 1000),
      productType: cleanText(value.productType, 30).toLowerCase(),
      size: cleanText(value.size, 80),
      color: cleanText(value.color, 120),
      variantLabel: cleanText(value.variantLabel, 180),
      variantAttributes: normalizeAttributes(
        value.variantAttributes || value.attributes || []
      ),
      trackInventory: value.trackInventory !== false,
      allowBackorder: value.allowBackorder === true,
      requiresShipping: value.requiresShipping !== false,
    });

    if (components.length >= maximum) break;
  }

  return components;
}

function productRequiresShipping(product = {}) {
  const productType = cleanText(
    product.productType || 'physical',
    30
  ).toLowerCase();

  if (productType === 'digital' || productType === 'service') {
    return false;
  }

  if (productType === 'bundle') {
    const components = Array.isArray(product.bundleComponents)
      ? product.bundleComponents
      : [];
    return components.some(
      (component) => component?.requiresShipping !== false
    );
  }

  return true;
}

function getPublicFulfillmentView(product = {}) {
  const productType = cleanText(
    product.productType || 'physical',
    30
  ).toLowerCase();
  const requiresShipping = productRequiresShipping(product);

  if (productType === 'digital') {
    const digital = normalizeDigitalDelivery(
      product.digitalDelivery
    );
    return {
      productType,
      requiresShipping,
      kind: 'digital_delivery',
      digital: {
        deliveryMode: digital.deliveryMode,
        fileName: digital.fileName,
        mimeType: digital.mimeType,
        fileSizeBytes: digital.fileSizeBytes,
        downloadLimit: digital.downloadLimit,
        accessDays: digital.accessDays,
      },
    };
  }

  if (productType === 'service') {
    const service = normalizeServiceDelivery(
      product.serviceDelivery
    );
    return {
      productType,
      requiresShipping,
      kind: 'service',
      service: {
        fulfillmentMode: service.fulfillmentMode,
        locationType: service.locationType,
        durationMinutes: service.durationMinutes,
        leadTimeHours: service.leadTimeHours,
        customerInstructions: service.customerInstructions,
      },
    };
  }

  if (productType === 'bundle') {
    return {
      productType,
      requiresShipping,
      kind: 'bundle',
      bundle: {
        components: normalizeBundleComponents(
          product.bundleComponents
        ).map((component) => ({
          product: component.product,
          title: component.title,
          sku: component.sku,
          image: component.image,
          productType: component.productType,
          variantKey: component.variantKey,
          variantLabel: component.variantLabel,
          quantity: component.quantity,
        })),
      },
    };
  }

  return {
    productType,
    requiresShipping,
    kind: requiresShipping ? 'shipment' : 'manual',
  };
}

module.exports = {
  DIGITAL_DELIVERY_MODES,
  SERVICE_FULFILLMENT_MODES,
  SERVICE_LOCATION_TYPES,
  cleanText,
  cleanMultiline,
  cleanUrl,
  clampInteger,
  normalizeDigitalDelivery,
  normalizeServiceDelivery,
  normalizeBundleComponents,
  productRequiresShipping,
  getPublicFulfillmentView,
};
