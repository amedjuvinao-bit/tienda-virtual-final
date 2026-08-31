'use strict';

const crypto = require('crypto');
const Order = require('../models/Order');
const {
  executeElectronicInvoiceAfterPayment,
} = require('./electronicInvoiceAfterPaymentService');
const {
  processOrderFulfillmentAfterPayment,
} = require('./orderFulfillmentService');
const {
  createWompiInvoiceSchedulingService,
} = require('./wompiInvoiceSchedulingService');

const DEFAULT_CLAIM_TIMEOUT_MS = 10 * 60 * 1000;

function clean(value, maximum = 120) {
  return String(value || '').trim().slice(0, maximum);
}

function normalizeProvider(value) {
  return clean(value, 40).toLowerCase();
}

function isFullyPaidStoreCreditOrder(order) {
  return (
    clean(order?.status, 40).toLowerCase() === 'paid' &&
    clean(order?.payment?.status, 40).toLowerCase() === 'paid' &&
    normalizeProvider(order?.payment?.provider) === 'store_credit' &&
    Number(order?.payment?.amount || 0) === 0 &&
    order?.storeCredit?.applied === true &&
    clean(order?.storeCredit?.status, 40).toLowerCase() === 'consumed'
  );
}

function buildStoreCreditTransaction(order) {
  return {
    id: clean(order?.payment?.transactionId, 120),
    reference: clean(order?.payment?.reference, 180),
    status: 'APPROVED',
    currency: clean(order?.payment?.currency || 'COP', 10).toUpperCase(),
    amount_in_cents: 0,
    payment_method_type: 'STORE_CREDIT',
  };
}

function ensurePaidOrderPostCommitState(
  order,
  {
    provider,
    transactionId,
    approvedAt = new Date(),
    inventoryStatus = '',
  } = {}
) {
  const safeProvider = normalizeProvider(provider || order?.payment?.provider);
  const safeTransactionId = clean(
    transactionId || order?.payment?.transactionId,
    120
  );
  if (!safeProvider || !safeTransactionId) {
    throw new TypeError('ORDER_POST_COMMIT_IDENTITY_REQUIRED');
  }

  const current =
    order?.paymentProcessing && typeof order.paymentProcessing === 'object'
      ? order.paymentProcessing
      : {};
  current.provider = safeProvider;
  current.approvedTransactionId = safeTransactionId;
  current.approvedAt = current.approvedAt || approvedAt;
  current.inventory =
    current.inventory && typeof current.inventory === 'object'
      ? current.inventory
      : {};
  if (!current.inventory.status && inventoryStatus) {
    current.inventory.status = clean(inventoryStatus, 40).toLowerCase();
  }
  current.fulfillment =
    current.fulfillment && typeof current.fulfillment === 'object'
      ? current.fulfillment
      : {};
  if (!current.fulfillment.status) current.fulfillment.status = 'pending';
  current.invoice =
    current.invoice && typeof current.invoice === 'object'
      ? current.invoice
      : {};
  if (!current.invoice.status) current.invoice.status = 'pending';
  if (!current.invoice.transactionId) {
    current.invoice.transactionId = safeTransactionId;
  }
  order.paymentProcessing = current;
  return current;
}

