'use strict';

const assert = require('node:assert/strict');
const { MIGRATIONS } = require('./runOrderIndexMigrationDryRuns');
const {
  APPLY_FLAGS,
  CONFIRMATION_FLAG,
  assertNonProduction,
  parseArguments,
  runApplySuite,
  validateApplyResult,
} = require('./runOrderIndexMigrationApply');

let passed = 0;
function ok(message) {
  passed += 1;
  console.log(`OK ${passed}: ${message}`);
}

assert.doesNotThrow(() => parseArguments([CONFIRMATION_FLAG]));
for (const invalid of [[], ['--apply'], [CONFIRMATION_FLAG, '--extra']]) {
  assert.throws(
    () => parseArguments(invalid),
    (error) => error.code === 'ORDER_INDEX_TEST_APPLY_CONFIRMATION_REQUIRED'
  );
}
ok('la aplicación exige una confirmación exacta y exclusiva');

assert.doesNotThrow(() => assertNonProduction('development'));
assert.doesNotThrow(() => assertNonProduction('test'));
assert.throws(
  () => assertNonProduction('production'),
  (error) => error.code === 'ORDER_INDEX_TEST_APPLY_PRODUCTION_BLOCKED'
);
ok('el comando queda bloqueado en producción');

assert.equal(Object.keys(APPLY_FLAGS).length, MIGRATIONS.length);
assert.ok(
  MIGRATIONS.every(([, scriptName]) => APPLY_FLAGS[scriptName]?.startsWith('--apply-'))
);
ok('cada migración tiene una bandera de aplicación cerrada');

assert.doesNotThrow(() =>
  validateApplyResult({ ok: true, mode: 'apply' }, 'segura')
);
for (const unsafe of [
  { ok: false, mode: 'apply' },
  { ok: true, mode: 'dry-run' },
  { ok: true, mode: 'apply', destructiveOperations: ['dropIndex'] },
]) {
  assert.throws(
    () => validateApplyResult(unsafe, 'insegura'),
    (error) => error.code === 'ORDER_INDEX_TEST_APPLY_SAFETY_CHECK_FAILED'
  );
}
ok('la validación rechaza resultados incompletos o destructivos');

let preflightRuns = 0;
const executed = [];
const output = [];
const results = runApplySuite({
  runPreflight() {
    preflightRuns += 1;
  },
  execute(scriptName, applyFlag) {
    executed.push([scriptName, applyFlag]);
    return {
      status: 0,
      stdout: JSON.stringify({ ok: true, mode: 'apply', indexCount: 1 }),
      stderr: '',
    };
  },
  write(message) {
    output.push(message);
  },
});
assert.equal(preflightRuns, 1);
assert.equal(results.length, 9);
assert.deepEqual(
  executed,
  MIGRATIONS.map(([, scriptName]) => [scriptName, APPLY_FLAGS[scriptName]])
);
assert.match(output.at(-1), /9\/9 migraciones aplicadas o verificadas/);
ok('el preflight precede la aplicación agrupada de las nueve migraciones');

console.log(`\nSuite de aplicación de índices: ${passed}/5 controles aprobados.`);
