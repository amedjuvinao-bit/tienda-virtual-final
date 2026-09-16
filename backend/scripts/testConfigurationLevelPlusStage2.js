'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SiteSettings = require('../models/SiteSettings');
const { buildPublicSiteSettings, isSensitiveKey } = require('../lib/siteSettingsSecurity');
const { findAdminRoutePermission } = require('../security/adminRoutePermissionMap');
const {
  PAYMENT_PROVIDERS,
  PaymentSettingsError,
  buildPaymentSettingsResponse,
  buildReadiness,
  mergeCredentials,
  normalizePaymentSettings,
  updatePaymentSettings,
  validatePaymentSettings,
} = require('../services/paymentSettingsService');

const COMPLETE_WOMPI = Object.freeze({
  active: true,
  provider: 'wompi',
  mode: 'sandbox',
  currency: 'COP',
  checkoutLabel: 'Paga con Wompi',
  successMessage: 'Recibimos tu pago.',
  enableWebhook: true,
  credentials: {
    wompi: {
      publicKey: 'pub_test_value',
      privateKey: 'prv_test_value',
      integrityKey: 'integrity_test_value',
      webhookSecret: 'webhook_test_value',
    },
    payu: {},
    manual: {},
  },
});

function queryResult(value) {
  return {
    select() { return this; },
    lean() { return Promise.resolve(value); },
  };
}

