import { catalogImageUrl } from "../catalog/catalogPresentation";
import { safeFooterLink } from "../footer/footerEditorialConfig";

export const RETURN_CHOICES = [
  {
    id: "change",
    icon: "exchange",
    title: "Quiero un cambio",
    body: "Consulta las opciones disponibles para tu compra.",
    actionText: "Ver opciones",
    requestHref: "/pqr?tipo=petition",
  },
  {
    id: "warranty",
    icon: "shield",
    title: "Mi producto tiene un problema",
    body: "Conoce cómo solicitar atención y garantía.",
    actionText: "Solicitar ayuda",
    requestHref: "/pqr?tipo=warranty",
  },
  {
    id: "withdrawal",
    icon: "return",
    title: "Quiero devolver mi compra",
    body: "Consulta el retracto y las condiciones aplicables.",
    actionText: "Ver mis derechos",
    requestHref: "/pqr?tipo=withdrawal",
  },
];
export const RETURN_STEPS = [
  {
    title: "Elige tu caso",
    body: "Selecciona la opción que se ajusta a tu situación.",
  },
  {
    title: "Envía tu solicitud",
    body: "Completa la información solicitada y guarda tu radicado.",
  },
  {
    title: "Consulta la respuesta",
    body: "Revisa el estado y las respuestas con tu radicado y clave.",
  },
];
export const RETURN_GUIDE_TEXTS = {
  choicesTitle: "¿Qué necesitas hacer?",
  journeyLabel: "Cómo solicitar atención",
  supportTitle: "Te acompañamos en el proceso",
  supportText: "Si ya tienes un radicado, consulta su estado y respuesta.",
  claimsText: "Peticiones y reclamos",
  trackText: "Consultar solicitud",
  requestText: "Iniciar solicitud de atención",
  closeText: "Cerrar información",
  orderHelpText:
    "Si tu compra tiene opciones de cambio habilitadas, puedes gestionarlas desde el enlace de tu pedido. Si no puedes acceder, solicita atención por este canal; revisaremos tu caso.",
  conditionsText: "Condiciones completas y derechos del consumidor",
  conditionsHint: "Consultar y descargar",
  downloadText: "Descargar esta información",
  loadingText: "Cargando condiciones…",
  retryText: "Reintentar",
};
const object = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};
const text = (value, fallback = "", max = 1000) =>
  typeof value === "string" ? value.slice(0, max) : fallback;
const size = (value, min, max, fallback) =>
  value !== "" && value != null && Number.isFinite(Number(value))
    ? Math.max(min, Math.min(max, Number(value)))
    : fallback;
export function returnsGuideLink(value) {
  const href = safeFooterLink(value);
  return /^\/(?:admin|probe-site-settings)(?:[/?#]|$)/i.test(href) ? "" : href;
}
export function buildReturnsGuide(raw = {}) {
  const source = object(raw);
  return {
    ...source,
    ...Object.fromEntries(
      Object.entries(RETURN_GUIDE_TEXTS).map(([key, fallback]) => [
        key,
        text(source[key], fallback),
      ]),
    ),
    choices: (Array.isArray(source.choices) && source.choices.length === 0
      ? []
      : RETURN_CHOICES
    ).map((fallback) => {
      const item = object(
        Array.isArray(source.choices)
          ? source.choices.find((choice) => choice?.id === fallback.id)
          : null,
      );
      return {
        ...item,
        id: fallback.id,
        icon: ["exchange", "shield", "return", "help", "document"].includes(
          item.icon,
        )
          ? item.icon
          : fallback.icon,
        title: text(item.title, fallback.title, 180),
        body: text(item.body, fallback.body),
        actionText: text(item.actionText, fallback.actionText, 180),
        requestHref: returnsGuideLink(item.requestHref ?? fallback.requestHref),
        enabled: item.enabled !== false,
      };
    }),
    steps: (Array.isArray(source.steps) && source.steps.length === 0
      ? []
      : RETURN_STEPS
    ).map((fallback, index) => {
      const item = object(source.steps?.[index]);
      return {
        ...item,
        title: text(item.title, fallback.title, 180),
        body: text(item.body, fallback.body),
      };
    }),
    heroArtwork: catalogImageUrl(
      source.heroArtwork === undefined
        ? "/returns/crystal-exchange.webp"
        : source.heroArtwork,
    ),
    heroArtworkAlt: text(source.heroArtworkAlt, "", 500),
    heroArtworkWidthPx: size(source.heroArtworkWidthPx, 120, 460, 310),
    heroMinHeightPx: size(source.heroMinHeightPx, 140, 420, 230),
    iconSizePx: size(source.iconSizePx, 38, 100, 72),
    claimsHref: returnsGuideLink(source.claimsHref ?? "/pqr"),
    trackHref: returnsGuideLink(source.trackHref ?? "/pqr?vista=consulta"),
    showArtwork: source.showArtwork !== false,
    showChoices: source.showChoices !== false,
    showJourney: source.showJourney !== false,
    showSupport: source.showSupport !== false,
    showSections: source.showSections !== false,
    showFooterAction: source.showFooterAction === true,
    editorialHeading: source.editorialHeading !== false,
    motion: source.motion !== false,
  };
}
export function validateReturnsGuide(raw = {}) {
  const c = buildReturnsGuide(raw);
  if (
    c.showChoices &&
    c.choices.some(
      (item) =>
        item.enabled &&
        (!item.title.trim() || !item.body.trim() || !item.actionText.trim()),
    )
  )
    return "Completa el título, descripción y botón de cada opción visible de atención.";
  if (
    c.showJourney &&
    c.steps.some((item) => !item.title.trim() || !item.body.trim())
  )
    return "Completa el título y la descripción de los tres pasos de atención.";
  const links = [
    raw.claimsHref,
    raw.trackHref,
    ...(Array.isArray(raw.choices)
      ? raw.choices.map((item) => item?.requestHref)
      : []),
  ];
  if (
    links.some(
      (href) =>
        typeof href === "string" && href.trim() && !returnsGuideLink(href),
    )
  )
    return "Revisa los destinos de atención: usa enlaces públicos seguros.";
  return "";
}
