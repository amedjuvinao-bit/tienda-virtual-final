'use strict';

const mongoose = require('mongoose');

const Product = require('../models/Product');
const InventoryStock = require('../models/InventoryStock');
const {
  findProductVariant,
  normalizeAttributes,
  normalizeProductVariants,
  resolveVariantCommercialSnapshot,
  resolveVariantIdentity,
} = require('../lib/products/productVariantConfig');
const {
  getPublicFulfillmentView,
} = require('../lib/products/productFulfillmentConfig');
const {
  getBundleAvailableQuantity,
} = require('./productBundleService');
const {
  buildStockVariantFilter,
  getAvailableFromStock,
} = require('./inventoryReservationService');

const PRODUCT_FIELDS = [
  'title',
  'price',
  'image',
  'images',
  'sku',
  'barcode',
  'category',
  'inventory',
  'stock',
  'visible',
  'active',
  'archivedAt',
  'productType',
  'trackInventory',
  'allowBackorder',
  'variants',
  'digitalDelivery',
  'serviceDelivery',
  'bundleComponents',
].join(' ');

const INVALID_MESSAGES = Object.freeze({
  INVALID_PRODUCT_ID: 'El identificador del producto no es valido.',
  PRODUCT_NOT_FOUND: 'El producto ya no existe.',
  PRODUCT_NOT_AVAILABLE: 'El producto no esta disponible.',
  INVALID_VARIANT: 'La variante seleccionada ya no existe.',
  INVALID_QUANTITY: 'La cantidad solicitada no es valida.',
  OUT_OF_STOCK: 'El producto no tiene inventario disponible.',
  INSUFFICIENT_STOCK: 'La cantidad solicitada supera el inventario disponible.',
  PRODUCT_PRICE_INVALID: 'El producto no tiene un precio valido.',
});

function clean(value, max = 1000) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function readProductId(item = {}) {
  const product = item?.product;
  const value =
    item?.productId ||
    item?._id ||
    (product && typeof product === 'object' ? product._id || product.id : product);
  return clean(value, 80);
}

function readQuantity(item = {}) {
  const quantity = Number(item.quantity ?? item.qty ?? item.cantidad ?? 0);
  return Number.isInteger(quantity) && quantity > 0 ? quantity : 0;
}

function readRequestedIdentity(item = {}) {
  return resolveVariantIdentity({
    variantKey:
      item.variantKey || item.variantId || item.selectedVariantKey || item.selectedVariantId,
    size: item.size || item.talla,
    color: item.rawColor || item.colorValue || item.color,
    attributes:
      item.variantAttributes || item.attributes || item.selectedAttributes || [],
  });
}

function safeStock(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.floor(number));
}

function invalidItem({
  productId,
  requestedQuantity,
  reason,
  product = null,
  availableStock = 0,
} = {}) {
  const productExists = Boolean(product);
  const fulfillment = productExists ? getPublicFulfillmentView(product) : null;
  const canonicalPrice = productExists ? Number(product.price) : 0;
  const mayExposeBaseCommercialData = reason !== 'INVALID_VARIANT';

  return {
    _id: productId || '',
    productId: productId || '',
    title: productExists ? clean(product.title, 220) : 'Producto no disponible',
    image:
      productExists && mayExposeBaseCommercialData ? clean(product.image, 1000) : '',
    price:
      productExists &&
      mayExposeBaseCommercialData &&
      Number.isFinite(canonicalPrice) &&
      canonicalPrice >= 0
        ? canonicalPrice
        : 0,
    color: '',
    size: '',
    variantId: '',
    variantKey: '',
    variantLabel: '',
    variantAttributes: [],
    variantSku: '',
    variantBarcode: '',
    productType: fulfillment?.productType || clean(product?.productType || 'physical', 30),
    requiresShipping: fulfillment?.requiresShipping !== false,
    fulfillment,
    requestedQty: safeStock(requestedQuantity),
    qty: 0,
    quantity: 0,
    availableStock: safeStock(availableStock),
    inventoryTracked: productExists && product.trackInventory !== false,
    valid: false,
    purchasable: false,
    invalidReason: reason,
    validationMessage: INVALID_MESSAGES[reason] || 'El producto no puede comprarse.',
  };
}

