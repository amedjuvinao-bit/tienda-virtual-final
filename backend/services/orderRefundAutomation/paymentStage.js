'use strict';

const OrderRefund = require('../../models/OrderRefund');
const {
  claimStage,
  claimedStageId,
  setClaimedStage,
  supersededOutcome,
} = require('./claims');
const { cleanText, createAutomationError, stageState } = require('./helpers');

async function markPaymentFailure(refundId, claimId, error, OrderRefundModel) {
  const now = new Date();
  const failed = await setClaimedStage(refundId, 'payment', claimId, {
    state: 'failed',
    errorCode: cleanText(error?.code || 'PAYMENT_AUTOMATION_FAILED', 120),
    errorMessage: cleanText(
      error?.message || 'No se pudo automatizar la devolución del dinero.',
      500
    ),
    providerStatus: cleanText(error?.details?.providerStatus, 80),
    lastAttemptAt: now,
    completedAt: null,
  }, { OrderRefundModel });
  if (!failed) {
    return supersededOutcome(
      refundId,
      'payment',
      'Un proceso posterior reemplazó este intento de devolución monetaria.',
      { OrderRefundModel }
    );
  }
  return {
    stage: 'payment',
    state: 'failed',
    error: cleanText(error?.code || 'PAYMENT_AUTOMATION_FAILED', 120),
    message: cleanText(error?.message, 500),
  };
}

async function automatePayment(
  { order, refund, adminLabel, gateway },
  { OrderRefundModel = OrderRefund } = {}
) {
  const currentState = stageState(refund, 'payment');
  if (['completed', 'not_required'].includes(currentState)) {
    return { stage: 'payment', state: currentState, skipped: true };
  }

  const claimed = await claimStage(refund, 'payment', { OrderRefundModel });
  if (!claimed) {
    const latest = await OrderRefundModel.findById(refund._id);
    return {
      stage: 'payment',
      state: stageState(latest, 'payment'),
      skipped: true,
      message: 'Otro proceso tomó primero la devolución monetaria.',
    };
  }
  const claimId = claimedStageId(claimed, 'payment');

  let gatewayResult;
  try {
    gatewayResult = await gateway({ order, refund: claimed });
  } catch (error) {
    return markPaymentFailure(refund._id, claimId, error, OrderRefundModel);
  }

  if (gatewayResult?.manualRequired) {
    const capability = gatewayResult.capability || {};
    const manual = await setClaimedStage(refund._id, 'payment', claimId, {
      state: 'action_required',
      errorCode: cleanText(capability.code || 'PAYMENT_MANUAL_REQUIRED', 120),
      errorMessage: cleanText(
        capability.message || 'La devolución monetaria requiere confirmación manual.',
        500
      ),
      providerStatus: '',
      lastAttemptAt: new Date(),
      completedAt: null,
    }, { OrderRefundModel });
    if (!manual) {
      return supersededOutcome(
        refund._id,
        'payment',
        'Un proceso posterior reemplazó esta revisión monetaria.',
        { OrderRefundModel }
      );
    }
    return {
      stage: 'payment',
      state: 'action_required',
      manualRequired: true,
      error: capability.code,
      message: capability.message,
    };
  }

  // La ejecución externa solo ocurre mientras este worker conserva el claim.
  // La finalización se compara con ese claim para cercar workers obsoletos.
  try {
    const result = await gateway({ order, refund: claimed, execute: true });
    if (!result?.completed) {
      throw createAutomationError(
        result?.message || 'El proveedor no confirmó la devolución del dinero.',
        result?.error || 'PAYMENT_AUTOMATION_NOT_COMPLETED',
        502
      );
    }
    const now = new Date();
    const completed = await setClaimedStage(refund._id, 'payment', claimId, {
      state: 'completed',
      reference: cleanText(result.reference, 220),
      errorCode: '',
      errorMessage: '',
      providerStatus: cleanText(result.providerStatus, 80),
      lastAttemptAt: now,
      completedAt: now,
      completedByLabel: cleanText(adminLabel || 'automatización', 160),
    }, { OrderRefundModel });
    if (!completed) {
      return supersededOutcome(
        refund._id,
        'payment',
        'El resultado perteneció a un claim vencido y no modificó el intento vigente.',
        { OrderRefundModel }
      );
    }
    return {
      stage: 'payment',
      state: 'completed',
      reference: result.reference,
      idempotent: result.idempotent === true,
    };
  } catch (error) {
    return markPaymentFailure(refund._id, claimId, error, OrderRefundModel);
  }
}

module.exports = { automatePayment };
