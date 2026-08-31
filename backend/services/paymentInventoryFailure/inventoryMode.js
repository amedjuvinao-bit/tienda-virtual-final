'use strict';

const {
  resolveVariantIdentity,
} = require('../../../shared/variantKeyAuthority.cjs');
const { createFailureError } = require('./errorClassification');
const { cleanText, idValue, toQuantity } = require('./support');

function hasLegacyDiscountEvidence(order = {}) {
  const allocations = Array.isArray(order.inventoryAllocations)
    ? order.inventoryAllocations
    : [];

  return allocations.some((allocation) => toQuantity(allocation?.soldQuantity) > 0);
}

function hasReservationEvidence(order = {}) {
  const allocations = Array.isArray(order.inventoryAllocations)
    ? order.inventoryAllocations
    : [];

  return allocations.some((allocation) => {
    const status = cleanText(allocation?.status, 40).toLowerCase();
    return (
      toQuantity(allocation?.reservedQuantity) > 0 ||
      ['reserved', 'confirmed'].includes(status)
    );
  });
}

function resolveFailureInventoryMode(order = {}) {
  const control = order.inventoryControl || {};

  if (control.restockedOnFailure === true) return 'completed';
  if (hasLegacyDiscountEvidence(order)) {
    return 'legacy_compensation';
  }
  if (
    control.reservationRequired === false &&
    !hasReservationEvidence(order)
  ) {
    return 'none';
  }
  if (control.reservationId) return 'release_reservation';
  return 'incomplete';
}

function getLegacyCompensationPlan(order = {}) {
  const allocations = Array.isArray(order.inventoryAllocations)
    ? order.inventoryAllocations
    : [];

  if (!allocations.length) {
    throw createFailureError(
      'La orden heredada figura descontada, pero no conserva asignaciones por sede.',
      'LEGACY_INVENTORY_ALLOCATIONS_REQUIRED',
      { orderNumber: cleanText(order.orderNumber, 40) }
    );
  }

  const plan = allocations.map((allocation, index) => {
    const quantity = toQuantity(allocation.quantity);
    const soldQuantity = Math.min(
      quantity,
      toQuantity(allocation.soldQuantity)
    );
    const returnedQuantity = Math.min(
      soldQuantity,
      toQuantity(allocation.returnedQuantity)
    );
    const identity = resolveVariantIdentity({
      variantKey: allocation.variantKey,
      size: allocation.size,
      color: allocation.color,
      attributes: allocation.variantAttributes || [],
    });

    if (
      !allocation.inventoryStock ||
      !allocation.branch ||
      !allocation.product
    ) {
      throw createFailureError(
        'Una asignacion heredada no identifica inventario, sede y producto.',
        'LEGACY_ALLOCATION_INCOMPLETE',
        { index, allocationId: idValue(allocation._id) }
      );
    }

    return {
      allocation,
      allocationId: idValue(allocation._id),
      inventoryStock: allocation.inventoryStock,
      branch: allocation.branch,
      product: allocation.product,
      variantKey: identity.variantKey,
      variantIdentity: identity,
      soldQuantity,
      returnedQuantity,
      quantityToRestore: Math.max(0, soldQuantity - returnedQuantity),
    };
  });

  const soldTotal = plan.reduce(
    (sum, item) => sum + item.soldQuantity,
    0
  );

  if (!soldTotal) {
    throw createFailureError(
      'No existe evidencia por asignacion de stock fisico descontado.',
      'LEGACY_DISCOUNT_EVIDENCE_MISSING',
      { orderNumber: cleanText(order.orderNumber, 40) }
    );
  }

  return plan;
}

module.exports = {
  getLegacyCompensationPlan,
  hasLegacyDiscountEvidence,
  hasReservationEvidence,
  resolveFailureInventoryMode,
};
