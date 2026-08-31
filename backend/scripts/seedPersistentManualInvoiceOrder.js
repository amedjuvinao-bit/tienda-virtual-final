/* eslint-disable no-console */
'use strict';

require('dotenv').config({
  path: require('path').join(__dirname, '..', '.env'),
  quiet: true,
});

const crypto = require('crypto');
const mongoose = require('mongoose');

const ElectronicInvoice = require('../models/ElectronicInvoice');
const InventoryReservation = require('../models/InventoryReservation');
const Order = require('../models/Order');
const { listPendingBillableOrders } = require('../services/adminBillingService');
const {
  confirmInventoryReservation,
  createInventoryReservation,
} = require('../services/inventoryReservationService');
const {
  applyReservationToOrderDocument,
} = require('../services/orderInventoryAllocationService');
const {
  initializeOrderLogistics,
} = require('../services/orderLogisticsService');
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
  const resumeOrder = String(optionValue(argv, 'resume-order') || '').trim();
  if (!Number.isInteger(stockLimit) || stockLimit < 20 || stockLimit > 2000) {
    throw new Error('stock-limit debe ser un entero entre 20 y 2000.');
  }
  if (resumeOrder.length > 120 || /\s/.test(resumeOrder)) {
    throw new Error('resume-order debe ser un número de orden o ObjectId válido, sin espacios.');
  }

  return {
    confirmPersist: argv.includes('--confirm-persist'),
    resumeOrder,
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
  const documentNumber = `10${String(parseInt(suffix, 16)).padStart(8, '0')}`;
  return {
    runId: `manual_invoice_${stamp.toLowerCase()}_${suffix.toLowerCase()}`,
    orderNumber: `FM-${stamp.replace(/[TZ]/g, '')}-${suffix}`,
    buyer: {
      documentNumber,
      documentType: 'CC',
      firstName: 'Cliente',
      lastName: `Prueba Habilitación ${suffix}`,
      email: `factura.habilitacion+${suffix.toLowerCase()}@example.com`,
      phone: '3000000000',
      address: 'Calle 93 # 12-34 · Prueba de habilitación',
      city: 'Bogotá D.C.',
      municipalityCode: '11001',
      department: 'Bogotá D.C.',
      departmentCode: '11',
      country: 'Colombia',
      countryCode: 'CO',
    },
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
    requiresShipping: true,
    fulfillmentKind: 'shipment',
    fulfillmentSnapshot: {
      productType: product.productType || 'physical',
      kind: 'shipment',
      requiresShipping: true,
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
  const buyer = identity.buyer || {};

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
    tags: ['factura-manual', 'prueba-persistente', 'sin-factura', 'operacion-trazable'],
    customer: {
      name: buyer.firstName,
      lastname: buyer.lastName,
      id: buyer.documentNumber,
      documentNumber: buyer.documentNumber,
      documentType: buyer.documentType,
      isFinalConsumer: false,
      email: buyer.email,
      emailOrPhone: buyer.email,
      phone: buyer.phone,
      address: buyer.address,
      city: buyer.city,
      municipalityCode: buyer.municipalityCode,
      department: buyer.department,
      departmentCode: buyer.departmentCode,
      country: buyer.country,
      countryCode: buyer.countryCode,
    },
    billing: {
      useSameAddress: true,
      personType: 'natural',
      isFinalConsumer: false,
      firstName: buyer.firstName,
      lastName: buyer.lastName,
      name: buyer.firstName,
      lastname: buyer.lastName,
      documentNumber: buyer.documentNumber,
      documentType: buyer.documentType,
      businessName: '',
      address: buyer.address,
      city: buyer.city,
      cityCode: buyer.municipalityCode,
      municipalityCode: buyer.municipalityCode,
      department: buyer.department,
      departmentCode: buyer.departmentCode,
      postalCode: '110111',
      phone: buyer.phone,
      email: buyer.email,
      country: buyer.country,
      countryCode: buyer.countryCode,
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
        status: 'pending',
        lastAttemptAt: null,
        confirmedAt: null,
      },
      invoice: {
        status: 'pending',
        transactionId: reference,
      },
    },
    inventoryControl: {
      reservationRequired: true,
      reservationId: null,
      discountedAtCheckout: false,
      restockedOnFailure: false,
      restockedAt: null,
    },
    timeline: [{
      type: 'system',
      message: 'Orden persistente creada sin factura electrónica y pendiente de confirmar su operación.',
      by: 'manual-invoice-test-script',
      at: now,
    }],
    notes: [{
      text: 'PRUEBA PERSISTENTE: comprador fiscal identificado, pago simulado, inventario y preparación trazables, sin factura automática. Emitir manualmente solo en Factus habilitación.',
      by: 'manual-invoice-test-script',
      pinned: true,
      at: now,
    }],
    createdAt: now,
    updatedAt: now,
  };
}

function orderLookup(identifier) {
  if (mongoose.Types.ObjectId.isValid(identifier)) return { _id: identifier };
  return { orderNumber: identifier };
}

