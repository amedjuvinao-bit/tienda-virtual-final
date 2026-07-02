// backend/scripts/test-admin-inventory-kardex.js

require('dotenv').config();

const mongoose = require('mongoose');

const InventoryStock = require('../models/InventoryStock');
const InventoryMovement = require('../models/InventoryMovement');

// Registrar modelos usados por populate()
require('../models/Product');
require('../models/Branch');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';
const ADMIN_TEST_TOKEN = process.env.ADMIN_TEST_TOKEN || '';

function logTitle(title) {
  console.log('\n' + title);
  console.log('-'.repeat(title.length));
}

function cleanText(value) {
  return String(value || '').trim();
}

function getObjectIdValue(value) {
  if (!value) return '';

  if (typeof value === 'object') {
    return String(value._id || value.id || value);
  }

  return String(value);
}

function getVariantSize(row = {}) {
  return cleanText(row?.variant?.size || row?.size || '');
}

function getVariantColor(row = {}) {
  return cleanText(row?.variant?.color || row?.color || '');
}

function getProductTitle(row = {}) {
  return cleanText(
    row?.product?.title ||
      row?.productSnapshot?.title ||
      'Producto sin nombre'
  );
}

function getProductSku(row = {}) {
  return cleanText(
    row?.product?.sku ||
      row?.productSnapshot?.sku ||
      '—'
  );
}

function getBranchName(row = {}) {
  return cleanText(
    row?.branch?.name ||
      row?.branchSnapshot?.name ||
      'Sede sin nombre'
  );
}

async function connectMongo() {
  const mongoUri =
    process.env.MONGODB_URI ||
    process.env.MONGO_URI ||
    process.env.MONGO_URL ||
    process.env.DB_URI;

  if (!mongoUri) {
    throw new Error(
      'No se encontró MONGODB_URI, MONGO_URI, MONGO_URL o DB_URI en el .env'
    );
  }

  await mongoose.connect(mongoUri);

  console.log('✅ Conectado a MongoDB');
}

async function findBestStockRowForKardex() {
  const stockRows = await InventoryStock.find({
    deletedAt: null,
    active: true,
  })
    .populate('product', 'title sku image price stock')
    .populate('branch', 'name code type status active')
    .limit(200)
    .lean();

  if (!stockRows.length) {
    throw new Error('No hay registros de inventario activos para probar Kardex.');
  }

  let bestRow = null;
  let bestCount = -1;

  for (const row of stockRows) {
    const productId = getObjectIdValue(row.product);
    const branchId = getObjectIdValue(row.branch);
    const size = getVariantSize(row);
    const color = getVariantColor(row);

    if (!productId || !branchId || !size || !color) continue;

    const movementCount = await InventoryMovement.countDocuments({
      deletedAt: null,
      product: row.product?._id || row.product,
      status: {
        $in: ['posted', 'reversed'],
      },
      'variant.size': size,
      'variant.color': color,
      $or: [
        {
          branchFrom: row.branch?._id || row.branch,
        },
        {
          branchTo: row.branch?._id || row.branch,
        },
      ],
    });

    if (movementCount > bestCount) {
      bestRow = row;
      bestCount = movementCount;
    }
  }

  if (!bestRow) {
    throw new Error(
      'No se encontró una fila de inventario con producto, sede, talla y color válidos.'
    );
  }

  return {
    row: bestRow,
    movementCount: bestCount,
  };
}

function buildKardexUrl({ productId, branchId, size, color }) {
  const params = new URLSearchParams();

  params.set('productId', productId);
  params.set('branchId', branchId);
  params.set('size', size);
  params.set('color', color);

  return `${API_BASE_URL}/api/admin/inventory/kardex?${params.toString()}`;
}

async function requestKardex(url) {
  if (!ADMIN_TEST_TOKEN) {
    throw new Error('Falta ADMIN_TEST_TOKEN en el .env o en la terminal.');
  }

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

    throw new Error(`El endpoint Kardex respondió HTTP ${response.status}`);
  }

  return payload;
}

