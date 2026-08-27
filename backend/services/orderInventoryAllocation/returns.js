'use strict';

const {
  canonicalizeVariantKey,
} = require('../../../shared/variantKeyAuthority.cjs');
const {
  getAllocationStatus,
  normalizeAllocation,
} = require('./normalization');
const { summarizeInventoryAllocations } = require('./summary');
const { idValue, toQuantity } = require('./support');

function applyReturnsToOrderInventoryAllocations(
  order,
  restorations = [],
  at = new Date()
) {
  if (!order || !Array.isArray(restorations) || !restorations.length) {
    return order;
  }

  const allocations = (
    Array.isArray(order.inventoryAllocations) ? order.inventoryAllocations : []
  ).map(normalizeAllocation);

  for (const restoration of restorations) {
    let remaining = toQuantity(restoration.quantity);
    if (!remaining) continue;

    const exactReservationItem = idValue(restoration.reservationItem);
    const stockId = idValue(restoration.inventoryStock);
    const productId = idValue(restoration.product);
    const branchId = idValue(restoration.branch);
    const variantKey =
      canonicalizeVariantKey(restoration.variantKey) || 'default__default';

    const candidates = allocations.filter((allocation) => {
      if (
        exactReservationItem &&
        idValue(allocation.reservationItem) === exactReservationItem
      ) {
        return true;
      }

      return (
        idValue(allocation.inventoryStock) === stockId &&
        idValue(allocation.product) === productId &&
        idValue(allocation.branch) === branchId &&
        canonicalizeVariantKey(allocation.variantKey) === variantKey
      );
    });

    for (const allocation of candidates) {
      if (!remaining) break;
      const capacity = Math.max(
        0,
        allocation.soldQuantity - allocation.returnedQuantity
      );
      if (!capacity) continue;

      const returnedNow = Math.min(remaining, capacity);
      allocation.returnedQuantity += returnedNow;
      allocation.lastReturnedAt = at;
      allocation.status = getAllocationStatus(allocation);
      remaining -= returnedNow;
    }
  }

  order.inventoryAllocations = allocations;
  order.inventoryAllocationSummary = summarizeInventoryAllocations(allocations);
  return order;
}

module.exports = { applyReturnsToOrderInventoryAllocations };
