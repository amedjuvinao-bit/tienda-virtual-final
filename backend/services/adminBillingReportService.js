'use strict';

// Reportes administrativos de Facturación.
// ElectronicInvoice y Order siguen siendo las únicas fuentes de datos.

const ElectronicInvoice = require('../models/ElectronicInvoice');
const Order = require('../models/Order');
const { once } = require('events');
const {
  buildBillingReportCountPipeline,
  buildBillingReportPipeline,
  buildBillingReportRowsPipeline,
} = require('./adminBillingReportAggregationService');

const REPORT_TIME_ZONE = 'America/Bogota';
const REPORT_OFFSET = '-05:00';
const MAX_REPORT_DAYS = 366;
const REPORT_QUERY_TIMEOUT_MS = 30_000;
const REPORT_CSV_BATCH_SIZE = 250;
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

function configureReportAggregation(aggregation) {
  if (aggregation && typeof aggregation.allowDiskUse === 'function') {
    aggregation.allowDiskUse(true);
  }
  if (aggregation && typeof aggregation.option === 'function') {
    aggregation.option({ maxTimeMS: REPORT_QUERY_TIMEOUT_MS });
  }
  return aggregation;
}

async function executeReportAggregation(pipeline) {
  const aggregation = configureReportAggregation(
    ElectronicInvoice.aggregate(pipeline)
  );
  if (aggregation && typeof aggregation.exec === 'function') {
    return aggregation.exec();
  }
  return aggregation;
}

function createReportRowsCursor(pipeline) {
  const aggregation = configureReportAggregation(
    ElectronicInvoice.aggregate(pipeline)
  );
  if (!aggregation || typeof aggregation.cursor !== 'function') {
    throw reportError(
      'No fue posible iniciar la exportación por lotes.',
      'BILLING_REPORT_CURSOR_UNAVAILABLE',
      503
    );
  }
  return aggregation.cursor({ batchSize: REPORT_CSV_BATCH_SIZE });
}

function emptyMetrics() {
  return {
    documents: 0,
    invoices: 0,
    validatedInvoices: 0,
    creditNotes: 0,
    validatedCreditNotes: 0,
    errors: 0,
    invoiced: 0,
    credited: 0,
    net: 0,
    discounts: 0,
    shipping: 0,
    taxableBase: 0,
    invoiceTax: 0,
    creditedTax: 0,
    netTax: 0,
  };
}

function normalizeMetrics(value = {}) {
  const normalized = emptyMetrics();
  Object.keys(normalized).forEach((key) => {
    normalized[key] = key === 'documents' ||
      key === 'invoices' ||
      key === 'validatedInvoices' ||
      key === 'creditNotes' ||
      key === 'validatedCreditNotes' ||
      key === 'errors'
      ? Math.max(0, Math.floor(Number(value[key] || 0)))
      : money(value[key]);
  });
  return normalized;
}

function normalizeBreakdownRows(rows = [], kind = '') {
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    key: cleanText(row?.key || 'unknown', 80),
    label: kind === 'status'
      ? statusLabel(cleanText(row?.key || 'pending', 40))
      : cleanText(row?.label || row?.key || 'Sin dato', 120),
    documents: Math.max(0, Math.floor(Number(row?.documents || 0))),
    invoices: Math.max(0, Math.floor(Number(row?.invoices || 0))),
    creditNotes: Math.max(0, Math.floor(Number(row?.creditNotes || 0))),
    invoiced: money(row?.invoiced),
    credited: money(row?.credited),
    net: money(row?.net),
  }));
}

function normalizeAggregatedRow(row = {}) {
  const documentType = row.documentType === 'credit_note'
    ? 'credit_note'
    : 'invoice';
  const status = cleanText(row.status || 'pending', 40).toLowerCase();
  const validated = row.validated === true;
  const total = money(row.total);
  const customer = row.customer || {};

  return {
    id: String(row.id || ''),
    documentType,
    documentTypeLabel: documentTypeLabel(documentType),
    date: row.date || null,
    dateKey: cleanText(row.dateKey, 10),
    number: row.number || 'Sin número',
    referenceNumber: row.referenceNumber || '',
    orderNumber: row.orderNumber || '',
    status,
    statusLabel: statusLabel(status),
    validated,
    customerName: customerName(customer),
    customerDocument: cleanText(customer.documentNumber, 80),
    customerEmail: cleanText(customer.email, 180),
    channelKey: cleanText(row.channelKey || 'unknown', 60),
    channel: cleanText(row.channel || 'Sin canal', 100),
    paymentMethodKey: cleanText(row.paymentMethodKey || 'unknown', 60),
    paymentMethod: cleanText(row.paymentMethod || 'Sin medio de pago', 100),
    subtotal: money(row.subtotal),
    productDiscount: money(row.productDiscount),
    shippingDiscount: money(row.shippingDiscount),
    totalDiscount: money(row.totalDiscount),
    shipping: money(row.shipping),
    taxableBase: money(row.taxableBase),
    taxAmount: money(row.taxAmount),
    total,
    fiscalImpact: validated
      ? money(documentType === 'credit_note' ? -total : total)
      : 0,
  };
}

function publicFilters(filters) {
  return {
    from: filters.from,
    to: filters.to,
    days: filters.days,
    type: filters.type,
    status: filters.status,
    timeZone: filters.timeZone,
  };
}

async function buildBillingReport(params = {}) {
  const filters = normalizeReportFilters(params);
  const pipeline = buildBillingReportPipeline({
    filters,
    orderCollectionName: Order.collection?.name || 'orders',
    rowLimit: 30,
  });
  const [result = {}] = await executeReportAggregation(pipeline);
  const metrics = normalizeMetrics(
    Array.isArray(result.metrics) ? result.metrics[0] : null
  );

  return {
    filters: publicFilters(filters),
    metrics,
    breakdowns: {
      statuses: normalizeBreakdownRows(result.statuses, 'status'),
      paymentMethods: normalizeBreakdownRows(result.paymentMethods),
      channels: normalizeBreakdownRows(result.channels),
      daily: normalizeBreakdownRows(result.daily),
    },
    rows: (Array.isArray(result.rows) ? result.rows : [])
      .map(normalizeAggregatedRow),
    totalRows: metrics.documents,
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

const CSV_HEADERS = [
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

function buildCsvLine(row) {
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
  return [...identity, ...amounts].join(';');
}

async function writeCsvChunk(writable, chunk) {
  if (writable.destroyed || writable.writableEnded) return false;
  if (writable.write(chunk)) return true;
  await once(writable, 'drain');
  return !(writable.destroyed || writable.writableEnded);
}

async function prepareBillingReportCsv(params = {}) {
  const filters = normalizeReportFilters(params);
  const orderCollectionName = Order.collection?.name || 'orders';
  const countPipeline = buildBillingReportCountPipeline({
    filters,
    orderCollectionName,
  });
  const [count = {}] = await executeReportAggregation(countPipeline);
  const totalRows = Math.max(0, Math.floor(Number(count.totalRows || 0)));

  return {
    fileName: `reporte-facturacion-${filters.from}-a-${filters.to}.csv`,
    contentType: 'text/csv; charset=utf-8',
    totalRows,
    async streamTo(writable) {
      const rowsPipeline = buildBillingReportRowsPipeline({
        filters,
        orderCollectionName,
      });
      const cursor = createReportRowsCursor(rowsPipeline);
      let rowsWritten = 0;

      try {
        const header = `\uFEFF${CSV_HEADERS.map(csvCell).join(';')}`;
        if (!(await writeCsvChunk(writable, header))) return rowsWritten;

        for await (const rawRow of cursor) {
          const row = normalizeAggregatedRow(rawRow);
          if (!(await writeCsvChunk(writable, `\r\n${buildCsvLine(row)}`))) {
            break;
          }
          rowsWritten += 1;
        }
      } finally {
        if (cursor && typeof cursor.close === 'function') {
          await cursor.close().catch(() => {});
        }
      }

      return rowsWritten;
    },
  };
}

module.exports = {
  REPORT_TIME_ZONE,
  buildBillingReport,
  normalizeReportFilters,
  prepareBillingReportCsv,
};
