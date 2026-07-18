// backend/scripts/testOrdersAdminModule.js
/* eslint-disable no-console */

/**
 * Prueba general del modulo Ordenes / seguimiento administrativo.
 *
 * Ejecutar desde backend:
 * npm run test:orders-admin
 *
 * Esta prueba trabaja directo contra MongoDB para no depender de interfaz.
 * Crea una orden POS temporal, valida filtros/acciones principales y al final
 * elimina la orden, notas y eventos de prueba.
 */

require('dotenv').config({
  path: require('path').join(__dirname, '..', '.env'),
  quiet: true,
});

const mongoose = require('mongoose');
const Order = require('../models/Order');
const Branch = require('../models/Branch');
const Product = require('../models/Product');

const TEST_TAG = '__test_orders_admin_module__';
const RUN_ID = Date.now().toString(36).toUpperCase();
const KEEP_DATA = String(process.env.ORDERS_TEST_KEEP_DATA || 'false').toLowerCase() === 'true';

const state = { passed: 0, warnings: 0, failed: 0 };

function title(text) {
  console.log(`\n=== ${text} ===`);
}

function pass(message) {
  state.passed += 1;
  console.log(`OK   ${message}`);
}

function warn(message) {
  state.warnings += 1;
  console.warn(`WARN ${message}`);
}

