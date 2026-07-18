// backend/scripts/seedUniversalProducts.js
/* eslint-disable no-console */

/**
 * Inserta y valida productos universales de prueba.
 *
 * Ejecutar desde backend:
 *   npm run seed:universal-products
 *   npm run test:products-universal
 *
 * Este script deja datos de demostracion en la base para probar:
 * - productos fisicos
 * - producto digital
 * - servicio
 * - combo/kit
 * - stock real en InventoryStock por sede
 * - endpoint /api/products/admin/list si el backend esta encendido
 */

require('dotenv').config({
  path: require('path').join(__dirname, '..', '.env'),
  quiet: true,
});

const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const Product = require('../models/Product');
const Branch = require('../models/Branch');
const InventoryStock = require('../models/InventoryStock');

const RUN_ID = Math.random().toString(36).slice(2, 9).toUpperCase();
const BASE_URL = String(process.env.PRODUCT_TEST_BASE_URL || 'http://localhost:5000').replace(/\/$/, '');
const SEED_TAG = 'seed-universal-products';

const results = {
  ok: 0,
  warn: 0,
  fail: 0,
};

function ok(message) {
  results.ok += 1;
  console.log(`OK  ${message}`);
}

function warn(message) {
  results.warn += 1;
  console.warn(`WARN ${message}`);
}

