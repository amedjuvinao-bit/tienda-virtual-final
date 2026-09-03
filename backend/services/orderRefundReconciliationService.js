'use strict';

const mongoose = require('mongoose');

const ElectronicInvoice = require('../models/ElectronicInvoice');
const Order = require('../models/Order');
const OrderRefund = require('../models/OrderRefund');
const {
  assertRefundAmountMatchesItems,
  assertRefundCreditNoteAmount,
  assertSupportedRefundPaymentSources,
} = require('./orderRefunds/refundPaymentIntegrity');
const OrderReturn = require('../models/OrderReturn');
const { recalculateCashSession } = require('./cashSessionService');
const {
  completePaymentStageManually,
} = require('./orderRefundAutomation/claims');

const RESOLVED_STAGE_STATES = new Set(['completed', 'not_required']);
const INVOICE_WITHOUT_FISCAL_EFFECT = new Set(['rejected', 'failed', 'error']);

function cleanText(value, max = 500) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function cleanLower(value, max = 500) {
  return cleanText(value, max).toLowerCase();
}

function toMoney(value) {
  const number = Number(value || 0);
  return Number.isFinite(number)
    ? Math.max(0, Math.round((number + Number.EPSILON) * 100) / 100)
    : 0;
}

function idValue(value) {
  if (!value) return '';
  if (typeof value?.toHexString === 'function') return value.toHexString();
  if (typeof value === 'object') return cleanText(value._id || value.id || '');
  return cleanText(value);
}

function createReconciliationError(message, code, statusCode = 400, details = {}) {
  return Object.assign(new Error(message), { code, statusCode, details });
}

function isValidatedInvoice(invoice = {}) {
  const status = cleanLower(invoice.status, 40);
  return (
    cleanLower(invoice?.provider?.name, 40) === 'factus' &&
    (invoice?.provider?.isValidated === true || ['accepted', 'validated'].includes(status))
  );
}

function stageState(stage = {}) {
  return cleanLower(stage.state, 40) || 'pending';
}

function deriveReconciliationState(reconciliation = {}) {
  const states = ['inventory', 'payment', 'cash', 'billing'].map((key) =>
    stageState(reconciliation[key])
  );

  if (states.every((state) => RESOLVED_STAGE_STATES.has(state))) return 'completed';
  if (states.some((state) => state === 'failed')) return 'failed';
  if (states.some((state) => state === 'action_required')) return 'action_required';
  return 'pending';
}

function pendingActions(reconciliation = {}) {
  const actions = [];
  const paymentState = stageState(reconciliation.payment);
  const cashState = stageState(reconciliation.cash);
  const billingState = stageState(reconciliation.billing);

  if (paymentState === 'action_required') actions.push('confirm_payment_reversal');
  if (paymentState === 'failed') actions.push('retry_payment_refund');
  if (paymentState === 'processing') actions.push('wait_payment_refund');
  if (billingState === 'action_required') actions.push('issue_credit_note');
  if (billingState === 'pending') actions.push('review_pending_invoice');
  if (cashState === 'failed') actions.push('retry_cash_reconciliation');
  if (billingState === 'failed') actions.push('retry_credit_note');
  return actions;
}

function billingStageForInvoice(invoice, currentStage = {}) {
  const currentState = stageState(currentStage);
  if (currentState === 'completed') return currentStage;

  const now = new Date();
  if (!invoice || INVOICE_WITHOUT_FISCAL_EFFECT.has(cleanLower(invoice.status, 40))) {
    return {
      state: 'not_required',
      reference: '',
      errorCode: '',
      errorMessage: '',
      lastAttemptAt: now,
      completedAt: now,
    };
  }

  if (isValidatedInvoice(invoice)) {
    if (['processing', 'failed'].includes(currentState)) return currentStage;
    return {
      state: 'action_required',
      reference: cleanText(invoice.invoiceNumber || invoice?.provider?.number, 220),
      errorCode: '',
      errorMessage: 'La factura validada requiere una nota crédito oficial.',
      lastAttemptAt: now,
      completedAt: null,
    };
  }

  return {
    state: 'pending',
    reference: cleanText(invoice.invoiceNumber || invoice?.provider?.number, 220),
    errorCode: '',
    errorMessage: 'La factura todavía no tiene un estado fiscal definitivo.',
    lastAttemptAt: now,
    completedAt: null,
  };
}

function isFullRefund(order = {}, totalRefunded = 0) {
  const total = toMoney(order.total || order?.pricing?.total || order?.payment?.amount);
  return total > 0 && toMoney(totalRefunded) >= total;
}

