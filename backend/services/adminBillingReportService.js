'use strict';

// Reportes administrativos de Facturación.
// ElectronicInvoice y Order siguen siendo las únicas fuentes de datos.

const ElectronicInvoice = require('../models/ElectronicInvoice');
const Order = require('../models/Order');

const REPORT_TIME_ZONE = 'America/Bogota';
const REPORT_OFFSET = '-05:00';
const MAX_REPORT_DAYS = 366;
const REPORT_TYPES = new Set(['all', 'invoice', 'credit_note']);
const REPORT_STATUSES = new Set([
  'all',
  'pending',
  'processing',
  'generated',
  'created',
  'sent',
  'validated',
  'rejected',
  'failed',
  'error',
  'deleted',
]);

function cleanText(value, max = 180) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function money(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? Math.round((number + Number.EPSILON) * 100) / 100 : 0;
}

function sumMoney(values = []) {
  return money(values.reduce((total, value) => total + money(value), 0));
}

function reportError(message, code = 'BILLING_REPORT_INVALID_FILTER', status = 400) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function dateInputValue(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function todayInBogota() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: REPORT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function validateDateInput(value, fieldLabel) {
  const text = cleanText(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw reportError(`${fieldLabel} debe tener el formato AAAA-MM-DD.`);
  }

  const [year, month, day] = text.split('-').map(Number);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    throw reportError(`${fieldLabel} no es una fecha válida.`);
  }

  return text;
}

function startOfBogotaDay(value) {
  return new Date(`${value}T00:00:00.000${REPORT_OFFSET}`);
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function normalizeReportFilters(params = {}) {
  const today = todayInBogota();
  const todayProbe = new Date(`${today}T00:00:00.000Z`);
  const defaultFrom = dateInputValue(addDays(todayProbe, -29));
  const from = validateDateInput(params.from || defaultFrom, 'La fecha inicial');
  const to = validateDateInput(params.to || today, 'La fecha final');
  const fromDate = startOfBogotaDay(from);
  const toExclusive = addDays(startOfBogotaDay(to), 1);
  const days = Math.round((toExclusive.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000));

  if (fromDate >= toExclusive) {
    throw reportError('La fecha inicial no puede ser posterior a la fecha final.');
  }
  if (days > MAX_REPORT_DAYS) {
    throw reportError(`El reporte no puede superar ${MAX_REPORT_DAYS} días.`);
  }

  const type = cleanText(params.type || 'all', 30).toLowerCase();
  const status = cleanText(params.status || 'all', 30).toLowerCase();
  if (!REPORT_TYPES.has(type)) throw reportError('El tipo de documento seleccionado no es válido.');
  if (!REPORT_STATUSES.has(status)) throw reportError('El estado seleccionado no es válido.');

  return {
    from,
    to,
    fromDate,
    toExclusive,
    days,
    type,
    status,
    timeZone: REPORT_TIME_ZONE,
  };
}

function parseReportDate(value) {
  if (!value) return null;
  const text = String(value);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(text)
    ? startOfBogotaDay(text)
    : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateInBogota(value) {
  const date = parseReportDate(value);
  if (!date) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: REPORT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function isInRange(value, filters) {
  const date = parseReportDate(value);
  return Boolean(
    date && date >= filters.fromDate && date < filters.toExclusive
  );
}

function getInvoiceDate(invoice = {}) {
  return (
    invoice.generatedAt ||
    invoice.acceptedAt ||
    invoice?.provider?.validatedAt ||
    invoice?.dianResponse?.issueDate ||
    invoice.createdAt ||
    null
  );
}

function getCreditNoteDate(note = {}) {
  return note.validatedAt || note?.provider?.validatedAt || note.createdAt || null;
}

function invoiceIsValidated(invoice = {}) {
  const status = cleanText(invoice.status, 40).toLowerCase();
  const providerStatus = cleanText(
    invoice?.provider?.status || invoice?.dianResponse?.code,
    40
  ).toLowerCase();
  return (
    ['accepted', 'validated', 'validada', 'validado'].includes(status) ||
    ['accepted', 'validated', 'validada', 'validado'].includes(providerStatus) ||
    invoice?.provider?.isValidated === true ||
    Boolean(invoice?.provider?.validatedAt || invoice?.acceptedAt)
  );
}

function creditNoteIsValidated(note = {}) {
  const status = cleanText(note.status, 40).toLowerCase();
  const providerStatus = cleanText(note?.provider?.status, 40).toLowerCase();
  return (
    ['accepted', 'validated', 'validada', 'validado'].includes(status) ||
    ['accepted', 'validated', 'validada', 'validado'].includes(providerStatus) ||
    note?.provider?.isValidated === true ||
    Boolean(note?.provider?.validatedAt || note?.validatedAt)
  );
}

function normalizeDocumentStatus(document = {}, type = 'invoice') {
  const validated = type === 'credit_note'
    ? creditNoteIsValidated(document)
    : invoiceIsValidated(document);
  if (validated) return 'validated';

  const value = cleanText(
    document.status || document?.provider?.status || 'pending',
    40
  ).toLowerCase();
  if (value === 'accepted' || value === 'validada' || value === 'validado') return 'validated';
  if (REPORT_STATUSES.has(value) && value !== 'all') return value;
  return 'pending';
}

function statusLabel(status) {
  const labels = {
    pending: 'Pendiente',
    processing: 'Procesando',
    generated: 'Generada',
    created: 'Creada',
    sent: 'Enviada',
    validated: 'Validada',
    rejected: 'Rechazada',
    failed: 'Fallida',
    error: 'Error',
    deleted: 'Eliminada',
  };
  return labels[status] || status || 'Pendiente';
}

function documentTypeLabel(type) {
  return type === 'credit_note' ? 'Nota crédito' : 'Factura';
}

function customerName(customer = {}) {
  return cleanText(
    customer.businessName ||
      [customer.firstName, customer.lastName].filter(Boolean).join(' ') ||
      customer.name ||
      customer.email ||
      'Cliente',
    180
  );
}

function normalizeChannel(order = {}) {
  const source = cleanText(order.source || order.channel, 50).toLowerCase();
  if (source === 'pos' || source === 'physical_store') return { key: 'pos', label: 'POS' };
  if (['online', 'web', 'storefront'].includes(source)) return { key: 'online', label: 'Tienda web' };
  if (['manual', 'admin'].includes(source)) return { key: 'manual', label: 'Manual' };
  return { key: source || 'unknown', label: source || 'Sin canal' };
}

function paymentMethod(order = {}) {
  const payment = order.payment || {};
  if (Array.isArray(payment.splitPayments) && payment.splitPayments.length > 1) {
    return { key: 'split', label: 'Pago dividido' };
  }

  const key = cleanText(payment.method || payment.provider || 'unknown', 60).toLowerCase();
  const commonLabels = {
    cash: 'Efectivo',
    efectivo: 'Efectivo',
    card: 'Tarjeta',
    tarjeta: 'Tarjeta',
    transfer: 'Transferencia',
    transferencia: 'Transferencia',
    wompi: 'Wompi',
    payu: 'PayU',
    pos: 'POS',
    manual: 'Manual',
    unknown: 'Sin medio de pago',
  };
  return {
    key,
    label: cleanText(payment.methodLabel || payment.providerLabel, 100) || commonLabels[key] || key,
  };
}

function buildInvoiceRow(invoice = {}, order = {}) {
  const hasInvoiceTotals = invoice.totals && typeof invoice.totals === 'object';
  const totals = hasInvoiceTotals ? invoice.totals : (order.pricing || {});
  const subtotal = money(totals.subtotal ?? order.subtotal);
  const productDiscount = money(totals.productDiscount ?? order?.discount?.amount);
  const shippingDiscount = money(totals.shippingDiscount);
  const totalDiscount = money(totals.totalDiscount ?? (productDiscount + shippingDiscount));
  const shipping = money(totals.shipping ?? order.shipping);
  const taxableBase = money(totals.taxableBase ?? order?.taxes?.iva?.taxableBase ?? (subtotal - productDiscount));
  const taxAmount = money(totals.taxAmount ?? order?.taxes?.iva?.amount);
  const status = normalizeDocumentStatus(invoice, 'invoice');
  const validated = invoiceIsValidated(invoice);
  const total = money(totals.total ?? order.total);
  const date = getInvoiceDate(invoice);
  const channel = normalizeChannel(order);
  const payment = paymentMethod(order);

  return {
    id: String(invoice._id || ''),
    documentType: 'invoice',
    documentTypeLabel: documentTypeLabel('invoice'),
    date: date || null,
    dateKey: dateInBogota(date),
    number: invoice.invoiceNumber || invoice?.provider?.number || 'Sin número',
    referenceNumber: '',
    orderNumber: invoice.orderNumber || order.orderNumber || '',
    status,
    statusLabel: statusLabel(status),
    validated,
    customerName: customerName(invoice.customer),
    customerDocument: cleanText(invoice?.customer?.documentNumber, 80),
    customerEmail: cleanText(invoice?.customer?.email, 180),
    channelKey: channel.key,
    channel: channel.label,
    paymentMethodKey: payment.key,
    paymentMethod: payment.label,
    subtotal,
    productDiscount,
    shippingDiscount,
    totalDiscount,
    shipping,
    taxableBase,
    taxAmount,
    total,
    fiscalImpact: validated ? total : 0,
  };
}

function buildCreditNoteRow(invoice = {}, note = {}, index = 0, order = {}) {
  const status = normalizeDocumentStatus(note, 'credit_note');
  const validated = creditNoteIsValidated(note);
  const total = money(note.totalAmount || note.total || note.amount);
  const date = getCreditNoteDate(note);
  const channel = normalizeChannel(order);
  const payment = paymentMethod(order);

  return {
    id: String(note._id || `${invoice._id || 'invoice'}-${index}`),
    documentType: 'credit_note',
    documentTypeLabel: documentTypeLabel('credit_note'),
    date: date || null,
    dateKey: dateInBogota(date),
    number: note?.provider?.number || note.number || note.referenceCode || 'Sin número',
    referenceNumber: invoice.invoiceNumber || invoice?.provider?.number || note.billNumber || '',
    orderNumber: invoice.orderNumber || order.orderNumber || '',
    status,
    statusLabel: statusLabel(status),
    validated,
    customerName: customerName(invoice.customer),
    customerDocument: cleanText(invoice?.customer?.documentNumber, 80),
    customerEmail: cleanText(invoice?.customer?.email, 180),
    channelKey: channel.key,
    channel: channel.label,
    paymentMethodKey: payment.key,
    paymentMethod: payment.label,
    subtotal: money(note.subtotal),
    productDiscount: 0,
    shippingDiscount: 0,
    totalDiscount: 0,
    shipping: 0,
    taxableBase: money(note.subtotal),
    taxAmount: money(note.taxAmount),
    total,
    fiscalImpact: validated ? money(-total) : 0,
  };
}

function candidateDateFilter(filters) {
  const range = { $gte: filters.fromDate, $lt: filters.toExclusive };
  const clauses = [];
  if (filters.type !== 'credit_note') {
    clauses.push(
      { createdAt: range },
      { generatedAt: range },
      { acceptedAt: range },
      { 'provider.validatedAt': { $gte: filters.from, $lte: `${filters.to}T23:59:59` } },
      { 'dianResponse.issueDate': { $gte: filters.from, $lte: filters.to } }
    );
  }
  if (filters.type !== 'invoice') {
    clauses.push(
      { 'creditNotes.createdAt': range },
      { 'creditNotes.validatedAt': range },
      { 'creditNotes.provider.validatedAt': { $gte: filters.from, $lte: `${filters.to}T23:59:59` } }
    );
  }
  return { $or: clauses };
}

function addBreakdownValue(map, key, label, row) {
  if (!map.has(key)) {
    map.set(key, {
      key,
      label,
      documents: 0,
      invoices: 0,
      creditNotes: 0,
      invoiced: 0,
      credited: 0,
      net: 0,
    });
  }
  const entry = map.get(key);
  entry.documents += 1;
  if (row.documentType === 'credit_note') {
    entry.creditNotes += 1;
    if (row.validated) entry.credited = money(entry.credited + row.total);
  } else {
    entry.invoices += 1;
    if (row.validated) entry.invoiced = money(entry.invoiced + row.total);
  }
  entry.net = money(entry.invoiced - entry.credited);
}

function buildBreakdowns(rows = []) {
  const statuses = new Map();
  const paymentMethods = new Map();
  const channels = new Map();
  const daily = new Map();

  rows.forEach((row) => {
    addBreakdownValue(statuses, row.status, row.statusLabel, row);
    addBreakdownValue(paymentMethods, row.paymentMethodKey, row.paymentMethod, row);
    addBreakdownValue(channels, row.channelKey, row.channel, row);
    addBreakdownValue(daily, row.dateKey || 'sin-fecha', row.dateKey || 'Sin fecha', row);
  });

  const byDocuments = (a, b) => b.documents - a.documents || a.label.localeCompare(b.label, 'es');
  return {
    statuses: [...statuses.values()].sort(byDocuments),
    paymentMethods: [...paymentMethods.values()].sort((a, b) => b.net - a.net || byDocuments(a, b)),
    channels: [...channels.values()].sort((a, b) => b.net - a.net || byDocuments(a, b)),
    daily: [...daily.values()].sort((a, b) => a.key.localeCompare(b.key)),
  };
}

function buildMetrics(rows = []) {
  const invoices = rows.filter((row) => row.documentType === 'invoice');
  const creditNotes = rows.filter((row) => row.documentType === 'credit_note');
  const validInvoices = invoices.filter((row) => row.validated);
  const validCreditNotes = creditNotes.filter((row) => row.validated);
  const errorStatuses = new Set(['rejected', 'failed', 'error']);

  const invoiced = sumMoney(validInvoices.map((row) => row.total));
  const credited = sumMoney(validCreditNotes.map((row) => row.total));
  const invoiceTax = sumMoney(validInvoices.map((row) => row.taxAmount));
  const creditedTax = sumMoney(validCreditNotes.map((row) => row.taxAmount));
  const invoiceTaxableBase = sumMoney(validInvoices.map((row) => row.taxableBase));
  const creditedTaxableBase = sumMoney(validCreditNotes.map((row) => row.taxableBase));

  return {
    documents: rows.length,
    invoices: invoices.length,
    validatedInvoices: validInvoices.length,
    creditNotes: creditNotes.length,
    validatedCreditNotes: validCreditNotes.length,
    errors: rows.filter((row) => errorStatuses.has(row.status)).length,
    invoiced,
    credited,
    net: money(invoiced - credited),
    discounts: sumMoney(validInvoices.map((row) => row.totalDiscount)),
    shipping: sumMoney(validInvoices.map((row) => row.shipping)),
    taxableBase: money(invoiceTaxableBase - creditedTaxableBase),
    invoiceTax,
    creditedTax,
    netTax: money(invoiceTax - creditedTax),
  };
}

async function loadReportRows(filters) {
  const invoices = await ElectronicInvoice.find(candidateDateFilter(filters)).lean();
  const orderIds = [...new Set(invoices.map((invoice) => String(invoice.orderId || '')).filter(Boolean))];
  const orders = orderIds.length
    ? await Order.find({ _id: { $in: orderIds } })
        .select('orderNumber source channel saleType payment subtotal shipping total taxes discount pricing')
        .lean()
    : [];
  const orderById = new Map(orders.map((order) => [String(order._id), order]));
  const rows = [];

  invoices.forEach((invoice) => {
    const order = orderById.get(String(invoice.orderId || '')) || {};
    if (filters.type !== 'credit_note' && isInRange(getInvoiceDate(invoice), filters)) {
      rows.push(buildInvoiceRow(invoice, order));
    }

    if (filters.type !== 'invoice') {
      (Array.isArray(invoice.creditNotes) ? invoice.creditNotes : []).forEach((note, index) => {
        if (isInRange(getCreditNoteDate(note), filters)) {
          rows.push(buildCreditNoteRow(invoice, note, index, order));
        }
      });
    }
  });

  const filtered = filters.status === 'all'
    ? rows
    : rows.filter((row) => row.status === filters.status);

  return filtered.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
}

async function buildBillingReport(params = {}, options = {}) {
  const filters = normalizeReportFilters(params);
  const rows = await loadReportRows(filters);
  const rowLimit = options.allRows === true ? rows.length : 30;

  return {
    filters: {
      from: filters.from,
      to: filters.to,
      days: filters.days,
      type: filters.type,
      status: filters.status,
      timeZone: filters.timeZone,
    },
    metrics: buildMetrics(rows),
    breakdowns: buildBreakdowns(rows),
    rows: rows.slice(0, rowLimit),
    totalRows: rows.length,
    generatedAt: new Date().toISOString(),
  };
}

function protectSpreadsheetText(value) {
  const text = String(value ?? '');
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function csvCell(value, protect = true) {
  const raw = protect ? protectSpreadsheetText(value) : String(value ?? '');
  const text = raw.replace(/"/g, '""');
  return /[;"\r\n]/.test(text) ? `"${text}"` : text;
}

function csvMoney(value) {
  return money(value).toFixed(2).replace('.', ',');
}

async function buildBillingReportCsv(params = {}) {
  const report = await buildBillingReport(params, { allRows: true });
  const headers = [
    'Fecha',
    'Tipo documento',
    'Número',
    'Factura relacionada',
    'Estado',
    'Validado',
    'Orden',
    'Cliente',
    'Documento cliente',
    'Correo cliente',
    'Canal',
    'Medio de pago',
    'Subtotal',
    'Descuento productos',
    'Descuento envío',
    'Descuento total',
    'Envío',
    'Base gravable',
    'IVA',
    'Total documento',
    'Impacto fiscal neto',
  ];
  const lines = [headers.map(csvCell).join(';')];

  report.rows.forEach((row) => {
    const identity = [
      row.dateKey,
      row.documentTypeLabel,
      row.number,
      row.referenceNumber,
      row.statusLabel,
      row.validated ? 'Sí' : 'No',
      row.orderNumber,
      row.customerName,
      row.customerDocument,
      row.customerEmail,
      row.channel,
      row.paymentMethod,
    ].map(csvCell);
    const amounts = [
      csvMoney(row.subtotal),
      csvMoney(row.productDiscount),
      csvMoney(row.shippingDiscount),
      csvMoney(row.totalDiscount),
      csvMoney(row.shipping),
      csvMoney(row.taxableBase),
      csvMoney(row.taxAmount),
      csvMoney(row.total),
      csvMoney(row.fiscalImpact),
    ].map((value) => csvCell(value, false));
    lines.push([...identity, ...amounts].join(';'));
  });

  return {
    buffer: Buffer.from(`\uFEFF${lines.join('\r\n')}`, 'utf8'),
    fileName: `reporte-facturacion-${report.filters.from}-a-${report.filters.to}.csv`,
    contentType: 'text/csv; charset=utf-8',
    totalRows: report.totalRows,
  };
}

module.exports = {
  REPORT_TIME_ZONE,
  buildBillingReport,
  buildBillingReportCsv,
  buildCreditNoteRow,
  buildInvoiceRow,
  normalizeReportFilters,
};
