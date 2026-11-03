"use strict";
const express = require("express");
const rateLimit = require("express-rate-limit");
const crypto = require("node:crypto");
const {
  createNewsletterHandlers,
} = require("../controllers/newsletterController");
const { normalizeEmail } = require("../services/newsletter/policy");
function createNewsletterRouter(options) {
  const router = express.Router(),
    handlers = createNewsletterHandlers(options);
  const limited = {
    ok: false,
    error: "TOO_MANY_SUBSCRIPTIONS",
    message: "Espera unos minutos antes de volver a intentarlo.",
  };
  const ipLimit = rateLimit({
    windowMs: 15 * 60000,
    limit: 12,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: limited,
  });
  const contactLimit = rateLimit({
    windowMs: 15 * 60000,
    limit: 4,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator: (req) =>
      crypto
        .createHash("sha256")
        .update(normalizeEmail(req.body?.email) || "invalid")
        .digest("hex"),
    message: limited,
  });
  router.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  router.get("/policy", handlers.policy);
  router.post("/subscribe", ipLimit, contactLimit, handlers.subscribe);
  router.post(
    "/request-withdrawal",
    ipLimit,
    contactLimit,
    handlers.requestWithdrawal,
  );
  router.post(
    "/confirm",
    rateLimit({
      windowMs: 15 * 60000,
      limit: 20,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      message: limited,
    }),
    handlers.confirm,
  );
  return router;
}
module.exports = createNewsletterRouter();
module.exports.createNewsletterRouter = createNewsletterRouter;
