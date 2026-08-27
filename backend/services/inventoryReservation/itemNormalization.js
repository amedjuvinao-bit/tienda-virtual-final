const {
  normalizeAttributes,
  resolveVariantIdentity,
} = require('../../lib/products/productVariantConfig');
const {
  cleanText,
  cleanUpper,
  createServiceError,
  getObjectIdValue,
  isValidObjectId,
  toNumber,
  toObjectId,
} = require('./support');

function normalizeVariantValue(value) {
  return cleanText(value);
}

function getProductImage(product = {}) {
  if (product.image) return product.image;

  if (Array.isArray(product.images) && product.images.length > 0) {
    const coverImage = product.images.find((image) => image?.isCover);

    if (coverImage?.url) return coverImage.url;
    if (typeof product.images[0] === 'string') return product.images[0];
    if (product.images[0]?.url) return product.images[0].url;
  }

  return '';
}

function getProductSnapshot(product = {}, fallbackItem = {}) {
  return {
    title: cleanText(product.title || fallbackItem.title || fallbackItem.name || ''),
    sku: cleanUpper(product.sku || fallbackItem.sku || ''),
    image: cleanText(getProductImage(product) || fallbackItem.image || ''),
    category: cleanText(product.category || fallbackItem.category || ''),
  };
}

function getBranchSnapshot(branch = {}) {
  return {
    name: cleanText(branch.name || branch.title || ''),
    code: cleanUpper(branch.code || ''),
    type: cleanText(branch.type || '').toLowerCase(),
  };
}

function getAvailableFromStock(stock = {}) {
  const physicalStock = toNumber(stock.stock, 0);
  const reservedStock = toNumber(stock.reservedStock, 0);

  return Math.max(0, physicalStock - reservedStock);
}

function normalizeCartItems(items = []) {
  if (!Array.isArray(items) || items.length === 0) {
    throw createServiceError(
      'La reserva necesita al menos un producto.',
      'EMPTY_RESERVATION_ITEMS',
      {},
      400
    );
  }

  return items.map((item, index) => {
    const productId =
      getObjectIdValue(item.productId) ||
      getObjectIdValue(item.product) ||
      getObjectIdValue(item._id);

    const size = normalizeVariantValue(item.size || item.talla || item.variant?.size);
    const color = normalizeVariantValue(item.color || item.variant?.color);
    const variantAttributes = normalizeAttributes(
      item.variantAttributes ||
        item.attributes ||
        item.variant?.attributes ||
        []
    );
    const identity = resolveVariantIdentity({
      variantKey: item.variantKey || item.variantId,
      size,
      color,
      attributes: variantAttributes,
    });
    const quantity = toNumber(item.quantity || item.qty || item.cantidad, 0);
    const unitPrice = toNumber(item.unitPrice || item.price || item.precio, 0);

    if (!productId || !isValidObjectId(productId)) {
      throw createServiceError(
        `El producto de la posición ${index + 1} no tiene un ID válido.`,
        'INVALID_PRODUCT_ID',
        {
          index,
          productId,
        },
        400
      );
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw createServiceError(
        `La cantidad del producto en la posición ${index + 1} debe ser mayor a cero.`,
        'INVALID_QUANTITY',
        {
          index,
          productId,
          quantity,
        },
        400
      );
    }

    return {
      originalItem: item,
      orderItem:
        getObjectIdValue(item.orderItem || item._id) || null,
      productId,
      productObjectId: toObjectId(productId, `items[${index}].productId`),
      size: identity.size,
      color: identity.color,
      variantLabel: cleanText(
        item.variantLabel || item.variant?.label || ''
      ),
      variantAttributes: identity.attributes,
      variantKey: identity.variantKey,
      quantity,
      unitPrice,
      lineTotal: quantity * unitPrice,
      title: cleanText(item.title || item.name || ''),
      sku: cleanUpper(item.sku || ''),
      image: cleanText(item.image || ''),
      category: cleanText(item.category || ''),
      bundleParentProduct:
        getObjectIdValue(item.bundleParentProduct) || null,
      bundleParentTitle: cleanText(item.bundleParentTitle || ''),
    };
  });
}

function buildStockVariantFilter(item) {
  const filter = {
    product: item.productObjectId,
    active: true,
    deletedAt: null,
  };

  if (
    item.variantKey &&
    item.variantKey !== 'default__default'
  ) {
    filter.variantKey = item.variantKey;
    return filter;
  }

  filter.$or = [
      {
        size: item.size,
        color: item.color,
      },
      {
        'variant.size': item.size,
        'variant.color': item.color,
      },
    ];

  return filter;
}

function sortStocksByPriority(stocks = [], branchPriorityIds = []) {
  const priorityMap = new Map(
    branchPriorityIds.map((branchId, index) => [String(branchId), index])
  );

  return [...stocks].sort((a, b) => {
    const branchA = String(a.branch || a.branchId || '');
    const branchB = String(b.branch || b.branchId || '');

    const priorityA = priorityMap.has(branchA) ? priorityMap.get(branchA) : 9999;
    const priorityB = priorityMap.has(branchB) ? priorityMap.get(branchB) : 9999;

    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }

    const availableA = getAvailableFromStock(a);
    const availableB = getAvailableFromStock(b);

    return availableB - availableA;
  });
}

module.exports = {
  buildStockVariantFilter,
  getAvailableFromStock,
  getBranchSnapshot,
  getProductSnapshot,
  normalizeCartItems,
  sortStocksByPriority,
};
