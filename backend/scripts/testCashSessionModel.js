// backend/scripts/testCashSessionModel.js

require('dotenv').config();

const mongoose = require('mongoose');
const CashSession = require('../models/CashSession');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  console.log('Test modelo CashSession');

  const branchId = new mongoose.Types.ObjectId();
  const cashierId = new mongoose.Types.ObjectId();

  const session = new CashSession({
    branch: branchId,
    branchSnapshot: {
      name: 'Sede Principal',
      code: 'principal',
      type: 'store',
    },
    cashRegisterCode: ' caja pos ',
    cashRegisterName: ' Caja POS ',
    cashier: cashierId,
    cashierSnapshot: {
      username: 'cajero.prueba',
      displayName: 'Cajero Prueba',
      role: 'cashier',
      adminRole: 'cashier',
    },
    openedBy: cashierId,
    openedBySnapshot: {
      username: 'cajero.prueba',
      displayName: 'Cajero Prueba',
      role: 'cashier',
      adminRole: 'cashier',
    },
    openingAmount: 50000,
    salesSummary: {
      ordersCount: 2,
      itemsCount: 3,
      grossSales: 280000,
      discounts: 0,
      refunds: 0,
      netSales: 280000,
      paymentTotals: {
        cash: 200000,
        transfer: 80000,
      },
    },
  });

  session.addCashMovement({
    type: 'cash_in',
    amount: 20000,
    direction: 'in',
    reason: 'Ingreso manual de prueba',
  });

  session.addCashMovement({
    type: 'expense',
    amount: 10000,
    direction: 'out',
    reason: 'Egreso de prueba',
  });

  await session.validate();

  assert(session.status === 'open', 'La caja debe iniciar abierta.');
  assert(session.cashRegisterCode === 'CAJA POS', 'El código de caja debe normalizarse.');
  assert(session.branchSnapshot.code === 'PRINCIPAL', 'El código de sede debe normalizarse.');
  assert(session.salesSummary.paymentTotals.total === 280000, 'El total de pagos debe calcularse.');
  assert(session.expectedCash === 260000, 'El efectivo esperado debe calcularse.');
  assert(session.cashMovements.length === 2, 'Debe registrar movimientos de caja.');

  session.closeSession({
    countedCash: 255000,
    closedBy: cashierId,
    closedBySnapshot: {
      username: 'cajero.prueba',
      displayName: 'Cajero Prueba',
      role: 'cashier',
      adminRole: 'cashier',
    },
    closingNotes: 'Cierre de prueba',
  });

  await session.validate();

  assert(session.status === 'closed', 'La caja debe quedar cerrada.');
  assert(session.closedAt instanceof Date, 'Debe tener fecha de cierre.');
  assert(session.differenceAmount === -5000, 'La diferencia debe calcular faltante o sobrante.');

  console.log('Modelo CashSession correcto.');
  console.log('Código:', session.sessionCode);
  console.log('Efectivo esperado:', session.expectedCash);
  console.log('Efectivo contado:', session.countedCash);
  console.log('Diferencia:', session.differenceAmount);
}

main().catch((error) => {
  console.error('Error probando CashSession:', error.message);
  process.exitCode = 1;
});
