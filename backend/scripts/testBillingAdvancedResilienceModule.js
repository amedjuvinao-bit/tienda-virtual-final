/* eslint-disable no-console */
'use strict';

const fs = require('fs');
const path = require('path');
const {
  readFactusProviderSource,
} = require('./lib/readFactusProviderSource');

process.env.BILLING_ENCRYPTION_KEY =
  process.env.BILLING_ENCRYPTION_KEY ||
  'billing-resilience-test-key-with-more-than-32-characters';

const {
  assertTotalsReconciled,
  buildCustomerSnapshot,
  calculateTotals,
  createElectronicInvoiceIssuanceService,
} = require('../services/electronicInvoiceIssuanceService');
const {
  buildRequestFingerprint,
  normalizePartialItems,
  normalizeRequest,
} = require('../services/electronicCreditNoteService');
const {
  requireProductionCandidate,
} = require('../services/billingClientActivationOrchestrator');
const {
  sendCreditNoteToFactus,
  sendInvoiceToFactus,
} = require('../lib/dian/providers/factusRangeAwareProvider');

const ROOT = path.join(__dirname, '..', '..');
const STRICT = process.argv.includes('--strict');
const VALID_ID = '507f1f77bcf86cd799439011';
const FIXED_DATE = new Date('2026-07-23T12:00:00.000Z');
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
  results.fail.push({ title, error: error?.stack || error?.message || String(error) });
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
  assert(captured, `Se esperaba ${expectedCode || 'una excepción'}.`);
  if (expectedCode) {
    assert(
      captured.code === expectedCode,
      `Se esperaba ${expectedCode}, llegó ${captured.code || captured.message}.`
    );
  }
  return captured;
}

function query(value) {
  return {
    select() {
      return this;
    },
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
  let current = target;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i];
    if (!current[key] || typeof current[key] !== 'object') current[key] = {};
    current = current[key];
  }
  current[parts[parts.length - 1]] = value;
}

function applySet(target, values = {}) {
  const next = target || {};
  Object.entries(values).forEach(([key, value]) => setPath(next, key, value));
  return next;
}

