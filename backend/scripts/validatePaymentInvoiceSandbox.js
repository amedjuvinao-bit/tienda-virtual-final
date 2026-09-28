/* eslint-disable no-console */
'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const mongoose = require('mongoose');
const Branch = require('../models/Branch');
const ElectronicInvoice = require('../models/ElectronicInvoice');
const ManualPaymentConfirmation = require('../models/ManualPaymentConfirmation');
const Order = require('../models/Order');
const SiteSettings = require('../models/SiteSettings');
const { FACTUS_API_URLS, buildRuntimeFactusConfig } = require('../lib/billing/billingConfigurationSecurity');
const { createInventoryReservation } = require('../services/inventoryReservationService');
const { applyReservationToOrderDocument } = require('../services/orderInventoryAllocationService');
const { confirmManualPayment } = require('../services/manualPaymentConfirmationService');
const { loadCandidates } = require('./seedPersistentOrdersTrace');
const { buildOrderDraft, buildTraceIdentity } = require('./seedPersistentManualInvoiceOrder');
const {
  assertIdentifiedFactusCustomer,
  assertValidatedInvoice,
  verifyInvoiceDocuments,
} = require('./wompiFactusSandboxTrace/factusStage');

const TIMEOUT_MS = 120_000;
let createdOrderNumber = '';

function assertSafeMongoTarget(uri) {
  const match = String(uri || '').match(/^mongodb(?:\+srv)?:\/\/(?:[^@/]+@)?([^/]+)\/([^?]+)/i);
  assert(match, 'Indica una base de datos explícita en MONGODB_URI o MONGO_URI.');
  const database = decodeURIComponent(match[2]);
  assert(!/(?:^|[_-])(prod|production)(?:$|[_-])/i.test(database),
    'La prueba está bloqueada para una base de datos identificada como producción.');
}

function assertSandboxConfiguration({ env = process.env, settings, branch } = {}) {
  assert.notEqual(String(env.NODE_ENV || '').toLowerCase(), 'production', 'NODE_ENV=production: prueba bloqueada.');
  assert(settings, 'Falta la configuración de facturación de la tienda.');
  assert.equal(settings.billing?.dian?.enabled, true, 'La facturación electrónica está desactivada.');
  assert.equal(String(settings.billing?.electronicProvider?.provider || '').toLowerCase(), 'factus');
  const runtime = buildRuntimeFactusConfig(settings.billing);
  assert.equal(runtime.environment, 'habilitacion', 'Factus debe estar en habilitación.');
  assert.equal(runtime.apiUrl, FACTUS_API_URLS.habilitacion, 'La URL de Factus no es sandbox.');
  assert(runtime.numberingRangeId > 0, 'Falta el rango de facturas de habilitación.');
  assert(branch?.active === true && branch?.status === 'active', 'La sede de prueba no está activa.');
  assert.equal(branch?.settings?.allowElectronicInvoice, true, 'La sede de prueba no permite factura automática.');
  return runtime;
}

function pendingDraft(candidate, identity, now = new Date()) {
  const draft = buildOrderDraft({ candidate, identity, now });
  draft.status = 'pending';
  draft.payment.status = 'pending_manual';
  draft.payment.transactionId = '';
  draft.payment.reference = '';
  draft.payment.paidAt = null;
  draft.payment.method = '';
  draft.payment.methodType = '';
  draft.payment.checkoutLabel = 'Pago manual simulado para comprobar la facturación automática';
  delete draft.paymentProcessing;
  draft.tags = ['qa-pago-factura-automatico', 'factus-habilitacion'];
  draft.notes = [{
    text: 'Prueba automática: el pago en efectivo es simulado; comprobar emisión en Factus habilitación.',
    by: 'validate-payment-invoice-sandbox',
    at: now,
  }];
  return draft;
}

async function createPendingOrder(candidate, identity) {
  const session = await mongoose.startSession();
  let orderId;
  try {
    await session.withTransaction(async () => {
      const [order] = await Order.create([pendingDraft(candidate, identity)], { session });
      orderId = order._id;
      const reservation = await createInventoryReservation({
        sessionId: order.sessionId,
        order: order._id,
        orderNumber: order.orderNumber,
        source: 'admin',
        items: order.items.map((item) => item.toObject()),
        branchPriorityIds: [candidate.branch.id],
        allowedBranchIds: [candidate.branch.id],
        expiresInMinutes: 30,
        currency: 'COP',
        metadata: { paymentInvoiceSandboxTest: true },
        notes: `Prueba automática ${order.orderNumber}`,
      }, { session });
      assert(reservation, 'No se pudo reservar inventario para la orden de prueba.');
      order.inventoryControl.reservationId = reservation._id;
      applyReservationToOrderDocument(order, reservation);
      await order.save({ session });
    });
  } finally {
    await session.endSession();
  }
  return Order.findById(orderId).exec();
}

