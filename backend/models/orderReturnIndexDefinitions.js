'use strict';

const ORDER_RETURN_CREATION_IDEMPOTENCY_INDEX_NAME =
  'order_return_creation_idempotency_unique';

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

module.exports = {
  ORDER_RETURN_CREATION_IDEMPOTENCY_INDEX_NAME,
  orderReturnCreationIdempotencyIndexDefinition,
};
