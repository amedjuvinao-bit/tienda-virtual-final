// backend/scripts/testOrdersAdminBranchFilter.js

try {
  require('dotenv').config();
} catch {
  // dotenv puede no estar instalado en algunos entornos
}

const mongoose = require('mongoose');

const Order = require('../models/Order');
const Product = require('../models/Product');
const Branch = require('../models/Branch');
const IdempotencyKey = require('../models/IdempotencyKey');

const BASE_URL = process.env.ORDERS_ADMIN_BRANCH_TEST_BASE_URL || 'http://localhost:5000';

const MONGO_URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  process.env.DB_URI ||
  process.env.ATLAS_URI ||
  '';

function cleanToken(value) {
  return String(value || '')
    .trim()
    .replace(/^Bearer\s+/i, '')
    .replace(/^"|"$/g, '')
    .replace(/^'|'$/g, '')
    .trim();
}

const ADMIN_TOKEN = cleanToken(
  process.env.ORDERS_ADMIN_BRANCH_TEST_TOKEN ||
    process.env.ADMIN_USERS_BRANCH_TEST_TOKEN ||
    process.env.ADMIN_BRANCH_TEST_TOKEN ||
    process.env.ADMIN_GATE_TEST_TOKEN ||
    process.argv[2]
);

const TEST_DELAY_MS = Number(process.env.ORDERS_ADMIN_BRANCH_TEST_DELAY_MS || 250);

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

function assertToken() {
  if (!ADMIN_TOKEN) {
    console.error('');
    console.error('❌ Falta token admin.');
    console.error('');
    console.error('Usa una de estas opciones:');
    console.error('');
    console.error('set "ORDERS_ADMIN_BRANCH_TEST_TOKEN=TU_TOKEN"');
    console.error('node scripts/testOrdersAdminBranchFilter.js');
    console.error('');
    console.error('O reutiliza el token anterior:');
    console.error('');
    console.error('set "ADMIN_BRANCH_TEST_TOKEN=TU_TOKEN"');
    console.error('node scripts/testOrdersAdminBranchFilter.js');
    console.error('');
    process.exit(1);
  }
}

