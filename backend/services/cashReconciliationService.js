'use strict';

const mongoose = require('mongoose');

const CashSession = require('../models/CashSession');

const BOGOTA_OFFSET_MS = -5 * 60 * 60 * 1000;
const SUMMARY_RANGES = new Set(['today', 'last_7_days']);

function cleanText(value, max = 200) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function money(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : 0;
}

function signedMoney(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? Math.round(number) : 0;
}

function appliedMovements(session = {}) {
  return (Array.isArray(session.cashMovements) ? session.cashMovements : [])
    .filter((movement) => !['pending', 'rejected'].includes(cleanText(movement?.approvalStatus, 30).toLowerCase()));
}

function movementTotal(session, direction) {
  return appliedMovements(session)
    .filter((movement) => movement.direction === direction)
    .reduce((total, movement) => total + money(movement.amount), 0);
}

function pendingMovementCount(session = {}) {
  return (Array.isArray(session.cashMovements) ? session.cashMovements : [])
    .filter((movement) => cleanText(movement?.approvalStatus, 30).toLowerCase() === 'pending')
    .length;
}

function pendingClosingReviewCount(session = {}) {
  return (Array.isArray(session.closingReviews) ? session.closingReviews : [])
    .filter((review) => cleanText(review?.status, 30).toLowerCase() === 'pending')
    .length;
}

function check({ code, label, expected, actual, status, message }) {
  return {
    code,
    label,
    status,
    expected: signedMoney(expected),
    actual: signedMoney(actual),
    difference: signedMoney(actual) - signedMoney(expected),
    message,
  };
}

function buildCashReconciliation(session = {}, options = {}) {
  const paymentTotals = session.salesSummary?.paymentTotals || {};
  const openingAmount = money(session.openingAmount);
  const cashSales = money(paymentTotals.cash);
  const cashIn = movementTotal(session, 'in');
  const cashOut = movementTotal(session, 'out');
  const calculatedExpectedCash = Math.max(0, openingAmount + cashSales + cashIn - cashOut);
  const storedExpectedCash = money(session.expectedCash);
  const netSales = money(session.salesSummary?.netSales);
  const paymentTotal = money(paymentTotals.total);
  const countedCash = money(session.countedCash);
  const differenceAmount = signedMoney(countedCash - storedExpectedCash);
  const toleranceAmount = money(options.toleranceAmount);
  const pendingMovements = pendingMovementCount(session);
  const pendingClosingReviews = pendingClosingReviewCount(session);
  const isClosed = cleanText(session.status, 20).toLowerCase() === 'closed';

  const checks = [
    check({
      code: 'sales_vs_payments',
      label: 'Ventas frente a medios de pago',
      expected: netSales,
      actual: paymentTotal,
      status: netSales === paymentTotal ? 'ok' : 'critical',
      message: netSales === paymentTotal
        ? 'Las ventas netas coinciden con la suma de los medios de pago.'
        : 'Las ventas netas no coinciden con la suma de los medios de pago.',
    }),
    check({
      code: 'expected_cash_formula',
      label: 'Fórmula de efectivo esperado',
      expected: calculatedExpectedCash,
      actual: storedExpectedCash,
      status: calculatedExpectedCash === storedExpectedCash ? 'ok' : 'critical',
      message: calculatedExpectedCash === storedExpectedCash
        ? 'Base, ventas en efectivo y movimientos forman el esperado correctamente.'
        : 'El efectivo esperado almacenado no coincide con sus componentes.',
    }),
  ];

  if (isClosed) {
    checks.push(check({
      code: 'counted_vs_expected',
      label: 'Efectivo contado frente al esperado',
      expected: storedExpectedCash,
      actual: countedCash,
      status: Math.abs(differenceAmount) <= toleranceAmount ? 'ok' : 'attention',
      message: Math.abs(differenceAmount) <= toleranceAmount
        ? 'La diferencia está dentro de la tolerancia autorizada.'
        : 'El cierre conserva una diferencia extraordinaria revisada.',
    }));
  }

  checks.push(check({
    code: 'pending_controls',
    label: 'Controles pendientes',
    expected: 0,
    actual: pendingMovements + pendingClosingReviews,
    status: pendingMovements + pendingClosingReviews === 0 ? 'ok' : 'attention',
    message: pendingMovements + pendingClosingReviews === 0
      ? 'No existen movimientos ni arqueos pendientes de decisión.'
      : 'Existen decisiones pendientes antes de completar la jornada.',
  }));

  const status = checks.some((item) => item.status === 'critical')
    ? 'critical'
    : checks.some((item) => item.status === 'attention')
      ? 'attention'
      : isClosed
        ? 'balanced'
        : 'in_progress';

  return {
    version: 'cash-reconciliation-v1',
    status,
    generatedAt: options.generatedAt || new Date(),
    serverAuthoritative: true,
    final: isClosed,
    openingAmount,
    cashSales,
    cashIn,
    cashOut,
    calculatedExpectedCash,
    storedExpectedCash,
    countedCash,
    differenceAmount,
    netSales,
    paymentTotal,
    ordersCount: Number(session.salesSummary?.ordersCount || 0),
    pendingMovements,
    pendingClosingReviews,
    checks,
  };
}

function bogotaDayStart(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const shifted = new Date(date.getTime() + BOGOTA_OFFSET_MS);
  return new Date(Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate()
  ) - BOGOTA_OFFSET_MS);
}

