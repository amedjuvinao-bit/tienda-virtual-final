// backend/scripts/testProductsModuleClosure.js
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const { env, assertEnv } = require('../config/env');
const Product = require('../models/Product');
const Branch = require('../models/Branch');
const Cart = require('../models/Cart');
const Order = require('../models/Order');
const InventoryStock = require('../models/InventoryStock');
const InventoryMovement = require('../models/InventoryMovement');
const {
  buildVariantKey,
  getColorDisplayName,
  resolveVariantCommercialSnapshot,
} = require('../lib/products/productVariantConfig');

const RUN_ID = Math.random().toString(36).slice(2, 9).toUpperCase();
const TEST_SKU = `CLOSE-PROD-${RUN_ID}`;
const TEST_SESSION = `sess-products-close-${RUN_ID}`;
const REPO_ROOT = path.join(__dirname, '..', '..');

const results = { ok: 0, warn: 0, fail: 0 };

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
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readRepoFile(relativePath) {
  const fullPath = path.join(REPO_ROOT, relativePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`No existe el archivo requerido: ${relativePath}`);
  }
  return fs.readFileSync(fullPath, 'utf8');
}

function assertSourceContains(source, patterns, label) {
  const missing = [];
  for (const pattern of patterns) {
    const matched = pattern instanceof RegExp ? pattern.test(source) : source.includes(pattern);
    if (!matched) missing.push(String(pattern));
  }
  assert(missing.length === 0, `${label} no contiene: ${missing.join(', ')}`);
}

async function connectDb() {
  assertEnv();
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(env.mongoUri);
  }
  ok(`Conexion a MongoDB activa desde ${env.mongoUriSource}`);
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
    ok(`Sede activa encontrada: ${branch.name}`);
    return branch;
  }

  branch = await Branch.create({
    name: `Sede Productos ${RUN_ID}`,
    code: `PROD-${RUN_ID}`,
    type: 'store',
    status: 'active',
    active: true,
    isMain: true,
    isDefaultForOnlineOrders: true,
    notes: `Creada por prueba cierre modulo productos ${RUN_ID}`,
  });

  warn('No habia sedes activas. Se creo una sede temporal para la prueba.');
  return branch;
}

async function waitForHooks() {
  await new Promise((resolve) => setTimeout(resolve, 450));
}

async function cleanup(productId = null) {
  await Cart.deleteMany({ sessionId: TEST_SESSION });
  await Product.deleteMany({ sku: TEST_SKU });

  if (productId) {
    await InventoryMovement.deleteMany({ sourceId: productId });
    await InventoryStock.deleteMany({ product: productId });
    await Product.deleteOne({ _id: productId });
  }
}

function validateStaticCode() {
  const productModel = readRepoFile('backend/models/Product.js');
  assertSourceContains(
    productModel,
    [
      'variants:',
      'variantKey',
      'sku:',
      'barcode:',
      'price:',
      'cost:',
      'image:',
      'images:',
      'syncProductInventoryFromProduct',
    ],
    'Product.js'
  );
  ok('Modelo Product soporta variantes comerciales avanzadas');

  const inventoryModel = readRepoFile('backend/models/InventoryStock.js');
  assertSourceContains(
    inventoryModel,
    ['variantKey', 'variant:', 'availableStock', 'reservedStock', 'buildVariantSnapshot'],
    'InventoryStock.js'
  );
  ok('InventoryStock soporta existencia real por variantKey');

  const cartRoutes = readRepoFile('backend/routes/cartRoutes.js');
  assertSourceContains(
    cartRoutes,
    ['resolveVariantCommercialSnapshot', 'InventoryStock', 'computeAvailableStockForCartItem', 'variantSku', 'variantBarcode'],
    'cartRoutes.js'
  );
  ok('Carrito backend valida precio y stock por variante avanzada');

  const productDetail = readRepoFile('frontend/src/pages/ProductDetail.jsx');
  assertSourceContains(
    productDetail,
    ['selectedVariant', 'variantAwareProduct', 'getColorDisplayName', 'variantId', 'variantSku', 'variantBarcode'],
    'ProductDetail.jsx'
  );
  ok('Detalle publico usa variante para imagen, precio y carrito');

  const cartContext = readRepoFile('frontend/src/context/CartContext.jsx');
  assertSourceContains(
    cartContext,
    ['readVariantId', 'variantId', 'variantKey', 'variantSku', 'variantBarcode', 'items: cart.map(toBackendItem)'],
    'CartContext.jsx'
  );
  ok('Carrito frontend conserva variante exacta y valida contra backend');

  const colorDisplay = readRepoFile('frontend/src/utils/colorDisplay.js');
  assertSourceContains(
    colorDisplay,
    ['getColorDisplayName', 'Celeste claro', 'HEX_COLOR_LABELS', 'approximateColorName'],
    'colorDisplay.js'
  );
  ok('Utilidad visual convierte colores hexadecimales a nombres legibles');

  const formSource = readRepoFile('frontend/src/admin/FormularioProducto.jsx');
  assert(/variantes avanzadas/i.test(formSource), 'FormularioProducto no tiene seccion visual de variantes avanzadas.');
  assertSourceContains(
    formSource,
    ['variant', 'variantKey', 'barcode', 'initialStock', 'images'],
    'FormularioProducto.jsx'
  );
  ok('Formulario admin contiene interfaz de variantes avanzadas');
}