async function executeLean(query) {
  let current = query;
  if (current && typeof current.lean === 'function') current = current.lean();
  if (current && typeof current.exec === 'function') return current.exec();
  return current;
}

async function loadProductMap(items, ProductModel) {
  const ids = Array.from(
    new Set(
      items
        .map(readProductId)
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
    )
  );
  if (!ids.length) return new Map();

  let query = ProductModel.find({ _id: { $in: ids } });
  if (query && typeof query.select === 'function') query = query.select(PRODUCT_FIELDS);
  const products = (await executeLean(query)) || [];
  return new Map(products.map((product) => [String(product._id), product]));
}

async function readAvailableStock({
  product,
  identity,
  InventoryStockModel,
  bundleAvailability,
}) {
  if (product.productType === 'bundle') {
    const availableStock = Number(await bundleAvailability(product));
    if (!Number.isFinite(availableStock)) {
      return { inventoryTracked: false, availableStock: null };
    }
    return {
      inventoryTracked: true,
      availableStock: safeStock(availableStock),
    };
  }

  if (product.trackInventory === false || product.allowBackorder === true) {
    return { inventoryTracked: false, availableStock: null };
  }

  const item = {
    productObjectId: product._id,
    variantKey: identity.variantKey,
    size: identity.size,
    color: identity.color,
  };
  let query = InventoryStockModel.find(buildStockVariantFilter(item));
  if (query && typeof query.select === 'function') {
    query = query.select('stock reservedStock availableStock');
  }
  const rows = (await executeLean(query)) || [];
  const availableStock = rows.reduce(
    (total, row) => total + safeStock(getAvailableFromStock(row)),
    0
  );
  return { inventoryTracked: true, availableStock };
}

function toStoredCartItem(item = {}) {
  return {
    _id: item.productId || item._id,
    title: item.title,
    image: item.image,
    price: item.price,
    color: item.color,
    size: item.size,
    variantId: item.variantKey,
    variantKey: item.variantKey,
    variantLabel: item.variantLabel,
    variantAttributes: item.variantAttributes,
    qty: item.qty,
    quantity: item.quantity,
  };
}

function createCartCanonicalValidationService({
  ProductModel = Product,
  InventoryStockModel = InventoryStock,
  bundleAvailability = getBundleAvailableQuantity,
} = {}) {
  async function validateItems(items = [], { mode = 'soft' } = {}) {
    const sourceItems = Array.isArray(items) ? items : [];
    const strict = String(mode || 'soft').toLowerCase() === 'strict';
    const productMap = await loadProductMap(sourceItems, ProductModel);
    const validated = [];
    const adjustments = [];

    for (const source of sourceItems) {
      const productId = readProductId(source);
      const requestedQuantity = readQuantity(source);
      const product = productMap.get(productId) || null;
      let result;

      if (!mongoose.Types.ObjectId.isValid(productId)) {
        result = invalidItem({
          productId,
          requestedQuantity,
          reason: 'INVALID_PRODUCT_ID',
        });
      } else if (!product) {
        result = invalidItem({
          productId,
          requestedQuantity,
          reason: 'PRODUCT_NOT_FOUND',
        });
      } else if (
        product.active === false ||
        product.visible === false ||
        Boolean(product.archivedAt)
      ) {
        result = invalidItem({
          productId,
          requestedQuantity,
          product,
          reason: 'PRODUCT_NOT_AVAILABLE',
        });
      } else if (!requestedQuantity) {
        result = invalidItem({
          productId,
          requestedQuantity,
          product,
          reason: 'INVALID_QUANTITY',
        });
      } else {
        const requestedIdentity = readRequestedIdentity(source);
        const activeVariants = normalizeProductVariants(product.variants || [], product)
          .filter((variant) => variant.active !== false);
        const selectedVariant = findProductVariant(product, requestedIdentity);
        const hasVariantSelection = requestedIdentity.variantKey !== 'default__default';
        const variantIsInvalid =
          (activeVariants.length > 0 && !selectedVariant) ||
          (activeVariants.length === 0 && hasVariantSelection);

        if (variantIsInvalid) {
          result = invalidItem({
            productId,
            requestedQuantity,
            product,
            reason: 'INVALID_VARIANT',
          });
        } else {
          const canonicalIdentity = selectedVariant
            ? resolveVariantIdentity(selectedVariant)
            : resolveVariantIdentity({ variantKey: 'default__default' });
          const commercial = resolveVariantCommercialSnapshot(product, canonicalIdentity);
          const price = Number(commercial.price);

          if (!Number.isFinite(price) || price < 0) {
            result = invalidItem({
              productId,
              requestedQuantity,
              product,
              reason: 'PRODUCT_PRICE_INVALID',
            });
          } else {
            const stock = await readAvailableStock({
              product,
              identity: canonicalIdentity,
              InventoryStockModel,
              bundleAvailability,
            });
            const availableStock = stock.availableStock;
            const outOfStock = stock.inventoryTracked && availableStock <= 0;
            const insufficient =
              stock.inventoryTracked && requestedQuantity > availableStock;
            const valid = !outOfStock && !insufficient;
            const finalQuantity = valid
              ? requestedQuantity
              : strict
                ? 0
                : Math.min(requestedQuantity, safeStock(availableStock));
            const fulfillment = getPublicFulfillmentView(product);

            result = {
              _id: String(product._id),
              productId: String(product._id),
              title: clean(product.title, 220),
              image: clean(commercial.image || product.image, 1000),
              price,
              color: canonicalIdentity.color,
              size: canonicalIdentity.size,
              variantId: canonicalIdentity.variantKey,
              variantKey: canonicalIdentity.variantKey,
              variantLabel: clean(commercial.variantLabel, 180),
              variantAttributes: normalizeAttributes(commercial.variantAttributes),
              variantSku: clean(commercial.sku || product.sku, 120),
              variantBarcode: clean(commercial.barcode || product.barcode, 120),
              productType: fulfillment.productType,
              requiresShipping: fulfillment.requiresShipping,
              fulfillment,
              requestedQty: requestedQuantity,
              qty: finalQuantity,
              quantity: finalQuantity,
              availableStock:
                stock.inventoryTracked ? safeStock(availableStock) : null,
              inventoryTracked: stock.inventoryTracked,
              valid,
              purchasable: valid,
              invalidReason: outOfStock
                ? 'OUT_OF_STOCK'
                : insufficient
                  ? 'INSUFFICIENT_STOCK'
                  : null,
              validationMessage: outOfStock
                ? INVALID_MESSAGES.OUT_OF_STOCK
                : insufficient
                  ? INVALID_MESSAGES.INSUFFICIENT_STOCK
                  : '',
            };
          }
        }
      }

      validated.push(result);
      if (!result.valid || Number(source.price) !== Number(result.price)) {
        adjustments.push({
          productId: result.productId,
          variantKey: result.variantKey,
          requestedQty: safeStock(requestedQuantity),
          finalQty: result.qty,
          availableStock: result.availableStock,
          price: result.price,
          previousPrice: Number.isFinite(Number(source.price)) ? Number(source.price) : 0,
          reason: result.invalidReason,
          note: result.validationMessage || 'Datos comerciales actualizados desde el producto.',
        });
      }
    }

    const invalidItems = validated.filter((item) => !item.valid);
    return {
      ok: invalidItems.length === 0,
      mode: strict ? 'strict' : 'soft',
      items: validated,
      invalidItems,
      adjustments,
    };
  }

  return { validateItems };
}

const defaultService = createCartCanonicalValidationService();

module.exports = {
  INVALID_MESSAGES,
  createCartCanonicalValidationService,
  defaultCartCanonicalValidationService: defaultService,
  readProductId,
  readQuantity,
  safeStock,
  toStoredCartItem,
};
