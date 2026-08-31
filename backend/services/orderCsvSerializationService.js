'use strict';

// Excel y otras hojas pueden ignorar controles/espacios iniciales antes de
// interpretar una fórmula. Se neutraliza también esa variante evasiva.
const CSV_FORMULA_PREFIX = /^[\u0000-\u0020]*[=+\-@]/;

function neutralizeCsvFormula(value) {
  const text = value instanceof Date
    ? value.toISOString()
    : String(value ?? '');
  return CSV_FORMULA_PREFIX.test(text) ? `'${text}` : text;
}

function csvCell(value, { trustedNumber = false } = {}) {
  if (trustedNumber) {
    const number = Number(value || 0);
    return Number.isFinite(number) ? String(number) : '0';
  }

  const safe = neutralizeCsvFormula(value);
  return `"${safe.replace(/"/g, '""')}"`;
}

function setOrderCsvResponseHeaders(res, fileName) {
  const safeFileName = String(fileName || 'orders.csv')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .slice(0, 120) || 'orders.csv';

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${safeFileName}"`
  );
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
}

module.exports = {
  CSV_FORMULA_PREFIX,
  csvCell,
  neutralizeCsvFormula,
  setOrderCsvResponseHeaders,
};
