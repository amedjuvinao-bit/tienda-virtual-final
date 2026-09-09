'use strict';

/* eslint-disable no-console */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const FinancePeriodClose = require('../models/FinancePeriodClose');
const closingService = require('../services/adminFinanceClosingService');
const migration = require('./migrateFinancePeriodCloseIndexes');
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
    return error;
  }
  assert.fail(`Se esperaba el error ${code}.`);
}

function healthyFixture() {
  return {
    summary: {
      kpis: {
        revenue: 100000,
        cogs: 40000,
        grossProfit: 60000,
        operatingExpenses: 10000,
        netProfit: 50000,
        cashDifference: 0,
        costQuality: { missingCostItems: 0, estimatedCostItems: 0 },
      },
      cash: { openSessions: 0 },
      expenses: { workflow: { pending: { count: 0, amount: 0 } } },
    },
    budget: {
      summary: {
        allocatedAmount: 100000,
        committedAmount: 10000,
        spentAmount: 20000,
        availableAmount: 70000,
        exceededCount: 0,
        unbudgetedCount: 0,
      },
    },
    treasury: {
      summary: {
        dueNext30Receivable: 30000,
        dueNext30Payable: 20000,
        projectedNet30: 10000,
        overdueReceivable: 0,
        overduePayable: 0,
      },
    },
  };
}

