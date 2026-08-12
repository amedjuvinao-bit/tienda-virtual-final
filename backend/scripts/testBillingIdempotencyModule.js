/* eslint-disable no-console */
'use strict';

const fs = require('fs');
const path = require('path');
const {
  readFactusProviderSource,
} = require('./lib/readFactusProviderSource');

const {
  createElectronicInvoiceIssuanceService,
} = require('../services/electronicInvoiceIssuanceService');

const PROJECT_ROOT = path.join(__dirname, '..', '..');
const results = { ok: 0, warn: 0, fail: 0 };

function ok(message) {
  results.ok += 1;
  console.log(`OK  ${message}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(relativePath) {
  return fs.readFileSync(path.join(PROJECT_ROOT, relativePath), 'utf8');
}

function setDotted(target, pathName, value) {
  const parts = String(pathName).split('.');
  let cursor = target;

  parts.forEach((part, index) => {
    if (index === parts.length - 1) {
      cursor[part] = value;
      return;
    }

    if (!cursor[part] || typeof cursor[part] !== 'object') cursor[part] = {};
    cursor = cursor[part];
  });
}

function clone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function createInMemoryModels({ order, settings }) {
  const invoicesByKey = new Map();
  const invoicesById = new Map();
  let sequence = 0;

  function findInvoice(filter = {}) {
    const conditions = Array.isArray(filter.$or) ? filter.$or : [filter];

    for (const condition of conditions) {
      if (condition.idempotencyKey && invoicesByKey.has(String(condition.idempotencyKey))) {
        return invoicesByKey.get(String(condition.idempotencyKey));
      }

      if (condition.orderId) {
        const found = [...invoicesById.values()].find(
          (invoice) => String(invoice.orderId) === String(condition.orderId)
        );
        if (found) return found;
      }
    }

    return null;
  }

  const ElectronicInvoice = {
    async findOne(filter) {
      return clone(findInvoice(filter));
    },

    async create(payload) {
      const key = String(payload.idempotencyKey || '');
      if (invoicesByKey.has(key)) {
        const error = new Error('duplicate key');
        error.code = 11000;
        throw error;
      }

      sequence += 1;
      const stored = {
        ...clone(payload),
        _id: `invoice-${sequence}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      invoicesByKey.set(key, stored);
      invoicesById.set(stored._id, stored);

      return {
        ...clone(stored),
        toObject: () => clone(stored),
      };
    },

    async findOneAndUpdate(filter, update) {
      const stored = invoicesById.get(String(filter._id || ''));
      if (!stored) return null;
      if (filter.status?.$in && !filter.status.$in.includes(stored.status)) return null;
      if (
        filter['emission.lockToken'] &&
        stored?.emission?.lockToken !== filter['emission.lockToken']
      ) {
        return null;
      }
      if (
        filter['emission.state']?.$ne &&
        stored?.emission?.state === filter['emission.state'].$ne
      ) {
        return null;
      }

      Object.entries(update?.$set || {}).forEach(([key, value]) => {
        setDotted(stored, key, clone(value));
      });
      stored.updatedAt = new Date().toISOString();
      return clone(stored);
    },
  };

  return {
    ElectronicInvoice,
    Order: {
      async findById(orderId) {
        return String(orderId) === String(order._id) ? clone(order) : null;
      },
    },
    SiteSettings: {
      async findOne() {
        return clone(settings);
      },
      async updateOne() {
        return { acknowledged: true };
      },
    },
    count: () => invoicesById.size,
  };
}

