'use strict';

const SHIPPING_OPERATION_INDEX_DEFINITIONS = Object.freeze([
  Object.freeze({
    key: Object.freeze({ idempotencyKey: 1 }),
    options: Object.freeze({ unique: true, name: 'idempotencyKey_1' }),
  }),
  Object.freeze({
    key: Object.freeze({ order: 1, shipmentId: 1, createdAt: -1 }),
    options: Object.freeze({ name: 'order_1_shipmentId_1_createdAt_-1' }),
  }),
  Object.freeze({
    key: Object.freeze({ status: 1 }),
    options: Object.freeze({ name: 'status_1' }),
  }),
  Object.freeze({
    key: Object.freeze({ returnCase: 1, createdAt: -1 }),
    options: Object.freeze({
      name: 'returnCase_1_createdAt_-1',
      partialFilterExpression: Object.freeze({
        scope: 'return',
        returnCase: Object.freeze({ $type: 'objectId' }),
      }),
    }),
  }),
  Object.freeze({
    key: Object.freeze({ returnCase: 1, activeLock: 1 }),
    options: Object.freeze({
      unique: true,
      name: 'returnCase_1_activeLock_1',
      partialFilterExpression: Object.freeze({
        scope: 'return',
        activeLock: true,
        returnCase: Object.freeze({ $type: 'objectId' }),
      }),
    }),
  }),
]);

module.exports = { SHIPPING_OPERATION_INDEX_DEFINITIONS };
