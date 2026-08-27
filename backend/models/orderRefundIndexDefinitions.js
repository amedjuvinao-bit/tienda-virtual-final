'use strict';

const ORDER_REFUND_INDEX_DEFINITIONS = Object.freeze([
  Object.freeze({
    key: Object.freeze({ refundNumber: 1 }),
    options: Object.freeze({ unique: true, name: 'refundNumber_1' }),
  }),
  Object.freeze({
    key: Object.freeze({ order: 1, idempotencyKey: 1 }),
    options: Object.freeze({
      unique: true,
      name: 'order_1_idempotencyKey_1',
    }),
  }),
  Object.freeze({
    key: Object.freeze({ order: 1, status: 1, createdAt: 1 }),
    options: Object.freeze({ name: 'order_1_status_1_createdAt_1' }),
  }),
  Object.freeze({
    key: Object.freeze({ order: 1, 'items.orderItemId': 1, status: 1 }),
    options: Object.freeze({ name: 'order_1_items.orderItemId_1_status_1' }),
  }),
  Object.freeze({
    key: Object.freeze({
      'reconciliation.state': 1,
      'reconciliation.lastReconciledAt': -1,
    }),
    options: Object.freeze({
      name: 'reconciliation.state_1_reconciliation.lastReconciledAt_-1',
    }),
  }),
]);

module.exports = { ORDER_REFUND_INDEX_DEFINITIONS };
