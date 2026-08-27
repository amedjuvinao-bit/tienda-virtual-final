'use strict';

const mongoose = require('mongoose');

const Counter = require('../../models/Counter');
const Order = require('../../models/Order');
const OrderReturn = require('../../models/OrderReturn');
const {
  confirmInventoryReservation,
  createInventoryReservation,
} = require('../inventoryReservationService');
const { getOrderReturnPolicy } = require('../orderReturnPolicyService');
const { createOrderEvent } = require('./events');
const {
  actorSnapshot,
  cleanLower,
  cleanText,
  createReturnError,
  idValue,
  objectId,
  orderLines,
  toQuantity,
} = require('./normalization');
const { safeReturnView } = require('./presentation');
const { assertExpectedRevision } = require('./validation');
const {
  assertReplacementOrderBranchScope,
} = require('./exchangeBranchScope');

async function resolveOrderReturnExchange(
  {
    orderFilter,
    replacementOrderFilter,
    returnId,
    expectedRevision,
    reference,
    actor = {},
    now = new Date(),
  } = {},
  { OrderEventModel = null } = {}
) {
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const [order, replacementOrder] = await Promise.all([
        Order.findOne(orderFilter).session(session),
        Order.findOne(replacementOrderFilter).session(session),
      ]);
      if (!order) throw createReturnError('Orden original no encontrada.', 'ORDER_NOT_FOUND', 404);
      if (!replacementOrder) {
        throw createReturnError(
          'La orden de reemplazo no existe o está fuera de tus sedes.',
          'REPLACEMENT_ORDER_NOT_FOUND',
          404
        );
      }
      if (idValue(replacementOrder._id) === idValue(order._id)) {
        throw createReturnError('La orden de reemplazo debe ser diferente.', 'REPLACEMENT_ORDER_INVALID', 400);
      }
      if (['failed', 'cancelled', 'canceled', 'refunded'].includes(cleanLower(replacementOrder.status))) {
        throw createReturnError('La orden de reemplazo no está operativamente vigente.', 'REPLACEMENT_ORDER_INVALID', 409);
      }
      const safeReference = cleanText(reference, 240);
      if (safeReference.length < 4) {
        throw createReturnError('Registra la referencia o motivo del cambio.', 'EXCHANGE_REFERENCE_REQUIRED', 400);
      }
      const returnCase = await OrderReturn.findOne({
        _id: objectId(returnId, 'El RMA'),
        order: order._id,
      }).session(session);
      if (!returnCase) throw createReturnError('RMA no encontrado.', 'RETURN_NOT_FOUND', 404);
      if (
        returnCase.status === 'resolved' &&
        returnCase.resolution?.type === 'exchange'
      ) {
        const sameReplacement =
          idValue(returnCase.resolution.replacementOrder) ===
          idValue(replacementOrder._id);
        const sameReference =
          cleanText(returnCase.resolution.reference, 240) === safeReference;
        if (!sameReplacement || !sameReference) {
          throw createReturnError(
            'El RMA ya fue resuelto con otro cambio.',
            'RETURN_ALREADY_RESOLVED',
            409
          );
        }
        result = safeReturnView(returnCase);
        return;
      }
      assertExpectedRevision(returnCase, expectedRevision);
      if (returnCase.status !== 'resolution_required' || returnCase.requestedResolution !== 'exchange') {
        throw createReturnError('El RMA no está listo para cambio.', 'RETURN_EXCHANGE_NOT_READY', 409);
      }
      returnCase.status = 'resolved';
      returnCase.resolvedAt = now;
      returnCase.resolvedBy = actorSnapshot(actor);
      returnCase.resolution = {
        type: 'exchange',
        state: 'completed',
        amount: 0,
        reference: safeReference,
        replacementOrder: replacementOrder._id,
        replacementOrderNumber: replacementOrder.orderNumber,
        completedAt: now,
      };
      returnCase.revision += 1;
      await returnCase.save({ session });
      await createOrderEvent(
        OrderEventModel,
        {
          orderId: order._id,
          type: 'return_resolved_exchange',
          message: `RMA ${returnCase.returnNumber} enlazado con la orden de reemplazo ${replacementOrder.orderNumber}.`,
          meta: {
            returnId: returnCase._id,
            replacementOrderId: replacementOrder._id,
            replacementOrderNumber: replacementOrder.orderNumber,
            reference: safeReference,
            revision: returnCase.revision,
            by: actorSnapshot(actor),
          },
        },
        session
      );
      result = safeReturnView(returnCase);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

async function nextOrderNumber(session) {
  const counter = await Counter.findOneAndUpdate(
    { _id: 'orderNumber' },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true, session }
  ).lean();
  return String(counter.seq).padStart(6, '0');
}

