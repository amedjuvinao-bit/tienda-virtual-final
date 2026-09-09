'use strict';

/* eslint-disable no-console */

const mongoose = require('mongoose');

const TEST_URI = String(process.env.FINANCE_STAGE4_MONGO_URI || '').trim();
if (!TEST_URI) {
  throw new Error(
    'FINANCE_STAGE4_MONGO_URI es obligatoria y debe apuntar a una base aislada.'
  );
}

const databaseName = new URL(TEST_URI).pathname.replace(/^\//, '');
if (!/^finance_stage4_ci(?:_|$)/.test(databaseName)) {
  throw new Error(
    `La integración solo puede usar una base aislada finance_stage4_ci*. Recibida: ${databaseName || '(vacía)'}`
  );
}

process.env.MONGO_URI = TEST_URI;

const Branch = require('../models/Branch');
const FinanceExpense = require('../models/FinanceExpense');
const FinancePeriodClose = require('../models/FinancePeriodClose');
const closingService = require('../services/adminFinanceClosingService');

const RUN_ID = Math.random().toString(36).slice(2, 9).toUpperCase();
const PREFIX = `FIN4-${RUN_ID}`;
const PERIOD_KEY = '2026-08';
let controls = 0;

function ok(message, condition = true) {
  if (!condition) throw new Error(message);
  controls += 1;
  console.log(`OK ${String(controls).padStart(2, '0')} ${message}`);
}

function actor(username = 'supervisor.cierre') {
  return {
    adminUserId: new mongoose.Types.ObjectId(),
    snapshot: {
      username,
      displayName: username.replace(/\./g, ' '),
      role: 'owner',
      adminRole: 'owner',
    },
    canOverride: true,
  };
}

async function expectError(operation, code) {
  try {
    await operation();
  } catch (error) {
    if (error?.code === code) return error;
    throw error;
  }
  throw new Error(`Se esperaba el error ${code}.`);
}

async function cleanup() {
  const branches = await Branch.find({ code: { $regex: `^${PREFIX}` } }).select('_id').lean();
  const ids = branches.map((item) => item._id);
  await Promise.all([
    FinancePeriodClose.deleteMany({ branch: { $in: ids } }),
    FinanceExpense.deleteMany({ reference: { $regex: `^${PREFIX}` } }),
    Branch.deleteMany({ _id: { $in: ids } }),
  ]);
}

async function createBranch(suffix) {
  return Branch.create({
    name: `Sede Cierre ${suffix} ${RUN_ID}`,
    code: `${PREFIX}-${suffix}`,
    type: 'store',
    status: 'active',
    active: true,
    isMain: false,
    isDefaultForOnlineOrders: false,
  });
}

async function createApprovedExpense(branch, suffix, amount) {
  return FinanceExpense.create({
    date: new Date(`2026-08-${suffix === 'A' ? '10' : '11'}T12:00:00.000Z`),
    amount,
    type: 'operating',
    category: 'Servicios',
    description: `Gasto aprobado de cierre ${suffix}`,
    reference: `${PREFIX}-EXP-${suffix}`,
    paymentMethod: 'cash',
    paymentTerms: 'immediate',
    status: 'paid',
    source: 'manual',
    branch: branch._id,
    branchSnapshot: { name: branch.name, code: branch.code, type: branch.type },
  });
}

async function main() {
  console.log('\n=== Integración Finanzas Nivel Plus · Etapa 4 ===');
  await mongoose.connect(TEST_URI, { autoIndex: false });
  await cleanup();

  try {
    const [branchA, branchB] = await Promise.all([
      createBranch('A'),
      createBranch('B'),
    ]);
    const certifier = actor();
    const scopeA = { branchIds: [String(branchA._id)] };

    await expectError(
      () => closingService.getClosingControl(
        { periodKey: PERIOD_KEY, branchId: String(branchB._id) },
        scopeA,
        { now: new Date('2026-09-09T12:00:00.000Z') }
      ),
      'FINANCE_CLOSE_BRANCH_FORBIDDEN'
    );
    ok('el cierre impide consultar una sede fuera del alcance autorizado');

    let control = await closingService.getClosingControl(
      { periodKey: PERIOD_KEY, branchId: String(branchA._id) },
      scopeA,
      { now: new Date('2026-09-09T12:00:00.000Z') }
    );
    ok('el diagnóstico vacío concilia todas las ecuaciones sin inventar valores', control.readiness.status === 'ready' && control.financial.kpis.revenue === 0 && control.snapshotHash.length === 64);

    const firstPayload = {
      periodKey: PERIOD_KEY,
      branchId: String(branchA._id),
      requestKey: `${PREFIX}-CERTIFICATION-001`,
      notes: 'Primer cierre mensual de prueba.',
    };
    const first = await closingService.certifyPeriod(firstPayload, certifier, scopeA);
    ok('la primera certificación crea una versión trazable', first.revision === 0 && first.status === 'certified' && first.certifications.length === 1);

    const replay = await closingService.certifyPeriod(firstPayload, certifier, scopeA);
    ok('repetir la misma solicitud no duplica la certificación', replay.idempotentReplay === true && replay.certifications.length === 1);

    await createApprovedExpense(branchA, 'A', 50000);
    control = await closingService.getClosingControl(
      { periodKey: PERIOD_KEY, branchId: String(branchA._id) },
      scopeA,
      { now: new Date('2026-09-09T12:00:00.000Z') }
    );
    ok('un nuevo hecho financiero marca cambio frente a la huella certificada', control.drifted === true && control.financial.kpis.operatingExpenses === 50000 && control.readiness.warningCount >= 1);

    const second = await closingService.certifyPeriod({
      periodKey: PERIOD_KEY,
      branchId: String(branchA._id),
      requestKey: `${PREFIX}-CERTIFICATION-002`,
      expectedRevision: 0,
      notes: 'Se incorpora un gasto aprobado al periodo.',
    }, certifier, scopeA);
    ok('la recertificación conserva la versión anterior y avanza la revisión', second.revision === 1 && second.certifications.length === 2 && second.snapshot.financial.kpis.netProfit === -50000);

    await createApprovedExpense(branchA, 'B', 20000);
    const concurrent = await Promise.allSettled([
      closingService.certifyPeriod({
        periodKey: PERIOD_KEY,
        branchId: String(branchA._id),
        requestKey: `${PREFIX}-CERTIFICATION-RACE-A`,
        expectedRevision: 1,
        notes: 'Actualización concurrente del cierre A.',
      }, certifier, scopeA),
      closingService.certifyPeriod({
        periodKey: PERIOD_KEY,
        branchId: String(branchA._id),
        requestKey: `${PREFIX}-CERTIFICATION-RACE-B`,
        expectedRevision: 1,
        notes: 'Actualización concurrente del cierre B.',
      }, certifier, scopeA),
    ]);
    const finalClose = await FinancePeriodClose.findOne({
      branch: branchA._id,
      periodKey: PERIOD_KEY,
    });
    ok('dos certificaciones simultáneas generan una sola versión nueva', concurrent.some((result) => result.status === 'fulfilled') && finalClose.revision === 2 && finalClose.certifications.length === 3);

    const finalControl = await closingService.getClosingControl(
      { periodKey: PERIOD_KEY, branchId: String(branchA._id) },
      scopeA,
      { now: new Date('2026-09-09T12:00:00.000Z') }
    );
    ok('la última huella coincide con los hechos financieros certificados', finalControl.drifted === false && finalControl.financial.kpis.operatingExpenses === 70000);

    const csv = closingService.buildExecutiveCsv(finalControl);
    ok('el informe descargable incluye periodo, sede, utilidad y controles', csv.includes(PERIOD_KEY) && csv.includes(branchA.name) && csv.includes('Utilidad neta') && csv.includes('Control'));

    console.log(`\nIntegración Etapa 4 Finanzas validada: ${controls} controles superados.`);
  } finally {
    await cleanup();
    await mongoose.disconnect();
  }
}

main().catch(async (error) => {
  console.error('Fallo integración Etapa 4 Finanzas:', error);
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect().catch(() => null);
  }
  process.exitCode = 1;
});
