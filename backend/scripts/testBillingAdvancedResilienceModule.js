/* eslint-disable no-console */
'use strict';

const fs = require('fs');
const path = require('path');

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
  normalizePartialItems,
  normalizeRequest,
  buildRequestFingerprint,
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
const FIXED_DATE = new Date('2026-07-23T12:00:00.000Z');
const VALID_ID = '507f1f77bcf86cd799439011';

const results = {
  ok: 0,
  fail: [],
  risks: [],
};

function read(relativePath) {
  const filePath = path.join(ROOT, relativePath);
  if (!fs.existsSync(filePath)) {
    throw new Error(`No existe ${relativePath}`);
  }
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
  const detail = error?.stack || error?.message || String(error);
  results.fail.push({ title, detail });
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

  assert(captured, `Se esperaba el error ${expectedCode}.`);
  assert(
    captured.code === expectedCode,
    `Se esperaba ${expectedCode}, llegó ${captured.code || captured.message}.`
  );
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
  for (let index = 0; index < parts.length - 1; index += 1) {
    const key = parts[index];
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

function baseOrder(overrides = {}) {
  const order = {
    _id: VALID_ID,
    orderNumber: 'ORD-RESILIENCE-001',
    status: 'paid',
    source: 'web',
    items: [
      {
        productId: 'SKU-1',
        title: 'Producto de prueba',
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
    payment: {
      status: 'paid',
      amount: 119,
      currency: 'COP',
      method: 'card',
    },
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
    ...order,
    ...overrides,
    pricing: { ...order.pricing, ...(overrides.pricing || {}) },
    taxes: {
      ...order.taxes,
      ...(overrides.taxes || {}),
      iva: { ...order.taxes.iva, ...(overrides.taxes?.iva || {}) },
    },
    payment: { ...order.payment, ...(overrides.payment || {}) },
    billing: { ...order.billing, ...(overrides.billing || {}) },
  };
}

function externalSettings(overrides = {}) {
  const settings = {
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
      dian: {
        enabled: true,
        mode: 'habilitacion',
        environment: '2',
      },
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
    ...settings,
    ...overrides,
    billing: {
      ...settings.billing,
      ...(overrides.billing || {}),
      fiscalInfo: {
        ...settings.billing.fiscalInfo,
        ...(overrides.billing?.fiscalInfo || {}),
      },
      dian: {
        ...settings.billing.dian,
        ...(overrides.billing?.dian || {}),
      },
      dianResolution: {
        ...settings.billing.dianResolution,
        ...(overrides.billing?.dianResolution || {}),
      },
      electronicProvider: {
        ...settings.billing.electronicProvider,
        ...(overrides.billing?.electronicProvider || {}),
      },
    },
  };
}

function internalSettings() {
  return externalSettings({
    billing: {
      dian: { enabled: false, mode: 'internal', environment: '2' },
      electronicProvider: { provider: 'mock' },
    },
  });
}

function successfulProviderResponse(extra = {}) {
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
        links: {
          pdf: 'https://factus.test/factura.pdf',
          xml: 'https://factus.test/factura.xml',
        },
      },
      ...extra,
    },
  };
}

function invoiceHarness(options = {}) {
  let state = options.existingInvoice || null;
  let createCalls = 0;
  let updateCalls = 0;

  const model = {
    findOne() {
      return query(state);
    },
    async create(payload) {
      createCalls += 1;
      if (options.duplicateOnCreate) {
        state = options.duplicateWinner || {
          _id: 'invoice-winner',
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
      updateCalls += 1;
      const nextStatus = update?.$set?.status;
      const isFailureUpdate = nextStatus === 'failed';
      const isFinalUpdate = ['accepted', 'sent', 'generated'].includes(nextStatus);

      if (options.throwOnFailurePersistence && isFailureUpdate) {
        throw new Error('MongoDB unavailable while persisting provider failure');
      }
      if (options.throwOnFinalPersistence && isFinalUpdate) {
        throw new Error('MongoDB unavailable after provider success');
      }
      if (options.nullOnFinalPersistence && isFinalUpdate) return null;

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
    get updateCalls() {
      return updateCalls;
    },
  };
}

function buildService(options = {}) {
  const invoice = options.invoice || invoiceHarness(options.invoiceOptions || {});
  let providerCalls = 0;
  let emailCalls = 0;

  const service = createElectronicInvoiceIssuanceService({
    ElectronicInvoice: invoice.model,
    Order: {
      findById() {
        return query(options.order === undefined ? baseOrder() : options.order);
      },
    },
    SiteSettings: {
      findOne() {
        return query(options.settings === undefined ? externalSettings() : options.settings);
      },
      async updateOne() {
        if (options.settingsUpdateError) throw new Error('settings update failed');
        return { acknowledged: true, modifiedCount: 1 };
      },
    },
    isValidObjectId: options.isValidObjectId || (() => true),
    now: () => new Date(FIXED_DATE),
    randomUUID: () => 'lock-token-resilience',
    generateCUFE: () => ({ cufe: 'local-cufe-resilience' }),
    generateInvoiceXML:
      options.generateInvoiceXML || (() => '<Invoice>resilience</Invoice>'),
    sendElectronicInvoiceToProvider: async (payload) => {
      providerCalls += 1;
      if (options.providerThrow) throw new Error(options.providerThrow);
      if (typeof options.providerResponse === 'function') {
        return options.providerResponse(payload);
      }
      return options.providerResponse || successfulProviderResponse();
    },
    sendValidatedInvoiceEmail: options.sendValidatedInvoiceEmail
      ? async (...args) => {
          emailCalls += 1;
          return options.sendValidatedInvoiceEmail(...args);
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

async function testInputAndEconomicBarriers() {
  const invalid = buildService({ isValidObjectId: () => false });
  await expectCode(
    () => invalid.service.issueElectronicInvoiceForOrder({ orderId: 'bad' }),
    'INVALID_ORDER_ID'
  );

  const missing = buildService({ order: null });
  await expectCode(
    () => missing.service.issueElectronicInvoiceForOrder({ orderId: VALID_ID }),
    'ORDER_NOT_FOUND'
  );

  const unpaid = buildService({
    order: baseOrder({ status: 'pending', payment: { status: 'pending', amount: 119 } }),
  });
  await expectCode(
    () => unpaid.service.issueElectronicInvoiceForOrder({ orderId: VALID_ID }),
    'ORDER_NOT_BILLABLE'
  );

  const totalMismatch = buildService({
    order: baseOrder({ total: 130, pricing: { total: 130 }, payment: { amount: 130 } }),
  });
  await expectCode(
    () => totalMismatch.service.issueElectronicInvoiceForOrder({ orderId: VALID_ID }),
    'BILLING_TOTAL_MISMATCH'
  );
  assert(totalMismatch.providerCalls === 0, 'Contactó al proveedor con totales inconsistentes.');

  const paymentMismatch = buildService({
    order: baseOrder({ payment: { amount: 118 } }),
  });
  await expectCode(
    () => paymentMismatch.service.issueElectronicInvoiceForOrder({ orderId: VALID_ID }),
    'BILLING_PAYMENT_TOTAL_MISMATCH'
  );
  assert(paymentMismatch.providerCalls === 0, 'Contactó al proveedor con pago inconsistente.');

  const lineMismatchOrder = baseOrder();
  lineMismatchOrder.items[0].taxAmount = 18;
  const lineMismatch = buildService({ order: lineMismatchOrder });
  await expectCode(
    () => lineMismatch.service.issueElectronicInvoiceForOrder({ orderId: VALID_ID }),
    'BILLING_LINE_TOTAL_MISMATCH'
  );

  ok('Bloquea ID inválido, orden inexistente/no pagada y descuadres de total, pago y líneas');
}

async function testIdempotencyAndConcurrency() {
  const staleDate = new Date('2026-01-01T00:00:00.000Z');
  const existing = {
    _id: 'invoice-existing',
    orderId: VALID_ID,
    idempotencyKey: `electronic-invoice:order:${VALID_ID}`,
    status: 'processing',
    emission: { state: 'processing', lastAttemptAt: staleDate },
  };
  const current = buildService({
    invoiceOptions: { existingInvoice: existing },
  });
  const result = await current.service.issueElectronicInvoiceForOrder({
    orderId: VALID_ID,
    allowRetry: true,
  });
  assert(result.reused === true && result.inProgress === true, 'No reutilizó emisión en curso.');
  assert(current.providerCalls === 0, 'Duplicó llamada al proveedor para emisión en curso.');

  const duplicate = buildService({
    invoiceOptions: { duplicateOnCreate: true },
  });
  const duplicateResult = await duplicate.service.issueElectronicInvoiceForOrder({
    orderId: VALID_ID,
  });
  assert(duplicateResult.reused === true, 'No recuperó carrera por índice único.');
  assert(duplicate.providerCalls === 0, 'El perdedor de la carrera llamó al proveedor.');

  ok('Índice idempotente y reserva previa evitan doble emisión concurrente');

  risk(
    'CRÍTICO',
    'Una factura en processing puede quedar bloqueada indefinidamente',
    'La emisión de facturas no aplica vencimiento ni recuperación del lock. Incluso con lastAttemptAt antiguo, devuelve “en proceso” y no permite recuperación automática.'
  );
}

async function testProviderFailuresAndMalformedResponses() {
  const thrown = buildService({ providerThrow: 'socket reset' });
  await expectCode(
    () => thrown.service.issueElectronicInvoiceForOrder({ orderId: VALID_ID }),
    'BILLING_PROVIDER_GENERATION_ERROR'
  );
  assert(thrown.invoice.state?.status === 'failed', 'No marcó como fallida la excepción de red.');

  const rejected = buildService({
    providerResponse: {
      success: false,
      status: 503,
      error: 'Factus temporalmente no disponible',
    },
  });
  await expectCode(
    () => rejected.service.issueElectronicInvoiceForOrder({ orderId: VALID_ID }),
    'BILLING_PROVIDER_GENERATION_ERROR'
  );

  const missingNumber = buildService({
    providerResponse: {
      success: true,
      status: 201,
      data: { data: { cufe: 'cufe-without-number', is_validated: true } },
    },
  });
  await expectCode(
    () => missingNumber.service.issueElectronicInvoiceForOrder({ orderId: VALID_ID }),
    'BILLING_PROVIDER_NUMBER_MISSING'
  );

  const sent = buildService({
    providerResponse: {
      success: true,
      status: 201,
      data: {
        data: {
          number: 'SETP990000002',
          cufe: '',
          reference_code: 'ORD-RESILIENCE-001',
          is_validated: false,
        },
      },
    },
  });
  const sentResult = await sent.service.issueElectronicInvoiceForOrder({ orderId: VALID_ID });
  assert(sentResult.invoice.status === 'sent', 'Marcó como aceptada una factura no validada.');

  ok('Excepciones de red, 503, respuesta sin número y validación pendiente se manejan sin falsos éxitos');
}

async function testEmailIsolation() {
  const harness = buildService({
    sendValidatedInvoiceEmail: async () => {
      const error = new Error('SMTP timeout');
      error.delivery = { status: 'error', lastError: 'SMTP timeout' };
      throw error;
    },
  });
  const result = await harness.service.issueElectronicInvoiceForOrder({ orderId: VALID_ID });
  assert(result.invoice.status === 'accepted', 'El correo degradó el estado fiscal aceptado.');
  assert(result.emailDelivery?.status === 'error', 'No informó el fallo del correo.');
  assert(harness.emailCalls === 1, 'No intentó el correo automático una sola vez.');
  ok('Fallo SMTP no convierte una factura fiscalmente aceptada en fallida');
}

async function testInactiveModeAndMissingRanges() {
  const inactive = buildService({ settings: internalSettings() });
  const skipped = await inactive.service.issueElectronicInvoiceForOrder({
    orderId: VALID_ID,
    skipWhenElectronicBillingIsInactive: true,
  });
  assert(skipped.skipped === true, 'No omitió facturación externa desactivada.');
  assert(inactive.providerCalls === 0, 'Contactó proveedor en modo interno omitido.');

  const invoiceRange = await sendInvoiceToFactus({
    providerConfig: {
      apiUrl: 'https://api-sandbox.factus.com.co',
      clientId: 'x',
      clientSecret: 'x',
      username: 'x',
      password: 'x',
      numberingRangeId: 0,
    },
  });
  assert(
    invoiceRange.code === 'FACTUS_INVOICE_NUMBERING_RANGE_REQUIRED',
    'Intentó emitir factura sin rango oficial.'
  );

  const creditRange = await sendCreditNoteToFactus({
    providerConfig: {
      apiUrl: 'https://api-sandbox.factus.com.co',
      clientId: 'x',
      clientSecret: 'x',
      username: 'x',
      password: 'x',
      creditNoteNumberingRangeId: 0,
    },
  });
  assert(
    creditRange.code === 'FACTUS_CREDIT_NOTE_NUMBERING_RANGE_REQUIRED',
    'Intentó emitir nota crédito sin rango oficial.'
  );

  ok('Modo interno y ausencia de rangos bloquean llamadas fiscales antes de tocar Factus');
}

async function testCreditNoteBarriers() {
  await expectCode(
    () => Promise.resolve(normalizeRequest({ type: 'other' })),
    'BILLING_CREDIT_NOTE_TYPE_INVALID'
  );
  await expectCode(
    () =>
      Promise.resolve(
        normalizeRequest({
          type: 'total',
          reasonCode: '1',
          reason: 'Devolución',
          idempotencyKey: 'credit-note-0001',
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

  const order = baseOrder();
  await expectCode(
    () =>
      Promise.resolve(
        normalizePartialItems(order, [
          { productId: 'SKU-1', quantity: 1 },
          { productId: 'SKU-1', quantity: 1 },
        ])
      ),
    'BILLING_CREDIT_NOTE_ITEMS_INVALID'
  );
  await expectCode(
    () =>
      Promise.resolve(
        normalizePartialItems(order, [{ productId: 'SKU-1', quantity: 2 }])
      ),
    'BILLING_CREDIT_NOTE_QUANTITY_INVALID'
  );

  const request = {
    type: 'partial',
    reasonCode: '1',
    reasonText: 'Devolución parcial',
  };
  const first = buildRequestFingerprint(request, [{ productId: 'SKU-1', quantity: 1 }]);
  const repeated = buildRequestFingerprint(request, [{ productId: 'SKU-1', quantity: 1 }]);
  const changed = buildRequestFingerprint(request, [{ productId: 'SKU-1', quantity: 2 }]);
  assert(first === repeated && first !== changed, 'Huella de nota crédito no es estable.');

  const creditService = read('backend/services/electronicCreditNoteService.js');
  assert(creditService.includes('CREDIT_NOTE_LOCK_MS'), 'Notas crédito no tienen lock temporal.');
  assert(creditService.includes("'creditNoteControl.lockedAt': { $lt: staleBefore }"), 'No recupera lock vencido.');
  assert(creditService.includes('BILLING_CREDIT_NOTE_PERSISTENCE_ERROR'), 'No detecta pérdida de persistencia después de Factus.');

  ok('Notas crédito bloquean tipo/motivo/clave/cantidades inválidas y recuperan locks vencidos');
}

async function testProductionActivationBarriers() {
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

  const activation = read('backend/services/billingClientActivationOrchestrator.js');
  const settingsRoute = read('backend/routes/billingSettingsProtection.js');
  const providerRoute = read('backend/routes/dianProviderTest.js');

  assert(activation.includes('ACTIVATION_LOCK_MS'), 'Activación no tiene lock temporal.');
  assert(activation.includes('assertMailReady'), 'Activación no valida correo.');
  assert(activation.includes('testFactusConnectionWithIdentity'), 'Activación no revalida empresa.');
  assert(activation.includes('saveFactusNumberingRangeSelection'), 'Activación no revalida rangos.');
  assert(activation.includes('readyForProduction'), 'Activación no confirma readiness final.');
  assert(settingsRoute.includes('assertDedicatedFirstProductionActivation'), 'Guardar general puede saltarse el asistente productivo.');
  assert(providerRoute.includes('productionActivationLimiter'), 'Activación no tiene rate limit propio.');
  assert(providerRoute.includes("requirePermission('billing:settings')"), 'Activación no exige permiso fiscal.');

  ok('Producción exige asistente dedicado, lock, permiso, rate limit, empresa, rangos y correo');

  const updatePosition = activation.indexOf('updateBillingConfigurationWithReadiness(candidate');
  const successPosition = activation.indexOf('const state = await markSuccess');
  if (updatePosition >= 0 && successPosition > updatePosition) {
    risk(
      'CRÍTICO',
      'La activación productiva no es atómica',
      'La configuración puede quedar en Producción antes de registrar activation=active. Si el proceso cae entre ambas escrituras, SiteSettings y BillingActivationState quedan contradictorios.'
    );
  }
}

async function testPersistenceFailureWindows() {
  const finalLoss = buildService({
    invoiceOptions: { nullOnFinalPersistence: true },
  });
  const finalResult = await finalLoss.service.issueElectronicInvoiceForOrder({ orderId: VALID_ID });
  if (
    finalLoss.providerCalls === 1 &&
    finalResult.inProgress === true &&
    finalResult.invoice?.status === 'processing'
  ) {
    risk(
      'CRÍTICO',
      'Factus puede emitir y MongoDB conservar la factura en processing',
      'Si la escritura final no encuentra el lock después del éxito remoto, el servicio devuelve una factura local todavía en processing. Falta conciliación inmediata por reference_code antes de responder.'
    );
  } else {
    ok('La pérdida del lock después del éxito remoto se reconcilia correctamente');
  }

  const failureLoss = buildService({
    invoiceOptions: { throwOnFailurePersistence: true },
    providerResponse: { success: false, status: 503, error: 'provider down' },
  });
  let failureError = null;
  try {
    await failureLoss.service.issueElectronicInvoiceForOrder({ orderId: VALID_ID });
  } catch (error) {
    failureError = error;
  }
  assert(failureError, 'Se esperaba fallo de persistencia de error.');
  if (failureLoss.invoice.state?.status === 'processing') {
    risk(
      'CRÍTICO',
      'Una caída de MongoDB al guardar el rechazo deja el lock en processing',
      'El proveedor falla, pero si MongoDB también falla en ese instante, el documento reservado no cambia a failed y queda bloqueado sin expiración.'
    );
  }

  const hardFailure = buildService({
    invoiceOptions: { throwOnFinalPersistence: true },
  });
  await expectCode(
    () => hardFailure.service.issueElectronicInvoiceForOrder({ orderId: VALID_ID }),
    undefined
  ).catch(() => null);
  if (hardFailure.invoice.state?.status === 'processing') {
    risk(
      'CRÍTICO',
      'Una excepción de MongoDB después del éxito de Factus no tiene cola de recuperación',
      'La respuesta remota ya puede ser válida, pero la excepción de persistencia se propaga sin guardar un evento de reconciliación pendiente.'
    );
  }
}

async function testLegacyAndDataQualityWeaknesses() {
  const negativeOrder = baseOrder({
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
      'Órdenes históricas version<2 aceptan cantidades y totales negativos',
      'assertTotalsReconciled omite toda conciliación para pricing.version menor que 2. Un registro corrupto puede avanzar hasta el proveedor.'
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
      'Datos faltantes del comprador se sustituyen silenciosamente',
      'La emisión construye un consumidor genérico sin exigir una decisión explícita de “consumidor final”; puede ocultar datos fiscales incompletos.'
    );
  }

  const xmlFailure = buildService({
    settings: internalSettings(),
    generateInvoiceXML: () => {
      throw new Error('XML generator crashed');
    },
  });
  const xmlResult = await xmlFailure.service.issueElectronicInvoiceForOrder({ orderId: VALID_ID });
  if (xmlResult.invoice?.status === 'generated' && xmlResult.invoice?.xmlContent === '') {
    risk(
      'ALTO',
      'El comprobante interno se marca generado aunque falle el XML',
      'La excepción del generador XML se ignora y se guarda xmlContent vacío. Falta distinguir documento incompleto de documento generado correctamente.'
    );
  }
}

async function testSensitiveRawPersistence() {
  const secret = 'token-super-secreto-resilience';
  const harness = buildService({
    providerResponse: successfulProviderResponse({
      diagnostic: { access_token: secret, client_secret: secret },
    }),
  });
  const result = await harness.service.issueElectronicInvoiceForOrder({ orderId: VALID_ID });
  const serialized = JSON.stringify(result.invoice || {});
  if (serialized.includes(secret)) {
    risk(
      'ALTO',
      'La respuesta cruda del proveedor puede persistir secretos inesperados',
      'provider.raw y dianResponse.raw almacenan providerResponse sin una sanitización profunda. Un proveedor o proxy que incluya tokens podría dejarlos en MongoDB y respuestas administrativas.'
    );
  } else {
    ok('La persistencia fiscal elimina secretos inesperados de respuestas externas');
  }
}

async function testTimeoutsSecurityAndBuildControls() {
  const provider = read('backend/lib/dian/providers/factusRangeAwareProvider.js');
  const factus = read('backend/lib/dian/providers/factusProvider.js');
  const route = read('backend/routes/dianProviderTest.js');
  const security = read('backend/lib/billing/billingConfigurationSecurity.js');
  const vite = read('frontend/vite.config.js');
  const app = read('frontend/src/App.jsx');

  assert(provider.includes('AbortController'), 'Proveedor de rangos no tiene cancelación.');
  assert(provider.includes('timeoutMs = 20000'), 'Proveedor de rangos no limita tiempo de espera.');
  assert(factus.includes('AbortController'), 'Proveedor Factus base no tiene cancelación.');
  assert(route.includes('connectionTestLimiter'), 'Prueba de conexión no limita abuso.');
  assert(route.includes('numberingRangeLimiter'), 'Consulta de rangos no limita abuso.');
  assert(security.includes('AES-256-GCM') || security.includes('aes-256-gcm'), 'Credenciales no usan cifrado autenticado.');
  assert(security.includes('sanitize') || security.includes('redact') || security.includes('SECRET'), 'No existe tratamiento explícito de secretos.');
  assert(vite.includes('manualChunks'), 'Build no separa dependencias principales.');
  assert(app.includes('React.lazy'), 'Rutas no se cargan bajo demanda.');

  ok('Timeouts, rate limits, cifrado y división del build reducen bloqueos y exposición');
}

async function runCase(title, action) {
  try {
    await action();
  } catch (error) {
    fail(title, error);
  }
}

function printRiskSummary() {
  const order = ['CRÍTICO', 'ALTO', 'MEDIO', 'BAJO'];
  const counts = Object.fromEntries(order.map((severity) => [severity, 0]));
  results.risks.forEach((item) => {
    counts[item.severity] = (counts[item.severity] || 0) + 1;
  });

  console.log('\nDEBILIDADES DETECTADAS');
  if (!results.risks.length) {
    console.log('Ninguna debilidad reproducible en esta ejecución.');
    return counts;
  }

  results.risks.forEach((item, index) => {
    console.log(`${index + 1}. [${item.severity}] ${item.title}`);
    console.log(`   ${item.detail}`);
  });

  return counts;
}

async function main() {
  console.log('\nAUDITORÍA AVANZADA DE RESILIENCIA DEL MÓDULO DE FACTURACIÓN');
  console.log('No usa Factus real, no emite documentos, no envía correos y no modifica MongoDB.');
  console.log('Inyecta fallos de red, concurrencia, persistencia, datos corruptos y respuestas incompletas.\n');

  const cases = [
    ['Barreras de entrada y conciliación económica', testInputAndEconomicBarriers],
    ['Idempotencia, carreras y locks', testIdempotencyAndConcurrency],
    ['Caídas y respuestas anómalas del proveedor', testProviderFailuresAndMalformedResponses],
    ['Aislamiento del correo', testEmailIsolation],
    ['Modo interno y rangos ausentes', testInactiveModeAndMissingRanges],
    ['Barreras de notas crédito', testCreditNoteBarriers],
    ['Activación productiva', testProductionActivationBarriers],
    ['Ventanas de pérdida de persistencia', testPersistenceFailureWindows],
    ['Datos históricos y calidad fiscal', testLegacyAndDataQualityWeaknesses],
    ['Persistencia de respuestas sensibles', testSensitiveRawPersistence],
    ['Timeouts, seguridad y build', testTimeoutsSecurityAndBuildControls],
  ];

  for (const [title, action] of cases) {
    await runCase(title, action);
  }

  const counts = printRiskSummary();

  console.log('\nRESUMEN');
  console.log(`OK: ${results.ok}`);
  console.log(`RIESGOS: ${results.risks.length} (críticos ${counts.CRÍTICO || 0}, altos ${counts.ALTO || 0}, medios ${counts.MEDIO || 0}, bajos ${counts.BAJO || 0})`);
  console.log(`FALLOS DE LA SUITE: ${results.fail.length}`);

  if (results.fail.length > 0) process.exit(1);
  if (STRICT && ((counts.CRÍTICO || 0) > 0 || (counts.ALTO || 0) > 0)) {
    console.error('\nMODO ESTRICTO: el cierre queda bloqueado por riesgos críticos o altos.');
    process.exit(2);
  }

  console.log('\nAuditoría completada. Los RIESGOS son debilidades reales a corregir; no son falsos fallos del test.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
