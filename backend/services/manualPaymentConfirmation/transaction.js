'use strict';

const mongoose = require('mongoose');

const Order = require('../../models/Order');
const OrderEvent = require('../../models/OrderEvent');
const ManualPaymentConfirmation = require('../../models/ManualPaymentConfirmation');
const {
  applyReservationToOrderDocument,
} = require('../orderInventoryAllocationService');
const {
  confirmInventoryReservation,
} = require('../inventoryReservationService');
const {
  applyCustomerStatsForOrder,
} = require('../customerOrderLinkService');
const {
  consumeReservedStoreCreditForOrder,
} = require('../storeCreditCheckoutService');
const {
  assertExactPayment,
  assertManualProvider,
  assertMatchingReplay,
  assertOrderAwaitsManualPayment,
  buildRequestFingerprint,
  cleanText,
  createManualPaymentError,
  normalizeActor,
  normalizeManualPaymentRequest,
  serializeEvidence,
} = require('./policy');
const {
  createManualPaymentPostCommitProcessor,
} = require('./postCommit');

async function executeQuery(query, { session = null, lean = false } = {}) {
  let current = query;
  if (session && typeof current?.session === 'function') {
    current = current.session(session);
  }
  if (lean && typeof current?.lean === 'function') current = current.lean();
  if (typeof current?.exec === 'function') return current.exec();
  return current;
}

function isDuplicateKey(error) {
  return Number(error?.code) === 11000;
}

function evidenceDocument({ order, request, actor, fingerprint, confirmedAt }) {
  return {
    order: order._id,
    orderNumber: cleanText(order.orderNumber, 80),
    provider: 'manual',
    method: request.method,
    methodLabel: request.methodLabel,
    reference: request.reference,
    referenceKey: request.referenceKey,
    amount: request.amount,
    amountInCents: request.amountInCents,
    currency: request.currency,
    reason: request.reason,
    actor,
    confirmedAt,
    requestFingerprint: fingerprint,
  };
}

async function confirmOrderInventory(
  order,
  evidence,
  session,
  { confirmReservation, applyReservation }
) {
  if (order?.inventoryControl?.reservationRequired !== true) {
    return { status: 'not_required', event: null };
  }

  if (
    order.inventoryControl?.discountedAtCheckout === true &&
    order.inventoryControl?.restockedOnFailure !== true
  ) {
    return { status: 'confirmed', event: null };
  }

  const reservationIdentifier =
    order.inventoryControl?.reservationId || cleanText(order.orderNumber, 80);
  if (!reservationIdentifier) {
    throw createManualPaymentError(
      'ORDER_RESERVATION_REQUIRED',
      'La orden requiere inventario, pero no tiene una reserva asociada.',
      409
    );
  }

  const reservation = await confirmReservation(
    reservationIdentifier,
    {
      order: order._id,
      orderNumber: order.orderNumber,
      paymentReference: evidence.reference,
      paymentTransactionId: String(evidence._id),
    },
    { session, syncOrderAllocations: false }
  );
  applyReservation(order, reservation);
  order.inventoryControl.discountedAtCheckout = true;
  order.inventoryControl.restockedOnFailure = false;
  order.inventoryControl.restockedAt = null;

  return {
    status: 'confirmed',
    event: {
      orderId: order._id,
      type: 'inventory_reservation_confirmed',
      message: 'Reserva de inventario confirmada por pago manual verificado.',
      meta: {
        evidenceId: evidence._id,
        reservationId: reservation?._id || null,
        reservationCode: reservation?.reservationCode || '',
      },
    },
  };
}

