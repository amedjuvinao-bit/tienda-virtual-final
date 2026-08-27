'use strict';

/* eslint-disable no-console */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const sift = require('sift').default || require('sift');

const {
  buildScopedOrderFilter,
} = require('../services/orderAdminScopeService');
const {
  buildOrderOperationFilter,
} = require('../services/orderRouteAccessService');
const {
  createOrderBranchPresentationScope,
  scopeOrderForBranchPresentation,
} = require('../services/orderBranchPresentationScopeService');
const {
  logisticsView,
} = require('../services/orderLogisticsService');
const {
  applyAllowedBranchScope,
} = require('../services/inventoryReservation/stockReservation');
const {
  assertReplacementOrderBranchScope,
} = require('../services/orderReturns/exchangeBranchScope');

const ROOT = path.resolve(__dirname, '..', '..');
const BRANCH_A = '64b000000000000000000001';
const BRANCH_B = '64b000000000000000000002';
const ORDER_ID = '64c000000000000000000001';
let passed = 0;

function ok(message) {
  passed += 1;
  console.log(`OK  ${message}`);
}

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function objectId(value) {
  return new mongoose.Types.ObjectId(value);
}

function branchOperator(overrides = {}) {
  return {
    query: {},
    adminRole: 'operator',
    adminBranches: [
      {
        branch: objectId(BRANCH_A),
        canManageInventory: true,
        canInvoice: true,
      },
      {
        branch: objectId(BRANCH_B),
        canManageInventory: false,
        canInvoice: false,
      },
    ],
    adminDefaultBranch: objectId(BRANCH_A),
    ...overrides,
  };
}

function mixedOrder() {
  return {
    _id: objectId(ORDER_ID),
    orderNumber: 'ORDER-A-B',
    status: 'paid',
    fulfillmentStatus: 'processing',
    branch: objectId(BRANCH_A),
    branchSnapshot: {
      name: 'Sede A',
      address: 'Dirección visible A',
    },
    inventoryAllocations: [
      {
        _id: objectId('64d000000000000000000001'),
        branch: objectId(BRANCH_A),
        branchSnapshot: { name: 'Sede A', address: 'Dirección visible A' },
        soldQuantity: 1,
        returnedQuantity: 0,
      },
      {
        _id: objectId('64d000000000000000000002'),
        branch: objectId(BRANCH_B),
        branchSnapshot: { name: 'Sede B', address: 'SECRETO-DIRECCION-B' },
        soldQuantity: 1,
        returnedQuantity: 0,
      },
    ],
    inventoryAllocationSummary: {
      allocationCount: 2,
      branchCount: 2,
      branchIds: [objectId(BRANCH_A), objectId(BRANCH_B)],
      soldQuantity: 2,
    },
    fulfillment: {
      logisticsSummary: { shipmentCount: 2, activeCount: 2 },
      shipments: [
        {
          _id: objectId('64e000000000000000000001'),
          branch: objectId(BRANCH_A),
          branchSnapshot: { name: 'Sede A', address: 'Dirección visible A' },
          status: 'ready_to_pick',
          carrier: { trackingNumber: 'TRACK-A' },
          incidents: [],
          sla: {},
        },
        {
          _id: objectId('64e000000000000000000002'),
          branch: objectId(BRANCH_B),
          branchSnapshot: { name: 'Sede B', address: 'SECRETO-DIRECCION-B' },
          status: 'in_transit',
          carrier: { trackingNumber: 'SECRETO-TRACK-B' },
          incidents: [{ status: 'open', description: 'SECRETO-INCIDENTE-B' }],
          sla: {},
        },
      ],
    },
  };
}

function verifyCapabilities() {
  const visible = buildScopedOrderFilter(branchOperator(), {});
  assert.strictEqual(visible.ok, true);
  assert.deepStrictEqual(new Set(visible.branchIds), new Set([BRANCH_A, BRANCH_B]));

  const inventory = buildScopedOrderFilter(branchOperator(), {}, {
    requestedBranchId: '',
    requiredCapability: 'canManageInventory',
  });
  assert.strictEqual(inventory.ok, true);
  assert.deepStrictEqual(inventory.branchIds, [BRANCH_A]);

  const invoice = buildScopedOrderFilter(branchOperator(), {}, {
    requestedBranchId: '',
    requiredCapability: 'canInvoice',
  });
  assert.strictEqual(invoice.ok, true);
  assert.deepStrictEqual(invoice.branchIds, [BRANCH_A]);

  const denied = buildScopedOrderFilter(
    branchOperator({
      adminBranches: [
        {
          branch: objectId(BRANCH_A),
          canManageInventory: false,
          canInvoice: false,
        },
      ],
    }),
    {},
    { requestedBranchId: '', requiredCapability: 'canManageInventory' }
  );
  assert.strictEqual(denied.ok, false);
  assert.strictEqual(denied.error, 'BRANCH_CAPABILITY_REQUIRED');
  const staleDefault = buildScopedOrderFilter(
    branchOperator({ adminBranches: [] }),
    {}
  );
  assert.strictEqual(staleDefault.ok, false);
  assert.strictEqual(staleDefault.error, 'NO_BRANCH_ASSIGNED');
  ok('canManageInventory y canInvoice se aplican por sede y fallan cerrados');
}

function verifyTransactionalWholeOrderFilter() {
  const access = buildOrderOperationFilter(branchOperator(), ORDER_ID, {
    requireWholeOrder: true,
  });
  assert.strictEqual(access.ok, true);
  assert.strictEqual(sift(access.filter)(mixedOrder()), true);

  const onlyA = branchOperator({
    adminBranches: [
      {
        branch: objectId(BRANCH_A),
        canManageInventory: true,
        canInvoice: true,
      },
    ],
  });
  const restricted = buildOrderOperationFilter(onlyA, ORDER_ID, {
    requireWholeOrder: true,
  });
  assert.strictEqual(restricted.ok, true);
  assert.strictEqual(sift(restricted.filter)(mixedOrder()), false);

  const global = buildOrderOperationFilter(
    branchOperator({ adminRole: 'owner', adminBranches: [] }),
    ORDER_ID,
    { requireWholeOrder: true, requiredCapability: 'canManageInventory' }
  );
  assert.strictEqual(global.ok, true);
  assert.strictEqual(sift(global.filter)(mixedOrder()), true);
  ok('el filtro transaccional bloquea hechos globales A+B al operador solo A');
}

function verifyScopedDtos() {
  const access = buildScopedOrderFilter(
    branchOperator({
      adminBranches: [
        {
          branch: objectId(BRANCH_A),
          canManageInventory: true,
          canInvoice: true,
        },
      ],
    }),
    {}
  );
  const scope = createOrderBranchPresentationScope(access);
  const scoped = scopeOrderForBranchPresentation(mixedOrder(), scope);
  const serialized = JSON.stringify(scoped);

  assert.strictEqual(scoped.inventoryAllocations.length, 1);
  assert.strictEqual(scoped.fulfillment.shipments.length, 1);
  assert.strictEqual(scoped.inventoryAllocationSummary, null);
  assert.strictEqual(scoped.fulfillment.logisticsSummary, null);
  assert.ok(serialized.includes('TRACK-A'));
  for (const forbidden of [
    'SECRETO-TRACK-B',
    'SECRETO-DIRECCION-B',
    'SECRETO-INCIDENTE-B',
  ]) {
    assert.ok(!serialized.includes(forbidden), forbidden);
  }
  const detailController = read(
    'backend/controllers/orderAdminDetailController.js'
  );
  const listEnrichment = read(
    'backend/services/orderAdminQuery/enrichment.js'
  );
  assert.ok(detailController.includes('scopeOrderForBranchPresentation'));
  assert.ok(listEnrichment.includes('scopeOrderForBranchPresentation'));
  ok('listado y detalle eliminan asignación, dirección, tracking e incidente de B');
}

function verifyScopedLogistics() {
  const scoped = logisticsView(mixedOrder(), new Date('2026-08-27T12:00:00Z'), {
    authorizedBranchIds: [BRANCH_A],
    allowAllBranches: false,
  });
  assert.strictEqual(scoped.shipments.length, 1);
  assert.strictEqual(scoped.summary.shipmentCount, 1);
  assert.strictEqual(scoped.summary.readyCount, 1);
  assert.ok(!JSON.stringify(scoped).includes('SECRETO-TRACK-B'));

  const global = logisticsView(
    mixedOrder(),
    new Date('2026-08-27T12:00:00Z'),
    { allowAllBranches: true }
  );
  assert.strictEqual(global.shipments.length, 2);
  assert.strictEqual(global.summary.shipmentCount, 2);
  ok('logística resume solo sedes autorizadas y conserva la vista global');
}

function verifyMutationWiring() {
  const logisticsController = read('backend/controllers/orderLogisticsController.js');
  const mutationController = read('backend/controllers/orderAdminMutationController.js');
  const bulkController = read('backend/controllers/orderBulkController.js');
  const customerController = read('backend/controllers/orderCustomerDataController.js');
  const serviceController = read(
    'backend/controllers/orderFulfillmentServiceController.js'
  );
  const statusTransition = read('backend/services/orderStatus/singleTransition.js');
  const returnController = [
    'backend/controllers/orderReturnController.js',
    'backend/controllers/orderReturns/shared.js',
    'backend/controllers/orderReturns/adminController.js',
  ]
    .map(read)
    .join('\n');
  const emailController = read('backend/controllers/orderEmailController.js');
  const notificationOrchestrator = read(
    'backend/services/orderCustomerNotificationOrchestrator.js'
  );

  assert.ok(logisticsController.includes("requiredCapability: 'canManageInventory'"));
  assert.ok(mutationController.includes('requireWholeOrder: true'));
  assert.ok(mutationController.includes("requiredCapability: 'canManageInventory'"));
  assert.ok(mutationController.includes('orderFilter: access.filter'));
  assert.ok(bulkController.includes('requireWholeOrder: true'));
  assert.ok(bulkController.includes("requiredCapability: 'canManageInventory'"));
  assert.ok(bulkController.includes('orderFilter: selectionFilter'));
  assert.ok(customerController.includes('requireWholeOrder: true'));
  assert.ok(serviceController.includes('requireWholeOrder: true'));
  assert.ok(returnController.includes('wholeOrderAccessOptions'));
  assert.ok(returnController.includes("wholeOrderAccessOptions('canManageInventory')"));
  assert.ok(returnController.includes("wholeOrderAccessOptions('canInvoice')"));
  assert.ok(emailController.includes('requireWholeOrder: true'));
  assert.ok(notificationOrchestrator.includes('requireWholeOrder: true'));
  assert.ok(statusTransition.includes('OrderModel.findOne({ ...orderFilter, _id: orderId })'));
  ok('estado, acciones masivas, cliente, fulfillment y RMA llevan el scope a la escritura');
}

