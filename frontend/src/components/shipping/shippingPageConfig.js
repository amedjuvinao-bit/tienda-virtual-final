import { catalogImageUrl } from "../catalog/catalogPresentation";
import { safeFooterLink } from "../footer/footerEditorialConfig";
export const SHIPPING_STEPS = [
  {
    id: "purchase",
    icon: "cart",
    title: "Realizas tu compra",
    body: "Revisa tus datos y confirma.",
  },
  {
    id: "prepare",
    icon: "package",
    title: "Preparamos tu pedido",
    body: "Organizamos los productos.",
  },
  {
    id: "dispatch",
    icon: "truck",
    title: "Lo despachamos",
    body: "Gestionamos la entrega.",
  },
  {
    id: "receive",
    icon: "home",
    title: "Recibes tu pedido",
    body: "Comprueba lo que recibiste.",
  },
];
export const SHIPPING_TEXTS = {
  journeyLabel: "El recorrido de tu pedido",
  detailsTitle: "Costo y plazo de entrega",
  costTitle: "Costo de envío",
  costText: "Lo verás antes de confirmar tu compra.",
  deliveryTitle: "Plazo de entrega",
  deliveryText: "Consulta el compromiso informado al comprar.",
  pickupTitle: "Recogida del pedido",
  coverageTitle: "¿Dónde entregamos?",
  coverageText: "Comprueba la disponibilidad para tu dirección al comprar.",
  supportTitle: "¿Necesitas ayuda con una entrega?",
  supportText: "Estamos aquí para acompañarte.",
  contactText: "Contactar tienda",
  claimsText: "Peticiones y reclamos",
  conditionsText: "Condiciones completas de entrega y datos del vendedor",
  downloadText: "Descargar esta información",
  retryText: "Reintentar",
  loadingText: "Cargando condiciones de entrega…",
};
export const SHIPPING_ICONS = [
  "cart",
  "package",
  "truck",
  "home",
  "pin",
  "clock",
  "check",
];
const object = (v) =>
  v && typeof v === "object" && !Array.isArray(v) ? v : {};
const text = (v, fallback = "", max = 1000) =>
  typeof v === "string" ? v.slice(0, max) : fallback;
const size = (v, min, max, fallback) =>
  v !== "" && v != null && Number.isFinite(Number(v))
    ? Math.min(max, Math.max(min, Number(v)))
    : fallback;
export function shippingLink(value) {
  const link = safeFooterLink(value);
  return /^\/(?:admin|probe-site-settings)(?:[/?#]|$)/i.test(link) ? "" : link;
}
export function buildShippingConfig(raw = {}) {
  const source = object(raw),
    seen = new Set();
  const steps = (Array.isArray(source.steps) ? source.steps : SHIPPING_STEPS)
    .slice(0, 6)
    .map((raw, i) => {
      const step = object(raw);
      let id =
        text(step.id, `step-${i + 1}`, 60).replace(/[^a-zA-Z0-9_-]/g, "") ||
        `step-${i + 1}`;
      while (seen.has(id)) id += `-${i + 1}`;
      seen.add(id);
      return {
        ...step,
        id,
        icon: SHIPPING_ICONS.includes(step.icon) ? step.icon : "package",
        title: text(step.title, "", 180),
        body: text(step.body, "", 1000),
        enabled: step.enabled !== false,
      };
    });
  return {
    ...source,
    ...Object.fromEntries(
      Object.entries(SHIPPING_TEXTS).map(([key, value]) => [
        key,
        text(source[key], value),
      ]),
    ),
    steps,
    heroArtwork: catalogImageUrl(
      source.heroArtwork === undefined
        ? "/shipping/crystal-parcel.webp"
        : source.heroArtwork,
    ),
    heroArtworkAlt: text(source.heroArtworkAlt, "", 500),
    coverageArtwork: catalogImageUrl(
      source.coverageArtwork === undefined
        ? "/shipping/crystal-location.webp"
        : source.coverageArtwork,
    ),
    showCoverageArtwork: source.showCoverageArtwork !== false,
    heroArtworkWidthPx: size(source.heroArtworkWidthPx, 120, 460, 310),
    heroMinHeightPx: size(source.heroMinHeightPx, 140, 420, 230),
    iconSizePx: size(source.iconSizePx, 38, 100, 72),
    contactHref: shippingLink(source.contactHref ?? "/contacto"),
    claimsHref: shippingLink(source.claimsHref ?? "/pqr"),
    showArtwork: source.showArtwork !== false,
    showJourney: source.showJourney !== false,
    showDetails: source.showDetails !== false,
    showCoverage: source.showCoverage !== false,
    showSupport: source.showSupport !== false,
    showSections: source.showSections !== false,
    showFooterAction: source.showFooterAction === true,
    editorialHeading: source.editorialHeading !== false,
    motion: source.motion !== false,
  };
}
export function validateShippingConfig(raw = {}) {
  const c = buildShippingConfig(raw);
  if (
    c.showJourney &&
    c.steps.some((s) => s.enabled && (!s.title.trim() || !s.body.trim()))
  )
    return "Completa el título y la descripción de cada paso visible de la entrega.";
  for (const key of ["contactHref", "claimsHref"]) {
    if (
      typeof raw[key] === "string" &&
      raw[key].trim() &&
      !shippingLink(raw[key])
    )
      return "Revisa los destinos de ayuda: usa enlaces públicos seguros.";
  }
  return "";
}
