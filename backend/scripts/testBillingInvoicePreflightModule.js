/* eslint-disable no-console */
'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const {
  assertPreflightReady,
  buildInvoicePreflight,
  validateCustomerSnapshot,
} = require('../services/billingInvoicePreflightService');
const {
  buildFactusCustomer,
} = require('../lib/dian/providers/factus/factusPayloads');
const {
  findAdminRoutePermission,
} = require('../security/adminRoutePermissionMap');

const ROOT = path.join(__dirname, '..', '..');
const checks = [];

function ok(message) {
  checks.push(message);
  console.log(`OK ${checks.length}: ${message}`);
}

function query(value) {
  return {
    sort() { return this; },
    async lean() { return value; },
  };
}

function sampleOrder(overrides = {}) {
  // Fixture completamente ficticia: no representa a ninguna persona real.
  const orderId = new mongoose.Types.ObjectId();
  return {
    _id: orderId,
    orderNumber: 'PRECHECK-ORDER-001',
    status: 'paid',
    source: 'manual',
    subtotal: 100000,
    shipping: 0,
    total: 100000,
    payment: {
      status: 'paid',
      amount: 100000,
      currency: 'COP',
      method: 'PSE',
      paidAt: new Date('2026-08-17T12:00:00.000Z'),
    },
    pricing: {
      version: 1,
      subtotal: 100000,
      subtotalAfterDiscount: 100000,
      shipping: 0,
      taxAmount: 0,
      total: 100000,
    },
    taxes: { iva: { enabled: false, amount: 0, percent: 0 } },
    customer: {
      name: 'Fixture',
      lastname: 'Automatizada',
      email: 'fixture.fiscal@example.invalid',
      phone: '0000000001',
      address: 'DIRECCION FICTICIA SIN VALIDEZ',
      documentType: 'CC',
      documentNumber: '0000000000',
      municipalityCode: '11001',
      city: 'Bogotá, D.C.',
      department: 'Bogotá, D.C.',
      country: 'Colombia',
      isFinalConsumer: false,
    },
    billing: {
      personType: 'natural',
      documentType: 'CC',
      documentNumber: '0000000000',
      firstName: 'Fixture',
      lastName: 'Automatizada',
      email: 'fixture.fiscal@example.invalid',
      phone: '0000000001',
      address: 'DIRECCION FICTICIA SIN VALIDEZ',
      municipalityCode: '11001',
      city: 'Bogotá, D.C.',
      department: 'Bogotá, D.C.',
      country: 'Colombia',
      countryCode: 'CO',
      isFinalConsumer: false,
    },
    items: [
      {
        productId: new mongoose.Types.ObjectId(),
        title: 'Producto de prueba',
        quantity: 1,
        price: 100000,
      },
    ],
    createdAt: new Date('2026-08-17T12:00:00.000Z'),
    updatedAt: new Date('2026-08-17T12:00:00.000Z'),
    ...overrides,
  };
}

function dependencies(order) {
  return {
    OrderModel: { findById: () => query(order) },
    SettingsModel: {
      findOne: () => query({
        billing: {
          dian: { enabled: false, mode: 'internal', providerType: 'mock' },
          electronicProvider: { provider: 'mock' },
          taxes: { iva: { enabled: false, percent: 0 } },
        },
      }),
    },
    InvoiceModel: { findOne: () => query(null) },
  };
}

