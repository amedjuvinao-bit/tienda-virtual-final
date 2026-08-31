'use strict';

const crypto = require('node:crypto');

const { buildOrderDraft } = require('../seedPersistentOrdersTrace');
const {
  cleanLabel,
  creditComposition,
  paymentReference,
  transactionId,
} = require('./scenarios');

function paidProcessing(entry, payment, at) {
  if (entry.paymentStatus !== 'paid') return undefined;
  const delivered = entry.logisticsActions.includes('deliver');
  return {
    provider: payment.provider,
    approvedTransactionId: payment.transactionId,
    approvedAt: at,
    inventory: { status: 'confirmed', lastAttemptAt: at, confirmedAt: at },
    fulfillment: {
      status: delivered ? 'completed' : 'pending',
      completedAt: delivered ? at : null,
      outcomeCode: 'DEMO_TRACE',
    },
    invoice: {
      status: 'not_required',
      transactionId: payment.transactionId,
      outcomeCode: 'DEMO_NO_FACTURAR',
    },
  };
}

function addManualConfirmation(payment, entry, runId, total, evidenceId) {
  if (!evidenceId) throw new Error('La transferencia manual requiere evidencia.');
  payment.manualConfirmation = {
    evidence: evidenceId,
    method: 'transfer',
    reference: payment.reference,
    amount: total,
    amountInCents: Math.round(total * 100),
    currency: 'COP',
    reason: 'Transferencia DEMO verificada para probar la trazabilidad administrativa.',
    actorId: 'orders-payment-trace-script',
    actorLabel: 'Simulador de pagos de Órdenes',
    actorRole: 'system',
    confirmedAt: entry.activityAt,
    requestFingerprint: crypto
      .createHash('sha256')
      .update(`${runId}:${entry.key}:${payment.reference}:${total}`)
      .digest('hex'),
  };
}

function buildPaymentSnapshot(entry, runId, total, evidenceId) {
  const credit = creditComposition(total, entry, runId);
  const due = credit ? credit.due : total;
  const lastAttempt = Math.max(1, entry.attemptStates.length);
  const isManual = entry.manualPayment === true;
  const isFullCredit = entry.storeCredit === 'full';
  const reference = isManual
    ? `TRF-DEMO-${entry.sequence}-${runId}`.toUpperCase().slice(0, 160)
    : isFullCredit
      ? credit.reference
      : paymentReference(runId, entry, lastAttempt);
  const provider = isManual ? 'manual' : isFullCredit ? 'store_credit' : 'wompi';
  const paid = entry.paymentStatus === 'paid';
  const payment = {
    active: true,
    provider,
    providerLabel: isManual
      ? 'Pago manual'
      : isFullCredit
        ? 'Saldo a favor'
        : 'Wompi',
    mode: 'sandbox',
    currency: 'COP',
    checkoutLabel: 'TRAZA DEMO DE PAGOS — sin movimiento real de dinero',
    enableWebhook: false,
    status: entry.paymentStatus,
    methodType: credit && !isFullCredit
      ? 'mixed'
      : isManual
        ? 'transfer'
        : isFullCredit
          ? 'store_credit'
          : 'card',
    method: credit && !isFullCredit
      ? 'mixed'
      : isManual
        ? 'transfer'
        : isFullCredit
          ? 'store_credit'
          : 'card',
    methodLabel: credit && !isFullCredit
      ? 'Saldo a favor + Wompi'
      : isManual
        ? 'Transferencia bancaria'
        : isFullCredit
          ? 'Saldo a favor'
          : 'Tarjeta de prueba',
    transactionId: paid
      ? isManual
        ? String(evidenceId || '')
        : isFullCredit
          ? `SC-${runId}-${entry.sequence}`.toUpperCase()
          : transactionId(runId, entry, lastAttempt)
      : entry.key === 'wompi_reconciliation' || entry.paymentStatus === 'failed'
        ? transactionId(runId, entry, lastAttempt)
        : '',
    reference,
    amount: due,
    amountInCents: Math.round(due * 100),
    paidAt: paid ? entry.activityAt : null,
    receivedAmount: paid ? due : 0,
    changeAmount: 0,
    splitPayments: credit
      ? [
          {
            method: 'store_credit',
            methodLabel: 'Saldo a favor',
            amount: credit.amount,
            reference: credit.reference,
          },
          ...(due > 0
            ? [{ method: 'wompi', methodLabel: 'Wompi', amount: due, reference }]
            : []),
        ]
      : [],
    rawMethod: isManual ? {} : { type: 'CARD', brand: 'VISA', last_four: '4242' },
    reviewRequired: entry.key === 'wompi_reconciliation',
    reviewCode: entry.key === 'wompi_reconciliation'
      ? 'PAYMENT_AMOUNT_MISMATCH'
      : '',
    reviewMessage: entry.key === 'wompi_reconciliation'
      ? 'El monto aprobado por la pasarela no coincide con el intento emitido.'
      : '',
    reviewTransactionId: entry.key === 'wompi_reconciliation'
      ? transactionId(runId, entry, 1)
      : '',
    reviewDetectedAt: entry.key === 'wompi_reconciliation' ? entry.activityAt : null,
  };
  if (isManual) addManualConfirmation(payment, entry, runId, total, evidenceId);
  return { credit, payment };
}

