'use strict';

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Branch = require('../models/Branch');
const Product = require('../models/Product');
const Order = require('../models/Order');
const OrderEvent = require('../models/OrderEvent');
const inventory = require('../services/inventoryReservationService');
const pricing = require('../services/orderPricingService');
const customerLink = require('../services/customerOrderLinkService');
const idempotency = require('../services/orderCreationIdempotencyService');
const creation = require('../services/orderCreationTransactionService');
const allocation = require('../services/orderInventoryAllocationService');

const branchId = new mongoose.Types.ObjectId();
const productId = new mongoose.Types.ObjectId();
const reservationId = new mongoose.Types.ObjectId();
const reservationExpiry = new Date('2026-09-28T01:00:00.000Z');
const transaction = { withTransaction: async (callback) => callback(), endSession: async () => {} };
const original = [];
function replace(target, key, value) {
  original.push([target, key, target[key]]);
  target[key] = value;
}

async function main() {
  const operations = [];
  let active = true;
  let persisted;
  try {
    replace(mongoose, 'startSession', async () => transaction);
    replace(Branch, 'findOne', () => ({ session() { return this; }, lean: async () => active ? {
      _id: branchId, name: 'Principal', code: 'PP', type: 'store',
      settings: { allowManualOrders: true, allowInventoryMovements: true },
    } : null }));
    replace(Product, 'find', () => ({ select() { return this; }, session() { return this; }, lean: async () => [
      { _id: productId, title: 'Producto', price: 12000, variants: [] },
    ] }));
    replace(pricing, 'buildOrderQuote', async () => ({ pricing: {
      version: 2, currency: 'COP', subtotal: 24000, subtotalAfterDiscount: 24000,
      productDiscount: 0, originalShipping: 0, shippingDiscount: 0,
      shipping: 0, totalDiscount: 0, total: 24000,
      tax: { enabled: false, percent: 0, code: '01', name: 'IVA', taxableBase: 24000, amount: 0 },
      items: [{ productId: String(productId), title: 'Producto', quantity: 2, qty: 2, price: 12000 }],
    } }));
    replace(inventory, 'expandReservableItems', async () => [{ productId: String(productId), quantity: 2 }] );
    replace(inventory, 'createInventoryReservation', async (options, { session }) => {
      assert.equal(session, transaction);
      assert.deepEqual(options.allowedBranchIds.map(String), [String(branchId)]);
      assert.deepEqual(options.branchPriorityIds.map(String), [String(branchId)]);
      assert.equal(options.expiresInMinutes, 20);
      operations.push('reserve');
      return { _id: reservationId, expiresAt: reservationExpiry, items: [] };
    });
    replace(allocation, 'applyReservationToOrderDocument', () => {});
    replace(customerLink, 'resolveCustomerForOrder', async () => ({ skipped: true }));
    replace(customerLink, 'applyCustomerResolutionToOrderData', (base) => base);
    replace(customerLink, 'applyCustomerStatsForOrder', async () => {});
    replace(idempotency, 'inspectExistingIdempotency', async (_input, { endpoint }) => {
      assert.equal(endpoint, 'POST /orders/admin/manual');
      return { action: 'continue' };
    });
    replace(idempotency, 'beginIdempotencyRecord', async ({ session, endpoint }) => {
      assert.equal(session, transaction);
      assert.equal(endpoint, 'POST /orders/admin/manual');
      operations.push('begin');
      return { status: 'processing' };
    });
    replace(idempotency, 'completeIdempotencyRecord', async (_record, _result, { session }) => {
      assert.equal(session, transaction);
      operations.push('complete');
    });
    replace(creation, 'getNextOrderNumber', async () => '000123');
    replace(Order, 'create', async ([base], { session }) => {
      assert.equal(session, transaction);
      persisted = new Order(base);
      await persisted.validate();
      persisted.save = async () => { operations.push('save-reservation'); };
      operations.push('order');
      return [persisted];
    });
    replace(OrderEvent, 'create', async (_events, { session }) => {
      assert.equal(session, transaction);
      operations.push('event');
    });

    delete require.cache[require.resolve('../services/manualOrderCreationService')];
    const { createManualOrder } = require('../services/manualOrderCreationService');
    const req = { adminRole: 'owner', adminUserId: String(new mongoose.Types.ObjectId()), adminUsername: 'owner' };
    const body = {
      requestId: 'cbe109bb-830f-45d9-9106-a82dc23e2532', branchId: String(branchId),
      customer: { name: 'Ana', lastname: 'Prueba', id: '123456', emailOrPhone: 'ana@example.com', deliveryType: 'retiro' },
      billing: {
        personType: 'natural', documentType: 'CC', documentNumber: '123456',
        firstName: 'Ana', lastName: 'Prueba', email: 'ana@example.com',
        useSameAddress: false, address: 'Calle 1', countryCode: 'CO',
        department: 'Magdalena', departmentCode: '47', city: 'Santa Marta', municipalityCode: '47001',
      },
      items: [{ productId: String(productId), quantity: 2 }],
    };
    const result = await createManualOrder(req, body);
    assert.equal(result.order, persisted);
    assert.equal(persisted.source, 'manual');
    assert.equal(persisted.channel, 'manual');
    assert.equal(persisted.saleType, 'manual_order');
    assert.equal(persisted.payment.status, 'pending_manual');
    assert.equal(persisted.billing.municipalityCode, '47001');
    assert.equal(persisted.inventoryControl.discountedAtCheckout, false);
    assert.equal(persisted.inventoryControl.reservationExpiresAt?.getTime(), reservationExpiry.getTime());
    assert.equal(persisted.payment.amount, 24000);
    assert.equal(String(persisted.branch), String(branchId));
    assert.equal(String(persisted.inventoryControl.reservationId), String(reservationId));
    assert.deepEqual(operations, ['begin', 'order', 'reserve', 'save-reservation', 'event', 'complete']);

    active = false;
    operations.length = 0;
    await assert.rejects(createManualOrder(req, { ...body, requestId: '3228109b-a02a-447d-920b-36f8a5c0f9ab' }),
      { code: 'MANUAL_ORDERS_DISABLED' });
    assert.deepEqual(operations, [], 'una sede bloqueada no escribe ni reserva');
    console.log('Pedido manual: orden, pago, reserva aislada y bloqueo dentro de la transacción verificados.');
  } finally {
    original.reverse().forEach(([target, key, value]) => { target[key] = value; });
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
