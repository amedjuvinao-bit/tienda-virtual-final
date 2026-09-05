'use strict';

const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const Branch = require('../models/Branch');
const CashJourneyClose = require('../models/CashJourneyClose');
const CashSession = require('../models/CashSession');
const { certifyCashJourney } = require('../services/cashJourneyCloseService');
const { closeCashSession, openCashSession } = require('../services/cashSessionService');

const MONGO_URI = String(process.env.CASH_STAGE4_MONGO_URI || '').trim();
const EXPECTED_DATABASE = 'cash_stage4_ci';

function assertDedicatedDatabase(uri) {
  if (!/^mongodb(?:\+srv)?:\/\//i.test(uri)) throw new Error('CASH_STAGE4_MONGO_URI es obligatoria.');
  if (uri.split('?')[0].split('/').pop() !== EXPECTED_DATABASE) throw new Error(`La prueba solo puede ejecutarse en la base aislada ${EXPECTED_DATABASE}.`);
}

async function main() {
  assertDedicatedDatabase(MONGO_URI);
  await mongoose.connect(MONGO_URI, { autoIndex: false });
  try {
    await mongoose.connection.dropDatabase();
    await Promise.all([Branch.createIndexes(), CashSession.createIndexes(), CashJourneyClose.createIndexes()]);
    const [branch, secondBranch] = await Branch.create([
      { name: 'Sede Caja Etapa 4 CI', code: 'CASH-STAGE4', type: 'store', status: 'active', active: true, settings: { allowPosSales: true, requireCashSessionForPos: true } },
      { name: 'Sede Caja Etapa 4 Bloqueada', code: 'CASH-STAGE4-B', type: 'store', status: 'active', active: true, settings: { allowPosSales: true, requireCashSessionForPos: true } },
    ]);
    const supervisor = { id: new mongoose.Types.ObjectId(), username: 'supervisor.stage4', displayName: 'Supervisor Etapa 4', role: 'owner', adminRole: 'owner' };
    const access = { admin: supervisor, branchIds: [branch._id, secondBranch._id], canSupervise: true };

    const session = await openCashSession({ branchId: branch._id, cashRegisterCode: 'CAJA POS', openingAmount: 50000 }, { admin: supervisor });
    const closed = await closeCashSession(session._id, {
      countedCash: 50000,
      denominations: [{ value: 50000, quantity: 1 }],
      closingNotes: 'Cierre exacto Etapa 4',
    }, access);
    assert.equal(closed.status, 'closed');
    console.log('OK 01 la jornada parte de una caja cerrada y conciliada');

    const first = await certifyCashJourney({ branchId: branch._id, branchIds: access.branchIds, notes: 'Jornada validada', admin: supervisor });
    assert.equal(first.alreadyCertified, false);
    assert.equal(first.close.status, 'certified');
    assert.equal(first.close.snapshot.totals.sessionsCount, 1);
    assert.match(first.close.contentDigest, /^[a-f0-9]{64}$/);
    console.log('OK 02 el cierre diario almacena totales y huella auditable');

    const repeated = await certifyCashJourney({ branchId: branch._id, branchIds: access.branchIds, notes: 'Intento repetido', admin: supervisor });
    assert.equal(repeated.alreadyCertified, true);
    assert.equal(String(repeated.close._id), String(first.close._id));
    assert.equal(await CashJourneyClose.countDocuments({ branch: branch._id }), 1);
    console.log('OK 03 una repetición devuelve el mismo certificado sin duplicarlo');

    await assert.rejects(
      () => openCashSession({ branchId: branch._id, cashRegisterCode: 'CAJA POS', openingAmount: 50000 }, { admin: supervisor }),
      (error) => error.code === 'CASH_JOURNEY_ALREADY_CERTIFIED'
    );
    console.log('OK 04 la certificación impide reabrir caja el mismo día');

    await openCashSession({ branchId: secondBranch._id, cashRegisterCode: 'CAJA POS', openingAmount: 10000 }, { admin: supervisor });
    await assert.rejects(
      () => certifyCashJourney({ branchId: secondBranch._id, branchIds: access.branchIds, admin: supervisor }),
      (error) => error.code === 'CASH_JOURNEY_CLOSE_BLOCKED' && error.details.blockers.some((item) => item.includes('abiertas'))
    );
    console.log('OK 05 una caja abierta bloquea el cierre diario');

    console.log('\nIntegración Etapa 4 Caja: 5/5 controles superados.');
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error('FAIL integración Etapa 4 Caja');
  console.error(error);
  process.exitCode = 1;
});
