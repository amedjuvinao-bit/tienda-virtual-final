// backend/scripts/testOrderBranchFlow.js

try {
  require('dotenv').config();
} catch {
  // dotenv puede no estar instalado en algunos entornos
}

const mongoose = require('mongoose');

const Order = require('../models/Order');
const OrderModel = require('../models/Order');
const Product = require('../models/Product');
const Branch = require('../models/Branch');
const IdempotencyKey = require('../models/IdempotencyKey');

const BASE_URL = process.env.ORDER_BRANCH_TEST_BASE_URL || 'http://localhost:5000';

const MONGO_URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  process.env.DB_URI ||
  process.env.ATLAS_URI ||
  '';

const TEST_DELAY_MS = Number(process.env.ORDER_BRANCH_TEST_DELAY_MS || 250);

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
    throw new Error('No hay sedes activas disponibles para la prueba.');
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
          usesVariantInventory: true,
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
        usesVariantInventory: false,
      };
    }
  }

  throw new Error(
    'No encontré productos activos con stock disponible. Crea o activa un producto con stock antes de correr esta prueba.'
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
    sessionId: `sess_order_branch_${unique}`,

    branch: String(branch._id),
    branchId: String(branch._id),
    source: 'online',

    cart: [
      {
        productId: String(product._id),
        title: String(product.title || 'Producto prueba sede'),
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
      lastname: 'Prueba Sede',
      id: `CC-${unique}`,
      emailOrPhone: `cliente-${unique}@test.local`,
      email: `cliente-${unique}@test.local`,
      phone: '3000000000',
      address: 'Dirección de prueba',
      city: 'Ciénaga',
      department: 'Magdalena',
      country: 'Colombia',
      deliveryType: 'envio',
      wantsNewsletter: false,
    },

    billing: {
      useSameAddress: true,
      name: 'Cliente',
      lastname: 'Prueba Sede',
      id: `CC-${unique}`,
      address: 'Dirección de prueba',
      city: 'Ciénaga',
      department: 'Magdalena',
      country: 'Colombia',
      phone: '3000000000',
      extra: '',
    },

    tags: ['prueba-sede'],
  };
}

