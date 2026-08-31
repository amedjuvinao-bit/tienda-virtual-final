'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const service = require('../services/inventoryReservationService');

const BACKEND_ROOT = path.resolve(__dirname, '..');
const FACADE_PATH = 'services/inventoryReservationService.js';
const MODULE_ROOT = 'services/inventoryReservation';
const MODULE_LINE_LIMIT = 450;
const FACADE_LINE_LIMIT = 100;
const MODULE_FILES = [
  'catalog.js',
  'confirmReservation.js',
  'constants.js',
  'createReservation.js',
  'expireReservations.js',
  'inventoryMovement.js',
  'itemNormalization.js',
  'releaseReservation.js',
  'repository.js',
  'stockReservation.js',
  'stockUpdates.js',
  'support.js',
].map((name) => `${MODULE_ROOT}/${name}`);
const EXPECTED_EXPORTS = [
  'DEFAULT_RESERVATION_MINUTES',
  'PAYMENT_FAILURE_RELEASE_PREFIX',
  'buildPaymentFailureReleaseReason',
  'buildStockVariantFilter',
  'createInventoryReservation',
  'confirmInventoryReservation',
  'reconcilePaymentFailureReservation',
  'releaseInventoryReservation',
  'expireInventoryReservations',
  'allocateReservationItems',
  'expandReservableItems',
  'releaseReservedItems',
  'resolveReservationStockVariant',
  'buildReleaseStockUpdate',
  'parsePaymentFailureReleaseReason',
  'createServiceError',
  'getAvailableFromStock',
  'normalizePaymentReferenceIdentity',
];
const PUBLIC_BINDINGS = {
  DEFAULT_RESERVATION_MINUTES: 'constants.js',
  PAYMENT_FAILURE_RELEASE_PREFIX: 'constants.js',
  buildPaymentFailureReleaseReason: 'support.js',
  buildStockVariantFilter: 'itemNormalization.js',
  createInventoryReservation: 'createReservation.js',
  confirmInventoryReservation: 'confirmReservation.js',
  reconcilePaymentFailureReservation: 'releaseReservation.js',
  releaseInventoryReservation: 'releaseReservation.js',
  expireInventoryReservations: 'expireReservations.js',
  allocateReservationItems: 'stockReservation.js',
  expandReservableItems: 'catalog.js',
  releaseReservedItems: 'stockReservation.js',
  resolveReservationStockVariant: 'stockUpdates.js',
  buildReleaseStockUpdate: 'stockUpdates.js',
  parsePaymentFailureReleaseReason: 'support.js',
  createServiceError: 'support.js',
  getAvailableFromStock: 'itemNormalization.js',
  normalizePaymentReferenceIdentity: 'support.js',
};

function read(relativePath) {
  return fs.readFileSync(path.join(BACKEND_ROOT, relativePath), 'utf8');
}

function lineCount(source) {
  return source.split(/\r?\n/).length;
}

function localDependencies(relativePath) {
  const source = read(relativePath);
  const dependencies = [];
  const requirePattern = /require\(\s*['"]([^'"]+)['"]\s*\)/g;
  let match;

  while ((match = requirePattern.exec(source))) {
    if (!match[1].startsWith('.')) continue;
    const base = path.resolve(
      path.dirname(path.join(BACKEND_ROOT, relativePath)),
      match[1]
    );
    const candidates = [base, `${base}.js`, path.join(base, 'index.js')];
    const resolved = candidates.find((candidate) => fs.existsSync(candidate));
    if (!resolved) continue;
    dependencies.push(
      path.relative(BACKEND_ROOT, resolved).split(path.sep).join('/')
    );
  }

  return dependencies;
}

function assertAcyclic(files) {
  const allowed = new Set(files);
  const visiting = new Set();
  const visited = new Set();

  function visit(file, chain = []) {
    if (visiting.has(file)) {
      assert.fail(`Dependencia circular: ${[...chain, file].join(' -> ')}`);
    }
    if (visited.has(file)) return;

    visiting.add(file);
    for (const dependency of localDependencies(file)) {
      if (allowed.has(dependency)) visit(dependency, [...chain, file]);
    }
    visiting.delete(file);
    visited.add(file);
  }

  files.forEach((file) => visit(file));
}

