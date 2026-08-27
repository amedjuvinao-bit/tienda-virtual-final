/* eslint-disable no-console */
'use strict';

const fs = require('fs');
const path = require('path');

process.env.BILLING_ENCRYPTION_KEY =
  process.env.BILLING_ENCRYPTION_KEY ||
  'billing-invoice-recovery-test-key-more-than-32-characters';

const {
  INVOICE_LOCK_MS,
  createBillingInvoiceRecoveryService,
  isInvoiceLockExpired,
} = require('../services/billingInvoiceRecoveryService');

const ROOT = path.join(__dirname, '..', '..');
const results = { ok: 0, fail: 0 };

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function ok(message) {
  results.ok += 1;
  console.log(`OK  ${message}`);
}

function read(relativePath) {
  const fullPath = path.join(ROOT, relativePath);
  assert(fs.existsSync(fullPath), `No existe ${relativePath}`);
  return fs.readFileSync(fullPath, 'utf8');
}

function query(value) {
  return {
    async lean() {
      return value;
    },
    then(resolve, reject) {
      return Promise.resolve(value).then(resolve, reject);
    },
  };
}

function setPath(target, dottedPath, value) {
  const parts = String(dottedPath).split('.');
  let cursor = target;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const key = parts[index];
    if (!cursor[key] || typeof cursor[key] !== 'object') cursor[key] = {};
    cursor = cursor[key];
  }
  cursor[parts[parts.length - 1]] = value;
}

function applyUpdate(target, update = {}) {
  Object.entries(update.$set || {}).forEach(([key, value]) => {
    setPath(target, key, value);
  });
  Object.entries(update.$setOnInsert || {}).forEach(([key, value]) => {
    if (target[key] === undefined) setPath(target, key, value);
  });
  Object.entries(update.$inc || {}).forEach(([key, value]) => {
    const current = Number(target[key] || 0);
    setPath(target, key, current + Number(value || 0));
  });
  return target;
}

function createHarness({ lookup, detail } = {}) {
  const invoice = {
    _id: '507f1f77bcf86cd799439011',
    orderId: '507f1f77bcf86cd799439012',
    orderNumber: 'ORD-RECOVERY-001',
    idempotencyKey:
      'electronic-invoice:order:507f1f77bcf86cd799439012',
    status: 'processing',
    emission: {
      state: 'processing',
      lastAttemptAt: new Date('2026-07-23T10:00:00.000Z'),
      attempts: 1,
    },
    provider: {
      name: 'factus',
      status: 'processing',
      referenceCode: 'ORD-RECOVERY-001',
    },
    dianResponse: {},
  };
  let task = null;
  let now = new Date('2026-07-23T12:00:00.000Z');
  let sequence = 0;
  const detailCalls = [];

  const InvoiceModel = {
    findById(id) {
      return query(String(id) === String(invoice._id) ? invoice : null);
    },
    async findByIdAndUpdate(id, update) {
      if (String(id) !== String(invoice._id)) return null;
      applyUpdate(invoice, update);
      return invoice;
    },
  };

  const TaskModel = {
    findOne(filter = {}) {
      if (!task) return null;
      if (filter.invoiceId && String(filter.invoiceId) !== String(task.invoiceId)) {
        return null;
      }
      return task;
    },
    async findOneAndUpdate(filter = {}, update = {}, options = {}) {
      if (options.upsert && !task) {
        sequence += 1;
        task = {
          _id: `task-${sequence}`,
          status: 'pending',
          attempts: 0,
          confirmedNotFound: 0,
          nextAttemptAt: now,
        };
      }
      if (!task) return null;
      if (filter._id && String(filter._id) !== String(task._id)) return null;
      if (
        filter.invoiceId &&
        String(filter.invoiceId) !== String(task.invoiceId || filter.invoiceId)
      ) {
        return null;
      }
      if (filter.lockToken && filter.lockToken !== task.lockToken) return null;
      if (
        filter.nextAttemptAt?.$lte &&
        task.nextAttemptAt &&
        new Date(task.nextAttemptAt) > new Date(filter.nextAttemptAt.$lte)
      ) {
        return null;
      }
      applyUpdate(task, update);
      return task;
    },
    find() {
      return {
        sort() {
          return this;
        },
        limit() {
          return this;
        },
        async lean() {
          return task ? [task] : [];
        },
      };
    },
  };

  const SettingsModel = {
    findOne() {
      return query({
        billing: {
          dian: { enabled: true, mode: 'habilitacion' },
          electronicProvider: {
            provider: 'factus',
            apiUrl: 'https://api-sandbox.factus.com.co',
            clientId: 'client',
            clientSecret: 'secret',
            username: 'user@example.com',
            password: 'password',
          },
        },
      });
    },
  };

  const service = createBillingInvoiceRecoveryService({
    ElectronicInvoice: InvoiceModel,
    BillingInvoiceRecoveryTask: TaskModel,
    SiteSettings: SettingsModel,
    findInvoiceByReferenceFromFactus:
      lookup ||
      (async () => ({
        success: true,
        found: true,
        document: {
          id: 55,
          number: 'SETP990000055',
          reference_code: 'ORD-RECOVERY-001',
          status: 1,
        },
      })),
    getInvoiceFromFactus: async (input) => {
      detailCalls.push(input);
      if (detail) return detail(input);
      return {
        success: true,
        data: {
          data: {
            bill: {
              id: 55,
              number: 'SETP990000055',
              reference_code: 'ORD-RECOVERY-001',
              cufe: 'cufe-recovered',
              status: 1,
              links: {
                pdf_url: 'https://factus.test/factura.pdf',
                xml_url: 'https://factus.test/factura.xml',
              },
            },
          },
        },
      };
    },
    now: () => new Date(now),
    randomUUID: () => 'recovery-lock-token',
  });

  return {
    service,
    invoice,
    get task() {
      return task;
    },
    detailCalls,
    advance(milliseconds) {
      now = new Date(now.getTime() + milliseconds);
      if (task) task.nextAttemptAt = new Date(now.getTime() - 1);
    },
  };
}