function storeCreditSnapshot(credit, entry) {
  if (!credit) return undefined;
  return {
    applied: true,
    usage: null,
    amount: credit.amount,
    currency: 'COP',
    status: credit.status,
    references: [credit.reference],
    reservedAt: new Date(entry.activityAt.getTime() - 5 * 60 * 1000),
    consumedAt: credit.status === 'consumed' ? entry.activityAt : null,
    releasedAt: credit.status === 'released' ? entry.activityAt : null,
    releaseReason: credit.status === 'released'
      ? 'Pago externo DEMO rechazado; saldo reservado devuelto.'
      : '',
  };
}

function buildPaymentOrderDraft(entry, runId, { evidenceId = null } = {}) {
  const draft = buildOrderDraft(
    {
      ...entry,
      status: entry.orderStatus,
      paymentStatus: entry.paymentStatus,
      actions: entry.logisticsActions,
    },
    runId
  );
  const total = Number(draft.total || 0);
  const { credit, payment } = buildPaymentSnapshot(entry, runId, total, evidenceId);
  const paid = entry.paymentStatus === 'paid';
  draft.status = entry.orderStatus;
  draft.fulfillmentStatus = paid
    ? 'reserved'
    : entry.paymentStatus === 'failed'
      ? 'cancelled'
      : 'pending';
  draft.tags = ['demo', 'payment-trace', cleanLabel(entry.key)];
  draft.customer.name = `DEMO PAGO ${entry.label} · ${runId}`;
  draft.customer.email = `payment-trace+${entry.sequence}@example.com`;
  draft.customer.emailOrPhone = draft.customer.email;
  draft.billing.name = draft.customer.name;
  draft.billing.email = draft.customer.email;
  draft.payment = payment;
  draft.storeCredit = storeCreditSnapshot(credit, entry);
  draft.paymentProcessing = paidProcessing(entry, payment, entry.activityAt);
  draft.inventoryControl = {
    reservationRequired: false,
    reservationId: null,
    discountedAtCheckout: false,
    restockedOnFailure: entry.paymentStatus === 'failed',
    restockedAt: entry.paymentStatus === 'failed' ? entry.activityAt : null,
  };
  draft.timeline = [
    {
      type: 'system',
      message: `Orden DEMO creada para el escenario: ${entry.label}.`,
      by: 'orders-payment-trace-script',
      at: new Date(entry.activityAt.getTime() - 10 * 60 * 1000),
    },
    {
      type: 'system',
      message: `Estado financiero DEMO: ${entry.paymentStatus}.`,
      by: 'orders-payment-trace-script',
      at: entry.activityAt,
    },
  ];
  draft.notes = [
    {
      text: `TRAZA DEMO DE PAGO ${runId}. Escenario: ${entry.label}. No cobrar, facturar ni despachar.`,
      by: 'orders-payment-trace-script',
      pinned: true,
      at: entry.activityAt,
    },
  ];
  return draft;
}

module.exports = { buildPaymentOrderDraft };