async function refreshOrderRefundReconciliation(refundId, options = {}) {
  const session = options.session || null;
  const refundQuery = OrderRefund.findById(refundId);
  if (session) refundQuery.session(session);
  const refund = await refundQuery;
  if (!refund) {
    throw createReconciliationError(
      'Reembolso no encontrado.',
      'ORDER_REFUND_NOT_FOUND',
      404
    );
  }

  const orderQuery = Order.findById(refund.order);
  const invoiceQuery = ElectronicInvoice.findOne({ orderId: refund.order }).sort({ createdAt: -1 });
  if (session) {
    orderQuery.session(session);
    invoiceQuery.session(session);
  }
  const [order, invoice] = await Promise.all([orderQuery, invoiceQuery]);
  if (!order) {
    throw createReconciliationError(
      'La orden del reembolso ya no existe.',
      'ORDER_NOT_FOUND',
      404
    );
  }

  const now = new Date();
  refund.reconciliation.inventory = {
    ...(refund.reconciliation?.inventory?.toObject?.() || refund.reconciliation?.inventory || {}),
    state: refund.status === 'processed' ? 'completed' : 'pending',
    reference: refund.refundNumber,
    errorCode: '',
    errorMessage: '',
    completedAt: refund.processedAt || null,
  };
  refund.reconciliation.billing = billingStageForInvoice(
    invoice,
    refund.reconciliation?.billing
  );
  refund.reconciliation.electronicInvoice = invoice?._id || null;

  if (order.cashSession) {
    try {
      await recalculateCashSession(order.cashSession, {
        session,
        requireOpen: true,
      });
      refund.reconciliation.cash = {
        ...(refund.reconciliation?.cash?.toObject?.() || refund.reconciliation?.cash || {}),
        state: 'completed',
        reference: idValue(order.cashSession),
        errorCode: '',
        errorMessage: '',
        lastAttemptAt: now,
        completedAt: now,
      };
      refund.reconciliation.cashSession = order.cashSession;
    } catch (error) {
      refund.reconciliation.cash = {
        ...(refund.reconciliation?.cash?.toObject?.() || refund.reconciliation?.cash || {}),
        state: 'failed',
        reference: idValue(order.cashSession),
        errorCode: cleanText(error?.code || 'CASH_RECONCILIATION_FAILED', 120),
        errorMessage: cleanText(error?.message || 'No se pudo recalcular la caja.', 500),
        lastAttemptAt: now,
        completedAt: null,
      };
      refund.reconciliation.cashSession = order.cashSession;
    }
  } else {
    refund.reconciliation.cash = {
      ...(refund.reconciliation?.cash?.toObject?.() || refund.reconciliation?.cash || {}),
      state: 'not_required',
      reference: '',
      errorCode: '',
      errorMessage: '',
      lastAttemptAt: now,
      completedAt: now,
    };
    refund.reconciliation.cashSession = null;
  }

  refund.reconciliation.lastReconciledAt = now;
  refund.reconciliation.state = deriveReconciliationState(refund.reconciliation);
  refund.reconciliation.completedAt =
    refund.reconciliation.state === 'completed'
      ? refund.reconciliation.completedAt || now
      : null;
  await refund.save(session ? { session } : undefined);

  const refundsQuery = OrderRefund.find({ order: order._id, status: 'processed' }).lean();
  if (session) refundsQuery.session(session);
  const processedRefunds = await refundsQuery;
  const totalRefunded = processedRefunds.reduce(
    (sum, item) => sum + toMoney(item.amount),
    0
  );
  const allResolved =
    processedRefunds.length > 0 &&
    processedRefunds.every(
      (item) => deriveReconciliationState(item.reconciliation || {}) === 'completed'
    );
  const actions = Array.from(
    new Set(processedRefunds.flatMap((item) => pendingActions(item.reconciliation || {})))
  );
  const aggregateState = allResolved
    ? 'completed'
    : processedRefunds.some(
        (item) => deriveReconciliationState(item.reconciliation || {}) === 'failed'
      )
      ? 'failed'
      : actions.length
        ? 'action_required'
        : 'pending';
  const orderUpdate = {
    'refundControl.reconciliationState': aggregateState,
    'refundControl.pendingActions': actions,
    'refundControl.lastReconciledAt': now,
  };

  if (allResolved && isFullRefund(order, totalRefunded)) {
    orderUpdate.status = 'refunded';
  }

  await Order.updateOne(
    { _id: order._id },
    { $set: orderUpdate },
    session ? { session } : undefined
  );

  if (refund.returnCase) {
    const resolutionState =
      refund.reconciliation.state === 'completed'
        ? 'completed'
        : refund.reconciliation.state === 'pending'
          ? 'pending'
          : 'action_required';
    await OrderReturn.updateOne(
      {
        _id: refund.returnCase,
        order: order._id,
        'resolution.refund': refund._id,
      },
      {
        $set: {
          'resolution.state': resolutionState,
          'resolution.completedAt':
            resolutionState === 'completed'
              ? refund.reconciliation.completedAt || now
              : null,
        },
      },
      session ? { session } : undefined
    );
  }

  return refund;
}

