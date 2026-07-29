'use strict';

/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');

const {
  createBillingOperationalLogger,
} = require('../services/billingOperationalLogger');
const {
  createBillingOperationalMonitoringService,
} = require('../services/billingOperationalMonitoringService');
const {
  createBillingOperationalRuntime,
} = require('../services/billingOperationalRuntime');

const BACKEND_ROOT = path.join(__dirname, '..');
const PROJECT_ROOT = path.join(BACKEND_ROOT, '..');
const results = { ok: 0, fail: 0 };

function ok(message) {
  results.ok += 1;
  console.log(`OK  ${message}`);
}

function fail(message, detail = '') {
  results.fail += 1;
  console.error(`FAIL ${message}`);
  if (detail) console.error(`     ${detail}`);
}

function assert(condition, message, detail = '') {
  if (condition) ok(message);
  else fail(message, detail);
}

function read(relativePath) {
  return fs.readFileSync(path.join(PROJECT_ROOT, relativePath), 'utf8');
}

function createModel({ count = () => 0, document = null } = {}) {
  return {
    countDocuments(filter) {
      return Promise.resolve(count(filter));
    },
    findOne() {
      return {
        select() {
          return this;
        },
        sort() {
          return this;
        },
        lean: async () =>
          typeof document === 'function' ? document() : document,
      };
    },
  };
}

function invoiceCountForCriticalSnapshot(filter) {
  const source = JSON.stringify(filter);

  if (source.includes('"emailDelivery.status":"sending"')) return 1;
  if (source.includes('"emailDelivery.status":"error"')) return 4;
  if (
    source.includes('"creditNotes"') &&
    source.includes('"processing"')
  ) {
    return 2;
  }
  if (
    source.includes('"creditNotes"') &&
    source.includes('"failed"') &&
    source.includes('"rejected"')
  ) {
    return 3;
  }
  if (source.includes('"emission.lastAttemptAt"')) return 2;
  if (source.includes('"failedAt"') && source.includes('"rejectedAt"')) {
    return 5;
  }
  return 0;
}

function recoveryCountForCriticalSnapshot(filter) {
  if (filter.status === 'failed') return 2;
  if (filter.status === 'processing' && filter.lockedAt) return 1;
  if (filter.nextAttemptAt) return 3;
  if (filter.status?.$in) return 5;
  return 0;
}

function validateStaticContract() {
  const route = read('backend/routes/adminBilling.js');
  const permissionMap = read('backend/security/adminRoutePermissionMap.js');
  const service = [
    read('backend/services/billingOperationalMonitoringService.js'),
    read(
      'backend/services/billingOperations/operationalHealthQueries.js'
    ),
    read(
      'backend/services/billingOperations/operationalHealthChecks.js'
    ),
  ].join('\n');
  const index = read('backend/index.js');
  const invoiceModel = read('backend/models/ElectronicInvoice.js');
  const packageJson = JSON.parse(read('backend/package.json'));
  const closure = read('backend/scripts/testBillingModuleClosure.js');

  const routeStart = route.indexOf("'/operations/health'");
  const routeEnd = route.indexOf("router.get(", routeStart + 1);
  const routeBlock = route.slice(routeStart, routeEnd);
  assert(
    routeStart >= 0 &&
      routeBlock.includes("requirePermission('billing:view')") &&
      routeBlock.includes('getOperationalHealth()') &&
      routeBlock.includes("'Cache-Control', 'private, no-store'"),
    'Endpoint operativo es privado, no cacheable y protegido por billing:view'
  );

  const permissionStart = permissionMap.indexOf(
    "path: '/api/admin/billing/operations/health'"
  );
  const permissionEnd = permissionMap.indexOf('},', permissionStart);
  const permissionBlock = permissionMap.slice(
    permissionStart,
    permissionEnd + 2
  );
  assert(
    permissionStart >= 0 &&
      permissionBlock.includes("permission: 'billing:view'") &&
      permissionBlock.includes('audit: true'),
    'Consulta de monitoreo queda registrada en la auditoría administrativa'
  );

  assert(
    [
      'staleInvoices',
      'overdueRecoveries',
      'stuckRecoveries',
      'staleCreditNotes',
      'emailErrors',
      'activationStuck',
      'buildWorkerCheck',
      'summarizeStatus',
      'queryOperationalHealthData',
    ].every((needle) => service.includes(needle)),
    'Monitoreo cubre worker, emisiones, conciliación, notas, correo y activación'
  );

  assert(
    ![
      'factusProvider',
      'findInvoiceByReferenceFromFactus',
      'getInvoiceFromFactus',
      'axios.',
      'fetch(',
    ].some((needle) => service.includes(needle)),
    'Diagnóstico operativo no consulta Factus ni otros servicios externos'
  );

  assert(
    index.includes("billing_recovery_worker_started") &&
      index.includes("billing_recovery_cycle_completed") &&
      index.includes("billing_recovery_cycle_failed") &&
      index.includes('markWorkerCycleSucceeded') &&
      index.includes('markWorkerCycleFailed'),
    'Worker publica ciclos estructurados y conserva su estado operativo'
  );

  assert(
    invoiceModel.includes("'billing_operations_email_delivery'") &&
      invoiceModel.includes("'billing_operations_credit_note_emission'"),
    'Consultas operativas críticas tienen índices específicos'
  );

  assert(
    packageJson.scripts['test:billing-operations'] ===
      'node scripts/testBillingOperationalMonitoringModule.js' &&
      closure.includes(
        "['Monitoreo operativo', 'testBillingOperationalMonitoringModule.js']"
      ),
    'Prueba operativa está registrada en package.json y en el cierre integral'
  );
}