async function run() {
  assert.deepStrictEqual(Object.keys(PAYMENT_PROVIDERS), ['wompi', 'payu', 'manual']);
  assert.strictEqual(normalizePaymentSettings({ provider: 'bold' }).provider, '');
  assert.strictEqual(normalizePaymentSettings({ provider: 'mercado-pago' }).provider, '');

  const normalized = normalizePaymentSettings(COMPLETE_WOMPI);
  assert.strictEqual(normalized.provider, 'wompi');
  assert.strictEqual(normalized.credentials.wompi.privateKey, 'prv_test_value');
  assert.strictEqual(buildReadiness(normalized).wompi.ready, true);

  assert.throws(
    () => validatePaymentSettings({ ...COMPLETE_WOMPI, credentials: { wompi: {} } }),
    (error) => error instanceof PaymentSettingsError &&
      error.code === 'INVALID_PAYMENT_SETTINGS' &&
      error.details.some((item) => item.field.endsWith('publicKey'))
  );
  assert.throws(
    () => validatePaymentSettings({ ...COMPLETE_WOMPI, mode: 'production' }, normalized),
    (error) => error instanceof PaymentSettingsError &&
      error.details.some((item) => item.field === 'confirmProduction')
  );
  assert.throws(
    () => validatePaymentSettings({ ...COMPLETE_WOMPI, currency: 'USD' }, normalized),
    (error) => error instanceof PaymentSettingsError &&
      error.details.some((item) => item.field === 'currency')
  );
  assert.doesNotThrow(() => validatePaymentSettings({
    ...COMPLETE_WOMPI,
    mode: 'production',
    confirmProduction: true,
  }, normalized));

  assert.throws(
    () => validatePaymentSettings({
      active: true,
      provider: 'manual',
      mode: 'sandbox',
      currency: 'COP',
      credentials: { manual: {} },
    }),
    (error) => error instanceof PaymentSettingsError &&
      error.details.some((item) => item.field.endsWith('paymentInstructions'))
  );

  const merged = mergeCredentials(
    normalized.credentials,
    { wompi: { publicKey: 'pub_test_new', privateKey: '', integrityKey: '', webhookSecret: '' } }
  );
  assert.strictEqual(merged.wompi.publicKey, 'pub_test_new');
  assert.strictEqual(merged.wompi.privateKey, 'prv_test_value');
  assert.strictEqual(merged.wompi.integrityKey, 'integrity_test_value');

  const response = buildPaymentSettingsResponse({
    theme: { global: { payments: normalized } },
    paymentSettingsRevision: 6,
    updatedBy: 'owner',
  });
  assert.strictEqual(response.revision, 6);
  assert.strictEqual(response.settings.credentials.wompi.privateKey, '');
  assert.strictEqual(response.settings.credentials.wompi.integrityKey, '');
  assert.strictEqual(response.credentialStatus.wompi.privateKey, true);
  assert.strictEqual(response.credentialStatus.wompi.integrityKey, true);
  assert(!JSON.stringify(response).includes('prv_test_value'));
  assert(!JSON.stringify(response).includes('integrity_test_value'));
  assert.strictEqual(isSensitiveKey('accountNumber'), true);

  const publicSettings = buildPublicSiteSettings({
    theme: { global: { payments: normalized } },
    paymentSettingsRevision: 12,
  });
  assert.strictEqual(publicSettings.paymentSettingsRevision, undefined);
  assert.strictEqual(publicSettings.theme.global.payments.credentials, undefined);

  assert(SiteSettings.schema.path('paymentSettingsRevision'));
  const getRule = findAdminRoutePermission('GET', '/api/admin/payment-settings');
  const putRule = findAdminRoutePermission('PUT', '/api/admin/payment-settings');
  assert.strictEqual(getRule?.permission, 'settings:payments');
  assert.strictEqual(putRule?.permission, 'settings:payments');
  assert.strictEqual(putRule?.audit, true);
  assert.strictEqual(putRule?.sensitive, true);

  const originalFindOne = SiteSettings.findOne;
  const originalFindOneAndUpdate = SiteSettings.findOneAndUpdate;
  let captured = null;
  try {
    const current = {
      _id: 'payment-settings-1',
      theme: { global: { payments: normalized } },
      paymentSettingsRevision: 4,
      updatedBy: 'owner',
    };
    SiteSettings.findOne = () => queryResult(current);
    SiteSettings.findOneAndUpdate = (filter, update, options) => {
      captured = { filter, update, options };
      return queryResult({
        ...current,
        theme: { global: { payments: update.$set['theme.global.payments'] } },
        paymentSettingsRevision: 5,
        updatedAt: new Date('2026-09-16T10:00:00.000Z'),
      });
    };

    const updated = await updatePaymentSettings({
      settings: {
        ...COMPLETE_WOMPI,
        credentials: {
          ...COMPLETE_WOMPI.credentials,
          wompi: { ...COMPLETE_WOMPI.credentials.wompi, privateKey: '', integrityKey: '' },
        },
      },
      revision: 4,
    }, { actor: 'owner' });

    assert.deepStrictEqual(captured.filter, {
      _id: 'payment-settings-1',
      paymentSettingsRevision: 4,
    });
    assert.strictEqual(captured.update.$inc.paymentSettingsRevision, 1);
    assert.strictEqual(captured.update.$set['theme.global.payments'].credentials.wompi.privateKey, 'prv_test_value');
    assert.strictEqual(captured.options.strict, false);
    assert.strictEqual(updated.revision, 5);

    captured = null;
    await assert.rejects(
      updatePaymentSettings({ settings: COMPLETE_WOMPI, revision: 3 }),
      (error) => error instanceof PaymentSettingsError &&
        error.code === 'PAYMENT_SETTINGS_CONFLICT'
    );
    assert.strictEqual(captured, null);
  } finally {
    SiteSettings.findOne = originalFindOne;
    SiteSettings.findOneAndUpdate = originalFindOneAndUpdate;
  }

  const indexSource = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');
  const globalRouteSource = fs.readFileSync(path.join(__dirname, '..', 'routes', 'siteSettings.js'), 'utf8');
  const uiSource = fs.readFileSync(
    path.join(__dirname, '..', '..', 'frontend', 'src', 'admin', 'configuracion', 'sections', 'PagosSection.jsx'),
    'utf8'
  );
  assert(indexSource.includes("app.use('/api/admin/payment-settings', adminPaymentSettingsRoutes)"));
  assert(globalRouteSource.includes('PAYMENTS_DEDICATED_ENDPOINT_REQUIRED'));
  assert(!uiSource.includes("value: 'bold'"));
  assert(!uiSource.includes("value: 'mercado-pago'"));
  assert(uiSource.includes("fetchPaymentSettings"));

  console.log('Configuración Nivel Plus Etapa 2 - Pagos (backend): OK');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
