'use strict';

const {
  isInventoryReadyForBilling,
  isLegacyInventoryReady,
} = require('../orderInventoryBillingReadinessService');
const { cleanText } = require('../wompiWebhookApprovalEvidence');
const {
  applyApprovedPaymentFact,
  asRetryableInventoryApprovalError,
  markInventoryConfirmed,
} = require('../wompiWebhookPaymentState');

async function runInitialApprovedTransaction({
  dependencies,
  merchantFingerprint,
  orderNumber,
  payments,
  reference,
  transaction,
  verified,
}) {
  const {
    applyReservation,
    claimApprovedPaymentAttempt,
    confirmReservation,
    nowFactory,
    processFailureRecovery,
    recordEvent,
    withOrderTransaction,
  } = dependencies;

  return withOrderTransaction(
    orderNumber,
    async (order, context) => {
      const attemptClaim = await claimApprovedPaymentAttempt(
        {
          order,
          provider: 'wompi',
          reference: reference || transaction?.reference || '',
          transactionId: transaction?.id || '',
          amountInCents: transaction?.amount_in_cents,
          currency: transaction?.currency || '',
          merchantFingerprint,
        },
        { session: context.session }
      );
      if (!attemptClaim.allowed) {
        return {
          orderId: order._id,
          orderNumber: order.orderNumber,
          inventoryReady: false,
          invoiceEligible: false,
          reconciliationRequired: true,
          reconciliationCode: attemptClaim.code,
          reconciliationMessage: attemptClaim.message,
          duplicateReconciliation: attemptClaim.alreadyRecorded === true,
        };
      }

      const failureRecoveryRequired =
        order?.inventoryControl?.restockedOnFailure === true;
      if (failureRecoveryRequired) {
        return processFailureRecovery({
          order,
          context,
          transaction,
          payments,
          reference,
          verified,
        });
      }

      const beforeOrderStatus = cleanText(order.status, 40).toLowerCase();
      const beforePaymentStatus = cleanText(
        order?.payment?.status,
        40
      ).toLowerCase();
      const { wasApproved } = applyApprovedPaymentFact(
        order,
        transaction,
        payments,
        nowFactory(),
        { verified }
      );
      let inventoryReady = isInventoryReadyForBilling(order);
      if (!inventoryReady && wasApproved) {
        return {
          orderId: order._id,
          orderNumber: order.orderNumber,
          inventoryReady: false,
          wasApproved: true,
          needsInventoryRetry: true,
        };
      }
      if (!inventoryReady) {
        let reservation;
        try {
          reservation = await confirmReservation(
            order?.inventoryControl?.reservationId || orderNumber,
            {
              order: order._id,
              orderNumber: order.orderNumber,
              paymentReference: reference || transaction?.reference || '',
              paymentTransactionId: transaction?.id || '',
            },
            { session: context.session, syncOrderAllocations: false }
          );
        } catch (error) {
          throw asRetryableInventoryApprovalError(error);
        }
        applyReservation(order, reservation);
        order.inventoryControl = order.inventoryControl || {};
        order.inventoryControl.discountedAtCheckout = true;
        order.inventoryControl.restockedOnFailure = false;
        order.inventoryControl.restockedAt = null;
        if (
          cleanText(reservation?.status, 40).toLowerCase() !== 'confirmed' ||
          !isLegacyInventoryReady(order)
        ) {
          throw Object.assign(
            new Error('La reserva confirmada no dejo asignaciones facturables.'),
            {
              code: 'INVENTORY_CONFIRMATION_INCONSISTENT',
              retryable: true,
            }
          );
        }
        markInventoryConfirmed(order, nowFactory());
        inventoryReady = isInventoryReadyForBilling(order);
        if (!inventoryReady) {
          throw Object.assign(
            new Error('El inventario confirmado no quedo listo.'),
            {
              code: 'INVENTORY_CONFIRMATION_NOT_READY',
              retryable: true,
            }
          );
        }
        await recordEvent(
          {
            orderId: order._id,
            type: 'inventory_reservation_confirmed',
            message: 'Reserva de inventario confirmada por pago aprobado.',
            meta: {
              provider: 'wompi',
              orderNumber: order.orderNumber,
              reservationId: reservation?._id || null,
              reservationCode: reservation?.reservationCode || '',
              paymentReference: cleanText(
                reference || transaction?.reference,
                180
              ),
              paymentTransactionId: cleanText(transaction?.id, 120),
            },
          },
          context
        );
      }

      order.status = 'paid';
      const afterOrderStatus = cleanText(order.status, 40).toLowerCase();
      const afterPaymentStatus = cleanText(
        order?.payment?.status,
        40
      ).toLowerCase();
      if (
        beforeOrderStatus !== afterOrderStatus ||
        beforePaymentStatus !== afterPaymentStatus
      ) {
        order.timeline = Array.isArray(order.timeline) ? order.timeline : [];
        order.timeline.push({
          type: 'system',
          message: `Wompi webhook: Pago aprobado${transaction?.id ? ` - TX ${transaction.id}` : ''}`,
          by: 'wompi_webhook',
          at: nowFactory(),
        });
        await recordEvent(
          {
            orderId: order._id,
            type: 'payment_updated',
            message: 'Wompi webhook: Pago aprobado.',
            meta: {
              by: 'wompi_webhook',
              provider: 'wompi',
              transactionId: cleanText(transaction?.id, 120),
              reference: cleanText(
                reference || transaction?.reference,
                180
              ),
              fromOrderStatus: beforeOrderStatus || null,
              toOrderStatus: afterOrderStatus || null,
              fromPaymentStatus: beforePaymentStatus || null,
              toPaymentStatus: afterPaymentStatus || null,
            },
          },
          context
        );
      }
      return {
        orderId: order._id,
        orderNumber: order.orderNumber,
        inventoryReady,
        wasApproved,
      };
    }
  );
}

module.exports = { runInitialApprovedTransaction };
