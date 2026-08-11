'use strict';

const {
  applyVerifiedPaidAt,
  isVerifiedPaymentApproval,
} = require('./verifiedPaymentApprovalService');
const {
  isInventoryReadyForBilling,
  isLegacyInventoryReady,
  resolveInitialInventoryStatus,
} = require('./orderInventoryBillingReadinessService');

const INVENTORY_EXCEPTION_PREFIX =
  'Pago aprobado pendiente de confirmacion de inventario';

function cleanText(value, max = 500) {
  return String(value || '').trim().slice(0, max);
}

function asNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function isApprovedPayment(order = {}) {
  return cleanText(order?.payment?.status, 40).toLowerCase() === 'paid';
}

function ensurePaymentDocument(order, payments = {}) {
  if (!order.payment || typeof order.payment !== 'object') {
    order.payment = {};
  }

  order.payment.active = true;
  order.payment.provider = 'wompi';
  order.payment.providerLabel = order.payment.providerLabel || 'Wompi';
  order.payment.mode = payments.mode || order.payment.mode || 'sandbox';
  order.payment.currency = order.payment.currency || payments.currency || 'COP';
  order.payment.checkoutLabel = order.payment.checkoutLabel || 'Wompi';
  order.payment.enableWebhook = true;
  return order.payment;
}

function ensurePaymentProcessing(
  order,
  transaction = {},
  { wasApprovedBefore = false } = {}
) {
  const hadPaymentProcessingBefore = Boolean(order.paymentProcessing);
  if (!order.paymentProcessing || typeof order.paymentProcessing !== 'object') {
    order.paymentProcessing = {};
  }
  if (
    !order.paymentProcessing.inventory ||
    typeof order.paymentProcessing.inventory !== 'object'
  ) {
    order.paymentProcessing.inventory = {};
  }
  if (
    !order.paymentProcessing.invoice ||
    typeof order.paymentProcessing.invoice !== 'object'
  ) {
    order.paymentProcessing.invoice = {};
  }

  order.paymentProcessing.provider = 'wompi';
  if (!order.paymentProcessing.approvedTransactionId) {
    order.paymentProcessing.approvedTransactionId = cleanText(
      transaction?.id,
      120
    );
  }
  if (!order.paymentProcessing.inventory.status) {
    order.paymentProcessing.inventory.status =
      resolveInitialInventoryStatus(order, {
        wasApprovedBefore,
        hadPaymentProcessingBefore,
      });
  }
  if (!order.paymentProcessing.invoice.status) {
    order.paymentProcessing.invoice.status = 'pending';
  }

  return order.paymentProcessing;
}

function applyApprovedPaymentFact(
  order,
  transaction = {},
  payments = {},
  now = new Date(),
  { verified = false } = {}
) {
  const payment = ensurePaymentDocument(order, payments);
  const wasApproved = isApprovedPayment(order);

  payment.status = 'paid';

  if (!wasApproved || !payment.transactionId) {
    payment.transactionId = cleanText(transaction?.id, 120);
  }
  if (!wasApproved || !payment.reference) {
    payment.reference = cleanText(transaction?.reference, 180);
  }
  if (!wasApproved || !payment.amountInCents) {
    payment.amountInCents = Math.max(
      0,
      Math.round(asNumber(transaction?.amount_in_cents))
    );
    payment.amount = payment.amountInCents / 100;
  }

  const paidAtResult = applyVerifiedPaidAt(order, {
    verified,
    providerStatus: transaction?.status,
    normalizedPaymentStatus: payment.status,
    providerPaidAt: transaction?.finalized_at,
    now,
  });

  if (!wasApproved || !payment.methodType) {
    payment.methodType = cleanText(transaction?.payment_method_type, 80);
  }
  if (!wasApproved || !payment.method) {
    payment.method = cleanText(transaction?.payment_method?.type, 80);
  }
  if (!wasApproved || !payment.methodLabel) {
    payment.methodLabel =
      cleanText(transaction?.payment_method_type, 80) ||
      cleanText(transaction?.payment_method?.type, 80);
  }
  if (
    !wasApproved ||
    !payment.rawMethod ||
    !Object.keys(payment.rawMethod).length
  ) {
    payment.rawMethod = transaction?.payment_method || {};
  }

  const processing = ensurePaymentProcessing(order, transaction, {
    wasApprovedBefore: wasApproved,
  });
  if (!processing.approvedAt) {
    processing.approvedAt = paidAtResult.paidAt || now;
  }

  return { wasApproved, payment, paidAtResult, processing };
}