function fail(message, error = null) {
  state.failed += 1;
  console.error(`FAIL ${message}`);
  if (error?.message) console.error(`     ${error.message}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function money(value) {
  return Math.max(0, Math.round(Number(value || 0)));
}

async function connectDb() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI no esta configurado en backend/.env');
  }

  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.MONGODB_URI);
  }
}

async function cleanup() {
  if (KEEP_DATA) {
    warn('ORDERS_TEST_KEEP_DATA=true. No se eliminan datos de prueba.');
    return;
  }

  const orders = await Order.find({ tags: TEST_TAG }).select('_id').lean();
  const ids = orders.map((order) => order._id);

  if (ids.length) {
    await mongoose.connection.collection('order_events').deleteMany({ orderId: { $in: ids } });
    await mongoose.connection.collection('order_notes').deleteMany({ orderId: { $in: ids } });
    await Order.deleteMany({ _id: { $in: ids } });
    console.log(`Limpieza: ${ids.length} orden(es) de prueba eliminada(s).`);
  }
}

function branchSnapshot(branch) {
  return {
    name: String(branch?.name || 'Sede Principal').trim(),
    code: String(branch?.code || 'MAIN').trim().toUpperCase(),
    type: String(branch?.type || 'store').trim().toLowerCase(),
  };
}

function productInfo(product) {
  return {
    id: product?._id ? String(product._id) : '',
    title: String(product?.title || product?.name || 'Producto prueba ordenes').trim(),
    sku: String(product?.sku || `ORD-${RUN_ID}`).trim().toUpperCase(),
    price: money(product?.price || 50000),
    image: String(product?.image || ''),
  };
}

async function createTestOrder() {
  const branch = await Branch.findOne({
    deletedAt: null,
    active: { $ne: false },
    status: 'active',
  }).lean();

  assert(branch, 'No existe una sede activa para probar ordenes.');

  const product = await Product.findOne({
    active: { $ne: false },
    visible: { $ne: false },
  }).lean();

  if (!product) warn('No se encontro producto activo. Se usara item snapshot sin producto real.');

  const p = productInfo(product);
  const qty = 1;
  const price = p.price;
  const subtotal = qty * price;
  const orderNumber = `TST-${RUN_ID}`;
  const document = `99${String(Date.now()).slice(-8)}`;
  const phone = `300${String(Date.now()).slice(-7)}`;
  const email = `orden.${RUN_ID.toLowerCase()}@example.com`;

  const item = {
    ...(p.id ? { product: p.id, productId: p.id } : { productId: `test-product-${RUN_ID}` }),
    title: p.title,
    image: p.image,
    color: 'royalblue',
    size: '4',
    qty,
    quantity: qty,
    price,
    unitPrice: price,
    priceNumber: price,
  };

  const order = await Order.create({
    sessionId: `test_orders_${RUN_ID}`,
    orderNumber,
    status: 'paid',
    fulfillmentStatus: 'delivered',
    source: 'pos',
    channel: 'physical_store',
    saleType: 'pos_sale',
    branch: branch._id,
    branchSnapshot: branchSnapshot(branch),
    pos: {
      saleNumber: `POS-${orderNumber}`,
      receiptNumber: `REC-${orderNumber}`,
      terminalId: 'terminal-test',
      registerCode: 'TEST',
      shiftCode: 'TEST',
      customerMode: 'identified',
      quickSale: false,
      notes: 'Orden temporal creada por prueba automatica.',
      confirmedAt: new Date(),
    },
    cart: [{ productId: item.productId, title: item.title, image: item.image, color: item.color, size: item.size, quantity: qty, price }],
    items: [item],
    summary: { itemsCount: 1, totalItems: qty, subtotal },
    subtotal,
    shipping: 0,
    total: subtotal,
    customer: {
      name: `Cliente Orden ${RUN_ID}`,
      lastname: 'Prueba',
      id: document,
      documentType: 'CC',
      emailOrPhone: email,
      email,
      phone,
      address: 'Direccion prueba ordenes',
      city: 'Zona Bananera',
      department: 'Magdalena',
      country: 'CO',
    },
    billing: {
      useSameAddress: true,
      name: `Cliente Orden ${RUN_ID}`,
      lastname: 'Prueba',
      id: document,
      documentType: 'CC',
      email,
      phone,
      address: 'Direccion prueba ordenes',
      city: 'Zona Bananera',
      department: 'Magdalena',
      country: 'CO',
    },
    payment: {
      active: true,
      provider: 'pos',
      providerLabel: 'Venta fisica',
      mode: 'production',
      currency: 'COP',
      checkoutLabel: 'Pago en tienda fisica',
      enableWebhook: false,
      status: 'paid',
      methodType: 'cash',
      method: 'cash',
      methodLabel: 'Efectivo',
      amount: subtotal,
      amountInCents: subtotal * 100,
      paidAt: new Date(),
      receivedAmount: subtotal,
      changeAmount: 0,
    },
    inventoryControl: {
      discountedAtCheckout: true,
      restockedOnFailure: false,
      restockedAt: null,
    },
    tags: [TEST_TAG, 'pos', 'venta fisica'],
  });

  console.log(`Orden prueba: ${order.orderNumber} | ${order._id}`);
  console.log(`Sede prueba: ${branch.name || branch.code || branch._id}`);

  return { order, branch };
}

function buildAdminFilter({ q = '', status = '', branchId = '', tags = [] } = {}) {
  const filter = {};

  if (q) {
    const rx = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [
      { orderNumber: rx },
      { 'customer.name': rx },
      { 'customer.email': rx },
      { 'customer.phone': rx },
      { 'customer.id': rx },
      { 'branchSnapshot.name': rx },
      { 'branchSnapshot.code': rx },
    ];
  }

  if (status) filter.status = status;
  if (branchId) filter.branch = new mongoose.Types.ObjectId(branchId);
  if (tags.length) filter.tags = { $all: tags };

  return filter;
}

function csvForOrders(orders = []) {
  const rows = [[
    'orderNumber', '_id', 'customerName', 'customerEmailOrPhone', 'itemsCount', 'totalItems', 'subtotal', 'total', 'status', 'tags', 'createdAt', 'updatedAt',
  ].join(',')];

  orders.forEach((order) => {
    const items = Array.isArray(order.items) ? order.items : [];
    const totalItems = items.reduce((sum, item) => sum + Number(item.quantity || item.qty || 0), 0);
    const customer = order.customer || {};
    rows.push([
      JSON.stringify(order.orderNumber || ''),
      JSON.stringify(String(order._id || '')),
      JSON.stringify([customer.name, customer.lastname].filter(Boolean).join(' ').trim()),
      JSON.stringify(customer.emailOrPhone || customer.email || ''),
      String(items.length),
      String(totalItems),
      String(order.subtotal || 0),
      String(order.total || 0),
      JSON.stringify(order.status || ''),
      JSON.stringify(Array.isArray(order.tags) ? order.tags.join('|') : ''),
      JSON.stringify(order.createdAt || ''),
      JSON.stringify(order.updatedAt || ''),
    ].join(','));
  });

  return rows.join('\n');
}

async function step(name, fn) {
  try {
    await fn();
    pass(name);
  } catch (error) {
    fail(name, error);
  }
}

async function main() {
  title('Prueba general Ordenes Administrativas');
  console.log(`Run ID: ${RUN_ID}`);

  await connectDb();
  await cleanup();

  const { order, branch } = await createTestOrder();
  const orderId = String(order._id);
  const branchId = String(branch._id);
  const orderNumber = order.orderNumber;

  await step('Listar ordenes admin', async () => {
    const rows = await Order.find({}).sort({ createdAt: -1 }).limit(10).lean();
    assert(Array.isArray(rows), 'La consulta no devolvio arreglo');
    assert(rows.length > 0, 'No hay ordenes para listar');
  });

  await step('Filtrar orden por busqueda', async () => {
    const rows = await Order.find(buildAdminFilter({ q: orderNumber })).lean();
    assert(rows.some((row) => String(row._id) === orderId), 'No encontro la orden por busqueda');
  });

  await step('Filtrar orden por estado', async () => {
    const rows = await Order.find(buildAdminFilter({ q: orderNumber, status: 'paid' })).lean();
    assert(rows.some((row) => String(row._id) === orderId), 'No encontro la orden pagada');
  });

  await step('Filtrar orden por sede', async () => {
    const rows = await Order.find(buildAdminFilter({ q: orderNumber, branchId })).lean();
    assert(rows.some((row) => String(row._id) === orderId), 'No encontro la orden por sede');
  });

  await step('Abrir detalle de orden', async () => {
    const detail = await Order.findById(orderId).lean();
    assert(detail, 'No encontro detalle');
    assert(Array.isArray(detail.items) && detail.items.length > 0, 'No trae items');
    assert(detail.payment?.status === 'paid', 'No trae pago pagado');
    assert(detail.customer?.name, 'No trae cliente');
  });

  await step('Validar datos POS de la orden', async () => {
    const detail = await Order.findById(orderId).lean();
    assert(detail.source === 'pos', 'source no es pos');
    assert(detail.channel === 'physical_store', 'channel no es physical_store');
    assert(detail.saleType === 'pos_sale', 'saleType no es pos_sale');
    assert(detail.pos?.receiptNumber, 'No trae recibo POS');
    assert(detail.branch || detail.branchSnapshot?.name, 'No trae sede');
  });

  await step('Cambiar estado individual', async () => {
    const updated = await Order.findByIdAndUpdate(orderId, { $set: { status: 'processing' } }, { new: true }).lean();
    await mongoose.connection.collection('order_events').insertOne({
      orderId: new mongoose.Types.ObjectId(orderId),
      type: 'status_changed',
      message: 'Estado: paid -> processing',
      meta: { from: 'paid', to: 'processing', by: 'orders-admin-test' },
      createdAt: new Date(),
    });
    assert(updated.status === 'processing', 'No cambio a processing');
  });

  await step('Marcar orden como impresa', async () => {
    const updated = await Order.findByIdAndUpdate(orderId, { $set: { printed: true } }, { new: true }).lean();
    assert(updated.printed === true, 'No marco printed=true');
  });

  await step('Archivar y desarchivar orden', async () => {
    const archived = await Order.findByIdAndUpdate(orderId, { $set: { archived: true } }, { new: true }).lean();
    assert(archived.archived === true, 'No archivo la orden');
    const restored = await Order.findByIdAndUpdate(orderId, { $set: { archived: false } }, { new: true }).lean();
    assert(restored.archived === false, 'No desarchivo la orden');
  });

  await step('Guardar tags individuales', async () => {
    const updated = await Order.findByIdAndUpdate(
      orderId,
      { $set: { tags: [TEST_TAG, 'pos', 'seguimiento', 'prioridad'] } },
      { new: true }
    ).lean();
    assert(updated.tags.includes('seguimiento'), 'No guardo tag seguimiento');
  });

  await step('Crear nota interna', async () => {
    const result = await mongoose.connection.collection('order_notes').insertOne({
      orderId: new mongoose.Types.ObjectId(orderId),
      text: `Nota de prueba modulo ordenes ${RUN_ID}`,
      author: { name: 'orders-admin-test', id: 'script' },
      pinned: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    assert(result.insertedId, 'No creo nota');
  });

  await step('Consultar notas internas', async () => {
    const rows = await mongoose.connection.collection('order_notes').find({ orderId: new mongoose.Types.ObjectId(orderId) }).toArray();
    assert(rows.some((note) => String(note.text || '').includes(RUN_ID)), 'No encontro nota creada');
  });

  await step('Consultar timeline', async () => {
    const rows = await mongoose.connection.collection('order_events').find({ orderId: new mongoose.Types.ObjectId(orderId) }).toArray();
    assert(rows.length > 0, 'Timeline esta vacio');
  });

  await step('Accion masiva agregar tag', async () => {
    const result = await Order.updateMany({ _id: orderId }, { $addToSet: { tags: { $each: ['bulk-test'] } } });
    assert(result.modifiedCount >= 0, 'No ejecuto bulk add');
    const updated = await Order.findById(orderId).lean();
    assert(updated.tags.includes('bulk-test'), 'No agrego bulk-test');
  });

  await step('Accion masiva quitar tag', async () => {
    await Order.updateMany({ _id: orderId }, { $pull: { tags: { $in: ['bulk-test'] } } });
    const updated = await Order.findById(orderId).lean();
    assert(!updated.tags.includes('bulk-test'), 'No retiro bulk-test');
  });

  await step('Accion masiva cambiar estado', async () => {
    await Order.updateMany({ _id: orderId }, { $set: { status: 'paid' } });
    const updated = await Order.findById(orderId).lean();
    assert(updated.status === 'paid', 'No cambio estado a paid');
  });

  await step('Exportar CSV filtrado', async () => {
    const rows = await Order.find(buildAdminFilter({ q: orderNumber })).lean();
    const csv = csvForOrders(rows);
    assert(csv.includes(orderNumber), 'CSV no contiene orden de prueba');
    assert(csv.includes('orderNumber'), 'CSV no contiene encabezado');
  });

  await step('Exportar seleccionadas CSV', async () => {
    const rows = await Order.find({ _id: orderId }).lean();
    const csv = csvForOrders(rows);
    assert(csv.includes(orderNumber), 'CSV seleccionadas no contiene orden de prueba');
    assert(csv.includes('tags'), 'CSV seleccionadas no contiene encabezado tags');
  });

  await step('Validar persistencia final de la orden', async () => {
    const finalOrder = await Order.findById(orderId).lean();
    assert(finalOrder.status === 'paid', 'La orden no quedo pagada');
    assert(finalOrder.printed === true, 'La orden no conserva impresa');
    assert(finalOrder.archived === false, 'La orden debe quedar desarchivada');
  });

  await cleanup();

  title('Resultado final');
  console.log(`OK: ${state.passed}`);
  console.log(`WARN: ${state.warnings}`);
  console.log(`FAIL: ${state.failed}`);

  if (state.failed > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    fail('Error general de la prueba de ordenes', error);
    title('Resultado final');
    console.log(`OK: ${state.passed}`);
    console.log(`WARN: ${state.warnings}`);
    console.log(`FAIL: ${state.failed}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      if (!KEEP_DATA) await cleanup();
    } catch (error) {
      console.error('Error en limpieza final:', error.message);
    }

    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });
