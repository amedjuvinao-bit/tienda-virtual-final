'use strict';

/* eslint-disable no-console */

const mongoose = require('mongoose');

const TEST_URI = String(process.env.FINANCE_STAGE1_MONGO_URI || '').trim();
if (!TEST_URI) {
  throw new Error(
    'FINANCE_STAGE1_MONGO_URI es obligatoria y debe apuntar a una base aislada.'
  );
}

const databaseName = new URL(TEST_URI).pathname.replace(/^\//, '');
if (!/^finance_stage1_ci(?:_|$)/.test(databaseName)) {
  throw new Error(
    `La integración solo puede usar una base aislada finance_stage1_ci*. Recibida: ${databaseName || '(vacía)'}`
  );
}

process.env.MONGO_URI = TEST_URI;

const Branch = require('../models/Branch');
const FinanceExpense = require('../models/FinanceExpense');
const financeService = require('../services/adminFinanceService');
const workflowService = require('../services/adminFinanceExpenseWorkflowService');

const RUN_ID = Math.random().toString(36).slice(2, 9).toUpperCase();
const PREFIX = `FIN1-${RUN_ID}`;
const NOW = new Date();
let controls = 0;

function ok(message, condition = true) {
  if (!condition) throw new Error(message);
  controls += 1;
  console.log(`OK ${String(controls).padStart(2, '0')} ${message}`);
}

function localDay(date) {
  const value = new Date(date);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function actor(username, role = 'manager') {
  const id = new mongoose.Types.ObjectId();
  return {
    adminUserId: id,
    snapshot: {
      username,
      displayName: username.replace(/\./g, ' '),
      role,
      adminRole: role,
    },
  };
}

async function cleanup() {
  await FinanceExpense.deleteMany({ reference: { $regex: `^${PREFIX}` } });
  await Branch.deleteMany({ code: { $regex: `^${PREFIX}` } });
}

async function createBranch(suffix) {
  return Branch.create({
    name: `Sede Finanzas ${suffix} ${RUN_ID}`,
    code: `${PREFIX}-${suffix}`,
    type: 'store',
    status: 'active',
    active: true,
    isMain: false,
    isDefaultForOnlineOrders: false,
  });
}

function requestPayload(branch, suffix, amount = 25000) {
  return {
    requestKey: `${PREFIX}-REQUEST-${suffix}`,
    date: NOW,
    amount,
    type: 'operating',
    category: `Operación ${suffix}`,
    description: `Gasto aislado de integración ${suffix}`,
    paymentMethod: 'transfer',
    reference: `${PREFIX}-EXP-${suffix}`,
    branchId: String(branch._id),
  };
}

async function expectError(operation, code) {
  try {
    await operation();
  } catch (error) {
    if (error?.code === code) return error;
    throw error;
  }
  throw new Error(`Se esperaba el error ${code}.`);
}

async function main() {
  console.log('\n=== Integración Finanzas Nivel Plus · Etapa 1 ===');
  await mongoose.connect(TEST_URI);
  await cleanup();

  try {
    const [branchA, branchB] = await Promise.all([
      createBranch('A'),
      createBranch('B'),
    ]);
    const requester = actor('solicitante.finanzas');
    const approver = actor('aprobador.finanzas');
    const owner = actor('propietario.finanzas', 'owner');
    const day = localDay(NOW);
    const scopeA = { branchIds: [String(branchA._id)] };
    const scopeB = { branchIds: [String(branchB._id)] };
    const queryA = {
      dateFrom: day,
      dateTo: day,
      branchIds: [String(branchA._id)],
    };

    const pending = await workflowService.requestExpense(
      requestPayload(branchA, 'A', 25000),
      requester
    );
    ok(
      'una solicitud nueva queda pendiente y versionada',
      pending.status === 'pending' &&
        pending.revision === 0 &&
        pending.workflow?.[0]?.action === 'submitted'
    );

    const replay = await workflowService.requestExpense(
      requestPayload(branchA, 'A', 25000),
      requester
    );
    const duplicateCount = await FinanceExpense.countDocuments({
      reference: `${PREFIX}-EXP-A`,
    });
    ok(
      'reintentar la misma solicitud no duplica el gasto',
      String(replay._id) === String(pending._id) &&
        replay.idempotentReplay === true &&
        duplicateCount === 1
    );

    const pendingReport = await financeService.getExpensesReport(queryA);
    ok(
      'un gasto pendiente no altera la utilidad',
      pendingReport.manualTotal === 0 &&
        pendingReport.workflow.pending.count === 1 &&
        pendingReport.workflow.pending.amount === 25000
    );

    await expectError(
      () =>
        workflowService.reviewExpenseRequest(
          pending._id,
          { decision: 'approve', expectedRevision: 0 },
          requester,
          scopeA
        ),
      'FINANCE_EXPENSE_SELF_APPROVAL_FORBIDDEN'
    );
    ok('un solicitante no propietario no puede revisar su propio gasto');

    await expectError(
      () =>
        workflowService.reviewExpenseRequest(
          pending._id,
          { decision: 'approve', expectedRevision: 0 },
          approver,
          scopeB
        ),
      'FINANCE_EXPENSE_NOT_FOUND'
    );
    ok('una sede no puede revisar gastos de otra sede');

    const approved = await workflowService.reviewExpenseRequest(
      pending._id,
      {
        decision: 'approve',
        expectedRevision: 0,
        reviewNotes: 'Soporte y valor verificados.',
      },
      approver,
      scopeA
    );
    ok(
      'una segunda persona aprueba y deja responsable, fecha y motivo',
      approved.status === 'paid' &&
        approved.revision === 1 &&
        String(approved.reviewedBy) === String(approver.adminUserId) &&
        approved.reviewNotes === 'Soporte y valor verificados.' &&
        approved.workflow?.at(-1)?.action === 'approved'
    );

    const paidReport = await financeService.getExpensesReport(queryA);
    ok(
      'solo después de aprobar el gasto entra al resultado financiero',
      paidReport.manualTotal === 25000 &&
        paidReport.manualCount === 1 &&
        paidReport.workflow.paid.count === 1
    );

    await expectError(
      () =>
        workflowService.reviewExpenseRequest(
          pending._id,
          { decision: 'reject', expectedRevision: 0, reviewNotes: 'Tardío' },
          actor('otro.aprobador'),
          scopeA
        ),
      'FINANCE_EXPENSE_VERSION_CONFLICT'
    );
    ok('una versión vencida no puede cambiar una decisión ya tomada');

    await expectError(
      () =>
        workflowService.updateExpenseRequest(
          pending._id,
          { expectedRevision: 1, description: 'Cambio tardío' },
          requester,
          scopeA
        ),
      'FINANCE_EXPENSE_IMMUTABLE'
    );
    ok('un gasto aprobado queda inmutable');

    const rejectedRequest = await workflowService.requestExpense(
      requestPayload(branchA, 'B', 10000),
      requester
    );
    await expectError(
      () =>
        workflowService.reviewExpenseRequest(
          rejectedRequest._id,
          { decision: 'reject', expectedRevision: 0 },
          approver,
          scopeA
        ),
      'FINANCE_EXPENSE_REVIEW_NOTES_REQUIRED'
    );
    ok('rechazar exige una explicación');

    const rejected = await workflowService.reviewExpenseRequest(
      rejectedRequest._id,
      {
        decision: 'reject',
        expectedRevision: 0,
        reviewNotes: 'Falta identificar el soporte.',
      },
      approver,
      scopeA
    );
    ok(
      'el rechazo conserva la decisión sin afectar la utilidad',
      rejected.status === 'rejected' && rejected.revision === 1
    );

    const resubmitted = await workflowService.updateExpenseRequest(
      rejected._id,
      {
        expectedRevision: 1,
        description: 'Gasto corregido con soporte identificado',
        invoiceNumber: `${PREFIX}-FACTURA-B`,
      },
      requester,
      scopeA
    );
    ok(
      'una solicitud rechazada puede corregirse y reenviarse',
      resubmitted.status === 'pending' &&
        resubmitted.revision === 2 &&
        !resubmitted.reviewedAt &&
        resubmitted.workflow?.at(-1)?.action === 'resubmitted'
    );

    const concurrent = await Promise.allSettled([
      workflowService.reviewExpenseRequest(
        resubmitted._id,
        { decision: 'approve', expectedRevision: 2, reviewNotes: 'Aprobación uno' },
        approver,
        scopeA
      ),
      workflowService.reviewExpenseRequest(
        resubmitted._id,
        { decision: 'approve', expectedRevision: 2, reviewNotes: 'Aprobación dos' },
        actor('aprobador.concurrente'),
        scopeA
      ),
    ]);
    ok(
      'dos aprobaciones simultáneas producen una sola decisión',
      concurrent.filter((result) => result.status === 'fulfilled').length === 1 &&
        concurrent.filter((result) => result.status === 'rejected').length === 1
    );

    const ownerPending = await workflowService.requestExpense(
      requestPayload(branchA, 'OWNER', 5000),
      owner
    );
    await expectError(
      () =>
        workflowService.reviewExpenseRequest(
          ownerPending._id,
          { decision: 'approve', expectedRevision: 0 },
          owner,
          scopeA
        ),
      'FINANCE_EXPENSE_SELF_APPROVAL_REASON_REQUIRED'
    );
    ok('la excepción de autoaprobación del propietario exige justificación');

    const ownerApproved = await workflowService.reviewExpenseRequest(
      ownerPending._id,
      {
        decision: 'approve',
        expectedRevision: 0,
        reviewNotes: 'Excepción necesaria por operación unipersonal.',
      },
      owner,
      scopeA
    );
    ok(
      'la excepción del propietario queda identificada en la trazabilidad',
      ownerApproved.selfApprovalOverride === true &&
        ownerApproved.workflow?.at(-1)?.selfApprovalOverride === true
    );

    await expectError(
      () =>
        workflowService.cancelExpenseRequest(
          approved._id,
          { expectedRevision: 1 },
          approver,
          scopeA
        ),
      'FINANCE_EXPENSE_CANCELLATION_REASON_REQUIRED'
    );
    ok('anular exige un motivo explícito');

    const cancelled = await workflowService.cancelExpenseRequest(
      approved._id,
      {
        expectedRevision: 1,
        cancellationReason: 'El proveedor reversó el cobro.',
      },
      approver,
      scopeA
    );
    ok(
      'la anulación conserva actor, motivo y versión',
      cancelled.status === 'cancelled' &&
        cancelled.revision === 2 &&
        cancelled.cancellationReason === 'El proveedor reversó el cobro.' &&
        cancelled.workflow?.at(-1)?.action === 'cancelled'
    );

    const finalReport = await financeService.getExpensesReport({
      ...queryA,
      status: 'all',
    });
    ok(
      'el consolidado excluye anulados pero conserva su historial',
      finalReport.manualTotal === 15000 &&
        finalReport.workflow.cancelled.count === 1 &&
        finalReport.data.some((expense) => expense.status === 'cancelled')
    );

    console.log(
      `\nIntegración Etapa 1 Finanzas validada: ${controls} controles superados.`
    );
  } finally {
    await cleanup();
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error('Fallo integración Etapa 1 Finanzas:', error);
  process.exitCode = 1;
});