async function confirmRefundPaymentReversal(
  { orderId, refundId, reference, adminLabel = '' } = {},
  options = {}
) {
  const safeReference = cleanText(reference, 220);
  if (safeReference.length < 4) {
    throw createReconciliationError(
      'Registra una referencia verificable de la devolución del dinero.',
      'PAYMENT_REVERSAL_REFERENCE_REQUIRED',
      422
    );
  }

  const query = OrderRefund.findOne({ _id: refundId, order: orderId });
  if (options.session) query.session(options.session);
  const refund = await query;
  if (!refund) {
    throw createReconciliationError(
      'El reembolso no pertenece a la orden.',
      'ORDER_REFUND_NOT_FOUND',
      404
    );
  }

  const orderQuery = Order.findById(orderId);
  if (options.session) orderQuery.session(options.session);
  const order = await orderQuery;
  if (!order) {
    throw createReconciliationError(
      'Orden no encontrada.',
      'ORDER_NOT_FOUND',
      404
    );
  }
  assertSupportedRefundPaymentSources(order);
  assertRefundAmountMatchesItems({
    order,
    amount: refund.amount,
    items: refund.items,
  });

  const confirmation = await completePaymentStageManually(
    refund,
    safeReference,
    adminLabel,
    { session: options.session || null }
  );
  return refreshOrderRefundReconciliation(confirmation.refund._id, options);
}

async function linkRefundCreditNote(
  { orderId, refundId, invoice, creditNote, adminLabel = '' } = {},
  options = {}
) {
  const query = OrderRefund.findOne({ _id: refundId, order: orderId });
  if (options.session) query.session(options.session);
  const refund = await query;
  if (!refund) {
    throw createReconciliationError(
      'El reembolso indicado para la nota crédito no pertenece a la orden.',
      'ORDER_REFUND_NOT_FOUND',
      404
    );
  }

  const orderQuery = Order.findById(orderId);
  if (options.session) orderQuery.session(options.session);
  const order = await orderQuery;
  if (!order) {
    throw createReconciliationError(
      'Orden no encontrada.',
      'ORDER_NOT_FOUND',
      404
    );
  }
  assertSupportedRefundPaymentSources(order);
  assertRefundAmountMatchesItems({
    order,
    amount: refund.amount,
    items: refund.items,
  });

  const noteState = cleanLower(creditNote?.status || creditNote?.emission?.state, 40);
  if (!['sent', 'validated', 'completed'].includes(noteState)) {
    throw createReconciliationError(
      'La nota crédito todavía no tiene un resultado oficial conciliable.',
      'CREDIT_NOTE_NOT_COMPLETED',
      409
    );
  }
  assertRefundCreditNoteAmount(refund, creditNote);

  const now = new Date();
  const expectedClaimId = cleanText(options.expectedClaimId, 160);
  const reference = cleanText(
    creditNote?.provider?.number || creditNote?.referenceCode || creditNote?._id,
    220
  );

  if (expectedClaimId) {
    const fencedQuery = OrderRefund.findOneAndUpdate(
      {
        _id: refundId,
        order: orderId,
        'reconciliation.billing.state': 'processing',
        'reconciliation.billing.claimId': expectedClaimId,
      },
      {
        $set: {
          'reconciliation.billing.state': 'completed',
          'reconciliation.billing.reference': reference,
          'reconciliation.billing.errorCode': '',
          'reconciliation.billing.errorMessage': '',
          'reconciliation.billing.lastAttemptAt': now,
          'reconciliation.billing.completedAt': now,
          'reconciliation.billing.completedByLabel': cleanText(
            adminLabel || 'admin',
            160
          ),
          'reconciliation.electronicInvoice': invoice?._id || null,
          'reconciliation.creditNoteId': creditNote?._id || null,
        },
      },
      { new: true, runValidators: true }
    );
    if (options.session) fencedQuery.session(options.session);
    const fencedRefund = await fencedQuery;
    if (!fencedRefund) {
      throw createReconciliationError(
        'El intento de automatización fue reemplazado por un claim más reciente.',
        'REFUND_AUTOMATION_CLAIM_SUPERSEDED',
        409,
        { stage: 'billing' }
      );
    }
    return refreshOrderRefundReconciliation(fencedRefund._id, options);
  }

  refund.reconciliation.billing = {
    ...(refund.reconciliation?.billing?.toObject?.() || refund.reconciliation?.billing || {}),
    state: 'completed',
    reference,
    errorCode: '',
    errorMessage: '',
    lastAttemptAt: now,
    completedAt: now,
    completedByLabel: cleanText(adminLabel || 'admin', 160),
    claimId: '',
  };
  refund.reconciliation.electronicInvoice = invoice?._id || null;
  refund.reconciliation.creditNoteId = creditNote?._id || null;
  await refund.save(options.session ? { session: options.session } : undefined);
  return refreshOrderRefundReconciliation(refund._id, options);
}

async function listOrderRefunds(orderId) {
  return OrderRefund.find({ order: orderId })
    .select('-requestHash -idempotencyKey -inventoryRestorations -createdBy -__v')
    .sort({ createdAt: -1, _id: -1 })
    .lean();
}

module.exports = {
  RESOLVED_STAGE_STATES,
  billingStageForInvoice,
  confirmRefundPaymentReversal,
  createReconciliationError,
  deriveReconciliationState,
  isFullRefund,
  isValidatedInvoice,
  linkRefundCreditNote,
  listOrderRefunds,
  pendingActions,
  refreshOrderRefundReconciliation,
};
