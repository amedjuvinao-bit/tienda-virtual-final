"use strict";

const express = require("express");
const requirePermission = require("../middleware/requirePermission");
const { canAdminSeeAllBranches } = require("../services/orderAdminScopeService");
const { createAdminSubscriptionReader } = require("../services/newsletter/adminRead");
const router = express.Router();
const reader = createAdminSubscriptionReader();

// Mounted after requireAdmin in adminCustomers. Newsletter contacts are global,
// including people without a Customer; a branch scope cannot isolate this list.
router.use(requirePermission(["customers:view", "customers:audit", "customers:sensitive"]));
router.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  if (!canAdminSeeAllBranches(req)) {
    return res.status(403).json({ ok: false, error: "SUBSCRIPTIONS_GLOBAL_ACCESS_REQUIRED",
      message: "La consulta de suscriptores requiere acceso administrativo global." });
  }
  return next();
});

function sendError(res, error) {
  const status = error.statusCode || 503;
  return res.status(status).json({ ok: false,
    error: error.statusCode ? error.code : "SUBSCRIPTIONS_UNAVAILABLE",
    message: error.statusCode ? error.message : "No se pudieron consultar las suscripciones. Intenta actualizar." });
}

router.get("/", async (req, res) => {
  try { return res.json(await reader.list(req.query)); }
  catch (error) { return sendError(res, error); }
});

router.get("/:id", async (req, res) => {
  try { return res.json(await reader.detail(req.params.id, req.query)); }
  catch (error) { return sendError(res, error); }
});

module.exports = router;
