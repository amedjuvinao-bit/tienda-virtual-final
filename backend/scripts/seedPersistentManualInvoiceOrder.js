/* eslint-disable no-console */
'use strict';

require('dotenv').config({
  path: require('path').join(__dirname, '..', '.env'),
  quiet: true,
});

const crypto = require('crypto');
const mongoose = require('mongoose');

const ElectronicInvoice = require('../models/ElectronicInvoice');
const Order = require('../models/Order');
const { listPendingBillableOrders } = require('../services/adminBillingService');
const {
  assertPersistentConfirmation,
  loadCandidates,
} = require('./seedPersistentOrdersTrace');

const DEFAULT_OPTIONS = Object.freeze({
  confirmPersist: false,
  stockLimit: 200,
});

function optionValue(argv, name) {
  const prefix = `--${name}=`;
  const entry = argv.find((value) => String(value).startsWith(prefix));
  return entry ? String(entry).slice(prefix.length) : undefined;
}

function parseArgs(argv = process.argv.slice(2)) {
  const rawLimit = optionValue(argv, 'stock-limit');
  const stockLimit = rawLimit === undefined ? DEFAULT_OPTIONS.stockLimit : Number(rawLimit);
  if (!Number.isInteger(stockLimit) || stockLimit < 20 || stockLimit > 2000) {
    throw new Error('stock-limit debe ser un entero entre 20 y 2000.');
  }

  return {
    confirmPersist: argv.includes('--confirm-persist'),
    stockLimit,
  };
}

