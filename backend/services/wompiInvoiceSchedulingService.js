'use strict';

const crypto = require('crypto');

const DEFAULT_CLAIM_TIMEOUT_MS = 10 * 60 * 1000;

function clean(value, maximum = 120) {
  return String(value || '').trim().slice(0, maximum);
}

function createWompiInvoiceSchedulingService({
  OrderModel,
  executeInvoiceAfterPayment,
  claimTimeoutMs = DEFAULT_CLAIM_TIMEOUT_MS,
  now = () => new Date(),
  randomUUID = () => crypto.randomUUID(),
  logger = console,
} = {}) {
  if (!OrderModel) {
    throw new TypeError('WOMPI_INVOICE_ORDER_MODEL_REQUIRED');
  }
  if (typeof executeInvoiceAfterPayment !== 'function') {
    throw new TypeError('WOMPI_INVOICE_EXECUTOR_REQUIRED');
  }

  async function scheduleOnce({
    orderId,
    transaction = {},
    payments = {},
    paymentProvider = 'wompi',
    approvedTransactionId = '',
  } = {}) {
    const claimedAt = now();
    const staleClaimBefore = new Date(claimedAt.getTime() - claimTimeoutMs);
    const claimId = randomUUID();
    const provider = clean(paymentProvider, 40).toLowerCase();
    const transactionId = clean(
      approvedTransactionId || transaction?.id,
      120
    );
    if (!provider || !transactionId) {
      throw new TypeError('INVOICE_POST_COMMIT_IDENTITY_REQUIRED');
    }

    const identity = {
      _id: orderId,
      'payment.status': 'paid',
      'payment.provider': provider,
      'payment.transactionId': transactionId,
      'paymentProcessing.provider': provider,
      'paymentProcessing.approvedTransactionId': transactionId,
    };
    const claimedOrder = await OrderModel.findOneAndUpdate(
      {
        ...identity,
        'paymentProcessing.inventory.status': {
          $in: ['confirmed', 'not_required'],
        },
        $or: [
          { 'paymentProcessing.invoice.status': { $exists: false } },
          {
            'paymentProcessing.invoice.status': {
              $in: ['pending', 'failed'],
            },
          },
          {
            'paymentProcessing.invoice.status': 'scheduling',
            'paymentProcessing.invoice.claimedAt': { $lt: staleClaimBefore },
          },
        ],
      },
      {
        $set: {
          'paymentProcessing.invoice.status': 'scheduling',
          'paymentProcessing.invoice.claimId': claimId,
          'paymentProcessing.invoice.claimedAt': claimedAt,
          'paymentProcessing.invoice.transactionId': transactionId,
          'paymentProcessing.invoice.outcomeCode': '',
          'paymentProcessing.invoice.errorCode': '',
        },
      },
      { new: true }
    );

    if (!claimedOrder) return { scheduled: false, duplicate: true };

    const fence = {
      ...identity,
      'paymentProcessing.invoice.claimId': claimId,
    };
    try {
      const outcome = await executeInvoiceAfterPayment({
        orderId,
        transaction,
        payments,
        paymentProvider: provider,
        allowRetry: true,
      });

      if (outcome?.outcome === 'performed' && outcome.performed === true) {
        const persistence = await OrderModel.updateOne(fence, {
          $set: {
            'paymentProcessing.invoice.status': 'scheduled',
            'paymentProcessing.invoice.scheduledAt': now(),
            'paymentProcessing.invoice.outcomeCode': clean(
              outcome.reasonCode || 'INVOICE_PROCESSED',
              100
            ),
            'paymentProcessing.invoice.errorCode': '',
          },
        });
        return {
          scheduled: Boolean(persistence?.matchedCount),
          superseded: !persistence?.matchedCount,
          claimId,
          outcome,
        };
      }

      const terminalBusinessSkip =
        outcome?.outcome === 'skipped' &&
        outcome?.terminal === true &&
        outcome?.reasonCode === 'ELECTRONIC_BILLING_INACTIVE';
      const nextStatus = terminalBusinessSkip ? 'not_required' : 'pending';
      const persistence = await OrderModel.updateOne(fence, {
        $set: {
          'paymentProcessing.invoice.status': nextStatus,
          'paymentProcessing.invoice.scheduledAt': null,
          'paymentProcessing.invoice.outcomeCode': clean(
            outcome?.reasonCode || 'INVOICE_NOT_PERFORMED',
            100
          ),
          'paymentProcessing.invoice.errorCode': '',
        },
      });
      return {
        scheduled: false,
        skipped: outcome?.outcome === 'skipped',
        terminal: terminalBusinessSkip,
        pending: nextStatus === 'pending',
        retryable: nextStatus === 'pending',
        superseded: !persistence?.matchedCount,
        claimId,
        outcome,
      };
    } catch (error) {
      try {
        await OrderModel.updateOne(fence, {
          $set: {
            'paymentProcessing.invoice.status': 'failed',
            'paymentProcessing.invoice.scheduledAt': null,
            'paymentProcessing.invoice.outcomeCode': '',
            'paymentProcessing.invoice.errorCode': clean(
              error?.code || 'INVOICE_SCHEDULING_ERROR',
              100
            ),
          },
        });
      } catch (persistenceError) {
        logger.error(
          'No se pudo persistir el fallo de programación de factura post pago.',
          {
            orderId: String(orderId || ''),
            provider,
            code: persistenceError?.code || '',
          }
        );
      }
      throw error;
    }
  }

  return Object.freeze({ scheduleOnce });
}

module.exports = {
  DEFAULT_CLAIM_TIMEOUT_MS,
  createWompiInvoiceSchedulingService,
};
