'use strict';

const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const Branch = require('../models/Branch');
const CashSession = require('../models/CashSession');
const {
  closeCashSession,
  getCashSessionById,
  openCashSession,
  recalculateCashSession,
} = require('../services/cashSessionService');
const { addManualCashMovement } = require('../services/cashMovementService');

const MONGO_URI = String(process.env.CASH_STAGE0_MONGO_URI || '').trim();
const EXPECTED_DATABASE = 'cash_stage0_ci';

function assertDedicatedDatabase(uri) {
  if (!/^mongodb(?:\+srv)?:\/\//i.test(uri)) {
    throw new Error('CASH_STAGE0_MONGO_URI es obligatoria.');
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
      name: 'Sede Caja CI',
      code: 'CASH-STAGE0',
      type: 'store',
      status: 'active',
      active: true,
      settings: { allowPosSales: true, requireCashSessionForPos: true },
    });
    const cashierId = new mongoose.Types.ObjectId();
    const admin = {
      id: cashierId,
      username: 'cajero.stage0',
      displayName: 'Cajero Etapa 0',
      role: 'seller',
      adminRole: 'seller',
    };

    await assert.rejects(
      openCashSession({ branchId: branch._id, cashRegisterCode: 'CAJA INVALIDA', openingAmount: -1 }, { admin }),
      (error) => error?.code === 'CASH_OPENING_AMOUNT_INVALID'
    );
    console.log('OK 01 la apertura rechaza montos negativos');

    const opened = await openCashSession({
      branchId: branch._id,
      cashRegisterCode: 'CAJA STAGE0',
      cashRegisterName: 'Caja Etapa 0',
      openingAmount: 50000,
    }, { admin });

    await assert.rejects(
      closeCashSession(opened._id, {}, { admin, branchIds: [branch._id] }),
      (error) => error?.code === 'CASH_COUNTED_AMOUNT_REQUIRED'
    );
    console.log('OK 02 el cierre exige el efectivo contado');

    const afterWithdrawal = await addManualCashMovement(opened._id, {
      type: 'withdrawal',
      amount: 10000,
      reason: 'Retiro operativo controlado',
      reference: 'RET-STAGE0',
    }, { admin, branchIds: [branch._id] });
    assert.equal(afterWithdrawal.expectedCash, 40000);
    console.log('OK 03 el retiro descuenta el efectivo esperado una sola vez');

    await CashSession.collection.updateOne(
      { _id: opened._id },
      { $set: { expectedCash: 0 } }
    );
    const closed = await closeCashSession(opened._id, {
      countedCash: 39000,
      closingNotes: 'Cierre de integración Etapa 0',
    }, { admin, branchIds: [branch._id] });
    assert.equal(closed.status, 'closed');
    assert.equal(closed.expectedCash, 40000);
    assert.equal(closed.differenceAmount, -1000);
    console.log('OK 04 el cierre usa la versión recalculada y conserva la diferencia');

    const persistedBeforeRead = await CashSession.findById(closed._id).lean();
    await getCashSessionById(closed._id, { branchIds: [branch._id] });
    await getCashSessionById(closed._id, { branchIds: [branch._id] });
    const persistedAfterRead = await CashSession.findById(closed._id).lean();
    assert.equal(persistedAfterRead.__v, persistedBeforeRead.__v);
    assert.equal(persistedAfterRead.expectedCash, persistedBeforeRead.expectedCash);
    assert.equal(persistedAfterRead.differenceAmount, persistedBeforeRead.differenceAmount);
    console.log('OK 05 consultar una caja cerrada no modifica su cierre histórico');

    await assert.rejects(
      recalculateCashSession(closed._id, { requireOpen: true }),
      (error) => error?.code === 'CASH_SESSION_FINAL_ADJUSTMENT_REQUIRED'
    );
    console.log('OK 06 una devolución posterior no reescribe una caja cerrada');

    const indexes = await CashSession.collection.indexes();
    assert.ok(indexes.some((index) =>
      index.key?.branch === 1 &&
      index.key?.cashRegisterCode === 1 &&
      index.key?.status === 1 &&
      index.unique === true &&
      index.partialFilterExpression?.status === 'open'
    ));
    assert.ok(indexes.some((index) =>
      index.key?.branch === 1 && index.key?.status === 1 && index.key?.openedAt === -1
    ));
    console.log('OK 07 MongoDB conserva unicidad de apertura e índice de histórico');

    const concurrent = await openCashSession({
      branchId: branch._id,
      cashRegisterCode: 'CAJA CONCURRENTE',
      openingAmount: 25000,
    }, { admin });
    const attempts = await Promise.allSettled([
      closeCashSession(concurrent._id, { countedCash: 25000 }, { admin, branchIds: [branch._id] }),
      closeCashSession(concurrent._id, { countedCash: 25000 }, { admin, branchIds: [branch._id] }),
    ]);
    assert.equal(attempts.filter((attempt) => attempt.status === 'fulfilled').length, 1);
    assert.equal(
      attempts.filter((attempt) => attempt.status === 'rejected' && attempt.reason?.code === 'CASH_SESSION_CONFLICT').length,
      1
    );
    console.log('OK 08 dos cierres simultáneos producen un solo cierre válido');

    console.log('\nIntegración Etapa 0 Caja: 8/8 controles superados.');
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.dropDatabase().catch(() => null);
    }
    await mongoose.disconnect().catch(() => null);
  }
}

main().catch((error) => {
  console.error('FAIL integración Etapa 0 Caja');
  console.error(error);
  process.exitCode = 1;
});
