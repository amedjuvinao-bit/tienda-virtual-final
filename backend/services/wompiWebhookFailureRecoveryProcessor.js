'use strict';

const {
  isInventoryReadyForBilling,
  isLegacyInventoryReady,
} = require('./orderInventoryBillingReadinessService');
const { cleanText } = require('./wompiWebhookApprovalEvidence');
const {
  applyApprovedPaymentFact,
  asRetryableInventoryApprovalError,
  markInventoryConfirmed,
} = require('./wompiWebhookPaymentState');

function createWompiFailureRecoveryProcessor({
  reconcileFailureRecovery,
  confirmReservation,
  applyReservation,
  recordEvent,
  nowFactory,
} = {}) {
  return async function processFailureRecovery({
    order,
    context,
    transaction,
    payments,
    reference,
    verified,
  }) {
    if (typeof reconcileFailureRecovery !== 'function') {
      throw Object.assign(
        new Error(
          'La aprobacion requiere reconciliar una recuperacion de inventario previa.'
        ),
        {
          code: 'PAYMENT_FAILURE_RECONCILIATION_REQUIRED',
          retryable: true,
        }
      );
    }

    const paymentReference = reference || transaction?.reference || '';
    const paymentTransactionId = transaction?.id || '';
    const reconciliation = await reconcileFailureRecovery({
      order,
      provider: 'wompi',
      paymentReference,
      paymentTransactionId,
      session: context.session,
    });
    let reservation = reconciliation?.reservation || null;
    if (reconciliation?.action === 'reconcile_reservation') {
      try {
        reservation = await confirmReservation(
          reservation?._id || order?.inventoryControl?.reservationId,
          {
            order: order._id,
            orderNumber: order.orderNumber,
            paymentReference,
            paymentTransactionId,
          },
          { session: context.session, syncOrderAllocations: false }
        );
      } catch (error) {
        throw asRetryableInventoryApprovalError(error);
      }
      applyReservation(order, reservation);
      order.inventoryControl = order.inventoryControl || {};
      order.inventoryControl.discountedAtCheckout = true;
      const reservationConfirmed =
        cleanText(reservation?.status, 40).toLowerCase() === 'confirmed';
      if (!reservationConfirmed || !isLegacyInventoryReady(order)) {
        throw Object.assign(
          new Error(
            'La reserva reconciliada no quedo confirmada completamente.'
          ),
          {
            code: 'PAYMENT_FAILURE_RECONCILIATION_INCONSISTENT',
            retryable: true,
          }
        );
      }
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
    if (reconciliation?.action === 'reconcile_not_required') {
      order.inventoryControl.reservationRequired = false;
    }
    order.inventoryControl = order.inventoryControl || {};
    order.inventoryControl.restockedOnFailure = false;
    order.inventoryControl.restockedAt = null;
    if (reconciliation?.action !== 'reconcile_not_required') {
      order.inventoryControl.discountedAtCheckout = true;
    }
    markInventoryConfirmed(order, nowFactory());
    if (!isInventoryReadyForBilling(order)) {
      throw Object.assign(
        new Error('El inventario reconciliado no quedo listo para facturar.'),
        {
          code: 'PAYMENT_FAILURE_RECONCILIATION_NOT_READY',
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
      message: `Wompi webhook: Pago aprobado e inventario reconciliado${paymentTransactionId ? ` - TX ${paymentTransactionId}` : ''}`,
      by: 'wompi_webhook',
      at: nowFactory(),
    });
    await recordEvent(
      {
        orderId: order._id,
        type: 'inventory_reservation_confirmed',
        message: 'Recuperacion de inventario reconciliada por pago aprobado.',
        meta: {
          provider: 'wompi',
          transactionId: cleanText(paymentTransactionId, 120),
          reference: cleanText(paymentReference, 180),
          reconciliationAction: reconciliation?.action || '',
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
      reconciledFailureRecovery: true,
    };
  };
}

module.exports = { createWompiFailureRecoveryProcessor };
