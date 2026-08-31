'use strict';

const { createApprovedProcessor } = require('./approved');
const {
  resolveWompiOrderDependencies,
} = require('./dependencies');
const { createNonApprovedProcessor } = require('./nonApproved');
const { createOrderTransactionRunner } = require('./orderTransaction');

function createWompiWebhookOrderService(config = {}) {
  const dependencies = resolveWompiOrderDependencies(config);
  const withOrderTransaction = createOrderTransactionRunner(dependencies);
  const processApproved = createApprovedProcessor(
    dependencies,
    withOrderTransaction
  );
  const processNonApproved = createNonApprovedProcessor(dependencies);

  return Object.freeze({
    paymentInventoryFailureService:
      dependencies.paymentInventoryFailureService,
    findPaymentAttempt: dependencies.findPaymentAttempt,
    processApproved,
    processNonApproved,
  });
}

module.exports = { createWompiWebhookOrderService };
