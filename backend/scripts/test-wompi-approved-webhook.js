// backend/scripts/test-wompi-approved-webhook.js

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
const ElectronicInvoice = require('../models/ElectronicInvoice');

const API_BASE = 'http://localhost:5000';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getNestedValue(obj, pathValue) {
  const safePath = String(pathValue || '').trim();
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

async function getSettingsDoc() {
  const settings = await SiteSettings.findOne().lean();

  if (!settings) {
    throw new Error('No encontré SiteSettings en la base de datos.');
  }

  return settings;
}

async function getWompiWebhookSecret(settings) {
  const possibleSecrets = [
    settings?.theme?.global?.payments?.credentials?.wompi?.webhookSecret,
    settings?.theme?.global?.payments?.wompi?.webhookSecret,
    settings?.theme?.payments?.credentials?.wompi?.webhookSecret,
    settings?.theme?.payments?.wompi?.webhookSecret,
    settings?.payments?.credentials?.wompi?.webhookSecret,
    settings?.payments?.wompi?.webhookSecret,
    process.env.WOMPI_WEBHOOK_SECRET,
    process.env.WOMPI_EVENTS_SECRET,
  ];

  const secret = possibleSecrets
    .map((value) => String(value || '').trim())
    .find(Boolean);

  if (!secret) {
    throw new Error(
      'No encontré webhookSecret de Wompi ni en SiteSettings ni en .env.'
    );
  }

  console.log('\n🔐 WebhookSecret de Wompi encontrado para la prueba.');

  return secret;
}

async function createTestOrder() {
  const payload = {
    sessionId: `test_wompi_approved_${Date.now()}`,

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
      lastname: 'Wompi Aprobado',
      id: '123456789',
      emailOrPhone: 'cliente.wompi.aprobado@test.com',
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
      'Idempotency-Key': `test-wompi-approved-${Date.now()}`,
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

async function simulateWompiApprovedWebhook(orderNumber, webhookSecret) {
  const reference = `ORDER-${orderNumber}__TRY__TEST-WOMPI-APPROVED-${Date.now()}`;
  const transactionId = `TEST-WOMPI-APPROVED-${Date.now()}`;
  const timestamp = Date.now();

  const payload = {
    event: 'transaction.updated',
    timestamp,
    data: {
      transaction: {
        id: transactionId,
        status: 'APPROVED',
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

  console.log('\n💳 RESPUESTA WEBHOOK WOMPI APROBADO:');
  console.log({
    status: response.status,
    data,
  });

  if (!response.ok) {
    throw new Error(`Webhook Wompi aprobado falló: ${JSON.stringify(data)}`);
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

  const electronicInvoice = await ElectronicInvoice.findOne({
    orderId: order?._id,
  })
    .sort({ createdAt: -1 })
    .lean();

  console.log('\n📌 ORDEN FINAL:');
  console.log({
    orderNumber: order?.orderNumber,
    orderStatus: order?.status,
    paymentStatus: order?.payment?.status,
    paymentProvider: order?.payment?.provider,
    paymentTransactionId: order?.payment?.transactionId,
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
      : 'No se encontró movimiento sale_out'
  );

  console.log('\n🧾 FACTURACIÓN ELECTRÓNICA:');
  console.log(
    electronicInvoice
      ? {
          invoiceId: String(electronicInvoice._id),
          status: electronicInvoice.status,
          provider: electronicInvoice.provider,
          orderNumber: electronicInvoice.orderNumber,
          number: electronicInvoice.number,
          cufe: electronicInvoice.cufe ? 'GENERADO' : '',
          hasPdf: Boolean(electronicInvoice.pdfUrl),
          hasXml: Boolean(electronicInvoice.xmlUrl),
        }
      : 'No se encontró factura electrónica asociada a esta orden.'
  );
}

async function main() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('No existe MONGODB_URI en backend/.env');
    }

    await mongoose.connect(process.env.MONGODB_URI);

    console.log('✅ Conectado a MongoDB Atlas');

    const settings = await getSettingsDoc();
    const webhookSecret = await getWompiWebhookSecret(settings);

    const orderData = await createTestOrder();

    await simulateWompiApprovedWebhook(orderData.orderNumber, webhookSecret);

    await sleep(7000);

    await printFinalState(orderData.orderNumber);

    await mongoose.disconnect();

    console.log('\n✅ Prueba Wompi aprobado finalizada.');
  } catch (error) {
    console.error('\n❌ ERROR EN PRUEBA WOMPI APROBADO:', error.message);

    try {
      await mongoose.disconnect();
    } catch {
      // ignorar
    }

    process.exit(1);
  }
}

main();