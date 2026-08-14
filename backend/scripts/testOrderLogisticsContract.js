'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const {
  initializeOrderLogistics,
  logisticsEligibility,
  summarizeShipments,
  updateOrderShipment,
} = require('../services/orderLogisticsService');

const checks = [];
function ok(message) {
  checks.push(message);
  console.log(`OK  ${message}`);
}

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', '..', relativePath), 'utf8');
}

function attachIdLookup(shipments) {
  Object.defineProperty(shipments, 'id', {
    configurable: true,
    enumerable: false,
    value(shipmentId) {
      return this.find((shipment) => String(shipment._id) === String(shipmentId));
    },
  });
  return shipments;
}

function branchSnapshot(code) {
  return { name: `Sede ${code}`, code, type: 'warehouse' };
}

function allocation(branch, quantity = 2) {
  return {
    _id: new mongoose.Types.ObjectId(),
    inventoryStock: new mongoose.Types.ObjectId(),
    product: new mongoose.Types.ObjectId(),
    branch,
    branchSnapshot: branchSnapshot(String(branch).slice(-4).toUpperCase()),
    variantKey: 'm__rosa',
    quantity,
    reservedQuantity: quantity,
    soldQuantity: quantity,
    shippedQuantity: 0,
    deliveredQuantity: 0,
    returnedQuantity: 0,
    releasedQuantity: 0,
    status: 'sold',
  };
}

function baseOrder({ branches = [new mongoose.Types.ObjectId()] } = {}) {
  const allocations = branches.map((branch, index) => allocation(branch, index + 1));
  return {
    _id: new mongoose.Types.ObjectId(),
    orderNumber: 'ORD-LOG-001',
    status: 'paid',
    payment: { status: 'paid' },
    fulfillmentStatus: 'processing',
    items: [{ productType: 'physical', requiresShipping: true }],
    inventoryAllocations: allocations,
    inventoryAllocationSummary: {},
    fulfillment: {
      status: 'processing',
      digitalDeliveries: [],
      services: [],
      shipments: attachIdLookup([]),
      logisticsSummary: {},
    },
    timeline: [],
    async save() {},
  };
}

function fakeOrderModel(order) {
  return {
    findOne() {
      return {
        async session() {
          return order;
        },
      };
    },
  };
}

function shipmentFixture(order, branch, allocationId) {
  const shipment = {
    _id: new mongoose.Types.ObjectId(),
    code: 'SHP-LOG-001',
    branch,
    branchSnapshot: branchSnapshot('BOG'),
    allocationIds: [allocationId],
    quantity: 1,
    status: 'ready_to_pick',
    resumeStatus: 'ready_to_pick',
    priority: 'normal',
    revision: 0,
    carrier: {},
    packages: [{ code: 'SHP-LOG-001-P01', weightGrams: 500 }],
    sla: {
      pickingDueAt: new Date('2026-08-13T15:00:00.000Z'),
      dispatchDueAt: new Date('2026-08-14T15:00:00.000Z'),
      deliveryDueAt: new Date('2026-08-16T15:00:00.000Z'),
    },
    incidents: [],
    history: [],
  };
  order.fulfillment.shipments = attachIdLookup([shipment]);
  return shipment;
}

async function update(order, shipment, action, payload = {}, now = new Date('2026-08-13T14:00:00.000Z')) {
  return updateOrderShipment(
    {
      orderFilter: { _id: order._id },
      shipmentId: shipment._id,
      action,
      expectedRevision: shipment.revision,
      payload,
      actor: { displayName: 'Operador de bodega', role: 'warehouse' },
      authorizedBranchIds: [shipment.branch],
      now,
    },
    {
      OrderModel: fakeOrderModel(order),
      session: {},
    }
  );
}