async function validateControlledRetry() {
  const orderId = '64b000000000000000000002';
  const order = {
    _id: orderId,
    orderNumber: '000301',
    status: 'paid',
    subtotal: 50000,
    total: 50000,
    customer: { documentNumber: '987654321', email: 'retry@example.com' },
    payment: {
      status: 'paid',
      provider: 'payu',
      paidAt: new Date('2026-07-27T12:00:00.000Z'),
    },
    items: [{ name: 'Producto retry', quantity: 1, price: 50000 }],
  };
  const settings = {
    _id: '64b000000000000000000098',
    billing: {
      fiscalInfo: { nit: '900000000' },
      dian: { enabled: true, mode: 'test', environment: '2' },
      dianResolution: { prefix: 'SETP', currentNumber: 2, environment: '2' },
      electronicProvider: { provider: 'factus' },
    },
  };
  const models = createInMemoryModels({ order, settings });
  let providerCalls = 0;
  let shouldFail = true;

  const service = createElectronicInvoiceIssuanceService({
    ...models,
    isValidObjectId: () => true,
    randomUUID: () => `retry-lock-${providerCalls + 1}`,
    generateCUFE: () => ({ cufe: 'retry-local-cufe' }),
    generateInvoiceXML: () => '<Invoice />',
    sendElectronicInvoiceToProvider: async () => {
      providerCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 15));

      if (shouldFail) {
        return { success: false, status: 422, error: 'Rechazo simulado' };
      }

      return {
        success: true,
        status: 201,
        data: {
          data: {
            number: 'SETP990100000',
            cufe: 'retry-official-cufe',
            is_validated: true,
          },
        },
      };
    },
  });

  let initialError = null;
  try {
    await service.issueElectronicInvoiceForOrder({ orderId, source: 'payu' });
  } catch (error) {
    initialError = error;
  }

  assert(initialError?.code === 'BILLING_PROVIDER_GENERATION_ERROR', 'El fallo inicial debe quedar controlado.');
  assert(initialError?.invoice?.status === 'failed', 'El intento fallido debe persistirse antes de responder.');

  shouldFail = false;
  const retries = await Promise.all([
    service.issueElectronicInvoiceForOrder({ orderId, source: 'admin-retry', allowRetry: true }),
    service.issueElectronicInvoiceForOrder({ orderId, source: 'admin-retry', allowRetry: true }),
  ]);

  assert(providerCalls === 2, 'Dos reintentos simultáneos solo deben producir una segunda llamada al proveedor.');
  assert(retries.filter((item) => item.retried).length === 1, 'Solo un proceso debe adquirir el reintento.');
  const successfulRetry = retries.find((item) => item.retried);
  assert(successfulRetry?.invoice?.status === 'accepted', 'El reintento exitoso debe finalizar en accepted.');
  assert(successfulRetry?.invoice?.emission?.attempts === 2, 'La auditoría debe registrar dos intentos.');
  ok('Los reintentos fallidos también quedan bloqueados contra concurrencia');
}

async function validateConcurrentIssuance() {
  const orderId = '64b000000000000000000001';
  const order = {
    _id: orderId,
    orderNumber: '000300',
    status: 'paid',
    subtotal: 100000,
    shipping: 0,
    total: 119000,
    taxes: { iva: { enabled: true, percent: 19, amount: 19000 } },
    customer: {
      name: 'Cliente',
      lastname: 'Prueba',
      documentNumber: '123456789',
      email: 'cliente@example.com',
    },
    payment: {
      status: 'paid',
      provider: 'wompi',
      paidAt: new Date('2026-07-27T12:00:00.000Z'),
      transactionId: 'WOMPI-TX-000300',
      reference: 'ORDER-000300',
    },
    items: [{ name: 'Producto', quantity: 1, price: 100000 }],
  };
  const settings = {
    _id: '64b000000000000000000099',
    billing: {
      fiscalInfo: { nit: '900000000' },
      dian: { enabled: true, mode: 'test', environment: '2' },
      dianResolution: {
        prefix: 'SETP',
        currentNumber: 1,
        rangeFrom: 1,
        rangeTo: 999999,
        environment: '2',
        technicalKey: 'test-key',
      },
      electronicProvider: { provider: 'factus' },
    },
  };
  const models = createInMemoryModels({ order, settings });
  let providerCalls = 0;

  const service = createElectronicInvoiceIssuanceService({
    ...models,
    isValidObjectId: () => true,
    randomUUID: () => 'lock-token-test',
    now: () => new Date('2026-07-21T15:00:00.000Z'),
    generateCUFE: () => ({ cufe: 'local-cufe', qrUrl: 'local-qr' }),
    generateInvoiceXML: () => '<Invoice />',
    sendElectronicInvoiceToProvider: async () => {
      providerCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return {
        success: true,
        status: 201,
        data: {
          data: {
            number: 'SETP990099999',
            cufe: 'official-cufe',
            is_validated: true,
            validated_at: '2026-07-21T15:00:01Z',
            reference_code: '000300',
            links: { pdf_url: 'https://example.com/invoice.pdf' },
          },
        },
      };
    },
  });

  const [first, second] = await Promise.all([
    service.issueElectronicInvoiceForOrder({ orderId, source: 'wompi' }),
    service.issueElectronicInvoiceForOrder({ orderId, source: 'admin' }),
  ]);

  assert(providerCalls === 1, `El proveedor fue llamado ${providerCalls} veces; debía llamarse una sola vez.`);
  assert(models.count() === 1, `Se guardaron ${models.count()} facturas; debía existir una sola.`);
  assert([first, second].filter((item) => item.created).length === 1, 'Solo una solicitud debe crear la emisión.');
  assert([first, second].filter((item) => item.reused).length === 1, 'La otra solicitud debe reutilizar la reserva.');
  ok('Dos solicitudes simultáneas llaman al proveedor una sola vez');

  const repeated = await service.issueElectronicInvoiceForOrder({ orderId, source: 'payu' });
  assert(repeated.reused === true, 'Una repetición posterior debe reutilizar la factura existente.');
  assert(providerCalls === 1, 'La repetición posterior no debe volver a llamar al proveedor.');
  assert(repeated.invoice.invoiceNumber === 'SETP990099999', 'Debe recuperarse el número oficial guardado.');
  ok('Reintentos de Wompi, PayU, POS o administración reutilizan el mismo documento');

  const completed = first.created ? first.invoice : repeated.invoice;
  assert(completed.status === 'accepted', 'La respuesta validada debe guardarse como accepted.');
  assert(completed.emission.state === 'completed', 'La reserva debe finalizar en completed.');
  assert(completed.cufe === 'official-cufe', 'Debe conservarse el CUFE oficial del proveedor.');
  ok('El documento único conserva estado, número y CUFE oficiales');
}

