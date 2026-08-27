'use strict';

function serializeRefundItem(item) {
  return {
    orderItemId: item.orderItemId,
    product: item.product,
    title: item.title,
    productType: item.productType,
    variantKey: item.variantKey,
    size: item.size,
    color: item.color,
    purchasedQuantity: item.purchasedQuantity,
    returnedQuantity: item.returnedQuantity,
    restockedQuantity: item.restockedQuantity,
  };
}

function safeRefundResponse(refund) {
  const value =
    typeof refund?.toObject === 'function'
      ? refund.toObject()
      : refund;
  return {
    _id: value?._id,
    refundNumber: value?.refundNumber,
    order: value?.order,
    orderNumber: value?.orderNumber,
    returnCase: value?.returnCase || null,
    idempotencyKey: value?.idempotencyKey,
    status: value?.status,
    amount: value?.amount,
    currency: value?.currency,
    reason: value?.reason,
    items: value?.items || [],
    inventoryRestorations: value?.inventoryRestorations || [],
    totalReturnedUnits: value?.totalReturnedUnits || 0,
    totalRestockedUnits: value?.totalRestockedUnits || 0,
    reconciliation: value?.reconciliation || {},
    processedAt: value?.processedAt || null,
    createdAt: value?.createdAt || null,
  };
}

module.exports = {
  safeRefundResponse,
  serializeRefundItem,
};
