// backend/scripts/test-admin-inventory-alerts.js

require('dotenv').config();

const mongoose = require('mongoose');

// Registrar modelos
require('../models/Product');
require('../models/Branch');
require('../models/Order');

const InventoryStock = require('../models/InventoryStock');
const InventoryReservation = require('../models/InventoryReservation');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';
const ADMIN_TEST_TOKEN = process.env.ADMIN_TEST_TOKEN || '';

function logTitle(title) {
  console.log('\n' + title);
  console.log('-'.repeat(title.length));
}

async function connectMongo() {
  const mongoUri =
    process.env.MONGODB_URI ||
    process.env.MONGO_URI ||
    process.env.MONGO_URL ||
    process.env.DB_URI;

  if (!mongoUri) {
    throw new Error('No se encontró MONGODB_URI, MONGO_URI, MONGO_URL o DB_URI en el .env');
  }

  await mongoose.connect(mongoUri);
  console.log('✅ Conectado a MongoDB');
}

async function requestAlerts() {
  if (!ADMIN_TEST_TOKEN) {
    throw new Error('Falta ADMIN_TEST_TOKEN en el .env o en la terminal.');
  }

  const url = `${API_BASE_URL}/api/admin/inventory/alerts?limit=20`;

  console.log('\n🌐 Consultando endpoint:');
  console.log(url);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${ADMIN_TEST_TOKEN}`,
      Accept: 'application/json',
    },
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    console.log('❌ Respuesta del backend:');
    console.dir(payload, { depth: null });
    throw new Error(`El endpoint alerts respondió HTTP ${response.status}`);
  }

  return payload;
}

async function getDbReferenceCounts() {
  const now = new Date();

  const stockRows = await InventoryStock.find({
    deletedAt: null,
    active: true,
  })
    .populate('product', 'title sku image price stock reorderPoint stockMin')
    .populate('branch', 'name code type status active')
    .lean({ virtuals: true });

  let outOfStock = 0;
  let lowStock = 0;

  stockRows.forEach((row) => {
    const physicalStock = Number(row.stock || 0);
    const reservedStock = Number(row.reservedStock || 0);
    const availableStock =
      typeof row.availableStock === 'number'
        ? Number(row.availableStock || 0)
        : Math.max(0, physicalStock - reservedStock);

    const lowStockLimit =
      Number(row.reorderPoint || 0) > 0
        ? Number(row.reorderPoint)
        : Number(row.product?.reorderPoint || 0) > 0
          ? Number(row.product.reorderPoint)
          : Number(row.productSnapshot?.reorderPoint || 0) > 0
            ? Number(row.productSnapshot.reorderPoint)
            : 5;

    if (availableStock <= 0) {
      outOfStock += 1;
      return;
    }

    if (availableStock <= lowStockLimit) {
      lowStock += 1;
    }
  });

  const expiredReservations = await InventoryReservation.countDocuments({
    status: 'pending',
    expiresAt: {
      $lte: now,
    },
  });

  const pendingReservations = await InventoryReservation.countDocuments({
    status: 'pending',
    expiresAt: {
      $gt: now,
    },
  });

  return {
    stockRows: stockRows.length,
    lowStock,
    outOfStock,
    expiredReservations,
    pendingReservations,
  };
}

function validateAlerts(payload, dbCounts) {
  if (!payload || payload.ok !== true) {
    throw new Error('La respuesta no trae ok: true.');
  }

  if (!payload.data) {
    throw new Error('La respuesta no trae data.');
  }

  const data = payload.data;

  if (!data.summary) {
    throw new Error('La respuesta no trae data.summary.');
  }

  if (!Array.isArray(data.lowStockItems)) {
    throw new Error('La respuesta no trae data.lowStockItems como arreglo.');
  }

  if (!Array.isArray(data.outOfStockItems)) {
    throw new Error('La respuesta no trae data.outOfStockItems como arreglo.');
  }

  if (!Array.isArray(data.expiredReservations)) {
    throw new Error('La respuesta no trae data.expiredReservations como arreglo.');
  }

  if (!Array.isArray(data.pendingReservations)) {
    throw new Error('La respuesta no trae data.pendingReservations como arreglo.');
  }

  const summary = data.summary;

  return {
    hasSummary: true,
    lowStockMatchesDb: Number(summary.lowStock || 0) === dbCounts.lowStock,
    outOfStockMatchesDb: Number(summary.outOfStock || 0) === dbCounts.outOfStock,
    expiredReservationsMatchesDb:
      Number(summary.expiredReservations || 0) === dbCounts.expiredReservations,
    pendingReservationsMatchesDb:
      Number(summary.pendingReservations || 0) === dbCounts.pendingReservations,
    lowStockItemsLimited: data.lowStockItems.length <= 20,
    outOfStockItemsLimited: data.outOfStockItems.length <= 20,
    expiredReservationsLimited: data.expiredReservations.length <= 20,
    pendingReservationsLimited: data.pendingReservations.length <= 20,
  };
}

async function main() {
  logTitle('🧪 Prueba automática del endpoint de alertas de inventario');

  await connectMongo();

  const dbCounts = await getDbReferenceCounts();

  console.log('\n📌 Conteos directos desde BD:');
  console.dir(dbCounts, { depth: null });

  const payload = await requestAlerts();

  console.log('\n✅ Respuesta recibida de alertas.');

  console.log('\n📊 Resumen del endpoint:');
  console.dir(payload.data.summary, { depth: null });

  console.log('\n🚨 Primeros agotados:');
  console.dir(payload.data.outOfStockItems.slice(0, 3), { depth: null });

  console.log('\n⚠️ Primeros bajo stock:');
  console.dir(payload.data.lowStockItems.slice(0, 3), { depth: null });

  console.log('\n⏰ Primeras reservas vencidas pendientes:');
  console.dir(payload.data.expiredReservations.slice(0, 3), { depth: null });

  console.log('\n🟡 Primeras reservas pendientes activas:');
  console.dir(payload.data.pendingReservations.slice(0, 3), { depth: null });

  const validation = validateAlerts(payload, dbCounts);

  console.log('\n🧾 Validación esperada:');
  console.dir(validation, { depth: null });

  const allOk = Object.values(validation).every(Boolean);

  if (!allOk) {
    throw new Error('La validación de alertas no coincide con la BD.');
  }

  console.log('\n✅ Prueba de alertas finalizada correctamente.');
}

main()
  .catch((error) => {
    console.error('\n❌ Prueba de alertas falló:');
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });