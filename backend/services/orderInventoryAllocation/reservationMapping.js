'use strict';

const {
  allocationIdentity,
  normalizeAllocation,
} = require('./normalization');
const { summarizeInventoryAllocations } = require('./summary');
const {
  asPlain,
  cleanLower,
  toQuantity,
} = require('./support');

const RELEASED_RESERVATION_STATUSES = new Set([
  'released',
  'expired',
  'cancelled',
  'failed',
]);

function buildAllocationFromReservationItem({ reservation, item, existing = {} }) {
  const reservationPlain = asPlain(reservation);
  const itemPlain = asPlain(item);
  const current = normalizeAllocation(existing);
  const quantity = toQuantity(itemPlain.quantity);
  const reservationStatus = cleanLower(reservationPlain.status);
  const confirmed = reservationStatus === 'confirmed';
  const released = RELEASED_RESERVATION_STATUSES.has(reservationStatus);
  const reservedAt = current.reservedAt || reservationPlain.createdAt || new Date();
  const soldAt =
    current.soldAt ||
    itemPlain.confirmedAt ||
    reservationPlain.confirmedAt ||
    null;
  const releasedAt =
    current.releasedAt ||
    itemPlain.releasedAt ||
    reservationPlain.releasedAt ||
    reservationPlain.expiredAt ||
    reservationPlain.cancelledAt ||
    reservationPlain.failedAt ||
    null;

  return normalizeAllocation({
    ...current,
    reservation: reservationPlain._id || current.reservation || null,
    reservationItem: itemPlain._id || current.reservationItem || null,
    orderItem: itemPlain.orderItem || current.orderItem || null,
    inventoryStock: itemPlain.inventoryStock || current.inventoryStock || null,
    branch: itemPlain.branch || current.branch || null,
    branchSnapshot: itemPlain.branchSnapshot || current.branchSnapshot || {},
    product: itemPlain.product || current.product || null,
    productSnapshot: itemPlain.productSnapshot || current.productSnapshot || {},
    bundleParentProduct:
      itemPlain.bundleParentProduct || current.bundleParentProduct || null,
    bundleParentTitle: itemPlain.bundleParentTitle || current.bundleParentTitle || '',
    variantKey: itemPlain.variantKey || current.variantKey || 'default__default',
    variantLabel: itemPlain.variantLabel || current.variantLabel || '',
    variantAttributes:
      itemPlain.variantAttributes || current.variantAttributes || [],
    size: itemPlain.size || current.size || '',
    color: itemPlain.color || current.color || '',
    quantity,
    reservedQuantity: quantity,
    soldQuantity: confirmed ? quantity : current.soldQuantity,
    releasedQuantity: released ? quantity : current.releasedQuantity,
    shippedQuantity: current.shippedQuantity,
    deliveredQuantity: current.deliveredQuantity,
    returnedQuantity: current.returnedQuantity,
    reservedAt,
    soldAt: confirmed ? soldAt || new Date() : current.soldAt,
    releasedAt: released ? releasedAt || new Date() : current.releasedAt,
  });
}

function applyReservationToOrderDocument(order, reservation) {
  if (!order || !reservation) return order;

  const existing = Array.isArray(order.inventoryAllocations)
    ? order.inventoryAllocations
    : [];
  const existingByIdentity = new Map(
    existing.map((allocation) => [allocationIdentity(allocation), allocation])
  );
  const reservationPlain = asPlain(reservation);
  const next = (reservationPlain.items || []).map((item) => {
    const candidate = {
      reservationItem: item?._id,
      inventoryStock: item?.inventoryStock,
      product: item?.product,
      variantKey: item?.variantKey,
      bundleParentProduct: item?.bundleParentProduct,
      orderItem: item?.orderItem,
    };
    return buildAllocationFromReservationItem({
      reservation: reservationPlain,
      item,
      existing: existingByIdentity.get(allocationIdentity(candidate)) || {},
    });
  });

  order.inventoryAllocations = next;
  order.inventoryAllocationSummary = summarizeInventoryAllocations(next);
  return order;
}

module.exports = {
  buildAllocationFromReservationItem,
  applyReservationToOrderDocument,
};
