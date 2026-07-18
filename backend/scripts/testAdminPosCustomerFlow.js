// backend/scripts/testAdminPosCustomerFlow.js

require('dotenv').config();

const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const Branch = require('../models/Branch');
const Product = require('../models/Product');
const InventoryStock = require('../models/InventoryStock');
const Order = require('../models/Order');
const Customer = require('../models/Customer');

const BASE_URL = String(process.env.TEST_BASE_URL || 'http://localhost:5000').replace(/\/+$/, '');

function fail(message) {
  throw new Error(message);
}

function available(row) {
  return Math.max(0, Number(row.stock || 0) - Number(row.reservedStock || 0));
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function buildToken() {
  if (!process.env.JWT_SECRET) fail('Falta JWT_SECRET.');

  return jwt.sign(
    {
      role: 'admin',
      username: 'script-pos-customer-flow',
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

async function getActivePosBranch() {
  const branch = await Branch.findOne({
    deletedAt: null,
    active: true,
    status: 'active',
    'settings.allowPosSales': true,
  });

  if (!branch) fail('No hay sede POS activa.');

  return branch;
}

async function getActiveProduct(stockRow) {
  return Product.findOne({
    _id: stockRow.product,
    active: { $ne: false },
    visible: { $ne: false },
    price: { $gt: 0 },
  }).lean();
}

async function prepareOneUnit(stockRow) {
  const currentStock = Number(stockRow.stock || 0);
  const reservedStock = Number(stockRow.reservedStock || 0);
  const nextStock = Math.max(currentStock, reservedStock) + 1;
  const nextAvailable = Math.max(0, nextStock - reservedStock);

  return InventoryStock.findByIdAndUpdate(
    stockRow._id,
    {
      $set: {
        stock: nextStock,
        availableStock: nextAvailable,
        lastMovementAt: new Date(),
      },
    },
    { new: true }
  ).lean();
}

async function pickCandidate() {
  const branch = await getActivePosBranch();
  const rows = await InventoryStock.find({
    branch: branch._id,
    active: true,
    deletedAt: null,
  }).limit(100).lean();

  for (const row of rows) {
    if (available(row) < 1) continue;

    const product = await getActiveProduct(row);
    if (product) return { branch, row, product, preparedStock: false };
  }

  for (const row of rows) {
    const product = await getActiveProduct(row);
    if (!product) continue;

    const preparedRow = await prepareOneUnit(row);
    return { branch, row: preparedRow, product, preparedStock: true };
  }

  fail('No hay producto disponible para probar POS con cliente.');
}

async function createCustomer(branch) {
  const stamp = Date.now();
  const customer = await Customer.create({
    fullName: `Cliente POS Venta ${stamp}`,
    phone: `301${String(stamp).slice(-7)}`,
    email: `cliente.venta.pos.${stamp}@example.com`,
    documentType: 'CC',
    documentNumber: String(stamp).slice(-10),
    address: 'Direccion cliente POS',
    city: 'Santa Marta',
    department: 'Magdalena',
    country: 'CO',
    source: 'pos',
    status: 'active',
    defaultBranch: branch._id,
    notes: 'Cliente creado por prueba POS con cliente.',
  });

  return customer;
}

async function main() {
  console.log('Test venta POS con cliente');
  console.log('Base URL:', BASE_URL);

  if (!process.env.MONGODB_URI) fail('Falta MONGODB_URI.');
  await mongoose.connect(process.env.MONGODB_URI);

  const selected = await pickCandidate();
  const customer = await createCustomer(selected.branch);

  const stockBefore = Number(selected.row.stock || 0);
  const expectedTotal = Math.round(Number(selected.product.price || 0));
  const statsBefore = {
    ordersCount: Number(customer.stats?.ordersCount || 0),
    posOrdersCount: Number(customer.stats?.posOrdersCount || 0),
    totalSpent: Number(customer.stats?.totalSpent || 0),
  };

  if (selected.preparedStock) {
    console.log('Stock temporal preparado para ejecutar la prueba.');
  }

  const payload = {
    branchId: String(selected.branch._id),
    registerCode: 'CAJA CLIENTE',
    customerMode: 'identified',
    customerId: String(customer._id),
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
  console.log('Cliente:', customer.fullName);
  console.log('Stock antes:', stockBefore);

  if (result.status !== 201) {
    console.log('Respuesta:', JSON.stringify(result.data, null, 2));
    fail(`HTTP incorrecto: ${result.status}`);
  }

  const orderId = result.data?.order?._id || result.data?.order?.id;
  assert(orderId, 'La respuesta no trajo orden.');

  const order = await Order.findById(orderId).lean();
  const stockAfter = await InventoryStock.findById(selected.row._id).lean();
  const updatedCustomer = await Customer.findById(customer._id).lean();

  console.log('Orden:', order?.orderNumber || '');
  console.log('Cliente en orden:', order?.customer?.name || '');
  console.log('Stock despues:', Number(stockAfter?.stock || 0));
  console.log('Compras cliente antes:', statsBefore.ordersCount);
  console.log('Compras cliente despues:', Number(updatedCustomer?.stats?.ordersCount || 0));

  assert(order, 'No se encontro la orden creada.');
  assert(order.source === 'pos', 'source incorrecto.');
  assert(order.status === 'paid', 'status incorrecto.');
  assert(order.fulfillmentStatus === 'delivered', 'fulfillment incorrecto.');
  assert(order.payment?.provider === 'pos', 'provider incorrecto.');
  assert(order.pos?.customerMode === 'identified', 'customerMode incorrecto.');
  assert(order.pos?.quickSale === false, 'quickSale debe ser false para cliente identificado.');
  assert(order.customer?.name === customer.fullName, 'El nombre del cliente no quedo en la orden.');
  assert(order.customer?.phone === customer.phone, 'El celular del cliente no quedo en la orden.');
  assert(order.customer?.id === customer.documentNumber, 'El documento del cliente no quedo en la orden.');
  assert(Number(order.total || 0) === expectedTotal, 'total incorrecto.');
  assert(Number(stockAfter.stock || 0) === stockBefore - 1, 'stock no bajo en 1.');
  assert(Number(updatedCustomer.stats?.ordersCount || 0) === statsBefore.ordersCount + 1, 'ordersCount del cliente no subio.');
  assert(Number(updatedCustomer.stats?.posOrdersCount || 0) === statsBefore.posOrdersCount + 1, 'posOrdersCount del cliente no subio.');
  assert(Number(updatedCustomer.stats?.totalSpent || 0) === statsBefore.totalSpent + expectedTotal, 'totalSpent del cliente no subio correctamente.');
  assert(String(updatedCustomer.stats?.lastOrder || '') === String(order._id), 'lastOrder del cliente no coincide.');
  assert(updatedCustomer.stats?.lastOrderNumber === order.orderNumber, 'lastOrderNumber del cliente no coincide.');

  console.log('Venta POS con cliente correcta.');
}

main()
  .catch((error) => {
    console.error('Error probando venta POS con cliente:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
