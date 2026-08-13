'use strict';

const Order = require('../models/Order');
const InventoryReservation = require('../models/InventoryReservation');
const {
  normalizeVariantKey,
  resolveVariantIdentity,
} = require('../../shared/variantKeyAuthority.cjs');

const RELEASED_RESERVATION_STATUSES = new Set([
  'released',
  'expired',
  'cancelled',
  'failed',
]);

function cleanText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function cleanLower(value) {
  return cleanText(value).toLowerCase();
}

function idValue(value) {
  if (!value) return '';
  if (typeof value === 'object') {
    return String(value._id || value.id || value);
  }
  return String(value);
}

function toQuantity(value) {
  const quantity = Math.floor(Number(value || 0));
  return Number.isFinite(quantity) ? Math.max(0, quantity) : 0;
}

function asPlain(value) {
  if (!value) return {};
  return typeof value.toObject === 'function'
    ? value.toObject({ depopulate: true })
    : value;
}

function allocationIdentity(allocation = {}) {
  const reservationItemId = idValue(allocation.reservationItem);
  if (reservationItemId) return `reservation-item:${reservationItemId}`;

  return [
    'stock',
    idValue(allocation.inventoryStock),
    idValue(allocation.product),
    normalizeVariantKey(allocation.variantKey) || 'default__default',
    idValue(allocation.bundleParentProduct),
    idValue(allocation.orderItem),
  ].join(':');
}

function getAllocationStatus(allocation = {}) {
  const quantity = toQuantity(allocation.quantity);
  const sold = Math.min(quantity, toQuantity(allocation.soldQuantity));
  const shipped = Math.min(sold, toQuantity(allocation.shippedQuantity));
  const delivered = Math.min(shipped, toQuantity(allocation.deliveredQuantity));
  const returned = Math.min(sold, toQuantity(allocation.returnedQuantity));
  const released = Math.min(quantity, toQuantity(allocation.releasedQuantity));

  if (sold > 0 && returned >= sold) return 'returned';
  if (returned > 0) return 'partially_returned';
  if (delivered >= sold && sold > 0) return 'delivered';
  if (delivered > 0) return 'partially_delivered';
  if (shipped >= sold && sold > 0) return 'shipped';
  if (shipped > 0) return 'partially_shipped';
  if (sold > 0) return 'sold';
  if (released >= quantity && quantity > 0) return 'released';
  return 'reserved';
}

