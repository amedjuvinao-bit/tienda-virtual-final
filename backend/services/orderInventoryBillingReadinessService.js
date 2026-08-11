'use strict';

const READY_INVENTORY_STATUSES = new Set(['confirmed', 'not_required']);
const KNOWN_INVENTORY_STATUSES = new Set([
  'pending',
  'confirmed',
  'not_required',
  'failed',
]);

function asNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function getPersistedInventoryStatus(order = {}) {
  const status = String(
    order?.paymentProcessing?.inventory?.status || ''
  ).trim().toLowerCase();
  return KNOWN_INVENTORY_STATUSES.has(status) ? status : '';
}

function getInventoryEvidence(order = {}) {
  const inventoryControl =
    order?.inventoryControl && typeof order.inventoryControl === 'object'
      ? order.inventoryControl
      : null;
  const allocations = Array.isArray(order?.inventoryAllocations)
    ? order.inventoryAllocations
    : [];
  const summary = order?.inventoryAllocationSummary || {};
  const totalQuantity = asNumber(summary.totalQuantity);
  const soldQuantity = asNumber(summary.soldQuantity);
  const activeReservedQuantity = asNumber(summary.activeReservedQuantity);
  const allocationTotal =
    totalQuantity ||
    allocations.reduce(
      (sum, allocation) =>
        sum + Math.max(0, asNumber(allocation?.quantity)),
      0
    );
  const allocationSold =
    soldQuantity ||
    allocations.reduce(
      (sum, allocation) =>
        sum + Math.max(0, asNumber(allocation?.soldQuantity)),
      0
    );

  return {
    inventoryControl,
    allocations,
    hasReservation: Boolean(inventoryControl?.reservationId),
    hasAllocations: allocations.length > 0,
    allocationTotal,
    allocationSold,
    activeReservedQuantity,
    explicitlyNotRequired: inventoryControl?.reservationRequired === false,
    allocationsConfirmed:
      inventoryControl?.discountedAtCheckout === true &&
      allocationTotal > 0 &&
      allocationSold >= allocationTotal &&
      activeReservedQuantity <= 0,
  };
}

function isHistoricallyPaidWithoutManagedInventory(
  order = {},
  options = {}
) {
  const evidence = getInventoryEvidence(order);
  const wasApprovedBeforeProvided = Object.prototype.hasOwnProperty.call(
    options,
    'wasApprovedBefore'
  );
  const paymentAlreadyApproved = wasApprovedBeforeProvided
    ? options.wasApprovedBefore === true
    : String(order?.payment?.status || '').trim().toLowerCase() === 'paid';
  const hasPersistedProcessing =
    typeof options.hadPaymentProcessingBefore === 'boolean'
      ? options.hadPaymentProcessingBefore
      : Boolean(order?.paymentProcessing);

  return (
    paymentAlreadyApproved &&
    !hasPersistedProcessing &&
    !evidence.hasReservation &&
    !evidence.hasAllocations
  );
}

function resolveCompatibleInventoryStatus(
  order = {},
  options = {}
) {
  const evidence = getInventoryEvidence(order);

  if (evidence.explicitlyNotRequired) return 'not_required';
  if (evidence.allocationsConfirmed) return 'confirmed';
  if (isHistoricallyPaidWithoutManagedInventory(order, options)) {
    return 'not_required';
  }
  return 'pending';
}

function isLegacyInventoryReady(order = {}, options = {}) {
  return READY_INVENTORY_STATUSES.has(
    resolveCompatibleInventoryStatus(order, options)
  );
}

function resolveInitialInventoryStatus(order = {}, options = {}) {
  const persistedStatus = getPersistedInventoryStatus(order);
  if (persistedStatus) return persistedStatus;
  return resolveCompatibleInventoryStatus(order, options);
}

function isInventoryReadyForBilling(order = {}) {
  const persistedStatus = getPersistedInventoryStatus(order);
  if (persistedStatus) return READY_INVENTORY_STATUSES.has(persistedStatus);
  return isLegacyInventoryReady(order);
}

module.exports = {
  getPersistedInventoryStatus,
  getInventoryEvidence,
  isInventoryReadyForBilling,
  isHistoricallyPaidWithoutManagedInventory,
  isLegacyInventoryReady,
  resolveCompatibleInventoryStatus,
  resolveInitialInventoryStatus,
};
