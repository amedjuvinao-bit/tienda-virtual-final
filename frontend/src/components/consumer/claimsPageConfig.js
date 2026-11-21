import { catalogImageUrl } from "../catalog/catalogPresentation";
import { safeFooterLink } from "../footer/footerEditorialConfig";
export const CLAIMS_TEXTS = {
  createTabText: "Nueva solicitud",
  trackTabText: "Consultar solicitud",
  recoverTabText: "Recuperar acceso",
  createTitle: "Cuéntanos qué necesitas",
  createHint: "El número de pedido es opcional.",
  trackTitle: "Consulta tu solicitud",
  trackHint:
    "Ingresa el radicado y la clave privada que recibiste al presentar tu solicitud.",
  recoverTitle: "Recupera tu acceso",
  optionalText: "Datos opcionales",
  submitText: "Enviar y obtener radicado",
  submittingText: "Radicando…",
  retrySubmissionText: "Reintentar la misma solicitud",
  trackSubmitText: "Consultar estado y respuesta",
  trackPendingText: "Consultando…",
  submitHint:
    "Al enviar recibirás tu número de seguimiento y una clave privada.",
  guideTitle: "Tu solicitud, paso a paso",
  guideText:
    "Conserva tu radicado y tu clave para consultar el estado y las respuestas.",
  securityTitle: "Protege tu información",
  securityText: "No compartas tu clave ni escribas datos de tarjetas.",
  contactText: "Contactar tienda",
  sellerText: "Datos del vendedor y atención al consumidor",
  loadingText: "Cargando información de atención…",
  retryText: "Reintentar",
  downloadText: "Descargar esta información",
  recoverySendText: "Enviar código de recuperación",
  recoveryConfirmText: "Verificar código y recuperar acceso",
  recoveryPendingText: "Procesando…",
  recoveryAgainText: "Solicitar otro código",
};
export const CLAIMS_FIELDS = {
  name: { label: "Nombre", placeholder: "Tu nombre" },
  contact: {
    label: "Correo o teléfono de contacto",
    placeholder: "Cómo podemos responderte",
  },
  type: { label: "Tipo de solicitud", placeholder: "" },
  orderNumber: { label: "Número de pedido (opcional)", placeholder: "" },
  subject: { label: "Asunto", placeholder: "Resume tu solicitud" },
  message: {
    label: "Describe tu solicitud",
    placeholder: "Cuéntanos qué ocurrió y cómo podemos ayudarte.",
  },
  recoveryEmail: {
    label: "Correo para constancia y recuperación (opcional)",
    placeholder: "",
  },
  preferredRefundMethod: {
    label: "Si solicitas devolución, ¿qué medio de pago prefieres? (opcional)",
    placeholder:
      "Describe el medio; no escribas números de tarjetas ni contraseñas",
  },
  reference: { label: "Radicado", placeholder: "" },
  accessKey: { label: "Clave privada de seguimiento", placeholder: "" },
  recoveryReference: { label: "Radicado a recuperar", placeholder: "" },
  registeredEmail: { label: "Correo registrado", placeholder: "" },
  recoveryCode: { label: "Código recibido por correo", placeholder: "" },
};
export const CLAIMS_STEPS = [
  {
    title: "Envía tu solicitud",
    body: "Completa la información con los detalles de tu caso.",
  },
  {
    title: "Guarda tu constancia",
    body: "Al radicar recibes un número y una clave privada para consultar tu solicitud.",
  },
  {
    title: "Consulta la respuesta",
    body: "Ingresa con tu radicado y tu clave para conocer el estado y nuestras respuestas.",
  },
];
const object = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};
const text = (value, fallback = "", max = 1000) =>
  typeof value === "string" ? value.slice(0, max) : fallback;
const size = (value, min, max, fallback) =>
  value !== "" && value != null && Number.isFinite(Number(value))
    ? Math.max(min, Math.min(max, Number(value)))
    : fallback;
export function claimsLink(value) {
  const href = safeFooterLink(value);
  return /^\/(?:admin|probe-site-settings)(?:[/?#]|$)/i.test(href) ? "" : href;
}
export function buildClaimsPage(raw = {}) {
  const source = object(raw);
  return {
    ...source,
    ...Object.fromEntries(
      Object.entries(CLAIMS_TEXTS).map(([key, fallback]) => [
        key,
        text(source[key], fallback),
      ]),
    ),
    fields: {
      ...object(source.fields),
      ...Object.fromEntries(
        Object.entries(CLAIMS_FIELDS).map(([key, fallback]) => {
          const item = object(source.fields?.[key]);
          return [
            key,
            {
              ...item,
              label:
                text(item.label, fallback.label, 180).trim() || fallback.label,
              placeholder: text(item.placeholder, fallback.placeholder, 500),
            },
          ];
        }),
      ),
    },
    steps: (Array.isArray(source.steps) ? source.steps : CLAIMS_STEPS)
      .slice(0, 6)
      .map((item) => ({
        ...object(item),
        title: text(item?.title, "", 180),
        body: text(item?.body),
      })),
    heroArtwork: catalogImageUrl(
      source.heroArtwork === undefined
        ? "/consumer/crystal-envelope.webp"
        : source.heroArtwork,
    ),
    heroArtworkAlt: text(source.heroArtworkAlt, "", 500),
    heroArtworkWidthPx: size(source.heroArtworkWidthPx, 120, 460, 320),
    heroMinHeightPx: size(source.heroMinHeightPx, 140, 380, 200),
    sidebarWidthPx: size(source.sidebarWidthPx, 260, 440, 350),
    textareaHeightPx: size(source.textareaHeightPx, 80, 260, 96),
    fieldRadiusPx: size(source.fieldRadiusPx, 0, 40, 16),
    fieldBorderWidth: size(source.fieldBorderWidth, 0, 3, 1.1),
    fieldOpacity: size(source.fieldOpacity, 0, 0.5, 0.08),
    fieldBlur: size(source.fieldBlur, 0, 16, 3),
    contactHref: claimsLink(source.contactHref ?? "/contacto"),
    showArtwork: source.showArtwork !== false,
    showGuide: source.showGuide !== false,
    showSteps: source.showSteps !== false,
    showSections: source.showSections !== false,
    showFooterAction: source.showFooterAction === true,
    editorialHeading: source.editorialHeading !== false,
    motion: source.motion !== false,
  };
}
export function validateClaimsPage(raw = {}) {
  raw = object(raw);
  const c = buildClaimsPage(raw);
  if (
    typeof raw.contactHref === "string" &&
    raw.contactHref.trim() &&
    !claimsLink(raw.contactHref)
  )
    return "Revisa el destino de contacto: usa un enlace público seguro.";
  if (
    c.showGuide &&
    c.showSteps &&
    c.steps.some((item) => !item.title.trim() || !item.body.trim())
  )
    return "Completa el título y la descripción de los pasos de atención.";
  if (
    Object.values(object(raw.fields)).some(
      (item) => typeof item?.label === "string" && !item.label.trim(),
    )
  )
    return "Cada campo del formulario necesita una etiqueta comprensible.";
  return "";
}
