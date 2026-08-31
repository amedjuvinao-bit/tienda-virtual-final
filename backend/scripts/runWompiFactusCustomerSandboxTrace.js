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

const SiteSettings = require('../models/SiteSettings');
const {
  getActivePaymentsConfig,
} = require('../services/paymentConfigurationAuthorityService');
const {
  assertFactusHabilitationConfig,
  assertNonProductionProcess,
  assertWompiSandboxConfig,
  parseCustomerInvoiceArguments,
} = require('./wompiFactusSandboxTrace/config');
const {
  createAutonomousCheckout,
} = require('./wompiFactusSandboxTrace/checkoutStage');
const {
  ensureFactusInvoice,
} = require('./wompiFactusSandboxTrace/factusStage');
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

function customerEvidence(order, invoice) {
  const invoiceCustomer = invoice?.customer || {};
  return {
    nombre:
      invoiceCustomer.businessName ||
      [invoiceCustomer.firstName, invoiceCustomer.lastName].filter(Boolean).join(' ') ||
      [order?.billing?.firstName, order?.billing?.lastName].filter(Boolean).join(' '),
    documento: invoiceCustomer.documentNumber || order?.billing?.documentNumber,
    correo: invoiceCustomer.email || order?.billing?.email,
    direccion: invoiceCustomer.address || order?.billing?.address,
    municipio: invoiceCustomer.municipalityCode || order?.billing?.municipalityCode,
  };
}

async function run() {
  assertNonProductionProcess();
  parseCustomerInvoiceArguments();
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

  console.log('\nPRUEBA ÚNICA — WOMPI + FACTUS + DATOS DEL CLIENTE');
  console.log(`Wompi: ${baseUrl}`);
  console.log(`Factus: ${factus.apiUrl}`);
  console.log('No ejecuta Envia, devolución, reembolso ni nota crédito.\n');

  const checkout = await createAutonomousCheckout();
  const orderNumber = checkout.order.orderNumber;
  console.log(`OK 1/5: orden nueva ${orderNumber} creada con comprador identificado`);

  const transaction = await createApprovedSandboxTransaction({
    baseUrl,
    payments,
    checkoutData: checkout.checkoutData,
    email: checkout.identity.email,
  });
  console.log(`OK 2/5: Wompi aprobó la transacción ${transaction.id}`);

  const verified = await loadVerifiedTransaction({
    orderNumber,
    transactionId: transaction.id,
    payments,
    baseUrl,
  });
  const paidOrder = await applyVerifiedApproval({ ...verified, payments });
  console.log('OK 3/5: pago e inventario aplicados por el motor canónico');

  const invoice = await ensureFactusInvoice({
    order: paidOrder,
    transaction: verified.transaction,
    payments,
  });
  console.log(`OK 4/5: factura Factus ${invoice.invoiceNumber} validada con PDF/XML`);

  const customer = customerEvidence(paidOrder, invoice);
  console.log('OK 5/5: XML oficial conserva los datos del comprador');
  console.log('\nRESULTADO CONSERVADO');
  console.log(`Buscar en Órdenes: ${paidOrder.orderNumber}`);
  console.log(`Transacción Wompi: ${transaction.id}`);
  console.log(`Factura Factus: ${invoice.invoiceNumber}`);
  console.log(`Cliente: ${customer.nombre}`);
  console.log(`Documento: ${customer.documento}`);
  console.log(`Correo: ${customer.correo}`);
  console.log(`Dirección: ${customer.direccion}`);
  console.log(`Municipio: ${customer.municipio}`);
  console.log('Persistencia: CONSERVADA (orden pagada y factura validada).');
}

run()
  .catch((error) => {
    console.error(
      '\nFALLO PRUEBA WOMPI + FACTUS:',
      error?.code || error?.message || error
    );
    if (error?.details) console.error('Detalles:', error.details);
    console.error('La evidencia alcanzada queda conservada para revisión.');
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
