"use strict";

const crypto = require("node:crypto");
const { sellerSource } = require("../consumer/sources");
const { normalizePrivacyConfig } = require("../consumer/policies");
const { privacyDocument } = require("../consumer/privacyDocument");
const normalizeEmail = (value) =>
  typeof value === "string" &&
  value.trim().length <= 254 &&
  /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value.trim())
    ? value.trim().toLowerCase()
    : "";
const digest = (value) =>
  crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");

function newsletterPolicy(settings = {}) {
  const seller = sellerSource(settings),
    privacy = normalizePrivacyConfig(settings.consumerProtection);
  const privacyText = privacyDocument(privacy).body;
  const text = `Autorizo a ${seller.legalName || "la tienda"} a utilizar mi correo electrónico para enviarme novedades y ofertas de su negocio. Esta autorización es opcional y puedo retirarla desde Datos personales, sin afectar mis compras.`;
  const policy = {
    text,
    seller,
    privacyText,
    privacyVersion: digest({ ...privacy, body: privacyText }),
    channel: "email",
  };
  return {
    ...policy,
    version: digest({ revision: "newsletter-email-1", ...policy }),
    ready: Boolean(
      seller.legalName &&
        seller.nit &&
        seller.notificationAddress &&
        normalizeEmail(seller.email) &&
        seller.phone &&
        privacy.privacyEffectiveDate &&
        privacy.retention &&
        privacy.processors,
    ),
    policyUrl: "/privacidad",
  };
}

function requestProof(policy, source, now = new Date()) {
  return {
    version: policy.version,
    text: policy.text,
    privacyVersion: policy.privacyVersion,
    privacyText: policy.privacyText,
    seller: policy.seller,
    channel: "email",
    source,
    requestedAt: now,
    method: "email_code",
  };
}

module.exports = { normalizeEmail, newsletterPolicy, requestProof, digest };
