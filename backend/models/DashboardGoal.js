// backend/models/DashboardGoal.js

const mongoose = require('mongoose');

const DASHBOARD_GOAL_METRICS = Object.freeze({
  MONTHLY_REVENUE: 'monthly_revenue',
});

const DASHBOARD_GOAL_PERIODS = Object.freeze({
  MONTH: 'month',
});

const dashboardGoalSchema = new mongoose.Schema(
  {
    metric: {
      type: String,
      trim: true,
      enum: Object.values(DASHBOARD_GOAL_METRICS),
      default: DASHBOARD_GOAL_METRICS.MONTHLY_REVENUE,
      required: true,
    },

    periodType: {
      type: String,
      trim: true,
      enum: Object.values(DASHBOARD_GOAL_PERIODS),
      default: DASHBOARD_GOAL_PERIODS.MONTH,
      required: true,
    },

    // Formato estable para metas mensuales: YYYY-MM.
    periodKey: {
      type: String,
      trim: true,
      required: true,
      match: [/^\d{4}-\d{2}$/, 'El periodo de la meta debe tener formato YYYY-MM.'],
    },

    title: {
      type: String,
      trim: true,
      default: 'Meta de ingresos',
      maxlength: 80,
    },

    targetAmount: {
      type: Number,
      required: true,
      min: [0, 'La meta no puede ser negativa.'],
      default: 250000,
    },

    currency: {
      type: String,
      trim: true,
      uppercase: true,
      default: 'COP',
      maxlength: 8,
    },

    active: {
      type: Boolean,
      default: true,
      index: true,
    },

    notes: {
      type: String,
      trim: true,
      default: '',
      maxlength: 240,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      default: null,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      default: null,
    },
  },
  { timestamps: true }
);

// Una meta activa por métrica y periodo.
dashboardGoalSchema.index(
  { metric: 1, periodType: 1, periodKey: 1 },
  { unique: true }
);

dashboardGoalSchema.index({ active: 1, metric: 1, periodKey: -1 });

module.exports = mongoose.model('DashboardGoal', dashboardGoalSchema);
module.exports.DASHBOARD_GOAL_METRICS = DASHBOARD_GOAL_METRICS;
module.exports.DASHBOARD_GOAL_PERIODS = DASHBOARD_GOAL_PERIODS;
