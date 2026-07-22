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

let extractFactusLinks = null;
try {
  ({ extractFactusLinks } = require('../lib/dian/factusDownloads'));
} catch {
  extractFactusLinks = null;
}

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
    Boolean(invoice?.provider?.validatedAt || invoice?.acceptedAt)
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

function getCreditNoteLinks(note = {}) {
  const links = note?.provider?.links || {};
  const rawLinks = note?.provider?.raw?.data?.links || note?.provider?.raw?.links || {};

  return {
    publicUrl: links.public_url || links.publicUrl || rawLinks.public_url || rawLinks.publicUrl || '',
    qrUrl: links.qr || links.qrUrl || rawLinks.qr || rawLinks.qrUrl || '',
    pdfUrl: links.pdf_url || links.pdfUrl || rawLinks.pdf_url || rawLinks.pdfUrl || '',
    xmlUrl: links.xml_url || links.xmlUrl || rawLinks.xml_url || rawLinks.xmlUrl || '',
  };
}

function serializeSync(sync = {}) {
  return {
    status: sync?.status || 'never',
    provider: sync?.provider || '',
    providerStatus: sync?.providerStatus || '',
    message: sync?.message || '',
    httpStatus: sync?.httpStatus ?? null,
    adminUser: sync?.adminUser || '',
    lastAttemptAt: sync?.lastAttemptAt || null,
    lastSuccessAt: sync?.lastSuccessAt || null,
  };
}

function serializeEmailDelivery(delivery = {}, customer = {}) {
  const history = Array.isArray(delivery?.history) ? delivery.history : [];

  return {
    status: delivery?.status || 'pending',
    recipient: delivery?.recipient || customer?.email || '',
    source: delivery?.source || 'automatic',
    initiatedBy: delivery?.initiatedBy || '',
    attempts: Number(delivery?.attempts || 0),
    messageId: delivery?.messageId || '',
    lastError: delivery?.lastError || '',
    lastAttemptAt: delivery?.lastAttemptAt || null,
    lastSentAt: delivery?.lastSentAt || null,
    attachments: Array.isArray(delivery?.attachments) ? delivery.attachments : [],
    history: history.slice(-10),
  };
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

function serializeElectronicInvoice(invoice = {}) {
  const links = getInvoiceLinks(invoice);
  const providerName = cleanText(invoice?.provider?.name, 60).toLowerCase();
  const providerNumber = cleanText(invoice?.provider?.number || invoice.invoiceNumber, 160);
  const hasOfficialFactusDocument =
    providerName === 'factus' &&
    Boolean(providerNumber) &&
    isValidatedInvoice(invoice);
  const officialDocuments = invoice.officialDocuments || {};

  return {
    id: String(invoice._id || ''),
    orderId: invoice.orderId ? String(invoice.orderId) : '',
    orderNumber: invoice.orderNumber || '',
    required: invoice.required === true,
    status: invoice.status || 'pending',
    invoiceNumber: invoice.invoiceNumber || invoice?.provider?.number || '',
    cufe: invoice.cufe || invoice?.provider?.cufe || '',
    customer: invoice.customer || {},
    totals: invoice.totals || {},
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
    emission: invoice.emission
      ? {
          state: invoice.emission.state || '',
          source: invoice.emission.source || '',
          initiatedBy: invoice.emission.initiatedBy || '',
          attempts: Number(invoice.emission.attempts || 0),
          firstAttemptAt: invoice.emission.firstAttemptAt || null,
          lastAttemptAt: invoice.emission.lastAttemptAt || null,
          completedAt: invoice.emission.completedAt || null,
          failedAt: invoice.emission.failedAt || null,
        }
      : null,
    hasXml: Boolean(
      officialDocuments?.xml?.available ||
      hasOfficialFactusDocument ||
      cleanText(invoice.xmlContent, 20) ||
      links.xmlUrl
    ),
    hasPdf: Boolean(
      officialDocuments?.pdf?.available ||
      hasOfficialFactusDocument ||
      links.pdfUrl ||
      links.publicUrl
    ),
    officialDocuments: {
      pdf: officialDocuments?.pdf || null,
      xml: officialDocuments?.xml || null,
    },
    emailDelivery: serializeEmailDelivery(invoice.emailDelivery, invoice.customer),
    links,
    errorMessage: invoice.errorMessage || '',
    providerErrors: invoice.providerErrors || {},
    sync: serializeSync(invoice.sync),
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

function serializeCreditNote(invoice = {}, note = {}, index = 0) {
  const links = getCreditNoteLinks(note);
  const customer = invoice.customer || {};

  return {
    id: String(note._id || `${invoice._id || 'invoice'}-${index}`),
    invoiceId: String(invoice._id || ''),
    orderId: invoice.orderId ? String(invoice.orderId) : '',
    orderNumber: invoice.orderNumber || '',
    invoiceNumber: invoice.invoiceNumber || invoice?.provider?.number || note.billNumber || '',
    invoiceStatus: invoice.status || 'pending',
    invoiceCufe: invoice.cufe || invoice?.provider?.cufe || '',
    customer,
    noteNumber: note?.provider?.number || note.number || note.referenceCode || '',
    referenceCode: note.referenceCode || note?.provider?.referenceCode || '',
    billNumber: note.billNumber || invoice.invoiceNumber || invoice?.provider?.number || '',
    type: note.type || 'total',
    status: note.status || note?.provider?.status || 'created',
    reasonCode: note.reasonCode || '',
    reasonText: note.reasonText || note.reason || note.observation || '',
    subtotal: money(note.subtotal),
    taxAmount: money(note.taxAmount),
    totalAmount: money(note.totalAmount || note.total || note.amount),
    itemsCount: Array.isArray(note.items) ? note.items.length : 0,
    provider: {
      name: note?.provider?.name || invoice?.provider?.name || '',
      status: note?.provider?.status || '',
      number: note?.provider?.number || '',
      cufe: note?.provider?.cufe || note?.provider?.cude || '',
      isValidated: note?.provider?.isValidated === true,
      validatedAt: note?.provider?.validatedAt || '',
    },
    links,
    errorMessage: note.errorMessage || '',
    providerErrors: note.providerErrors || {},
    sync: serializeSync(note.sync),
    createdAt: note.createdAt || invoice.updatedAt || invoice.createdAt || null,
    updatedAt: note.updatedAt || null,
    invoice: serializeElectronicInvoice(invoice),
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

async function generateInvoiceForOrder(orderId, options = {}) {
  const result = await issueElectronicInvoiceForOrder({
    orderId,
    source: 'admin',
    initiatedBy: options.adminUser || 'admin',
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

  const invoices = await ElectronicInvoice.find(invoiceFilter).sort({ updatedAt: -1, createdAt: -1 }).lean();
  const status = cleanText(params.status, 50).toLowerCase();
  const type = cleanText(params.type, 50).toLowerCase();

  const flattened = [];
  invoices.forEach((invoice) => {
    (Array.isArray(invoice.creditNotes) ? invoice.creditNotes : []).forEach((note, index) => {
      const row = serializeCreditNote(invoice, note, index);
      const rowStatus = cleanText(row.status, 50).toLowerCase();
      const rowType = cleanText(row.type, 50).toLowerCase();

      if (status && status !== 'all' && rowStatus !== status) return;
      if (type && type !== 'all' && rowType !== type) return;
      flattened.push(row);
    });
  });

  flattened.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

  const total = flattened.length;
  const rows = flattened.slice(skip, skip + limit);

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
  const creditNotes = invoices.reduce((acc, invoice) => acc + (Array.isArray(invoice.creditNotes) ? invoice.creditNotes.length : 0), 0);

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
  extractProviderDocument,
  getBillingSummary,
  getBillingSettingsSnapshot,
  generateInvoiceForOrder,
  getMailConfigurationSnapshot,
  listCreditNotes,
  listElectronicInvoices,
  listPendingBillableOrders,
  serializeCreditNote,
  serializeElectronicInvoice,
  serializeEmailDelivery,
};
