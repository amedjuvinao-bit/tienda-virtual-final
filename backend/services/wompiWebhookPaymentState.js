'use strict';

const {
  applyVerifiedPaidAt,
} = require('./verifiedPaymentApprovalService');
const {
  resolveInitialInventoryStatus,
} = require('./orderInventoryBillingReadinessService');
const {
  asRetryablePaymentInventoryError,
  isPermanentPaymentInventoryError,
  isRetryablePaymentInventoryError,
} = require('./paymentInventoryFailureService');
const {
  asNumber,
  cleanText,
  hasPersistedWompiFinancialTerminality,
  isApprovedPayment,
} = require('./wompiWebhookApprovalEvidence');

const INVENTORY_EXCEPTION_PREFIX =
  'Pago aprobado pendiente de confirmacion de inventario';

const isRetryableInventoryApprovalError = isRetryablePaymentInventoryError;

function asRetryableInventoryApprovalError(error) {
  if (isPermanentPaymentInventoryError(error)) return error;
  return asRetryablePaymentInventoryError(
    error,
    'INVENTORY_CONFIRMATION_ERROR'
  );
}

function ensurePaymentDocument(order, payments = {}) {
  if (!order.payment || typeof order.payment !== 'object') {
    order.payment = {};
  }

  order.payment.active = true;
  order.payment.provider = 'wompi';
  order.payment.providerLabel = order.payment.providerLabel || 'Wompi';
  order.payment.mode = payments.mode || order.payment.mode || 'sandbox';
  order.payment.currency = order.payment.currency || payments.currency || 'COP';
  order.payment.checkoutLabel = order.payment.checkoutLabel || 'Wompi';
  order.payment.enableWebhook = true;
  return order.payment;
}

function ensurePaymentProcessing(
  order,
  transaction = {},
  { wasApprovedBefore = false } = {}
) {
  const hadPaymentProcessingBefore = Boolean(order.paymentProcessing);
  if (!order.paymentProcessing || typeof order.paymentProcessing !== 'object') {
    order.paymentProcessing = {};
  }
  if (
    !order.paymentProcessing.inventory ||
    typeof order.paymentProcessing.inventory !== 'object'
  ) {
    order.paymentProcessing.inventory = {};
  }
  if (
    !order.paymentProcessing.invoice ||
    typeof order.paymentProcessing.invoice !== 'object'
  ) {
    order.paymentProcessing.invoice = {};
  }
  if (
    !order.paymentProcessing.fulfillment ||
    typeof order.paymentProcessing.fulfillment !== 'object'
  ) {
    order.paymentProcessing.fulfillment = {};
  }

  order.paymentProcessing.provider = 'wompi';
  if (!order.paymentProcessing.approvedTransactionId) {
    order.paymentProcessing.approvedTransactionId = cleanText(
      transaction?.id,
      120
    );
  }
  if (!order.paymentProcessing.inventory.status) {
    order.paymentProcessing.inventory.status = resolveInitialInventoryStatus(
      order,
      {
        wasApprovedBefore,
        hadPaymentProcessingBefore,
      }
    );
  }
  if (!order.paymentProcessing.invoice.status) {
    order.paymentProcessing.invoice.status = 'pending';
  }
  if (!order.paymentProcessing.invoice.transactionId) {
    order.paymentProcessing.invoice.transactionId = cleanText(
      transaction?.id,
      120
    );
  }
  if (!order.paymentProcessing.fulfillment.status) {
    order.paymentProcessing.fulfillment.status = 'pending';
  }

  return order.paymentProcessing;
}