function normalizeAllocation(allocation = {}) {
  const plain = asPlain(allocation);
  const variantIdentity = resolveVariantIdentity({
    variantKey: plain.variantKey,
    size: plain.size,
    color: plain.color,
    attributes: plain.variantAttributes || [],
  });
  const quantity = toQuantity(plain.quantity);
  const soldQuantity = Math.min(quantity, toQuantity(plain.soldQuantity));
  const shippedQuantity = Math.min(
    soldQuantity,
    toQuantity(plain.shippedQuantity)
  );
  const deliveredQuantity = Math.min(
    shippedQuantity,
    toQuantity(plain.deliveredQuantity)
  );
  const returnedQuantity = Math.min(
    soldQuantity,
    toQuantity(plain.returnedQuantity)
  );
  const releasedQuantity = Math.min(
    quantity,
    toQuantity(plain.releasedQuantity)
  );

  const normalized = {
    ...plain,
    reservation: plain.reservation || null,
    reservationItem: plain.reservationItem || null,
    orderItem: plain.orderItem || null,
    inventoryStock: plain.inventoryStock || null,
    branch: plain.branch || null,
    branchSnapshot: plain.branchSnapshot || {},
    product: plain.product || null,
    productSnapshot: plain.productSnapshot || {},
    bundleParentProduct: plain.bundleParentProduct || null,
    bundleParentTitle: cleanText(plain.bundleParentTitle),
    variantKey: variantIdentity.variantKey,
    variantLabel: cleanText(plain.variantLabel),
    variantAttributes: variantIdentity.attributes,
    size: variantIdentity.size,
    color: variantIdentity.color,
    quantity,
    reservedQuantity: Math.min(
      quantity,
      Math.max(
        toQuantity(plain.reservedQuantity),
        quantity
      )
    ),
    soldQuantity,
    shippedQuantity,
    deliveredQuantity,
    returnedQuantity,
    releasedQuantity,
    reservedAt: plain.reservedAt || null,
    soldAt: plain.soldAt || null,
    shippedAt: plain.shippedAt || null,
    deliveredAt: plain.deliveredAt || null,
    releasedAt: plain.releasedAt || null,
    lastReturnedAt: plain.lastReturnedAt || null,
  };

  normalized.status = getAllocationStatus(normalized);
  return normalized;
}

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

  const summary = normalized.reduce(
    (result, allocation) => {
      result.totalQuantity += allocation.quantity;
      result.reservedQuantity += allocation.reservedQuantity;
      result.activeReservedQuantity +=
        allocation.status === 'reserved'
          ? allocation.quantity
          : 0;
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

  return summary;
}

function buildAllocationFromReservationItem({
  reservation,
  item,
  existing = {},
}) {
  const reservationPlain = asPlain(reservation);
  const itemPlain = asPlain(item);
  const current = normalizeAllocation(existing);
  const quantity = toQuantity(itemPlain.quantity);
  const reservationStatus = cleanLower(reservationPlain.status);
  const confirmed = reservationStatus === 'confirmed';
  const released = RELEASED_RESERVATION_STATUSES.has(
    reservationStatus
  );
  const reservedAt =
    current.reservedAt ||
    reservationPlain.createdAt ||
    new Date();
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
    inventoryStock:
      itemPlain.inventoryStock || current.inventoryStock || null,
    branch: itemPlain.branch || current.branch || null,
    branchSnapshot:
      itemPlain.branchSnapshot || current.branchSnapshot || {},
    product: itemPlain.product || current.product || null,
    productSnapshot:
      itemPlain.productSnapshot || current.productSnapshot || {},
    bundleParentProduct:
      itemPlain.bundleParentProduct ||
      current.bundleParentProduct ||
      null,
    bundleParentTitle:
      itemPlain.bundleParentTitle ||
      current.bundleParentTitle ||
      '',
    variantKey:
      itemPlain.variantKey ||
      current.variantKey ||
      'default__default',
    variantLabel:
      itemPlain.variantLabel || current.variantLabel || '',
    variantAttributes:
      itemPlain.variantAttributes ||
      current.variantAttributes ||
      [],
    size: itemPlain.size || current.size || '',
    color: itemPlain.color || current.color || '',
    quantity,
    reservedQuantity: quantity,
    soldQuantity: confirmed
      ? quantity
      : current.soldQuantity,
    releasedQuantity: released
      ? quantity
      : current.releasedQuantity,
    shippedQuantity: current.shippedQuantity,
    deliveredQuantity: current.deliveredQuantity,
    returnedQuantity: current.returnedQuantity,
    reservedAt,
    soldAt: confirmed ? soldAt || new Date() : current.soldAt,
    releasedAt: released
      ? releasedAt || new Date()
      : current.releasedAt,
  });
}

function applyReservationToOrderDocument(order, reservation) {
  if (!order || !reservation) return order;

  const existing = Array.isArray(order.inventoryAllocations)
    ? order.inventoryAllocations
    : [];
  const existingByIdentity = new Map(
    existing.map((allocation) => [
      allocationIdentity(allocation),
      allocation,
    ])
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
      existing:
        existingByIdentity.get(allocationIdentity(candidate)) || {},
    });
  });

  order.inventoryAllocations = next;
  order.inventoryAllocationSummary =
    summarizeInventoryAllocations(next);
  return order;
}

async function syncOrderInventoryAllocationsFromReservation(
  reservation,
  {
    orderId = null,
    session = null,
    OrderModel = Order,
  } = {}
) {
  const resolvedOrderId =
    idValue(orderId) || idValue(reservation?.order);
  if (!resolvedOrderId) return null;

  const order = await OrderModel.findById(resolvedOrderId).session(
    session
  );
  if (!order) return null;

  applyReservationToOrderDocument(order, reservation);
  await order.save({ session });
  return order;
}

