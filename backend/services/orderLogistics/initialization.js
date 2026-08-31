'use strict';

const Order = require('../../models/Order');
const {
  hydrateOrderInventoryAllocations,
} = require('../orderInventoryAllocationService');
const { DISPATCHED_LOGISTICS_STATUSES } = require('./constants');
const {
  actorSnapshot,
  addHours,
  cleanLower,
  cleanText,
  createLogisticsError,
  idValue,
} = require('./support');
const {
  buildShipmentGroups,
  logisticsEligibility,
  logisticsView,
  reconcileOrderFromLogistics,
} = require('./logisticsViewModel');
const {
  createOrderEvent,
  runInTransaction,
} = require('./transactionSupport');

function defaultShipmentCode(order, group, index) {
  const orderPart = cleanText(order?.orderNumber || idValue(order?._id), 40)
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(-12)
    .toUpperCase();
  const branchPart = cleanText(group?.branchSnapshot?.code, 12)
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase();
  return `SHP-${orderPart || 'ORDER'}-${
    branchPart || String(index + 1).padStart(2, '0')
  }`;
}

async function initializeOrderLogistics(
  {
    orderFilter,
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
  if (!orderFilter || typeof orderFilter !== 'object') {
    throw createLogisticsError(
      'Falta el alcance autorizado de la orden.',
      'ORDER_SCOPE_REQUIRED',
      403
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
    await hydrateOrderInventoryAllocations(order, { session });
    const eligibility = logisticsEligibility(order, {
      authorizedBranchIds,
      allowAllBranches,
    });
    if (!eligibility.canInitialize) {
      throw createLogisticsError(eligibility.blockingMessage, eligibility.code, 409);
    }

    const allowedBranches = new Set(
      (Array.isArray(authorizedBranchIds) ? authorizedBranchIds : [])
        .map(idValue)
        .filter(Boolean)
    );
    const groups = buildShipmentGroups(order).filter(
      (group) => allowAllBranches || allowedBranches.has(idValue(group.branch))
    );
    if (!groups.length) {
      throw createLogisticsError(
        'La orden no tiene asignaciones físicas vendidas para preparar.',
        'ORDER_LOGISTICS_ALLOCATIONS_REQUIRED',
        409
      );
    }

    if (!order.fulfillment) order.fulfillment = {};
    const existing = Array.isArray(order.fulfillment.shipments)
      ? order.fulfillment.shipments
      : [];
    const byBranch = new Map(
      existing.map((shipment) => [idValue(shipment.branch), shipment])
    );
    const actorView = actorSnapshot(actor);

    for (const [index, group] of groups.entries()) {
      const branchId = idValue(group.branch);
      const current = byBranch.get(branchId);
      if (current) {
        if (!DISPATCHED_LOGISTICS_STATUSES.has(cleanLower(current.status))) {
          current.allocationIds = group.allocationIds;
          current.quantity = group.quantity;
          current.branchSnapshot = group.branchSnapshot;
          current.updatedAt = now;
        }
        continue;
      }

      const code = defaultShipmentCode(order, group, index);
      const initialStatus =
        group.deliveredQuantity >= group.quantity
          ? 'delivered'
          : group.shippedQuantity >= group.quantity
            ? 'dispatched'
            : 'ready_to_pick';
      const legacyState = initialStatus !== 'ready_to_pick';
      existing.push({
        code,
        branch: group.branch,
        branchSnapshot: group.branchSnapshot,
        allocationIds: group.allocationIds,
        quantity: group.quantity,
        initializationSource: legacyState
          ? 'legacy_allocation_state'
          : 'inventory_allocations',
        status: initialStatus,
        resumeStatus: initialStatus,
        priority: 'normal',
        revision: 0,
        packages: [{ code: `${code}-P01` }],
        sla: {
          pickingDueAt: addHours(now, 4),
          dispatchDueAt: addHours(now, 24),
          deliveryDueAt: addHours(now, 72),
          lastEvaluatedAt: now,
        },
        history: [
          {
            action: 'initialize',
            statusFrom: '',
            statusTo: initialStatus,
            note: legacyState
              ? 'Envío reconstruido desde cantidades históricas de inventario; la referencia externa anterior no estaba disponible.'
              : 'Envío creado desde las asignaciones confirmadas de inventario.',
            actor: actorView,
            at: now,
          },
        ],
        dispatchedAt: ['dispatched', 'delivered'].includes(initialStatus)
          ? group.shippedAt || group.deliveredAt || now
          : null,
        deliveredAt:
          initialStatus === 'delivered' ? group.deliveredAt || now : null,
        updatedAt: now,
      });
    }

    order.fulfillment.shipments = existing;
    reconcileOrderFromLogistics(order, now);
    order.timeline = Array.isArray(order.timeline) ? order.timeline : [];
    order.timeline.push({
      type: 'system',
      message: `Logística preparada: ${existing.length} envío(s) por sede.`,
      by: actorView.displayName || actorView.source,
      at: now,
    });
    await order.save({ session });

    await createOrderEvent(
      OrderEventModel,
      {
        orderId: order._id,
        type: 'logistics_initialized',
        message: `Logística preparada con ${existing.length} envío(s).`,
        meta: {
          shipmentCount: existing.length,
          branches: existing.map((shipment) => idValue(shipment.branch)),
          by: actorView,
        },
      },
      session
    );

    return {
      order,
      ...logisticsView(order, now, {
        authorizedBranchIds,
        allowAllBranches,
      }),
    };
  }, externalSession);
}

module.exports = {
  initializeOrderLogistics,
};
