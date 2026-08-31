'use strict';

function quantityOf(item) {
  return Number(item?.quantity ?? item?.qty ?? 0) || 0;
}

function resolveProductId(item) {
  return item?._id || item?.productId || item?.id || null;
}

function calculateItemsSummary(items) {
  const source = Array.isArray(items) ? items : [];
  let totalItems = 0;
  let subtotal = 0;

  for (const item of source) {
    const quantity = quantityOf(item);
    const price =
      Number(
        item?.price ??
          item?.unitPrice ??
          item?.priceNumber ??
          item?.product?.price ??
          0
      ) || 0;
    totalItems += quantity;
    subtotal += quantity * price;
  }

  return { totalItems, subtotal };
}

function normalizeOrderTags(input) {
  const values = Array.isArray(input) ? input : String(input || '').split(',');
  const normalized = values
    .map((tag) =>
      String(tag || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .slice(0, 24)
    )
    .filter(Boolean);

  return Array.from(new Set(normalized)).slice(0, 20);
}

module.exports = {
  calculateItemsSummary,
  normalizeOrderTags,
  quantityOf,
  resolveProductId,
};
