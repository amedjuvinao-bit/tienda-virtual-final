/* eslint-disable no-console */
'use strict';

const assert = require('node:assert/strict');

const {
  buildAuthorizedOrderBody,
} = require('../services/authorizedCartOrderService');
const {
  resolveOrderBranchData,
} = require('../services/orderCreationBranchService');
const {
  assertReservationUsesEligibleBranches,
} = require('../services/orderCreationTransactionService');

const IDS = {
  canonical: '64b000000000000000000101',
  foreign: '64b000000000000000000102',
  inactive: '64b000000000000000000103',
  noStock: '64b000000000000000000104',
  local: '64b000000000000000000105',
  second: '64b000000000000000000106',
  product: '64b000000000000000000201',
};

let passed = 0;

function ok(message) {
  passed += 1;
  console.log(`OK ${passed}: ${message}`);
}

function matches(record, filter = {}) {
  for (const [key, expected] of Object.entries(filter)) {
    const actual = key.split('.').reduce((value, part) => value?.[part], record);
    if (expected && typeof expected === 'object' && '$in' in expected) {
      if (!expected.$in.map(String).includes(String(actual))) return false;
      continue;
    }
    if (expected && typeof expected === 'object' && '$ne' in expected) {
      if (actual === expected.$ne) return false;
      continue;
    }
    if (String(actual ?? '') !== String(expected ?? '')) return false;
  }
  return true;
}

function queryFor(records, filter) {
  const query = {
    select() {
      return query;
    },
    session() {
      return query;
    },
    lean() {
      return query;
    },
    async exec() {
      return records.filter((record) => matches(record, filter));
    },
  };
  return query;
}

function modelFor(records) {
  return {
    find(filter = {}) {
      return queryFor(records, filter);
    },
    findOne(filter = {}) {
      const query = queryFor(records, filter);
      const originalExec = query.exec;
      query.exec = async () => (await originalExec())[0] || null;
      return query;
    },
  };
}

function branch(_id, overrides = {}) {
  return {
    _id,
    name: `Sede ${_id.slice(-3)}`,
    code: `BR-${_id.slice(-3)}`,
    type: 'store',
    active: true,
    status: 'active',
    deletedAt: null,
    isDefaultForOnlineOrders: false,
    isMain: false,
    settings: { allowInventoryMovements: true },
    address: { city: 'Bogotá', department: 'Cundinamarca' },
    ...overrides,
  };
}

function stock(branchId, quantity, overrides = {}) {
  return {
    branch: branchId,
    product: IDS.product,
    variantKey: 'default__default',
    stock: quantity,
    reservedStock: 0,
    active: true,
    deletedAt: null,
    ...overrides,
  };
}

const oneItem = [
  {
    productId: IDS.product,
    variantKey: 'default__default',
    quantity: 2,
  },
];

async function resolve({ branches, stocks, rawBody = {}, cleaned = {}, items = oneItem }) {
  return resolveOrderBranchData(rawBody, cleaned, {
    reservableItems: items,
    BranchModel: modelFor(branches),
    InventoryStockModel: modelFor(stocks),
  });
}

