'use strict';

const PAYMENT_ATTEMPT_INDEX_DEFINITIONS = Object.freeze([
  Object.freeze({
    key: Object.freeze({ provider: 1, reference: 1 }),
    options: Object.freeze({
      unique: true,
      name: 'payment_attempt_provider_reference_unique',
    }),
  }),
  Object.freeze({
    key: Object.freeze({ order: 1, active: 1 }),
    options: Object.freeze({
      unique: true,
      partialFilterExpression: Object.freeze({ active: true }),
      name: 'payment_attempt_one_active_per_order',
    }),
  }),
  Object.freeze({
    key: Object.freeze({ order: 1, createdAt: -1 }),
    options: Object.freeze({ name: 'payment_attempt_order_recent' }),
  }),
  Object.freeze({
    key: Object.freeze({ 'reconciliation.required': 1, updatedAt: 1 }),
    options: Object.freeze({
      partialFilterExpression: Object.freeze({
        'reconciliation.required': true,
      }),
      name: 'payment_attempt_reconciliation_queue',
    }),
  }),
]);

module.exports = { PAYMENT_ATTEMPT_INDEX_DEFINITIONS };
