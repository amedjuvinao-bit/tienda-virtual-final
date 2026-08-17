/* eslint-disable no-console */

'use strict';

const assert = require('assert');
const path = require('path');
const { spawnSync } = require('child_process');

require('dotenv').config({
  path: path.resolve(__dirname, '..', '.env'),
  override: false,
  quiet: true,
});

const mongoose = require('mongoose');

const ElectronicInvoice = require('../models/ElectronicInvoice');
const InventoryMovement = require('../models/InventoryMovement');
const Order = require('../models/Order');
const OrderRefund = require('../models/OrderRefund');
const OrderReturn = require('../models/OrderReturn');
const SiteSettings = require('../models/SiteSettings');
const {
  FACTUS_API_URLS,
  buildRuntimeFactusConfig,
} = require('../lib/billing/billingConfigurationSecurity');
const {
  createElectronicInvoiceIssuanceService,
} = require('../services/electronicInvoiceIssuanceService');
const {
  createOfficialCreditNote,
} = require('../services/electronicCreditNoteService');
const {
  downloadOfficialCreditNoteDocument,
} = require('../services/electronicCreditNoteDocumentService');
const {
  downloadOfficialInvoiceDocument,
} = require('../services/electronicInvoiceDocumentService');
const {
  confirmRefundPaymentReversal,
  linkRefundCreditNote,
  refreshOrderRefundReconciliation,
} = require('../services/orderRefundReconciliationService');

const PERSIST_FLAG = '--confirm-persist';
const FACTUS_FLAG = '--confirm-factus-habilitacion';
const RESUME_ORDER_PREFIX = '--resume-order=';
const MONGO_URI = String(process.env.MONGODB_URI || '').trim();
const SEED_SCRIPT = path.resolve(__dirname, 'seedPersistentOrderReturnTrace.js');

function clean(value, max = 220) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function requestedResumeOrder() {
  const argument = process.argv.find((value) => value.startsWith(RESUME_ORDER_PREFIX));
  return clean(argument?.slice(RESUME_ORDER_PREFIX.length), 180);
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function retry(label, action, attempts = 5) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await action();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await wait(attempt * 1000);
    }
  }
  const error = new Error(
    `${label} no se confirmó después de ${attempts} intentos: ${lastError?.message || 'sin detalle'}`
  );
  error.code = lastError?.code || 'FACTUS_PERSISTENT_TRACE_RETRY_FAILED';
  throw error;
}

async function connectMainDatabase() {
  if (mongoose.connection.readyState === 1) return;
  await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 15000 });
}

async function assertFactusHabilitationReady() {
  await connectMainDatabase();
  await mongoose.connection.db.command({ ping: 1 });

  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  assert(
    hello?.setName || String(hello?.msg || '').toLowerCase() === 'isdbgrid',
    'La base principal debe soportar transacciones.'
  );

  const settings = await SiteSettings.findOne().lean();
  assert(settings, 'No existe SiteSettings en la base principal.');
  const billing = settings.billing || {};
  const runtime = buildRuntimeFactusConfig(billing);

  assert.strictEqual(
    billing?.dian?.enabled,
    true,
    'La facturación electrónica no está activa.'
  );
  assert.strictEqual(
    clean(billing?.electronicProvider?.provider, 40).toLowerCase(),
    'factus',
    'Factus no es el proveedor activo.'
  );
  assert.strictEqual(
    runtime.environment,
    'habilitacion',
    'La prueba está bloqueada fuera de Factus habilitación.'
  );
  assert.strictEqual(
    runtime.apiUrl,
    FACTUS_API_URLS.habilitacion,
    'La URL configurada no corresponde al sandbox oficial de Factus.'
  );
  assert.notStrictEqual(
    runtime.apiUrl,
    FACTUS_API_URLS.production,
    'La prueba nunca puede contactar Factus producción.'
  );
  assert(runtime.numberingRangeId > 0, 'Falta seleccionar un rango oficial de facturas.');
  assert(
    runtime.creditNoteNumberingRangeId > 0,
    'Falta seleccionar un rango oficial de notas crédito.'
  );

  console.log(
    `OK 01: Factus habilitación activo · rango factura ${runtime.numberingRangeId} · rango nota crédito ${runtime.creditNoteNumberingRangeId}`
  );
  await mongoose.disconnect();
}

