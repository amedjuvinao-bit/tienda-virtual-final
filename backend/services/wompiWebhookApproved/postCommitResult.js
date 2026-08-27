'use strict';

async function completeApprovedPostCommit({
  initial,
  payments,
  processPostCommitEffects,
  transaction,
}) {
  const postCommit = await processPostCommitEffects({
    orderId: initial.orderId,
    transaction,
    payments,
    paymentProvider: 'wompi',
  });

  if (postCommit?.retryable === true) {
    return {
      ok: false,
      retryable: true,
      postCommitPending: true,
      inventoryReady: true,
      invoiceEligible: true,
      duplicateApproved: initial.wasApproved,
      orderId: initial.orderId,
      orderNumber: initial.orderNumber,
      paymentStatus: 'paid',
      postCommit,
      error: Object.assign(
        new Error('Los efectos posteriores del pago requieren reintento.'),
        { code: 'PAYMENT_POST_COMMIT_RETRY_REQUIRED' }
      ),
    };
  }

  return {
    ok: true,
    inventoryReady: true,
    invoiceEligible: true,
    invoiceScheduled: postCommit?.invoice?.scheduled === true,
    fulfillmentCompleted:
      postCommit?.fulfillment?.processed === true ||
      postCommit?.fulfillment?.notRequired === true,
    postCommit,
    duplicateApproved: initial.wasApproved,
    orderId: initial.orderId,
    orderNumber: initial.orderNumber,
  };
}

module.exports = { completeApprovedPostCommit };
