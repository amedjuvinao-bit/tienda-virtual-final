'use strict';

const OrderEvent = require('../models/OrderEvent');
const {
  applyReservationToOrderDocument,
} = require('./orderInventoryAllocationService');
const {
  confirmInventoryReservation,
} = require('./inventoryReservationService');
const {
  applyUsageSnapshotToOrder,
  consumeReservedStoreCreditForOrder,
  reserveStoreCreditForOrder,
} = require('./storeCreditCheckoutService');

async function applyStoreCreditToNewOrder({
  order,
  cleaned,
  pricing,
  inventoryReservation,
  reservationRequired,
  session,
}) {
  if (cleaned.storeCredit?.apply !== true) {
    return { fullyPaidWithStoreCredit: false, storeCreditUsage: null };
  }

  const customerId = order.customer?.customerId;
  if (!customerId) {
    throw Object.assign(
      new Error(
        'No fue posible identificar la ficha del cliente para aplicar el saldo.'
      ),
      { code: 'STORE_CREDIT_CUSTOMER_REQUIRED', statusCode: 422 }
    );
  }

  const storeCreditUsage = await reserveStoreCreditForOrder(
    {
      order,
      customerId,
      sessionId: cleaned.sessionId,
      currency: order.payment?.currency || 'COP',
      requestedAmount: cleaned.storeCredit.amount,
      orderTotal: pricing.total,
      accessToken: cleaned.storeCredit.accessToken,
      expiresAt: inventoryReservation?.expiresAt,
    },
    { session }
  );

  const storeCreditAmount = Number(storeCreditUsage.amount || 0);
  const amountDue = Math.max(
    0,
    Math.round((pricing.total - storeCreditAmount + Number.EPSILON) * 100) / 100
  );
  const configuredProvider = String(order.payment?.provider || '')
    .trim()
    .toLowerCase();

  if (amountDue > 0 && configuredProvider !== 'wompi') {
    throw Object.assign(
      new Error(
        'El pago parcial con saldo a favor está disponible actualmente con Wompi.'
      ),
      { code: 'STORE_CREDIT_GATEWAY_UNSUPPORTED', statusCode: 409 }
    );
  }

  applyUsageSnapshotToOrder(order, storeCreditUsage, 'reserved');
  order.payment.amount = amountDue;
  order.payment.amountInCents = Math.round(amountDue * 100);
  order.payment.splitPayments = [
    {
      method: 'store_credit',
      methodLabel: 'Saldo a favor',
      amount: storeCreditAmount,
      reference: storeCreditUsage.allocations
        .map((item) => item.creditNumber)
        .join(', '),
    },
    ...(amountDue > 0
      ? [
          {
            method: configuredProvider,
            methodLabel: order.payment?.providerLabel || 'Wompi',
            amount: amountDue,
            reference: `ORDER-${order.orderNumber}`,
          },
        ]
      : []),
  ];

  await OrderEvent.create(
    [
      {
        orderId: order._id,
        type: 'store_credit_reserved',
        message: `Saldo a favor reservado por $${storeCreditAmount.toLocaleString(
          'es-CO'
        )}.`,
        meta: {
          usageId: storeCreditUsage._id,
          amount: storeCreditAmount,
          currency: storeCreditUsage.currency,
          amountDue,
          expiresAt: storeCreditUsage.expiresAt,
        },
      },
    ],
    { session }
  );

  let fullyPaidWithStoreCredit = false;
  if (amountDue <= 0) {
    const paidAt = new Date();
    const transactionId = `SC-${storeCreditUsage._id}`;
    order.payment.provider = 'store_credit';
    order.payment.providerLabel = 'Saldo a favor';
    order.payment.checkoutLabel = 'Saldo a favor';
    order.payment.enableWebhook = false;
    order.payment.status = 'paid';
    order.payment.methodType = 'store_credit';
    order.payment.method = 'store_credit';
    order.payment.methodLabel = 'Saldo a favor';
    order.payment.transactionId = transactionId;
    order.payment.reference = `ORDER-${order.orderNumber}`;
    order.payment.paidAt = paidAt;
    order.payment.receivedAmount = pricing.total;
    order.status = 'paid';

    let inventoryStatus = 'not_required';
    if (reservationRequired && inventoryReservation) {
      const confirmedReservation = await confirmInventoryReservation(
        inventoryReservation._id,
        {
          order: order._id,
          orderNumber: order.orderNumber,
          paymentReference: order.payment.reference,
          paymentTransactionId: transactionId,
        },
        { session, syncOrderAllocations: false }
      );
      applyReservationToOrderDocument(order, confirmedReservation);
      order.inventoryControl.discountedAtCheckout = true;
      inventoryStatus = 'confirmed';
    } else {
      order.inventoryControl.reservationRequired = false;
      order.inventoryControl.discountedAtCheckout = false;
    }

    order.paymentProcessing = {
      provider: 'store_credit',
      approvedTransactionId: transactionId,
      approvedAt: paidAt,
      inventory: {
        status: inventoryStatus,
        lastAttemptAt: paidAt,
        confirmedAt: paidAt,
        errorCode: '',
        errorMessage: '',
      },
      fulfillment: {
        status: 'pending',
        claimId: '',
        claimedAt: null,
        completedAt: null,
        outcomeCode: '',
        errorCode: '',
      },
      invoice: {
        status: 'pending',
        claimId: '',
        claimedAt: null,
        scheduledAt: null,
        transactionId,
        outcomeCode: '',
        errorCode: '',
      },
    };
    await consumeReservedStoreCreditForOrder(order, { session, now: paidAt });
    order.timeline = Array.isArray(order.timeline) ? order.timeline : [];
    order.timeline.push({
      type: 'system',
      message: 'Compra pagada completamente con saldo a favor.',
      by: 'store_credit_checkout',
      at: paidAt,
    });
    await OrderEvent.create(
      [
        {
          orderId: order._id,
          type: 'store_credit_consumed',
          message: 'Compra pagada completamente con saldo a favor.',
          meta: {
            usageId: storeCreditUsage._id,
            amount: storeCreditAmount,
            transactionId,
            inventoryStatus,
          },
        },
      ],
      { session }
    );
    fullyPaidWithStoreCredit = true;
  } else {
    order.payment.methodType = 'mixed';
    order.payment.method = 'mixed';
    order.payment.methodLabel = 'Saldo a favor + Wompi';
  }

  await order.save({ session });
  return { fullyPaidWithStoreCredit, storeCreditUsage };
}

module.exports = { applyStoreCreditToNewOrder };
