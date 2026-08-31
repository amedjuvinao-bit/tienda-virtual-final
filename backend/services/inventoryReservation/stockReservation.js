const InventoryStock = require('../../models/InventoryStock');
const { resolveVariantIdentity } = require('../../lib/products/productVariantConfig');
const { loadBranchMap, loadProductMap } = require('./catalog');
const {
  buildStockVariantFilter,
  getAvailableFromStock,
  getBranchSnapshot,
  getProductSnapshot,
  normalizeCartItems,
  sortStocksByPriority,
} = require('./itemNormalization');
const {
  buildReleaseStockUpdate,
  buildReservationStockUpdate,
  resolveReservationStockVariant,
} = require('./stockUpdates');
const {
  createServiceError,
  isValidObjectId,
  toNumber,
  toObjectId,
} = require('./support');

function applyAllowedBranchScope(filter = {}, allowedBranchIds = null) {
  if (!Array.isArray(allowedBranchIds)) return filter;
  return {
    ...filter,
    branch: {
      $in: allowedBranchIds
        .filter((branchId) => isValidObjectId(branchId))
        .map((branchId) => toObjectId(branchId, 'allowedBranchId')),
    },
  };
}

async function reserveFromStockRow({
  stock,
  item,
  product,
  branch,
  quantityToReserve,
  allowedBranchIds = null,
  session,
}) {
  const stockBeforeReservation = toNumber(stock.stock, 0);
  const reservedBeforeReservation = toNumber(stock.reservedStock, 0);
  const availableBeforeReservation = getAvailableFromStock(stock);

  const updateFilter = applyAllowedBranchScope(
    {
      _id: stock._id,
      active: true,
      deletedAt: null,
      $expr: {
        $gte: [
          {
            $subtract: [
              '$stock',
              {
                $ifNull: ['$reservedStock', 0],
              },
            ],
          },
          quantityToReserve,
        ],
      },
    },
    allowedBranchIds
  );

  const updatedStock = await InventoryStock.findOneAndUpdate(
    updateFilter,
    buildReservationStockUpdate(quantityToReserve),
    {
      new: true,
      session,
      runValidators: false,
    }
  );

  if (!updatedStock) {
    throw createServiceError(
      'El inventario cambió mientras se intentaba reservar. Intenta nuevamente.',
      'CONCURRENT_STOCK_CHANGE',
      {
        productId: item.productId,
        size: item.size,
        color: item.color,
        stockId: String(stock._id),
      },
      409
    );
  }

  const stockIdentity = resolveReservationStockVariant(
    stock,
    item.variantKey
  );

  return {
    product: item.productObjectId,
    inventoryStock: stock._id,
    branch: stock.branch,
    orderItem:
      item.orderItem && isValidObjectId(item.orderItem)
        ? toObjectId(item.orderItem, 'orderItem')
        : null,
    productSnapshot: getProductSnapshot(product, item),
    branchSnapshot: getBranchSnapshot(branch),
    size: stockIdentity.size,
    color: stockIdentity.color,
    variantLabel:
      stock.variant?.label || item.variantLabel || '',
    variantAttributes: stockIdentity.attributes,
    variantKey: stockIdentity.variantKey,
    bundleParentProduct: item.bundleParentProduct || null,
    bundleParentTitle: item.bundleParentTitle || '',
    quantity: quantityToReserve,
    unitPrice: item.unitPrice,
    lineTotal: quantityToReserve * item.unitPrice,
    stockBeforeReservation,
    reservedBeforeReservation,
    availableBeforeReservation,
  };
}

async function releaseReservedItems({
  items = [],
  session,
  InventoryStockModel = InventoryStock,
}) {
  for (const item of items) {
    const quantity = toNumber(item.quantity, 0);

    if (!item.inventoryStock || quantity <= 0) continue;

    const identity = resolveVariantIdentity({
      variantKey: item.variantKey,
      size: item.size,
      color: item.color,
      attributes: item.variantAttributes || [],
    });

    const result = await InventoryStockModel.updateOne(
      {
        _id: item.inventoryStock,
        ...(item.branch ? { branch: item.branch } : {}),
        ...(item.product ? { product: item.product } : {}),
        variantKey: identity.variantKey,
        reservedStock: { $gte: quantity },
      },
      buildReleaseStockUpdate(quantity),
      {
        session,
      }
    );

    if (Number(result?.matchedCount || 0) !== 1) {
      throw createServiceError(
        'No se pudo liberar completamente la fila reservada.',
        'RESERVED_STOCK_RELEASE_FAILED',
        {
          inventoryStock: String(item.inventoryStock),
          branch: String(item.branch || ''),
          product: String(item.product || ''),
          variantKey: identity.variantKey,
          quantity,
        },
        409
      );
    }
  }
}

async function allocateReservationItems({
  items,
  branchPriorityIds = [],
  allowedBranchIds = null,
  session,
}) {
  const normalizedItems = normalizeCartItems(items);
  const productMap = await loadProductMap(normalizedItems, session);
  const allowedBranchObjectIds = Array.isArray(allowedBranchIds)
    ? allowedBranchIds
        .filter((branchId) => isValidObjectId(branchId))
        .map((branchId) => toObjectId(branchId, 'allowedBranchId'))
    : null;

  const reservationItems = [];
  const insufficientItems = [];
  const usedBranchIds = new Set();

  for (const item of normalizedItems) {
    let remainingQuantity = item.quantity;

    const stockFilter = applyAllowedBranchScope(
      buildStockVariantFilter(item),
      allowedBranchObjectIds
    );
    const rawStocks = await InventoryStock.find(stockFilter)
      .select(
        'product branch stock reservedStock availableStock size color variant productSnapshot branchSnapshot'
      )
      .session(session)
      .lean();

    const stocks = sortStocksByPriority(rawStocks, branchPriorityIds);

    const branchIdsForItem = stocks.map((stock) => String(stock.branch || ''));
    const branchMap = await loadBranchMap(branchIdsForItem, session);

    for (const stock of stocks) {
      if (remainingQuantity <= 0) break;

      const availableStock = getAvailableFromStock(stock);

      if (availableStock <= 0) continue;

      const quantityToReserve = Math.min(remainingQuantity, availableStock);
      const product = productMap.get(item.productId) || {};
      const branchId = String(stock.branch || '');
      const branch = branchMap.get(branchId) || {};

      const reservedItem = await reserveFromStockRow({
        stock,
        item,
        product,
        branch,
        quantityToReserve,
        allowedBranchIds: allowedBranchObjectIds,
        session,
      });

      reservationItems.push(reservedItem);
      usedBranchIds.add(branchId);

      remainingQuantity -= quantityToReserve;
    }

    if (remainingQuantity > 0) {
      insufficientItems.push({
        productId: item.productId,
        title: item.title || productMap.get(item.productId)?.title || '',
        sku: item.sku || productMap.get(item.productId)?.sku || '',
        size: item.size,
        color: item.color,
        requestedQuantity: item.quantity,
        missingQuantity: remainingQuantity,
      });
    }
  }

  if (insufficientItems.length > 0) {
    await releaseReservedItems({
      items: reservationItems,
      session,
    });

    throw createServiceError(
      'No hay inventario suficiente para completar la reserva.',
      'INSUFFICIENT_STOCK',
      {
        insufficientItems,
      },
      409
    );
  }

  return {
    reservationItems,
    usedBranchIds: Array.from(usedBranchIds),
  };
}

module.exports = {
  applyAllowedBranchScope,
  allocateReservationItems,
  releaseReservedItems,
  reserveFromStockRow,
};
