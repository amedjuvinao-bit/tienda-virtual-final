'use strict';

const crypto = require('node:crypto');

const { paymentReference, transactionId } = require('./scenarios');

function buildAttemptDrafts(entry, order, runId) {
  if (!entry.attemptStates.length) return [];
  const appliedCredit = order.storeCredit?.applied === true;
  return entry.attemptStates.map((state, index) => {
    const attemptNumber = index + 1;
    const finalized = state !== 'issued';
    const reconciliation = state === 'reconciliation_required';
    return {
      provider: 'wompi',
      order: order._id,
      orderNumber: order.orderNumber,
      reference: paymentReference(runId, entry, attemptNumber),
      merchantFingerprint: crypto
        .createHash('sha256')
        .update(`${runId}:${entry.key}:${attemptNumber}`)
        .digest('hex'),
      amountInCents: Math.max(1, Number(order.payment.amountInCents || 0)),
      currency: 'COP',
      state,
      active: state === 'issued',
      issuedBySystem: true,
      transactionId: finalized
        ? transactionId(runId, entry, attemptNumber)
        : '',
      providerStatus: state === 'approved'
        ? 'APPROVED'
        : state === 'declined'
          ? 'DECLINED'
          : reconciliation
            ? 'APPROVED'
            : 'PENDING',
      issuedAt: new Date(
        entry.activityAt.getTime() -
          (entry.attemptStates.length - index) * 4 * 60 * 1000
      ),
      supersededAt: state === 'superseded' ? entry.activityAt : null,
      finalizedAt: finalized ? entry.activityAt : null,
      storeCredit: {
        applied: appliedCredit,
        usage: null,
        amountInCents: Math.round(Number(order.storeCredit?.amount || 0) * 100),
        statusAtIssue: appliedCredit
          ? String(order.storeCredit.status || 'reserved')
          : 'none',
      },
      reconciliation: reconciliation
        ? {
            required: true,
            code: 'PAYMENT_AMOUNT_MISMATCH',
            message: 'El monto aprobado no coincide con el intento DEMO emitido.',
            detectedAt: entry.activityAt,
            transactionId: transactionId(runId, entry, attemptNumber),
            amountInCents: Math.max(1, Number(order.payment.amountInCents || 0) + 100),
            currency: 'COP',
          }
        : undefined,
    };
  });
}

function buildManualEvidenceDraft(entry, order, evidenceId) {
  if (!entry.manualPayment) return null;
  const snapshot = order.payment.manualConfirmation;
  return {
    _id: evidenceId,
    order: order._id,
    orderNumber: order.orderNumber,
    provider: 'manual',
    method: 'transfer',
    methodLabel: 'Transferencia bancaria',
    reference: snapshot.reference,
    referenceKey: String(snapshot.reference).toLowerCase(),
    amount: snapshot.amount,
    amountInCents: snapshot.amountInCents,
    currency: snapshot.currency,
    reason: snapshot.reason,
    actor: {
      id: snapshot.actorId,
      label: snapshot.actorLabel,
      role: snapshot.actorRole,
      source: 'script',
    },
    confirmedAt: snapshot.confirmedAt,
    requestFingerprint: snapshot.requestFingerprint,
    createdAt: entry.activityAt,
    updatedAt: entry.activityAt,
  };
}

function buildExternalEvents(entry, order, runId) {
  const meta = { demo: true, runId, scenario: entry.key };
  const events = [
    {
      orderId: order._id,
      type: 'order_created',
      message: `Orden DEMO creada: ${entry.label}.`,
      meta,
      createdAt: new Date(entry.activityAt.getTime() - 10 * 60 * 1000),
    },
  ];
  entry.attemptStates.forEach((state, index) => {
    events.push({
      orderId: order._id,
      type: `payment_attempt_${state}`,
      message: `Intento ${index + 1}: ${state}.`,
      meta: { ...meta, attempt: index + 1, state },
      createdAt: new Date(
        entry.activityAt.getTime() -
          (entry.attemptStates.length - index) * 4 * 60 * 1000
      ),
    });
  });
  if (entry.storeCredit) {
    events.push({
      orderId: order._id,
      type: `store_credit_${order.storeCredit.status}`,
      message: `Saldo DEMO ${order.storeCredit.status}: ${order.storeCredit.references[0]}.`,
      meta,
      createdAt: entry.activityAt,
    });
  }
  if (entry.manualPayment) {
    events.push({
      orderId: order._id,
      type: 'manual_payment_confirmed',
      message: 'Transferencia DEMO confirmada con evidencia administrativa.',
      meta,
      createdAt: entry.activityAt,
    });
  }
  return events;
}

module.exports = {
  buildAttemptDrafts,
  buildExternalEvents,
  buildManualEvidenceDraft,
};
