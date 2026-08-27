'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');

const MIGRATIONS = Object.freeze([
  ['Actividad y notas', 'migrateOrderActivityIndexes.js'],
  ['Paginación administrativa', 'migrateOrderAdminCursorIndex.js'],
  ['Devoluciones', 'migrateOrderReturnIndexes.js'],
  ['Reembolsos', 'migrateOrderRefundIndexes.js'],
  ['Idempotencia', 'migrateIdempotencyKeyIndexes.js'],
  ['Operaciones de envío', 'migrateShippingOperationIndexes.js'],
  ['Intentos de pago', 'migratePaymentAttemptIndexes.js'],
  ['Evidencia de pago manual', 'migrateManualPaymentConfirmationIndexes.js'],
  ['Operaciones posteriores al pago', 'migrateOrderPostCommitOutboxIndexes.js'],
]);

function parseArguments(argv = []) {
  if (argv.length > 0) {
    const error = new Error(
      'Este comando es exclusivamente de simulación y no acepta argumentos.'
    );
    error.code = 'ORDER_INDEX_DRY_RUN_ARGUMENT_NOT_ALLOWED';
    throw error;
  }
}

function readJsonOutput(stdout, label) {
  try {
    return JSON.parse(String(stdout || '').trim());
  } catch (_error) {
    const error = new Error(
      `La migración "${label}" no devolvió un resultado JSON válido.`
    );
    error.code = 'ORDER_INDEX_DRY_RUN_INVALID_OUTPUT';
    throw error;
  }
}

function validateDryRunResult(result, label) {
  const safeMode = result?.mode === 'dry-run' || result?.mode === 'plan';
  const noMutations = Number(result?.mutations || 0) === 0;
  const noDestructiveOperations =
    !result?.destructiveOperations || result.destructiveOperations.length === 0;
  const noCreatedIndexes = !Object.hasOwn(result || {}, 'created');

  if (
    result?.ok !== true ||
    !safeMode ||
    result?.appliesChanges === true ||
    !noMutations ||
    !noDestructiveOperations ||
    !noCreatedIndexes
  ) {
    const error = new Error(
      `La migración "${label}" no acreditó una simulación sin cambios.`
    );
    error.code = 'ORDER_INDEX_DRY_RUN_SAFETY_CHECK_FAILED';
    throw error;
  }
  return result;
}

function countIndexes(result) {
  if (Number.isInteger(result.indexCount)) return result.indexCount;
  if (Array.isArray(result.indexes)) return result.indexes.length;
  return result.index ? 1 : 0;
}

function executeMigration(scriptName) {
  return spawnSync(process.execPath, [path.join(__dirname, scriptName)], {
    cwd: path.join(__dirname, '..'),
    encoding: 'utf8',
    env: process.env,
  });
}

function runSuite({ execute = executeMigration, write = console.log } = {}) {
  const results = [];
  for (const [label, scriptName] of MIGRATIONS) {
    const execution = execute(scriptName);
    if (execution.error || execution.status !== 0) {
      const detail = String(execution.stderr || execution.error?.message || '')
        .trim();
      const error = new Error(
        `Falló la simulación "${label}"${detail ? `: ${detail}` : '.'}`
      );
      error.code = 'ORDER_INDEX_DRY_RUN_EXECUTION_FAILED';
      throw error;
    }
    const result = validateDryRunResult(
      readJsonOutput(execution.stdout, label),
      label
    );
    results.push({ label, scriptName, result });
    write(
      `OK ${results.length}/${MIGRATIONS.length}: ${label} - ${countIndexes(result)} índice(s), sin cambios`
    );
  }
  write(
    `\nResultado: ${results.length}/${MIGRATIONS.length} simulaciones seguras aprobadas. MongoDB no fue modificado.`
  );
  return results;
}

function main(argv = process.argv.slice(2)) {
  parseArguments(argv);
  return runSuite();
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
  MIGRATIONS,
  countIndexes,
  main,
  parseArguments,
  readJsonOutput,
  runSuite,
  validateDryRunResult,
};
