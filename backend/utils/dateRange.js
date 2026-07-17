// backend/utils/dateRange.js

function clean(value) {
  return String(value || '').trim();
}

function cleanLower(value) {
  return clean(value).toLowerCase();
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + Number(days || 0));
  return d;
}

function startOfMonth(date) {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfMonth(date) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + 1, 0);
  d.setHours(23, 59, 59, 999);
  return d;
}

function parseDateOnlyLocal(value) {
  const text = clean(value);
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;

  const date = new Date(year, month - 1, day, 0, 0, 0, 0);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function safeDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : new Date(value);

  const dateOnly = parseDateOnlyLocal(value);
  if (dateOnly) return dateOnly;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatLocalDate(date) {
  const d = safeDate(date) || new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function resolveDateRange(query = {}, options = {}) {
  const now = safeDate(options.now) || new Date();
  const range = cleanLower(query.range || options.defaultRange || 'this_month');

  let from;
  let to;

  if (range === 'today') {
    from = startOfDay(now);
    to = endOfDay(now);
  } else if (range === 'yesterday') {
    const yesterday = addDays(now, -1);
    from = startOfDay(yesterday);
    to = endOfDay(yesterday);
  } else if (range === 'last_7_days') {
    from = startOfDay(addDays(now, -6));
    to = endOfDay(now);
  } else if (range === 'this_week') {
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1;
    from = startOfDay(addDays(now, -diff));
    to = endOfDay(now);
  } else if (range === 'previous_month') {
    const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    from = startOfMonth(previous);
    to = endOfMonth(previous);
  } else if (range === 'this_year') {
    from = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    to = endOfDay(now);
  } else {
    from = startOfMonth(now);
    to = endOfDay(now);
  }

  const customFrom = safeDate(query.dateFrom || query.from || query.startDate);
  const customTo = safeDate(query.dateTo || query.to || query.endDate);

  if (customFrom) from = startOfDay(customFrom);
  if (customTo) to = endOfDay(customTo);

  return {
    range,
    from,
    to,
    fromISO: from.toISOString(),
    toISO: to.toISOString(),
    fromLocal: formatLocalDate(from),
    toLocal: formatLocalDate(to),
  };
}

function isDateWithinRange(date, range) {
  const d = safeDate(date);
  if (!d || !range?.from || !range?.to) return false;
  return d >= range.from && d <= range.to;
}

module.exports = {
  addDays,
  endOfDay,
  endOfMonth,
  formatLocalDate,
  isDateWithinRange,
  parseDateOnlyLocal,
  resolveDateRange,
  safeDate,
  startOfDay,
  startOfMonth,
};
