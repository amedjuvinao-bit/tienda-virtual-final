import { catalogImageUrl } from "../catalog/catalogPresentation";
import { claimsLink } from "./claimsPageConfig";

export const TERMS_TOPICS = {
  terminos: "Compra y condiciones",
  envios: "Envíos y entregas",
  retracto: "Derecho de retracto",
  garantia: "Garantía y cambios",
  reversion: "Reversión del pago",
  privacidad: "Datos personales",
};
export const TERMS_TEXTS = {
  indexTitle: "Encuentra un tema",
  firstEyebrow: "Antes de confirmar",
  downloadText: "Descargar condiciones",
  downloadHint: "Conserva una copia para consultarla.",
  helpTitle: "¿Necesitas ayuda?",
  helpText: "Peticiones y reclamos",
  sellerText: "Datos del vendedor y canales de contacto",
  sellerTitle: "Identificación del vendedor",
  contactText: "Canales de contacto",
  loadingText: "Cargando condiciones…",
  retryText: "Reintentar",
};
const object = (v) =>
  v && typeof v === "object" && !Array.isArray(v) ? v : {};
const text = (v, fallback, max = 500) =>
  typeof v === "string" ? v.slice(0, max) : fallback;
const size = (v, min, max, fallback) =>
  v !== "" && v != null && Number.isFinite(Number(v))
    ? Math.max(min, Math.min(max, Number(v)))
    : fallback;
export function buildTermsPage(raw = {}) {
  const c = object(raw);
  return {
    ...c,
    ...Object.fromEntries(
      Object.entries(TERMS_TEXTS).map(([key, value]) => [
        key,
        text(c[key], value),
      ]),
    ),
    topics: {
      ...object(c.topics),
      ...Object.fromEntries(
        Object.entries(TERMS_TOPICS).map(([id, label]) => [
          id,
          {
            ...object(c.topics?.[id]),
            label: text(c.topics?.[id]?.label, label, 180),
          },
        ]),
      ),
    },
    heroArtwork: catalogImageUrl(
      c.heroArtwork === undefined
        ? "/consumer/crystal-document.webp"
        : c.heroArtwork,
    ),
    heroArtworkAlt: text(c.heroArtworkAlt, ""),
    heroArtworkWidthPx: size(c.heroArtworkWidthPx, 120, 460, 320),
    heroMinHeightPx: size(c.heroMinHeightPx, 140, 380, 200),
    stickyOffsetPx: size(c.stickyOffsetPx, 0, 240, 112),
    helpHref: claimsLink(c.helpHref ?? "/pqr"),
    showArtwork: c.showArtwork !== false,
    showHelp: c.showHelp !== false,
    stickyIndex: c.stickyIndex !== false,
    editorialHeading: c.editorialHeading !== false,
    motion: c.motion !== false,
    showSections: c.showSections !== false,
    showFooterAction: c.showFooterAction === true,
  };
}
export function validateTermsPage(raw = {}) {
  const c = object(raw);
  if (
    typeof c.helpHref === "string" &&
    c.helpHref.trim() &&
    !claimsLink(c.helpHref)
  )
    return "Revisa el destino de ayuda: usa un enlace público seguro.";
  if (
    Object.values(object(c.topics)).some(
      (topic) => typeof topic?.label === "string" && !topic.label.trim(),
    )
  )
    return "Cada tema del índice necesita un nombre comprensible.";
  return "";
}
