// backend/scripts/testAdminPosRouteFlow.js

require('dotenv').config();

const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Branch = require('../models/Branch');
const Product = require('../models/Product');
const InventoryStock = require('../models/InventoryStock');
const Order = require('../models/Order');

const BASE_URL = String(process.env.TEST_BASE_URL || 'http://localhost:5000').replace(/\/+$/, '');

function fail(message) {
  throw new Error(message);
}

function available(row) {
  return Math.max(0, Number(row.stock || 0) - Number(row.reservedStock || 0));
}

function buildToken() {
  if (!process.env.JWT_SECRET) fail('Falta JWT_SECRET.');

  return jwt.sign(
    {
      role: 'admin',
      username: 'script-pos-route',
      authType: 'legacy',
      adminRole: 'admin',
    },
    process.env.JWT_SECRET,
    { expiresIn: '10m' }
  );
}

async function callSaleRoute(body) {
  const response = await fetch(`${BASE_URL}/api/admin/pos/sales`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${buildToken()}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
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

async function pickCandidate() {
  const branch = await Branch.findOne({
    deletedAt: null,
    active: true,
    status: 'active',
    'settings.allowPosSales': true,
  });

  if (!branch) fail('No hay sede POS activa.');

  const rows = await InventoryStock.find({
    branch: branch._id,
    active: true,
    deletedAt: null,
  }).limit(80).lean();

  for (const row of rows) {
    if (available(row) < 1) continue;

    const product = await Product.findOne({
      _id: row.product,
      active: { $ne: false },
      visible: { $ne: false },
      price: { $gt: 0 },
    }).lean();

    if (product) return { branch, row, product };
  }

  fail('No hay producto disponible para probar la ruta POS.');
}

async function main() {
  console.log('Test ruta venta POS');
  console.log('Base URL:', BASE_URL);

  if (!process.env.MONGODB_URI) fail('Falta MONGODB_URI.');
  await mongoose.connect(process.env.MONGODB_URI);

  const selected = await pickCandidate();
  const stockBefore = Number(selected.row.stock || 0);
  const expectedTotal = Math.round(Number(selected.product.price || 0));

  const payload = {
    branchId: String(selected.branch._id),
    registerCode: 'CAJA RUTA',
    customerMode: 'guest',
    items: [
      {
        productId: String(selected.product._id),
        quantity: 1,
        size: selected.row.variant?.size || '',
        color: selected.row.variant?.color || '',
      },
    ],
    payment: {
      method: 'cash',
      receivedAmount: expectedTotal,
    },
  };

  const result = await callSaleRoute(payload);

  console.log('HTTP:', result.status);
  console.log('Sede:', selected.branch.name);
  console.log('Producto:', selected.product.title);
  console.log('Stock antes:', stockBefore);

  if (result.status !== 201) {
    console.log('Respuesta:', JSON.stringify(result.data, null, 2));
    fail(`HTTP incorrecto: ${result.status}`);
  }

  const orderId = result.data?.order?._id || result.data?.order?.id;
  if (!orderId) fail('La respuesta no trajo orden.');

  const order = await Order.findById(orderId).lean();
  const stockAfter = await InventoryStock.findById(selected.row._id).lean();

  console.log('Orden:', order?.orderNumber || '');
  console.log('Stock despues:', Number(stockAfter?.stock || 0));

  if (!order) fail('No se encontro la orden creada.');
  if (order.source !== 'pos') fail('source incorrecto.');
  if (order.status !== 'paid') fail('status incorrecto.');
  if (order.fulfillmentStatus !== 'delivered') fail('fulfillment incorrecto.');
  if (order.payment?.provider !== 'pos') fail('provider incorrecto.');
  if (Number(order.total || 0) !== expectedTotal) fail('total incorrecto.');
  if (Number(stockAfter.stock || 0) !== stockBefore - 1) fail('stock no bajo en 1.');

  console.log('Ruta venta POS correcta.');
}

main()
  .catch((error) => {
    console.error('Error probando ruta POS:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