function buildReplacementItems(order, returnCase) {
  const lines = new Map(
    orderLines(order).map((line) => [idValue(line._id || line.orderItemId), line])
  );
  return (returnCase.items || [])
    .filter((item) => toQuantity(item.acceptedQuantity) > 0)
    .map((returnItem) => {
      const original = lines.get(idValue(returnItem.orderItemId)) || {};
      const plain = typeof original.toObject === 'function'
        ? original.toObject({ depopulate: true })
        : { ...original };
      delete plain._id;
      const quantity = toQuantity(returnItem.acceptedQuantity);
      return {
        ...plain,
        product: returnItem.product || original.product || original.productId,
        productId: idValue(returnItem.product || original.product || original.productId),
        title: returnItem.title || original.title || 'Producto de cambio',
        size: returnItem.size || original.size || '',
        color: returnItem.color || original.color || '',
        variantKey: returnItem.variantKey || original.variantKey || 'default__default',
        qty: quantity,
        quantity,
        price: 0,
        unitPrice: 0,
        priceNumber: 0,
        lineSubtotal: 0,
        discountAmount: 0,
        taxableBase: 0,
        taxAmount: 0,
        lineTotal: 0,
      };
    });
}

async function resolveOrderReturnAutomaticExchange(
  {
    orderFilter,
    returnId,
    expectedRevision,
    reference = 'Cambio automático por RMA',
    actor = {},
    authorizedBranchIds = [],
    allowAllBranches = true,
    now = new Date(),
  } = {},
  { OrderEventModel = null } = {}
) {
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const order = await Order.findOne(orderFilter).session(session);
      if (!order) throw createReturnError('Orden original no encontrada.', 'ORDER_NOT_FOUND', 404);
      const returnCase = await OrderReturn.findOne({
        _id: objectId(returnId, 'El RMA'),
        order: order._id,
      }).session(session);
      if (!returnCase) throw createReturnError('RMA no encontrado.', 'RETURN_NOT_FOUND', 404);
      if (
        returnCase.status === 'resolved' &&
        returnCase.resolution?.type === 'exchange' &&
        returnCase.resolution?.replacementOrder
      ) {
        const replacementOrder = await Order.findById(
          returnCase.resolution.replacementOrder
        ).session(session).lean();
        assertReplacementOrderBranchScope(replacementOrder, {
          authorizedBranchIds,
          allowAllBranches,
        });
        result = {
          returnCase: safeReturnView(returnCase),
          replacementOrder,
          idempotent: true,
        };
        return;
      }
      assertExpectedRevision(returnCase, expectedRevision);
      if (
        returnCase.status !== 'resolution_required' ||
        returnCase.requestedResolution !== 'exchange'
      ) {
        throw createReturnError(
          'El RMA no está listo para cambio.',
          'RETURN_EXCHANGE_NOT_READY',
          409
        );
      }
      const policy = await getOrderReturnPolicy({ session });
      if (!policy.automaticExchangeEnabled) {
        throw createReturnError(
          'La creación automática de cambios está desactivada.',
          'RETURN_AUTOMATIC_EXCHANGE_DISABLED',
          409
        );
      }
      const items = buildReplacementItems(order, returnCase);
      if (!items.length) {
        throw createReturnError(
          'No hay unidades aceptadas para crear el cambio.',
          'RETURN_EXCHANGE_ITEMS_REQUIRED',
          409
        );
      }
      const orderNumber = await nextOrderNumber(session);
      const totalItems = items.reduce((sum, item) => sum + toQuantity(item.quantity), 0);
      const [replacementOrder] = await Order.create(
        [
          {
            sessionId: `exchange:${returnCase._id}`,
            orderNumber,
            status: 'paid',
            fulfillmentStatus: 'pending',
            branch: order.branch || null,
            branchSnapshot: order.branchSnapshot || {},
            source: 'system',
            channel: 'system',
            saleType: 'system_order',
            exchangeOrigin: {
              type: 'rma_exchange',
              originalOrder: order._id,
              originalOrderNumber: order.orderNumber,
              returnCase: returnCase._id,
              returnNumber: returnCase.returnNumber,
              noCharge: true,
            },
            customer: order.customer || {},
            billing: order.billing || {},
            items,
            cart: items,
            summary: { itemsCount: items.length, totalItems, subtotal: 0 },
            subtotal: 0,
            shipping: 0,
            total: 0,
            taxes: {
              iva: {
                enabled: false,
                percent: 0,
                code: '01',
                name: 'IVA',
                taxableBase: 0,
                amount: 0,
              },
            },
            discount: {
              type: 'none',
              value: 0,
              amount: 0,
              reason: `Cambio sin cobro por ${returnCase.returnNumber}`,
            },
            pricing: {
              version: 2,
              currency: order.payment?.currency || 'COP',
              subtotal: 0,
              productDiscount: 0,
              subtotalAfterDiscount: 0,
              originalShipping: 0,
              shippingDiscount: 0,
              shipping: 0,
              totalDiscount: 0,
              taxableBase: 0,
              taxAmount: 0,
              total: 0,
            },
            payment: {
              active: false,
              provider: 'manual',
              providerLabel: 'Cambio RMA',
              mode: order.payment?.mode || 'sandbox',
              currency: order.payment?.currency || 'COP',
              status: 'paid',
              methodType: 'store_credit',
              method: 'exchange',
              methodLabel: 'Cambio sin cobro',
              reference: returnCase.returnNumber,
              amountInCents: 0,
              amount: 0,
              paidAt: now,
            },
            inventoryControl: {
              reservationRequired: true,
              reservationId: null,
              discountedAtCheckout: false,
              restockedOnFailure: false,
              restockedAt: null,
            },
            tags: ['exchange'],
            timeline: [
              {
                type: 'system',
                message: `Orden creada automáticamente desde ${returnCase.returnNumber}.`,
                by: 'system',
                at: now,
              },
            ],
          },
        ],
        { session }
      );

      const reservation = await createInventoryReservation(
        {
          sessionId: replacementOrder.sessionId,
          order: replacementOrder._id,
          orderNumber: replacementOrder.orderNumber,
          paymentReference: returnCase.returnNumber,
          source: 'admin',
          items: replacementOrder.items,
          branchPriorityIds: [
            ...(order.branch ? [String(order.branch)] : []),
            ...(Array.isArray(authorizedBranchIds)
              ? authorizedBranchIds.map(String)
              : []),
          ],
          allowedBranchIds: allowAllBranches
            ? null
            : authorizedBranchIds,
          expiresInMinutes: 60,
          currency: order.payment?.currency || 'COP',
          metadata: {
            source: 'rma_automatic_exchange',
            returnId: String(returnCase._id),
            originalOrderId: String(order._id),
          },
          notes: `Reserva automática para cambio ${returnCase.returnNumber}.`,
        },
        { session }
      );
      if (reservation) {
        await confirmInventoryReservation(
          reservation._id,
          {
            order: replacementOrder._id,
            orderNumber: replacementOrder.orderNumber,
            paymentReference: returnCase.returnNumber,
          },
          { session }
        );
        await Order.updateOne(
          { _id: replacementOrder._id },
          {
            $set: {
              'inventoryControl.reservationId': reservation._id,
              'inventoryControl.discountedAtCheckout': true,
            },
          },
          { session }
        );
      } else {
        await Order.updateOne(
          { _id: replacementOrder._id },
          {
            $set: {
              'inventoryControl.reservationRequired': false,
              'inventoryControl.discountedAtCheckout': true,
            },
          },
          { session }
        );
      }

      returnCase.status = 'resolved';
      returnCase.resolvedAt = now;
      returnCase.resolvedBy = actorSnapshot(actor);
      returnCase.resolution = {
        type: 'exchange',
        state: 'completed',
        amount: 0,
        reference: cleanText(reference, 240) || 'Cambio automático por RMA',
        replacementOrder: replacementOrder._id,
        replacementOrderNumber: replacementOrder.orderNumber,
        completedAt: now,
      };
      returnCase.revision += 1;
      await returnCase.save({ session });
      await createOrderEvent(
        OrderEventModel,
        {
          orderId: order._id,
          type: 'return_resolved_automatic_exchange',
          message: `RMA ${returnCase.returnNumber} creó la orden de cambio ${replacementOrder.orderNumber}.`,
          meta: {
            returnId: returnCase._id,
            replacementOrderId: replacementOrder._id,
            replacementOrderNumber: replacementOrder.orderNumber,
            reservationId: reservation?._id || null,
            revision: returnCase.revision,
            by: actorSnapshot(actor),
          },
        },
        session
      );
      await createOrderEvent(
        OrderEventModel,
        {
          orderId: replacementOrder._id,
          type: 'exchange_order_created',
          message: `Orden de cambio creada desde ${order.orderNumber} y ${returnCase.returnNumber}.`,
          meta: {
            originalOrderId: order._id,
            originalOrderNumber: order.orderNumber,
            returnId: returnCase._id,
            returnNumber: returnCase.returnNumber,
          },
        },
        session
      );
      const refreshedReplacement = await Order.findById(replacementOrder._id)
        .session(session)
        .lean();
      assertReplacementOrderBranchScope(refreshedReplacement, {
        authorizedBranchIds,
        allowAllBranches,
      });
      result = {
        returnCase: safeReturnView(returnCase),
        replacementOrder: refreshedReplacement,
        idempotent: false,
      };
    });
    return result;
  } finally {
    await session.endSession();
  }
}

module.exports = {
  resolveOrderReturnAutomaticExchange,
  resolveOrderReturnExchange,
};
