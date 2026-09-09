'use strict';

/* eslint-disable no-console */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const FinanceExpense = require('../models/FinanceExpense');
const Order = require('../models/Order');
const treasuryService = require('../services/adminFinanceTreasuryService');
const workflowService = require('../services/adminFinanceExpenseWorkflowService');
const migration = require('./migrateFinanceTreasuryIndexes');
const {
  ADMIN_ROUTE_PERMISSION_RULES,
} = require('../security/adminRoutePermissionMap');
const {
  ADMIN_PERMISSION_KEYS,
} = require('../security/adminPermissionCatalog');

let controls = 0;

function ok(message, condition = true) {
  assert.equal(Boolean(condition), true, message);
  controls += 1;
  console.log(`OK ${String(controls).padStart(2, '0')} ${message}`);
}

function source(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', '..', relativePath), 'utf8');
}

async function expectError(operation, code) {
  try {
    await operation();
  } catch (error) {
    assert.equal(error?.code, code);
    return;
  }
  assert.fail(`Se esperaba el error ${code}.`);
}

async function main() {
  console.log('\n=== Finanzas Nivel Plus · Etapa 3 ===');

  const expenseIndexes = FinanceExpense.schema.indexes();
  const orderIndexes = Order.schema.indexes();
  ok(
    'los gastos exponen el índice operativo de cuentas por pagar',
    expenseIndexes.some(([, options]) => options.name === 'branch_1_paymentTerms_1_settlement.status_1_dueDate_1')
  );
  ok(
    'las órdenes exponen el índice de cobros pendientes por sede',
    orderIndexes.some(([, options]) => options.name === 'branch_1_payment.status_1_createdAt_1')
  );
  ok('el modelo admite condición de pago a crédito', FinanceExpense.getPaymentTerms().includes('credit'));

  const workflowActions = FinanceExpense.schema.path('workflow').schema.path('action').enumValues;
  ok('el historial admite abonos de tesorería', workflowActions.includes('payable_payment_registered'));
  ok('el permiso de tesorería está registrado', ADMIN_PERMISSION_KEYS.includes('finance:treasury:manage'));

  const treasuryRead = ADMIN_ROUTE_PERMISSION_RULES.find((rule) => rule.path === '/api/admin/finance/treasury');
  const treasuryWrite = ADMIN_ROUTE_PERMISSION_RULES.find((rule) => rule.path === '/api/admin/finance/payables/:id/payments');
  ok('la consulta de tesorería exige finance:view', treasuryRead?.permission === 'finance:view');
  ok('los abonos exigen un permiso independiente', treasuryWrite?.permission === 'finance:treasury:manage');
  ok('los abonos están marcados como auditables y peligrosos', treasuryWrite?.audit && treasuryWrite?.danger);

  const normalized = workflowService.__test.normalizeExpenseData({
    date: '2026-09-08',
    amount: 100000,
    type: 'operating',
    category: 'Servicios',
    description: 'Servicio mensual',
    paymentMethod: 'transfer',
    paymentTerms: 'credit',
    dueDate: '2026-09-30',
  });
  ok('el gasto conserva crédito y vencimiento normalizados', normalized.paymentTerms === 'credit' && normalized.dueDate instanceof Date);
  await expectError(
    () => Promise.resolve(workflowService.__test.normalizeExpenseData({
      date: '2026-09-08',
      amount: 100000,
      type: 'operating',
      category: 'Servicios',
      description: 'Servicio mensual',
      paymentMethod: 'transfer',
      paymentTerms: 'credit',
    })),
    'FINANCE_EXPENSE_DUE_DATE_REQUIRED'
  );
  ok('un crédito no puede registrarse sin vencimiento');

  const asOf = new Date('2026-09-08T00:00:00.000Z');
  const aging = treasuryService.__test.agingMeta('2026-08-20', asOf);
  ok('la antigüedad identifica vencimientos entre 8 y 30 días', aging.key === 'days_8_30' && aging.overdue);
  const summary = treasuryService.__test.summarizeRows([
    { amount: 30000, dueDate: '2026-09-07' },
    { amount: 50000, dueDate: '2026-09-20' },
  ], asOf);
  ok('el resumen separa cartera vencida y próxima', summary.amount === 80000 && summary.overdueAmount === 30000 && summary.dueNext30Amount === 50000);
  ok('la orden usa el monto de pago como saldo canónico', treasuryService.__test.orderBalance({ total: 90000, payment: { amount: 70000 } }) === 70000);

  const payment = treasuryService.__test.paymentData({
    amount: 25000,
    paymentMethod: 'transfer',
    reference: 'TRX-100',
    paidAt: '2026-09-08',
  });
  ok('el abono normaliza valor, método y referencia', payment.amount === 25000 && payment.method === 'transfer' && payment.reference === 'TRX-100');
  ok('la fecha del abono conserva el día operativo de Bogotá', payment.paidAt.toISOString() === '2026-09-08T05:00:00.000Z');
  await expectError(
    () => Promise.resolve(treasuryService.__test.paymentData({
      amount: 25000,
      paymentMethod: 'transfer',
      reference: 'TRX-INVALID-DATE',
      paidAt: '2026-02-31',
    })),
    'FINANCE_PAYABLE_PAYMENT_DATE_INVALID'
  );
  ok('el abono rechaza fechas calendario inexistentes');
  await expectError(
    () => Promise.resolve(treasuryService.__test.paymentData({
      amount: 25000,
      paymentMethod: 'transfer',
      paidAt: '2026-09-08',
    })),
    'FINANCE_PAYABLE_PAYMENT_REFERENCE_REQUIRED'
  );
  ok('los pagos no efectivos exigen referencia');

  const firstHash = treasuryService.__test.paymentRequestKey('request-123', 'actor-1', 'expense-1');
  const secondHash = treasuryService.__test.paymentRequestKey('request-123', 'actor-1', 'expense-1');
  ok('la idempotencia produce una llave SHA-256 estable', firstHash === secondHash && firstHash.length === 64);

  const plan = migration.buildMigrationPlan();
  ok('la migración cubre gastos y órdenes', plan.length === 2 && plan.every((item) => item.indexCount === 1));
  ok('la migración no declara operaciones destructivas', source('backend/scripts/migrateFinanceTreasuryIndexes.js').includes('destructiveOperations: []'));
  await expectError(
    () => Promise.resolve(migration.parseArguments(['--desconocido'])),
    'FINANCE_TREASURY_INDEX_MIGRATION_UNKNOWN_ARGUMENT'
  );
  ok('la migración rechaza argumentos desconocidos');
  await expectError(
    () => Promise.resolve(migration.assertWriteAuthorization({
      apply: true,
      confirmProduction: false,
      nodeEnv: 'production',
    })),
    'FINANCE_TREASURY_INDEX_MIGRATION_PRODUCTION_CONFIRMATION_REQUIRED'
  );
  ok('producción exige confirmación adicional para crear índices');

  const routeSource = source('backend/routes/adminFinance.js');
  const panelSource = source('frontend/src/admin/finance/FinanceTreasuryPanel.jsx');
  const pageSource = source('frontend/src/admin/finance/AdminFinancePage.jsx');
  const cssSource = source('frontend/src/admin/finance/financeTreasuryPanel.css');
  const treasurySource = source('backend/services/adminFinanceTreasuryService.js');
  const docsSource = source('docs/modulos/finanzas-nivel-plus-etapa-3.md');
  const ciSource = source('.github/workflows/finance-ci.yml');
  ok('la API expone lectura y registro de abonos', routeSource.includes("'/treasury'") && routeSource.includes("'/payables/:id/payments'"));
  ok('la interfaz integra cartera dentro de Finanzas', pageSource.includes('<FinanceTreasuryPanel'));
  ok('la interfaz permite elegir contado o crédito', pageSource.includes('Condición de pago') && pageSource.includes('Vencimiento'));
  ok('el panel diferencia cobros y pagos pendientes', panelSource.includes('Cobros pendientes') && panelSource.includes('Pagos pendientes'));
  ok('el panel informa proyección a 30 días', panelSource.includes('Flujo próximo 30 días'));
  ok('el pago usa versión e idempotencia', panelSource.includes('expectedRevision') && panelSource.includes('requestKey'));
  ok('la interfaz oculta abonos sin permiso', pageSource.includes("can('finance:treasury:manage')") && panelSource.includes('canManage'));
  ok('los modales permanecen centrados y adaptables', cssSource.includes('place-items: center') && cssSource.includes('@media (max-width: 560px)'));
  ok('los colores provienen del tema administrativo', cssSource.includes('var(--admin-card-bg)') && cssSource.includes('var(--admin-primary)'));
  ok('la interfaz no muestra nombres internos de etapa', !panelSource.includes('Etapa 3'));
  ok('los listados están limitados y los totales se agregan en MongoDB', treasurySource.includes('.limit(40)') && treasurySource.includes('aggregateSummary'));
  ok('la documentación diferencia operación y contabilidad legal', docsSource.includes('No sustituye un sistema de contabilidad legal'));
  ok('la documentación explica idempotencia y concurrencia', docsSource.includes('llave idempotente') && docsSource.includes('Dos abonos simultáneos'));
  ok('CI ejecuta contratos, migración, interfaz e integración aislada de Etapa 3', ciSource.includes('test:finance-level-plus-stage3') && ciSource.includes('migrate:finance-treasury-indexes') && ciSource.includes('FINANCE_STAGE3_MONGO_URI'));

  console.log(`\nEtapa 3 Finanzas validada: ${controls} controles superados.`);
}

main().catch((error) => {
  console.error('Fallo validando Etapa 3 Finanzas:', error);
  process.exitCode = 1;
});
