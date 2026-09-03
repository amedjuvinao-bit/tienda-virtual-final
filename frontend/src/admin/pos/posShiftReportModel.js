export const POS_REPORT_RANGES = Object.freeze([
  { value: 'current_shift', label: 'Jornada actual' },
  { value: 'today', label: 'Hoy' },
  { value: 'last_7_days', label: 'Últimos 7 días' },
]);

export const POS_PAYMENT_LABELS = Object.freeze({
  cash: 'Efectivo',
  transfer: 'Transferencia',
  card: 'Tarjeta / Datáfono',
  mixed: 'Pago mixto sin desglose',
  other: 'Otros medios',
});

const DEFAULT_REPORT_TIMEZONE = 'America/Bogota';

function number(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function csvCell(value) {
  const text = String(value ?? '').replace(/"/g, '""');
  return `"${text}"`;
}

function reportTimezone(value) {
  const timezone = String(value || DEFAULT_REPORT_TIMEZONE).trim();
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(0);
    return timezone;
  } catch {
    return DEFAULT_REPORT_TIMEZONE;
  }
}

function zonedDateParts(value, timezone) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: reportTimezone(timezone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date).reduce((result, part) => {
    if (part.type !== 'literal') result[part.type] = part.value;
    return result;
  }, {});

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    dateTime: `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`,
  };
}

export function formatPosReportDateTime(value, timezone = DEFAULT_REPORT_TIMEZONE) {
  return zonedDateParts(value, timezone)?.dateTime || '';
}

export function getPosShiftReportFilename(report = {}) {
  const timezone = reportTimezone(report.period?.timezone);
  const date = zonedDateParts(report.generatedAt || report.period?.end, timezone)?.date || 'reporte';
  const branch = String(report.branch?.code || 'sede')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `jornada-pos-${branch || 'sede'}-${date}.csv`;
}

export function getPosReportStatus(report = {}) {
  if (report.status === 'critical') {
    return {
      label: 'Requiere atención',
      detail: 'Hay diferencias operativas que deben revisarse antes del cierre.',
      tone: 'critical',
    };
  }
  if (report.status === 'attention') {
    return {
      label: 'Con pendientes',
      detail: 'La jornada puede continuar, pero conserva tareas operativas abiertas.',
      tone: 'attention',
    };
  }
  return {
    label: 'Operación al día',
    detail: 'No se detectaron pendientes críticos para el periodo consultado.',
    tone: 'healthy',
  };
}

export function getPaymentRows(report = {}) {
  const breakdown = report.paymentBreakdown || {};
  return Object.entries(POS_PAYMENT_LABELS)
    .map(([key, label]) => ({ key, label, amount: number(breakdown[key]) }))
    .filter((row) => row.amount > 0);
}

export function buildPosShiftReportCsv(report = {}) {
  const metrics = report.metrics || {};
  const reconciliation = report.reconciliation || {};
  const heldSales = report.heldSales || {};
  const timezone = reportTimezone(report.period?.timezone);
  const rows = [
    ['REPORTE OPERATIVO POS', report.branch?.name || ''],
    ['Sede', report.branch?.code || ''],
    ['Caja', report.cashRegisterCode || ''],
    ['Periodo desde', formatPosReportDateTime(report.period?.start, timezone)],
    ['Periodo hasta', formatPosReportDateTime(report.period?.end, timezone)],
    ['Zona horaria', timezone],
    ['Generado', formatPosReportDateTime(report.generatedAt, timezone)],
    [],
    ['VENTAS', 'Valor'],
    ['Ventas confirmadas', number(metrics.ordersCount)],
    ['Unidades', number(metrics.itemsCount)],
    ['Venta bruta', number(metrics.grossSales)],
    ['Descuentos', number(metrics.discounts)],
    ['Reembolsos', number(metrics.refunds)],
    ['Venta neta', number(metrics.netSales)],
    ['Ticket promedio', number(metrics.averageTicket)],
    ['Anulaciones', number(metrics.cancelledOrdersCount)],
    [],
    ['MEDIOS DE PAGO', 'Valor'],
    ...getPaymentRows(report).map((row) => [row.label, row.amount]),
    ['Total cobrado', number(report.paymentBreakdown?.total)],
    [],
    ['CONCILIACIÓN DE CAJA', 'Valor'],
    ['Base inicial', number(reconciliation.openingAmount)],
    ['Ventas en efectivo', number(reconciliation.cashSales)],
    ['Entradas manuales', number(reconciliation.cashIn)],
    ['Salidas manuales', number(reconciliation.cashOut)],
    ['Efectivo esperado', number(reconciliation.expectedCash)],
    ['Efectivo contado', number(reconciliation.countedCash)],
    ['Diferencia', number(reconciliation.differenceAmount)],
    [],
    ['CONTROL OPERATIVO', 'Cantidad'],
    ['Ventas activas en espera', number(heldSales.activeCount)],
    ['Ventas sin caja asociada', number(metrics.missingCashSessionCount)],
    ['Facturas pendientes', number(metrics.invoicePendingCount)],
    ['Facturas fallidas', number(metrics.invoiceFailedCount)],
    ['Reembolsos por conciliar', number(metrics.refundReconciliationIssueCount)],
  ];

  return `\uFEFF${rows.map((row) => row.map(csvCell).join(';')).join('\r\n')}`;
}

export function downloadPosShiftReportCsv(report = {}) {
  const csv = buildPosShiftReportCsv(report);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = getPosShiftReportFilename(report);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}