function verifyReturnWholeOrderScope() {
  const onlyA = branchOperator({
    adminBranches: [
      {
        branch: objectId(BRANCH_A),
        canManageInventory: true,
        canInvoice: true,
      },
    ],
  });
  const readAccess = buildScopedOrderFilter(onlyA, { _id: objectId(ORDER_ID) }, {
    requestedBranchId: '',
    requireWholeOrder: true,
  });
  assert.strictEqual(readAccess.ok, true);
  assert.strictEqual(sift(readAccess.filter)(mixedOrder()), false);

  const allAssigned = buildScopedOrderFilter(branchOperator(), {
    _id: objectId(ORDER_ID),
  }, {
    requestedBranchId: '',
    requireWholeOrder: true,
  });
  assert.strictEqual(sift(allAssigned.filter)(mixedOrder()), true);

  for (const requiredCapability of ['canManageInventory', 'canInvoice']) {
    const capabilityAccess = buildScopedOrderFilter(branchOperator(), {
      _id: objectId(ORDER_ID),
    }, {
      requestedBranchId: '',
      requireWholeOrder: true,
      requiredCapability,
    });
    assert.strictEqual(capabilityAccess.ok, true);
    assert.strictEqual(sift(capabilityAccess.filter)(mixedOrder()), false);
  }
  ok('RMA A+B falla cerrado para A-only y para capacidades incompletas');
}

function verifyAutomaticExchangeBranchWhitelist() {
  const scoped = applyAllowedBranchScope(
    { active: true },
    [BRANCH_A]
  );
  assert.strictEqual(
    sift(scoped)({ active: true, branch: objectId(BRANCH_A) }),
    true
  );
  assert.strictEqual(
    sift(scoped)({ active: true, branch: objectId(BRANCH_B) }),
    false
  );
  const global = applyAllowedBranchScope({ active: true }, null);
  assert.strictEqual(
    sift(global)({ active: true, branch: objectId(BRANCH_B) }),
    true
  );
  assert.throws(
    () =>
      assertReplacementOrderBranchScope(
        {
          branch: objectId(BRANCH_A),
          inventoryAllocations: [{ branch: objectId(BRANCH_B) }],
        },
        { authorizedBranchIds: [BRANCH_A], allowAllBranches: false }
      ),
    (error) => error?.code === 'RETURN_EXCHANGE_BRANCH_FORBIDDEN'
  );
  assert.doesNotThrow(() =>
    assertReplacementOrderBranchScope(
      {
        branch: objectId(BRANCH_A),
        inventoryAllocations: [{ branch: objectId(BRANCH_A) }],
      },
      { authorizedBranchIds: [BRANCH_A], allowAllBranches: false }
    )
  );

  const exchangeService = read(
    'backend/services/orderReturns/exchangeResolution.js'
  );
  const reservationService = read(
    'backend/services/inventoryReservation/createReservation.js'
  );
  const stockReservation = read(
    'backend/services/inventoryReservation/stockReservation.js'
  );
  const confirmReservation = read(
    'backend/services/inventoryReservation/confirmReservation.js'
  );
  assert.ok(exchangeService.includes('allowedBranchIds: allowAllBranches'));
  assert.ok(reservationService.includes('allowedBranchIds'));
  assert.ok(stockReservation.includes('applyAllowedBranchScope'));
  assert.ok(stockReservation.includes('allowedBranchIds: allowedBranchObjectIds'));
  assert.ok(confirmReservation.includes('branch: item.branch'));
  ok('el cambio automático consulta y reserva solo inventario de sedes autorizadas');
}

function main() {
  verifyCapabilities();
  verifyTransactionalWholeOrderFilter();
  verifyScopedDtos();
  verifyScopedLogistics();
  verifyMutationWiring();
  verifyReturnWholeOrderScope();
  verifyAutomaticExchangeBranchWhitelist();

  assert.strictEqual(passed, 7);
  console.log(`\nAislamiento multisede de Órdenes: ${passed}/7 controles superados.`);
}

try {
  main();
} catch (error) {
  console.error('\nFALLO aislamiento multisede de Órdenes:', error);
  process.exitCode = 1;
}
