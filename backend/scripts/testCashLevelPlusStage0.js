'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CashSession = require('../models/CashSession');
const {
  isFinalCashSession,
  parseCashAmount,
} = require('../services/cashSessionService');
const {
  CASH_SESSION_INDEX_DEFINITIONS,
} = require('../models/cashSessionIndexDefinitions');
const migration = require('./migrateCashSessionIndexes');

let controls = 0;

function ok(message, condition = true) {
  assert.ok(condition, message);
  controls += 1;
  console.log(`OK ${String(controls).padStart(2, '0')} ${message}`);
}

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', '..', relativePath), 'utf8');
}

function main() {
  ok('el monto inicial acepta cero', parseCashAmount(undefined) === 0);
  ok('el efectivo contado conserva pesos enteros', parseCashAmount('50500', { required: true }) === 50500);
  assert.throws(
    () => parseCashAmount('', { required: true, code: 'COUNT_REQUIRED' }),
    (error) => error?.code === 'COUNT_REQUIRED' && error?.statusCode === 400
  );
  ok('el cierre rechaza un conteo vacío');
  assert.throws(
    () => parseCashAmount(-1, { code: 'NEGATIVE_AMOUNT' }),
    (error) => error?.code === 'NEGATIVE_AMOUNT'
  );
  ok('los movimientos rechazan valores negativos');
  assert.throws(
    () => parseCashAmount('sin-valor', { code: 'INVALID_AMOUNT' }),
    (error) => error?.code === 'INVALID_AMOUNT'
  );
  ok('los movimientos rechazan valores no numéricos');

  ok('una caja cerrada se reconoce como estado final', isFinalCashSession({ status: 'closed' }));
  ok('una caja anulada se reconoce como estado final', isFinalCashSession({ status: 'cancelled' }));
  ok('una caja abierta continúa siendo recalculable', !isFinalCashSession({ status: 'open' }));

  const code = CashSession.buildSessionCode();
  ok('el código de caja conserva una fecha operativa y sufijo seguro', /^CAJA-\d{8}-[A-Z0-9]{6}$/.test(code));

  const indexes = CashSession.schema.indexes();
  ok(
    'el modelo declara una sola caja abierta por sede y terminal',
    indexes.some(([key, options]) =>
      key.branch === 1 &&
      key.cashRegisterCode === 1 &&
      key.status === 1 &&
      options.unique === true &&
      options.partialFilterExpression?.status === 'open'
    )
  );
  ok(
    'el histórico por sede y estado tiene índice operativo',
    indexes.some(([key]) => key.branch === 1 && key.status === 1 && key.openedAt === -1)
  );
  ok(
    'la migración usa las mismas definiciones canónicas del modelo',
    JSON.stringify(migration.buildMigrationPlan()) === JSON.stringify(CASH_SESSION_INDEX_DEFINITIONS)
  );
  ok(
    'la migración de índices es no destructiva por defecto',
    migration.buildMigrationPlan().length === 4 &&
      migration.buildMigrationPlan().every((definition) => definition.options.name)
  );
  assert.throws(
    () => migration.assertWriteAuthorization({ apply: true, nodeEnv: 'production' }),
    (error) => error?.code === 'CASH_SESSION_INDEX_MIGRATION_PRODUCTION_CONFIRMATION_REQUIRED'
  );
  ok('producción exige confirmación adicional antes de crear índices');

  const service = read('backend/services/cashSessionService.js');
  const refundService = read('backend/services/orderRefundReconciliationService.js');
  const movementService = read('backend/services/cashMovementService.js');
  const wrapper = read('frontend/src/admin/cash/CashSessionsPage.js');
  const page = read('frontend/src/admin/cash/CashSessionsPageReport.jsx');
  const workflow = read('.github/workflows/pos-ci.yml');

  ok(
    'el cierre usa la instancia devuelta por el recálculo atómico',
    service.includes('const recalculatedSession = await recalculateCashSession(session);') &&
      service.includes('recalculatedSession.closeSession({') &&
      service.includes('await saveCashSession(recalculatedSession);')
  );
  ok(
    'las lecturas protegen estados finales contra nuevos recálculos',
    service.includes('if (isFinalCashSession(session))') && service.includes('return session;')
  );
  ok(
    'un reembolso posterior no declara conciliada una caja ya cerrada',
    refundService.includes('requireOpen: true') &&
      service.includes('CASH_SESSION_FINAL_ADJUSTMENT_REQUIRED')
  );
  ok(
    'registrar un movimiento evita un segundo recálculo y escritura innecesaria',
    movementService.includes('return recalculatedSession;')
  );
  ok(
    'retiro de efectivo es una opción React real del formulario',
    page.includes("{ key: 'withdrawal', label: 'Retiro de efectivo'")
  );
  ok(
    'la pantalla activa ya no depende de un parche periódico del DOM',
    !wrapper.includes('CashMovementWithdrawalOptionPatch') &&
      !wrapper.includes('setInterval')
  );
  ok(
    'el reporte de caja se expone como diálogo accesible',
    page.includes('role="dialog"') && page.includes('aria-modal="true"')
  );
  ok(
    'las fechas del reporte se fijan a la zona horaria de Colombia',
    page.includes("timeZone: 'America/Bogota'")
  );
  ok(
    'CI ejecuta el contrato estático de Caja Etapa 0',
    workflow.includes('test:cash-level-plus-stage0')
  );

  console.log(`\nEtapa 0 Caja validada: ${controls} controles superados.`);
}

try {
  main();
} catch (error) {
  console.error('Fallo en Etapa 0 Caja:', error);
  process.exitCode = 1;
}
