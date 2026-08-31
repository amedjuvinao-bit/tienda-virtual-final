'use strict';

async function finalizePayUWebhookResponse({
  transactionResult,
  processPostCommitEffects,
}) {
  const {
    responsePayload,
    shouldProcessPostCommit,
    postCommitOrderId,
    postCommitTransaction,
    postCommitPayments,
  } = transactionResult;

  if (shouldProcessPostCommit && postCommitOrderId) {
    const postCommit = await processPostCommitEffects({
      orderId: postCommitOrderId,
      transaction: postCommitTransaction,
      payments: postCommitPayments,
      paymentProvider: 'payu',
    });
    if (responsePayload && postCommit?.retryable === true) {
      responsePayload.postCommitRetryRequired = true;
    }
  }

  return {
    status: responsePayload?.postCommitRetryRequired === true ? 503 : 200,
    body: responsePayload,
  };
}

function buildPayUWebhookErrorResponse(error) {
  const retryable = error?.retryable === true || error?.statusCode === 503;
  return {
    status: retryable ? 503 : 500,
    body: {
      ok: false,
      error: retryable
        ? error.code || 'PAYU_INVENTORY_RETRY_REQUIRED'
        : 'PAYU_WEBHOOK_ERROR',
      message: error.message || 'No se pudo procesar la confirmación de PayU.',
    },
  };
}

function sendPayUWebhookResponse(res, responsePayload) {
  return res.status(responsePayload.status).json(responsePayload.body);
}

module.exports = {
  buildPayUWebhookErrorResponse,
  finalizePayUWebhookResponse,
  sendPayUWebhookResponse,
};
