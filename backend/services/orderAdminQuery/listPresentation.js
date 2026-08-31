'use strict';

function definedEntries(entries) {
  return Object.fromEntries(entries.filter(([, value]) => value !== undefined));
}

function record(value) {
  return value && typeof value === 'object' ? value : {};
}

function presentIdentifier(value) {
  if (value == null) return value;
  if (typeof value !== 'object' || typeof value.toHexString === 'function') {
    return value;
  }
  return definedEntries([
    ['_id', value._id],
    ['id', value.id],
    ['name', value.name],
    ['code', value.code],
    ['type', value.type],
  ]);
}

function presentCustomer(customer = {}) {
  customer = record(customer);
  return definedEntries([
    ['name', customer.name],
    ['lastname', customer.lastname],
    ['emailOrPhone', customer.emailOrPhone],
    ['email', customer.email],
    ['phone', customer.phone],
  ]);
}

function presentBranchSnapshot(snapshot = {}) {
  snapshot = record(snapshot);
  return definedEntries([
    ['name', snapshot.name],
    ['code', snapshot.code],
    ['type', snapshot.type],
  ]);
}

function presentVariantAttribute(attribute = {}) {
  attribute = record(attribute);
  return definedEntries([
    ['key', attribute.key],
    ['label', attribute.label],
    ['value', attribute.value],
  ]);
}

function presentProduct(product) {
  if (product == null) return product;
  if (typeof product !== 'object' || typeof product.toHexString === 'function') {
    return product;
  }
  return definedEntries([
    ['_id', product._id],
    ['title', product.title],
    ['price', product.price],
    ['image', product.image],
    ['slug', product.slug],
    ['sku', product.sku],
  ]);
}

function presentItem(item = {}) {
  item = record(item);
  return definedEntries([
    ['_id', item._id],
    ['product', presentProduct(item.product)],
    ['productId', item.productId],
    ['title', item.title],
    ['image', item.image],
    ['color', item.color],
    ['colorLabel', item.colorLabel],
    ['size', item.size],
    ['qty', item.qty],
    ['quantity', item.quantity],
    ['price', item.price],
    ['unitPrice', item.unitPrice],
    ['priceNumber', item.priceNumber],
    ['variantId', item.variantId],
    ['variantKey', item.variantKey],
    ['variantLabel', item.variantLabel],
    [
      'variantAttributes',
      Array.isArray(item.variantAttributes)
        ? item.variantAttributes.map(presentVariantAttribute)
        : undefined,
    ],
    ['variantSku', item.variantSku],
    ['variantBarcode', item.variantBarcode],
    ['productType', item.productType],
    ['requiresShipping', item.requiresShipping],
    ['fulfillmentKind', item.fulfillmentKind],
  ]);
}

function presentAllocation(allocation = {}) {
  allocation = record(allocation);
  return definedEntries([
    ['branch', presentIdentifier(allocation.branch)],
    ['branchSnapshot', presentBranchSnapshot(allocation.branchSnapshot)],
    ['soldQuantity', allocation.soldQuantity],
    ['returnedQuantity', allocation.returnedQuantity],
  ]);
}

function presentPayment(payment = {}) {
  payment = record(payment);
  return definedEntries([
    ['provider', payment.provider],
    ['providerLabel', payment.providerLabel],
    ['status', payment.status],
    ['method', payment.method],
    ['methodLabel', payment.methodLabel],
    ['currency', payment.currency],
  ]);
}

function presentExchangeOrigin(exchangeOrigin) {
  if (!exchangeOrigin || typeof exchangeOrigin !== 'object') return undefined;
  return definedEntries([
    ['type', exchangeOrigin.type],
    ['originalOrderNumber', exchangeOrigin.originalOrderNumber],
    ['returnNumber', exchangeOrigin.returnNumber],
    ['noCharge', exchangeOrigin.noCharge],
  ]);
}

function presentSummary(summary = {}) {
  summary = record(summary);
  return {
    itemsCount: Number(summary.itemsCount || 0),
    totalItems: Number(summary.totalItems || 0),
    subtotal: Number(summary.subtotal || 0),
  };
}

function presentAdminOrderListItem(
  order = {},
  { items, summary, operational } = {}
) {
  order = record(order);
  const safeItems = (Array.isArray(items) ? items : []).map(presentItem);
  const safeSummary = presentSummary(summary);

  return definedEntries([
    ['_id', order._id],
    ['orderNumber', order.orderNumber],
    ['status', order.status],
    ['source', order.source],
    ['channel', order.channel],
    ['saleType', order.saleType],
    ['total', Number(order.total || 0)],
    ['subtotal', Number(order.subtotal ?? safeSummary.subtotal ?? 0)],
    ['shipping', Number(order.shipping || 0)],
    ['customer', presentCustomer(order.customer)],
    ['payment', presentPayment(order.payment)],
    ['pos', definedEntries([['receiptNumber', order?.pos?.receiptNumber]])],
    ['exchangeOrigin', presentExchangeOrigin(order.exchangeOrigin)],
    ['tags', Array.isArray(order.tags) ? order.tags.map(String) : []],
    ['printed', Boolean(order.printed)],
    ['archived', Boolean(order.archived)],
    ['branch', presentIdentifier(order.branch)],
    ['branchSnapshot', presentBranchSnapshot(order.branchSnapshot)],
    [
      'inventoryAllocations',
      (Array.isArray(order.inventoryAllocations)
        ? order.inventoryAllocations
        : []
      ).map(presentAllocation),
    ],
    ['items', safeItems],
    ['itemsCount', safeItems.length],
    ['summary', safeSummary],
    ['totalItems', safeSummary.totalItems],
    ['operational', operational],
    ['createdAt', order.createdAt],
    ['updatedAt', order.updatedAt],
  ]);
}

module.exports = {
  presentAdminOrderListItem,
  presentAllocation,
  presentCustomer,
  presentItem,
};
