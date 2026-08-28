'use strict';

const ORDER_RETURN_CREATION_IDEMPOTENCY_INDEX_NAME =
  'order_return_creation_idempotency_unique';
const ORDER_RETURN_SHIPPING_TRACKING_INDEX_NAME =
  'order_return_shipping_tracking_lookup';

function orderReturnCreationIdempotencyIndexDefinition() {
  return {
    key: {
      order: 1,
      creationIdempotencyScope: 1,
      creationIdempotencyKey: 1,
    },
    options: {
      unique: true,
      partialFilterExpression: {
        creationIdempotencyScope: { $type: 'string' },
        creationIdempotencyKey: { $type: 'string' },
      },
      name: ORDER_RETURN_CREATION_IDEMPOTENCY_INDEX_NAME,
    },
  };
}

function orderReturnShippingTrackingIndexDefinition() {
  return {
    key: { 'shipping.trackingNumber': 1 },
    options: {
      partialFilterExpression: {
        'shipping.trackingNumber': { $type: 'string', $gt: '' },
      },
      name: ORDER_RETURN_SHIPPING_TRACKING_INDEX_NAME,
    },
  };
}

function orderReturnIndexDefinitions() {
  return [
    orderReturnCreationIdempotencyIndexDefinition(),
    orderReturnShippingTrackingIndexDefinition(),
  ];
}

module.exports = {
  ORDER_RETURN_CREATION_IDEMPOTENCY_INDEX_NAME,
  ORDER_RETURN_SHIPPING_TRACKING_INDEX_NAME,
  orderReturnIndexDefinitions,
  orderReturnCreationIdempotencyIndexDefinition,
  orderReturnShippingTrackingIndexDefinition,
};
