'use strict';

const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const Branch = require('../models/Branch');
const CashSession = require('../models/CashSession');
const {
  closeCashSession,
  getCashSessionById,
  openCashSession,
  reviewCashClosing,
  serializeCashSession,
} = require('../services/cashSessionService');
const { addManualCashMovement } = require('../services/cashMovementService');
const { resolveCashSessionForSale } = require('../services/posCashSaleService');

const MONGO_URI = String(process.env.CASH_STAGE2_MONGO_URI || '').trim();
const EXPECTED_DATABASE = 'cash_stage2_ci';

function assertDedicatedDatabase(uri) {
  if (!/^mongodb(?:\+srv)?:\/\//i.test(uri)) throw new Error('CASH_STAGE2_MONGO_URI es obligatoria.');
  if (uri.split('?')[0].split('/').pop() !== EXPECTED_DATABASE) {
    throw new Error(`La prueba solo puede ejecutarse en la base aislada ${EXPECTED_DATABASE}.`);
  }
}

async function main() {
  assertDedicatedDatabase(MONGO_URI);
  await mongoose.connect(MONGO_URI, { autoIndex: false });
  try {
    await mongoose.connection.dropDatabase();
    await Promise.all([Branch.createIndexes(), CashSession.createIndexes()]);
    const branch = await Branch.create({
      name: 'Sede Caja Etapa 2 CI', code: 'CASH-STAGE2', type: 'store',
      status: 'active', active: true,
      settings: { allowPosSales: true, requireCashSessionForPos: true },
    });
    const cashier = { id: new mongoose.Types.ObjectId(), username: 'cajero.stage2', displayName: 'Cajero Etapa 2', role: 'cashier', adminRole: 'cashier' };
    const supervisor = { id: new mongoose.Types.ObjectId(), username: 'supervisor.stage2', displayName: 'Supervisor Etapa 2', role: 'manager', adminRole: 'manager' };
    const cashierAccess = { admin: cashier, branchIds: [branch._id], canSupervise: false };
    const supervisorAccess = { admin: supervisor, branchIds: [branch._id], canSupervise: true };

    const direct = await openCashSession({ branchId: branch._id, cashRegisterCode: 'CAJA STAGE2 DIRECTA', openingAmount: 50000 }, { admin: cashier });
    const directClosed = await closeCashSession(direct._id, {
      countedCash: 50000,
      denominations: [{ value: 50000, quantity: 1 }],
      closingNotes: 'Conteo exacto',
    }, cashierAccess);
    assert.equal(directClosed.status, 'closed');
    assert.equal(directClosed.cashCount.mode, 'denominations');
    assert.equal(directClosed.cashCount.total, 50000);
    console.log('OK 01 un arqueo exacto por denominaciones cierra directamente');

    const opened = await openCashSession({ branchId: branch._id, cashRegisterCode: 'CAJA STAGE2', openingAmount: 50000 }, { admin: cashier });
    const pending = await closeCashSession(opened._id, {
      countedCash: 40000,
      denominations: [{ value: 20000, quantity: 2 }],
      closingNotes: 'Faltante detectado',
    }, cashierAccess);
    const review = pending.closingReviews.at(-1);
    assert.equal(pending.status, 'open');
    assert.equal(review.status, 'pending');
    assert.equal(review.differenceAmount, -10000);
    assert.equal(pending.$locals.cashClosingOutcome.requiresApproval, true);
    console.log('OK 02 una diferencia fuera de tolerancia solicita supervisión sin cerrar');

    const blind = serializeCashSession(pending, { canSupervise: false, blindCount: true });
    assert.equal(blind.cashControl.closingLocked, true);
    assert.equal(blind.closingReviews.at(-1).expectedCash, null);
    assert.equal(blind.closingReviews.at(-1).differenceAmount, null);
    console.log('OK 03 el cajero conserva el conteo ciego durante la revisión');

    await assert.rejects(
      addManualCashMovement(opened._id, { type: 'cash_in', amount: 1000, reason: 'Intento bloqueado' }, cashierAccess),
      (error) => error?.code === 'CASH_CLOSING_REVIEW_PENDING'
    );
    await assert.rejects(
      resolveCashSessionForSale({ cashRegisterCode: 'CAJA STAGE2' }, branch),
      (error) => error?.code === 'POS_CASH_CLOSING_REVIEW_PENDING'
    );
    console.log('OK 04 la solicitud congela movimientos y ventas POS');

    await assert.rejects(
      reviewCashClosing(opened._id, review._id, { decision: 'approve', reviewNotes: 'Intento' }, cashierAccess),
      (error) => error?.code === 'CASH_CLOSING_REVIEW_FORBIDDEN'
    );
    console.log('OK 05 el cajero no puede aprobar su propio arqueo');

    const rejected = await reviewCashClosing(opened._id, review._id, {
      decision: 'reject', reviewNotes: 'Repetir el conteo con testigo',
    }, supervisorAccess);
    assert.equal(rejected.status, 'open');
    assert.equal(rejected.closingReviews.id(review._id).status, 'rejected');
    console.log('OK 06 el rechazo conserva la caja abierta y la trazabilidad');

    const unlocked = await addManualCashMovement(opened._id, { type: 'cash_in', amount: 1000, reason: 'Fondo verificado' }, cashierAccess);
    assert.equal(unlocked.expectedCash, 51000);
    console.log('OK 07 rechazar desbloquea nuevamente la operación');

    const pendingAgain = await closeCashSession(opened._id, {
      countedCash: 40000,
      denominations: [{ value: 20000, quantity: 2 }],
      closingNotes: 'Segundo conteo confirmado',
    }, cashierAccess);
    const secondReview = pendingAgain.closingReviews.at(-1);
    const decisions = await Promise.allSettled([
      reviewCashClosing(opened._id, secondReview._id, { decision: 'approve', reviewNotes: 'Faltante autorizado' }, supervisorAccess),
      reviewCashClosing(opened._id, secondReview._id, { decision: 'reject', reviewNotes: 'Decisión paralela' }, supervisorAccess),
    ]);
    assert.equal(decisions.filter((result) => result.status === 'fulfilled').length, 1);
    assert.equal(decisions.filter((result) => result.status === 'rejected').length, 1);
    const persisted = await getCashSessionById(opened._id, { branchIds: [branch._id] });
    assert.notEqual(persisted.closingReviews.id(secondReview._id).status, 'pending');
    console.log('OK 08 dos revisiones simultáneas producen una sola decisión válida');

    const approvedResult = decisions.find((result) => result.status === 'fulfilled')?.value;
    if (approvedResult?.status === 'closed') {
      assert.equal(approvedResult.countedCash, 40000);
      assert.equal(approvedResult.cashCount.total, 40000);
      assert.equal(String(approvedResult.closedBy), String(supervisor.id));
      console.log('OK 09 aprobar cierra con el conteo y supervisor auditados');
    } else {
      assert.equal(approvedResult?.status, 'open');
      console.log('OK 09 rechazar mantiene la caja lista para un nuevo conteo');
    }

    console.log('\nIntegración Etapa 2 Caja: 9/9 controles superados.');
  } finally {
    if (mongoose.connection.readyState === 1) await mongoose.connection.dropDatabase().catch(() => null);
    await mongoose.disconnect().catch(() => null);
  }
}

main().catch((error) => {
  console.error('FAIL integración Etapa 2 Caja');
  console.error(error);
  process.exitCode = 1;
});
