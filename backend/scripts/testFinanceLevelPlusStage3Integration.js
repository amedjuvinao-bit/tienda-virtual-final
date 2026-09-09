'use strict';

/* eslint-disable no-console */

const mongoose = require('mongoose');

const TEST_URI = String(process.env.FINANCE_STAGE3_MONGO_URI || '').trim();
if (!TEST_URI) {
  throw new Error(
    'FINANCE_STAGE3_MONGO_URI es obligatoria y debe apuntar a una base aislada.'
  );
}

const databaseName = new URL(TEST_URI).pathname.replace(/^\//, '');
if (!/^finance_stage3_ci(?:_|$)/.test(databaseName)) {
  throw new Error(
    `La integración solo puede usar una base aislada finance_stage3_ci*. Recibida: ${databaseName || '(vacía)'}`
  );
}

process.env.MONGO_URI = TEST_URI;

const Branch = require('../models/Branch');
const FinanceExpense = require('../models/FinanceExpense');
const Order = require('../models/Order');
const treasuryService = require('../services/adminFinanceTreasuryService');
const workflowService = require('../services/adminFinanceExpenseWorkflowService');

const RUN_ID = Math.random().toString(36).slice(2, 9).toUpperCase();
const PREFIX = `FIN3-${RUN_ID}`;
const NOW = new Date();
const PAYMENT_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Bogota',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(NOW);
let controls = 0;

function ok(message, condition = true) {
  if (!condition) throw new Error(message);
  controls += 1;
  console.log(`OK ${String(controls).padStart(2, '0')} ${message}`);
}

function actor(username) {
  return {
    adminUserId: new mongoose.Types.ObjectId(),
    snapshot: {
      username,
      displayName: username.replace(/\./g, ' '),
      role: 'manager',
      adminRole: 'manager',
    },
  };
}

async function expectError(operation, codes) {
  const expected = Array.isArray(codes) ? codes : [codes];
  try {
    await operation();
  } catch (error) {
    if (expected.includes(error?.code)) return error;
    throw error;
  }
  throw new Error(`Se esperaba uno de estos errores: ${expected.join(', ')}.`);
}

async function cleanup() {
  await FinanceExpense.deleteMany({ reference: { $regex: `^${PREFIX}` } });
  await Order.deleteMany({ orderNumber: { $regex: `^${PREFIX}` } });
  await Branch.deleteMany({ code: { $regex: `^${PREFIX}` } });
}

async function createBranch(suffix) {
  return Branch.create({
    name: `Sede Tesorería ${suffix} ${RUN_ID}`,
    code: `${PREFIX}-${suffix}`,
    type: 'store',
    status: 'active',
    active: true,
    isMain: false,
    isDefaultForOnlineOrders: false,
  });
}

async function createPendingOrder(branch, suffix, amount) {
  const _id = new mongoose.Types.ObjectId();
  await Order.collection.insertOne({
    _id,
    sessionId: `${PREFIX}-${suffix}-SESSION`,
    orderNumber: `${PREFIX}-${suffix}`,
    status: 'pending',
    branch: branch._id,
    branchSnapshot: { name: branch.name, code: branch.code, type: branch.type },
    total: amount,
    customer: { name: `Cliente ${suffix}`, email: `${suffix.toLowerCase()}@example.com` },
    payment: { status: 'pending_manual', method: 'transfer', amount },
    createdAt: NOW,
    updatedAt: NOW,
  });
  return _id;
}

async function main() {
  console.log('\n=== Integración Finanzas Nivel Plus · Etapa 3 ===');
  await mongoose.connect(TEST_URI, { autoIndex: false });
  await cleanup();

  try {
    const [branchA, branchB] = await Promise.all([
      createBranch('A'),
      createBranch('B'),
    ]);
    const requester = actor('solicitante.tesoreria');
    const approver = actor('aprobador.tesoreria');
    const treasurer = actor('tesorero.operativo');
    const scopeA = { branchIds: [String(branchA._id)] };

    const [orderA] = await Promise.all([
      createPendingOrder(branchA, 'COBRO-A', 80000),
      createPendingOrder(branchB, 'COBRO-B', 90000),
    ]);
    ok('se preparan cobros pendientes reales en sedes aisladas');

    const requested = await workflowService.requestExpense({
      requestKey: `${PREFIX}-REQUEST-CREDIT`,
      date: NOW,
      amount: 100000,
      type: 'inventory_purchase',
      category: 'Empaques',
      description: 'Compra mensual a crédito',
      vendor: 'Proveedor de prueba',
      invoiceNumber: `${PREFIX}-FAC-1`,
      reference: `${PREFIX}-EXP-1`,
      paymentMethod: 'transfer',
      paymentTerms: 'credit',
      dueDate: new Date(NOW.getTime() + 5 * 24 * 60 * 60 * 1000),
      branchId: String(branchA._id),
    }, requester);
    ok('la solicitud a crédito queda pendiente sin crear deuda ejecutada', requested.status === 'pending' && requested.paymentTerms === 'credit' && requested.settlement?.status === 'not_required');

    const approved = await workflowService.reviewExpenseRequest(
      requested._id,
      {
        decision: 'approve',
        expectedRevision: 0,
        reviewNotes: 'Compra y vencimiento verificados.',
      },
      approver,
      scopeA
    );
    ok('la aprobación abre una cuenta por pagar por el saldo completo', approved.status === 'paid' && approved.settlement?.status === 'pending' && approved.settlement?.balanceAmount === 100000);

    let treasury = await treasuryService.getTreasury({ branchIds: scopeA.branchIds, asOf: NOW });
    ok('la cartera usa únicamente la sede autorizada', treasury.receivables.count === 1 && treasury.summary.accountsReceivable === 80000);
    ok('la cuenta por pagar aparece sin duplicar el gasto', treasury.payables.count === 1 && treasury.summary.accountsPayable === 100000);
    ok('la proyección resta pagos próximos a cobros próximos', treasury.summary.projectedNet30 === -20000);

    const firstPaymentPayload = {
      expectedRevision: 1,
      requestKey: `${PREFIX}-PAYMENT-1`,
      amount: 40000,
      paymentMethod: 'transfer',
      reference: `${PREFIX}-TRX-1`,
      paidAt: PAYMENT_DATE,
      notes: 'Primer abono conciliado.',
    };
    const partial = await treasuryService.registerPayablePayment(
      requested._id,
      firstPaymentPayload,
      treasurer,
      scopeA
    );
    ok('el primer abono deja la cuenta parcial y reduce el saldo', partial.settlement?.status === 'partial' && partial.settlement?.paidAmount === 40000 && partial.settlement?.balanceAmount === 60000 && partial.revision === 2);
    ok('el abono queda en el historial financiero', partial.workflow?.at(-1)?.action === 'payable_payment_registered' && partial.settlement?.payments?.length === 1);
    ok('la fecha calendario del abono se conserva en horario de Bogotá', new Date(partial.settlement?.payments?.[0]?.paidAt).toISOString() === `${PAYMENT_DATE}T05:00:00.000Z`);

    const replay = await treasuryService.registerPayablePayment(
      requested._id,
      firstPaymentPayload,
      treasurer,
      scopeA
    );
    ok('repetir la misma solicitud no descuenta el saldo dos veces', replay.idempotentReplay === true && replay.settlement?.balanceAmount === 60000 && replay.revision === 2);

    await expectError(
      () => treasuryService.registerPayablePayment(
        requested._id,
        {
          expectedRevision: 2,
          requestKey: `${PREFIX}-OVERPAY`,
          amount: 70000,
          paymentMethod: 'cash',
          paidAt: NOW,
        },
        treasurer,
        scopeA
      ),
      'FINANCE_PAYABLE_PAYMENT_EXCEEDS_BALANCE'
    );
    ok('el servidor impide pagar más que el saldo');

    const concurrent = await Promise.allSettled([
      treasuryService.registerPayablePayment(
        requested._id,
        {
          expectedRevision: 2,
          requestKey: `${PREFIX}-RACE-A`,
          amount: 40000,
          paymentMethod: 'cash',
          paidAt: NOW,
        },
        treasurer,
        scopeA
      ),
      treasuryService.registerPayablePayment(
        requested._id,
        {
          expectedRevision: 2,
          requestKey: `${PREFIX}-RACE-B`,
          amount: 40000,
          paymentMethod: 'cash',
          paidAt: NOW,
        },
        treasurer,
        scopeA
      ),
    ]);
    ok('dos abonos simultáneos no consumen dos veces la misma versión', concurrent.filter((result) => result.status === 'fulfilled').length === 1 && concurrent.filter((result) => result.status === 'rejected').length === 1);

    const afterRace = await FinanceExpense.findById(requested._id);
    ok('la concurrencia deja exactamente un nuevo abono', afterRace.settlement?.paidAmount === 80000 && afterRace.settlement?.balanceAmount === 20000 && afterRace.revision === 3);

    await expectError(
      () => workflowService.cancelExpenseRequest(
        requested._id,
        { expectedRevision: 3, cancellationReason: 'Intento de anulación.' },
        approver,
        scopeA
      ),
      'FINANCE_PAYABLE_WITH_PAYMENTS_CANNOT_CANCEL'
    );
    ok('una cuenta con abonos no puede anularse sin reversión');

    const settled = await treasuryService.registerPayablePayment(
      requested._id,
      {
        expectedRevision: 3,
        requestKey: `${PREFIX}-FINAL`,
        amount: 20000,
        paymentMethod: 'transfer',
        reference: `${PREFIX}-TRX-FINAL`,
        paidAt: NOW,
      },
      treasurer,
      scopeA
    );
    ok('el último abono salda la cuenta con saldo cero', settled.settlement?.status === 'paid' && settled.settlement?.balanceAmount === 0 && settled.revision === 4);

    treasury = await treasuryService.getTreasury({ branchIds: scopeA.branchIds, asOf: NOW });
    ok('una cuenta saldada deja de aparecer en pagos pendientes', treasury.payables.count === 0 && treasury.summary.accountsPayable === 0);

    await Order.collection.updateOne(
      { _id: orderA },
      { $set: { status: 'paid', 'payment.status': 'paid', 'payment.paidAt': NOW } }
    );
    treasury = await treasuryService.getTreasury({ branchIds: scopeA.branchIds, asOf: NOW });
    ok('una orden cobrada deja de aparecer en cartera', treasury.receivables.count === 0 && treasury.summary.accountsReceivable === 0);

    console.log(`\nIntegración Etapa 3 Finanzas validada: ${controls} controles superados.`);
  } finally {
    await cleanup();
    await mongoose.disconnect();
  }
}

main().catch(async (error) => {
  console.error('Fallo integración Etapa 3 Finanzas:', error);
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect().catch(() => null);
  }
  process.exitCode = 1;
});
