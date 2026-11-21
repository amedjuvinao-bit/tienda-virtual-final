import { buildSafeCartPageConfig, safePath } from "../cart/cartPageConfig";
import { catalogImageUrl } from "../catalog/catalogPresentation";
const object = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};
const text = (value, fallback) =>
  typeof value === "string" ? value : fallback;
const number = (value, min, max, fallback) =>
  Number.isFinite(Number.parseFloat(value))
    ? Math.min(max, Math.max(min, Number.parseFloat(value)))
    : fallback;
export function buildSafeNotFoundPageConfig(raw) {
  const c = object(raw),
    p = object(c.presentation);
  const material = buildSafeCartPageConfig({
    presentation: { ...p, borderWidth: p.borderWidth ?? c.cardBorderWidthPx },
    style: {
      ...c,
      cardBg: c.cardBg || "#efb9b7",
      cardBorderColor: c.cardBorderColor || "#fff4ed",
      textPrimaryColor: c.textPrimaryColor || "#652d42",
      textSecondaryColor: c.textSecondaryColor || "#875a68",
      accentColor: c.accentColor || "#b3315c",
    },
  });
  const defaults = {
    titleText: "Página no encontrada",
    titleImageAlt: "Página no encontrada",
    breadcrumbRootLabel: "Inicio",
    breadcrumbText: "Página no encontrada",
    messageText:
      "La página que buscas no está disponible. Puedes volver al inicio o seguir explorando nuestros productos.",
    buttonText: "Volver al inicio",
    secondaryButtonText: "Explorar productos",
    imageAlt: "Ilustración de página no encontrada",
    codeText: "404",
  };
  return {
    ...c,
    ...Object.fromEntries(
      Object.entries(defaults).map(([key, fallback]) => [
        key,
        text(c[key], fallback),
      ]),
    ),
    ...Object.fromEntries(
      [
        "showHeader",
        "showFooter",
        "showWhatsapp",
        "showBreadcrumb",
        "showTitle",
        "showMessage",
        "showButton",
        "showSecondaryButton",
        "showImage",
        "showCode",
      ].map((key) => [key, c[key] !== false]),
    ),
    titleMode: c.titleMode === "image" ? "image" : "text",
    titleImage: catalogImageUrl(c.titleImage),
    imageUrl: catalogImageUrl(c.imageUrl),
    buttonLink: safePath(c.buttonLink, "/"),
    secondaryButtonLink: safePath(c.secondaryButtonLink, "/#categorias"),
    breadcrumbRootLink: safePath(c.breadcrumbRootLink, "/"),
    pageBg: text(c.pageBg, material.style.pageBg),
    cardBg: material.style.cardBg,
    cardBorderColor: material.style.cardBorderColor,
    textPrimaryColor: material.style.textPrimaryColor,
    textSecondaryColor: material.style.textSecondaryColor,
    accentColor: material.style.accentColor,
    titleTextColor: text(c.titleTextColor, material.style.textPrimaryColor),
    breadcrumbColor: text(c.breadcrumbColor, material.style.textSecondaryColor),
    buttonBg: text(c.buttonBg, material.style.accentColor),
    buttonTextColor: text(c.buttonTextColor, material.style.textPrimaryColor),
    buttonBorderColor: text(
      c.buttonBorderColor,
      material.style.cardBorderColor,
    ),
    secondaryButtonColor: text(
      c.secondaryButtonColor,
      material.style.accentColor,
    ),
    codeColor: text(c.codeColor, material.style.accentColor),
    contentTopPaddingPx: number(c.contentTopPaddingPx, 0, 300, 28),
    contentBottomPaddingPx: number(c.contentBottomPaddingPx, 0, 300, 40),
    contentMaxWidthPx: number(c.contentMaxWidthPx, 320, 1800, 1120),
    cardRadiusPx: number(c.cardRadiusPx, 0, 60, 24),
    cardPaddingPx: number(c.cardPaddingPx, 12, 80, 40),
    cardBorderWidthPx: material.presentation.borderWidth,
    titleFontSizePx: number(c.titleFontSizePx, 18, 90, 36),
    titleImageHeightPx: number(c.titleImageHeightPx, 24, 260, 96),
    messageFontSizePx: number(c.messageFontSizePx, 12, 28, 15),
    buttonFontSizePx: number(c.buttonFontSizePx, 10, 24, 13),
    buttonRadiusPx: number(c.buttonRadiusPx, 0, 999, 999),
    imageMaxWidthPx: number(c.imageMaxWidthPx, 100, 700, 340),
    imageRadiusPx: number(c.imageRadiusPx, 0, 60, 20),
    gapPx: number(c.gapPx, 12, 100, 36),
    codeFontSizePx: number(c.codeFontSizePx, 48, 240, 132),
    buttonStyle: ["solid", "outline", "ghost"].includes(c.buttonStyle)
      ? c.buttonStyle
      : "solid",
    shadowStyle: ["none", "soft", "medium", "strong"].includes(c.shadowStyle)
      ? c.shadowStyle
      : "soft",
    presentation: material.presentation,
  };
}
export function notFoundMaterialConfig(config) {
  const material = buildSafeCartPageConfig({
    style: config,
    presentation: config.presentation,
  });
  return {
    ...material,
    style: {
      ...material.style,
      cardRadiusPx: config.cardRadiusPx,
      cardPaddingPx: config.cardPaddingPx,
    },
  };
}
