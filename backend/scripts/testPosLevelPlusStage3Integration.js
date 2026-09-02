'use strict';

const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const Branch = require('../models/Branch');
const InventoryStock = require('../models/InventoryStock');
const Product = require('../models/Product');
const {
  closeHeldSale,
  createHeldSale,
  listHeldSales,
  listPosSalesHistory,
  touchHeldSale,
} = require('../services/posOperationsService');
const { createPosSale } = require('../services/adminPosService');

const MONGO_URI = String(process.env.POS_STAGE3_MONGO_URI || '').trim();
const EXPECTED_DATABASE = 'pos_stage3_ci';

function assertDedicatedDatabase(uri) {
  if (!/^mongodb(?:\+srv)?:\/\//i.test(uri)) {
    throw new Error('POS_STAGE3_MONGO_URI es obligatoria.');
  }
  const database = uri.split('?')[0].split('/').pop();
  if (database !== EXPECTED_DATABASE) {
    throw new Error(`La prueba solo puede ejecutarse en la base aislada ${EXPECTED_DATABASE}.`);
  }
}

async function createStock(branch, product, stock = 5) {
  return InventoryStock.create({
    branch: branch._id,
    branchSnapshot: { name: branch.name, code: branch.code, type: branch.type },
    product: product._id,
    productSnapshot: { title: product.title, sku: product.sku },
    variantKey: 'default__default',
    variant: { label: 'Sin variante', size: '', color: '' },
    stock,
    reservedStock: 0,
    availableStock: stock,
    active: true,
    deletedAt: null,
  });
}

async function main() {
  assertDedicatedDatabase(MONGO_URI);
  await mongoose.connect(MONGO_URI, { autoIndex: true });

  try {
    const cashierId = new mongoose.Types.ObjectId();
    const admin = {
      _id: cashierId,
      id: String(cashierId),
      username: 'cajero.stage3',
      displayName: 'Cajero Etapa 3',
      role: 'seller',
      adminRole: 'seller',
      canApplyPosDiscount: true,
      canApprovePosDiscount: false,
    };
    const [branch, otherBranch] = await Branch.create([
      {
        name: 'Sede CI Etapa 3',
        code: 'POS-STAGE3',
        type: 'store',
        status: 'active',
        active: true,
        settings: { allowPosSales: true, allowNegativeStock: false, requireCashSessionForPos: false },
      },
      {
        name: 'Otra sede CI Etapa 3',
        code: 'POS-STAGE3-B',
        type: 'store',
        status: 'active',
        active: true,
        settings: { allowPosSales: true, allowNegativeStock: false, requireCashSessionForPos: false },
      },
    ]);
    const product = await Product.create({
      title: 'Producto POS Etapa 3',
      sku: 'POS-STAGE3-PRODUCT',
      price: 50000,
      stock: 10,
      active: true,
      visible: true,
      productType: 'physical',
      trackInventory: true,
      allowBackorder: false,
      variantPreset: 'none',
      variantAxes: [],
      variants: [],
    });
    const stock = await createStock(branch, product, 5);
    await createStock(otherBranch, product, 5);

    const held = await createHeldSale({
      branchId: String(branch._id),
      customerSelection: { mode: 'guest' },
      items: [{ productId: String(product._id), quantity: 1, variantKey: 'default__default' }],
      paymentMethod: 'cash',
      paymentDetails: { receivedAmount: 50000 },
      discount: { type: 'none' },
      note: 'Cliente regresa luego',
    }, { admin });
    assert.match(held.code, /^ESPERA-\d{6}$/);
    assert.equal(held.subtotal, 50000);
    console.log('OK 01 la espera se guarda con código, sede, cajero y total del servidor');

    const unchangedStock = await InventoryStock.findById(stock._id).lean();
    assert.equal(unchangedStock.stock, 5);
    assert.equal(unchangedStock.reservedStock, 0);
    console.log('OK 02 guardar en espera no reserva ni descuenta inventario');

    const branchSales = await listHeldSales({ branchIds: [String(branch._id)] });
    assert.equal(branchSales.length, 1);
    assert.equal(branchSales[0].customerSelection.mode, 'guest');
    console.log('OK 03 la bandeja recupera la venta dentro de su sede');

    const opened = await touchHeldSale(held.id, { branchIds: [String(branch._id)] });
    assert.ok(opened.lastOpenedAt);
    await assert.rejects(
      () => touchHeldSale(held.id, { branchIds: [String(otherBranch._id)] }),
      (error) => error?.code === 'POS_HELD_SALE_NOT_FOUND'
    );
    console.log('OK 04 otra sede no puede abrir la venta en espera');

    const sale = await createPosSale({
      branchId: String(branch._id),
      customerMode: 'guest',
      registerCode: 'CAJA POS',
      items: [{ productId: String(product._id), quantity: 1, variantKey: 'default__default' }],
      payment: { method: 'cash', amount: 50000, receivedAmount: 50000 },
      discount: { type: 'none' },
    }, { admin });
    await closeHeldSale(held.id, {
      reason: 'sold',
      orderId: sale.order._id,
      branchIds: [String(branch._id)],
    });

    const activeAfterSale = await listHeldSales({ branchIds: [String(branch._id)] });
    assert.equal(activeAfterSale.length, 0);
    console.log('OK 05 al cobrar, la espera se cierra y enlaza con la orden');

    const history = await listPosSalesHistory({ branchIds: [String(branch._id)] });
    assert.equal(history.length, 1);
    assert.equal(history[0].id, String(sale.order._id));
    assert.equal(history[0].total, 50000);
    console.log('OK 06 el historial devuelve la venta POS confirmada de la sede');

    const finalStock = await InventoryStock.findById(stock._id).lean();
    assert.equal(finalStock.stock, 4);
    console.log('OK 07 el inventario solo cambia cuando la venta es confirmada');

    console.log('\nIntegración Etapa 3 POS: 7/7 controles superados.');
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.dropDatabase();
    }
    await mongoose.disconnect();
  }
}

main().catch(async (error) => {
  console.error('FAIL integración Etapa 3 POS');
  console.error(error);
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect().catch(() => null);
  }
  process.exitCode = 1;
});
