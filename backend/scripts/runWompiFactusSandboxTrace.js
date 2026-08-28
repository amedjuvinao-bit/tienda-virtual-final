/* eslint-disable no-console */

'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');

require('dotenv').config({
  path: path.resolve(__dirname, '..', '.env'),
  override: false,
  quiet: true,
});

const mongoose = require('mongoose');

const OrderEvent = require('../models/OrderEvent');
const SiteSettings = require('../models/SiteSettings');
const {
  getActivePaymentsConfig,
} = require('../services/paymentConfigurationAuthorityService');
const {
  createWompiPublicGatewayService,
} = require('../services/wompiPublicGatewayService');
const {
  assertFactusHabilitationConfig,
  assertNonProductionProcess,
  assertWompiSandboxConfig,
  parseArguments,
} = require('./wompiFactusSandboxTrace/config');
const {
  ensureFactusInvoice,
  verifyCreditNoteDocuments,
} = require('./wompiFactusSandboxTrace/factusStage');
const {
  automateSandboxRefund,
  createFullCancellationRefund,
} = require('./wompiFactusSandboxTrace/refundStage');
const {
  applyVerifiedApproval,
  loadVerifiedTransaction,
} = require('./wompiFactusSandboxTrace/wompiStage');

const MONGO_URI = String(process.env.MONGODB_URI || '').trim();

async function assertTransactionalDatabase() {
  await mongoose.connection.db.command({ ping: 1 });
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  assert(
    hello?.setName || String(hello?.msg || '').toLowerCase() === 'isdbgrid',
    'MongoDB debe soportar transacciones.'
  );
}

async function verifyRemoteVoid({ transactionId, payments, baseUrl }) {
  const gateway = createWompiPublicGatewayService({ fetchImpl: global.fetch });
  const transaction = await gateway.fetchTransactionById({
    baseUrl,
    transactionId,
    privateKey: payments.credentials.wompi.privateKey,
    publicKey: payments.credentials.wompi.publicKey,
  });
  assert.strictEqual(
    String(transaction?.status || '').toUpperCase(),
    'VOIDED',
    'Wompi Sandbox no confirmó la anulación.'
  );
  return transaction;
}

async function run() {
  assertNonProductionProcess();
  const { orderNumber, transactionId } = parseArguments();
  assert(MONGO_URI, 'No existe MONGODB_URI en backend/.env.');
  await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 15000 });
  await assertTransactionalDatabase();

  const [settings, payments] = await Promise.all([
    SiteSettings.findOne().lean(),
    getActivePaymentsConfig(),
  ]);
  assert(settings, 'No existe SiteSettings.');
  const baseUrl = assertWompiSandboxConfig(payments);
  const factus = assertFactusHabilitationConfig(settings);

  console.log('\nTRAZA EXTERNA — SOLO SANDBOX/HABILITACIÓN');
  console.log(`Orden: ${orderNumber}`);
  console.log(`Wompi: ${baseUrl}`);
  console.log(`Factus: ${factus.apiUrl}`);
  console.log('No almacena tarjeta y no contacta ambientes de producción.\n');

  const verified = await loadVerifiedTransaction({
    orderNumber,
    transactionId,
    payments,
    baseUrl,
  });
  console.log(`OK 1/6: Wompi confirmó ${verified.status} y la propiedad de la transacción`);

  const paidOrder = await applyVerifiedApproval({ ...verified, payments });
  console.log('OK 2/6: pago e inventario aplicados por el motor canónico');

  const invoice = await ensureFactusInvoice({
    order: paidOrder,
    transaction: verified.transaction,
    payments,
  });
  console.log(`OK 3/6: factura Factus ${invoice.invoiceNumber} validada con PDF/XML`);

  const refund = await createFullCancellationRefund(paidOrder);
  console.log(`OK 4/6: reembolso ${refund.refundNumber} e inventario conciliados`);

  const completed = await automateSandboxRefund({ order: paidOrder, refund });
  const note = await verifyCreditNoteDocuments(completed.finalInvoice);
  console.log(`OK 5/6: nota crédito Factus ${note.provider.number} validada con PDF/XML`);

  const voided = await verifyRemoteVoid({ transactionId, payments, baseUrl });
  const events = await OrderEvent.countDocuments({ orderId: paidOrder._id });
  console.log(`OK 6/6: Wompi confirmó ${voided.status}; ${events} eventos auditables`);

  console.log('\nTRAZA CONSERVADA');
  console.log(`Buscar en Órdenes: ${paidOrder.orderNumber}`);
  console.log(`Transacción Wompi: ${transactionId}`);
  console.log(`Factura Factus: ${invoice.invoiceNumber}`);
  console.log(`Reembolso: ${completed.finalRefund.refundNumber}`);
  console.log(`Nota crédito Factus: ${note.provider.number}`);
  console.log('Persistencia: CONSERVADA (sin limpieza automática).');
}

run()
  .catch((error) => {
    console.error('\nFALLO TRAZA WOMPI + FACTUS SANDBOX:', error?.code || error?.message || error);
    if (error?.details) console.error('Detalles:', error.details);
    console.error('No se ejecuta limpieza: toda evidencia alcanzada queda disponible para reintento.');
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
