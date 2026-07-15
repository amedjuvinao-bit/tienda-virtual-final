// backend/scripts/testPosInventoryModule.js
/* eslint-disable no-console */

/**
 * Prueba general de integración POS + Inventario.
 *
 * Esta prueba usa una transacción y la aborta al final para no dejar ventas,
 * movimientos ni descuentos reales en la base de datos.
 *
 * Ejecutar:
 *   npm run test:pos-inventory
 */

require('dotenv').config({
  path: require('path').join(__dirname, '..', '.env'),
  quiet: true,
});

const mongoose = require('mongoose');

const Branch = require('../models/Branch');
const Product = require('../models/Product');
const InventoryStock = require('../models/InventoryStock');
const InventoryMovement = require('../models/InventoryMovement');
const Order = require('../models/Order');
const { createPosSale, preparePosSalePreview } = require('../services/adminPosService');

const RUN_ID = Math.random().toString(36).slice(2, 10).toUpperCase();
const TEST_QTY = 1;

const results = {
  ok: 0,
  warn: 0,
  fail: 0,
};

function printOk(message) {
  results.ok += 1;
  console.log(`OK  ${message}`);
}

function printWarn(message) {
  results.warn += 1;
  console.log(`WARN ${message}`);
}

function printFail(message) {
  results.fail += 1;
  console.log(`FAIL ${message}`);
}

function cleanText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function getAvailableStock(stock = {}) {
  const physical = toNumber(stock.stock, 0);
  const reserved = toNumber(stock.reservedStock, 0);
  const available = toNumber(stock.availableStock, physical - reserved);

  return Math.max(0, available);
}

function getId(value) {
  if (!value) return '';
  if (typeof value === 'object') return String(value._id || value.id || value);
  return String(value);
}

function getVariantLabel(stock = {}) {
  const size = cleanText(stock.variant?.size || '');
  const color = cleanText(stock.variant?.color || '');
  const parts = [size, color].filter(Boolean);
  return parts.length ? parts.join(' / ') : 'Variante general';
}

function buildAdminMock() {
  return {
    _id: null,
    id: null,
    username: `test-pos-inventory-${RUN_ID.toLowerCase()}`,
    displayName: 'Script prueba POS inventario',
    role: 'owner',
    adminRole: 'owner',
    canApprovePosDiscount: true,
  };
}

function buildSalePayload({ branch, stock, quantity }) {
  const product = stock.product || {};

  return {
    branchId: getId(branch),
    customerMode: 'guest',
    registerCode: `TEST-${RUN_ID}`,
    terminalId: `SCRIPT-${RUN_ID}`,
    shiftCode: `SHIFT-${RUN_ID}`,
    notes: `Prueba automatica POS inventario ${RUN_ID}`,
    items: [
      {
        productId: getId(product),
        quantity,
        size: stock.variant?.size || '',
        color: stock.variant?.color || '',
      },
    ],
    payment: {
      method: 'cash',
      receivedAmount: Number(product.price || 0) * quantity,
      amount: Number(product.price || 0) * quantity,
      reference: `TEST-${RUN_ID}`,
    },
    discount: {
      type: 'none',
      value: 0,
    },
  };
}

async function connect() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI no esta configurado en backend/.env');
  }

  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.MONGODB_URI);
  }
}

async function findCandidateStock() {
  const branches = await Branch.find({
    deletedAt: null,
    active: true,
    status: 'active',
    'settings.allowPosSales': true,
  })
    .select('_id name code type status active settings')
    .lean();

  if (!branches.length) {
    return {
      branch: null,
      stock: null,
      reason: 'No hay sedes activas habilitadas para ventas POS.',
    };
  }

  const branchIds = branches.map((branch) => branch._id);

  const stockRows = await InventoryStock.find({
    branch: { $in: branchIds },
    active: true,
    deletedAt: null,
    stock: { $gte: TEST_QTY + 1 },
  })
    .sort({ availableStock: -1, updatedAt: -1 })
    .limit(80)
    .populate('product', 'title sku barcode price active visible stock')
    .populate('branch', 'name code type status active settings')
    .lean();

  const candidate = stockRows.find((row) => {
    const product = row.product || {};
    const branch = row.branch || {};

    return (
      product &&
      product.active !== false &&
      product.visible !== false &&
      Number(product.price || 0) > 0 &&
      branch &&
      branch.active !== false &&
      branch.status === 'active' &&
      branch.settings?.allowPosSales === true &&
      getAvailableStock(row) >= TEST_QTY + 1
    );
  });

  if (!candidate) {
    return {
      branch: branches[0],
      stock: null,
      reason: 'No hay producto con stock disponible suficiente para probar venta y bloqueo por sobreventa.',
    };
  }

  return {
    branch: candidate.branch,
    stock: candidate,
    reason: '',
  };
}

