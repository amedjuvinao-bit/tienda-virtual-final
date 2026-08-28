'use strict';

const crypto = require('crypto');

const ORDER_CART_SNAPSHOT_HEADER = 'x-cart-snapshot-fingerprint';
const ORDER_CART_SNAPSHOT_VERSION = 1;

function clean(value, max = 1000) {
  return String(value || '').trim().slice(0, max);
}

function productIdOf(item = {}) {
  const raw = item.productId || item.product || item._id || item.id || '';
  if (raw && typeof raw === 'object') {
    return clean(raw._id || raw.id || raw, 80).toLowerCase();
  }
  return clean(raw, 80).toLowerCase();
}

function quantityOf(item = {}) {
  const value = Number(item.quantity ?? item.qty ?? 0);
  return Number.isInteger(value) ? Math.max(0, value) : 0;
}

function moneyInCents(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0
    ? Math.round(number * 100)
    : 0;
}

function normalizeAttributes(values = []) {
  return (Array.isArray(values) ? values : [])
    .map((attribute) => ({
      key: clean(attribute?.key, 80).toLowerCase(),
      value: clean(attribute?.value, 180),
    }))
    .filter((attribute) => attribute.key || attribute.value)
    .sort((left, right) =>
      `${left.key}\u0000${left.value}`.localeCompare(
        `${right.key}\u0000${right.value}`
      )
    );
}

function canonicalizeOrderCartSnapshot(items = []) {
  return (Array.isArray(items) ? items : [])
    .map((item) => ({
      productId: productIdOf(item),
      variantKey: clean(
        item?.variantKey || item?.variantId || 'default__default',
        180
      ).toLowerCase(),
      variantAttributes: normalizeAttributes(
        item?.variantAttributes || item?.attributes
      ),
      quantity: quantityOf(item),
      unitAmountInCents: moneyInCents(
        item?.price ?? item?.unitPrice ?? item?.priceNumber
      ),
      productType: clean(item?.productType || 'physical', 40).toLowerCase(),
      requiresShipping: item?.requiresShipping !== false,
    }))
    .sort((left, right) =>
      `${left.productId}\u0000${left.variantKey}`.localeCompare(
        `${right.productId}\u0000${right.variantKey}`
      )
    );
}

function createOrderCartSnapshotFingerprint(items = []) {
  const payload = {
    version: ORDER_CART_SNAPSHOT_VERSION,
    items: canonicalizeOrderCartSnapshot(items),
  };
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex');
}

function isValidOrderCartSnapshotFingerprint(value) {
  return /^[a-f0-9]{64}$/.test(clean(value, 80).toLowerCase());
}

function safeFingerprintEqual(left, right) {
  const safeLeft = clean(left, 80).toLowerCase();
  const safeRight = clean(right, 80).toLowerCase();
  if (
    !isValidOrderCartSnapshotFingerprint(safeLeft) ||
    !isValidOrderCartSnapshotFingerprint(safeRight)
  ) {
    return false;
  }
  return crypto.timingSafeEqual(
    Buffer.from(safeLeft, 'ascii'),
    Buffer.from(safeRight, 'ascii')
  );
}

module.exports = {
  ORDER_CART_SNAPSHOT_HEADER,
  ORDER_CART_SNAPSHOT_VERSION,
  canonicalizeOrderCartSnapshot,
  createOrderCartSnapshotFingerprint,
  isValidOrderCartSnapshotFingerprint,
  safeFingerprintEqual,
};
