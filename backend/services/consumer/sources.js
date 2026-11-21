"use strict";
const { clean } = require("./policiesText");
const DELIVERY_KEYS = [
  "shippingCountries",
  "deliveryDays",
  "pickupEnabled",
  "pickupInstructions",
];
const PRIVACY_KEYS = ["privacyEffectiveDate", "retention", "processors"];
function deliverySettings(settings = {}) {
  // Read the previous release only until delivery settings are saved in Envíos.
  const raw = settings.shippingDelivery || settings.consumerProtection || {};
  const configuredCountries = (settings.theme?.global?.envios?.zones || [])
    .map((z) => clean(z.countryCode, 2))
    .filter(Boolean)
    .join(",");
  return {
    revision:
      Number.isSafeInteger(raw.revision) && raw.revision >= 0
        ? raw.revision
        : 0,
    shippingCountries:
      [
        ...new Set(
          (clean(raw.shippingCountries, 500) || configuredCountries || "CO")
            .toUpperCase()
            .split(",")
            .map((s) => s.trim())
            .filter((s) => /^[A-Z]{2}$/.test(s)),
        ),
      ].join(", ") || "CO",
    deliveryDays: raw.deliveryDays == null ? null : Number(raw.deliveryDays),
    pickupEnabled: raw.pickupEnabled === true,
    pickupInstructions: clean(raw.pickupInstructions, 1000),
  };
}
function sellerSource(settings = {}) {
  const store = settings.store || {},
    fiscal = settings.billing?.fiscalInfo || {},
    previous = settings.consumerProtection || {};
  const fiscalNit = clean(fiscal.nit, 30);
  const nit = fiscalNit
    ? `${fiscalNit}${fiscal.dv && !fiscalNit.includes("-") ? `-${clean(fiscal.dv, 1)}` : ""}`
    : clean(previous.nit, 30);
  return {
    legalName:
      clean(fiscal.businessName) ||
      clean(store.businessName) ||
      clean(previous.legalName),
    nit,
    notificationAddress:
      [store.address, store.city, store.department]
        .map((v) => clean(v))
        .filter(Boolean)
        .join(", ") ||
      [fiscal.address, fiscal.city, fiscal.department]
        .map((v) => clean(v))
        .filter(Boolean)
        .join(", ") ||
      clean(previous.notificationAddress),
    email:
      clean(store.supportEmail || store.email, 180).toLowerCase() ||
      clean(previous.email, 180).toLowerCase(),
    phone:
      clean(store.phone || store.whatsapp, 40) || clean(previous.phone, 40),
  };
}
function sourceSummary(settings = {}) {
  return [
    {
      title: "Datos de la tienda",
      description: "Dirección, correo y teléfono de atención.",
      href: "/admin/configuracion/empresa",
    },
    {
      title: "Datos fiscales",
      description: "Razón social y NIT del vendedor.",
      href: "/admin/facturacion/configuracion",
    },
    {
      title: "Envíos",
      description: "Tarifas, destinos, plazo y recogida.",
      href: "/admin/configuracion/envios?tema=condiciones",
    },
    {
      title: "Órdenes",
      description: "Entregas, cambios, devoluciones y su política vigente.",
      href: "/admin/ordenes",
    },
  ];
}
module.exports = {
  DELIVERY_KEYS,
  PRIVACY_KEYS,
  deliverySettings,
  sellerSource,
  sourceSummary,
};