async function validateCriticalSnapshot() {
  const now = new Date('2026-07-28T20:00:00.000Z');
  const InvoiceModel = createModel({
    count: invoiceCountForCriticalSnapshot,
  });
  const RecoveryModel = createModel({
    count: recoveryCountForCriticalSnapshot,
    document: {
      invoiceId: 'invoice-1',
      orderId: 'order-1',
      referenceCode: 'ORDER-0001',
      status: 'processing',
      reason: 'unknown_outcome',
      attempts: 4,
      nextAttemptAt: new Date('2026-07-28T19:50:00.000Z'),
      lastAttemptAt: new Date('2026-07-28T19:45:00.000Z'),
      lastError: 'Bearer super-secret-token client_secret=visible-secret',
    },
  });
  const ActivationModel = createModel({
    document: {
      status: 'error',
      provider: 'factus',
      environment: 'production',
      lastAttemptAt: new Date('2026-07-28T19:59:00.000Z'),
      lastErrorCode: 'FACTUS_CONNECTION_ERROR',
      lastErrorMessage: 'password=visible-password conexión rechazada',
    },
  });
  const runtime = {
    getSnapshot: () => ({
      workerStarted: true,
      workerStartedAt: new Date('2026-07-28T19:00:00.000Z'),
      intervalMs: 60_000,
      running: false,
      lastSuccessAt: new Date('2026-07-28T19:59:20.000Z'),
      lastFailureAt: null,
      failures: 0,
      lastErrorMessage: '',
    }),
  };
  const service = createBillingOperationalMonitoringService({
    ElectronicInvoice: InvoiceModel,
    BillingInvoiceRecoveryTask: RecoveryModel,
    BillingActivationState: ActivationModel,
    billingOperationalRuntime: runtime,
    now: () => now,
  });
  const snapshot = await service.getOperationalHealth();
  const serialized = JSON.stringify(snapshot);

  assert(
    snapshot.status === 'critical' &&
      snapshot.severity === 'critical' &&
      snapshot.metrics.staleInvoices === 2 &&
      snapshot.metrics.recovery.stuck === 1 &&
      snapshot.metrics.staleCreditNotes === 2,
    'Estado crítico concilia emisiones trabadas, locks vencidos y notas pendientes',
    serialized
  );
  assert(
    snapshot.metrics.recentInvoiceFailures === 5 &&
      snapshot.metrics.recentCreditNoteFailures === 3 &&
      snapshot.metrics.emailErrors === 4 &&
      snapshot.metrics.stuckEmails === 1,
    'Ventana de 24 horas contabiliza fallos fiscales y de correo',
    serialized
  );
  assert(
    snapshot.checks.some(
      (check) =>
        check.code === 'BILLING_RECOVERY_WORKER' &&
        check.severity === 'ok'
    ) &&
      snapshot.checks.some(
        (check) =>
          check.code === 'BILLING_RECOVERY_BACKLOG' &&
          check.severity === 'critical'
      ),
    'Cada subsistema expone un check independiente con severidad'
  );
  assert(
    !serialized.includes('super-secret-token') &&
      !serialized.includes('visible-secret') &&
      !serialized.includes('visible-password') &&
      serialized.includes('[REDACTED]'),
    'Diagnóstico redacta secretos incluso cuando vienen dentro de errores'
  );
}

