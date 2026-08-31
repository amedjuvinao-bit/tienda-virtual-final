'use strict';

const ORDER_POST_COMMIT_INDEX_DEFINITIONS = Object.freeze([
  Object.freeze({
    key: Object.freeze({
      'paymentProcessing.fulfillment.status': 1,
      'paymentProcessing.fulfillment.claimedAt': 1,
      'payment.status': 1,
      'paymentProcessing.inventory.status': 1,
      updatedAt: 1,
    }),
    options: Object.freeze({
      name: 'orders_postcommit_fulfillment_recovery',
    }),
  }),
  Object.freeze({
    key: Object.freeze({
      'paymentProcessing.invoice.status': 1,
      'paymentProcessing.invoice.claimedAt': 1,
      'payment.status': 1,
      'paymentProcessing.inventory.status': 1,
      updatedAt: 1,
    }),
    options: Object.freeze({
      name: 'orders_postcommit_invoice_recovery',
    }),
  }),
]);

module.exports = { ORDER_POST_COMMIT_INDEX_DEFINITIONS };