function createOrderCreationPostCommitService({
  OrderModel = Order,
  fulfillmentProcessor = processOrderFulfillmentAfterPayment,
  invoiceExecutor = executeElectronicInvoiceAfterPayment,
  invoiceSchedulingService,
  claimTimeoutMs = DEFAULT_CLAIM_TIMEOUT_MS,
  now = () => new Date(),
  randomUUID = () => crypto.randomUUID(),
  logger = console,
} = {}) {
  if (!OrderModel || typeof OrderModel.findOneAndUpdate !== 'function') {
    throw new TypeError('ORDER_POST_COMMIT_MODEL_REQUIRED');
  }
  if (typeof fulfillmentProcessor !== 'function') {
    throw new TypeError('ORDER_POST_COMMIT_FULFILLMENT_REQUIRED');
  }
  if (typeof invoiceExecutor !== 'function') {
    throw new TypeError('ORDER_POST_COMMIT_INVOICE_REQUIRED');
  }

  const invoiceScheduler =
    invoiceSchedulingService ||
    createWompiInvoiceSchedulingService({
      OrderModel,
      executeInvoiceAfterPayment: (options) =>
        invoiceExecutor({ ...options, processFulfillment: false }),
      claimTimeoutMs,
      now,
      randomUUID,
      logger,
    });

  function buildIdentity({ paymentProvider, transaction }) {
    const provider = normalizeProvider(
      paymentProvider || transaction?.provider || transaction?.payment_provider
    );
    const transactionId = clean(transaction?.id, 120);
    if (!provider || !transactionId) {
      throw new TypeError('ORDER_POST_COMMIT_IDENTITY_REQUIRED');
    }
    return { provider, transactionId };
  }

  function claimFence({ orderId, claimId, provider, transactionId }) {
    return {
      _id: orderId,
      'payment.status': 'paid',
      'payment.provider': provider,
      'payment.transactionId': transactionId,
      'paymentProcessing.provider': provider,
      'paymentProcessing.approvedTransactionId': transactionId,
      'paymentProcessing.fulfillment.claimId': claimId,
    };
  }

  async function persistFulfillmentOutcome({
    orderId,
    claimId,
    provider,
    transactionId,
    status,
    completedAt = null,
    outcomeCode = '',
    errorCode = '',
  }) {
    return OrderModel.updateOne(
      claimFence({ orderId, claimId, provider, transactionId }),
      {
        $set: {
          'paymentProcessing.fulfillment.status': status,
          'paymentProcessing.fulfillment.completedAt': completedAt,
          'paymentProcessing.fulfillment.outcomeCode': clean(outcomeCode, 100),
          'paymentProcessing.fulfillment.errorCode': clean(errorCode, 100),
        },
      }
    );
  }

  async function processFulfillmentOnce({
    orderId,
    transaction = {},
    paymentProvider = '',
  } = {}) {
    const { provider, transactionId } = buildIdentity({
      paymentProvider,
      transaction,
    });
    const claimedAt = now();
    const staleClaimBefore = new Date(claimedAt.getTime() - claimTimeoutMs);
    const claimId = randomUUID();
    const claimedOrder = await OrderModel.findOneAndUpdate(
      {
        _id: orderId,
        'payment.status': 'paid',
        'payment.provider': provider,
        'payment.transactionId': transactionId,
        'paymentProcessing.provider': provider,
        'paymentProcessing.approvedTransactionId': transactionId,
        'paymentProcessing.inventory.status': {
          $in: ['confirmed', 'not_required'],
        },
        $or: [
          { 'paymentProcessing.fulfillment.status': { $exists: false } },
          {
            'paymentProcessing.fulfillment.status': {
              $in: ['pending', 'failed'],
            },
          },
          {
            'paymentProcessing.fulfillment.status': 'processing',
            'paymentProcessing.fulfillment.claimedAt': {
              $lt: staleClaimBefore,
            },
          },
        ],
      },
      {
        $set: {
          'paymentProcessing.fulfillment.status': 'processing',
          'paymentProcessing.fulfillment.claimId': claimId,
          'paymentProcessing.fulfillment.claimedAt': claimedAt,
          'paymentProcessing.fulfillment.completedAt': null,
          'paymentProcessing.fulfillment.outcomeCode': '',
          'paymentProcessing.fulfillment.errorCode': '',
        },
      },
      { new: true }
    );

    if (!claimedOrder) return { processed: false, duplicate: true };

    try {
      const outcome = await fulfillmentProcessor({
        orderId,
        transaction,
        paymentProvider: provider,
      });
      if (outcome?.reason === 'payment_not_confirmed') {
        throw Object.assign(
          new Error('La entrega no reconoció el pago confirmado.'),
          {
            code:
              provider === 'store_credit'
                ? 'STORE_CREDIT_FULFILLMENT_PAYMENT_NOT_CONFIRMED'
                : 'PAYMENT_FULFILLMENT_PAYMENT_NOT_CONFIRMED',
          }
        );
      }
      if (outcome?.notificationInProgress === true) {
        const persistence = await persistFulfillmentOutcome({
          orderId,
          claimId,
          provider,
          transactionId,
          status: 'pending',
          outcomeCode: 'FULFILLMENT_NOTIFICATION_IN_PROGRESS',
        });
        return {
          processed: false,
          pending: true,
          retryable: true,
          superseded: !persistence?.matchedCount,
          claimId,
          outcome,
        };
      }
      if (outcome?.notified === false || outcome?.notificationError) {
        throw Object.assign(
          new Error(
            outcome?.notificationError ||
              'La notificación de entrega continúa pendiente.'
          ),
          {
            code:
              provider === 'store_credit'
                ? 'STORE_CREDIT_FULFILLMENT_NOTIFICATION_PENDING'
                : 'PAYMENT_FULFILLMENT_NOTIFICATION_PENDING',
          }
        );
      }

      const notRequired = outcome?.reason === 'no_digital_or_service_items';
      const persistence = await persistFulfillmentOutcome({
        orderId,
        claimId,
        provider,
        transactionId,
        status: notRequired ? 'not_required' : 'completed',
        completedAt: now(),
        outcomeCode: notRequired
          ? 'FULFILLMENT_NOT_REQUIRED'
          : outcome?.reused
            ? 'FULFILLMENT_REUSED'
            : 'FULFILLMENT_PROCESSED',
      });
      return {
        processed: Boolean(persistence?.matchedCount),
        superseded: !persistence?.matchedCount,
        notRequired,
        claimId,
        outcome,
      };
    } catch (error) {
      try {
        await persistFulfillmentOutcome({
          orderId,
          claimId,
          provider,
          transactionId,
          status: 'failed',
          errorCode:
            error?.code ||
            (provider === 'store_credit'
              ? 'STORE_CREDIT_FULFILLMENT_ERROR'
              : 'PAYMENT_FULFILLMENT_ERROR'),
        });
      } catch (persistenceError) {
        logger.error('No se pudo persistir el fallo de entrega post pago.', {
          orderId: String(orderId || ''),
          provider,
          code: persistenceError?.code || '',
        });
      }
      return {
        processed: false,
        failed: true,
        retryable: true,
        claimId,
        error,
      };
    }
  }

  async function processPaidOrderEffects({
    orderId,
    transaction = {},
    payments = {},
    paymentProvider = '',
  } = {}) {
    const { provider, transactionId } = buildIdentity({
      paymentProvider,
      transaction,
    });
    let fulfillment;
    try {
      fulfillment = await processFulfillmentOnce({
        orderId,
        transaction,
        paymentProvider: provider,
      });
    } catch (error) {
      logger.error('No fue posible reclamar la entrega post pago.', {
        orderId: String(orderId || ''),
        provider,
        code: error?.code || '',
      });
      fulfillment = { processed: false, failed: true, retryable: true, error };
    }

    let invoice;
    try {
      invoice = await invoiceScheduler.scheduleOnce({
        orderId,
        transaction,
        payments,
        paymentProvider: provider,
        approvedTransactionId: transactionId,
      });
    } catch (error) {
      logger.error('No fue posible completar la facturación post pago.', {
        orderId: String(orderId || ''),
        provider,
        code: error?.code || '',
      });
      invoice = { scheduled: false, failed: true, retryable: true, error };
    }

    return {
      processed: true,
      provider,
      transactionId,
      fulfillment,
      invoice,
      retryable:
        fulfillment?.retryable === true || invoice?.retryable === true,
    };
  }

  async function processFullyPaidStoreCreditOrder({
    order,
    paymentConfig = {},
  } = {}) {
    if (!isFullyPaidStoreCreditOrder(order)) {
      return {
        processed: false,
        skipped: true,
        reason: 'not_fully_paid_store_credit',
      };
    }
    return processPaidOrderEffects({
      orderId: order._id,
      transaction: buildStoreCreditTransaction(order),
      payments: paymentConfig || {},
      paymentProvider: 'store_credit',
    });
  }

  return Object.freeze({
    processFullyPaidStoreCreditOrder,
    processFulfillmentOnce,
    processPaidOrderEffects,
  });
}

const defaultService = createOrderCreationPostCommitService();

module.exports = {
  DEFAULT_CLAIM_TIMEOUT_MS,
  buildStoreCreditTransaction,
  createOrderCreationPostCommitService,
  ensurePaidOrderPostCommitState,
  isFullyPaidStoreCreditOrder,
  processFullyPaidStoreCreditOrder:
    defaultService.processFullyPaidStoreCreditOrder,
  processPaidOrderEffects: defaultService.processPaidOrderEffects,
};
