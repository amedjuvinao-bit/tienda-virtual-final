'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  bogotaDayStart,
  buildCashReconciliation,
  buildSummaryPeriod,
} = require('../services/cashReconciliationService');
const { serializeCashSession } = require('../services/cashSessionService');

let passed = 0;
function ok(label, condition) {
  assert.ok(condition, label);
  passed += 1;
  console.log(`OK ${String(passed).padStart(2, '0')} ${label}`);
}

function source(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', '..', relativePath), 'utf8');
}

function balancedSession(overrides = {}) {
  return {
    _id: 'cash-stage3', status: 'closed', openingAmount: 50000,
    expectedCash: 95000, countedCash: 95000, differenceAmount: 0,
    salesSummary: {
      ordersCount: 2, netSales: 70000,
      paymentTotals: { cash: 45000, transfer: 25000, card: 0, mixed: 0, other: 0, total: 70000 },
    },
    cashMovements: [
      { type: 'opening', amount: 50000, direction: 'neutral', approvalStatus: 'not_required' },
      { type: 'cash_in', amount: 10000, direction: 'in', approvalStatus: 'not_required' },
      { type: 'cash_out', amount: 10000, direction: 'out', approvalStatus: 'approved' },
    ],
    closingReviews: [],
    ...overrides,
  };
}

function main() {
  const balanced = buildCashReconciliation(balancedSession(), { toleranceAmount: 1000 });
  ok('la conciliación cruza ventas netas y medios de pago', balanced.checks.find((item) => item.code === 'sales_vs_payments')?.status === 'ok');
  ok('la fórmula reconstruye el efectivo esperado', balanced.calculatedExpectedCash === 95000 && balanced.checks.find((item) => item.code === 'expected_cash_formula')?.status === 'ok');
  ok('un cierre exacto queda conciliado', balanced.status === 'balanced' && balanced.final === true);

  const paymentMismatch = buildCashReconciliation(balancedSession({
    salesSummary: { ordersCount: 2, netSales: 70000, paymentTotals: { cash: 45000, transfer: 15000, total: 60000 } },
  }), { toleranceAmount: 1000 });
  ok('una inconsistencia entre venta y pago es crítica', paymentMismatch.status === 'critical');

  const pending = buildCashReconciliation(balancedSession({
    status: 'open', countedCash: 0,
    cashMovements: [{ type: 'cash_out', amount: 5000, direction: 'out', approvalStatus: 'pending' }],
    closingReviews: [{ status: 'pending' }],
  }), { toleranceAmount: 1000 });
  ok('las decisiones pendientes dejan la jornada en atención', pending.status === 'attention' && pending.pendingMovements === 1 && pending.pendingClosingReviews === 1);

  const supervisorView = serializeCashSession(balancedSession(), { canSupervise: true, blindCount: false });
  ok('el supervisor recibe controles completos de conciliación', supervisorView.reconciliation.checks.length >= 3);
  const cashierView = serializeCashSession(balancedSession({ status: 'open' }), { canSupervise: false, blindCount: true });
  ok('el cajero no recibe valores conciliados durante el conteo ciego', cashierView.reconciliation.status === 'protected' && cashierView.reconciliation.checks === undefined);

  const now = new Date('2026-09-04T15:00:00.000Z');
  ok('el inicio diario respeta la zona America/Bogota', bogotaDayStart(now).toISOString() === '2026-09-04T05:00:00.000Z');
  const period = buildSummaryPeriod('last_7_days', now);
  ok('el consolidado de siete días usa un período explícito', period.range === 'last_7_days' && period.end.toISOString() === now.toISOString());

  const model = source('backend/models/CashSession.js');
  const service = source('backend/services/cashReconciliationService.js');
  const routes = source('backend/routes/adminCashSessions.js');
  const permissionMap = source('backend/security/adminRoutePermissionMap.js');
  const api = source('frontend/src/admin/api/adminCashSessionApi.js');
  const page = source('frontend/src/admin/cash/CashSessionsPageReport.jsx');
  const posRoutes = source('backend/routes/adminPos.js');
  const posPage = source('frontend/src/admin/pos/PosSalesPageSafe.jsx');
  const posOperations = source('frontend/src/admin/pos/PosOperationsPanel.jsx');
  ok('el cierre conserva una instantánea autoritativa', model.includes('CashReconciliationSchema') && source('backend/services/cashSessionService.js').includes('recalculatedSession.reconciliation = buildCashReconciliation'));
  ok('el consolidado limita alcance, rango y volumen', service.includes('branchIds') && service.includes("limit(500)") && service.includes('SUMMARY_RANGES'));
  ok('la ruta de jornada exige supervisión y está declarada', routes.includes("router.get('/journey-summary'") && routes.includes('CASH_JOURNEY_FORBIDDEN') && permissionMap.includes('consolidado conciliado'));
  ok('la interfaz consume el consolidado sin cálculo manual', api.includes('getCashJourneySummary') && page.includes('Conciliación automática de caja'));
  ok('el reporte imprime los controles de conciliación', page.includes('cash-report-reconciliation') && page.includes('<h2>Conciliación automática</h2>'));
  ok('las respuestas de venta POS conservan el conteo ciego', posRoutes.includes('blindCount: cashAccess.canSupervise !== true'));
  ok('el resumen monetario POS exige supervisión', posRoutes.includes('POS_SHIFT_SUMMARY_FORBIDDEN') && posRoutes.includes('canSuperviseCashSession(req)'));
  ok('el POS presenta valores protegidos como ocultos', posPage.includes('protectedMoney') && posPage.includes('Efectivo esperado {protectedMoney') && posOperations.includes('canSuperviseCash ?'));

  console.log(`\nEtapa 3 Caja validada: ${passed} controles superados.`);
}

try {
  main();
} catch (error) {
  console.error('Fallo en Etapa 3 Caja:', error);
  process.exitCode = 1;
}