async function calculateProductTotalStock(productId, { session = null } = {}) {
  const rows = await InventoryStock.find({
    product: productId,
    active: true,
    deletedAt: null,
  })
    .select('stock')
    .session(session)
    .lean();

  return rows.reduce((sum, row) => sum + Math.max(0, Number(row.stock || 0)), 0);
}

async function countMovementsForOrder(orderId, { session = null } = {}) {
  return InventoryMovement.countDocuments({
    order: orderId,
    type: 'sale_out',
    status: 'posted',
    deletedAt: null,
  }).session(session);
}

async function runTransactionalTest({ branch, stock }) {
  const session = await mongoose.startSession();
  let shouldAbort = false;

  try {
    session.startTransaction();
    shouldAbort = true;

    const productId = getId(stock.product);
    const branchId = getId(branch);
    const stockId = getId(stock);
    const stockBefore = toNumber(stock.stock, 0);
    const reservedBefore = toNumber(stock.reservedStock, 0);
    const availableBefore = getAvailableStock(stock);
    const productTotalBefore = await calculateProductTotalStock(productId, { session });

    console.log(`Producto prueba: ${stock.product?.title || productId}`);
    console.log(`Sede: ${branch.name || branchId}`);
    console.log(`Variante: ${getVariantLabel(stock)}`);
    console.log(`Stock inicial: ${stockBefore} | Reservado: ${reservedBefore} | Disponible: ${availableBefore}`);

    const preview = await preparePosSalePreview(
      buildSalePayload({ branch, stock, quantity: TEST_QTY }),
      { session }
    );

    if (preview?.total > 0 && Array.isArray(preview.items) && preview.items.length === 1) {
      printOk('Vista previa POS calcula producto, total y sede correctamente');
    } else {
      printFail('Vista previa POS no calculo correctamente la venta');
    }

    const saleResult = await createPosSale(
      buildSalePayload({ branch, stock, quantity: TEST_QTY }),
      {
        session,
        admin: buildAdminMock(),
        generateElectronicInvoice: false,
      }
    );

    const order = saleResult?.order;
    const movements = Array.isArray(saleResult?.movements) ? saleResult.movements : [];

    if (order?._id && order.source === 'pos' && order.status === 'paid') {
      printOk('Venta POS crea orden pagada correctamente');
    } else {
      printFail('Venta POS no creo una orden POS pagada');
    }

    if (movements.length === 1 && movements[0]?.type === 'sale_out' && movements[0]?.status === 'posted') {
      printOk('Venta POS crea movimiento sale_out aplicado');
    } else {
      printFail(`Venta POS creo ${movements.length} movimiento(s), se esperaba 1 sale_out`);
    }

    if (movements[0] && String(movements[0].order) === String(order._id)) {
      printOk('Movimiento de inventario queda enlazado con la orden POS');
    } else {
      printFail('Movimiento de inventario no quedo enlazado con la orden POS');
    }

    const movementCount = await countMovementsForOrder(order._id, { session });
    if (movementCount === 1) {
      printOk('La orden tiene un movimiento sale_out consultable en inventario');
    } else {
      printFail(`La orden tiene ${movementCount} movimientos sale_out, se esperaba 1`);
    }

    const stockAfterSale = await InventoryStock.findById(stockId).session(session).lean();
    const expectedStockAfter = stockBefore - TEST_QTY;
    const expectedAvailableAfter = Math.max(0, expectedStockAfter - reservedBefore);

    if (toNumber(stockAfterSale?.stock, 0) === expectedStockAfter) {
      printOk('Stock fisico baja exactamente la cantidad vendida');
    } else {
      printFail(`Stock fisico incorrecto. Esperado ${expectedStockAfter}, actual ${stockAfterSale?.stock}`);
    }

    if (getAvailableStock(stockAfterSale) === expectedAvailableAfter) {
      printOk('Stock disponible se recalcula correctamente despues de vender');
    } else {
      printFail(`Stock disponible incorrecto. Esperado ${expectedAvailableAfter}, actual ${getAvailableStock(stockAfterSale)}`);
    }

    const productAfterSale = await Product.findById(productId).session(session).lean();
    if (toNumber(productAfterSale?.stock, 0) === productTotalBefore - TEST_QTY) {
      printOk('Product.stock se sincroniza con la suma de InventoryStock');
    } else {
      printFail(`Product.stock incorrecto. Esperado ${productTotalBefore - TEST_QTY}, actual ${productAfterSale?.stock}`);
    }

    const oversellQuantity = getAvailableStock(stockAfterSale) + 1;
    const stockBeforeOversell = await InventoryStock.findById(stockId).session(session).lean();
    let oversellBlocked = false;

    try {
      await createPosSale(
        buildSalePayload({ branch, stock: stockAfterSale, quantity: oversellQuantity }),
        {
          session,
          admin: buildAdminMock(),
          generateElectronicInvoice: false,
        }
      );
    } catch (error) {
      oversellBlocked = error?.code === 'POS_STOCK_NOT_AVAILABLE' || error?.code === 'POS_CONCURRENT_STOCK_CHANGE';
    }

    if (oversellBlocked) {
      printOk('Backend bloquea venta POS por encima del stock disponible');
    } else {
      printFail('Backend permitio vender mas unidades que el stock disponible');
    }

    const stockAfterOversell = await InventoryStock.findById(stockId).session(session).lean();
    if (toNumber(stockAfterOversell?.stock, 0) === toNumber(stockBeforeOversell?.stock, 0)) {
      printOk('Venta fallida no descuenta inventario');
    } else {
      printFail('Venta fallida modifico el inventario');
    }

    const orderExists = await Order.exists({ _id: order._id }).session(session);
    if (orderExists) {
      printOk('Orden POS queda consultable dentro de la transaccion');
    } else {
      printFail('Orden POS no queda consultable despues de crear la venta');
    }
  } finally {
    if (shouldAbort && session.inTransaction()) {
      await session.abortTransaction();
      printOk('Transaccion de prueba abortada: no se dejaron ventas ni descuentos reales');
    }

    await session.endSession();
  }
}

