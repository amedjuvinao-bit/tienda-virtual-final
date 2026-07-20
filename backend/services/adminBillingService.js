'use strict';

// backend/services/adminBillingService.js
// Servicio del módulo unificado de Facturación.
// Usa el modelo existente ElectronicInvoice como fuente oficial.

const mongoose = require('mongoose');

const ElectronicInvoice = require('../models/ElectronicInvoice');
const Order = require('../models/Order');
const SiteSettings = require('../models/SiteSettings');

let extractFactusLinks = null;
try {
  ({ extractFactusLinks } = require('../lib/dian/factusDownloads'));
} catch {
  extractFactusLinks = null;
}

const BILLABLE_ORDER_STATUSES = ['paid', 'processing', 'shipped', 'delivered'];
const PAID_PAYMENT_STATUSES = ['paid', 'approved', 'captured', 'success'];

function cleanText(value, max = 180) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function money(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function makeRegex(value) {
  const text = cleanText(value, 120);
  if (!text) return null;
  return new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
}

function normalizePage(params = {}) {
  const page = Math.max(1, Number(params.page || 1) || 1);
  const limit = Math.min(100, Math.max(1, Number(params.limit || 20) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

function getProviderStatus(invoice = {}) {
  return cleanText(
    invoice?.provider?.status ||
      invoice?.dianResponse?.code ||
      invoice?.status ||
      '',
    60
  ).toLowerCase();
}

function isValidatedInvoice(invoice = {}) {
  const status = cleanText(invoice.status, 60).toLowerCase();
  const providerStatus = getProviderStatus(invoice);

  return (
    ['accepted', 'validated', 'validada', 'validado'].includes(status) ||
    ['accepted', 'validated', 'validada', 'validado'].includes(providerStatus) ||
    invoice?.provider?.isValidated === true ||
    Boolean(invoice.cufe || invoice?.provider?.cufe || invoice?.provider?.raw?.cufe)
  );
}

function isRejectedOrFailed(invoice = {}) {
  const status = cleanText(invoice.status, 60).toLowerCase();
  const providerStatus = getProviderStatus(invoice);

  return ['rejected', 'failed', 'error'].includes(status) || ['rejected', 'failed', 'error'].includes(providerStatus);
}

function getInvoiceLinks(invoice = {}) {
  const factusLinks = typeof extractFactusLinks === 'function' ? extractFactusLinks(invoice) : {};
  const providerLinks = invoice?.provider?.links || {};

  return {
    pdfUrl: invoice.pdfUrl || factusLinks?.pdfUrl || providerLinks?.pdf_url || providerLinks?.pdfUrl || '',
    publicUrl: factusLinks?.publicUrl || providerLinks?.public_url || providerLinks?.publicUrl || '',
    xmlUrl: invoice.xmlUrl || providerLinks?.xml_url || providerLinks?.xmlUrl || '',
    qrUrl: invoice.qrUrl || providerLinks?.qr_url || providerLinks?.qrUrl || '',
  };
}

function serializeElectronicInvoice(invoice = {}) {
  const links = getInvoiceLinks(invoice);

  return {
    id: String(invoice._id || ''),
    orderId: invoice.orderId ? String(invoice.orderId) : '',
    orderNumber: invoice.orderNumber || '',
    required: invoice.required === true,
    status: invoice.status || 'pending',
    invoiceNumber: invoice.invoiceNumber || invoice?.provider?.number || '',
    cufe: invoice.cufe || invoice?.provider?.cufe || '',
    customer: invoice.customer || {},
    fiscalInfo: invoice.fiscalInfo || {},
    dianResolution: invoice.dianResolution || {},
    provider: {
      name: invoice?.provider?.name || '',
      status: invoice?.provider?.status || '',
      referenceCode: invoice?.provider?.referenceCode || '',
      number: invoice?.provider?.number || '',
      cufe: invoice?.provider?.cufe || '',
      isValidated: invoice?.provider?.isValidated === true,
      validatedAt: invoice?.provider?.validatedAt || '',
    },
    dianResponse: invoice.dianResponse || {},
    hasXml: Boolean(cleanText(invoice.xmlContent, 20) || links.xmlUrl),
    hasPdf: Boolean(links.pdfUrl || links.publicUrl),
    links,
    errorMessage: invoice.errorMessage || '',
    providerErrors: invoice.providerErrors || {},
    creditNotesCount: Array.isArray(invoice.creditNotes) ? invoice.creditNotes.length : 0,
    generatedAt: invoice.generatedAt || null,
    sentAt: invoice.sentAt || null,
    acceptedAt: invoice.acceptedAt || null,
    rejectedAt: invoice.rejectedAt || null,
    failedAt: invoice.failedAt || null,
    createdAt: invoice.createdAt || null,
    updatedAt: invoice.updatedAt || null,
  };
}

function serializePendingOrder(order = {}) {
  const customer = order.customer || {};
  const billing = order.billing || {};
  const payment = order.payment || {};
  const items = Array.isArray(order.items) ? order.items : Array.isArray(order.cart) ? order.cart : [];

  return {
    id: String(order._id || ''),
    orderNumber: order.orderNumber || '',
    status: order.status || '',
    source: order.source || order.channel || '',
    saleType: order.saleType || '',
    customerName:
      [customer.name, customer.lastname].filter(Boolean).join(' ').trim() ||
      [billing.name, billing.lastname].filter(Boolean).join(' ').trim() ||
      'Cliente',
    customerEmail: customer.email || customer.emailOrPhone || billing.email || '',
    paymentStatus: payment.status || '',
    paymentProvider: payment.provider || payment.method || '',
    subtotal: money(order.subtotal),
    shipping: money(order.shipping),
    total: money(order.total),
    itemsCount: items.length,
    createdAt: order.createdAt || null,
    updatedAt: order.updatedAt || null,
  };
}

function buildBillableOrderFilter(orderIdsWithInvoice = [], params = {}) {
  const filter = {
    _id: { $nin: orderIdsWithInvoice },
    $or: [
      { status: { $in: BILLABLE_ORDER_STATUSES } },
      { 'payment.status': { $in: PAID_PAYMENT_STATUSES } },
      { source: 'pos', total: { $gt: 0 } },
    ],
  };

  const regex = makeRegex(params.q || params.search || '');
  if (regex) {
    filter.$and = [
      {
        $or: [
          { orderNumber: regex },
          { 'customer.name': regex },
          { 'customer.lastname': regex },
          { 'customer.email': regex },
          { 'customer.emailOrPhone': regex },
          { 'billing.email': regex },
        ],
      },
    ];
  }

  return filter;
}

async function getBillingSettingsSnapshot() {
  const settings = await SiteSettings.findOne().lean();
  const billing = settings?.billing || {};

  return {
    store: settings?.store || {},
    publicUrl: settings?.publicUrl || '',
    billing,
    provider:
      billing?.electronicProvider?.provider ||
      billing?.dian?.providerType ||
      'mock',
    mode: billing?.dian?.mode || 'internal',
    resolution: billing?.dianResolution || {},
    taxes: billing?.taxes || {},
  };
}

async function listElectronicInvoices(params = {}) {
  const { page, limit, skip } = normalizePage(params);
  const filter = {};

  const regex = makeRegex(params.q || params.search || '');
  if (regex) {
    filter.$or = [
      { orderNumber: regex },
      { invoiceNumber: regex },
      { cufe: regex },
      { 'provider.number': regex },
      { 'provider.cufe': regex },
      { 'customer.businessName': regex },
      { 'customer.email': regex },
      { 'customer.documentNumber': regex },
    ];
  }

  const status = cleanText(params.status, 50).toLowerCase();
  if (status && status !== 'all') {
    if (status === 'validated') {
      filter.$or = [
        ...(filter.$or || []),
        { cufe: { $exists: true, $nin: ['', null] } },
        { 'provider.cufe': { $exists: true, $nin: ['', null] } },
        { 'provider.isValidated': true },
      ];
    } else {
      filter.status = status;
    }
  }

  const [total, rows] = await Promise.all([
    ElectronicInvoice.countDocuments(filter),
    ElectronicInvoice.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
  ]);

  return {
    rows: rows.map(serializeElectronicInvoice),
    total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(total / limit)),
  };
}

async function listPendingBillableOrders(params = {}) {
  const { page, limit, skip } = normalizePage(params);
  const orderIdsWithInvoice = await ElectronicInvoice.distinct('orderId', {});
  const filter = buildBillableOrderFilter(orderIdsWithInvoice, params);

  const [total, rows] = await Promise.all([
    Order.countDocuments(filter),
    Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
  ]);

  return {
    rows: rows.map(serializePendingOrder),
    total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(total / limit)),
  };
}

async function getBillingSummary() {
  const [settings, invoices, ordersWithInvoice, billableTotal] = await Promise.all([
    getBillingSettingsSnapshot(),
    ElectronicInvoice.find({}).lean(),
    ElectronicInvoice.distinct('orderId', {}),
    Order.countDocuments({
      $or: [
        { status: { $in: BILLABLE_ORDER_STATUSES } },
        { 'payment.status': { $in: PAID_PAYMENT_STATUSES } },
        { source: 'pos', total: { $gt: 0 } },
      ],
    }),
  ]);

  const emitted = invoices.length;
  const validated = invoices.filter(isValidatedInvoice).length;
  const errors = invoices.filter(isRejectedOrFailed).length;
  const pending = Math.max(0, Number(billableTotal || 0) - ordersWithInvoice.length);

  return {
    emitted,
    validated,
    pending,
    errors,
    provider: settings.provider || 'mock',
    mode: settings.mode || 'internal',
    resolution: settings.resolution || {},
    nextNumber: Number(settings?.resolution?.currentNumber || 1),
    rangeTo: Number(settings?.resolution?.rangeTo || 0),
  };
}

module.exports = {
  getBillingSummary,
  getBillingSettingsSnapshot,
  listElectronicInvoices,
  listPendingBillableOrders,
  serializeElectronicInvoice,
};
