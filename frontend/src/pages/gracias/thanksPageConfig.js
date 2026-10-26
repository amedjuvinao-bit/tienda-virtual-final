import {
  applyThanksCentralPreset,
  THANKS_CENTRAL_VERSION,
} from "./thanksCentralPreset";
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
  const original = object(raw);
  const adopting = original.designVersion !== THANKS_CENTRAL_VERSION;
  const config = adopting ? applyThanksCentralPreset(original) : original;
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
    designVersion: THANKS_CENTRAL_VERSION,
    showNextSteps: config.showNextSteps !== false,
    showOrderDetails: config.showOrderDetails !== false,
    refreshButtonText: text(config.refreshButtonText, "Actualizar estado"),
    detailsToggleText: text(config.detailsToggleText, "Ver detalle del pedido"),
    nextStepsTitle: text(config.nextStepsTitle, "¿Qué sigue?"),
    paymentStepTitle: text(config.paymentStepTitle, "Confirmación del pago"),
    pendingStepText: text(
      config.pendingStepText,
      "Estamos esperando la confirmación de tu pago.",
    ),
    approvedStepText: text(
      config.approvedStepText,
      "El pago de tu pedido fue confirmado.",
    ),
    attentionStepText: text(
      config.attentionStepText,
      "El pago requiere atención antes de continuar.",
    ),
    preparationStepTitle: text(
      config.preparationStepTitle,
      "Preparación del pedido",
    ),
    preparationStepText: text(
      config.preparationStepText,
      "Te avisaremos cuando comencemos a prepararlo.",
    ),
    deliveryStepTitle: text(config.deliveryStepTitle, "Entrega"),
    deliveryStepText: text(
      config.deliveryStepText,
      "Te compartiremos las novedades de la entrega.",
    ),
    entryTitleText: text(config.entryTitleText, "Consulta tu pedido"),
    pendingTotalLabel: text(config.pendingTotalLabel, "Total del pedido"),
    pendingMessageText: text(
      config.pendingMessageText,
      "Recibimos tu pedido. Estamos esperando la confirmación del pago.",
    ),
    itemSingularText: text(config.itemSingularText, "producto"),
    itemPluralText: text(config.itemPluralText, "productos"),
    presentation: {
      ...object(config.presentation),
      ...material.presentation,
    },
    continueButtonLink: safePath(config.continueButtonLink, "/"),
    entryMessage: text(
      config.entryMessage,
      "Puedes consultar el resultado de tu pedido al finalizar la compra o continuar explorando nuestros productos.",
    ),
    returnsButtonText: text(config.returnsButtonText, "Cambios y devoluciones"),
    showPaymentStatus: config.showPaymentStatus !== false,
    titleMode: ["text", "image"].includes(config.titleMode)
      ? config.titleMode
      : "text",
    titleText:
      adopting && config.titleText === "¡Gracias por tu compra!"
        ? "Gracias por tu pedido"
        : text(config.titleText, "Gracias por tu pedido"),
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
    showVisualPanel: config.showVisualPanel === true,
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
    factValueColor: color(style.factValueColor, "#74243e"),
    lineColor: color(style.lineColor, "#c68899"),
    statusBadgeBg: color(style.statusBadgeBg, "#f7bfd2"),
    statusBadgeTextColor: color(style.statusBadgeTextColor, "#9a214e"),
    iconColor: color(style.iconColor, "#a52c53"),
    medallionSizePx: clampInt(style.medallionSizePx, 56, 120, 88),
    stepIconSizePx: clampInt(style.stepIconSizePx, 36, 80, 62),
    pageBg: color(style.pageBg, "#f7e7e5"),
    contentMaxWidthPx: clampInt(style.contentMaxWidthPx, 900, 1800, 1200),
    contentTopPaddingPx: clampInt(style.contentTopPaddingPx, 0, 240, 28),
    headingFontFamily: ["editorial", "theme", "body"].includes(
      style.headingFontFamily,
    )
      ? style.headingFontFamily
      : "editorial",
    titleTextColor: color(style.titleTextColor, "#74243e"),
    titleFontSizePx: clampInt(style.titleFontSizePx, 18, 72, 48),
    titleImageHeightPx: clampInt(style.titleImageHeightPx, 24, 220, 72),
    panelBg: color(style.panelBg, "#efb9b7"),
    panelBorderColor: color(style.panelBorderColor, "#fff4ed"),
    panelRadiusPx: clampInt(style.panelRadiusPx, 0, 40, 24),
    panelPaddingPx: clampInt(style.panelPaddingPx, 8, 64, 40),
    panelWidthPx: clampInt(style.panelWidthPx, 280, 1200, 1000),
    panelMinHeightPx: clampInt(style.panelMinHeightPx, 0, 900, 0),
    visualBorderColor: color(style.visualBorderColor, "#fff4ed"),
    visualRadiusPx: clampInt(style.visualRadiusPx, 0, 40, 16),
    visualWidthPx: clampInt(style.visualWidthPx, 220, 900, 400),
    visualHeightPx: clampInt(style.visualHeightPx, 220, 760, 520),
    badgeBg: color(style.badgeBg, "#ffffffcc"),
    badgeTextColor: color(style.badgeTextColor, "#db2777"),
    captionBg: color(style.captionBg, "#ffffffcc"),
    captionTextColor: color(style.captionTextColor, "#374151"),
    textPrimaryColor: color(style.textPrimaryColor, "#652d42"),
    textSecondaryColor: color(style.textSecondaryColor, "#875a68"),
    accentColor: color(style.accentColor, "#a52c53"),
    secondaryButtonBg: color(style.secondaryButtonBg, "#f4bdcf"),
    secondaryButtonTextColor: color(style.secondaryButtonTextColor, "#922048"),
    buttonBg: color(style.buttonBg, "#a52c53"),
    buttonTextColor: color(style.buttonTextColor, "#fff6f5"),
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
