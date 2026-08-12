/* eslint-disable no-console */
'use strict';

const crypto = require('crypto');
const path = require('path');

require('dotenv').config({
  path:
    process.env.BILLING_STRESS_ENV_FILE ||
    path.join(__dirname, '..', '.env'),
  quiet: true,
});

process.env.BILLING_ENCRYPTION_KEY =
  process.env.BILLING_ENCRYPTION_KEY ||
  'billing-stress-test-key-with-more-than-32-characters';

const mongoose = require('mongoose');

const ProductionElectronicInvoice = require('../models/ElectronicInvoice');
const ProductionBillingInvoiceRecoveryTask = require('../models/BillingInvoiceRecoveryTask');
const ProductionOrder = require('../models/Order');
const ProductionSiteSettings = require('../models/SiteSettings');
const {
  createElectronicInvoiceIssuanceService,
} = require('../services/electronicInvoiceIssuanceService');
const {
  INVOICE_LOCK_MS,
  createBillingInvoiceRecoveryService,
} = require('../services/billingInvoiceRecoveryService');
const {
  buildRuntimeFactusConfig,
  encryptBillingSecret,
} = require('../lib/billing/billingConfigurationSecurity');

const ORDER_COUNT = 500;
const REQUESTS_PER_ORDER = 8;
const INITIAL_REQUEST_COUNT = ORDER_COUNT * REQUESTS_PER_ORDER;
const RETRIES_PER_FAILED_ORDER = 3;
const CRASH_REPLAY_COUNT = 2;
const MAX_INITIAL_DURATION_MS = Number(
  process.env.BILLING_STRESS_MAX_DURATION_MS || 180_000
);
const DATABASE_PREFIX = 'billing_stress_';
const VALIDATE_PLAN_ONLY = process.argv.includes('--validate-plan');

const SCENARIOS = Object.freeze([
  { key: 'accepted', count: 300, billable: true },
  { key: 'slow_success', count: 40, billable: true },
  { key: 'provider_rejected', count: 20, billable: true },
  { key: 'provider_incomplete', count: 15, billable: true },
  { key: 'provider_network_error', count: 15, billable: true },
  { key: 'post_provider_crash', count: 10, billable: true },
  { key: 'unpaid', count: 30, billable: false },
  { key: 'tampered_total', count: 30, billable: false },
  { key: 'inconsistent_discount', count: 20, billable: false },
  { key: 'missing_identity', count: 20, billable: false },
]);

const INITIAL_ACCEPTED_SCENARIOS = new Set(['accepted', 'slow_success']);
const RETRYABLE_PROVIDER_SCENARIOS = new Set([
  'provider_rejected',
  'provider_incomplete',
  'provider_network_error',
]);
const PRE_RECOVERY_STAGES = new Set(['initial', 'final']);
const POST_RETRY_STAGES = new Set(['final', 'recovered']);
const BILLABLE_SCENARIOS = new Set(
  SCENARIOS.filter((item) => item.billable).map((item) => item.key)
);
const SOURCE_SEQUENCE = [
  'wompi',
  'payu',
  'pos',
  'admin',
  'webhook',
  'admin-retry',
  'system',
  'replay',
];
const ECONOMIC_FIELDS = [
  'subtotal',
  'productDiscount',
  'subtotalAfterDiscount',
  'originalShipping',
  'shippingDiscount',
  'shipping',
  'totalDiscount',
  'taxableBase',
  'taxAmount',
  'total',
];
const SENSITIVE_KEY =
  /(authorization|password|passwd|secret|token|credential|cookie|softwarepin|technicalkey|certificate|privatekey|apikey|clientsecret|refresh)/i;

function assert(condition, message, code = 'BILLING_STRESS_ASSERTION_FAILED') {
  if (condition) return;
  const error = new Error(message);
  error.code = code;
  throw error;
}

