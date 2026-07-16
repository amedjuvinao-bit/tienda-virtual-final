// backend/controllers/adminDashboardController.js

const Product = require('../models/Product');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Favorite = require('../models/Favorite');
const Branch = require('../models/Branch');
const InventoryStock = require('../models/InventoryStock');
const CashSession = require('../models/CashSession');
const {
  getMonthPeriodKey,
  getMonthlyGoal,
  buildDashboardGoalSummary,
} = require('../services/dashboardGoalService');

const TIMEZONE = 'America/Bogota';

const VALID_SALE_STATUSES = ['paid', 'confirmed', 'shipped', 'delivered', 'completed'];
const ACTIONABLE_ORDER_STATUSES = ['pending', 'processing'];
const CANCELLED_STATUSES = ['cancelled', 'canceled', 'refunded', 'failed'];

const SALES_TOTAL_EXPRESSION = {
  $ifNull: [
    '$total',
    {
      $add: [
        { $ifNull: ['$subtotal', 0] },
        { $ifNull: ['$shipping', 0] },
        { $ifNull: ['$taxes.iva.amount', 0] },
      ],
    },
  ],
};

const QUICK_ACTIONS = [
  {
    id: 'new-order',
    label: 'Nueva orden',
    icon: 'plus',
    path: '/admin/ordenes',
  },
  {
    id: 'new-product',
    label: 'Agregar producto',
    icon: 'tag',
    path: '/admin/productos',
  },
  {
    id: 'reservations',
    label: 'Ver reservas',
    icon: 'calendar',
    path: '/admin/inventario',
  },
  {
    id: 'sales-report',
    label: 'Reporte de ventas',
    icon: 'chart',
    path: '/admin/ordenes',
  },
  {
    id: 'export-data',
    label: 'Exportar datos',
    icon: 'download',
    path: '/admin/inventario',
  },
];

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function roundNumber(value) {
  return Math.round(toNumber(value, 0));
}

