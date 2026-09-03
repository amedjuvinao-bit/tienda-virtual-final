'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  bogotaDayStart,
  buildOperationalAlerts,
  buildOrderReportPipeline,
  buildReconciliation,
  buildReportPeriod,
  normalizePaymentBreakdown,
  normalizeRange,
  summarizeReportStatus,
} = require('../services/posShiftReportService');

let controls = 0;

function ok(message, condition = true) {
  assert.ok(condition, message);
  controls += 1;
  console.log(`OK ${String(controls).padStart(2, '0')} ${message}`);
}

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', '..', relativePath), 'utf8');
}

function main() {
  ok('el rango desconocido se normaliza a jornada actual', normalizeRange('otro') === 'current_shift');
  ok('los tres rangos operativos son válidos', ['current_shift', 'today', 'last_7_days'].every((range) => normalizeRange(range) === range));

  const beforeMidnight = bogotaDayStart(new Date('2026-09-03T04:30:00.000Z'));
  ok('el inicio diario respeta medianoche de Colombia', beforeMidnight.toISOString() === '2026-09-02T05:00:00.000Z');
  const afterMidnight = bogotaDayStart(new Date('2026-09-03T05:30:00.000Z'));
  ok('el cambio de día ocurre a las 05:00 UTC', afterMidnight.toISOString() === '2026-09-03T05:00:00.000Z');

  const sessionPeriod = buildReportPeriod({
    range: 'current_shift',
    now: new Date('2026-09-03T20:00:00.000Z'),
    currentSession: { openedAt: new Date('2026-09-03T13:00:00.000Z') },
  });
  ok('la jornada abierta inicia exactamente en la apertura de caja', sessionPeriod.start.toISOString() === '2026-09-03T13:00:00.000Z');
  ok('una jornada abierta no activa fallback', sessionPeriod.fallback === false && sessionPeriod.effectiveRange === 'current_shift');

  const fallbackPeriod = buildReportPeriod({
    range: 'current_shift',
    now: new Date('2026-09-03T20:00:00.000Z'),
  });
  ok('sin caja abierta la jornada vuelve al día actual', fallbackPeriod.fallback === true && fallbackPeriod.effectiveRange === 'today');
  ok('el reporte declara la zona horaria operacional', fallbackPeriod.timezone === 'America/Bogota');

  const weekPeriod = buildReportPeriod({
    range: 'last_7_days',
    now: new Date('2026-09-03T20:00:00.000Z'),
  });
  ok('últimos siete días incluyen hoy y seis días anteriores', weekPeriod.start.toISOString() === '2026-08-28T05:00:00.000Z');

  const payments = normalizePaymentBreakdown([
    { _id: 'cash', amount: 45000 },
    { _id: 'card', amount: 30000 },
    { _id: 'unknown', amount: 5000 },
  ]);
  ok('el resumen conserva efectivo y tarjeta por separado', payments.cash === 45000 && payments.card === 30000);
  ok('un medio desconocido queda agrupado como otro', payments.other === 5000);
  ok('el total de pagos se calcula en el servidor', payments.total === 80000);

  const reconciliation = buildReconciliation({
    status: 'open',
    openingAmount: 50000,
    expectedCash: 98000,
    countedCash: 0,
    salesSummary: { paymentTotals: { cash: 45000 } },
    cashMovements: [
      { direction: 'in', amount: 5000 },
      { direction: 'out', amount: 2000 },
      { direction: 'neutral', amount: 50000 },
    ],
  });
  ok('la conciliación expone base y venta en efectivo', reconciliation.openingAmount === 50000 && reconciliation.cashSales === 45000);
  ok('la conciliación distingue entradas y salidas manuales', reconciliation.cashIn === 5000 && reconciliation.cashOut === 2000);
  ok('una caja abierta queda pendiente de arqueo', reconciliation.status === 'pending_count' && reconciliation.expectedCash === 98000);
  ok('sin caja existe un estado explícito y cifras neutras', buildReconciliation().status === 'no_session' && buildReconciliation().expectedCash === 0);

  const alerts = buildOperationalAlerts({
    cashSessionRequired: true,
    currentSession: null,
    metrics: {
      missingCashSessionCount: 1,
      invoiceFailedCount: 1,
      invoicePendingCount: 2,
      refundReconciliationIssueCount: 1,
    },
    heldSales: { activeCount: 3 },
  });
  ok('se detecta caja requerida sin sesión abierta', alerts.some((alert) => alert.code === 'cash_session_required'));
  ok('se detectan ventas huérfanas de caja', alerts.some((alert) => alert.code === 'sales_without_cash_session'));
  ok('se detectan fallos de facturación', alerts.some((alert) => alert.code === 'invoice_failed'));
  ok('se detectan reembolsos por conciliar', alerts.some((alert) => alert.code === 'refund_reconciliation'));
  ok('se distinguen pendientes fiscales no críticos', alerts.some((alert) => alert.code === 'invoice_pending' && alert.severity === 'attention'));
  ok('se contabilizan ventas todavía en espera', alerts.some((alert) => alert.code === 'held_sales'));
  ok('un hallazgo crítico domina el estado general', summarizeReportStatus(alerts) === 'critical');
  ok('solo pendientes producen estado de atención', summarizeReportStatus([{ severity: 'attention' }]) === 'attention');
  ok('sin alertas la jornada queda saludable', summarizeReportStatus([]) === 'healthy');

  const pipelineText = JSON.stringify(buildOrderReportPipeline({ source: 'pos' }));
  ok('las métricas se calculan con agregación Mongo y no con paginación', pipelineText.includes('$facet') && !pipelineText.includes('$skip') && !pipelineText.includes('$limit'));
  ok('el pago mixto se desglosa desde splitPayments', pipelineText.includes('splitPayments') && pipelineText.includes('$unwind'));
  ok('ventas anuladas se separan de ventas confirmadas', pipelineText.includes('cancelled') && pipelineText.includes('canceled'));
  const billingPipelineText = JSON.stringify(buildOrderReportPipeline(
    { source: 'pos' },
    { billingActive: true, invoiceCollectionName: 'electronic_invoices' }
  ));
  ok('la auditoría fiscal consulta la colección oficial de facturas', billingPipelineText.includes('$lookup') && billingPipelineText.includes('electronic_invoices'));

  const route = read('backend/routes/adminPos.js');
  const service = read('backend/services/posShiftReportService.js');
  const api = read('frontend/src/admin/api/adminPosApi.js');
  const operations = read('frontend/src/admin/pos/PosOperationsPanel.jsx');
  const reportPanel = read('frontend/src/admin/pos/PosShiftReportPanel.jsx');
  const reportModel = read('frontend/src/admin/pos/posShiftReportModel.js');

  ok('el reporte exige permiso pos:view', route.includes("router.get('/shift-summary', requirePermission('pos:view')"));
  ok('el endpoint aplica alcance de sede antes de consultar', route.includes('buildPosResourceAccess') && route.includes('requestedBranchId: branchId'));
  ok('la respuesta declara autoridad del servidor', service.includes("serverAuthoritative: true"));
  ok('la interfaz integra Jornada en el centro operativo', operations.includes("openView('shift')") && operations.includes('<PosShiftReportPanel'));
  ok('Jornada enlaza Caja y Finanzas sin duplicar sus acciones', reportPanel.includes('to="/admin/caja"') && reportPanel.includes('to="/admin/finanzas"'));
  ok('el reporte puede descargarse como CSV reutilizable', reportModel.includes('buildPosShiftReportCsv') && reportPanel.includes('downloadPosShiftReportCsv'));
  ok('la API del panel consume el endpoint protegido', api.includes('function getPosShiftSummary') && api.includes('/shift-summary'));

  console.log(`\nEtapa 4 POS validada: ${controls} controles superados.`);
}

try {
  main();
} catch (error) {
  console.error('Fallo en Etapa 4 POS:', error);
  process.exitCode = 1;
}
