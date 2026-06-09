// backend/scripts/test-wompi-declined-webhook.js

const path = require('path');
const mongoose = require('mongoose');
const crypto = require('crypto');

require('dotenv').config({
  path: path.join(__dirname, '..', '.env'),
});

const SiteSettings = require('../models/SiteSettings');
const InventoryReservation = require('../models/InventoryReservation');
const InventoryStock = require('../models/InventoryStock');
const InventoryMovement = require('../models/InventoryMovement');
const Order = require('../models/Order');

const API_BASE = 'http://localhost:5000';

function getNestedValue(obj, path) {
  const safePath = String(path || '').trim();
  if (!safePath) return '';

  return safePath.split('.').reduce((acc, key) => {
    if (acc == null || typeof acc !== 'object') return undefined;
    return acc[key];
  }, obj);
}

function buildWompiEventChecksum(payload, eventSecret) {
  const signature =
    payload?.signature && typeof payload.signature === 'object'
      ? payload.signature
      : {};

  const properties = Array.isArray(signature.properties)
    ? signature.properties
    : [];

  const timestamp = payload?.timestamp;

  const propertiesConcat = properties
    .map((prop) => getNestedValue(payload?.data || {}, prop))
    .map((value) => (value === undefined || value === null ? '' : String(value)))
    .join('');

  const raw = `${propertiesConcat}${String(timestamp || '')}${String(eventSecret || '')}`;

  return crypto.createHash('sha256').update(raw).digest('hex');
}

async function getWompiWebhookSecret() {
  const settings = await SiteSettings.findOne().lean();

  const secret =
    settings?.theme?.global?.payments?.credentials?.wompi?.webhookSecret || '';

  if (!secret) {
    throw new Error(
      'No encontré webhookSecret de Wompi en SiteSettings. Revisa la configuración de pagos.'
    );
  }

  return secret;
}

async function createTestOrder() {
  const payload = {
    sessionId: `test_wompi_declined_${Date.now()}`,

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
      lastname: 'Wompi Rechazado',
      id: '123456789',
      emailOrPhone: 'cliente.wompi.rechazado@test.com',
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
      provider: 'wompi',
      providerLabel: 'Wompi',
      mode: 'sandbox',
      currency: 'COP',
      checkoutLabel: 'Wompi',
      enableWebhook: true,
      status: 'pending_gateway',
    },
  };

  const response = await fetch(`${API_BASE}/api/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': `test-wompi-declined-${Date.now()}`,
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

async function simulateWompiDeclinedWebhook(orderNumber, webhookSecret) {
  const reference = `ORDER-${orderNumber}__TRY__TEST-WOMPI-DECLINED-${Date.now()}`;
  const transactionId = `TEST-WOMPI-DECLINED-${Date.now()}`;
  const timestamp = Date.now();

  const payload = {
    event: 'transaction.updated',
    timestamp,
    data: {
      transaction: {
        id: transactionId,
        status: 'DECLINED',
        reference,
        amount_in_cents: 9000000,
        currency: 'COP',
        payment_method_type: 'CARD',
        payment_method: {
          type: 'CARD',
        },
        created_at: new Date().toISOString(),
        finalized_at: new Date().toISOString(),
      },
    },
    signature: {
      properties: [
        'transaction.id',
        'transaction.status',
        'transaction.reference',
        'transaction.amount_in_cents',
      ],
      checksum: '',
    },
  };

  payload.signature.checksum = buildWompiEventChecksum(payload, webhookSecret);

  const response = await fetch(`${API_BASE}/api/payments/wompi/webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Event-Checksum': payload.signature.checksum,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  console.log('\n💳 RESPUESTA WEBHOOK WOMPI RECHAZADO:');
  console.log({
    status: response.status,
    data,
  });

  if (!response.ok) {
    throw new Error(`Webhook Wompi rechazado falló: ${JSON.stringify(data)}`);
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
    releaseReason: reservation?.releaseReason,
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
      : 'Correcto: no se creó movimiento sale_out porque Wompi rechazó el pago.'
  );
}

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error('No existe MONGODB_URI en backend/.env');
  }

  await mongoose.connect(process.env.MONGODB_URI);

  console.log('✅ Conectado a MongoDB Atlas');

  const webhookSecret = await getWompiWebhookSecret();

  const orderData = await createTestOrder();

  await simulateWompiDeclinedWebhook(orderData.orderNumber, webhookSecret);

  await printFinalState(orderData.orderNumber);

  await mongoose.disconnect();

  console.log('\n✅ Prueba Wompi rechazado finalizada.');
}

main().catch(async (error) => {
  console.error('\n❌ ERROR EN PRUEBA WOMPI RECHAZADO:', error.message);

  try {
    await mongoose.disconnect();
  } catch {
    // ignorar
  }

  process.exit(1);
});