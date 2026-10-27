"use strict";
const express = require("express");
const rateLimit = require("express-rate-limit");
const SiteSettings = require("../models/SiteSettings");
const ConsumerCase = require("../models/ConsumerCase");
const requireAdmin = require("../middleware/requireAdmin");
const requirePermission = require("../middleware/requirePermission");
const {
  normalizeConfig,
  policyDocument,
} = require("../services/consumer/policies");
const { digest } = require("../services/consumer/checkoutContract");
const {
  TYPES,
  error,
  publicCase,
  submitCase,
  normalizeReply,
} = require("../services/consumer/cases");
const { ensureConsumerCaseIndexes } = require("../services/consumer/indexes");
const router = express.Router();
const guard = [requireAdmin, requirePermission.adminOrOwner()];
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message:
      "Has realizado varias solicitudes. Espera unos minutos o usa los canales de contacto publicados.",
  },
});
const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (e) {
    res.status(e.statusCode || 500).json({
      error: e.code || "CONSUMER_ERROR",
      message: e.statusCode
        ? e.message
        : "No pudimos procesar la solicitud. Intenta de nuevo.",
    });
  }
};
router.get(
  "/information",
  handle(async (_req, res) => {
    const settings = await SiteSettings.findOne().lean();
    res.json({ ...policyDocument(settings || {}), types: TYPES });
  }),
);
router.post(
  "/cases",
  limiter,
  handle(async (req, res) => {
    await ensureConsumerCaseIndexes();
    const settings = await SiteSettings.findOne().lean();
    res
      .set("Cache-Control", "no-store")
      .status(201)
      .json(
        await submitCase(
          ConsumerCase,
          req.body,
          policyDocument(settings || {}),
        ),
      );
  }),
);
router.post(
  "/cases/track",
  limiter,
  handle(async (req, res) => {
    const reference =
      typeof req.body?.reference === "string"
        ? req.body.reference.trim().slice(0, 60)
        : "";
    const key =
      typeof req.body?.accessKey === "string" ? req.body.accessKey : "";
    const doc = /^[a-f0-9]{64}$/.test(key)
      ? await ConsumerCase.findOne({
          reference,
          accessHash: digest(key),
        }).lean()
      : null;
    if (!doc)
      throw error(
        "No encontramos una solicitud con ese radicado y clave.",
        "CONSUMER_CASE_NOT_FOUND",
        404,
      );
    res.set("Cache-Control", "no-store").json(publicCase(doc));
  }),
);
router.get(
  "/admin/settings",
  ...guard,
  handle(async (_req, res) => {
    const settings = await SiteSettings.findOne().lean();
    res.set("Cache-Control", "no-store").json({
      config: normalizeConfig(settings?.consumerProtection),
      document: policyDocument(settings || {}),
    });
  }),
);
router.put(
  "/admin/settings",
  ...guard,
  handle(async (req, res) => {
    const raw = req.body?.config;
    if (
      !raw ||
      typeof raw !== "object" ||
      Array.isArray(raw) ||
      !Number.isInteger(raw.revision) ||
      raw.revision < 0
    )
      throw error("Recarga la configuración antes de guardar.");
    const config = normalizeConfig(raw);
    if (
      raw.shippingCountries &&
      !/^[A-Za-z]{2}(?:\s*,\s*[A-Za-z]{2})*$/.test(
        String(raw.shippingCountries).trim(),
      )
    )
      throw error("Usa códigos de país de dos letras separados por coma.");
    if (
      config.deliveryDays !== null &&
      (!Number.isInteger(config.deliveryDays) ||
        config.deliveryDays < 1 ||
        config.deliveryDays > 30)
    )
      throw error(
        "El plazo debe ser de 1 a 30 días calendario, o déjalo vacío para el plazo legal supletorio.",
      );
    const settings = await SiteSettings.findOne().lean();
    if (!settings)
      throw error("Completa primero la configuración de la tienda.");
    const filter = {
      _id: settings._id,
      ...(raw.revision === 0
        ? {
            $or: [
              { "consumerProtection.revision": 0 },
              { "consumerProtection.revision": { $exists: false } },
            ],
          }
        : { "consumerProtection.revision": raw.revision }),
    };
    config.revision = raw.revision + 1;
    const result = await SiteSettings.updateOne(
      filter,
      { $set: { consumerProtection: config } },
      { runValidators: true },
    );
    if (result.matchedCount !== 1)
      throw error(
        "Otra sesión actualizó las condiciones. Recarga para revisar sus cambios.",
        "CONSUMER_CONFIG_CONFLICT",
        409,
      );
    res.json({
      config,
      document: policyDocument({ ...settings, consumerProtection: config }),
    });
  }),
);
router.get(
  "/admin/cases",
  ...guard,
  handle(async (req, res) => {
    const before = typeof req.query.before === "string" ? req.query.before : "";
    const filter =
      before && /^[a-f0-9]{24}$/i.test(before) ? { _id: { $lt: before } } : {};
    const cases = await ConsumerCase.find(filter)
      .sort({ _id: -1 })
      .limit(31)
      .lean();
    const page = cases.slice(0, 30);
    res.set("Cache-Control", "no-store").json({
      cases: page.map((c) => ({
        ...publicCase(c),
        id: String(c._id),
        name: c.name,
        contact: c.contact,
        orderNumber: c.orderNumber,
        message: c.message,
        preferredRefundMethod: c.preferredRefundMethod,
        revision: c.revision,
      })),
      next: cases.length > 30 ? String(page[29]._id) : "",
    });
  }),
);
router.post(
  "/admin/cases/:id/replies",
  ...guard,
  handle(async (req, res) => {
    if (!/^[a-f0-9]{24}$/i.test(req.params.id))
      throw error("Radicado no encontrado.", "CONSUMER_CASE_NOT_FOUND", 404);
    const reply = normalizeReply(req.body);
    const at = new Date();
    const result = await ConsumerCase.updateOne(
      { _id: req.params.id, revision: req.body.revision },
      {
        $set: { status: reply.status },
        $inc: { revision: 1 },
        $push: {
          history: { ...reply, at, admin: String(req.adminUserId || "") },
        },
      },
      { runValidators: true },
    );
    if (result.matchedCount !== 1)
      throw error(
        "La solicitud cambió. Actualiza el listado antes de responder.",
        "CONSUMER_CASE_CONFLICT",
        409,
      );
    res.json({ ok: true });
  }),
);
module.exports = router;
