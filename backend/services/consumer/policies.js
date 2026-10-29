"use strict";

const VERSION = "CO-2026-10-27.1";
const AUTHORITY_URL = "https://www.sic.gov.co/";
const SOURCES = [
  "https://normograma.mintic.gov.co/mintic/compilacion/docs/ley_1480_2011.htm",
  "https://normograma.superservicios.gov.co/NORMOGRAMA/compilacion/docs/ley_2439_2024.htm",
  "https://cancilleria.gov.co/normograma/compilacion/docs/ley_1581_2012.htm",
];
const { clean } = require("./policiesText");
const { privacyDocument } = require("./privacyDocument");
const { deliverySettings, sellerSource } = require("./sources");
function normalizeConfig(raw = {}) {
  raw = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  return {
    revision:
      Number.isSafeInteger(raw.revision) && raw.revision >= 0
        ? raw.revision
        : 0,
    privacyEffectiveDate: /^\d{4}-\d{2}-\d{2}$/.test(
      raw.privacyEffectiveDate || "",
    )
      ? raw.privacyEffectiveDate
      : "",
    retention: clean(raw.retention, 1000),
    processors: clean(raw.processors, 2000),
  };
}
function sellerFor(settings = {}) {
  return sellerSource(settings);
}
function normalizePrivacyConfig(raw = {}) {
  const c = normalizeConfig(raw);
  return {
    revision: c.revision,
    privacyEffectiveDate: c.privacyEffectiveDate,
    retention: c.retention,
    processors: c.processors,
  };
}
function readiness(settings = {}) {
  const c = {
      ...normalizeConfig(settings.consumerProtection),
      ...deliverySettings(settings),
    },
    s = sellerFor(settings);
  const missing = [];
  if (!s.legalName) missing.push("Nombre o razón social del vendedor");
  if (!/^\d[\d.\s-]{4,28}$/.test(s.nit)) missing.push("NIT del vendedor");
  if (
    !s.notificationAddress ||
    !(
      settings.store?.address ||
      settings.billing?.fiscalInfo?.address ||
      settings.consumerProtection?.notificationAddress
    )
  )
    missing.push("Dirección de notificación judicial");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email))
    missing.push("Correo de atención");
  if (s.phone.replace(/\D/g, "").length < 7)
    missing.push("Teléfono de atención");
  if (
    c.deliveryDays !== null &&
    (!Number.isInteger(c.deliveryDays) ||
      c.deliveryDays < 1 ||
      c.deliveryDays > 30)
  )
    missing.push("Plazo de entrega de 1 a 30 días calendario");
  if (!c.privacyEffectiveDate || !c.retention || !c.processors)
    missing.push("Vigencia, conservación y encargados de datos personales");
  if (c.pickupEnabled && !c.pickupInstructions)
    missing.push("Instrucciones para recoger el pedido");
  return { ready: missing.length === 0, missing };
}
function policyDocument(settings = {}) {
  const privacy = normalizeConfig(settings.consumerProtection);
  const c = { ...privacy, ...deliverySettings(settings) },
    seller = sellerFor(settings);
  const returns = settings.consumerReturnPolicy;
  const delivery =
    c.deliveryDays == null
      ? "Si no se acuerda un plazo particular, la entrega tiene como límite 30 días calendario contados desde el día siguiente a la comunicación del pedido."
      : `El plazo máximo de entrega es de ${c.deliveryDays} días calendario contados desde el día siguiente a la comunicación del pedido. Incluye preparación y transporte.`;
  const regionNames = new Intl.DisplayNames(["es-CO"], { type: "region" });
  const destinations = c.shippingCountries
    .split(", ")
    .map((code) => regionNames.of(code) || code)
    .join(", ");
  const privacyPolicy = privacyDocument(c);
  const sections = [
    {
      id: "terminos",
      title: "Compra y condiciones",
      body: "Antes de confirmar puedes revisar productos, cantidades, impuestos, descuentos, envío y total, corregir tus datos o abandonar la compra sin confirmarla. Solo la confirmación expresa crea el pedido. El estado del pago se informa por separado. Conservamos las condiciones aceptadas con cada pedido; cambios posteriores no las modifican. Los derechos legales del consumidor prevalecen sobre cualquier condición comercial.",
    },
    {
      id: "envios",
      title: "Envíos y entregas",
      body: `${delivery} Destinos habilitados: ${destinations}. El costo de envío se discrimina antes de confirmar, según las tarifas y el destino habilitados. El envío gratuito no modifica el plazo. ${c.pickupEnabled ? `También puedes recoger el pedido: ${c.pickupInstructions}.` : "Las opciones de entrega disponibles se muestran antes de confirmar."} Cualquier costo adicional requiere tu aceptación previa.\n\n Si falta disponibilidad se informa de inmediato; una segunda fecha se acuerda a solicitud del consumidor. Si se excede el plazo pactado o los 30 días calendario, o el producto no está disponible, puedes terminar unilateralmente el contrato y solicitar la devolución íntegra, sin retenciones ni descuentos, dentro de un máximo de 15 días calendario. Puedes presentar la solicitud en Peticiones y reclamos.`,
    },
    {
      id: "retracto",
      title: "Derecho de retracto",
      body: "Cuando procede en una venta a distancia, puedes ejercer el retracto dentro de los 5 días hábiles siguientes a la entrega del bien o a la celebración del contrato de servicios. Devuelve el producto por los mismos medios y en las mismas condiciones en que lo recibiste; el transporte y demás costos de esa devolución corresponden al consumidor. Las excepciones legales incluyen servicios cuya ejecución haya comenzado con tu acuerdo, bienes o servicios de precio sujeto a fluctuaciones no controlables, productos personalizados, bienes que no puedan devolverse o se deterioren o caduquen rápidamente por su naturaleza, apuestas y loterías, perecederos y bienes de uso personal. Las excepciones se evalúan según la naturaleza del producto y las condiciones de la compra. La devolución del dinero no puede exceder 15 días calendario desde el ejercicio del derecho, una vez suministrados los datos correctos y completos y cumplida la devolución exigible. Se informa y respeta el medio de pago que prefiera el consumidor conforme a la ley; no se impone saldo a favor. Radica tu solicitud incluso si el portal de cambios comerciales no admite el producto.",
    },
    {
      id: "garantia",
      title: "Garantía legal y cambios comerciales",
      body: `La garantía legal protege la calidad, idoneidad y seguridad y no se elimina por una promoción ni por cerrar el plazo de cambios comerciales. La reparación, transporte necesario y repuestos no tienen costo en los casos cubiertos. Si no admite reparación procede reposición o devolución; si la falla se repite, el consumidor elige la solución legal aplicable. El término es el que establece la norma o se anuncia; a falta de indicación, los productos nuevos tienen garantía de un año, sin perjuicio de reglas especiales según su naturaleza. No se exige exclusivamente la factura para demostrar la relación de consumo. Los cambios por gusto o talla son beneficios comerciales adicionales, distintos del retracto y la garantía. ${returns ? (returns.enabled === false ? "Los cambios comerciales adicionales no están habilitados." : `La política comercial vigente ofrece una ventana general de ${returns.windowDays || 30} días calendario para los artículos que cumplan sus condiciones; pueden existir reglas especiales según el producto. ${clean(returns.policyText, 4000)}`) : "Las condiciones comerciales adicionales se informan en la oferta cuando existan."} Puedes presentar una reclamación directa en Peticiones y reclamos. Se responde dentro de 15 días hábiles conforme al artículo 58 de la Ley 1480.`,
    },
    {
      id: "reversion",
      title: "Reversión del pago",
      body: "Para pagos con instrumentos electrónicos, la reversión procede en los supuestos legales de fraude, operación no solicitada, producto no recibido, diferente al solicitado o defectuoso. Dentro de los 5 días hábiles siguientes al conocimiento del hecho o al momento en que debió recibirse o se recibió el producto, según el caso, presenta la queja al proveedor y notifica al emisor del instrumento de pago. Radicar aquí no sustituye la notificación al emisor. Identifica la operación, la causal y el valor solicitado; cuando corresponda, pon el producto a disposición del proveedor. No es el mismo trámite que retracto o garantía.",
    },
    {
      id: "privacidad",
      title: "Tratamiento de datos personales",
      body: privacyPolicy.body,
    },
  ];
  return {
    version: `${VERSION}:${privacy.revision}:delivery-${c.revision}:returns-${returns?.revision ?? 0}`,
    seller,
    sections,
    privacySections: privacyPolicy.sections,
    authorityUrl: AUTHORITY_URL,
    sources: SOURCES,
    readiness: readiness(settings),
    pickupEnabled: c.pickupEnabled,
    pickupInstructions: c.pickupInstructions,
    deliveryDays:
      Number.isInteger(c.deliveryDays) &&
      c.deliveryDays >= 1 &&
      c.deliveryDays <= 30
        ? c.deliveryDays
        : 30,
  };
}
module.exports = {
  VERSION,
  AUTHORITY_URL,
  SOURCES,
  clean,
  normalizeConfig,
  normalizePrivacyConfig,
  sellerFor,
  readiness,
  policyDocument,
};
