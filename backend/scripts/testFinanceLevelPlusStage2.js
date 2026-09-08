'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');

const FinanceBudget = require('../models/FinanceBudget');
const FinanceCostCenter = require('../models/FinanceCostCenter');
const FinanceExpense = require('../models/FinanceExpense');
const budgetService = require('../services/adminFinanceBudgetService');
const migration = require('./migrateFinanceBudgetIndexes');
const {
  findAdminRoutePermission,
} = require('../security/adminRoutePermissionMap');
const {
  getPermissionMeta,
} = require('../security/adminPermissionCatalog');

let controls = 0;

function ok(message, condition = true) {
  assert.ok(condition, message);
  controls += 1;
  console.log(`OK ${String(controls).padStart(2, '0')} ${message}`);
}

function read(relativePath) {
  return fs
    .readFileSync(path.join(__dirname, '..', '..', relativePath), 'utf8')
    .replace(/\r\n?/g, '\n');
}

function id() {
  return new mongoose.Types.ObjectId().toHexString();
}

function validateDataContracts() {
  ok('existe el modelo de centros de costo', FinanceCostCenter.modelName === 'FinanceCostCenter');
  ok('cada centro conserva estado y revisión', Boolean(FinanceCostCenter.schema.path('status')) && Boolean(FinanceCostCenter.schema.path('revision')));
  ok('cada centro conserva historial auditable', Boolean(FinanceCostCenter.schema.path('history')));
  ok('existe el modelo presupuestal', FinanceBudget.modelName === 'FinanceBudget');
  ok('el presupuesto identifica periodo, sede, centro y categoría', ['periodKey', 'branch', 'costCenter', 'expenseType'].every((field) => Boolean(FinanceBudget.schema.path(field))));
  ok('el presupuesto conserva límite y umbral de alerta', Boolean(FinanceBudget.schema.path('amount')) && Boolean(FinanceBudget.schema.path('warningThresholdPercent')));
  ok('el presupuesto tiene revisión optimista', Boolean(FinanceBudget.schema.path('revision')) && Boolean(FinanceBudget.schema.path('controlRevision')));
  ok('el presupuesto incorpora bloqueo de aprobación', Boolean(FinanceBudget.schema.path('approvalLock.expiresAt')));
  ok('el gasto conserva centro de costo', Boolean(FinanceExpense.schema.path('costCenter')) && Boolean(FinanceExpense.schema.path('costCenterSnapshot')));
  ok('el gasto conserva la evaluación presupuestal', Boolean(FinanceExpense.schema.path('budgetEvaluation')));
  ok('el gasto conserva excepciones presupuestales', Boolean(FinanceExpense.schema.path('budgetOverride')));

  const invalidCenter = new FinanceCostCenter({
    code: '!',
    name: '',
    createdBy: id(),
  }).validateSync();
  ok('un centro exige código y nombre válidos', Boolean(invalidCenter?.errors?.code) && Boolean(invalidCenter?.errors?.name));

  const invalidBudget = new FinanceBudget({
    budgetKey: 'x',
    periodKey: '2026-13',
    periodStart: new Date(),
    periodEnd: new Date(),
    costCenter: id(),
    costCenterSnapshot: { code: 'OPS', name: 'Operación' },
    expenseType: 'invalid',
    amount: 0,
    createdBy: id(),
  }).validateSync();
  ok('un presupuesto rechaza periodo, categoría y monto inválidos', Boolean(invalidBudget?.errors?.periodKey) && Boolean(invalidBudget?.errors?.expenseType) && Boolean(invalidBudget?.errors?.amount));
}

function validateBudgetLogic() {
  const { __test } = budgetService;
  const period = __test.parsePeriod('2026-09');
  ok('el periodo mensual tiene límites UTC deterministas', period.start.toISOString() === '2026-09-01T00:00:00.000Z' && period.endExclusive.toISOString() === '2026-10-01T00:00:00.000Z');
  assert.throws(
    () => __test.parsePeriod('09/2026'),
    (error) => error?.code === 'FINANCE_BUDGET_PERIOD_INVALID'
  );
  ok('un periodo ambiguo se rechaza');
  ok('el nivel saludable queda bajo el umbral', __test.budgetLevel({ amount: 100000, exposure: 70000, warningThresholdPercent: 80 }) === 'healthy');
  ok('el umbral activa una alerta', __test.budgetLevel({ amount: 100000, exposure: 80000, warningThresholdPercent: 80 }) === 'warning');
  ok('la exposición superior al límite queda excedida', __test.budgetLevel({ amount: 100000, exposure: 100001, warningThresholdPercent: 80 }) === 'exceeded');
  const centerId = id();
  const branchId = id();
  const key = __test.budgetIdentity({ periodKey: '2026-09', branch: branchId, costCenter: centerId, expenseType: 'operating' });
  ok('la identidad evita duplicar el mismo presupuesto', key === `2026-09:${branchId}:${centerId}:operating`);

  const service = read('backend/services/adminFinanceBudgetService.js');
  const workflow = read('backend/services/adminFinanceExpenseWorkflowService.js');
  ok('los totales se derivan de gastos pendientes y pagados', service.includes("status: { $in: ['pending', 'paid'] }") && service.includes('FinanceExpense.aggregate'));
  ok('las aprobaciones se serializan con un bloqueo temporal', service.includes('acquireApprovalLock') && service.includes('approvalLock.expiresAt'));
  ok('el bloqueo siempre intenta liberarse', service.includes('releaseApprovalLock') && service.includes('finally'));
  ok('el gasto se vuelve a evaluar al aprobar', workflow.includes('runExpenseApprovalControl'));
  ok('un exceso exige permiso y justificación', service.includes('FINANCE_BUDGET_LIMIT_EXCEEDED') && service.includes('FINANCE_BUDGET_OVERRIDE_REASON_REQUIRED'));
  ok('los gastos anteriores sin centro mantienen compatibilidad', service.includes("outcome: 'unassigned'"));
  ok('la excepción queda registrada en la línea de tiempo', workflow.includes('budgetOverrideReason') && workflow.includes('budgetOverrideUsed'));
}

