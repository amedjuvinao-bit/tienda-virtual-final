/* eslint-disable no-console */
'use strict';

require('dotenv').config({
  path: require('path').join(__dirname, '..', '.env'),
  quiet: true,
});

const mongoose = require('mongoose');

const Order = require('../models/Order');
const {
  summarizeInventoryAllocations,
} = require('../services/orderInventoryAllocationService');
const {
  logisticsEligibility,
} = require('../services/orderLogisticsService');
const {
  assertPersistentConfirmation,
  buildOrderDraft,
  buildRunId,
  loadCandidates,
  parseArgs,
} = require('./seedPersistentOrdersTrace');

const BLOCKED_MESSAGE =
  'Disponible cuando el pago esté confirmado y exista inventario vendido.';

const ELIGIBILITY_SCENARIOS = Object.freeze([
  Object.freeze({
    key: 'eligibility_blocked',
    label: 'PRUEBA logística bloqueada — pago pendiente',
    status: 'pending',
    paymentStatus: 'pending_gateway',
    allocationState: 'released',
    expectedCanInitialize: false,
    expectedCode: 'ORDER_PAYMENT_REQUIRED_FOR_LOGISTICS',
    expectedMessage: BLOCKED_MESSAGE,
  }),
  Object.freeze({
    key: 'eligibility_ready',
    label: 'PRUEBA logística habilitada — inventario vendido',
    status: 'paid',
    paymentStatus: 'paid',
    allocationState: 'sold',
    expectedCanInitialize: true,
    expectedCode: null,
    expectedMessage:
      'Pago confirmado e inventario vendido disponibles para preparar.',
  }),
]);

function buildEligibilityRunId(options = {}) {
  return buildRunId(options).replace(/^ord_trace/, 'ord_elig');
}

function buildEligibilityTracePlan({
  runId,
  candidates,
  now = new Date(),
} = {}) {
  if (!runId) throw new Error('Falta el identificador de la prueba logística.');
  const physicalCandidates = (Array.isArray(candidates) ? candidates : []).filter(
    (candidate) => candidate?.product?.productType === 'physical'
  );
  if (physicalCandidates.length < 1) {
    throw new Error('Se necesita al menos una existencia física elegible.');
  }

  return ELIGIBILITY_SCENARIOS.map((scenario, index) => ({
    ...scenario,
    sequence: index + 1,
    candidates: [physicalCandidates[index % physicalCandidates.length]],
    activityAt: new Date(now.getTime() - index * 60 * 1000),
  }));
}

function buildEligibilityOrderDraft(entry, runId) {
  const draft = buildOrderDraft(entry, runId);
  draft.tags = Array.from(
    new Set([
      ...(Array.isArray(draft.tags) ? draft.tags : []),
      'logistics-eligibility',
      entry.expectedCanInitialize ? 'preparation-enabled' : 'preparation-blocked',
    ])
  );
  draft.timeline[0].message =
    `Prueba visual de elegibilidad creada: ${entry.label}. ` +
    'No afecta inventario, caja, pasarelas, facturación ni transportadoras.';
  draft.notes[0].text =
    `PRUEBA VISUAL PERSISTENTE ${runId}. ` +
    `Resultado esperado: ${entry.expectedCanInitialize ? 'PREPARAR LOGÍSTICA HABILITADO' : 'PREPARAR LOGÍSTICA BLOQUEADO'}. ` +
    'No facturar ni despachar físicamente.';
  return draft;
}

function prepareOrderDocument(order) {
  order.inventoryAllocations.forEach((allocation, index) => {
    allocation.orderItem =
      order.items[index]?._id || order.items[0]?._id || null;
  });
  order.inventoryAllocationSummary = summarizeInventoryAllocations(
    order.inventoryAllocations
  );
  return order;
}

function assertExpectedEligibility(order, entry) {
  const view = logisticsEligibility(order);
  if (
    view.canInitialize !== entry.expectedCanInitialize ||
    view.code !== entry.expectedCode ||
    view.message !== entry.expectedMessage
  ) {
    const error = new Error(
      `La orden ${entry.label} no cumple la elegibilidad esperada.`
    );
    error.code = 'ORDERS_LOGISTICS_ELIGIBILITY_TRACE_MISMATCH';
    error.details = { expected: entry, received: view };
    throw error;
  }
  return view;
}

