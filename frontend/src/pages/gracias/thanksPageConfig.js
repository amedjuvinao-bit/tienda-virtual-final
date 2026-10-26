import {
  buildSafeCartPageConfig,
  safePath,
} from "../../components/cart/cartPageConfig";
import { catalogImageUrl } from "../../components/catalog/catalogPresentation";
const object = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};

function clampInt(value, min, max, fallback) {
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

export function buildSafeThanksPageConfig(raw) {
  const config = object(raw);
  const material = buildSafeCartPageConfig({
    presentation: config.presentation,
  });
  const sourceSlides = Array.isArray(config.slider?.slides)
    ? config.slider.slides
    : [];
  const slideIds = new Set();
  const slides = sourceSlides.length
    ? sourceSlides
        .filter((slide) => slide && typeof slide === "object")
        .slice(0, 20)
        .map((slide, index) => {
          const requested =
            typeof slide.id === "string" && slide.id.trim()
              ? slide.id
              : `slide-${index}`;
          let id = requested;
          while (slideIds.has(id)) id += `-${index}`;
          slideIds.add(id);
          return {
            ...slide,
            id,
            image: catalogImageUrl(slide.image),
            alt:
              typeof slide?.alt === "string" && slide.alt.trim()
                ? slide.alt
                : `Imagen ${index + 1}`,
            badge: typeof slide?.badge === "string" ? slide.badge : "",
            caption: typeof slide?.caption === "string" ? slide.caption : "",
          };
        })
    : [];

  const text = (value, fallback) =>
    typeof value === "string" ? value : fallback;

  return {
    ...config,
    presentation: { ...object(config.presentation), ...material.presentation },
    continueButtonLink: safePath(config.continueButtonLink, "/"),
    entryMessage: text(
      config.entryMessage,
      "Puedes consultar el resultado de tu pedido al finalizar la compra o continuar explorando nuestros productos.",
    ),
    returnsButtonText: text(
      config.returnsButtonText,
      "Gestionar cambios o devoluciones",
    ),
    showPaymentStatus: config.showPaymentStatus !== false,
    titleMode: ["text", "image"].includes(config.titleMode)
      ? config.titleMode
      : "text",
    titleText: text(config.titleText, "¡Gracias por tu compra!"),
    titleImage: catalogImageUrl(config.titleImage),
    titleImageAlt: text(config.titleImageAlt, "Agradecimiento"),
    showHeader: config.showHeader !== false,
    showFooter: config.showFooter !== false,
    showWhatsAppButton: config.showWhatsAppButton !== false,
    showOrderNumber: config.showOrderNumber !== false,
    showCustomerName: config.showCustomerName !== false,
    showItemCount: config.showItemCount !== false,
    showSubtotal: config.showSubtotal !== false,
    showShipping: config.showShipping !== false,
    showTotal: config.showTotal !== false,
    showContinueButton: config.showContinueButton !== false,
    showHelpText: config.showHelpText !== false,
    showVisualPanel: config.showVisualPanel !== false,
    mainMessage: text(
      config.mainMessage,
      "Hemos recibido tu pedido correctamente. Te enviaremos un mensaje cuando esté en camino.",
    ),
    summaryTitle: text(config.summaryTitle, "Resumen de tu orden"),
    orderNumberLabel: text(config.orderNumberLabel, "Número de orden:"),
    customerLabel: text(config.customerLabel, "Cliente:"),
    itemCountLabel: text(config.itemCountLabel, "Productos comprados:"),
    subtotalLabel: text(config.subtotalLabel, "Subtotal:"),
    shippingLabel: text(config.shippingLabel, "Envío:"),
    totalLabel: text(config.totalLabel, "Total pagado:"),
    continueButtonText: text(config.continueButtonText, "Seguir comprando"),
    helpText: text(
      config.helpText,
      "¿Tienes dudas? Contáctanos por WhatsApp o revisa tu correo electrónico para más detalles.",
    ),
    slider: {
      ...object(config.slider),
      enabled: config.slider?.enabled !== false,
      autoplay: config.slider?.autoplay !== false,
      intervalMs: clampInt(config.slider?.intervalMs, 1500, 12000, 3500),
      animation: ["slide", "zoom", "fade"].includes(config.slider?.animation)
        ? config.slider.animation
        : "fade",
      slides,
    },
    style: buildStyle(config.style || {}),
  };
}

function buildStyle(raw) {
  const style = object(raw);
  const color = (value, fallback) =>
    typeof value === "string" ? value : fallback;
  return {
    ...style,
    pageBg: color(style.pageBg, "#f7e7e5"),
    contentMaxWidthPx: clampInt(style.contentMaxWidthPx, 900, 1800, 1200),
    contentTopPaddingPx: clampInt(style.contentTopPaddingPx, 0, 240, 28),
    titleTextColor: color(style.titleTextColor, "#db2777"),
    titleFontSizePx: clampInt(style.titleFontSizePx, 18, 72, 28),
    titleImageHeightPx: clampInt(style.titleImageHeightPx, 24, 220, 72),
    panelBg: color(style.panelBg, "#efb9b7"),
    panelBorderColor: color(style.panelBorderColor, "#fff4ed"),
    panelRadiusPx: clampInt(style.panelRadiusPx, 0, 40, 24),
    panelPaddingPx: clampInt(style.panelPaddingPx, 8, 48, 24),
    panelWidthPx: clampInt(style.panelWidthPx, 280, 900, 540),
    panelMinHeightPx: clampInt(style.panelMinHeightPx, 0, 900, 0),
    visualBorderColor: color(style.visualBorderColor, "#fff4ed"),
    visualRadiusPx: clampInt(style.visualRadiusPx, 0, 40, 16),
    visualWidthPx: clampInt(style.visualWidthPx, 220, 900, 400),
    visualHeightPx: clampInt(style.visualHeightPx, 220, 760, 520),
    badgeBg: color(style.badgeBg, "#ffffffcc"),
    badgeTextColor: color(style.badgeTextColor, "#db2777"),
    captionBg: color(style.captionBg, "#ffffffcc"),
    captionTextColor: color(style.captionTextColor, "#374151"),
    textPrimaryColor: color(style.textPrimaryColor, "#111827"),
    textSecondaryColor: color(style.textSecondaryColor, "#4b5563"),
    accentColor: color(style.accentColor, "#ec4899"),
    buttonBg: color(style.buttonBg, "#ec4899"),
    buttonTextColor: color(style.buttonTextColor, "#652d42"),
    buttonRadiusPx: clampInt(style.buttonRadiusPx, 0, 40, 24),
    buttonStyle: ["pill", "rounded", "square"].includes(style.buttonStyle)
      ? style.buttonStyle
      : "rounded",
    shadowStyle: ["none", "soft", "medium", "strong"].includes(
      style.shadowStyle,
    )
      ? style.shadowStyle
      : "soft",
  };
}

export function thanksMaterialConfig(config) {
  const s = config.style;
  const material = buildSafeCartPageConfig({
    presentation: config.presentation,
    style: {
      ...s,
      cardBg: s.panelBg,
      cardBorderColor: s.panelBorderColor,
      cardRadiusPx: s.panelRadiusPx,
      cardPaddingPx: s.panelPaddingPx,
    },
  });
  return material;
}
