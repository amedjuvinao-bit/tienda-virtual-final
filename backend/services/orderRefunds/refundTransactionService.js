'use strict';

const mongoose = require('mongoose');

const Order = require('../../models/Order');
const OrderRefund = require('../../models/OrderRefund');
const {
  hydrateOrderInventoryAllocations,
  applyReturnsToOrderInventoryAllocations,
} = require('../orderInventoryAllocationService');
const {
  refreshOrderRefundReconciliation,
} = require('../orderRefundReconciliationService');
const {
  getPreviousRefundState,
  loadLegacyRefundState,
  mergeQuantityMaps,
} = require('./refundCalculations');
const { restoreInventory } = require('./refundInventoryService');
const {
  buildRefundNumber,
  canonicalRefundPayload,
  cleanLower,
  cleanText,
  createRefundError,
  getOrderLines,
  hashPayload,
  idValue,
  isPaidOrder,
  normalizeRequestedItems,
  toMoney,
  toObjectId,
  toQuantity,
} = require('./refundNormalization');
const {
  safeRefundResponse,
  serializeRefundItem,
} = require('./refundPresentation');
const {
  assertRefundAmountMatchesItems,
  assertSupportedRefundPaymentSources,
  resolveRefundableOrderTotal,
} = require('./refundPaymentIntegrity');

