'use strict';

const { requireFunction } = require('./dependencies');

function createApprovedProcessor(dependencies, withOrderTransaction) {
  const {
    OrderEventModel,
    applyReservationToOrderDocument,
    claimApprovedPaymentAttempt,
    confirmInventoryReservation,
    createWompiWebhookIntegrityService,
    merchantFingerprintFor,
    paymentInventoryFailureService,
    processPostCommitEffects,
  } = dependencies;

  const integrityService = requireFunction(
    createWompiWebhookIntegrityService,
    'createWompiWebhookIntegrityService'
  )({
    withOrderTransaction,
    confirmInventoryReservation,
    applyReservationToOrderDocument,
    createOrderEvent: async (event, context = {}) => {
      await OrderEventModel.create([event], { session: context.session });
    },
    processPostCommitEffects: (payload) =>
      processPostCommitEffects({
        ...payload,
        paymentProvider: 'wompi',
      }),
    reconcileFailureRecovery: (payload) =>
      paymentInventoryFailureService.reconcileApproved(payload),
    claimApprovedPaymentAttempt,
  });

  return async function processApproved(payload) {
    return integrityService.processApproved({
      ...payload,
      merchantFingerprint: merchantFingerprintFor(
        'wompi',
        payload?.payments?.credentials?.wompi?.publicKey
      ),
    });
  };
}

module.exports = { createApprovedProcessor };