async function main() {
  console.log('\n=== Finanzas Nivel Plus · Etapa 4 ===');

  const indexes = FinancePeriodClose.schema.indexes();
  ok('el cierre posee identidad única por periodo y sede', indexes.some(([, options]) => options.name === 'branch_1_periodKey_1_unique' && options.unique));
  ok('la huella del cierre exige SHA-256', FinancePeriodClose.schema.path('snapshotHash').options.minlength === 64);
  ok('el modelo conserva certificaciones versionadas', Boolean(FinancePeriodClose.schema.path('certifications').schema.path('revision')));

  const period = closingService.__test.periodMeta('2026-08', new Date('2026-09-09T12:00:00.000Z'));
  ok('un mes terminado se clasifica como cierre mensual', period.status === 'certified' && period.toLocal === '2026-08-31');
  const current = closingService.__test.periodMeta('2026-09', new Date('2026-09-09T12:00:00.000Z'));
  ok('el mes en curso se conserva como corte provisional', current.status === 'provisional');
  await expectError(
    () => Promise.resolve(closingService.__test.periodMeta('2026-10', new Date('2026-09-09T12:00:00.000Z'))),
    'FINANCE_CLOSE_FUTURE_PERIOD'
  );
  ok('el servidor impide certificar periodos futuros');

  const healthy = closingService.__test.buildControls(healthyFixture());
  ok('las ecuaciones financieras y operativas quedan conciliadas', healthy.status === 'ready' && healthy.blockerCount === 0 && healthy.checks.length === 12);
  const blockedFixture = healthyFixture();
  blockedFixture.summary.kpis.cashDifference = 5000;
  blockedFixture.summary.kpis.costQuality.missingCostItems = 2;
  blockedFixture.summary.cash.openSessions = 1;
  const blocked = closingService.__test.buildControls(blockedFixture);
  ok('caja abierta, diferencia y costos faltantes bloquean el cierre', blocked.status === 'blocked' && blocked.blockerCount === 3);

  const hashA = closingService.__test.hashSnapshot({ b: 2, a: { y: 1, x: 0 } });
  const hashB = closingService.__test.hashSnapshot({ a: { x: 0, y: 1 }, b: 2 });
  ok('la huella financiera es estable aunque cambie el orden de las propiedades', hashA === hashB && hashA.length === 64);
  await expectError(
    () => Promise.resolve(closingService.__test.expectedRevision('')),
    'FINANCE_CLOSE_REVISION_REQUIRED'
  );
  ok('una recertificación exige la versión vigente');
  await expectError(
    () => Promise.resolve(closingService.__test.certificationRequestKey('corta')),
    'FINANCE_CLOSE_REQUEST_KEY_REQUIRED'
  );
  ok('cada certificación exige una clave idempotente');

  ok('el permiso de certificación está registrado', ADMIN_PERMISSION_KEYS.includes('finance:periods:certify'));
  ok('la autorización excepcional usa un permiso independiente', ADMIN_PERMISSION_KEYS.includes('finance:periods:override'));
  const closeRead = ADMIN_ROUTE_PERMISSION_RULES.find((rule) => rule.path === '/api/admin/finance/closing-control');
  const closeWrite = ADMIN_ROUTE_PERMISSION_RULES.find((rule) => rule.path === '/api/admin/finance/period-closes');
  const closeExport = ADMIN_ROUTE_PERMISSION_RULES.find((rule) => rule.path === '/api/admin/finance/closing-export');
  ok('el diagnóstico exige únicamente permiso de consulta', closeRead?.permission === 'finance:view');
  ok('la certificación es auditable, sensible y separada de la lectura', closeWrite?.permission === 'finance:periods:certify' && closeWrite?.audit && closeWrite?.danger);
  ok('el informe ejecutivo conserva el permiso de exportación', closeExport?.permission === 'finance:export' && closeExport?.audit);

  const plan = migration.buildMigrationPlan();
  ok('la migración declara los tres índices canónicos del cierre', plan.collection === 'financeperiodcloses' && plan.indexCount === 3);
  ok('la migración no contiene operaciones destructivas', source('backend/scripts/migrateFinancePeriodCloseIndexes.js').includes('destructiveOperations: []'));
  await expectError(
    () => Promise.resolve(migration.parseArguments(['--desconocido'])),
    'FINANCE_PERIOD_CLOSE_INDEX_MIGRATION_UNKNOWN_ARGUMENT'
  );
  ok('la migración rechaza argumentos desconocidos');
  await expectError(
    () => Promise.resolve(migration.assertWriteAuthorization({ apply: true, confirmProduction: false, nodeEnv: 'production' })),
    'FINANCE_PERIOD_CLOSE_INDEX_MIGRATION_PRODUCTION_CONFIRMATION_REQUIRED'
  );
  ok('producción requiere confirmación adicional para crear índices');

  const serviceSource = source('backend/services/adminFinanceClosingService.js');
  const routeSource = source('backend/routes/adminFinance.js');
  const pageSource = source('frontend/src/admin/finance/AdminFinancePage.jsx');
  const panelSource = source('frontend/src/admin/finance/FinanceClosingPanel.jsx');
  const cssSource = source('frontend/src/admin/finance/financeClosingPanel.css');
  const docsSource = source('docs/modulos/finanzas-nivel-plus-etapa-4.md');
  const ciSource = source('.github/workflows/finance-ci.yml');
  ok('el servicio cruza resultados, presupuesto y tesorería reales', serviceSource.includes('getFinanceSummary') && serviceSource.includes('getBudgetControl') && serviceSource.includes('getTreasury'));
  ok('la API publica diagnóstico, certificación e informe', routeSource.includes("'/closing-control'") && routeSource.includes("'/period-closes'") && routeSource.includes("'/closing-export'"));
  ok('la interfaz integra el cierre dentro de Finanzas', pageSource.includes('<FinanceClosingPanel'));
  ok('el panel explica controles, alertas y diferencias críticas', panelSource.includes('controles correctos') && panelSource.includes('diferencias críticas'));
  ok('la interfaz exige sede específica para certificar', panelSource.includes('Selecciona una sede'));
  ok('la certificación envía versión e idempotencia', panelSource.includes('expectedRevision') && panelSource.includes('requestKey'));
  ok('el panel no muestra nombres internos de etapa', !panelSource.includes('Etapa 4'));
  ok('el diseño usa el tema administrativo y se adapta a móvil', cssSource.includes('var(--admin-card-bg)') && cssSource.includes('@media (max-width: 580px)'));
  ok('la documentación diferencia el cierre operativo de la contabilidad legal', docsSource.includes('no es un cierre contable legal'));
  ok('CI cubre contrato, interfaz, migración e integración aislada', ciSource.includes('test:finance-level-plus-stage4') && ciSource.includes('migrate:finance-period-close-indexes') && ciSource.includes('FINANCE_STAGE4_MONGO_URI'));

  const csv = closingService.buildExecutiveCsv({
    period: { periodKey: '2026-08', status: 'certified', label: 'Cierre mensual' },
    branch: { name: 'Principal', code: 'MAIN' },
    financial: healthyFixture().summary,
    budget: healthyFixture().budget,
    treasury: healthyFixture().treasury,
    readiness: healthy,
    snapshotHash: hashA,
  });
  ok('el informe ejecutivo contiene KPIs, controles y huella', csv.startsWith('\uFEFF') && csv.includes('Utilidad neta') && csv.includes('Huella SHA-256'));
  const safeCsv = closingService.buildExecutiveCsv({
    period: { periodKey: '2026-08', status: 'certified', label: 'Cierre mensual' },
    branch: { name: '=SUM(A1:A2)', code: 'MAIN' },
    readiness: { checks: [] },
  });
  ok('el informe neutraliza fórmulas inyectadas desde textos administrativos', safeCsv.includes("'=SUM(A1:A2)"));

  console.log(`\nEtapa 4 Finanzas validada: ${controls} controles superados.`);
}

main().catch((error) => {
  console.error('Fallo validando Etapa 4 Finanzas:', error);
  process.exitCode = 1;
});
