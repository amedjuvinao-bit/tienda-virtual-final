// backend/services/dashboardGoalService.js

const DashboardGoal = require('../models/DashboardGoal');
const {
  DASHBOARD_GOAL_METRICS,
  DASHBOARD_GOAL_PERIODS,
} = require('../models/DashboardGoal');

const TIMEZONE = 'America/Bogota';
const DEFAULT_MONTHLY_GOAL_AMOUNT = normalizeAmount(
  process.env.DASHBOARD_MONTHLY_GOAL || 250000
);
const DEFAULT_MONTHLY_GOAL_TITLE = 'Meta de ingresos';
const DEFAULT_CURRENCY = 'COP';

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function roundMoney(value) {
  return Math.round(toNumber(value, 0) * 100) / 100;
}

function formatCurrency(value) {
  const number = roundMoney(value);

  return `$${number.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function normalizeText(value, fallback = '') {
  const text = String(value || '').trim().replace(/\s+/g, ' ');
  return text || fallback;
}

function normalizeCurrency(value) {
  return normalizeText(value, DEFAULT_CURRENCY).toUpperCase().slice(0, 8);
}

function parseAmountString(value) {
  const raw = String(value || '').trim();
  if (!raw) return NaN;

  const clean = raw.replace(/[^\d.,-]/g, '');
  const lastDot = clean.lastIndexOf('.');
  const lastComma = clean.lastIndexOf(',');

  if (lastDot >= 0 && lastComma >= 0) {
    const decimalSeparator = lastDot > lastComma ? '.' : ',';
    const thousandsSeparator = decimalSeparator === '.' ? ',' : '.';

    return Number(
      clean
        .replaceAll(thousandsSeparator, '')
        .replace(decimalSeparator, '.')
    );
  }

  if (lastComma >= 0) {
    const decimalDigits = clean.length - lastComma - 1;
    const normalized = decimalDigits > 0 && decimalDigits <= 2
      ? clean.replace(',', '.')
      : clean.replaceAll(',', '');

    return Number(normalized);
  }

  if (lastDot >= 0) {
    const decimalDigits = clean.length - lastDot - 1;
    const normalized = decimalDigits > 0 && decimalDigits <= 2
      ? clean
      : clean.replaceAll('.', '');

    return Number(normalized);
  }

  return Number(clean);
}

function normalizeAmount(value) {
  const amount = typeof value === 'number' ? value : parseAmountString(value);

  if (!Number.isFinite(amount) || amount < 0) {
    return 0;
  }

  return roundMoney(amount);
}

function getMonthPeriodKey(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
  });

  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;

  return `${year}-${month}`;
}

function getDefaultMonthlyGoalData(periodKey = getMonthPeriodKey()) {
  return {
    metric: DASHBOARD_GOAL_METRICS.MONTHLY_REVENUE,
    periodType: DASHBOARD_GOAL_PERIODS.MONTH,
    periodKey,
    title: DEFAULT_MONTHLY_GOAL_TITLE,
    targetAmount: DEFAULT_MONTHLY_GOAL_AMOUNT,
    currency: DEFAULT_CURRENCY,
    active: true,
    notes: '',
  };
}

async function getMonthlyGoal({ periodKey = getMonthPeriodKey(), createIfMissing = true } = {}) {
  const query = {
    metric: DASHBOARD_GOAL_METRICS.MONTHLY_REVENUE,
    periodType: DASHBOARD_GOAL_PERIODS.MONTH,
    periodKey,
  };

  let goal = await DashboardGoal.findOne(query).lean();

  if (!goal && createIfMissing) {
    goal = await DashboardGoal.findOneAndUpdate(
      query,
      {
        $setOnInsert: getDefaultMonthlyGoalData(periodKey),
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    ).lean();
  }

  return goal;
}

async function updateMonthlyGoal({
  periodKey = getMonthPeriodKey(),
  targetAmount,
  title,
  notes,
  currency,
  updatedBy = null,
} = {}) {
  const normalizedAmount = normalizeAmount(targetAmount);

  if (normalizedAmount <= 0) {
    const error = new Error('La meta mensual debe ser mayor que cero.');
    error.statusCode = 400;
    throw error;
  }

  const query = {
    metric: DASHBOARD_GOAL_METRICS.MONTHLY_REVENUE,
    periodType: DASHBOARD_GOAL_PERIODS.MONTH,
    periodKey,
  };

  const update = {
    $set: {
      title: normalizeText(title, DEFAULT_MONTHLY_GOAL_TITLE).slice(0, 80),
      targetAmount: normalizedAmount,
      currency: normalizeCurrency(currency),
      notes: normalizeText(notes, '').slice(0, 240),
      active: true,
      updatedBy,
    },
    $setOnInsert: {
      metric: DASHBOARD_GOAL_METRICS.MONTHLY_REVENUE,
      periodType: DASHBOARD_GOAL_PERIODS.MONTH,
      periodKey,
      createdBy: updatedBy,
    },
  };

  return DashboardGoal.findOneAndUpdate(query, update, {
    new: true,
    upsert: true,
    runValidators: true,
    setDefaultsOnInsert: true,
  }).lean();
}

function buildDashboardGoalSummary({ goal, currentAmount = 0 } = {}) {
  const safeGoal = goal || getDefaultMonthlyGoalData();
  const targetAmount = normalizeAmount(safeGoal.targetAmount || DEFAULT_MONTHLY_GOAL_AMOUNT);
  const achievedAmount = roundMoney(currentAmount);
  const percentage = targetAmount > 0
    ? Math.min(Math.round((achievedAmount / targetAmount) * 100), 100)
    : 0;

  return {
    title: safeGoal.title || DEFAULT_MONTHLY_GOAL_TITLE,
    goal: formatCurrency(targetAmount),
    detail: `${formatCurrency(achievedAmount)} / ${formatCurrency(targetAmount)}`,
    percentage,
    metric: safeGoal.metric || DASHBOARD_GOAL_METRICS.MONTHLY_REVENUE,
    periodType: safeGoal.periodType || DASHBOARD_GOAL_PERIODS.MONTH,
    periodKey: safeGoal.periodKey || getMonthPeriodKey(),
    targetAmount,
    currentAmount: achievedAmount,
    currency: normalizeCurrency(safeGoal.currency),
    notes: safeGoal.notes || '',
  };
}

module.exports = {
  TIMEZONE,
  DEFAULT_MONTHLY_GOAL_AMOUNT,
  DEFAULT_MONTHLY_GOAL_TITLE,
  DEFAULT_CURRENCY,
  formatCurrency,
  getMonthPeriodKey,
  getDefaultMonthlyGoalData,
  getMonthlyGoal,
  updateMonthlyGoal,
  buildDashboardGoalSummary,
  normalizeAmount,
};
