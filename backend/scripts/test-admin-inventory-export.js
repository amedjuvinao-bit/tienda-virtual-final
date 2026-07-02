// backend/scripts/test-admin-inventory-export.js

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

// Registrar modelos usados por populate en las rutas
require('../models/Product');
require('../models/Branch');

const InventoryStock = require('../models/InventoryStock');

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

async function requestInventoryExport() {
  if (!ADMIN_TEST_TOKEN) {
    throw new Error('Falta ADMIN_TEST_TOKEN en el .env o en la terminal.');
  }

  const url = `${API_BASE_URL}/api/admin/inventory/export`;

  console.log('\n🌐 Consultando endpoint:');
  console.log(url);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${ADMIN_TEST_TOKEN}`,
      Accept: 'text/csv',
    },
  });

  const text = await response.text();

  if (!response.ok) {
    console.log('❌ Respuesta del backend:');
    console.log(text);

    throw new Error(`El endpoint export respondió HTTP ${response.status}`);
  }

  return {
    text,
    contentType: response.headers.get('content-type') || '',
    contentDisposition: response.headers.get('content-disposition') || '',
  };
}

function normalizeCsvText(text) {
  return String(text || '').replace(/^\uFEFF/, '').trim();
}

function parseCsvLines(text) {
  const normalized = normalizeCsvText(text);

  if (!normalized) return [];

  return normalized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function validateCsv({ text, contentType, contentDisposition }, expectedRows) {
  const lines = parseCsvLines(text);

  if (!contentType.toLowerCase().includes('text/csv')) {
    throw new Error(`Content-Type inesperado: ${contentType}`);
  }

  if (!contentDisposition.toLowerCase().includes('attachment')) {
    throw new Error(`Content-Disposition inesperado: ${contentDisposition}`);
  }

  if (lines.length < 1) {
    throw new Error('El CSV llegó vacío.');
  }

  const header = lines[0];

  const requiredHeaders = [
    'Producto',
    'SKU',
    'Sede',
    'Codigo sede',
    'Tipo sede',
    'Talla',
    'Color',
    'Stock fisico',
    'Reservado',
    'Disponible',
    'Punto minimo',
    'Estado',
    'Ultima actualizacion',
  ];

  const missingHeaders = requiredHeaders.filter((column) => !header.includes(column));

  if (missingHeaders.length > 0) {
    throw new Error(`Faltan columnas en el CSV: ${missingHeaders.join(', ')}`);
  }

  const dataRows = Math.max(0, lines.length - 1);

  if (dataRows !== expectedRows) {
    throw new Error(
      `Cantidad de filas incorrecta. Esperadas: ${expectedRows}. Recibidas: ${dataRows}.`
    );
  }

  return {
    totalLines: lines.length,
    dataRows,
    header,
    firstDataRow: lines[1] || '',
  };
}

function saveCsvFile(text) {
  const outputDir = path.join(__dirname, 'data');

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, {
      recursive: true,
    });
  }

  const fileName = `inventory-export-test-${Date.now()}.csv`;
  const filePath = path.join(outputDir, fileName);

  fs.writeFileSync(filePath, text, 'utf8');

  return filePath;
}

async function main() {
  logTitle('🧪 Prueba automática de exportación CSV de inventario');

  await connectMongo();

  const expectedRows = await InventoryStock.countDocuments({
    deletedAt: null,
  });

  console.log('\n📌 Registros esperados desde BD:');
  console.dir(
    {
      inventoryStockRows: expectedRows,
    },
    { depth: null }
  );

  const exportResponse = await requestInventoryExport();

  console.log('\n✅ CSV recibido desde el backend.');

  const validation = validateCsv(exportResponse, expectedRows);

  console.log('\n📊 Validación CSV:');
  console.dir(
    {
      contentType: exportResponse.contentType,
      contentDisposition: exportResponse.contentDisposition,
      totalLines: validation.totalLines,
      dataRows: validation.dataRows,
      header: validation.header,
      firstDataRow: validation.firstDataRow,
    },
    { depth: null }
  );

  const filePath = saveCsvFile(exportResponse.text);

  console.log('\n💾 Archivo guardado para revisión:');
  console.log(filePath);

  console.log('\n✅ Prueba de exportación CSV finalizada correctamente.');
}

main()
  .catch((error) => {
    console.error('\n❌ Prueba de exportación CSV falló:');
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });