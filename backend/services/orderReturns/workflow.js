'use strict';

const mongoose = require('mongoose');

const Order = require('../../models/Order');
const OrderReturn = require('../../models/OrderReturn');
const {
  normalizeRequestedItems,
  restoreInventory,
} = require('../orderRefundService');
const {
  applyReturnsToOrderInventoryAllocations,
  hydrateOrderInventoryAllocations,
} = require('../orderInventoryAllocationService');
const { loadReturnUsage } = require('./eligibility');
const { createOrderEvent } = require('./events');
const {
  MUTABLE_RETURN_STATUSES,
  actorSnapshot,
  cleanLower,
  cleanText,
  createReturnError,
  idValue,
  objectId,
} = require('./normalization');
const { safeReturnView } = require('./presentation');
const {
  applyAuthorization,
  applyReceipt,
  assertManualReturnTransitAllowed,
  assertReturnShippingCancelled,
  assertExpectedRevision,
  validateInspection,
} = require('./validation');

async function updateOrderReturn(
  {
    orderFilter,
    returnId,
    action,
    expectedRevision,
    payload = {},
    actor = {},
    now = new Date(),
  } = {},
  { OrderEventModel = null } = {}
) {
  const cleanAction = cleanLower(action, 60);
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const order = await Order.findOne(orderFilter).session(session);
      if (!order) throw createReturnError('Orden no encontrada.', 'ORDER_NOT_FOUND', 404);
      const returnCase = await OrderReturn.findOne({
        _id: objectId(returnId, 'El RMA'),
        order: order._id,
      }).session(session);
      if (!returnCase) throw createReturnError('RMA no encontrado.', 'RETURN_NOT_FOUND', 404);
      assertExpectedRevision(returnCase, expectedRevision);

      if (cleanAction === 'authorize') {
        applyAuthorization(returnCase, payload, actor, now);
      } else if (cleanAction === 'reject') {
        if (returnCase.status !== 'requested') {
          throw createReturnError('Solo un RMA solicitado puede rechazarse.', 'RETURN_STATUS_INVALID', 409);
        }
        const reason = cleanText(payload.reason, 800);
        if (reason.length < 5) throw createReturnError('Explica el motivo del rechazo.', 'RETURN_REJECTION_REASON_REQUIRED', 400);
        returnCase.status = 'rejected';
        returnCase.rejectionReason = reason;
        returnCase.rejectedAt = now;
        returnCase.resolvedBy = actorSnapshot(actor);
        returnCase.resolution = {
          type: 'no_refund',
          state: 'completed',
          amount: 0,
          reference: 'RMA_REJECTED',
          completedAt: now,
        };
      } else if (cleanAction === 'mark_in_transit') {
        if (returnCase.status !== 'authorized') {
          throw createReturnError('Solo un RMA autorizado puede marcarse en tránsito.', 'RETURN_STATUS_INVALID', 409);
        }
        assertManualReturnTransitAllowed(returnCase);
        returnCase.shipping.carrierName = cleanText(payload.shipping?.carrierName || returnCase.shipping?.carrierName, 160);
        returnCase.shipping.trackingNumber = cleanText(payload.shipping?.trackingNumber || returnCase.shipping?.trackingNumber, 180);
        returnCase.shipping.trackingUrl = cleanText(payload.shipping?.trackingUrl || returnCase.shipping?.trackingUrl, 1000);
        returnCase.shipping.labelUrl = cleanText(payload.shipping?.labelUrl || returnCase.shipping?.labelUrl, 1000);
        returnCase.shipping.labelType = returnCase.shipping.labelUrl
          ? 'carrier'
          : 'internal_rma';
        returnCase.shipping.instructions = cleanText(
          payload.shipping?.instructions || returnCase.shipping?.instructions,
          1600
        );
        returnCase.status = 'in_transit';
        returnCase.inTransitAt = now;
      } else if (cleanAction === 'receive') {
        applyReceipt(returnCase, payload, actor, now);
      } else if (cleanAction === 'cancel') {
        if (!MUTABLE_RETURN_STATUSES.has(returnCase.status) || returnCase.status === 'received') {
          throw createReturnError('Este RMA ya no puede cancelarse.', 'RETURN_STATUS_INVALID', 409);
        }
        assertReturnShippingCancelled(returnCase);
        const reason = cleanText(payload.reason, 800);
        if (reason.length < 5) throw createReturnError('Explica el motivo de la cancelación.', 'RETURN_CANCELLATION_REASON_REQUIRED', 400);
        returnCase.status = 'cancelled';
        returnCase.cancellationReason = reason;
        returnCase.cancelledAt = now;
        returnCase.resolvedBy = actorSnapshot(actor);
        returnCase.resolution = {
          type: 'no_refund',
          state: 'completed',
          amount: 0,
          reference: 'RMA_CANCELLED',
          completedAt: now,
        };
      } else if (cleanAction === 'inspect') {
        if (returnCase.status !== 'received') {
          throw createReturnError('El RMA debe estar recibido antes de inspeccionarlo.', 'RETURN_STATUS_INVALID', 409);
        }
        const inspections = validateInspection(returnCase, payload.items);
        const usage = await loadReturnUsage(order._id, {
          session,
          excludeReturnId: returnCase._id,
        });
        const normalizedItems = normalizeRequestedItems(
          order,
          inspections
            .filter((item) => item.acceptedQuantity > 0)
            .map((item) => ({
              orderItemId: item.orderItemId,
              quantity: item.acceptedQuantity,
              restockQuantity: item.sellableQuantity,
            })),
          usage.returnedByLine
        );
        const restorations = await restoreInventory({
          order,
          returnCase,
          requestedItems: normalizedItems,
          previousRestoredByStock: usage.restoredByStock,
          adminId: actorSnapshot(actor).id,
          session,
        });
        const inspectionMap = new Map(inspections.map((item) => [item.orderItemId, item]));
        for (const item of returnCase.items) {
          const inspection = inspectionMap.get(idValue(item.orderItemId));
          item.sellableQuantity = inspection.sellableQuantity;
          item.damagedQuantity = inspection.damagedQuantity;
          item.quarantineQuantity = inspection.quarantineQuantity;
          item.rejectedQuantity = inspection.rejectedQuantity;
          item.acceptedQuantity = inspection.acceptedQuantity;
          item.inspectionNote = inspection.inspectionNote;
        }
        await hydrateOrderInventoryAllocations(order, { session });
        applyReturnsToOrderInventoryAllocations(order, restorations, now);
        await Order.updateOne(
          { _id: order._id },
          {
            $set: {
              inventoryAllocations: order.inventoryAllocations,
              inventoryAllocationSummary: order.inventoryAllocationSummary,
            },
          },
          { session }
        );
        returnCase.inventoryRestorations = restorations;
        returnCase.inventoryProcessedAt = now;
        returnCase.inspectedAt = now;
        returnCase.inspectedBy = actorSnapshot(actor);
        const acceptedTotal = inspections.reduce((sum, item) => sum + item.acceptedQuantity, 0);
        if (acceptedTotal > 0) {
          returnCase.status = 'resolution_required';
          returnCase.resolution = {
            ...(returnCase.resolution?.toObject?.() || returnCase.resolution || {}),
            type: returnCase.requestedResolution,
            state: 'action_required',
          };
        } else {
          returnCase.status = 'resolved';
          returnCase.resolvedAt = now;
          returnCase.resolvedBy = actorSnapshot(actor);
          returnCase.resolution = {
            type: 'no_refund',
            state: 'completed',
            amount: 0,
            reference: 'INSPECTION_REJECTED',
            completedAt: now,
          };
        }
      } else {
        throw createReturnError('La acción solicitada no es válida.', 'RETURN_ACTION_INVALID', 400);
      }

      returnCase.revision += 1;
      await returnCase.save({ session });
      await createOrderEvent(
        OrderEventModel,
        {
          orderId: order._id,
          type: `return_${cleanAction}`,
          message: `RMA ${returnCase.returnNumber}: ${cleanAction}.`,
          meta: {
            returnId: returnCase._id,
            returnNumber: returnCase.returnNumber,
            action: cleanAction,
            status: returnCase.status,
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

module.exports = { updateOrderReturn };
