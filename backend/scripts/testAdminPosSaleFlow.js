// backend/scripts/testAdminPosSaleFlow.js

require('dotenv').config();

const mongoose = require('mongoose');
const Branch = require('../models/Branch');
const Product = require('../models/Product');
const InventoryStock = require('../models/InventoryStock');
const { createPosSale } = require('../services/adminPosService');

function fail(message) {
  throw new Error(message);
}

function available(row) {
  return Math.max(0, Number(row.stock || 0) - Number(row.reservedStock || 0));
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
  }).limit(50).lean();

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

  fail('No hay producto disponible para POS.');
}

async function main() {
  console.log('Test flujo venta POS');

  if (!process.env.MONGODB_URI) fail('Falta MONGODB_URI.');
  await mongoose.connect(process.env.MONGODB_URI);

  const selected = await pickCandidate();
  const stockBefore = Number(selected.row.stock || 0);
  const expectedTotal = Math.round(Number(selected.product.price || 0));

  const result = await createPosSale(
    {
      branchId: String(selected.branch._id),
      registerCode: 'CAJA SCRIPT',
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
    },
    {
      admin: {
        username: 'script-pos-flow',
        displayName: 'Script POS',
        role: 'admin',
        adminRole: 'admin',
        canApprovePosDiscount: true,
      },
      generateElectronicInvoice: false,
    }
  );

  const stockAfter = await InventoryStock.findById(selected.row._id).lean();
  const order = result.order;

  console.log('Sede:', selected.branch.name);
  console.log('Producto:', selected.product.title);
  console.log('Orden:', order.orderNumber);
  console.log('Stock antes:', stockBefore);
  console.log('Stock despues:', Number(stockAfter.stock || 0));

  if (order.source !== 'pos') fail('source incorrecto.');
  if (order.status !== 'paid') fail('status incorrecto.');
  if (order.fulfillmentStatus !== 'delivered') fail('fulfillment incorrecto.');
  if (order.payment?.provider !== 'pos') fail('provider incorrecto.');
  if (Number(order.total || 0) !== expectedTotal) fail('total incorrecto.');
  if (Number(stockAfter.stock || 0) !== stockBefore - 1) fail('stock no bajo en 1.');
  if (!Array.isArray(result.movements) || result.movements.length < 1) fail('movimiento no creado.');

  console.log('Flujo venta POS correcto.');
}

main()
  .catch((error) => {
    console.error('Error probando flujo POS:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
