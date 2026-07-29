/* eslint-disable no-console */
'use strict';

const fs = require('fs');
const path = require('path');

process.env.BILLING_ENCRYPTION_KEY =
  process.env.BILLING_ENCRYPTION_KEY ||
  'billing-fiscal-compatibility-test-key-32-characters-minimum';

const {
  buildCanonicalFiscalInfo,
  buildCompatibilitySet,
  normalizeColombianNit,
} = require('../services/billingFiscalCompatibilityService');

const ROOT = path.join(__dirname, '..', '..');
const results = { ok: 0, fail: 0 };

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function ok(message) {
  results.ok += 1;
  console.log(`OK  ${message}`);
}

function read(relativePath) {
  const fullPath = path.join(ROOT, relativePath);
  assert(fs.existsSync(fullPath), `No existe ${relativePath}`);
  return fs.readFileSync(fullPath, 'utf8');
}

function testLegacyFiscalFieldsAreReused() {
  const canonical = buildCanonicalFiscalInfo({
    fiscalInfo: {
      company: 'Tienda Virtual SAS',
      nit: '819003632',
      cityCode: '47980',
      legalRepresentative: 'Representante Legal',
    },
    store: {
      address: 'Calle 1 # 2-3',
      email: 'facturacion@tienda.test',
    },
  });

  assert(canonical.businessName === 'Tienda Virtual SAS', 'No reutilizó la razón social histórica.');
  assert(canonical.nit === '819003632', 'No conservó el NIT.');
  assert(canonical.dv === '1', 'No calculó correctamente el DV faltante.');
  assert(canonical.address === 'Calle 1 # 2-3', 'No reutilizó la dirección guardada.');
  assert(canonical.municipalityCode === '47980', 'No migró cityCode a municipalityCode.');
  assert(canonical.billingEmail === 'facturacion@tienda.test', 'No reutilizó el correo guardado.');

  ok('Datos fiscales históricos se normalizan sin pedirlos nuevamente');
}

function testFormattedNitAndStaleDvAreNormalized() {
  const separated = normalizeColombianNit('819.003.632-1', '9');
  assert(separated.nit === '819003632', 'No separó el DV incluido en el NIT.');
  assert(separated.dv === '1', 'No corrigió el DV usando el cálculo oficial.');

  const embedded = normalizeColombianNit('8190036321', '');
  assert(embedded.nit === '819003632', 'No detectó el DV incorporado al final.');
  assert(embedded.dv === '1', 'No conservó el DV incorporado válido.');

  const { $set } = buildCompatibilitySet({
    billing: {
      fiscalInfo: {
        nit: '819.003.632-1',
        dv: '9',
      },
    },
  });

  assert($set['billing.fiscalInfo.nit'] === '819003632', 'No preparó la normalización del NIT.');
  assert($set['billing.fiscalInfo.dv'] === '1', 'No preparó la corrección del DV obsoleto.');

  ok('NIT con formato histórico y DV inconsistente se corrigen de forma determinística');
}

function testMigrationFillsMissingFieldsWithoutOverwritingValidNit() {
  const settings = {
    billing: {
      fiscalInfo: {
        businessName: '',
        nit: '819003632',
        dv: '',
        address: '',
        cityCode: '47980',
        municipalityCode: '',
      },
    },
    store: {
      businessName: 'Tienda Virtual SAS',
      address: 'Calle 1 # 2-3',
    },
  };

  const { $set } = buildCompatibilitySet(settings);

  assert($set['billing.fiscalInfo.businessName'] === 'Tienda Virtual SAS', 'No preparó la razón social.');
  assert($set['billing.fiscalInfo.dv'] === '1', 'No preparó el DV.');
  assert($set['billing.fiscalInfo.address'] === 'Calle 1 # 2-3', 'No preparó la dirección.');
  assert($set['billing.fiscalInfo.municipalityCode'] === '47980', 'No preparó el municipio.');
  assert(
    !Object.prototype.hasOwnProperty.call($set, 'billing.fiscalInfo.nit'),
    'La migración intentó sobrescribir un NIT ya normalizado.'
  );

  ok('Migración conserva el NIT válido y completa únicamente lo necesario');
}

function testNoInventedMunicipalityCode() {
  const canonical = buildCanonicalFiscalInfo({
    fiscalInfo: { nit: '819003632' },
    store: { businessName: 'Tienda Virtual SAS' },
  });

  assert(canonical.dv === '1', 'El DV determinístico debe calcularse.');
  assert(canonical.municipalityCode === '', 'No debe inventarse un código municipal.');

  ok('Compatibilidad no inventa datos territoriales inexistentes');
}

function testRoutesUseCompatibilityLayer() {
  const settingsRoute = read('backend/routes/billingSettingsProtection.js');
  const factusRoute = read('backend/routes/dianProviderTest.js');

  assert(
    settingsRoute.includes('ensureStoredFiscalInfoCompatibility') &&
      settingsRoute.includes('hydrateBillingConfiguration'),
    'La lectura o guardado no usa la capa de compatibilidad fiscal.'
  );
  assert(
    factusRoute.includes('hydrateBillingPayload'),
    'La prueba real no reutiliza los datos fiscales almacenados.'
  );

  ok('Lectura, guardado y prueba Factus usan compatibilidad fiscal');
}

function testFrontendShowsRequiredFiscalFields() {
  const frontend = read(
    'frontend/src/admin/configuracion/sections/facturacion/FiscalInfoBlock.jsx'
  );

  [
    'Razón social',
    'Dígito de verificación',
    'Dirección fiscal',
    'Código DANE del municipio',
  ].forEach((label) => {
    assert(frontend.includes(label), `Falta mostrar ${label}.`);
  });

  assert(
    frontend.includes("value.municipalityCode || value.cityCode"),
    'El panel no reutiliza cityCode histórico.'
  );

  ok('Panel muestra los campos fiscales requeridos y conserva compatibilidad');
}

function main() {
  console.log('\nValidando compatibilidad de datos fiscales históricos...');

  [
    testLegacyFiscalFieldsAreReused,
    testFormattedNitAndStaleDvAreNormalized,
    testMigrationFillsMissingFieldsWithoutOverwritingValidNit,
    testNoInventedMunicipalityCode,
    testRoutesUseCompatibilityLayer,
    testFrontendShowsRequiredFiscalFields,
  ].forEach((test) => {
    try {
      test();
    } catch (error) {
      results.fail += 1;
      console.error(`FAIL ${test.name}`);
      console.error(`     ${error.message}`);
    }
  });

  console.log(
    `\nResumen compatibilidad fiscal -> OK: ${results.ok} FAIL: ${results.fail}`
  );
  if (results.fail > 0) process.exit(1);
}

main();
