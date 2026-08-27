'use strict';

const crypto = require('crypto');

const {
  canonicalizeVariantKey,
} = require('../../../shared/variantKeyAuthority.cjs');
const { createFailureError } = require('./errorClassification');
const { cleanText, idValue, toQuantity } = require('./support');

function buildFailureMovementNumber(order, planItem) {
  const raw = [
    idValue(order?._id),
    cleanText(order?.orderNumber, 40),
    planItem.allocationId,
    idValue(planItem.inventoryStock),
    idValue(planItem.branch),
    idValue(planItem.product),
    planItem.variantKey,
  ].join('|');
  const digest = crypto.createHash('sha256').update(raw).digest('hex').slice(0, 24);
  return `IM-PF-${digest}`.toUpperCase();
}

function buildFailureReversalMovementNumber(order, planItem) {
  const raw = [
    'approval-reversal',
    idValue(order?._id),
    cleanText(order?.orderNumber, 40),
    planItem.allocationId,
    idValue(planItem.inventoryStock),
    idValue(planItem.branch),
    idValue(planItem.product),
    planItem.variantKey,
  ].join('|');
  const digest = crypto.createHash('sha256').update(raw).digest('hex').slice(0, 23);
  return `IM-PFA-${digest}`.toUpperCase();
}

function buildFailureMovementReference(order, planItem, prefix = 'PAYFAIL') {
  return [
    prefix,
    cleanText(order?.orderNumber, 40),
    planItem.allocationId,
  ].join(':').slice(0, 120);
}

function assertFailureMovementMatches({
  movement,
  order,
  planItem,
  quantity,
  reversal = false,
} = {}) {
  const expectedType = reversal ? 'adjustment_out' : 'return_in';
  const expectedDirection = reversal ? 'out' : 'in';
  const expectedReference = buildFailureMovementReference(
    order,
    planItem,
    reversal ? 'PAYFAIL-UNDO' : 'PAYFAIL'
  );
  const expectedReason = reversal
    ? 'Reversion de compensacion por aprobacion verificada'
    : 'Compensacion de inventario por pago no aprobado';
  const actualBranch = reversal ? movement?.branchFrom : movement?.branchTo;
  const mismatches = {
    order: idValue(movement?.order) !== idValue(order?._id),
    orderNumber:
      cleanText(movement?.orderNumber, 40) !== cleanText(order?.orderNumber, 40),
    branch: idValue(actualBranch) !== idValue(planItem?.branch),
    product: idValue(movement?.product) !== idValue(planItem?.product),
    variant:
      canonicalizeVariantKey(movement?.variantKey) !== planItem?.variantKey,
    inventoryStock:
      cleanText(movement?.sourceModel, 80) !== 'InventoryStock' ||
      idValue(movement?.sourceId) !== idValue(planItem?.inventoryStock),
    allocation: cleanText(movement?.reference, 120) !== expectedReference,
    type: cleanText(movement?.type, 40).toLowerCase() !== expectedType,
    direction:
      cleanText(movement?.direction, 40).toLowerCase() !== expectedDirection,
    status: cleanText(movement?.status, 40).toLowerCase() !== 'posted',
    quantity: toQuantity(movement?.quantity) !== toQuantity(quantity),
    purpose: cleanText(movement?.reason, 240) !== expectedReason,
  };
  const invalidFields = Object.entries(mismatches)
    .filter(([, invalid]) => invalid)
    .map(([field]) => field);

  if (invalidFields.length) {
    throw createFailureError(
      'El movimiento idempotente existente no coincide con la compensacion esperada.',
      'PAYMENT_FAILURE_MOVEMENT_MISMATCH',
      {
        movementNumber: cleanText(movement?.movementNumber, 40),
        invalidFields,
      }
    );
  }
  return true;
}

module.exports = {
  assertFailureMovementMatches,
  buildFailureMovementNumber,
  buildFailureMovementReference,
  buildFailureReversalMovementNumber,
};
