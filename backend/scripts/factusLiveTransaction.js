/* eslint-disable no-console */
'use strict';

const crypto = require('crypto');
const path = require('path');

require('dotenv').config({
  path: path.join(__dirname, '..', '.env'),
  quiet: true,
});

const mongoose = require('mongoose');

const { env, assertEnv } = require('../config/env');
const ProductionElectronicInvoice = require('../models/ElectronicInvoice');
const ProductionBillingInvoiceRecoveryTask = require('../models/BillingInvoiceRecoveryTask');
const ProductionOrder = require('../models/Order');
const ProductionSiteSettings = require('../models/SiteSettings');
const {
  FACTUS_API_URLS,
  buildRuntimeFactusConfig,
} = require('../lib/billing/billingConfigurationSecurity');
const { sendElectronicInvoiceToProvider } = require('../lib/dian/providerAdapter');
const {
  downloadInvoiceDocumentFromFactus,
  getInvoiceFromFactus,
} = require('../lib/dian/providers/factusProvider');
const {
  findInvoiceByReferenceFromFactus,
} = require('../lib/dian/providers/factusRangeAwareProvider');
const {
  createElectronicInvoiceIssuanceService,
} = require('../services/electronicInvoiceIssuanceService');
const {
  createBillingInvoiceRecoveryService,
} = require('../services/billingInvoiceRecoveryService');

const CONFIRMATION_FLAG = '--confirm-habilitacion';
const DATABASE_PREFIX = 'bfl_';
const NORMAL_CONCURRENCY = 32;
const LOST_RESPONSE_CONCURRENCY = 32;
const REPLAY_CONCURRENCY = 16;
const LOOKUP_ATTEMPTS = 6;
const DOWNLOAD_ATTEMPTS = 5;
const VALIDATE_PLAN_ONLY = process.argv.includes('--validate-plan');
const SENSITIVE_KEY =
  /(authorization|password|passwd|secret|token|credential|cookie|softwarepin|technicalkey|certificate|privatekey|apikey|clientsecret|refresh)/i;

function assert(condition, message, code = 'FACTUS_LIVE_TRANSACTION_ASSERTION_FAILED') {
  if (condition) return;
  const error = new Error(message);
  error.code = code;
  throw error;
}