function createPersistentRmaTrace() {
  const child = spawnSync(
    process.execPath,
    [SEED_SCRIPT, PERSIST_FLAG],
    {
      cwd: path.resolve(__dirname, '..'),
      env: process.env,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    }
  );

  if (child.stdout) process.stdout.write(child.stdout);
  if (child.stderr) process.stderr.write(child.stderr);
  assert.strictEqual(
    child.status,
    0,
    `La creación de la traza RMA terminó con código ${child.status}.`
  );

  const orderNumber = child.stdout.match(/Buscar orden en el panel:\s*(\S+)/)?.[1];
  assert(orderNumber, 'La traza RMA no devolvió el número de orden persistente.');
  return orderNumber;
}

async function prepareOrderForFactus(orderNumber) {
  const order = await Order.findOne({ orderNumber });
  assert(order, `No se encontró la orden persistente ${orderNumber}.`);

  const subtotal = Number(order.total || 0);
  assert(subtotal > 0, 'La orden persistente no tiene un total facturable.');

  for (const item of order.items || []) {
    const quantity = Number(item.quantity || item.qty || 0);
    const price = Number(item.price || item.unitPrice || 0);
    const lineTotal = quantity * price;
    item.lineSubtotal = lineTotal;
    item.discountAmount = 0;
    item.taxableBase = lineTotal;
    item.taxRate = 0;
    item.taxAmount = 0;
    item.lineTotal = lineTotal;
  }

  order.pricing = {
    version: 2,
    currency: 'COP',
    subtotal,
    productDiscount: 0,
    subtotalAfterDiscount: subtotal,
    originalShipping: 0,
    shippingDiscount: 0,
    shipping: 0,
    totalDiscount: 0,
    taxableBase: subtotal,
    taxAmount: 0,
    total: subtotal,
  };
  order.taxes = {
    iva: {
      enabled: false,
      percent: 0,
      code: '01',
      name: 'IVA',
      taxableBase: subtotal,
      amount: 0,
    },
  };
  order.billing = {
    isFinalConsumer: true,
    personType: 'natural',
    documentType: 'CC',
    documentNumber: '222222222222',
    firstName: 'Consumidor',
    lastName: 'Final',
    address: 'Dirección de prueba Factus habilitación',
    city: 'Bogotá',
    municipalityCode: '11001',
    department: 'Bogotá D.C.',
    departmentCode: '11',
    phone: '3000000000',
    email: 'factus-habilitacion@example.com',
    country: 'Colombia',
    countryCode: 'CO',
    tributeCode: 'ZZ',
  };
  order.paymentProcessing = {
    provider: 'manual',
    approvedTransactionId: order.payment?.reference || `${orderNumber}-PAY`,
    approvedAt: order.payment?.paidAt || new Date(),
    inventory: {
      status: 'confirmed',
      lastAttemptAt: new Date(),
      confirmedAt: new Date(),
      errorCode: '',
      errorMessage: '',
    },
    invoice: {
      status: 'pending',
      transactionId: order.payment?.reference || `${orderNumber}-PAY`,
    },
  };
  order.tags = Array.from(
    new Set([...(order.tags || []), 'factus-habilitacion', 'credit-note-trace'])
  );
  order.timeline.push({
    type: 'system',
    message: 'Factura y nota crédito reales de Factus habilitación; traza persistente.',
    by: 'factus-rma-trace-script',
    at: new Date(),
  });
  order.markModified('items');
  order.markModified('pricing');
  order.markModified('taxes');
  order.markModified('billing');
  order.markModified('paymentProcessing');
  await order.save();
  return order;
}