async function waitForAutomaticInvoice(orderId, { timeoutMs = TIMEOUT_MS, intervalMs = 2000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastStatus = '';
  while (Date.now() < deadline) {
    const [order, invoice] = await Promise.all([
      Order.findById(orderId).lean(),
      ElectronicInvoice.findOne({ orderId }).lean(),
    ]);
    assert(order, 'La orden de prueba desapareció.');
    const lane = order.paymentProcessing?.invoice || {};
    lastStatus = `${lane.status || 'pending'} / ${invoice?.status || 'sin factura'}`;
    if (lane.status === 'needs_review' || lane.status === 'not_required') {
      throw new Error(`La factura automática requiere revisión o fue omitida: ${lane.outcomeCode || lane.errorCode || lastStatus}`);
    }
    if (invoice?.status === 'accepted' && invoice?.provider?.isValidated === true && lane.status === 'scheduled') {
      return { order, invoice };
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`Factus no confirmó la factura automática en ${timeoutMs / 1000} s (último estado: ${lastStatus}).`);
}

async function run() {
  assert.notEqual(String(process.env.NODE_ENV || '').toLowerCase(), 'production', 'Prueba bloqueada en producción.');
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DB_URI;
  assert(mongoUri, 'Falta MONGODB_URI o MONGO_URI en backend/.env.');
  assertSafeMongoTarget(mongoUri);
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 15_000 });
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  assert(hello?.setName || String(hello?.msg || '').toLowerCase() === 'isdbgrid', 'MongoDB debe admitir transacciones.');

  const settings = await SiteSettings.findOne().lean();
  const candidates = await loadCandidates(200);
  let candidate;
  for (const item of candidates) {
    const branch = await Branch.findById(item.branch.id).lean();
    if (!branch || branch.settings?.allowElectronicInvoice !== true) continue;
    assertSandboxConfiguration({ settings, branch });
    candidate = item;
    break;
  }
  assert(candidate, 'No hay sede con factura activa y producto con inventario disponible.');

  const identity = buildTraceIdentity();
  const order = await createPendingOrder(candidate, identity);
  createdOrderNumber = order.orderNumber;
  console.log(`Orden de prueba conservada: ${order.orderNumber} (${order._id}).`);
  const expectedCustomer = assertIdentifiedFactusCustomer(order);
  const payment = {
    method: 'cash',
    reference: `QA-${identity.runId}`,
    amount: Number(order.payment.amount),
    currency: order.payment.currency,
    reason: 'Pago simulado para comprobar la facturación automática en Factus habilitación.',
  };
  const actor = { id: 'qa-payment-invoice-sandbox', label: 'QA pago y factura', role: 'admin', source: 'sandbox_test' };
  const start = Date.now();
  const result = await confirmManualPayment({ orderId: order._id, payment, actor });
  assert.equal(result.confirmed, true);
  assert.equal(result.order?.payment?.status, 'paid');
  assert(Date.now() - start < 30_000, 'La confirmación del pago tardó demasiado.');
  console.log('OK: pago confirmado con evidencia; la emisión quedó en segundo plano.');

  const replay = await confirmManualPayment({ orderId: order._id, payment, actor });
  assert.equal(replay.duplicate, true);

  const verified = await waitForAutomaticInvoice(order._id);
  assertValidatedInvoice(verified.invoice);
  assert.equal(verified.invoice.customer?.documentNumber, expectedCustomer.documentNumber);
  assert.equal(verified.invoice.customer?.email, expectedCustomer.email);
  assert.equal(verified.invoice.customer?.address, expectedCustomer.address);
  await verifyInvoiceDocuments(order, verified.invoice, expectedCustomer);
  console.log(`OK: Factus aceptó automáticamente ${verified.invoice.invoiceNumber}; CUFE y PDF/XML verificados.`);

  const [evidenceCount, invoiceCount] = await Promise.all([
    ManualPaymentConfirmation.countDocuments({ order: order._id }),
    ElectronicInvoice.countDocuments({ orderId: order._id }),
  ]);
  assert.equal(evidenceCount, 1, 'Se duplicó la evidencia de pago.');
  assert.equal(invoiceCount, 1, 'Se duplicó la factura.');
  console.log('OK: segundo intento idempotente; una evidencia de pago y una factura.');
  console.log(`APROBADO: ${order.orderNumber} · Factus ${verified.invoice.invoiceNumber} · ${verified.invoice.cufe}`);
  console.log('La orden de prueba y la factura de habilitación permanecen como evidencia.');
}

if (require.main === module) {
  run().catch((error) => {
    console.error(`FALLÓ la prueba real: ${error.message || error.code}`);
    if (createdOrderNumber) {
      console.error(`Orden conservada para diagnóstico: ${createdOrderNumber}.`);
    }
    process.exitCode = 1;
  }).finally(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect().catch(() => {});
  });
}

module.exports = { assertSafeMongoTarget, assertSandboxConfiguration, pendingDraft, waitForAutomaticInvoice };
