'use strict';

// backend/services/invoiceService.js
const mongoose = require('mongoose');

const Invoice = require('../models/Invoice');
const Order = require('../models/Order');
const SiteSettings = require('../models/SiteSettings');

const PAID_ORDER_STATUSES = new Set(['paid', 'processing', 'shipped']);
const PAID_PAYMENT_STATUSES = new Set(['paid']);

function createServiceError(message, status = 400, code = 'INVOICE_SERVICE_ERROR') {
  const error = new Error(message);
  error.status = status;
  error.statusCode = status;
  error.code = code;
  return error;
}

function cleanText(value, max = 250) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function cleanUpper(value, max = 30) {
  return cleanText(value, max).toUpperCase();
}

function moneySafe(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : fallback;
}

function numberSafe(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function positiveInt(value, fallback = 1) {
  const number = Math.floor(Number(value));
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function normalizeActor(actor = {}) {
  const snapshot = actor.snapshot || actor;
  return {
    adminUserId: mongoose.Types.ObjectId.isValid(String(actor.adminUserId || ''))
      ? new mongoose.Types.ObjectId(String(actor.adminUserId))
      : null,
    username: cleanText(snapshot.username || actor.username, 80).toLowerCase(),
    displayName: cleanText(snapshot.displayName || actor.displayName, 120),
    role: cleanText(snapshot.role || actor.role, 80).toLowerCase(),
    adminRole: cleanText(snapshot.adminRole || actor.adminRole, 80).toLowerCase(),
  };
}

function serializeInvoice(invoice) {
  if (!invoice) return null;
  const plain = invoice.toObject ? invoice.toObject() : invoice;
  return {
    ...plain,
    id: String(plain._id || plain.id || ''),
  };
}

async function getBillingSettings() {
  const settings = await SiteSettings.findOne({}).sort({ updatedAt: -1 }).lean();
  const billing = settings?.billing || {};

  return {
    settingsId: settings?._id || null,
    store: settings?.store || {},
    publicUrl: settings?.publicUrl || '',
    billing,
    fiscalInfo: billing.fiscalInfo || {},
    dianResolution: billing.dianResolution || {},
    electronicProvider: billing.electronicProvider || { provider: 'mock' },
    legalTexts: billing.legalTexts || {},
    taxes: billing.taxes || {},
  };
}

function isPaidOrder(order = {}) {
  const status = cleanText(order.status, 40).toLowerCase();
  const paymentStatus = cleanText(order.payment?.status, 40).toLowerCase();
  const source = cleanText(order.source, 40).toLowerCase();

  if (PAID_ORDER_STATUSES.has(status)) return true;
  if (PAID_PAYMENT_STATUSES.has(paymentStatus)) return true;
  if (source === 'pos' && moneySafe(order.total, 0) > 0) return true;

  return false;
}

function getOrderItems(order = {}) {
  if (Array.isArray(order.items) && order.items.length) return order.items;
  if (Array.isArray(order.cart) && order.cart.length) return order.cart;
  return [];
}

function getItemQuantity(item = {}) {
  return Math.max(1, Math.floor(numberSafe(item.quantity ?? item.qty, 1)));
}

function getItemUnitPrice(item = {}) {
  return moneySafe(item.unitPrice ?? item.price ?? item.priceNumber, 0);
}

function getItemProductId(item = {}) {
  const raw = item.product || item.productId || '';
  if (raw && typeof raw === 'object' && raw._id) return String(raw._id);
  return cleanText(raw, 80);
}

function buildInvoiceItems(order = {}, taxConfig = {}) {
  const iva = taxConfig?.iva || {};
  const taxEnabled = iva.enabled === true && Number(iva.percent || 0) > 0;
  const taxPercent = taxEnabled ? Number(iva.percent || 0) : 0;

  return getOrderItems(order).map((item) => {
    const quantity = getItemQuantity(item);
    const unitPrice = getItemUnitPrice(item);
    const subtotal = moneySafe(unitPrice * quantity, 0);
    const taxAmount = moneySafe(item.taxAmount ?? 0, 0);

    return {
      product: mongoose.Types.ObjectId.isValid(getItemProductId(item))
        ? new mongoose.Types.ObjectId(getItemProductId(item))
        : null,
      productId: getItemProductId(item),
      title: cleanText(item.title || item.name || item.product?.name || 'Producto', 180),
      description: cleanText(item.description || '', 300),
      sku: cleanText(item.sku || item.code || '', 80),
      color: cleanText(item.color || '', 80),
      size: cleanText(item.size || '', 80),
      quantity,
      unitPrice,
      subtotal,
      discountAmount: moneySafe(item.discountAmount, 0),
      taxAmount,
      total: moneySafe(subtotal + taxAmount - moneySafe(item.discountAmount, 0), 0),
      tax: {
        enabled: taxEnabled,
        percent: taxPercent,
        code: cleanText(iva.code || '01', 20),
        name: cleanText(iva.name || 'IVA', 80),
      },
    };
  });
}

function getCouponSnapshot(order = {}) {
  const coupon = order.coupon || {};
  if (!coupon || typeof coupon !== 'object') return {};
  return coupon;
}

function buildInvoiceTotals(order = {}, items = []) {
  const itemsSubtotal = items.reduce((sum, item) => sum + moneySafe(item.subtotal, 0), 0);
  const subtotal = moneySafe(order.subtotal ?? order.summary?.subtotal ?? itemsSubtotal, itemsSubtotal);
  const couponSnapshot = getCouponSnapshot(order);
  const discountAmount = moneySafe(
    order.discount?.amount ?? couponSnapshot.totalDiscountAmount ?? couponSnapshot.discountAmount,
    0
  );
  const shippingAmount = moneySafe(order.shipping, 0);
  const taxAmount = moneySafe(order.taxes?.iva?.amount, 0);
  const total = moneySafe(order.total, Math.max(0, subtotal + shippingAmount + taxAmount - discountAmount));
  const paidAmount = moneySafe(order.payment?.amount, total);

  return {
    itemsSubtotal,
    subtotal,
    discountAmount,
    shippingAmount,
    taxAmount,
    total,
    paidAmount,
  };
}

function buildNumberingSnapshot(billingSettings = {}) {
  const resolution = billingSettings.dianResolution || {};
  const provider = billingSettings.electronicProvider || {};
  const prefix = cleanUpper(resolution.prefix || (provider.provider && provider.provider !== 'mock' ? 'FE' : 'CI'), 12) || 'CI';
  const rangeFrom = positiveInt(resolution.rangeFrom, 1);
  const rangeTo = positiveInt(resolution.rangeTo, 999999999);
  const number = Math.max(rangeFrom, positiveInt(resolution.currentNumber, rangeFrom));

  if (number > rangeTo) {
    throw createServiceError('La numeración de facturación llegó al rango final configurado.', 409, 'INVOICE_NUMBER_RANGE_EXHAUSTED');
  }

  return {
    prefix,
    number,
    fullNumber: `${prefix}${String(number).padStart(6, '0')}`,
    resolutionNumber: cleanText(resolution.resolutionNumber, 80),
    rangeFrom,
    rangeTo,
    resolutionDate: cleanText(resolution.resolutionDate, 40),
    expirationDate: cleanText(resolution.expirationDate, 40),
    environment: cleanText(resolution.environment || billingSettings.electronicProvider?.environment || '2', 10),
    source: 'site-settings.billing.dianResolution',
  };
}

async function advanceBillingNumber(settingsId, issuedNumber) {
  if (!settingsId) return;
  await SiteSettings.updateOne(
    { _id: settingsId },
    { $set: { 'billing.dianResolution.currentNumber': issuedNumber + 1 } }
  );
}

function buildProviderSnapshot(billingSettings = {}) {
  const provider = billingSettings.electronicProvider || {};
  const dian = billingSettings.billing?.dian || billingSettings.dian || {};
  const providerName = cleanText(provider.provider || 'mock', 80).toLowerCase() || 'mock';

  return {
    provider: providerName,
    mode: providerName === 'mock' ? 'internal' : cleanText(dian.mode || 'habilitacion', 40),
    electronicStatus: providerName === 'mock' ? 'not_sent' : 'pending',
    externalId: '',
    cufe: '',
    cude: '',
    qrText: '',
    xmlUrl: '',
    pdfUrl: '',
    sentAt: null,
    response: {},
  };
}

function buildInvoicePayloadFromOrder(order = {}, billingSettings = {}, actor = {}) {
  const items = buildInvoiceItems(order, billingSettings.taxes || {});
  const totals = buildInvoiceTotals(order, items);
  const numbering = buildNumberingSnapshot(billingSettings);
  const fiscalInfo = billingSettings.fiscalInfo || {};
  const legalTexts = billingSettings.legalTexts || {};

  return {
    documentType: 'internal_receipt',
    status: 'issued',
    order: order._id || null,
    orderNumber: cleanText(order.orderNumber, 80),
    source: cleanText(order.source || 'online', 40).toLowerCase(),
    channel: cleanText(order.channel || (order.source === 'pos' ? 'physical_store' : 'web'), 40).toLowerCase(),
    saleType: cleanText(order.saleType || '', 60).toLowerCase(),
    numbering,
    fullNumber: numbering.fullNumber,
    storeSnapshot: {
      ...(billingSettings.store || {}),
      publicUrl: billingSettings.publicUrl || '',
    },
    fiscalSnapshot: fiscalInfo,
    customerSnapshot: order.customer || {},
    billingSnapshot: order.billing || order.customer || {},
    paymentSnapshot: order.payment || {},
    taxSnapshot: billingSettings.taxes || {},
    couponSnapshot: getCouponSnapshot(order),
    items,
    totals,
    currency: cleanText(order.payment?.currency || 'COP', 10).toUpperCase() || 'COP',
    provider: buildProviderSnapshot(billingSettings),
    notes: cleanText(legalTexts.internalReceiptNote || legalTexts.invoiceLegalText || '', 1000),
    events: [
      {
        type: 'created_from_order',
        message: `Comprobante interno generado desde la orden ${cleanText(order.orderNumber, 80)}`,
        by: actor.username || 'system',
        at: new Date(),
        meta: {
          orderId: String(order._id || ''),
          orderNumber: cleanText(order.orderNumber, 80),
        },
      },
    ],
    createdBy: actor,
    updatedBy: actor,
  };
}

async function listInvoices(params = {}) {
  const page = Math.max(1, positiveInt(params.page, 1));
  const limit = Math.min(100, Math.max(1, positiveInt(params.limit, 20)));
  const skip = (page - 1) * limit;
  const filter = { deletedAt: null };

  const q = cleanText(params.q || params.search || '', 120);
  if (q) {
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [
      { fullNumber: regex },
      { orderNumber: regex },
      { 'customerSnapshot.name': regex },
      { 'customerSnapshot.email': regex },
      { 'billingSnapshot.email': regex },
    ];
  }

  const status = cleanText(params.status, 40).toLowerCase();
  if (['draft', 'issued', 'cancelled', 'failed'].includes(status)) filter.status = status;

  const source = cleanText(params.source, 40).toLowerCase();
  if (source) filter.source = source;

  const [total, rows] = await Promise.all([
    Invoice.countDocuments(filter),
    Invoice.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
  ]);

  return {
    rows: rows.map(serializeInvoice),
    total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(total / limit)),
  };
}

async function getInvoiceById(id) {
  if (!mongoose.Types.ObjectId.isValid(String(id || ''))) {
    throw createServiceError('Comprobante no encontrado.', 404, 'INVOICE_NOT_FOUND');
  }

  const invoice = await Invoice.findOne({ _id: id, deletedAt: null }).lean();
  if (!invoice) throw createServiceError('Comprobante no encontrado.', 404, 'INVOICE_NOT_FOUND');
  return serializeInvoice(invoice);
}

async function getInvoicePublic(id, params = {}) {
  const invoice = await getInvoiceById(id);
  const orderNumber = cleanText(params.orderNumber || params.orden || '', 80);
  const email = cleanText(params.email || '', 160).toLowerCase();

  if (orderNumber && orderNumber !== invoice.orderNumber) {
    throw createServiceError('No se pudo validar el comprobante solicitado.', 403, 'INVOICE_PUBLIC_ACCESS_DENIED');
  }

  const invoiceEmail = cleanText(invoice.customerSnapshot?.email || invoice.billingSnapshot?.email || '', 160).toLowerCase();
  if (email && invoiceEmail && email !== invoiceEmail) {
    throw createServiceError('No se pudo validar el comprobante solicitado.', 403, 'INVOICE_PUBLIC_ACCESS_DENIED');
  }

  return {
    id: invoice.id,
    fullNumber: invoice.fullNumber,
    status: invoice.status,
    orderNumber: invoice.orderNumber,
    documentType: invoice.documentType,
    customerSnapshot: invoice.customerSnapshot,
    items: invoice.items,
    totals: invoice.totals,
    currency: invoice.currency,
    provider: {
      provider: invoice.provider?.provider || 'mock',
      electronicStatus: invoice.provider?.electronicStatus || 'not_sent',
      cufe: invoice.provider?.cufe || '',
      qrText: invoice.provider?.qrText || '',
    },
    createdAt: invoice.createdAt,
  };
}

async function getPendingBillableOrders(params = {}) {
  const page = Math.max(1, positiveInt(params.page, 1));
  const limit = Math.min(100, Math.max(1, positiveInt(params.limit, 20)));
  const skip = (page - 1) * limit;

  const invoicedOrderIds = await Invoice.distinct('order', {
    order: { $ne: null },
    deletedAt: null,
    status: { $ne: 'cancelled' },
  });

  const filter = {
    _id: { $nin: invoicedOrderIds },
    $or: [
      { status: { $in: ['paid', 'processing', 'shipped'] } },
      { 'payment.status': 'paid' },
      { source: 'pos', total: { $gt: 0 } },
    ],
  };

  const q = cleanText(params.q || params.search || '', 120);
  if (q) {
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$and = [
      { $or: filter.$or },
      {
        $or: [
          { orderNumber: regex },
          { 'customer.name': regex },
          { 'customer.lastname': regex },
          { 'customer.email': regex },
          { 'billing.email': regex },
        ],
      },
    ];
    delete filter.$or;
  }

  const [total, rows] = await Promise.all([
    Order.countDocuments(filter),
    Order.find(filter)
      .select('orderNumber status source channel saleType subtotal shipping total customer billing payment createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  return {
    rows,
    total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(total / limit)),
  };
}

async function getInvoiceSummary() {
  const [issued, pendingOrders, failed, cancelled] = await Promise.all([
    Invoice.countDocuments({ deletedAt: null, status: 'issued' }),
    getPendingBillableOrders({ limit: 1 }).then((data) => data.total),
    Invoice.countDocuments({ deletedAt: null, status: 'failed' }),
    Invoice.countDocuments({ deletedAt: null, status: 'cancelled' }),
  ]);

  const settings = await getBillingSettings();
  const resolution = settings.dianResolution || {};
  const provider = settings.electronicProvider || {};
  const currentNumber = positiveInt(resolution.currentNumber, positiveInt(resolution.rangeFrom, 1));
  const rangeTo = positiveInt(resolution.rangeTo, currentNumber);
  const remainingNumbers = Math.max(0, rangeTo - currentNumber + 1);

  return {
    issued,
    pendingOrders,
    failed,
    cancelled,
    provider: provider.provider || 'mock',
    nextNumber: buildNumberingSnapshot(settings).fullNumber,
    remainingNumbers,
    resolutionExpirationDate: resolution.expirationDate || '',
  };
}

async function createInvoiceFromOrder(orderId, actorInput = {}, options = {}) {
  if (!mongoose.Types.ObjectId.isValid(String(orderId || ''))) {
    throw createServiceError('Orden inválida para facturación.', 400, 'ORDER_ID_INVALID');
  }

  const actor = normalizeActor(actorInput);
  const existing = await Invoice.findOne({ order: orderId, deletedAt: null }).lean();
  if (existing) {
    return { created: false, invoice: serializeInvoice(existing) };
  }

  const order = await Order.findById(orderId).lean();
  if (!order) throw createServiceError('Orden no encontrada.', 404, 'ORDER_NOT_FOUND');

  if (!options.allowUnpaid && !isPaidOrder(order)) {
    throw createServiceError('Solo se puede generar comprobante de órdenes pagadas.', 422, 'ORDER_NOT_PAID');
  }

  const settings = await getBillingSettings();
  let payload = buildInvoicePayloadFromOrder(order, settings, actor);
  let lastError = null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const invoice = await Invoice.create(payload);
      await advanceBillingNumber(settings.settingsId, payload.numbering.number);
      return { created: true, invoice: serializeInvoice(invoice) };
    } catch (error) {
      lastError = error;
      if (error?.code !== 11000) break;
      payload = {
        ...payload,
        numbering: {
          ...payload.numbering,
          number: payload.numbering.number + 1,
          fullNumber: `${payload.numbering.prefix}${String(payload.numbering.number + 1).padStart(6, '0')}`,
        },
      };
      payload.fullNumber = payload.numbering.fullNumber;
    }
  }

  if (lastError?.code === 11000) {
    throw createServiceError('No se pudo generar un consecutivo único de facturación.', 409, 'INVOICE_NUMBER_DUPLICATED');
  }

  throw lastError;
}

