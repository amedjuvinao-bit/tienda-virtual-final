// backend/scripts/test-payu-approved-webhook.js

const path = require('path');
const mongoose = require('mongoose');

require('dotenv').config({
  path: path.join(__dirname, '..', '.env'),
});

const InventoryReservation = require('../models/InventoryReservation');
const InventoryStock = require('../models/InventoryStock');
const InventoryMovement = require('../models/InventoryMovement');
const Order = require('../models/Order');

const API_BASE = 'http://localhost:5000';

async function createTestOrder() {
  const payload = {
    sessionId: `test_payu_approved_${Date.now()}`,

    cart: [
      {
        productId: '68a4a78a59706e44cade0316',
        title: 'Vestido Girasoles Lila',
        price: 90000,
        quantity: 1,
        size: '4',
        color: 'royalblue',
        image: '',
      },
    ],

    subtotal: 90000,
    shipping: 0,
    total: 90000,

    customer: {
      name: 'Cliente',
      lastname: 'PayU Prueba',
      id: '123456789',
      emailOrPhone: 'cliente.payu@test.com',
      phone: '3000000000',
      address: 'Dirección de prueba',
      city: 'Santa Marta',
      country: 'Colombia',
      department: 'Magdalena',
      deliveryType: 'envio',
      wantsNewsletter: false,
    },

    billing: {
      useSameAddress: true,
    },

    payment: {
      active: true,
      provider: 'payu',
      providerLabel: 'PayU',
      mode: 'sandbox',
      currency: 'COP',
      checkoutLabel: 'PayU',
      enableWebhook: true,
      status: 'pending_gateway',
    },
  };

  const response = await fetch(`${API_BASE}/api/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': `test-payu-${Date.now()}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  console.log('\n🧾 ORDEN CREADA:');
  console.log({
    status: response.status,
    orderId: data._id,
    orderNumber: data.orderNumber,
    reservationId: data.reservationId,
    reservationCode: data.reservationCode,
    reservationStatus: data.reservationStatus,
  });

  if (!response.ok) {
    throw new Error(`No se pudo crear la orden: ${JSON.stringify(data)}`);
  }

  return data;
}

async function simulatePayUApprovedWebhook(orderNumber) {
  const reference = `ORDER-${orderNumber}__TRY__TEST-${Date.now()}`;

  const form = new URLSearchParams();
  form.set('reference_sale', reference);
  form.set('state_pol', '4');
  form.set('transaction_id', `TEST-PAYU-${Date.now()}`);
  form.set('value', '90000');
  form.set('currency', 'COP');
  form.set('lapTransactionState', 'APPROVED');
  form.set('status', 'APPROVED');

  const response = await fetch(`${API_BASE}/api/payments/payu/webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  });

  const data = await response.json();

  console.log('\n💳 RESPUESTA WEBHOOK PAYU APROBADO:');
  console.log({
    status: response.status,
    data,
  });

  if (!response.ok) {
    throw new Error(`Webhook PayU falló: ${JSON.stringify(data)}`);
  }

  return data;
}

async function printFinalState(orderNumber) {
  const order = await Order.findOne({ orderNumber }).lean();

  const reservation = await InventoryReservation.findOne({
    orderNumber,
  }).lean();

  const stockRows = reservation?.items?.[0]?.product
    ? await InventoryStock.find({
        product: reservation.items[0].product,
        deletedAt: null,
      })
        .select('branchSnapshot variant stock reservedStock availableStock')
        .lean()
    : [];

  const movement = await InventoryMovement.findOne({
    orderNumber,
    type: 'sale_out',
  })
    .sort({ createdAt: -1 })
    .lean();

  console.log('\n📌 ORDEN FINAL:');
  console.log({
    orderNumber: order?.orderNumber,
    orderStatus: order?.status,
    paymentStatus: order?.payment?.status,
    paymentProvider: order?.payment?.provider,
  });

  console.log('\n📌 RESERVA FINAL:');
  console.log({
    reservationCode: reservation?.reservationCode,
    status: reservation?.status,
    confirmedAt: reservation?.confirmedAt,
    releasedAt: reservation?.releasedAt,
  });

  console.log('\n📦 STOCK FINAL:');
  console.log(
    stockRows.map((row) => ({
      branch: row.branchSnapshot?.name || '',
      size: row.variant?.size || '',
      color: row.variant?.color || '',
      stock: row.stock,
      reservedStock: row.reservedStock,
      availableStock: row.availableStock,
    }))
  );

  console.log('\n📤 MOVIMIENTO SALE_OUT:');
  console.log(
    movement
      ? {
          movementNumber: movement.movementNumber,
          type: movement.type,
          direction: movement.direction,
          quantity: movement.quantity,
          orderNumber: movement.orderNumber,
        }
      : 'No se encontró movimiento sale_out'
  );
}

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error('No existe MONGODB_URI en backend/.env');
  }

  await mongoose.connect(process.env.MONGODB_URI);

  console.log('✅ Conectado a MongoDB Atlas');

  const orderData = await createTestOrder();

  await simulatePayUApprovedWebhook(orderData.orderNumber);

  await printFinalState(orderData.orderNumber);

  await mongoose.disconnect();

  console.log('\n✅ Prueba PayU aprobado finalizada.');
}

main().catch(async (error) => {
  console.error('\n❌ ERROR EN PRUEBA PAYU:', error.message);

  try {
    await mongoose.disconnect();
  } catch {
    // ignorar
  }

  process.exit(1);
});