// backend/controllers/adminDashboardSalesController.js

const Order = require('../models/Order');

const TIMEZONE = 'America/Bogota';
const VALID_SALE_STATUSES = ['paid', 'confirmed', 'shipped', 'delivered', 'completed'];

const SALES_RANGE_OPTIONS = {
  this_week: 'Esta semana',
  last_7_days: 'Últimos 7 días',
  this_month: 'Este mes',
  previous_month: 'Mes anterior',
};

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function roundNumber(value) {
  return Math.round(toNumber(value, 0));
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfWeekMonday(date) {
  const d = startOfDay(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(d, diff);
}

function normalizeRange(value) {
  const key = String(value || '').trim().toLowerCase();
  return SALES_RANGE_OPTIONS[key] ? key : 'this_week';
}

function normalizeCompare(value) {
  return ['1', 'true', 'yes', 'si', 'sí'].includes(String(value || '').trim().toLowerCase());
}

function getRangeDates(rangeKey) {
  const today = startOfDay(new Date());

  if (rangeKey === 'last_7_days') {
    const currentStart = addDays(today, -6);
    const currentEnd = addDays(today, 1);
    return {
      currentStart,
      currentEnd,
      previousStart: addDays(currentStart, -7),
      previousEnd: currentStart,
    };
  }

  if (rangeKey === 'this_month') {
    const currentStart = startOfMonth(today);
    const currentEnd = addMonths(currentStart, 1);
    const previousStart = addMonths(currentStart, -1);
    return {
      currentStart,
      currentEnd,
      previousStart,
      previousEnd: currentStart,
    };
  }

  if (rangeKey === 'previous_month') {
    const currentEnd = startOfMonth(today);
    const currentStart = addMonths(currentEnd, -1);
    const previousStart = addMonths(currentStart, -1);
    return {
      currentStart,
      currentEnd,
      previousStart,
      previousEnd: currentStart,
    };
  }

  const currentStart = startOfWeekMonday(today);
  const currentEnd = addDays(currentStart, 7);

  return {
    currentStart,
    currentEnd,
    previousStart: addDays(currentStart, -7),
    previousEnd: currentStart,
  };
}

function formatShortWeekday(date) {
  return date
    .toLocaleDateString('es-CO', {
      weekday: 'short',
      timeZone: TIMEZONE,
    })
    .replace('.', '');
}

function formatShortMonth(date) {
  return date
    .toLocaleDateString('es-CO', {
      month: 'short',
      timeZone: TIMEZONE,
    })
    .replace('.', '');
}

function formatBucketLabel(start, end) {
  const exclusiveEnd = addDays(end, -1);
  const dayCount = Math.max(
    1,
    Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
  );

  if (dayCount <= 1) {
    return formatShortWeekday(start).charAt(0).toUpperCase() + formatShortWeekday(start).slice(1);
  }

  const sameMonth = start.getMonth() === exclusiveEnd.getMonth();
  const monthLabel = formatShortMonth(exclusiveEnd);

  if (sameMonth) {
    return `${start.getDate()}-${exclusiveEnd.getDate()} ${monthLabel}`;
  }

  return `${start.getDate()} ${formatShortMonth(start)}-${exclusiveEnd.getDate()} ${monthLabel}`;
}

function buildBuckets(start, end, maxBuckets = 7) {
  const totalMs = Math.max(end.getTime() - start.getTime(), 1);
  const totalDays = Math.max(1, Math.round(totalMs / (24 * 60 * 60 * 1000)));

  if (totalDays <= maxBuckets) {
    return Array.from({ length: totalDays }, (_, index) => {
      const bucketStart = addDays(start, index);
      const bucketEnd = addDays(bucketStart, 1);
      return {
        start: bucketStart,
        end: bucketEnd,
        label: formatBucketLabel(bucketStart, bucketEnd),
        value: 0,
      };
    });
  }

  const bucketCount = maxBuckets;
  return Array.from({ length: bucketCount }, (_, index) => {
    const bucketStart = new Date(start.getTime() + (totalMs / bucketCount) * index);
    const bucketEnd =
      index === bucketCount - 1
        ? new Date(end)
        : new Date(start.getTime() + (totalMs / bucketCount) * (index + 1));

    return {
      start,
      end,
      label: formatBucketLabel(bucketStart, bucketEnd),
      value: 0,
      bucketStart,
      bucketEnd,
    };
  }).map((bucket) => ({
    start: bucket.bucketStart,
    end: bucket.bucketEnd,
    label: bucket.label,
    value: 0,
  }));
}

function putOrderIntoBucket(buckets, order) {
  const createdAt = new Date(order.createdAt);
  const total = toNumber(order.total, 0);

  const bucket = buckets.find(
    (item) => createdAt >= item.start && createdAt < item.end
  );

  if (bucket) {
    bucket.value += total;
  }
}

async function getSalesForRange(start, end) {
  const orders = await Order.find({
    status: { $in: VALID_SALE_STATUSES },
    createdAt: {
      $gte: start,
      $lt: end,
    },
  })
    .select('createdAt total')
    .lean();

  return orders;
}

async function buildChartData(start, end) {
  const buckets = buildBuckets(start, end);
  const orders = await getSalesForRange(start, end);

  orders.forEach((order) => putOrderIntoBucket(buckets, order));

  return buckets.map((bucket) => ({
    label: bucket.label,
    value: roundNumber(bucket.value),
  }));
}

function sumChartData(chartData = []) {
  return chartData.reduce((total, item) => total + toNumber(item.value, 0), 0);
}

function calculateTrend(current, previous) {
  const currentNumber = toNumber(current, 0);
  const previousNumber = toNumber(previous, 0);

  if (previousNumber <= 0 && currentNumber <= 0) {
    return { trend: '0%', trendType: 'neutral' };
  }

  if (previousNumber <= 0 && currentNumber > 0) {
    return { trend: '+100%', trendType: 'up' };
  }

  const percent = ((currentNumber - previousNumber) / previousNumber) * 100;
  const rounded = Math.abs(percent).toFixed(1);
  const sign = percent >= 0 ? '+' : '-';

  return {
    trend: `${sign}${rounded}%`,
    trendType: percent >= 0 ? 'up' : 'down',
  };
}

async function getDashboardSales(req, res) {
  try {
    const range = normalizeRange(req.query.range);
    const compare = normalizeCompare(req.query.compare);
    const { currentStart, currentEnd, previousStart, previousEnd } = getRangeDates(range);

    const [chartData, comparisonChartData] = await Promise.all([
      buildChartData(currentStart, currentEnd),
      compare ? buildChartData(previousStart, previousEnd) : Promise.resolve([]),
    ]);

    const currentSales = sumChartData(chartData);
    const previousSales = compare ? sumChartData(comparisonChartData) : 0;
    const salesTrend = compare ? calculateTrend(currentSales, previousSales) : null;

    return res.json({
      ok: true,
      data: {
        range,
        rangeLabel: SALES_RANGE_OPTIONS[range],
        compare,
        chartData,
        comparisonChartData,
        summary: {
          currentSales,
          previousSales,
          trend: salesTrend?.trend || '',
          trendType: salesTrend?.trendType || 'neutral',
        },
      },
    });
  } catch (error) {
    console.error('GET /api/admin/dashboard-sales error:', error);

    return res.status(500).json({
      ok: false,
      message: 'No se pudo cargar el gráfico de ventas del dashboard.',
      error: process.env.NODE_ENV === 'production' ? undefined : error.message,
    });
  }
}

module.exports = {
  getDashboardSales,
};
