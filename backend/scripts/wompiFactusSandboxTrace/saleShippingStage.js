'use strict';

const assert = require('node:assert/strict');
const Order = require('../../models/Order');
const OrderEvent = require('../../models/OrderEvent');
const {
  initializeOrderLogistics,
  updateOrderShipment,
} = require('../../services/orderLogisticsService');

const PACKAGE = Object.freeze({
  code: 'WFE-PICKUP-01',
  weightGrams: 500,
  lengthCm: 20,
  widthCm: 20,
  heightCm: 20,
});
const ACTOR = Object.freeze({
  displayName: 'QA Wompi + Factus + Envia',
  role: 'manager',
});

function shipmentFrom(order, shipmentId = '') {
  const shipments = order?.fulfillment?.shipments || [];
  return shipments.find((item) => String(item._id) === String(shipmentId)) || shipments[0];
}

async function freshOrder(orderId) {
  const order = await Order.findById(orderId);
  assert(order, 'La orden desapareció durante la entrega de prueba.');
  return order;
}

async function ensureShipment(order) {
  if (order.fulfillment?.shipments?.length) return order;
  const initialized = await initializeOrderLogistics(
    {
      orderFilter: { _id: order._id },
      actor: ACTOR,
      allowAllBranches: true,
    },
    { OrderEventModel: OrderEvent }
  );
  return initialized.order;
}

function payloadFor(action) {
  if (action === 'update_plan') {
    return { packages: [PACKAGE], note: 'Paquete de retiro normalizado para la traza.' };
  }
  if (action === 'dispatch') {
    return {
      carrier: { name: 'Retiro en tienda', code: 'STORE_PICKUP' },
      packages: [PACKAGE],
      dispatchReference: 'WFE-STORE-PICKUP-READY',
      note: 'Pedido preparado y entregado al área de retiro.',
    };
  }
  if (action === 'deliver') {
    return {
      deliveryReference: 'WFE-CUSTOMER-PICKUP',
      recipient: 'Cliente Sandbox',
      note: 'Retiro Sandbox confirmado por el flujo administrativo.',
    };
  }
  return { note: `Transición automática ${action} de la traza Sandbox.` };
}

async function transition(order, shipment, action) {
  const updated = await updateOrderShipment(
    {
      orderFilter: { _id: order._id },
      shipmentId: shipment._id,
      action,
      expectedRevision: shipment.revision,
      payload: payloadFor(action),
      actor: ACTOR,
      allowAllBranches: true,
    },
    { OrderEventModel: OrderEvent }
  );
  return updated.order;
}

async function ensureSandboxSaleDelivered(sourceOrder) {
  let order = await ensureShipment(await freshOrder(sourceOrder._id));
  let shipment = shipmentFrom(order);
  const actions = {
    ready_to_pick: ['update_plan', 'start_picking'],
    picking: ['complete_picking'],
    picked: ['start_packing'],
    packing: ['complete_packing'],
    packed: ['dispatch'],
    dispatched: ['mark_in_transit'],
    in_transit: ['deliver'],
  };

  while (shipment?.status !== 'delivered') {
    const next = actions[shipment?.status];
    assert(next, `La venta quedó en un estado logístico no reanudable: ${shipment?.status}.`);
    for (const action of next) {
      order = await transition(order, shipment, action);
      shipment = shipmentFrom(order, shipment._id);
    }
  }
  assert.strictEqual(order.status, 'delivered');
  assert.strictEqual(order.fulfillmentStatus, 'delivered');
  return { order, shipment };
}

module.exports = { PACKAGE, ensureSandboxSaleDelivered };
