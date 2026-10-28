import {
  buildMemoryJournal,
  validateMemoryJournal,
} from "./memoryJournalConfig";
import { buildContactConfig, validateContactConfig } from "./contactPageConfig";
import { buildHelpConfig, validateHelpConfig } from "./helpPageConfig";
import { buildSafeCartPageConfig } from "../cart/cartPageConfig";
import { catalogImageUrl } from "../catalog/catalogPresentation";
import { safeFooterLink } from "../footer/footerEditorialConfig";
import { buildShippingConfig, validateShippingConfig } from "../shipping/shippingPageConfig";
const object = (v) =>
  v && typeof v === "object" && !Array.isArray(v) ? v : {};
const text = (v, fallback = "", limit = Infinity) =>
  typeof v === "string" ? v.slice(0, limit) : fallback;
const number = (v, min, max, fallback) =>
  v !== "" && v != null && Number.isFinite(Number(v))
    ? Math.max(min, Math.min(max, Number(v)))
    : fallback;
const color = (v, fallback) => (/^#[\da-f]{6}$/i.test(v || "") ? v : fallback);
export const INFORMATION_STARTER = [
  {
    id: "historia",
    type: "text",
    title: "Nuestra historia",
    body: "Conoce nuestra propuesta, lo que nos inspira y lo que queremos compartir contigo.",
  },
  {
    id: "hablemos",
    type: "text",
    title: "Hablemos",
    body: "Si deseas conocer más o resolver una pregunta, utiliza los canales de atención disponibles en la tienda.",
  },
];
export function informationLink(value) {
  const link = safeFooterLink(value);
  return /^\/(?:admin|probe-site-settings)(?:[/?#]|$)/i.test(link) ? "" : link;
}
function normalizeSections(value) {
  const seen = new Set();
  return (Array.isArray(value) ? value : INFORMATION_STARTER)
    .slice(0, 24)
    .map((raw, index) => {
      const source = object(raw);
      let id =
        text(source.id, `section-${index + 1}`, 80).replace(
          /[^a-zA-Z0-9_-]/g,
          "",
        ) || `section-${index + 1}`;
      while (seen.has(id)) id += `-${index + 1}`;
      seen.add(id);
      return {
        ...source,
        id,
        type: ["text", "split", "values", "faq"].includes(source.type)
          ? source.type
          : "text",
        title: text(source.title, "", 180),
        body: text(source.body),
        enabled: source.enabled !== false,
        image: catalogImageUrl(source.image),
        imageAlt: text(source.imageAlt, "", 500),
        imagePosition: source.imagePosition === "left" ? "left" : "right",
        items: (Array.isArray(source.items) ? source.items : [])
          .slice(0, 20)
          .map((item) => ({
            ...object(item),
            title: text(item?.title, "", 180),
            body: text(item?.body),
          })),
      };
    });
}
export function buildInformationConfig(raw = {}) {
  const source = object(raw),
    s = object(source.style),
    p = object(source.presentation);
  const material = buildSafeCartPageConfig({
    style: {
      cardBg: "#efb9b7",
      cardBorderColor: "#fff4ed",
      textPrimaryColor: "#652d42",
      textSecondaryColor: "#875a68",
      accentColor: "#a52c53",
      cardRadiusPx: 24,
      cardPaddingPx: 28,
      ...s,
    },
    presentation: {
      glassOpacity: 0.12,
      glassBlur: 5,
      borderWidth: 2.75,
      reflection: 0.85,
      ...p,
    },
  });
  return {
    ...source,
    ...(source.shipping !== undefined ? { shipping: buildShippingConfig(source.shipping) } : {}),
    layout: ["memory-table", "contact", "help"].includes(source.layout) ? source.layout : "editorial",
    help: buildHelpConfig(source.help, { starter: source.layout === "help" }),
    contact: buildContactConfig(source.contact),
    journal: buildMemoryJournal(
      source.journal,
      Array.isArray(source.sections) ? source.sections : [],
    ),
    eyebrowText: text(source.eyebrowText, "Conócenos", 180),
    titleText: text(source.titleText, "Nosotros", 180),
    subtitleText: text(
      source.subtitleText,
      "Descubre nuestra propuesta y encuentra cómo comunicarte con nuestro equipo.",
      2000,
    ),
    titleMode: source.titleMode === "image" ? "image" : "text",
    titleImage: catalogImageUrl(source.titleImage),
    titleImageAlt: text(source.titleImageAlt),
    titleImageHeightPx: number(source.titleImageHeightPx, 24, 220, 80),
    titleFontSizePx: number(source.titleFontSizePx, 18, 72, 48),
    contentMaxWidthPx: number(source.contentMaxWidthPx, 320, 1800, 1200),
    contentTopPaddingPx: number(source.contentTopPaddingPx, 0, 300, 32),
    contentBottomPaddingPx: number(source.contentBottomPaddingPx, 0, 300, 56),
    gapPx: number(source.gapPx, 8, 60, 24),
    navigationTitle: text(source.navigationTitle, "En esta página", 180),
    showNavigation: source.showNavigation !== false,
    showTitle: source.showTitle !== false,
    showSubtitle: source.showSubtitle !== false,
    showEyebrow: source.showEyebrow !== false,
    showHeader: source.showHeader !== false,
    showFooter: source.showFooter !== false,
    showWhatsapp: source.showWhatsapp === true,
    actionText: text(source.actionText, "Volver a Inicio", 180),
    actionHref: informationLink(source.actionHref ?? "/"),
    sections: normalizeSections(source.sections),
    style: {
      ...s,
      ...material.style,
      titleTextColor: color(s.titleTextColor, material.style.textPrimaryColor),
      lineColor: color(s.lineColor, material.style.cardBorderColor),
      buttonBg: color(s.buttonBg, material.style.accentColor),
      buttonTextColor: color(s.buttonTextColor, "#fff4ed"),
      buttonBorderColor: color(
        s.buttonBorderColor,
        material.style.cardBorderColor,
      ),
      bodyFontSizePx: number(s.bodyFontSizePx, 12, 22, 15),
      sectionTitleSizePx: number(s.sectionTitleSizePx, 18, 56, 32),
      navigationWidthPx: number(s.navigationWidthPx, 180, 360, 230),
      buttonRadiusPx: number(s.buttonRadiusPx, 0, 999, 14),
    },
    presentation: {
      ...material.presentation,
      backgroundImage: catalogImageUrl(p.backgroundImage),
      mobileBackgroundImage: catalogImageUrl(p.mobileBackgroundImage),
    },
  };
}
export function normalizeInformationPage(page) {
  return {
    name: text(page.name, "Nosotros", 120).trim(),
    slug: text(page.slug, "nosotros", 160).trim().toLowerCase(),
    pageType: "information",
    ...((["about", "contact", "help"].includes(page.systemRole) || String(page.systemRole || "").startsWith("consumer-")) ? { systemRole: page.systemRole } : {}),
    enabled: page.enabled !== false,
    useHeader: page.useHeader !== false,
    useFooter: page.useFooter !== false,
    blocks: Array.isArray(page.blocks) ? page.blocks : [],
    informationPageConfig: informationConfigForPage(page),
  };
}
export function informationConfigForPage(page) {
  const raw = object(page.informationPageConfig);
  const shipping = page.systemRole === "consumer-shipping";
  const adoptShipping = shipping && raw.shipping === undefined && raw.subtitleText === "Información clara para comprar y recibir atención." && raw.eyebrowText === "Tu compra, con confianza";
  const shippingDefaults = shipping ? {
    shipping: {},
    titleText: page.name || "Envíos y entregas", eyebrowText: "Información de tu compra", subtitleText: "Todo lo que necesitas saber para recibir tu pedido.",
    contentMaxWidthPx: 1440, titleFontSizePx: 64, gapPx: 16, actionText: "", sections: [],
    style: { cardRadiusPx: 28, cardPaddingPx: 28, buttonRadiusPx: 999, textPrimaryColor: "#6b1635", textSecondaryColor: "#71384b", accentColor: "#922e50", sectionTitleSizePx: 32, buttonBg: "#7e2440", buttonTextColor: "#fff4ed" },
    presentation: { backgroundMode: "continuity", borderWidth: 2.25, glassOpacity: .12, glassBlur: 5, reflection: .9, checkoutGlassOpacity: .88, checkoutGlassBlur: 8 },
  } : {};
  const adopt = page.systemRole === "about" && raw.layout === undefined;
  const contactDefaults = page.systemRole === "contact" ? {
    layout: "contact", eyebrowText: "Estamos cerca", titleText: "Hablemos de lo\nque necesitas.",
    subtitleText: "Elige cómo prefieres contactarnos.", contentMaxWidthPx: 1440,
    titleFontSizePx: 64, gapPx: 36, actionText: "", sections: [],
    style: { cardRadiusPx: 32, buttonRadiusPx: 999, buttonBg: "#7e2440", buttonTextColor: "#fff4ed" },
    presentation: { borderWidth: 3.25, checkoutGlassOpacity: .8, checkoutGlassBlur: 8 },
  } : {};
  const helpDefaults = page.systemRole === "help" ? {
    layout: "help", eyebrowText: "Te acompañamos", titleText: "¿Cómo podemos ayudarte?",
    subtitleText: "Encuentra respuestas y sigue con tu compra.", titleFontSizePx: 56,
    contentMaxWidthPx: 1440, gapPx: 24, actionText: "", sections: [],
    style: { cardRadiusPx: 28, cardPaddingPx: 26, buttonRadiusPx: 999, navigationWidthPx: 290, buttonBg: "#7e2440", buttonTextColor: "#fff4ed" },
    presentation: { borderWidth: 3.25, checkoutGlassOpacity: .8, checkoutGlassBlur: 8 },
  } : {};
  return buildInformationConfig({
    ...(page.systemRole === "about"
      ? {}
      : {
          titleText: page.name || "Información",
          eyebrowText: "",
          subtitleText: "",
          sections: [],
        }),
    ...contactDefaults,
    ...helpDefaults,
    ...shippingDefaults,
    ...raw,
    ...(shipping ? {
      style: { ...shippingDefaults.style, ...object(raw.style) },
      presentation: { ...shippingDefaults.presentation, ...object(raw.presentation) },
      ...(adoptShipping ? { eyebrowText: shippingDefaults.eyebrowText, subtitleText: shippingDefaults.subtitleText, ...(raw.titleFontSizePx === 40 ? { titleFontSizePx: 64 } : {}) } : {}),
    } : {}),
    ...(page.systemRole === "contact" ? {
      style: { ...contactDefaults.style, ...object(raw.style) },
      presentation: { ...contactDefaults.presentation, ...object(raw.presentation) },
    } : {}),
    ...(page.systemRole === "help" ? {
      style: { ...helpDefaults.style, ...object(raw.style) },
      presentation: { ...helpDefaults.presentation, ...object(raw.presentation) },
    } : {}),
    ...(adopt
      ? {
          layout: "memory-table",
          eyebrowText:
            !raw.eyebrowText || raw.eyebrowText === "Conócenos"
              ? "Nosotros"
              : raw.eyebrowText,
          titleText:
            !raw.titleText || raw.titleText === "Nosotros"
              ? "Nuestra historia,\npor dentro"
              : raw.titleText,
          subtitleText:
            !raw.subtitleText ||
            raw.subtitleText ===
              "Descubre nuestra propuesta y encuentra cómo comunicarte con nuestro equipo."
              ? "Explora los recuerdos que dan vida a nuestro negocio."
              : raw.subtitleText,
          contentMaxWidthPx:
            !raw.contentMaxWidthPx || raw.contentMaxWidthPx === 1200
              ? 1480
              : raw.contentMaxWidthPx,
          titleFontSizePx:
            !raw.titleFontSizePx || raw.titleFontSizePx === 48
              ? 56
              : raw.titleFontSizePx,
        }
      : {}),
  });
}
export function validateInformationPage(page) {
  if (!page.name?.trim()) return "Escribe el nombre de la página.";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(page.slug || ""))
    return "Usa una dirección con letras minúsculas, números y guiones, sin espacios.";
  const config = page.informationPageConfig || {};
  const shippingError = page.systemRole === "consumer-shipping" ? validateShippingConfig(config.shipping) : "";
  if (shippingError) return shippingError;
  const memoryError = config.layout === "memory-table" ? validateMemoryJournal(config.journal) : "";
  if (memoryError) return memoryError;
  const contactError = config.layout === "contact" ? validateContactConfig(config.contact) : "";
  if (contactError) return contactError;
  const helpError = config.layout === "help" ? validateHelpConfig(config.help) : "";
  if (helpError) return helpError;
  if (config.actionHref?.trim() && !informationLink(config.actionHref))
    return "Revisa el destino del botón: usa una página pública o un enlace http(s), correo o teléfono.";
  if (
    config.sections?.some(
      (section) =>
        section.enabled &&
        section.type === "faq" &&
        section.items.some((item) => item.body.trim() && !item.title.trim()),
    )
  )
    return "Cada respuesta necesita el texto de su pregunta.";
  return "";
}
