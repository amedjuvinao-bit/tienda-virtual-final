'use strict';

const Order = require('../../models/Order');
const { SHIPMENT_ACTIONS } = require('./constants');
const {
  actorSnapshot,
  appendShipmentHistory,
  cleanLower,
  cleanText,
  createLogisticsError,
  idValue,
} = require('./support');
const {
  evaluateShipmentSla,
  logisticsView,
  reconcileOrderFromLogistics,
} = require('./logisticsViewModel');
const {
  applyIncidentAction,
  applyOperationalTransition,
  applyPlanUpdate,
  ensureExpectedRevision,
  resolveIncident,
} = require('./shipmentStateMachine');
const {
  createOrderEvent,
  runInTransaction,
} = require('./transactionSupport');

async function updateOrderShipment(
  {
    orderFilter,
    shipmentId,
    action,
    expectedRevision,
    payload = {},
    actor = {},
    now = new Date(),
    authorizedBranchIds = [],
    allowAllBranches = false,
  } = {},
  {
    OrderModel = Order,
    OrderEventModel = null,
    session: externalSession = null,
  } = {}
) {
  const normalizedAction = cleanLower(action);
  const allowedActions = new Set([
    ...Object.keys(SHIPMENT_ACTIONS),
    'update_plan',
    'report_incident',
    'resolve_incident',
  ]);
  if (!allowedActions.has(normalizedAction)) {
    throw createLogisticsError(
      'La acción logística no es válida.',
      'INVALID_LOGISTICS_ACTION',
      400
    );
  }

  return runInTransaction(async (session) => {
    const order = await OrderModel.findOne(orderFilter).session(session);
    if (!order) {
      throw createLogisticsError(
        'Orden no encontrada dentro de tus sedes autorizadas.',
        'ORDER_NOT_FOUND',
        404
      );
    }
    const shipment = order.fulfillment?.shipments?.id(shipmentId);
    if (!shipment) {
      throw createLogisticsError(
        'Envío logístico no encontrado.',
        'SHIPMENT_NOT_FOUND',
        404
      );
    }
    const allowedBranches = new Set(
      (Array.isArray(authorizedBranchIds) ? authorizedBranchIds : [])
        .map(idValue)
        .filter(Boolean)
    );
    if (!allowAllBranches && !allowedBranches.has(idValue(shipment.branch))) {
      throw createLogisticsError(
        'No tienes permiso para operar el envío de esa sede.',
        'SHIPMENT_BRANCH_FORBIDDEN',
        403
      );
    }
    ensureExpectedRevision(shipment, expectedRevision);

    const previousStatus = cleanLower(shipment.status);
    const actorView = actorSnapshot(actor);
    if (normalizedAction === 'update_plan') {
      applyPlanUpdate(shipment, payload);
    } else if (normalizedAction === 'report_incident') {
      applyIncidentAction(shipment, payload, actorView, now);
    } else if (normalizedAction === 'resolve_incident') {
      resolveIncident(shipment, payload, actorView, now);
    } else {
      applyOperationalTransition(order, shipment, normalizedAction, payload, now);
    }

    shipment.revision = Number(shipment.revision || 0) + 1;
    shipment.updatedAt = now;
    evaluateShipmentSla(shipment, now);
    appendShipmentHistory(shipment, {
      action: normalizedAction,
      statusFrom: previousStatus,
      statusTo: cleanLower(shipment.status),
      note: cleanText(
        payload.note || payload.description || payload.resolution,
        1000
      ),
      evidenceReference: cleanText(
        payload.dispatchReference || payload.deliveryReference,
        240
      ),
      actor: actorView,
      at: now,
    });
    const summary = reconcileOrderFromLogistics(order, now);
    order.timeline = Array.isArray(order.timeline) ? order.timeline : [];
    order.timeline.push({
      type: 'system',
      message: `Logística ${shipment.code}: ${previousStatus} → ${shipment.status}.`,
      by: actorView.displayName || actorView.source,
      at: now,
    });
    await order.save({ session });

    await createOrderEvent(
      OrderEventModel,
      {
        orderId: order._id,
        type: `logistics_${normalizedAction}`,
        message: `Envío ${shipment.code}: ${previousStatus} → ${shipment.status}.`,
        meta: {
          shipmentId: idValue(shipment._id),
          shipmentCode: shipment.code,
          action: normalizedAction,
          revision: shipment.revision,
          branchId: idValue(shipment.branch),
          by: actorView,
        },
      },
      session
    );

    const scopedView = logisticsView(order, now, {
      authorizedBranchIds,
      allowAllBranches,
    });
    return {
      order,
      ...scopedView,
      shipment,
    };
  }, externalSession);
}

module.exports = {
  updateOrderShipment,
};
