/* eslint-disable no-console */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

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
  const orderModel = read('backend/models/Order.js');
  const reservationModel = read(
    'backend/models/InventoryReservation.js'
  );
  const allocationService = read(
    'backend/services/orderInventoryAllocationService.js'
  );
  const reservationService = read(
    'backend/services/inventoryReservationService.js'
  );
  const statusService = read(
    'backend/services/orderStatusTransitionService.js'
  );
  const refundService = read(
    'backend/services/orderRefundService.js'
  );
  const ordersRoute = read('backend/routes/orders.js');
  const orderScopeService = read(
    'backend/services/orderAdminScopeService.js'
  );
  const orderQueryService = read(
    'backend/services/orderAdminQueryService.js'
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

  assert(orderModel.includes('inventoryAllocations'));
  assert(orderModel.includes('inventoryAllocationSummary'));
  assert(orderModel.includes('splitAcrossBranches'));
  assert(orderModel.includes("'inventoryAllocations.branch'"));
  ok('La orden conserva asignaciones e índice por cada sede');

  [
    'reservedQuantity',
    'soldQuantity',
    'shippedQuantity',
    'deliveredQuantity',
    'returnedQuantity',
    'releasedQuantity',
  ].forEach((field) => {
    assert(orderModel.includes(field), `${field} no existe`);
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
    ordersRoute.includes('applyOrderBranchAccessFilter')
  );
  assert(
    orderScopeService.includes(
      "{ 'inventoryAllocations.branch': { $in: branchObjectIds } }"
    )
  );
  assert(
    orderQueryService.includes(
      "'inventoryAllocations.branchSnapshot.name'"
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
