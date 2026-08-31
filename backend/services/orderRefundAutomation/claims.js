'use strict';

const OrderRefund = require('../../models/OrderRefund');
const {
  claimedStageId,
  cleanText,
  createAutomationError,
  createClaimId,
  operationKey,
  stageState,
} = require('./helpers');

const AUTOMATION_LOCK_MS = 5 * 60 * 1000;

async function setClaimedStage(
  refundId,
  stage,
  claimId,
  values = {},
  { OrderRefundModel = OrderRefund } = {}
) {
  const prefix = `reconciliation.${stage}`;
  const set = {};
  for (const [key, value] of Object.entries(values)) {
    set[`${prefix}.${key}`] = value;
  }
  return OrderRefundModel.findOneAndUpdate(
    {
      _id: refundId,
      [`${prefix}.state`]: 'processing',
      [`${prefix}.claimId`]: cleanText(claimId, 160),
    },
    { $set: set },
    { new: true, runValidators: true }
  );
}

async function claimStage(
  refund,
  stage,
  {
    OrderRefundModel = OrderRefund,
    now = new Date(),
    claimId = createClaimId(),
  } = {}
) {
  const staleBefore = new Date(now.getTime() - AUTOMATION_LOCK_MS);
  const prefix = `reconciliation.${stage}`;
  const key = operationKey(refund, stage);
  return OrderRefundModel.findOneAndUpdate(
    {
      _id: refund._id,
      order: refund.order,
      $or: [
        { [`${prefix}.state`]: { $in: ['action_required', 'failed'] } },
        {
          [`${prefix}.state`]: 'processing',
          [`${prefix}.lastAttemptAt`]: { $lt: staleBefore },
        },
      ],
    },
    {
      $set: {
        [`${prefix}.state`]: 'processing',
        [`${prefix}.operationKey`]: key,
        [`${prefix}.claimId`]: cleanText(claimId, 160),
        [`${prefix}.errorCode`]: '',
        [`${prefix}.errorMessage`]: '',
        [`${prefix}.lastAttemptAt`]: now,
        [`${prefix}.completedAt`]: null,
        [`${prefix}.nextRetryAt`]: null,
      },
      $inc: { [`${prefix}.attempts`]: 1 },
    },
    { new: true, runValidators: true }
  );
}

async function supersededOutcome(
  refundId,
  stage,
  message,
  { OrderRefundModel = OrderRefund } = {}
) {
  const latest = await OrderRefundModel.findById(refundId);
  return {
    stage,
    state: stageState(latest, stage),
    skipped: true,
    superseded: true,
    message,
  };
}

async function completePaymentStageManually(
  refund,
  reference,
  adminLabel,
  {
    OrderRefundModel = OrderRefund,
    now = new Date(),
    session = null,
  } = {}
) {
  const safeReference = cleanText(reference, 220);
  let updateQuery = OrderRefundModel.findOneAndUpdate(
    {
      _id: refund._id,
      order: refund.order,
      'reconciliation.payment.state': {
        $in: ['pending', 'action_required', 'failed'],
      },
    },
    {
      $set: {
        'reconciliation.payment.state': 'completed',
        'reconciliation.payment.reference': safeReference,
        'reconciliation.payment.errorCode': '',
        'reconciliation.payment.errorMessage': '',
        'reconciliation.payment.lastAttemptAt': now,
        'reconciliation.payment.completedAt': now,
        'reconciliation.payment.completedByLabel': cleanText(
          adminLabel || 'admin',
          160
        ),
        'reconciliation.payment.claimId': '',
      },
    },
    { new: true, runValidators: true }
  );
  if (session && typeof updateQuery?.session === 'function') {
    updateQuery = updateQuery.session(session);
  }
  const completed = await updateQuery;
  if (completed) return { refund: completed, replayed: false };

  let latestQuery = OrderRefundModel.findOne({
    _id: refund._id,
    order: refund.order,
  });
  if (session && typeof latestQuery?.session === 'function') {
    latestQuery = latestQuery.session(session);
  }
  const latest = await latestQuery;
  if (!latest) {
    throw createAutomationError(
      'El reembolso no pertenece a la orden.',
      'ORDER_REFUND_NOT_FOUND',
      404
    );
  }

  const paymentState = stageState(latest, 'payment');
  if (paymentState === 'completed') {
    if (cleanText(latest.reconciliation.payment.reference, 220) !== safeReference) {
      throw createAutomationError(
        'La devolución del dinero ya fue confirmada con otra referencia.',
        'PAYMENT_REVERSAL_ALREADY_CONFIRMED',
        409
      );
    }
    return { refund: latest, replayed: true };
  }
  if (paymentState === 'processing') {
    throw createAutomationError(
      'Hay una devolución automática vigente. Espera su resultado antes de confirmar manualmente.',
      'PAYMENT_REVERSAL_AUTOMATION_IN_PROGRESS',
      409
    );
  }
  throw createAutomationError(
    'El estado de la devolución cambió mientras se confirmaba el movimiento.',
    'PAYMENT_REVERSAL_STATE_CHANGED',
    409
  );
}

module.exports = {
  AUTOMATION_LOCK_MS,
  claimStage,
  claimedStageId,
  completePaymentStageManually,
  setClaimedStage,
  supersededOutcome,
};
