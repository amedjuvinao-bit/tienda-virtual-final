// backend/scripts/testDateRangeUtil.js
/* eslint-disable no-console */

const {
  endOfDay,
  formatLocalDate,
  isDateWithinRange,
  parseDateOnlyLocal,
  resolveDateRange,
  safeDate,
  startOfDay,
} = require('../utils/dateRange');

const results = { ok: 0, warn: 0, fail: 0 };

function ok(message) {
  results.ok += 1;
  console.log(`OK  ${message}`);
}

function fail(message, error = null) {
  results.fail += 1;
  console.error(`FAIL ${message}`);
  if (error?.message) console.error(`     ${error.message}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertLocalDate(date, year, month, day, label) {
  assert(date instanceof Date, `${label} no devolvio Date.`);
  assert(date.getFullYear() === year, `${label} año incorrecto.`);
  assert(date.getMonth() === month - 1, `${label} mes incorrecto.`);
  assert(date.getDate() === day, `${label} día incorrecto.`);
}

function main() {
  console.log('\n=== Prueba utilidades fechas locales ===');

  try {
    const dateOnly = parseDateOnlyLocal('2026-07-17');
    assertLocalDate(dateOnly, 2026, 7, 17, 'parseDateOnlyLocal');
    assert(dateOnly.getHours() === 0 && dateOnly.getMinutes() === 0, 'parseDateOnlyLocal no inicia a medianoche local.');
    ok('YYYY-MM-DD se interpreta como fecha local, no como UTC');

    const safe = safeDate('2026-07-17');
    assertLocalDate(safe, 2026, 7, 17, 'safeDate');
    ok('safeDate conserva día local para fechas tipo formulario');

    const start = startOfDay(new Date(2026, 6, 17, 15, 30, 20));
    const end = endOfDay(new Date(2026, 6, 17, 15, 30, 20));
    assert(start.getHours() === 0 && start.getMinutes() === 0 && start.getSeconds() === 0, 'startOfDay incorrecto.');
    assert(end.getHours() === 23 && end.getMinutes() === 59 && end.getSeconds() === 59, 'endOfDay incorrecto.');
    ok('Inicio y cierre de día trabajan en horario local');

    const range = resolveDateRange({ dateFrom: '2026-07-17', dateTo: '2026-07-17' });
    assertLocalDate(range.from, 2026, 7, 17, 'resolveDateRange.from');
    assertLocalDate(range.to, 2026, 7, 17, 'resolveDateRange.to');
    assert(range.fromLocal === '2026-07-17' && range.toLocal === '2026-07-17', 'Rango local visible incorrecto.');
    ok('resolveDateRange crea rango diario completo local');

    assert(isDateWithinRange(new Date(2026, 6, 17, 12, 0, 0), range), 'Mediodía local no quedó dentro del rango.');
    assert(!isDateWithinRange(new Date(2026, 6, 18, 0, 0, 0), range), 'Día siguiente quedó dentro del rango.');
    ok('Validación de pertenencia al rango funciona');

    assert(formatLocalDate(new Date(2026, 6, 17, 23, 59, 59)) === '2026-07-17', 'formatLocalDate incorrecto.');
    ok('formatLocalDate devuelve fecha local estable');
  } catch (error) {
    fail('Error inesperado en prueba utilidades fechas locales', error);
  } finally {
    console.log('\n=== Resultado final ===');
    console.log(`OK: ${results.ok}`);
    console.log(`WARN: ${results.warn}`);
    console.log(`FAIL: ${results.fail}`);
    if (results.fail > 0) process.exit(1);
  }
}

main();