function validateKardex(payload) {
  if (!payload || payload.ok !== true) {
    throw new Error('La respuesta no trae ok: true.');
  }

  if (!payload.data) {
    throw new Error('La respuesta no trae data.');
  }

  if (!payload.data.product) {
    throw new Error('La respuesta no trae data.product.');
  }

  if (!payload.data.branch) {
    throw new Error('La respuesta no trae data.branch.');
  }

  if (!payload.data.variant) {
    throw new Error('La respuesta no trae data.variant.');
  }

  if (!payload.data.stock) {
    throw new Error('La respuesta no trae data.stock.');
  }

  if (!payload.data.summary) {
    throw new Error('La respuesta no trae data.summary.');
  }

  if (!Array.isArray(payload.data.movements)) {
    throw new Error('La respuesta no trae data.movements como arreglo.');
  }

  const summary = payload.data.summary;

  const totalInFromRows = payload.data.movements.reduce((sum, movement) => {
    return sum + Number(movement.entry || 0);
  }, 0);

  const totalOutFromRows = payload.data.movements.reduce((sum, movement) => {
    return sum + Number(movement.exit || 0);
  }, 0);

  const lastBalance =
    payload.data.movements.length > 0
      ? Number(
          payload.data.movements[payload.data.movements.length - 1].balance || 0
        )
      : 0;

  const totalInOk = Number(summary.totalIn || 0) === totalInFromRows;
  const totalOutOk = Number(summary.totalOut || 0) === totalOutFromRows;
  const closingBalanceOk = Number(summary.closingBalance || 0) === lastBalance;

  return {
    totalInOk,
    totalOutOk,
    closingBalanceOk,
    totalMovements: payload.data.movements.length,
    totalInFromRows,
    totalOutFromRows,
    lastBalance,
  };
}

async function main() {
  logTitle('🧪 Prueba automática del endpoint Kardex de inventario');

  await connectMongo();

  const { row, movementCount } = await findBestStockRowForKardex();

  const productId = getObjectIdValue(row.product);
  const branchId = getObjectIdValue(row.branch);
  const size = getVariantSize(row);
  const color = getVariantColor(row);

  console.log('\n📦 Inventario seleccionado para la prueba:');
  console.dir(
    {
      inventoryStockId: String(row._id),
      productId,
      product: getProductTitle(row),
      sku: getProductSku(row),
      branchId,
      branch: getBranchName(row),
      size,
      color,
      stockFisico: Number(row.stock || 0),
      reservado: Number(row.reservedStock || 0),
      disponible:
        typeof row.availableStock === 'number'
          ? row.availableStock
          : Math.max(0, Number(row.stock || 0) - Number(row.reservedStock || 0)),
      movimientosEncontradosEnBD: movementCount,
    },
    { depth: null }
  );

  const url = buildKardexUrl({
    productId,
    branchId,
    size,
    color,
  });

  console.log('\n🌐 Consultando endpoint:');
  console.log(url);

  const payload = await requestKardex(url);

  console.log('\n✅ Respuesta recibida del Kardex.');

  const validation = validateKardex(payload);

  console.log('\n📊 Resumen Kardex:');
  console.dir(
    {
      producto: payload.data.product,
      sede: payload.data.branch,
      variante: payload.data.variant,
      stock: payload.data.stock,
      summary: payload.data.summary,
      totalMovimientosDevueltos: payload.data.movements.length,
    },
    { depth: null }
  );

  console.log('\n🧾 Validación esperada:');
  console.dir(validation, { depth: null });

  if (
    !validation.totalInOk ||
    !validation.totalOutOk ||
    !validation.closingBalanceOk
  ) {
    throw new Error(
      'La validación del Kardex no coincide con los movimientos devueltos.'
    );
  }

  console.log('\n📋 Primeros movimientos del Kardex:');
  console.dir(payload.data.movements.slice(0, 5), { depth: null });

  console.log('\n✅ Prueba Kardex finalizada correctamente.');
}

main()
  .catch((error) => {
    console.error('\n❌ Prueba Kardex falló:');
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });