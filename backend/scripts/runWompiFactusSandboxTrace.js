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
  createAutonomousCheckout,
} = require('./wompiFactusSandboxTrace/checkoutStage');
const {
  ensureFactusInvoice,
  verifyCreditNoteDocuments,
} = require('./wompiFactusSandboxTrace/factusStage');
const {
  automateSandboxRefund,
  createFullCancellationRefund,
} = require('./wompiFactusSandboxTrace/refundStage');
const {
  createApprovedSandboxTransaction,
} = require('./wompiFactusSandboxTrace/secureCardStage');
const {
  applyVerifiedApproval,
  loadVerifiedTransaction,
} = require('./wompiFactusSandboxTrace/wompiStage');

const MONGO_URI = String(
  process.env.MONGO_URI ||
    process.env.MONGODB_URI ||
    process.env.MONGO_URL ||
    process.env.DATABASE_URL ||
    ''
).trim();

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
  const args = parseArguments();
  assert(
    MONGO_URI,
    'No existe MONGO_URI en backend/.env (también se aceptan MONGODB_URI, MONGO_URL o DATABASE_URL).'
  );
  await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 15000 });
  await assertTransactionalDatabase();

  const [settings, payments] = await Promise.all([
    SiteSettings.findOne().lean(),
    getActivePaymentsConfig(),
  ]);
  assert(settings, 'No existe SiteSettings.');
  const baseUrl = assertWompiSandboxConfig(payments);
  const factus = assertFactusHabilitationConfig(settings);

  console.log('\nTRAZA AUTÓNOMA — SOLO SANDBOX/HABILITACIÓN');
  console.log(`Wompi: ${baseUrl}`);
  console.log(`Factus: ${factus.apiUrl}`);
  console.log('No almacena tarjeta y no contacta ambientes de producción.\n');

  let orderNumber = args.orderNumber;
  let transactionId = args.transactionId;
  if (args.autonomous) {
    const checkout = await createAutonomousCheckout();
    orderNumber = checkout.order.orderNumber;
    console.log(
      `OK 1/9: carrito firmado y orden ${orderNumber} creados con inventario real`
    );
    console.log(
      `OK 2/9: reserva ${checkout.order.inventoryControl.reservationId} e intento de pago persistidos`
    );

    const transaction = await createApprovedSandboxTransaction({
      baseUrl,
      payments,
      checkoutData: checkout.checkoutData,
      email: checkout.identity.email,
    });
    transactionId = transaction.id;
    console.log(`OK 3/9: Wompi creó y aprobó la transacción ${transactionId}`);
  } else {
    console.log(`Reanudando orden ${orderNumber} y transacción ${transactionId}`);
  }

  const verified = await loadVerifiedTransaction({
    orderNumber,
    transactionId,
    payments,
    baseUrl,
  });
  console.log(
    `${args.autonomous ? 'OK 4/9' : 'OK 1/6'}: Wompi confirmó ${verified.status} y la propiedad de la transacción`
  );

  const paidOrder = await applyVerifiedApproval({ ...verified, payments });
  console.log(
    `${args.autonomous ? 'OK 5/9' : 'OK 2/6'}: pago e inventario aplicados por el motor canónico`
  );

  const invoice = await ensureFactusInvoice({
    order: paidOrder,
    transaction: verified.transaction,
    payments,
  });
  console.log(
    `${args.autonomous ? 'OK 6/9' : 'OK 3/6'}: factura Factus ${invoice.invoiceNumber} validada con PDF/XML`
  );

  const refund = await createFullCancellationRefund(paidOrder);
  console.log(
    `${args.autonomous ? 'OK 7/9' : 'OK 4/6'}: reembolso ${refund.refundNumber} e inventario conciliados`
  );

  const completed = await automateSandboxRefund({ order: paidOrder, refund });
  const note = await verifyCreditNoteDocuments(completed.finalInvoice);
  console.log(
    `${args.autonomous ? 'OK 8/9' : 'OK 5/6'}: nota crédito Factus ${note.provider.number} validada con PDF/XML`
  );

  const voided = await verifyRemoteVoid({ transactionId, payments, baseUrl });
  const events = await OrderEvent.countDocuments({ orderId: paidOrder._id });
  console.log(
    `${args.autonomous ? 'OK 9/9' : 'OK 6/6'}: Wompi confirmó ${voided.status}; ${events} eventos auditables`
  );

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
