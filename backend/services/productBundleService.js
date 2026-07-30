'use strict';

const mongoose = require('mongoose');

const Product = require('../models/Product');
const InventoryStock = require('../models/InventoryStock');
const {
  buildVariantKey,
  resolveVariantCommercialSnapshot,
} = require('../lib/products/productVariantConfig');
const {
  normalizeBundleComponents,
  productRequiresShipping,
} = require('../lib/products/productFulfillmentConfig');

class ProductFulfillmentInputError extends Error {
  constructor(message, status = 400, code = 'PRODUCT_FULFILLMENT_INVALID') {
    super(message);
    this.name = 'ProductFulfillmentInputError';
    this.status = status;
    this.statusCode = status;
    this.code = code;
  }
}

function clean(value) {
  return String(value || '').trim();
}

function getReferenceId(value) {
  if (!value) return '';
  if (typeof value === 'object') {
    return clean(value._id || value.id || value.product);
  }
  return clean(value);
}

function getActiveVariants(product = {}) {
  return (Array.isArray(product.variants) ? product.variants : [])
    .filter((variant) => variant?.active !== false);
}

function findVariant(product, requestedVariantKey) {
  const variants = getActiveVariants(product);
  const requested = clean(requestedVariantKey).toLowerCase();

  if (!variants.length) {
    return {
      variantKey: 'default__default',
      size: '',
      color: '',
      label: 'Presentación general',
      sku: product.sku || '',
      image: product.image || '',
    };
  }

  if (!requested || requested === 'default__default') {
    if (variants.length > 1) {
      throw new ProductFulfillmentInputError(
        `Selecciona una variante para ${product.title}.`,
        400,
        'BUNDLE_COMPONENT_VARIANT_REQUIRED'
      );
    }
    return variants[0];
  }

  const match = variants.find((variant) => {
    const key = clean(
      variant.variantKey ||
        buildVariantKey(
          variant.size,
          variant.color,
          variant.attributes
        )
    ).toLowerCase();
    return key === requested;
  });

  if (!match) {
    throw new ProductFulfillmentInputError(
      `La variante seleccionada de ${product.title} no está disponible.`,
      409,
      'BUNDLE_COMPONENT_VARIANT_UNAVAILABLE'
    );
  }

  return match;
}

async function resolveBundleComponents(
  values,
  {
    excludeProductId = '',
    session = null,
    ProductModel = Product,
  } = {}
) {
  const requested = normalizeBundleComponents(values);

  if (!requested.length) {
    throw new ProductFulfillmentInputError(
      'Un combo debe incluir al menos un producto.',
      400,
      'BUNDLE_COMPONENTS_REQUIRED'
    );
  }

  const invalid = requested.find(
    (component) =>
      !mongoose.Types.ObjectId.isValid(component.product)
  );

  if (invalid) {
    throw new ProductFulfillmentInputError(
      'Uno de los productos del combo no tiene un ID válido.',
      400,
      'BUNDLE_COMPONENT_ID_INVALID'
    );
  }

  const excluded = clean(excludeProductId);
  if (
    excluded &&
    requested.some(
      (component) => component.product === excluded
    )
  ) {
    throw new ProductFulfillmentInputError(
      'Un combo no puede incluirse a sí mismo.',
      400,
      'BUNDLE_SELF_REFERENCE'
    );
  }

  let query = ProductModel.find({
    _id: {
      $in: requested.map((component) => component.product),
    },
    archivedAt: null,
  }).select(
    'title sku image productType variants trackInventory allowBackorder active visible archivedAt bundleComponents'
  );

  if (session && typeof query.session === 'function') {
    query = query.session(session);
  }

  const products = await query.lean();
  const productMap = new Map(
    products.map((product) => [String(product._id), product])
  );

  const resolved = requested.map((component) => {
    const product = productMap.get(component.product);

    if (
      !product ||
      product.active === false ||
      product.visible === false ||
      product.archivedAt
    ) {
      throw new ProductFulfillmentInputError(
        'Uno de los productos del combo no está disponible.',
        409,
        'BUNDLE_COMPONENT_UNAVAILABLE'
      );
    }

    if (product.productType === 'bundle') {
      throw new ProductFulfillmentInputError(
        'No se permiten combos dentro de otros combos.',
        400,
        'NESTED_BUNDLE_NOT_ALLOWED'
      );
    }

    const variant = findVariant(
      product,
      component.variantKey
    );
    const commercial = resolveVariantCommercialSnapshot(
      product,
      {
        variantKey:
          variant.variantKey ||
          buildVariantKey(
            variant.size,
            variant.color,
            variant.attributes
          ),
        size: variant.size || '',
        color: variant.color || '',
        variantAttributes: variant.attributes || [],
      }
    );

    return {
      product: product._id,
      variantKey:
        commercial.variantKey || 'default__default',
      quantity: component.quantity,
      title: product.title || '',
      sku: commercial.sku || product.sku || '',
      image: commercial.image || product.image || '',
      productType: product.productType || 'physical',
      size: variant.size || '',
      color: variant.color || '',
      variantLabel:
        variant.label ||
        [variant.size, variant.color].filter(Boolean).join(' / ') ||
        'Presentación general',
      variantAttributes: Array.isArray(variant.attributes)
        ? variant.attributes
        : [],
      trackInventory: product.trackInventory !== false,
      allowBackorder: product.allowBackorder === true,
      requiresShipping: productRequiresShipping(product),
    };
  });

  const seen = new Set();
  for (const component of resolved) {
    const identity =
      `${String(component.product)}:${component.variantKey}`;
    if (seen.has(identity)) {
      throw new ProductFulfillmentInputError(
        'El combo contiene el mismo producto y variante más de una vez.',
        400,
        'BUNDLE_COMPONENT_DUPLICATE'
      );
    }
    seen.add(identity);
  }

  return resolved;
}

async function assertBundlePurchasable(
  product,
  {
    session = null,
    ProductModel = Product,
  } = {}
) {
  if (product?.productType !== 'bundle') return [];

  return resolveBundleComponents(product.bundleComponents, {
    excludeProductId: product._id,
    session,
    ProductModel,
  });
}

function getAvailable(stock = {}) {
  const available = Number(stock.availableStock);
  if (Number.isFinite(available)) return Math.max(0, available);
  return Math.max(
    0,
    Number(stock.stock || 0) - Number(stock.reservedStock || 0)
  );
}

async function getBundleAvailableQuantity(
  product,
  {
    InventoryStockModel = InventoryStock,
  } = {}
) {
  const components = normalizeBundleComponents(
    product?.bundleComponents
  );
  const tracked = components.filter(
    (component) =>
      component.trackInventory !== false &&
      component.allowBackorder !== true
  );

  if (!tracked.length) return Infinity;

  const limits = [];

  for (const component of tracked) {
    const filter = {
      product: component.product,
      deletedAt: null,
      active: { $ne: false },
    };

    if (
      component.variantKey &&
      component.variantKey !== 'default__default'
    ) {
      filter.variantKey = component.variantKey;
    }

    const rows = await InventoryStockModel.find(filter)
      .select('stock reservedStock availableStock')
      .lean();
    const total = rows.reduce(
      (sum, row) => sum + getAvailable(row),
      0
    );

    limits.push(
      Math.floor(total / Math.max(1, component.quantity))
    );
  }

  return limits.length ? Math.min(...limits) : Infinity;
}

module.exports = {
  ProductFulfillmentInputError,
  resolveBundleComponents,
  assertBundlePurchasable,
  getBundleAvailableQuantity,
};
