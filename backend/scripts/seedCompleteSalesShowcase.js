/* eslint-disable no-console */

'use strict';

/**
 * Escenario demostrativo permanente de Productos + Inventario + Órdenes +
 * Wompi sandbox + Factus habilitación.
 *
 * Seguridad:
 * - Nunca ejecuta pagos reales: envía al backend un webhook Wompi firmado
 *   localmente y exige que la pasarela esté en modo sandbox.
 * - Nunca factura en producción: exige Factus + DIAN en habilitación y valida
 *   la URL oficial del sandbox antes de crear cualquier registro.
 * - Es idempotente: reutiliza las mismas sesiones, órdenes y facturas.
 * - No elimina registros al terminar.
 */

const crypto = require('crypto');
const path = require('path');
const { spawnSync } = require('child_process');

require('dotenv').config({
  path: path.join(__dirname, '..', '.env'),
  quiet: true,
});

const express = require('express');
const mongoose = require('mongoose');

const Product = require('../models/Product');
const Branch = require('../models/Branch');
const InventoryStock = require('../models/InventoryStock');
const InventoryMovement = require('../models/InventoryMovement');
const InventoryReservation = require('../models/InventoryReservation');
const Order = require('../models/Order');
const ElectronicInvoice = require('../models/ElectronicInvoice');
const SiteSettings = require('../models/SiteSettings');
const {
  buildVariantKey,
} = require('../lib/products/productVariantConfig');
const {
  FACTUS_API_URLS,
  buildRuntimeFactusConfig,
} = require('../lib/billing/billingConfigurationSecurity');
const {
  saveProductWithInventoryTransaction,
} = require('../services/productInventoryPersistenceService');
const {
  createInventoryMovement,
} = require('../services/inventoryService');
const {
  transitionOrderStatus,
} = require('../services/orderStatusTransitionService');
const {
  createElectronicInvoiceIssuanceService,
} = require('../services/electronicInvoiceIssuanceService');

const CONFIRMATION_FLAG = '--confirm-habilitacion';
const VALIDATE_PLAN_ONLY = process.argv.includes('--validate-plan');
const SEED_TAG = 'seed-complete-sales-showcase-v1';
const DEMO_ORDER_TAGS = [
  'demo',
  'wompi sandbox',
  'factus habilitacion',
  'venta integral',
];
const ADVANCED_PRODUCT_SKU = 'DEMO-VENTA-SMARTPHONE-4EJES';
const HYBRID_BUNDLE_SKU = 'DEMO-COM-CREADOR';
const SECONDARY_BRANCH_CODE = 'DEMO-BODEGA-VENTAS';
const PHYSICAL_SESSION_ID = 'DEMO-SALE-PHYSICAL-WOMPI-FACTUS-V1';
const HYBRID_SESSION_ID = 'DEMO-SALE-HYBRID-WOMPI-FACTUS-V1';
const CUSTOMER_EMAIL = 'facturacion.demo@example.com';

const PHYSICAL_ATTRIBUTES = [
  { key: 'capacidad', label: 'Capacidad', value: '256GB' },
  { key: 'ram', label: 'RAM', value: '12GB' },
  { key: 'color', label: 'Color', value: 'Azul' },
  { key: 'conectividad', label: 'Conectividad', value: '5G' },
];
const PHYSICAL_VARIANT_KEY = buildVariantKey(
  '',
  'Azul',
  PHYSICAL_ATTRIBUTES
);

const ALTERNATE_ATTRIBUTES = [
  { key: 'capacidad', label: 'Capacidad', value: '512GB' },
  { key: 'ram', label: 'RAM', value: '16GB' },
  { key: 'color', label: 'Color', value: 'Negro' },
  {
    key: 'conectividad',
    label: 'Conectividad',
    value: 'eSIM + 5G',
  },
];
const ALTERNATE_VARIANT_KEY = buildVariantKey(
  '',
  'Negro',
  ALTERNATE_ATTRIBUTES
);

const DEMO_SALES = [
  {
    key: 'physical',
    sessionId: PHYSICAL_SESSION_ID,
    idempotencyKey: `${PHYSICAL_SESSION_ID}-CHECKOUT`,
    quantity: 3,
    expectedBranchCount: 2,
    delivered: true,
  },
  {
    key: 'hybrid',
    sessionId: HYBRID_SESSION_ID,
    idempotencyKey: `${HYBRID_SESSION_ID}-CHECKOUT`,
    quantity: 1,
    expectedBranchCount: 1,
    delivered: false,
  },
];

let server = null;

function assert(condition, message, code = 'DEMO_SHOWCASE_ASSERTION_FAILED') {
  if (condition) return;
  const error = new Error(message);
  error.code = code;
  throw error;
}

