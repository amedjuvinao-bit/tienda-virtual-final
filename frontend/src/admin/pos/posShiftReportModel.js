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

function number(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function csvCell(value) {
  const text = String(value ?? '').replace(/"/g, '""');
  return `"${text}"`;
}

function isoDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : '';
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
  const rows = [
    ['REPORTE OPERATIVO POS', report.branch?.name || ''],
    ['Sede', report.branch?.code || ''],
    ['Caja', report.cashRegisterCode || ''],
    ['Periodo desde', isoDate(report.period?.start)],
    ['Periodo hasta', isoDate(report.period?.end)],
    ['Zona horaria', report.period?.timezone || 'America/Bogota'],
    ['Generado', isoDate(report.generatedAt)],
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
  const date = isoDate(report.generatedAt).slice(0, 10) || 'reporte';
  const branch = String(report.branch?.code || 'sede')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `jornada-pos-${branch || 'sede'}-${date}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}