function validOrder(overrides = {}) {
  const base = {
    _id: VALID_ID,
    orderNumber: 'ORD-RESILIENCE-001',
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
    payment: { status: 'paid', amount: 119, currency: 'COP', method: 'card' },
    billing: {
      documentType: 'CC',
      documentNumber: '1000000000',
      firstName: 'Cliente',
      lastName: 'Prueba',
      email: 'cliente@example.com',
      phone: '3000000000',
      address: 'Calle 1 # 2-3',
      city: 'Bogotá',
      municipalityCode: '11001',
      department: 'Bogotá D.C.',
      departmentCode: '11',
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

function settings(overrides = {}) {
  const base = {
    _id: 'settings-main',
    billing: {
      fiscalInfo: {
        businessName: 'Tienda Cliente SAS',
        nit: '900123456',
        dv: '8',
        billingEmail: 'facturacion@example.com',
        address: 'Calle 10 # 20-30',
        municipalityCode: '11001',
      },
      dian: { enabled: true, mode: 'habilitacion', environment: '2' },
      dianResolution: {
        resolutionNumber: '18760000001',
        prefix: 'SETP',
        rangeFrom: 1,
        rangeTo: 5000,
        currentNumber: 20,
        resolutionDate: '2026-01-01',
        expirationDate: '2099-12-31',
        environment: '2',
      },
      electronicProvider: {
        provider: 'factus',
        apiUrl: 'https://api-sandbox.factus.com.co',
        clientId: 'client-id',
        clientSecret: 'client-secret',
        username: 'sandbox@example.com',
        password: 'password',
        numberingRangeId: 101,
        creditNoteNumberingRangeId: 202,
      },
      taxes: { iva: { enabled: true, percent: 19 } },
      legalTexts: {},
    },
  };

  return {
    ...base,
    ...overrides,
    billing: {
      ...base.billing,
      ...(overrides.billing || {}),
      fiscalInfo: {
        ...base.billing.fiscalInfo,
        ...(overrides.billing?.fiscalInfo || {}),
      },
      dian: { ...base.billing.dian, ...(overrides.billing?.dian || {}) },
      dianResolution: {
        ...base.billing.dianResolution,
        ...(overrides.billing?.dianResolution || {}),
      },
      electronicProvider: {
        ...base.billing.electronicProvider,
        ...(overrides.billing?.electronicProvider || {}),
      },
    },
  };
}

function internalSettings() {
  return settings({
    billing: {
      dian: { enabled: false, mode: 'internal', environment: '2' },
      electronicProvider: { provider: 'mock' },
    },
  });
}

function successResponse(extra = {}) {
  return {
    success: true,
    status: 201,
    provider: 'factus',
    data: {
      message: 'Documento recibido',
      data: {
        number: 'SETP990000001',
        cufe: 'cufe-oficial-resilience',
        reference_code: 'ORD-RESILIENCE-001',
        is_validated: true,
        links: { pdf: 'https://factus.test/a.pdf', xml: 'https://factus.test/a.xml' },
      },
      ...extra,
    },
  };
}

function invoiceHarness(options = {}) {
  let state = options.existing || null;
  let createCalls = 0;

  const model = {
    findOne() {
      return query(state);
    },
    async create(payload) {
      createCalls += 1;
      if (options.duplicateOnCreate) {
        state = {
          _id: 'winner',
          ...payload,
          status: 'processing',
          emission: { ...payload.emission, state: 'processing' },
        };
        const error = new Error('duplicate key');
        error.code = 11000;
        throw error;
      }
      state = { _id: 'invoice-1', ...payload };
      return state;
    },
    async findOneAndUpdate(_filter, update) {
      const status = update?.$set?.status;
      const isFailure = status === 'failed';
      const isFinal = ['accepted', 'sent', 'generated'].includes(status);
      if (options.throwFailureWrite && isFailure) throw new Error('Mongo failure write');
      if (options.throwFinalWrite && isFinal) throw new Error('Mongo final write');
      if (options.nullFinalWrite && isFinal) return null;
      state = applySet(state || {}, update?.$set || {});
      return state;
    },
  };

  return {
    model,
    get state() {
      return state;
    },
    get createCalls() {
      return createCalls;
    },
  };
}

function serviceHarness(options = {}) {
  const invoice = invoiceHarness(options.invoice || {});
  let providerCalls = 0;
  let emailCalls = 0;

  const service = createElectronicInvoiceIssuanceService({
    ElectronicInvoice: invoice.model,
    Order: {
      findById() {
        return query(options.order === undefined ? validOrder() : options.order);
      },
    },
    SiteSettings: {
      findOne() {
        return query(options.settings === undefined ? settings() : options.settings);
      },
      async updateOne() {
        return { acknowledged: true };
      },
    },
    isValidObjectId: options.validId || (() => true),
    now: () => new Date(FIXED_DATE),
    randomUUID: () => 'lock-resilience',
    generateCUFE: () => ({ cufe: 'local-cufe-resilience' }),
    generateInvoiceXML: options.xml || (() => '<Invoice />'),
    sendElectronicInvoiceToProvider: async (payload) => {
      providerCalls += 1;
      if (options.providerThrow) throw new Error(options.providerThrow);
      if (typeof options.provider === 'function') return options.provider(payload);
      return options.provider || successResponse();
    },
    sendValidatedInvoiceEmail: options.email
      ? async (...args) => {
          emailCalls += 1;
          return options.email(...args);
        }
      : null,
  });

  return {
    service,
    invoice,
    get providerCalls() {
      return providerCalls;
    },
    get emailCalls() {
      return emailCalls;
    },
  };
}

async function barriers() {
  await expectCode(
    () => serviceHarness({ validId: () => false }).service.issueElectronicInvoiceForOrder({ orderId: 'bad' }),
    'INVALID_ORDER_ID'
  );
  await expectCode(
    () => serviceHarness({ order: null }).service.issueElectronicInvoiceForOrder({ orderId: VALID_ID }),
    'ORDER_NOT_FOUND'
  );
  await expectCode(
    () =>
      serviceHarness({
        order: validOrder({ status: 'pending', payment: { status: 'pending' } }),
      }).service.issueElectronicInvoiceForOrder({ orderId: VALID_ID }),
    'ORDER_NOT_BILLABLE'
  );

  const totalMismatch = serviceHarness({
    order: validOrder({ total: 130, pricing: { total: 130 }, payment: { amount: 130 } }),
  });
  await expectCode(
    () => totalMismatch.service.issueElectronicInvoiceForOrder({ orderId: VALID_ID }),
    'BILLING_TOTAL_MISMATCH'
  );
  assert(totalMismatch.providerCalls === 0, 'Contactó Factus con total inconsistente.');

  const paymentMismatch = serviceHarness({
    order: validOrder({ payment: { amount: 118 } }),
  });
  await expectCode(
    () => paymentMismatch.service.issueElectronicInvoiceForOrder({ orderId: VALID_ID }),
    'BILLING_PAYMENT_TOTAL_MISMATCH'
  );
  assert(paymentMismatch.providerCalls === 0, 'Contactó Factus con pago inconsistente.');

  const brokenLines = validOrder();
  brokenLines.items[0].taxAmount = 18;
  await expectCode(
    () => serviceHarness({ order: brokenLines }).service.issueElectronicInvoiceForOrder({ orderId: VALID_ID }),
    'BILLING_LINE_TOTAL_MISMATCH'
  );
  ok('Bloquea órdenes inválidas, impagas y descuadres de total, pago o líneas');
}

async function concurrency() {
  const existing = {
    _id: 'invoice-existing',
    orderId: VALID_ID,
    status: 'processing',
    idempotencyKey: `electronic-invoice:order:${VALID_ID}`,
    emission: { state: 'processing', lastAttemptAt: new Date('2025-01-01') },
  };
  const current = serviceHarness({ invoice: { existing } });
  const reused = await current.service.issueElectronicInvoiceForOrder({
    orderId: VALID_ID,
    allowRetry: true,
  });
  assert(reused.reused && reused.inProgress, 'No reutilizó emisión en curso.');
  assert(current.providerCalls === 0, 'Duplicó llamada al proveedor.');

  const duplicate = serviceHarness({ invoice: { duplicateOnCreate: true } });
  const race = await duplicate.service.issueElectronicInvoiceForOrder({ orderId: VALID_ID });
  assert(race.reused && duplicate.providerCalls === 0, 'Falló recuperación de carrera idempotente.');
  ok('Reserva previa e índice único evitan doble emisión concurrente');

  risk(
    'CRÍTICO',
    'Factura processing sin vencimiento ni recuperación automática',
    'Un proceso caído deja la factura bloqueada indefinidamente porque el motor no compara lastAttemptAt con un límite de tiempo.'
  );
}

async function providerFailures() {
  const thrown = serviceHarness({ providerThrow: 'socket reset' });
  await expectCode(
    () => thrown.service.issueElectronicInvoiceForOrder({ orderId: VALID_ID }),
    'BILLING_PROVIDER_GENERATION_ERROR'
  );
  assert(thrown.invoice.state?.status === 'failed', 'No guardó fallo de red.');

  await expectCode(
    () =>
      serviceHarness({
        provider: { success: false, status: 503, error: 'Factus no disponible' },
      }).service.issueElectronicInvoiceForOrder({ orderId: VALID_ID }),
    'BILLING_PROVIDER_GENERATION_ERROR'
  );

  await expectCode(
    () =>
      serviceHarness({
        provider: {
          success: true,
          status: 201,
          data: { data: { cufe: 'sin-numero', is_validated: true } },
        },
      }).service.issueElectronicInvoiceForOrder({ orderId: VALID_ID }),
    'BILLING_PROVIDER_NUMBER_MISSING'
  );

  const pending = serviceHarness({
    provider: {
      success: true,
      status: 201,
      data: {
        data: {
          number: 'SETP990000002',
          cufe: '',
          is_validated: false,
          reference_code: 'ORD-RESILIENCE-001',
        },
      },
    },
  });
  const pendingResult = await pending.service.issueElectronicInvoiceForOrder({ orderId: VALID_ID });
  assert(pendingResult.invoice.status === 'sent', 'Presentó como aceptada una factura pendiente.');
  ok('Maneja excepción de red, 503, respuesta sin número y validación pendiente');
}

async function emailAndRanges() {
  const email = serviceHarness({
    email: async () => {
      const error = new Error('SMTP timeout');
      error.delivery = { status: 'error', lastError: 'SMTP timeout' };
      throw error;
    },
  });
  const result = await email.service.issueElectronicInvoiceForOrder({ orderId: VALID_ID });
  assert(result.invoice.status === 'accepted', 'SMTP degradó estado fiscal.');
  assert(result.emailDelivery?.status === 'error' && email.emailCalls === 1, 'No informó fallo SMTP.');

  const inactive = serviceHarness({ settings: internalSettings() });
  const skipped = await inactive.service.issueElectronicInvoiceForOrder({
    orderId: VALID_ID,
    skipWhenElectronicBillingIsInactive: true,
  });
  assert(skipped.skipped && inactive.providerCalls === 0, 'Llamó proveedor con modo externo desactivado.');

  const invoiceRange = await sendInvoiceToFactus({ providerConfig: { numberingRangeId: 0 } });
  const creditRange = await sendCreditNoteToFactus({
    providerConfig: { creditNoteNumberingRangeId: 0 },
  });
  assert(invoiceRange.code === 'FACTUS_INVOICE_NUMBERING_RANGE_REQUIRED', 'No bloqueó factura sin rango.');
  assert(creditRange.code === 'FACTUS_CREDIT_NOTE_NUMBERING_RANGE_REQUIRED', 'No bloqueó nota sin rango.');
  ok('Aísla SMTP, respeta modo interno y bloquea documentos sin rangos');
}

async function creditNotes() {
  await expectCode(() => Promise.resolve(normalizeRequest({ type: 'otro' })), 'BILLING_CREDIT_NOTE_TYPE_INVALID');
  await expectCode(
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
  );
  await expectCode(
    () =>
      Promise.resolve(
        normalizeRequest({
          type: 'partial',
          reasonCode: '1',
          reason: 'Devolución',
          idempotencyKey: 'bad',
        })
      ),
    'BILLING_CREDIT_NOTE_IDEMPOTENCY_KEY_INVALID'
  );
  await expectCode(
    () =>
      Promise.resolve(
        normalizePartialItems(validOrder(), [
          { productId: 'SKU-1', quantity: 1 },
          { productId: 'SKU-1', quantity: 1 },
        ])
      ),
    'BILLING_CREDIT_NOTE_ITEMS_INVALID'
  );
  await expectCode(
    () => Promise.resolve(normalizePartialItems(validOrder(), [{ productId: 'SKU-1', quantity: 2 }])),
    'BILLING_CREDIT_NOTE_QUANTITY_INVALID'
  );

  const request = { type: 'partial', reasonCode: '1', reasonText: 'Devolución parcial' };
  const a = buildRequestFingerprint(request, [{ productId: 'SKU-1', quantity: 1 }]);
  const b = buildRequestFingerprint(request, [{ productId: 'SKU-1', quantity: 1 }]);
  const c = buildRequestFingerprint(request, [{ productId: 'SKU-1', quantity: 2 }]);
  assert(a === b && a !== c, 'Huella idempotente inestable.');

  const source = read('backend/services/electronicCreditNoteService.js');
  assert(source.includes('CREDIT_NOTE_LOCK_MS'), 'Nota crédito sin lock temporal.');
  assert(source.includes("'creditNoteControl.lockedAt': { $lt: staleBefore }"), 'No recupera lock vencido.');
  assert(source.includes('BILLING_CREDIT_NOTE_PERSISTENCE_ERROR'), 'No detecta pérdida de persistencia.');
  ok('Notas crédito validan motivo, tipo, clave, cantidades, identidad y lock vencido');
}

async function activation() {
  await expectCode(
    () =>
      Promise.resolve(
        requireProductionCandidate(
          { dian: { mode: 'habilitacion' }, electronicProvider: { provider: 'factus' } },
          {}
        )
      ),
    'BILLING_CLIENT_ACTIVATION_INCOMPLETE'
  );

  const source = read('backend/services/billingClientActivationOrchestrator.js');
  const settingsRoute = read('backend/routes/billingSettingsProtection.js');
  const providerRoute = read('backend/routes/dianProviderTest.js');
  [
    'ACTIVATION_LOCK_MS',
    'assertMailReady',
    'testFactusConnectionWithIdentity',
    'saveFactusNumberingRangeSelection',
    'readyForProduction',
  ].forEach((token) => assert(source.includes(token), `Activación incompleta: ${token}.`));
  assert(settingsRoute.includes('assertDedicatedFirstProductionActivation'), 'Guardar general salta activación dedicada.');
  assert(providerRoute.includes('productionActivationLimiter'), 'Activación sin rate limit.');
  assert(providerRoute.includes("requirePermission('billing:settings')"), 'Activación sin permiso fiscal.');
  ok('Producción revalida cuenta, empresa, rangos, correo, permiso y concurrencia');

  if (
    source.indexOf('updateBillingConfigurationWithReadiness(candidate') >= 0 &&
    source.indexOf('const state = await markSuccess') >
      source.indexOf('updateBillingConfigurationWithReadiness(candidate')
  ) {
    risk(
      'CRÍTICO',
      'Activación productiva no atómica',
      'SiteSettings puede quedar en Producción antes de registrar activation=active. Una caída entre ambas escrituras deja estados contradictorios.'
    );
  }
}

async function persistenceWindows() {
  const lostFinal = serviceHarness({ invoice: { nullFinalWrite: true } });
  const result = await lostFinal.service.issueElectronicInvoiceForOrder({ orderId: VALID_ID });
  if (lostFinal.providerCalls === 1 && result.inProgress && result.invoice?.status === 'processing') {
    risk(
      'CRÍTICO',
      'Éxito en Factus con factura local todavía processing',
      'Si se pierde el lock antes de la escritura final, falta consultar inmediatamente Factus por reference_code y reconciliar antes de responder.'
    );
  }

  const failedWrite = serviceHarness({
    invoice: { throwFailureWrite: true },
    provider: { success: false, status: 503, error: 'provider down' },
  });
  await expectCode(() => failedWrite.service.issueElectronicInvoiceForOrder({ orderId: VALID_ID }));
  if (failedWrite.invoice.state?.status === 'processing') {
    risk(
      'CRÍTICO',
      'Fallo simultáneo de Factus y MongoDB deja lock processing',
      'No existe expiración del lock ni cola duradera para registrar el rechazo cuando falla la escritura de estado failed.'
    );
  }

  const finalWrite = serviceHarness({ invoice: { throwFinalWrite: true } });
  await expectCode(() => finalWrite.service.issueElectronicInvoiceForOrder({ orderId: VALID_ID }));
  if (finalWrite.invoice.state?.status === 'processing') {
    risk(
      'CRÍTICO',
      'MongoDB cae después de emisión remota sin recuperación duradera',
      'La respuesta oficial puede existir, pero no se guarda un trabajo pendiente de conciliación para recuperar número y CUFE.'
    );
  }
}

async function dataQuality() {
  const negativeOrder = validOrder({
    items: [{ productId: 'NEG', quantity: -1, price: 100 }],
    subtotal: -100,
    total: -100,
    pricing: { version: 1 },
    taxes: { iva: { enabled: false, amount: 0, percent: 0 } },
    payment: { amount: -100 },
  });
  const totals = calculateTotals(negativeOrder, internalSettings());
  let accepted = true;
  try {
    assertTotalsReconciled(negativeOrder, totals);
  } catch {
    accepted = false;
  }
  if (accepted && totals.total < 0) {
    risk(
      'ALTO',
      'Órdenes históricas version<2 aceptan totales negativos',
      'La conciliación se omite por completo para pricing.version menor que 2; un registro corrupto puede llegar al proveedor.'
    );
  }

  const anonymous = buildCustomerSnapshot({});
  if (
    anonymous.documentNumber === '222222222222' &&
    !anonymous.email &&
    !anonymous.address &&
    !anonymous.municipalityCode
  ) {
    risk(
      'MEDIO',
      'Consumidor genérico aplicado silenciosamente',
      'Datos fiscales faltantes se sustituyen sin exigir que la orden esté marcada explícitamente como consumidor final.'
    );
  }

  const brokenXml = serviceHarness({
    settings: internalSettings(),
    xml: () => {
      throw new Error('XML crash');
    },
  });
  const xmlResult = await brokenXml.service.issueElectronicInvoiceForOrder({ orderId: VALID_ID });
  if (xmlResult.invoice?.status === 'generated' && xmlResult.invoice?.xmlContent === '') {
    risk(
      'ALTO',
      'Comprobante interno generado con XML vacío',
      'La excepción del generador XML se ignora y el documento queda marcado como generado correctamente.'
    );
  }
}

async function rawSecrets() {
  const secret = 'secret-resilience-token';
  const harness = serviceHarness({
    provider: successResponse({ diagnostic: { access_token: secret, client_secret: secret } }),
  });
  const result = await harness.service.issueElectronicInvoiceForOrder({ orderId: VALID_ID });
  if (JSON.stringify(result.invoice || {}).includes(secret)) {
    risk(
      'ALTO',
      'Respuesta cruda del proveedor puede persistir secretos inesperados',
      'provider.raw y dianResponse.raw guardan providerResponse sin sanitización profunda de access_token, client_secret o password.'
    );
  } else {
    ok('Respuestas externas se sanitizan antes de persistir');
  }
}

async function infrastructureControls() {
  const rangeProvider = read('backend/lib/dian/providers/factusRangeAwareProvider.js');
  const factus = readFactusProviderSource();
  const route = read('backend/routes/dianProviderTest.js');
  const security = read('backend/lib/billing/billingConfigurationSecurity.js');
  const vite = read('frontend/vite.config.js');
  const app = read('frontend/src/App.jsx');

  assert(rangeProvider.includes('AbortController'), 'Proveedor rango sin cancelación.');
  assert(rangeProvider.includes('timeoutMs = 20000'), 'Proveedor rango sin timeout.');
  assert(factus.includes('AbortController'), 'Proveedor Factus sin cancelación.');
  assert(route.includes('connectionTestLimiter'), 'Conexión sin rate limit.');
  assert(route.includes('numberingRangeLimiter'), 'Rangos sin rate limit.');
  assert(security.includes('aes-256-gcm'), 'Credenciales sin cifrado autenticado.');
  assert(security.includes('sanitizeProvider'), 'Configuración sin saneamiento de proveedor.');
  assert(vite.includes('manualChunks'), 'Build sin separación manual.');
  assert(
    app.includes('lazy(() => import(') || app.includes('React.lazy'),
    'Rutas sin carga diferida.'
  );
  ok('Timeouts, rate limits, cifrado y code splitting reducen caídas y exposición');
}

async function runCase(title, action) {
  try {
    await action();
  } catch (error) {
    fail(title, error);
  }
}

function riskCounts() {
  const counts = { CRÍTICO: 0, ALTO: 0, MEDIO: 0, BAJO: 0 };
  results.risks.forEach((item) => {
    counts[item.severity] = (counts[item.severity] || 0) + 1;
  });
  return counts;
}

async function main() {
  console.log('\nAUDITORÍA AVANZADA DE RESILIENCIA DEL MÓDULO DE FACTURACIÓN');
  console.log('No usa Factus real, no emite documentos, no envía correos y no modifica MongoDB.');
  console.log('Inyecta caídas de red, carreras, fallos de persistencia, datos corruptos y respuestas incompletas.\n');

  const cases = [
    ['Barreras económicas y de entrada', barriers],
    ['Idempotencia y concurrencia', concurrency],
    ['Proveedor externo', providerFailures],
    ['Correo, modo y rangos', emailAndRanges],
    ['Notas crédito', creditNotes],
    ['Activación productiva', activation],
    ['Ventanas de persistencia', persistenceWindows],
    ['Calidad de datos', dataQuality],
    ['Persistencia sensible', rawSecrets],
    ['Controles de infraestructura', infrastructureControls],
  ];

  for (const [title, action] of cases) await runCase(title, action);

  const counts = riskCounts();
  console.log('\nDEBILIDADES DETECTADAS');
  if (!results.risks.length) console.log('Ninguna debilidad reproducible.');
  results.risks.forEach((item, index) => {
    console.log(`${index + 1}. [${item.severity}] ${item.title}`);
    console.log(`   ${item.detail}`);
  });

  console.log('\nRESUMEN');
  console.log(`OK: ${results.ok}`);
  console.log(
    `RIESGOS: ${results.risks.length} (críticos ${counts.CRÍTICO}, altos ${counts.ALTO}, medios ${counts.MEDIO}, bajos ${counts.BAJO})`
  );
  console.log(`FALLOS DE LA SUITE: ${results.fail.length}`);

  if (results.fail.length) process.exit(1);
  if (STRICT && (counts.CRÍTICO > 0 || counts.ALTO > 0)) {
    console.error('\nMODO ESTRICTO: cierre bloqueado por riesgos críticos o altos.');
    process.exit(2);
  }

  console.log('\nLos RIESGOS son debilidades reproducibles a corregir, no falsos errores de la prueba.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
