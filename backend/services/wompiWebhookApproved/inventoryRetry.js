'use strict';

const {
  isInventoryReadyForBilling,
  isLegacyInventoryReady,
} = require('../orderInventoryBillingReadinessService');
const { cleanText } = require('../wompiWebhookApprovalEvidence');
const {
  applyApprovedPaymentFact,
  asRetryableInventoryApprovalError,
  isRetryableInventoryApprovalError,
  markInventoryConfirmed,
} = require('../wompiWebhookPaymentState');

async function retryApprovedInventory({
  dependencies,
  initial,
  orderNumber,
  payments,
  persistInventoryFailure,
  reference,
  transaction,
  verified,
}) {
  const {
    applyReservation,
    confirmReservation,
    nowFactory,
    recordEvent,
    withOrderTransaction,
  } = dependencies;
  let reservation;
  try {
    reservation = await confirmReservation(
      orderNumber,
      {
        order: initial.orderId,
        orderNumber: initial.orderNumber,
        paymentReference: reference || transaction?.reference || '',
        paymentTransactionId: transaction?.id || '',
      },
      { syncOrderAllocations: false }
    );
  } catch (error) {
    return {
      terminal: true,
      result: await persistInventoryFailure(
        asRetryableInventoryApprovalError(error)
      ),
    };
  }

  try {
    const retriedInitial = await withOrderTransaction(
      orderNumber,
      async (order, context) => {
        if (order?.inventoryControl?.restockedOnFailure === true) {
          throw Object.assign(
            new Error(
              'La recuperacion por pago fallido debe reconciliarse antes de aprobar.'
            ),
            {
              code: 'PAYMENT_FAILURE_RECONCILIATION_REQUIRED',
              retryable: true,
            }
          );
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
            new Error(
              'La reserva reintentada no dejo asignaciones facturables.'
            ),
            {
              code: 'INVENTORY_CONFIRMATION_INCONSISTENT',
              retryable: true,
            }
          );
        }
        markInventoryConfirmed(order, nowFactory());
        if (!isInventoryReadyForBilling(order)) {
          throw Object.assign(
            new Error('El inventario reintentado no quedo listo.'),
            {
              code: 'INVENTORY_CONFIRMATION_NOT_READY',
              retryable: true,
            }
          );
        }
        order.status = 'paid';
        const afterOrderStatus = cleanText(order.status, 40).toLowerCase();
        const afterPaymentStatus = cleanText(
          order?.payment?.status,
          40
        ).toLowerCase();
        order.timeline = Array.isArray(order.timeline) ? order.timeline : [];
        order.timeline.push({
          type: 'system',
          message: `Wompi webhook: Inventario reintentado para pago aprobado${transaction?.id ? ` - TX ${transaction.id}` : ''}`,
          by: 'wompi_webhook',
          at: nowFactory(),
        });
        await recordEvent(
          {
            orderId: order._id,
            type: 'inventory_reservation_confirmed',
            message: 'Reserva confirmada al reintentar un pago ya aprobado.',
            meta: {
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
        return {
          orderId: order._id,
          orderNumber: order.orderNumber,
          inventoryReady: true,
          wasApproved,
        };
      }
    );
    return { terminal: false, initial: retriedInitial };
  } catch (error) {
    if (!isRetryableInventoryApprovalError(error)) throw error;
    return {
      terminal: true,
      result: await persistInventoryFailure(error),
    };
  }
}

module.exports = { retryApprovedInventory };