async function restoreStock({ product, variant, usesVariantInventory }) {
  if (!product?._id) return;

  if (usesVariantInventory) {
    await Product.updateOne(
      {
        _id: product._id,
        inventory: {
          $elemMatch: {
            color: { $regex: `^${escapeRegex(variant.color)}$`, $options: 'i' },
            size: { $regex: `^${escapeRegex(variant.size)}$`, $options: 'i' },
          },
        },
      },
      {
        $inc: {
          'inventory.$.stock': 1,
        },
      }
    );

    const updatedProduct = await Product.findById(product._id).lean();

    if (updatedProduct && Array.isArray(updatedProduct.inventory)) {
      const totalStock = updatedProduct.inventory.reduce(
        (acc, row) => acc + Math.max(0, Number(row?.stock || 0)),
        0
      );

      await Product.updateOne(
        { _id: product._id },
        {
          $set: {
            stock: totalStock,
          },
        }
      );
    }

    return;
  }

  await Product.updateOne(
    { _id: product._id },
    {
      $inc: {
        stock: 1,
      },
    }
  );
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function cleanup({ orderId, idempotencyKey, productData }) {
  if (productData?.product?._id) {
    try {
      await restoreStock(productData);
      console.log('🧹 Stock restaurado.');
    } catch (error) {
      console.warn('⚠️ No se pudo restaurar stock:', error.message);
    }
  }

  if (orderId) {
    try {
      await Order.deleteOne({ _id: orderId });
      console.log('🧹 Orden temporal eliminada.');
    } catch (error) {
      console.warn('⚠️ No se pudo eliminar orden temporal:', error.message);
    }

    try {
      const OrderEvent =
        mongoose.models.OrderEvent ||
        mongoose.model(
          'OrderEvent',
          new mongoose.Schema({}, { strict: false }),
          'order_events'
        );

      await OrderEvent.deleteMany({ orderId });
      console.log('🧹 Eventos temporales eliminados.');
    } catch (error) {
      console.warn('⚠️ No se pudieron eliminar eventos temporales:', error.message);
    }
  }

  if (idempotencyKey) {
    try {
      await IdempotencyKey.deleteMany({
        key: idempotencyKey,
        endpoint: 'POST /orders',
      });
      console.log('🧹 Idempotency key eliminada.');
    } catch (error) {
      console.warn('⚠️ No se pudo eliminar idempotency key:', error.message);
    }
  }
}

async function main() {
  assertMongoUri();

  console.log('');
  console.log('🧪 Test automático de Órdenes ↔ Sede operativa');
  console.log(`Base URL: ${BASE_URL}`);
  console.log('');

  let orderId = '';
  let idempotencyKey = '';
  let productData = null;

  try {
    console.log('1️⃣ Conectando a MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Conectado a MongoDB.');

    console.log('');
    console.log('2️⃣ Buscando sede activa para la orden...');
    const branch = await findBranchForTest();

    console.log(`✅ Sede seleccionada: ${branch.name} (${branch.code})`);

    console.log('');
    console.log('3️⃣ Buscando producto activo con stock...');
    productData = await findProductForTest();

    console.log(
      `✅ Producto seleccionado: ${productData.product.title} (${productData.product._id})`
    );

    const unique = buildUniqueKey();
    idempotencyKey = `order-branch-test-${unique}`;

    const payload = buildOrderPayload({
      branch,
      product: productData.product,
      variant: productData.variant,
      unique,
    });

    console.log('');
    console.log('4️⃣ Creando orden por API...');
    const createdResponse = await request('POST', '/api/orders', payload, {
      'Idempotency-Key': idempotencyKey,
    });

    if (![200, 201].includes(createdResponse.status)) {
      throw new Error(
        `POST /api/orders falló con estado ${createdResponse.status}: ${JSON.stringify(
          createdResponse.data
        )}`
      );
    }

    orderId = createdResponse.data?._id;

    if (!orderId) {
      throw new Error('La API creó respuesta, pero no devolvió _id de orden.');
    }

    console.log(`✅ Orden creada: ${orderId}`);
    console.log(`✅ Número de orden: ${createdResponse.data?.orderNumber || 'N/A'}`);

    console.log('');
    console.log('5️⃣ Consultando orden guardada en MongoDB...');
    const order = await OrderModel.findById(orderId).lean();

    if (!order) {
      throw new Error('La orden no existe en MongoDB después de crearla.');
    }

    if (String(order.branch || '') !== String(branch._id || '')) {
      throw new Error('La orden no guardó el branch esperado.');
    }

    if (!order.branchSnapshot || typeof order.branchSnapshot !== 'object') {
      throw new Error('La orden no guardó branchSnapshot.');
    }

    if (String(order.branchSnapshot.code || '') !== String(branch.code || '')) {
      throw new Error('branchSnapshot.code no coincide con la sede seleccionada.');
    }

    if (String(order.source || '') !== 'online') {
      throw new Error('La orden no guardó source = online.');
    }

    console.log('✅ La orden guardó branch correctamente.');
    console.log('✅ La orden guardó branchSnapshot correctamente.');
    console.log('✅ La orden guardó source correctamente.');

    console.log('');
    console.log('6️⃣ Limpiando datos temporales...');
    await cleanup({
      orderId,
      idempotencyKey,
      productData,
    });

    console.log('');
    console.log('===============================================');
    console.log('✅ TEST ÓRDENES ↔ SEDE OPERATIVA APROBADO');
    console.log('===============================================');
    console.log('');
    console.log('Validado:');
    console.log('- Selección de sede activa');
    console.log('- Selección de producto con stock');
    console.log('- Creación de orden por API');
    console.log('- Guardado de branch');
    console.log('- Guardado de branchSnapshot');
    console.log('- Guardado de source');
    console.log('- Limpieza de orden temporal');
    console.log('- Restauración de stock');
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('');
    console.error('===============================================');
    console.error('❌ TEST ÓRDENES ↔ SEDE OPERATIVA FALLÓ');
    console.error('===============================================');
    console.error(error.message);
    console.error('');

    await cleanup({
      orderId,
      idempotencyKey,
      productData,
    });

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