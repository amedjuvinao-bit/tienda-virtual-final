'use strict';

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const {
  DEFAULT_SHIPPING_PRICE,
  findShippingZone,
  normalizeShippingRates,
  resolveShippingRate,
} = require('../lib/shipping/shippingRateRules');
const {
  ShippingRatesError,
  buildReadiness,
  updateShippingRates,
  validateShippingRates,
} = require('../services/shippingRatesService');
const { resolveShippingAmount } = require('../services/orderPricingService');
const { findAdminRoutePermission } = require('../security/adminRoutePermissionMap');

const checks = [];
async function check(name, callback) {
  assert.equal(mongoose.connection.readyState, 0, 'MongoDB debe permanecer desconectado');
  await callback();
  assert.equal(mongoose.connection.readyState, 0, 'MongoDB debe permanecer desconectado');
  checks.push(name);
  console.log(`OK ${checks.length}: ${name}`);
}

function validRates(overrides = {}) {
  return {
    active: true,
    mode: 'zones',
    fixedPrice: 15000,
    estimatedTime: '2 a 5 días hábiles',
    freeShipping: { enabled: true, minimum: 200000 },
    fallback: { price: 25000, eta: '4 a 7 días hábiles' },
    zones: [{
      id: 'magdalena-cienaga',
      countryCode: 'CO',
      country: 'Colombia',
      departmentCode: '47',
      department: 'Magdalena',
      cityCode: '47189',
      city: 'Ciénaga',
      price: 12000,
      eta: '1 a 2 días hábiles',
    }],
    ...overrides,
  };
}

function expectRatesError(callback, code, field) {
  assert.throws(callback, (error) => {
    assert.ok(error instanceof ShippingRatesError);
    assert.equal(error.code, code);
    assert.ok(error.details.some((detail) => detail.field === field));
    return true;
  });
}

function fakeSettingsModel(initial) {
  let document = JSON.parse(JSON.stringify(initial));
  const query = (value) => ({
    select() { return this; },
    async lean() { return value; },
  });
  return {
    snapshot: () => JSON.parse(JSON.stringify(document)),
    findOne() { return query(document); },
    async create(value) {
      document = { _id: 'settings-1', ...value };
      return { ...document, toObject: () => ({ ...document }) };
    },
    findOneAndUpdate(filter, update) {
      const expected = filter.shippingRatesRevision ?? 0;
      if (Number(document.shippingRatesRevision || 0) !== expected) return query(null);
      document = {
        ...document,
        theme: {
          ...(document.theme || {}),
          global: {
            ...(document.theme?.global || {}),
            envios: update.$set['theme.global.envios'],
          },
        },
        updatedBy: update.$set.updatedBy,
        shippingRatesRevision:
          Number(document.shippingRatesRevision || 0) + Number(update.$inc.shippingRatesRevision || 0),
      };
      return query(document);
    },
  };
}

