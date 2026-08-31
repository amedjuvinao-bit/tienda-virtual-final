'use strict';

const {
  ensurePaidOrderPostCommitState,
} = require('../orderCreationPostCommitService');
const {
  resolveInitialInventoryStatus,
} = require('../orderInventoryBillingReadinessService');

async function processPayUWebhookTransaction({
  session,
  context,
  OrderModel,
  OrderEventModel,
  loadStoreCredit,
  claimApprovedAttempt,
  claimNonApprovedAttempt,
  fingerprintPaymentMerchant,
  syncReservationAfterPayU,
  buildPayUInvoiceTransaction,
}) {
  const {
    payload,
    payments,
    payu,
    reference,
    orderNumber,
    webhookAmount,
    webhookCurrency,
    mapped,
    transactionId,
    signatureAlgorithm,
    trimSafe,
  } = context;
  let shouldProcessPostCommit = false;
  let postCommitOrderId = null;
  let postCommitTransaction = null;
  let postCommitPayments = null;
  let responsePayload = null;

  await session.withTransaction(async () => {
    const freshOrder = await OrderModel.findOne({ orderNumber }).session(session);

    if (!freshOrder) {
      throw new Error(`ORDER_NOT_FOUND_TX_${orderNumber}`);
    }

    const beforeOrderStatus = String(freshOrder.status || '')
      .trim()
      .toLowerCase();
    const beforePaymentStatus = String(freshOrder.payment?.status || '')
      .trim()
      .toLowerCase();

    if (beforePaymentStatus === 'paid' && mapped.paymentStatus !== 'paid') {
      responsePayload = {
        ok: true,
        ignored: true,
        reason: 'ORDER_ALREADY_PAID_TX',
        orderNumber: freshOrder.orderNumber,
        paymentStatus: beforePaymentStatus,
      };
      return;
    }

    if (mapped.paymentStatus === 'paid') {
      const attemptClaim = await claimApprovedAttempt(
        {
          order: freshOrder,
          provider: 'payu',
          reference,
          transactionId,
          amountInCents: Math.round(webhookAmount * 100),
          currency: webhookCurrency,
          merchantFingerprint: fingerprintPaymentMerchant(
            'payu',
            `${payu.merchantId}:${payu.accountId}`
          ),
        },
        { session }
      );

      if (attemptClaim.duplicate === true) {
        const duplicateInventoryStatus = resolveInitialInventoryStatus(
          freshOrder,
          {
            wasApprovedBefore: true,
            hadPaymentProcessingBefore: Boolean(freshOrder.paymentProcessing),
          }
        );
        ensurePaidOrderPostCommitState(freshOrder, {
          provider: 'payu',
          transactionId,
          approvedAt: freshOrder.payment?.paidAt || new Date(),
          inventoryStatus: duplicateInventoryStatus,
        });
        await freshOrder.save({ session });
        shouldProcessPostCommit = true;
        postCommitOrderId = freshOrder._id;
        postCommitTransaction = buildPayUInvoiceTransaction({
          payload,
          transactionId,
          signatureAlgorithm,
        });
        postCommitPayments = payments;
        responsePayload = {
          ok: true,
          received: true,
          ignored: true,
          reason: attemptClaim.code || 'PAYMENT_ATTEMPT_DUPLICATE',
          orderNumber: freshOrder.orderNumber,
          orderStatus: freshOrder.status,
          paymentStatus: freshOrder.payment?.status || 'paid',
          transactionId: freshOrder.payment?.transactionId || transactionId,
          reference: freshOrder.payment?.reference || reference,
        };
        return;
      }

      if (attemptClaim.allowed !== true) {
        await freshOrder.save({ session });
        responsePayload = {
          ok: true,
          received: true,
          ignored: true,
          reconciliationRequired: true,
          reason: attemptClaim.code || 'PAYMENT_RECONCILIATION_REQUIRED',
          orderNumber: freshOrder.orderNumber,
          orderStatus: freshOrder.status,
          paymentStatus: freshOrder.payment?.status || beforePaymentStatus,
          transactionId,
          reference,
        };
        return;
      }
    } else {
      const attemptClaim = await claimNonApprovedAttempt(
        {
          order: freshOrder,
          provider: 'payu',
          reference,
          transactionId,
          amountInCents: Math.round(webhookAmount * 100),
          currency: webhookCurrency,
          providerStatus:
            trimSafe(payload.state_pol, 40) ||
            trimSafe(payload.response_code_pol, 80),
          paymentStatus: mapped.paymentStatus,
          merchantFingerprint: fingerprintPaymentMerchant(
            'payu',
            `${payu.merchantId}:${payu.accountId}`
          ),
        },
        { session }
      );

      if (attemptClaim.allowed !== true) {
        responsePayload = {
          ok: true,
          received: true,
          ignored: true,
          reason: attemptClaim.reason || 'PAYMENT_ATTEMPT_NOT_ACTIVE',
          orderNumber: freshOrder.orderNumber,
          orderStatus: freshOrder.status,
          paymentStatus: beforePaymentStatus,
          transactionId,
          reference,
        };
        return;
      }
    }

    if (!freshOrder.payment || typeof freshOrder.payment !== 'object') {
      freshOrder.payment = {
        active: true,
        provider: 'payu',
        providerLabel: 'PayU',
        mode: payments.mode || 'sandbox',
        currency: webhookCurrency || payments.currency || 'COP',
        checkoutLabel: 'PayU',
        enableWebhook: true,
        status: 'pending_gateway',
      };
    }

    freshOrder.payment.provider = 'payu';
    freshOrder.payment.providerLabel = freshOrder.payment.providerLabel || 'PayU';
    freshOrder.payment.mode = payments.mode || freshOrder.payment.mode || 'sandbox';
    freshOrder.payment.currency =
      webhookCurrency || freshOrder.payment.currency || 'COP';
    freshOrder.payment.enableWebhook = true;
    freshOrder.payment.status = mapped.paymentStatus;
    freshOrder.payment.methodType = trimSafe(payload.payment_method_type, 80);
    freshOrder.payment.method =
      trimSafe(payload.payment_method_name, 120) ||
      trimSafe(payload.payment_method, 120) ||
      trimSafe(payload.payment_method_id, 120);
    freshOrder.payment.methodLabel =
      trimSafe(payload.payment_method_name, 120) ||
      trimSafe(payload.payment_method, 120) ||
      '';
    freshOrder.payment.transactionId = transactionId;
    freshOrder.payment.reference = reference;
    freshOrder.payment.amount = webhookAmount;
    freshOrder.payment.amountInCents = Math.round(webhookAmount * 100);
    freshOrder.payment.paidAt =
      mapped.paymentStatus === 'paid'
        ? new Date(
            trimSafe(payload.transaction_date || payload.date, 80) || Date.now()
          )
        : null;
    freshOrder.payment.rawMethod = {
      state_pol: trimSafe(payload.state_pol, 40),
      response_code_pol: trimSafe(payload.response_code_pol, 120),
      response_message_pol: trimSafe(payload.response_message_pol, 180),
      reference_pol: trimSafe(payload.reference_pol, 120),
      transaction_id: transactionId,
      payment_method: trimSafe(payload.payment_method, 80),
      payment_method_type: trimSafe(payload.payment_method_type, 80),
      payment_method_name: trimSafe(payload.payment_method_name, 120),
      test: trimSafe(payload.test, 20),
      signatureAlgorithm,
    };

    if (mapped.orderStatus) freshOrder.status = mapped.orderStatus;

    await syncReservationAfterPayU({
      order: freshOrder,
      mapped,
      reference,
      transactionId,
      session,
    });

    if (mapped.paymentStatus === 'paid') {
      const inventoryStatus = resolveInitialInventoryStatus(freshOrder, {
        wasApprovedBefore: beforePaymentStatus === 'paid',
        hadPaymentProcessingBefore: Boolean(freshOrder.paymentProcessing),
      });
      ensurePaidOrderPostCommitState(freshOrder, {
        provider: 'payu',
        transactionId,
        approvedAt: freshOrder.payment?.paidAt || new Date(),
        inventoryStatus,
      });
    }

    if (freshOrder.storeCredit?.applied === true) {
      const {
        consumeReservedStoreCreditForOrder,
        releaseReservedStoreCreditForOrder,
      } = loadStoreCredit();
      let storeCreditResult = null;
      let eventType = '';
      let eventMessage = '';

      if (mapped.paymentStatus === 'paid') {
        storeCreditResult = await consumeReservedStoreCreditForOrder(freshOrder, {
          session,
        });
        eventType = 'store_credit_consumed';
        eventMessage = 'Saldo a favor aplicado definitivamente al pago.';
      } else if (
        mapped.paymentStatus === 'failed' ||
        mapped.paymentStatus === 'cancelled'
      ) {
        storeCreditResult = await releaseReservedStoreCreditForOrder(freshOrder, {
          session,
          reason:
            mapped.paymentStatus === 'cancelled'
              ? 'El pago restante fue cancelado en PayU.'
              : 'El pago restante fue rechazado por PayU.',
        });
        eventType = 'store_credit_released';
        eventMessage = 'El saldo a favor reservado volvió a quedar disponible.';
      }

      const changed =
        (storeCreditResult?.consumed === true ||
          storeCreditResult?.released === true) &&
        storeCreditResult?.duplicate !== true;
      if (changed) {
        await OrderEventModel.create(
          [
            {
              orderId: freshOrder._id,
              type: eventType,
              message: eventMessage,
              meta: {
                provider: 'store_credit',
                gatewayProvider: 'payu',
                amount: Number(storeCreditResult.usage?.amount || 0),
                currency: storeCreditResult.usage?.currency || 'COP',
                paymentStatus: mapped.paymentStatus,
              },
            },
          ],
          { session }
        );
      }
    }

    const afterOrderStatus = String(freshOrder.status || '')
      .trim()
      .toLowerCase();
    const afterPaymentStatus = String(freshOrder.payment?.status || '')
      .trim()
      .toLowerCase();

    freshOrder.timeline = Array.isArray(freshOrder.timeline)
      ? freshOrder.timeline
      : [];

    if (
      beforeOrderStatus !== afterOrderStatus ||
      beforePaymentStatus !== afterPaymentStatus
    ) {
      freshOrder.timeline.push({
        type: 'system',
        message: `PayU webhook validado: ${mapped.label}${transactionId ? ` · TX ${transactionId}` : ''}${webhookAmount ? ` · Valor ${webhookAmount}` : ''}`,
        by: 'payu_webhook',
        at: new Date(),
      });

      await OrderEventModel.create(
        [
          {
            orderId: freshOrder._id,
            type: 'payment_updated',
            message: `PayU webhook validado: ${mapped.label}`,
            meta: {
              by: 'payu_webhook',
              provider: 'payu',
              transactionId,
              reference,
              signatureAlgorithm,
              fromOrderStatus: beforeOrderStatus || null,
              toOrderStatus: afterOrderStatus || null,
              fromPaymentStatus: beforePaymentStatus || null,
              toPaymentStatus: afterPaymentStatus || null,
            },
          },
        ],
        { session }
      );
    }

    await freshOrder.save({ session });

    if (mapped.paymentStatus === 'paid') {
      shouldProcessPostCommit = true;
      postCommitOrderId = freshOrder._id;
      postCommitTransaction = buildPayUInvoiceTransaction({
        payload,
        transactionId,
        signatureAlgorithm,
      });
      postCommitPayments = payments;
    }

    responsePayload = {
      ok: true,
      received: true,
      provider: 'payu',
      orderNumber: freshOrder.orderNumber,
      orderStatus: freshOrder.status,
      paymentStatus: freshOrder.payment?.status || '',
      transactionId,
      reference,
      signatureAlgorithm,
    };
  });

  return {
    responsePayload,
    shouldProcessPostCommit,
    postCommitOrderId,
    postCommitTransaction,
    postCommitPayments,
  };
}

module.exports = {
  processPayUWebhookTransaction,
};