function timestamp(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function buildTraceIdentity({
  now = new Date(),
  randomBytes = crypto.randomBytes,
} = {}) {
  const stamp = timestamp(now);
  const suffix = randomBytes(3).toString('hex').toUpperCase();
  return {
    runId: `manual_invoice_${stamp.toLowerCase()}_${suffix.toLowerCase()}`,
    orderNumber: `FM-${stamp.replace(/[TZ]/g, '')}-${suffix}`,
  };
}

function buildItem(candidate) {
  const product = candidate.product || {};
  const price = Math.max(1000, Number(product.price || 0));
  return {
    product: product.id,
    productId: product.id,
    title: product.title || 'Producto de prueba para factura manual',
    image: product.image || '',
    color: product.color || '',
    colorLabel: product.color || '',
    size: product.size || '',
    qty: 1,
    quantity: 1,
    price,
    unitPrice: price,
    priceNumber: price,
    variantId: product.variantKey || 'default__default',
    variantKey: product.variantKey || 'default__default',
    variantLabel: product.variantLabel || '',
    variantAttributes: product.variantAttributes || [],
    variantSku: product.variantSku || product.sku || '',
    variantBarcode: product.variantBarcode || '',
    category: product.category || '',
    categories: product.categories || [],
    productType: product.productType || 'physical',
    requiresShipping: false,
    fulfillmentKind: 'manual',
    fulfillmentSnapshot: {
      productType: product.productType || 'physical',
      kind: 'manual',
      requiresShipping: false,
    },
    lineSubtotal: price,
    discountAmount: 0,
    taxableBase: price,
    taxRate: 0,
    taxAmount: 0,
    lineTotal: price,
  };
}

function buildOrderDraft({ candidate, now = new Date(), identity } = {}) {
  if (!candidate?.product?.id || !candidate?.branch?.id) {
    throw new Error('La prueba necesita un producto y una sede reales.');
  }
  if (!identity?.runId || !identity?.orderNumber) {
    throw new Error('Falta el identificador trazable de la prueba.');
  }

  const item = buildItem(candidate);
  const total = Number(item.lineTotal || 0);
  const reference = `${identity.orderNumber}-PAY`;

  return {
    sessionId: identity.runId.slice(0, 120),
    orderNumber: identity.orderNumber,
    status: 'paid',
    fulfillmentStatus: 'pending',
    branch: candidate.branch.id,
    branchSnapshot: {
      name: candidate.branch.name,
      code: candidate.branch.code,
      type: candidate.branch.type,
    },
    source: 'manual',
    channel: 'manual',
    saleType: 'manual_order',
    tags: ['factura-manual', 'prueba-persistente', 'sin-factura'],
    customer: {
      name: 'Consumidor',
      lastname: 'Final Prueba Manual',
      id: '222222222222',
      documentType: 'CC',
      email: 'factura.manual@example.com',
      emailOrPhone: 'factura.manual@example.com',
      phone: '3000000000',
      address: 'Calle 1 # 1-01',
      city: 'Bogotá',
      municipalityCode: '11001',
      department: 'Bogotá D.C.',
      departmentCode: '11',
      country: 'Colombia',
      countryCode: 'CO',
    },
    billing: {
      useSameAddress: true,
      personType: 'natural',
      firstName: 'Consumidor',
      lastName: 'Final Prueba Manual',
      name: 'Consumidor',
      lastname: 'Final Prueba Manual',
      documentNumber: '222222222222',
      documentType: 'CC',
      businessName: '',
      address: 'Calle 1 # 1-01',
      city: 'Bogotá',
      cityCode: '11001',
      municipalityCode: '11001',
      department: 'Bogotá D.C.',
      departmentCode: '11',
      postalCode: '110111',
      phone: '3000000000',
      email: 'factura.manual@example.com',
      country: 'Colombia',
      countryCode: 'CO',
      tributeCode: 'ZZ',
    },
    items: [item],
    cart: [{
      productId: item.productId,
      title: item.title,
      image: item.image,
      color: item.color,
      colorLabel: item.colorLabel,
      size: item.size,
      variantId: item.variantId,
      variantKey: item.variantKey,
      variantLabel: item.variantLabel,
      variantAttributes: item.variantAttributes,
      quantity: 1,
      price: total,
    }],
    summary: {
      itemsCount: 1,
      totalItems: 1,
      subtotal: total,
    },
    pricing: {
      version: 2,
      currency: 'COP',
      subtotal: total,
      productDiscount: 0,
      subtotalAfterDiscount: total,
      originalShipping: 0,
      shippingDiscount: 0,
      shipping: 0,
      totalDiscount: 0,
      taxableBase: total,
      taxAmount: 0,
      total,
    },
    subtotal: total,
    shipping: 0,
    total,
    taxes: {
      iva: {
        enabled: false,
        percent: 0,
        code: '01',
        name: 'IVA',
        taxableBase: total,
        amount: 0,
      },
    },
    payment: {
      active: true,
      provider: 'manual',
      providerLabel: 'Prueba administrativa persistente',
      mode: 'sandbox',
      currency: 'COP',
      checkoutLabel: 'PAGO DE PRUEBA — factura electrónica manual pendiente',
      enableWebhook: false,
      status: 'paid',
      methodType: 'cash',
      method: 'cash',
      methodLabel: 'Efectivo de prueba',
      transactionId: reference,
      reference,
      amountInCents: Math.round(total * 100),
      amount: total,
      paidAt: now,
    },
    paymentProcessing: {
      provider: 'manual',
      approvedTransactionId: reference,
      approvedAt: now,
      inventory: {
        status: 'not_required',
        lastAttemptAt: now,
        confirmedAt: now,
      },
      invoice: {
        status: 'pending',
        transactionId: reference,
      },
    },
    inventoryControl: {
      reservationRequired: false,
      reservationId: null,
      discountedAtCheckout: false,
      restockedOnFailure: false,
      restockedAt: null,
    },
    timeline: [{
      type: 'system',
      message: 'Orden persistente creada sin factura electrónica para emisión manual desde el panel.',
      by: 'manual-invoice-test-script',
      at: now,
    }],
    notes: [{
      text: 'PRUEBA PERSISTENTE: pago simulado, sin movimiento de inventario y sin factura automática. Emitir manualmente solo en Factus habilitación.',
      by: 'manual-invoice-test-script',
      pinned: true,
      at: now,
    }],
    createdAt: now,
    updatedAt: now,
  };
}

async function verifyPendingManualInvoiceOrder(order) {
  const invoiceCount = await ElectronicInvoice.countDocuments({
    orderId: order._id,
  }).exec();
  if (invoiceCount !== 0) {
    throw new Error('La orden ya tiene un documento ElectronicInvoice y no sirve para la prueba manual.');
  }

  const pending = await listPendingBillableOrders({
    q: order.orderNumber,
    page: 1,
    limit: 10,
  });
  const listed = pending.rows.find(
    (row) => String(row.id) === String(order._id)
  );
  if (!listed) {
    throw new Error('La orden se guardó, pero no apareció en Órdenes por facturar.');
  }

  return listed;
}

async function run(options = parseArgs()) {
  assertPersistentConfirmation(options);
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DB_URI || '';
  if (!mongoUri) {
    throw new Error('Falta MONGODB_URI, MONGO_URI o DB_URI en backend/.env.');
  }

  await mongoose.connect(mongoUri);
  const candidates = await loadCandidates(options.stockLimit);
  if (!candidates.length) {
    throw new Error('No existe un producto con sede activa para construir la orden de prueba.');
  }

  const now = new Date();
  const identity = buildTraceIdentity({ now });
  const order = new Order(buildOrderDraft({
    candidate: candidates[0],
    now,
    identity,
  }));
  await order.save();
  const listed = await verifyPendingManualInvoiceOrder(order);

  console.log('\n=== ORDEN PERSISTENTE SIN FACTURA ELECTRÓNICA ===');
  console.log(`Base principal: ${mongoose.connection.name}`);
  console.log(`Orden: ${order.orderNumber}`);
  console.log(`MongoDB ID: ${order._id}`);
  console.log(`Total: $ ${Number(order.total || 0).toLocaleString('es-CO')}`);
  console.log(`Producto: ${order.items[0]?.title || 'Producto de prueba'}`);
  console.log(`Estado del pago: ${listed.paymentStatus}`);
  console.log('ElectronicInvoice asociados: 0');
  console.log('Cola de facturación: VERIFICADA');
  console.log('Persistencia: CONSERVADA (sin limpieza automática).');
  console.log(`\nBuscar en Facturación > Órdenes por facturar: ${order.orderNumber}`);
  console.log('Después abre la orden y pulsa Emitir/Reintentar para generar tú la factura electrónica.');

  return {
    orderId: String(order._id),
    orderNumber: order.orderNumber,
    total: Number(order.total || 0),
  };
}

async function main() {
  try {
    await run(parseArgs());
  } catch (error) {
    console.error(`\nERROR: ${error.message}`);
    console.error('Si una orden alcanzó a guardarse, se conserva para trazabilidad.');
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect().catch(() => {});
    }
  }
}

if (require.main === module) main();

module.exports = {
  DEFAULT_OPTIONS,
  buildItem,
  buildOrderDraft,
  buildTraceIdentity,
  parseArgs,
  run,
  verifyPendingManualInvoiceOrder,
};
