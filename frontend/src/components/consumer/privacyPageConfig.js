import { catalogImageUrl } from "../catalog/catalogPresentation";
import { claimsLink } from "./claimsPageConfig";
export const PRIVACY_TOPICS = {
  datos: "Datos y finalidades",
  autorizacion: "Autorización y comunicaciones",
  conservacion: "Conservación y proveedores",
  consultas: "Consultas y reclamos",
};
export const PRIVACY_SUMMARIES = [
  {
    id: "datos",
    icon: "user",
    title: "Qué datos usamos",
    body: "Contacto, identificación, compra y entrega.",
  },
  {
    id: "usos",
    icon: "package",
    title: "Para qué los usamos",
    body: "Pedidos, pagos, facturación, logística y atención.",
  },
  {
    id: "comunicaciones",
    icon: "hand",
    title: "Tus comunicaciones",
    body: "La autorización comercial es independiente y opcional.",
  },
];
export const PRIVACY_RIGHTS = [
  {
    id: "consulta",
    icon: "eye",
    title: "Consultar tus datos",
    body: "Conoce qué información se trata y para qué.",
  },
  {
    id: "actualizacion",
    icon: "edit",
    title: "Actualizar y rectificar",
    body: "Solicita la corrección de tus datos.",
  },
  {
    id: "supresion",
    icon: "shield",
    title: "Revocar o solicitar supresión",
    body: "Puedes solicitarlo cuando proceda.",
  },
];
export const PRIVACY_TEXTS = {
  rightsEyebrow: "Tu información",
  rightsTitle: "Conoce tus derechos",
  rightsText: "Ejercer mis derechos",
  rightsHint: "Presenta tu solicitud por Peticiones y reclamos.",
  contactText: "Contactar tienda",
  downloadTitle: "Conserva esta información",
  downloadHint:
    "Descarga la política completa para consultarla cuando necesites.",
  downloadText: "Descargar política",
  sellerText: "Responsable y canales de contacto",
  sellerTitle: "Identificación del responsable",
  sellerContactText: "Canales de contacto",
  fullPolicyTitle: "Política completa",
  loadingText: "Cargando política de datos…",
  retryText: "Reintentar",
};
const object = (v) =>
  v && typeof v === "object" && !Array.isArray(v) ? v : {};
const text = (v, fallback = "", max = 1000) =>
  typeof v === "string" ? v.slice(0, max) : fallback;
const size = (v, min, max, fallback) =>
  v !== "" && v != null && Number.isFinite(Number(v))
    ? Math.max(min, Math.min(max, Number(v)))
    : fallback;
export const PRIVACY_ICONS = {
  user: "Persona",
  package: "Paquete",
  hand: "Mano",
  eye: "Consulta",
  edit: "Edición",
  shield: "Protección",
  file: "Documento",
  messages: "Mensajes",
  database: "Conservación",
};
function items(value, fallback) {
  const seen = new Set();
  return (Array.isArray(value) ? value : fallback)
    .slice(0, 6)
    .map((raw, index) => {
      const item = object(raw);
      let id =
        text(item.id, `item-${index + 1}`, 80).replace(/[^a-zA-Z0-9_-]/g, "") ||
        `item-${index + 1}`;
      while (seen.has(id)) id += `-${index + 1}`;
      seen.add(id);
      return {
        ...item,
        id,
        title: text(item.title),
        body: text(item.body),
        icon: Object.hasOwn(PRIVACY_ICONS, item.icon) ? item.icon : "file",
        enabled: item.enabled !== false,
      };
    });
}
export function buildPrivacyPage(raw = {}) {
  const c = object(raw);
  return {
    ...c,
    ...Object.fromEntries(
      Object.entries(PRIVACY_TEXTS).map(([key, value]) => [
        key,
        text(c[key], value),
      ]),
    ),
    topics: {
      ...object(c.topics),
      ...Object.fromEntries(
        Object.entries(PRIVACY_TOPICS).map(([id, label]) => [
          id,
          {
            ...object(c.topics?.[id]),
            label: text(c.topics?.[id]?.label, label, 180),
          },
        ]),
      ),
    },
    summaries: items(c.summaries, PRIVACY_SUMMARIES),
    rights: items(c.rights, PRIVACY_RIGHTS),
    heroArtwork: catalogImageUrl(
      c.heroArtwork === undefined
        ? "/consumer/crystal-privacy.webp"
        : c.heroArtwork,
    ),
    heroArtworkAlt: text(c.heroArtworkAlt),
    heroArtworkWidthPx: size(c.heroArtworkWidthPx, 120, 460, 320),
    heroMinHeightPx: size(c.heroMinHeightPx, 140, 380, 200),
    sidebarWidthPx: size(c.sidebarWidthPx, 260, 480, 390),
    rightsHref: claimsLink(c.rightsHref ?? "/pqr?tipo=privacy_query"),
    contactHref: claimsLink(c.contactHref ?? "/contacto"),
    showArtwork: c.showArtwork !== false,
    showSummary: c.showSummary !== false,
    showRights: c.showRights !== false,
    showSections: c.showSections !== false,
    showFooterAction: c.showFooterAction === true,
    editorialHeading: c.editorialHeading !== false,
    motion: c.motion !== false,
  };
}
export function validatePrivacyPage(raw = {}) {
  const c = object(raw);
  for (const key of ["rightsHref", "contactHref"])
    if (typeof c[key] === "string" && c[key].trim() && !claimsLink(c[key]))
      return "Revisa los destinos de atención: usa enlaces públicos seguros.";
  if (
    Object.values(object(c.topics)).some(
      (topic) => typeof topic?.label === "string" && !topic.label.trim(),
    )
  )
    return "Cada tema de privacidad necesita un nombre comprensible.";
  for (const key of ["summaries", "rights"])
    if (
      Array.isArray(c[key]) &&
      c[key].some(
        (item) =>
          item?.enabled !== false &&
          (typeof item?.title !== "string" ||
            !item.title.trim() ||
            typeof item?.body !== "string" ||
            !item.body.trim()),
      )
    )
      return "Completa el título y la descripción de los elementos visibles.";
  return "";
}