function cleanText(value, max = 300) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function money(value) {
  return Number(value || 0).toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  });
}

function getNestedValue(value, pathValue) {
  return String(pathValue || '')
    .split('.')
    .filter(Boolean)
    .reduce((current, key) => current?.[key], value);
}

function buildWompiEventChecksum(payload, secret) {
  const properties = Array.isArray(payload?.signature?.properties)
    ? payload.signature.properties
    : [];
  const values = properties
    .map((property) => getNestedValue(payload?.data || {}, property))
    .map((value) =>
      value === null || value === undefined ? '' : String(value)
    )
    .join('');
  const raw = `${values}${String(payload?.timestamp || '')}${secret}`;

  return crypto.createHash('sha256').update(raw).digest('hex');
}

function buildWompiPayload({ order, webhookSecret }) {
  const transactionId = `DEMO-WOMPI-${order.orderNumber}`;
  const payload = {
    event: 'transaction.updated',
    timestamp: Date.now(),
    data: {
      transaction: {
        id: transactionId,
        status: 'APPROVED',
        reference: `ORDER-${order.orderNumber}__TRY__DEMO-SANDBOX`,
        amount_in_cents: Math.round(Number(order.total || 0) * 100),
        currency: 'COP',
        payment_method_type: 'CARD',
        payment_method: {
          type: 'CARD',
          extra: {
            brand: 'VISA',
            last_four: '4242',
          },
        },
        created_at: new Date().toISOString(),
        finalized_at: new Date().toISOString(),
      },
    },
    signature: {
      properties: [
        'transaction.id',
        'transaction.status',
        'transaction.reference',
        'transaction.amount_in_cents',
      ],
      checksum: '',
    },
  };

  payload.signature.checksum = buildWompiEventChecksum(
    payload,
    webhookSecret
  );

  return payload;
}

