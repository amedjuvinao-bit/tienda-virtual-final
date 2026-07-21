'use strict';

// backend/services/adminBillingService.js
// Servicio del módulo unificado de Facturación.
// Usa el modelo existente ElectronicInvoice como fuente oficial.

const mongoose = require('mongoose');

const ElectronicInvoice = require('../models/ElectronicInvoice');
const Order = require('../models/Order');
const SiteSettings = require('../models/SiteSettings');
const { buildAdminSiteSettings } = require('../lib/siteSettingsSecurity');
const { generateCUFE } = require('../lib/dian/cufe');
const { generateInvoiceXML } = require('../lib/dian/xmlGenerator');
const { sendElectronicInvoiceToProvider } = require('../lib/dian/providerAdapter');

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

function firstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '');
}

function hasProviderDocumentShape(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;

  return Boolean(firstValue(
    value.number,
    value.invoiceNumber,
    value.reference_code,
    value.referenceCode,
    value.cufe,
    value.is_validated,
    value.validated_at
  ) !== undefined);
}

function extractProviderDocument(providerResponse = {}) {
  const data = providerResponse?.data;
  const nested = data?.data;
  const raw = providerResponse?.raw;
  const candidates = [
    nested?.bill,
    nested?.invoice,
    nested,
    data?.bill,
    data?.invoice,
    data,
    raw?.data?.data?.bill,
    raw?.data?.data?.invoice,
    raw?.data?.data,
    raw?.data,
    raw,
  ];

  return candidates.find(hasProviderDocumentShape) || {};
}

function providerMessage(providerResponse = {}, fallback = '') {
  const value = firstValue(
    providerResponse?.error,
    providerResponse?.data?.message,
    providerResponse?.message,
    fallback
  );

  if (typeof value === 'string') return cleanText(value, 500);

  try {
    return cleanText(JSON.stringify(value), 500);
  } catch {
    return cleanText(fallback, 500);
  }
}

