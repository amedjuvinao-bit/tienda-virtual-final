'use strict';

const {
  AUTOMATION_LOCK_MS,
  claimStage,
  setClaimedStage,
} = require('./orderRefundAutomation/claims');
const {
  buildAutomaticCreditNoteRequest,
  claimedStageId,
  createAutomationError,
  createClaimId,
  isFullRefund,
  operationKey,
  safeRefundView,
} = require('./orderRefundAutomation/helpers');
const { automateOrderRefund } = require('./orderRefundAutomation/orchestrator');

module.exports = {
  AUTOMATION_LOCK_MS,
  automateOrderRefund,
  buildAutomaticCreditNoteRequest,
  claimStage,
  claimedStageId,
  createAutomationError,
  createClaimId,
  isFullRefund,
  operationKey,
  safeRefundView,
  setClaimedStage,
};