function buildUniqueKey() {
  return Date.now().toString(36).toLowerCase();
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getOrderId(order) {
  return String(order?._id || order?.id || '');
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

async function adminRequest(method, path, body = null) {
  return request(method, path, body, {
    Authorization: `Bearer ${ADMIN_TOKEN}`,
  });
}

function getOrdersFromAdminResponse(responseData) {
  if (Array.isArray(responseData?.data)) return responseData.data;
  if (Array.isArray(responseData?.orders)) return responseData.orders;
  if (Array.isArray(responseData?.items)) return responseData.items;
  if (Array.isArray(responseData)) return responseData;

  return [];
}

function containsOrder(responseData, orderId) {
  const orders = getOrdersFromAdminResponse(responseData);

  return orders.some((order) => getOrderId(order) === String(orderId));
}

async function findBranchesForTest() {
  const branches = await Branch.find({
    deletedAt: null,
    active: true,
    status: 'active',
  })
    .sort({ isDefaultForOnlineOrders: -1, isMain: -1, createdAt: 1 })
    .lean();

  if (!branches.length) {
    throw new Error('No hay sedes activas disponibles para la prueba.');
  }

  const mainBranch =
    branches.find((branch) => branch.isDefaultForOnlineOrders) ||
    branches.find((branch) => branch.isMain) ||
    branches[0];

  const otherBranch = branches.find(
    (branch) => String(branch._id) !== String(mainBranch._id)
  );

  return {
    mainBranch,
    otherBranch: otherBranch || null,
    branches,
  };
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

function buildOrderPayload({ branch, product, variant, unique }) {
  const price = getProductPrice(product);

  return {
    sessionId: `sess_orders_admin_branch_${unique}`,

    branch: String(branch._id),
    branchId: String(branch._id),
    source: 'online',

    cart: [
      {
        productId: String(product._id),
        title: String(product.title || 'Producto prueba filtro sede'),
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
      lastname: 'Filtro Sede',
      id: `CC-${unique}`,
      emailOrPhone: `cliente-filtro-${unique}@test.local`,
      email: `cliente-filtro-${unique}@test.local`,
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
      lastname: 'Filtro Sede',
      id: `CC-${unique}`,
      address: 'Dirección de prueba',
      city: 'Ciénaga',
      department: 'Magdalena',
      country: 'Colombia',
      phone: '3000000000',
      extra: '',
    },

    tags: ['prueba-filtro-sede'],
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
  assertToken();

  console.log('');
  console.log('🧪 Test automático de Listado Admin de Órdenes por Sede');
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
    console.log('2️⃣ Buscando sedes activas...');
    const { mainBranch, otherBranch, branches } = await findBranchesForTest();

    console.log(`✅ Sedes activas: ${branches.length}`);
    console.log(`✅ Sede de prueba: ${mainBranch.name} (${mainBranch.code})`);

    if (otherBranch) {
      console.log(`✅ Sede diferente para control negativo: ${otherBranch.name} (${otherBranch.code})`);
    } else {
      console.log('⚠️ Solo hay una sede activa. Se omitirá la prueba con sede diferente.');
    }

    console.log('');
    console.log('3️⃣ Buscando producto activo con stock...');
    productData = await findProductForTest();

    console.log(
      `✅ Producto seleccionado: ${productData.product.title} (${productData.product._id})`
    );

    const unique = buildUniqueKey();
    idempotencyKey = `orders-admin-branch-filter-test-${unique}`;

    const payload = buildOrderPayload({
      branch: mainBranch,
      product: productData.product,
      variant: productData.variant,
      unique,
    });

    console.log('');
    console.log('4️⃣ Creando orden temporal con sede...');
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

    console.log(`✅ Orden temporal creada: ${orderId}`);
    console.log(`✅ Número de orden: ${createdResponse.data?.orderNumber || 'N/A'}`);

    console.log('');
    console.log('5️⃣ Consultando listado admin sin filtro de sede...');
    const adminAllResponse = await adminRequest(
      'GET',
      `/api/orders/admin?limit=100&q=${encodeURIComponent(createdResponse.data?.orderNumber || '')}`
    );

    if (adminAllResponse.status !== 200) {
      throw new Error(
        `GET /api/orders/admin falló con estado ${adminAllResponse.status}: ${JSON.stringify(
          adminAllResponse.data
        )}`
      );
    }

    if (!containsOrder(adminAllResponse.data, orderId)) {
      throw new Error('La orden temporal no apareció en el listado admin sin filtro.');
    }

    console.log('✅ La orden aparece en listado admin sin filtro.');

    console.log('');
    console.log('6️⃣ Consultando listado admin con branchId correcto...');
    const adminCorrectBranchResponse = await adminRequest(
      'GET',
      `/api/orders/admin?limit=100&branchId=${mainBranch._id}&q=${encodeURIComponent(
        createdResponse.data?.orderNumber || ''
      )}`
    );

    if (adminCorrectBranchResponse.status !== 200) {
      throw new Error(
        `GET /api/orders/admin?branchId correcto falló con estado ${adminCorrectBranchResponse.status}: ${JSON.stringify(
          adminCorrectBranchResponse.data
        )}`
      );
    }

    if (!containsOrder(adminCorrectBranchResponse.data, orderId)) {
      throw new Error('La orden temporal no apareció con el branchId correcto.');
    }

    console.log('✅ La orden aparece cuando el branchId coincide.');

    if (otherBranch) {
      console.log('');
      console.log('7️⃣ Consultando listado admin con branchId de otra sede...');
      const adminWrongBranchResponse = await adminRequest(
        'GET',
        `/api/orders/admin?limit=100&branchId=${otherBranch._id}&q=${encodeURIComponent(
          createdResponse.data?.orderNumber || ''
        )}`
      );

      if (adminWrongBranchResponse.status !== 200) {
        throw new Error(
          `GET /api/orders/admin?branchId diferente falló con estado ${adminWrongBranchResponse.status}: ${JSON.stringify(
            adminWrongBranchResponse.data
          )}`
        );
      }

      if (containsOrder(adminWrongBranchResponse.data, orderId)) {
        throw new Error('La orden temporal apareció con una sede diferente. El filtro branchId no está funcionando.');
      }

      console.log('✅ La orden NO aparece cuando el branchId es de otra sede.');
    }

    console.log('');
    console.log('8️⃣ Validando resumen financiero con filtro de sede...');
    const financialSummary = adminCorrectBranchResponse.data?.financialSummary || {};

    if (Number(financialSummary.totalOrders || 0) < 1) {
      throw new Error('El financialSummary no reflejó la orden filtrada por sede.');
    }

    console.log('✅ El resumen financiero responde al filtro por sede.');

    console.log('');
    console.log('9️⃣ Limpiando datos temporales...');
    await cleanup({
      orderId,
      idempotencyKey,
      productData,
    });

    console.log('');
    console.log('===============================================');
    console.log('✅ TEST LISTADO ADMIN ÓRDENES POR SEDE APROBADO');
    console.log('===============================================');
    console.log('');
    console.log('Validado:');
    console.log('- Creación de orden temporal con sede');
    console.log('- Listado admin sin filtro');
    console.log('- Listado admin con branchId correcto');
    console.log('- Listado admin con branchId diferente');
    console.log('- Resumen financiero filtrado por sede');
    console.log('- Limpieza de orden temporal');
    console.log('- Restauración de stock');
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('');
    console.error('===============================================');
    console.error('❌ TEST LISTADO ADMIN ÓRDENES POR SEDE FALLÓ');
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