'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const SiteSettings = require('../models/SiteSettings');
const { buildPublicSiteSettings } = require('../lib/siteSettingsSecurity');
const { findAdminRoutePermission } = require('../security/adminRoutePermissionMap');
const {
  StoreSettingsError,
  buildStoreSettingsResponse,
  normalizeStoreSettings,
  updateStoreSettings,
  validateStoreSettings,
} = require('../services/storeSettingsService');

const VALID_STORE = Object.freeze({
  name: 'Rosa Boutique',
  businessName: 'Rosa Boutique S.A.S.',
  email: 'contacto@rosa.example',
  phone: '+57 300 123 4567',
  whatsapp: '+57 301 765 4321',
  supportEmail: 'soporte@rosa.example',
  website: 'https://rosa.example/',
  address: 'Calle 20 # 4-15',
  city: 'Santa Marta',
  cityCode: '47001',
  department: 'Magdalena',
  departmentCode: '47',
  country: 'co',
  timezone: 'America/Bogota',
  locale: 'es-CO',
  customerServiceHours: 'Lunes a sábado, 8:00 a. m. a 6:00 p. m.',
  weeklySchedule: {
    version: 1,
    days: [
      { day: 'monday', enabled: true, intervals: [{ open: '08:00', close: '18:00' }] },
      { day: 'tuesday', enabled: true, intervals: [{ open: '08:00', close: '18:00' }] },
      { day: 'wednesday', enabled: true, intervals: [{ open: '08:00', close: '18:00' }] },
      { day: 'thursday', enabled: true, intervals: [{ open: '08:00', close: '18:00' }] },
      { day: 'friday', enabled: true, intervals: [{ open: '08:00', close: '18:00' }] },
      { day: 'saturday', enabled: true, intervals: [{ open: '08:00', close: '18:00' }] },
      { day: 'sunday', enabled: false, intervals: [] },
    ],
  },
});

function queryResult(value) {
  return {
    select() {
      return this;
    },
    lean() {
      return Promise.resolve(value);
    },
  };
}