function buildSummaryPeriod(range = 'today', now = new Date()) {
  const normalizedRange = SUMMARY_RANGES.has(cleanText(range, 30).toLowerCase())
    ? cleanText(range, 30).toLowerCase()
    : 'today';
  const end = now instanceof Date ? now : new Date(now);
  const dayStart = bogotaDayStart(end);
  const start = normalizedRange === 'last_7_days'
    ? new Date(dayStart.getTime() - 6 * 24 * 60 * 60 * 1000)
    : dayStart;
  return { range: normalizedRange, start, end, timezone: 'America/Bogota' };
}

function serializeJourneySession(session, toleranceAmount) {
  const reconciliation = session.reconciliation?.version
    ? session.reconciliation
    : buildCashReconciliation(session, { toleranceAmount });
  return {
    id: String(session._id || session.id || ''),
    sessionCode: session.sessionCode || '',
    status: session.status || '',
    cashRegisterCode: session.cashRegisterCode || '',
    cashierSnapshot: session.cashierSnapshot || {},
    openedAt: session.openedAt || null,
    closedAt: session.closedAt || null,
    ordersCount: Number(session.salesSummary?.ordersCount || 0),
    netSales: money(session.salesSummary?.netSales),
    expectedCash: money(session.expectedCash),
    countedCash: money(session.countedCash),
    differenceAmount: signedMoney(session.differenceAmount),
    reconciliationStatus: reconciliation.status || 'in_progress',
  };
}

async function buildCashJourneySummary({ branchId, branchIds, range = 'today', now = new Date(), toleranceAmount = 0 } = {}) {
  const id = cleanText(branchId, 80);
  if (!mongoose.Types.ObjectId.isValid(id)) {
    const error = new Error('Debes seleccionar una sede válida para consultar la jornada.');
    error.code = 'CASH_JOURNEY_BRANCH_REQUIRED';
    error.statusCode = 400;
    throw error;
  }
  const allowed = Array.isArray(branchIds) ? branchIds.map(String) : null;
  if (allowed && !allowed.includes(id)) {
    const error = new Error('No tienes acceso al consolidado de esa sede.');
    error.code = 'CASH_BRANCH_FORBIDDEN';
    error.statusCode = 403;
    throw error;
  }

  const period = buildSummaryPeriod(range, now);
  const sessions = await CashSession.find({
    branch: new mongoose.Types.ObjectId(id),
    openedAt: { $gte: period.start, $lte: period.end },
  }).sort({ openedAt: -1 }).limit(500).lean();

  const totals = {
    sessionsCount: sessions.length,
    openSessionsCount: 0,
    closedSessionsCount: 0,
    pendingReviewCount: 0,
    ordersCount: 0,
    netSales: 0,
    openingAmount: 0,
    expectedCash: 0,
    countedCash: 0,
    differenceAmount: 0,
    shortages: 0,
    overages: 0,
    cashIn: 0,
    cashOut: 0,
    paymentTotals: { cash: 0, transfer: 0, card: 0, mixed: 0, other: 0, total: 0 },
  };
  const issueCounts = { critical: 0, attention: 0 };

  sessions.forEach((session) => {
    const reconciliation = session.reconciliation?.version
      ? session.reconciliation
      : buildCashReconciliation(session, { toleranceAmount });
    if (session.status === 'open') totals.openSessionsCount += 1;
    if (session.status === 'closed') totals.closedSessionsCount += 1;
    totals.pendingReviewCount += pendingClosingReviewCount(session);
    totals.ordersCount += Number(session.salesSummary?.ordersCount || 0);
    totals.netSales += money(session.salesSummary?.netSales);
    totals.openingAmount += money(session.openingAmount);
    totals.expectedCash += money(session.expectedCash);
    if (session.status === 'closed') totals.countedCash += money(session.countedCash);
    const difference = session.status === 'closed' ? signedMoney(session.differenceAmount) : 0;
    totals.differenceAmount += difference;
    if (difference < 0) totals.shortages += Math.abs(difference);
    if (difference > 0) totals.overages += difference;
    totals.cashIn += money(reconciliation.cashIn);
    totals.cashOut += money(reconciliation.cashOut);
    Object.keys(totals.paymentTotals).forEach((key) => {
      totals.paymentTotals[key] += money(session.salesSummary?.paymentTotals?.[key]);
    });
    if (reconciliation.status === 'critical') issueCounts.critical += 1;
    if (reconciliation.status === 'attention') issueCounts.attention += 1;
  });

  const status = issueCounts.critical > 0
    ? 'critical'
    : issueCounts.attention > 0 || totals.openSessionsCount > 0 || totals.pendingReviewCount > 0
      ? 'attention'
      : 'healthy';

  const alerts = [];
  if (issueCounts.critical) alerts.push({ code: 'integrity', severity: 'critical', message: `${issueCounts.critical} caja(s) presentan inconsistencias de conciliación.` });
  if (totals.pendingReviewCount) alerts.push({ code: 'pending_reviews', severity: 'attention', message: `${totals.pendingReviewCount} arqueo(s) requieren decisión de supervisión.` });
  if (totals.shortages) alerts.push({ code: 'shortages', severity: 'attention', message: `Faltantes acumulados por ${totals.shortages} COP.` });

  return {
    version: 'cash-journey-summary-v1',
    generatedAt: period.end,
    serverAuthoritative: true,
    branchId: id,
    period,
    status,
    issueCounts,
    totals,
    alerts,
    sessions: sessions.map((session) => serializeJourneySession(session, toleranceAmount)),
  };
}

module.exports = {
  BOGOTA_OFFSET_MS,
  SUMMARY_RANGES,
  appliedMovements,
  bogotaDayStart,
  buildCashJourneySummary,
  buildCashReconciliation,
  buildSummaryPeriod,
  movementTotal,
  pendingClosingReviewCount,
  pendingMovementCount,
};
