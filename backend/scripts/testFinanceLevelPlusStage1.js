'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');

const FinanceExpense = require('../models/FinanceExpense');
const workflowService = require('../services/adminFinanceExpenseWorkflowService');
const {
  findAdminRoutePermission,
} = require('../security/adminRoutePermissionMap');
const {
  getPermissionMeta,
} = require('../security/adminPermissionCatalog');
const migration = require('./migrateFinanceExpenseIndexes');

const { __test } = workflowService;
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

function validateModelAndWorkflowContracts() {
  const statuses = FinanceExpense.getStatuses();
  ok('el modelo incorpora el estado rechazado', statuses.includes('rejected'));
  ok('cada gasto conserva una revisión optimista', Boolean(FinanceExpense.schema.path('revision')));
  ok('cada gasto conserva una línea de tiempo de decisiones', Boolean(FinanceExpense.schema.path('workflow')));
  ok('la solicitud conserva una clave idempotente', Boolean(FinanceExpense.schema.path('requestKey')));
  ok('la anulación conserva actor y motivo', Boolean(FinanceExpense.schema.path('cancelledBy')) && Boolean(FinanceExpense.schema.path('cancellationReason')));

  const actorA = id();
  const actorB = id();
  const keyA = __test.normalizeRequestKey('solicitud-segura-001', actorA);
  const keyB = __test.normalizeRequestKey('solicitud-segura-001', actorB);
  ok('la idempotencia se aísla por usuario solicitante', keyA.length === 64 && keyA !== keyB);

  assert.throws(
    () => __test.expectedRevision(undefined),
    (error) => error?.code === 'FINANCE_EXPENSE_REVISION_REQUIRED' && error?.status === 428
  );
  ok('toda mutación exige la versión vigente');

  assert.throws(
    () => __test.actorContext({ snapshot: { username: 'sin-id' } }),
    (error) => error?.code === 'FINANCE_EXPENSE_ACTOR_REQUIRED' && error?.status === 403
  );
  ok('las decisiones exigen un administrador identificable');

  assert.throws(
    () => __test.normalizeExpenseData({ amount: 1000, category: 'Operativo', paymentMethod: 'cash' }),
    (error) => error?.code === 'FINANCE_EXPENSE_DESCRIPTION_REQUIRED'
  );
  ok('una solicitud exige explicar el concepto del gasto');

  const event = __test.workflowEvent({
    action: 'approved',
    fromStatus: 'pending',
    toStatus: 'paid',
    actor: __test.actorContext({
      adminUserId: id(),
      snapshot: { username: 'supervisor', adminRole: 'manager' },
    }),
    notes: 'Soporte verificado',
    revision: 1,
  });
  ok('cada decisión registra estado, actor, nota y versión', event.action === 'approved' && event.fromStatus === 'pending' && event.toStatus === 'paid' && event.actor && event.notes === 'Soporte verificado' && event.revision === 1);
}

function validatePermissionsAndRoutes() {
  const approvePermission = getPermissionMeta('finance:expenses:approve');
  const cancelPermission = getPermissionMeta('finance:expenses:cancel');
  ok('aprobar gastos tiene permiso financiero propio', approvePermission?.module === 'finance' && approvePermission?.danger === true);
  ok('anular gastos tiene permiso financiero propio', cancelPermission?.module === 'finance' && cancelPermission?.danger === true);

  const review = findAdminRoutePermission('POST', `/api/admin/finance/expenses/${id()}/review`);
  const cancel = findAdminRoutePermission('DELETE', `/api/admin/finance/expenses/${id()}`);
  ok('aprobar o rechazar exige finance:expenses:approve', review?.permission === 'finance:expenses:approve');
  ok('las decisiones quedan auditadas como sensibles', review?.audit === true && review?.danger === true);
  ok('anular exige finance:expenses:cancel', cancel?.permission === 'finance:expenses:cancel');
  ok('la anulación queda auditada como acción peligrosa', cancel?.audit === true && cancel?.danger === true);

  const routes = read('backend/routes/adminFinance.js');
  ok('la API usa el flujo controlado al crear y editar', routes.includes('financeExpenseWorkflow.requestExpense') && routes.includes('financeExpenseWorkflow.updateExpenseRequest'));
  ok('la API usa decisiones y anulaciones controladas', routes.includes('financeExpenseWorkflow.reviewExpenseRequest') && routes.includes('financeExpenseWorkflow.cancelExpenseRequest'));
}

