import { buildCartPresentation } from "../../components/cart/cartPageConfig";
import { catalogImageUrl } from "../../components/catalog/catalogPresentation";
const object = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};
const clampInt = (value, min, max, fallback) =>
  Number.isFinite(Number.parseInt(value, 10))
    ? Math.max(min, Math.min(max, Number.parseInt(value, 10)))
    : fallback;
export function buildSafeCheckoutPageConfig(raw) {
  const cfg = object(raw);
  return {
    ...cfg,
    presentation: buildCartPresentation(object(cfg.presentation)),
    showProgress: cfg.showProgress !== false,
    showCoupon: cfg.showCoupon !== false,
    subtitleText:
      typeof cfg.subtitleText === "string"
        ? cfg.subtitleText
        : "Completa tus datos y revisa tu pedido antes de continuar.",
    lastnameLabelText:
      typeof cfg.lastnameLabelText === "string"
        ? cfg.lastnameLabelText
        : "Apellidos",
    phoneLabelText:
      typeof cfg.phoneLabelText === "string" ? cfg.phoneLabelText : "Teléfono",
    paymentSectionTitle:
      typeof cfg.paymentSectionTitle === "string"
        ? cfg.paymentSectionTitle
        : "Pago",
    titleMode:
      cfg.titleMode === "text" || cfg.titleMode === "image"
        ? cfg.titleMode
        : "text",
    titleText:
      typeof cfg.titleText === "string" && cfg.titleText.trim()
        ? cfg.titleText
        : "Finalizar compra",
    titleImage: catalogImageUrl(cfg.titleImage),
    titleImageAlt:
      typeof cfg.titleImageAlt === "string" && cfg.titleImageAlt.trim()
        ? cfg.titleImageAlt
        : "Título checkout",
    showHeader: cfg.showHeader !== false,
    showFooter: cfg.showFooter !== false,
    showWhatsAppButton: cfg.showWhatsAppButton !== false,
    showBreadcrumb: cfg.showBreadcrumb !== false,
    showContactSection: cfg.showContactSection !== false,
    showDeliverySection: cfg.showDeliverySection !== false,
    showBillingSection: cfg.showBillingSection !== false,
    showOrderSummary: cfg.showOrderSummary !== false,
    showPaymentMethodsImage: cfg.showPaymentMethodsImage !== false,
    showNewsletterCheckbox: cfg.showNewsletterCheckbox !== false,
    showPoliciesText: cfg.showPoliciesText !== false,
    showConfirmButton: cfg.showConfirmButton !== false,
    breadcrumbHomeText:
      typeof cfg.breadcrumbHomeText === "string" &&
      cfg.breadcrumbHomeText.trim()
        ? cfg.breadcrumbHomeText
        : "Inicio",
    breadcrumbCurrentText:
      typeof cfg.breadcrumbCurrentText === "string" &&
      cfg.breadcrumbCurrentText.trim()
        ? cfg.breadcrumbCurrentText
        : "Finalizar compra",
    contactSectionTitle:
      typeof cfg.contactSectionTitle === "string" &&
      cfg.contactSectionTitle.trim()
        ? cfg.contactSectionTitle
        : "Contacto",
    deliverySectionTitle:
      typeof cfg.deliverySectionTitle === "string" &&
      cfg.deliverySectionTitle.trim()
        ? cfg.deliverySectionTitle
        : "Entrega",
    billingSectionTitle:
      typeof cfg.billingSectionTitle === "string" &&
      cfg.billingSectionTitle.trim()
        ? cfg.billingSectionTitle
        : "Dirección de facturación",
    orderSummaryTitle:
      typeof cfg.orderSummaryTitle === "string" && cfg.orderSummaryTitle.trim()
        ? cfg.orderSummaryTitle
        : "Resumen de compra",
    emailLabelText:
      typeof cfg.emailLabelText === "string" && cfg.emailLabelText.trim()
        ? cfg.emailLabelText
        : "Email o número de teléfono móvil",
    phoneLabelText:
      typeof cfg.phoneLabelText === "string" && cfg.phoneLabelText.trim()
        ? cfg.phoneLabelText
        : "Teléfono",
    documentLabelText:
      typeof cfg.documentLabelText === "string" && cfg.documentLabelText.trim()
        ? cfg.documentLabelText
        : "Documento de identidad",
    nameLabelText:
      typeof cfg.nameLabelText === "string" && cfg.nameLabelText.trim()
        ? cfg.nameLabelText
        : "Nombre",
    cityLabelText:
      typeof cfg.cityLabelText === "string" && cfg.cityLabelText.trim()
        ? cfg.cityLabelText
        : "Ciudad",
    addressLabelText:
      typeof cfg.addressLabelText === "string" && cfg.addressLabelText.trim()
        ? cfg.addressLabelText
        : "Dirección",
    neighborhoodLabelText:
      typeof cfg.neighborhoodLabelText === "string" &&
      cfg.neighborhoodLabelText.trim()
        ? cfg.neighborhoodLabelText
        : "Barrio",
    notesLabelText:
      typeof cfg.notesLabelText === "string" && cfg.notesLabelText.trim()
        ? cfg.notesLabelText
        : "Información adicional",
    billingToggleText:
      typeof cfg.billingToggleText === "string" && cfg.billingToggleText.trim()
        ? cfg.billingToggleText
        : "Mi información de facturación es diferente",
    newsletterText:
      typeof cfg.newsletterText === "string" && cfg.newsletterText.trim()
        ? cfg.newsletterText
        : "Enviarme novedades y ofertas por correo electrónico",
    policiesText:
      typeof cfg.policiesText === "string" && cfg.policiesText.trim()
        ? cfg.policiesText
        : "Tus datos están seguros y encriptados",
    subtotalLabelText:
      typeof cfg.subtotalLabelText === "string" && cfg.subtotalLabelText.trim()
        ? cfg.subtotalLabelText
        : "Subtotal",
    totalLabelText:
      typeof cfg.totalLabelText === "string" && cfg.totalLabelText.trim()
        ? cfg.totalLabelText
        : "Total",
    shippingMessageText:
      typeof cfg.shippingMessageText === "string" &&
      cfg.shippingMessageText.trim()
        ? cfg.shippingMessageText
        : "Impuestos y envío calculado al finalizar la compra",
    confirmButtonText:
      typeof cfg.confirmButtonText === "string" && cfg.confirmButtonText.trim()
        ? cfg.confirmButtonText
        : "Pagar ahora",
    paymentMethodsImage: catalogImageUrl(cfg.paymentMethodsImage),
    paymentMethodsImageAlt:
      typeof cfg.paymentMethodsImageAlt === "string" &&
      cfg.paymentMethodsImageAlt.trim()
        ? cfg.paymentMethodsImageAlt
        : "Métodos de pago",
    style: {
      ...object(cfg.style),
      shadowStyle: ["none", "soft", "medium", "strong"].includes(
        cfg.style?.shadowStyle,
      )
        ? cfg.style.shadowStyle
        : "soft",
      inputStyle: ["rounded", "pill", "square"].includes(cfg.style?.inputStyle)
        ? cfg.style.inputStyle
        : "rounded",
      confirmButtonStyle: ["rounded", "pill", "square"].includes(
        cfg.style?.confirmButtonStyle,
      )
        ? cfg.style.confirmButtonStyle
        : "rounded",
      labelTextColor:
        typeof cfg.style?.labelTextColor === "string"
          ? cfg.style.labelTextColor
          : "#875a68",
      inputPlaceholderColor:
        typeof cfg.style?.inputPlaceholderColor === "string"
          ? cfg.style.inputPlaceholderColor
          : "#99737f",
      lineColor:
        typeof cfg.style?.lineColor === "string"
          ? cfg.style.lineColor
          : "#d3a5b4",

      pageBg:
        typeof cfg?.style?.pageBg === "string" ? cfg.style.pageBg : "#f7e7e5",
      contentMaxWidthPx: clampInt(
        cfg?.style?.contentMaxWidthPx,
        900,
        1800,
        1280,
      ),
      contentTopPaddingPx: clampInt(
        cfg?.style?.contentTopPaddingPx,
        0,
        240,
        24,
      ),
      breadcrumbTextColor:
        typeof cfg?.style?.breadcrumbTextColor === "string"
          ? cfg.style.breadcrumbTextColor
          : "#9ca3af",
      breadcrumbLinkColor:
        typeof cfg?.style?.breadcrumbLinkColor === "string"
          ? cfg.style.breadcrumbLinkColor
          : "#db2777",
      titleTextColor:
        typeof cfg?.style?.titleTextColor === "string"
          ? cfg.style.titleTextColor
          : "#652d42",
      titleFontSizePx: clampInt(cfg?.style?.titleFontSizePx, 18, 72, 34),
      titleImageHeightPx: clampInt(cfg?.style?.titleImageHeightPx, 24, 220, 70),
      sectionCardBg:
        typeof cfg?.style?.sectionCardBg === "string"
          ? cfg.style.sectionCardBg
          : "#efb9b7",
      sectionCardBorderColor:
        typeof cfg?.style?.sectionCardBorderColor === "string"
          ? cfg.style.sectionCardBorderColor
          : "#fff4ed",
      sectionCardRadiusPx: clampInt(cfg?.style?.sectionCardRadiusPx, 0, 40, 24),
      sectionCardPaddingPx: clampInt(
        cfg?.style?.sectionCardPaddingPx,
        8,
        48,
        24,
      ),
      textPrimaryColor:
        typeof cfg?.style?.textPrimaryColor === "string"
          ? cfg.style.textPrimaryColor
          : "#652d42",
      textSecondaryColor:
        typeof cfg?.style?.textSecondaryColor === "string"
          ? cfg.style.textSecondaryColor
          : "#875a68",
      accentColor:
        typeof cfg?.style?.accentColor === "string"
          ? cfg.style.accentColor
          : "#b3315c",
      inputBg:
        typeof cfg?.style?.inputBg === "string" ? cfg.style.inputBg : "#efb9b7",
      inputBorderColor:
        typeof cfg?.style?.inputBorderColor === "string"
          ? cfg.style.inputBorderColor
          : "#e2e8f0",
      inputTextColor:
        typeof cfg?.style?.inputTextColor === "string"
          ? cfg.style.inputTextColor
          : "#652d42",
      inputRadiusPx: clampInt(cfg?.style?.inputRadiusPx, 0, 40, 10),
      inputHeightPx: clampInt(cfg?.style?.inputHeightPx, 36, 80, 46),
      summaryBg:
        typeof cfg?.style?.summaryBg === "string"
          ? cfg.style.summaryBg
          : "#efb9b7",
      summaryBorderColor:
        typeof cfg?.style?.summaryBorderColor === "string"
          ? cfg.style.summaryBorderColor
          : "#fff4ed",
      summaryRadiusPx: clampInt(cfg?.style?.summaryRadiusPx, 0, 40, 24),
      subtotalTextColor:
        typeof cfg?.style?.subtotalTextColor === "string"
          ? cfg.style.subtotalTextColor
          : "#374151",
      subtotalValueColor:
        typeof cfg?.style?.subtotalValueColor === "string"
          ? cfg.style.subtotalValueColor
          : "#374151",
      totalTextColor:
        typeof cfg?.style?.totalTextColor === "string"
          ? cfg.style.totalTextColor
          : "#652d42",
      totalValueColor:
        typeof cfg?.style?.totalValueColor === "string"
          ? cfg.style.totalValueColor
          : "#652d42",
      confirmButtonBg:
        typeof cfg?.style?.confirmButtonBg === "string"
          ? cfg.style.confirmButtonBg
          : "#b3315c",
      confirmButtonTextColor:
        typeof cfg?.style?.confirmButtonTextColor === "string"
          ? cfg.style.confirmButtonTextColor
          : "#efb9b7",
      confirmButtonRadiusPx: clampInt(
        cfg?.style?.confirmButtonRadiusPx,
        0,
        40,
        18,
      ),
      paymentMethodsImageHeightPx: clampInt(
        cfg?.style?.paymentMethodsImageHeightPx,
        24,
        140,
        96,
      ),
    },
  };
}