function validateAccessAndRoutes() {
  const manage = getPermissionMeta('finance:budgets:manage');
  const override = getPermissionMeta('finance:budgets:override');
  ok('gestionar presupuestos tiene permiso propio', manage?.module === 'finance' && manage?.audit === true);
  ok('autorizar excesos es un permiso peligroso independiente', override?.module === 'finance' && override?.danger === true);

  const centerCreate = findAdminRoutePermission('POST', '/api/admin/finance/cost-centers');
  const budgetCreate = findAdminRoutePermission('POST', '/api/admin/finance/budgets');
  const budgetUpdate = findAdminRoutePermission('PUT', `/api/admin/finance/budgets/${id()}`);
  const control = findAdminRoutePermission('GET', '/api/admin/finance/budget-control');
  ok('crear centros exige gestión presupuestal', centerCreate?.permission === 'finance:budgets:manage' && centerCreate?.audit === true);
  ok('crear presupuestos exige gestión presupuestal', budgetCreate?.permission === 'finance:budgets:manage' && budgetCreate?.audit === true);
  ok('ajustar presupuestos exige gestión y auditoría', budgetUpdate?.permission === 'finance:budgets:manage' && budgetUpdate?.audit === true);
  ok('el control mensual usa el permiso de consulta', control?.permission === 'finance:view');

  const routes = read('backend/routes/adminFinance.js');
  ok('las rutas aplican alcance de sede a presupuestos', routes.includes('resolveFinanceWriteBranch') && routes.includes('branchIds: scoped.access.branchIds'));
  ok('la aprobación calcula el permiso efectivo de excepción', routes.includes("hasEffectivePermission(\n      req,\n      'finance:budgets:override'"));
}

function validateInterfaceAndDelivery() {
  const page = read('frontend/src/admin/finance/AdminFinancePage.jsx');
  const panel = read('frontend/src/admin/finance/FinanceBudgetPanel.jsx');
  const css = read('frontend/src/admin/finance/financeBudgetPanel.css');
  const api = read('frontend/src/admin/finance/api/financeApi.js');
  ok('la interfaz muestra asignado, comprometido, ejecutado y disponible', ['Asignado', 'Comprometido', 'Ejecutado', 'Disponible'].every((label) => panel.includes(label)));
  ok('el gasto permite elegir centro de costo', page.includes('Centro de costo') && page.includes('costCenterId'));
  ok('la interfaz separa gestión y excepción por permisos', page.includes("can('finance:budgets:manage')") && page.includes("can('finance:budgets:override')"));
  ok('la aprobación explica el bloqueo presupuestal', page.includes('Esta aprobación supera el presupuesto') && page.includes('Justificación presupuestal'));
  ok('el panel no introduce una barra lateral', !panel.includes('sidebar'));
  ok('los modales son centrados y no usan confirmación nativa', css.includes('place-items: center') && !panel.includes('window.confirm') && !page.includes('window.confirm'));
  ok('los colores proceden del tema administrativo', css.includes('var(--admin-primary)') && css.includes('var(--admin-card-bg)') && css.includes('var(--admin-button-bg)'));
  ok('la API expone centros, presupuestos y control mensual', ['getFinanceCostCenters', 'createFinanceCostCenter', 'getFinanceBudgets', 'createFinanceBudget', 'getFinanceBudgetControl'].every((name) => api.includes(name)));

  const plan = migration.buildMigrationPlan();
  const indexCount = plan.reduce((sum, item) => sum + item.indexCount, 0);
  ok('la migración cubre tres colecciones y siete índices', plan.length === 3 && indexCount === 7);
  ok('la migración no se aplica sin bandera explícita', migration.parseArguments([]).apply === false && migration.parseArguments([migration.APPLY_FLAG]).apply === true);
  assert.throws(
    () => migration.assertWriteAuthorization({ apply: true, nodeEnv: 'production' }),
    (error) => error?.code === 'FINANCE_BUDGET_INDEX_MIGRATION_PRODUCTION_CONFIRMATION_REQUIRED'
  );
  ok('producción exige confirmación adicional para migrar');

  const backendPackage = read('backend/package.json');
  const frontendPackage = read('frontend/package.json');
  const ci = read('.github/workflows/finance-ci.yml');
  const docs = read('docs/modulos/finanzas-nivel-plus-etapa-2.md');
  ok('backend y frontend exponen pruebas propias de Etapa 2', backendPackage.includes('test:finance-level-plus-stage2') && frontendPackage.includes('test:finance-level-plus-stage2'));
  ok('CI valida contratos, migración e integración aislada', ci.includes('test:finance-level-plus-stage2') && ci.includes('migrate:finance-budget-indexes') && ci.includes('finance_stage2_ci'));
  ok('la documentación explica comprometido, ejecución y excepciones', docs.includes('Comprometido') && docs.includes('bloqueo atómico') && docs.includes('finance:budgets:override'));
}

function main() {
  validateDataContracts();
  validateBudgetLogic();
  validateAccessAndRoutes();
  validateInterfaceAndDelivery();
  console.log(`\nEtapa 2 Finanzas validada: ${controls} controles superados.`);
}

try {
  main();
} catch (error) {
  console.error('Fallo en Etapa 2 Finanzas:', error);
  process.exitCode = 1;
}
