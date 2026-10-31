"use strict";
const express = require("express");
const rateLimit = require("express-rate-limit");
const SiteSettings = require("../models/SiteSettings");
const ConsumerCase = require("../models/ConsumerCase");
const Order = require("../models/Order");
const { sendMail } = require("../lib/mail/mailer");
const {
  requestRecovery,
  confirmRecovery,
  sendCaseReceipt,
  assistedRecovery,
} = require("../services/consumer/recovery");
const {
  authorizedCaseOrder,
  casesForOrder,
  linkCaseToOrder,
} = require("../services/consumer/orderConnection");
const requireAdmin = require("../middleware/requireAdmin");
const requirePermission = require("../middleware/requirePermission");
const { policyDocument } = require("../services/consumer/policies");
const { digest } = require("../services/consumer/checkoutContract");
const {
  TYPES,
  error,
  publicCase,
  submitCase,
  normalizeReply,
} = require("../services/consumer/cases");
const { ensureConsumerCaseIndexes } = require("../services/consumer/indexes");
const {
  withReturnPolicy,
  sectionResponse,
  saveSection,
} = require("../services/consumer/settingsService");
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
const recoveryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Espera unos minutos antes de volver a recuperar el acceso.",
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
    res.json({
      ...policyDocument(await withReturnPolicy(settings || {})),
      types: TYPES,
    });
  }),
);
router.post(
  "/cases",
  limiter,
  handle(async (req, res) => {
    await ensureConsumerCaseIndexes();
    const settings = await SiteSettings.findOne().lean();
    const order = await authorizedCaseOrder(req, Order);
    const receipt = await submitCase(
      ConsumerCase,
      req.body,
      policyDocument(await withReturnPolicy(settings || {})),
      new Date(),
      { order },
    );
    const doc = await ConsumerCase.findOneAndUpdate(
      { reference: receipt.reference, "receiptEmail.at": { $exists: false } },
      { $set: { receiptEmail: { at: new Date(), status: "sending" } } },
      { new: true },
    )
      .select("+recoveryEmail")
      .lean();
    let emailStatus = "already_requested";
    if (doc) {
      emailStatus = await sendCaseReceipt(doc, req.body.accessKey, sendMail);
      await ConsumerCase.updateOne(
        { _id: doc._id },
        { $set: { "receiptEmail.status": emailStatus } },
      );
    }
    res
      .set("Cache-Control", "no-store")
      .status(201)
      .json({ ...receipt, emailStatus });
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
          $or: [
            { trackingHash: digest(key) },
            { accessHash: digest(key), trackingHash: { $exists: false } },
          ],
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
router.post(
  "/cases/recovery/request",
  recoveryLimiter,
  handle(async (req, res) => {
    res
      .set("Cache-Control", "no-store")
      .json(await requestRecovery(ConsumerCase, req.body, sendMail));
  }),
);
router.post(
  "/cases/recovery/confirm",
  recoveryLimiter,
  handle(async (req, res) => {
    res
      .set("Cache-Control", "no-store")
      .json(await confirmRecovery(ConsumerCase, req.body));
  }),
);
for (const [path, section, permission] of [
  ["/admin/settings", "privacy", "settings:store"],
  ["/admin/delivery-settings", "delivery", "settings:shipping"],
]) {
  const sectionGuard = [requireAdmin, requirePermission(permission)];
  router.get(
    path,
    ...sectionGuard,
    handle(async (_req, res) => {
      const settings = await SiteSettings.findOne().lean();
      res
        .set("Cache-Control", "no-store")
        .json(sectionResponse(await withReturnPolicy(settings || {}), section));
    }),
  );
  router.put(
    path,
    ...sectionGuard,
    handle(async (req, res) => {
      const settings = await saveSection(
        SiteSettings,
        req.body?.config,
        section,
        req.adminUserId || req.adminUsername,
      );
      res
        .set("Cache-Control", "no-store")
        .json(sectionResponse(await withReturnPolicy(settings), section));
    }),
  );
}
router.get(
  "/admin/cases",
  ...guard,
  handle(async (req, res) => {
    const before = typeof req.query.before === "string" ? req.query.before : "";
    let filter =
      before && /^[a-f0-9]{24}$/i.test(before) ? { _id: { $lt: before } } : {};
    if (req.query.orderId) {
      if (
        typeof req.query.orderId !== "string" ||
        !/^[a-f0-9]{24}$/i.test(req.query.orderId)
      )
        throw error("Compra no encontrada.", "CONSUMER_ORDER_NOT_FOUND", 404);
      const order = await Order.findById(req.query.orderId)
        .select("orderNumber")
        .lean();
      if (!order)
        throw error("Compra no encontrada.", "CONSUMER_ORDER_NOT_FOUND", 404);
      filter = { $and: [filter, casesForOrder(order)] };
    }
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
        linkedOrderId: c.order ? String(c.order) : "",
        message: c.message,
        preferredRefundMethod: c.preferredRefundMethod,
        revision: c.revision,
      })),
      next: cases.length > 30 ? String(page[29]._id) : "",
    });
  }),
);
router.post(
  "/admin/cases/:id/order",
  ...guard,
  handle(async (req, res) => {
    if (
      !/^[a-f0-9]{24}$/i.test(req.params.id) ||
      req.body?.identityVerified !== true
    )
      throw error(
        "Verifica la identidad y la relación con la compra antes de vincularla.",
      );
    const number =
      typeof req.body.orderNumber === "string"
        ? req.body.orderNumber.trim().slice(0, 80)
        : "";
    const order = number
      ? await Order.findOne({ orderNumber: number })
          .select("orderNumber")
          .lean()
      : null;
    if (!order)
      throw error(
        "No encontramos ese número de pedido.",
        "CONSUMER_ORDER_NOT_FOUND",
        404,
      );
    const doc = await ConsumerCase.findById(req.params.id).lean();
    await linkCaseToOrder(
      ConsumerCase,
      doc,
      order,
      String(req.adminUserId || req.adminUsername || ""),
      req.body.revision,
    );
    res.json({ ok: true });
  }),
);
router.post(
  "/admin/cases/:id/recovery",
  ...guard,
  handle(async (req, res) => {
    if (!/^[a-f0-9]{24}$/i.test(req.params.id))
      throw error("Radicado no encontrado.", "CONSUMER_CASE_NOT_FOUND", 404);
    const doc = await ConsumerCase.findById(req.params.id)
      .select("+trackingHash")
      .lean();
    res
      .set("Cache-Control", "no-store")
      .json(
        await assistedRecovery(
          ConsumerCase,
          doc,
          req.body,
          String(req.adminUserId || req.adminUsername || ""),
        ),
      );
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
