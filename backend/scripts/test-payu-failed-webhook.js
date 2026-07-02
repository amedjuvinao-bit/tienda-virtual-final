// backend/scripts/test-payu-failed-webhook.js

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
    sessionId: `test_payu_failed_${Date.now()}`,

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
      lastname: 'PayU Rechazado',
      id: '123456789',
      emailOrPhone: 'cliente.payu.rechazado@test.com',
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
      'Idempotency-Key': `test-payu-failed-${Date.now()}`,
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

async function simulatePayUFailedWebhook(orderNumber) {
  const reference = `ORDER-${orderNumber}__TRY__TEST-FAILED-${Date.now()}`;

  const form = new URLSearchParams();
  form.set('reference_sale', reference);
  form.set('state_pol', '6');
  form.set('transaction_id', `TEST-PAYU-FAILED-${Date.now()}`);
  form.set('value', '90000');
  form.set('currency', 'COP');
  form.set('lapTransactionState', 'DECLINED');
  form.set('status', 'DECLINED');

  const response = await fetch(`${API_BASE}/api/payments/payu/webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  });

  const data = await response.json();

  console.log('\n💳 RESPUESTA WEBHOOK PAYU RECHAZADO:');
  console.log({
    status: response.status,
    data,
  });

  if (!response.ok) {
    throw new Error(`Webhook PayU rechazado falló: ${JSON.stringify(data)}`);
  }

  return data;
}

async function printStock(title, reservation) {
  const stockRows = reservation?.items?.[0]?.product
    ? await InventoryStock.find({
        product: reservation.items[0].product,
        deletedAt: null,
      })
        .select('branchSnapshot variant stock reservedStock availableStock')
        .lean()
    : [];

  console.log(`\n📦 ${title}:`);
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
}

async function printFinalState(orderNumber) {
  const order = await Order.findOne({ orderNumber }).lean();

  const reservation = await InventoryReservation.findOne({
    orderNumber,
  }).lean();

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
    releaseReason: reservation?.releaseReason,
  });

  await printStock('STOCK FINAL', reservation);

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
      : 'Correcto: no se creó movimiento sale_out porque el pago fue rechazado.'
  );
}

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error('No existe MONGODB_URI en backend/.env');
  }

  await mongoose.connect(process.env.MONGODB_URI);

  console.log('✅ Conectado a MongoDB Atlas');

  const orderData = await createTestOrder();

  const reservationBefore = await InventoryReservation.findOne({
    orderNumber: orderData.orderNumber,
  }).lean();

  console.log('\n📌 RESERVA DESPUÉS DE CREAR ORDEN:');
  console.log({
    reservationCode: reservationBefore?.reservationCode,
    status: reservationBefore?.status,
    orderNumber: reservationBefore?.orderNumber,
  });

  await printStock('STOCK DESPUÉS DE CREAR ORDEN', reservationBefore);

  await simulatePayUFailedWebhook(orderData.orderNumber);

  await printFinalState(orderData.orderNumber);

  await mongoose.disconnect();

  console.log('\n✅ Prueba PayU rechazado finalizada.');
}

main().catch(async (error) => {
  console.error('\n❌ ERROR EN PRUEBA PAYU RECHAZADO:', error.message);

  try {
    await mongoose.disconnect();
  } catch {
    // ignorar
  }

  process.exit(1);
});