function money(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function cleanText(value, max = 500) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildDatabaseName() {
  const timestamp = new Date()
    .toISOString()
    .replace(/\D/g, '')
    .slice(0, 14);
  const random = crypto.randomBytes(3).toString('hex');
  return `${DATABASE_PREFIX}${timestamp}_${random}`;
}

function buildRunId() {
  const timestamp = new Date()
    .toISOString()
    .replace(/\D/g, '')
    .slice(0, 14);
  return `${timestamp}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
}

function safeSettingsCopy(settings) {
  return {
    billing: clone(settings?.billing || {}),
  };
}

function assertHabilitationSafety(settings) {
  const billing = settings?.billing || {};
  const runtime = buildRuntimeFactusConfig(billing);
  const configuredMode = cleanText(billing?.dian?.mode, 40).toLowerCase();
  const configuredProvider = cleanText(
    billing?.electronicProvider?.provider,
    40
  ).toLowerCase();

  assert(
    process.argv.includes(CONFIRMATION_FLAG),
    `Falta la confirmación de seguridad ${CONFIRMATION_FLAG}.`,
    'FACTUS_LIVE_TRANSACTION_CONFIRMATION_REQUIRED'
  );
  assert(
    configuredMode === 'habilitacion',
    `La prueba exige modo habilitacion; se encontró ${configuredMode || 'vacío'}.`,
    'FACTUS_LIVE_TRANSACTION_PRODUCTION_BLOCKED'
  );
  assert(
    runtime.environment === 'habilitacion',
    `El runtime resolvió el ambiente ${runtime.environment}.`,
    'FACTUS_LIVE_TRANSACTION_PRODUCTION_BLOCKED'
  );
  assert(
    runtime.apiUrl === FACTUS_API_URLS.habilitacion,
    `La URL debe ser exactamente ${FACTUS_API_URLS.habilitacion}.`,
    'FACTUS_LIVE_TRANSACTION_URL_BLOCKED'
  );
  assert(
    runtime.apiUrl !== FACTUS_API_URLS.production,
    'La URL de producción está bloqueada para esta prueba.',
    'FACTUS_LIVE_TRANSACTION_PRODUCTION_BLOCKED'
  );
  assert(
    billing?.dian?.enabled === true && configuredProvider === 'factus',
    'Factus externo no está activo en la configuración cargada.',
    'FACTUS_LIVE_TRANSACTION_PROVIDER_INACTIVE'
  );
  assert(
    Number(runtime.numberingRangeId || 0) > 0,
    'No existe un rango oficial de facturas seleccionado.',
    'FACTUS_LIVE_TRANSACTION_RANGE_MISSING'
  );

  return runtime;
}

function compileIsolatedModels(connection) {
  return {
    Order: connection.model(
      'Order',
      ProductionOrder.schema.clone(),
      ProductionOrder.collection.name
    ),
    ElectronicInvoice: connection.model(
      'ElectronicInvoice',
      ProductionElectronicInvoice.schema.clone(),
      ProductionElectronicInvoice.collection.name
    ),
    SiteSettings: connection.model(
      'SiteSettings',
      ProductionSiteSettings.schema.clone(),
      ProductionSiteSettings.collection.name
    ),
    BillingInvoiceRecoveryTask: connection.model(
      'BillingInvoiceRecoveryTask',
      ProductionBillingInvoiceRecoveryTask.schema.clone(),
      ProductionBillingInvoiceRecoveryTask.collection.name
    ),
  };
}

function buildOrderPayload({ orderNumber, tampered = false }) {
  const subtotal = 1_000;
  const productDiscount = 0;
  const subtotalAfterDiscount = 1_000;
  const taxAmount = 190;
  const total = tampered ? 1_191 : 1_190;

  return {
    sessionId: `factus-live-${orderNumber}`,
    orderNumber,
    status: 'paid',
    source: 'pos',
    channel: 'pos',
    saleType: 'pos_sale',
    fulfillmentStatus: 'completed',
    tags: ['factus-live-habilitacion', 'automated-transaction-test'],
    pos: {
      customerMode: 'guest',
      quickSale: true,
    },
    items: [
      {
        productId: `TEST-${orderNumber}`,
        title: 'Producto controlado de habilitación',
        quantity: 1,
        qty: 1,
        price: subtotal,
        unitPrice: subtotal,
        priceNumber: subtotal,
        lineSubtotal: subtotal,
        discountAmount: 0,
        taxableBase: subtotalAfterDiscount,
        taxRate: 19,
        taxAmount,
        lineTotal: subtotalAfterDiscount + taxAmount,
      },
    ],
    discount: {
      type: 'none',
      value: 0,
      amount: 0,
      reason: '',
    },
    subtotal,
    shipping: 0,
    total,
    pricing: {
      version: 2,
      currency: 'COP',
      subtotal,
      productDiscount,
      subtotalAfterDiscount,
      originalShipping: 0,
      shippingDiscount: 0,
      shipping: 0,
      totalDiscount: 0,
      taxableBase: subtotalAfterDiscount,
      taxAmount,
      total,
    },
    taxes: {
      iva: {
        enabled: true,
        percent: 19,
        code: '01',
        name: 'IVA',
        taxableBase: subtotalAfterDiscount,
        amount: taxAmount,
      },
    },
    customer: {
      name: 'Consumidor',
      lastname: 'Final',
      email: 'factus-habilitacion@example.com',
      phone: '3000000000',
      address: 'Dirección de prueba',
      city: 'Bogotá',
      municipalityId: '11001',
      department: 'Bogotá D.C.',
      departmentCode: '11',
      country: 'Colombia',
      countryCode: 'CO',
      isFinalConsumer: true,
    },
    billing: {
      isFinalConsumer: true,
      personType: 'natural',
      firstName: 'Consumidor',
      lastName: 'Final',
      documentType: 'CC',
      address: 'Dirección de prueba',
      city: 'Bogotá',
      municipalityCode: '11001',
      department: 'Bogotá D.C.',
      departmentCode: '11',
      phone: '3000000000',
      email: 'factus-habilitacion@example.com',
      country: 'Colombia',
      countryCode: 'CO',
      tributeCode: 'ZZ',
    },
    payment: {
      active: true,
      provider: 'cash',
      providerLabel: 'Efectivo',
      mode: 'sandbox',
      currency: 'COP',
      status: 'paid',
      methodType: 'cash',
      method: 'cash',
      methodLabel: 'Efectivo',
      transactionId: `TX-${orderNumber}`,
      reference: orderNumber,
      amount: total,
      amountInCents: total * 100,
      paidAt: new Date(),
    },
  };
}

function createProviderProbe(metrics) {
  return async (input = {}) => {
    const reference = cleanText(
      input?.invoiceData?.order?.orderNumber,
      180
    );
    metrics.emissionCalls += 1;
    metrics.emissionCallsByReference.set(
      reference,
      Number(metrics.emissionCallsByReference.get(reference) || 0) + 1
    );

    const result = await sendElectronicInvoiceToProvider(input);
    if (result?.success === true) {
      metrics.successfulEmissionCalls += 1;
      metrics.providerResponses.set(reference, result);
    }
    return result;
  };
}

function createCrashAfterProviderModel(ElectronicInvoice, targetOrderId) {
  let targetInvoiceId = '';
  let crashInjected = false;

  return {
    findOne(...args) {
      return ElectronicInvoice.findOne(...args);
    },

    async create(payload) {
      const document = await ElectronicInvoice.create(payload);
      if (String(payload?.orderId || '') === String(targetOrderId)) {
        targetInvoiceId = String(document._id);
      }
      return document;
    },

    async findOneAndUpdate(filter, update, options) {
      const finalPersistence =
        String(filter?._id || '') === targetInvoiceId &&
        ['accepted', 'sent'].includes(cleanText(update?.$set?.status, 40)) &&
        update?.$set?.['emission.state'] === 'completed';

      if (finalPersistence && !crashInjected) {
        crashInjected = true;
        const error = new Error(
          'Corte controlado después de que Factus respondió y antes de guardar la respuesta local.'
        );
        error.code = 'FACTUS_LIVE_POST_PROVIDER_PERSISTENCE_CRASH';
        throw error;
      }

      return ElectronicInvoice.findOneAndUpdate(filter, update, options);
    },

    wasCrashInjected() {
      return crashInjected;
    },
  };
}

function issueRequest(service, orderId, source) {
  return service.issueElectronicInvoiceForOrder({
    orderId,
    source,
    initiatedBy: 'factus-live-transaction-test',
    skipWhenElectronicBillingIsInactive: false,
    allowRetry: false,
  });
}

async function runConcurrentIssues({
  service,
  orderId,
  count,
  source,
}) {
  const startedAt = Date.now();
  const results = await Promise.allSettled(
    Array.from({ length: count }, () =>
      issueRequest(service, orderId, source)
    )
  );

  return {
    durationMs: Date.now() - startedAt,
    results,
    fulfilled: results.filter((item) => item.status === 'fulfilled'),
    rejected: results.filter((item) => item.status === 'rejected'),
  };
}

function findSensitivePath(value, pathName = 'root', seen = new WeakSet()) {
  if (!value || typeof value !== 'object') return '';
  if (seen.has(value)) return '';
  seen.add(value);

  for (const [key, item] of Object.entries(value)) {
    const normalizedKey = String(key).replace(/[^a-z0-9]/gi, '');
    const nextPath = `${pathName}.${key}`;
    if (SENSITIVE_KEY.test(normalizedKey) && item !== '' && item !== null) {
      return nextPath;
    }
    const nested = findSensitivePath(item, nextPath, seen);
    if (nested) return nested;
  }
  return '';
}

function looksLikeRemoteInvoice(value) {
  return Boolean(
    value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      (value.number || value.invoiceNumber) &&
      (value.cufe || value.reference_code || value.referenceCode)
  );
}

function findRemoteInvoice(value, depth = 0, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || depth > 8) return null;
  if (seen.has(value)) return null;
  seen.add(value);
  if (looksLikeRemoteInvoice(value)) return value;

  for (const item of Object.values(value)) {
    const found = findRemoteInvoice(item, depth + 1, seen);
    if (found) return found;
  }
  return null;
}

function findQrValue(value, depth = 0, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || depth > 8) return '';
  if (seen.has(value)) return '';
  seen.add(value);

  for (const [key, item] of Object.entries(value)) {
    if (/qr/i.test(key) && typeof item === 'string' && item.trim().length > 10) {
      return item.trim();
    }
    const found = findQrValue(item, depth + 1, seen);
    if (found) return found;
  }
  return '';
}

function remoteReference(document = {}) {
  return cleanText(
    document.reference_code ||
      document.referenceCode ||
      document.reference,
    180
  );
}

async function waitForReference(settings, referenceCode) {
  let lastResult = null;

  for (let attempt = 1; attempt <= LOOKUP_ATTEMPTS; attempt += 1) {
    lastResult = await findInvoiceByReferenceFromFactus({
      settings,
      referenceCode,
    });
    if (lastResult?.success && lastResult?.found && lastResult?.document) {
      return { ...lastResult, attempts: attempt };
    }
    if (lastResult?.code === 'FACTUS_RECONCILIATION_AMBIGUOUS') {
      break;
    }
    if (attempt < LOOKUP_ATTEMPTS) {
      await delay(attempt * 1_000);
    }
  }

  const error = new Error(
    lastResult?.error ||
      `Factus no devolvió la referencia exacta ${referenceCode}.`
  );
  error.code =
    lastResult?.code || 'FACTUS_LIVE_REFERENCE_NOT_VISIBLE';
  throw error;
}

async function withRetry(action, attempts, label) {
  let lastResult = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    lastResult = await action();
    if (lastResult?.success === true) {
      return { ...lastResult, attempts: attempt };
    }
    if (attempt < attempts) await delay(attempt * 1_000);
  }

  const error = new Error(
    lastResult?.error || `${label} no estuvo disponible después de ${attempts} intentos.`
  );
  error.code = `FACTUS_LIVE_${label.toUpperCase().replace(/\W+/g, '_')}_FAILED`;
  throw error;
}

async function verifyOfficialDocument({
  invoice,
  settings,
  expectedReference,
  expectedTotal,
}) {
  const providerConfig = buildRuntimeFactusConfig(settings.billing || {});
  const queried = await withRetry(
    () =>
      getInvoiceFromFactus({
        providerConfig,
        invoiceNumber: invoice.invoiceNumber,
      }),
    LOOKUP_ATTEMPTS,
    'invoice_query'
  );
  const remote = findRemoteInvoice(queried);

  assert(
    remote,
    `${expectedReference} no devolvió un documento oficial reconocible.`,
    'FACTUS_LIVE_REMOTE_DOCUMENT_MISSING'
  );
  assert(
    cleanText(remote.number || remote.invoiceNumber, 160) ===
      cleanText(invoice.invoiceNumber, 160),
    `${expectedReference} no coincide con el número consultado en Factus.`,
    'FACTUS_LIVE_REMOTE_NUMBER_MISMATCH'
  );
  assert(
    cleanText(remote.cufe, 220) === cleanText(invoice.cufe, 220),
    `${expectedReference} no coincide con el CUFE consultado en Factus.`,
    'FACTUS_LIVE_REMOTE_CUFE_MISMATCH'
  );
  assert(
    !remoteReference(remote) || remoteReference(remote) === expectedReference,
    `${expectedReference} no coincide con la referencia devuelta por Factus.`,
    'FACTUS_LIVE_REMOTE_REFERENCE_MISMATCH'
  );

  const qrValue =
    cleanText(invoice.qrUrl, 5_000) ||
    findQrValue(queried) ||
    findQrValue(remote);
  assert(
    qrValue.length > 10,
    `${expectedReference} no devolvió información verificable del QR.`,
    'FACTUS_LIVE_QR_MISSING'
  );

  const [pdf, xml] = await Promise.all([
    withRetry(
      () =>
        downloadInvoiceDocumentFromFactus({
          providerConfig,
          invoiceNumber: invoice.invoiceNumber,
          type: 'pdf',
        }),
      DOWNLOAD_ATTEMPTS,
      'pdf_download'
    ),
    withRetry(
      () =>
        downloadInvoiceDocumentFromFactus({
          providerConfig,
          invoiceNumber: invoice.invoiceNumber,
          type: 'xml',
        }),
      DOWNLOAD_ATTEMPTS,
      'xml_download'
    ),
  ]);

  assert(
    pdf.buffer?.subarray(0, 5).toString('ascii') === '%PDF-' &&
      pdf.byteLength > 1_000,
    `${expectedReference} devolvió un PDF inválido o vacío.`,
    'FACTUS_LIVE_PDF_INVALID'
  );
  assert(
    xml.buffer?.length > 500 &&
      xml.buffer.toString('utf8').trimStart().startsWith('<'),
    `${expectedReference} devolvió un XML inválido o vacío.`,
    'FACTUS_LIVE_XML_INVALID'
  );

  const xmlText = xml.buffer.toString('utf8');
  assert(
    xmlText.includes(invoice.invoiceNumber),
    `${expectedReference} no contiene el número oficial dentro del XML.`,
    'FACTUS_LIVE_XML_NUMBER_MISMATCH'
  );
  assert(
    xmlText.includes(invoice.cufe),
    `${expectedReference} no contiene el CUFE oficial dentro del XML.`,
    'FACTUS_LIVE_XML_CUFE_MISMATCH'
  );
  assert(
    Math.abs(money(invoice?.totals?.total) - money(expectedTotal)) <= 0.01,
    `${expectedReference} no conserva el total esperado en MongoDB.`,
    'FACTUS_LIVE_LOCAL_TOTAL_MISMATCH'
  );

  return {
    number: invoice.invoiceNumber,
    cufe: invoice.cufe,
    qrVerified: true,
    pdfBytes: pdf.byteLength,
    xmlBytes: xml.byteLength,
    pdfHash: crypto.createHash('sha256').update(pdf.buffer).digest('hex'),
    xmlHash: crypto.createHash('sha256').update(xml.buffer).digest('hex'),
    queryAttempts: queried.attempts,
    pdfAttempts: pdf.attempts,
    xmlAttempts: xml.attempts,
  };
}

function duplicateValues(items, getter) {
  const counts = new Map();
  for (const item of items) {
    const value = cleanText(getter(item), 250);
    if (!value) continue;
    counts.set(value, Number(counts.get(value) || 0) + 1);
  }
  return [...counts.entries()].filter(([, count]) => count > 1);
}

async function auditLocalIntegrity({
  models,
  validOrders,
  invalidOrder,
  metrics,
  references,
}) {
  const [invoices, tasks, invalidInvoices] = await Promise.all([
    models.ElectronicInvoice.find({
      orderId: { $in: validOrders.map((order) => order._id) },
    }).lean(),
    models.BillingInvoiceRecoveryTask.find().lean(),
    models.ElectronicInvoice.countDocuments({ orderId: invalidOrder._id }),
  ]);

  assert(invoices.length === 2, `Se guardaron ${invoices.length} facturas; se esperaban 2.`);
  assert(
    invoices.every(
      (invoice) =>
        invoice.status === 'accepted' &&
        invoice?.emission?.state === 'completed' &&
        invoice?.provider?.isValidated === true &&
        invoice.invoiceNumber &&
        invoice.cufe
    ),
    'Las dos facturas no terminaron aceptadas con datos oficiales completos.',
    'FACTUS_LIVE_LOCAL_INVOICE_INCOMPLETE'
  );
  assert(
    duplicateValues(invoices, (item) => item.invoiceNumber).length === 0 &&
      duplicateValues(invoices, (item) => item.cufe).length === 0 &&
      duplicateValues(invoices, (item) => item?.provider?.referenceCode).length === 0,
    'MongoDB contiene números, CUFE o referencias duplicadas.',
    'FACTUS_LIVE_LOCAL_DUPLICATE'
  );
  assert(
    invalidInvoices === 0,
    'La orden con total alterado alcanzó a reservar una factura.',
    'FACTUS_LIVE_INVALID_ORDER_RESERVED'
  );
  assert(
    tasks.length === 1 &&
      tasks[0].status === 'resolved' &&
      Number(tasks[0].attempts || 0) === 1 &&
      tasks[0].providerNumber &&
      tasks[0].providerCufe,
    'La recuperación no dejó una única tarea resuelta con número y CUFE.',
    'FACTUS_LIVE_RECOVERY_TASK_INVALID'
  );
  assert(
    metrics.emissionCalls === 2 &&
      references.every(
        (reference) =>
          Number(metrics.emissionCallsByReference.get(reference) || 0) === 1
      ),
    `El adaptador realizó ${metrics.emissionCalls} emisiones; se esperaban exactamente 2.`,
    'FACTUS_LIVE_REEMISSION_DETECTED'
  );

  for (const invoice of invoices) {
    const sensitive =
      findSensitivePath(invoice.provider?.raw) ||
      findSensitivePath(invoice.dianResponse?.raw);
    assert(
      !sensitive,
      `Se persistió información sensible en ${sensitive}.`,
      'FACTUS_LIVE_SENSITIVE_DATA_PERSISTED'
    );
  }

  return { invoices, tasks };
}

async function run() {
  if (VALIDATE_PLAN_ONLY) {
    assert(
      process.argv.includes(CONFIRMATION_FLAG),
      `Falta la confirmación de seguridad ${CONFIRMATION_FLAG}.`,
      'FACTUS_LIVE_TRANSACTION_CONFIRMATION_REQUIRED'
    );
    const valid = buildOrderPayload({
      orderNumber: 'LIVE-HAB-PLAN-VALID',
    });
    const invalid = buildOrderPayload({
      orderNumber: 'LIVE-HAB-PLAN-BLOCKED',
      tampered: true,
    });
    assert(
      NORMAL_CONCURRENCY + LOST_RESPONSE_CONCURRENCY + REPLAY_CONCURRENCY + 1 ===
        81,
      'El plan no contiene las 81 solicitudes locales esperadas.'
    );
    assert(
      money(valid.total) === 1_190 &&
        money(valid?.pricing?.subtotalAfterDiscount) +
          money(valid?.pricing?.taxAmount) ===
          money(valid.total),
      'La orden válida del plan no concilia.'
    );
    assert(
      money(invalid.total) === 1_191 &&
        money(invalid?.pricing?.subtotalAfterDiscount) +
          money(invalid?.pricing?.taxAmount) !==
          money(invalid.total),
      'La corrupción económica controlada no quedó activa.'
    );
    console.log('\nPLAN TRANSACCIONAL REAL VALIDADO');
    console.log('  Ambiente permitido: habilitacion');
    console.log('  Emisiones reales máximas: 2');
    console.log('  Solicitudes locales: 81');
    console.log('  Factura normal: concurrencia e idempotencia');
    console.log('  Factura incierta: corte posproveedor y recuperación');
    console.log('  Orden alterada: bloqueo obligatorio antes de Factus');
    return;
  }

  assert(
    process.argv.includes(CONFIRMATION_FLAG),
    `Falta la confirmación de seguridad ${CONFIRMATION_FLAG}.`,
    'FACTUS_LIVE_TRANSACTION_CONFIRMATION_REQUIRED'
  );
  assertEnv();
  const runId = buildRunId();
  const databaseName = buildDatabaseName();
  const references = {
    normal: `LIVE-HAB-NORMAL-${runId}`,
    lost: `LIVE-HAB-RECOVERY-${runId}`,
    invalid: `LIVE-HAB-BLOCKED-${runId}`,
  };
  const metrics = {
    emissionCalls: 0,
    successfulEmissionCalls: 0,
    emissionCallsByReference: new Map(),
    providerResponses: new Map(),
    recoveryLookups: 0,
  };
  let sourceConnection = null;
  let connection = null;
  let settings = null;
  let completed = false;
  let primaryError = null;
  let cleanupError = null;
  const startedAt = Date.now();
  const issuedDocuments = [];

  console.log('\nPRUEBA TRANSACCIONAL REAL — FACTUS HABILITACIÓN');
  console.log('Crea exactamente 2 facturas reales en el sandbox de Factus.');
  console.log('No contacta Producción y no envía correos.');
  console.log(`Referencia normal: ${references.normal}`);
  console.log(`Referencia de recuperación: ${references.lost}`);
  console.log(`Caso bloqueado localmente: ${references.invalid}`);
  console.log(`Base MongoDB temporal: ${databaseName}\n`);

  try {
    sourceConnection = await mongoose
      .createConnection(env.mongoUri, {
        serverSelectionTimeoutMS: 15_000,
        socketTimeoutMS: 60_000,
        maxPoolSize: 5,
      })
      .asPromise();
    const SourceSettings = sourceConnection.model(
      'FactusLiveSourceSiteSettings',
      ProductionSiteSettings.schema.clone(),
      ProductionSiteSettings.collection.name
    );
    settings = await SourceSettings.findOne().lean();
    assert(settings, 'No existe SiteSettings para ejecutar la prueba.');
    const runtime = assertHabilitationSafety(settings);
    console.log(
      `OK       Seguridad: ${runtime.environment} | ${runtime.apiUrl} | rango ${runtime.numberingRangeId}`
    );
    console.log(`OK       MongoDB origen leído mediante ${env.mongoUriSource}`);
    await sourceConnection.close();
    sourceConnection = null;

    connection = await mongoose
      .createConnection(env.mongoUri, {
        dbName: databaseName,
        serverSelectionTimeoutMS: 20_000,
        socketTimeoutMS: 120_000,
        maxPoolSize: 50,
        minPoolSize: 2,
        autoIndex: true,
      })
      .asPromise();
    assert(
      connection.name === databaseName &&
        connection.name.startsWith(DATABASE_PREFIX),
      `MongoDB abrió ${connection.name} en lugar de la base temporal.`,
      'FACTUS_LIVE_DATABASE_ISOLATION_FAILED'
    );

    const models = compileIsolatedModels(connection);
    await Promise.all([
      models.Order.init(),
      models.ElectronicInvoice.init(),
      models.SiteSettings.init(),
      models.BillingInvoiceRecoveryTask.init(),
    ]);
    await models.SiteSettings.create(safeSettingsCopy(settings));
    const [normalOrder, lostOrder, invalidOrder] = await models.Order.insertMany(
      [
        buildOrderPayload({ orderNumber: references.normal }),
        buildOrderPayload({ orderNumber: references.lost }),
        buildOrderPayload({
          orderNumber: references.invalid,
          tampered: true,
        }),
      ],
      { ordered: true }
    );
    console.log('OK       Base temporal aislada y 3 órdenes controladas creadas');

    const providerProbe = createProviderProbe(metrics);
    const standardService = createElectronicInvoiceIssuanceService({
      ElectronicInvoice: models.ElectronicInvoice,
      Order: models.Order,
      SiteSettings: models.SiteSettings,
      sendElectronicInvoiceToProvider: providerProbe,
      assertProductionActivation: async () => {
        throw Object.assign(
          new Error('La prueba intentó entrar en una ruta de Producción.'),
          { code: 'FACTUS_LIVE_PRODUCTION_ROUTE_BLOCKED' }
        );
      },
    });

    console.log(`\nETAPA 1 — ${NORMAL_CONCURRENCY} solicitudes sobre una factura real`);
    const normalRun = await runConcurrentIssues({
      service: standardService,
      orderId: normalOrder._id,
      count: NORMAL_CONCURRENCY,
      source: 'live-habilitacion-concurrency',
    });
    assert(
      normalRun.rejected.length === 0,
      `${normalRun.rejected.length} solicitudes normales fueron rechazadas.`,
      'FACTUS_LIVE_NORMAL_CONCURRENCY_REJECTED'
    );
    assert(
      Number(metrics.emissionCallsByReference.get(references.normal) || 0) === 1,
      'La concurrencia normal produjo más de una emisión real.',
      'FACTUS_LIVE_NORMAL_DUPLICATE_EMISSION'
    );
    const normalInvoices = await models.ElectronicInvoice.find({
      orderId: normalOrder._id,
    }).lean();
    assert(
      normalInvoices.length === 1 && normalInvoices[0].status === 'accepted',
      'La factura normal no terminó aceptada exactamente una vez.',
      'FACTUS_LIVE_NORMAL_NOT_ACCEPTED'
    );
    issuedDocuments.push({
      reference: references.normal,
      number: normalInvoices[0].invoiceNumber,
    });
    const normalReferenceLookup = await waitForReference(
      settings,
      references.normal
    );
    assert(
      remoteReference(normalReferenceLookup.document) === references.normal,
      'La consulta exacta no devolvió la factura normal.',
      'FACTUS_LIVE_NORMAL_REFERENCE_MISMATCH'
    );
    const normalOfficial = await verifyOfficialDocument({
      invoice: normalInvoices[0],
      settings,
      expectedReference: references.normal,
      expectedTotal: normalOrder.total,
    });
    console.log(
      `OK       Una emisión real, ${normalRun.fulfilled.length} respuestas locales, ${normalRun.durationMs} ms`
    );
    console.log(
      `OK       ${normalOfficial.number} | CUFE ${normalOfficial.cufe.slice(0, 18)}… | PDF ${normalOfficial.pdfBytes} B | XML ${normalOfficial.xmlBytes} B`
    );

    console.log(
      `\nETAPA 2 — ${LOST_RESPONSE_CONCURRENCY} solicitudes y pérdida local posproveedor`
    );
    const crashModel = createCrashAfterProviderModel(
      models.ElectronicInvoice,
      lostOrder._id
    );
    const crashService = createElectronicInvoiceIssuanceService({
      ElectronicInvoice: crashModel,
      Order: models.Order,
      SiteSettings: models.SiteSettings,
      sendElectronicInvoiceToProvider: providerProbe,
      assertProductionActivation: async () => {
        throw Object.assign(
          new Error('La prueba intentó entrar en una ruta de Producción.'),
          { code: 'FACTUS_LIVE_PRODUCTION_ROUTE_BLOCKED' }
        );
      },
    });
    const lostRun = await runConcurrentIssues({
      service: crashService,
      orderId: lostOrder._id,
      count: LOST_RESPONSE_CONCURRENCY,
      source: 'live-habilitacion-lost-response',
    });
    assert(
      crashModel.wasCrashInjected(),
      'No se produjo el corte controlado después de la respuesta de Factus.',
      'FACTUS_LIVE_CRASH_NOT_INJECTED'
    );
    assert(
      lostRun.rejected.length === 1 &&
        lostRun.rejected[0].reason?.code ===
          'FACTUS_LIVE_POST_PROVIDER_PERSISTENCE_CRASH',
      `El corte produjo ${lostRun.rejected.length} rechazos; se esperaba exactamente 1.`,
      'FACTUS_LIVE_CRASH_RESULT_UNEXPECTED'
    );
    assert(
      Number(metrics.emissionCallsByReference.get(references.lost) || 0) === 1,
      'El corte posproveedor produjo más de una emisión real.',
      'FACTUS_LIVE_LOST_RESPONSE_DUPLICATE_EMISSION'
    );
    const uncertainInvoice = await models.ElectronicInvoice.findOne({
      orderId: lostOrder._id,
    }).lean();
    assert(
      uncertainInvoice &&
        uncertainInvoice.status === 'processing' &&
        uncertainInvoice?.emission?.state === 'processing' &&
        !uncertainInvoice.invoiceNumber &&
        !uncertainInvoice.cufe,
      'La respuesta perdida no quedó bloqueada como resultado incierto.',
      'FACTUS_LIVE_UNCERTAIN_STATE_UNSAFE'
    );
    const visibleRemote = await waitForReference(settings, references.lost);
    console.log(
      `OK       Factus conserva la referencia perdida; visible tras ${visibleRemote.attempts} consulta(s)`
    );

    console.log('\nETAPA 3 — recuperación exacta sin volver a emitir');
    const recoveryService = createBillingInvoiceRecoveryService({
      ElectronicInvoice: models.ElectronicInvoice,
      BillingInvoiceRecoveryTask: models.BillingInvoiceRecoveryTask,
      SiteSettings: models.SiteSettings,
      findInvoiceByReferenceFromFactus: async (input) => {
        metrics.recoveryLookups += 1;
        return findInvoiceByReferenceFromFactus(input);
      },
    });
    await recoveryService.markInvoiceForReconciliation({
      invoice: uncertainInvoice,
      reason: 'live_post_provider_response_lost',
      source: 'factus-live-transaction-test',
      lastError:
        'Corte controlado después de respuesta exitosa y antes de persistencia.',
    });
    const recovery = await recoveryService.reconcileInvoiceByReference({
      invoiceId: uncertainInvoice._id,
      source: 'factus-live-recovery',
    });
    assert(
      recovery?.resolved === true && recovery?.found === true,
      `La recuperación no fue resuelta: ${JSON.stringify(recovery)}.`,
      'FACTUS_LIVE_RECOVERY_FAILED'
    );
    assert(
      metrics.recoveryLookups === 1 &&
        Number(metrics.emissionCallsByReference.get(references.lost) || 0) === 1,
      'La recuperación repitió la emisión o consultó de forma inesperada.',
      'FACTUS_LIVE_RECOVERY_REISSUED'
    );
    const recoveredInvoice = await models.ElectronicInvoice.findOne({
      orderId: lostOrder._id,
    }).lean();
    assert(
      recoveredInvoice?.status === 'accepted' &&
        recoveredInvoice?.emission?.state === 'completed' &&
        recoveredInvoice.invoiceNumber &&
        recoveredInvoice.cufe,
      'La factura recuperada no terminó aceptada con número y CUFE.',
      'FACTUS_LIVE_RECOVERY_INCOMPLETE'
    );
    issuedDocuments.push({
      reference: references.lost,
      number: recoveredInvoice.invoiceNumber,
    });
    const recoveredOfficial = await verifyOfficialDocument({
      invoice: recoveredInvoice,
      settings,
      expectedReference: references.lost,
      expectedTotal: lostOrder.total,
    });
    console.log(
      `OK       ${recoveredOfficial.number} recuperada con CUFE, QR, PDF y XML; emisiones adicionales: 0`
    );

    console.log(`\nETAPA 4 — ${REPLAY_CONCURRENCY} repeticiones después de recuperar`);
    const replay = await runConcurrentIssues({
      service: standardService,
      orderId: lostOrder._id,
      count: REPLAY_CONCURRENCY,
      source: 'live-habilitacion-replay',
    });
    assert(
      replay.rejected.length === 0 &&
        replay.fulfilled.every(
          (item) =>
            item.value?.reused === true &&
            item.value?.created === false
        ),
      'Las repeticiones posteriores no reutilizaron la factura recuperada.',
      'FACTUS_LIVE_REPLAY_NOT_IDEMPOTENT'
    );
    assert(
      Number(metrics.emissionCallsByReference.get(references.lost) || 0) === 1,
      'Las repeticiones posteriores volvieron a emitir la factura.',
      'FACTUS_LIVE_REPLAY_REISSUED'
    );
    console.log('OK       Todas reutilizaron el mismo documento; emisiones adicionales: 0');

    console.log('\nETAPA 5 — orden alterada bloqueada antes de Factus');
    let invalidError = null;
    try {
      await issueRequest(
        standardService,
        invalidOrder._id,
        'live-habilitacion-invalid-total'
      );
    } catch (error) {
      invalidError = error;
    }
    assert(
      invalidError?.code === 'BILLING_TOTAL_MISMATCH',
      `La orden alterada produjo ${invalidError?.code || 'ningún error'}.`,
      'FACTUS_LIVE_INVALID_ORDER_NOT_BLOCKED'
    );
    assert(
      Number(metrics.emissionCallsByReference.get(references.invalid) || 0) === 0,
      'La orden alterada alcanzó a contactar a Factus.',
      'FACTUS_LIVE_INVALID_ORDER_REACHED_PROVIDER'
    );
    console.log('OK       BILLING_TOTAL_MISMATCH; llamadas a Factus: 0');

    console.log('\nETAPA 6 — auditoría integral local y remota');
    const audit = await auditLocalIntegrity({
      models,
      validOrders: [normalOrder, lostOrder],
      invalidOrder,
      metrics,
      references: [references.normal, references.lost],
    });
    assert(
      metrics.successfulEmissionCalls === 2,
      `Factus confirmó ${metrics.successfulEmissionCalls} emisiones; se esperaban 2.`,
      'FACTUS_LIVE_PROVIDER_SUCCESS_COUNT'
    );
    assert(
      audit.invoices.length === 2 && audit.tasks.length === 1,
      'La auditoría final no conservó la cardinalidad esperada.',
      'FACTUS_LIVE_FINAL_CARDINALITY'
    );
    console.log('OK       2 facturas, 2 números, 2 CUFE, 2 referencias y 1 recuperación');
    console.log('OK       0 duplicados, 0 reemisiones y 0 datos sensibles persistidos');

    completed = true;
    console.log('\nMÉTRICAS');
    console.log(
      `  Solicitudes locales: ${
        NORMAL_CONCURRENCY + LOST_RESPONSE_CONCURRENCY + REPLAY_CONCURRENCY + 1
      }`
    );
    console.log(`  Emisiones reales a Factus: ${metrics.emissionCalls}`);
    console.log(`  Consultas del worker de recuperación: ${metrics.recoveryLookups}`);
    console.log(`  Duración total: ${Date.now() - startedAt} ms`);
    console.log(
      `  PDF normal SHA-256: ${normalOfficial.pdfHash.slice(0, 20)}…`
    );
    console.log(
      `  XML normal SHA-256: ${normalOfficial.xmlHash.slice(0, 20)}…`
    );
    console.log(
      `  PDF recuperado SHA-256: ${recoveredOfficial.pdfHash.slice(0, 20)}…`
    );
    console.log(
      `  XML recuperado SHA-256: ${recoveredOfficial.xmlHash.slice(0, 20)}…`
    );
  } catch (error) {
    primaryError = error;
    console.error('\nDICTAMEN: RECHAZADO');
    console.error(`[${error.code || 'ERROR'}] ${error.message}`);
  } finally {
    if (sourceConnection) {
      await sourceConnection.close().catch(() => {});
    }
    if (connection) {
      try {
        assert(
          connection.name.startsWith(DATABASE_PREFIX),
          `Se bloqueó la limpieza de una base no temporal: ${connection.name}.`,
          'FACTUS_LIVE_CLEANUP_UNSAFE'
        );
        await connection.dropDatabase();
        console.log(`\nLimpieza: base temporal ${connection.name} eliminada.`);
      } catch (error) {
        cleanupError = error;
        console.error(
          `\nNo se pudo eliminar la base temporal ${connection.name}: ${error.message}`
        );
      } finally {
        await connection.close().catch(() => {});
      }
    }

    if (issuedDocuments.length) {
      console.log('\nDOCUMENTOS CREADOS EN FACTUS HABILITACIÓN');
      for (const item of issuedDocuments) {
        console.log(`  ${item.reference} -> ${item.number || 'número no persistido'}`);
      }
    }
  }

  if (primaryError) throw primaryError;
  if (cleanupError) throw cleanupError;
  assert(completed, 'La prueba terminó sin producir un dictamen.');
  console.log('\nDICTAMEN: APROBADO');
  console.log(
    'Factus habilitación aprobó emisión real, concurrencia, idempotencia, consulta, CUFE, QR, PDF, XML y recuperación sin reemisión.'
  );
}

run().catch((error) => {
  if (!String(error?.message || '').includes('DICTAMEN')) {
    console.error(`\nEjecución terminada con error: ${error.message}`);
  }
  process.exitCode = 1;
});
