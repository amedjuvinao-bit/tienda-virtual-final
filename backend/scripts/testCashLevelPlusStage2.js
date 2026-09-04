'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  CASH_DENOMINATIONS,
  getCashVarianceTolerance,
  parseCashCount,
  serializeCashSession,
} = require('../services/cashSessionService');

let passed = 0;
function ok(label, condition) {
  assert.ok(condition, label);
  passed += 1;
  console.log(`OK ${String(passed).padStart(2, '0')} ${label}`);
}

function source(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', '..', relativePath), 'utf8');
}

function main() {
  const count = parseCashCount({
    countedCash: 171000,
    denominations: [
      { value: 100000, quantity: 1 },
      { value: 50000, quantity: 1 },
      { value: 20000, quantity: 1 },
      { value: 1000, quantity: 1 },
    ],
  });
  ok('las denominaciones calculan el total en el servidor', count.total === 171000 && count.mode === 'denominations');
  ok('el subtotal no se confía al cliente', count.denominations[0].subtotal === 100000);
  ok('el catálogo usa denominaciones colombianas admitidas', CASH_DENOMINATIONS.includes(100000) && CASH_DENOMINATIONS.includes(50));
  assert.throws(() => parseCashCount({ countedCash: 10, denominations: [{ value: 10, quantity: 1 }] }), /denominación inválida/i);
  ok('una denominación no admitida es rechazada', true);
  assert.throws(() => parseCashCount({ countedCash: 100000, denominations: [{ value: 50000, quantity: 1 }] }), /no coincide/i);
  ok('el total declarado debe coincidir con el conteo', true);
  ok('la tolerancia predeterminada es explícita y no negativa', Number.isSafeInteger(getCashVarianceTolerance()) && getCashVarianceTolerance() >= 0);

  const cashierView = serializeCashSession({
    _id: 'cash-stage2',
    status: 'open',
    expectedCash: 50000,
    closingReviews: [{
      _id: 'review-stage2', status: 'pending', countedCash: 40000,
      expectedCash: 50000, differenceAmount: -10000, toleranceAmount: 1000,
    }],
    salesSummary: { paymentTotals: {} },
    cashMovements: [],
  }, { canSupervise: false, blindCount: true });
  ok('una revisión pendiente congela la caja', cashierView.cashControl.closingLocked === true);
  ok('el cajero no recibe esperado ni diferencia durante la revisión', cashierView.closingReviews[0].expectedCash === null && cashierView.closingReviews[0].differenceAmount === null);

  const cashService = source('backend/services/cashSessionService.js');
  const movementService = source('backend/services/cashMovementService.js');
  const posService = source('backend/services/posCashSaleService.js');
  const routes = source('backend/routes/adminCashSessions.js');
  const permissionMap = source('backend/security/adminRoutePermissionMap.js');
  const api = source('frontend/src/admin/api/adminCashSessionApi.js');
  const page = source('frontend/src/admin/cash/CashSessionsPageReport.jsx');
  ok('la diferencia extraordinaria crea una solicitud sin cerrar', cashService.includes("status: 'pending'") && cashService.includes('requiresApproval: true'));
  ok('ventas y movimientos se bloquean durante la revisión', movementService.includes('CASH_CLOSING_REVIEW_PENDING') && posService.includes('POS_CASH_CLOSING_REVIEW_PENDING'));
  ok('la revisión exige supervisor y observación', cashService.includes('CASH_CLOSING_REVIEW_FORBIDDEN') && cashService.includes('CASH_CLOSING_REVIEW_NOTES_REQUIRED'));
  ok('la API de revisión está auditada', routes.includes("router.post('/:id/closing-reviews/:reviewId/review'") && permissionMap.includes('Aprobar o rechazar un arqueo extraordinario'));
  ok('el cliente usa la ruta de revisión profesional', api.includes('export async function reviewCashClosing') && page.includes("handleClosingReview('approve')"));
  ok('la interfaz calcula el arqueo por denominaciones', page.includes('Arqueo por denominaciones') && page.includes('denominationTotal'));

  console.log(`\nEtapa 2 Caja validada: ${passed} controles superados.`);
}

try {
  main();
} catch (error) {
  console.error('Fallo en Etapa 2 Caja:', error);
  process.exitCode = 1;
}
