'use strict';
const assert = require('node:assert/strict');
const Order = require('../../models/Order');
const OrderEvent = require('../../models/OrderEvent');
const OrderRefund = require('../../models/OrderRefund');
const OrderReturn = require('../../models/OrderReturn');
const {
  createOrderReturn,
  resolveOrderReturnRefund,
  updateOrderReturn,
} = require('../../services/orderReturnService');
const {
  generateOrderReturnLabel,
  quoteOrderReturnShipping,
  scheduleOrderReturnPickup,
} = require('../../services/orderReturnShippingService');
const { ensureCarrierJourney } = require('./returnWebhookStage');
const PACKAGE = Object.freeze({
  code: 'WFE-RMA-01',
  weightGrams: 500,
  lengthCm: 20,
  widthCm: 20,
  heightCm: 20,
});
const ACTOR = Object.freeze({ label: 'QA Wompi + Factus + Envia', role: 'manager' });
function nextBusinessDate(offset = 1, now = new Date()) {
  const date = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  ));
  let remaining = Math.max(1, Number(offset) || 1);
  while (remaining > 0) {
    date.setUTCDate(date.getUTCDate() + 1);
    if (![0, 6].includes(date.getUTCDay())) remaining -= 1;
  }
  return date.toISOString().slice(0, 10);
}
function choosePickupRate(rates = []) {
  const candidates = rates.filter((rate) =>
    rate.carrierActionsResolved === true &&
    (rate.carrierActions || []).some((action) =>
      ['pickup', 'pickup_mandatory'].includes(action)
    )
  );
  candidates.sort((left, right) => Number(left.totalPrice) - Number(right.totalPrice));
  assert(
    candidates[0],
    'Envia no devolvió una tarifa RMA con recolección independiente. No se simulará esa capacidad.'
  );
  return candidates[0];
}
async function freshReturn(returnId) {
  const returnCase = await OrderReturn.findById(returnId);
  assert(returnCase, 'El RMA desapareció durante la prueba.');
  return returnCase;
}
async function createRma(order) {
  const item = order.items.find((candidate) => candidate.requiresShipping !== false);
  assert(item, 'La orden entregada no tiene una línea física para devolver.');
  const returnCase = await createOrderReturn(
    {
      orderFilter: { _id: order._id },
      items: [{
        orderItemId: String(item._id),
        quantity: 1,
        reasonCode: 'not_as_described',
        reasonText: 'Devolución integral de prueba oficial Sandbox.',
      }],
      requestedResolution: 'refund',
      reasonSummary: 'Traza Wompi + Factus + Envia Sandbox.',
      actor: ACTOR,
      idempotencyKey: `WFE-RMA-${order.orderNumber}`,
    },
    { OrderEventModel: OrderEvent }
  );
  return { item, returnCase: await freshReturn(returnCase._id) };
}
async function authorizeRma(order, item, returnCase) {
  if (returnCase.status !== 'requested') return returnCase;
  const authorized = await updateOrderReturn(
    {
      orderFilter: { _id: order._id },
      returnId: returnCase._id,
      action: 'authorize',
      expectedRevision: returnCase.revision,
      payload: {
        items: [{ orderItemId: String(item._id), authorizedQuantity: 1 }],
        riskReviewNote: 'Identidad, entrega, historial y trazabilidad Sandbox verificados.',
        shipping: { method: 'pending' },
      },
      actor: ACTOR,
    },
    { OrderEventModel: OrderEvent }
  );
  return freshReturn(authorized._id);
}
async function ensureReturnLabel(order, returnCase) {
  if (returnCase.shipping?.labelUrl) return returnCase;
  const input = {
    orderFilter: { _id: order._id },
    returnId: returnCase._id,
    expectedRevision: returnCase.revision,
    destinationBranchId: order.branch,
    packages: [PACKAGE],
    provider: 'envia',
  };
  const quoted = await quoteOrderReturnShipping(input);
  const rate = choosePickupRate(quoted.rates);
  const generated = await generateOrderReturnLabel({
    ...input,
    rate,
    confirmStorePaidShipping: true,
    idempotencyKey: `WFE-RMA-LABEL-${returnCase.returnNumber}`,
  });
  assert.strictEqual(generated.actionRequired, false, 'La guía RMA requiere revisión manual.');
  return freshReturn(returnCase._id);
}
async function schedulePickup(order, returnCase) {
  if (['scheduled', 'completed'].includes(
    returnCase.shipping?.integration?.pickup?.status
  )) return returnCase;
  let lastError;
  for (let offset = 1; offset <= 8; offset += 1) {
    const pickupDate = nextBusinessDate(offset);
    try {
      await scheduleOrderReturnPickup({
        orderFilter: { _id: order._id },
        returnId: returnCase._id,
        expectedRevision: returnCase.revision,
        provider: 'envia',
        pickupDate,
        pickupTimeStart: '09:00',
        pickupTimeEnd: '14:00',
        pickupInstructions: 'Recolección oficial de prueba Sandbox; no existe paquete físico.',
        idempotencyKey: `WFE-RMA-PICKUP-${returnCase.returnNumber}-${pickupDate}`,
      });
      return freshReturn(returnCase._id);
    } catch (error) {
      lastError = error;
      if (!/requested day|requested date|fecha seleccionada|otro día|día hábil/i
        .test(error.message || '')) throw error;
      returnCase = await freshReturn(returnCase._id);
    }
  }
  throw lastError || new Error('Envia no aceptó una fecha de recolección Sandbox.');
}
async function receiveAndInspect(order, item, returnCase) {
  if (returnCase.status === 'in_transit') {
    const received = await updateOrderReturn({
      orderFilter: { _id: order._id }, returnId: returnCase._id,
      action: 'receive', expectedRevision: returnCase.revision,
      payload: { items: [{ orderItemId: String(item._id), receivedQuantity: 1 }] },
      actor: ACTOR,
    }, { OrderEventModel: OrderEvent });
    returnCase = await freshReturn(received._id);
  }
  if (returnCase.status === 'received') {
    const inspected = await updateOrderReturn({
      orderFilter: { _id: order._id }, returnId: returnCase._id,
      action: 'inspect', expectedRevision: returnCase.revision,
      payload: { items: [{
        orderItemId: String(item._id), sellableQuantity: 1,
        damagedQuantity: 0, quarantineQuantity: 0, rejectedQuantity: 0,
        inspectionNote: 'Unidad Sandbox recibida y apta para inventario.',
      }] }, actor: ACTOR,
    }, { OrderEventModel: OrderEvent });
    returnCase = await freshReturn(inspected._id);
  }
  return returnCase;
}
async function completeSandboxRma(order) {
  const created = await createRma(order);
  let returnCase = await authorizeRma(order, created.item, created.returnCase);
  if (returnCase.status === 'resolved' && returnCase.resolution?.refund) {
    return {
      order: await Order.findById(order._id),
      refund: await OrderRefund.findById(returnCase.resolution.refund),
      returnCase,
    };
  }
  returnCase = await ensureReturnLabel(order, returnCase);
  returnCase = await schedulePickup(order, returnCase);
  returnCase = await ensureCarrierJourney(order, returnCase);
  returnCase = await receiveAndInspect(order, created.item, returnCase);
  assert.strictEqual(returnCase.status, 'resolution_required');
  const resolved = await resolveOrderReturnRefund({
    orderFilter: { _id: order._id }, returnId: returnCase._id,
    expectedRevision: returnCase.revision, actor: ACTOR,
  }, { OrderEventModel: OrderEvent });
  return {
    order: await Order.findById(order._id),
    refund: resolved.refund,
    returnCase: await freshReturn(returnCase._id),
  };
}
module.exports = { PACKAGE, choosePickupRate, completeSandboxRma, nextBusinessDate };