async function run() {
  const normalized = normalizeStoreSettings(VALID_STORE);
  assert.strictEqual(normalized.email, 'contacto@rosa.example');
  assert.strictEqual(normalized.phone, '+573001234567');
  assert.strictEqual(normalized.whatsapp, '+573017654321');
  assert.strictEqual(normalized.website, 'https://rosa.example');
  assert.strictEqual(normalized.country, 'CO');
  assert.strictEqual(normalized.departmentCode, '47');
  assert.strictEqual(normalized.cityCode, '47001');
  assert.strictEqual(
    normalized.customerServiceHours,
    'Lunes a sábado: 8:00 a. m. – 6:00 p. m.'
  );
  assert.deepStrictEqual(validateStoreSettings(VALID_STORE), normalized);

  assert.throws(
    () => validateStoreSettings({ ...VALID_STORE, phone: 'abc3001234567' }),
    (error) =>
      error instanceof StoreSettingsError &&
      error.status === 422 &&
      error.details.some(({ field }) => field === 'phone')
  );
  assert.throws(
    () => validateStoreSettings({ ...VALID_STORE, cityCode: '' }),
    (error) =>
      error instanceof StoreSettingsError &&
      error.details.some(({ field }) => field === 'cityCode')
  );
  assert.throws(
    () => validateStoreSettings({
      ...VALID_STORE,
      weeklySchedule: {
        version: 1,
        days: [{
          day: 'monday',
          enabled: true,
          intervals: [{ open: '18:00', close: '08:00' }],
        }],
      },
    }),
    (error) =>
      error instanceof StoreSettingsError &&
      error.details.some(({ field }) => field === 'weeklySchedule')
  );
  assert.throws(
    () => validateStoreSettings({ ...VALID_STORE, website: 'rosa.example' }),
    (error) =>
      error instanceof StoreSettingsError &&
      error.details.some(({ field }) => field === 'website')
  );
  assert.throws(
    () => validateStoreSettings({ ...VALID_STORE, timezone: 'Mars/Olympus' }),
    (error) =>
      error instanceof StoreSettingsError &&
      error.details.some(({ field }) => field === 'timezone')
  );

  await assert.rejects(
    updateStoreSettings({ store: VALID_STORE }),
    (error) =>
      error instanceof StoreSettingsError &&
      error.code === 'STORE_REVISION_REQUIRED' &&
      error.status === 409
  );

  const response = buildStoreSettingsResponse({
    store: { ...VALID_STORE, injectedSecret: 'no-exponer' },
    storeRevision: 8,
    updatedBy: ' owner ',
  });
  assert.strictEqual(response.revision, 8);
  assert.strictEqual(response.updatedBy, 'owner');
  assert.strictEqual(response.store.injectedSecret, undefined);

  const publicSettings = buildPublicSiteSettings({
    store: normalized,
    storeRevision: 99,
    updatedBy: 'owner',
  });
  assert.strictEqual(publicSettings.store.name, VALID_STORE.name);
  assert.strictEqual(publicSettings.storeRevision, undefined);
  assert.strictEqual(publicSettings.updatedBy, undefined);

  const getRule = findAdminRoutePermission('GET', '/api/admin/store-settings');
  const putRule = findAdminRoutePermission('PUT', '/api/admin/store-settings');
  assert.strictEqual(getRule?.permission, 'settings:store');
  assert.strictEqual(putRule?.permission, 'settings:store');
  assert.strictEqual(putRule?.audit, true);

  assert(SiteSettings.schema.path('storeRevision'), 'Falta la revisión de Tienda.');
  assert(SiteSettings.schema.path('store.website'), 'Falta el sitio web de Tienda.');
  assert(SiteSettings.schema.path('store.timezone'), 'Falta la zona horaria de Tienda.');
  assert(SiteSettings.schema.path('store.departmentCode'), 'Falta el código de departamento.');
  assert(SiteSettings.schema.path('store.cityCode'), 'Falta el código de municipio.');
  assert(SiteSettings.schema.path('store.weeklySchedule'), 'Falta el horario semanal estructurado.');

  const originalFindOne = SiteSettings.findOne;
  const originalFindOneAndUpdate = SiteSettings.findOneAndUpdate;
  let capturedUpdate = null;

  try {
    const current = {
      _id: 'settings-1',
      store: normalized,
      storeRevision: 3,
      updatedBy: 'owner',
    };

    SiteSettings.findOne = () => queryResult(current);
    SiteSettings.findOneAndUpdate = (filter, update, options) => {
      capturedUpdate = { filter, update, options };
      return queryResult({
        ...current,
        ...update.$set,
        storeRevision: 4,
        updatedAt: new Date('2026-09-15T12:00:00.000Z'),
      });
    };

    const updated = await updateStoreSettings(
      { store: VALID_STORE, revision: 3 },
      { actor: ' owner ' }
    );

    assert.deepStrictEqual(capturedUpdate.filter, {
      _id: 'settings-1',
      storeRevision: 3,
    });
    assert.strictEqual(capturedUpdate.update.$inc.storeRevision, 1);
    assert.strictEqual(capturedUpdate.update.$set.updatedBy, 'owner');
    assert.deepStrictEqual(capturedUpdate.options, {
      new: true,
      runValidators: true,
    });
    assert.strictEqual(updated.revision, 4);

    capturedUpdate = null;
    await assert.rejects(
      updateStoreSettings({ store: VALID_STORE, revision: 2 }),
      (error) =>
        error instanceof StoreSettingsError &&
        error.code === 'STORE_SETTINGS_CONFLICT' &&
        error.status === 409
    );
    assert.strictEqual(capturedUpdate, null, 'Un conflicto no debe escribir en base de datos.');
  } finally {
    SiteSettings.findOne = originalFindOne;
    SiteSettings.findOneAndUpdate = originalFindOneAndUpdate;
  }

  const indexSource = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');
  const globalRouteSource = fs.readFileSync(
    path.join(__dirname, '..', 'routes', 'siteSettings.js'),
    'utf8'
  );
  assert(
    indexSource.includes("app.use('/api/admin/store-settings', adminStoreSettingsRoutes)"),
    'La ruta administrativa dedicada de Tienda debe estar montada.'
  );
  assert(
    globalRouteSource.includes('STORE_DEDICATED_ENDPOINT_REQUIRED'),
    'La ruta global no debe permitir escrituras paralelas sobre Tienda.'
  );

  console.log('Configuración Nivel Plus Etapa 1 - Tienda (backend): OK');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
