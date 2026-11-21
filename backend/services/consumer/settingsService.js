"use strict";
const { normalizePrivacyConfig, policyDocument } = require("./policies");
const {
  DELIVERY_KEYS,
  PRIVACY_KEYS,
  deliverySettings,
  sourceSummary,
} = require("./sources");
const { error } = require("./cases");
const { getOrderReturnPolicy } = require("../orderReturnPolicyService");
async function withReturnPolicy(
  settings = {},
  { session = null, returnPolicy } = {},
) {
  return {
    ...settings,
    consumerReturnPolicy:
      returnPolicy ?? (await getOrderReturnPolicy({ session })),
  };
}
function sectionResponse(settings, section) {
  return {
    config:
      section === "delivery"
        ? deliverySettings(settings)
        : normalizePrivacyConfig(settings.consumerProtection),
    document: policyDocument(settings),
    sources: sourceSummary(settings),
  };
}
async function saveSection(Model, raw, section, actor = "") {
  if (
    !raw ||
    typeof raw !== "object" ||
    Array.isArray(raw) ||
    !Number.isSafeInteger(raw.revision) ||
    raw.revision < 0
  )
    throw error("Recarga la configuración antes de guardar.");
  const allowed = new Set([
    "revision",
    ...(section === "delivery" ? DELIVERY_KEYS : PRIVACY_KEYS),
  ]);
  if (Object.keys(raw).some((k) => !allowed.has(k)))
    throw error(
      "Este formulario solo guarda su propia configuración. Los demás datos se administran en Tienda, Facturación, Envíos y Órdenes.",
    );
  const current = await Model.findOne().lean();
  if (!current) throw error("Completa primero los datos de la tienda.");
  const field =
    section === "delivery" ? "shippingDelivery" : "consumerProtection";
  const stored = current[field];
  const expected =
    section === "delivery"
      ? deliverySettings(current).revision
      : normalizePrivacyConfig(stored).revision;
  if (raw.revision !== expected)
    throw error(
      "Otra sesión actualizó estos datos. Recarga antes de guardar.",
      "CONSUMER_CONFIG_CONFLICT",
      409,
    );
  const config =
    section === "delivery"
      ? deliverySettings({ shippingDelivery: raw })
      : normalizePrivacyConfig(raw);
  if (section === "delivery") {
    if (
      raw.shippingCountries &&
      !/^[A-Za-z]{2}(?:\s*,\s*[A-Za-z]{2})*$/.test(
        String(raw.shippingCountries).trim(),
      )
    )
      throw error("Selecciona los países donde realiza envíos la tienda.");
    if (
      config.deliveryDays !== null &&
      (!Number.isInteger(config.deliveryDays) ||
        config.deliveryDays < 1 ||
        config.deliveryDays > 30)
    )
      throw error(
        "El plazo máximo debe estar entre 1 y 30 días calendario, o quedar vacío para el plazo legal supletorio.",
      );
    if (config.pickupEnabled && !config.pickupInstructions)
      throw error("Indica dónde y cómo se recogerá el pedido.");
  }
  config.revision = expected + 1;
  const baseFilter =
    !stored || stored.revision == null
      ? {
          $or: [
            { [`${field}.revision`]: { $exists: false } },
            { [`${field}.revision`]: null },
            { [`${field}.revision`]: 0 },
          ],
        }
      : { [`${field}.revision`]: stored.revision };
  // Preserve previous values as a compatibility fallback; there is no second editor for them.
  const persisted = {
    ...(stored || {}),
    ...config,
    updatedBy: String(actor || ""),
    updatedAt: new Date(),
  };
  const result = await Model.updateOne(
    { _id: current._id, ...baseFilter },
    { $set: { [field]: persisted } },
    { runValidators: true },
  );
  if (result.matchedCount !== 1)
    throw error(
      "Otra sesión actualizó estos datos. Recarga antes de guardar.",
      "CONSUMER_CONFIG_CONFLICT",
      409,
    );
  return { ...current, [field]: persisted };
}
module.exports = { withReturnPolicy, sectionResponse, saveSection };
