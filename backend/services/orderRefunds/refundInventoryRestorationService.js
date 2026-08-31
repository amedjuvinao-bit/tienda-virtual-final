'use strict';

const InventoryStock = require('../../models/InventoryStock');
const InventoryMovement = require('../../models/InventoryMovement');
const {
  assertVariantIdentity,
} = require('../../lib/products/productVariantConfig');
const { syncProductTotalStock } = require('../inventoryService');
const {
  cleanUpper,
  createRefundError,
  idValue,
  toQuantity,
} = require('./refundNormalization');
const {
  groupSaleAllocations,
  loadConfirmedSaleAllocations,
} = require('./refundInventoryAllocationService');
const {
  buildInventoryDemands,
} = require('./refundInventoryDemandService');

async function restoreInventory({
  order,
  refund = null,
  returnCase = null,
  requestedItems,
  previousRestoredByStock,
  adminId,
  session,
}) {
  if (!requestedItems.length) return [];

  const allocations = await loadConfirmedSaleAllocations(
    order,
    session
  );
  const allocationGroups = groupSaleAllocations(allocations);
  const demands = await buildInventoryDemands({
    order,
    requestedItems,
    allocationGroups,
    allocations,
    session,
  });
  const restorations = [];
  const affectedProducts = new Set();
  const now = new Date();
  const source = returnCase || refund;
  const sourceReference = cleanUpper(
    returnCase?.returnNumber || refund?.refundNumber || 'RETURN'
  );
  const sourceModel = returnCase ? 'OrderReturn' : 'OrderRefund';

  for (const demand of demands.values()) {
    const group = allocationGroups.get(demand.key);
    let remaining = demand.quantity;

    for (const allocation of group?.allocations?.values() || []) {
      if (remaining <= 0) break;
      const stockId = idValue(allocation.inventoryStock);
      const alreadyRestored = toQuantity(
        previousRestoredByStock.get(stockId) || 0
      );
      const restoredNow = restorations
        .filter(
          (restoration) =>
            idValue(restoration.inventoryStock) === stockId
        )
        .reduce(
          (sum, restoration) =>
            sum + toQuantity(restoration.quantity),
          0
        );
      const capacity = Math.max(
        0,
        toQuantity(allocation.quantity) -
          alreadyRestored -
          restoredNow
      );
      if (!capacity) continue;

      const quantity = Math.min(remaining, capacity);
      const stock = await InventoryStock.findById(stockId).session(
        session
      );
      if (!stock) {
        throw createRefundError(
          'La existencia histórica de la venta ya no está disponible.',
          'RETURN_STOCK_ROW_NOT_FOUND',
          409,
          { inventoryStock: stockId }
        );
      }

      const before = Number(stock.stock || 0);
      const after = before + quantity;
      const stockIdentity = assertVariantIdentity({
        variantKey: allocation.variantKey || stock.variantKey,
        size: stock.variant?.size,
        color: stock.variant?.color,
        attributes: stock.variant?.attributes || [],
      });
      const movement = new InventoryMovement({
        type: 'return_in',
        direction: 'in',
        status: 'posted',
        product: allocation.product,
        productSnapshot:
          allocation.productSnapshot ||
          stock.productSnapshot ||
          {},
        variant: {
          size: stockIdentity.size,
          color: stockIdentity.color,
          label:
            allocation.variantLabel || stock.variant?.label || '',
          attributes: stockIdentity.attributes,
          sku: stock.variant?.sku || '',
          barcode: stock.variant?.barcode || '',
        },
        variantKey: stockIdentity.variantKey,
        branchFrom: null,
        branchFromSnapshot: {},
        branchTo: allocation.branch || stock.branch,
        branchToSnapshot:
          allocation.branchSnapshot ||
          stock.branchSnapshot ||
          {},
        quantity,
        stockFrom: {
          before: 0,
          quantity: 0,
          after: 0,
        },
        stockTo: {
          before,
          quantity,
          after,
        },
        reason: 'Entrada automática por devolución de cliente',
        notes: `${returnCase ? 'RMA' : 'Reembolso'} ${sourceReference} de la orden ${order.orderNumber || order._id}.`,
        reference: sourceReference,
        order: order._id,
        orderNumber: cleanUpper(order.orderNumber),
        sourceModel,
        sourceId: source?._id || null,
        createdBy: adminId,
        updatedBy: adminId,
        postedBy: adminId,
        postedAt: now,
      });
      await movement.save({ session });

      stock.stock = after;
      stock.availableStock = Math.max(
        0,
        after - Number(stock.reservedStock || 0)
      );
      stock.lastMovement = movement._id;
      stock.lastMovementAt = now;
      stock.updatedBy = adminId;
      await stock.save({ session });

      restorations.push({
        reservationItem:
          allocation.reservationItem || null,
        inventoryStock: stock._id,
        inventoryMovement: movement._id,
        branch: allocation.branch || stock.branch,
        product: allocation.product,
        variantKey: allocation.variantKey,
        size: allocation.size,
        color: allocation.color,
        quantity,
        bundleParentProduct:
          demand.bundleParentProduct || null,
      });
      affectedProducts.add(idValue(allocation.product));
      remaining -= quantity;
    }

    if (remaining > 0) {
      throw createRefundError(
        'La devolución supera las unidades realmente descontadas del inventario.',
        'REFUND_QUANTITY_EXCEEDS_SOLD_INVENTORY',
        409,
        {
          product: demand.product,
          variantKey: demand.variantKey,
          requestedQuantity: demand.quantity,
          missingQuantity: remaining,
        }
      );
    }
  }

  for (const productId of affectedProducts) {
    await syncProductTotalStock(productId, { session });
  }

  return restorations;
}

module.exports = {
  restoreInventory,
};
