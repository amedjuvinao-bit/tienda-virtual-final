/* eslint-disable no-console */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  readFactusProviderSource,
} = require('./lib/readFactusProviderSource');

process.env.BILLING_ENCRYPTION_KEY =
  process.env.BILLING_ENCRYPTION_KEY ||
  'billing-resilience-v2-test-key-with-more-than-32-characters';

const {
  assertTotalsReconciled,
  buildCustomerSnapshot,
  calculateTotals,
  sanitizeProviderPayload,
} = require('../services/electronicInvoiceIssuanceService');
const {
  normalizePartialItems,
  normalizeRequest,
  buildRequestFingerprint,
} = require('../services/electronicCreditNoteService');
const {
  requireProductionCandidate,
} = require('../services/billingClientActivationOrchestrator');
const {
  INVOICE_LOCK_MS,
  isInvoiceLockExpired,
} = require('../services/billingInvoiceRecoveryService');

const ROOT = path.join(__dirname, '..', '..');
const STRICT = process.argv.includes('--strict');
const results = { ok: 0, fail: [], risks: [] };

function read(relativePath) {
  const filePath = path.join(ROOT, relativePath);
  if (!fs.existsSync(filePath)) throw new Error(`No existe ${relativePath}`);
  return fs.readFileSync(filePath, 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function ok(message) {
  results.ok += 1;
  console.log(`OK       ${message}`);
}

function risk(severity, title, detail) {
  results.risks.push({ severity, title, detail });
  console.warn(`RIESGO   [${severity}] ${title}`);
  console.warn(`         ${detail}`);
}

function fail(title, error) {
  results.fail.push({ title, detail: error?.stack || error?.message || String(error) });
  console.error(`FAIL     ${title}`);
  console.error(`         ${error?.message || String(error)}`);
}

async function expectCode(action, expectedCode) {
  let captured = null;
  try {
    await action();
  } catch (error) {
    captured = error;
  }
  assert(captured, `Se esperaba ${expectedCode}.`);
  assert(
    captured.code === expectedCode,
    `Se esperaba ${expectedCode}, llegó ${captured.code || captured.message}.`
  );
}

function validOrder(overrides = {}) {
  const base = {
    _id: '507f1f77bcf86cd799439011',
    orderNumber: 'ORD-RESILIENCE-V2',
    status: 'paid',
    source: 'web',
    items: [
      {
        productId: 'SKU-1',
        title: 'Producto prueba',
        quantity: 1,
        price: 100,
        lineSubtotal: 100,
        discountAmount: 0,
        taxableBase: 100,
        taxAmount: 19,
        taxRate: 19,
      },
    ],
    subtotal: 100,
    shipping: 0,
    total: 119,
    pricing: {
      version: 2,
      currency: 'COP',
      subtotal: 100,
      productDiscount: 0,
      subtotalAfterDiscount: 100,
      originalShipping: 0,
      shippingDiscount: 0,
      shipping: 0,
      totalDiscount: 0,
      taxableBase: 100,
      taxAmount: 19,
      total: 119,
    },
    taxes: {
      iva: {
        enabled: true,
        percent: 19,
        taxableBase: 100,
        amount: 19,
      },
    },
    payment: { status: 'paid', amount: 119, currency: 'COP' },
    billing: {
      documentType: 'CC',
      documentNumber: '1000000000',
      firstName: 'Cliente',
      lastName: 'Prueba',
      email: 'cliente@example.com',
      address: 'Calle 1',
      municipalityCode: '11001',
    },
  };

  return {
    ...base,
    ...overrides,
    pricing: { ...base.pricing, ...(overrides.pricing || {}) },
    taxes: {
      ...base.taxes,
      ...(overrides.taxes || {}),
      iva: { ...base.taxes.iva, ...(overrides.taxes?.iva || {}) },
    },
    payment: { ...base.payment, ...(overrides.payment || {}) },
    billing: { ...base.billing, ...(overrides.billing || {}) },
  };
}

function internalSettings() {
  return {
    billing: {
      dian: { enabled: false, mode: 'internal', environment: '2' },
      electronicProvider: { provider: 'mock' },
      taxes: { iva: { enabled: true, percent: 19 } },
    },
  };
}

async function testRecoveryArchitecture() {
  const script = path.join(__dirname, 'testBillingInvoiceRecoveryModule.js');
  const child = spawnSync(process.execPath, [script], {
    cwd: path.join(ROOT, 'backend'),
    encoding: 'utf8',
    env: process.env,
  });

  if (child.status !== 0) {
    throw new Error(
      `La suite de recuperación falló.\n${child.stdout || ''}\n${child.stderr || ''}`
    );
  }

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

  assert(!isInvoiceLockExpired(fresh, now), 'Expiró un lock fresco.');
  assert(isInvoiceLockExpired(stale, now), 'No detectó un lock vencido.');

  const bootstrap = read(
    'backend/services/electronicInvoiceRecoveryBootstrapService.js'
  );
  const recovery = read('backend/services/billingInvoiceRecoveryService.js');
  const worker = read('backend/services/billingInvoiceRecoveryWorkerService.js');
  const index = read('backend/index.js');
  const provider = read(
    'backend/lib/dian/providers/factusRangeAwareProvider.js'
  );
  const recoveryBootstrapPosition = index.indexOf(
    'electronicInvoiceRecoveryBootstrapService'
  );
  const paymentRoutesPosition = index.indexOf("'./routes/payments'");

  assert(
    bootstrap.includes('BILLING_RECONCILIATION_PENDING') &&
      bootstrap.includes('reconcileExisting'),
    'El motor real no intercepta resultados inciertos.'
  );
  assert(
    recovery.includes('MAX_NOT_FOUND_CONFIRMATIONS = 3') &&
      recovery.includes('BillingInvoiceRecoveryTask'),
    'No existe recuperación duradera con confirmaciones múltiples.'
  );
  assert(
    worker.includes("status: 'processing'") &&
      !worker.includes("status: 'reconciliation_pending'"),
    'El scanner reinicia el backoff de tareas pendientes.'
  );
  assert(
    provider.includes('findInvoiceByReferenceFromFactus') &&
      provider.includes('FACTUS_RECONCILIATION_AMBIGUOUS'),
    'La consulta no exige referencia exacta y única.'
  );
  assert(
    recoveryBootstrapPosition >= 0 &&
      paymentRoutesPosition >= 0 &&
      recoveryBootstrapPosition < paymentRoutesPosition &&
      index.includes('startBillingInvoiceRecoveryJob'),
    'La protección no se carga antes de pagos o no tiene worker.'
  );

  ok('Locks vencidos, caídas de persistencia y éxito remoto perdido quedan cubiertos por conciliación duradera');
}

function testEconomicBarriers() {
  const totalMismatch = validOrder({
    total: 130,
    pricing: { total: 130 },
    payment: { amount: 130 },
  });
  const totals = calculateTotals(totalMismatch, internalSettings());
  let error = null;
  try {
    assertTotalsReconciled(totalMismatch, totals);
  } catch (caught) {
    error = caught;
  }
  assert(error?.code === 'BILLING_TOTAL_MISMATCH', 'No bloqueó total inconsistente.');

  const paymentMismatch = validOrder({ payment: { amount: 118 } });
  const paymentTotals = calculateTotals(paymentMismatch, internalSettings());
  error = null;
  try {
    assertTotalsReconciled(paymentMismatch, paymentTotals);
  } catch (caught) {
    error = caught;
  }
  assert(
    error?.code === 'BILLING_PAYMENT_TOTAL_MISMATCH',
    'No bloqueó pago inconsistente.'
  );

  ok('Totales, pago y líneas modernas se concilian antes de facturar');
}

function testCreditNoteBarriers() {
  const order = validOrder();

  return Promise.all([
    expectCode(
      () => Promise.resolve(normalizeRequest({ type: 'otro' })),
      'BILLING_CREDIT_NOTE_TYPE_INVALID'
    ),
    expectCode(
      () =>
        Promise.resolve(
          normalizeRequest({
            type: 'total',
            reasonCode: '1',
            reason: 'Devolución',
            idempotencyKey: 'credit-note-001',
          })
        ),
      'BILLING_CREDIT_NOTE_REASON_TYPE_MISMATCH'
    ),
    expectCode(
      () =>
        Promise.resolve(
          normalizePartialItems(order, [
            { productId: 'SKU-1', quantity: 1 },
            { productId: 'SKU-1', quantity: 1 },
          ])
        ),
      'BILLING_CREDIT_NOTE_ITEMS_INVALID'
    ),
  ]).then(() => {
    const request = {
      type: 'partial',
      reasonCode: '1',
      reasonText: 'Devolución parcial',
    };
    const a = buildRequestFingerprint(request, [
      { productId: 'SKU-1', quantity: 1 },
    ]);
    const b = buildRequestFingerprint(request, [
      { productId: 'SKU-1', quantity: 1 },
    ]);
    assert(a === b, 'Huella idempotente inestable.');
    ok('Notas crédito mantienen barreras de motivo, tipo, cantidad e idempotencia');
  });
}

async function testActivationAndResidualRisks() {
  await expectCode(
    () =>
      Promise.resolve(
        requireProductionCandidate(
          {
            dian: { mode: 'habilitacion' },
            electronicProvider: { provider: 'factus' },
          },
          {}
        )
      ),
    'BILLING_CLIENT_ACTIVATION_INCOMPLETE'
  );
  ok('Producción rechaza candidatos incompletos');

  const activation = read(
    'backend/services/billingClientActivationOrchestrator.js'
  );
  const updatePosition = activation.indexOf(
    'updateBillingConfigurationWithReadiness(candidate'
  );
  const successPosition = activation.indexOf('const state = await markSuccess');
  const issuance = read(
    'backend/services/electronicInvoiceIssuanceService.js'
  );
  const productionFailClosed =
    activation.includes('assertClientActivationReady') &&
    issuance.includes('await assertProductionActivation(billing)');
  if (
    updatePosition >= 0 &&
    successPosition > updatePosition &&
    !productionFailClosed
  ) {
    risk(
      'CRÍTICO',
      'Activación productiva no atómica',
      'SiteSettings puede quedar en Producción antes de registrar activation=active. Una caída entre ambas escrituras deja estados contradictorios.'
    );
  } else {
    ok('Producción permanece cerrada hasta confirmar configuración y activación');
  }

  const negativeOrder = validOrder({
    items: [{ productId: 'NEG', quantity: -1, price: 100 }],
    subtotal: -100,
    total: -100,
    pricing: { version: 1 },
    taxes: { iva: { enabled: false, percent: 0, amount: 0 } },
    payment: { amount: -100 },
  });
  const negativeTotals = calculateTotals(negativeOrder, internalSettings());
  let negativeAccepted = true;
  try {
    assertTotalsReconciled(negativeOrder, negativeTotals);
  } catch {
    negativeAccepted = false;
  }
  if (negativeAccepted && negativeTotals.total < 0) {
    risk(
      'ALTO',
      'Órdenes históricas version<2 aceptan totales negativos',
      'La conciliación se omite para pricing.version menor que 2; un registro corrupto puede llegar al proveedor.'
    );
  }

  let anonymousError = null;
  try {
    buildCustomerSnapshot({});
  } catch (error) {
    anonymousError = error;
  }
  const explicitFinalConsumer = buildCustomerSnapshot({
    source: 'pos',
    pos: { customerMode: 'guest', quickSale: true },
  });
  if (
    anonymousError?.code !== 'BILLING_CUSTOMER_IDENTITY_REQUIRED' ||
    explicitFinalConsumer.documentNumber !== '222222222222' ||
    explicitFinalConsumer.isFinalConsumer !== true
  ) {
    risk(
      'MEDIO',
      'Consumidor genérico aplicado silenciosamente',
      'Datos fiscales faltantes se sustituyen sin exigir que la orden esté marcada explícitamente como consumidor final.'
    );
  } else {
    ok('Consumidor final requiere una selección explícita y verificable');
  }

  if (
    issuance.includes('xmlContent = createXml') &&
    issuance.includes("catch {\n      xmlContent = '';")
  ) {
    risk(
      'ALTO',
      'Comprobante interno puede quedar generado con XML vacío',
      'La excepción del generador XML se ignora y el flujo puede continuar con xmlContent vacío.'
    );
  } else if (!issuance.includes('BILLING_XML_GENERATION_FAILED')) {
    risk(
      'ALTO',
      'Comprobante interno no acredita XML obligatorio',
      'No existe una barrera explícita cuando falla el generador XML.'
    );
  } else {
    ok('Comprobante interno no puede completarse sin XML');
  }

  const sanitized = sanitizeProviderPayload({
    data: {
      number: 'FE-1',
      access_token: 'token-no-persistir',
      nested: { client_secret: 'secreto', status: 'validated' },
    },
  });
  if (
    sanitized?.data?.access_token ||
    sanitized?.data?.nested?.client_secret ||
    sanitized?.data?.number !== 'FE-1'
  ) {
    risk(
      'ALTO',
      'Respuesta cruda del proveedor puede persistir secretos inesperados',
      'provider.raw y dianResponse.raw guardan respuestas externas sin una sanitización profunda garantizada.'
    );
  } else {
    ok('Respuestas externas se sanitizan profundamente antes de persistir');
  }
}

function testInfrastructureControls() {
  const rangeProvider = read(
    'backend/lib/dian/providers/factusRangeAwareProvider.js'
  );
  const factus = readFactusProviderSource();
  const route = read('backend/routes/dianProviderTest.js');
  const security = read(
    'backend/lib/billing/billingConfigurationSecurity.js'
  );
  const vite = read('frontend/vite.config.js');
  const app = read('frontend/src/App.jsx');

  assert(rangeProvider.includes('AbortController'), 'Proveedor sin cancelación.');
  assert(rangeProvider.includes('timeoutMs = 20000'), 'Proveedor sin timeout.');
  assert(factus.includes('AbortController'), 'Proveedor base sin cancelación.');
  assert(route.includes('connectionTestLimiter'), 'Conexión sin rate limit.');
  assert(route.includes('numberingRangeLimiter'), 'Rangos sin rate limit.');
  assert(security.includes('aes-256-gcm'), 'Credenciales sin cifrado autenticado.');
  assert(vite.includes('manualChunks'), 'Build sin división de dependencias.');
  assert(app.includes('lazy(() => import('), 'Rutas sin carga bajo demanda.');

  ok('Timeouts, rate limits, cifrado y code splitting reducen caídas y exposición');
}

async function runCase(title, action) {
  try {
    await action();
  } catch (error) {
    fail(title, error);
  }
}

function printSummary() {
  const order = ['CRÍTICO', 'ALTO', 'MEDIO', 'BAJO'];
  const counts = Object.fromEntries(order.map((severity) => [severity, 0]));
  results.risks.forEach((item) => {
    counts[item.severity] = (counts[item.severity] || 0) + 1;
  });

  console.log('\nDEBILIDADES DETECTADAS');
  if (!results.risks.length) {
    console.log('Ninguna debilidad reproducible en esta ejecución.');
  } else {
    results.risks.forEach((item, index) => {
      console.log(`${index + 1}. [${item.severity}] ${item.title}`);
      console.log(`   ${item.detail}`);
    });
  }

  console.log('\nRESUMEN');
  console.log(`OK: ${results.ok}`);
  console.log(
    `RIESGOS: ${results.risks.length} (críticos ${counts.CRÍTICO || 0}, altos ${counts.ALTO || 0}, medios ${counts.MEDIO || 0}, bajos ${counts.BAJO || 0})`
  );
  console.log(`FALLOS DE LA SUITE: ${results.fail.length}`);

  return counts;
}

async function main() {
  console.log('\nAUDITORÍA AVANZADA DE RESILIENCIA DEL MÓDULO DE FACTURACIÓN — V2');
  console.log('No usa Factus real, no emite documentos, no envía correos y no modifica MongoDB.');
  console.log('Valida recuperación duradera y mantiene visibles las debilidades pendientes.\n');

  await runCase('Recuperación y conciliación de facturas', testRecoveryArchitecture);
  await runCase('Barreras económicas', testEconomicBarriers);
  await runCase('Barreras de notas crédito', testCreditNoteBarriers);
  await runCase('Activación y riesgos residuales', testActivationAndResidualRisks);
  await runCase('Controles de infraestructura', testInfrastructureControls);

  const counts = printSummary();
  if (results.fail.length > 0) process.exit(1);
  if (STRICT && ((counts.CRÍTICO || 0) > 0 || (counts.ALTO || 0) > 0)) {
    console.error('\nMODO ESTRICTO: el cierre queda bloqueado por riesgos críticos o altos.');
    process.exit(2);
  }

  console.log('\nAuditoría completada. Los riesgos listados son debilidades pendientes, no falsos fallos.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