function main() {
  let passed = 0;
  const ok = (label) => {
    passed += 1;
    console.log(`OK  ${label}`);
  };

  assert.deepStrictEqual(Object.keys(service), EXPECTED_EXPORTS);
  for (const [name, moduleName] of Object.entries(PUBLIC_BINDINGS)) {
    const implementation = require(`../${MODULE_ROOT}/${moduleName}`);
    assert.strictEqual(
      service[name],
      implementation[name],
      `${name} debe conservar la misma referencia pública`
    );
  }
  ok('la fachada conserva exactamente los exports y referencias públicas');

  const facade = read(FACADE_PATH);
  assert.ok(lineCount(facade) <= FACADE_LINE_LIMIT);
  assert.ok(!facade.includes("require('mongoose')"));
  assert.ok(!facade.includes('/models/'));
  assert.ok(!facade.includes('withTransaction('));
  assert.ok(!/module\.exports\s*=\s*require\(/.test(facade));
  ok('la fachada es explícita, estable y no contiene lógica de dominio');

  for (const modulePath of MODULE_FILES) {
    const source = read(modulePath);
    assert.ok(
      lineCount(source) <= MODULE_LINE_LIMIT,
      `${modulePath} supera ${MODULE_LINE_LIMIT} líneas`
    );
    assert.ok(
      !/module\.exports\s*=\s*require\(/.test(source),
      `${modulePath} no puede ser un barrel ciego`
    );
  }
  ok('todos los módulos internos respetan el ratchet de 450 líneas');

  assertAcyclic([FACADE_PATH, ...MODULE_FILES]);
  ok('el grafo interno no contiene dependencias circulares');

  const responsibilityOwners = {
    createInventoryReservation: 'createReservation.js',
    confirmInventoryReservation: 'confirmReservation.js',
    reconcilePaymentFailureReservation: 'releaseReservation.js',
    releaseInventoryReservation: 'releaseReservation.js',
    expireInventoryReservations: 'expireReservations.js',
    allocateReservationItems: 'stockReservation.js',
    createSaleOutMovementFromReservationItem: 'inventoryMovement.js',
  };
  for (const [functionName, owner] of Object.entries(responsibilityOwners)) {
    const definitions = MODULE_FILES.filter((modulePath) =>
      new RegExp(`(?:async\\s+)?function\\s+${functionName}\\s*\\(`).test(
        read(modulePath)
      )
    );
    assert.deepStrictEqual(definitions, [`${MODULE_ROOT}/${owner}`]);
  }
  ok('cada operación transaccional conserva una única autoridad cohesiva');

  assert.strictEqual(
    service.normalizePaymentReferenceIdentity(' order-42__try__ABC '),
    'ORDER-42'
  );
  const reason = service.buildPaymentFailureReleaseReason({
    provider: 'Wompi',
    paymentStatus: 'failed',
    orderNumber: '42',
    paymentReference: 'ORDER-42__TRY__ABC',
    paymentTransactionId: 'tx-9',
  });
  assert.deepStrictEqual(service.parsePaymentFailureReleaseReason(reason), {
    operation: 'inventory_release',
    provider: 'wompi',
    status: 'failed',
    order: '42',
    reference: 'ORDER-42__TRY__ABC',
    canonicalReference: 'ORDER-42',
    transaction: 'tx-9',
  });
  assert.strictEqual(service.getAvailableFromStock({ stock: 9, reservedStock: 4 }), 5);
  assert.strictEqual(service.getAvailableFromStock({ stock: 2, reservedStock: 8 }), 0);
  ok('identidad de pago y disponibilidad conservan su paridad observable');

  const serviceError = service.createServiceError(
    'conflicto',
    'TEST_CONFLICT',
    { reservation: 'r1' },
    409
  );
  assert.strictEqual(serviceError.message, 'conflicto');
  assert.strictEqual(serviceError.code, 'TEST_CONFLICT');
  assert.deepStrictEqual(serviceError.details, { reservation: 'r1' });
  assert.strictEqual(serviceError.statusCode, 409);
  assert.throws(
    () => service.buildPaymentFailureReleaseReason({ paymentStatus: 'paid' }),
    (error) =>
      error?.code === 'INVALID_PAYMENT_FAILURE_RELEASE_STATUS' &&
      error?.statusCode === 409
  );
  ok('errores y códigos contractuales permanecen estables');

  const stockFilter = service.buildStockVariantFilter({
    productObjectId: 'product-1',
    variantKey: '4__royalblue',
    size: '4',
    color: 'royalblue',
  });
  assert.deepStrictEqual(stockFilter, {
    product: 'product-1',
    active: true,
    deletedAt: null,
    variantKey: '4__royalblue',
  });
  assert.deepStrictEqual(
    service.resolveReservationStockVariant(
      {
        _id: 'stock-1',
        variantKey: '4__royalblue',
        variant: { size: '4', color: 'Azul rey', attributes: [] },
      },
      '4__azul rey'
    ),
    {
      size: '4',
      color: 'royalblue',
      attributes: [],
      variantKey: '4__royalblue',
      source: 'matching-key',
    }
  );
  assert.deepStrictEqual(service.buildReleaseStockUpdate(3), [
    {
      $set: {
        reservedStock: {
          $max: [
            0,
            { $subtract: [{ $ifNull: ['$reservedStock', 0] }, 3] },
          ],
        },
      },
    },
    {
      $set: {
        availableStock: {
          $max: [
            0,
            { $subtract: ['$stock', { $ifNull: ['$reservedStock', 0] }] },
          ],
        },
      },
    },
  ]);
  ok('selección de variante y actualización atómica conservan el contrato');

  console.log(
    `\nComposición de reservas de inventario: ${passed}/${passed} controles aprobados.`
  );
}

try {
  main();
} catch (error) {
  console.error('\nFALLO composición de reservas de inventario:', error);
  process.exitCode = 1;
}
