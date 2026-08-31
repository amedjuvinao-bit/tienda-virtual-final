/* eslint-disable no-console */
'use strict';

require('dotenv').config({
  path: require('path').join(__dirname, '..', '.env'),
  quiet: true,
});

const mongoose = require('mongoose');

const Order = require('../models/Order');
const {
  assertPersistentConfirmation,
  loadCandidates,
  parseArgs,
} = require('./seedPersistentOrdersTrace');
const {
  buildPaymentRunId,
  buildPaymentTracePlan,
} = require('./paymentTraceDemo/plan');
const {
  persistPaymentTraceEntry,
} = require('./paymentTraceDemo/persistence');

function money(value) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function traceSummary(result) {
  return [
    `${result.attempts} intento(s)`,
    `${result.events} evento(s)`,
    `${result.notes} nota(s)`,
    `${result.evidence} evidencia(s)`,
  ].join(', ');
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
  const runId = buildPaymentRunId({ now, label: options.label });
  const candidates = await loadCandidates(options.stockLimit);
  if (!candidates.length) {
    throw new Error(
      'No hay existencias activas con producto y sede válidos para la simulación.'
    );
  }
  const plan = buildPaymentTracePlan({ runId, candidates, now });

  console.log('\n=== Trazabilidad persistente de pagos de Órdenes ===');
  console.log(`Base: ${mongoose.connection.name}`);
  console.log(`Host: ${mongoose.connection.host}`);
  console.log(`Ejecución: ${runId}`);
  console.log(`Escenarios: ${plan.length}`);
  console.log(
    'Seguridad: no llama Wompi, Factus, DIAN, transportadoras ni servicios externos.'
  );
  console.log(
    'Inventario: usa productos existentes como fotografía; no modifica existencias.'
  );
  console.log('Persistencia: las órdenes DEMO y su trazabilidad se conservan.\n');

  const created = [];
  for (const entry of plan) {
    const result = await persistPaymentTraceEntry(entry, runId);
    created.push(result);
    console.log(
      `OK ${String(entry.sequence).padStart(2, '0')} | ${entry.label}` +
        ` | ${result.order.payment.status} | ${money(result.order.total)}` +
        ` | ${traceSummary(result)} | ${result.order.orderNumber}`
    );
  }

  const orderIds = created.map((result) => result.order._id);
  const verified = await Order.countDocuments({ _id: { $in: orderIds } }).exec();
  if (verified !== plan.length) {
    throw new Error('La verificación final no encontró todas las órdenes DEMO.');
  }

  console.log('\n=== Resultado ===');
  console.log(`Órdenes creadas y verificadas: ${verified}/${plan.length}`);
  console.log(`Intentos de pago: ${created.reduce((sum, item) => sum + item.attempts, 0)}`);
  console.log(`Eventos externos: ${created.reduce((sum, item) => sum + item.events, 0)}`);
  console.log(`Evidencias manuales: ${created.reduce((sum, item) => sum + item.evidence, 0)}`);
  console.log(`Buscar en el panel: ${runId}`);
  console.log('Persistencia: CONSERVADA (sin limpieza automática).');
  return { runId, created: verified };
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

module.exports = { run };