async function requestJson(
  baseUrl,
  routePath,
  { method = 'GET', headers = {}, body } = {}
) {
  const response = await fetch(`${baseUrl}${routePath}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  const text = await response.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  return {
    status: response.status,
    ok: response.ok,
    data,
  };
}

async function waitFor(work, message, timeoutMs = 120_000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const value = await work();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(message);
}

function assertExecutionPlan() {
  assert(
    process.argv.includes(CONFIRMATION_FLAG),
    `Falta la confirmación de seguridad ${CONFIRMATION_FLAG}.`,
    'DEMO_SHOWCASE_CONFIRMATION_REQUIRED'
  );
  assert(DEMO_SALES.length === 2, 'El plan debe contener exactamente 2 ventas.');
  assert(
    PHYSICAL_ATTRIBUTES.length === 4 &&
      ALTERNATE_ATTRIBUTES.length === 4,
    'El producto demostrativo debe conservar cuatro atributos por variante.'
  );
  assert(
    DEMO_SALES[0].quantity === 3 &&
      DEMO_SALES[0].expectedBranchCount === 2,
    'La venta física debe reservar tres unidades entre dos sedes.'
  );
  assert(
    DEMO_ORDER_TAGS.includes('wompi sandbox') &&
      DEMO_ORDER_TAGS.includes('factus habilitacion'),
    'Las ventas deben quedar identificadas por pasarela y ambiente fiscal.'
  );

  console.log('\nPLAN DEMOSTRATIVO VALIDADO');
  console.log('  Productos permanentes: catálogo DEMO + smartphone de 4 atributos');
  console.log('  Ventas permanentes: 2');
  console.log('  Pago: webhook Wompi firmado en sandbox, sin cobro real');
  console.log('  Facturación: Factus habilitación únicamente');
  console.log('  Inventario: reserva multisede 2 + 1');
  console.log('  Cumplimiento: físico + digital + servicio + combo');
  console.log('  Limpieza automática: desactivada');
}

async function connectDatabase() {
  assert(
    process.env.MONGODB_URI,
    'MONGODB_URI no está configurado en backend/.env.',
    'DEMO_SHOWCASE_MONGODB_URI_MISSING'
  );

  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 20_000,
      socketTimeoutMS: 120_000,
    });
  }

  console.log(`OK  MongoDB conectado: ${mongoose.connection.name}`);
}

async function loadAndAssertSafeSettings() {
  const settings = await SiteSettings.findOne().lean();
  assert(
    settings,
    'No existe SiteSettings. Configura primero Wompi y Factus.',
    'DEMO_SHOWCASE_SETTINGS_MISSING'
  );

  const payments = settings?.theme?.global?.payments || {};
  const wompi = payments?.credentials?.wompi || {};
  const billing = settings?.billing || {};
  const runtime = buildRuntimeFactusConfig(billing);
  const paymentProvider = cleanText(payments.provider, 40).toLowerCase();
  const paymentMode = cleanText(payments.mode, 30).toLowerCase();
  const billingMode = cleanText(billing?.dian?.mode, 40).toLowerCase();
  const billingProvider = cleanText(
    billing?.electronicProvider?.provider,
    40
  ).toLowerCase();

  assert(
    process.argv.includes(CONFIRMATION_FLAG),
    `Falta la confirmación de seguridad ${CONFIRMATION_FLAG}.`,
    'DEMO_SHOWCASE_CONFIRMATION_REQUIRED'
  );
  assert(
    payments.active !== false &&
      paymentProvider === 'wompi' &&
      paymentMode === 'sandbox',
    'La demostración exige Wompi activo en modo sandbox.',
    'DEMO_SHOWCASE_WOMPI_PRODUCTION_BLOCKED'
  );
  assert(
    cleanText(wompi.webhookSecret, 300),
    'Wompi sandbox no tiene webhook secret configurado.',
    'DEMO_SHOWCASE_WOMPI_SECRET_MISSING'
  );
  assert(
    billing?.dian?.enabled === true &&
      billingMode === 'habilitacion' &&
      billingProvider === 'factus',
    'La demostración exige Factus activo en modo habilitación.',
    'DEMO_SHOWCASE_FACTUS_INACTIVE'
  );
  assert(
    runtime.environment === 'habilitacion' &&
      runtime.apiUrl === FACTUS_API_URLS.habilitacion &&
      runtime.apiUrl !== FACTUS_API_URLS.production,
    'Se bloqueó la ejecución porque Factus no apunta exclusivamente a habilitación.',
    'DEMO_SHOWCASE_FACTUS_PRODUCTION_BLOCKED'
  );
  assert(
    Number(runtime.numberingRangeId || 0) > 0,
    'Selecciona un rango de numeración de habilitación antes de ejecutar.',
    'DEMO_SHOWCASE_FACTUS_RANGE_MISSING'
  );

  console.log('OK  Seguridad: Wompi sandbox, sin cobro real');
  console.log(
    `OK  Seguridad: Factus ${runtime.environment}, rango ${runtime.numberingRangeId}`
  );

  return {
    settings,
    payments,
    webhookSecret: cleanText(wompi.webhookSecret, 300),
    runtime,
  };
}

function runPermanentCatalogSeed() {
  const seedPath = path.join(__dirname, 'seedDemonstrationProducts.js');
  const result = spawnSync(process.execPath, [seedPath], {
    cwd: path.join(__dirname, '..'),
    env: process.env,
    encoding: 'utf8',
    stdio: 'inherit',
  });

  assert(
    result.status === 0,
    'El catálogo demostrativo no pudo prepararse.',
    'DEMO_SHOWCASE_CATALOG_FAILED'
  );
}

async function ensureBranches() {
  let primary = await Branch.findOne({
    deletedAt: null,
    active: true,
    status: 'active',
  })
    .sort({
      isDefaultForOnlineOrders: -1,
      isMain: -1,
      createdAt: 1,
    })
    .exec();

  if (!primary) {
    primary = await Branch.create({
      name: 'Sede Principal',
      code: 'SEDE-PRINCIPAL',
      type: 'store',
      status: 'active',
      active: true,
      isMain: true,
      isDefaultForOnlineOrders: true,
      notes: `Creada por ${SEED_TAG}`,
    });
  }

  let secondary = await Branch.findOne({
    code: SECONDARY_BRANCH_CODE,
    deletedAt: null,
  });

  if (!secondary) {
    secondary = await Branch.create({
      name: 'DEMO Bodega de Ventas',
      code: SECONDARY_BRANCH_CODE,
      type: 'warehouse',
      status: 'active',
      active: true,
      isMain: false,
      isDefaultForOnlineOrders: false,
      notes: `Sede demostrativa permanente. ${SEED_TAG}`,
    });
  } else {
    secondary.name = 'DEMO Bodega de Ventas';
    secondary.type = 'warehouse';
    secondary.status = 'active';
    secondary.active = true;
    secondary.deletedAt = null;
    secondary.notes = `Sede demostrativa permanente. ${SEED_TAG}`;
    await secondary.save();
  }

  assert(
    String(primary._id) !== String(secondary._id),
    'La sede principal y la bodega DEMO deben ser diferentes.'
  );

  console.log(`OK  Sede principal: ${primary.name}`);
  console.log(`OK  Segunda sede: ${secondary.name}`);

  return { primary, secondary };
}

function advancedProductPayload() {
  const mainImage =
    'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=1200&q=85';
  const blueImage =
    'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?auto=format&fit=crop&w=1200&q=85';
  const blackImage =
    'https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=1200&q=85';

  return {
    sku: ADVANCED_PRODUCT_SKU,
    title: 'DEMO Smartphone Pro · 4 atributos',
    description:
      'Producto demostrativo permanente para visualizar variantes avanzadas, inventario multisede, venta Wompi y facturación electrónica Factus.',
    category: 'Tecnología',
    categories: ['Tecnología', 'Smartphones'],
    collections: ['Destacados', 'Demostración'],
    productType: 'physical',
    unitOfMeasure: 'unit',
    trackInventory: true,
    allowBackorder: false,
    variantPreset: 'tech',
    variantAxes: [
      {
        key: 'capacidad',
        label: 'Capacidad',
        values: ['256GB', '512GB'],
      },
      { key: 'ram', label: 'RAM', values: ['12GB', '16GB'] },
      { key: 'color', label: 'Color', values: ['Azul', 'Negro'] },
      {
        key: 'conectividad',
        label: 'Conectividad',
        values: ['5G', 'eSIM + 5G'],
      },
    ],
    price: 1_899_000,
    originalPrice: 2_199_000,
    cost: 1_250_000,
    averageCost: 1_250_000,
    taxRate: 19,
    taxIncluded: true,
    brand: 'DemoTech',
    supplier: {
      name: 'Proveedor demostrativo DemoTech',
      contact: 'Catálogo DEMO',
      email: 'productos.demo@example.com',
    },
    barcode: '7798111100001',
    image: mainImage,
    images: [mainImage, blueImage, blackImage],
    variants: [
      {
        variantKey: PHYSICAL_VARIANT_KEY,
        label: '256GB / 12GB / Azul / 5G',
        attributes: PHYSICAL_ATTRIBUTES,
        color: 'Azul',
        sku: `${ADVANCED_PRODUCT_SKU}-256-12-AZ-5G`,
        barcode: '7798111100002',
        price: 1_899_000,
        originalPrice: 2_199_000,
        cost: 1_250_000,
        image: blueImage,
        images: [blueImage, mainImage],
        initialStock: 0,
        active: true,
        sortOrder: 0,
      },
      {
        variantKey: ALTERNATE_VARIANT_KEY,
        label: '512GB / 16GB / Negro / eSIM + 5G',
        attributes: ALTERNATE_ATTRIBUTES,
        color: 'Negro',
        sku: `${ADVANCED_PRODUCT_SKU}-512-16-NE-ESIM`,
        barcode: '7798111100003',
        price: 2_499_000,
        originalPrice: 2_799_000,
        cost: 1_690_000,
        image: blackImage,
        images: [blackImage, mainImage],
        initialStock: 0,
        active: true,
        sortOrder: 1,
      },
    ],
    stock: 0,
    active: true,
    visible: true,
    featured: true,
    tags: [
      'Demostración',
      'Cuatro atributos',
      'Inventario multisede',
      'Wompi',
      'Factus',
    ],
    notes: `Producto demostrativo permanente. ${SEED_TAG}`,
    warehouseLocation: 'DEMO-MULTISEDE',
    reorderPoint: 2,
    reorderQty: 6,
    seo: {
      title: 'DEMO Smartphone Pro con cuatro atributos',
      description:
        'Ejemplo editable de variantes, inventario multisede, Wompi y Factus.',
      slug: 'demo-smartphone-pro-cuatro-atributos',
    },
  };
}

async function ensureAdvancedProduct() {
  let product = await Product.findOne({ sku: ADVANCED_PRODUCT_SKU });

  if (product) {
    assert(
      cleanText(product.notes, 500).includes(SEED_TAG),
      `El SKU ${ADVANCED_PRODUCT_SKU} ya existe y no pertenece a esta demostración.`,
      'DEMO_SHOWCASE_PRODUCT_CONFLICT'
    );
    console.log(`OK  Producto reutilizado: ${product.title}`);
    return product;
  }

  product = new Product(advancedProductPayload());
  product = await saveProductWithInventoryTransaction(product, {
    variantsAuthoritative: true,
  });
  console.log(`OK  Producto creado: ${product.title}`);
  return product;
}

async function getStock(productId, branchId, variantKey) {
  return InventoryStock.findOne({
    product: productId,
    branch: branchId,
    variantKey,
    deletedAt: null,
  }).lean();
}

async function ensureStockAtLeast({
  product,
  branch,
  variantKey,
  variantAttributes,
  color,
  target,
  reference,
}) {
  const row = await getStock(product._id, branch._id, variantKey);
  const current = Number(row?.stock || 0);

  if (current >= target) return;

  await createInventoryMovement({
    type: 'adjustment_in',
    product: product._id,
    variantKey,
    variantAttributes,
    color,
    branchTo: branch._id,
    quantity: target - current,
    reason: 'Carga permanente del escenario demostrativo de ventas',
    notes: SEED_TAG,
    reference,
  });
}

async function prepareAdvancedProductStock({
  product,
  primary,
  secondary,
}) {
  const existingPhysicalOrder = await Order.findOne({
    sessionId: PHYSICAL_SESSION_ID,
  }).lean();

  if (!existingPhysicalOrder) {
    await ensureStockAtLeast({
      product,
      branch: primary,
      variantKey: PHYSICAL_VARIANT_KEY,
      variantAttributes: PHYSICAL_ATTRIBUTES,
      color: 'Azul',
      target: 2,
      reference: 'DEMO-STOCK-PHYSICAL-PRIMARY',
    });
    await ensureStockAtLeast({
      product,
      branch: secondary,
      variantKey: PHYSICAL_VARIANT_KEY,
      variantAttributes: PHYSICAL_ATTRIBUTES,
      color: 'Azul',
      target: 2,
      reference: 'DEMO-STOCK-PHYSICAL-SECONDARY',
    });
  }

  await ensureStockAtLeast({
    product,
    branch: primary,
    variantKey: ALTERNATE_VARIANT_KEY,
    variantAttributes: ALTERNATE_ATTRIBUTES,
    color: 'Negro',
    target: 3,
    reference: 'DEMO-STOCK-ALTERNATE-PRIMARY',
  });
  await ensureStockAtLeast({
    product,
    branch: secondary,
    variantKey: ALTERNATE_VARIANT_KEY,
    variantAttributes: ALTERNATE_ATTRIBUTES,
    color: 'Negro',
    target: 2,
    reference: 'DEMO-STOCK-ALTERNATE-SECONDARY',
  });

  console.log('OK  Inventario del smartphone distribuido entre dos sedes');
}

async function startHttpServer() {
  const orderRoutes = require('../routes/orders');
  const paymentRoutes = require('../routes/payments');
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '2mb' }));
  app.use('/api/orders', orderRoutes);
  app.use('/api/payments', paymentRoutes);

  server = await new Promise((resolve, reject) => {
    const instance = app.listen(0, '127.0.0.1', () =>
      resolve(instance)
    );
    instance.once('error', reject);
  });

  const address = server.address();
  return `http://127.0.0.1:${address.port}`;
}

function customerPayload() {
  return {
    customer: {
      name: 'Cliente',
      lastname: 'Demostración',
      id: '222222222222',
      documentType: 'CC',
      emailOrPhone: CUSTOMER_EMAIL,
      email: CUSTOMER_EMAIL,
      phone: '3000000000',
      address: 'Calle 22 # 5-10',
      city: 'Santa Marta',
      municipalityId: '47001',
      country: 'Colombia',
      countryCode: 'CO',
      department: 'Magdalena',
      departmentCode: '47',
      deliveryType: 'retiro',
      wantsNewsletter: false,
      isFinalConsumer: true,
    },
    billing: {
      useSameAddress: true,
      isFinalConsumer: true,
      personType: 'natural',
      documentType: 'CC',
      documentNumber: '222222222222',
      firstName: 'Cliente',
      lastName: 'Demostración',
      email: CUSTOMER_EMAIL,
      phone: '3000000000',
      address: 'Calle 22 # 5-10',
      city: 'Santa Marta',
      municipalityCode: '47001',
      department: 'Magdalena',
      departmentCode: '47',
      country: 'Colombia',
      countryCode: 'CO',
      tributeCode: 'ZZ',
    },
  };
}

function paymentPayload() {
  return {
    active: true,
    provider: 'wompi',
    providerLabel: 'Wompi',
    mode: 'sandbox',
    currency: 'COP',
    checkoutLabel: 'Wompi Sandbox · DEMO',
    enableWebhook: true,
    status: 'pending_gateway',
  };
}

function physicalCheckoutPayload(product, primary) {
  return {
    sessionId: PHYSICAL_SESSION_ID,
    source: 'web',
    branchId: String(primary._id),
    cart: [
      {
        productId: String(product._id),
        title: product.title,
        price: 1,
        quantity: 3,
        color: 'Azul',
        variantKey: PHYSICAL_VARIANT_KEY,
        variantLabel: '256GB / 12GB / Azul / 5G',
        variantAttributes: PHYSICAL_ATTRIBUTES,
      },
    ],
    subtotal: 3,
    shipping: 0,
    total: 3,
    ...customerPayload(),
    payment: paymentPayload(),
  };
}

function hybridCheckoutPayload(bundle, primary) {
  return {
    sessionId: HYBRID_SESSION_ID,
    source: 'web',
    branchId: String(primary._id),
    cart: [
      {
        productId: String(bundle._id),
        title: bundle.title,
        price: 1,
        quantity: 1,
      },
    ],
    subtotal: 1,
    shipping: 0,
    total: 1,
    ...customerPayload(),
    payment: paymentPayload(),
  };
}

async function createOrReuseOrder({
  baseUrl,
  checkoutPayload,
  idempotencyKey,
}) {
  const response = await requestJson(baseUrl, '/api/orders', {
    method: 'POST',
    headers: {
      'Idempotency-Key': idempotencyKey,
    },
    body: checkoutPayload,
  });

  assert(
    [200, 201].includes(response.status) && response.data?._id,
    `No se pudo crear o reutilizar la orden: ${JSON.stringify(response.data)}`,
    'DEMO_SHOWCASE_ORDER_FAILED'
  );

  const order = await Order.findById(response.data._id);
  assert(order, 'La orden creada no quedó disponible en MongoDB.');

  order.tags = [...new Set([...(order.tags || []), ...DEMO_ORDER_TAGS])];
  order.timeline = Array.isArray(order.timeline) ? order.timeline : [];

  if (
    !order.timeline.some(
      (event) => event?.by === SEED_TAG
    )
  ) {
    order.timeline.push({
      type: 'system',
      message:
        'Escenario DEMO permanente: Wompi sandbox + Factus habilitación.',
      by: SEED_TAG,
      at: new Date(),
    });
  }

  await order.save();
  return order;
}

async function approveWithWompi({
  baseUrl,
  order,
  webhookSecret,
}) {
  const status = cleanText(order.status, 40).toLowerCase();
  const paymentStatus = cleanText(
    order?.payment?.status,
    40
  ).toLowerCase();

  if (
    ['paid', 'processing', 'shipped', 'delivered'].includes(status) &&
    paymentStatus === 'paid'
  ) {
    console.log(`OK  Wompi reutilizado: orden ${order.orderNumber}`);
    return {
      order,
      transaction: {
        id: order?.payment?.transactionId || `DEMO-WOMPI-${order.orderNumber}`,
        status: 'APPROVED',
        reference:
          order?.payment?.reference ||
          `ORDER-${order.orderNumber}__TRY__DEMO-SANDBOX`,
        amount_in_cents: Math.round(Number(order.total || 0) * 100),
        currency: order?.payment?.currency || 'COP',
        payment_method_type: order?.payment?.methodType || 'CARD',
        payment_method: order?.payment?.rawMethod || { type: 'CARD' },
      },
    };
  }

  assert(
    ['pending', 'processing'].includes(status),
    `La orden DEMO ${order.orderNumber} está en ${order.status} y no se modificará automáticamente.`,
    'DEMO_SHOWCASE_ORDER_STATE_CONFLICT'
  );

  const payload = buildWompiPayload({ order, webhookSecret });
  const response = await requestJson(
    baseUrl,
    '/api/payments/wompi/webhook',
    {
      method: 'POST',
      headers: {
        'X-Event-Checksum': payload.signature.checksum,
      },
      body: payload,
    }
  );

  assert(
    response.status === 200 &&
      response.data?.paymentStatus === 'paid',
    `Wompi sandbox no aprobó la orden: ${JSON.stringify(response.data)}`,
    'DEMO_SHOWCASE_WOMPI_WEBHOOK_FAILED'
  );

  const paidOrder = await Order.findById(order._id);
  console.log(
    `OK  Wompi sandbox: ${paidOrder.orderNumber} · TX ${paidOrder.payment.transactionId}`
  );

  return {
    order: paidOrder,
    transaction: payload.data.transaction,
  };
}

async function ensureFactusInvoice({
  order,
  transaction,
  payments,
}) {
  const service = createElectronicInvoiceIssuanceService();

  await new Promise((resolve) => setTimeout(resolve, 600));

  const result = await service.issueElectronicInvoiceForOrder({
    orderId: order._id,
    source: 'demo-showcase',
    initiatedBy: SEED_TAG,
    transaction,
    payments,
    skipWhenElectronicBillingIsInactive: false,
    allowRetry: true,
  });

  let invoice = result?.invoice || null;

  if (
    result?.inProgress === true ||
    ['processing', ''].includes(cleanText(invoice?.status, 40).toLowerCase())
  ) {
    invoice = await waitFor(
      async () => {
        const current = await ElectronicInvoice.findOne({
          orderId: order._id,
        }).lean();
        const status = cleanText(current?.status, 40).toLowerCase();
        return current &&
          ['accepted', 'sent', 'generated', 'failed', 'rejected', 'error'].includes(
            status
          )
          ? current
          : null;
      },
      `Factus no terminó la factura de la orden ${order.orderNumber}.`
    );
  }

  const invoiceStatus = cleanText(invoice?.status, 40).toLowerCase();
  assert(
    invoice &&
      ['accepted', 'sent'].includes(invoiceStatus) &&
      invoice.invoiceNumber,
    `La factura de ${order.orderNumber} terminó en ${invoiceStatus || 'sin estado'}: ${
      invoice?.errorMessage || result?.message || 'sin detalle'
    }`,
    'DEMO_SHOWCASE_FACTUS_INVOICE_FAILED'
  );

  console.log(
    `OK  Factus: ${order.orderNumber} -> ${invoice.invoiceNumber} (${invoice.status})`
  );
  return invoice;
}

async function ensureDelivered(order) {
  let current = await Order.findById(order._id);

  if (cleanText(current.status, 40).toLowerCase() === 'delivered') {
    return current;
  }

  if (
    ['paid', 'processing'].includes(
      cleanText(current.status, 40).toLowerCase()
    )
  ) {
    await transitionOrderStatus({
      orderId: current._id,
      status: 'shipped',
      actor: {
        label: 'Escenario DEMO',
        source: SEED_TAG,
      },
    });
  }

  current = await Order.findById(current._id);

  if (cleanText(current.status, 40).toLowerCase() === 'shipped') {
    await transitionOrderStatus({
      orderId: current._id,
      status: 'delivered',
      actor: {
        label: 'Escenario DEMO',
        source: SEED_TAG,
      },
    });
  }

  return Order.findById(current._id);
}

function summarizeAllocations(order) {
  const allocations = Array.isArray(order?.inventoryAllocations)
    ? order.inventoryAllocations
    : [];
  const byBranch = new Map();

  allocations.forEach((allocation) => {
    const branchName =
      allocation?.branchSnapshot?.name ||
      String(allocation?.branch || 'Sin sede');
    const current = byBranch.get(branchName) || {
      reserved: 0,
      sold: 0,
      shipped: 0,
      delivered: 0,
    };
    current.reserved += Number(allocation?.reservedQuantity || 0);
    current.sold += Number(allocation?.soldQuantity || 0);
    current.shipped += Number(allocation?.shippedQuantity || 0);
    current.delivered += Number(allocation?.deliveredQuantity || 0);
    byBranch.set(branchName, current);
  });

  return [...byBranch.entries()].map(([branch, quantities]) => ({
    branch,
    ...quantities,
  }));
}

async function runSale({
  key,
  baseUrl,
  checkoutPayload,
  idempotencyKey,
  webhookSecret,
  payments,
  delivered,
}) {
  let order = await createOrReuseOrder({
    baseUrl,
    checkoutPayload,
    idempotencyKey,
  });
  const payment = await approveWithWompi({
    baseUrl,
    order,
    webhookSecret,
  });
  order = await waitFor(
    async () => {
      const current = await Order.findById(payment.order._id);
      return current?.fulfillment?.processedAt ? current : null;
    },
    `El cumplimiento posterior al pago no terminó para ${payment.order.orderNumber}.`,
    30_000
  );

  const invoice = await ensureFactusInvoice({
    order,
    transaction: payment.transaction,
    payments,
  });

  if (delivered) {
    order = await ensureDelivered(order);
  } else {
    order = await Order.findById(order._id);
  }

  return {
    key,
    order: order.toObject(),
    invoice,
  };
}

async function validateResults({
  physical,
  hybrid,
  product,
  primary,
  secondary,
}) {
  const physicalOrder = physical.order;
  const branchCount = Number(
    physicalOrder?.inventoryAllocationSummary?.branchCount || 0
  );
  const physicalReservation = await InventoryReservation.findOne({
    order: physicalOrder._id,
  }).lean();
  const saleMovements = await InventoryMovement.find({
    order: physicalOrder._id,
    type: 'sale_out',
    status: 'posted',
  }).lean();
  const invoices = await ElectronicInvoice.find({
    orderId: {
      $in: [physical.order._id, hybrid.order._id],
    },
  }).lean();
  const primaryStock = await getStock(
    product._id,
    primary._id,
    PHYSICAL_VARIANT_KEY
  );
  const secondaryStock = await getStock(
    product._id,
    secondary._id,
    PHYSICAL_VARIANT_KEY
  );

  assert(
    physicalOrder.status === 'delivered' &&
      physicalOrder?.payment?.provider === 'wompi' &&
      physicalOrder?.payment?.mode === 'sandbox' &&
      physicalOrder?.payment?.status === 'paid',
    'La venta física no terminó entregada y pagada por Wompi sandbox.'
  );
  assert(
    branchCount >= 2 &&
      physicalOrder?.inventoryAllocationSummary?.soldQuantity === 3 &&
      physicalOrder?.inventoryAllocationSummary?.deliveredQuantity === 3,
    'La venta física no conserva la distribución multisede 2 + 1.'
  );
  assert(
    physicalReservation?.status === 'confirmed' &&
      saleMovements.length >= 2,
    'La reserva o el kardex multisede no quedaron confirmados.'
  );
  assert(
    invoices.length === 2 &&
      invoices.every(
        (invoice) =>
          ['accepted', 'sent'].includes(invoice.status) &&
          invoice.invoiceNumber
      ),
    'Las dos ventas no conservan sus facturas Factus.'
  );
  assert(
    Number(primaryStock?.reservedStock || 0) === 0 &&
      Number(secondaryStock?.reservedStock || 0) === 0,
    'Quedó inventario reservado después del pago.'
  );

  console.log('\n=== RESULTADO VISIBLE EN EL PANEL ===');

  for (const sale of [physical, hybrid]) {
    const order = sale.order;
    console.log(
      `\n${sale.key === 'physical' ? 'VENTA FÍSICA MULTISEDE' : 'VENTA DE COMBO HÍBRIDO'}`
    );
    console.log(
      `  Orden: ${order.orderNumber} · ${order.status} · ${money(order.total)}`
    );
    console.log(
      `  Wompi: ${order.payment?.status} · ${order.payment?.transactionId}`
    );
    console.log(
      `  Factus: ${sale.invoice.invoiceNumber} · ${sale.invoice.status}`
    );
    console.log(
      `  CUFE: ${cleanText(sale.invoice.cufe, 220).slice(0, 30)}…`
    );

    summarizeAllocations(order).forEach((allocation) => {
      console.log(
        `  Sede: ${allocation.branch} · vendido ${allocation.sold} · entregado ${allocation.delivered}`
      );
    });
  }

  console.log('\nDónde revisarlo:');
  console.log(`  Productos: busca ${ADVANCED_PRODUCT_SKU}`);
  console.log('  Pedidos: filtra la etiqueta demo');
  console.log('  Facturación > Documentos: aparecen las dos facturas');
  console.log('  Inventario/Kardex: filtra el smartphone DEMO');
  console.log('\nLos datos NO se eliminan al terminar.');
}

async function run() {
  if (VALIDATE_PLAN_ONLY) {
    assertExecutionPlan();
    return;
  }

  console.log('\n=== DEMOSTRACIÓN INTEGRAL PERMANENTE ===');
  console.log('Productos + multisede + Wompi sandbox + Factus habilitación');
  console.log('No se realizarán cobros reales y no se eliminarán datos.\n');

  await connectDatabase();
  const safeConfig = await loadAndAssertSafeSettings();

  console.log('\nETAPA 1 — catálogo demostrativo');
  runPermanentCatalogSeed();

  console.log('\nETAPA 2 — producto avanzado e inventario multisede');
  const { primary, secondary } = await ensureBranches();
  const product = await ensureAdvancedProduct();
  await prepareAdvancedProductStock({
    product,
    primary,
    secondary,
  });

  const hybridBundle = await Product.findOne({
    sku: HYBRID_BUNDLE_SKU,
    deletedAt: null,
    active: true,
  });
  assert(
    hybridBundle,
    `No se encontró el combo ${HYBRID_BUNDLE_SKU} creado por el catálogo DEMO.`
  );

  console.log('\nETAPA 3 — checkout y Wompi sandbox');
  const baseUrl = await startHttpServer();
  const physical = await runSale({
    key: 'physical',
    baseUrl,
    checkoutPayload: physicalCheckoutPayload(product, primary),
    idempotencyKey: DEMO_SALES[0].idempotencyKey,
    webhookSecret: safeConfig.webhookSecret,
    payments: safeConfig.payments,
    delivered: true,
  });
  const hybrid = await runSale({
    key: 'hybrid',
    baseUrl,
    checkoutPayload: hybridCheckoutPayload(hybridBundle, primary),
    idempotencyKey: DEMO_SALES[1].idempotencyKey,
    webhookSecret: safeConfig.webhookSecret,
    payments: safeConfig.payments,
    delivered: false,
  });

  console.log('\nETAPA 4 — validación y resumen');
  await validateResults({
    physical,
    hybrid,
    product,
    primary,
    secondary,
  });
}

run()
  .then(() => {
    console.log('\nDICTAMEN: APROBADO');
  })
  .catch((error) => {
    console.error('\nDICTAMEN: RECHAZADO');
    console.error(`[${error.code || 'ERROR'}] ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (server) {
      await new Promise((resolve) =>
        server.close(() => resolve())
      );
    }

    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  });