function fail(message, error = null) {
  results.fail += 1;
  console.error(`FAIL ${message}`);
  if (error?.message) console.error(`     ${error.message}`);
  if (error?.data) console.error(`     ${JSON.stringify(error.data)}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function money(value) {
  return Number(value || 0).toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  });
}

function cleanText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function makeToken() {
  if (!process.env.JWT_SECRET) return null;

  return jwt.sign(
    {
      role: 'admin',
      username: 'products-universal-test',
      authType: 'legacy',
      adminRole: 'owner',
    },
    process.env.JWT_SECRET,
    { expiresIn: '30m' }
  );
}

async function connectDb() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI no esta configurado en backend/.env');
  }

  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.MONGODB_URI);
  }

  ok('Conexion a MongoDB activa');
}

async function ensureBranch() {
  let branch = await Branch.findOne({
    deletedAt: null,
    active: true,
    status: 'active',
  })
    .sort({ isMain: -1, isDefaultForOnlineOrders: -1, createdAt: 1 })
    .exec();

  if (branch) {
    ok(`Sede encontrada para inventario: ${branch.name}`);
    return branch;
  }

  branch = new Branch({
    name: 'Sede Principal',
    code: 'SEDE-PRINCIPAL',
    type: 'store',
    status: 'active',
    active: true,
    isMain: true,
    isDefaultForOnlineOrders: true,
    notes: `Creada por seed universal ${RUN_ID}`,
  });

  await branch.save();
  warn('No habia sedes activas. Se creo Sede Principal para probar inventario.');
  return branch;
}

const DEMO_PRODUCTS = [
  {
    sku: 'UNI-TEC-AUDIFONOS-BT',
    title: 'Audifonos Bluetooth Pro Universal',
    description: 'Producto fisico de tecnologia usado para validar catalogo universal, variantes e inventario real.',
    productType: 'physical',
    unitOfMeasure: 'unit',
    trackInventory: true,
    allowBackorder: false,
    variantPreset: 'tech',
    variantAxes: [
      { label: 'Tecnologia', values: ['Bluetooth 5.3'] },
      { label: 'Color', values: ['Negro', 'Blanco'] },
    ],
    category: 'Tecnologia',
    categories: ['Tecnologia', 'Audio'],
    price: 159000,
    originalPrice: 189000,
    cost: 85000,
    averageCost: 85000,
    taxRate: 19,
    taxIncluded: true,
    brand: 'DemoTech',
    supplier: { name: 'Proveedor demo tecnologia' },
    barcode: '7700000001001',
    reorderPoint: 3,
    reorderQty: 10,
    weightGrams: 250,
    dimensionsCm: { l: 16, w: 10, h: 6 },
    colors: ['#000000', '#ffffff'],
    sizes: ['Bluetooth 5.3'],
    inventory: [
      { size: 'Bluetooth 5.3', color: 'Negro', stock: 12 },
      { size: 'Bluetooth 5.3', color: 'Blanco', stock: 8 },
    ],
    stockRows: [
      { size: 'Bluetooth 5.3', color: 'Negro', stock: 12, reservedStock: 1, reorderPoint: 3 },
      { size: 'Bluetooth 5.3', color: 'Blanco', stock: 8, reservedStock: 0, reorderPoint: 3 },
    ],
  },
  {
    sku: 'UNI-BEL-SHAMPOO-500',
    title: 'Shampoo Hidratante 500 ml',
    description: 'Producto de belleza para validar presentaciones, costos e inventario por unidad.',
    productType: 'physical',
    unitOfMeasure: 'unit',
    trackInventory: true,
    allowBackorder: false,
    variantPreset: 'beauty',
    variantAxes: [
      { label: 'Presentacion', values: ['500 ml'] },
      { label: 'Tipo', values: ['Hidratante'] },
    ],
    category: 'Belleza',
    categories: ['Belleza', 'Cuidado personal'],
    price: 32000,
    cost: 18500,
    averageCost: 18500,
    taxRate: 19,
    taxIncluded: true,
    brand: 'DemoCare',
    supplier: { name: 'Proveedor demo belleza' },
    barcode: '7700000001002',
    reorderPoint: 5,
    reorderQty: 12,
    weightGrams: 560,
    dimensionsCm: { l: 7, w: 7, h: 22 },
    sizes: ['500 ml'],
    colors: ['Hidratante'],
    inventory: [{ size: '500 ml', color: 'Hidratante', stock: 24 }],
    stockRows: [{ size: '500 ml', color: 'Hidratante', stock: 24, reservedStock: 2, reorderPoint: 5 }],
  },
  {
    sku: 'UNI-ALI-CAFE-500G',
    title: 'Cafe Especial 500 g',
    description: 'Producto alimenticio para validar categoria, unidad de medida, presentacion y control de stock.',
    productType: 'physical',
    unitOfMeasure: 'package',
    trackInventory: true,
    allowBackorder: false,
    variantPreset: 'food',
    variantAxes: [
      { label: 'Sabor', values: ['Clasico'] },
      { label: 'Presentacion', values: ['500 g'] },
    ],
    category: 'Alimentos',
    categories: ['Alimentos', 'Cafe'],
    price: 28500,
    cost: 16000,
    averageCost: 16000,
    taxRate: 5,
    taxIncluded: true,
    brand: 'DemoCafe',
    supplier: { name: 'Proveedor demo alimentos' },
    barcode: '7700000001003',
    reorderPoint: 6,
    reorderQty: 18,
    weightGrams: 520,
    dimensionsCm: { l: 12, w: 8, h: 20 },
    sizes: ['500 g'],
    colors: ['Clasico'],
    inventory: [{ size: '500 g', color: 'Clasico', stock: 35 }],
    stockRows: [{ size: '500 g', color: 'Clasico', stock: 35, reservedStock: 0, reorderPoint: 6 }],
  },
  {
    sku: 'UNI-HOG-KIT-LIMPIEZA',
    title: 'Combo Hogar Kit Limpieza',
    description: 'Combo fisico para validar productos tipo bundle con control de inventario.',
    productType: 'bundle',
    unitOfMeasure: 'package',
    trackInventory: true,
    allowBackorder: false,
    variantPreset: 'home',
    variantAxes: [
      { label: 'Medida', values: ['Kit completo'] },
      { label: 'Color', values: ['Mixto'] },
    ],
    category: 'Hogar',
    categories: ['Hogar', 'Combos'],
    price: 74900,
    cost: 42000,
    averageCost: 42000,
    taxRate: 19,
    taxIncluded: true,
    brand: 'DemoHome',
    supplier: { name: 'Proveedor demo hogar' },
    barcode: '7700000001004',
    reorderPoint: 2,
    reorderQty: 5,
    weightGrams: 1600,
    dimensionsCm: { l: 30, w: 20, h: 15 },
    sizes: ['Kit completo'],
    colors: ['Mixto'],
    inventory: [{ size: 'Kit completo', color: 'Mixto', stock: 9 }],
    stockRows: [{ size: 'Kit completo', color: 'Mixto', stock: 9, reservedStock: 1, reorderPoint: 2 }],
  },
  {
    sku: 'UNI-DIG-PLANTILLA-PRO',
    title: 'Plantilla Digital Premium',
    description: 'Producto digital sin control de inventario fisico.',
    productType: 'digital',
    unitOfMeasure: 'license',
    trackInventory: false,
    allowBackorder: true,
    variantPreset: 'none',
    variantAxes: [],
    category: 'Digital',
    categories: ['Digital', 'Descargables'],
    price: 59000,
    cost: 8000,
    averageCost: 8000,
    taxRate: 19,
    taxIncluded: true,
    brand: 'DemoDigital',
    supplier: { name: 'Proveedor demo digital' },
    barcode: '7700000001005',
    reorderPoint: 0,
    reorderQty: 0,
    weightGrams: 0,
    dimensionsCm: { l: 0, w: 0, h: 0 },
    sizes: [],
    colors: [],
    inventory: [],
    stockRows: [],
  },
  {
    sku: 'UNI-SER-INSTALACION',
    title: 'Servicio de Instalacion Basica',
    description: 'Servicio sin inventario para validar catalogo universal no limitado a productos fisicos.',
    productType: 'service',
    unitOfMeasure: 'service',
    trackInventory: false,
    allowBackorder: true,
    variantPreset: 'none',
    variantAxes: [],
    category: 'Servicios',
    categories: ['Servicios', 'Instalacion'],
    price: 90000,
    cost: 35000,
    averageCost: 35000,
    taxRate: 19,
    taxIncluded: true,
    brand: 'DemoServicios',
    supplier: { name: 'Proveedor demo servicios' },
    barcode: '7700000001006',
    reorderPoint: 0,
    reorderQty: 0,
    weightGrams: 0,
    dimensionsCm: { l: 0, w: 0, h: 0 },
    sizes: [],
    colors: [],
    inventory: [],
    stockRows: [],
  },
];

function buildProductPayload(item) {
  return {
    sku: item.sku,
    title: item.title,
    description: item.description,
    price: item.price,
    originalPrice: item.originalPrice,
    image: '',
    images: [],
    features: [`Catalogo universal`, `Seed ${SEED_TAG}`],
    colors: item.colors,
    sizes: item.sizes,
    inventory: item.inventory,
    productType: item.productType,
    unitOfMeasure: item.unitOfMeasure,
    trackInventory: item.trackInventory,
    allowBackorder: item.allowBackorder,
    variantPreset: item.variantPreset,
    variantAxes: item.variantAxes,
    category: item.category,
    categories: item.categories,
    stock: item.stockRows.reduce((sum, row) => sum + Number(row.stock || 0), 0),
    visible: true,
    active: true,
    reorderPoint: item.reorderPoint,
    reorderQty: item.reorderQty,
    warehouseLocation: 'SEED-UNIVERSAL',
    weightGrams: item.weightGrams,
    dimensionsCm: item.dimensionsCm,
    cost: item.cost,
    averageCost: item.averageCost,
    taxRate: item.taxRate,
    taxIncluded: item.taxIncluded,
    brand: item.brand,
    season: 'UNIVERSAL',
    supplier: item.supplier,
    barcode: item.barcode,
    notes: `Producto de demostracion para catalogo universal. ${SEED_TAG}.`,
  };
}

async function upsertProduct(item) {
  const payload = buildProductPayload(item);

  let product = await Product.findOne({
    $or: [{ sku: item.sku }, { barcode: item.barcode }],
  });

  if (!product) {
    product = new Product(payload);
  } else {
    Object.assign(product, payload);
  }

  await product.save();
  return product;
}

async function upsertStock({ branch, product, row, item }) {
  const variant = InventoryStock.buildVariantSnapshot({
    size: row.size,
    color: row.color,
    sku: `${item.sku}-${cleanText(row.size).slice(0, 8)}-${cleanText(row.color).slice(0, 8)}`,
    barcode: '',
  });

  const variantKey = InventoryStock.buildVariantKey(variant.size, variant.color);
  const filter = {
    branch: branch._id,
    product: product._id,
    variantKey,
    deletedAt: null,
  };

  let stock = await InventoryStock.findOne(filter);

  if (!stock) {
    stock = new InventoryStock({
      branch: branch._id,
      product: product._id,
      variantKey,
    });
  }

  stock.branchSnapshot = InventoryStock.buildBranchSnapshot(branch);
  stock.productSnapshot = InventoryStock.buildProductSnapshot(product);
  stock.variant = variant;
  stock.stock = Number(row.stock || 0);
  stock.reservedStock = Number(row.reservedStock || 0);
  stock.reorderPoint = Number(row.reorderPoint ?? item.reorderPoint ?? 0);
  stock.reorderQty = Number(item.reorderQty || 0);
  stock.warehouseLocation = 'SEED-UNIVERSAL';
  stock.notes = `Stock demo catalogo universal ${SEED_TAG}`;
  stock.active = true;
  stock.deletedAt = null;
  stock.lastCountedAt = new Date();
  stock.lastMovementAt = new Date();

  await stock.save();
  return stock;
}

async function seedProducts(branch) {
  const created = [];

  for (const item of DEMO_PRODUCTS) {
    const product = await upsertProduct(item);
    created.push(product);

    if (item.trackInventory && item.stockRows.length > 0) {
      for (const row of item.stockRows) {
        await upsertStock({ branch, product, row, item });
      }
    } else {
      await InventoryStock.updateMany(
        { product: product._id, deletedAt: null },
        { $set: { active: false, deletedAt: new Date(), notes: `Producto sin inventario fisico ${SEED_TAG}` } }
      );
    }
  }

  ok(`${created.length} productos universales creados/actualizados`);
  return created;
}

async function validateProducts(products) {
  const skus = DEMO_PRODUCTS.map((item) => item.sku);
  const saved = await Product.find({ sku: { $in: skus } }).lean();

  assert(saved.length === DEMO_PRODUCTS.length, `Se esperaban ${DEMO_PRODUCTS.length} productos y hay ${saved.length}`);
  ok('Productos semilla existen en la base');

  const types = new Set(saved.map((item) => item.productType));
  ['physical', 'digital', 'service', 'bundle'].forEach((type) => {
    assert(types.has(type), `Falta producto tipo ${type}`);
  });
  ok('Tipos universales validados: fisico, digital, servicio y combo');

  const withInventory = saved.filter((item) => item.trackInventory === true);
  const stocks = await InventoryStock.find({
    product: { $in: withInventory.map((item) => item._id) },
    deletedAt: null,
    active: { $ne: false },
  }).lean();

  assert(stocks.length >= 5, `Se esperaban registros InventoryStock y hay ${stocks.length}`);
  ok(`InventoryStock creado correctamente: ${stocks.length} registro(s)`);

  const financialProblems = saved.filter((item) => Number(item.price || 0) <= 0 || Number(item.cost || 0) < 0);
  assert(financialProblems.length === 0, 'Hay productos sin precio/costo valido');
  ok('Precio, costo y margen base listos para finanzas');

  products.forEach((product) => {
    const item = DEMO_PRODUCTS.find((row) => row.sku === product.sku);
    if (!item) return;
    const margin = Number(product.price || 0) - Number(product.cost || 0);
    console.log(`   - ${product.sku} | ${product.title} | ${product.productType} | precio ${money(product.price)} | margen ${money(margin)}`);
  });
}

async function validateAdminEndpoint() {
  const token = makeToken();

  if (!token) {
    warn('JWT_SECRET no esta configurado. Se omite prueba HTTP /api/products/admin/list.');
    return;
  }

  let response;
  try {
    response = await fetch(`${BASE_URL}/api/products/admin/list?all=1&q=UNI-`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (error) {
    warn(`Backend no disponible en ${BASE_URL}. Se insertaron productos, pero no se probo endpoint admin.`);
    return;
  }

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    const error = new Error(data?.message || data?.error || `HTTP ${response.status}`);
    error.data = data;
    throw error;
  }

  const list = Array.isArray(data?.data) ? data.data : [];
  assert(list.length >= DEMO_PRODUCTS.length, `Endpoint admin devolvio ${list.length} productos seed`);

  const firstPhysical = list.find((item) => item.trackInventory === true);
  assert(firstPhysical?.inventorySummary, 'Endpoint admin no trae inventorySummary');
  assert(Number(firstPhysical.inventorySummary.stock || 0) > 0, 'Endpoint admin no trae stock real desde InventoryStock');

  ok('/api/products/admin/list responde con productos e inventario real');
}

async function main() {
  console.log('\n=== Seed y prueba Productos Universales ===');
  console.log(`Run ID: ${RUN_ID}`);

  try {
    await connectDb();
    const branch = await ensureBranch();
    const products = await seedProducts(branch);
    await validateProducts(products);
    await validateAdminEndpoint();
  } catch (error) {
    fail('Error inesperado en seed/prueba de productos universales', error);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }

    console.log('\n=== Resultado final ===');
    console.log(`OK: ${results.ok}`);
    console.log(`WARN: ${results.warn}`);
    console.log(`FAIL: ${results.fail}`);

    process.exit(results.fail > 0 ? 1 : 0);
  }
}

main();
