// backend/routes/adminDashboard.js

const express = require('express');

const requireAdmin = require('../middleware/requireAdmin');
const requirePermission = require('../middleware/requirePermission');

const {
  getDashboardSummary,
} = require('../controllers/adminDashboardController');

const router = express.Router();

/* ============================
 * DASHBOARD ADMINISTRATIVO
 * GET /api/admin/dashboard
 * ============================ */

router.get(
  '/',
  requireAdmin,
  requirePermission('dashboard:view'),
  getDashboardSummary
);

module.exports = router;