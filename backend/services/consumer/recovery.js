"use strict";
const crypto = require("crypto");
const { digest } = require("./checkoutContract");
const { error, publicCase } = require("./cases");
const { getOrderReturnAccessSecret } = require("../orderReturnAccessService");

const RECOVERY_MESSAGE =
  "Si el radicado y el correo coinciden, recibirás un código válido por 10 minutos. Revisa también spam. Si no llega, usa los canales de contacto de la tienda.";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function emailFor(doc) {
  const email = String(
    doc?.recoveryEmail || (EMAIL.test(doc?.contact || "") ? doc.contact : ""),
  )
    .trim()
    .toLowerCase();
  return EMAIL.test(email) ? email : "";
}
function credentials(body = {}) {
  return {
    reference:
      typeof body.reference === "string"
        ? body.reference.trim().slice(0, 60)
        : "",
    email:
      typeof body.email === "string"
        ? body.email.trim().toLowerCase().slice(0, 180)
        : "",
  };
}
function codeHash(reference, nonce, code) {
  return crypto
    .createHmac("sha256", getOrderReturnAccessSecret())
    .update(`${reference}|${nonce}|${code}`)
    .digest("hex");
}
async function requestRecovery(Model, body, mailer, now = new Date()) {
  const { reference, email } = credentials(body);
  if (!reference || !EMAIL.test(email)) return { message: RECOVERY_MESSAGE };
  const doc = await Model.findOne({ reference })
    .select("+recoveryEmail")
    .lean();
  if (!doc || emailFor(doc) !== email) return { message: RECOVERY_MESSAGE };
  const nonce = crypto.randomBytes(24).toString("hex");
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
  const recovery = {
    nonce,
    hash: codeHash(reference, nonce, code),
    sentAt: now,
    expiresAt: new Date(now.getTime() + 10 * 60 * 1000),
    attempts: 0,
  };
  const claimed = await Model.updateOne(
    {
      _id: doc._id,
      $or: [
        { "recovery.sentAt": { $exists: false } },
        { "recovery.sentAt": { $lte: new Date(now.getTime() - 120000) } },
      ],
    },
    { $set: { recovery } },
  );
  if (claimed.modifiedCount !== 1) return { message: RECOVERY_MESSAGE };
  try {
    await mailer({
      to: emailFor(doc),
      subject: "Código para consultar tu solicitud",
      text: `Radicado: ${reference}\n\nCódigo de recuperación: ${code}\n\nCaduca en 10 minutos y permite crear una nueva clave de seguimiento. La clave anterior dejará de funcionar. Si no lo solicitaste, ignora este mensaje. No compartas este código.`,
    });
  } catch {
    // Retain the cooldown after a transport failure to prevent mail flooding.
    await Model.updateOne(
      { _id: doc._id, "recovery.nonce": nonce },
      { $unset: { "recovery.hash": "" } },
    );
  }
  return { message: RECOVERY_MESSAGE };
}
async function confirmRecovery(Model, body, now = new Date()) {
  const { reference, email } = credentials(body);
  const fail = () =>
    error(
      "No pudimos verificar el código. Revisa los datos o solicita uno nuevo.",
      "CONSUMER_RECOVERY_INVALID",
      400,
    );
  if (
    !EMAIL.test(email) ||
    !/^\d{6}$/.test(body.code || "") ||
    !/^[a-f0-9]{64}$/.test(body.accessKey || "")
  )
    throw fail();
  const doc = await Model.findOne({ reference })
    .select("+recoveryEmail +recovery +trackingHash")
    .lean();
  if (!doc || emailFor(doc) !== email) throw fail();
  const nextHash = digest(body.accessKey);
  // The caller already holds the current key: permit a lost-response retry.
  if (doc.trackingHash === nextHash) return publicCase(doc);
  const r = doc.recovery;
  if (
    !/^[a-f0-9]{64}$/.test(r?.hash || "") ||
    !Number.isFinite(new Date(r.expiresAt).getTime()) ||
    new Date(r.expiresAt) <= now ||
    r.attempts >= 5
  )
    throw fail();
  const supplied = codeHash(reference, r.nonce, body.code);
  if (!crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(r.hash))) {
    await Model.updateOne(
      {
        _id: doc._id,
        "recovery.nonce": r.nonce,
        "recovery.attempts": { $lt: 5 },
      },
      { $inc: { "recovery.attempts": 1 } },
    );
    throw fail();
  }
  const recovered = await Model.findOneAndUpdate(
    {
      _id: doc._id,
      "recovery.nonce": r.nonce,
      "recovery.hash": r.hash,
      "recovery.expiresAt": { $gt: now },
      "recovery.attempts": { $lt: 5 },
    },
    { $set: { trackingHash: nextHash }, $unset: { "recovery.hash": "" } },
    { new: true },
  ).lean();
  if (!recovered) throw fail();
  return publicCase(recovered);
}
async function sendCaseReceipt(doc, accessKey, mailer) {
  const to = emailFor(doc);
  if (!to) return "not_available";
  try {
    await mailer({
      to,
      subject: "Constancia de tu solicitud",
      text: `Tu solicitud fue recibida.\n\nRadicado: ${doc.reference}\nFecha y hora (Colombia): ${new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeStyle: "short", timeZone: "America/Bogota" }).format(new Date(doc.createdAt))}\nAsunto: ${doc.subject}\nPedido: ${doc.orderNumber || "No informado"}\n\n${doc.message || ""}\n\nClave privada de seguimiento: ${accessKey}\n\nEn la tienda, abre Peticiones y reclamos y selecciona Consultar radicado. Guarda esta constancia y no compartas la clave. También puedes recuperar el acceso desde esa página con este correo.`,
    });
    return "sent";
  } catch {
    return "failed";
  }
}
async function assistedRecovery(Model, doc, body, actor) {
  if (
    !doc ||
    body.identityVerified !== true ||
    typeof body.reason !== "string" ||
    body.reason.trim().length < 10 ||
    body.reason.length > 1000 ||
    !/^[a-f0-9]{64}$/.test(body.accessKey || "") ||
    !Number.isInteger(body.revision)
  )
    throw error(
      "Verifica la identidad y describe cómo la comprobaste antes de recuperar el acceso.",
    );
  const trackingHash = digest(body.accessKey);
  if (doc.trackingHash === trackingHash)
    return { ...publicCase(doc), revision: doc.revision };
  const result = await Model.findOneAndUpdate(
    { _id: doc._id, revision: body.revision },
    {
      $set: {
        trackingHash,
        accessRecovery: {
          at: new Date(),
          admin: actor,
          method: "verified_contact",
          reason: body.reason.trim(),
        },
      },
      $unset: { "recovery.hash": "" },
      $inc: { revision: 1 },
    },
    { new: true },
  ).lean();
  if (!result)
    throw error(
      "La solicitud cambió. Actualiza antes de recuperar el acceso.",
      "CONSUMER_CASE_CONFLICT",
      409,
    );
  return { ...publicCase(result), revision: result.revision };
}
module.exports = {
  requestRecovery,
  confirmRecovery,
  sendCaseReceipt,
  emailFor,
  RECOVERY_MESSAGE,
  assistedRecovery,
};