function validateDatabaseConstraint() {
  const model = read('backend/models/ElectronicInvoice.js');
  assert(model.includes('uniq_electronic_invoice_idempotency_key'), 'Falta el índice único de idempotencia.');
  assert(model.includes("partialFilterExpression: { idempotencyKey: { $type: 'string' } }"), 'El índice debe ser compatible con documentos históricos.');
  assert(model.includes("'processing'"), 'El modelo debe representar una emisión en proceso.');
  assert(model.includes('InvoiceEmissionSchema'), 'Falta la trazabilidad de emisión.');
  ok('MongoDB impone una clave única compatible con facturas históricas');
}

function validateUnifiedEntryPoints() {
  const admin = read('backend/services/adminBillingService.js');
  const afterPayment = read('backend/services/electronicInvoiceAfterPaymentService.js');
  const wompi = read('backend/routes/payments.js');
  const payu = read('backend/routes/payuProductionWebhook.js');
  const adminPos = read('backend/services/adminPosService.js');
  const cashPos = read('backend/services/posCashSaleService.js');
  const posReceipt = read('backend/services/posReceiptService.js');

  assert(admin.includes('issueElectronicInvoiceForOrder'), 'Administración no usa el motor único.');
  assert(afterPayment.includes('issueElectronicInvoiceForOrder'), 'Pagos no usan el motor único.');
  assert(wompi.includes('allowRetry: true'), 'El reintento administrativo no usa el motor único.');
  assert(!wompi.includes('async function generateElectronicInvoiceAfterPayment'), 'Wompi conserva un generador duplicado.');
  assert(wompi.includes("paymentProvider: 'wompi'"), 'Wompi no identifica el origen.');
  assert(payu.includes("paymentProvider: 'payu'"), 'PayU no identifica el origen.');
  assert(adminPos.includes("paymentProvider: 'pos'"), 'POS administrativo no identifica el origen.');
  assert(cashPos.includes("paymentProvider: 'pos'"), 'POS con caja no identifica el origen.');
  assert(posReceipt.includes('electronicInvoiceAfterPaymentService'), 'El comprobante POS no usa el motor único.');
  ok('Administración, Wompi, PayU y POS comparten el mismo motor');
}

function validateFailureLifecycle() {
  const service = read('backend/services/electronicInvoiceIssuanceService.js');
  const factusProvider = readFactusProviderSource();
  assert(service.includes("status: 'failed'"), 'Los errores del proveedor deben quedar en failed.');
  assert(service.includes("'emission.state': 'failed'"), 'La reserva debe registrar que el intento falló.');
  assert(service.includes('providerErrors'), 'Deben conservarse los errores estructurados del proveedor.');
  assert(!service.includes("status: 'provider_error'"), 'No debe usarse el estado inválido provider_error.');
  assert(
    factusProvider.includes('referenceCode === expectedReferenceCode'),
    'Factus solo debe eliminar la factura pendiente de la misma orden.'
  );
  assert(
    factusProvider.includes('No se eliminó ningún otro documento.'),
    'Debe bloquearse la eliminación cuando no coincide la referencia.'
  );
  ok('Los errores quedan auditables sin presentar la factura como emitida');
}

async function main() {
  console.log('\nValidando motor único e idempotencia de Facturación...');

  try {
    await validateConcurrentIssuance();
    await validateControlledRetry();
    validateDatabaseConstraint();
    validateUnifiedEntryPoints();
    validateFailureLifecycle();
  } catch (error) {
    results.fail += 1;
    console.error(`FAIL ${error.message}`);
  }

  console.log(`\nResumen idempotencia Facturación -> OK: ${results.ok} WARN: ${results.warn} FAIL: ${results.fail}`);
  if (results.fail > 0) process.exitCode = 1;
}

main();
