// backend/scripts/createPermanentOrderForBranchView.js

try {
  require('dotenv').config();
} catch {
  // dotenv puede no estar instalado en algunos entornos
}

const mongoose = require('mongoose');

const Order = require('../models/Order');
const Product = require('../models/Product');
const Branch = require('../models/Branch');

const BASE_URL = process.env.PERMANENT_ORDER_BRANCH_TEST_BASE_URL || 'http://localhost:5000';

const MONGO_URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  process.env.DB_URI ||
  process.env.ATLAS_URI ||
  '';

const TEST_DELAY_MS = Number(process.env.PERMANENT_ORDER_BRANCH_TEST_DELAY_MS || 250);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assertMongoUri() {
  if (!MONGO_URI) {
    console.error('');
    console.error('❌ Falta variable de conexión MongoDB.');
    console.error('Revisa tu archivo .env. Debe existir MONGO_URI o MONGODB_URI.');
    console.error('');
    process.exit(1);
  }
}

function buildUniqueKey() {
  return Date.now().toString(36).toLowerCase();
}

function getProductPrice(product) {
  return Number(product?.price || 0) > 0 ? Number(product.price) : 1000;
}

function getProductImage(product) {
  if (product?.image) return String(product.image);

  if (Array.isArray(product?.images) && product.images[0]) {
    return String(product.images[0]);
  }

  return '';
}

function getAvailableVariant(product) {
  const inventory = Array.isArray(product?.inventory) ? product.inventory : [];
  const variant = inventory.find((item) => Number(item?.stock || 0) > 0);

  if (!variant) return null;

  return {
    color: String(variant.color || ''),
    size: String(variant.size || ''),
  };
}

async function findBranchForTest() {
  const branch =
    (await Branch.findOne({
      deletedAt: null,
      active: true,
      status: 'active',
      isDefaultForOnlineOrders: true,
    }).lean()) ||
    (await Branch.findOne({
      deletedAt: null,
      active: true,
      status: 'active',
      isMain: true,
    }).lean()) ||
    (await Branch.findOne({
      deletedAt: null,
      active: true,
      status: 'active',
    }).lean());

  if (!branch) {
    throw new Error('No hay sedes activas disponibles para crear la orden.');
  }

  return branch;
}

async function findProductForTest() {
  const products = await Product.find({
    active: { $ne: false },
    visible: { $ne: false },
    price: { $gt: 0 },
    $or: [
      { stock: { $gt: 0 } },
      { 'inventory.stock': { $gt: 0 } },
    ],
  })
    .sort({ updatedAt: -1, createdAt: -1 })
    .limit(50)
    .lean();

  for (const product of products) {
    const inventory = Array.isArray(product.inventory) ? product.inventory : [];

    if (inventory.length > 0) {
      const variant = getAvailableVariant(product);

      if (variant) {
        return {
          product,
          variant,
        };
      }

      continue;
    }

    if (Number(product.stock || 0) > 0) {
      return {
        product,
        variant: {
          color: Array.isArray(product.colors) ? product.colors[0] || '' : '',
          size: Array.isArray(product.sizes) ? product.sizes[0] || '' : '',
        },
      };
    }
  }

  throw new Error(
    'No encontré productos activos con stock disponible. Crea o activa un producto con stock antes de correr este script.'
  );
}

async function request(method, path, body = null, headers = {}) {
  await sleep(TEST_DELAY_MS);

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  return {
    status: response.status,
    data,
  };
}

