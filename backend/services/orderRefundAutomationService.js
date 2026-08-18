'use strict';

const crypto = require('crypto');

const ElectronicInvoice = require('../models/ElectronicInvoice');
const Order = require('../models/Order');
const OrderRefund = require('../models/OrderRefund');
const {
  createOfficialCreditNote,
} = require('./electronicCreditNoteService');
const {
  deriveReconciliationState,
  linkRefundCreditNote,
  refreshOrderRefundReconciliation,
} = require('./orderRefundReconciliationService');
const {
  executeWompiAutomaticRefund,
  orderTotal,
} = require('./wompiRefundGatewayService');

const AUTOMATION_LOCK_MS = 5 * 60 * 1000;

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

async function recordEvent(OrderEventModel, payload = {}) {
  if (!OrderEventModel) return;
  try {
    await OrderEventModel.create(payload);
  } catch (_error) {
    // La auditoría complementaria no puede invalidar una operación externa ya realizada.
  }
}

async function setStage(refundId, stage, values = {}) {
  const prefix = `reconciliation.${stage}`;
  const set = {};
  for (const [key, value] of Object.entries(values)) {
    set[`${prefix}.${key}`] = value;
  }
  return OrderRefund.findByIdAndUpdate(
    refundId,
    { $set: set },
    { new: true, runValidators: true }
  );
}

async function claimStage(refund, stage) {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - AUTOMATION_LOCK_MS);
  const prefix = `reconciliation.${stage}`;
  const key = operationKey(refund, stage);
  return OrderRefund.findOneAndUpdate(
    {
      _id: refund._id,
      order: refund.order,
      $or: [
        { [`${prefix}.state`]: { $in: ['action_required', 'failed'] } },
        {
          [`${prefix}.state`]: 'processing',
          [`${prefix}.lastAttemptAt`]: { $lt: staleBefore },
        },
      ],
    },
    {
      $set: {
        [`${prefix}.state`]: 'processing',
        [`${prefix}.operationKey`]: key,
        [`${prefix}.errorCode`]: '',
        [`${prefix}.errorMessage`]: '',
        [`${prefix}.lastAttemptAt`]: now,
        [`${prefix}.completedAt`]: null,
        [`${prefix}.nextRetryAt`]: null,
      },
      $inc: { [`${prefix}.attempts`]: 1 },
    },
    { new: true, runValidators: true }
  );
}

