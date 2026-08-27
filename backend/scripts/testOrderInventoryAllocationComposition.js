'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const service = require('../services/orderInventoryAllocationService');

const BACKEND_ROOT = path.resolve(__dirname, '..');
const FACADE_PATH = 'services/orderInventoryAllocationService.js';
const MODULE_ROOT = 'services/orderInventoryAllocation';
const FACADE_LINE_LIMIT = 60;
const MODULE_LINE_LIMIT = 200;
const MODULE_FILES = [
  'fulfillment.js',
  'normalization.js',
  'repository.js',
  'reservationMapping.js',
  'returns.js',
  'summary.js',
  'support.js',
].map((name) => `${MODULE_ROOT}/${name}`);
const EXPECTED_EXPORTS = [
  'allocationIdentity',
  'getAllocationStatus',
  'normalizeAllocation',
  'summarizeInventoryAllocations',
  'applyReservationToOrderDocument',
  'syncOrderInventoryAllocationsFromReservation',
  'hydrateOrderInventoryAllocations',
  'advanceOrderInventoryAllocations',
  'advanceOrderInventoryAllocationsForShipment',
  'applyReturnsToOrderInventoryAllocations',
];
const PUBLIC_BINDINGS = {
  allocationIdentity: 'normalization.js',
  getAllocationStatus: 'normalization.js',
  normalizeAllocation: 'normalization.js',
  summarizeInventoryAllocations: 'summary.js',
  applyReservationToOrderDocument: 'reservationMapping.js',
  syncOrderInventoryAllocationsFromReservation: 'repository.js',
  hydrateOrderInventoryAllocations: 'repository.js',
  advanceOrderInventoryAllocations: 'fulfillment.js',
  advanceOrderInventoryAllocationsForShipment: 'fulfillment.js',
  applyReturnsToOrderInventoryAllocations: 'returns.js',
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

function clone(value) {
  return structuredClone(value);
}

function stableOrder(order) {
  const copy = clone(order);
  if (copy.inventoryAllocationSummary?.updatedAt) {
    copy.inventoryAllocationSummary.updatedAt = '<generated-at>';
  }
  return copy;
}

async function main() {
  let passed = 0;
  const ok = (label) => {
    passed += 1;
    console.log(`OK  ${label}`);
  };

  assert.deepEqual(Object.keys(service), EXPECTED_EXPORTS);
  for (const [name, moduleName] of Object.entries(PUBLIC_BINDINGS)) {
    const implementation = require(`../${MODULE_ROOT}/${moduleName}`);
    assert.strictEqual(
      service[name],
      implementation[name],
      `${name} debe conservar la misma referencia pública`
    );
  }
  ok('la fachada conserva exactamente sus diez exports y referencias públicas');

  const facade = read(FACADE_PATH);
  assert.ok(lineCount(facade) <= FACADE_LINE_LIMIT);
  assert.ok(!facade.includes('/models/'));
  assert.ok(!facade.includes('canonicalizeVariantKey'));
  assert.ok(!facade.includes('new Date('));
  assert.ok(!/module\.exports\s*=\s*require\(/.test(facade));
  ok('la fachada es explícita y no contiene lógica de dominio o persistencia');

  for (const modulePath of MODULE_FILES) {
    assert.ok(
      lineCount(read(modulePath)) <= MODULE_LINE_LIMIT,
      `${modulePath} supera ${MODULE_LINE_LIMIT} líneas`
    );
  }
  assertAcyclic([FACADE_PATH, ...MODULE_FILES]);
  ok('los siete módulos internos respetan el ratchet y no forman ciclos');

  const responsibilityOwners = {
    normalizeAllocation: 'normalization.js',
    summarizeInventoryAllocations: 'summary.js',
    applyReservationToOrderDocument: 'reservationMapping.js',
    syncOrderInventoryAllocationsFromReservation: 'repository.js',
    hydrateOrderInventoryAllocations: 'repository.js',
    advanceOrderInventoryAllocations: 'fulfillment.js',
    advanceOrderInventoryAllocationsForShipment: 'fulfillment.js',
    applyReturnsToOrderInventoryAllocations: 'returns.js',
  };
  for (const [functionName, owner] of Object.entries(responsibilityOwners)) {
    const definitions = MODULE_FILES.filter((modulePath) =>
      new RegExp(`(?:async\\s+)?function\\s+${functionName}\\s*\\(`).test(
        read(modulePath)
      )
    );
    assert.deepEqual(definitions, [`${MODULE_ROOT}/${owner}`]);
  }
  ok('cada responsabilidad tiene una única autoridad cohesiva');

  const normalized = service.normalizeAllocation({
    reservationItem: 'reservation-item-1',
    branch: 'branch-1',
    quantity: 3.8,
    reservedQuantity: 0,
    soldQuantity: 9,
    shippedQuantity: 8,
    deliveredQuantity: 7,
    returnedQuantity: 6,
    releasedQuantity: 5,
    variantKey: '8__Celeste claro',
    bundleParentTitle: '  Combo   infantil  ',
  });
  assert.equal(normalized.quantity, 3);
  assert.equal(normalized.reservedQuantity, 3);
  assert.equal(normalized.soldQuantity, 3);
  assert.equal(normalized.shippedQuantity, 3);
  assert.equal(normalized.deliveredQuantity, 3);
  assert.equal(normalized.returnedQuantity, 3);
  assert.equal(normalized.releasedQuantity, 3);
  assert.equal(normalized.status, 'returned');
  assert.equal(normalized.bundleParentTitle, 'Combo infantil');
  assert.equal(
    service.allocationIdentity(normalized),
    'reservation-item:reservation-item-1'
  );
  ok('normalización, límites de cantidad e identidad permanecen canónicos');

  const reservedAt = new Date('2026-08-27T10:00:00.000Z');
  const soldAt = new Date('2026-08-27T10:05:00.000Z');
  const reservation = {
    _id: 'reservation-1',
    status: 'confirmed',
    createdAt: reservedAt,
    confirmedAt: soldAt,
    items: [
      {
        _id: 'reservation-item-1',
        orderItem: 'order-item-1',
        inventoryStock: 'stock-1',
        branch: 'branch-1',
        product: 'product-1',
        variantKey: '8__celeste claro',
        size: '8',
        color: 'Celeste claro',
        quantity: 3,
      },
    ],
  };
  const mappedOnce = service.applyReservationToOrderDocument({}, reservation);
  const mappedTwice = service.applyReservationToOrderDocument(
    clone(mappedOnce),
    reservation
  );
  assert.deepEqual(stableOrder(mappedTwice), stableOrder(mappedOnce));
  assert.equal(mappedOnce.inventoryAllocationSummary.soldQuantity, 3);
  assert.equal(mappedOnce.inventoryAllocationSummary.branchCount, 1);
  ok('sincronizar dos veces la misma reserva conserva asignaciones idempotentes');

  const shippedAt = new Date('2026-08-27T11:00:00.000Z');
  const shipmentOrder = clone(mappedOnce);
  shipmentOrder.inventoryAllocations[0]._id = 'allocation-1';
  service.advanceOrderInventoryAllocationsForShipment(
    shipmentOrder,
    ['allocation-1'],
    'shipped',
    shippedAt
  );
  const firstShipmentState = stableOrder(shipmentOrder);
  service.advanceOrderInventoryAllocationsForShipment(
    shipmentOrder,
    ['allocation-1'],
    'shipped',
    new Date('2026-08-27T12:00:00.000Z')
  );
  assert.deepEqual(stableOrder(shipmentOrder), firstShipmentState);
  assert.equal(shipmentOrder.inventoryAllocations[0].shippedQuantity, 3);
  ok('repetir el mismo avance logístico no duplica cantidades ni fechas');

  const returnedAt = new Date('2026-08-27T13:00:00.000Z');
  service.applyReturnsToOrderInventoryAllocations(
    shipmentOrder,
    [{ reservationItem: 'reservation-item-1', quantity: 5 }],
    returnedAt
  );
  assert.equal(shipmentOrder.inventoryAllocations[0].returnedQuantity, 3);
  assert.equal(shipmentOrder.inventoryAllocations[0].status, 'returned');
  assert.equal(shipmentOrder.inventoryAllocationSummary.returnedQuantity, 3);
  ok('las devoluciones permanecen acotadas a la cantidad realmente vendida');

  const trace = [];
  const persistedOrder = {
    async save(options) {
      trace.push(['save', options]);
    },
  };
  const session = { id: 'session-1' };
  const OrderModel = {
    findById(orderId) {
      trace.push(['findById', orderId]);
      return {
        async session(receivedSession) {
          trace.push(['session', receivedSession]);
          return persistedOrder;
        },
      };
    },
  };
  const result = await service.syncOrderInventoryAllocationsFromReservation(
    { ...reservation, order: 'order-1' },
    { session, OrderModel }
  );
  assert.strictEqual(result, persistedOrder);
  assert.deepEqual(trace, [
    ['findById', 'order-1'],
    ['session', session],
    ['save', { session }],
  ]);
  assert.equal(persistedOrder.inventoryAllocationSummary.soldQuantity, 3);
  ok('la sincronización conserva sesión, persistencia y resultado público');

  const hydrateTrace = [];
  const InventoryReservationModel = {
    findOne(filter) {
      hydrateTrace.push(['findOne', filter]);
      return {
        sort(sort) {
          hydrateTrace.push(['sort', sort]);
          return this;
        },
        async session(receivedSession) {
          hydrateTrace.push(['session', receivedSession]);
          return reservation;
        },
      };
    },
  };
  const hydratedOrder = {
    _id: 'order-1',
    orderNumber: 'ORDER-1',
    inventoryControl: { reservationId: 'reservation-1' },
    inventoryAllocations: [],
  };
  await service.hydrateOrderInventoryAllocations(hydratedOrder, {
    session,
    InventoryReservationModel,
  });
  assert.deepEqual(hydrateTrace, [
    ['findOne', { _id: 'reservation-1' }],
    ['sort', { confirmedAt: -1, createdAt: -1 }],
    ['session', session],
  ]);
  assert.equal(hydratedOrder.inventoryAllocations.length, 1);
  await service.hydrateOrderInventoryAllocations(hydratedOrder, {
    session,
    InventoryReservationModel,
  });
  assert.equal(hydrateTrace.length, 3);
  ok('la hidratación consulta una vez y respeta asignaciones ya materializadas');

  console.log(`\n${passed} controles de composición aprobados.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