async function processOrderRefund(
  {
    orderId,
    amount,
    reason = '',
    items = [],
    idempotencyKey = '',
    adminId = null,
    adminLabel = '',
    returnCaseId = null,
  } = {},
  {
    session: externalSession = null,
    OrderEventModel = null,
    additionalReturnedByLine = new Map(),
    allowInventoryRestock = false,
  } = {}
) {
  const orderObjectId = toObjectId(orderId, 'La orden');
  const refundAmount = toMoney(amount);
  if (refundAmount <= 0) {
    throw createRefundError(
      'El monto del reembolso debe ser mayor a cero.',
      'AMOUNT_INVALID',
      400
    );
  }
  const safeAdminId = mongoose.Types.ObjectId.isValid(idValue(adminId))
    ? new mongoose.Types.ObjectId(idValue(adminId))
    : null;
  const ownsSession = !externalSession;
  const session =
    externalSession || (await mongoose.startSession());
  let resolvedIdempotencyKey = '';
  let resolvedRequestHash = '';

  async function execute() {
    const order = await Order.findById(orderObjectId).session(session);
    if (!order) {
      throw createRefundError(
        'Orden no encontrada.',
        'ORDER_NOT_FOUND',
        404
      );
    }
    if (!isPaidOrder(order)) {
      throw createRefundError(
        'Solo se pueden reembolsar órdenes pagadas.',
        'ORDER_NOT_PAID',
        409,
        {
          orderStatus: order.status,
          paymentStatus: order.payment?.status,
        }
      );
    }
    assertSupportedRefundPaymentSources(order);

    const processedRefunds = await OrderRefund.find({
      order: order._id,
      status: 'processed',
    })
      .sort({ createdAt: 1, _id: 1 })
      .session(session)
      .lean();
    const previous = getPreviousRefundState(processedRefunds);
    const legacy = await loadLegacyRefundState({
      order,
      orderLines: getOrderLines(order),
      OrderEventModel,
      session,
    });
    const normalizedItems = normalizeRequestedItems(
      order,
      items,
      new Map()
    );
    if (
      allowInventoryRestock === false &&
      normalizedItems.some(
        (item) =>
          !['digital', 'service'].includes(item.productType) &&
          item.requestedRestockQuantity > 0
      )
    ) {
      throw createRefundError(
        'El inventario físico solo puede reponerse desde un RMA recibido e inspeccionado. Para un ajuste exclusivamente financiero, envía restockQuantity en cero.',
        'RETURN_INSPECTION_REQUIRED',
        409
      );
    }
    const canonical = canonicalRefundPayload({
      amount: refundAmount,
      reason,
      items: normalizedItems,
      returnCaseId,
    });
    resolvedRequestHash = hashPayload(canonical);
    resolvedIdempotencyKey =
      cleanText(idempotencyKey).slice(0, 200) ||
      `auto:${resolvedRequestHash}`;

    const existing = await OrderRefund.findOne({
      order: order._id,
      idempotencyKey: resolvedIdempotencyKey,
    }).session(session);
    if (existing) {
      if (existing.requestHash !== resolvedRequestHash) {
        throw createRefundError(
          'La clave de idempotencia ya fue usada con otro reembolso.',
          'IDEMPOTENCY_KEY_REUSED',
          409
        );
      }
      const reconciled = await refreshOrderRefundReconciliation(existing._id, {
        session,
      });
      return {
        refund: safeRefundResponse(reconciled),
        idempotent: true,
      };
    }

    const previouslyReturnedByLine = mergeQuantityMaps(
      previous.returnedByLine,
      legacy.returnedByLine
    );
    const allPreviouslyReturnedByLine = mergeQuantityMaps(
      previouslyReturnedByLine,
      additionalReturnedByLine instanceof Map
        ? additionalReturnedByLine
        : new Map(Object.entries(additionalReturnedByLine || {}))
    );
    for (const item of normalizedItems) {
      const previouslyReturned = toQuantity(
        allPreviouslyReturnedByLine.get(item.orderItemId) || 0
      );
      if (
        previouslyReturned + item.returnedQuantity >
        item.purchasedQuantity
      ) {
        throw createRefundError(
          `La devolución de ${item.title || 'un producto'} supera la cantidad comprada.`,
          'REFUND_QUANTITY_EXCEEDS_PURCHASED',
          409,
          {
            orderItemId: item.orderItemId,
            purchasedQuantity: item.purchasedQuantity,
            previouslyReturned,
            requestedQuantity: item.returnedQuantity,
          }
        );
      }
    }

    const orderTotal = resolveRefundableOrderTotal(order);
    const previouslyRefunded =
      previous.amount + legacy.amount;
    const refundableAmount = toMoney(
      orderTotal - previouslyRefunded
    );
    if (refundAmount > refundableAmount) {
      throw createRefundError(
        'El monto supera el saldo disponible para reembolsar.',
        'REFUND_AMOUNT_EXCEEDS_ORDER',
        409,
        {
          orderTotal,
          previouslyRefunded,
          refundableAmount,
          requestedAmount: refundAmount,
        }
      );
    }
    assertRefundAmountMatchesItems({
      order,
      amount: refundAmount,
      items: normalizedItems,
    });

    const refund = new OrderRefund({
      refundNumber: buildRefundNumber(order.orderNumber),
      order: order._id,
      orderNumber: order.orderNumber,
      returnCase:
        returnCaseId && mongoose.Types.ObjectId.isValid(idValue(returnCaseId))
          ? new mongoose.Types.ObjectId(idValue(returnCaseId))
          : null,
      idempotencyKey: resolvedIdempotencyKey,
      requestHash: resolvedRequestHash,
      status: 'processing',
      amount: refundAmount,
      currency:
        order.payment?.currency ||
        order.pricing?.currency ||
        'COP',
      reason,
      items: normalizedItems.map(serializeRefundItem),
      inventoryRestorations: [],
      createdBy: safeAdminId,
      createdByLabel: cleanText(adminLabel || 'admin'),
      reconciliation: {
        state: 'action_required',
        inventory: { state: 'pending' },
        payment: {
          state: 'action_required',
          errorMessage: 'Debes confirmar cómo y cuándo se devolvió el dinero al cliente.',
        },
        cash: {
          state: order.cashSession ? 'pending' : 'not_required',
        },
        billing: { state: 'pending' },
        paymentProvider: cleanLower(order.payment?.provider),
        paymentMethod: cleanLower(order.payment?.method),
        paymentTransactionId: cleanText(order.payment?.transactionId),
        cashSession: order.cashSession || null,
      },
    });
    await refund.save({ session });

    const inventoryRestorations = await restoreInventory({
      order,
      refund,
      requestedItems: normalizedItems,
      previousRestoredByStock: previous.restoredByStock,
      adminId: safeAdminId,
      session,
    });
    refund.items = normalizedItems.map(serializeRefundItem);
    refund.inventoryRestorations = inventoryRestorations;
    refund.status = 'processed';
    refund.processedAt = new Date();
    await refund.save({ session });

    await hydrateOrderInventoryAllocations(order, {
      session,
    });
    applyReturnsToOrderInventoryAllocations(
      order,
      inventoryRestorations,
      refund.processedAt
    );

    await Order.updateOne(
      { _id: order._id },
      {
        $inc: {
          'refundControl.totalAmount': refundAmount,
          'refundControl.transactionCount': 1,
          'refundControl.returnedUnits':
            refund.totalReturnedUnits,
          'refundControl.restockedUnits':
            refund.totalRestockedUnits,
        },
        $set: {
          'refundControl.lastRefundAt': refund.processedAt,
          'refundControl.lastRefund': refund._id,
          inventoryAllocations:
            order.inventoryAllocations,
          inventoryAllocationSummary:
            order.inventoryAllocationSummary,
        },
      },
      { session }
    );

    const reconciledRefund = await refreshOrderRefundReconciliation(refund._id, {
      session,
    });

    if (OrderEventModel) {
      await OrderEventModel.create(
        [
          {
            orderId: order._id,
            type: 'refund_created',
            message: `Reembolso ${refund.refundNumber} por ${refundAmount.toLocaleString(
              'es-CO',
              {
                style: 'currency',
                currency: refund.currency || 'COP',
              }
            )}${reason ? ` · ${cleanText(reason)}` : ''}`,
            meta: {
              refundId: refund._id,
              refundNumber: refund.refundNumber,
              idempotencyKey: resolvedIdempotencyKey,
              amount: refundAmount,
              currency: refund.currency,
              reason: cleanText(reason),
              items: refund.items,
              inventoryMovements:
                inventoryRestorations.map(
                  (restoration) =>
                    restoration.inventoryMovement
                ),
              by: cleanText(adminLabel || 'admin'),
            },
          },
        ],
        { session }
      );
    }

    return {
      refund: safeRefundResponse(reconciledRefund),
      idempotent: false,
    };
  }

  try {
    if (externalSession) return await execute();

    let result;
    await session.withTransaction(async () => {
      result = await execute();
    });
    return result;
  } catch (error) {
    if (
      String(error?.code || '') === '11000' &&
      resolvedIdempotencyKey
    ) {
      const existing = await OrderRefund.findOne({
        order: orderObjectId,
        idempotencyKey: resolvedIdempotencyKey,
      });
      if (
        existing &&
        existing.requestHash === resolvedRequestHash
      ) {
        return {
          refund: safeRefundResponse(existing),
          idempotent: true,
        };
      }
    }
    throw error;
  } finally {
    if (ownsSession) {
      await session.endSession();
    }
  }
}

module.exports = {
  processOrderRefund,
};
