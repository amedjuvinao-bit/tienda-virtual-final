// backend/routes/adminDashboardGoal.js

const express = require('express');

const requireAdmin = require('../middleware/requireAdmin');
const requirePermission = require('../middleware/requirePermission');

const {
  getDashboardGoal,
  updateDashboardGoal,
} = require('../controllers/adminDashboardGoalController');

const router = express.Router();

/* ============================
 * META MENSUAL DEL DASHBOARD
 * GET /api/admin/dashboard-goal
 * PUT /api/admin/dashboard-goal
 * ============================ */

router.get(
  '/',
  requireAdmin,
  requirePermission('dashboard:view'),
  getDashboardGoal
);

router.put(
  '/',
  requireAdmin,
  requirePermission.any(['dashboard:update', 'dashboard:manage', 'dashboard:*']),
  updateDashboardGoal
);

module.exports = router;