async function run() {
  await check('normaliza el contrato geográfico canónico', () => {
    const rates = normalizeShippingRates(validRates());
    assert.equal(rates.zones[0].countryCode, 'CO');
    assert.equal(rates.zones[0].departmentCode, '47');
    assert.equal(rates.zones[0].cityCode, '47189');
  });

  await check('rechaza mínimo vacío para envío gratis', () => {
    expectRatesError(
      () => validateShippingRates(validRates({ freeShipping: { enabled: true, minimum: '' } })),
      'INVALID_SHIPPING_RATES',
      'freeShipping.minimum'
    );
  });

  await check('rechaza respaldo vacío y zonas duplicadas', () => {
    const duplicate = validRates().zones[0];
    expectRatesError(
      () => validateShippingRates(validRates({
        fallback: { price: '' },
        zones: [duplicate, { ...duplicate, id: 'duplicate' }],
      })),
      'INVALID_SHIPPING_RATES',
      'fallback.price'
    );
    expectRatesError(
      () => validateShippingRates(validRates({ zones: [duplicate, { ...duplicate, id: 'duplicate' }] })),
      'INVALID_SHIPPING_RATES',
      'zones.1.cityCode'
    );
  });

  await check('encuentra zonas por código y conserva compatibilidad por nombre', () => {
    assert.equal(findShippingZone(validRates(), {
      countryCode: 'CO', departmentCode: '47', cityCode: '47189',
    }).price, 12000);
    assert.equal(findShippingZone(validRates(), {
      country: 'Colombia', department: 'Magdalena', city: 'Cienaga',
    }).cityCode, '47189');
  });

  await check('aplica zona, respaldo y umbral gratis sin gratuidad accidental', () => {
    const customer = { countryCode: 'CO', departmentCode: '47', cityCode: '47189' };
    assert.equal(resolveShippingRate({ config: validRates(), customer, subtotal: 100000 }), 12000);
    assert.equal(resolveShippingRate({
      config: validRates(),
      customer: { countryCode: 'CO', departmentCode: '11', cityCode: '11001' },
      subtotal: 100000,
    }), 25000);
    assert.equal(resolveShippingRate({ config: validRates(), customer, subtotal: 200000 }), 0);
    assert.equal(resolveShippingRate({
      config: validRates({ freeShipping: { enabled: true, minimum: null } }),
      customer,
      subtotal: 100000,
    }), 12000);
    assert.equal(resolveShippingRate({ config: null, customer, subtotal: 100000 }), DEFAULT_SHIPPING_PRICE);
  });

  await check('el precio autoritativo respeta retiro y productos sin envío físico', () => {
    const settings = { theme: { global: { envios: validRates() } } };
    assert.equal(resolveShippingAmount({
      settings, customer: { deliveryType: 'retiro' }, subtotal: 100000,
      items: [{ requiresShipping: true }],
    }), 0);
    assert.equal(resolveShippingAmount({
      settings, customer: { deliveryType: 'envio' }, subtotal: 100000,
      items: [{ requiresShipping: false }],
    }), 0);
    assert.equal(resolveShippingAmount({
      settings,
      customer: {
        deliveryType: 'envio',
        countryCode: 'CO',
        departmentCode: '47',
        municipalityId: '47189',
      },
      subtotal: 100000,
      items: [{ requiresShipping: true }],
    }), 12000);
  });

  await check('calcula preparación de tarifas y origen por separado', () => {
    const readiness = buildReadiness(validRates(), {
      address: 'Calle 12', city: 'Ciénaga', department: 'Magdalena', country: 'CO',
    });
    assert.deepEqual(
      { ready: readiness.ready, originReady: readiness.originReady, zoneCount: readiness.zoneCount },
      { ready: true, originReady: true, zoneCount: 1 }
    );
  });

  await check('exige revisión y actualiza mediante concurrencia optimista', async () => {
    const model = fakeSettingsModel({
      _id: 'settings-1',
      theme: { global: { envios: validRates() } },
      store: { name: 'Rosa Boutique' },
      shippingRatesRevision: 3,
    });
    await assert.rejects(
      () => updateShippingRates({ revision: 2, settings: validRates() }, { SiteSettingsModel: model }),
      (error) => error.code === 'SHIPPING_RATES_CONFLICT'
    );
    const result = await updateShippingRates(
      { revision: 3, settings: validRates({ mode: 'fixed', fixedPrice: 18000 }) },
      { SiteSettingsModel: model, actor: 'owner' }
    );
    assert.equal(result.revision, 4);
    assert.equal(result.settings.fixedPrice, 18000);
    assert.equal(model.snapshot().updatedBy, 'owner');
  });

  await check('registra las rutas protegidas y auditables de tarifas', () => {
    assert.equal(
      findAdminRoutePermission('GET', '/api/admin/shipping-rates')?.permission,
      'settings:shipping'
    );
    const putRule = findAdminRoutePermission('PUT', '/api/admin/shipping-rates');
    assert.equal(putRule?.permission, 'settings:shipping');
    assert.equal(putRule?.audit, true);
  });

  console.log(`\nConfiguración Nivel Plus Etapa 3: ${checks.length} comprobaciones aprobadas.`);
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