function setPaymentFacts(order, evidence, inventoryStatus, previousStatus) {
  const now = evidence.confirmedAt;
  const existingSplits = Array.isArray(order.payment?.splitPayments)
    ? order.payment.splitPayments.filter(
        (split) => cleanText(split?.method, 40).toLowerCase() === 'store_credit'
      )
    : [];

  order.payment.status = 'paid';
  order.payment.methodType = evidence.method;
  order.payment.method = evidence.method;
  order.payment.methodLabel = evidence.methodLabel;
  order.payment.transactionId = String(evidence._id);
  order.payment.reference = evidence.reference;
  order.payment.amount = evidence.amount;
  order.payment.amountInCents = evidence.amountInCents;
  order.payment.paidAt = now;
  order.payment.receivedAmount = evidence.amount;
  order.payment.changeAmount = 0;
  order.payment.splitPayments = [
    ...existingSplits,
    {
      method: evidence.method,
      methodLabel: evidence.methodLabel,
      amount: evidence.amount,
      reference: evidence.reference,
    },
  ];
  order.payment.manualConfirmation = {
    evidence: evidence._id,
    method: evidence.method,
    reference: evidence.reference,
    amount: evidence.amount,
    amountInCents: evidence.amountInCents,
    currency: evidence.currency,
    reason: evidence.reason,
    actorId: evidence.actor.id,
    actorLabel: evidence.actor.label,
    actorRole: evidence.actor.role,
    confirmedAt: now,
    requestFingerprint: evidence.requestFingerprint,
  };

  order.paymentProcessing = {
    provider: 'manual',
    approvedTransactionId: String(evidence._id),
    approvedAt: now,
    inventory: {
      status: inventoryStatus,
      lastAttemptAt: now,
      confirmedAt: inventoryStatus === 'confirmed' ? now : null,
      errorCode: '',
      errorMessage: '',
    },
    fulfillment: {
      status: 'pending',
      claimId: '',
      claimedAt: null,
      completedAt: null,
      outcomeCode: '',
      errorCode: '',
    },
    invoice: {
      status: 'pending',
      claimId: '',
      claimedAt: null,
      scheduledAt: null,
      transactionId: String(evidence._id),
      outcomeCode: '',
      errorCode: '',
    },
  };
  order.status = 'paid';
  order.timeline = Array.isArray(order.timeline) ? order.timeline : [];
  order.timeline.push({
    type: 'status',
    statusFrom: previousStatus,
    statusTo: 'paid',
    message: `Estado: ${previousStatus || '—'} -> paid`,
    by: evidence.actor.label,
    at: now,
  });
}

async function createCanonicalEvents({
  OrderEventModel,
  order,
  evidence,
  inventoryEvent,
  storeCreditResult,
  previousStatus,
  session,
}) {
  const events = [];
  if (inventoryEvent) events.push(inventoryEvent);
  if (storeCreditResult?.consumed === true && storeCreditResult?.duplicate !== true) {
    events.push({
      orderId: order._id,
      type: 'store_credit_consumed',
      message: 'Saldo a favor consumido al confirmar el pago manual.',
      meta: {
        evidenceId: evidence._id,
        usageId: storeCreditResult.usage?._id || null,
        amount: Number(order.storeCredit?.amount || 0),
        currency: order.storeCredit?.currency || evidence.currency,
      },
    });
  }
  events.push(
    {
      orderId: order._id,
      type: 'manual_payment_confirmed',
      message: 'Pago manual confirmado con evidencia administrativa.',
      meta: {
        evidenceId: evidence._id,
        method: evidence.method,
        reference: evidence.reference,
        amount: evidence.amount,
        amountInCents: evidence.amountInCents,
        currency: evidence.currency,
        reason: evidence.reason,
        actorId: evidence.actor.id,
        actorLabel: evidence.actor.label,
        actorRole: evidence.actor.role,
        confirmedAt: evidence.confirmedAt,
      },
    },
    {
      orderId: order._id,
      type: 'status_changed',
      message: `Estado: ${previousStatus || '—'} -> paid`,
      meta: {
        from: previousStatus || null,
        to: 'paid',
        by: 'manual_payment_confirmation',
        adminId: evidence.actor.id,
        adminLabel: evidence.actor.label,
        evidenceId: evidence._id,
      },
    }
  );
  await OrderEventModel.create(events, { session, ordered: true });
}

