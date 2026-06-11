// backend/scripts/test-expire-inventory-reservation.js

require('dotenv').config();

const mongoose = require('mongoose');

const InventoryStock = require('../models/InventoryStock');
const InventoryReservation = require('../models/InventoryReservation');

const {
  createInventoryReservation,
} = require('../services/inventoryReservationService');

const TEST_TIMEOUT_MS = 90_000;
const POLL_INTERVAL_MS = 5_000;
const EXPIRES_IN_MINUTES = 0.05; // 0.05 minutos = 3 segundos

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toNumber(value, defaultValue = 0) {
  const number = Number(value);

  if (!Number.isFinite(number)) return defaultValue;

  return number;
}

function getAvailableStock(row = {}) {
  const stock = toNumber(row.stock, 0);
  const reservedStock = toNumber(row.reservedStock, 0);

  return Math.max(0, stock - reservedStock);
}

function getVariantSize(stockRow = {}) {
  return (
    stockRow.size ||
    stockRow.variant?.size ||
    stockRow.variantSnapshot?.size ||
    ''
  );
}

function getVariantColor(stockRow = {}) {
  return (
    stockRow.color ||
    stockRow.variant?.color ||
    stockRow.variantSnapshot?.color ||
    ''
  );
}

function getProductTitle(stockRow = {}) {
  return (
    stockRow.product?.title ||
    stockRow.productSnapshot?.title ||
    'Producto sin nombre'
  );
}

function getProductSku(stockRow = {}) {
  return (
    stockRow.product?.sku ||
    stockRow.productSnapshot?.sku ||
    'SIN-SKU'
  );
}

function getProductPrice(stockRow = {}) {
  return toNumber(
    stockRow.product?.price ||
      stockRow.productSnapshot?.price ||
      stockRow.price ||
      90000,
    90000
  );
}

function getBranchName(stockRow = {}) {
  return (
    stockRow.branch?.name ||
    stockRow.branchSnapshot?.name ||
    'Sede sin nombre'
  );
}

async function findStockRowForTest() {
  const rows = await InventoryStock.find({
    active: true,
    deletedAt: null,
    stock: {
      $gt: 0,
    },
  })
    .populate('product', 'title sku price image category')
    .populate('branch', 'name code type')
    .sort({
      updatedAt: -1,
      createdAt: -1,
    })
    .limit(100)
    .lean();

  return rows.find((row) => {
    const availableStock = getAvailableStock(row);
    const size = getVariantSize(row);
    const color = getVariantColor(row);
    const productId = row.product?._id || row.product;
    const branchId = row.branch?._id || row.branch;

    return availableStock > 0 && size && color && productId && branchId;
  });
}

