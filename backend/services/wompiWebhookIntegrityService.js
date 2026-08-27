'use strict';

const {
  CANONICAL_ELECTRONIC_INVOICE_STATUSES,
  findCanonicalElectronicInvoice,
  getCanonicalPaymentApprovalEvidence,
  isApprovedPayment,
} = require('./wompiWebhookApprovalEvidence');
const {
  INVENTORY_EXCEPTION_PREFIX,
  applyApprovedPaymentFact,
  isRetryableInventoryApprovalError,
  markInventoryConfirmationException,
  markInventoryConfirmed,
  resolveMonotonicWompiTransition,
} = require('./wompiWebhookPaymentState');
const {
  createWompiWebhookIntegrityService,
} = require('./wompiWebhookApprovedProcessor');

module.exports = {
  CANONICAL_ELECTRONIC_INVOICE_STATUSES,
  INVENTORY_EXCEPTION_PREFIX,
  applyApprovedPaymentFact,
  createWompiWebhookIntegrityService,
  findCanonicalElectronicInvoice,
  getCanonicalPaymentApprovalEvidence,
  isApprovedPayment,
  isRetryableInventoryApprovalError,
  markInventoryConfirmationException,
  markInventoryConfirmed,
  resolveMonotonicWompiTransition,
};