async function setInvoiceStatus(id, status, actorInput = {}, meta = {}) {
  if (!mongoose.Types.ObjectId.isValid(String(id || ''))) {
    throw createServiceError('Comprobante no encontrado.', 404, 'INVOICE_NOT_FOUND');
  }

  const normalizedStatus = cleanText(status, 40).toLowerCase();
  if (!['draft', 'issued', 'cancelled', 'failed'].includes(normalizedStatus)) {
    throw createServiceError('Estado de comprobante inválido.', 400, 'INVOICE_STATUS_INVALID');
  }

  const actor = normalizeActor(actorInput);
  const patch = {
    status: normalizedStatus,
    updatedBy: actor,
  };

  if (normalizedStatus === 'cancelled') {
    patch.cancelledAt = new Date();
    patch.cancelledBy = actor;
  }

  const invoice = await Invoice.findOneAndUpdate(
    { _id: id, deletedAt: null },
    {
      $set: patch,
      $push: {
        events: {
          type: `status_${normalizedStatus}`,
          message: cleanText(meta.message || `Estado cambiado a ${normalizedStatus}`, 300),
          by: actor.username || 'admin',
          at: new Date(),
          meta,
        },
      },
    },
    { new: true }
  );

  if (!invoice) throw createServiceError('Comprobante no encontrado.', 404, 'INVOICE_NOT_FOUND');
  return serializeInvoice(invoice);
}

async function cancelInvoice(id, actor = {}, reason = '') {
  return setInvoiceStatus(id, 'cancelled', actor, {
    reason: cleanText(reason, 500),
  });
}

module.exports = {
  createServiceError,
  serializeInvoice,
  getBillingSettings,
  isPaidOrder,
  buildInvoiceItems,
  buildInvoiceTotals,
  buildNumberingSnapshot,
  buildInvoicePayloadFromOrder,
  listInvoices,
  getInvoiceById,
  getInvoicePublic,
  getPendingBillableOrders,
  getInvoiceSummary,
  createInvoiceFromOrder,
  setInvoiceStatus,
  cancelInvoice,
};