function testLockExpiry() {
  const now = new Date('2026-07-23T12:00:00.000Z');
  const fresh = {
    status: 'processing',
    emission: {
      state: 'processing',
      lastAttemptAt: new Date(now.getTime() - INVOICE_LOCK_MS + 1000),
    },
  };
  const stale = {
    status: 'processing',
    emission: {
      state: 'processing',
      lastAttemptAt: new Date(now.getTime() - INVOICE_LOCK_MS - 1000),
    },
  };

  assert(isInvoiceLockExpired(fresh, now) === false, 'Expiró un lock fresco.');
  assert(isInvoiceLockExpired(stale, now) === true, 'No expiró un lock abandonado.');
  ok('Lock de factura vence de forma determinística y permite recuperación');
}

async function testSuccessfulReconciliation() {
  const harness = createHarness();
  const marked = await harness.service.markInvoiceForReconciliation({
    invoice: harness.invoice,
    reason: 'stale_processing_lock',
    source: 'test',
  });

  assert(
    harness.invoice.status === 'reconciliation_pending',
    'No marcó el estado local de conciliación.'
  );
  assert(marked.task?.status === 'pending', 'No creó trabajo duradero pendiente.');

  const result = await harness.service.reconcileInvoiceByReference({
    invoiceId: harness.invoice._id,
    taskId: marked.task._id,
    source: 'test',
  });

  assert(result.resolved === true && result.found === true, 'No resolvió la conciliación.');
  assert(harness.invoice.status === 'accepted', 'No recuperó estado fiscal aceptado.');
  assert(harness.invoice.invoiceNumber === 'SETP990000055', 'No recuperó número oficial.');
  assert(harness.invoice.cufe === 'cufe-recovered', 'No recuperó CUFE oficial.');
  assert(harness.task.status === 'resolved', 'No cerró el trabajo duradero.');
  assert(
    harness.detailCalls.length === 1 &&
      harness.detailCalls[0].invoiceNumber === 'SETP990000055' &&
      harness.detailCalls[0].providerConfig?.apiUrl ===
        'https://api-sandbox.factus.com.co',
    'No consultó una sola vez la factura completa usando el número localizado.'
  );
  ok('Listado resumido se completa por número antes de recuperar CUFE y aceptación');
}

async function testIncompleteDetailKeepsPending() {
  const harness = createHarness({
    detail: async () => ({
      success: true,
      data: {
        data: {
          bill: {
            id: 55,
            number: 'SETP990000055',
            reference_code: 'ORD-RECOVERY-001',
            cufe: '',
            is_validated: false,
          },
        },
      },
    }),
  });
  const marked = await harness.service.markInvoiceForReconciliation({
    invoice: harness.invoice,
    reason: 'real_list_response_incomplete',
  });
  const result = await harness.service.reconcileInvoiceByReference({
    invoiceId: harness.invoice._id,
    taskId: marked.task._id,
  });

  assert(
    result.pending === true &&
      result.reason === 'remote_detail_incomplete',
    'Cerró la recuperación aunque el detalle no tenía CUFE y aceptación.'
  );
  assert(
    harness.invoice.status === 'reconciliation_pending' &&
      harness.task.status === 'pending',
    'Liberó la factura o resolvió la tarea con datos fiscales incompletos.'
  );
  ok('Detalle sin CUFE o aceptación permanece pendiente y bloquea la reemisión');
}

