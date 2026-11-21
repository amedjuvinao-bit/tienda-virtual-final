"use strict";

const {
  createNewsletterService,
} = require("../services/newsletter/verification");
const { normalizeEmail } = require("../services/newsletter/policy");

function createNewsletterHandlers({
  service = createNewsletterService(),
} = {}) {
  const handle = (action) => async (req, res) => {
    try {
      return res.json({ ok: true, ...(await action(req)) });
    } catch (error) {
      return res
        .status(error.statusCode || 503)
        .json({
          ok: false,
          error: error.code || "NEWSLETTER_UNAVAILABLE",
          message: error.statusCode
            ? error.message
            : "No pudimos tramitar la solicitud. Intenta de nuevo o utiliza Peticiones y reclamos.",
        });
    }
  };
  return {
    policy: handle(async () => ({ policy: await service.getPolicy() })),
    subscribe: handle((req) =>
      service.request({
        email: req.body?.email,
        consent: req.body?.consent,
        version: req.body?.version,
        intent: "subscribe",
        source: "web",
      }),
    ),
    requestWithdrawal: handle((req) =>
      service.request({ email: req.body?.email, intent: "withdraw" }),
    ),
    confirm: handle((req) =>
      service.confirm({
        email: req.body?.email,
        code: req.body?.code,
        intent: req.body?.intent,
      }),
    ),
  };
}
function createSubscribeHandler(options) {
  return createNewsletterHandlers(options).subscribe;
}
module.exports = {
  createNewsletterHandlers,
  createSubscribeHandler,
  normalizeEmail,
};