function createManualPaymentConfirmationService({
  mongooseAdapter = mongoose,
  OrderModel = Order,
  ManualPaymentConfirmationModel = ManualPaymentConfirmation,
  OrderEventModel = OrderEvent,
  confirmReservation = confirmInventoryReservation,
  applyReservation = applyReservationToOrderDocument,
  customerStatsApplier = applyCustomerStatsForOrder,
  consumeStoreCredit = consumeReservedStoreCreditForOrder,
  postCommitProcessor = createManualPaymentPostCommitProcessor(),
  now = () => new Date(),
} = {}) {
  if (typeof mongooseAdapter?.startSession !== 'function') {
    throw new TypeError('MANUAL_PAYMENT_TRANSACTION_ADAPTER_REQUIRED');
  }

  async function findEvidence(filter, session = null) {
    return executeQuery(ManualPaymentConfirmationModel.findOne(filter), {
      session,
    });
  }

  async function resolveDuplicate(orderId, request, fingerprint) {
    const byOrder = await findEvidence({ order: orderId });
    if (byOrder) {
      assertMatchingReplay(byOrder, fingerprint);
      return { duplicate: true, orderId, evidence: byOrder };
    }
    const byReference = await findEvidence({
      provider: 'manual',
      referenceKey: request.referenceKey,
    });
    if (byReference) {
      throw createManualPaymentError(
        'MANUAL_PAYMENT_REFERENCE_CONFLICT',
        'La referencia del pago manual ya fue utilizada en otra orden.',
        409
      );
    }
    throw createManualPaymentError(
      'MANUAL_PAYMENT_CONCURRENCY_CONFLICT',
      'La confirmación compitió con otra operación. Intenta consultar la orden nuevamente.',
      409
    );
  }

  async function confirmInsideTransaction({ orderId, request, actor, fingerprint, session }) {
    const order = await executeQuery(OrderModel.findById(orderId), { session });
    if (!order) {
      throw createManualPaymentError(
        'ORDER_NOT_FOUND',
        'Orden no encontrada.',
        404
      );
    }

    assertManualProvider(order);
    const existing = await findEvidence({ order: order._id }, session);
    if (existing) {
      assertMatchingReplay(existing, fingerprint);
      return { duplicate: true, orderId: order._id, evidence: existing };
    }

    assertOrderAwaitsManualPayment(order);
    assertExactPayment(order, request);
    const confirmedAt = now();
    const created = await ManualPaymentConfirmationModel.create(
      [evidenceDocument({ order, request, actor, fingerprint, confirmedAt })],
      { session }
    );
    const evidence = created[0];
    const inventory = await confirmOrderInventory(order, evidence, session, {
      confirmReservation,
      applyReservation,
    });
    const storeCreditResult =
      order.storeCredit?.applied === true && order.storeCredit?.status === 'reserved'
        ? await consumeStoreCredit(order, { session, now: confirmedAt })
        : null;
    const previousStatus = cleanText(order.status, 40).toLowerCase();
    setPaymentFacts(order, evidence, inventory.status, previousStatus);
    await order.save({ session });
    await customerStatsApplier(order, { session });
    await createCanonicalEvents({
      OrderEventModel,
      order,
      evidence,
      inventoryEvent: inventory.event,
      storeCreditResult,
      previousStatus,
      session,
    });

    return { duplicate: false, orderId: order._id, evidence };
  }

  async function confirmManualPayment({ orderId, payment = {}, actor = {} } = {}) {
    const safeOrderId = cleanText(orderId, 80);
    const isValidObjectId = mongooseAdapter?.Types?.ObjectId?.isValid;
    if (!safeOrderId || (typeof isValidObjectId === 'function' && !isValidObjectId(safeOrderId))) {
      throw createManualPaymentError(
        'INVALID_ORDER_ID',
        'El identificador de la orden no es válido.',
        400
      );
    }

    const request = normalizeManualPaymentRequest(payment);
    const safeActor = normalizeActor(actor);
    const fingerprint = buildRequestFingerprint(safeOrderId, request);
    const session = await mongooseAdapter.startSession();
    let transactionResult;

    try {
      await session.withTransaction(async () => {
        transactionResult = await confirmInsideTransaction({
          orderId: safeOrderId,
          request,
          actor: safeActor,
          fingerprint,
          session,
        });
      });
    } catch (error) {
      if (!isDuplicateKey(error)) throw error;
      transactionResult = await resolveDuplicate(safeOrderId, request, fingerprint);
    } finally {
      await session.endSession();
    }

    let postCommit = null;
    let postCommitWarning = null;
    try {
      postCommit = await postCommitProcessor({
        orderId: transactionResult.orderId,
        evidence: transactionResult.evidence,
      });
      if (postCommit?.retryable === true) {
        postCommitWarning = {
          code: 'MANUAL_PAYMENT_POST_COMMIT_RETRY_REQUIRED',
          message:
            'El pago quedó confirmado, pero sus efectos posteriores requieren reintento.',
        };
      }
    } catch (error) {
      postCommitWarning = {
        code: error?.code || 'MANUAL_PAYMENT_POST_COMMIT_FAILED',
        message:
          error?.message ||
          'El pago quedó confirmado, pero sus efectos posteriores requieren reintento.',
      };
    }

    const order = await executeQuery(
      OrderModel.findById(transactionResult.orderId),
      { lean: true }
    );
    return {
      confirmed: transactionResult.duplicate !== true,
      duplicate: transactionResult.duplicate === true,
      order,
      evidence: serializeEvidence(transactionResult.evidence),
      postCommit,
      postCommitWarning,
    };
  }

  return Object.freeze({ confirmManualPayment });
}

module.exports = {
  createManualPaymentConfirmationService,
};