function preparePhysicalItems(order) {
  for (const item of order.items || []) {
    item.productType = item.productType || 'physical';
    item.requiresShipping = true;
    item.fulfillmentKind = 'shipment';
    item.fulfillmentSnapshot = {
      ...(item.fulfillmentSnapshot?.toObject?.() || item.fulfillmentSnapshot || {}),
      productType: item.productType || 'physical',
      kind: 'shipment',
      requiresShipping: true,
    };
  }
}

function reservationPayload(order, now) {
  return {
    sessionId: order.sessionId,
    order: order._id,
    orderNumber: order.orderNumber,
    paymentReference: order.payment?.reference || '',
    paymentTransactionId: order.payment?.transactionId || '',
    source: 'admin',
    items: (order.items || []).map((item) => item.toObject()),
    branchPriorityIds: order.branch ? [order.branch] : [],
    expiresInMinutes: 30,
    currency: order.payment?.currency || 'COP',
    metadata: {
      manualInvoicePersistentTest: true,
      operationalTraceAt: now,
    },
    notes: `Operación persistente para ${order.orderNumber}; factura electrónica pendiente.`,
  };
}

async function persistOperationalTrace({ orderDraft = null, orderId = null, now = new Date() } = {}) {
  if (!orderDraft && !orderId) {
    throw new Error('Falta la orden nueva o existente que recibirá la operación trazable.');
  }

  const session = await mongoose.startSession();
  let persistedOrderId = orderId;

  try {
    await session.withTransaction(async () => {
      let order;
      if (orderDraft) {
        [order] = await Order.create([orderDraft], { session });
        persistedOrderId = order._id;
      } else {
        order = await Order.findById(orderId).session(session);
      }
      if (!order) throw new Error('No se encontró la orden que recibirá la operación trazable.');
      if (String(order.payment?.status || '').toLowerCase() !== 'paid') {
        throw new Error('La orden debe tener el pago confirmado antes de reservar inventario.');
      }

      preparePhysicalItems(order);
      let reservation = null;
      const reservationId = order.inventoryControl?.reservationId;
      const hasAllocations = Array.isArray(order.inventoryAllocations) && order.inventoryAllocations.length > 0;

      if (reservationId) {
        reservation = await confirmInventoryReservation(
          reservationId,
          {
            order: order._id,
            orderNumber: order.orderNumber,
            paymentReference: order.payment?.reference || '',
            paymentTransactionId: order.payment?.transactionId || '',
          },
          { session }
        );
      } else if (!hasAllocations) {
        reservation = await createInventoryReservation(
          reservationPayload(order, now),
          { session }
        );
        if (!reservation) {
          throw new Error('El producto no usa inventario administrado y no pudo crear una operación física trazable.');
        }

        order.inventoryControl.reservationRequired = true;
        order.inventoryControl.reservationId = reservation._id;
        applyReservationToOrderDocument(order, reservation);
        await order.save({ session });

        reservation = await confirmInventoryReservation(
          reservation._id,
          {
            order: order._id,
            orderNumber: order.orderNumber,
            paymentReference: order.payment?.reference || '',
            paymentTransactionId: order.payment?.transactionId || '',
          },
          { session }
        );
      }

      order = await Order.findById(order._id).session(session);
      if (reservation) applyReservationToOrderDocument(order, reservation);
      order.inventoryControl.reservationRequired = true;
      order.inventoryControl.discountedAtCheckout = true;
      order.inventoryControl.restockedOnFailure = false;
      order.inventoryControl.restockedAt = null;
      if (!order.paymentProcessing) {
        order.paymentProcessing = {
          provider: order.payment?.provider || 'manual',
          approvedTransactionId: order.payment?.transactionId || '',
          approvedAt: order.payment?.paidAt || now,
          inventory: {},
          invoice: {
            status: 'pending',
            transactionId: order.payment?.transactionId || '',
          },
        };
      }
      if (!order.paymentProcessing.inventory) {
        order.paymentProcessing.inventory = {};
      }
      order.paymentProcessing.inventory.status = 'confirmed';
      order.paymentProcessing.inventory.lastAttemptAt = now;
      order.paymentProcessing.inventory.confirmedAt = reservation?.confirmedAt || now;

      const traceMessage = 'Inventario confirmado y operación preparada; la factura electrónica continúa pendiente.';
      if (!Array.isArray(order.timeline)) order.timeline = [];
      if (!(order.timeline || []).some((entry) => entry.message === traceMessage)) {
        order.timeline.push({
          type: 'system',
          message: traceMessage,
          by: 'manual-invoice-test-script',
          at: now,
        });
      }
      await order.save({ session });

      await initializeOrderLogistics(
        {
          orderFilter: { _id: order._id },
          actor: {
            displayName: 'Prueba persistente de factura manual',
            role: 'system',
            source: 'system',
          },
          now,
          allowAllBranches: true,
        },
        { session }
      );
    });
  } finally {
    await session.endSession();
  }

  return Order.findById(persistedOrderId).exec();
}