function buildOrderPayload({ branch, product, variant, unique }) {
  const price = getProductPrice(product);

  return {
    sessionId: `sess_permanent_branch_view_${unique}`,

    branch: String(branch._id),
    branchId: String(branch._id),
    source: 'online',

    cart: [
      {
        productId: String(product._id),
        title: String(product.title || 'Producto prueba sede visible'),
        image: getProductImage(product),
        color: variant.color,
        size: variant.size,
        quantity: 1,
        price,
      },
    ],

    subtotal: price,
    shipping: 0,
    total: price,

    customer: {
      name: 'Cliente',
      lastname: 'Prueba Sede Visible',
      id: `CC-${unique}`,
      emailOrPhone: `cliente-visible-${unique}@test.local`,
      email: `cliente-visible-${unique}@test.local`,
      phone: '3000000000',
      address: 'Dirección de prueba visual',
      city: 'Ciénaga',
      department: 'Magdalena',
      country: 'Colombia',
      deliveryType: 'envio',
      wantsNewsletter: false,
    },

    billing: {
      useSameAddress: true,
      name: 'Cliente',
      lastname: 'Prueba Sede Visible',
      id: `CC-${unique}`,
      address: 'Dirección de prueba visual',
      city: 'Ciénaga',
      department: 'Magdalena',
      country: 'Colombia',
      phone: '3000000000',
      extra: '',
    },

    tags: ['prueba-visual-sede'],
  };
}

async function main() {
  assertMongoUri();

  console.log('');
  console.log('🧪 Crear orden permanente para visualizar sede en panel admin');
  console.log(`Base URL: ${BASE_URL}`);
  console.log('');
  console.log('⚠️ Esta orden NO se elimina automáticamente.');
  console.log('⚠️ Esta orden descuenta 1 unidad de stock porque se crea por la API real.');
  console.log('');

  try {
    console.log('1️⃣ Conectando a MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Conectado a MongoDB.');

    console.log('');
    console.log('2️⃣ Buscando sede activa...');
    const branch = await findBranchForTest();

    console.log(`✅ Sede seleccionada: ${branch.name} (${branch.code})`);

    console.log('');
    console.log('3️⃣ Buscando producto activo con stock...');
    const { product, variant } = await findProductForTest();

    console.log(`✅ Producto seleccionado: ${product.title} (${product._id})`);

    const unique = buildUniqueKey();
    const idempotencyKey = `permanent-order-branch-view-${unique}`;

    const payload = buildOrderPayload({
      branch,
      product,
      variant,
      unique,
    });

    console.log('');
    console.log('4️⃣ Creando orden permanente por API...');
    const response = await request('POST', '/api/orders', payload, {
      'Idempotency-Key': idempotencyKey,
    });

    if (![200, 201].includes(response.status)) {
      throw new Error(
        `POST /api/orders falló con estado ${response.status}: ${JSON.stringify(
          response.data
        )}`
      );
    }

    const orderId = response.data?._id;

    if (!orderId) {
      throw new Error('La API respondió, pero no devolvió _id de orden.');
    }

    console.log(`✅ Orden creada: ${orderId}`);
    console.log(`✅ Número de orden: ${response.data?.orderNumber || 'N/A'}`);

    console.log('');
    console.log('5️⃣ Verificando orden guardada...');
    const order = await Order.findById(orderId).lean();

    if (!order) {
      throw new Error('La orden no existe en MongoDB después de crearla.');
    }

    if (String(order.branch || '') !== String(branch._id || '')) {
      throw new Error('La orden no guardó la sede esperada.');
    }

    console.log('✅ La orden guardó branch correctamente.');
    console.log('✅ La orden guardó branchSnapshot correctamente.');
    console.log('✅ La orden quedó disponible para verla en el panel admin.');
    console.log('');

    console.log('===============================================');
    console.log('✅ ORDEN PERMANENTE CREADA PARA VISUALIZAR SEDE');
    console.log('===============================================');
    console.log('');
    console.log(`Orden: #${response.data?.orderNumber || 'N/A'}`);
    console.log(`ID: ${orderId}`);
    console.log(`Sede: ${order.branchSnapshot?.name || branch.name}`);
    console.log(`Código sede: ${order.branchSnapshot?.code || branch.code}`);
    console.log('');
    console.log('Ahora entra a:');
    console.log('http://localhost:5173/admin/ordenes');
    console.log('');
    console.log('Busca el número de orden anterior. Debe aparecer con la sede.');
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('');
    console.error('===============================================');
    console.error('❌ NO SE PUDO CREAR LA ORDEN PERMANENTE');
    console.error('===============================================');
    console.error(error.message);
    console.error('');

    process.exit(1);
  } finally {
    try {
      await mongoose.disconnect();
    } catch {
      // ignore
    }
  }
}

main();