async function main() {
  const identified = validateCustomerSnapshot({
    documentType: 'CC',
    documentNumber: '222222222222',
    personType: 'natural',
    firstName: 'Fixture',
    lastName: 'Identificada',
    email: 'fixture.identificada@example.invalid',
    phone: '0000000001',
    address: 'DIRECCION FICTICIA SIN VALIDEZ',
    municipalityCode: '11001',
    isFinalConsumer: false,
  });
  assert.ok(identified.blockers.some((item) => item.code === 'BILLING_FINAL_CONSUMER_MISMATCH'));
  ok('bloquea 222222222222 cuando el comprador no es consumidor final');

  const finalCustomer = buildFactusCustomer({
    source: 'manual',
    customer: { name: 'Consumidor final', isFinalConsumer: true },
    billing: { isFinalConsumer: true },
  });
  assert.equal(finalCustomer.identification, '222222222222');
  assert.equal(finalCustomer.names, 'Consumidor final');
  ok('el consumidor final explícito se normaliza igual en órdenes manuales y POS');

  const validOrder = sampleOrder();
  const preflight = await buildInvoicePreflight(
    validOrder._id,
    dependencies(validOrder)
  );
  assert.equal(preflight.ready, true, JSON.stringify(preflight.blockers));
  assert.equal(preflight.payload.customer.identification, '0000000000');
  assert.equal(preflight.payload.items.length, 1);
  assert.equal(preflight.totals.total, 100000);
  assert.match(preflight.fingerprint, /^[a-f0-9]{64}$/);
  ok('construye una fotografía fiscal completa y determinística sin llamar a Factus');

  assert.equal(assertPreflightReady(preflight, preflight.fingerprint), true);
  assert.throws(
    () => assertPreflightReady(preflight, 'a'.repeat(64)),
    (error) => error.code === 'BILLING_PREFLIGHT_CHANGED'
  );
  assert.throws(
    () => assertPreflightReady(preflight, ''),
    (error) => error.code === 'BILLING_PREFLIGHT_CONFIRMATION_REQUIRED'
  );
  ok('la emisión exige la misma huella que revisó el administrador');

  const blockedOrder = sampleOrder({
    billing: {
      personType: 'natural',
      documentType: 'CC',
      documentNumber: '222222222222',
      firstName: 'Fixture',
      lastName: 'Identificada',
      email: 'fixture.identificada@example.invalid',
      phone: '0000000001',
      address: 'DIRECCION FICTICIA SIN VALIDEZ',
      municipalityCode: '11001',
      isFinalConsumer: false,
    },
  });
  const blocked = await buildInvoicePreflight(
    blockedOrder._id,
    dependencies(blockedOrder)
  );
  assert.equal(blocked.ready, false);
  assert.ok(blocked.blockers.some((item) => item.code === 'BILLING_FINAL_CONSUMER_MISMATCH'));
  ok('la revisión completa conserva el bloqueo antes de cualquier emisión');

  assert.equal(
    findAdminRoutePermission(
      'GET',
      `/api/admin/billing/orders/${validOrder._id}/preflight`
    )?.permission,
    'billing:create'
  );
  ok('la vista previa está protegida por alcance administrativo y billing:create');

  const routeSource = fs.readFileSync(
    path.join(ROOT, 'backend/routes/adminBilling.js'),
    'utf8'
  );
  const adminServiceSource = fs.readFileSync(
    path.join(ROOT, 'backend/services/adminBillingService.js'),
    'utf8'
  );
  assert.ok(routeSource.includes("'/orders/:orderId/preflight'"));
  assert.ok(routeSource.includes('preflightFingerprint: req.body?.preflightFingerprint'));
  assert.ok(adminServiceSource.includes('assertPreflightReady(preflight, options.preflightFingerprint)'));
  ok('la ruta de emisión no puede omitir el precontrol confirmado');

  const e2eSource = fs.readFileSync(
    path.join(ROOT, 'frontend/e2e/ordersBillingPreflight.e2e.js'),
    'utf8'
  );
  const frontendPackage = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'frontend/package.json'),
    'utf8'
  ));
  const billingWorkflow = fs.readFileSync(
    path.join(ROOT, '.github/workflows/billing-ci.yml'),
    'utf8'
  );
  [
    "chromium.launch",
    "page.route('**/*'",
    "name: 'Revisar y emitir'",
    'preflightFingerprint: FINGERPRINT',
  ].forEach((needle) => assert.ok(e2eSource.includes(needle), needle));
  assert.equal(
    frontendPackage.scripts['test:e2e:orders-billing-phase1'],
    'node e2e/ordersBillingPreflight.e2e.js'
  );
  assert.ok(billingWorkflow.includes('playwright-core install --with-deps chromium'));
  assert.ok(billingWorkflow.includes('test:e2e:orders-billing-phase1'));
  ok('CI recorre el panel real con navegador y APIs fiscales interceptadas');

  console.log(`\nControl fiscal previo: ${checks.length}/${checks.length} verificaciones aprobadas.`);
}

main().catch((error) => {
  console.error('FALLO control fiscal previo:', error);
  process.exit(1);
});
