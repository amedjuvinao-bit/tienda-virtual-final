'use strict';

const assert = require('node:assert/strict');
const Order = require('../models/Order');
const ElectronicInvoice = require('../models/ElectronicInvoice');
const { buildTraceIdentity } = require('./seedPersistentManualInvoiceOrder');
const {
  assertSafeMongoTarget,
  assertSandboxConfiguration,
  pendingDraft,
  waitForAutomaticInvoice,
} = require('./validatePaymentInvoiceSandbox');
const { FACTUS_API_URLS } = require('../lib/billing/billingConfigurationSecurity');

function settings(environment = 'habilitacion') {
  return {
    billing: {
      dian: { enabled: true, mode: environment },
      electronicProvider: {
        provider: 'factus', clientId: 'fixture', clientSecret: 'fixture',
        username: 'fixture@example.com', password: 'fixture', numberingRangeId: 1,
      },
      // Validación de formato; los secretos nunca se usan en esta prueba.
    },
  };
}

async function main() {
  const candidate = {
    branch: { id: '66bb00000000000000000001', name: 'Sede', code: 'P', type: 'store' },
    product: { id: '66cc00000000000000000001', title: 'Producto', price: 161600, productType: 'physical' },
  };
  const draft = pendingDraft(candidate, buildTraceIdentity());
  await new Order(draft).validate();
  assert.equal(draft.status, 'pending');
  assert.equal(draft.payment.status, 'pending_manual');
  assert.equal(draft.payment.amountInCents, 16160000);
  assert.equal(draft.inventoryControl.reservationRequired, true);
  assert(draft.billing.lastName);
  assert.doesNotThrow(() => assertSafeMongoTarget('mongodb://127.0.0.1:27017/tienda_virtual'));
  assert.doesNotThrow(() => assertSafeMongoTarget('mongodb+srv://user:pass@cluster.example/tienda_sandbox'));
  assert.throws(() => assertSafeMongoTarget('mongodb+srv://cluster.example/tienda_virtual'), /remota/);

  // Estas condiciones se comprueban antes de insertar la orden o llamar al proveedor.
  const validBranch = { active: true, status: 'active', settings: { allowElectronicInvoice: true } };
  assert.throws(() => assertSandboxConfiguration({ env: { NODE_ENV: 'production' }, settings: settings(), branch: validBranch }), /production/);
  assert.throws(() => assertSandboxConfiguration({ env: {}, settings: settings('production'), branch: validBranch }), /habilitación/);
  assert.throws(() => assertSandboxConfiguration({ env: {}, settings: settings(), branch: { ...validBranch, settings: { allowElectronicInvoice: false } } }), /sede/);

  const orderLookup = Order.findById;
  const invoiceLookup = ElectronicInvoice.findOne;
  try {
    Order.findById = () => ({ lean: async () => ({ paymentProcessing: { invoice: { status: 'scheduled' } } }) });
    ElectronicInvoice.findOne = () => ({ lean: async () => ({ status: 'accepted', provider: { isValidated: true } }) });
    const success = await waitForAutomaticInvoice('test', { timeoutMs: 30, intervalMs: 1 });
    assert.equal(success.invoice.status, 'accepted');

    Order.findById = () => ({ lean: async () => ({ paymentProcessing: { invoice: { status: 'not_required', outcomeCode: 'BRANCH_ELECTRONIC_INVOICE_DISABLED' } } }) });
    ElectronicInvoice.findOne = () => ({ lean: async () => null });
    await assert.rejects(waitForAutomaticInvoice('test', { timeoutMs: 30, intervalMs: 1 }), /BRANCH_ELECTRONIC_INVOICE_DISABLED/);

    Order.findById = () => ({ lean: async () => ({ paymentProcessing: { invoice: { status: 'scheduled' } } }) });
    ElectronicInvoice.findOne = () => ({ lean: async () => ({ status: 'accepted', provider: { isValidated: false } }) });
    await assert.rejects(waitForAutomaticInvoice('test', { timeoutMs: 20, intervalMs: 1 }), /no confirmó/);
  } finally {
    Order.findById = orderLookup;
    ElectronicInvoice.findOne = invoiceLookup;
  }
  assert.equal(FACTUS_API_URLS.habilitacion, 'https://api-sandbox.factus.com.co');
  console.log('OK: orden pendiente válida, bloqueo de producción y estados terminales verificados.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
