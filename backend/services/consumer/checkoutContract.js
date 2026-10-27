"use strict";
const crypto = require("crypto");
const { normalizeConfig, policyDocument } = require("./policies");
const { findShippingZone } = require("../../lib/shipping/shippingRateRules");
const digest = (value) =>
  crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
function colombianDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
function buildConsumerOffer({
  settings = {},
  pricing = {},
  customer = {},
  now = new Date(),
} = {}) {
  const document = policyDocument(settings),
    config = normalizeConfig(settings.consumerProtection);
  const physical = (pricing.items || []).some(
    (i) => i.requiresShipping !== false,
  );
  const pickup = physical && customer.deliveryType === "retiro";
  const missing = [...document.readiness.missing];
  const rates = settings.theme?.global?.envios;
  if (physical && !pickup) {
    const zone =
      rates?.mode === "zones" ? findShippingZone(rates, customer) : null;
    const price =
      rates?.mode === "zones"
        ? (zone?.price ?? rates?.fallback?.price)
        : rates?.fixedPrice;
    if (
      !rates ||
      (rates.active !== false &&
        (price == null ||
          price === "" ||
          !Number.isFinite(Number(price)) ||
          Number(price) < 0))
    )
      missing.push("Tarifa de envío configurada para el destino");
    if (
      !config.shippingCountries
        .split(", ")
        .includes(String(customer.countryCode || "CO").toUpperCase())
    )
      missing.push(
        "El destino está fuera de los países habilitados para envío",
      );
  }
  if (pickup && !config.pickupEnabled)
    missing.push("El retiro no está habilitado");
  const communicatedOn = colombianDate(now);
  const due = new Date(`${communicatedOn}T12:00:00Z`);
  due.setUTCDate(due.getUTCDate() + document.deliveryDays);
  const deadlineDate = due.toISOString().slice(0, 10);
  const delivery = {
    type: !physical ? "electronic" : pickup ? "pickup" : "shipping",
    days: document.deliveryDays,
    unit: "calendar",
    starts: "day_after_order",
    communicatedOn,
    deadlineDate,
    text: `${!physical ? "Entrega o prestación" : pickup ? "Disponible para recoger" : "Entrega"} a más tardar el ${new Intl.DateTimeFormat("es-CO", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" }).format(due)} (${document.deliveryDays} días calendario desde el día siguiente al pedido).${pickup ? ` ${config.pickupInstructions}` : ""}`,
  };
  const snapshot = {
    paymentMethod: settings.theme?.global?.payments?.provider || "manual",
    version: document.version,
    seller: document.seller,
    policies: document.sections,
    delivery,
    currency:
      pricing.currency || settings.theme?.global?.payments?.currency || "COP",
    pricing: {
      subtotal: pricing.subtotal,
      shipping: pricing.shipping,
      taxAmount: pricing.tax?.amount ?? pricing.taxAmount ?? 0,
      totalDiscount: pricing.totalDiscount,
      total: pricing.total,
    },
    items: (pricing.items || []).map((i) => ({
      productId: String(i.productId || i.product || ""),
      variantId: i.variantId || i.variantKey || "",
      title: i.title,
      variantLabel: i.variantLabel || "",
      attributes: i.variantAttributes || [],
      description: i.consumerProductInfo?.description || "",
      features: i.consumerProductInfo?.features || [],
      quantity: i.quantity,
      price: i.price,
    })),
    destination: {
      type: customer.deliveryType || (physical ? "envio" : "digital"),
      country: customer.countryCode || customer.country || "",
      department: customer.departmentCode || customer.department || "",
      city: customer.cityCode || customer.municipalityId || customer.city || "",
    },
  };
  return {
    ...snapshot,
    fingerprint: digest(snapshot),
    ready: missing.length === 0,
    missing,
    message: missing.includes(
      "El destino está fuera de los países habilitados para envío",
    )
      ? "El destino seleccionado está fuera de nuestra cobertura de envíos. Elige otro destino o contáctanos."
      : missing.includes("El retiro no está habilitado")
        ? "El retiro no está disponible. Elige envío a domicilio para continuar."
        : "",
    pickupEnabled: config.pickupEnabled,
  };
}
function acceptConsumerOffer(offer, acceptance, now = new Date()) {
  function fail(message, code, statusCode = 409) {
    throw Object.assign(new Error(message), { code, statusCode });
  }
  if (!offer.ready)
    fail(
      "La tienda debe completar su información y las condiciones de entrega antes de recibir pedidos.",
      "CONSUMER_CONFIGURATION_REQUIRED",
      422,
    );
  if (acceptance?.terms !== true || acceptance?.privacy !== true)
    fail(
      "Debes aceptar las condiciones y autorizar el tratamiento informado de tus datos.",
      "CONSUMER_ACCEPTANCE_REQUIRED",
      422,
    );
  if (acceptance.fingerprint !== offer.fingerprint)
    fail(
      "El total, las condiciones o el plazo cambiaron. Revisa el resumen y confirma de nuevo.",
      "CONSUMER_OFFER_CHANGED",
    );
  return {
    ...offer,
    acceptedAt: now,
    termsAccepted: true,
    privacyAuthorized: true,
  };
}
module.exports = {
  digest,
  colombianDate,
  buildConsumerOffer,
  acceptConsumerOffer,
};
