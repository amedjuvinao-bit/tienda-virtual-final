'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const scriptPath = path.join(__dirname, 'resetTestCatalog.js');
const source = fs.readFileSync(scriptPath, 'utf8');
const { CONFIRMATION, assertSafeExecution } = require('./resetTestCatalog');

let checks = 0;
function check(message, assertion) {
  assertion();
  checks += 1;
  console.log(`OK  ${message}`);
}

check('exige confirmación explícita', () => {
  assert.throws(() => assertSafeExecution([]), /CONFIRMATION_REQUIRED/);
  assert.strictEqual(CONFIRMATION, '--confirm-test-catalog-reset');
});

check('rechaza argumentos adicionales', () => {
  assert.throws(
    () => assertSafeExecution([CONFIRMATION, '--all']),
    /ARGUMENT_NOT_ALLOWED/
  );
});

check('queda bloqueado en producción', () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    assert.throws(
      () => assertSafeExecution([CONFIRMATION]),
      /BLOCKED_IN_PRODUCTION/
    );
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});

check('limita el borrado a datos del catálogo de prueba', () => {
  for (const model of [
    'InventoryReservation',
    'InventoryMovement',
    'InventoryStock',
    'Cart',
    'Favorite',
    'Product',
  ]) {
    assert(source.includes(`${model}.deleteMany({}, { session })`));
  }
  for (const protectedModel of [
    'AdminUser',
    'SiteSetting',
    'Page',
    'Customer',
    'Order',
    'ElectronicInvoice',
  ]) {
    assert(!source.includes(`${protectedModel}.deleteMany`));
  }
});

check('el borrado es transaccional y luego recrea el catálogo canónico', () => {
  assert(source.includes('session.withTransaction'));
  assert(source.includes("seedDemonstrationProducts.js"));
  assert(source.includes("DEMONSTRATION_CATALOG_RESEED_FAILED"));
});

console.log(`\nReinicio controlado del catálogo: ${checks}/5 controles aprobados.`);
