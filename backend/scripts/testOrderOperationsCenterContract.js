'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
  buildOperationalSummaryPipeline,
  buildOperationalViewCriteria,
  deriveOrderOperationalView,
  normalizeOperationalView,
} = require('../services/orderAdminQueryService');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (relativePath) =>
  fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
const checks = [];
const ok = (message) => {
  checks.push(message);
  console.log(`OK  ${message}`);
};

function shipment(status, overrides = {}) {
  return {
    status,
    sla: {},
    incidents: [],
    ...overrides,
  };
}

function main() {
  assert.strictEqual(normalizeOperationalView('dispatch'), 'dispatch');
  assert.strictEqual(normalizeOperationalView('campo_inseguro'), 'all');
  assert.strictEqual(buildOperationalViewCriteria('all'), null);
  ok('las vistas operativas aceptan únicamente una lista cerrada');

  const prepare = buildOperationalViewCriteria('prepare');
  assert.ok(prepare.$and);
  assert.ok(JSON.stringify(prepare).includes('ready_to_pick'));
  assert.ok(JSON.stringify(prepare).includes('paid'));
  ok('la cola de preparación exige pago y estado logístico coherente');

  const attention = JSON.stringify(buildOperationalViewCriteria('attention'));
  assert.ok(attention.includes('failed'));
  assert.ok(attention.includes('incidents'));
  assert.ok(attention.includes('breachedAt'));
  ok('la atención inmediata reúne fallos, incidencias y compromisos SLA');

  const now = new Date('2026-08-13T16:00:00.000Z');
  const paid = deriveOrderOperationalView(
    {
      status: 'paid',
      inventoryAllocations: [{ soldQuantity: 2, returnedQuantity: 0 }],
    },
    now
  );
  assert.strictEqual(paid.queue, 'prepare');
  assert.strictEqual(paid.nextAction, 'Preparar logística');
  assert.strictEqual(paid.urgency, 'high');
  ok('una orden pagada sin envíos expone la preparación como siguiente acción');

  const digitalOnly = deriveOrderOperationalView({ status: 'paid' }, now);
  assert.notStrictEqual(digitalOnly.queue, 'prepare');
  const confirmedProcessing = deriveOrderOperationalView(
    {
      status: 'processing',
      payment: { status: 'paid' },
      inventoryAllocations: [{ soldQuantity: 1, returnedQuantity: 0 }],
    },
    now
  );
  assert.strictEqual(confirmedProcessing.queue, 'prepare');
  ok('la bodega excluye entregas digitales y reconoce pagos confirmados por su autoridad');

  const incident = deriveOrderOperationalView(
    {
      status: 'paid',
      fulfillment: {
        shipments: [
          shipment('exception', {
            incidents: [{ status: 'open', type: 'damaged' }],
          }),
        ],
      },
    },
    now
  );
  assert.strictEqual(incident.queue, 'incidents');
  assert.strictEqual(incident.openIncidentCount, 1);
  assert.strictEqual(incident.urgency, 'critical');
  ok('las incidencias abiertas dominan la prioridad comercial');

  const packed = deriveOrderOperationalView(
    {
      status: 'paid',
      fulfillment: { shipments: [shipment('packed')] },
    },
    now
  );
  assert.strictEqual(packed.queue, 'dispatch');
  assert.strictEqual(packed.nextAction, 'Registrar despacho');
  ok('un paquete listo queda en la cola de despacho');

  const transit = deriveOrderOperationalView(
    {
      status: 'shipped',
      fulfillment: { shipments: [shipment('in_transit')] },
    },
    now
  );
  assert.strictEqual(transit.queue, 'transit');
  assert.strictEqual(transit.nextAction, 'Confirmar entrega');
  assert.ok(transit.progress >= 80);
  ok('el tránsito presenta seguimiento y avance operativo');

  const overdue = deriveOrderOperationalView(
    {
      status: 'paid',
      fulfillment: {
        shipments: [
          shipment('picking', {
            sla: { pickingDueAt: new Date('2026-08-13T14:00:00.000Z') },
          }),
        ],
      },
    },
    now
  );
  assert.strictEqual(overdue.queue, 'sla_risk');
  assert.strictEqual(overdue.sla.state, 'breached');
  assert.strictEqual(overdue.urgency, 'critical');
  ok('el listado detecta un SLA vencido aunque aún no se haya recalculado el documento');

  const pipeline = buildOperationalSummaryPipeline(now);
  const group = pipeline.find((stage) => stage.$group)?.$group;
  assert.ok(group?.attention);
  assert.ok(group?.prepare);
  assert.ok(group?.dispatch);
  assert.ok(group?.incidents);
  assert.ok(group?.slaRisk);
  ok('MongoDB calcula los contadores operativos sin recorrer órdenes en React');

  const adminSource = read('frontend/src/admin/OrdersAdmin.jsx');
  const boardSource = read(
    'frontend/src/admin/orders/components/OrdersQuickViews.jsx'
  );
  const tableSource = read(
    'frontend/src/admin/orders/components/OrdersTable.jsx'
  );
  assert.ok(adminSource.includes('operationalView'));
  assert.ok(adminSource.includes('operationalSummary'));
  assert.ok(!boardSource.includes('createPortal'));
  assert.ok(boardSource.includes('Centro de operaciones'));
  ok('el tablero dejó de ser flotante y se integra al flujo principal');

  assert.ok(tableSource.includes('Vista compacta'));
  assert.ok(tableSource.includes('operational.nextAction'));
  assert.ok(tableSource.includes('formatSla'));
  assert.ok(tableSource.includes('Gestionar'));
  assert.ok(tableSource.includes('<table'));
  assert.ok(tableSource.includes('xl:table'));
  assert.ok(tableSource.includes('grid grid-cols-2'));
  assert.ok(boardSource.includes('Cola operativa'));
  assert.ok(boardSource.includes('xl:grid-cols-9'));
  assert.ok(adminSource.includes('.orders-control-toggle'));
  assert.ok(adminSource.includes('position: fixed'));
  assert.ok(adminSource.includes('backdrop-filter: blur(18px)'));
  assert.ok(adminSource.includes('CONTROL_TOGGLE_POSITION_KEY'));
  assert.ok(adminSource.includes('createPortal(controlToggleButton, document.body)'));
  assert.ok(adminSource.includes('onPointerMove={handleControlTogglePointerMove}'));
  assert.ok(adminSource.includes('grid-area: controls'));
  assert.ok(adminSource.includes('overflow: visible'));
  assert.ok(!adminSource.includes('overflow-y: auto'));
  ok('la bandeja ofrece tabla semántica, densidad, prioridad y adaptación por pantalla');

  const workflow = read('.github/workflows/products-ci.yml');
  assert.ok(workflow.includes('test:orders-operations'));
  ok('CI protege el contrato del centro operativo');

  console.log(
    `\nCentro operativo de Órdenes: ${checks.length}/${checks.length} controles superados.`
  );
}

try {
  main();
} catch (error) {
  console.error('\nFALLO centro operativo de Órdenes:', error);
  process.exitCode = 1;
}
