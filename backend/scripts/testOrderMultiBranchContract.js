/* eslint-disable no-console */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Order = require('../models/Order');
const {
  buildAdminOrderFilter,
} = require('../services/orderAdminQueryService');
const { hasExactIndex } = require('./lib/orderSchemaContract');

const ROOT = path.resolve(__dirname, '..', '..');
let passed = 0;

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function ok(label) {
  passed += 1;
  console.log(`OK  ${label}`);
}

function run() {
  const orderSchema = Order.schema;
  const reservationModel = read(
    'backend/models/InventoryReservation.js'
  );
  const allocationService = [
    'backend/services/orderInventoryAllocationService.js',
    'backend/services/orderInventoryAllocation/fulfillment.js',
  ].map(read).join('\n');
  const reservationService = [
    'backend/services/inventoryReservationService.js',
    'backend/services/inventoryReservation/stockReservation.js',
    'backend/services/inventoryReservation/releaseReservation.js',
    'backend/services/inventoryReservation/confirmReservation.js',
    'backend/services/inventoryReservation/expireReservations.js',
  ].map(read).join('\n');
  const statusService = [
    'backend/services/orderStatusTransitionService.js',
    'backend/services/orderStatus/operationalEffects.js',
    'backend/services/orderStatus/singleTransition.js',
  ].map(read).join('\n');
  const refundService = [
    'backend/services/orderRefunds/refundInventoryService.js',
    'backend/services/orderRefunds/refundInventoryAllocationService.js',
    'backend/services/orderRefunds/refundInventoryDemandService.js',
    'backend/services/orderRefunds/refundInventoryRestorationService.js',
    'backend/services/orderRefunds/refundTransactionService.js',
  ].map(read).join('\n');
  const ordersRoute = read('backend/routes/orders.js');
  const orderDetailController = read(
    'backend/controllers/orderAdminDetailController.js'
  );
  const orderScopeService = read(
    'backend/services/orderAdminScopeService.js'
  );
  const detailView = read(
    'frontend/src/admin/orders/components/orderDetail/OrderDetailProfessionalView.jsx'
  );
  const allocationPanel = read(
    'frontend/src/admin/orders/components/orderDetail/OrderDetailInventoryAllocations.jsx'
  );
  const workflow = read('.github/workflows/products-ci.yml');
  const packageJson = JSON.parse(
    read('backend/package.json')
  );

  assert.strictEqual(orderSchema.path('inventoryAllocations')?.instance, 'Array');
  assert.ok(
    orderSchema.path('inventoryAllocations')?.schema,
    'inventoryAllocations no contiene subdocumentos'
  );
  assert.strictEqual(
    orderSchema.path('inventoryAllocationSummary')?.instance,
    'Embedded'
  );
  assert.strictEqual(
    orderSchema.path('inventoryAllocationSummary.splitAcrossBranches')?.instance,
    'Boolean'
  );
  assert.ok(
    hasExactIndex(orderSchema, {
      'inventoryAllocations.branch': 1,
      createdAt: -1,
    })
  );
  ok('La orden conserva asignaciones e índice por cada sede');

  [
    'reservedQuantity',
    'soldQuantity',
    'shippedQuantity',
    'deliveredQuantity',
    'returnedQuantity',
    'releasedQuantity',
  ].forEach((field) => {
    assert.strictEqual(
      orderSchema.path(`inventoryAllocations.${field}`)?.instance,
      'Number',
      `inventoryAllocations.${field} no existe`
    );
    assert.strictEqual(
      orderSchema.path(`inventoryAllocationSummary.${field}`)?.instance,
      'Number',
      `inventoryAllocationSummary.${field} no existe`
    );
  });
  ok('Las cantidades operativas quedan separadas y auditables');

  assert(reservationModel.includes('orderItem'));
  assert(reservationService.includes('orderItem:'));
  assert(
    reservationService.includes(
      'syncOrderInventoryAllocationsFromReservation'
    )
  );
  ok('Cada parte reservada conserva su línea y se copia a la orden');

  assert(
    statusService.includes('applyReservationToOrderDocument')
  );
  assert(
    statusService.includes('advanceOrderInventoryAllocations')
  );
  assert(
    allocationService.includes(
      "['shipped', 'delivered'].includes"
    )
  );
  ok('Pago, liberación, envío y entrega actualizan las sedes');

  assert(
    refundService.includes(
      'applyReturnsToOrderInventoryAllocations'
    )
  );
  assert(refundService.includes('reservationItem:'));
  ok('Las devoluciones regresan a la asignación de origen');

  assert(
    orderDetailController.includes('applyOrderBranchAccessFilter') &&
      ordersRoute.includes('getAdminOrderDetail')
  );
  assert(
    orderScopeService.includes(
      "{ 'inventoryAllocations.branch': { $in: branchObjectIds } }"
    )
  );
  const searchFilter = buildAdminOrderFilter({
    adminRole: 'owner',
    query: { q: 'Sede Norte' },
  });
  assert.strictEqual(searchFilter.ok, true);
  assert(
    searchFilter.filter.$or.some(
      (criterion) =>
        criterion['inventoryAllocations.branchSnapshot.name'] instanceof RegExp
    )
  );
  ok('Filtros, búsqueda y permisos reconocen todas las sedes');

  assert(
    detailView.includes('OrderDetailInventoryAllocations')
  );
  assert(allocationPanel.includes('Preparación por sedes'));
  assert(allocationPanel.includes('Despachadas'));
  assert(allocationPanel.includes('Devueltas'));
  ok('El detalle muestra la distribución real sin sede falsa');

  assert(
    packageJson.scripts['test:order-multi-branch-contract']
  );
  assert(
    packageJson.scripts['test:order-multi-branch-inventory']
  );
  assert(workflow.includes('Validar contrato multisede'));
  assert(workflow.includes('Validar órdenes multisede'));
  ok('CI protege el contrato y el flujo transaccional multisede');

  console.log(
    `\nContrato de órdenes multisede: ${passed}/8 verificaciones aprobadas.`
  );
}

try {
  run();
} catch (error) {
  console.error(
    '\nFALLO contrato de órdenes multisede:',
    error.message
  );
  process.exitCode = 1;
}
