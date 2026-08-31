'use strict';

const {
  createManualPaymentConfirmationService,
} = require('./manualPaymentConfirmation/transaction');
const {
  MANUAL_PAYMENT_METHODS,
  normalizeManualPaymentRequest,
} = require('./manualPaymentConfirmation/policy');
const {
  buildApprovedManualTransaction,
  createManualPaymentPostCommitProcessor,
} = require('./manualPaymentConfirmation/postCommit');

const defaultService = createManualPaymentConfirmationService();

module.exports = {
  MANUAL_PAYMENT_METHODS,
  buildApprovedManualTransaction,
  confirmManualPayment: defaultService.confirmManualPayment,
  createManualPaymentConfirmationService,
  createManualPaymentPostCommitProcessor,
  normalizeManualPaymentRequest,
};