function formatCurrency(value) {
  const number = toNumber(value, 0);

  return `$${number.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatPlainNumber(value) {
  return roundNumber(value).toLocaleString('en-US');
}

function pluralize(value, singular, plural) {
  return Number(value) === 1 ? singular : plural;
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

function getLastSevenDays() {
  const today = startOfDay(new Date());
  const start = addDays(today, -6);

  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(start, index);
    const key = date.toISOString().slice(0, 10);

    return {
      date,
      key,
      label: date
        .toLocaleDateString('es-CO', {
          weekday: 'short',
        })
        .replace('.', ''),
    };
  });
}

function getCurrentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  return { start, end };
}

function getTodayRange() {
  const start = startOfDay(new Date());
  const end = addDays(start, 1);

  return { start, end };
}

function getLastSevenRange() {
  const today = startOfDay(new Date());
  const currentStart = addDays(today, -6);
  const currentEnd = addDays(today, 1);
  const previousStart = addDays(currentStart, -7);
  const previousEnd = currentStart;

  return {
    currentStart,
    currentEnd,
    previousStart,
    previousEnd,
  };
}

function calculateTrend(current, previous) {
  const currentNumber = toNumber(current, 0);
  const previousNumber = toNumber(previous, 0);

  if (previousNumber <= 0 && currentNumber <= 0) {
    return {
      trend: '0%',
      trendType: 'neutral',
    };
  }

  if (previousNumber <= 0 && currentNumber > 0) {
    return {
      trend: '+100%',
      trendType: 'up',
    };
  }

  const percent = ((currentNumber - previousNumber) / previousNumber) * 100;
  const rounded = Math.abs(percent).toFixed(1);
  const sign = percent >= 0 ? '+' : '-';

  return {
    trend: `${sign}${rounded}%`,
    trendType: percent >= 0 ? 'up' : 'down',
  };
}

function buildSparkline(values = []) {
  const cleanValues = values
    .map((value) => roundNumber(value))
    .filter((value) => Number.isFinite(value));

  if (cleanValues.length === 0) return [];
  if (cleanValues.length >= 10) return cleanValues.slice(-10);

  const firstValue = cleanValues[0] || 0;
  const missing = 10 - cleanValues.length;

  return [...Array.from({ length: missing }, () => firstValue), ...cleanValues];
}

function getStatusLabel(status = '') {
  const value = String(status || '').toLowerCase();
  const labels = {
    pending: 'Pendiente',
    processing: 'En proceso',
    paid: 'Confirmada',
    confirmed: 'Confirmada',
    shipped: 'Enviado',
    delivered: 'Entregada',
    completed: 'Completada',
    cancelled: 'Cancelada',
    canceled: 'Cancelada',
    refunded: 'Reembolsada',
    failed: 'Fallida',
  };

  return labels[value] || 'Pendiente';
}

function getStatusType(status = '') {
  const value = String(status || '').toLowerCase();

  if (['paid', 'confirmed', 'delivered', 'completed'].includes(value)) return 'success';
  if (['processing', 'pending'].includes(value)) return 'warning';
  if (['shipped'].includes(value)) return 'info';
  if (['cancelled', 'canceled', 'refunded', 'failed'].includes(value)) return 'danger';

  return 'warning';
}

function formatRecentDate(date) {
  if (!date) return '';

  return new Date(date).toLocaleString('es-CO', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function getCustomerName(customer = {}) {
  const fullName = String(
    customer.fullName ||
      `${customer.name || customer.firstName || ''} ${
        customer.lastname || customer.lastName || ''
      }`
  )
    .trim()
    .replace(/\s+/g, ' ');

  return (
    fullName ||
    customer.email ||
    customer.phone ||
    customer.emailOrPhone ||
    'Cliente sin nombre'
  );
}

function getSaleOrigin(order = {}) {
  const source = String(order.source || '').toLowerCase();
  const channel = String(order.channel || '').toLowerCase();
  const saleType = String(order.saleType || '').toLowerCase();

  if (source === 'pos' || channel === 'physical_store' || saleType === 'pos_sale') {
    return {
      id: 'pos',
      label: 'POS',
      detail: 'Venta física',
    };
  }

  if (
    ['manual', 'admin', 'imported'].includes(source) ||
    ['manual_order', 'admin_order'].includes(saleType) ||
    ['admin_panel', 'manual'].includes(channel)
  ) {
    return {
      id: 'manual',
      label: 'Manual',
      detail: 'Panel administrativo',
    };
  }

  return {
    id: 'web',
    label: 'Web',
    detail: 'Tienda online',
  };
}

function getSalesBaseMatch({ start, end } = {}) {
  const match = {
    status: { $in: VALID_SALE_STATUSES },
  };

  if (start || end) {
    match.createdAt = {};
    if (start) match.createdAt.$gte = start;
    if (end) match.createdAt.$lt = end;
  }

  return match;
}

async function getSalesTotal(match = {}) {
  const result = await Order.aggregate([
    {
      $match: {
        status: { $in: VALID_SALE_STATUSES },
        ...match,
      },
    },
    {
      $group: {
        _id: null,
        total: {
          $sum: SALES_TOTAL_EXPRESSION,
        },
      },
    },
  ]);

  return toNumber(result?.[0]?.total, 0);
}

async function getOrdersCount(match = {}) {
  return Order.countDocuments({
    status: { $nin: CANCELLED_STATUSES },
    ...match,
  });
}

async function getLowStockCount() {
  const hasInventoryStock = await InventoryStock.exists({
    active: true,
    deletedAt: null,
  });

  const inventoryResult = await InventoryStock.aggregate([
    {
      $match: {
        active: true,
        deletedAt: null,
        reorderPoint: { $gt: 0 },
      },
    },
    {
      $addFields: {
        realAvailableStock: {
          $ifNull: ['$availableStock', '$stock'],
        },
      },
    },
    {
      $match: {
        $expr: {
          $lte: ['$realAvailableStock', '$reorderPoint'],
        },
      },
    },
    {
      $group: {
        _id: '$product',
      },
    },
    {
      $count: 'count',
    },
  ]);

  const inventoryCount = toNumber(inventoryResult?.[0]?.count, 0);

  if (hasInventoryStock) return inventoryCount;

  return Product.countDocuments({
    active: true,
    reorderPoint: { $gt: 0 },
    $expr: {
      $lte: ['$stock', '$reorderPoint'],
    },
  });
}

async function getSalesChartData() {
  const days = getLastSevenDays();
  const startDate = days[0].date;
  const endDate = addDays(days[days.length - 1].date, 1);

  const rows = await Order.aggregate([
    {
      $match: {
        status: { $in: VALID_SALE_STATUSES },
        createdAt: {
          $gte: startDate,
          $lt: endDate,
        },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: {
            format: '%Y-%m-%d',
            date: '$createdAt',
            timezone: TIMEZONE,
          },
        },
        value: {
          $sum: SALES_TOTAL_EXPRESSION,
        },
      },
    },
  ]);

  const valuesByDate = new Map(rows.map((row) => [row._id, toNumber(row.value, 0)]));

  return days.map((day) => ({
    label: day.label.charAt(0).toUpperCase() + day.label.slice(1),
    value: valuesByDate.get(day.key) || 0,
  }));
}

async function getTopProducts() {
  const thirtyDaysAgo = addDays(startOfDay(new Date()), -30);

  const rows = await Order.aggregate([
    {
      $match: {
        status: { $in: VALID_SALE_STATUSES },
        createdAt: {
          $gte: thirtyDaysAgo,
        },
      },
    },
    {
      $addFields: {
        dashboardItems: {
          $cond: [
            { $gt: [{ $size: { $ifNull: ['$items', []] } }, 0] },
            '$items',
            { $ifNull: ['$cart', []] },
          ],
        },
      },
    },
    {
      $unwind: '$dashboardItems',
    },
    {
      $addFields: {
        itemQty: {
          $ifNull: ['$dashboardItems.quantity', { $ifNull: ['$dashboardItems.qty', 1] }],
        },
        itemPrice: {
          $ifNull: [
            '$dashboardItems.price',
            {
              $ifNull: [
                '$dashboardItems.unitPrice',
                {
                  $ifNull: ['$dashboardItems.priceNumber', 0],
                },
              ],
            },
          ],
        },
      },
    },
    {
      $group: {
        _id: {
          product: {
            $ifNull: ['$dashboardItems.product', '$dashboardItems.productId'],
          },
          title: '$dashboardItems.title',
        },
        name: {
          $first: '$dashboardItems.title',
        },
        image: {
          $first: '$dashboardItems.image',
        },
        sales: {
          $sum: '$itemQty',
        },
        income: {
          $sum: {
            $multiply: ['$itemQty', '$itemPrice'],
          },
        },
      },
    },
    {
      $sort: {
        sales: -1,
        income: -1,
      },
    },
    {
      $limit: 3,
    },
  ]);

  return rows.map((row, index) => ({
    id: String(row?._id?.product || `top-${index + 1}`),
    name: row.name || 'Producto sin nombre',
    sku: '',
    sales: roundNumber(row.sales),
    income: formatCurrency(row.income),
    trend: buildSparkline([
      row.sales * 0.35,
      row.sales * 0.45,
      row.sales * 0.4,
      row.sales * 0.58,
      row.sales * 0.55,
      row.sales * 0.75,
      row.sales,
    ]),
    image: row.image || '',
  }));
}

async function getInventoryByBranch() {
  const inventoryRows = await InventoryStock.aggregate([
    {
      $match: {
        active: true,
        deletedAt: null,
      },
    },
    {
      $group: {
        _id: '$branch',
        branch: {
          $first: '$branchSnapshot.name',
        },
        code: {
          $first: '$branchSnapshot.code',
        },
        type: {
          $first: '$branchSnapshot.type',
        },
        products: {
          $sum: {
            $ifNull: ['$availableStock', '$stock'],
          },
        },
        uniqueProducts: {
          $addToSet: '$product',
        },
      },
    },
    {
      $sort: {
        products: -1,
      },
    },
    {
      $limit: 4,
    },
  ]);

  if (inventoryRows.length > 0) {
    const maxProducts = Math.max(
      ...inventoryRows.map((row) => toNumber(row.products, 0)),
      1
    );

    return inventoryRows.map((row, index) => ({
      id: String(row._id || row.code || `branch-${index + 1}`),
      branch: row.branch || row.code || 'Sede sin nombre',
      products: roundNumber(row.products),
      percentage: Math.min(
        100,
        Math.round((toNumber(row.products, 0) / maxProducts) * 100)
      ),
    }));
  }

  const fallbackRows = await Product.aggregate([
    {
      $match: {
        active: true,
      },
    },
    {
      $group: {
        _id: {
          $ifNull: ['$warehouseLocation', 'Inventario general'],
        },
        products: {
          $sum: {
            $ifNull: ['$stock', 0],
          },
        },
      },
    },
    {
      $sort: {
        products: -1,
      },
    },
    {
      $limit: 4,
    },
  ]);

  const maxProducts = Math.max(
    ...fallbackRows.map((row) => toNumber(row.products, 0)),
    1
  );

  return fallbackRows.map((row, index) => ({
    id: `warehouse-${index + 1}`,
    branch: row._id || 'Inventario general',
    products: roundNumber(row.products),
    percentage: Math.min(
      100,
      Math.round((toNumber(row.products, 0) / maxProducts) * 100)
    ),
  }));
}

async function getSalesByChannel({ start, end } = {}) {
  const rows = await Order.aggregate([
    {
      $match: getSalesBaseMatch({ start, end }),
    },
    {
      $addFields: {
        normalizedSource: {
          $toLower: {
            $ifNull: ['$source', ''],
          },
        },
        normalizedChannel: {
          $toLower: {
            $ifNull: ['$channel', ''],
          },
        },
        normalizedSaleType: {
          $toLower: {
            $ifNull: ['$saleType', ''],
          },
        },
      },
    },
    {
      $addFields: {
        saleChannel: {
          $switch: {
            branches: [
              {
                case: {
                  $or: [
                    { $eq: ['$normalizedSource', 'pos'] },
                    { $eq: ['$normalizedChannel', 'physical_store'] },
                    { $eq: ['$normalizedSaleType', 'pos_sale'] },
                  ],
                },
                then: 'pos',
              },
              {
                case: {
                  $or: [
                    { $in: ['$normalizedSource', ['manual', 'admin', 'imported']] },
                    { $in: ['$normalizedChannel', ['manual', 'admin_panel']] },
                    { $in: ['$normalizedSaleType', ['manual_order', 'admin_order']] },
                  ],
                },
                then: 'manual',
              },
            ],
            default: 'web',
          },
        },
        orderAmount: SALES_TOTAL_EXPRESSION,
      },
    },
    {
      $group: {
        _id: '$saleChannel',
        amount: {
          $sum: '$orderAmount',
        },
        orders: {
          $sum: 1,
        },
      },
    },
  ]);

  const byId = new Map(rows.map((row) => [row._id, row]));
  const totalSales = rows.reduce((total, row) => total + toNumber(row.amount, 0), 0);
  const totalOrders = rows.reduce((total, row) => total + toNumber(row.orders, 0), 0);

  const channelDefinitions = [
    {
      id: 'pos',
      label: 'POS',
      title: 'Venta física',
      description: 'Ventas cobradas desde punto de venta.',
    },
    {
      id: 'web',
      label: 'Web',
      title: 'Tienda online',
      description: 'Pedidos generados desde la tienda virtual.',
    },
    {
      id: 'manual',
      label: 'Manual',
      title: 'Panel admin',
      description: 'Órdenes creadas o importadas desde administración.',
    },
  ];

  return {
    periodLabel: 'Mes actual',
    totalSales: roundNumber(totalSales),
    totalSalesFormatted: formatCurrency(totalSales),
    totalOrders: roundNumber(totalOrders),
    channels: channelDefinitions.map((channel) => {
      const row = byId.get(channel.id) || {};
      const amount = toNumber(row.amount, 0);
      const orders = toNumber(row.orders, 0);

      return {
        ...channel,
        amount: roundNumber(amount),
        amountFormatted: formatCurrency(amount),
        orders: roundNumber(orders),
        percentage: totalSales > 0 ? Math.round((amount / totalSales) * 100) : 0,
      };
    }),
  };
}

async function getCashSummary({ start, end } = {}) {
  const openRowsPromise = CashSession.aggregate([
    {
      $match: {
        status: 'open',
      },
    },
    {
      $group: {
        _id: null,
        openSessions: { $sum: 1 },
        expectedCash: { $sum: { $ifNull: ['$expectedCash', 0] } },
        openingAmount: { $sum: { $ifNull: ['$openingAmount', 0] } },
        cashSales: { $sum: { $ifNull: ['$salesSummary.paymentTotals.cash', 0] } },
        netSales: { $sum: { $ifNull: ['$salesSummary.netSales', 0] } },
      },
    },
  ]);

  const todayRowsPromise = CashSession.aggregate([
    {
      $match: {
        openedAt: {
          $gte: start,
          $lt: end,
        },
        status: {
          $ne: 'cancelled',
        },
      },
    },
    {
      $group: {
        _id: null,
        sessionsToday: { $sum: 1 },
        cashSalesToday: { $sum: { $ifNull: ['$salesSummary.paymentTotals.cash', 0] } },
        netSalesToday: { $sum: { $ifNull: ['$salesSummary.netSales', 0] } },
      },
    },
  ]);

  const closedRowsPromise = CashSession.aggregate([
    {
      $match: {
        status: 'closed',
        closedAt: {
          $gte: start,
          $lt: end,
        },
      },
    },
    {
      $group: {
        _id: null,
        closedSessionsToday: { $sum: 1 },
        differenceToday: { $sum: { $ifNull: ['$differenceAmount', 0] } },
        countedCashToday: { $sum: { $ifNull: ['$countedCash', 0] } },
      },
    },
  ]);

  const posSalesTodayPromise = Order.aggregate([
    {
      $match: {
        createdAt: {
          $gte: start,
          $lt: end,
        },
        status: {
          $in: VALID_SALE_STATUSES,
        },
        $or: [
          { source: 'pos' },
          { channel: 'physical_store' },
          { saleType: 'pos_sale' },
        ],
      },
    },
    {
      $group: {
        _id: null,
        posSalesToday: {
          $sum: SALES_TOTAL_EXPRESSION,
        },
        posOrdersToday: {
          $sum: 1,
        },
      },
    },
  ]);

  const openSessionsPromise = CashSession.find({ status: 'open' })
    .sort({ openedAt: -1 })
    .limit(3)
    .select(
      'sessionCode status branchSnapshot cashRegisterCode cashRegisterName cashierSnapshot openedAt openingAmount expectedCash salesSummary'
    )
    .lean();

  const [openRows, todayRows, closedRows, posRows, openSessionsList] = await Promise.all([
    openRowsPromise,
    todayRowsPromise,
    closedRowsPromise,
    posSalesTodayPromise,
    openSessionsPromise,
  ]);

  const openData = openRows?.[0] || {};
  const todayData = todayRows?.[0] || {};
  const closedData = closedRows?.[0] || {};
  const posData = posRows?.[0] || {};

  const openSessions = roundNumber(openData.openSessions);
  const expectedCash = roundNumber(openData.expectedCash);
  const posSalesToday = roundNumber(posData.posSalesToday);

  return {
    status: openSessions > 0 ? 'open' : 'closed',
    statusLabel:
      openSessions > 0
        ? `${openSessions} ${pluralize(openSessions, 'caja abierta', 'cajas abiertas')}`
        : 'Sin caja abierta',
    periodLabel: 'Hoy',
    openSessions,
    sessionsToday: roundNumber(todayData.sessionsToday),
    closedSessionsToday: roundNumber(closedData.closedSessionsToday),
    posOrdersToday: roundNumber(posData.posOrdersToday),
    expectedCash,
    expectedCashFormatted: formatCurrency(expectedCash),
    openingAmount: roundNumber(openData.openingAmount),
    openingAmountFormatted: formatCurrency(openData.openingAmount),
    cashSales: roundNumber(openData.cashSales),
    cashSalesFormatted: formatCurrency(openData.cashSales),
    cashSalesToday: roundNumber(todayData.cashSalesToday),
    cashSalesTodayFormatted: formatCurrency(todayData.cashSalesToday),
    netSalesToday: roundNumber(todayData.netSalesToday),
    netSalesTodayFormatted: formatCurrency(todayData.netSalesToday),
    posSalesToday,
    posSalesTodayFormatted: formatCurrency(posSalesToday),
    differenceToday: roundNumber(closedData.differenceToday),
    differenceTodayFormatted: formatCurrency(closedData.differenceToday),
    countedCashToday: roundNumber(closedData.countedCashToday),
    countedCashTodayFormatted: formatCurrency(closedData.countedCashToday),
    sessions: openSessionsList.map((session) => ({
      id: String(session._id),
      sessionCode: session.sessionCode,
      branch: session.branchSnapshot?.name || session.branchSnapshot?.code || 'Sede sin nombre',
      cashRegisterCode: session.cashRegisterCode || 'CAJA',
      cashRegisterName: session.cashRegisterName || 'Caja',
      cashier:
        session.cashierSnapshot?.displayName ||
        session.cashierSnapshot?.username ||
        'Cajero sin nombre',
      openedAt: session.openedAt || null,
      expectedCash: roundNumber(session.expectedCash),
      expectedCashFormatted: formatCurrency(session.expectedCash),
      netSales: roundNumber(session.salesSummary?.netSales),
      netSalesFormatted: formatCurrency(session.salesSummary?.netSales),
    })),
  };
}

async function getRecentOrders() {
  const orders = await Order.find({})
    .sort({ createdAt: -1 })
    .limit(5)
    .select('orderNumber customer total status createdAt source channel saleType branchSnapshot payment cashSession')
    .lean();

  return orders.map((order) => {
    const origin = getSaleOrigin(order);

    return {
      id: order.orderNumber || String(order._id),
      customer: getCustomerName(order.customer),
      total: formatCurrency(order.total),
      status: getStatusLabel(order.status),
      statusType: getStatusType(order.status),
      date: formatRecentDate(order.createdAt),
      origin,
      source: origin.id,
      sourceLabel: origin.label,
      sourceDetail: origin.detail,
      branch: order.branchSnapshot?.name || order.branchSnapshot?.code || '',
      paymentStatus: order.payment?.status || '',
    };
  });
}

async function getOrderStatusBreakdown() {
  const rows = await Order.aggregate([
    {
      $group: {
        _id: {
          $ifNull: ['$status', 'unknown'],
        },
        count: {
          $sum: 1,
        },
      },
    },
    {
      $sort: {
        count: -1,
      },
    },
  ]);

  return rows.reduce((acc, row) => {
    acc[row._id] = row.count;
    return acc;
  }, {});
}

async function getAlerts({
  lowStockCount,
  withoutCategoryCount,
  withoutImageCount,
  pendingOrdersCount,
}) {
  const alerts = [];

  if (lowStockCount > 0) {
    alerts.push({
      id: 'alert-stock',
      title: `${lowStockCount} ${pluralize(
        lowStockCount,
        'producto con stock bajo',
        'productos con stock bajo'
      )}`,
      description: 'Revisa el inventario para evitar quiebres.',
      action: 'Revisar',
      type: 'stock',
    });
  }

  if (withoutCategoryCount > 0) {
    alerts.push({
      id: 'alert-category',
      title: `${withoutCategoryCount} ${pluralize(
        withoutCategoryCount,
        'producto sin categoría',
        'productos sin categoría'
      )}`,
      description: 'Organiza tus productos para mejor visibilidad.',
      action: 'Revisar',
      type: 'category',
    });
  }

  if (withoutImageCount > 0) {
    alerts.push({
      id: 'alert-image',
      title: `${withoutImageCount} ${pluralize(
        withoutImageCount,
        'producto sin imagen',
        'productos sin imagen'
      )}`,
      description: 'Agrega imágenes para mejorar la presentación.',
      action: 'Revisar',
      type: 'image',
    });
  }

  if (pendingOrdersCount > 0) {
    alerts.push({
      id: 'alert-orders',
      title: `${pendingOrdersCount} ${pluralize(
        pendingOrdersCount,
        'orden pendiente de revisión',
        'órdenes pendientes de revisión'
      )}`,
      description: 'Revisa pedidos pendientes o en proceso.',
      action: 'Revisar',
      type: 'orders',
    });
  }

  return alerts;
}

async function getDashboardSummary(req, res) {
  try {
    const { currentStart, currentEnd, previousStart, previousEnd } = getLastSevenRange();
    const { start: monthStart, end: monthEnd } = getCurrentMonthRange();
    const { start: todayStart, end: todayEnd } = getTodayRange();
    const goalPeriodKey = getMonthPeriodKey();

    const [
      currentSales,
      previousSales,
      currentOrders,
      previousOrders,
      activeCarts,
      previousCarts,
      favoriteItemsResult,
      previousFavoriteItemsResult,
      lowStockCount,
      totalProducts,
      activeProducts,
      inactiveProducts,
      withoutCategoryCount,
      withoutImageCount,
      pendingOrdersCount,
      salesChartData,
      topProducts,
      inventoryByBranch,
      recentOrders,
      monthSales,
      monthlyGoalDoc,
      totalBranches,
      orderStatusBreakdown,
      salesByChannel,
      cashSummary,
    ] = await Promise.all([
      getSalesTotal({
        createdAt: {
          $gte: currentStart,
          $lt: currentEnd,
        },
      }),

      getSalesTotal({
        createdAt: {
          $gte: previousStart,
          $lt: previousEnd,
        },
      }),

      getOrdersCount({
        createdAt: {
          $gte: currentStart,
          $lt: currentEnd,
        },
      }),

      getOrdersCount({
        createdAt: {
          $gte: previousStart,
          $lt: previousEnd,
        },
      }),

      Cart.countDocuments({
        'items.0': {
          $exists: true,
        },
      }),

      Cart.countDocuments({
        'items.0': {
          $exists: true,
        },
        updatedAt: {
          $gte: previousStart,
          $lt: previousEnd,
        },
      }),

      Favorite.aggregate([
        {
          $unwind: '$items',
        },
        {
          $count: 'count',
        },
      ]),

      Favorite.aggregate([
        {
          $match: {
            updatedAt: {
              $gte: previousStart,
              $lt: previousEnd,
            },
          },
        },
        {
          $unwind: '$items',
        },
        {
          $count: 'count',
        },
      ]),

      getLowStockCount(),

      Product.countDocuments({}),

      Product.countDocuments({
        active: true,
      }),

      Product.countDocuments({
        active: false,
      }),

      Product.countDocuments({
        active: true,
        $and: [
          {
            $or: [
              { category: { $exists: false } },
              { category: null },
              { category: '' },
            ],
          },
          {
            $or: [
              { categories: { $exists: false } },
              { categories: { $size: 0 } },
            ],
          },
        ],
      }),

      Product.countDocuments({
        active: true,
        $and: [
          {
            $or: [{ image: { $exists: false } }, { image: null }, { image: '' }],
          },
          {
            $or: [{ images: { $exists: false } }, { images: { $size: 0 } }],
          },
        ],
      }),

      Order.countDocuments({
        status: {
          $in: ACTIONABLE_ORDER_STATUSES,
        },
      }),

      getSalesChartData(),

      getTopProducts(),

      getInventoryByBranch(),

      getRecentOrders(),

      getSalesTotal({
        createdAt: {
          $gte: monthStart,
          $lt: monthEnd,
        },
      }),

      getMonthlyGoal({
        periodKey: goalPeriodKey,
        createIfMissing: true,
      }),

      Branch.countDocuments({
        deletedAt: null,
        active: true,
      }),

      getOrderStatusBreakdown(),

      getSalesByChannel({
        start: monthStart,
        end: monthEnd,
      }),

      getCashSummary({
        start: todayStart,
        end: todayEnd,
      }),
    ]);

    const favoriteItems = toNumber(favoriteItemsResult?.[0]?.count, 0);
    const previousFavoriteItems = toNumber(previousFavoriteItemsResult?.[0]?.count, 0);

    const incomeTrend = calculateTrend(currentSales, previousSales);
    const ordersTrend = calculateTrend(currentOrders, previousOrders);
    const cartsTrend = calculateTrend(activeCarts, previousCarts);
    const favoritesTrend = calculateTrend(favoriteItems, previousFavoriteItems);

    const salesSparkline = buildSparkline(salesChartData.map((item) => item.value));
    const monthlyGoal = buildDashboardGoalSummary({
      goal: monthlyGoalDoc,
      currentAmount: monthSales,
    });

    const kpis = [
      {
        id: 'income',
        title: 'Ingresos',
        value: formatCurrency(currentSales),
        helper: 'últimos 7 días',
        trend: incomeTrend.trend,
        trendType: incomeTrend.trendType,
        icon: 'income',
        accent: 'pink',
        sparkline: salesSparkline,
      },
      {
        id: 'new-orders',
        title: 'Pedidos nuevos',
        value: formatPlainNumber(currentOrders),
        helper: 'últimos 7 días',
        trend: ordersTrend.trend,
        trendType: ordersTrend.trendType,
        icon: 'cart',
        accent: 'rose',
        sparkline: buildSparkline(
          salesChartData.map((item) => (item.value > 0 ? item.value / 1000 : 0))
        ),
      },
      {
        id: 'active-carts',
        title: 'Carritos activos',
        value: formatPlainNumber(activeCarts),
        helper: 'con productos guardados',
        trend: cartsTrend.trend,
        trendType: cartsTrend.trendType,
        icon: 'cart-active',
        accent: 'fuchsia',
        sparkline: [],
      },
      {
        id: 'favorites',
        title: 'Favoritos',
        value: formatPlainNumber(favoriteItems),
        helper: 'productos guardados',
        trend: favoritesTrend.trend,
        trendType: favoritesTrend.trendType,
        icon: 'heart',
        accent: 'soft',
        sparkline: [],
      },
      {
        id: 'low-stock',
        title: 'Stock bajo',
        value: formatPlainNumber(lowStockCount),
        helper: 'Productos críticos',
        trend: '',
        trendType: lowStockCount > 0 ? 'warning' : 'neutral',
        icon: 'warning',
        accent: 'warning',
        sparkline: [],
      },
    ];

    const alerts = await getAlerts({
      lowStockCount,
      withoutCategoryCount,
      withoutImageCount,
      pendingOrdersCount,
    });

    return res.json({
      ok: true,
      data: {
        quickActions: QUICK_ACTIONS,
        kpis,
        salesChartData,
        topProducts,
        alerts,
        monthlyGoal,
        inventoryByBranch,
        recentOrders,
        salesByChannel,
        cashSummary,
        totals: {
          products: totalProducts,
          activeProducts,
          inactiveProducts,
          lowStockProducts: lowStockCount,
          branches: totalBranches,
          pendingOrders: pendingOrdersCount,
          currentSales,
          monthSales,
          activeCarts,
          favorites: favoriteItems,
          orderStatusBreakdown,
          posSales: salesByChannel.channels.find((channel) => channel.id === 'pos')?.amount || 0,
          webSales: salesByChannel.channels.find((channel) => channel.id === 'web')?.amount || 0,
          manualSales: salesByChannel.channels.find((channel) => channel.id === 'manual')?.amount || 0,
          salesByChannel,
          cashSummary,
        },
      },
    });
  } catch (error) {
    console.error('GET /api/admin/dashboard error:', error);

    return res.status(500).json({
      ok: false,
      message: 'No se pudo cargar el resumen del dashboard.',
      error: process.env.NODE_ENV === 'production' ? undefined : error.message,
    });
  }
}

module.exports = {
  getDashboardSummary,
};