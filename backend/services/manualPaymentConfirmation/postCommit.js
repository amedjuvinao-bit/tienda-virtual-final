'use strict';

const {
  processPaidOrderEffects,
} = require('../orderCreationPostCommitService');

function buildApprovedManualTransaction(evidence) {
  return Object.freeze({
    id: String(evidence?._id || evidence?.id || ''),
    provider: 'manual',
    reference: String(evidence?.reference || ''),
    status: 'APPROVED',
    currency: String(evidence?.currency || '').toUpperCase(),
    amount_in_cents: Number(evidence?.amountInCents || 0),
    payment_method_type: String(evidence?.method || '').toUpperCase(),
  });
}

function createManualPaymentPostCommitProcessor(options = {}) {
  const durableProcessor =
    options.processPaidOrderEffects ||
    (typeof options.executeAfterPayment === 'function'
      ? async (payload) =>
          options.executeAfterPayment({
            ...payload,
            allowRetry: true,
            processFulfillment: true,
          })
      : processPaidOrderEffects);
  if (typeof durableProcessor !== 'function') {
    throw new TypeError('MANUAL_PAYMENT_POST_COMMIT_PROCESSOR_REQUIRED');
  }

  return async function processManualPaymentPostCommit({ orderId, evidence }) {
    return durableProcessor({
      orderId,
      transaction: buildApprovedManualTransaction(evidence),
      payments: {},
      paymentProvider: 'manual',
    });
  };
}

module.exports = {
  buildApprovedManualTransaction,
  createManualPaymentPostCommitProcessor,
};
