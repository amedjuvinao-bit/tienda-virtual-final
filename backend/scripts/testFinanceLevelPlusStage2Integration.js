'use strict';

/* eslint-disable no-console */

const mongoose = require('mongoose');

const TEST_URI = String(process.env.FINANCE_STAGE2_MONGO_URI || '').trim();
if (!TEST_URI) {
  throw new Error(
    'FINANCE_STAGE2_MONGO_URI es obligatoria y debe apuntar a una base aislada.'
  );
}

const databaseName = new URL(TEST_URI).pathname.replace(/^\//, '');
if (!/^finance_stage2_ci(?:_|$)/.test(databaseName)) {
  throw new Error(
    `La integración solo puede usar una base aislada finance_stage2_ci*. Recibida: ${databaseName || '(vacía)'}`
  );
}

process.env.MONGO_URI = TEST_URI;

const Branch = require('../models/Branch');
const FinanceBudget = require('../models/FinanceBudget');
const FinanceCostCenter = require('../models/FinanceCostCenter');
const FinanceExpense = require('../models/FinanceExpense');
const budgetService = require('../services/adminFinanceBudgetService');
const workflowService = require('../services/adminFinanceExpenseWorkflowService');

const RUN_ID = Math.random().toString(36).slice(2, 9).toUpperCase();
const PREFIX = `FIN2-${RUN_ID}`;
const NOW = new Date();
const PERIOD_KEY = `${NOW.getUTCFullYear()}-${String(NOW.getUTCMonth() + 1).padStart(2, '0')}`;
let controls = 0;

function ok(message, condition = true) {
  if (!condition) throw new Error(message);
  controls += 1;
  console.log(`OK ${String(controls).padStart(2, '0')} ${message}`);
}

function actor(username, options = {}) {
  const role = options.role || 'manager';
  return {
    adminUserId: new mongoose.Types.ObjectId(),
    canOverrideBudget: options.canOverrideBudget === true,
    snapshot: {
      username,
      displayName: username.replace(/\./g, ' '),
      role,
      adminRole: role,
    },
  };
}

async function cleanup() {
  const centers = await FinanceCostCenter.find({
    code: { $regex: `^${PREFIX}` },
  }).select('_id');
  const centerIds = centers.map((center) => center._id);
  await FinanceExpense.deleteMany({ reference: { $regex: `^${PREFIX}` } });
  if (centerIds.length) {
    await FinanceBudget.deleteMany({ costCenter: { $in: centerIds } });
  }
  await FinanceCostCenter.deleteMany({ code: { $regex: `^${PREFIX}` } });
  await Branch.deleteMany({ code: { $regex: `^${PREFIX}` } });
}

async function createBranch(suffix) {
  return Branch.create({
    name: `Sede Presupuesto ${suffix} ${RUN_ID}`,
    code: `${PREFIX}-${suffix}`,
    type: 'store',
    status: 'active',
    active: true,
    isMain: false,
    isDefaultForOnlineOrders: false,
  });
}

function expensePayload(branch, center, suffix, amount, type = 'operating') {
  return {
    requestKey: `${PREFIX}-REQUEST-${suffix}`,
    date: NOW,
    amount,
    type,
    category: `Operación ${suffix}`,
    description: `Gasto presupuestal aislado ${suffix}`,
    paymentMethod: 'transfer',
    reference: `${PREFIX}-EXP-${suffix}`,
    branchId: String(branch._id),
    ...(center ? { costCenterId: String(center._id || center) } : {}),
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
  console.log('\n=== Integración Finanzas Nivel Plus · Etapa 2 ===');
  await mongoose.connect(TEST_URI, { autoIndex: false });
  await cleanup();

  try {
    const [branchA, branchB] = await Promise.all([
      createBranch('A'),
      createBranch('B'),
    ]);
    const planner = actor('planificador.finanzas');
    const requester = actor('solicitante.finanzas');
    const approver = actor('aprobador.finanzas');
    const controller = actor('controlador.finanzas', {
      canOverrideBudget: true,
    });
    const scopeA = { branchIds: [String(branchA._id)] };
    const scopeB = { branchIds: [String(branchB._id)] };

    const center = await budgetService.createCostCenter(
      {
        code: `${PREFIX}-LOG`,
        name: `Logística ${RUN_ID}`,
        description: 'Centro aislado para integración.',
      },
      planner
    );
    ok(
      'un centro de costo se crea activo y auditado',
      center.status === 'active' &&
        center.revision === 0 &&
        center.history?.[0]?.action === 'created'
    );

    await expectError(
      () => budgetService.createCostCenter(
        { code: `${PREFIX}-LOG`, name: 'Duplicado' },
        planner
      ),
      'FINANCE_COST_CENTER_CODE_CONFLICT'
    );
    ok('el código del centro de costo no se puede duplicar');

    const budget = await budgetService.createBudget(
      {
        periodKey: PERIOD_KEY,
        branchId: String(branchA._id),
        costCenterId: String(center._id),
        expenseType: 'operating',
        amount: 100000,
        warningThresholdPercent: 80,
      },
      planner
    );
    ok(
      'el presupuesto conserva periodo, sede, centro y límite',
      budget.periodKey === PERIOD_KEY &&
        String(budget.branch) === String(branchA._id) &&
        String(budget.costCenter) === String(center._id) &&
        budget.amount === 100000
    );

    await expectError(
      () => budgetService.createBudget(
        {
          periodKey: PERIOD_KEY,
          branchId: String(branchA._id),
          costCenterId: String(center._id),
          expenseType: 'operating',
          amount: 200000,
        },
        planner
      ),
      'FINANCE_BUDGET_ALREADY_EXISTS'
    );
    ok('la identidad presupuestal impide límites duplicados');

    const firstPending = await workflowService.requestExpense(
      expensePayload(branchA, center, 'A-70', 70000),
      requester
    );
    ok(
      'la solicitud conserva centro y evaluación inicial',
      firstPending.status === 'pending' &&
        String(firstPending.costCenter) === String(center._id) &&
        firstPending.budgetEvaluation?.projectedAmount === 70000 &&
        firstPending.budgetEvaluation?.outcome === 'healthy'
    );

    let control = await budgetService.getBudgetControl(
      { periodKey: PERIOD_KEY },
      scopeA
    );
    ok(
      'el gasto pendiente queda comprometido sin ejecutarse',
      control.summary.allocatedAmount === 100000 &&
        control.summary.committedAmount === 70000 &&
        control.summary.spentAmount === 0 &&
        control.summary.availableAmount === 30000
    );

    const firstPaid = await workflowService.reviewExpenseRequest(
      firstPending._id,
      {
        decision: 'approve',
        expectedRevision: 0,
        reviewNotes: 'Dentro del límite aprobado.',
      },
      approver,
      scopeA
    );
    ok(
      'aprobar dentro del límite ejecuta el gasto sin excepción',
      firstPaid.status === 'paid' &&
        firstPaid.budgetEvaluation?.spentAmount === 0 &&
        firstPaid.budgetEvaluation?.projectedAmount === 70000 &&
        firstPaid.budgetOverride?.used === false
    );

    control = await budgetService.getBudgetControl(
      { periodKey: PERIOD_KEY },
      scopeA
    );
    ok(
      'la aprobación mueve el valor de comprometido a ejecutado',
      control.summary.committedAmount === 0 &&
        control.summary.spentAmount === 70000 &&
        control.summary.availableAmount === 30000
    );

    const excessPending = await workflowService.requestExpense(
      expensePayload(branchA, center, 'A-40', 40000),
      requester
    );
    ok(
      'una solicitud que supera la exposición queda advertida',
      excessPending.budgetEvaluation?.outcome === 'exceeded' &&
        excessPending.budgetEvaluation?.projectedAmount === 110000
    );

    await expectError(
      () => workflowService.reviewExpenseRequest(
        excessPending._id,
        { decision: 'approve', expectedRevision: 0 },
        approver,
        scopeA
      ),
      'FINANCE_BUDGET_LIMIT_EXCEEDED'
    );
    ok('una persona sin permiso no puede exceder el presupuesto');

    await expectError(
      () => workflowService.reviewExpenseRequest(
        excessPending._id,
        { decision: 'approve', expectedRevision: 0 },
        controller,
        scopeA
      ),
      'FINANCE_BUDGET_OVERRIDE_REASON_REQUIRED'
    );
    ok('incluso con permiso, la excepción exige justificación');

    const excessPaid = await workflowService.reviewExpenseRequest(
      excessPending._id,
      {
        decision: 'approve',
        expectedRevision: 0,
        reviewNotes: 'Soporte verificado.',
        budgetOverrideReason: 'Operación urgente autorizada por dirección.',
      },
      controller,
      scopeA
    );
    ok(
      'la excepción conserva actor, motivo y resultado',
      excessPaid.status === 'paid' &&
        excessPaid.budgetEvaluation?.outcome === 'exceeded' &&
        excessPaid.budgetOverride?.used === true &&
        excessPaid.budgetOverride?.reason === 'Operación urgente autorizada por dirección.' &&
        excessPaid.workflow?.at(-1)?.budgetOverrideUsed === true
    );

    control = await budgetService.getBudgetControl(
      { periodKey: PERIOD_KEY },
      scopeA
    );
    ok(
      'el control refleja el exceso real después de autorizarlo',
      control.summary.spentAmount === 110000 &&
        control.summary.availableAmount === -10000 &&
        control.summary.exceededCount === 1
    );

    await workflowService.cancelExpenseRequest(
      excessPaid._id,
      {
        expectedRevision: 1,
        cancellationReason: 'El proveedor reversó el servicio.',
      },
      controller,
      scopeA
    );
    control = await budgetService.getBudgetControl(
      { periodKey: PERIOD_KEY },
      scopeA
    );
    ok(
      'anular revierte el ejecutado sin borrar la trazabilidad',
      control.summary.spentAmount === 70000 &&
        control.summary.availableAmount === 30000 &&
        await FinanceExpense.exists({
          _id: excessPaid._id,
          status: 'cancelled',
          'budgetOverride.used': true,
        })
    );

    const concurrencyCenter = await budgetService.createCostCenter(
      { code: `${PREFIX}-CON`, name: `Concurrencia ${RUN_ID}` },
      planner
    );
    await budgetService.createBudget(
      {
        periodKey: PERIOD_KEY,
        branchId: String(branchA._id),
        costCenterId: String(concurrencyCenter._id),
        expenseType: 'operating',
        amount: 100000,
        warningThresholdPercent: 90,
      },
      planner
    );
    const [concurrentA, concurrentB] = await Promise.all([
      workflowService.requestExpense(
        expensePayload(branchA, concurrencyCenter, 'CON-A', 60000),
        requester
      ),
      workflowService.requestExpense(
        expensePayload(branchA, concurrencyCenter, 'CON-B', 60000),
        requester
      ),
    ]);
    const concurrentResults = await Promise.allSettled([
      workflowService.reviewExpenseRequest(
        concurrentA._id,
        { decision: 'approve', expectedRevision: 0 },
        actor('aprobador.concurrente.a'),
        scopeA
      ),
      workflowService.reviewExpenseRequest(
        concurrentB._id,
        { decision: 'approve', expectedRevision: 0 },
        actor('aprobador.concurrente.b'),
        scopeA
      ),
    ]);
    const fulfilled = concurrentResults.filter((result) => result.status === 'fulfilled');
    const rejected = concurrentResults.filter((result) => result.status === 'rejected');
    ok(
      'dos aprobaciones simultáneas no consumen dos veces el mismo saldo',
      fulfilled.length === 1 &&
        rejected.length === 1 &&
        rejected[0].reason?.code === 'FINANCE_BUDGET_LIMIT_EXCEEDED'
    );

    const paidConcurrentCount = await FinanceExpense.countDocuments({
      _id: { $in: [concurrentA._id, concurrentB._id] },
      status: 'paid',
    });
    ok('la concurrencia deja exactamente un gasto pagado', paidConcurrentCount === 1);

    await budgetService.createBudget(
      {
        periodKey: PERIOD_KEY,
        branchId: String(branchB._id),
        costCenterId: String(center._id),
        expenseType: 'operating',
        amount: 50000,
      },
      planner
    );
    const onlyA = await budgetService.getBudgetControl(
      { periodKey: PERIOD_KEY },
      scopeA
    );
    ok(
      'el consolidado de una sede no mezcla presupuestos de otra',
      onlyA.lines.every((line) => String(line.branch) === String(branchA._id))
    );

    const budgetB = (await budgetService.listBudgets(
      { periodKey: PERIOD_KEY },
      scopeB
    ))[0];
    await expectError(
      () => budgetService.updateBudget(
        budgetB._id,
        {
          expectedRevision: 0,
          amount: 60000,
          changeReason: 'Intento fuera de sede.',
        },
        planner,
        scopeA
      ),
      'FINANCE_BUDGET_NOT_FOUND'
    );
    ok('una sede no puede ajustar el presupuesto de otra');

    const adjusted = await budgetService.updateBudget(
      budget._id,
      {
        expectedRevision: 0,
        amount: 120000,
        warningThresholdPercent: 75,
        changeReason: 'Ajuste documentado por proyección mensual.',
      },
      planner,
      scopeA
    );
    ok(
      'un ajuste autorizado incrementa versión y conserva motivo',
      adjusted.revision === 1 &&
        adjusted.amount === 120000 &&
        adjusted.history?.at(-1)?.notes === 'Ajuste documentado por proyección mensual.'
    );

    await expectError(
      () => budgetService.updateBudget(
        budget._id,
        {
          expectedRevision: 0,
          amount: 130000,
          changeReason: 'Versión antigua.',
        },
        planner,
        scopeA
      ),
      'FINANCE_BUDGET_VERSION_CONFLICT'
    );
    ok('una versión vencida no sobrescribe el presupuesto');

    const legacyPending = await workflowService.requestExpense(
      expensePayload(branchA, null, 'LEGACY', 5000, 'other'),
      requester
    );
    const legacyPaid = await workflowService.reviewExpenseRequest(
      legacyPending._id,
      { decision: 'approve', expectedRevision: 0 },
      approver,
      scopeA
    );
    ok(
      'un gasto compatible sin centro conserva el flujo anterior',
      legacyPaid.status === 'paid' &&
        legacyPaid.budgetEvaluation?.outcome === 'unassigned' &&
        legacyPaid.budgetOverride?.used === false
    );

    console.log(
      `\nIntegración Etapa 2 Finanzas validada: ${controls} controles superados.`
    );
  } finally {
    await cleanup();
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error('Fallo integración Etapa 2 Finanzas:', error);
  process.exitCode = 1;
});
