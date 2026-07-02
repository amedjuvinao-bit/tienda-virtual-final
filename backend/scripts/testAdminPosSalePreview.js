// backend/scripts/testAdminPosSalePreview.js

require('dotenv').config();

const mongoose = require('mongoose');
const Branch = require('../models/Branch');
const Product = require('../models/Product');
const InventoryStock = require('../models/InventoryStock');
const { preparePosSalePreview } = require('../services/adminPosService');

function stop(message) {
  throw new Error(message);
}

function available(stock) {
  return Math.max(0, Number(stock.stock || 0) - Number(stock.reservedStock || 0));
}

async function findCandidate() {
  const branch = await Branch.findOne({
    deletedAt: null,
    active: true,
    status: 'active',
    'settings.allowPosSales': true,
  });

  if (!branch) stop('No hay sede POS activa.');

  const stocks = await InventoryStock.find({
    branch: branch._id,
    active: true,
    deletedAt: null,
  }).limit(50).lean();

  for (const stock of stocks) {
    if (available(stock) < 1) continue;

    const product = await Product.findOne({
      _id: stock.product,
      active: { $ne: false },
      visible: { $ne: false },
      price: { $gt: 0 },
    }).lean();

    if (product) return { branch, stock, product };
  }

  stop('No hay producto con stock disponible para POS.');
}

async function main() {
  console.log('Test preview venta POS');

  if (!process.env.MONGODB_URI) stop('Falta MONGODB_URI.');

  await mongoose.connect(process.env.MONGODB_URI);

  const found = await findCandidate();
  const expectedTotal = Math.round(Number(found.product.price || 0));

  const preview = await preparePosSalePreview({
    branchId: String(found.branch._id),
    registerCode: 'CAJA SCRIPT',
    customerMode: 'guest',
    items: [
      {
        productId: String(found.product._id),
        quantity: 1,
        size: found.stock.variant?.size || '',
        color: found.stock.variant?.color || '',
      },
    ],
    payment: {
      method: 'cash',
      receivedAmount: expectedTotal,
    },
  });

  console.log('Sede:', found.branch.name);
  console.log('Producto:', found.product.title);
  console.log('Total preview:', preview.total);

  if (preview.total !== expectedTotal) stop('Total incorrecto.');
  if (preview.payment.method !== 'cash') stop('Metodo de pago incorrecto.');
  if (!Array.isArray(preview.items) || preview.items.length !== 1) stop('Items incorrectos.');

  console.log('Preview de venta POS correcto.');
}

main()
  .catch((error) => {
    console.error('Error probando preview POS:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
