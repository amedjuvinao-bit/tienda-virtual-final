/* eslint-disable no-console */
'use strict';

require('dotenv').config({
  path: require('path').join(__dirname, '..', '.env'),
  quiet: true,
});

const mongoose = require('mongoose');

const Customer = require('../models/Customer');
const Order = require('../models/Order');
const StoreCredit = require('../models/StoreCredit');
const {
  assertPersistentConfirmation,
  buildOrderDraft,
  buildRunId,
  loadCandidates,
} = require('./seedPersistentOrdersTrace');

const DEMO = Object.freeze({
  documentType: 'CC',
  documentNumber: '1010123456',
  email: 'saldo.checkout@example.com',
  phone: '3001112233',
  firstName: 'Cliente',
  lastName: 'Saldo Checkout',
  creditNumber: 'SC-DEMO-CHECKOUT',
  creditAmount: 300000,
});

function parseArgs(argv = process.argv.slice(2)) {
  return {
    confirmPersist: argv.includes('--confirm-persist'),
  };
}

async function ensureCustomer() {
  let customer = await Customer.findOne({
    documentType: DEMO.documentType,
    normalizedDocument: DEMO.documentNumber,
    deletedAt: null,
  });
  if (!customer) {
    customer = new Customer({
      firstName: DEMO.firstName,
      lastName: DEMO.lastName,
      fullName: `${DEMO.firstName} ${DEMO.lastName}`,
      email: DEMO.email,
      phone: DEMO.phone,
      documentType: DEMO.documentType,
      documentNumber: DEMO.documentNumber,
      source: 'system',
      notes: 'Cliente DEMO para validar saldo a favor en Checkout.',
      tags: ['demo', 'checkout', 'saldo-a-favor'],
    });
  } else {
    customer.firstName = DEMO.firstName;
    customer.lastName = DEMO.lastName;
    customer.fullName = `${DEMO.firstName} ${DEMO.lastName}`;
    customer.email = DEMO.email;
    customer.phone = DEMO.phone;
    customer.status = 'active';
    customer.deletedAt = null;
  }
  await customer.save();
  return customer;
}

async function ensureDeliveredOrder(customer, candidate, now) {
  const sessionId = 'demo_checkout_store_credit';
  const existing = await Order.findOne({ sessionId });
  if (existing) return existing;

  const runId = buildRunId({ now, label: 'saldo-checkout' });
  const activityAt = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const draft = buildOrderDraft(
    {
      key: 'checkout_store_credit',
      label: 'Saldo a favor para Checkout',
      sequence: 1,
      candidates: [candidate],
      activityAt,
      status: 'delivered',
      paymentStatus: 'paid',
      allocationState: 'sold',
    },
    runId
  );
  draft.sessionId = sessionId;
  draft.status = 'delivered';
  draft.fulfillmentStatus = 'delivered';
  draft.tags = ['demo', 'checkout', 'saldo-a-favor', 'no-despachar', 'no-facturar'];
  draft.customer = {
    ...customer.toOrderSnapshot(),
    customerId: customer._id,
  };
  draft.billing = {
    ...draft.billing,
    name: customer.fullName,
    firstName: customer.firstName,
    lastName: customer.lastName,
    documentType: customer.documentType,
    documentNumber: customer.documentNumber,
    email: customer.email,
    phone: customer.phone,
  };
  draft.timeline = [{
    type: 'system',
    message: 'Orden DEMO entregada para probar saldo a favor. No mueve inventario, caja, Wompi, DIAN ni transportadoras.',
    by: 'checkout-store-credit-demo',
    at: activityAt,
  }];
  draft.notes = [{
    text: 'PRUEBA LOCAL: no facturar, no despachar y no conciliar como venta real.',
    by: 'checkout-store-credit-demo',
    pinned: true,
    at: activityAt,
  }];

  const order = new Order(draft);
  order.inventoryAllocations.forEach((allocation, index) => {
    allocation.orderItem = order.items[index]?._id || order.items[0]?._id || null;
  });
  await order.save();
  return order;
}

async function ensureStoreCredit(customer, order, now) {
  let credit = await StoreCredit.findOne({ creditNumber: DEMO.creditNumber });
  if (!credit) {
    credit = new StoreCredit({
      creditNumber: DEMO.creditNumber,
      customer: customer._id,
      customerKey: `customer:${customer._id}`,
      currency: 'COP',
      originalAmount: DEMO.creditAmount,
      balance: DEMO.creditAmount,
      status: 'active',
      expiresAt: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
      sourceOrder: order._id,
      sourceOrderNumber: order.orderNumber,
      sourceReturn: new mongoose.Types.ObjectId(),
      issuedAt: now,
      issuedBy: {
        label: 'Script DEMO Checkout',
        role: 'system',
      },
    });
  } else {
    credit.customer = customer._id;
    credit.customerKey = `customer:${customer._id}`;
    credit.originalAmount = DEMO.creditAmount;
    credit.balance = DEMO.creditAmount;
    credit.status = 'active';
    credit.expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    credit.sourceOrder = order._id;
    credit.sourceOrderNumber = order.orderNumber;
    credit.revision += 1;
  }
  await credit.save();
  return credit;
}

async function run(options = parseArgs()) {
  assertPersistentConfirmation(options);
  const mongoUri =
    process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DB_URI || '';
  if (!mongoUri) {
    throw new Error('Falta MONGODB_URI, MONGO_URI o DB_URI en backend/.env.');
  }

  await mongoose.connect(mongoUri);
  const now = new Date();
  const candidates = await loadCandidates(200);
  if (!candidates.length) {
    throw new Error('No hay un producto con existencia y sede válidas para crear la orden DEMO.');
  }

  const customer = await ensureCustomer();
  const order = await ensureDeliveredOrder(customer, candidates[0], now);
  const credit = await ensureStoreCredit(customer, order, now);

  console.log('\n=== SALDO A FAVOR DEMO CREADO ===');
  console.log(`Orden entregada: ${order.orderNumber}`);
  console.log(`Cliente: ${customer.fullName}`);
  console.log(`Cédula: ${DEMO.documentNumber}`);
  console.log(`Correo: ${DEMO.email}`);
  console.log(`Teléfono: ${DEMO.phone}`);
  console.log(`Saldo disponible: COP $${Number(credit.balance).toLocaleString('es-CO')}`);
  console.log(`Vence: ${credit.expiresAt.toISOString().slice(0, 10)}`);
  console.log('\nEn Checkout escribe la cédula y el correo anteriores y pulsa "Consultar saldo".');
  console.log('Seguridad: no se modificaron existencias, caja, Wompi, Factus ni transportadoras.');

  return { customer, order, credit };
}

async function main() {
  try {
    await run();
  } catch (error) {
    console.error(`\nERROR: ${error.message}`);
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect().catch(() => {});
    }
  }
}

if (require.main === module) main();

module.exports = { DEMO, parseArgs, run };
