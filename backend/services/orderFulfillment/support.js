'use strict';

function clean(value, maximum = 2000) {
  return String(value || '').trim().slice(0, maximum);
}

function getOrderItemProductId(item = {}) {
  return clean(item.product || item.productId, 80);
}

function deliveryIdentity(item = {}) {
  return clean(item.sourceKey || item.orderItemId, 240);
}

module.exports = {
  clean,
  deliveryIdentity,
  getOrderItemProductId,
};
