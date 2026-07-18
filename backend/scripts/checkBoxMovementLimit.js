// backend/scripts/checkBoxMovementLimit.js

require('dotenv').config();

const mongoose = require('mongoose');
const Branch = require('../models/Branch');
const { openCashSession, closeCashSession } = require('../services/cashSessionService');
const { addManualCashMovement } = require('../services/cashMovementService');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  console.log('Test limite de salidas de caja');

  assert(process.env.MONGODB_URI, 'Falta MONGODB_URI.');
  await mongoose.connect(process.env.MONGODB_URI);

  const branch = await Branch.findOne({
    deletedAt: null,
    active: true,
    status: 'active',
    'settings.allowPosSales': true,
  });

  assert(branch, 'No hay sede POS activa.');

  const admin = {
    username: 'script-limite-caja',
    displayName: 'Script limite caja',
    role: 'admin',
    adminRole: 'admin',
  };

  const session = await openCashSession(
    {
      branchId: String(branch._id),
      cashRegisterCode: `LIM-${Date.now()}`,
      cashRegisterName: 'Caja limite POS',
      openingAmount: 50000,
      openingNotes: 'Apertura prueba limite de caja.',
    },
    { admin }
  );

  let blocked = false;

  try {
    await addManualCashMovement(
      session._id,
      {
        type: 'expense',
        amount: 60000,
        reason: 'Prueba limite caja',
        reference: 'LIM-TEST',
      },
      { admin }
    );
  } catch (error) {
    blocked = error.code === 'CASH_MOVEMENT_EXCEEDS_EXPECTED_CASH';
    console.log('Salida bloqueada:', blocked ? 'SI' : 'NO');
    console.log('Mensaje:', error.message);
  }

  assert(blocked, 'La salida mayor al efectivo esperado debe bloquearse.');

  const afterIn = await addManualCashMovement(
    session._id,
    {
      type: 'cash_in',
      amount: 20000,
      reason: 'Ingreso prueba limite',
      reference: 'IN-TEST',
    },
    { admin }
  );

  assert(Number(afterIn.expectedCash || 0) === 70000, 'El esperado debe quedar en 70000.');

  const afterOut = await addManualCashMovement(
    session._id,
    {
      type: 'expense',
      amount: 10000,
      reason: 'Gasto permitido prueba limite',
      reference: 'OUT-TEST',
    },
    { admin }
  );

  assert(Number(afterOut.expectedCash || 0) === 60000, 'El esperado debe quedar en 60000.');

  const closed = await closeCashSession(
    session._id,
    {
      countedCash: 60000,
      closingNotes: 'Cierre prueba limite de caja.',
    },
    { admin }
  );

  assert(closed.status === 'closed', 'La caja debe cerrar.');
  assert(Number(closed.differenceAmount || 0) === 0, 'La diferencia debe ser cero.');

  console.log('Caja:', closed.sessionCode);
  console.log('Efectivo esperado:', closed.expectedCash);
  console.log('Efectivo contado:', closed.countedCash);
  console.log('Diferencia:', closed.differenceAmount);
  console.log('Limite de salidas de caja correcto.');
}

main()
  .catch((error) => {
    console.error('Error probando limite de caja:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