function providerErrors(providerResponse = {}, providerDocument = {}) {
  const errors = firstValue(
    providerDocument?.errors,
    providerResponse?.data?.errors,
    providerResponse?.data?.data?.errors,
    providerResponse?.raw?.errors,
    {}
  );

  return errors && typeof errors === 'object' && !Array.isArray(errors) ? errors : {};
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

function getItems(order = {}) {
  return Array.isArray(order.items) ? order.items : Array.isArray(order.cart) ? order.cart : [];
}

function buildCustomerSnapshot(order = {}) {
  const customer = order.customer || {};
  const billing = order.billing || {};
  const fullName = [customer.name, customer.lastname].filter(Boolean).join(' ').trim();
  const billingName = [billing.name, billing.lastname].filter(Boolean).join(' ').trim();

  return {
    documentType: customer.documentType || customer.tipoDocumento || billing.documentType || '13',
    documentNumber:
      customer.documentNumber ||
      customer.document ||
      customer.cedula ||
      customer.identification ||
      customer.id ||
      billing.documentNumber ||
      billing.id ||
      '222222222222',
    dv: customer.dv || billing.dv || '',
    personType: customer.personType || billing.personType || 'natural',
    businessName: customer.businessName || fullName || billingName || customer.email || 'Consumidor final',
    email: customer.email || customer.emailOrPhone || billing.email || '',
    phone: customer.phone || billing.phone || '',
    address: customer.address || billing.address || '',
    city: customer.city || billing.city || '',
    department: customer.department || billing.department || '',
    country: customer.country || billing.country || 'Colombia',
  };
}

function calculateTotals(order = {}, settings = {}) {
  const items = getItems(order);
  const lineSubtotal = items.reduce((acc, item) => {
    const quantity = Number(item.quantity || item.qty || 0) || 0;
    const price = Number(item.price || item.unitPrice || item.priceNumber || item?.product?.price || 0) || 0;
    return acc + quantity * price;
  }, 0);

  const subtotal = money(order.subtotal || lineSubtotal);
  const shipping = money(order.shipping);
  const ivaConfig = order?.taxes?.iva || settings?.billing?.taxes?.iva || {};
  const ivaEnabled = ivaConfig.enabled !== false;
  const ivaPercent = Number(ivaConfig.percent || 0) || 0;
  const taxAmount = typeof ivaConfig.amount === 'number' ? money(ivaConfig.amount) : ivaEnabled ? Number(((subtotal * ivaPercent) / 100).toFixed(2)) : 0;
  const total = money(order.total || subtotal + shipping + taxAmount);

  return { subtotal, shipping, taxAmount, total, ivaConfig, ivaEnabled, ivaPercent };
}

function buildInvoiceNumber(resolution = {}) {
  const prefix = cleanText(resolution.prefix || 'FE', 20).replace(/\s+/g, '').toUpperCase() || 'FE';
  const currentNumber = Math.max(1, Number(resolution.currentNumber || resolution.rangeFrom || 1) || 1);
  const padded = String(currentNumber).padStart(6, '0');
  return {
    invoiceNumber: `${prefix}${padded}`,
    currentNumber,
    nextNumber: currentNumber + 1,
  };
}

function buildSettingsForInvoice(settings = {}) {
  const billing = settings?.billing || {};
  const dianConfig = billing.dian || {};
  const resolution = billing.dianResolution || {};
  const environment = dianConfig.mode === 'production' ? '1' : dianConfig.environment || resolution.environment || '2';

  return {
    ...(settings || {}),
    billing: {
      ...billing,
      dianResolution: {
        ...resolution,
        environment,
      },
    },
  };
}

async function generateInvoiceForOrder(orderId, options = {}) {
  if (!mongoose.Types.ObjectId.isValid(String(orderId || ''))) {
    const error = new Error('La orden enviada no es válida.');
    error.status = 400;
    error.code = 'INVALID_ORDER_ID';
    throw error;
  }

  const existing = await ElectronicInvoice.findOne({ orderId }).lean();
  if (existing) {
    return {
      created: false,
      invoice: serializeElectronicInvoice(existing),
      message: 'La orden ya tenía factura registrada.',
    };
  }

  const order = await Order.findById(orderId).lean();
  if (!order) {
    const error = new Error('Orden no encontrada.');
    error.status = 404;
    error.code = 'ORDER_NOT_FOUND';
    throw error;
  }

  const status = cleanText(order.status, 50).toLowerCase();
  const paymentStatus = cleanText(order.payment?.status, 50).toLowerCase();
  const isBillable =
    BILLABLE_ORDER_STATUSES.includes(status) ||
    PAID_PAYMENT_STATUSES.includes(paymentStatus) ||
    (String(order.source || '').toLowerCase() === 'pos' && money(order.total) > 0);

  if (!isBillable) {
    const error = new Error('Solo se pueden facturar órdenes pagadas o ventas POS cerradas.');
    error.status = 422;
    error.code = 'ORDER_NOT_BILLABLE';
    throw error;
  }

  const settings = await SiteSettings.findOne().lean();
  const settingsForInvoice = buildSettingsForInvoice(settings || {});
  const billing = settingsForInvoice.billing || {};
  const fiscalInfo = billing.fiscalInfo || {};
  const dianResolution = billing.dianResolution || {};
  const legalTexts = billing.legalTexts || {};
  const providerName = cleanText(
    billing?.electronicProvider?.provider || billing?.dian?.providerType || 'mock',
    60
  ).toLowerCase();
  const providerMode = billing?.dian?.mode || 'internal';
  const isExternalProvider =
    billing?.dian?.enabled === true &&
    providerMode !== 'internal' &&
    providerName !== 'mock';
  const environment = dianResolution.environment || '2';
  const { subtotal, shipping, taxAmount, total } = calculateTotals(order, settingsForInvoice);
  const customerSnapshot = buildCustomerSnapshot(order);
  const now = new Date();
  const issueDate = now.toISOString().slice(0, 10);
  const issueTime = now.toISOString().slice(11, 19);
  const { invoiceNumber, currentNumber, nextNumber } = buildInvoiceNumber(dianResolution);

  const cufeData = generateCUFE({
    invoiceNumber,
    issueDate,
    issueTime,
    grossAmount: subtotal,
    taxAmount,
    totalAmount: total,
    companyNit: fiscalInfo.nit || billing?.dian?.providerNit || '900000000',
    customerDocument: customerSnapshot.documentNumber || '222222222222',
    technicalKey: dianResolution.technicalKey || billing?.dian?.technicalKey || 'INTERNAL',
    environment,
  });

  let xmlContent = '';
  try {
    xmlContent = generateInvoiceXML({ order, settings: settingsForInvoice, cufeData });
  } catch (error) {
    xmlContent = '';
  }

  const qrUrl = `https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=${cufeData.cufe}`;

  let providerResponse = null;
  let providerDocument = {};

  if (isExternalProvider) {
    try {
      providerResponse = await sendElectronicInvoiceToProvider({
        provider: providerName,
        invoiceData: {
          order,
          settings: settingsForInvoice,
          cufeData,
          xmlContent,
          provider: providerName,
          providerConfig: billing.electronicProvider || {},
        },
      });
    } catch (error) {
      providerResponse = {
        success: false,
        provider: providerName,
        stage: 'send_invoice',
        error: error?.message || 'No fue posible enviar la factura al proveedor.',
      };
    }

    providerDocument = extractProviderDocument(providerResponse);

    if (providerResponse?.success !== true) {
      const error = new Error(providerMessage(
        providerResponse,
        'Factus no confirmó la creación de la factura.'
      ));
      error.status = 502;
      error.code = 'BILLING_PROVIDER_GENERATION_ERROR';
      throw error;
    }
  }

  const remoteNumber = cleanText(firstValue(
    providerDocument?.number,
    providerDocument?.invoiceNumber,
    providerResponse?.data?.invoiceNumber
  ), 160);
  const remoteCufe = cleanText(providerDocument?.cufe, 220);

  if (isExternalProvider && providerName === 'factus' && !remoteNumber) {
    const error = new Error(
      'Factus respondió la creación, pero no devolvió el número oficial de la factura.'
    );
    error.status = 502;
    error.code = 'BILLING_PROVIDER_NUMBER_MISSING';
    throw error;
  }

  const isProviderValidated =
    providerDocument?.is_validated === true ||
    providerDocument?.validated === true ||
    Boolean(providerDocument?.validated_at || providerDocument?.validatedAt);
  const officialLinks = providerDocument?.links && typeof providerDocument.links === 'object'
    ? providerDocument.links
    : {};
  const nextStatus = isExternalProvider
    ? (isProviderValidated ? 'accepted' : 'sent')
    : 'generated';
  const storedInvoiceNumber = remoteNumber || invoiceNumber;
  const storedCufe = isExternalProvider ? remoteCufe : cufeData.cufe;
  const responseMessage = providerMessage(
    providerResponse,
    isProviderValidated
      ? 'Factura creada y validada correctamente por Factus.'
      : isExternalProvider
        ? 'Factura enviada al proveedor y pendiente de validación.'
        : 'Comprobante interno generado desde módulo Facturación.'
  );

  const created = await ElectronicInvoice.create({
    orderId: order._id,
    orderNumber: order.orderNumber || '',
    required: true,
    status: nextStatus,
    customer: customerSnapshot,
    fiscalInfo,
    dianResolution: {
      resolutionNumber: dianResolution.resolutionNumber || '',
      prefix: dianResolution.prefix || '',
      rangeFrom: Number(dianResolution.rangeFrom || 1),
      rangeTo: Number(dianResolution.rangeTo || 1),
      currentNumber,
      resolutionDate: dianResolution.resolutionDate || '',
      expirationDate: dianResolution.expirationDate || '',
      documentType: dianResolution.documentType || '01',
    },
    legalTexts: {
      invoiceLegalText: legalTexts.invoiceLegalText || '',
      internalReceiptNote: legalTexts.internalReceiptNote || '',
    },
    invoiceNumber: storedInvoiceNumber,
    cufe: storedCufe,
    xmlContent,
    qrUrl: officialLinks.qr || officialLinks.qr_url || (isExternalProvider ? '' : qrUrl),
    pdfUrl: officialLinks.pdf || officialLinks.pdf_url || officialLinks.public_url || '',
    xmlUrl: officialLinks.xml || officialLinks.xml_url || '',
    provider: {
      name: providerName,
      status: isProviderValidated
        ? 'validated'
        : isExternalProvider
          ? 'sent'
          : 'created',
      referenceCode: cleanText(
        providerDocument?.reference_code ||
        providerDocument?.referenceCode ||
        order.orderNumber ||
        order._id,
        180
      ),
      number: remoteNumber,
      cufe: storedCufe,
      isValidated: isProviderValidated,
      validatedAt: providerDocument?.validated_at || providerDocument?.validatedAt || '',
      links: officialLinks,
      raw: {
        ...providerDocument,
        mode: providerMode,
        source: 'admin-billing',
        response: providerResponse,
      },
    },
    dianResponse: {
      stage: isExternalProvider
        ? (isProviderValidated ? 'provider_validated' : 'provider_sent')
        : 'internal_generated',
      environment,
      issueDate,
      issueTime,
      message: responseMessage,
      code: isExternalProvider
        ? String(providerResponse?.status || (isProviderValidated ? 'VALIDATED' : 'SENT'))
        : 'GENERATED',
      raw: {
        subtotal,
        shipping,
        taxAmount,
        total,
        providerResponse,
      },
    },
    providerErrors: providerErrors(providerResponse, providerDocument),
    errorMessage: '',
    generatedAt: now,
    sentAt: isExternalProvider ? now : null,
    acceptedAt: isProviderValidated ? now : null,
  });

  if (settings?._id) {
    await SiteSettings.updateOne(
      { _id: settings._id, 'billing.dianResolution.currentNumber': currentNumber },
      { $set: { 'billing.dianResolution.currentNumber': nextNumber } }
    );
  }

  return {
    created: true,
    invoice: serializeElectronicInvoice(created.toObject()),
    message: isProviderValidated
      ? 'Factura generada y validada correctamente por Factus.'
      : isExternalProvider
        ? 'Factura enviada correctamente al proveedor.'
        : 'Comprobante interno generado correctamente.',
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
  listCreditNotes,
  listElectronicInvoices,
  listPendingBillableOrders,
  serializeCreditNote,
  serializeElectronicInvoice,
};
