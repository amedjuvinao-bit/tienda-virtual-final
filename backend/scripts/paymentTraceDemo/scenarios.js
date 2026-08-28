'use strict';

const crypto = require('node:crypto');

const PAYMENT_SCENARIOS = Object.freeze([
  Object.freeze({
    key: 'wompi_pending',
    label: 'Wompi pendiente de confirmación',
    orderStatus: 'pending',
    paymentStatus: 'pending_gateway',
    allocationState: 'reserved',
    attemptStates: ['issued'],
    logisticsActions: [],
  }),
  Object.freeze({
    key: 'wompi_approved',
    label: 'Wompi aprobado',
    orderStatus: 'paid',
    paymentStatus: 'paid',
    allocationState: 'sold',
    attemptStates: ['approved'],
    logisticsActions: [],
  }),
  Object.freeze({
    key: 'wompi_declined',
    label: 'Wompi rechazado e inventario liberado',
    orderStatus: 'failed',
    paymentStatus: 'failed',
    allocationState: 'released',
    attemptStates: ['declined'],
    logisticsActions: [],
  }),
  Object.freeze({
    key: 'wompi_retry_approved',
    label: 'Wompi aprobado después de reintento',
    orderStatus: 'paid',
    paymentStatus: 'paid',
    allocationState: 'sold',
    attemptStates: ['superseded', 'approved'],
    logisticsActions: [
      'start_picking',
      'complete_picking',
      'start_packing',
      'complete_packing',
      'dispatch',
      'mark_in_transit',
    ],
  }),
  Object.freeze({
    key: 'wompi_reconciliation',
    label: 'Wompi enviado a conciliación',
    orderStatus: 'pending',
    paymentStatus: 'pending_gateway',
    allocationState: 'reserved',
    attemptStates: ['reconciliation_required'],
    logisticsActions: [],
  }),
  Object.freeze({
    key: 'mixed_credit_paid',
    label: 'Saldo a favor más Wompi aprobado',
    orderStatus: 'paid',
    paymentStatus: 'paid',
    allocationState: 'sold',
    attemptStates: ['approved'],
    storeCredit: 'consumed',
    logisticsActions: [
      'start_picking',
      'complete_picking',
      'start_packing',
      'complete_packing',
      'dispatch',
      'mark_in_transit',
      'deliver',
    ],
  }),
  Object.freeze({
    key: 'credit_released',
    label: 'Saldo reservado y devuelto tras pago fallido',
    orderStatus: 'failed',
    paymentStatus: 'failed',
    allocationState: 'released',
    attemptStates: ['declined'],
    storeCredit: 'released',
    logisticsActions: [],
  }),
  Object.freeze({
    key: 'full_credit_paid',
    label: 'Compra pagada totalmente con saldo a favor',
    orderStatus: 'paid',
    paymentStatus: 'paid',
    allocationState: 'sold',
    attemptStates: [],
    storeCredit: 'full',
    logisticsActions: [],
  }),
  Object.freeze({
    key: 'manual_transfer_paid',
    label: 'Transferencia manual verificada',
    orderStatus: 'paid',
    paymentStatus: 'paid',
    allocationState: 'sold',
    attemptStates: [],
    manualPayment: true,
    logisticsActions: [
      'start_picking',
      'complete_picking',
      'start_packing',
      'complete_packing',
    ],
  }),
]);

function cleanLabel(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
}

function buildPaymentRunId({
  now = new Date(),
  label = '',
  randomBytes = crypto.randomBytes,
} = {}) {
  const stamp = now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'z')
    .toLowerCase();
  return ['pay_trace', cleanLabel(label), stamp, randomBytes(3).toString('hex')]
    .filter(Boolean)
    .join('_')
    .slice(0, 82);
}

function buildPaymentTracePlan({ runId, candidates, now = new Date() } = {}) {
  if (!runId) throw new Error('Falta el identificador de la traza de pagos.');
  if (!Array.isArray(candidates) || candidates.length < 1) {
    throw new Error('Se necesita al menos una existencia elegible.');
  }
  return PAYMENT_SCENARIOS.map((scenario, index) => ({
    ...scenario,
    sequence: index + 1,
    candidates: [candidates[index % candidates.length]],
    activityAt: new Date(
      now.getTime() - (PAYMENT_SCENARIOS.length - index) * 17 * 60 * 1000
    ),
  }));
}

function paymentReference(runId, entry, attemptNumber = 1) {
  return `ORDER-${entry.sequence}-${runId}__TRY__DEMO-${attemptNumber}`
    .toUpperCase()
    .slice(0, 220);
}

function transactionId(runId, entry, attemptNumber = 1) {
  return `DEMO-${entry.key}-${attemptNumber}-${runId}`
    .toUpperCase()
    .slice(0, 160);
}

function creditComposition(total, entry, runId) {
  if (!entry.storeCredit) return null;
  const full = entry.storeCredit === 'full';
  const amount = full
    ? total
    : Math.min(total - 1, Math.max(1, Math.round(total * 0.4)));
  return {
    amount,
    due: Math.max(0, total - amount),
    reference: `SC-DEMO-${entry.sequence}-${runId}`
      .toUpperCase()
      .slice(0, 90),
    status:
      full || entry.storeCredit === 'consumed' ? 'consumed' : 'released',
  };
}

module.exports = {
  PAYMENT_SCENARIOS,
  buildPaymentRunId,
  buildPaymentTracePlan,
  cleanLabel,
  creditComposition,
  paymentReference,
  transactionId,
};
