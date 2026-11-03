"use strict";

const crypto = require("node:crypto");
const Subscriber = require("../../models/Subscriber");
const Customer = require("../../models/Customer");
const NewsletterConsentEvent = require("../../models/NewsletterConsentEvent");
const SiteSettings = require("../../models/SiteSettings");
const { sendMail } = require("../../lib/mail/mailer");
const { getOrderReturnAccessSecret } = require("../orderReturnAccessService");
const { normalizeEmail, newsletterPolicy, requestProof } = require("./policy");
const { transaction, projectCustomers } = require("./consent");
const { ensureEmailIndex } = require("./indexes");

const REQUEST_MESSAGE =
  "Si podemos tramitar la solicitud, recibirás un código por correo. Revisa también spam. El código dura 10 minutos. No modifica tu suscripción hasta que lo confirmes.";
const fail = (message, code, statusCode = 400) =>
  Object.assign(new Error(message), { code, statusCode });
const invalidCode = () =>
  fail(
    "El código no es válido o venció. Solicita otro y vuelve a intentarlo.",
    "NEWSLETTER_CODE_INVALID",
  );
function codeHash(email, nonce, code, secret) {
  return crypto
    .createHmac("sha256", secret)
    .update(`newsletter-email|${email}|${nonce}|${code}`)
    .digest("hex");
}
function createNewsletterService({
  SubscriberModel = Subscriber,
  CustomerModel = Customer,
  EventModel = NewsletterConsentEvent,
  readSettings = () => SiteSettings.findOne().lean(),
  mailer = sendMail,
  runTransaction = transaction,
  secret = getOrderReturnAccessSecret,
  ensureIndex = () => ensureEmailIndex(SubscriberModel),
  clock = () => new Date(),
  randomCode = () => String(crypto.randomInt(0, 1000000)).padStart(6, "0"),
} = {}) {
  const getPolicy = async () => newsletterPolicy((await readSettings()) || {});

  async function request({
    email: input,
    consent,
    version,
    intent = "subscribe",
    source = "web",
    proof: suppliedProof,
  } = {}) {
    const email = normalizeEmail(input);
    if (!email || !["subscribe", "withdraw"].includes(intent))
      throw fail(
        "Escribe un correo electrónico válido.",
        "NEWSLETTER_INVALID_EMAIL",
      );
    let policy, proof;
    if (intent === "subscribe") {
      policy = await getPolicy();
      if (!policy.ready)
        throw fail(
          "La tienda debe completar su información de privacidad para ofrecer esta suscripción.",
          "NEWSLETTER_NOT_READY",
          422,
        );
      if (consent !== true || version !== policy.version)
        throw fail(
          "Revisa y autoriza la información actual antes de suscribirte.",
          "NEWSLETTER_POLICY_CHANGED",
          409,
        );
      proof =
        suppliedProof ||
        requestProof(
          policy,
          source === "checkout" ? "checkout" : "web",
          clock(),
        );
      // A stored order supplies evidence, never a new authorization under a changed policy.
      if (proof.version !== policy.version)
        throw fail(
          "La información de privacidad cambió. Solicita nuevamente la suscripción.",
          "NEWSLETTER_POLICY_CHANGED",
          409,
        );
    }
    await ensureIndex();
    const now = clock(),
      nonce = crypto.randomBytes(24).toString("hex"),
      code = randomCode();
    const verification = {
      nonce,
      hash: codeHash(email, nonce, code, secret()),
      attempts: 0,
      intent,
      proof,
      sentAt: now,
      expiresAt: new Date(now.getTime() + 10 * 60000),
    };
    const canInsert =
      intent === "subscribe" ||
      Boolean(
        await CustomerModel.exists({ normalizedEmail: email, deletedAt: null }),
      );
    let claimed;
    try {
      claimed = await SubscriberModel.findOneAndUpdate(
        {
          email,
          $or: [
            { "verification.sentAt": { $exists: false } },
            {
              "verification.sentAt": { $lte: new Date(now.getTime() - 120000) },
            },
            { "verification.intent": { $ne: intent } },
            ...(intent === "subscribe"
              ? [{ "verification.proof.version": { $ne: policy.version } }]
              : []),
          ],
        },
        {
          $set: { verification },
          ...(canInsert
            ? {
                $setOnInsert: {
                  email,
                  origen: source === "checkout" ? "checkout" : "web",
                  fecha: now,
                  status: "unknown",
                },
              }
            : {}),
        },
        { upsert: canInsert, new: true, runValidators: true },
      ).select("+verification");
    } catch (error) {
      if (error.code === 11000) return { message: REQUEST_MESSAGE };
      throw error;
    }
    if (!claimed) return { message: REQUEST_MESSAGE };
    try {
      await mailer({
        to: email,
        subject:
          intent === "subscribe"
            ? "Confirma tu suscripción"
            : "Confirma el retiro de comunicaciones",
        text: `Tu código es: ${code}\n\nVálido por 10 minutos y para una sola confirmación. ${intent === "subscribe" ? "Confirma si deseas recibir novedades y ofertas por correo. También puedes introducir este código en Datos personales → Comunicaciones comerciales → Confirmar suscripción pendiente." : "Confirma si deseas dejar de recibir comunicaciones comerciales por correo. Esto no afecta tus pedidos ni los mensajes necesarios para gestionarlos."}\n\n${intent === "subscribe" ? `${proof.text}\nResponsable: ${proof.seller.legalName}. ${proof.seller.email}. ${proof.seller.phone}.\n\n` : ""}Si no hiciste esta solicitud, ignora este correo. No compartas el código.`,
      });
    } catch {
      await SubscriberModel.updateOne(
        { _id: claimed._id, "verification.nonce": nonce },
        { $unset: { verification: "" } },
      );
      throw fail(
        "No pudimos enviar el código. Intenta de nuevo o utiliza Peticiones y reclamos.",
        "NEWSLETTER_MAIL_UNAVAILABLE",
        503,
      );
    }
    return { message: REQUEST_MESSAGE };
  }

  async function confirm({ email: input, code, intent } = {}) {
    const email = normalizeEmail(input);
    if (
      !email ||
      !/^\d{6}$/.test(String(code || "")) ||
      !["subscribe", "withdraw"].includes(intent)
    )
      throw invalidCode();
    await ensureIndex();
    const doc = await SubscriberModel.findOne({ email }).select(
      "+verification",
    );
    const v = doc?.verification,
      now = clock();
    if (
      !v?.hash ||
      v.intent !== intent ||
      v.attempts >= 5 ||
      new Date(v.expiresAt) <= now
    )
      throw invalidCode();
    const supplied = codeHash(email, v.nonce, String(code), secret());
    if (
      !/^[a-f0-9]{64}$/.test(v.hash) ||
      !crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(v.hash))
    ) {
      await SubscriberModel.updateOne(
        {
          _id: doc._id,
          "verification.nonce": v.nonce,
          "verification.attempts": { $lt: 5 },
        },
        { $inc: { "verification.attempts": 1 } },
      );
      throw invalidCode();
    }
    if (intent === "subscribe") {
      const policy = await getPolicy();
      if (!policy.ready || v.proof?.version !== policy.version)
        throw fail(
          "La información de privacidad cambió. Vuelve a solicitar tu suscripción.",
          "NEWSLETTER_POLICY_CHANGED",
          409,
        );
    }
    return runTransaction(async (session) => {
      const proof = {
        ...(intent === "subscribe" ? v.proof.toObject?.() || v.proof : {}),
        status: intent === "subscribe" ? "granted" : "withdrawn",
        channel: "email",
        source: intent === "subscribe" ? v.proof.source : "web",
        text:
          intent === "subscribe"
            ? v.proof.text
            : "Retiro de comunicaciones comerciales por correo electrónico, sin afectar los mensajes necesarios de pedidos.",
        method: "email_code",
        proofReference: `newsletter:${doc._id}:${v.nonce}`,
        recordedAt: now,
        confirmedAt: now,
      };
      const changed = await SubscriberModel.findOneAndUpdate(
        {
          _id: doc._id,
          "verification.nonce": v.nonce,
          "verification.hash": v.hash,
          "verification.intent": intent,
          "verification.expiresAt": { $gt: now },
          "verification.attempts": { $lt: 5 },
        },
        {
          $set: { status: proof.status, consent: proof },
          $unset: { verification: "" },
          $push: { consentHistory: { $each: [proof], $slice: -50 } },
        },
        { session, new: true, runValidators: true },
      );
      if (!changed) throw invalidCode();
      await EventModel.create([{ subscriber: changed._id, proof }], {
        session,
      });
      await projectCustomers(email, proof, { session, CustomerModel });
      return {
        status: proof.status,
        message:
          intent === "subscribe"
            ? "Suscripción confirmada. Puedes retirarla desde Datos personales cuando quieras."
            : "Retiraste las comunicaciones comerciales por correo. Tus pedidos y sus notificaciones continúan funcionando.",
      };
    });
  }
  return { getPolicy, request, confirm };
}

module.exports = { createNewsletterService, codeHash, REQUEST_MESSAGE };
