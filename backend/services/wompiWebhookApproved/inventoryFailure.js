'use strict';

const {
  isInventoryReadyForBilling,
} = require('../orderInventoryBillingReadinessService');
const { cleanText } = require('../wompiWebhookApprovalEvidence');
const {
  markInventoryConfirmationException,
} = require('../wompiWebhookPaymentState');

function createInventoryFailurePersister({
  dependencies,
  orderNumber,
  payments,
  reference,
  transaction,
}) {
  const {
    nowFactory,
    processPostCommitEffects,
    recordEvent,
    withOrderTransaction,
  } = dependencies;

  return async function persistInventoryFailure(error) {
    const failure = await withOrderTransaction(
      orderNumber,
      async (order, context) => {
        if (isInventoryReadyForBilling(order)) {
          return {
            recoveredConcurrently: true,
            orderId: order._id,
            orderNumber: order.orderNumber,
          };
        }
        const exception = markInventoryConfirmationException(
          order,
          error,
          nowFactory()
        );
        if (exception.changed) {
          order.timeline = Array.isArray(order.timeline) ? order.timeline : [];
          order.timeline.push({
            type: 'system',
            message: exception.operationalMessage,
            by: 'wompi_webhook',
            at: nowFactory(),
          });
          await recordEvent(
            {
              orderId: order._id,
              type: 'inventory_reservation_error',
              message:
                'La aprobacion verificada requiere reintentar la confirmacion de inventario.',
              meta: {
                provider: 'wompi',
                orderNumber: order.orderNumber,
                transactionId: cleanText(transaction?.id, 120),
                reference: cleanText(
                  reference || transaction?.reference,
                  180
                ),
                error: exception.message,
                code: exception.code,
                retryable: true,
              },
            },
            context
          );
        }
        return {
          recoveredConcurrently: false,
          orderId: order._id,
          orderNumber: order.orderNumber,
          paymentStatus: cleanText(order?.payment?.status, 40).toLowerCase(),
        };
      }
    );

    if (failure.recoveredConcurrently) {
      const postCommit = await processPostCommitEffects({
        orderId: failure.orderId,
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
          orderId: failure.orderId,
          orderNumber: failure.orderNumber,
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
        recoveredConcurrently: true,
        orderId: failure.orderId,
        orderNumber: failure.orderNumber,
      };
    }
    return {
      ok: false,
      retryable: true,
      inventoryReady: false,
      invoiceEligible: false,
      orderId: failure.orderId,
      orderNumber: failure.orderNumber,
      paymentStatus: failure.paymentStatus,
      error,
    };
  };
}

module.exports = { createInventoryFailurePersister };
