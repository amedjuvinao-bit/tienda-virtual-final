"use strict";

const mongoose = require("mongoose");
const Subscriber = require("../../models/Subscriber");
const Customer = require("../../models/Customer");
const NewsletterConsentEvent = require("../../models/NewsletterConsentEvent");
const { normalizeEmail } = require("./policy");
const { ensureEmailIndex } = require("./indexes");

async function transaction(task) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await task(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

function customerConsent(proof) {
  return {
    status: proof.status,
    source: proof.source === "checkout" ? "web" : proof.source,
    proofReference: proof.proofReference,
    updatedAt: proof.recordedAt,
    updatedByAdmin: proof.recordedByAdmin || null,
  };
}

// Called inside the same transaction as the authoritative subscription change.
async function projectCustomers(
  email,
  proof,
  { session, CustomerModel = Customer, excludeId } = {},
) {
  const consent = customerConsent(proof);
  await CustomerModel.updateMany(
    {
      normalizedEmail: email,
      deletedAt: null,
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    },
    {
      $set: {
        ...Object.fromEntries(
          Object.entries(consent).map(([key, value]) => [
            `emailMarketingConsent.${key}`,
            value,
          ]),
        ),
      },
      $push: {
        "emailMarketingConsent.history": {
          $each: [
            {
              ...consent,
              recordedAt: proof.recordedAt,
              recordedByAdmin: proof.recordedByAdmin || null,
              note: "Comunicaciones comerciales por correo electrónico.",
            },
          ],
          $slice: -50,
        },
      },
    },
    { session, runValidators: true },
  );
}

async function reconcileCustomer(
  customerId,
  email,
  {
    SubscriberModel = Subscriber,
    CustomerModel = Customer,
    runTransaction = transaction,
    ensureIndex = () => ensureEmailIndex(SubscriberModel),
  } = {},
) {
  email = normalizeEmail(email);
  if (!email || !customerId) return;
  const existing = await SubscriberModel.findOne({ email })
    .select("status consent")
    .lean();
  if (
    !existing ||
    !["granted", "withdrawn"].includes(existing.status) ||
    !existing.consent?.proofReference
  )
    return;
  await ensureIndex();
  return runTransaction(async (session) => {
    const subscriber = await SubscriberModel.findOne({ email })
      .session(session)
      .lean();
    if (
      !subscriber ||
      !["granted", "withdrawn"].includes(subscriber.status) ||
      !subscriber.consent?.proofReference
    )
      return;
    const consent = customerConsent(subscriber.consent);
    // The read and projection share a snapshot. A simultaneous withdrawal
    // conflicts/retries instead of being overwritten by an older order.
    await CustomerModel.updateOne(
      {
        _id: customerId,
        normalizedEmail: email,
        deletedAt: null,
        $or: [
          { "emailMarketingConsent.updatedAt": null },
          {
            "emailMarketingConsent.updatedAt": {
              $lte: subscriber.consent.recordedAt,
            },
          },
        ],
      },
      {
        $set: {
          ...Object.fromEntries(
            Object.entries(consent).map(([key, value]) => [
              `emailMarketingConsent.${key}`,
              value,
            ]),
          ),
        },
      },
      { session, runValidators: true },
    );
  });
}

async function saveAdministrativeConsent(
  customer,
  { status, source, proofReference, note, adminId, emailMarketing = false },
  {
    SubscriberModel = Subscriber,
    CustomerModel = Customer,
    EventModel = NewsletterConsentEvent,
    runTransaction = transaction,
    ensureIndex = () => ensureEmailIndex(SubscriberModel),
  } = {},
) {
  await ensureIndex();
  return runTransaction(async (session) => {
    const current = await CustomerModel.findOne({
      _id: customer._id,
      deletedAt: null,
      ...(customer.updatedAt ? { updatedAt: customer.updatedAt } : {}),
    }).session(session);
    if (!current)
      throw Object.assign(
        new Error(
          "Los datos del cliente cambiaron. Recarga antes de registrar la decisión.",
        ),
        { statusCode: 409, code: "CUSTOMER_CONSENT_CHANGED" },
      );
    const now = new Date(),
      email = normalizeEmail(current.email);
    const history = [
      ...(current.marketingConsent?.history || []),
      {
        status,
        source,
        proofReference,
        note,
        recordedAt: now,
        recordedByAdmin: adminId,
      },
    ];
    current.marketingConsent = {
      status,
      source,
      proofReference,
      updatedAt: now,
      updatedByAdmin: adminId,
      history: history.slice(-50),
    };
    current.acceptsMarketing = status === "granted";
    current.updatedByAdmin = adminId;
    await current.save({ session });
    if (email && (status === "withdrawn" || emailMarketing === true)) {
      const proof = {
        status,
        source,
        channel: "email",
        method: "admin_reference",
        proofReference:
          proofReference || `customer:${current._id}:${now.toISOString()}`,
        recordedAt: now,
        recordedByAdmin: adminId,
        text:
          note ||
          "Decisión registrada por la administración con su referencia de prueba.",
      };
      const subscriber = await SubscriberModel.findOneAndUpdate(
        { email },
        {
          $setOnInsert: { email, origen: "customer", fecha: now },
          $set: { status, consent: proof },
          $unset: { verification: "" },
          $push: { consentHistory: { $each: [proof], $slice: -50 } },
        },
        { session, upsert: true, new: true, runValidators: true },
      );
      await EventModel.create([{ subscriber: subscriber._id, proof }], {
        session,
      });
      await projectCustomers(email, proof, { session, CustomerModel });
      current.emailMarketingConsent = {
        ...customerConsent(proof),
        history: [
          ...(current.emailMarketingConsent?.history || []),
          { ...customerConsent(proof), recordedAt: now },
        ].slice(-50),
      };
    }
    return current;
  });
}

async function subscriptionEvidence(email) {
  email = normalizeEmail(email);
  if (!email) return null;
  return Subscriber.findOne({ email })
    .select("status consent consentHistory")
    .lean();
}

async function canSendCommercialEmail(
  email,
  {
    SubscriberModel = Subscriber,
    ensureIndex = () => ensureEmailIndex(SubscriberModel),
  } = {},
) {
  email = normalizeEmail(email);
  if (!email) return false;
  await ensureIndex();
  const subscriber = await SubscriberModel.findOne({ email }).lean();
  const proof = subscriber?.consent;
  return Boolean(
    subscriber?.status === "granted" &&
      proof?.status === "granted" &&
      proof?.channel === "email" &&
      proof.proofReference &&
      ["email_code", "admin_reference"].includes(proof.method),
  );
}

module.exports = {
  transaction,
  projectCustomers,
  reconcileCustomer,
  saveAdministrativeConsent,
  subscriptionEvidence,
  canSendCommercialEmail,
};
