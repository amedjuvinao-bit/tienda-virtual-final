/* eslint-disable no-console */
'use strict';

const fs = require('fs');
const path = require('path');

const {
  buildFactusCustomer,
} = require('../lib/dian/providers/factusProvider');
const {
  buildCustomerSnapshot,
} = require('../services/electronicInvoiceIssuanceService');
const {
  resolveOrderBillingMunicipality,
} = require('../services/orderBillingMunicipalityService');

const PROJECT_ROOT = path.join(__dirname, '..', '..');
const results = { ok: 0, fail: 0 };

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function ok(message) {
  results.ok += 1;
  console.log(`OK  ${message}`);
}

function read(relativePath) {
  return fs.readFileSync(path.join(PROJECT_ROOT, relativePath), 'utf8');
}

function expectCode(callback, code) {
  try {
    callback();
  } catch (error) {
    assert(error?.code === code, `Se esperaba ${code} y se recibió ${error?.code || error?.message}.`);
    return error;
  }

  throw new Error(`Se esperaba el rechazo ${code}.`);
}

function testExplicitCode() {
  const resolved = resolveOrderBillingMunicipality({
    billing: { municipalityCode: '47980', countryCode: 'CO' },
  }, { required: true });

  assert(resolved.municipalityCode === '47980', 'Cambió el código municipal explícito.');
  assert(resolved.departmentCode === '47', 'No recuperó el departamento del código explícito.');
  ok('Código DIVIPOLA explícito se valida contra el catálogo oficial');
}

function testLegacyZonaBananera() {
  const resolved = resolveOrderBillingMunicipality({
    customer: { city: 'Zona Bananera', department: 'Magdalena' },
    billing: { city: 'Zona Bananera', department: 'Magdalena', country: 'Colombia' },
  }, { required: true });

  assert(resolved.municipalityCode === '47980', 'Zona Bananera no se recuperó como 47980.');
  assert(resolved.departmentCode === '47', 'Zona Bananera perdió Magdalena 47.');
  ok('Orden histórica de Zona Bananera recupera 47980 sin inventar datos');
}

function testAmbiguousCity() {
  const error = expectCode(
    () => resolveOrderBillingMunicipality({
      billing: { city: 'La Victoria', countryCode: 'CO' },
    }, { required: true }),
    'BILLING_MUNICIPALITY_AMBIGUOUS'
  );

  assert(Array.isArray(error.details?.matches) && error.details.matches.length > 1, 'No informó las coincidencias ambiguas.');
  ok('Municipio ambiguo exige selección y no escoge un código al azar');
}

function testAmbiguousCityWithDepartment() {
  const resolved = resolveOrderBillingMunicipality({
    billing: { city: 'La Victoria', departmentCode: '15', countryCode: 'CO' },
  }, { required: true });

  assert(resolved.municipalityCode === '15401', 'No usó el departamento para resolver La Victoria de Boyacá.');
  ok('Departamento desambigua correctamente municipios con el mismo nombre');
}

function testUnknownCity() {
  expectCode(
    () => resolveOrderBillingMunicipality({
      billing: { city: 'Municipio inexistente', countryCode: 'CO' },
    }, { required: true }),
    'BILLING_MUNICIPALITY_NOT_FOUND'
  );
  ok('Municipio desconocido bloquea la emisión con una instrucción accionable');
}

function testInvalidCode() {
  expectCode(
    () => resolveOrderBillingMunicipality({
      billing: { municipalityCode: '99999', countryCode: 'CO' },
    }, { required: true }),
    'BILLING_MUNICIPALITY_CODE_INVALID'
  );
  ok('Código DIVIPOLA inválido se rechaza antes de llamar a Factus');
}

function testInvoiceSnapshotRecovery() {
  const snapshot = buildCustomerSnapshot({
    customer: { name: 'Ana', id: '123456789', city: 'Zona Bananera' },
    billing: {
      documentType: 'CC',
      documentNumber: '123456789',
      city: 'Zona Bananera',
      department: 'Magdalena',
      countryCode: 'CO',
    },
  }, { requireMunicipality: true });

  assert(snapshot.municipalityCode === '47980', 'La fotografía fiscal no recuperó el municipio.');
  assert(snapshot.departmentCode === '47', 'La fotografía fiscal no recuperó el departamento.');
  ok('ElectronicInvoice conserva municipio y departamento recuperados');
}

function testFactusCustomerPayload() {
  const snapshot = buildCustomerSnapshot({
    customer: { name: 'Ana', id: '123456789' },
    billing: {
      documentType: 'CC',
      documentNumber: '123456789',
      city: 'Zona Bananera',
      departmentCode: '47',
      countryCode: 'CO',
    },
  }, { requireMunicipality: true });
  const customer = buildFactusCustomer({ billing: snapshot, customer: snapshot });

  assert(customer.municipality_code === '47980', 'Factus no recibió municipality_code 47980.');
  ok('Payload oficial de Factus recibe municipality_code');
}

function testOrderPersistenceContract() {
  const model = read('backend/models/Order.js');
  const route = read('backend/routes/orders.js');

  assert(model.includes('municipalityCode: String'), 'Order.customer no persiste municipalityCode.');
  assert(route.includes("'municipalityCode'"), 'La edición administrativa descarta municipalityCode.');
  assert(route.includes("'departmentCode'"), 'La edición administrativa descarta departmentCode.');
  ok('Orden persiste los códigos geográficos editados por el administrador');
}

function testFrontendSelectorContract() {
  const component = read(
    'frontend/src/admin/orders/components/orderDetail/OrderDetailCustomerBilling.jsx'
  );

  [
    "'/api/geo/regions'",
    "'/api/geo/cities'",
    'Departamento fiscal',
    'Municipio fiscal',
    'municipalityCode',
    'departmentCode',
  ].forEach((needle) => {
    assert(component.includes(needle), `El formulario no contiene ${needle}.`);
  });

  ok('Formulario usa selectores reales y guarda códigos DIVIPOLA');
}

console.log('\nValidando municipio fiscal de Órdenes y Factus...');

[
  testExplicitCode,
  testLegacyZonaBananera,
  testAmbiguousCity,
  testAmbiguousCityWithDepartment,
  testUnknownCity,
  testInvalidCode,
  testInvoiceSnapshotRecovery,
  testFactusCustomerPayload,
  testOrderPersistenceContract,
  testFrontendSelectorContract,
].forEach((test) => {
  try {
    test();
  } catch (error) {
    results.fail += 1;
    console.error(`FAIL ${error.message}`);
  }
});

console.log(`\nResultado: ${results.ok}/10 controles superados.`);
if (results.fail > 0 || results.ok !== 10) process.exit(1);
