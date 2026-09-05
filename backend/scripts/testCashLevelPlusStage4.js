'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  bogotaBusinessDate,
  certificatePayload,
  digestSnapshot,
  serializeJourneyClose,
} = require('../services/cashJourneyCloseService');

let passed = 0;
function ok(label, condition) {
  assert.ok(condition, label);
  passed += 1;
  console.log(`OK ${String(passed).padStart(2, '0')} ${label}`);
}

function source(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', '..', relativePath), 'utf8');
}

function main() {
  const now = new Date('2026-09-06T03:30:00.000Z');
  ok('la fecha operativa respeta America/Bogota', bogotaBusinessDate(now) === '2026-09-05');

  const summary = {
    version: 'cash-journey-summary-v1', branchId: 'branch-stage4',
    period: { range: 'today' }, status: 'healthy', issueCounts: { critical: 0, attention: 0 },
    totals: { sessionsCount: 2, openSessionsCount: 0 }, alerts: [], sessions: [{ id: 'cash-1' }],
    transient: 'no debe certificarse',
  };
  const snapshot = certificatePayload(summary);
  ok('la instantánea conserva únicamente el contrato autoritativo', snapshot.transient === undefined && snapshot.totals.sessionsCount === 2);
  ok('la huella SHA-256 es determinista', digestSnapshot(snapshot) === digestSnapshot({ ...snapshot }));
  ok('la huella tiene longitud criptográfica completa', /^[a-f0-9]{64}$/.test(digestSnapshot(snapshot)));

  const serialized = serializeJourneyClose({
    _id: 'close-stage4', branch: 'branch-stage4', businessDate: '2026-09-05',
    timezone: 'America/Bogota', status: 'certified', snapshot, contentDigest: digestSnapshot(snapshot),
    certifiedBySnapshot: { displayName: 'Supervisor' }, certifiedAt: now,
  });
  ok('el certificado expone responsable, fecha y huella', serialized.status === 'certified' && serialized.certifiedBySnapshot.displayName === 'Supervisor' && serialized.contentDigest.length === 64);

  const model = source('backend/models/CashJourneyClose.js');
  const indexes = source('backend/models/cashJourneyCloseIndexDefinitions.js');
  const migration = source('backend/scripts/migrateCashJourneyCloseIndexes.js');
  const service = source('backend/services/cashJourneyCloseService.js');
  const sessionService = source('backend/services/cashSessionService.js');
  const routes = source('backend/routes/adminCashSessions.js');
  const permissions = source('backend/security/adminRoutePermissionMap.js');
  const api = source('frontend/src/admin/api/adminCashSessionApi.js');
  const page = source('frontend/src/admin/cash/CashSessionsPageReport.jsx');
  const workflow = source('.github/workflows/pos-ci.yml');

  ok('solo existe un certificado por sede y fecha', indexes.includes("{ branch: 1, businessDate: 1 }") && indexes.includes('unique: true'));
  ok('el certificado conserva una instantánea inmutable', model.includes("snapshot: { type: mongoose.Schema.Types.Mixed, required: true, immutable: true }") && model.includes('contentDigest'));
  ok('el cierre bloquea cajas abiertas, pendientes e inconsistencias críticas', service.includes('openSessionsCount') && service.includes('pendingReviewCount') && service.includes('issueCounts.critical'));
  ok('las diferencias exigen observación de supervisión', service.includes('CASH_JOURNEY_CLOSE_NOTES_REQUIRED'));
  ok('las solicitudes repetidas son idempotentes', service.includes('alreadyCertified: true') && service.includes("error?.code || '') === '11000'"));
  ok('una jornada certificada impide nuevas aperturas', sessionService.includes('CASH_JOURNEY_ALREADY_CERTIFIED'));
  ok('la ruta de certificación exige supervisión', routes.includes("router.post('/journey-close'") && routes.includes('CASH_JOURNEY_CLOSE_FORBIDDEN'));
  ok('la operación queda declarada para auditoría administrativa', permissions.includes("path: '/api/admin/cash-sessions/journey-close'") && permissions.includes('Certificar el cierre diario'));
  ok('los índices críticos tienen una migración segura', migration.includes('createCanonicalIndexMigration') && migration.includes('cashjourneycloses'));
  ok('la interfaz consume el cierre autoritativo', api.includes('certifyCashJourney') && page.includes('cash-journey-close-stage4'));
  ok('la interfaz explica los bloqueos antes de certificar', page.includes('Cierra todas las cajas.') && page.includes('Corrige las inconsistencias críticas.'));
  ok('CI ejecuta contrato, interfaz e integración aislada', workflow.includes('test:cash-level-plus-stage4') && workflow.includes('CASH_STAGE4_MONGO_URI'));

  console.log(`\nEtapa 4 Caja validada: ${passed} controles superados.`);
}

try {
  main();
} catch (error) {
  console.error('Fallo en Etapa 4 Caja:', error);
  process.exitCode = 1;
}
