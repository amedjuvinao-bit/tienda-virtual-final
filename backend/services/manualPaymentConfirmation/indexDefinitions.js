'use strict';

const MANUAL_PAYMENT_CONFIRMATION_INDEX_DEFINITIONS = Object.freeze([
  Object.freeze({
    key: Object.freeze({ order: 1 }),
    options: Object.freeze({
      unique: true,
      name: 'manual_payment_confirmation_order_unique',
    }),
  }),
  Object.freeze({
    key: Object.freeze({ provider: 1, referenceKey: 1 }),
    options: Object.freeze({
      unique: true,
      name: 'manual_payment_confirmation_reference_unique',
    }),
  }),
  Object.freeze({
    key: Object.freeze({ confirmedAt: -1 }),
    options: Object.freeze({
      name: 'manual_payment_confirmation_recent',
    }),
  }),
]);

module.exports = { MANUAL_PAYMENT_CONFIRMATION_INDEX_DEFINITIONS };