function applyApprovedPaymentFact(
  order,
  transaction = {},
  payments = {},
  now = new Date(),
  { verified = false } = {}
) {
  const payment = ensurePaymentDocument(order, payments);
  const legacyPaidBeforeVerifiedApproval =
    !order?.paymentProcessing &&
    cleanText(order?.payment?.status, 40).toLowerCase() === 'paid' &&
    Boolean(order?.payment?.paidAt);
  const wasApproved =
    hasPersistedWompiFinancialTerminality(order) ||
    legacyPaidBeforeVerifiedApproval;

  payment.status = 'paid';

  if (!wasApproved || !payment.transactionId) {
    payment.transactionId = cleanText(transaction?.id, 120);
  }
  if (!wasApproved || !payment.reference) {
    payment.reference = cleanText(transaction?.reference, 180);
  }
  if (!wasApproved || !payment.amountInCents) {
    payment.amountInCents = Math.max(
      0,
      Math.round(asNumber(transaction?.amount_in_cents))
    );
    payment.amount = payment.amountInCents / 100;
  }

  const paidAtResult = applyVerifiedPaidAt(order, {
    verified,
    providerStatus: transaction?.status,
    normalizedPaymentStatus: payment.status,
    providerPaidAt: transaction?.finalized_at,
    now,
  });

  if (!wasApproved || !payment.methodType) {
    payment.methodType = cleanText(transaction?.payment_method_type, 80);
  }
  if (!wasApproved || !payment.method) {
    payment.method = cleanText(transaction?.payment_method?.type, 80);
  }
  if (!wasApproved || !payment.methodLabel) {
    payment.methodLabel =
      cleanText(transaction?.payment_method_type, 80) ||
      cleanText(transaction?.payment_method?.type, 80);
  }
  if (
    !wasApproved ||
    !payment.rawMethod ||
    !Object.keys(payment.rawMethod).length
  ) {
    payment.rawMethod = transaction?.payment_method || {};
  }

  const processing = ensurePaymentProcessing(order, transaction, {
    wasApprovedBefore: wasApproved,
  });
  if (!processing.approvedAt) {
    processing.approvedAt = paidAtResult.paidAt || now;
  }

  return { wasApproved, payment, paidAtResult, processing };
}

function resolveMonotonicWompiTransition(
  order = {},
  mapped = {},
  approvalContext = {}
) {
  const currentApproved =
    isApprovedPayment(order, approvalContext) ||
    hasPersistedWompiFinancialTerminality(order);
  const incomingPaymentStatus = cleanText(
    mapped?.paymentStatus,
    40
  ).toLowerCase();

  if (currentApproved && incomingPaymentStatus !== 'paid') {
    return {
      ignored: true,
      reason: 'APPROVED_IS_TERMINAL',
      paymentStatus: 'paid',
      orderStatus: order?.status || 'paid',
    };
  }

  return {
    ignored: false,
    reason: '',
    paymentStatus: incomingPaymentStatus,
    orderStatus: mapped?.orderStatus || null,
  };
}

function markInventoryConfirmationException(order, error, now = new Date()) {
  const code = cleanText(error?.code || 'INVENTORY_CONFIRMATION_ERROR', 100);
  const message = cleanText(
    error?.message || 'No se pudo confirmar la reserva.',
    300
  );
  const operationalMessage = `${INVENTORY_EXCEPTION_PREFIX}: ${code} - ${message}`;
  const processing = ensurePaymentProcessing(order);
  const previousCode = cleanText(processing.inventory.errorCode, 100);
  const previousMessage = cleanText(processing.inventory.errorMessage, 300);

  order.status = 'pending';
  processing.inventory.status = 'failed';
  processing.inventory.lastAttemptAt = now;
  processing.inventory.errorCode = code;
  processing.inventory.errorMessage = message;
  order.fulfillment = order.fulfillment || {};
  order.fulfillment.status = 'action_required';
  order.fulfillment.notificationError = operationalMessage;
  order.inventoryControl = order.inventoryControl || {};
  if (order.inventoryControl.restockedOnFailure !== true) {
    order.inventoryControl.discountedAtCheckout = false;
    order.inventoryControl.restockedOnFailure = false;
    order.inventoryControl.restockedAt = null;
  }

  return {
    changed: previousCode !== code || previousMessage !== message,
    code,
    message,
    operationalMessage,
  };
}

function markInventoryConfirmed(order, now = new Date()) {
  const processing = ensurePaymentProcessing(order);
  processing.inventory.status =
    order?.inventoryControl?.reservationRequired === false
      ? 'not_required'
      : 'confirmed';
  processing.inventory.confirmedAt = now;
  processing.inventory.lastAttemptAt = now;
  processing.inventory.errorCode = '';
  processing.inventory.errorMessage = '';

  const currentError = cleanText(order?.fulfillment?.notificationError, 500);
  if (currentError.startsWith(INVENTORY_EXCEPTION_PREFIX)) {
    order.fulfillment.status = 'pending';
    order.fulfillment.notificationError = '';
  }
}

module.exports = {
  INVENTORY_EXCEPTION_PREFIX,
  applyApprovedPaymentFact,
  asRetryableInventoryApprovalError,
  ensurePaymentProcessing,
  isRetryableInventoryApprovalError,
  markInventoryConfirmationException,
  markInventoryConfirmed,
  resolveMonotonicWompiTransition,
};
