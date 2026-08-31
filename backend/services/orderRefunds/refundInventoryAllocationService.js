'use strict';

const InventoryReservation = require('../../models/InventoryReservation');
const InventoryStock = require('../../models/InventoryStock');
const InventoryMovement = require('../../models/InventoryMovement');
const {
  canonicalizeVariantKey,
  normalizeAttributes,
} = require('../../lib/products/productVariantConfig');
const {
  cleanText,
  cleanUpper,
  idValue,
  normalizeVariantKey,
  toQuantity,
} = require('./refundNormalization');

function inventoryKey(product, variantKey) {
  return `${idValue(product)}:${
    canonicalizeVariantKey(variantKey) || 'default__default'
  }`;
}

async function loadConfirmedSaleAllocations(order, session) {
  const reservation = await InventoryReservation.findOne({
    $or: [
      { order: order._id },
      { orderNumber: cleanText(order.orderNumber) },
    ],
    status: 'confirmed',
  })
    .sort({ confirmedAt: -1, createdAt: -1 })
    .session(session)
    .lean();

  if (reservation?.items?.length) {
    return reservation.items
      .filter(
        (item) =>
          item.inventoryStock &&
          item.product &&
          toQuantity(item.quantity) > 0
      )
      .map((item) => ({
        reservationItem: idValue(item._id),
        inventoryStock: idValue(item.inventoryStock),
        branch: idValue(item.branch),
        product: idValue(item.product),
        variantKey: normalizeVariantKey(item),
        size: cleanText(item.size),
        color: cleanText(item.color),
        variantLabel: cleanText(item.variantLabel),
        variantAttributes: normalizeAttributes(
          item.variantAttributes || []
        ),
        quantity: toQuantity(item.quantity),
        bundleParentProduct: idValue(item.bundleParentProduct) || null,
        productSnapshot: item.productSnapshot || {},
        branchSnapshot: item.branchSnapshot || {},
        source: 'InventoryReservation',
        sourceId: reservation._id,
      }));
  }

  const saleMovements = await InventoryMovement.find({
    $or: [
      { order: order._id },
      { orderNumber: cleanUpper(order.orderNumber) },
    ],
    type: 'sale_out',
    status: 'posted',
    deletedAt: null,
  })
    .sort({ createdAt: 1, _id: 1 })
    .session(session)
    .lean();

  const allocations = [];
  for (const movement of saleMovements) {
    const variantKey = normalizeVariantKey(movement.variant || {});
    const stock = await InventoryStock.findOne({
      branch: movement.branchFrom,
      product: movement.product,
      variantKey,
      deletedAt: null,
    })
      .session(session)
      .lean();

    if (!stock) continue;

    allocations.push({
      inventoryStock: idValue(stock._id),
      branch: idValue(movement.branchFrom),
      product: idValue(movement.product),
      variantKey,
      size: cleanText(movement.variant?.size),
      color: cleanText(movement.variant?.color),
      variantLabel: cleanText(movement.variant?.label),
      variantAttributes: normalizeAttributes(
        movement.variant?.attributes || []
      ),
      quantity: toQuantity(movement.quantity),
      bundleParentProduct: null,
      productSnapshot: movement.productSnapshot || stock.productSnapshot || {},
      branchSnapshot: movement.branchFromSnapshot || stock.branchSnapshot || {},
      source: 'InventoryMovement',
      sourceId: movement._id,
    });
  }

  return allocations;
}

function groupSaleAllocations(allocations = []) {
  const groups = new Map();

  for (const allocation of allocations) {
    const key = inventoryKey(
      allocation.product,
      allocation.variantKey
    );
    const stockId = idValue(allocation.inventoryStock);
    const group = groups.get(key) || {
      key,
      product: allocation.product,
      variantKey: allocation.variantKey,
      size: allocation.size,
      color: allocation.color,
      variantLabel: allocation.variantLabel,
      variantAttributes: allocation.variantAttributes,
      allocations: new Map(),
    };
    const current = group.allocations.get(stockId) || {
      ...allocation,
      quantity: 0,
    };
    current.quantity += toQuantity(allocation.quantity);
    group.allocations.set(stockId, current);
    groups.set(key, group);
  }

  return groups;
}

module.exports = {
  groupSaleAllocations,
  inventoryKey,
  loadConfirmedSaleAllocations,
};
