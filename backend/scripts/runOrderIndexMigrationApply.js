'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');

require('dotenv').config({
  path: path.join(__dirname, '..', '.env'),
  override: false,
  quiet: true,
});

const {
  MIGRATIONS,
  countIndexes,
  runSuite: runDryRunSuite,
} = require('./runOrderIndexMigrationDryRuns');

const CONFIRMATION_FLAG = '--confirm-test-order-index-application';
const APPLY_FLAGS = Object.freeze({
  'migrateOrderActivityIndexes.js': '--apply-order-activity-index-migration',
  'migrateOrderAdminCursorIndex.js':
    '--apply-order-admin-cursor-index-migration',
  'migrateOrderReturnIndexes.js': '--apply-order-return-index-migration',
  'migrateOrderRefundIndexes.js': '--apply-order-refund-index-migration',
  'migrateIdempotencyKeyIndexes.js': '--apply-idempotency-key-index-migration',
  'migrateShippingOperationIndexes.js':
    '--apply-shipping-operation-index-migration',
  'migratePaymentAttemptIndexes.js':
    '--apply-payment-attempt-index-migration',
  'migrateManualPaymentConfirmationIndexes.js':
    '--apply-manual-payment-confirmation-index-migration',
  'migrateOrderPostCommitOutboxIndexes.js':
    '--apply-order-postcommit-index-migration',
});

function parseArguments(argv = []) {
  if (argv.length !== 1 || argv[0] !== CONFIRMATION_FLAG) {
    const error = new Error(
      `Para aplicar los índices de pruebas se requiere exactamente ${CONFIRMATION_FLAG}.`
    );
    error.code = 'ORDER_INDEX_TEST_APPLY_CONFIRMATION_REQUIRED';
    throw error;
  }
}

function assertNonProduction(nodeEnv = process.env.NODE_ENV) {
  if (String(nodeEnv || '').trim().toLowerCase() === 'production') {
    const error = new Error(
      'El comando agrupado de pruebas está bloqueado en producción.'
    );
    error.code = 'ORDER_INDEX_TEST_APPLY_PRODUCTION_BLOCKED';
    throw error;
  }
}

function readJsonOutput(stdout, label) {
  try {
    return JSON.parse(String(stdout || '').trim());
  } catch (_error) {
    const error = new Error(
      `La aplicación "${label}" no devolvió un resultado JSON válido.`
    );
    error.code = 'ORDER_INDEX_TEST_APPLY_INVALID_OUTPUT';
    throw error;
  }
}

function validateApplyResult(result, label) {
  const noDestructiveOperations =
    !result?.destructiveOperations || result.destructiveOperations.length === 0;
  if (
    result?.ok !== true ||
    result?.mode !== 'apply' ||
    !noDestructiveOperations
  ) {
    const error = new Error(
      `La aplicación "${label}" no acreditó un resultado seguro.`
    );
    error.code = 'ORDER_INDEX_TEST_APPLY_SAFETY_CHECK_FAILED';
    throw error;
  }
  return result;
}

function executeMigration(scriptName, applyFlag) {
  return spawnSync(
    process.execPath,
    [path.join(__dirname, scriptName), applyFlag],
    {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8',
      env: process.env,
    }
  );
}

function runApplySuite({
  execute = executeMigration,
  runPreflight = runDryRunSuite,
  write = console.log,
} = {}) {
  write('Preflight: ejecutando las nueve simulaciones antes de aplicar...');
  runPreflight();
  write('\nAplicación de índices en la base de pruebas:');

  const results = [];
  for (const [label, scriptName] of MIGRATIONS) {
    const applyFlag = APPLY_FLAGS[scriptName];
    if (!applyFlag) {
      const error = new Error(`No existe bandera de aplicación para "${label}".`);
      error.code = 'ORDER_INDEX_TEST_APPLY_FLAG_MISSING';
      throw error;
    }
    const execution = execute(scriptName, applyFlag);
    if (execution.error || execution.status !== 0) {
      const detail = String(execution.stderr || execution.error?.message || '')
        .trim();
      const error = new Error(
        `Falló la aplicación "${label}"${detail ? `: ${detail}` : '.'}`
      );
      error.code = 'ORDER_INDEX_TEST_APPLY_EXECUTION_FAILED';
      throw error;
    }
    const result = validateApplyResult(
      readJsonOutput(execution.stdout, label),
      label
    );
    results.push({ label, scriptName, result });
    write(
      `OK ${results.length}/${MIGRATIONS.length}: ${label} - ${countIndexes(result)} índice(s) verificados`
    );
  }

  write(
    `\nResultado: ${results.length}/${MIGRATIONS.length} migraciones aplicadas o verificadas. No se borraron datos ni índices.`
  );
  return results;
}

function main(argv = process.argv.slice(2)) {
  parseArguments(argv);
  assertNonProduction();
  return runApplySuite();
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(
      `${JSON.stringify({ ok: false, code: error.code, message: error.message })}\n`
    );
    process.exitCode = 1;
  }
}

module.exports = {
  APPLY_FLAGS,
  CONFIRMATION_FLAG,
  assertNonProduction,
  main,
  parseArguments,
  readJsonOutput,
  runApplySuite,
  validateApplyResult,
};
