'use strict';

const assert = require('node:assert/strict');
const { closeExpiredManualOrder } = require('../services/inventoryReservation/expireManualOrder');

async function main() {
  const now = new Date('2026-09-28T01:20:00.000Z');
  const reservation = { _id: 'reservation-1' };
  const session = {};
  const events = [];
  const OrderEventModel = {
    async create(documents, options) {
      assert.equal(options.session, session);
      events.push(...documents);
    },
  };
  let saved = 0;
  const order = {
    _id: 'order-1', source: 'manual', status: 'pending',
    payment: { provider: 'manual', status: 'pending_manual' },
    inventoryControl: { reservationRequired: true, discountedAtCheckout: true },
    timeline: [],
    async save(options) { assert.equal(options.session, session); saved += 1; },
  };

  assert.equal(await closeExpiredManualOrder({ order, reservation, now, session, OrderEventModel }), true);
  assert.equal(order.status, 'failed');
  assert.equal(order.payment.status, 'failed');
  assert.equal(order.inventoryControl.discountedAtCheckout, false);
  assert.equal(order.inventoryControl.restockedOnFailure, true);
  assert.equal(order.fulfillmentStatus, 'cancelled');
  assert.equal(order.timeline.length, 1);
  assert.equal(events[0].meta.reservationId, reservation._id);
  assert.equal(saved, 1);

  assert.equal(await closeExpiredManualOrder({ order, reservation, now, session, OrderEventModel }), false);
  assert.equal(saved, 1, 'el reintento no vuelve a cerrar el pedido');

  const paid = {
    ...order, status: 'paid',
    payment: { provider: 'manual', status: 'paid' },
  };
  assert.equal(await closeExpiredManualOrder({ order: paid, reservation, now, session, OrderEventModel }), false);
  assert.equal(paid.payment.status, 'paid');
  assert.equal(events.length, 1, 'no cambia un pedido ya pagado');
  console.log('Vencimiento de pedido: libera estado pendiente una sola vez y conserva pagos confirmados.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