async function validateHealthySnapshot() {
  const now = new Date('2026-07-28T20:00:00.000Z');
  const emptyModel = createModel();
  const activationModel = createModel({
    document: {
      status: 'idle',
      provider: 'factus',
      environment: 'testing',
    },
  });
  const runtime = {
    getSnapshot: () => ({
      workerStarted: true,
      workerStartedAt: new Date('2026-07-28T19:00:00.000Z'),
      intervalMs: 60_000,
      running: false,
      lastSuccessAt: new Date('2026-07-28T19:59:30.000Z'),
      failures: 0,
      lastErrorMessage: '',
    }),
  };
  const service = createBillingOperationalMonitoringService({
    ElectronicInvoice: emptyModel,
    BillingInvoiceRecoveryTask: emptyModel,
    BillingActivationState: activationModel,
    billingOperationalRuntime: runtime,
    now: () => now,
  });
  const snapshot = await service.getOperationalHealth();

  assert(
    snapshot.status === 'healthy' &&
      snapshot.severity === 'ok' &&
      snapshot.checks.every((check) => check.severity === 'ok'),
    'Sandbox sin incidentes permanece saludable y no exige activar Producción',
    JSON.stringify(snapshot)
  );
}

function validateRuntimeAndLogger() {
  let current = new Date('2026-07-28T20:00:00.000Z');
  const runtime = createBillingOperationalRuntime({
    now: () => current,
    processUptime: () => 120,
  });

  runtime.markWorkerStarted({ intervalMs: 60_000 });
  runtime.markWorkerCycleStarted();
  current = new Date('2026-07-28T20:00:02.000Z');
  runtime.markWorkerCycleSucceeded({
    scheduled: 2,
    processed: 1,
    resolved: 1,
  });
  const success = runtime.getSnapshot();

  assert(
    success.workerStarted === true &&
      success.running === false &&
      success.cycles === 1 &&
      success.lastSummary.resolved === 1 &&
      success.lastSuccessAt.toISOString() === current.toISOString(),
    'Runtime conserva inicio, duración lógica y último ciclo exitoso'
  );

  current = new Date('2026-07-28T20:01:00.000Z');
  runtime.markWorkerCycleStarted();
  runtime.markWorkerCycleFailed(
    Object.assign(new Error('token=runtime-secret'), {
      code: 'RECOVERY_DOWN',
    })
  );
  const failure = runtime.getSnapshot();
  assert(
    failure.cycles === 2 &&
      failure.failures === 1 &&
      failure.lastErrorCode === 'RECOVERY_DOWN',
    'Runtime conserva fallos del worker sin perder el último éxito'
  );

  const entries = [];
  const logger = createBillingOperationalLogger({
    now: () => current,
    consoleImpl: {
      log: (value) => entries.push(value),
      warn: (value) => entries.push(value),
      error: (value) => entries.push(value),
    },
  });
  logger.error('billing_test', {
    token: 'direct-secret',
    nested: {
      authorization: 'Bearer nested-secret',
      message: 'client_secret=embedded-secret',
    },
  });
  const output = entries.join('\n');
  assert(
    output.includes('"event":"billing_test"') &&
      output.includes('"level":"error"') &&
      !output.includes('direct-secret') &&
      !output.includes('nested-secret') &&
      !output.includes('embedded-secret'),
    'Logger estructurado conserva contexto y elimina credenciales'
  );
}

async function main() {
  console.log('Validando monitoreo operativo del módulo Facturación.');
  console.log(
    'No usa Factus, no emite documentos, no envía correos y no modifica MongoDB.'
  );

  validateStaticContract();
  await validateCriticalSnapshot();
  await validateHealthySnapshot();
  validateRuntimeAndLogger();

  console.log('');
  console.log(
    `Resumen monitoreo operativo -> OK: ${results.ok} FAIL: ${results.fail}`
  );
  if (results.fail > 0) process.exit(1);
}

main().catch((error) => {
  fail(
    'Ejecución de monitoreo operativo',
    error?.stack || error?.message || String(error)
  );
  console.log('');
  console.log(
    `Resumen monitoreo operativo -> OK: ${results.ok} FAIL: ${results.fail}`
  );
  process.exit(1);
});