async function main() {
  const modelSource = read('backend/models/Order.js');
  const routeSource = read('backend/routes/orders.js');
  const transitionSource = read('backend/services/orderStatusTransitionService.js');
  const allocationSource = read('backend/services/orderInventoryAllocationService.js');
  const permissionSource = read('backend/security/adminRoutePermissionMap.js');
  const frontendSource = read('frontend/src/admin/orders/components/orderDetail/OrderDetailLogisticsPanel.jsx');

  for (const marker of ['PhysicalShipmentSchema', 'LogisticsIncidentSchema', 'LogisticsSummarySchema', 'revision:', 'allocationIds:', 'deliveryEvidence:']) {
    assert(modelSource.includes(marker), `Falta ${marker}`);
  }
  ok('el modelo conserva envíos multisede, paquetes, evidencia, SLA, incidencias y revisión');

  assert(routeSource.includes("requirePermission('orders:fulfillment')"));
  assert(permissionSource.includes('/api/orders/:id/fulfillment/logistics/shipments/:shipmentId'));
  assert(permissionSource.includes("permission: 'orders:fulfillment'"));
  ok('las mutaciones logísticas tienen permiso granular y mapa RBAC explícito');

  assert(transitionSource.includes('ORDER_LOGISTICS_DISPATCH_REQUIRED'));
  assert(transitionSource.includes('ORDER_LOGISTICS_DELIVERY_REQUIRED'));
  ok('el cambio global de estado no puede saltarse preparación ni evidencia de entrega');

  assert(allocationSource.includes('advanceOrderInventoryAllocationsForShipment'));
  assert(allocationSource.includes('selectedIds.has'));
  ok('despacho y entrega avanzan solo las asignaciones vinculadas al envío');

  const lateSummary = summarizeShipments(
    [{ status: 'picking', sla: { pickingDueAt: new Date('2026-08-13T10:00:00.000Z') } }],
    new Date('2026-08-13T12:00:00.000Z')
  );
  assert.strictEqual(lateSummary.status, 'in_progress');
  assert.strictEqual(lateSummary.slaBreachedCount, 1);
  ok('el resumen detecta compromisos SLA vencidos sin consultar servicios externos');

  const branchA = new mongoose.Types.ObjectId();
  const branchB = new mongoose.Types.ObjectId();
  const initializedOrder = baseOrder({ branches: [branchA, branchB] });
  const initialized = await initializeOrderLogistics(
    {
      orderFilter: { _id: initializedOrder._id },
      authorizedBranchIds: [branchA],
      actor: { displayName: 'Bodega A', role: 'warehouse' },
      now: new Date('2026-08-13T12:00:00.000Z'),
    },
    { OrderModel: fakeOrderModel(initializedOrder), session: {} }
  );
  assert.strictEqual(initialized.shipments.length, 1);
  assert.strictEqual(String(initialized.shipments[0].branch), String(branchA));
  assert.strictEqual(initialized.shipments[0].allocationIds.length, 1);
  ok('la inicialización agrupa por sede y un operador no crea envíos de otra sede');

  const legacyOrder = baseOrder();
  legacyOrder.status = 'delivered';
  legacyOrder.inventoryAllocations[0].shippedQuantity = 1;
  legacyOrder.inventoryAllocations[0].deliveredQuantity = 1;
  const legacy = await initializeOrderLogistics(
    {
      orderFilter: { _id: legacyOrder._id },
      allowAllBranches: true,
      now: new Date('2026-08-13T12:00:00.000Z'),
    },
    { OrderModel: fakeOrderModel(legacyOrder), session: {} }
  );
  assert.strictEqual(legacy.shipments[0].status, 'delivered');
  assert.strictEqual(legacy.shipments[0].initializationSource, 'legacy_allocation_state');
  assert(legacy.shipments[0].history[0].note.includes('históricas'));
  ok('las órdenes históricas se reconstruyen sin retroceder un despacho o entrega existente');

  const unpaid = baseOrder();
  unpaid.status = 'pending';
  unpaid.payment.status = 'pending';
  await assert.rejects(
    () => initializeOrderLogistics(
      { orderFilter: { _id: unpaid._id }, allowAllBranches: true },
      { OrderModel: fakeOrderModel(unpaid), session: {} }
    ),
    (error) => error.code === 'ORDER_PAYMENT_REQUIRED_FOR_LOGISTICS'
  );
  ok('una orden sin pago confirmado no puede entrar a preparación física');

  const unpaidEligibility = logisticsEligibility(unpaid);
  assert.strictEqual(unpaidEligibility.canInitialize, false);
  assert.strictEqual(
    unpaidEligibility.code,
    'ORDER_PAYMENT_REQUIRED_FOR_LOGISTICS'
  );
  assert.strictEqual(
    unpaidEligibility.message,
    'Disponible cuando el pago esté confirmado y exista inventario vendido.'
  );
  ok('la consulta logística explica y bloquea la preparación con pago pendiente');

  const released = baseOrder();
  released.inventoryAllocations[0].soldQuantity = 0;
  released.inventoryAllocations[0].releasedQuantity =
    released.inventoryAllocations[0].quantity;
  released.inventoryAllocations[0].status = 'released';
  const releasedEligibility = logisticsEligibility(released);
  assert.strictEqual(releasedEligibility.canInitialize, false);
  assert.strictEqual(
    releasedEligibility.code,
    'ORDER_LOGISTICS_ALLOCATIONS_REQUIRED'
  );
  assert.strictEqual(
    releasedEligibility.message,
    'Disponible cuando el pago esté confirmado y exista inventario vendido.'
  );
  ok('una reserva liberada sin inventario vendido mantiene la logística deshabilitada');

  const validEligibility = logisticsEligibility(baseOrder());
  assert.strictEqual(validEligibility.canInitialize, true);
  assert.strictEqual(validEligibility.branchCount, 1);
  assert.strictEqual(validEligibility.soldQuantity, 1);
  ok('el pago confirmado con inventario vendido habilita la preparación');

  const refunded = baseOrder();
  refunded.status = 'refunded';
  const refundedEligibility = logisticsEligibility(refunded);
  assert.strictEqual(refundedEligibility.canInitialize, false);
  assert.strictEqual(
    refundedEligibility.code,
    'ORDER_STATUS_BLOCKS_LOGISTICS'
  );
  ok('un estado comercial cerrado mantiene bloqueada la preparación logística');

  const flowOrder = baseOrder();
  const flowAllocation = flowOrder.inventoryAllocations[0];
  const flowShipment = shipmentFixture(flowOrder, flowAllocation.branch, flowAllocation._id);
  await assert.rejects(
    () => update(flowOrder, flowShipment, 'dispatch', { dispatchReference: 'MAN-1' }),
    (error) => error.code === 'INVALID_LOGISTICS_TRANSITION'
  );
  ok('la máquina de estados bloquea despachos que omiten picking y packing');

  await update(flowOrder, flowShipment, 'start_picking');
  await update(flowOrder, flowShipment, 'complete_picking');
  await update(flowOrder, flowShipment, 'start_packing');
  await update(flowOrder, flowShipment, 'complete_packing');
  await assert.rejects(
    () => update(flowOrder, flowShipment, 'dispatch', { carrier: { name: 'Transportadora segura' } }),
    (error) => error.code === 'DISPATCH_EVIDENCE_REQUIRED'
  );
  await update(flowOrder, flowShipment, 'dispatch', {
    carrier: { name: 'Transportadora segura', trackingNumber: 'GUIA-001' },
    dispatchReference: 'MANIFIESTO-001',
  });
  assert.strictEqual(flowOrder.inventoryAllocations[0].shippedQuantity, 1);
  assert.strictEqual(flowOrder.status, 'shipped');
  await update(flowOrder, flowShipment, 'mark_in_transit');
  await assert.rejects(
    () => update(flowOrder, flowShipment, 'deliver'),
    (error) => error.code === 'DELIVERY_EVIDENCE_REQUIRED'
  );
  await update(flowOrder, flowShipment, 'deliver', {
    deliveryReference: 'POD-001',
    recipient: 'Cliente de prueba',
  });
  assert.strictEqual(flowOrder.inventoryAllocations[0].deliveredQuantity, 1);
  assert.strictEqual(flowOrder.status, 'delivered');
  assert.strictEqual(flowOrder.fulfillmentStatus, 'delivered');
  ok('el recorrido completo exige manifiesto y prueba de entrega antes de cerrar la orden');

  const scopedOrder = baseOrder({ branches: [branchA, branchB] });
  const first = scopedOrder.inventoryAllocations[0];
  const second = scopedOrder.inventoryAllocations[1];
  const scopedShipment = shipmentFixture(scopedOrder, first.branch, first._id);
  scopedShipment.status = 'packed';
  await update(scopedOrder, scopedShipment, 'dispatch', {
    carrier: { name: 'Operación propia' },
    dispatchReference: 'SALIDA-SEDE-A',
  });
  assert.strictEqual(scopedOrder.inventoryAllocations[0].shippedQuantity, 1);
  assert.strictEqual(scopedOrder.inventoryAllocations[1].shippedQuantity, 0);
  assert.strictEqual(second.shippedQuantity, 0);
  ok('un despacho parcial no marca como enviada la mercancía de otra sede');

  const incidentOrder = baseOrder();
  const incidentAllocation = incidentOrder.inventoryAllocations[0];
  const incidentShipment = shipmentFixture(incidentOrder, incidentAllocation.branch, incidentAllocation._id);
  await update(incidentOrder, incidentShipment, 'report_incident', {
    incidentType: 'damage',
    severity: 'high',
    description: 'Empaque externo deteriorado.',
  });
  assert.strictEqual(incidentShipment.status, 'exception');
  assert.strictEqual(incidentOrder.fulfillment.status, 'action_required');
  await update(incidentOrder, incidentShipment, 'resolve_incident', {
    resolution: 'Producto verificado y reempacado.',
  });
  assert.strictEqual(incidentShipment.status, 'ready_to_pick');
  assert.strictEqual(incidentShipment.incidents[0].status, 'resolved');
  ok('las incidencias pausan el flujo y exigen una resolución trazable para reanudarlo');

  const revisionOrder = baseOrder();
  const revisionAllocation = revisionOrder.inventoryAllocations[0];
  const revisionShipment = shipmentFixture(revisionOrder, revisionAllocation.branch, revisionAllocation._id);
  await assert.rejects(
    () => updateOrderShipment(
      {
        orderFilter: { _id: revisionOrder._id },
        shipmentId: revisionShipment._id,
        action: 'start_picking',
        expectedRevision: 99,
        authorizedBranchIds: [revisionShipment.branch],
      },
      { OrderModel: fakeOrderModel(revisionOrder), session: {} }
    ),
    (error) => error.code === 'LOGISTICS_REVISION_CONFLICT'
  );
  ok('la revisión optimista evita sobrescribir cambios de otro operador');

  assert(frontendSource.includes('Centro logístico'));
  assert(frontendSource.includes('Plan de transportadora, paquetes y SLA'));
  assert(frontendSource.includes('Reportar incidencia'));
  assert(frontendSource.includes('expectedRevision'));
  assert(frontendSource.includes('eligibility?.canInitialize'));
  assert(frontendSource.includes("eligibility?.message || 'Verificando pago e inventario vendido…'"));
  ok('la interfaz expone el flujo operativo, evidencia, SLA, incidencias y concurrencia');

  console.log(`\nLogística avanzada de órdenes: ${checks.length}/${checks.length} controles superados.`);
}

main().catch((error) => {
  console.error('\nFALLO logística avanzada de órdenes:', error.message);
  process.exitCode = 1;
});