async function automatePayment({ order, refund, adminLabel, gateway }) {
  const currentState = stageState(refund, 'payment');
  if (['completed', 'not_required'].includes(currentState)) {
    return { stage: 'payment', state: currentState, skipped: true };
  }
  if (currentState === 'processing') {
    return {
      stage: 'payment',
      state: 'processing',
      skipped: true,
      message: 'Ya existe una devolución monetaria en procesamiento.',
    };
  }

  let gatewayResult;
  try {
    gatewayResult = await gateway({ order, refund });
  } catch (error) {
    const now = new Date();
    await setStage(refund._id, 'payment', {
      state: 'failed',
      errorCode: cleanText(error?.code || 'PAYMENT_AUTOMATION_FAILED', 120),
      errorMessage: cleanText(error?.message || 'No se pudo automatizar la devolución del dinero.', 500),
      providerStatus: cleanText(error?.details?.providerStatus, 80),
      lastAttemptAt: now,
      completedAt: null,
    });
    return {
      stage: 'payment',
      state: 'failed',
      error: cleanText(error?.code || 'PAYMENT_AUTOMATION_FAILED', 120),
      message: cleanText(error?.message, 500),
    };
  }

  if (gatewayResult?.manualRequired) {
    const capability = gatewayResult.capability || {};
    await setStage(refund._id, 'payment', {
      state: 'action_required',
      errorCode: cleanText(capability.code || 'PAYMENT_MANUAL_REQUIRED', 120),
      errorMessage: cleanText(capability.message || 'La devolución monetaria requiere confirmación manual.', 500),
      providerStatus: '',
      lastAttemptAt: new Date(),
      completedAt: null,
    });
    return {
      stage: 'payment',
      state: 'action_required',
      manualRequired: true,
      error: capability.code,
      message: capability.message,
    };
  }

  const claimed = await claimStage(refund, 'payment');
  if (!claimed) {
    const latest = await OrderRefund.findById(refund._id);
    return {
      stage: 'payment',
      state: stageState(latest, 'payment'),
      skipped: true,
      message: 'Otro proceso tomó primero la devolución monetaria.',
    };
  }

  // La consulta de capacidad anterior no mueve dinero. La ejecución real se
  // realiza una sola vez después de obtener el bloqueo persistente.
  try {
    const result = await gateway({ order, refund: claimed, execute: true });
    if (!result?.completed) {
      throw createAutomationError(
        result?.message || 'El proveedor no confirmó la devolución del dinero.',
        result?.error || 'PAYMENT_AUTOMATION_NOT_COMPLETED',
        502
      );
    }
    const now = new Date();
    await setStage(refund._id, 'payment', {
      state: 'completed',
      reference: cleanText(result.reference, 220),
      errorCode: '',
      errorMessage: '',
      providerStatus: cleanText(result.providerStatus, 80),
      lastAttemptAt: now,
      completedAt: now,
      completedByLabel: cleanText(adminLabel || 'automatización', 160),
    });
    return {
      stage: 'payment',
      state: 'completed',
      reference: result.reference,
      idempotent: result.idempotent === true,
    };
  } catch (error) {
    const now = new Date();
    await setStage(refund._id, 'payment', {
      state: 'failed',
      errorCode: cleanText(error?.code || 'PAYMENT_AUTOMATION_FAILED', 120),
      errorMessage: cleanText(error?.message || 'No se pudo automatizar la devolución del dinero.', 500),
      providerStatus: cleanText(error?.details?.providerStatus, 80),
      lastAttemptAt: now,
      completedAt: null,
    });
    return {
      stage: 'payment',
      state: 'failed',
      error: cleanText(error?.code || 'PAYMENT_AUTOMATION_FAILED', 120),
      message: cleanText(error?.message, 500),
    };
  }
}

async function automateBilling({ order, refund, invoice, adminLabel }) {
  const currentState = stageState(refund, 'billing');
  if (['completed', 'not_required'].includes(currentState)) {
    return { stage: 'billing', state: currentState, skipped: true };
  }
  if (currentState === 'pending') {
    return {
      stage: 'billing',
      state: 'pending',
      skipped: true,
      message: 'La factura todavía no tiene un estado fiscal definitivo.',
    };
  }
  if (currentState === 'processing') {
    return {
      stage: 'billing',
      state: 'processing',
      skipped: true,
      message: 'Ya existe una nota crédito en procesamiento.',
    };
  }
  if (!invoice) {
    return { stage: 'billing', state: 'not_required', skipped: true };
  }

  const claimed = await claimStage(refund, 'billing');
  if (!claimed) {
    const latest = await OrderRefund.findById(refund._id);
    return {
      stage: 'billing',
      state: stageState(latest, 'billing'),
      skipped: true,
      message: 'Otro proceso tomó primero la nota crédito.',
    };
  }

  try {
    const request = buildAutomaticCreditNoteRequest(order, claimed);
    const result = await createOfficialCreditNote(invoice._id, request, {
      adminUser: cleanText(adminLabel || 'automatización de reembolso', 160),
    });
    await linkRefundCreditNote({
      orderId: order._id,
      refundId: claimed._id,
      invoice: result.invoice,
      creditNote: result.creditNote,
      adminLabel,
    });
    return {
      stage: 'billing',
      state: 'completed',
      reference: cleanText(
        result?.creditNote?.provider?.number || result?.creditNote?.referenceCode,
        220
      ),
      idempotent: result.reused === true,
    };
  } catch (error) {
    const now = new Date();
    await setStage(refund._id, 'billing', {
      state: 'failed',
      errorCode: cleanText(error?.code || 'REFUND_CREDIT_NOTE_AUTOMATION_FAILED', 120),
      errorMessage: cleanText(error?.message || 'No se pudo automatizar la nota crédito.', 500),
      lastAttemptAt: now,
      completedAt: null,
    });
    return {
      stage: 'billing',
      state: 'failed',
      error: cleanText(error?.code || 'REFUND_CREDIT_NOTE_AUTOMATION_FAILED', 120),
      message: cleanText(error?.message, 500),
    };
  }
}

