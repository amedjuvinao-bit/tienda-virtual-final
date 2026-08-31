'use strict';

const assert = require('node:assert/strict');
const {
  MIGRATIONS,
  parseArguments,
  runSuite,
  validateDryRunResult,
} = require('./runOrderIndexMigrationDryRuns');

let passed = 0;
function ok(message) {
  passed += 1;
  console.log(`OK ${passed}: ${message}`);
}

assert.equal(MIGRATIONS.length, 9);
assert.equal(new Set(MIGRATIONS.map(([, script]) => script)).size, 9);
assert.ok(MIGRATIONS.every(([, script]) => /^migrate[A-Za-z]+\.js$/.test(script)));
ok('la suite contiene exactamente las nueve migraciones de Órdenes');

assert.doesNotThrow(() => parseArguments([]));
assert.throws(
  () => parseArguments(['--apply']),
  (error) => error.code === 'ORDER_INDEX_DRY_RUN_ARGUMENT_NOT_ALLOWED'
);
ok('el comando agrupado rechaza cualquier argumento de escritura');

assert.doesNotThrow(() =>
  validateDryRunResult({ ok: true, mode: 'dry-run' }, 'segura')
);
for (const unsafe of [
  { ok: true, mode: 'apply' },
  { ok: true, mode: 'plan', appliesChanges: true },
  { ok: true, mode: 'dry-run', mutations: 1 },
  { ok: true, mode: 'dry-run', destructiveOperations: ['dropIndex'] },
  { ok: true, mode: 'dry-run', created: ['index_1'] },
]) {
  assert.throws(
    () => validateDryRunResult(unsafe, 'insegura'),
    (error) => error.code === 'ORDER_INDEX_DRY_RUN_SAFETY_CHECK_FAILED'
  );
}
ok('la validación bloquea resultados que impliquen cambios');

const output = [];
const executed = [];
const results = runSuite({
  execute(scriptName) {
    executed.push(scriptName);
    return {
      status: 0,
      stdout: JSON.stringify({
        ok: true,
        mode: 'dry-run',
        indexCount: 1,
        mutations: 0,
        destructiveOperations: [],
      }),
      stderr: '',
    };
  },
  write(message) {
    output.push(message);
  },
});
assert.equal(results.length, 9);
assert.deepEqual(executed, MIGRATIONS.map(([, script]) => script));
assert.match(output.at(-1), /9\/9 simulaciones seguras aprobadas/);
ok('la ejecución agrupada recorre todas las migraciones y resume el resultado');

console.log(`\nSuite de dry-runs de índices: ${passed}/4 controles aprobados.`);