async function createAdvancedProduct() {
  const product = await Product.create({
    sku: TEST_SKU,
    title: `Producto cierre modulo ${RUN_ID}`,
    description: 'Producto temporal para validar cierre completo del modulo productos.',
    productType: 'physical',
    unitOfMeasure: 'unit',
    trackInventory: true,
    allowBackorder: false,
    variantPreset: 'generic',
    category: 'Pruebas modulo productos',
    categories: ['Pruebas modulo productos'],
    price: 120000,
    originalPrice: 150000,
    cost: 65000,
    averageCost: 65000,
    image: 'https://example.com/producto-base.jpg',
    images: ['https://example.com/producto-base-1.jpg'],
    colors: ['#0000ff', '#ff0000'],
    sizes: ['128GB', '256GB'],
    variants: [
      {
        size: '128GB',
        color: '#0000ff',
        label: '128GB / #0000ff',
        sku: `${TEST_SKU}-AZU-128`,
        barcode: `770${RUN_ID}128`,
        price: 135000,
        cost: 80000,
        originalPrice: 160000,
        image: 'https://example.com/azul-cover.jpg',
        images: ['https://example.com/azul-1.jpg', 'https://example.com/azul-2.jpg'],
        initialStock: 4,
        active: true,
      },
      {
        size: '256GB',
        color: '#ff0000',
        label: '256GB / #ff0000',
        sku: `${TEST_SKU}-ROJ-256`,
        barcode: `770${RUN_ID}256`,
        price: 155000,
        cost: 95000,
        originalPrice: 180000,
        image: 'https://example.com/rojo-cover.jpg',
        images: ['https://example.com/rojo-1.jpg'],
        initialStock: 2,
        active: true,
      },
    ],
    active: true,
    visible: true,
  });

  await waitForHooks();
  ok('Producto temporal con variantes avanzadas creado');
  return product;
}

async function validateProductDocument(productId) {
  const product = await Product.findById(productId).lean();
  assert(product, 'Producto temporal no existe despues de crear.');
  assert(product.slug, 'Producto no genero slug publico.');
  assert(Array.isArray(product.variants) && product.variants.length === 2, 'Producto no guardo dos variantes avanzadas.');

  const blue = product.variants.find((variant) => variant.size === '128GB');
  assert(blue, 'No existe variante 128GB.');
  assert(blue.variantKey === buildVariantKey('128GB', '#0000ff'), 'variantKey no es consistente.');
  assert(!String(blue.label || '').includes('#'), 'La etiqueta visible de variante sigue mostrando hexadecimal.');
  assert(blue.label.includes('Azul'), 'La etiqueta de variante no muestra nombre visible del color.');
  assert(Number(blue.price) === 135000, 'La variante azul no conserva precio propio.');
  assert(Number(blue.cost) === 80000, 'La variante azul no conserva costo propio.');
  assert(blue.image === 'https://example.com/azul-cover.jpg', 'La variante azul no conserva imagen principal.');
  assert(Array.isArray(blue.images) && blue.images.length === 2, 'La variante azul no conserva galeria propia.');
  assert(blue.sku === `${TEST_SKU}-AZU-128`, 'La variante azul no conserva SKU propio.');
  assert(blue.barcode === `770${RUN_ID}128`, 'La variante azul no conserva barcode propio.');
  ok('Product guarda precio, costo, imagenes, SKU y barcode por variante');

  assert(getColorDisplayName('#0000ff') === 'Azul', 'El color hexadecimal azul no se traduce a nombre visible.');
  assert(getColorDisplayName('#b2ebf2') === 'Celeste claro', 'El color hexadecimal celeste no se traduce a nombre visible.');
  ok('Colores hexadecimales se traducen a nombres visibles');

  return product;
}