async function main() {
  console.log('🧪 Prueba automática de expiración de reserva de inventario');
  console.log('----------------------------------------------------------');

  if (!process.env.MONGODB_URI) {
    console.error('❌ Falta MONGODB_URI en el archivo .env');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);

  console.log('✅ Conectado a MongoDB');

  const stockRow = await findStockRowForTest();

  if (!stockRow) {
    console.error('\n❌ No se encontró una fila de inventario disponible para probar.');
    console.error('Debe existir al menos un InventoryStock activo con stock disponible, talla y color.');
    process.exit(1);
  }

  const productId = String(stockRow.product?._id || stockRow.product);
  const branchId = String(stockRow.branch?._id || stockRow.branch);
  const size = getVariantSize(stockRow);
  const color = getVariantColor(stockRow);

  const beforePhysicalStock = toNumber(stockRow.stock, 0);
  const beforeReservedStock = toNumber(stockRow.reservedStock, 0);
  const beforeAvailableStock = getAvailableStock(stockRow);

  console.log('\n📦 Inventario seleccionado para la prueba:');
  console.log({
    inventoryStockId: String(stockRow._id),
    productId,
    product: getProductTitle(stockRow),
    sku: getProductSku(stockRow),
    branchId,
    branch: getBranchName(stockRow),
    size,
    color,
    stockFisicoAntes: beforePhysicalStock,
    reservadoAntes: beforeReservedStock,
    disponibleAntes: beforeAvailableStock,
  });

  const testOrderNumber = `TEST-EXP-${Date.now()}`;

  console.log('\n🟡 Creando reserva pendiente de prueba...');
  console.log(`⏱️ Vence en ${EXPIRES_IN_MINUTES} minutos.`);

  const reservation = await createInventoryReservation({
    sessionId: `test_exp_${Date.now()}`,
    order: null,
    orderNumber: testOrderNumber,
    paymentReference: testOrderNumber,
    paymentTransactionId: '',
    source: 'checkout',
    branchPriorityIds: [branchId],
    expiresInMinutes: EXPIRES_IN_MINUTES,
    currency: 'COP',
    notes: 'Reserva temporal creada por script de prueba de expiración automática.',
    metadata: {
      test: true,
      script: 'test-expire-inventory-reservation.js',
      purpose: 'expiration-job-test',
    },
    items: [
      {
        productId,
        title: getProductTitle(stockRow),
        sku: getProductSku(stockRow),
        size,
        color,
        quantity: 1,
        price: getProductPrice(stockRow),
      },
    ],
  });

  console.log('\n✅ Reserva creada:');
  console.log({
    reservationId: String(reservation._id),
    reservationCode: reservation.reservationCode,
    orderNumber: reservation.orderNumber,
    status: reservation.status,
    expiresAt: reservation.expiresAt,
    totalQuantity: reservation.totalQuantity,
  });

  const stockAfterReservation = await InventoryStock.findById(stockRow._id).lean();

  console.log('\n📊 Stock después de crear reserva:');
  console.log({
    stockFisico: toNumber(stockAfterReservation.stock, 0),
    reservado: toNumber(stockAfterReservation.reservedStock, 0),
    disponible: getAvailableStock(stockAfterReservation),
  });

  console.log('\n⏳ Esperando que el job automático del backend venza la reserva...');
  console.log('Importante: el backend debe estar corriendo en otra terminal.');
  console.log(`Tiempo máximo de espera: ${Math.round(TEST_TIMEOUT_MS / 1000)} segundos.`);

  const startedAt = Date.now();
  let currentReservation = null;

  while (Date.now() - startedAt < TEST_TIMEOUT_MS) {
    await sleep(POLL_INTERVAL_MS);

    currentReservation = await InventoryReservation.findById(reservation._id).lean();

    console.log(
      `🔎 Estado actual: ${currentReservation?.status || 'SIN_ESTADO'} | ${new Date().toLocaleTimeString()}`
    );

    if (currentReservation?.status === 'expired') {
      break;
    }
  }

  if (!currentReservation || currentReservation.status !== 'expired') {
    console.error('\n❌ La reserva no venció dentro del tiempo esperado.');
    console.error('Posibles causas:');
    console.error('- El backend no está corriendo.');
    console.error('- El job automático no está activo.');
    console.error('- El intervalo del job está configurado por encima del tiempo de espera.');
    console.error('- La reserva fue confirmada/liberada por otro proceso.');

    console.error('\nReserva actual:');
    console.error(currentReservation);

    await mongoose.disconnect();
    process.exit(1);
  }

  const finalStock = await InventoryStock.findById(stockRow._id).lean();

  console.log('\n✅ Reserva vencida automáticamente:');
  console.log({
    reservationId: String(currentReservation._id),
    reservationCode: currentReservation.reservationCode,
    orderNumber: currentReservation.orderNumber,
    status: currentReservation.status,
    expiredAt: currentReservation.expiredAt,
    releaseReason: currentReservation.releaseReason,
  });

  console.log('\n📊 Stock final después de expirar:');
  console.log({
    stockFisicoFinal: toNumber(finalStock.stock, 0),
    reservadoFinal: toNumber(finalStock.reservedStock, 0),
    disponibleFinal: getAvailableStock(finalStock),
  });

  console.log('\n🧾 Validación esperada:');
  console.log({
    stockFisicoNoDebeCambiar:
      toNumber(finalStock.stock, 0) === beforePhysicalStock,
    reservadoDebeVolverAlValorInicial:
      toNumber(finalStock.reservedStock, 0) === beforeReservedStock,
    disponibleDebeVolverAlValorInicial:
      getAvailableStock(finalStock) === beforeAvailableStock,
  });

  if (toNumber(finalStock.stock, 0) !== beforePhysicalStock) {
    console.error('\n❌ Error: el stock físico cambió y no debía cambiar.');
    await mongoose.disconnect();
    process.exit(1);
  }

  if (toNumber(finalStock.reservedStock, 0) !== beforeReservedStock) {
    console.error('\n❌ Error: el stock reservado no volvió al valor inicial.');
    await mongoose.disconnect();
    process.exit(1);
  }

  if (getAvailableStock(finalStock) !== beforeAvailableStock) {
    console.error('\n❌ Error: el stock disponible no volvió al valor inicial.');
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log('\n✅ Prueba finalizada correctamente.');

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('\n❌ Error ejecutando prueba:', error.message);

  if (error.details) {
    console.error('\nDetalles:');
    console.error(JSON.stringify(error.details, null, 2));
  }

  try {
    await mongoose.disconnect();
  } catch (_error) {
    // noop
  }

  process.exit(1);
});