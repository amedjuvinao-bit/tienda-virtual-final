'use strict';

// backend/services/adminBillingService.js
// Servicio del módulo unificado de Facturación.
// Usa el modelo existente ElectronicInvoice como fuente oficial.

const ElectronicInvoice = require('../models/ElectronicInvoice');
const Order = require('../models/Order');
const SiteSettings = require('../models/SiteSettings');
const MailSettings = require('../models/MailSettings');
const { buildAdminSiteSettings } = require('../lib/siteSettingsSecurity');
const {
  BILLABLE_ORDER_STATUSES,
  PAID_PAYMENT_STATUSES,
  extractProviderDocument,
  issueElectronicInvoiceForOrder,
} = require('./electronicInvoiceIssuanceService');
const {
  assertPreflightReady,
  buildInvoicePreflight,
} = require('./billingInvoicePreflightService');
const {
  buildCreditNotesPaginationPipeline,
  buildInvoiceSummaryPipeline,
  buildPendingOrdersCountPipeline,
  buildPendingOrdersPaginationPipeline,
  runBillingAggregation,
  unpackPaginationFacet,
} = require('./adminBillingAggregationService');
const {
  serializeCreditNote: serializeCreditNoteRecord,
  serializeElectronicInvoice: serializeElectronicInvoiceRecord,
  serializeEmailDelivery: serializeEmailDeliveryRecord,
} = require('./adminBillingSerializationService');

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

function serializeElectronicInvoice(invoice = {}) {
  return serializeElectronicInvoiceRecord(invoice);
}

function serializeCreditNote(invoice = {}, note = {}, index = 0) {
  return serializeCreditNoteRecord(invoice, note, index);
}

function serializeEmailDelivery(delivery = {}, customer = {}) {
  return serializeEmailDeliveryRecord(delivery, customer);
}

async function getMailConfigurationSnapshot() {
  const settings = await MailSettings.findOne({ key: 'main' })
    .select('+smtpPasswordEncrypted')
    .lean();

  const configured = Boolean(
    settings?.enabled &&
      settings?.fromEmail &&
      settings?.smtpHost &&
      settings?.smtpPort &&
      settings?.smtpUser &&
      settings?.smtpPasswordEncrypted
  );

  return {
    loaded: true,
    enabled: settings?.enabled === true,
    configured,
    fromEmail: settings?.fromEmail || '',
    fromName: settings?.fromName || '',
  };
}

function serializePendingOrder(order = {}) {
  const customer = order.customer || {};
  const billing = order.billing || {};
  const payment = order.payment || {};
  const items = Array.isArray(order.items) ? order.items : Array.isArray(order.cart) ? order.cart : [];
  const invoice = order._billingInvoice || {};
  const invoiceStatus = cleanText(invoice.status, 60).toLowerCase();
  const hasRetryableInvoice =
    Boolean(invoice._id) && ['failed', 'rejected', 'error'].includes(invoiceStatus);

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
    billingIssue: hasRetryableInvoice
      ? {
          invoiceId: String(invoice._id),
          status: invoiceStatus,
          retryable: true,
          errorMessage: cleanText(invoice.errorMessage, 1000),
          providerErrors:
            invoice.providerErrors && typeof invoice.providerErrors === 'object'
              ? invoice.providerErrors
              : {},
          attempts: Number(invoice?.emission?.attempts || 0),
          failedAt: invoice.failedAt || invoice.updatedAt || null,
        }
      : null,
    createdAt: order.createdAt || null,
    updatedAt: order.updatedAt || null,
  };
}

function buildBillableOrderFilter(params = {}) {
  const conditions = [
    {
      $or: [
        { status: { $in: BILLABLE_ORDER_STATUSES } },
        { 'payment.status': { $in: PAID_PAYMENT_STATUSES } },
        { source: 'pos', total: { $gt: 0 } },
      ],
    },
    {
      $nor: [
        { total: { $lte: 0 }, 'exchangeOrigin.type': 'rma_exchange' },
        { total: { $lte: 0 }, 'payment.method': /^exchange$/i },
        { total: { $lte: 0 }, sessionId: /^exchange:/i },
        {
          source: 'system',
          saleType: 'system_order',
          total: { $lte: 0 },
          tags: 'exchange',
        },
      ],
    },
  ];

  const regex = makeRegex(params.q || params.search || '');
  if (regex) {
    conditions.push({
      $or: [
        { orderNumber: regex },
        { 'customer.name': regex },
        { 'customer.lastname': regex },
        { 'customer.email': regex },
        { 'customer.emailOrPhone': regex },
        { 'billing.email': regex },
      ],
    });
  }

  return { $and: conditions };
}

async function getBillingSettingsSnapshot() {
  const settings = await SiteSettings.findOne().lean();
  const safeSettings = buildAdminSiteSettings(settings || {});
  const billing = safeSettings?.billing || {};
  const credentialStatus = Object.fromEntries(
    Object.entries(safeSettings?._credentialStatus || {}).filter(([path]) =>
      path.startsWith('billing.')
    )
  );

  return {
    store: safeSettings?.store || {},
    publicUrl: safeSettings?.publicUrl || '',
    billing,
    credentialStatus,
    provider:
      billing?.electronicProvider?.provider ||
      billing?.dian?.providerType ||
      'mock',
    mode: billing?.dian?.mode || 'internal',
    resolution: billing?.dianResolution || {},
    taxes: billing?.taxes || {},
  };
}

async function getInvoicePreflight(orderId) {
  return buildInvoicePreflight(orderId);
}

async function generateInvoiceForOrder(orderId, options = {}) {
  const preflight = await buildInvoicePreflight(orderId);
  assertPreflightReady(preflight, options.preflightFingerprint);

  const result = await issueElectronicInvoiceForOrder({
    orderId,
    source: 'admin',
    initiatedBy: options.adminUser || 'admin',
    allowRetry: true,
    skipWhenElectronicBillingIsInactive: false,
  });

  return {
    ...result,
    invoice: result.invoice ? serializeElectronicInvoice(result.invoice) : null,
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

  const [total, rows, mailConfiguration] = await Promise.all([
    ElectronicInvoice.countDocuments(filter),
    ElectronicInvoice.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    getMailConfigurationSnapshot(),
  ]);

  return {
    rows: rows.map(serializeElectronicInvoice),
    mailConfiguration,
    total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(total / limit)),
  };
}

async function listCreditNotes(params = {}) {
  const { page, limit, skip } = normalizePage(params);
  const regex = makeRegex(params.q || params.search || '');
  const invoiceFilter = { 'creditNotes.0': { $exists: true } };

  if (regex) {
    invoiceFilter.$or = [
      { orderNumber: regex },
      { invoiceNumber: regex },
      { cufe: regex },
      { 'provider.number': regex },
      { 'customer.businessName': regex },
      { 'customer.email': regex },
      { 'customer.documentNumber': regex },
      { 'creditNotes.provider.number': regex },
      { 'creditNotes.referenceCode': regex },
      { 'creditNotes.reasonText': regex },
      { 'creditNotes.reason': regex },
    ];
  }

  const status = cleanText(params.status, 50).toLowerCase();
  const type = cleanText(params.type, 50).toLowerCase();
  const pipeline = buildCreditNotesPaginationPipeline({
    invoiceFilter,
    status,
    type,
    skip,
    limit,
  });
  const facet = unpackPaginationFacet(
    await runBillingAggregation(ElectronicInvoice, pipeline)
  );
  const total = facet.total;
  const rows = facet.rows.map((invoice) =>
    serializeCreditNote(
      invoice,
      invoice.creditNotes || {},
      Number(invoice._billingCreditNoteIndex || 0)
    )
  );

  return {
    rows,
    total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(total / limit)),
  };
}

async function listPendingBillableOrders(params = {}) {
  const { page, limit, skip } = normalizePage(params);
  const filter = buildBillableOrderFilter(params);
  const pipeline = buildPendingOrdersPaginationPipeline({
    orderFilter: filter,
    invoiceCollectionName: ElectronicInvoice.collection.name,
    skip,
    limit,
  });
  const facet = unpackPaginationFacet(
    await runBillingAggregation(Order, pipeline)
  );

  return {
    rows: facet.rows.map(serializePendingOrder),
    total: facet.total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(facet.total / limit)),
  };
}

async function getBillingSummary() {
  const billableOrderFilter = buildBillableOrderFilter();
  const [
    settings,
    invoiceSummaryRows,
    pendingSummaryRows,
  ] = await Promise.all([
    getBillingSettingsSnapshot(),
    runBillingAggregation(
      ElectronicInvoice,
      buildInvoiceSummaryPipeline()
    ),
    runBillingAggregation(
      Order,
      buildPendingOrdersCountPipeline({
        orderFilter: billableOrderFilter,
        invoiceCollectionName: ElectronicInvoice.collection.name,
      })
    ),
  ]);

  const invoiceSummary = invoiceSummaryRows[0] || {};
  const pendingSummary = pendingSummaryRows[0] || {};
  const emitted = Math.max(0, Number(invoiceSummary.emitted || 0));
  const validated = Math.max(0, Number(invoiceSummary.validated || 0));
  const errors = Math.max(0, Number(invoiceSummary.errors || 0));
  const pending = Math.max(0, Number(pendingSummary.pending || 0));
  const creditNotes = Math.max(0, Number(invoiceSummary.creditNotes || 0));

  return {
    emitted,
    validated,
    pending,
    errors,
    creditNotes,
    provider: settings.provider || 'mock',
    mode: settings.mode || 'internal',
    resolution: settings.resolution || {},
    nextNumber: Number(settings?.resolution?.currentNumber || 1),
    rangeTo: Number(settings?.resolution?.rangeTo || 0),
  };
}

module.exports = {
  buildBillableOrderFilter,
  extractProviderDocument,
  getBillingSummary,
  getBillingSettingsSnapshot,
  generateInvoiceForOrder,
  getInvoicePreflight,
  getMailConfigurationSnapshot,
  listCreditNotes,
  listElectronicInvoices,
  listPendingBillableOrders,
  serializeCreditNote,
  serializeElectronicInvoice,
  serializeEmailDelivery,
};