async function verifyFactusInvoice(order, invoice, { recovered = false } = {}) {
  assert(invoice, 'No se guardó la factura electrónica.');
  assert.strictEqual(clean(invoice?.provider?.name, 40).toLowerCase(), 'factus');
  assert.strictEqual(invoice?.provider?.isValidated, true, 'Factus no validó la factura.');
  assert(invoice.invoiceNumber && invoice.cufe, 'Faltan número oficial o CUFE de la factura.');

  const [pdf, xml] = await Promise.all([
    retry('PDF oficial de factura', () =>
      downloadOfficialInvoiceDocument({ orderId: order._id, type: 'pdf' })
    ),
    retry('XML oficial de factura', () =>
      downloadOfficialInvoiceDocument({ orderId: order._id, type: 'xml' })
    ),
  ]);
  assert(pdf.byteLength > 1000 && xml.byteLength > 500, 'Los documentos de la factura están vacíos.');
  console.log(
    `OK 02: factura Factus ${invoice.invoiceNumber} ${recovered ? 'recuperada y ' : ''}validada con CUFE, PDF y XML`
  );
  return invoice;
}

async function issueFactusInvoice(order) {
  const service = createElectronicInvoiceIssuanceService();
  const result = await service.issueElectronicInvoiceForOrder({
    orderId: order._id,
    source: 'persistent-rma-factus-trace',
    initiatedBy: 'QA Factus RMA persistente',
    skipWhenElectronicBillingIsInactive: false,
    allowRetry: false,
  });
  assert.strictEqual(result?.inProgress, false, 'La factura quedó en procesamiento.');

  const invoice = await ElectronicInvoice.findOne({ orderId: order._id });
  return verifyFactusInvoice(order, invoice);
}

async function recoverFactusInvoice(order) {
  const invoice = await ElectronicInvoice.findOne({ orderId: order._id });
  assert(invoice, 'La orden indicada no tiene una factura electrónica para recuperar.');
  return verifyFactusInvoice(order, invoice, { recovered: true });
}

async function issueFactusCreditNote({ order, invoice, refund, returnCase }) {
  const idempotencyKey = `RMA_FACTUS_${String(returnCase._id)}`;
  const result = await createOfficialCreditNote(
    invoice._id,
    {
      type: 'total',
      reasonCode: '2',
      reason: `Anulación total por devolución ${returnCase.returnNumber}`,
      idempotencyKey,
    },
    { adminUser: 'QA Factus RMA persistente' }
  );

  const note = result.creditNote;
  assert(note, 'No se guardó la nota crédito.');
  assert.strictEqual(note.status, 'validated', 'Factus no validó la nota crédito.');
  assert(note?.provider?.number, 'La nota crédito no tiene número oficial.');
  assert(note?.provider?.cude || note?.provider?.cufe, 'La nota crédito no tiene CUDE.');

  await linkRefundCreditNote({
    orderId: order._id,
    refundId: refund._id,
    invoice: result.invoice,
    creditNote: note,
    adminLabel: 'QA Factus RMA persistente',
  });

  const [pdf, xml] = await Promise.all([
    retry('PDF oficial de nota crédito', () =>
      downloadOfficialCreditNoteDocument({
        invoiceId: invoice._id,
        noteId: note._id,
        type: 'pdf',
      })
    ),
    retry('XML oficial de nota crédito', () =>
      downloadOfficialCreditNoteDocument({
        invoiceId: invoice._id,
        noteId: note._id,
        type: 'xml',
      })
    ),
  ]);
  assert(pdf.byteLength > 1000 && xml.byteLength > 500, 'Los documentos de la nota están vacíos.');
  console.log(`OK 04: nota crédito Factus ${note.provider.number} validada con CUDE, PDF y XML`);
  return note;
}