async function main() {
  console.log('\n=== Prueba general POS + Inventario ===');
  console.log(`Run ID: ${RUN_ID}`);

  await connect();
  printOk('Conexion a MongoDB activa');

  const { branch, stock, reason } = await findCandidateStock();

  if (!branch) {
    printFail(reason || 'No se encontro sede para pruebas POS.');
    return;
  }

  printOk('Existe sede activa habilitada para POS');

  if (!stock) {
    printWarn(reason || 'No se encontro stock suficiente para ejecutar la prueba completa.');
    return;
  }

  printOk('Existe producto con stock disponible para prueba POS');

  try {
    await runTransactionalTest({ branch, stock });
  } catch (error) {
    printFail(error?.message || 'La prueba POS + Inventario fallo sin detalle.');
    if (error?.code) console.log(`Codigo error: ${error.code}`);
    if (error?.details) console.log(`Detalles: ${JSON.stringify(error.details)}`);
  }
}

main()
  .catch((error) => {
    printFail(error?.message || 'Error general ejecutando prueba POS + Inventario.');
  })
  .finally(async () => {
    console.log('\n=== Resultado final ===');
    console.log(`OK: ${results.ok}`);
    console.log(`WARN: ${results.warn}`);
    console.log(`FAIL: ${results.fail}`);

    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }

    if (results.fail > 0) {
      process.exitCode = 1;
    }
  });
