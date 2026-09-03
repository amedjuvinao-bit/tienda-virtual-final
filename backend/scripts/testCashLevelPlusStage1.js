'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');

const CashSession = require('../models/CashSession');
const { serializeCashSession } = require('../services/cashSessionService');
const { movementRequiresSupervisorApproval } = require('../services/cashMovementService');
const { canSuperviseCashSession } = require('../services/adminPosAccessService');

let controls = 0;

function ok(message, condition = true) {
  assert.ok(condition, message);
  controls += 1;
  console.log(`OK ${String(controls).padStart(2, '0')} ${message}`);
}

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', '..', relativePath), 'utf8');
}

async function main() {
  const branchId = new mongoose.Types.ObjectId();
  const cashierId = new mongoose.Types.ObjectId();
  const session = new CashSession({
    branch: branchId,
    cashier: cashierId,
    openingAmount: 50000,
    salesSummary: { paymentTotals: { cash: 20000 } },
    cashMovements: [
      {
        type: 'withdrawal',
        amount: 10000,
        direction: 'out',
        reason: 'Solicitud pendiente',
        approvalRequired: true,
        approvalStatus: 'pending',
      },
    ],
  });
  await session.validate();

  ok('un movimiento pendiente no modifica el efectivo esperado', session.expectedCash === 70000);

  session.cashMovements[0].approvalStatus = 'approved';
  await session.validate();
  ok('un movimiento aprobado se aplica exactamente una vez', session.expectedCash === 60000);

  const legacyMovement = { approvalStatus: undefined };
  ok('un movimiento heredado sin estado conserva su efecto histórico', CashSession.isAppliedCashMovement(legacyMovement));
  ok('un movimiento rechazado queda fuera de los cálculos', !CashSession.isAppliedCashMovement({ approvalStatus: 'rejected' }));

  ok(
    'las salidas del cajero exigen aprobación de supervisor',
    movementRequiresSupervisorApproval({ direction: 'out' }, { canSupervise: false })
  );
  ok(
    'los ingresos del cajero se aplican sin aprobación',
    !movementRequiresSupervisorApproval({ direction: 'in' }, { canSupervise: false })
  );
  ok(
    'un supervisor puede registrar una salida directamente',
    !movementRequiresSupervisorApproval({ direction: 'out' }, { canSupervise: true })
  );

  ok(
    'owner admin y manager tienen autoridad de supervisión',
    ['owner', 'admin', 'manager'].every((adminRole) =>
      canSuperviseCashSession({ adminAuthType: 'session', adminRole })
    )
  );
  ok(
    'seller y cashier no reciben autoridad de supervisión',
    ['seller', 'cashier'].every((adminRole) =>
      !canSuperviseCashSession({ adminAuthType: 'session', adminRole })
    )
  );

  session.cashMovements[0].approvalStatus = 'pending';
  await session.validate();
  const blindView = serializeCashSession(session, { canSupervise: false, blindCount: true });
  ok(
    'el arqueo ciego oculta esperado contado y diferencia durante la apertura',
    blindView.expectedCash === null && blindView.countedCash === null && blindView.differenceAmount === null
  );
  ok(
    'el arqueo ciego oculta totales monetarios pero conserva conteos operativos',
    blindView.salesSummary.netSales === null &&
      blindView.salesSummary.paymentTotals.cash === null &&
      blindView.salesSummary.ordersCount === 0
  );
  ok(
    'la respuesta declara el modo ciego y las solicitudes pendientes',
    blindView.cashControl.blindCountActive === true &&
      blindView.cashControl.canSupervise === false &&
      blindView.cashControl.pendingMovementsCount === 1
  );

  const supervisorView = serializeCashSession(session, { canSupervise: true });
  ok(
    'la vista supervisor conserva cifras y capacidad de revisión',
    supervisorView.expectedCash === 70000 && supervisorView.cashControl.canReviewMovements === true
  );

  session.status = 'closed';
  session.countedCash = 70000;
  await session.validate();
  const closedCashierView = serializeCashSession(session, { canSupervise: false, blindCount: true });
  ok(
    'el cierre revela el resultado final incluso al cajero',
    closedCashierView.expectedCash === 70000 && closedCashierView.countedCash === 70000
  );

  const sessionService = read('backend/services/cashSessionService.js');
  const movementService = read('backend/services/cashMovementService.js');
  const routes = read('backend/routes/adminCashSessions.js');
  const permissionMap = read('backend/security/adminRoutePermissionMap.js');
  const api = read('frontend/src/admin/api/adminCashSessionApi.js');
  const page = read('frontend/src/admin/cash/CashSessionsPageReport.jsx');
  const workflow = read('.github/workflows/pos-ci.yml');

  ok(
    'el servidor bloquea el cierre mientras existan aprobaciones pendientes',
    sessionService.includes("'CASH_PENDING_MOVEMENTS'") &&
      sessionService.includes('getPendingCashMovements(session)')
  );
  ok(
    'la revisión exige supervisor y una decisión pendiente única',
    movementService.includes("'CASH_MOVEMENT_REVIEW_FORBIDDEN'") &&
      movementService.includes("movement.approvalStatus !== 'pending'")
  );
  ok(
    'la trazabilidad conserva revisor fecha y observación',
    movementService.includes('movement.reviewedBySnapshot =') &&
      movementService.includes('movement.reviewedAt = new Date()') &&
      movementService.includes('movement.reviewNotes = reviewNotes')
  );
  ok(
    'la API expone una ruta auditada para aprobar o rechazar',
    routes.includes("router.post('/:id/movements/:movementId/review'") &&
      permissionMap.includes("path: '/api/admin/cash-sessions/:id/movements/:movementId/review'") &&
      permissionMap.includes("description: 'Aprobar o rechazar un movimiento pendiente como supervisor de caja.'")
  );
  ok(
    'el cliente usa la API de revisión sin mutaciones manuales del DOM',
    api.includes('export async function reviewCashMovement') &&
      page.includes('<MovementReviewDialog') &&
      !page.includes('window.prompt(')
  );
  ok(
    'la interfaz no precarga el contado con el valor esperado',
    page.includes("setCountedCash('');") && !page.includes('String(session.expectedCash)')
  );
  ok(
    'CI conserva contratos e integración aislada de Caja Etapa 1',
    workflow.includes('test:cash-level-plus-stage1') &&
      workflow.includes('CASH_STAGE1_MONGO_URI')
  );

  console.log(`\nEtapa 1 Caja validada: ${controls} controles superados.`);
}

main().catch((error) => {
  console.error('Fallo en Etapa 1 Caja:', error);
  process.exitCode = 1;
});
