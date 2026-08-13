/* eslint-disable no-console */
'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');

const {
  PROFILES,
  assertPersistentConfirmation,
  buildCandidatePool,
  buildRunId,
  buildSessionId,
  buildTracePlan,
  parseArgs,
  randomActivityDate,
} = require('./seedPersistentFavoritesTrace');

const results = { ok: 0, fail: 0 };

async function test(name, callback) {
  try {
    await callback();
    results.ok += 1;
    console.log(`OK ${results.ok}: ${name}`);
  } catch (error) {
    results.fail += 1;
    console.error(`FAIL: ${name}`);
    console.error(`      ${error.message}`);
  }
}

function fixedRandomInt(min) {
  return min;
}

function fixedBytes(size) {
  return Buffer.alloc(size, 7);
}

async function main() {
  await test('exige confirmación explícita porque los datos no se borran', () => {
    assert.throws(
      () => assertPersistentConfirmation({ confirmPersist: false }),
      /--confirm-persist/
    );
    assert.doesNotThrow(() => assertPersistentConfirmation({ confirmPersist: true }));
  });

  await test('limita sesiones, productos y rangos de carga', () => {
    const parsed = parseArgs([
      '--confirm-persist',
      '--sessions=12',
      '--min-items=2',
      '--max-items=8',
      '--label=Revision Agosto',
    ]);
    assert.equal(parsed.sessions, 12);
    assert.equal(parsed.minItems, 2);
    assert.equal(parsed.maxItems, 8);
    assert.equal(parsed.label, 'revision-agosto');
    assert.equal(parsed.confirmPersist, true);
    assert.throws(() => parseArgs(['--sessions=100']), /sessions/);
    assert.throws(
      () => parseArgs(['--min-items=9', '--max-items=4']),
      /no puede superar/
    );
  });

  await test('produce identificadores buscables, únicos y válidos para el modelo', () => {
    const runId = buildRunId({
      now: new Date('2026-08-13T12:30:40.000Z'),
      label: 'QA Agosto',
      randomBytes: fixedBytes,
    });
    assert.match(runId, /^fav_trace_qa-agosto_20260813t123040z_/);
    const ids = PROFILES.map((profile, index) =>
      buildSessionId(runId, profile, index, fixedBytes)
    );
    assert.equal(new Set(ids).size, PROFILES.length);
    ids.forEach((sessionId) => {
      assert(sessionId.length >= 20 && sessionId.length <= 120);
      assert(sessionId.startsWith(runId));
    });
  });

  await test('construye candidatos con autoridad de producto y variante', () => {
    const pool = buildCandidatePool([
      { _id: 'p1', title: 'Base', price: 50000, variants: [] },
      {
        _id: 'p2',
        title: 'Variable',
        price: 80000,
        variants: [
          { variantKey: 's__rojo', size: 'S', color: 'Rojo', price: 90000, active: true },
          { variantKey: 'm__azul', size: 'M', color: 'Azul', price: 95000, active: true },
          { variantKey: 'l__negro', size: 'L', color: 'Negro', active: false },
        ],
      },
    ]);
    assert.equal(pool.length, 3);
    assert.deepEqual(
      pool.map((entry) => entry.estimatedPrice).sort((a, b) => a - b),
      [50000, 90000, 95000]
    );
  });

  await test('genera las cuatro trazas y fuerza alta intención con tres productos', () => {
    const pool = Array.from({ length: 8 }, (_, index) => ({
      request: { productId: `p${index}` },
      estimatedPrice: (index + 1) * 10000,
    }));
    const options = parseArgs([
      '--confirm-persist',
      '--sessions=8',
      '--min-items=1',
      '--max-items=6',
    ]);
    const plan = buildTracePlan({
      runId: 'fav_trace_control_20260813t123040z_010101',
      pool,
      options,
      now: new Date('2026-08-13T12:30:40.000Z'),
      randomInt: fixedRandomInt,
      randomBytes: fixedBytes,
    });
    assert.equal(plan.length, 8);
    assert.deepEqual(plan.slice(0, 4).map((entry) => entry.profile), PROFILES);
    assert(plan.find((entry) => entry.profile === 'high_intent').requests.length >= 3);
    assert.equal(plan.find((entry) => entry.profile === 'high_value').requests[0].productId, 'p7');
  });

  await test('las fechas recientes y antiguas caen en ventanas separadas', () => {
    const now = new Date('2026-08-13T12:30:40.000Z');
    const recent = randomActivityDate('recent', now, fixedRandomInt);
    const stale = randomActivityDate('stale', now, fixedRandomInt);
    const recentDays = (now - recent) / (24 * 60 * 60 * 1000);
    const staleDays = (now - stale) / (24 * 60 * 60 * 1000);
    assert(recentDays < 7);
    assert(staleDays >= 31);
  });

  await test('el script no contiene operaciones de borrado ni limpieza', () => {
    const source = fs.readFileSync(
      path.join(__dirname, 'seedPersistentFavoritesTrace.js'),
      'utf8'
    );
    assert.doesNotMatch(
      source,
      /\.(?:deleteOne|deleteMany|findOneAndDelete|findByIdAndDelete|drop)\s*\(/
    );
  });

  console.log(`\nFavoritos trazables: ${results.ok} controles superados.`);
  if (results.fail) process.exitCode = 1;
}

main();