function resolveMonotonicWompiTransition(order = {}, mapped = {}) {
  const currentApproved = isApprovedPayment(order);
  const incomingPaymentStatus = cleanText(
    mapped?.paymentStatus,
    40
  ).toLowerCase();

  if (currentApproved && incomingPaymentStatus !== 'paid') {
    return {
      ignored: true,
      reason: 'APPROVED_IS_TERMINAL',
      paymentStatus: 'paid',
      orderStatus: order?.status || 'paid',
    };
  }

  return {
    ignored: false,
    reason: '',
    paymentStatus: incomingPaymentStatus,
    orderStatus: mapped?.orderStatus || null,
  };
}

function markInventoryConfirmationException(order, error, now = new Date()) {
  const code = cleanText(error?.code || 'INVENTORY_CONFIRMATION_ERROR', 100);
  const message = cleanText(
    error?.message || 'No se pudo confirmar la reserva.',
    300
  );
  const operationalMessage = `${INVENTORY_EXCEPTION_PREFIX}: ${code} - ${message}`;
  const processing = ensurePaymentProcessing(order);
  const previousCode = cleanText(processing.inventory.errorCode, 100);
  const previousMessage = cleanText(processing.inventory.errorMessage, 300);

  order.status = 'pending';
  processing.inventory.status = 'failed';
  processing.inventory.lastAttemptAt = now;
  processing.inventory.errorCode = code;
  processing.inventory.errorMessage = message;
  order.fulfillment = order.fulfillment || {};
  order.fulfillment.status = 'action_required';
  order.fulfillment.notificationError = operationalMessage;
  order.inventoryControl = order.inventoryControl || {};
  order.inventoryControl.discountedAtCheckout = false;
  order.inventoryControl.restockedOnFailure = false;
  order.inventoryControl.restockedAt = null;

  return {
    changed: previousCode !== code || previousMessage !== message,
    code,
    message,
    operationalMessage,
  };
}

function markInventoryConfirmed(order, now = new Date()) {
  const processing = ensurePaymentProcessing(order);
  processing.inventory.status =
    order?.inventoryControl?.reservationRequired === false
      ? 'not_required'
      : 'confirmed';
  processing.inventory.confirmedAt = now;
  processing.inventory.lastAttemptAt = now;
  processing.inventory.errorCode = '';
  processing.inventory.errorMessage = '';

  const currentError = cleanText(order?.fulfillment?.notificationError, 500);
  if (currentError.startsWith(INVENTORY_EXCEPTION_PREFIX)) {
    order.fulfillment.status = 'pending';
    order.fulfillment.notificationError = '';
  }
}

