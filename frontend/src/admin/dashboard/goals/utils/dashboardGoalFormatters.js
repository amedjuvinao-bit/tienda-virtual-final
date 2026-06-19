// frontend/src/admin/dashboard/goals/utils/dashboardGoalFormatters.js

const DEFAULT_CURRENCY = 'COP';
const MAX_TARGET_AMOUNT = 999999999;

export function toNumber(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  const normalized = String(value ?? '')
    .replace(/[^0-9.,-]/g, '')
    .replace(/,/g, '');

  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : 0;
}

export function clampAmount(value) {
  const amount = Math.round(toNumber(value));

  if (amount < 0) return 0;
  if (amount > MAX_TARGET_AMOUNT) return MAX_TARGET_AMOUNT;

  return amount;
}

export function cleanAmountInput(value) {
  return String(value ?? '').replace(/[^0-9]/g, '');
}

export function formatCurrency(value, currency = DEFAULT_CURRENCY) {
  const amount = toNumber(value);

  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatAmountInput(value) {
  const cleanValue = cleanAmountInput(value);

  if (!cleanValue) return '';

  return new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(cleanValue));
}

export function normalizeGoalForForm(goal = {}) {
  return {
    targetAmount: goal.targetAmount ? String(Math.round(Number(goal.targetAmount))) : '',
    currency: goal.currency || DEFAULT_CURRENCY,
    notes: goal.notes || '',
    periodKey: goal.periodKey || '',
  };
}

export function buildGoalPayload(form = {}) {
  return {
    targetAmount: clampAmount(form.targetAmount),
    currency: form.currency || DEFAULT_CURRENCY,
    notes: String(form.notes || '').trim(),
  };
}

export function validateGoalForm(form = {}) {
  const targetAmount = clampAmount(form.targetAmount);

  if (!targetAmount) {
    return 'La meta mensual debe ser mayor a cero.';
  }

  if (targetAmount > MAX_TARGET_AMOUNT) {
    return 'La meta mensual es demasiado alta.';
  }

  return '';
}

export function getGoalPercentage(goal = {}) {
  const percentage = Number(goal.percentage || 0);

  if (!Number.isFinite(percentage)) return 0;
  if (percentage < 0) return 0;
  if (percentage > 100) return 100;

  return Math.round(percentage);
}