async function closeAndVerifyTrace(orderNumber, { resume = false } = {}) {
  await connectMainDatabase();
  const order = resume
    ? await Order.findOne({ orderNumber })
    : await prepareOrderForFactus(orderNumber);
  assert(order, `No se encontró la orden persistente ${orderNumber}.`);
  const [returnCase, refund] = await Promise.all([
    OrderReturn.findOne({ order: order._id }),
    OrderRefund.findOne({ order: order._id }),
  ]);
  assert(returnCase && refund, 'La orden no conserva su RMA y reembolso enlazados.');

  const invoice = resume
    ? await recoverFactusInvoice(order)
    : await issueFactusInvoice(order);
  const pendingRefund = await refreshOrderRefundReconciliation(refund._id);
  assert.strictEqual(
    pendingRefund?.reconciliation?.billing?.state,
    'action_required',
    'La factura validada no exigió nota crédito.'
  );
  console.log('OK 03: conciliación detectó que la factura validada requiere nota crédito');

  const note = await issueFactusCreditNote({ order, invoice, refund, returnCase });
  await confirmRefundPaymentReversal({
    orderId: order._id,
    refundId: refund._id,
    reference: `SIMULATED-${refund.refundNumber}`,
    adminLabel: 'QA Factus RMA persistente',
  });

  const [finalOrder, finalRefund, finalInvoice, movements] = await Promise.all([
    Order.findById(order._id).lean(),
    OrderRefund.findById(refund._id).lean(),
    ElectronicInvoice.findById(invoice._id).lean(),
    InventoryMovement.find({ order: order._id, type: 'return_in', status: 'posted' }).lean(),
  ]);

  assert.strictEqual(finalRefund?.reconciliation?.state, 'completed');
  assert.strictEqual(finalRefund?.reconciliation?.inventory?.state, 'completed');
  assert.strictEqual(finalRefund?.reconciliation?.payment?.state, 'completed');
  assert.strictEqual(finalRefund?.reconciliation?.billing?.state, 'completed');
  assert.strictEqual(finalOrder?.status, 'refunded');
  assert.strictEqual(movements.length, 1, 'El kardex del retorno no es único.');
  assert.strictEqual(finalInvoice.creditNotes.length, 1, 'La nota crédito se duplicó.');
  assert.strictEqual(finalInvoice.creditNotes[0].status, 'validated');
  console.log('OK 05: inventario, dinero, nota crédito y estado reembolsado conciliados');

  console.log('\nTRAZA FACTUS + RMA CONSERVADA EN MONGODB PRINCIPAL');
  console.log(`Buscar orden en el panel: ${order.orderNumber}`);
  console.log(`RMA: ${returnCase.returnNumber}`);
  console.log(`Reembolso: ${refund.refundNumber}`);
  console.log(`Factura Factus: ${invoice.invoiceNumber}`);
  console.log(`Nota crédito Factus: ${note.provider.number}`);
  console.log('Persistencia: CONSERVADA (sin limpieza automática).');
}

async function run() {
  assert(
    process.argv.includes(PERSIST_FLAG),
    `Falta ${PERSIST_FLAG}; la prueba conserva todos sus datos en la base principal.`
  );
  assert(
    process.argv.includes(FACTUS_FLAG),
    `Falta ${FACTUS_FLAG}; la prueba emite documentos reales en Factus habilitación.`
  );
  assert(
    MONGO_URI,
    'No existe MONGODB_URI en backend/.env. No se acepta una base alternativa.'
  );

  console.log('\nPRUEBA PERSISTENTE — RMA + FACTUS HABILITACIÓN');
  console.log('Emite una factura y una nota crédito reales únicamente en habilitación.');
  console.log('No usa bases temporales y no elimina ningún documento.\n');

  await assertFactusHabilitationReady();
  const resumeOrder = requestedResumeOrder();
  if (process.argv.some((value) => value.startsWith(RESUME_ORDER_PREFIX)) && !resumeOrder) {
    throw new Error(`${RESUME_ORDER_PREFIX} requiere un número de orden.`);
  }

  if (resumeOrder) {
    console.log(`RECUPERACIÓN SEGURA: se continuará la orden ${resumeOrder}.`);
    console.log('No se crearán una orden ni una factura nuevas.\n');
  }

  const orderNumber = resumeOrder || createPersistentRmaTrace();
  await closeAndVerifyTrace(orderNumber, { resume: Boolean(resumeOrder) });
}

run()
  .catch((error) => {
    console.error('\nFALLO TRAZA FACTUS + RMA:', error?.code || error?.message || error);
    console.error('Todo documento alcanzado se conserva para diagnóstico; no se ejecutó limpieza.');
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
