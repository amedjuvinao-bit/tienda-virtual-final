'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const MailSettings = require('../models/MailSettings');
const { findAdminRoutePermission } = require('../security/adminRoutePermissionMap');
const {
  MailSettingsError,
  buildMailSettingsResponse,
  buildReadiness,
  configurationFingerprint,
  normalizeMailSettings,
  testMailSettings,
  updateMailSettings,
  validateConnection,
} = require('../services/mailSettingsService');

function storeModel(store = {}) {
  return {
    findOne() {
      return {
        select() { return this; },
        lean() {
          return Promise.resolve({
            store: {
              name: 'Rosa Boutique',
              businessName: 'Rosa Boutique S.A.S.',
              email: 'rosa@gmail.com',
              supportEmail: 'soporte@rosa.com',
              ...store,
            },
          });
        },
      };
    },
  };
}

function mailDocument(overrides = {}) {
  const document = {
    enabled: false,
    revision: 3,
    provider: 'gmail',
    fromName: 'Nombre anterior',
    fromEmail: 'ventas@rosa.com',
    replyToEmail: 'soporte@rosa.com',
    smtpHost: 'smtp.gmail.com',
    smtpPort: 465,
    smtpSecurity: 'ssl',
    smtpUser: 'ventas@rosa.com',
    smtpPasswordEncrypted: 'v1:protected',
    hasSmtpPassword: true,
    testEmail: 'owner@rosa.com',
    lastTestStatus: 'none',
    lastTestMessage: '',
    lastTestAt: null,
    lastTestFingerprint: '',
    updatedAt: new Date('2026-09-17T10:00:00.000Z'),
    updatedBy: 'owner',
    async save() { return this; },
    toSafeObject() {
      const clone = { ...this };
      delete clone.smtpPasswordEncrypted;
      delete clone.lastTestFingerprint;
      delete clone.save;
      delete clone.toSafeObject;
      return clone;
    },
    ...overrides,
  };
  return document;
}

function mailModel(document) {
  return { getSingleton: async () => document };
}

async function run() {
  const normalized = normalizeMailSettings({
    provider: 'gmail',
    fromEmail: ' VENTAS@ROSA.COM ',
    smtpHost: 'incorrecto.example',
    smtpPort: 25,
    smtpSecurity: 'none',
    smtpUser: 'ventas@rosa.com',
  });
  assert.equal(normalized.fromEmail, 'ventas@rosa.com');
  assert.equal(normalized.smtpHost, 'smtp.gmail.com');
  assert.equal(normalized.smtpPort, 465);
  assert.equal(normalized.smtpSecurity, 'ssl');

  const incomplete = mailDocument({ fromEmail: '', smtpUser: '', hasSmtpPassword: false, smtpPasswordEncrypted: '' });
  assert.deepEqual(
    validateConnection(incomplete).map((item) => item.field),
    ['fromEmail', 'smtpUser', 'smtpPassword']
  );

  const configured = mailDocument();
  configured.lastTestFingerprint = configurationFingerprint(configured);
  configured.lastTestStatus = 'success';
  const ready = buildReadiness(configured, { name: 'Rosa Boutique' });
  assert.equal(ready.ready, true);
  assert.equal(ready.completed, 5);
  assert.equal(ready.tested, true);

  const response = buildMailSettingsResponse(configured, {
    name: 'Rosa Boutique',
    email: 'rosa@gmail.com',
    supportEmail: 'soporte@rosa.com',
  });
  assert.equal(response.settings.fromName, 'Rosa Boutique');
  assert.equal(response.settings.smtpPasswordEncrypted, undefined);
  assert.equal(response.settings.lastTestFingerprint, undefined);
  assert(!JSON.stringify(response).includes('v1:protected'));

  await assert.rejects(
    () => updateMailSettings({ revision: 2, settings: configured }, {
      MailSettingsModel: mailModel(configured),
      SiteSettingsModel: storeModel(),
    }),
    (error) => error instanceof MailSettingsError && error.code === 'MAIL_SETTINGS_CONFLICT'
  );

  const changed = mailDocument({
    lastTestStatus: 'success',
    enabled: true,
  });
  changed.lastTestFingerprint = configurationFingerprint(changed);
  const saved = await updateMailSettings({
    revision: 3,
    enabled: true,
    settings: {
      ...changed,
      fromEmail: 'pedidos@rosa.com',
    },
  }, {
    MailSettingsModel: mailModel(changed),
    SiteSettingsModel: storeModel(),
    actor: 'owner',
  });
  assert.equal(saved.settings.enabled, false);
  assert.equal(saved.settings.lastTestStatus, 'none');
  assert.equal(saved.revision, 4);
  assert.equal(saved.settings.fromName, 'Rosa Boutique');

  const pendingTest = mailDocument();
  let delivered = null;
  const tested = await testMailSettings({ revision: 3, testEmail: 'owner@rosa.com' }, {
    MailSettingsModel: mailModel(pendingTest),
    SiteSettingsModel: storeModel(),
    actor: 'owner',
    sendTestMailFn: async (message) => { delivered = message; },
  });
  assert.match(delivered.subject, /Rosa Boutique/);
  assert.equal(tested.readiness.tested, true);
  assert.equal(tested.settings.lastTestStatus, 'success');
  assert.equal(tested.revision, 4);

  assert(MailSettings.schema.path('revision'));
  assert(MailSettings.schema.path('lastTestFingerprint'));

  const getRule = findAdminRoutePermission('GET', '/api/admin/mail-settings');
  const putRule = findAdminRoutePermission('PUT', '/api/admin/mail-settings');
  const testRule = findAdminRoutePermission('POST', '/api/admin/mail-settings/test');
  assert.equal(getRule?.permission, 'settings:mail');
  assert.equal(putRule?.permission, 'settings:mail');
  assert.equal(putRule?.audit, true);
  assert.equal(putRule?.danger, true);
  assert.equal(testRule?.permission, 'settings:mail_test');
  assert.equal(testRule?.audit, true);

  const routeSource = fs.readFileSync(
    path.join(__dirname, '..', 'routes', 'adminMailSettings.js'),
    'utf8'
  );
  const mailerSource = fs.readFileSync(
    path.join(__dirname, '..', 'lib', 'mail', 'mailer.js'),
    'utf8'
  );
  const uiSource = fs.readFileSync(
    path.join(__dirname, '..', '..', 'frontend', 'src', 'admin', 'configuracion', 'sections', 'CorreoSection.jsx'),
    'utf8'
  );
  assert(routeSource.includes("requirePermission('settings:mail')"));
  assert(routeSource.includes("requirePermission('settings:mail_test')"));
  assert(mailerSource.includes('getDynamicStoreName'));
  assert(uiSource.includes('Nombre tomado de Configuración → Tienda'));
  assert(uiSource.includes('Guardar primero') || uiSource.includes('Guarda primero'));

  console.log('Configuración Nivel Plus Etapa 4 - Correo (backend): OK');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
