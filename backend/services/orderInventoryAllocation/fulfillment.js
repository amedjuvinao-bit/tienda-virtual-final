'use strict';

const {
  getAllocationStatus,
  normalizeAllocation,
} = require('./normalization');
const { summarizeInventoryAllocations } = require('./summary');
const { cleanLower, idValue } = require('./support');

function advanceOrderInventoryAllocations(order, targetStatus, at = new Date()) {
  if (!order) return order;
  const normalizedStatus = cleanLower(targetStatus);
  if (!['shipped', 'delivered'].includes(normalizedStatus)) return order;

  const allocations = (
    Array.isArray(order.inventoryAllocations) ? order.inventoryAllocations : []
  ).map((allocation) => {
    const next = normalizeAllocation(allocation);
    const fulfillableQuantity = Math.max(
      0,
      next.soldQuantity - next.returnedQuantity
    );

    if (normalizedStatus === 'shipped') {
      next.shippedQuantity = Math.max(next.shippedQuantity, fulfillableQuantity);
      next.shippedAt = next.shippedAt || at;
    }

    if (normalizedStatus === 'delivered') {
      next.shippedQuantity = Math.max(next.shippedQuantity, fulfillableQuantity);
      next.deliveredQuantity = Math.max(
        next.deliveredQuantity,
        fulfillableQuantity
      );
      next.shippedAt = next.shippedAt || at;
      next.deliveredAt = next.deliveredAt || at;
    }

    next.status = getAllocationStatus(next);
    return next;
  });

  order.inventoryAllocations = allocations;
  order.inventoryAllocationSummary = summarizeInventoryAllocations(allocations);
  return order;
}

function advanceOrderInventoryAllocationsForShipment(
  order,
  allocationIds = [],
  targetStatus,
  at = new Date()
) {
  if (!order) return order;
  const normalizedStatus = cleanLower(targetStatus);
  if (!['shipped', 'delivered'].includes(normalizedStatus)) return order;

  const selectedIds = new Set(
    (Array.isArray(allocationIds) ? allocationIds : [])
      .map(idValue)
      .filter(Boolean)
  );
  if (!selectedIds.size) return order;

  const allocations = (
    Array.isArray(order.inventoryAllocations) ? order.inventoryAllocations : []
  ).map((allocation) => {
    const next = normalizeAllocation(allocation);
    if (!selectedIds.has(idValue(allocation?._id))) return next;

    const fulfillableQuantity = Math.max(
      0,
      next.soldQuantity - next.returnedQuantity
    );
    next.shippedQuantity = Math.max(next.shippedQuantity, fulfillableQuantity);
    next.shippedAt = next.shippedAt || at;

    if (normalizedStatus === 'delivered') {
      next.deliveredQuantity = Math.max(
        next.deliveredQuantity,
        fulfillableQuantity
      );
      next.deliveredAt = next.deliveredAt || at;
    }

    next.status = getAllocationStatus(next);
    return next;
  });

  order.inventoryAllocations = allocations;
  order.inventoryAllocationSummary = summarizeInventoryAllocations(allocations);
  return order;
}

module.exports = {
  advanceOrderInventoryAllocations,
  advanceOrderInventoryAllocationsForShipment,
};