async function persistEligibilityTraceEntry(entry, runId) {
  const order = prepareOrderDocument(
    new Order(buildEligibilityOrderDraft(entry, runId))
  );
  const eligibility = assertExpectedEligibility(order, entry);
  const shipments = order?.fulfillment?.shipments || [];
  if (shipments.length > 0) {
    throw new Error(`La orden ${entry.label} ya contiene envíos antes de la prueba.`);
  }

  await order.save();
  const persisted = await Order.findById(order._id).lean().exec();
  if (
    !persisted ||
    persisted.sessionId !== `${runId}_${entry.key}`.slice(0, 120) ||
    (persisted?.fulfillment?.shipments || []).length > 0
  ) {
    throw new Error(`No se pudo verificar la orden ${entry.label}.`);
  }

  assertExpectedEligibility(persisted, entry);
  return { order: persisted, eligibility };
}

function printManualGuide(runId, created) {
  const blocked = created.find((item) => !item.eligibility.canInitialize);
  const ready = created.find((item) => item.eligibility.canInitialize);

  console.log('\n=== Guía de validación en el panel ===');
  console.log(`1. Abre Administración > Órdenes y busca: ${runId}`);
  console.log(
    `2. Abre ${blocked.order.orderNumber}: el botón debe estar deshabilitado y mostrar "${BLOCKED_MESSAGE}"`
  );
  console.log(
    `3. Abre ${ready.order.orderNumber}: el botón debe estar habilitado.`
  );
  console.log(
    '4. Pulsa "Preparar logística": debe crearse un envío por sede y aparecer "Iniciar picking".'
  );
  console.log(
    '5. Recarga el detalle: el envío debe conservarse y el botón de preparación ya no debe aparecer.'
  );
}

async function run(options = parseArgs()) {
  assertPersistentConfirmation(options);
  const mongoUri =
    process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DB_URI || '';
  if (!mongoUri) {
    throw new Error('Falta MONGODB_URI, MONGO_URI o DB_URI en backend/.env.');
  }

  await mongoose.connect(mongoUri);
  const now = new Date();
  const runId = buildEligibilityRunId({ now, label: options.label });
  const beforeCount = await Order.countDocuments({}).exec();
  const candidates = await loadCandidates(options.stockLimit);
  const plan = buildEligibilityTracePlan({ runId, candidates, now });

  console.log('\n=== Prueba persistente: elegibilidad de preparación logística ===');
  console.log(`Base: ${mongoose.connection.name}`);
  console.log(`Host: ${mongoose.connection.host}`);
  console.log(`Ejecución trazable: ${runId}`);
  console.log('Seguridad: no modifica existencias, caja, pasarelas, DIAN ni transportadoras.');
  console.log('Persistencia: las dos órdenes DEMO se conservan para revisión visual.\n');

  const created = [];
  for (const entry of plan) {
    const result = await persistEligibilityTraceEntry(entry, runId);
    created.push(result);
    console.log(
      `OK | ${entry.expectedCanInitialize ? 'HABILITADA' : 'BLOQUEADA'} | ` +
      `${result.order.orderNumber} | ${entry.label}`
    );
  }

  const ids = created.map((item) => item.order._id);
  const verified = await Order.countDocuments({ _id: { $in: ids } }).exec();
  const afterCount = await Order.countDocuments({}).exec();
  if (verified !== plan.length || afterCount < beforeCount + plan.length) {
    throw new Error('La verificación final de persistencia no coincide con la prueba.');
  }

  printManualGuide(runId, created);
  console.log('\nPersistencia: CONSERVADA (sin limpieza automática).');

  return {
    runId,
    created: verified,
    beforeCount,
    afterCount,
    orderNumbers: created.map((item) => item.order.orderNumber),
  };
}

async function main() {
  try {
    await run(parseArgs());
  } catch (error) {
    console.error(`\nERROR: ${error.message}`);
    console.error(
      'Toda orden que haya alcanzado a guardarse se conserva para trazabilidad.'
    );
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect().catch(() => {});
    }
  }
}

if (require.main === module) main();

module.exports = {
  BLOCKED_MESSAGE,
  ELIGIBILITY_SCENARIOS,
  assertExpectedEligibility,
  buildEligibilityOrderDraft,
  buildEligibilityRunId,
  buildEligibilityTracePlan,
  prepareOrderDocument,
  printManualGuide,
  run,
};
