// backend/routes/adminDashboardSales.js

const express = require('express');

const requireAdmin = require('../middleware/requireAdmin');
const requirePermission = require('../middleware/requirePermission');
const { getDashboardSales } = require('../controllers/adminDashboardSalesController');

const router = express.Router();

/* ============================
 * VENTAS DEL DASHBOARD
 * GET /api/admin/dashboard-sales
 * ============================ */

router.get(
  '/',
  requireAdmin,
  requirePermission('dashboard:view'),
  getDashboardSales
);

module.exports = router;
