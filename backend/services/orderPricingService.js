'use strict';

const mongoose = require('mongoose');

const Product = require('../models/Product');
const SiteSettings = require('../models/SiteSettings');
const couponService = require('./couponService');
const {
  buildVariantKey,
  normalizeAttributes,
  resolveVariantCommercialSnapshot,
} = require('../lib/products/productVariantConfig');
const {
  getPublicFulfillmentView,
} = require('../lib/products/productFulfillmentConfig');
const {
  assertBundlePurchasable,
} = require('./productBundleService');

const MONEY_FACTOR = 100;

function createPricingError(message, status = 400, code = 'ORDER_PRICING_ERROR', details = null) {
  const error = new Error(message);
  error.status = status;
  error.statusCode = status;
  error.code = code;
  error.details = details;
  return error;
}

function numberSafe(value, fallback = 0) {
  if (value === '' || value === null || value === undefined) return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function money(value, fallback = 0) {
  return Math.max(0, Math.round(numberSafe(value, fallback) * MONEY_FACTOR) / MONEY_FACTOR);
}

function clean(value, max = 300) {
  return String(value || '').trim().slice(0, max);
}

function normalizeText(value) {
  return clean(value, 180)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function readProductId(item = {}) {
  const raw = item.productId || item.product || item._id || item.id || '';
  if (raw && typeof raw === 'object') return clean(raw._id || raw.id, 80);
  return clean(raw, 80);
}

function readQuantity(item = {}) {
  const quantity = Number(item.quantity ?? item.qty ?? 0);
  return Number.isFinite(quantity) ? Math.max(0, Math.floor(quantity)) : 0;
}

function readVariantKey(item = {}) {
  const variantAttributes = normalizeAttributes(
    item.variantAttributes ||
      item.attributes ||
      item.selectedAttributes ||
      []
  );
  return clean(
    item.variantId ||
      item.variantKey ||
      item.selectedVariantId ||
      item.selectedVariantKey ||
      buildVariantKey(
        item.size || '',
        item.color || '',
        variantAttributes
      ),
    180
  );
}

function toStringArray(values = []) {
  const input = Array.isArray(values) ? values : [values];
  return Array.from(
    new Set(input.map((value) => clean(value, 120)).filter(Boolean))
  );
}

async function resolveAuthoritativeItems(items = [], options = {}) {
  const ProductModel = options.ProductModel || Product;
  const session = options.session || null;
  const sourceItems = Array.isArray(items) ? items : [];
  const requestedProductIds = sourceItems
    .map(readProductId)
    .filter((id) => mongoose.Types.ObjectId.isValid(id));
  const productIds = Array.from(
    new Set(requestedProductIds)
  );

  if (!productIds.length || requestedProductIds.length !== sourceItems.length) {
    throw createPricingError(
      'Uno o más productos del carrito no son válidos.',
      400,
      'INVALID_PRODUCT_ID'
    );
  }

  let query = ProductModel.find({ _id: { $in: productIds } })
    .select(
      'title price image images sku barcode category categories variants visible active archivedAt productType trackInventory allowBackorder digitalDelivery.fileName digitalDelivery.mimeType digitalDelivery.fileSizeBytes digitalDelivery.downloadLimit digitalDelivery.accessDays digitalDelivery.deliveryMode serviceDelivery.fulfillmentMode serviceDelivery.locationType serviceDelivery.durationMinutes serviceDelivery.leadTimeHours serviceDelivery.customerInstructions bundleComponents'
    );

  if (session && typeof query.session === 'function') query = query.session(session);
  const products = await query.lean();
  const productMap = new Map(products.map((product) => [String(product._id), product]));

  const resolvedItems = [];

  for (const item of sourceItems) {
    const productId = readProductId(item);
    const product = productMap.get(productId);

    if (!product || product.visible === false || product.active === false) {
      throw createPricingError(
        `El producto ${clean(item.title, 160) || productId} ya no está disponible.`,
        409,
        'PRODUCT_NOT_AVAILABLE',
        { productId }
      );
    }

    const quantity = readQuantity(item);
    if (quantity <= 0) {
      throw createPricingError(
        'La cantidad de cada producto debe ser mayor a cero.',
        400,
        'INVALID_QUANTITY',
        { productId }
      );
    }

    const variantKey = readVariantKey(item);
    const requestedVariantAttributes = normalizeAttributes(
      item.variantAttributes ||
        item.attributes ||
        item.selectedAttributes ||
        []
    );
    const commercial = resolveVariantCommercialSnapshot(product, {
      variantKey,
      size: item.size || '',
      color: item.color || '',
      variantAttributes: requestedVariantAttributes,
    });
    const unitPrice = money(commercial?.price ?? product.price, 0);

    if (unitPrice <= 0) {
      throw createPricingError(
        `El producto ${product.title || productId} no tiene un precio válido.`,
        409,
        'PRODUCT_PRICE_INVALID',
        { productId, variantKey }
      );
    }

    const categories = toStringArray([
      product.category,
      ...(Array.isArray(product.categories) ? product.categories : []),
    ]);
    let bundleComponents = [];

    if (product.productType === 'bundle') {
      bundleComponents = await assertBundlePurchasable(product, {
        session,
        ProductModel,
      });
      product.bundleComponents = bundleComponents;
    }

    const fulfillment = getPublicFulfillmentView(product);

    resolvedItems.push({
      product: product._id,
      productId,
      title: clean(product.title || item.title, 160),
      image: clean(commercial?.image || item.image || product.image, 1000),
      color: clean(item.color, 80),
      size: clean(item.size, 80),
      variantId: commercial?.variantKey || variantKey,
      variantKey: commercial?.variantKey || variantKey,
      variantLabel:
        clean(commercial?.variantLabel || item.variantLabel, 180),
      variantAttributes:
        commercial?.variantAttributes || requestedVariantAttributes,
      variantSku: clean(commercial?.sku || product.sku, 120),
      variantBarcode: clean(commercial?.barcode || product.barcode, 120),
      category: categories[0] || '',
      categories,
      productType: fulfillment.productType,
      requiresShipping: fulfillment.requiresShipping,
      fulfillmentKind: fulfillment.kind,
      fulfillmentSnapshot: fulfillment,
      quantity,
      qty: quantity,
      price: unitPrice,
      unitPrice,
      priceNumber: unitPrice,
    });
  }

  return resolvedItems;
}

function normalizeTaxConfig(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const enabled = source.enabled !== false;
  const percent = enabled
    ? Math.min(100, Math.max(0, numberSafe(source.percent, 0)))
    : 0;

  return {
    enabled: enabled && percent > 0,
    percent,
    code: clean(source.code || '01', 10) || '01',
    name: clean(source.name || 'IVA', 80) || 'IVA',
  };
}

function resolveShippingAmount({
  settings = {},
  customer = {},
  subtotal = 0,
  items = [],
} = {}) {
  const requiresShipping = (Array.isArray(items) ? items : [])
    .some((item) => item?.requiresShipping !== false);
  if (!requiresShipping) return 0;

  const deliveryType = clean(customer.deliveryType || 'envio', 30).toLowerCase();
  if (deliveryType === 'retiro') return 0;

  const shippingConfig = settings?.theme?.global?.envios;
  if (!shippingConfig || typeof shippingConfig !== 'object') return 20000;
  if (shippingConfig.active === false) return 0;

  const freeShipping = shippingConfig.freeShipping || {};
  const freeMinimum = money(freeShipping.minimum, 0);
  if (freeShipping.enabled === true && money(subtotal) >= freeMinimum) {
    return 0;
  }

  const mode = clean(shippingConfig.mode, 30).toLowerCase();
  if (mode === 'fixed') return money(shippingConfig.fixedPrice, 0);

  if (mode === 'zones') {
    const country = normalizeText(customer.country);
    const department = normalizeText(customer.departmentCode || customer.department);
    const city = normalizeText(customer.city);
    const zones = Array.isArray(shippingConfig.zones) ? shippingConfig.zones : [];

    const zone = zones.find((candidate) => {
      const zoneCountry = normalizeText(candidate?.country);
      const zoneDepartment = normalizeText(candidate?.department);
      const zoneCity = normalizeText(candidate?.city);

      if (zoneCountry && country && zoneCountry !== country) return false;
      if (zoneDepartment && department && zoneDepartment !== department) return false;
      return Boolean(zoneCity && city && zoneCity === city);
    });

    if (zone) return money(zone.price, 0);
    return money(shippingConfig?.fallback?.price, 0);
  }

  return 20000;
}

function allocateDiscount(lines, targetDiscount, coupon = null) {
  const targetCents = Math.round(money(targetDiscount) * MONEY_FACTOR);
  if (targetCents <= 0) return lines.map(() => 0);

  const eligibleIndexes = [];
  let eligibleCents = 0;

  lines.forEach((line, index) => {
    if (!coupon || couponService.isItemEligibleForCoupon(coupon, line.item)) {
      const lineCents = Math.round(line.lineSubtotal * MONEY_FACTOR);
      if (lineCents > 0) {
        eligibleIndexes.push(index);
        eligibleCents += lineCents;
      }
    }
  });

  if (!eligibleIndexes.length || eligibleCents <= 0) return lines.map(() => 0);

  const allocations = lines.map(() => 0);
  let remainingCents = Math.min(targetCents, eligibleCents);

  eligibleIndexes.forEach((lineIndex, eligiblePosition) => {
    const lineCents = Math.round(lines[lineIndex].lineSubtotal * MONEY_FACTOR);
    const isLast = eligiblePosition === eligibleIndexes.length - 1;
    const allocatedCents = isLast
      ? Math.min(lineCents, remainingCents)
      : Math.min(
          lineCents,
          Math.round((Math.min(targetCents, eligibleCents) * lineCents) / eligibleCents)
        );

    allocations[lineIndex] = allocatedCents / MONEY_FACTOR;
    remainingCents -= allocatedCents;
  });

  if (remainingCents > 0) {
    for (const lineIndex of eligibleIndexes) {
      if (remainingCents <= 0) break;
      const lineCents = Math.round(lines[lineIndex].lineSubtotal * MONEY_FACTOR);
      const allocatedCents = Math.round(allocations[lineIndex] * MONEY_FACTOR);
      const capacity = Math.max(0, lineCents - allocatedCents);
      const extra = Math.min(capacity, remainingCents);
      allocations[lineIndex] = (allocatedCents + extra) / MONEY_FACTOR;
      remainingCents -= extra;
    }
  }

  return allocations.map((value) => money(value));
}

function calculateOrderPricing({
  items = [],
  originalShipping = 0,
  taxConfig = {},
  couponValidation = null,
} = {}) {
  const tax = normalizeTaxConfig(taxConfig);
  const coupon = couponValidation?.valid ? couponValidation.coupon || null : null;
  const requestedDiscount = couponValidation?.valid
    ? money(couponValidation?.discount?.discountAmount, 0)
    : 0;
  const requestedShippingDiscount = couponValidation?.valid
    ? money(couponValidation?.discount?.shippingDiscountAmount, 0)
    : 0;

  const baseLines = (Array.isArray(items) ? items : []).map((item) => {
    const quantity = readQuantity(item);
    const unitPrice = money(item.price ?? item.unitPrice ?? item.priceNumber, 0);
    return {
      item,
      quantity,
      unitPrice,
      lineSubtotal: money(quantity * unitPrice),
    };
  });

  const allocations = allocateDiscount(baseLines, requestedDiscount, coupon);
  const pricedItems = baseLines.map((line, index) => {
    const discountAmount = money(Math.min(line.lineSubtotal, allocations[index] || 0));
    const taxableBase = money(line.lineSubtotal - discountAmount);
    const taxAmount = tax.enabled ? money((taxableBase * tax.percent) / 100) : 0;
    const discountRate = line.lineSubtotal > 0
      ? Math.min(100, (discountAmount * 100) / line.lineSubtotal)
      : 0;

    return {
      ...line.item,
      quantity: line.quantity,
      qty: line.quantity,
      price: line.unitPrice,
      unitPrice: line.unitPrice,
      priceNumber: line.unitPrice,
      lineSubtotal: line.lineSubtotal,
      discountAmount,
      discountRate: Math.round(discountRate * 100000000) / 100000000,
      taxableBase,
      taxRate: tax.percent,
      taxAmount,
      lineTotal: money(taxableBase + taxAmount),
    };
  });

  const subtotal = money(pricedItems.reduce((sum, item) => sum + item.lineSubtotal, 0));
  const productDiscount = money(pricedItems.reduce((sum, item) => sum + item.discountAmount, 0));
  const subtotalAfterDiscount = money(subtotal - productDiscount);
  const taxAmount = money(pricedItems.reduce((sum, item) => sum + item.taxAmount, 0));
  const safeOriginalShipping = money(originalShipping, 0);
  const shippingDiscount = money(
    Math.min(safeOriginalShipping, requestedShippingDiscount)
  );
  const finalShipping = money(safeOriginalShipping - shippingDiscount);
  const totalDiscount = money(productDiscount + shippingDiscount);
  const total = money(subtotalAfterDiscount + taxAmount + finalShipping);

  return {
    version: 2,
    currency: 'COP',
    items: pricedItems,
    subtotal,
    productDiscount,
    subtotalAfterDiscount,
    originalShipping: safeOriginalShipping,
    shippingDiscount,
    shipping: finalShipping,
    totalDiscount,
    tax: {
      ...tax,
      taxableBase: subtotalAfterDiscount,
      amount: taxAmount,
    },
    total,
  };
}

async function buildOrderQuote(input = {}, options = {}) {
  const session = options.session || null;
  let settings = options.settings || null;

  if (!settings) {
    let settingsQuery = (options.SiteSettingsModel || SiteSettings).findOne();
    if (session && typeof settingsQuery.session === 'function') settingsQuery = settingsQuery.session(session);
    settings = await settingsQuery.lean();
  }

  const items = await resolveAuthoritativeItems(input.items || input.cart || [], {
    ProductModel: options.ProductModel || Product,
    session,
  });
  const subtotal = money(
    items.reduce((sum, item) => sum + item.quantity * item.price, 0)
  );
  const customer = input.customer || {};
  const originalShipping = resolveShippingAmount({
    settings,
    customer,
    subtotal,
    items,
  });
  const couponCode = couponService.normalizeCode(
    input.couponCode || input?.coupon?.code || input.discountCode || ''
  );

  let couponValidation = null;
  if (couponCode) {
    couponValidation = await couponService.validateCoupon(
      {
        code: couponCode,
        subtotal,
        shippingAmount: originalShipping,
        items,
        customerId: input.customerId,
        customerEmail:
          input.customerEmail ||
          input?.billing?.email ||
          customer.email ||
          customer.emailOrPhone ||
          '',
        sessionId: input.sessionId,
      },
      { session }
    );
  }

  const pricing = calculateOrderPricing({
    items,
    originalShipping,
    taxConfig: settings?.billing?.taxes?.iva || {},
    couponValidation,
  });

  return {
    settings,
    couponCode,
    couponValidation,
    pricing,
  };
}

module.exports = {
  createPricingError,
  money,
  normalizeTaxConfig,
  resolveAuthoritativeItems,
  resolveShippingAmount,
  allocateDiscount,
  calculateOrderPricing,
  buildOrderQuote,
};