async function validateInventory(productId) {
  const rows = await InventoryStock.find({ product: productId, deletedAt: null }).lean();
  const blueKey = buildVariantKey('128GB', '#0000ff');
  const redKey = buildVariantKey('256GB', '#ff0000');
  const blueStock = rows.find((row) => row.variantKey === blueKey);
  const redStock = rows.find((row) => row.variantKey === redKey);

  assert(blueStock, 'No existe InventoryStock para variante azul.');
  assert(redStock, 'No existe InventoryStock para variante roja.');
  assert(Number(blueStock.stock) === 4, 'Stock inicial azul incorrecto.');
  assert(Number(blueStock.availableStock) === 4, 'Disponible azul incorrecto.');
  assert(Number(redStock.stock) === 2, 'Stock inicial rojo incorrecto.');
  assert(blueStock.variant?.sku === `${TEST_SKU}-AZU-128`, 'InventoryStock no conserva SKU variante.');
  assert(blueStock.variant?.barcode === `770${RUN_ID}128`, 'InventoryStock no conserva barcode variante.');
  ok('InventoryStock sincroniza stock, disponible, SKU y barcode por variante');

  const product = await Product.findById(productId).lean();
  assert(Number(product.stock) === 6, 'Product.stock no refleja suma real de InventoryStock.');
  ok('Product.stock refleja el inventario real total');
}

async function validateCommercialResolver(product) {
  const blueSnapshot = resolveVariantCommercialSnapshot(product, {
    variantKey: buildVariantKey('128GB', '#0000ff'),
  });

  assert(Number(blueSnapshot.price) === 135000, 'Resolver comercial no toma precio de variante.');
  assert(Number(blueSnapshot.cost) === 80000, 'Resolver comercial no toma costo de variante.');
  assert(blueSnapshot.image === 'https://example.com/azul-cover.jpg', 'Resolver comercial no toma imagen de variante.');
  assert(Array.isArray(blueSnapshot.images) && blueSnapshot.images.length === 2, 'Resolver comercial no toma galeria de variante.');
  assert(blueSnapshot.sku === `${TEST_SKU}-AZU-128`, 'Resolver comercial no toma SKU de variante.');
  assert(blueSnapshot.barcode === `770${RUN_ID}128`, 'Resolver comercial no toma barcode de variante.');
  ok('Resolver comercial devuelve precio, costo, imagen y codigos de variante');

  const fallbackSnapshot = resolveVariantCommercialSnapshot(product, {
    variantKey: 'no-existe__no-existe',
  });
  assert(Number(fallbackSnapshot.price) === 120000, 'Fallback comercial no usa precio base.');
  assert(Number(fallbackSnapshot.cost) === 65000, 'Fallback comercial no usa costo base.');
  ok('Resolver comercial usa precio/costo base si la variante no existe');
}

