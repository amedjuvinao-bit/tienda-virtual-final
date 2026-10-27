"use strict";
const crypto = require("crypto");
const { clean } = require("./policies");
const { digest, colombianDate } = require("./checkoutContract");
const TYPES = Object.freeze({
  petition: "Petición",
  complaint: "Queja o reclamo",
  delivery: "Incumplimiento de entrega",
  withdrawal: "Retracto",
  warranty: "Garantía legal",
  reversal: "Reversión del pago",
  privacy_query: "Consulta de datos personales",
  privacy_claim: "Reclamo de datos personales",
});
function error(message, code = "CONSUMER_CASE_INVALID", statusCode = 400) {
  return Object.assign(new Error(message), { code, statusCode });
}
function normalizeCase(body = {}) {
  const data = {
    name: clean(body.name, 180),
    contact: clean(body.contact, 180),
    type: clean(body.type, 30),
    orderNumber: clean(body.orderNumber, 80),
    subject: clean(body.subject, 180),
    message: clean(body.message, 6000),
    preferredRefundMethod: clean(body.preferredRefundMethod, 300),
  };
  if (
    !data.name ||
    !data.subject ||
    data.message.length < 10 ||
    !Object.prototype.hasOwnProperty.call(TYPES, data.type)
  )
    throw error(
      "Completa nombre, asunto, tipo y una descripción de al menos 10 caracteres.",
    );
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.contact) &&
    !(
      /^\+?[\d\s().-]{7,30}$/.test(data.contact) &&
      data.contact.replace(/\D/g, "").length >= 7
    )
  )
    throw error("Indica un correo o teléfono válido para atenderte.");
  if (body.privacyAuthorized !== true)
    throw error(
      "Autoriza el tratamiento informado para gestionar esta solicitud.",
    );
  if (!/^[a-f0-9]{64}$/.test(body.accessKey || ""))
    throw error(
      "No pudimos generar el acceso seguro. Recarga e intenta de nuevo.",
    );
  return {
    data,
    accessHash: digest(body.accessKey),
    requestHash: digest(data),
  };
}
function publicCase(doc) {
  return {
    reference: doc.reference,
    createdAt: doc.createdAt,
    status: doc.status,
    type: doc.type,
    subject: doc.subject,
    message: doc.message,
    orderNumber: doc.orderNumber,
    preferredRefundMethod: doc.preferredRefundMethod,
    policyVersion: doc.authorization?.version,
    history: (doc.history || []).map((h) => ({
      at: h.at,
      status: h.status,
      message: h.message,
    })),
  };
}
async function submitCase(Model, body, document, now = new Date()) {
  const { data, accessHash, requestHash } = normalizeCase(body);
  const existing = await Model.findOne({ accessHash }).select("+requestHash");
  if (existing) {
    if (existing.requestHash !== requestHash)
      throw error(
        "Esta clave ya pertenece a una solicitud distinta. Conserva la constancia o inicia otra solicitud.",
        "CONSUMER_CASE_REPLAY_CONFLICT",
        409,
      );
    return publicCase(existing);
  }
  if (body.privacyVersion !== document.version)
    throw error(
      "La política de datos cambió. Recarga la página, revísala y presenta la solicitud de nuevo.",
      "CONSUMER_POLICY_CHANGED",
      409,
    );
  const reference = `PQR-${colombianDate(now).replace(/-/g, "")}-${crypto.randomBytes(12).toString("hex").toUpperCase()}`;
  try {
    const doc = await Model.create({
      ...data,
      accessHash,
      requestHash,
      reference,
      createdAt: now,
      authorization: {
        at: now,
        version: document.version,
        seller: document.seller,
        policy: document.sections.find((s) => s.id === "privacidad"),
        authorized: true,
      },
      history: [
        {
          at: now,
          status: "received",
          message:
            "Solicitud recibida. Conserva el radicado y la clave privada para consultar la respuesta.",
        },
      ],
    });
    return publicCase(doc);
  } catch (err) {
    if (err.code === 11000) {
      const repeated = await Model.findOne({ accessHash }).select(
        "+requestHash",
      );
      if (repeated?.requestHash === requestHash) return publicCase(repeated);
    }
    throw err;
  }
}
function normalizeReply(body = {}) {
  const status = clean(body.status, 30),
    message = clean(body.message, 4000);
  if (
    !["in_review", "answered", "closed"].includes(status) ||
    message.length < 10 ||
    !Number.isInteger(body.revision) ||
    body.revision < 0
  )
    throw error(
      "Indica estado, revisión y una respuesta pública de al menos 10 caracteres.",
    );
  return { status, message };
}
module.exports = {
  TYPES,
  error,
  normalizeCase,
  publicCase,
  submitCase,
  normalizeReply,
};
