// backend/controllers/adminDashboardGoalController.js

const Order = require('../models/Order');
const {
  getMonthPeriodKey,
  getMonthlyGoal,
  updateMonthlyGoal,
  buildDashboardGoalSummary,
} = require('../services/dashboardGoalService');

const VALID_GOAL_SALE_STATUSES = [
  'paid',
  'confirmed',
  'shipped',
  'delivered',
  'completed',
];

function normalizePeriodKey(value) {
  const periodKey = String(value || '').trim();

  if (!periodKey) return getMonthPeriodKey();

  if (!/^\d{4}-\d{2}$/.test(periodKey)) {
    const error = new Error('El periodo de la meta debe tener formato YYYY-MM.');
    error.statusCode = 400;
    throw error;
  }

  const [year, month] = periodKey.split('-').map(Number);

  if (month < 1 || month > 12 || year < 2000 || year > 2100) {
    const error = new Error('El periodo de la meta no es válido.');
    error.statusCode = 400;
    throw error;
  }

  return periodKey;
}

function getBogotaMonthRange(periodKey) {
  const safePeriodKey = normalizePeriodKey(periodKey);
  const [year, month] = safePeriodKey.split('-').map(Number);

  return {
    start: new Date(Date.UTC(year, month - 1, 1, 5, 0, 0, 0)),
    end: new Date(Date.UTC(year, month, 1, 5, 0, 0, 0)),
  };
}

function getAdminReference(req) {
  return req.adminUserId || req.adminUsername || req.adminUser || null;
}

function getGoalAmountFromBody(body = {}) {
  return body.targetAmount ?? body.amount ?? body.goal ?? body.value;
}

async function getMonthlyRevenue(periodKey) {
  const { start, end } = getBogotaMonthRange(periodKey);

  const rows = await Order.aggregate([
    {
      $match: {
        status: { $in: VALID_GOAL_SALE_STATUSES },
        createdAt: {
          $gte: start,
          $lt: end,
        },
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

  return Number(rows?.[0]?.total || 0);
}

function sendError(res, error, fallbackMessage) {
  const statusCode = Number(error?.statusCode || 500);

  if (statusCode >= 500) {
    console.error('[adminDashboardGoalController]', error);
  }

  return res.status(statusCode).json({
    ok: false,
    message: error?.message || fallbackMessage,
    error: process.env.NODE_ENV === 'production' ? undefined : error?.message,
  });
}

async function getDashboardGoal(req, res) {
  try {
    const periodKey = normalizePeriodKey(req.query.periodKey);

    const [goal, currentAmount] = await Promise.all([
      getMonthlyGoal({ periodKey, createIfMissing: true }),
      getMonthlyRevenue(periodKey),
    ]);

    return res.json({
      ok: true,
      data: buildDashboardGoalSummary({ goal, currentAmount }),
    });
  } catch (error) {
    return sendError(
      res,
      error,
      'No se pudo cargar la meta mensual del dashboard.'
    );
  }
}

async function updateDashboardGoal(req, res) {
  try {
    const periodKey = normalizePeriodKey(req.body?.periodKey || req.query.periodKey);
    const targetAmount = getGoalAmountFromBody(req.body);

    const goal = await updateMonthlyGoal({
      periodKey,
      targetAmount,
      title: req.body?.title,
      notes: req.body?.notes,
      currency: req.body?.currency,
      updatedBy: getAdminReference(req),
    });

    const currentAmount = await getMonthlyRevenue(periodKey);

    return res.json({
      ok: true,
      message: 'Meta mensual actualizada correctamente.',
      data: buildDashboardGoalSummary({ goal, currentAmount }),
    });
  } catch (error) {
    return sendError(
      res,
      error,
      'No se pudo actualizar la meta mensual del dashboard.'
    );
  }
}

module.exports = {
  getDashboardGoal,
  updateDashboardGoal,
};