async function validateCartPersistence(product) {
  const blueKey = buildVariantKey('128GB', '#0000ff');
  const snapshot = resolveVariantCommercialSnapshot(product, { variantKey: blueKey });

  const cart = await Cart.create({
    sessionId: TEST_SESSION,
    items: [
      {
        _id: product._id,
        title: product.title,
        image: snapshot.image,
        color: 'Azul',
        colorLabel: 'Azul',
        size: '128GB',
        variantId: blueKey,
        price: snapshot.price,
        qty: 2,
      },
    ],
  });

  const item = cart.items[0];
  assert(item.variantId === blueKey, 'Carrito no conserva variantId.');
  assert(item.color === '#0000ff', 'Carrito no conserva el valor canónico del color.');
  assert(item.colorLabel === 'Azul', 'Carrito no conserva nombre visible del color.');
  assert(item.image === 'https://example.com/azul-cover.jpg', 'Carrito no conserva imagen de variante.');
  assert(Number(item.price) === 135000, 'Carrito no conserva precio de variante.');
  ok('Carrito guarda variante exacta con imagen, precio y color visible');

  const persisted = await Cart.findOne({ sessionId: TEST_SESSION }).lean();
  assert(
    persisted.items[0].colorLabel === 'Azul',
    'La recarga del carrito perdió el nombre visible del color.'
  );
  const subtotal = persisted.items.reduce((sum, row) => sum + Number(row.price || 0) * Number(row.qty || 0), 0);
  assert(subtotal === 270000, 'Subtotal de carrito no respeta precio propio de variante.');
  ok('Subtotal de carrito respeta precio propio de variante');

  cart.items[0].qty = 3;
  await cart.save();
  const updatedCart = await Cart.findOne({ sessionId: TEST_SESSION });
  assert(
    updatedCart.items[0].colorLabel === 'Azul' &&
      updatedCart.items[0].color === '#0000ff',
    'Actualizar la cantidad perdió la separación entre color visible y canónico.'
  );

  const order = new Order({
    sessionId: TEST_SESSION,
    orderNumber: `CLOSE-${RUN_ID}`,
    status: 'pending',
    subtotal: 405000,
    total: 405000,
    items: [
      {
        product: product._id,
        productId: String(product._id),
        title: product.title,
        image: updatedCart.items[0].image,
        color: updatedCart.items[0].color,
        colorLabel: updatedCart.items[0].colorLabel,
        size: updatedCart.items[0].size,
        variantKey: updatedCart.items[0].variantKey,
        variantLabel: updatedCart.items[0].variantLabel,
        variantAttributes: updatedCart.items[0].variantAttributes,
        quantity: 3,
        qty: 3,
        price: 135000,
        unitPrice: 135000,
      },
    ],
    payment: {
      provider: 'manual',
      status: 'pending_manual',
      amount: 405000,
      currency: 'COP',
    },
  });
  await order.validate();
  assert(
    order.items[0].colorLabel === 'Azul' &&
      order.items[0].color === '#0000ff',
    'La orden perdió el nombre visible o el valor canónico del color.'
  );
  ok('Cantidad, recarga y orden conservan color visible e identidad canónica');
}

async function validateEditDoesNotOverwriteStock(productId) {
  let product = await Product.findById(productId);
  const blueKey = buildVariantKey('128GB', '#0000ff');

  product.variants = product.variants.map((variant) => {
    const plain = variant.toObject ? variant.toObject() : variant;
    if (plain.variantKey !== blueKey) return plain;
    return {
      ...plain,
      price: 145000,
      cost: 82000,
      image: 'https://example.com/azul-cover-v2.jpg',
      images: ['https://example.com/azul-v2-1.jpg'],
      initialStock: 999,
    };
  });

  await product.save();
  await waitForHooks();

  const saved = await Product.findById(productId).lean();
  const snapshot = resolveVariantCommercialSnapshot(saved, { variantKey: blueKey });
  assert(Number(snapshot.price) === 145000, 'Edicion de variante no actualizo precio.');
  assert(snapshot.image === 'https://example.com/azul-cover-v2.jpg', 'Edicion de variante no actualizo imagen.');

  const stockRow = await InventoryStock.findOne({ product: productId, variantKey: blueKey, deletedAt: null }).lean();
  assert(Number(stockRow.stock) === 4, 'Edicion de variante sobrescribio stock real existente.');
  ok('Editar variante actualiza ficha comercial sin pisar stock real');
}

async function main() {
  console.log('\n=== Prueba General de Cierre Modulo Productos ===');
  console.log(`Run ID: ${RUN_ID}`);

  let product = null;

  try {
    validateStaticCode();
    await connectDb();
    await ensureBranch();
    await cleanup();

    product = await createAdvancedProduct();
    const savedProduct = await validateProductDocument(product._id);
    await validateInventory(product._id);
    await validateCommercialResolver(savedProduct);
    await validateCartPersistence(savedProduct);
    await validateEditDoesNotOverwriteStock(product._id);

    ok('Modulo Productos cumple condiciones tecnicas para cierre funcional');
  } catch (error) {
    fail('Error inesperado en prueba general de Productos', error);
  } finally {
    await cleanup(product?._id);
    ok('Limpieza final de datos temporales');

    console.log('\n=== Resultado final ===');
    console.log(`OK: ${results.ok}`);
    console.log(`WARN: ${results.warn}`);
    console.log(`FAIL: ${results.fail}`);

    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }

    if (results.fail > 0) process.exit(1);
  }
}

main();