async function main() {
  const authorized = buildAuthorizedOrderBody(
    {
      payment: { provider: 'wompi' },
      branch: IDS.foreign,
      branchId: IDS.inactive,
      defaultBranch: IDS.noStock,
    },
    { items: [] },
    'server-session',
    { provider: 'wompi', status: 'pending_gateway', currency: 'COP' }
  );
  assert.equal(Object.hasOwn(authorized, 'branch'), false);
  assert.equal(Object.hasOwn(authorized, 'branchId'), false);
  assert.equal(Object.hasOwn(authorized, 'defaultBranch'), false);
  ok('la lista positiva pública elimina toda sede enviada por el comprador');

  const canonicalBranches = [
    branch(IDS.foreign),
    branch(IDS.inactive, { active: false, status: 'inactive' }),
    branch(IDS.noStock),
    branch(IDS.canonical, { isDefaultForOnlineOrders: true }),
  ];
  const canonicalStocks = [
    stock(IDS.foreign, 5),
    stock(IDS.inactive, 99),
    stock(IDS.noStock, 0),
    stock(IDS.canonical, 5),
  ];
  const canonical = await resolve({
    branches: canonicalBranches,
    stocks: canonicalStocks,
    rawBody: { branch: IDS.foreign },
  });
  assert.equal(String(canonical.branchId), IDS.canonical);
  ok('una sede ajena enviada por el cliente no reemplaza la sede canónica');
  assert.equal(canonical.eligibleBranchIds.includes(IDS.inactive), false);
  ok('una sede inactiva queda fuera de la lista elegible aunque tenga stock');
  assert.equal(canonical.eligibleBranchIds.includes(IDS.noStock), false);
  ok('una sede activa sin disponibilidad no se presenta como elegible');

  const reversed = await resolve({
    branches: [...canonicalBranches].reverse(),
    stocks: [...canonicalStocks].reverse(),
    rawBody: { defaultBranch: IDS.foreign },
  });
  assert.equal(String(reversed.branchId), IDS.canonical);
  assert.deepEqual(reversed.branchPriorityIds, canonical.branchPriorityIds);
  ok('la selección es determinista e independiente del orden de MongoDB');

  const coverage = await resolve({
    branches: [
      branch(IDS.canonical, { isDefaultForOnlineOrders: true }),
      branch(IDS.local, {
        address: { city: 'Medellín', department: 'Antioquia' },
      }),
    ],
    stocks: [stock(IDS.canonical, 5), stock(IDS.local, 5)],
    cleaned: { customer: { city: 'Medellín', department: 'Antioquia' } },
  });
  assert.equal(String(coverage.branchId), IDS.local);
  ok('entre sedes con stock completo se prioriza la cobertura del destino');

  const multisite = await resolve({
    branches: [
      branch(IDS.canonical, { isDefaultForOnlineOrders: true }),
      branch(IDS.second),
    ],
    stocks: [stock(IDS.canonical, 1), stock(IDS.second, 1)],
  });
  assert.equal(String(multisite.branchId), IDS.canonical);
  assert.deepEqual(multisite.branchPriorityIds, [IDS.canonical, IDS.second]);
  assert.equal(multisite.selectionReason, 'multi_branch_stock');
  ok('dos sedes elegibles conservan la reserva multisede 1 + 1');

  await assert.rejects(
    resolve({
      branches: [
        branch(IDS.inactive, { active: false, status: 'inactive' }),
        branch(IDS.noStock),
      ],
      stocks: [stock(IDS.inactive, 20), stock(IDS.noStock, 0)],
      rawBody: { branchId: IDS.inactive },
    }),
    (error) =>
      error.code === 'INSUFFICIENT_STOCK' &&
      error.details?.reason === 'NO_ELIGIBLE_BRANCH_STOCK'
  );
  ok('stock de una sede inactiva no autoriza una compra');

  assert.doesNotThrow(() =>
    assertReservationUsesEligibleBranches(
      { items: [{ branch: IDS.canonical }, { branch: IDS.second }] },
      { eligibleBranchIds: [IDS.canonical, IDS.second] }
    )
  );
  assert.throws(
    () =>
      assertReservationUsesEligibleBranches(
        { items: [{ branch: IDS.canonical }, { branch: IDS.inactive }] },
        { eligibleBranchIds: [IDS.canonical] }
      ),
    (error) =>
      error.code === 'INSUFFICIENT_STOCK' &&
      error.details?.reason === 'RESERVATION_USED_INELIGIBLE_BRANCH'
  );
  ok('la transacción rechaza cualquier asignación fuera de la lista elegible');

  const digital = await resolve({
    branches: [
      branch(IDS.foreign),
      branch(IDS.canonical, { isDefaultForOnlineOrders: true }),
    ],
    stocks: [],
    rawBody: { branch: IDS.foreign },
    items: [],
  });
  assert.equal(String(digital.branchId), IDS.canonical);
  assert.equal(digital.selectionReason, 'online_default');
  ok('órdenes sin inventario usan la sede online del servidor');

  console.log(`\nAutoridad de sede en Checkout: ${passed}/10 controles aprobados.`);
}

main().catch((error) => {
  console.error('\nFALLO autoridad de sede en Checkout:', error);
  process.exitCode = 1;
});
