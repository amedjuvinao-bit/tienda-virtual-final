"use strict";

const Subscriber = require("../../models/Subscriber");
const NewsletterConsentEvent = require("../../models/NewsletterConsentEvent");

const grantedFilter = {
  status: "granted",
  "consent.status": "granted",
  "consent.channel": "email",
  "consent.proofReference": { $type: "string", $gt: "" },
  "consent.method": { $in: ["email_code", "admin_reference"] },
};
const proofFields = [
  "status", "channel", "source", "method", "proofReference", "version",
  "privacyVersion", "text", "privacyText", "requestedAt", "confirmedAt", "recordedAt",
];

function routeError(message, code, statusCode = 400) {
  return Object.assign(new Error(message), { code, statusCode });
}

function positiveInt(value, fallback, max) {
  if (value === undefined || value === "") return fallback;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > max) {
    throw routeError("La página solicitada no es válida.", "SUBSCRIPTIONS_INVALID_PAGE");
  }
  return number;
}

function authorizationStatus(subscriber = {}) {
  const proof = subscriber.consent;
  if (subscriber.status === "withdrawn") return "withdrawn";
  if (subscriber.status === "granted" && proof?.status === "granted"
    && proof.channel === "email" && proof.proofReference
    && ["email_code", "admin_reference"].includes(proof.method)) return "granted";
  return "unknown";
}

function serializeProof(proof) {
  if (!proof) return null;
  const result = {};
  for (const field of proofFields) {
    if (proof[field] !== undefined) result[field] = proof[field];
  }
  if (proof.seller) {
    result.seller = {};
    for (const field of ["legalName", "nit", "address", "email", "phone"]) {
      if (proof.seller[field] !== undefined) result.seller[field] = proof.seller[field];
    }
  }
  return result;
}

function serializeSubscriber(subscriber) {
  return {
    id: String(subscriber._id),
    email: subscriber.email,
    status: authorizationStatus(subscriber),
    decisionAt: subscriber.consent?.recordedAt || subscriber.consent?.confirmedAt || null,
    method: subscriber.consent?.method || "",
    updatedAt: subscriber.updatedAt || null,
  };
}

function createAdminSubscriptionReader({
  SubscriberModel = Subscriber,
  EventModel = NewsletterConsentEvent,
} = {}) {
  return {
    async list(query = {}) {
      const page = positiveInt(query.page, 1, 100000);
      const limit = positiveInt(query.limit, 20, 100);
      if (query.q !== undefined && typeof query.q !== "string") {
        throw routeError("Escribe un correo para buscar.", "SUBSCRIPTIONS_INVALID_SEARCH");
      }
      const q = (query.q || "").trim().toLowerCase();
      if (q.length > 254) {
        throw routeError("El correo de búsqueda es demasiado largo.", "SUBSCRIPTIONS_INVALID_SEARCH");
      }
      const status = query.status || "all";
      if (!["all", "granted", "withdrawn", "unknown"].includes(status)) {
        throw routeError("El estado seleccionado no es válido.", "SUBSCRIPTIONS_INVALID_STATUS");
      }
      const clauses = [{ email: { $type: "string", $gt: "" } }];
      if (q) clauses.push({ email: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } });
      if (status === "granted") clauses.push(grantedFilter);
      if (status === "withdrawn") clauses.push({ status: "withdrawn" });
      if (status === "unknown") clauses.push({ $nor: [grantedFilter, { status: "withdrawn" }] });
      const filter = { $and: clauses };
      const [rows, total] = await Promise.all([
        SubscriberModel.find(filter)
          .select("email status updatedAt consent.status consent.channel consent.method consent.proofReference consent.recordedAt consent.confirmedAt")
          .sort({ updatedAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
        SubscriberModel.countDocuments(filter),
      ]);
      return { ok: true, subscribers: rows.map(serializeSubscriber), total, page, limit,
        pages: Math.max(1, Math.ceil(total / limit)) };
    },

    async detail(id, query = {}) {
      if (!/^[a-f\d]{24}$/i.test(String(id || ""))) {
        throw routeError("La suscripción no es válida.", "SUBSCRIPTION_INVALID_ID");
      }
      const page = positiveInt(query.page, 1, 100000);
      const limit = 20;
      const subscriber = await SubscriberModel.findOne({
        _id: id, email: { $type: "string", $gt: "" },
      }).select("email status updatedAt consent").lean();
      if (!subscriber) throw routeError("Suscripción no encontrada.", "SUBSCRIPTION_NOT_FOUND", 404);
      const filter = { subscriber: subscriber._id };
      const [events, total] = await Promise.all([
        EventModel.find(filter).select("proof createdAt").sort({ createdAt: -1, _id: -1 })
          .skip((page - 1) * limit).limit(limit).lean(),
        EventModel.countDocuments(filter),
      ]);
      return {
        ok: true,
        subscriber: { ...serializeSubscriber(subscriber), consent: serializeProof(subscriber.consent) },
        events: events.map(event => ({
          id: String(event._id), createdAt: event.createdAt, proof: serializeProof(event.proof),
        })),
        total, page, limit, pages: Math.max(1, Math.ceil(total / limit)),
      };
    },
  };
}

module.exports = { createAdminSubscriptionReader };