async function verifyPendingManualInvoiceOrder(
  order,
  { expectedInvoiceCount = 0 } = {}
) {
  const invoiceCount = await ElectronicInvoice.countDocuments({
    orderId: order._id,
  }).exec();
  if (invoiceCount !== expectedInvoiceCount) {
    throw new Error(
      `La cantidad de facturas cambió durante la operación: antes ${expectedInvoiceCount}, después ${invoiceCount}.`
    );
  }

  const reservation = order.inventoryControl?.reservationId
    ? await InventoryReservation.findById(order.inventoryControl.reservationId).lean().exec()
    : null;
  if (!reservation || reservation.status !== 'confirmed') {
    throw new Error('La orden no conservó una reserva de inventario confirmada.');
  }
  if (!(order.inventoryAllocations || []).length) {
    throw new Error('La orden no conservó asignaciones de inventario para Operación.');
  }
  if (!(order.fulfillment?.shipments || []).length) {
    throw new Error('La orden no conservó preparación logística para Operación.');
  }
  if (order.paymentProcessing?.inventory?.status !== 'confirmed') {
    throw new Error('La conciliación del inventario no quedó confirmada.');
  }

  let listed = null;
  if (invoiceCount === 0) {
    const pending = await listPendingBillableOrders({
      q: order.orderNumber,
      page: 1,
      limit: 10,
    });
    listed = pending.rows.find(
      (row) => String(row.id) === String(order._id)
    );
    if (!listed) {
      throw new Error('La orden se guardó, pero no apareció en Órdenes por facturar.');
    }
  }

  return {
    invoiceCount,
    paymentStatus: listed?.paymentStatus || order.payment?.status || '',
    pendingBillingVerified: invoiceCount === 0,
  };
}

async function run(options = parseArgs()) {
  assertPersistentConfirmation(options);
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DB_URI || '';
  if (!mongoUri) {
    throw new Error('Falta MONGODB_URI, MONGO_URI o DB_URI en backend/.env.');
  }

  await mongoose.connect(mongoUri);
  const now = new Date();
  let order;
  let recovered = false;
  let expectedInvoiceCount = 0;

  if (options.resumeOrder) {
    const existing = await Order.findOne(orderLookup(options.resumeOrder)).exec();
    if (!existing) throw new Error(`No existe la orden ${options.resumeOrder}.`);
    expectedInvoiceCount = await ElectronicInvoice.countDocuments({
      orderId: existing._id,
    }).exec();
    order = await persistOperationalTrace({ orderId: existing._id, now });
    recovered = true;
  } else {
    const candidates = await loadCandidates(options.stockLimit);
    if (!candidates.length) {
      throw new Error('No existe un producto con sede activa para construir la orden de prueba.');
    }
    const identity = buildTraceIdentity({ now });
    order = await persistOperationalTrace({
      orderDraft: buildOrderDraft({
        candidate: candidates[0],
        now,
        identity,
      }),
      now,
    });
  }
  const verification = await verifyPendingManualInvoiceOrder(order, {
    expectedInvoiceCount,
  });

  console.log('\n=== ORDEN PERSISTENTE SIN FACTURA ELECTRÓNICA Y CON OPERACIÓN ===');
  console.log(`Base principal: ${mongoose.connection.name}`);
  console.log(`Modo: ${recovered ? 'ORDEN EXISTENTE COMPLETADA' : 'ORDEN NUEVA'}`);
  console.log(`Orden: ${order.orderNumber}`);
  console.log(`MongoDB ID: ${order._id}`);
  console.log(`Total: $ ${Number(order.total || 0).toLocaleString('es-CO')}`);
  console.log(`Producto: ${order.items[0]?.title || 'Producto de prueba'}`);
  console.log(
    `Comprador fiscal: ${order.billing?.firstName || ''} ${order.billing?.lastName || ''} · ${order.billing?.documentType || ''} ${order.billing?.documentNumber || ''}`
  );
  console.log(
    `Ubicación fiscal: ${order.billing?.municipalityCode || ''} · ${order.billing?.address || ''}`
  );
  console.log(`Estado del pago: ${verification.paymentStatus}`);
  console.log(`Reserva: ${order.inventoryControl.reservationId}`);
  console.log(`Asignaciones: ${order.inventoryAllocations.length}`);
  console.log(`Envíos preparados: ${order.fulfillment.shipments.length}`);
  console.log(
    `ElectronicInvoice asociados: ${verification.invoiceCount} (CONSERVADOS; no se emitieron nuevos)`
  );
  console.log(
    `Cola de facturación: ${verification.pendingBillingVerified ? 'VERIFICADA' : 'NO APLICA (la orden ya está facturada)'}`
  );
  console.log('Persistencia: CONSERVADA (sin limpieza automática).');
  console.log(`\nBuscar en Facturación > Órdenes por facturar: ${order.orderNumber}`);
  console.log('En Órdenes > Operación verás inventario vendido y preparación pendiente.');
  if (verification.invoiceCount === 0) {
    console.log('Después pulsa Emitir/Reintentar para generar tú la factura electrónica.');
  } else {
    console.log('La factura existente quedó intacta; no se creó ni reintentó ningún documento fiscal.');
  }

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
  persistOperationalTrace,
  preparePhysicalItems,
  run,
  verifyPendingManualInvoiceOrder,
};
