"use strict";

const {
  normalizeEmail,
  newsletterPolicy,
  requestProof,
} = require("./newsletter/policy");
const { createNewsletterService } = require("./newsletter/verification");
const { reconcileCustomer } = require("./newsletter/consent");

function normalizeNewsletterIntent(
  customer = {},
  sessionId = "",
  { settings = {} } = {},
) {
  const email =
    normalizeEmail(customer.emailOrPhone) || normalizeEmail(customer.email);
  if (!email) return null;
  const policy = newsletterPolicy(settings);
  const requested = customer.wantsNewsletter === true;
  return {
    email,
    sessionId: String(sessionId || "").slice(0, 200),
    requested,
    proof:
      requested &&
      policy.ready &&
      customer.newsletterConsentVersion === policy.version
        ? requestProof(policy, "checkout")
        : null,
  };
}

async function persistNewsletterSubscription(
  intent,
  {
    service = createNewsletterService(),
    reconcile = reconcileCustomer,
    logger = console,
  } = {},
) {
  if (!intent?.email)
    return { attempted: false, persisted: false, reason: "not_requested" };
  try {
    await reconcile(intent.customerId, intent.email);
    if (!intent.requested)
      return { attempted: false, persisted: false, reason: "not_requested" };
    if (!intent.proof)
      return { attempted: false, persisted: false, reason: "policy_changed" };
    await service.request({
      email: intent.email,
      consent: true,
      version: intent.proof.version,
      intent: "subscribe",
      source: "checkout",
      proof: intent.proof,
    });
    return { attempted: true, persisted: false, pendingVerification: true };
  } catch (error) {
    // An optional email must never turn an already committed purchase into a failure.
    logger.warn("No se pudo tramitar la confirmación comercial del pedido.", {
      code: error?.code || "NEWSLETTER_UNAVAILABLE",
    });
    return {
      attempted: true,
      persisted: false,
      retryable: true,
      reason: "unavailable",
    };
  }
}
module.exports = { normalizeNewsletterIntent, persistNewsletterSubscription };