function validateAccountingAndInterface() {
  const service = read('backend/services/adminFinanceService.js');
  const workflow = read('backend/services/adminFinanceExpenseWorkflowService.js');
  const page = read('frontend/src/admin/finance/AdminFinancePage.jsx');
  const layout = read('frontend/src/admin/finance/financeLayoutFix.css');
  const api = read('frontend/src/admin/finance/api/financeApi.js');

  ok('solo los gastos pagados afectan la utilidad', service.includes("buildExpenseFilter({ ...query, status: 'paid' })"));
  ok('el reporte separa montos por estado del flujo', service.includes('getExpenseWorkflowSummary') && service.includes("['pending', 'paid', 'rejected', 'cancelled']"));
  ok('una aprobación simultánea se protege con estado y revisión', workflow.includes("revision,\n      status: 'pending'") && workflow.includes("$inc: { revision: 1 }"));
  ok('el solicitante no propietario no puede autoaprobarse', workflow.includes('FINANCE_EXPENSE_SELF_APPROVAL_FORBIDDEN'));
  ok('la excepción del propietario exige justificación', workflow.includes('FINANCE_EXPENSE_SELF_APPROVAL_REASON_REQUIRED') && workflow.includes('selfApprovalOverride'));
  ok('rechazo y anulación exigen motivos explícitos', workflow.includes('FINANCE_EXPENSE_REVIEW_NOTES_REQUIRED') && workflow.includes('FINANCE_EXPENSE_CANCELLATION_REASON_REQUIRED'));

  ok('la interfaz diferencia los cuatro estados financieros', ['Pendientes', 'Aprobados', 'Rechazados', 'Anulados'].every((label) => page.includes(label)));
  ok('la interfaz muestra la trazabilidad de cada gasto', page.includes('Trazabilidad financiera') && page.includes('ExpenseHistoryModal'));
  ok('la interfaz no usa confirmaciones nativas del navegador', !page.includes('window.confirm'));
  ok('la interfaz separa permisos para solicitar, aprobar y anular', page.includes("can('finance:expenses')") && page.includes("can('finance:expenses:approve')") && page.includes("can('finance:expenses:cancel')"));
  ok('los controles visuales respetan las variables del tema', page.includes("background: 'var(--admin-button-bg)'") && page.includes("color: 'var(--admin-button-text)'"));
  ok('la tabla de solicitudes reorganiza sus acciones sin desbordarse', page.includes('finance-expense-workflow') && page.includes('finance-expense-table') && layout.includes('@container finance-expense-workflow (max-width: 1040px)') && layout.includes('grid-column: 1 / -1'));
  ok('el cliente envía decisiones y anulaciones con cuerpo versionado', api.includes("/review`") && api.includes('data: payload'));
}

function validateMigrationAndDelivery() {
  const plan = migration.buildMigrationPlan();
  ok('la migración declara tres índices financieros canónicos', plan.length === 3);
  const unique = plan.find((definition) => definition.options?.unique === true);
  ok('la clave de solicitud tiene índice único parcial', unique?.options?.name === 'requestKey_1_unique_present' && unique?.options?.partialFilterExpression?.requestKey?.$exists === true);
  ok('la migración es no destructiva y requiere autorización para aplicar', migration.parseArguments([]).apply === false && migration.parseArguments([migration.APPLY_FLAG]).apply === true);
  assert.throws(
    () => migration.assertWriteAuthorization({ apply: true, nodeEnv: 'production' }),
    (error) => error?.code === 'FINANCE_EXPENSE_INDEX_MIGRATION_PRODUCTION_CONFIRMATION_REQUIRED'
  );
  ok('producción exige una confirmación adicional para migrar');

  const backendPackage = read('backend/package.json');
  const frontendPackage = read('frontend/package.json');
  const ci = read('.github/workflows/finance-ci.yml');
  const docs = read('docs/modulos/finanzas-nivel-plus-etapa-1.md');
  ok('backend y frontend exponen pruebas propias de Etapa 1', backendPackage.includes('test:finance-level-plus-stage1') && frontendPackage.includes('test:finance-level-plus-stage1'));
  ok('CI ejecuta Etapa 1 y MongoDB aislado', ci.includes('test:finance-level-plus-stage1') && ci.includes('test:finance-level-plus-stage1-integration') && ci.includes('finance_stage1_ci'));
  ok('la documentación explica aprobación, concurrencia y migración', docs.includes('segregación') && docs.includes('revisión optimista') && docs.includes('migrate:finance-expense-indexes'));
}

function main() {
  validateModelAndWorkflowContracts();
  validatePermissionsAndRoutes();
  validateAccountingAndInterface();
  validateMigrationAndDelivery();
  console.log(`\nEtapa 1 Finanzas validada: ${controls} controles superados.`);
}

try {
  main();
} catch (error) {
  console.error('Fallo en Etapa 1 Finanzas:', error);
  process.exitCode = 1;
}
