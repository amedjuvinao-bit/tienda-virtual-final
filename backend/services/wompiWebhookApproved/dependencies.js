'use strict';

const {
  createWompiFailureRecoveryProcessor,
} = require('../wompiWebhookFailureRecoveryProcessor');

function resolveApprovedProcessorDependencies(overrides = {}) {
  const withOrderTransaction = overrides.withOrderTransaction;
  const confirmReservation = overrides.confirmInventoryReservation;
  const applyReservation = overrides.applyReservationToOrderDocument;
  const createOrderEvent = overrides.createOrderEvent;
  const legacyInvoiceScheduler = overrides.scheduleInvoiceOnce;
  const processPostCommitEffects =
    overrides.processPostCommitEffects ||
    (typeof legacyInvoiceScheduler === 'function'
      ? async (payload) => ({
          fulfillment: { processed: false, legacy: true },
          invoice: await legacyInvoiceScheduler(payload),
        })
      : null);
  const reconcileFailureRecovery = overrides.reconcileFailureRecovery;
  const claimApprovedPaymentAttempt = overrides.claimApprovedPaymentAttempt;
  const nowFactory = overrides.now || (() => new Date());

  if (typeof withOrderTransaction !== 'function') {
    throw new TypeError('withOrderTransaction es obligatorio.');
  }
  if (typeof confirmReservation !== 'function') {
    throw new TypeError('confirmInventoryReservation es obligatorio.');
  }
  if (typeof applyReservation !== 'function') {
    throw new TypeError('applyReservationToOrderDocument es obligatorio.');
  }
  if (typeof processPostCommitEffects !== 'function') {
    throw new TypeError('processPostCommitEffects es obligatorio.');
  }
  if (typeof claimApprovedPaymentAttempt !== 'function') {
    throw new TypeError('claimApprovedPaymentAttempt es obligatorio.');
  }

  async function recordEvent(event, context) {
    if (typeof createOrderEvent === 'function') {
      await createOrderEvent(event, context);
    }
  }

  const processFailureRecovery = createWompiFailureRecoveryProcessor({
    reconcileFailureRecovery,
    confirmReservation,
    applyReservation,
    recordEvent,
    nowFactory,
  });

  return {
    applyReservation,
    claimApprovedPaymentAttempt,
    confirmReservation,
    nowFactory,
    processFailureRecovery,
    processPostCommitEffects,
    recordEvent,
    withOrderTransaction,
  };
}

module.exports = { resolveApprovedProcessorDependencies };
