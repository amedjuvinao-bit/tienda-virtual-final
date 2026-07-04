// backend/scripts/testAdminPosReceipt.js

require('dotenv').config();

const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const Order = require('../models/Order');

const BASE_URL = String(process.env.TEST_BASE_URL || 'http://localhost:5000').replace(/\/+$/, '');
const TEST_EMAIL_TO = String(process.env.TEST_POS_RECEIPT_EMAIL_TO || '').trim();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function buildToken() {
  if (!process.env.JWT_SECRET) throw new Error('Falta JWT_SECRET.');

  return jwt.sign(
    {
      role: 'admin',
      username: 'script-pos-receipt',
      authType: 'legacy',
      adminRole: 'admin',
    },
    process.env.JWT_SECRET,
    { expiresIn: '10m' }
  );
}

async function requestJson(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${buildToken()}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  return { status: response.status, data };
}

async function requestBuffer(path) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${buildToken()}`,
      Accept: 'application/pdf',
    },
  });

  const buffer = Buffer.from(await response.arrayBuffer());
  return { status: response.status, buffer, contentType: response.headers.get('content-type') || '' };
}

async function main() {
  console.log('Test comprobante POS');
  console.log('Base URL:', BASE_URL);

  if (!process.env.MONGODB_URI) throw new Error('Falta MONGODB_URI.');
  await mongoose.connect(process.env.MONGODB_URI);

  const order = await Order.findOne({ source: 'pos', status: 'paid' })
    .sort({ createdAt: -1 })
    .lean();

  assert(order, 'No hay orden POS pagada para probar comprobante.');

  console.log('Orden POS:', order.orderNumber);

  const receipt = await requestJson(`/api/admin/pos/sales/${order._id}/receipt`);
  console.log('GET receipt HTTP:', receipt.status);
  console.log('Cliente:', receipt.data?.receipt?.customer?.name || '');
  console.log('Total:', receipt.data?.receipt?.totals?.total || 0);

  assert(receipt.status === 200, `Esperado HTTP 200 en comprobante, recibido ${receipt.status}.`);
  assert(receipt.data?.ok === true, 'El comprobante debe responder ok:true.');
  assert(receipt.data?.receipt?.order?.orderNumber === order.orderNumber, 'El número de orden no coincide.');
  assert(Array.isArray(receipt.data?.receipt?.items), 'El comprobante debe tener items.');

  const pdf = await requestBuffer(`/api/admin/pos/sales/${order._id}/receipt/pdf`);
  console.log('GET receipt PDF HTTP:', pdf.status);
  console.log('PDF bytes:', pdf.buffer.length);

  assert(pdf.status === 200, `Esperado HTTP 200 en PDF, recibido ${pdf.status}.`);
  assert(pdf.contentType.includes('application/pdf'), 'La respuesta PDF debe tener content-type application/pdf.');
  assert(pdf.buffer.length > 500, 'El PDF del comprobante parece vacío.');

  if (TEST_EMAIL_TO) {
    const sent = await requestJson(`/api/admin/pos/sales/${order._id}/send-email`, {
      method: 'POST',
      body: JSON.stringify({
        to: TEST_EMAIL_TO,
        generateInvoice: true,
      }),
    });

    console.log('POST send-email HTTP:', sent.status);
    console.log('Mensaje:', sent.data?.message || sent.data?.message);

    assert(sent.status === 200, `Esperado HTTP 200 enviando correo, recibido ${sent.status}.`);
    assert(sent.data?.ok === true, 'El envío debe responder ok:true.');
  } else {
    console.log('Envio de correo omitido. Define TEST_POS_RECEIPT_EMAIL_TO para probarlo.');
  }

  console.log('Comprobante POS correcto.');
}

main()
  .catch((error) => {
    console.error('Error probando comprobante POS:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