function money(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function scenarioForIndex(index) {
  let cursor = 0;
  for (const scenario of SCENARIOS) {
    cursor += scenario.count;
    if (index < cursor) return scenario.key;
  }
  throw new Error(`No existe escenario para el índice ${index}.`);
}

function scenarioCounts() {
  return Object.fromEntries(SCENARIOS.map(({ key, count }) => [key, count]));
}

function expectedInitialErrorCode(scenario) {
  return {
    provider_rejected: 'BILLING_PROVIDER_GENERATION_ERROR',
    provider_incomplete: 'BILLING_PROVIDER_NUMBER_MISSING',
    provider_network_error: 'BILLING_PROVIDER_GENERATION_ERROR',
    post_provider_crash: 'BILLING_STRESS_POST_PROVIDER_PERSISTENCE_CRASH',
    unpaid: 'ORDER_NOT_BILLABLE',
    tampered_total: 'BILLING_TOTAL_MISMATCH',
    inconsistent_discount: 'BILLING_LINE_TOTAL_MISMATCH',
    missing_identity: 'BILLING_CUSTOMER_IDENTITY_REQUIRED',
  }[scenario];
}

function expectedStatus(scenario, stage) {
  if (!BILLABLE_SCENARIOS.has(scenario)) return null;
  if (
    scenario === 'post_provider_crash' &&
    PRE_RECOVERY_STAGES.has(stage)
  ) {
    return 'processing';
  }
  if (stage === 'initial' && RETRYABLE_PROVIDER_SCENARIOS.has(scenario)) {
    return 'failed';
  }
  return 'accepted';
}

function expectedAttempts(scenario, stage) {
  if (!BILLABLE_SCENARIOS.has(scenario)) return 0;
  if (
    POST_RETRY_STAGES.has(stage) &&
    RETRYABLE_PROVIDER_SCENARIOS.has(scenario)
  ) {
    return 2;
  }
  return 1;
}

function expectedProviderCalls(scenario, stage) {
  if (!BILLABLE_SCENARIOS.has(scenario)) return 0;
  if (
    POST_RETRY_STAGES.has(stage) &&
    RETRYABLE_PROVIDER_SCENARIOS.has(scenario)
  ) {
    return 2;
  }
  return 1;
}

function buildOrderPayload(index, scenario) {
  const firstUnitPrice = 30_000 + (index % 20) * 100;
  const secondUnitPrice = 15_000 + (index % 15) * 100;
  const firstQuantity = 1;
  const secondQuantity = 2;
  const firstSubtotal = firstUnitPrice * firstQuantity;
  const secondSubtotal = secondUnitPrice * secondQuantity;
  const firstDiscount = index % 4 === 0 ? 1_000 : 0;
  const secondDiscount = 0;
  const firstTaxableBase = firstSubtotal - firstDiscount;
  const secondTaxableBase = secondSubtotal - secondDiscount;
  const firstTax = money(firstTaxableBase * 0.19);
  const secondTax = money(secondTaxableBase * 0.19);
  const subtotal = firstSubtotal + secondSubtotal;
  const productDiscount = firstDiscount + secondDiscount;
  const subtotalAfterDiscount = subtotal - productDiscount;
  const shipping = index % 3 === 0 ? 5_000 : 0;
  const taxAmount = firstTax + secondTax;
  const total = subtotalAfterDiscount + shipping + taxAmount;
  const orderNumber = `STRESS-${String(index + 1).padStart(6, '0')}`;

  const payload = {
    sessionId: `billing-stress-session-${String(index + 1).padStart(6, '0')}`,
    orderNumber,
    status: 'paid',
    source: 'online',
    channel: 'web',
    saleType: 'online_order',
    fulfillmentStatus: 'processing',
    tags: ['billing-stress'],
    pos: {
      customerMode: 'identified',
      quickSale: false,
    },
    items: [
      {
        productId: `STRESS-SKU-A-${index + 1}`,
        title: `Producto de choque A ${index + 1}`,
        quantity: firstQuantity,
        qty: firstQuantity,
        price: firstUnitPrice,
        unitPrice: firstUnitPrice,
        priceNumber: firstUnitPrice,
        lineSubtotal: firstSubtotal,
        discountAmount: firstDiscount,
        taxableBase: firstTaxableBase,
        taxRate: 19,
        taxAmount: firstTax,
        lineTotal: firstTaxableBase + firstTax,
      },
      {
        productId: `STRESS-SKU-B-${index + 1}`,
        title: `Producto de choque B ${index + 1}`,
        quantity: secondQuantity,
        qty: secondQuantity,
        price: secondUnitPrice,
        unitPrice: secondUnitPrice,
        priceNumber: secondUnitPrice,
        lineSubtotal: secondSubtotal,
        discountAmount: secondDiscount,
        taxableBase: secondTaxableBase,
        taxRate: 19,
        taxAmount: secondTax,
        lineTotal: secondTaxableBase + secondTax,
      },
    ],
    discount: {
      type: productDiscount > 0 ? 'amount' : 'none',
      value: productDiscount,
      amount: productDiscount,
      reason: productDiscount > 0 ? 'Descuento controlado de prueba' : '',
    },
    subtotal,
    shipping,
    total,
    pricing: {
      version: 2,
      currency: 'COP',
      subtotal,
      productDiscount,
      subtotalAfterDiscount,
      originalShipping: shipping,
      shippingDiscount: 0,
      shipping,
      totalDiscount: productDiscount,
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
      name: 'Cliente',
      lastname: `Choque ${index + 1}`,
      email: `billing-stress-${index + 1}@example.invalid`,
      phone: `300${String(index + 1).padStart(7, '0')}`,
      address: `Calle de prueba ${index + 1}`,
      city: 'Bogotá',
      municipalityId: '11001',
      department: 'Bogotá D.C.',
      departmentCode: '11',
      country: 'Colombia',
      countryCode: 'CO',
    },
    billing: {
      personType: 'natural',
      firstName: 'Cliente',
      lastName: `Choque ${index + 1}`,
      documentNumber: `10${String(index + 1).padStart(8, '0')}`,
      documentType: 'CC',
      address: `Calle de prueba ${index + 1}`,
      city: 'Bogotá',
      municipalityCode: '11001',
      department: 'Bogotá D.C.',
      departmentCode: '11',
      phone: `300${String(index + 1).padStart(7, '0')}`,
      email: `billing-stress-${index + 1}@example.invalid`,
      country: 'Colombia',
      countryCode: 'CO',
      tributeCode: 'ZZ',
    },
    payment: {
      active: true,
      provider: index % 2 === 0 ? 'wompi' : 'payu',
      providerLabel: index % 2 === 0 ? 'Wompi' : 'PayU',
      mode: 'sandbox',
      currency: 'COP',
      status: 'paid',
      methodType: 'card',
      method: 'visa',
      methodLabel: 'Tarjeta de prueba',
      transactionId: `STRESS-TX-${index + 1}`,
      reference: index % 2 === 0 ? `ORDER-${orderNumber}` : orderNumber,
      amount: total,
      amountInCents: total * 100,
      paidAt: new Date('2026-07-27T12:00:00.000Z'),
    },
  };

  if (scenario === 'unpaid') {
    payload.status = 'pending';
    payload.payment.status = 'failed';
    payload.payment.paidAt = null;
  }

  if (scenario === 'tampered_total') {
    payload.total += 777;
    payload.pricing.total += 777;
    payload.payment.amount += 777;
    payload.payment.amountInCents = payload.payment.amount * 100;
  }

  if (scenario === 'inconsistent_discount') {
    const hiddenDiscount = 700;
    payload.pricing.productDiscount += hiddenDiscount;
    payload.pricing.totalDiscount += hiddenDiscount;
    payload.pricing.subtotalAfterDiscount -= hiddenDiscount;
    payload.pricing.taxableBase -= hiddenDiscount;
    payload.taxes.iva.taxableBase -= hiddenDiscount;
    payload.pricing.taxAmount = money(payload.pricing.taxableBase * 0.19);
    payload.taxes.iva.amount = payload.pricing.taxAmount;
    payload.total = money(
      payload.pricing.subtotalAfterDiscount +
        payload.shipping +
        payload.pricing.taxAmount
    );
    payload.pricing.total = payload.total;
    payload.payment.amount = payload.total;
    payload.payment.amountInCents = payload.total * 100;
  }

  if (scenario === 'missing_identity') {
    delete payload.billing.documentNumber;
  }

  return payload;
}

function buildBillingSettings() {
  return {
    publicUrl: 'https://stress-test.invalid',
    store: {
      name: 'Tienda temporal de choque',
      businessName: 'Tienda temporal de choque S.A.S.',
      email: 'stress-test@example.invalid',
      phone: '3000000000',
      address: 'Calle temporal 1',
    },
    billing: {
      fiscalInfo: {
        businessName: 'Tienda temporal de choque S.A.S.',
        nit: '900123456',
        dv: '7',
        taxRegime: 'Responsable de IVA',
        taxResponsibility: 'O-13',
        legalRepresentative: 'Prueba automatizada',
        billingEmail: 'stress-test@example.invalid',
        address: 'Calle temporal 1',
        city: 'Bogotá',
        cityCode: '11001',
        municipalityCode: '11001',
        department: 'Bogotá D.C.',
        departmentCode: '11',
        country: 'CO',
      },
      dian: {
        enabled: true,
        mode: 'habilitacion',
        environment: '2',
        providerType: 'provider',
        providerNit: '900123456',
        providerDv: '7',
      },
      dianResolution: {
        resolutionNumber: '18760000001',
        prefix: 'SETP',
        rangeFrom: 990000000,
        rangeTo: 995000000,
        currentNumber: 990000000,
        resolutionDate: '2026-01-01',
        expirationDate: '2027-12-31',
        documentType: '01',
        technicalKey: 'stress-technical-key-never-sent',
        environment: '2',
        numberingRangeId: 1,
      },
      electronicProvider: {
        provider: 'factus',
        apiUrl: 'https://api-sandbox.factus.com.co',
        clientId: 'billing-stress-client',
        clientSecret: encryptBillingSecret('billing-stress-client-secret'),
        username: 'billing-stress@example.invalid',
        password: encryptBillingSecret('billing-stress-password'),
        numberingRangeId: 1,
      },
      legalTexts: {
        invoiceLegalText: 'Factura generada únicamente en una prueba temporal.',
        internalReceiptNote: 'No representa una venta real.',
      },
      taxes: {
        iva: {
          enabled: true,
          percent: 19,
          code: '01',
          name: 'IVA',
        },
      },
    },
  };
}

function validatePlan() {
  const runtimeProvider = buildRuntimeFactusConfig(
    buildBillingSettings().billing
  );
  const declaredOrders = SCENARIOS.reduce((sum, item) => sum + item.count, 0);
  const billableOrders = SCENARIOS.filter((item) => item.billable).reduce(
    (sum, item) => sum + item.count,
    0
  );
  const retryableOrders = SCENARIOS.filter((item) =>
    RETRYABLE_PROVIDER_SCENARIOS.has(item.key)
  ).reduce((sum, item) => sum + item.count, 0);
  const crashOrders = SCENARIOS.find(
    (item) => item.key === 'post_provider_crash'
  ).count;
  const retryRequests =
    retryableOrders * RETRIES_PER_FAILED_ORDER +
    crashOrders * CRASH_REPLAY_COUNT;

  assert(declaredOrders === ORDER_COUNT, 'El plan no suma 500 órdenes.');
  assert(INITIAL_REQUEST_COUNT === 4_000, 'El choque inicial no suma 4.000 solicitudes.');
  assert(billableOrders === 400, 'El plan debe contener 400 órdenes facturables.');
  assert(retryableOrders === 50, 'El plan debe contener 50 fallos reintentables.');
  assert(
    expectedAttempts('provider_rejected', 'final') === 2 &&
      expectedAttempts('provider_rejected', 'recovered') === 2,
    'El auditor perdió los dos intentos después de la conciliación.'
  );
  assert(
    expectedProviderCalls('provider_rejected', 'final') === 2 &&
      expectedProviderCalls('provider_rejected', 'recovered') === 2,
    'El auditor perdió las dos llamadas al proveedor después de la conciliación.'
  );
  assert(
    expectedStatus('post_provider_crash', 'final') === 'processing' &&
      expectedStatus('post_provider_crash', 'recovered') === 'accepted',
    'El auditor no reconoce la transición de resultado incierto a factura aceptada.'
  );
  assert(
    runtimeProvider.apiUrl === 'https://api-sandbox.factus.com.co' &&
      runtimeProvider.environment === 'habilitacion' &&
      runtimeProvider.clientId === 'billing-stress-client' &&
      runtimeProvider.clientSecret === 'billing-stress-client-secret' &&
      runtimeProvider.username === 'billing-stress@example.invalid' &&
      runtimeProvider.password === 'billing-stress-password',
    'La prueba de choque no construye una configuración aislada válida de Factus.'
  );

  const payloads = Array.from({ length: ORDER_COUNT }, (_, index) => {
    const scenario = scenarioForIndex(index);
    return buildOrderPayload(index, scenario);
  });
  assert(
    new Set(payloads.map((item) => item.orderNumber)).size === ORDER_COUNT,
    'El generador produjo números de orden duplicados.'
  );

  return {
    declaredOrders,
    billableOrders,
    retryableOrders,
    initialRequests: INITIAL_REQUEST_COUNT,
    retryRequests,
    totalRequests: INITIAL_REQUEST_COUNT + retryRequests,
    scenarios: scenarioCounts(),
  };
}

function buildDatabaseName() {
  const timestamp = new Date()
    .toISOString()
    .replace(/\D/g, '')
    .slice(0, 14);
  const random = crypto.randomBytes(3).toString('hex');
  return `${DATABASE_PREFIX}${timestamp}_${random}`;
}

function resolveMongoConfiguration() {
  const candidates = [
    ['BILLING_STRESS_MONGO_URI', process.env.BILLING_STRESS_MONGO_URI],
    ['MONGO_URI', process.env.MONGO_URI],
    ['MONGODB_URI', process.env.MONGODB_URI],
    ['MONGO_URL', process.env.MONGO_URL],
    ['DATABASE_URL', process.env.DATABASE_URL],
  ];
  const selected = candidates.find(([, value]) => String(value || '').trim());
  assert(
    selected,
    'Falta MONGO_URI o MONGODB_URI en backend/.env. No se inició ninguna prueba.',
    'BILLING_STRESS_MONGO_URI_MISSING'
  );
  assert(
    /^mongodb(\+srv)?:\/\//i.test(String(selected[1]).trim()),
    `${selected[0]} no contiene una URI válida de MongoDB.`,
    'BILLING_STRESS_MONGO_URI_INVALID'
  );

  const databaseName =
    String(process.env.BILLING_STRESS_DATABASE_NAME || '').trim() ||
    buildDatabaseName();
  assert(
    new RegExp(`^${DATABASE_PREFIX}[a-z0-9_]+$`, 'i').test(databaseName),
    `La base temporal debe comenzar por ${DATABASE_PREFIX}.`,
    'BILLING_STRESS_DATABASE_NAME_UNSAFE'
  );
  assert(databaseName.length <= 63, 'El nombre de la base temporal supera 63 caracteres.');

  return {
    source: selected[0],
    uri: String(selected[1]).trim(),
    databaseName,
  };
}

function compileIsolatedModels(connection) {
  const Order = connection.model(
    'Order',
    ProductionOrder.schema.clone(),
    ProductionOrder.collection.name
  );
  const ElectronicInvoice = connection.model(
    'ElectronicInvoice',
    ProductionElectronicInvoice.schema.clone(),
    ProductionElectronicInvoice.collection.name
  );
  const SiteSettings = connection.model(
    'SiteSettings',
    ProductionSiteSettings.schema.clone(),
    ProductionSiteSettings.collection.name
  );
  const BillingInvoiceRecoveryTask = connection.model(
    'BillingInvoiceRecoveryTask',
    ProductionBillingInvoiceRecoveryTask.schema.clone(),
    ProductionBillingInvoiceRecoveryTask.collection.name
  );

  return {
    Order,
    ElectronicInvoice,
    SiteSettings,
    BillingInvoiceRecoveryTask,
  };
}

function createProviderSimulator({
  scenarioByOrderId,
  metrics,
  remoteDocumentsByReference,
}) {
  return async ({ provider, invoiceData } = {}) => {
    assert(provider === 'factus', `Proveedor inesperado: ${provider}.`);
    const order = invoiceData?.order || {};
    const orderId = String(order._id || '');
    const scenario = scenarioByOrderId.get(orderId);
    assert(scenario, `El proveedor recibió una orden desconocida: ${orderId}.`);

    const attempt = Number(metrics.providerCallsByOrder.get(orderId) || 0) + 1;
    metrics.providerCallsByOrder.set(orderId, attempt);
    metrics.providerCalls += 1;

    if (scenario === 'slow_success' && attempt === 1) {
      await delay(40 + (Number(order.orderNumber?.slice(-2)) % 5) * 10);
    }

    if (scenario === 'provider_rejected' && attempt === 1) {
      return {
        success: false,
        status: 422,
        data: {
          message: 'Rechazo fiscal simulado y controlado.',
          data: {
            reference_code: order.orderNumber,
            errors: {
              document: ['Documento rechazado por la prueba de choque.'],
              client_secret: 'stress-client-secret-must-not-persist',
            },
          },
          authorization: 'Bearer stress-token-must-not-persist',
        },
      };
    }

    if (scenario === 'provider_incomplete' && attempt === 1) {
      return {
        success: true,
        status: 201,
        data: {
          message: 'Respuesta incompleta simulada.',
          data: {
            reference_code: order.orderNumber,
            cufe: crypto
              .createHash('sha256')
              .update(`incomplete:${orderId}`)
              .digest('hex'),
            is_validated: true,
            access_token: 'stress-token-must-not-persist',
          },
        },
      };
    }

    if (scenario === 'provider_network_error' && attempt === 1) {
      throw new Error('Caída de red simulada después de reservar la emisión.');
    }

    const number = `SETP${String(order.orderNumber || '').replace(/\D/g, '')}`;
    const cufe = crypto
      .createHash('sha256')
      .update(`official-stress-cufe:${orderId}`)
      .digest('hex');
    const remoteDocument = {
      id: Number(String(order.orderNumber || '').replace(/\D/g, '')),
      reference_code: order.orderNumber,
      number,
      cufe,
      is_validated: true,
      validated_at: new Date().toISOString(),
      links: {
        pdf_url: `https://simulator.invalid/${number}.pdf`,
        xml_url: `https://simulator.invalid/${number}.xml`,
      },
    };
    remoteDocumentsByReference.set(order.orderNumber, remoteDocument);

    return {
      success: true,
      status: 201,
      data: {
        status: 'Created',
        message: 'Documento validado por el simulador de choque.',
        data: {
          ...remoteDocument,
          access_token: 'stress-token-must-not-persist',
          nested: {
            client_secret: 'stress-client-secret-must-not-persist',
            status: 'validated',
          },
        },
      },
    };
  };
}

function createRecoveryLookupSimulator({
  metrics,
  remoteDocumentsByReference,
}) {
  return async ({ settings, referenceCode } = {}) => {
    assert(
      settings?.billing?.electronicProvider?.provider === 'factus',
      'La conciliación no cargó la configuración aislada de Factus.'
    );

    const normalizedReference = String(referenceCode || '').trim();
    metrics.recoveryLookupCalls += 1;
    metrics.recoveryLookupCallsByReference.set(
      normalizedReference,
      Number(metrics.recoveryLookupCallsByReference.get(normalizedReference) || 0) + 1
    );
    await delay(10);

    const document = remoteDocumentsByReference.get(normalizedReference) || null;
    return {
      success: true,
      found: Boolean(document),
      document,
    };
  };
}

function createRecoveryDetailSimulator({ remoteDocumentsByReference }) {
  return async ({ providerConfig, invoiceNumber } = {}) => {
    assert(
      providerConfig?.apiUrl === 'https://api-sandbox.factus.com.co',
      'La recuperación no construyó la configuración segura de Factus.'
    );

    const document =
      [...remoteDocumentsByReference.values()].find(
        (item) => item.number === invoiceNumber
      ) || null;

    return document
      ? {
          success: true,
          data: {
            data: {
              bill: document,
            },
          },
        }
      : {
          success: false,
          status: 404,
          error: 'Factura simulada no encontrada por número.',
        };
  };
}

function createCrashAwareInvoiceModel({
  ElectronicInvoice,
  scenarioByOrderId,
  metrics,
}) {
  const scenarioByInvoiceId = new Map();

  return {
    findOne(...args) {
      return ElectronicInvoice.findOne(...args);
    },

    async create(payload) {
      const document = await ElectronicInvoice.create(payload);
      scenarioByInvoiceId.set(
        String(document._id),
        scenarioByOrderId.get(String(document.orderId))
      );
      return document;
    },

    async findOneAndUpdate(filter, update, options) {
      const invoiceId = String(filter?._id || '');
      const scenario = scenarioByInvoiceId.get(invoiceId);
      const isSuccessfulProviderPersistence =
        update?.$set?.status === 'accepted' &&
        update?.$set?.['emission.state'] === 'completed';

      if (
        scenario === 'post_provider_crash' &&
        isSuccessfulProviderPersistence &&
        !metrics.crashedInvoiceIds.has(invoiceId)
      ) {
        metrics.crashedInvoiceIds.add(invoiceId);
        const error = new Error(
          'Corte simulado después de la respuesta del proveedor y antes de persistirla.'
        );
        error.code = 'BILLING_STRESS_POST_PROVIDER_PERSISTENCE_CRASH';
        throw error;
      }

      const document = await ElectronicInvoice.findOneAndUpdate(
        filter,
        update,
        options
      );
      if (document?._id && !scenarioByInvoiceId.has(String(document._id))) {
        scenarioByInvoiceId.set(
          String(document._id),
          scenarioByOrderId.get(String(document.orderId))
        );
      }
      return document;
    },
  };
}

function createEmailSimulator({ ElectronicInvoice, metrics }) {
  return async (invoiceId) => {
    metrics.emailCalls += 1;
    const callNumber = metrics.emailCalls;
    const invoice = await ElectronicInvoice.findById(invoiceId).lean();

    if (callNumber % 13 === 0) {
      metrics.emailFailures += 1;
      const error = new Error('Fallo SMTP simulado y controlado.');
      error.invoice = invoice;
      error.delivery = {
        status: 'error',
        lastError: 'Fallo SMTP simulado y controlado.',
      };
      throw error;
    }

    return {
      invoice,
      delivery: {
        status: 'sent',
        sentAt: new Date(),
      },
    };
  };
}

function buildInitialTasks(orders, scenarioByOrderId) {
  return orders.flatMap((order) =>
    Array.from({ length: REQUESTS_PER_ORDER }, (_, requestIndex) => ({
      orderId: String(order._id),
      scenario: scenarioByOrderId.get(String(order._id)),
      requestIndex,
      parameters: {
        orderId: order._id,
        source: SOURCE_SEQUENCE[requestIndex % SOURCE_SEQUENCE.length],
        initiatedBy: `billing-stress-${requestIndex + 1}`,
        transaction: {
          id: `${order.orderNumber}-request-${requestIndex + 1}`,
          payment_method_type: requestIndex % 2 === 0 ? 'card' : 'transfer',
          payment_method_name: requestIndex % 2 === 0 ? 'Visa' : 'PSE',
        },
        payments: {
          mode: 'sandbox',
        },
      },
    }))
  );
}

function buildRetryTasks(orders, scenarioByOrderId) {
  const tasks = [];

  for (const order of orders) {
    const orderId = String(order._id);
    const scenario = scenarioByOrderId.get(orderId);
    const repetitions = RETRYABLE_PROVIDER_SCENARIOS.has(scenario)
      ? RETRIES_PER_FAILED_ORDER
      : scenario === 'post_provider_crash'
        ? CRASH_REPLAY_COUNT
        : 0;

    for (let index = 0; index < repetitions; index += 1) {
      tasks.push({
        orderId,
        scenario,
        requestIndex: index,
        parameters: {
          orderId: order._id,
          source: index % 2 === 0 ? 'admin-retry' : 'webhook-replay',
          initiatedBy: `billing-stress-retry-${index + 1}`,
          allowRetry: true,
          transaction: {
            id: `${order.orderNumber}-retry-${index + 1}`,
          },
          payments: {
            mode: 'sandbox',
          },
        },
      });
    }
  }

  return tasks;
}

async function executeConcurrentTasks(tasks, issueElectronicInvoiceForOrder) {
  const startedAt = Date.now();
  const settled = await Promise.allSettled(
    tasks.map((task) => issueElectronicInvoiceForOrder(task.parameters))
  );
  const durationMs = Date.now() - startedAt;

  return {
    durationMs,
    records: settled.map((result, index) => ({
      ...tasks[index],
      result,
    })),
  };
}

function rejectionCode(record) {
  return String(record?.result?.reason?.code || '');
}

function auditInitialRequestResults(records) {
  const findings = [];
  const byOrder = new Map();

  for (const record of records) {
    const current = byOrder.get(record.orderId) || [];
    current.push(record);
    byOrder.set(record.orderId, current);
  }

  for (const [orderId, group] of byOrder.entries()) {
    const scenario = group[0].scenario;
    const rejected = group.filter((item) => item.result.status === 'rejected');
    const fulfilled = group.filter((item) => item.result.status === 'fulfilled');
    const expectedCode = expectedInitialErrorCode(scenario);

    if (group.length !== REQUESTS_PER_ORDER) {
      findings.push({
        code: 'REQUEST_COUNT_PER_ORDER',
        detail: `${orderId} recibió ${group.length} solicitudes.`,
      });
    }

    if (INITIAL_ACCEPTED_SCENARIOS.has(scenario)) {
      if (rejected.length > 0 || fulfilled.length !== REQUESTS_PER_ORDER) {
        findings.push({
          code: 'SUCCESS_REQUEST_REJECTED',
          detail: `${orderId} (${scenario}) tuvo ${rejected.length} rechazos.`,
        });
      }
      continue;
    }

    if (!BILLABLE_SCENARIOS.has(scenario)) {
      const wrong = rejected.filter((item) => rejectionCode(item) !== expectedCode);
      if (
        rejected.length !== REQUESTS_PER_ORDER ||
        fulfilled.length > 0 ||
        wrong.length > 0
      ) {
        findings.push({
          code: 'INVALID_ORDER_NOT_BLOCKED',
          detail:
            `${orderId} (${scenario}) debía rechazar las ${REQUESTS_PER_ORDER} ` +
            `solicitudes con ${expectedCode}.`,
        });
      }
      continue;
    }

    if (
      rejected.length !== 1 ||
      rejectionCode(rejected[0]) !== expectedCode ||
      fulfilled.length !== REQUESTS_PER_ORDER - 1
    ) {
      findings.push({
        code: 'CONTROLLED_FAILURE_RESULT',
        detail:
          `${orderId} (${scenario}) produjo ${rejected.length} rechazos; ` +
          `se esperaba uno con ${expectedCode}.`,
      });
    }
  }

  return findings;
}

function auditRetryRequestResults(records) {
  return records
    .filter((record) => record.result.status === 'rejected')
    .map((record) => ({
      code: 'RETRY_REQUEST_REJECTED',
      detail:
        `${record.orderId} (${record.scenario}) rechazó un reintento con ` +
        `${rejectionCode(record) || record.result.reason?.message}.`,
    }));
}

function duplicateValues(documents, getter) {
  const occurrences = new Map();
  for (const document of documents) {
    const value = String(getter(document) || '').trim();
    if (!value) continue;
    const ids = occurrences.get(value) || [];
    ids.push(String(document._id));
    occurrences.set(value, ids);
  }
  return [...occurrences.entries()].filter(([, ids]) => ids.length > 1);
}

function findSensitivePath(value, currentPath = 'root', seen = new WeakSet()) {
  if (!value || typeof value !== 'object') return null;
  if (seen.has(value)) return null;
  seen.add(value);

  for (const [key, item] of Object.entries(value)) {
    const nextPath = `${currentPath}.${key}`;
    if (SENSITIVE_KEY.test(String(key).replace(/[^a-z0-9]/gi, ''))) {
      return nextPath;
    }
    if (
      typeof item === 'string' &&
      /stress-(token|client-secret)-must-not-persist/i.test(item)
    ) {
      return nextPath;
    }
    const nested = findSensitivePath(item, nextPath, seen);
    if (nested) return nested;
  }
  return null;
}

async function auditDatabaseIntegrity({
  ElectronicInvoice,
  Order,
  metrics,
  scenarioByOrderId,
  stage,
}) {
  const findings = [];
  const [orders, invoices] = await Promise.all([
    Order.find().lean(),
    ElectronicInvoice.find().lean(),
  ]);
  const invoicesByOrder = new Map();

  for (const invoice of invoices) {
    const key = String(invoice.orderId);
    const current = invoicesByOrder.get(key) || [];
    current.push(invoice);
    invoicesByOrder.set(key, current);
  }

  if (orders.length !== ORDER_COUNT) {
    findings.push({
      code: 'ORDER_COUNT',
      detail: `MongoDB contiene ${orders.length} órdenes; se esperaban ${ORDER_COUNT}.`,
    });
  }

  const expectedInvoiceCount = SCENARIOS.filter((item) => item.billable).reduce(
    (sum, item) => sum + item.count,
    0
  );
  if (invoices.length !== expectedInvoiceCount) {
    findings.push({
      code: 'INVOICE_COUNT',
      detail:
        `MongoDB contiene ${invoices.length} facturas; ` +
        `se esperaban ${expectedInvoiceCount}.`,
    });
  }

  for (const order of orders) {
    const orderId = String(order._id);
    const scenario = scenarioByOrderId.get(orderId);
    const rows = invoicesByOrder.get(orderId) || [];
    const shouldHaveInvoice = BILLABLE_SCENARIOS.has(scenario);

    if (rows.length !== (shouldHaveInvoice ? 1 : 0)) {
      findings.push({
        code: 'INVOICE_PER_ORDER',
        detail:
          `${order.orderNumber} (${scenario}) tiene ${rows.length} facturas; ` +
          `se esperaba ${shouldHaveInvoice ? 1 : 0}.`,
      });
      continue;
    }
    if (!shouldHaveInvoice) continue;

    const invoice = rows[0];
    const wantedStatus = expectedStatus(scenario, stage);
    const wantedAttempts = expectedAttempts(scenario, stage);
    const providerCalls = Number(metrics.providerCallsByOrder.get(orderId) || 0);
    const wantedProviderCalls = expectedProviderCalls(scenario, stage);

    if (invoice.status !== wantedStatus) {
      findings.push({
        code: 'INVOICE_STATUS',
        detail:
          `${order.orderNumber} (${scenario}) está en ${invoice.status}; ` +
          `se esperaba ${wantedStatus}.`,
      });
    }
    if (Number(invoice?.emission?.attempts || 0) !== wantedAttempts) {
      findings.push({
        code: 'EMISSION_ATTEMPTS',
        detail:
          `${order.orderNumber} registra ${invoice?.emission?.attempts || 0} ` +
          `intentos; se esperaban ${wantedAttempts}.`,
      });
    }
    if (providerCalls !== wantedProviderCalls) {
      findings.push({
        code: 'PROVIDER_CALL_COUNT',
        detail:
          `${order.orderNumber} llamó ${providerCalls} veces al proveedor; ` +
          `se esperaban ${wantedProviderCalls}.`,
      });
    }
    if (
      invoice.idempotencyKey !==
      `electronic-invoice:order:${String(order._id)}`
    ) {
      findings.push({
        code: 'IDEMPOTENCY_KEY',
        detail: `${order.orderNumber} no conserva la clave idempotente de su orden.`,
      });
    }

    for (const field of ECONOMIC_FIELDS) {
      const stored = money(invoice?.totals?.[field]);
      const expected = money(order?.pricing?.[field]);
      if (Math.abs(stored - expected) > 0.01) {
        findings.push({
          code:
            field === 'total'
              ? 'TOTALS_TOTAL_MISMATCH'
              : 'ECONOMIC_SNAPSHOT_MISMATCH',
          detail:
            `${order.orderNumber} no concilia ${field}: ` +
            `factura=${stored}, orden=${expected}.`,
        });
      }
    }

    if (invoice.status === 'accepted') {
      if (
        !invoice.invoiceNumber ||
        !invoice.cufe ||
        invoice?.provider?.isValidated !== true ||
        invoice?.emission?.state !== 'completed'
      ) {
        findings.push({
          code: 'ACCEPTED_WITHOUT_OFFICIAL_DATA',
          detail: `${order.orderNumber} figura aceptada sin datos oficiales completos.`,
        });
      }
      if (invoice.errorMessage || Object.keys(invoice.providerErrors || {}).length) {
        findings.push({
          code: 'ACCEPTED_WITH_STALE_ERROR',
          detail: `${order.orderNumber} conserva errores después de quedar aceptada.`,
        });
      }
    }

    if (scenario === 'post_provider_crash' && stage === 'recovered') {
      if (
        !invoice.pdfUrl ||
        !invoice.xmlUrl ||
        invoice?.dianResponse?.stage !== 'provider_reconciled_validated' ||
        invoice?.provider?.raw?.recoveredBy !== 'recovery-worker'
      ) {
        findings.push({
          code: 'RECOVERY_OFFICIAL_DATA_INCOMPLETE',
          detail:
            `${order.orderNumber} fue conciliada sin número, CUFE, PDF, XML ` +
            'o trazabilidad completa del worker.',
        });
      }
    }

    if (invoice.status === 'failed') {
      if (
        invoice?.emission?.state !== 'failed' ||
        !invoice.failedAt ||
        !invoice.errorMessage
      ) {
        findings.push({
          code: 'FAILED_WITHOUT_AUDIT',
          detail: `${order.orderNumber} falló sin trazabilidad completa.`,
        });
      }
    }

    if (
      scenario === 'post_provider_crash' &&
      PRE_RECOVERY_STAGES.has(stage) &&
      (invoice.status !== 'processing' ||
        invoice?.emission?.state !== 'processing' ||
        invoice.invoiceNumber ||
        invoice.cufe)
    ) {
      findings.push({
        code: 'POST_PROVIDER_CRASH_UNSAFE',
        detail:
          `${order.orderNumber} no quedó bloqueada como emisión incierta ` +
          'después del corte de persistencia.',
      });
    }

    const sensitiveProviderPath = findSensitivePath(invoice.provider?.raw);
    const sensitiveDianPath = findSensitivePath(invoice.dianResponse?.raw);
    if (sensitiveProviderPath || sensitiveDianPath) {
      findings.push({
        code: 'SENSITIVE_PROVIDER_DATA',
        detail:
          `${order.orderNumber} persistió un dato sensible en ` +
          `${sensitiveProviderPath || sensitiveDianPath}.`,
      });
    }
  }

  for (const [field, getter, code] of [
    ['idempotencyKey', (item) => item.idempotencyKey, 'DUPLICATE_IDEMPOTENCY_KEY'],
    ['invoiceNumber', (item) => item.invoiceNumber, 'DUPLICATE_INVOICE_NUMBER'],
    ['cufe', (item) => item.cufe, 'DUPLICATE_CUFE'],
    [
      'provider.referenceCode',
      (item) => item?.provider?.referenceCode,
      'DUPLICATE_REFERENCE_CODE',
    ],
  ]) {
    const duplicates = duplicateValues(invoices, getter);
    for (const [value, ids] of duplicates) {
      findings.push({
        code,
        detail: `${field}=${value} aparece en ${ids.length} facturas.`,
      });
    }
  }

  const expectedProviderTotal =
    stage === 'initial'
      ? 400
      : 400 +
        SCENARIOS.filter((item) =>
          RETRYABLE_PROVIDER_SCENARIOS.has(item.key)
        ).reduce((sum, item) => sum + item.count, 0);
  if (metrics.providerCalls !== expectedProviderTotal) {
    findings.push({
      code: 'PROVIDER_TOTAL_CALLS',
      detail:
        `El proveedor recibió ${metrics.providerCalls} llamadas; ` +
        `se esperaban ${expectedProviderTotal}.`,
    });
  }

  return {
    findings,
    invoices,
    orders,
    summary: {
      orders: orders.length,
      invoices: invoices.length,
      accepted: invoices.filter((item) => item.status === 'accepted').length,
      failed: invoices.filter((item) => item.status === 'failed').length,
      processing: invoices.filter((item) => item.status === 'processing').length,
      providerCalls: metrics.providerCalls,
    },
  };
}

function assertNoFindings(title, findings) {
  if (!findings.length) return;
  const preview = findings
    .slice(0, 20)
    .map((item, index) => `${index + 1}. [${item.code}] ${item.detail}`)
    .join('\n');
  throw new Error(
    `${title}: se detectaron ${findings.length} inconsistencias.\n${preview}`
  );
}

async function verifyMongoUniqueConstraint(ElectronicInvoice) {
  const indexes = await ElectronicInvoice.collection.indexes();
  const uniqueIndex = indexes.find(
    (item) =>
      item.name === 'uniq_electronic_invoice_idempotency_key' &&
      item.unique === true
  );
  assert(
    uniqueIndex,
    'MongoDB no creó el índice único real de idempotencia.',
    'BILLING_STRESS_UNIQUE_INDEX_MISSING'
  );

  const template = await ElectronicInvoice.findOne().lean();
  assert(template, 'No existe una factura para probar el índice único.');
  const probeId = new mongoose.Types.ObjectId();
  let duplicateBlocked = false;

  try {
    await ElectronicInvoice.collection.insertOne({
      _id: probeId,
      orderId: new mongoose.Types.ObjectId(),
      orderNumber: 'STRESS-DUPLICATE-PROBE',
      idempotencyKey: template.idempotencyKey,
      status: 'processing',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  } catch (error) {
    duplicateBlocked = String(error?.code || '') === '11000';
  } finally {
    await ElectronicInvoice.collection.deleteOne({ _id: probeId });
  }

  assert(
    duplicateBlocked,
    'MongoDB permitió insertar una clave idempotente duplicada.',
    'BILLING_STRESS_UNIQUE_INDEX_BYPASSED'
  );
}

async function auditRecoveryTasks({
  BillingInvoiceRecoveryTask,
  ElectronicInvoice,
  metrics,
  providerCallsBeforeRecovery,
}) {
  const findings = [];
  const [tasks, recoveredInvoices] = await Promise.all([
    BillingInvoiceRecoveryTask.find().sort({ createdAt: 1 }).lean(),
    ElectronicInvoice.find({
      'provider.raw.recoveredBy': 'recovery-worker',
    }).lean(),
  ]);

  if (tasks.length !== 10) {
    findings.push({
      code: 'RECOVERY_TASK_COUNT',
      detail: `MongoDB contiene ${tasks.length} tareas de conciliación; se esperaban 10.`,
    });
  }
  if (recoveredInvoices.length !== 10) {
    findings.push({
      code: 'RECOVERED_INVOICE_COUNT',
      detail:
        `MongoDB contiene ${recoveredInvoices.length} facturas recuperadas; ` +
        'se esperaban 10.',
    });
  }
  if (metrics.providerCalls !== providerCallsBeforeRecovery) {
    findings.push({
      code: 'RECOVERY_REISSUED_INVOICE',
      detail:
        `La conciliación aumentó las emisiones de ${providerCallsBeforeRecovery} ` +
        `a ${metrics.providerCalls}.`,
    });
  }
  if (metrics.recoveryLookupCalls !== 10) {
    findings.push({
      code: 'RECOVERY_LOOKUP_COUNT',
      detail:
        `La conciliación consultó ${metrics.recoveryLookupCalls} referencias; ` +
        'se esperaban exactamente 10.',
    });
  }

  const invoicesById = new Map(
    recoveredInvoices.map((invoice) => [String(invoice._id), invoice])
  );
  for (const task of tasks) {
    const invoice = invoicesById.get(String(task.invoiceId));
    const referenceCode = String(task.referenceCode || '');
    const lookupCalls = Number(
      metrics.recoveryLookupCallsByReference.get(referenceCode) || 0
    );

    if (
      task.status !== 'resolved' ||
      Number(task.attempts || 0) !== 1 ||
      !task.resolvedAt ||
      !task.providerNumber ||
      !task.providerCufe
    ) {
      findings.push({
        code: 'RECOVERY_TASK_NOT_RESOLVED',
        detail:
          `${referenceCode || task._id} no terminó resuelta en un solo intento ` +
          'con número y CUFE oficiales.',
      });
    }
    if (lookupCalls !== 1) {
      findings.push({
        code: 'RECOVERY_REFERENCE_LOOKUP_REPEATED',
        detail:
          `${referenceCode || task._id} fue consultada ${lookupCalls} veces; ` +
          'se esperaba una sola consulta exacta.',
      });
    }
    if (
      !invoice ||
      invoice.status !== 'accepted' ||
      invoice.invoiceNumber !== task.providerNumber ||
      invoice.cufe !== task.providerCufe ||
      !invoice.pdfUrl ||
      !invoice.xmlUrl
    ) {
      findings.push({
        code: 'RECOVERY_TASK_INVOICE_MISMATCH',
        detail:
          `${referenceCode || task._id} no coincide con una factura aceptada ` +
          'que conserve número, CUFE, PDF y XML.',
      });
    }
  }

  return {
    findings,
    summary: {
      tasks: tasks.length,
      resolved: tasks.filter((task) => task.status === 'resolved').length,
      recoveredInvoices: recoveredInvoices.length,
      lookups: metrics.recoveryLookupCalls,
      reissued: metrics.providerCalls - providerCallsBeforeRecovery,
    },
  };
}

async function proveAuditorDetectsCorruption({
  ElectronicInvoice,
  audit,
}) {
  const accepted = await ElectronicInvoice.find({ status: 'accepted' })
    .sort({ createdAt: 1 })
    .limit(2)
    .lean();
  assert(
    accepted.length === 2,
    'No hay dos facturas aceptadas para ejecutar la corrupción controlada.'
  );

  const source = accepted[0];
  const victim = accepted[1];
  const original = {
    cufe: victim.cufe,
    total: victim?.totals?.total,
  };

  try {
    await ElectronicInvoice.collection.updateOne(
      { _id: victim._id },
      {
        $set: {
          cufe: source.cufe,
          'totals.total': money(original.total + 777),
        },
      }
    );

    const corruptedAudit = await audit();
    const codes = new Set(corruptedAudit.findings.map((item) => item.code));
    assert(
      codes.has('DUPLICATE_CUFE'),
      'El auditor no detectó el CUFE duplicado inyectado.',
      'BILLING_STRESS_AUDITOR_MISSED_DUPLICATE_CUFE'
    );
    assert(
      codes.has('TOTALS_TOTAL_MISMATCH'),
      'El auditor no detectó el total alterado inyectado.',
      'BILLING_STRESS_AUDITOR_MISSED_TAMPERED_TOTAL'
    );

    return corruptedAudit.findings;
  } finally {
    await ElectronicInvoice.collection.updateOne(
      { _id: victim._id },
      {
        $set: {
          cufe: original.cufe,
          'totals.total': original.total,
        },
      }
    );
  }
}

function printStageSummary(title, audit) {
  console.log(`\n${title}`);
  console.log(`  Órdenes: ${audit.summary.orders}`);
  console.log(`  Facturas: ${audit.summary.invoices}`);
  console.log(`  Aceptadas: ${audit.summary.accepted}`);
  console.log(`  Fallidas: ${audit.summary.failed}`);
  console.log(`  Bloqueadas por resultado incierto: ${audit.summary.processing}`);
  console.log(`  Llamadas al proveedor simulado: ${audit.summary.providerCalls}`);
  console.log(`  Inconsistencias: ${audit.findings.length}`);
}

async function runStressTest() {
  const plan = validatePlan();
  const mongo = resolveMongoConfiguration();
  const metrics = {
    providerCalls: 0,
    providerCallsByOrder: new Map(),
    recoveryLookupCalls: 0,
    recoveryLookupCallsByReference: new Map(),
    emailCalls: 0,
    emailFailures: 0,
    crashedInvoiceIds: new Set(),
  };
  const remoteDocumentsByReference = new Map();
  let connection = null;
  let primaryError = null;
  let cleanupError = null;
  let completedSuccessfully = false;
  const memoryBefore = process.memoryUsage().heapUsed;
  const testStartedAt = Date.now();

  console.log('\nPRUEBA DE CHOQUE E INTEGRIDAD — FACTURACIÓN');
  console.log('No contacta Factus, no envía correos y no usa la base normal.');
  console.log(`Base temporal: ${mongo.databaseName}`);
  console.log(`Variable de conexión: ${mongo.source}`);
  console.log(`Plan: ${plan.declaredOrders} órdenes, ${plan.initialRequests} solicitudes simultáneas.`);

  try {
    connection = await mongoose
      .createConnection(mongo.uri, {
        dbName: mongo.databaseName,
        serverSelectionTimeoutMS: 20_000,
        socketTimeoutMS: 120_000,
        maxPoolSize: 100,
        minPoolSize: 5,
        autoIndex: true,
      })
      .asPromise();

    assert(
      connection.name === mongo.databaseName,
      `MongoDB abrió ${connection.name} en lugar de ${mongo.databaseName}.`,
      'BILLING_STRESS_DATABASE_ISOLATION_FAILED'
    );

    const models = compileIsolatedModels(connection);
    await Promise.all([
      models.Order.init(),
      models.ElectronicInvoice.init(),
      models.SiteSettings.init(),
      models.BillingInvoiceRecoveryTask.init(),
    ]);
    await models.SiteSettings.create(buildBillingSettings());

    const payloads = Array.from({ length: ORDER_COUNT }, (_, index) =>
      buildOrderPayload(index, scenarioForIndex(index))
    );
    const orders = await models.Order.insertMany(payloads, {
      ordered: true,
      rawResult: false,
    });
    const scenarioByOrderId = new Map(
      orders.map((order, index) => [
        String(order._id),
        scenarioForIndex(index),
      ])
    );

    const provider = createProviderSimulator({
      scenarioByOrderId,
      metrics,
      remoteDocumentsByReference,
    });
    const invoiceModel = createCrashAwareInvoiceModel({
      ElectronicInvoice: models.ElectronicInvoice,
      scenarioByOrderId,
      metrics,
    });
    const email = createEmailSimulator({
      ElectronicInvoice: models.ElectronicInvoice,
      metrics,
    });
    const service = createElectronicInvoiceIssuanceService({
      ElectronicInvoice: invoiceModel,
      Order: models.Order,
      SiteSettings: models.SiteSettings,
      sendElectronicInvoiceToProvider: provider,
      sendValidatedInvoiceEmail: email,
      assertProductionActivation: async () => true,
    });

    console.log('\nETAPA 1 — choque inicial');
    const initialTasks = buildInitialTasks(orders, scenarioByOrderId);
    const initialExecution = await executeConcurrentTasks(
      initialTasks,
      service.issueElectronicInvoiceForOrder
    );
    assert(
      initialExecution.records.length === INITIAL_REQUEST_COUNT,
      'No se ejecutaron las 4.000 solicitudes iniciales.'
    );
    assertNoFindings(
      'Resultados de solicitudes iniciales',
      auditInitialRequestResults(initialExecution.records)
    );
    assert(
      initialExecution.durationMs <= MAX_INITIAL_DURATION_MS,
      `El choque inicial tardó ${initialExecution.durationMs} ms; ` +
        `el límite es ${MAX_INITIAL_DURATION_MS} ms.`,
      'BILLING_STRESS_PERFORMANCE_LIMIT'
    );

    const initialAudit = await auditDatabaseIntegrity({
      ...models,
      metrics,
      scenarioByOrderId,
      stage: 'initial',
    });
    printStageSummary('AUDITORÍA DESPUÉS DEL CHOQUE INICIAL', initialAudit);
    assertNoFindings('Auditoría inicial', initialAudit.findings);

    console.log('\nETAPA 2 — reintentos simultáneos y repetición de cortes inciertos');
    const retryTasks = buildRetryTasks(orders, scenarioByOrderId);
    assert(
      retryTasks.length === plan.retryRequests,
      `Se generaron ${retryTasks.length} reintentos; se esperaban ${plan.retryRequests}.`
    );
    const retryExecution = await executeConcurrentTasks(
      retryTasks,
      service.issueElectronicInvoiceForOrder
    );
    assertNoFindings(
      'Resultados de reintentos',
      auditRetryRequestResults(retryExecution.records)
    );

    const finalAudit = await auditDatabaseIntegrity({
      ...models,
      metrics,
      scenarioByOrderId,
      stage: 'final',
    });
    printStageSummary('AUDITORÍA DESPUÉS DE LOS REINTENTOS', finalAudit);
    assertNoFindings('Auditoría posterior a reintentos', finalAudit.findings);
    assert(
      metrics.crashedInvoiceIds.size === 10,
      `Se simularon ${metrics.crashedInvoiceIds.size} cortes; se esperaban 10.`
    );
    assert(
      metrics.emailCalls === 390,
      `Se intentaron ${metrics.emailCalls} correos; se esperaban 390.`
    );
    assert(
      metrics.emailFailures === 30,
      `Se simularon ${metrics.emailFailures} fallos de correo; se esperaban 30.`
    );
    await verifyMongoUniqueConstraint(models.ElectronicInvoice);

    console.log('\nETAPA 3 — conciliación de resultados inciertos sin reemisión');
    const providerCallsBeforeRecovery = metrics.providerCalls;
    const recoveryNow = new Date(Date.now() + INVOICE_LOCK_MS + 1_000);
    const recoveryService = createBillingInvoiceRecoveryService({
      ElectronicInvoice: models.ElectronicInvoice,
      BillingInvoiceRecoveryTask: models.BillingInvoiceRecoveryTask,
      SiteSettings: models.SiteSettings,
      findInvoiceByReferenceFromFactus: createRecoveryLookupSimulator({
        metrics,
        remoteDocumentsByReference,
      }),
      getInvoiceFromFactus: createRecoveryDetailSimulator({
        remoteDocumentsByReference,
      }),
      now: () => new Date(recoveryNow),
    });

    const scheduled = await recoveryService.scanStaleProcessingInvoices({
      limit: 25,
    });
    assert(
      scheduled.scanned === 10 && scheduled.scheduled === 10,
      `El scanner encontró ${scheduled.scanned} y programó ${scheduled.scheduled}; ` +
        'se esperaban exactamente 10 documentos inciertos.',
      'BILLING_STRESS_RECOVERY_SCHEDULING_FAILED'
    );

    const recoverySummary =
      await recoveryService.processPendingInvoiceRecoveries({ limit: 10 });
    assert(
      recoverySummary.processed === 10 &&
        recoverySummary.resolved === 10 &&
        recoverySummary.pending === 0 &&
        recoverySummary.failed === 0,
      `El worker produjo ${JSON.stringify(recoverySummary)}; ` +
        'se esperaban 10 conciliaciones resueltas.',
      'BILLING_STRESS_RECOVERY_WORKER_FAILED'
    );

    const drainedRecoverySummary =
      await recoveryService.processPendingInvoiceRecoveries({ limit: 10 });
    assert(
      drainedRecoverySummary.processed === 0,
      `El worker volvió a procesar ${drainedRecoverySummary.processed} tareas ya resueltas.`,
      'BILLING_STRESS_RECOVERY_REPLAYED_RESOLVED_TASK'
    );

    const recoveredAudit = await auditDatabaseIntegrity({
      ...models,
      metrics,
      scenarioByOrderId,
      stage: 'recovered',
    });
    printStageSummary('AUDITORÍA DESPUÉS DE LA CONCILIACIÓN', recoveredAudit);
    assertNoFindings('Auditoría posterior a conciliación', recoveredAudit.findings);

    const recoveryAudit = await auditRecoveryTasks({
      ...models,
      metrics,
      providerCallsBeforeRecovery,
    });
    assertNoFindings(
      'Auditoría de tareas de conciliación',
      recoveryAudit.findings
    );
    console.log(`  Tareas resueltas: ${recoveryAudit.summary.resolved}`);
    console.log(`  Facturas recuperadas: ${recoveryAudit.summary.recoveredInvoices}`);
    console.log(`  Consultas exactas al simulador: ${recoveryAudit.summary.lookups}`);
    console.log(`  Facturas reemitidas: ${recoveryAudit.summary.reissued}`);

    console.log('\nETAPA 4 — autoprueba del auditor con corrupción controlada');
    const corruptionFindings = await proveAuditorDetectsCorruption({
      ElectronicInvoice: models.ElectronicInvoice,
      audit: () =>
        auditDatabaseIntegrity({
          ...models,
          metrics,
          scenarioByOrderId,
          stage: 'recovered',
        }),
    });
    console.log(
      `  Corrupción detectada correctamente: ${corruptionFindings.length} hallazgos.`
    );
    console.log('  Señales obligatorias detectadas: CUFE duplicado y total alterado.');

    const restoredAudit = await auditDatabaseIntegrity({
      ...models,
      metrics,
      scenarioByOrderId,
      stage: 'recovered',
    });
    assertNoFindings(
      'Auditoría después de restaurar la corrupción',
      restoredAudit.findings
    );

    const totalDurationMs = Date.now() - testStartedAt;
    const memoryAfter = process.memoryUsage().heapUsed;
    const throughput = Math.round(
      INITIAL_REQUEST_COUNT / Math.max(initialExecution.durationMs / 1000, 0.001)
    );

    console.log('\nMÉTRICAS');
    console.log(`  Solicitudes ejecutadas: ${plan.totalRequests}`);
    console.log(`  Choque inicial: ${initialExecution.durationMs} ms`);
    console.log(`  Reintentos: ${retryExecution.durationMs} ms`);
    console.log(`  Duración total: ${totalDurationMs} ms`);
    console.log(`  Rendimiento inicial: ${throughput} solicitudes/segundo`);
    console.log(
      `  Variación de heap: ${Math.round((memoryAfter - memoryBefore) / 1024 / 1024)} MB`
    );
    console.log(`  Fallos SMTP simulados y aislados: ${metrics.emailFailures}`);
    console.log(`  Cortes posproveedor bloqueados: ${metrics.crashedInvoiceIds.size}`);
    console.log(`  Documentos inciertos recuperados: ${metrics.recoveryLookupCalls}`);
    console.log('  Reemisiones durante conciliación: 0');
    completedSuccessfully = true;
  } catch (error) {
    primaryError = error;
    console.error('\nDICTAMEN: RECHAZADO');
    console.error(`[${error.code || 'ERROR'}] ${error.message}`);
  } finally {
    if (connection) {
      try {
        assert(
          connection.name.startsWith(DATABASE_PREFIX),
          `Se bloqueó la limpieza de una base no temporal: ${connection.name}.`,
          'BILLING_STRESS_CLEANUP_UNSAFE'
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
  }

  if (primaryError) throw primaryError;
  if (cleanupError) {
    console.error('\nDICTAMEN: RECHAZADO');
    throw cleanupError;
  }
  assert(completedSuccessfully, 'La prueba terminó sin producir un dictamen.');
  console.log('\nDICTAMEN: APROBADO');
  console.log(
    'El motor mantuvo idempotencia, integridad económica, recuperación sin reemisión, aislamiento fiscal y detección de corrupción.'
  );
}

async function main() {
  const plan = validatePlan();

  if (VALIDATE_PLAN_ONLY) {
    console.log('\nPLAN DE PRUEBA VALIDADO');
    console.log(JSON.stringify(plan, null, 2));
    return;
  }

  await runStressTest();
}

main().catch((error) => {
  if (!String(error?.message || '').includes('DICTAMEN')) {
    console.error(`\nEjecución terminada con error: ${error.message}`);
  }
  process.exitCode = 1;
});