async function testProviderUnavailableKeepsPending() {
  const harness = createHarness({
    lookup: async () => ({
      success: false,
      status: 503,
      error: 'Factus no disponible',
    }),
  });
  const marked = await harness.service.markInvoiceForReconciliation({
    invoice: harness.invoice,
    reason: 'network_uncertain',
  });
  const result = await harness.service.reconcileInvoiceByReference({
    invoiceId: harness.invoice._id,
    taskId: marked.task._id,
  });

  assert(result.pending === true, 'No mantuvo pendiente una consulta temporalmente fallida.');
  assert(harness.invoice.status === 'reconciliation_pending', 'Liberó la factura antes de conocer el resultado.');
  assert(harness.task.status === 'pending', 'No reprogramó el trabajo.');
  ok('Caída temporal de Factus conserva bloqueo seguro y backoff');
}

async function testThreeExactNotFoundConfirmationsAllowRetry() {
  const harness = createHarness({
    lookup: async () => ({ success: true, found: false, document: null }),
  });
  const marked = await harness.service.markInvoiceForReconciliation({
    invoice: harness.invoice,
    reason: 'unknown_remote_result',
  });

  let result = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    result = await harness.service.reconcileInvoiceByReference({
      invoiceId: harness.invoice._id,
      taskId: marked.task._id,
    });
    harness.advance(20 * 60 * 1000);
  }

  assert(result.resolved === true && result.retryable === true, 'No determinó ausencia remota después de tres confirmaciones.');
  assert(harness.invoice.status === 'failed', 'No liberó para reintento controlado.');
  assert(
    harness.invoice.dianResponse?.code ===
      'BILLING_RECONCILIATION_REMOTE_NOT_FOUND',
    'No dejó evidencia del resultado de conciliación.'
  );
  ok('Solo tres consultas exactas sin documento habilitan un reintento controlado');
}

function testIntegrationAndNoReissueControls() {
  const bootstrap = read(
    'backend/services/electronicInvoiceRecoveryBootstrapService.js'
  );
  const recovery = read('backend/services/billingInvoiceRecoveryService.js');
  const worker = read('backend/services/billingInvoiceRecoveryWorkerService.js');
  const provider = read(
    'backend/lib/dian/providers/factusRangeAwareProvider.js'
  );
  const index = read('backend/index.js');
  const model = read('backend/models/ElectronicInvoice.js');
  const taskModel = read('backend/models/BillingInvoiceRecoveryTask.js');
  const recoveryBootstrapPosition = index.indexOf(
    'electronicInvoiceRecoveryBootstrapService'
  );
  const paymentRoutesPosition = index.indexOf("'./routes/payments'");

  assert(
    bootstrap.includes('isInvoiceLockExpired') &&
      bootstrap.includes('reconcileExisting') &&
      bootstrap.includes('BILLING_RECONCILIATION_PENDING'),
    'El motor real no intercepta locks vencidos y resultados inciertos.'
  );
  assert(
    recoveryBootstrapPosition >= 0 &&
      paymentRoutesPosition >= 0 &&
      recoveryBootstrapPosition < paymentRoutesPosition,
    'El bootstrap se carga después de las rutas de pago.'
  );
  assert(
    index.includes('startBillingInvoiceRecoveryJob') &&
      index.includes('processPendingInvoiceRecoveries'),
    'No existe worker automático al recuperar MongoDB.'
  );
  assert(
    worker.includes("status: 'processing'") &&
      !worker.includes("status: 'reconciliation_pending'"),
    'El scanner reinicia indebidamente el backoff de tareas ya pendientes.'
  );
  assert(
    provider.includes('findInvoiceByReferenceFromFactus') &&
      provider.includes('FACTUS_RECONCILIATION_AMBIGUOUS'),
    'La conciliación no exige referencia exacta y única.'
  );
  assert(
    recovery.includes('MAX_NOT_FOUND_CONFIRMATIONS = 3') &&
      recovery.includes('BILLING_RECONCILIATION_REMOTE_NOT_FOUND') &&
      recovery.includes('getInvoiceFromFactus') &&
      recovery.includes('remote_detail_incomplete'),
    'Puede reemitir sin confirmar primero la ausencia remota.'
  );
  assert(
    model.includes("'reconciliation_pending'") &&
      taskModel.includes("unique: true"),
    'No persiste estado local y trabajo único por factura.'
  );

  ok('Bootstrap, worker, modelo y proveedor impiden reemisión mientras exista incertidumbre');
}

async function main() {
  console.log('\nValidando recuperación y conciliación de facturas...');

  const tests = [
    testLockExpiry,
    testSuccessfulReconciliation,
    testIncompleteDetailKeepsPending,
    testProviderUnavailableKeepsPending,
    testThreeExactNotFoundConfirmationsAllowRetry,
    testIntegrationAndNoReissueControls,
  ];

  for (const test of tests) {
    try {
      await test();
    } catch (error) {
      results.fail += 1;
      console.error(`FAIL ${test.name}`);
      console.error(`     ${error.message}`);
    }
  }

  console.log(`\nResumen recuperación fiscal -> OK: ${results.ok} FAIL: ${results.fail}`);
  if (results.fail > 0) process.exit(1);
}

main();
