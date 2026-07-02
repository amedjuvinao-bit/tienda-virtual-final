// backend/scripts/test-confirm-reservation.js

const path = require('path');
const mongoose = require('mongoose');

require('dotenv').config({
  path: path.join(__dirname, '..', '.env'),
});

const InventoryReservation = require('../models/InventoryReservation');
const InventoryStock = require('../models/InventoryStock');
const InventoryMovement = require('../models/InventoryMovement');
const {
  confirmInventoryReservation,
} = require('../services/inventoryReservationService');

const ORDER_NUMBER = '000196';

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error('No existe MONGODB_URI en backend/.env');
  }

  await mongoose.connect(process.env.MONGODB_URI);

  console.log('✅ Conectado a MongoDB Atlas');

  const beforeReservation = await InventoryReservation.findOne({
    orderNumber: ORDER_NUMBER,
  }).lean();

  if (!beforeReservation) {
    throw new Error(`No encontré reserva para la orden ${ORDER_NUMBER}`);
  }

  console.log('\n📌 RESERVA ANTES:');
  console.log({
    reservationCode: beforeReservation.reservationCode,
    status: beforeReservation.status,
    orderNumber: beforeReservation.orderNumber,
    items: beforeReservation.items.map((item) => ({
      title: item.title,
      size: item.size,
      color: item.color,
      quantity: item.quantity,
      branch: item.branchSnapshot?.name || '',
    })),
  });

  const stockBefore = await InventoryStock.find({
    product: beforeReservation.items[0].product,
    deletedAt: null,
  })
    .select('branchSnapshot variant stock reservedStock availableStock')
    .lean();

  console.log('\n📦 STOCK ANTES:');
  console.log(
    stockBefore.map((row) => ({
      branch: row.branchSnapshot?.name || '',
      size: row.variant?.size || '',
      color: row.variant?.color || '',
      stock: row.stock,
      reservedStock: row.reservedStock,
      availableStock: row.availableStock,
    }))
  );

  const confirmedReservation = await confirmInventoryReservation(ORDER_NUMBER, {
    order: beforeReservation.order,
    orderNumber: beforeReservation.orderNumber,
    paymentReference: 'TEST-PAGO-APROBADO',
    paymentTransactionId: `TEST-TX-${Date.now()}`,
  });

  console.log('\n✅ RESERVA CONFIRMADA:');
  console.log({
    reservationCode: confirmedReservation.reservationCode,
    status: confirmedReservation.status,
    confirmedAt: confirmedReservation.confirmedAt,
  });

  const stockAfter = await InventoryStock.find({
    product: beforeReservation.items[0].product,
    deletedAt: null,
  })
    .select('branchSnapshot variant stock reservedStock availableStock')
    .lean();

  console.log('\n📦 STOCK DESPUÉS:');
  console.log(
    stockAfter.map((row) => ({
      branch: row.branchSnapshot?.name || '',
      size: row.variant?.size || '',
      color: row.variant?.color || '',
      stock: row.stock,
      reservedStock: row.reservedStock,
      availableStock: row.availableStock,
    }))
  );

  const movement = await InventoryMovement.findOne({
    orderNumber: ORDER_NUMBER,
    type: 'sale_out',
  })
    .sort({ createdAt: -1 })
    .lean();

  console.log('\n📤 MOVIMIENTO DE SALIDA:');
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

  await mongoose.disconnect();

  console.log('\n✅ Prueba finalizada.');
}

main().catch(async (error) => {
  console.error('\n❌ ERROR EN PRUEBA:', error.message);

  try {
    await mongoose.disconnect();
  } catch {
    // ignorar
  }

  process.exit(1);
});