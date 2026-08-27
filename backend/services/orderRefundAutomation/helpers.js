'use strict';

const crypto = require('crypto');

const { orderTotal } = require('../wompiRefundGatewayService');

function cleanText(value, max = 500) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function cleanLower(value, max = 500) {
  return cleanText(value, max).toLowerCase();
}

function idValue(value) {
  if (!value) return '';
  if (typeof value?.toHexString === 'function') return value.toHexString();
  if (typeof value === 'object') return cleanText(value._id || value.id || '', 120);
  return cleanText(value, 120);
}

function toMoney(value) {
  const number = Number(value || 0);
  return Number.isFinite(number)
    ? Math.max(0, Math.round((number + Number.EPSILON) * 100) / 100)
    : 0;
}

function createAutomationError(message, code, statusCode = 409, details = {}) {
  return Object.assign(new Error(message), { code, statusCode, details });
}

function operationKey(refund = {}, stage = '') {
  return crypto
    .createHash('sha256')
    .update(`${idValue(refund._id)}:${cleanLower(stage, 40)}:${cleanText(refund.requestHash, 128)}`)
    .digest('hex')
    .slice(0, 48);
}

function createClaimId() {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : crypto.randomBytes(24).toString('hex');
}

function isFullRefund(order = {}, refund = {}) {
  const total = orderTotal(order);
  return total > 0 && toMoney(refund?.amount) >= total;
}

function buildAutomaticCreditNoteRequest(order = {}, refund = {}) {
  const total = isFullRefund(order, refund);
  const refundId = idValue(refund?._id);
  const idempotencyKey = `refund_${refundId}`.slice(0, 120);
  const reasonText = cleanText(
    `Devolución conciliada ${refund?.refundNumber || refundId}${refund?.reason ? `: ${refund.reason}` : ''}`,
    250
  );

  if (total) {
    return {
      type: 'total',
      reasonCode: '2',
      reason: reasonText,
      idempotencyKey,
      selectedItems: [],
    };
  }

  const selectedItems = (refund?.items || [])
    .filter((item) => Number(item?.returnedQuantity || 0) > 0)
    .map((item) => ({
      productId: idValue(item?.product || item?.orderItemId),
      quantity: Number(item.returnedQuantity || 0),
    }));

  if (selectedItems.length === 0) {
    throw createAutomationError(
      'El reembolso parcial no conserva líneas suficientes para generar automáticamente la nota crédito.',
      'REFUND_CREDIT_NOTE_ITEMS_MISSING',
      422
    );
  }

  return {
    type: 'partial',
    reasonCode: '1',
    reason: reasonText,
    idempotencyKey,
    selectedItems,
  };
}

function stageState(refund = {}, stage = '') {
  return cleanLower(refund?.reconciliation?.[stage]?.state, 40) || 'pending';
}

function claimedStageId(refund = {}, stage = '') {
  return cleanText(refund?.reconciliation?.[stage]?.claimId, 160);
}

function safeRefundView(refund = {}) {
  const value = refund?.toObject ? refund.toObject() : refund;
  return {
    _id: value?._id,
    refundNumber: value?.refundNumber,
    order: value?.order,
    orderNumber: value?.orderNumber,
    returnCase: value?.returnCase || null,
    status: value?.status,
    amount: value?.amount,
    currency: value?.currency,
    reason: value?.reason,
    items: value?.items || [],
    reconciliation: value?.reconciliation || {},
    processedAt: value?.processedAt || null,
    createdAt: value?.createdAt || null,
  };
}

module.exports = {
  buildAutomaticCreditNoteRequest,
  claimedStageId,
  cleanText,
  createAutomationError,
  createClaimId,
  isFullRefund,
  operationKey,
  safeRefundView,
  stageState,
};
