'use strict';

const OrderRefund = require('../../models/OrderRefund');
const { createOfficialCreditNote } = require('../electronicCreditNoteService');
const { linkRefundCreditNote } = require('../orderRefundReconciliationService');
const {
  claimStage,
  claimedStageId,
  setClaimedStage,
  supersededOutcome,
} = require('./claims');
const {
  buildAutomaticCreditNoteRequest,
  cleanText,
  stageState,
} = require('./helpers');

async function automateBilling({ order, refund, invoice, adminLabel }) {
  const currentState = stageState(refund, 'billing');
  if (['completed', 'not_required'].includes(currentState)) {
    return { stage: 'billing', state: currentState, skipped: true };
  }
  if (currentState === 'pending') {
    return {
      stage: 'billing',
      state: 'pending',
      skipped: true,
      message: 'La factura todavía no tiene un estado fiscal definitivo.',
    };
  }
  if (!invoice) {
    return { stage: 'billing', state: 'not_required', skipped: true };
  }

  const claimed = await claimStage(refund, 'billing');
  if (!claimed) {
    const latest = await OrderRefund.findById(refund._id);
    return {
      stage: 'billing',
      state: stageState(latest, 'billing'),
      skipped: true,
      message: 'Otro proceso tomó primero la nota crédito.',
    };
  }
  const claimId = claimedStageId(claimed, 'billing');

  try {
    const request = buildAutomaticCreditNoteRequest(order, claimed);
    const result = await createOfficialCreditNote(invoice._id, request, {
      adminUser: cleanText(adminLabel || 'automatización de reembolso', 160),
    });
    await linkRefundCreditNote({
      orderId: order._id,
      refundId: claimed._id,
      invoice: result.invoice,
      creditNote: result.creditNote,
      adminLabel,
    }, { expectedClaimId: claimId });
    return {
      stage: 'billing',
      state: 'completed',
      reference: cleanText(
        result?.creditNote?.provider?.number || result?.creditNote?.referenceCode,
        220
      ),
      idempotent: result.reused === true,
    };
  } catch (error) {
    if (error?.code === 'REFUND_AUTOMATION_CLAIM_SUPERSEDED') {
      return supersededOutcome(
        refund._id,
        'billing',
        'La nota crédito perteneció a un claim vencido y no cerró el intento vigente.'
      );
    }
    const now = new Date();
    const failed = await setClaimedStage(refund._id, 'billing', claimId, {
      state: 'failed',
      errorCode: cleanText(error?.code || 'REFUND_CREDIT_NOTE_AUTOMATION_FAILED', 120),
      errorMessage: cleanText(
        error?.message || 'No se pudo automatizar la nota crédito.',
        500
      ),
      lastAttemptAt: now,
      completedAt: null,
    });
    if (!failed) {
      return supersededOutcome(
        refund._id,
        'billing',
        'Un proceso posterior reemplazó este intento de nota crédito.'
      );
    }
    return {
      stage: 'billing',
      state: 'failed',
      error: cleanText(error?.code || 'REFUND_CREDIT_NOTE_AUTOMATION_FAILED', 120),
      message: cleanText(error?.message, 500),
    };
  }
}

module.exports = { automateBilling };