async function automateOrderRefund(
  { orderId, refundId, adminLabel = '' } = {},
  {
    OrderEventModel = null,
    paymentGateway = null,
  } = {}
) {
  let refund = await OrderRefund.findOne({ _id: refundId, order: orderId });
  if (!refund) {
    throw createAutomationError(
      'El reembolso no pertenece a la orden.',
      'ORDER_REFUND_NOT_FOUND',
      404
    );
  }
  if (refund.status !== 'processed') {
    throw createAutomationError(
      'El reembolso todavía no terminó su operación transaccional de inventario.',
      'ORDER_REFUND_NOT_PROCESSED',
      409
    );
  }

  const order = await Order.findById(orderId);
  if (!order) {
    throw createAutomationError('Orden no encontrada.', 'ORDER_NOT_FOUND', 404);
  }

  refund = await refreshOrderRefundReconciliation(refund._id);
  const invoice = await ElectronicInvoice.findOne({ orderId: order._id })
    .sort({ createdAt: -1 });

  let gateway = paymentGateway;
  if (!gateway) {
    // La consulta de capacidad usa la política pura del adaptador. La ejecución
    // externa solo ocurre después de tomar el bloqueo persistente.
    const {
      getActivePaymentsConfig,
    } = require('./paymentConfigurationAuthorityService');
    const {
      resolveWompiRefundCapability,
    } = require('./wompiRefundGatewayService');
    gateway = async ({ order: targetOrder, refund: targetRefund, execute }) => {
      if (execute) {
        return executeWompiAutomaticRefund({ order: targetOrder, refund: targetRefund });
      }
      const config = await getActivePaymentsConfig();
      const capability = resolveWompiRefundCapability({
        order: targetOrder,
        refund: targetRefund,
        config,
      });
      return capability.automatic
        ? { completed: false, manualRequired: false, capability }
        : { completed: false, manualRequired: true, capability };
    };
  }

  const paymentOutcome = await automatePayment({
    order,
    refund,
    adminLabel,
    gateway,
  });
  refund = await refreshOrderRefundReconciliation(refund._id);
  const billingOutcome = await automateBilling({
    order,
    refund,
    invoice,
    adminLabel,
  });
  refund = await refreshOrderRefundReconciliation(refund._id);

  const finalState = deriveReconciliationState(refund.reconciliation || {});
  await recordEvent(OrderEventModel, {
    orderId: order._id,
    type: 'refund_automation_finished',
    message:
      finalState === 'completed'
        ? `Reembolso ${refund.refundNumber} conciliado automáticamente.`
        : `Automatización de ${refund.refundNumber} ejecutada con acciones pendientes.`,
    meta: {
      refundId: refund._id,
      refundNumber: refund.refundNumber,
      finalState,
      payment: paymentOutcome,
      billing: billingOutcome,
      by: cleanText(adminLabel || 'admin', 160),
    },
  });

  return {
    completed: finalState === 'completed',
    state: finalState,
    refund: safeRefundView(refund),
    outcomes: {
      payment: paymentOutcome,
      billing: billingOutcome,
    },
  };
}

module.exports = {
  AUTOMATION_LOCK_MS,
  automateOrderRefund,
  buildAutomaticCreditNoteRequest,
  createAutomationError,
  isFullRefund,
  operationKey,
  safeRefundView,
};
