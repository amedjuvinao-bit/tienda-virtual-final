// backend/controllers/adminDashboardController.js

const Product = require('../models/Product');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Favorite = require('../models/Favorite');
const Branch = require('../models/Branch');
const InventoryStock = require('../models/InventoryStock');

const TIMEZONE = 'America/Bogota';

const VALID_SALE_STATUSES = ['paid', 'confirmed', 'shipped', 'delivered', 'completed'];
const ACTIONABLE_ORDER_STATUSES = ['pending', 'processing'];
const CANCELLED_STATUSES = ['cancelled', 'canceled', 'refunded', 'failed'];

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

  return {
    start,
    end,
  };
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

  if (cleanValues.length >= 10) {
    return cleanValues.slice(-10);
  }

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
          $sum: {
            $ifNull: ['$total', 0],
          },
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
          $sum: {
            $ifNull: ['$total', 0],
          },
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
      $unwind: '$items',
    },
    {
      $addFields: {
        itemQty: {
          $ifNull: ['$items.quantity', { $ifNull: ['$items.qty', 1] }],
        },
        itemPrice: {
          $ifNull: [
            '$items.price',
            {
              $ifNull: [
                '$items.unitPrice',
                {
                  $ifNull: ['$items.priceNumber', 0],
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
            $ifNull: ['$items.product', '$items.productId'],
          },
          title: '$items.title',
        },
        name: {
          $first: '$items.title',
        },
        image: {
          $first: '$items.image',
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

async function getRecentOrders() {
  const orders = await Order.find({})
    .sort({ createdAt: -1 })
    .limit(5)
    .select('orderNumber customer total status createdAt')
    .lean();

  return orders.map((order) => ({
    id: order.orderNumber || String(order._id),
    customer: getCustomerName(order.customer),
    total: formatCurrency(order.total),
    status: getStatusLabel(order.status),
    statusType: getStatusType(order.status),
    date: formatRecentDate(order.createdAt),
  }));
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
      totalBranches,
      orderStatusBreakdown,
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

      Branch.countDocuments({
        deletedAt: null,
        active: true,
      }),

      getOrderStatusBreakdown(),
    ]);

    const favoriteItems = toNumber(favoriteItemsResult?.[0]?.count, 0);
    const previousFavoriteItems = toNumber(previousFavoriteItemsResult?.[0]?.count, 0);

    const incomeTrend = calculateTrend(currentSales, previousSales);
    const ordersTrend = calculateTrend(currentOrders, previousOrders);
    const cartsTrend = calculateTrend(activeCarts, previousCarts);
    const favoritesTrend = calculateTrend(favoriteItems, previousFavoriteItems);

    const salesSparkline = buildSparkline(salesChartData.map((item) => item.value));

    const monthlyGoalValue = toNumber(process.env.DASHBOARD_MONTHLY_GOAL, 250000);
    const monthlyGoalPercentage =
      monthlyGoalValue > 0 ? Math.min(100, Math.round((monthSales / monthlyGoalValue) * 100)) : 0;

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

    const monthlyGoal = {
      title: 'Meta de ingresos',
      goal: formatCurrency(monthlyGoalValue),
      current: formatCurrency(monthSales),
      percentage: monthlyGoalPercentage,
      detail: `${formatCurrency(monthSales)} / ${formatCurrency(monthlyGoalValue)}`,
    };

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