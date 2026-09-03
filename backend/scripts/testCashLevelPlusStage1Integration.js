'use strict';

const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const Branch = require('../models/Branch');
const CashSession = require('../models/CashSession');
const {
  closeCashSession,
  getCashSessionById,
  openCashSession,
  serializeCashSession,
} = require('../services/cashSessionService');
const {
  addManualCashMovement,
  reviewCashMovement,
} = require('../services/cashMovementService');

const MONGO_URI = String(process.env.CASH_STAGE1_MONGO_URI || '').trim();
const EXPECTED_DATABASE = 'cash_stage1_ci';

function assertDedicatedDatabase(uri) {
  if (!/^mongodb(?:\+srv)?:\/\//i.test(uri)) {
    throw new Error('CASH_STAGE1_MONGO_URI es obligatoria.');
  }
  const database = uri.split('?')[0].split('/').pop();
  if (database !== EXPECTED_DATABASE) {
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
      name: 'Sede Caja Etapa 1 CI',
      code: 'CASH-STAGE1',
      type: 'store',
      status: 'active',
      active: true,
      settings: { allowPosSales: true, requireCashSessionForPos: true },
    });
    const seller = {
      id: new mongoose.Types.ObjectId(),
      username: 'cajero.stage1',
      displayName: 'Cajero Etapa 1',
      role: 'seller',
      adminRole: 'seller',
    };
    const supervisor = {
      id: new mongoose.Types.ObjectId(),
      username: 'supervisor.stage1',
      displayName: 'Supervisor Etapa 1',
      role: 'manager',
      adminRole: 'manager',
    };
    const sellerAccess = { admin: seller, branchIds: [branch._id], canSupervise: false };
    const supervisorAccess = { admin: supervisor, branchIds: [branch._id], canSupervise: true };

    const opened = await openCashSession({
      branchId: branch._id,
      cashRegisterCode: 'CAJA STAGE1',
      openingAmount: 50000,
    }, { admin: seller });

    const withIncome = await addManualCashMovement(opened._id, {
      type: 'cash_in',
      amount: 10000,
      reason: 'Fondo adicional documentado',
    }, sellerAccess);
    assert.equal(withIncome.expectedCash, 60000);
    assert.equal(withIncome.cashMovements.at(-1).approvalStatus, 'not_required');
    console.log('OK 01 un ingreso del cajero se aplica sin aprobación');

    const withPendingWithdrawal = await addManualCashMovement(opened._id, {
      type: 'withdrawal',
      amount: 10000,
      reason: 'Traslado solicitado a bóveda',
      reference: 'RET-STAGE1-01',
    }, sellerAccess);
    const pendingWithdrawal = withPendingWithdrawal.cashMovements.at(-1);
    assert.equal(pendingWithdrawal.approvalStatus, 'pending');
    assert.equal(withPendingWithdrawal.expectedCash, 60000);
    console.log('OK 02 una salida del cajero queda pendiente y no altera el esperado');

    const blindView = serializeCashSession(withPendingWithdrawal, {
      canSupervise: false,
      blindCount: true,
    });
    assert.equal(blindView.expectedCash, null);
    assert.equal(blindView.salesSummary.paymentTotals.cash, null);
    assert.equal(blindView.cashControl.pendingMovementsCount, 1);
    console.log('OK 03 el arqueo ciego no filtra cifras monetarias al cajero');

    await assert.rejects(
      closeCashSession(opened._id, { countedCash: 50000 }, sellerAccess),
      (error) => error?.code === 'CASH_PENDING_MOVEMENTS' && error?.details?.pendingMovementsCount === 1
    );
    console.log('OK 04 una aprobación pendiente bloquea el cierre');

    await assert.rejects(
      reviewCashMovement(opened._id, pendingWithdrawal._id, { decision: 'approve' }, sellerAccess),
      (error) => error?.code === 'CASH_MOVEMENT_REVIEW_FORBIDDEN'
    );
    console.log('OK 05 el cajero no puede aprobar su propia solicitud');

    const approved = await reviewCashMovement(
      opened._id,
      pendingWithdrawal._id,
      { decision: 'approve', reviewNotes: 'Soporte y efectivo verificados' },
      supervisorAccess
    );
    const approvedMovement = approved.cashMovements.id(pendingWithdrawal._id);
    assert.equal(approved.expectedCash, 50000);
    assert.equal(approvedMovement.approvalStatus, 'approved');
    assert.equal(String(approvedMovement.reviewedBy), String(supervisor.id));
    assert.equal(approvedMovement.reviewedBySnapshot.displayName, supervisor.displayName);
    assert.ok(approvedMovement.reviewedAt instanceof Date);
    console.log('OK 06 el supervisor aprueba y deja trazabilidad completa');

    const withPendingExpense = await addManualCashMovement(opened._id, {
      type: 'expense',
      amount: 5000,
      reason: 'Compra solicitada sin soporte',
    }, sellerAccess);
    const pendingExpense = withPendingExpense.cashMovements.at(-1);
    const rejected = await reviewCashMovement(
      opened._id,
      pendingExpense._id,
      { decision: 'reject', reviewNotes: 'Falta soporte del gasto' },
      supervisorAccess
    );
    const rejectedMovement = rejected.cashMovements.id(pendingExpense._id);
    assert.equal(rejected.expectedCash, 50000);
    assert.equal(rejectedMovement.approvalStatus, 'rejected');
    assert.equal(rejectedMovement.reviewNotes, 'Falta soporte del gasto');
    console.log('OK 07 rechazar conserva el esperado y registra el motivo');

    const closed = await closeCashSession(opened._id, {
      countedCash: 49000,
      closingNotes: 'Arqueo ciego de integración',
    }, sellerAccess);
    const revealed = serializeCashSession(closed, { canSupervise: false, blindCount: true });
    assert.equal(revealed.expectedCash, 50000);
    assert.equal(revealed.countedCash, 49000);
    assert.equal(revealed.differenceAmount, -1000);
    console.log('OK 08 el cierre revela esperado contado y diferencia al cajero');

    const concurrent = await openCashSession({
      branchId: branch._id,
      cashRegisterCode: 'CAJA STAGE1 CONCURRENTE',
      openingAmount: 30000,
    }, { admin: seller });
    const pendingConcurrentSession = await addManualCashMovement(concurrent._id, {
      type: 'cash_out',
      amount: 5000,
      reason: 'Solicitud concurrente',
    }, sellerAccess);
    const pendingConcurrent = pendingConcurrentSession.cashMovements.at(-1);
    const decisions = await Promise.allSettled([
      reviewCashMovement(concurrent._id, pendingConcurrent._id, { decision: 'approve' }, supervisorAccess),
      reviewCashMovement(concurrent._id, pendingConcurrent._id, { decision: 'reject', reviewNotes: 'Revisión paralela' }, supervisorAccess),
    ]);
    assert.equal(decisions.filter((result) => result.status === 'fulfilled').length, 1);
    assert.equal(decisions.filter((result) => result.status === 'rejected').length, 1);
    const persistedConcurrent = await getCashSessionById(concurrent._id, { branchIds: [branch._id] });
    assert.notEqual(persistedConcurrent.cashMovements.id(pendingConcurrent._id).approvalStatus, 'pending');
    console.log('OK 09 dos revisiones simultáneas producen una sola decisión válida');

    console.log('\nIntegración Etapa 1 Caja: 9/9 controles superados.');
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.dropDatabase().catch(() => null);
    }
    await mongoose.disconnect().catch(() => null);
  }
}

main().catch((error) => {
  console.error('FAIL integración Etapa 1 Caja');
  console.error(error);
  process.exitCode = 1;
});
