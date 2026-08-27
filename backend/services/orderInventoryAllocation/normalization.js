'use strict';

const {
  canonicalizeVariantKey,
  resolveVariantIdentity,
} = require('../../../shared/variantKeyAuthority.cjs');
const {
  asPlain,
  cleanText,
  idValue,
  toQuantity,
} = require('./support');

function allocationIdentity(allocation = {}) {
  const reservationItemId = idValue(allocation.reservationItem);
  if (reservationItemId) return `reservation-item:${reservationItemId}`;

  return [
    'stock',
    idValue(allocation.inventoryStock),
    idValue(allocation.product),
    canonicalizeVariantKey(allocation.variantKey) || 'default__default',
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
    variantKey: canonicalizeVariantKey(plain.variantKey) || plain.variantKey,
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
      Math.max(toQuantity(plain.reservedQuantity), quantity)
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

module.exports = {
  allocationIdentity,
  getAllocationStatus,
  normalizeAllocation,
};