async function hydrateOrderInventoryAllocations(
  order,
  {
    session = null,
    InventoryReservationModel = InventoryReservation,
  } = {}
) {
  if (
    !order ||
    (Array.isArray(order.inventoryAllocations) &&
      order.inventoryAllocations.length > 0)
  ) {
    return order;
  }

  const reservationId = idValue(
    order?.inventoryControl?.reservationId
  );
  const orderId = idValue(order?._id);
  const orderNumber = cleanText(order?.orderNumber);
  const filter = reservationId
    ? { _id: reservationId }
    : {
        $or: [
          ...(orderId ? [{ order: orderId }] : []),
          ...(orderNumber ? [{ orderNumber }] : []),
        ],
      };

  if (!reservationId && filter.$or.length === 0) {
    return order;
  }

  const reservation = await InventoryReservationModel.findOne(
    filter
  )
    .sort({ confirmedAt: -1, createdAt: -1 })
    .session(session);

  if (reservation) {
    applyReservationToOrderDocument(order, reservation);
  }

  return order;
}

function advanceOrderInventoryAllocations(
  order,
  targetStatus,
  at = new Date()
) {
  if (!order) return order;
  const normalizedStatus = cleanLower(targetStatus);
  if (!['shipped', 'delivered'].includes(normalizedStatus)) {
    return order;
  }

  const allocations = (
    Array.isArray(order.inventoryAllocations)
      ? order.inventoryAllocations
      : []
  ).map((allocation) => {
    const next = normalizeAllocation(allocation);
    const fulfillableQuantity = Math.max(
      0,
      next.soldQuantity - next.returnedQuantity
    );

    if (normalizedStatus === 'shipped') {
      next.shippedQuantity = Math.max(
        next.shippedQuantity,
        fulfillableQuantity
      );
      next.shippedAt = next.shippedAt || at;
    }

    if (normalizedStatus === 'delivered') {
      next.shippedQuantity = Math.max(
        next.shippedQuantity,
        fulfillableQuantity
      );
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
  order.inventoryAllocationSummary =
    summarizeInventoryAllocations(allocations);
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
  if (!['shipped', 'delivered'].includes(normalizedStatus)) {
    return order;
  }

  const selectedIds = new Set(
    (Array.isArray(allocationIds) ? allocationIds : [])
      .map(idValue)
      .filter(Boolean)
  );
  if (!selectedIds.size) return order;

  const allocations = (
    Array.isArray(order.inventoryAllocations)
      ? order.inventoryAllocations
      : []
  ).map((allocation) => {
    const next = normalizeAllocation(allocation);
    if (!selectedIds.has(idValue(allocation?._id))) return next;

    const fulfillableQuantity = Math.max(
      0,
      next.soldQuantity - next.returnedQuantity
    );

    next.shippedQuantity = Math.max(
      next.shippedQuantity,
      fulfillableQuantity
    );
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
  order.inventoryAllocationSummary =
    summarizeInventoryAllocations(allocations);
  return order;
}

function applyReturnsToOrderInventoryAllocations(
  order,
  restorations = [],
  at = new Date()
) {
  if (!order || !Array.isArray(restorations) || !restorations.length) {
    return order;
  }

  const allocations = (
    Array.isArray(order.inventoryAllocations)
      ? order.inventoryAllocations
      : []
  ).map(normalizeAllocation);

  for (const restoration of restorations) {
    let remaining = toQuantity(restoration.quantity);
    if (!remaining) continue;

    const exactReservationItem = idValue(
      restoration.reservationItem
    );
    const stockId = idValue(restoration.inventoryStock);
    const productId = idValue(restoration.product);
    const branchId = idValue(restoration.branch);
    const variantKey =
      normalizeVariantKey(restoration.variantKey) || 'default__default';

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
        normalizeVariantKey(allocation.variantKey) === variantKey
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
  order.inventoryAllocationSummary =
    summarizeInventoryAllocations(allocations);
  return order;
}

module.exports = {
  allocationIdentity,
  getAllocationStatus,
  normalizeAllocation,
  summarizeInventoryAllocations,
  applyReservationToOrderDocument,
  syncOrderInventoryAllocationsFromReservation,
  hydrateOrderInventoryAllocations,
  advanceOrderInventoryAllocations,
  advanceOrderInventoryAllocationsForShipment,
  applyReturnsToOrderInventoryAllocations,
};
