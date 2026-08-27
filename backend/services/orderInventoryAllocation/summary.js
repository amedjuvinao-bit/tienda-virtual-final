'use strict';

const { normalizeAllocation } = require('./normalization');
const { idValue } = require('./support');

function summarizeInventoryAllocations(allocations = []) {
  const normalized = (Array.isArray(allocations) ? allocations : [])
    .map(normalizeAllocation)
    .filter((allocation) => allocation.quantity > 0);
  const branchIds = Array.from(
    new Set(
      normalized
        .map((allocation) => idValue(allocation.branch))
        .filter(Boolean)
    )
  );

  return normalized.reduce(
    (result, allocation) => {
      result.totalQuantity += allocation.quantity;
      result.reservedQuantity += allocation.reservedQuantity;
      result.activeReservedQuantity +=
        allocation.status === 'reserved' ? allocation.quantity : 0;
      result.soldQuantity += allocation.soldQuantity;
      result.shippedQuantity += allocation.shippedQuantity;
      result.deliveredQuantity += allocation.deliveredQuantity;
      result.returnedQuantity += allocation.returnedQuantity;
      result.releasedQuantity += allocation.releasedQuantity;
      return result;
    },
    {
      allocationCount: normalized.length,
      branchCount: branchIds.length,
      splitAcrossBranches: branchIds.length > 1,
      branchIds,
      totalQuantity: 0,
      reservedQuantity: 0,
      activeReservedQuantity: 0,
      soldQuantity: 0,
      shippedQuantity: 0,
      deliveredQuantity: 0,
      returnedQuantity: 0,
      releasedQuantity: 0,
      updatedAt: new Date(),
    }
  );
}

module.exports = { summarizeInventoryAllocations };
