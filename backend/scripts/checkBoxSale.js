// backend/scripts/checkBoxSale.js

require('dotenv').config();

const mongoose = require('mongoose');

const Branch = require('../models/Branch');
const Product = require('../models/Product');
const InventoryStock = require('../models/InventoryStock');
const Order = require('../models/Order');
const CashSession = require('../models/CashSession');
const { openCashSession, closeCashSession } = require('../services/cashSessionService');
const { createPosSaleWithCashSession } = require('../services/posCashSaleService');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function buildVariantKey(size = '', color = '') {
  return `${String(size || '').trim().toLowerCase()}__${String(color || '').trim().toLowerCase()}`;
}

async function findOrPrepareProduct(branch) {
  const existingStock = await InventoryStock.findOne({
    branch: branch._id,
    deletedAt: null,
    active: true,
    stock: { $gt: 0 },
  })
    .populate({
      path: 'product',
      match: { active: { $ne: false }, visible: { $ne: false }, price: { $gt: 0 } },
    })
    .sort({ stock: -1, updatedAt: -1 });

  if (existingStock?.product) {
    return existingStock;
  }

  const product = await Product.findOne({
    active: { $ne: false },
    visible: { $ne: false },
    price: { $gt: 0 },
  }).sort({ updatedAt: -1 });

  assert(product, 'No hay producto activo con precio para preparar stock.');

  const size = product.sizes?.[0] || 'Única';
  const color = product.colors?.[0] || 'General';
  const variantKey = buildVariantKey(size, color);

  const stock = await InventoryStock.findOneAndUpdate(
    {
      branch: branch._id,
      product: product._id,
      variantKey,
    },
    {
      $set: {
        branchSnapshot: {
          name: branch.name || '',
          code: branch.code || '',
          type: branch.type || '',
        },
        productSnapshot: {
          title: product.title || '',
          sku: product.sku || '',
          image: product.image || '',
          category: product.category || '',
        },
        variant: {
          size,
          color,
          sku: product.sku || '',
          barcode: product.barcode || '',
        },
        stock: 3,
        reservedStock: 0,
        availableStock: 3,
        active: true,
        deletedAt: null,
        lastMovementAt: new Date(),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  stock.product = product;
  await Product.updateOne({ _id: product._id }, { $set: { stock: 3 } });

  return stock;
}

async function main() {
  console.log('Test venta POS asociada a caja');

  assert(process.env.MONGODB_URI, 'Falta MONGODB_URI.');
  await mongoose.connect(process.env.MONGODB_URI);

  const branch = await Branch.findOne({
    deletedAt: null,
    active: true,
    status: 'active',
    'settings.allowPosSales': true,
  });

  assert(branch, 'No hay sede POS activa.');

  const stock = await findOrPrepareProduct(branch);
  const product = stock.product;
  const registerCode = `TEST-${Date.now()}`;
  const admin = {
    username: 'script-caja-pos',
    displayName: 'Script Caja POS',
    role: 'admin',
    adminRole: 'admin',
    canApprovePosDiscount: true,
  };

  const cash = await openCashSession(
    {
      branchId: String(branch._id),
      cashRegisterCode: registerCode,
      cashRegisterName: 'Caja prueba venta POS',
      openingAmount: 50000,
      openingNotes: 'Apertura para venta POS con caja.',
    },
    { admin }
  );

  const beforeStock = Number(stock.stock || 0);

  const result = await createPosSaleWithCashSession(
    {
      branchId: String(branch._id),
      registerCode,
      customerMode: 'guest',
      items: [
        {
          productId: String(product._id),
          quantity: 1,
          size: stock.variant?.size || '',
          color: stock.variant?.color || '',
        },
      ],
      payment: {
        method: 'cash',
        receivedAmount: Number(product.price || 0),
        amount: Number(product.price || 0),
      },
      discount: { type: 'none', value: 0 },
    },
    { admin, generateElectronicInvoice: false }
  );

  const order = await Order.findById(result.order._id).lean();
  const updatedCash = await CashSession.findById(cash._id).lean();
  const updatedStock = await InventoryStock.findById(stock._id).lean();

  assert(order, 'La orden debe existir.');
  assert(String(order.cashSession) === String(cash._id), 'La orden debe quedar asociada a la caja.');
  assert(order.pos?.registerCode === registerCode, 'La orden debe guardar el código de caja.');
  assert(updatedCash.salesSummary.ordersCount >= 1, 'La caja debe sumar la venta.');
  assert(updatedCash.salesSummary.paymentTotals.cash >= Number(order.total || 0), 'La caja debe sumar efectivo.');
  assert(Number(updatedStock.stock || 0) === beforeStock - 1, 'El stock debe disminuir en uno.');

  const expectedCash = Number(updatedCash.expectedCash || 0);
  const closed = await closeCashSession(
    cash._id,
    {
      countedCash: expectedCash,
      closingNotes: 'Cierre de prueba venta POS con caja.',
    },
    { admin }
  );

  assert(closed.status === 'closed', 'La caja debe cerrar.');
  assert(Number(closed.differenceAmount || 0) === 0, 'La diferencia debe ser cero.');

  console.log('Sede:', branch.name);
  console.log('Caja:', cash.sessionCode);
  console.log('Registro:', registerCode);
  console.log('Orden:', order.orderNumber);
  console.log('Caja en orden:', String(order.cashSession));
  console.log('Ventas caja:', updatedCash.salesSummary.ordersCount);
  console.log('Efectivo caja:', updatedCash.salesSummary.paymentTotals.cash);
  console.log('Efectivo esperado:', closed.expectedCash);
  console.log('Diferencia:', closed.differenceAmount);
  console.log('Venta POS asociada a caja correcta.');
}

main()
  .catch((error) => {
    console.error('Error probando venta POS con caja:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