function createWompiWebhookIntegrityService(overrides = {}) {
  const withOrderTransaction = overrides.withOrderTransaction;
  const confirmReservation = overrides.confirmInventoryReservation;
  const applyReservation = overrides.applyReservationToOrderDocument;
  const createOrderEvent = overrides.createOrderEvent;
  const scheduleInvoiceOnce = overrides.scheduleInvoiceOnce;
  const nowFactory = overrides.now || (() => new Date());

  if (typeof withOrderTransaction !== 'function') {
    throw new TypeError('withOrderTransaction es obligatorio.');
  }
  if (typeof confirmReservation !== 'function') {
    throw new TypeError('confirmInventoryReservation es obligatorio.');
  }
  if (typeof applyReservation !== 'function') {
    throw new TypeError('applyReservationToOrderDocument es obligatorio.');
  }
  if (typeof scheduleInvoiceOnce !== 'function') {
    throw new TypeError('scheduleInvoiceOnce es obligatorio.');
  }

  async function recordEvent(event, context) {
    if (typeof createOrderEvent === 'function') {
      await createOrderEvent(event, context);
    }
  }

  async function processApproved({
    orderNumber,
    transaction = {},
    payments = {},
    reference = '',
    verified = false,
  } = {}) {
    if (
      !isVerifiedPaymentApproval({
        verified,
        providerStatus: transaction?.status,
        normalizedPaymentStatus: 'paid',
      })
    ) {
      const error = Object.assign(
        new Error('El proveedor no confirmo un pago aprobado verificable.'),
        { code: 'UNVERIFIED_PAYMENT_APPROVAL' }
      );
      return {
        ok: false,
        ignored: true,
        retryable: false,
        inventoryReady: false,
        invoiceEligible: false,
        error,
      };
    }

    const initial = await withOrderTransaction(
      orderNumber,
      async (order, context) => {
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
        const inventoryReady = isInventoryReadyForBilling(order);

        order.status = inventoryReady ? 'paid' : 'pending';

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

    if (initial.inventoryReady) {
      const invoice = await scheduleInvoiceOnce({
        orderId: initial.orderId,
        transaction,
        payments,
        paymentProvider: 'wompi',
      });

      return {
        ok: true,
        inventoryReady: true,
        invoiceEligible: true,
        invoiceScheduled: invoice?.scheduled === true,
        duplicateApproved: initial.wasApproved,
        orderId: initial.orderId,
        orderNumber: initial.orderNumber,
      };
    }

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
        {
          syncOrderAllocations: false,
        }
      );
    } catch (error) {
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
                  'Pago aprobado, pero no se pudo confirmar la reserva de inventario.',
                meta: {
                  provider: 'wompi',
                  orderNumber: order.orderNumber,
                  paymentStatus: 'paid',
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
          };
        }
      );

      if (failure.recoveredConcurrently) {
        const invoice = await scheduleInvoiceOnce({
          orderId: failure.orderId,
          transaction,
          payments,
          paymentProvider: 'wompi',
        });
        return {
          ok: true,
          inventoryReady: true,
          invoiceEligible: true,
          invoiceScheduled: invoice?.scheduled === true,
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
        error,
      };
    }

    const completed = await withOrderTransaction(
      orderNumber,
      async (order, context) => {
        const wasInventoryReady = isInventoryReadyForBilling(order);

        applyReservation(order, reservation);
        order.inventoryControl = order.inventoryControl || {};
        order.inventoryControl.discountedAtCheckout = true;
        order.inventoryControl.restockedOnFailure = false;
        order.inventoryControl.restockedAt = null;
        const reservationConfirmed =
          cleanText(reservation?.status, 40).toLowerCase() === 'confirmed';
        const allocationsConfirmed = isLegacyInventoryReady(order);

        if (!reservationConfirmed || !allocationsConfirmed) {
          const error = Object.assign(
            new Error(
              'La reserva se confirmo, pero sus asignaciones no quedaron listas para facturar.'
            ),
            { code: 'INVENTORY_CONFIRMATION_INCONSISTENT' }
          );
          const exception = markInventoryConfirmationException(
            order,
            error,
            nowFactory()
          );

          if (exception.changed) {
            await recordEvent(
              {
                orderId: order._id,
                type: 'inventory_reservation_error',
                message:
                  'La reserva confirmada no dejo asignaciones de inventario facturables.',
                meta: {
                  provider: 'wompi',
                  orderNumber: order.orderNumber,
                  paymentStatus: 'paid',
                  transactionId: cleanText(transaction?.id, 120),
                  reference: cleanText(
                    reference || transaction?.reference,
                    180
                  ),
                  code: error.code,
                  retryable: true,
                },
              },
              context
            );
          }

          return {
            orderId: order._id,
            orderNumber: order.orderNumber,
            inventoryReady: false,
            wasInventoryReady,
            error,
          };
        }

        markInventoryConfirmed(order, nowFactory());
        order.status = 'paid';

        if (!wasInventoryReady) {
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

        return {
          orderId: order._id,
          orderNumber: order.orderNumber,
          inventoryReady: isInventoryReadyForBilling(order),
          wasInventoryReady,
        };
      }
    );

    if (!completed.inventoryReady) {
      return {
        ok: false,
        retryable: true,
        inventoryReady: false,
        invoiceEligible: false,
        orderId: completed.orderId,
        orderNumber: completed.orderNumber,
        error: completed.error,
      };
    }

    const invoice = await scheduleInvoiceOnce({
      orderId: completed.orderId,
      transaction,
      payments,
      paymentProvider: 'wompi',
    });

    return {
      ok: true,
      inventoryReady: true,
      invoiceEligible: true,
      invoiceScheduled: invoice?.scheduled === true,
      inventoryConfirmedNow: !completed.wasInventoryReady,
      orderId: completed.orderId,
      orderNumber: completed.orderNumber,
    };
  }

  return { processApproved };
}

module.exports = {
  INVENTORY_EXCEPTION_PREFIX,
  applyApprovedPaymentFact,
  createWompiWebhookIntegrityService,
  isApprovedPayment,
  markInventoryConfirmationException,
  markInventoryConfirmed,
  resolveMonotonicWompiTransition,
};
