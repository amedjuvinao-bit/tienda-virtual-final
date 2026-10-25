function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
}
const number = (value, min, max, fallback) =>
  Number.isFinite(Number.parseFloat(value))
    ? Math.max(min, Math.min(max, Number.parseFloat(value)))
    : fallback;
const text = (value, fallback) =>
  typeof value === "string" && value.trim() ? value : fallback;
export const safePath = (value, fallback) =>
  typeof value === "string" &&
  /^\/(?!\/)/.test(value) &&
  !/[\\\r\n]/.test(value)
    ? value
    : fallback;
export function buildCartPresentation(raw = {}) {
  const value = raw || {};
  return {
    ...value,
    backgroundMode: value.backgroundMode === "custom" ? "custom" : "continuity",
    backgroundImage:
      typeof value.backgroundImage === "string" ? value.backgroundImage : "",
    mobileBackgroundImage:
      typeof value.mobileBackgroundImage === "string"
        ? value.mobileBackgroundImage
        : "",
    glassOpacity: number(value.glassOpacity, 0, 0.8, 0.14),
    glassBlur: number(value.glassBlur, 0, 24, 4),
    borderWidth: number(value.borderWidth, 0, 4, 1.25),
    reflection: number(value.reflection, 0, 1, 0.85),
  };
}
export function buildSafeCartPageConfig(raw) {
  const cfg = raw && typeof raw === "object" ? raw : {};
  return {
    ...cfg,
    presentation: buildCartPresentation(cfg.presentation),
    variantLabelText: text(cfg.variantLabelText, "Variante"),
    generalVariantText: text(cfg.generalVariantText, "Presentación general"),
    summaryTitle: text(cfg.summaryTitle, "Resumen del pedido"),
    countSingularText: text(cfg.countSingularText, "producto"),
    countLabelText: text(cfg.countLabelText, "productos"),
    viewCartText: text(cfg.viewCartText, "Ver carrito"),
    sidebarTitleText: text(cfg.sidebarTitleText, cfg.titleText || "Carrito"),
    continueShoppingPath: safePath(cfg.continueShoppingPath, "/#categorias"),
    titleMode:
      cfg.titleMode === "text" || cfg.titleMode === "image"
        ? cfg.titleMode
        : "image",
    titleText:
      typeof cfg.titleText === "string" && cfg.titleText.trim()
        ? cfg.titleText
        : "Tu carrito",
    titleImage: typeof cfg.titleImage === "string" ? cfg.titleImage : "",
    titleImageAlt:
      typeof cfg.titleImageAlt === "string" && cfg.titleImageAlt.trim()
        ? cfg.titleImageAlt
        : "Título carrito",

    showHeader: cfg.showHeader !== false,
    showFooter: cfg.showFooter !== false,
    showWhatsAppButton: cfg.showWhatsAppButton !== false,
    showBreadcrumb: cfg.showBreadcrumb !== false,
    showTableHeader: cfg.showTableHeader !== false,
    showRemoveButton: cfg.showRemoveButton !== false,
    showQuantityControls: cfg.showQuantityControls !== false,
    showSubtotal: cfg.showSubtotal !== false,
    showShippingMessage: cfg.showShippingMessage !== false,
    showCheckoutButton: cfg.showCheckoutButton !== false,
    showEmptyState: cfg.showEmptyState !== false,

    breadcrumbHomeText:
      typeof cfg.breadcrumbHomeText === "string" &&
      cfg.breadcrumbHomeText.trim()
        ? cfg.breadcrumbHomeText
        : "Inicio",
    breadcrumbCurrentText:
      typeof cfg.breadcrumbCurrentText === "string" &&
      cfg.breadcrumbCurrentText.trim()
        ? cfg.breadcrumbCurrentText
        : "Tu carrito",
    tableProductText:
      typeof cfg.tableProductText === "string" && cfg.tableProductText.trim()
        ? cfg.tableProductText
        : "Producto",
    tablePriceText:
      typeof cfg.tablePriceText === "string" && cfg.tablePriceText.trim()
        ? cfg.tablePriceText
        : "Precio",
    tableQuantityText:
      typeof cfg.tableQuantityText === "string" && cfg.tableQuantityText.trim()
        ? cfg.tableQuantityText
        : "Cantidad",
    tableTotalText:
      typeof cfg.tableTotalText === "string" && cfg.tableTotalText.trim()
        ? cfg.tableTotalText
        : "Total",
    removeButtonText:
      typeof cfg.removeButtonText === "string" && cfg.removeButtonText.trim()
        ? cfg.removeButtonText
        : "Eliminar",
    colorLabelText:
      typeof cfg.colorLabelText === "string" && cfg.colorLabelText.trim()
        ? cfg.colorLabelText
        : "Color:",
    sizeLabelText:
      typeof cfg.sizeLabelText === "string" && cfg.sizeLabelText.trim()
        ? cfg.sizeLabelText
        : "Talla:",
    subtotalLabelText:
      typeof cfg.subtotalLabelText === "string" && cfg.subtotalLabelText.trim()
        ? cfg.subtotalLabelText
        : "Subtotal:",
    shippingMessageText:
      typeof cfg.shippingMessageText === "string" &&
      cfg.shippingMessageText.trim()
        ? cfg.shippingMessageText
        : "Impuestos y envío calculado al finalizar la compra",
    checkoutButtonText:
      typeof cfg.checkoutButtonText === "string" &&
      cfg.checkoutButtonText.trim()
        ? cfg.checkoutButtonText
        : "Finalizar compra",
    emptyStateTitle:
      typeof cfg.emptyStateTitle === "string" && cfg.emptyStateTitle.trim()
        ? cfg.emptyStateTitle
        : "Tu carrito está vacío",
    emptyStateText:
      typeof cfg.emptyStateText === "string" && cfg.emptyStateText.trim()
        ? cfg.emptyStateText
        : "Aún no has agregado productos a tu carrito.",
    continueShoppingText:
      typeof cfg.continueShoppingText === "string" &&
      cfg.continueShoppingText.trim()
        ? cfg.continueShoppingText
        : "Seguir comprando",

    modal: {
      ...cfg.modal,
      backdropColor:
        typeof cfg?.modal?.backdropColor === "string"
          ? cfg.modal.backdropColor
          : "#000000",
      backdropOpacity: clampInt(cfg?.modal?.backdropOpacity, 0, 100, 0),
      panelBg:
        typeof cfg?.modal?.panelBg === "string" ? cfg.modal.panelBg : "#efb9b7",
      panelOpacity: clampInt(cfg?.modal?.panelOpacity, 0, 100, 100),
      textColor:
        typeof cfg?.modal?.textColor === "string"
          ? cfg.modal.textColor
          : "#b3315c",
      widthPx: clampInt(cfg?.modal?.widthPx, 280, 600, 400),
      checkoutBg:
        typeof cfg?.modal?.checkoutBg === "string"
          ? cfg.modal.checkoutBg
          : "#b3315c",
      checkoutText:
        typeof cfg?.modal?.checkoutText === "string"
          ? cfg.modal.checkoutText
          : "#ffffff",
      linkColor:
        typeof cfg?.modal?.linkColor === "string"
          ? cfg.modal.linkColor
          : "#b3315c",
      closeIconColor:
        typeof cfg?.modal?.closeIconColor === "string"
          ? cfg.modal.closeIconColor
          : "#b3315c",
      emptyTextColor:
        typeof cfg?.modal?.emptyTextColor === "string"
          ? cfg.modal.emptyTextColor
          : "#b3315c",
      subtotalLabelColor:
        typeof cfg?.modal?.subtotalLabelColor === "string"
          ? cfg.modal.subtotalLabelColor
          : "#b3315c",
      subtotalValueColor:
        typeof cfg?.modal?.subtotalValueColor === "string"
          ? cfg.modal.subtotalValueColor
          : "#b3315c",
      quantityButtonBg:
        typeof cfg?.modal?.quantityButtonBg === "string"
          ? cfg.modal.quantityButtonBg
          : "#fcdbe5",
      quantityButtonTextColor:
        typeof cfg?.modal?.quantityButtonTextColor === "string"
          ? cfg.modal.quantityButtonTextColor
          : "#b3315c",
      removeLinkColor:
        typeof cfg?.modal?.removeLinkColor === "string"
          ? cfg.modal.removeLinkColor
          : "#b3315c",
      titleImageWidthPx: clampInt(cfg?.modal?.titleImageWidthPx, 80, 260, 160),
      titleImageHeightPx: clampInt(cfg?.modal?.titleImageHeightPx, 40, 180, 80),
      productImageWidthPx: clampInt(
        cfg?.modal?.productImageWidthPx,
        40,
        180,
        80,
      ),
      productImageHeightPx: clampInt(
        cfg?.modal?.productImageHeightPx,
        60,
        220,
        112,
      ),
      panelPaddingPx: clampInt(cfg?.modal?.panelPaddingPx, 8, 40, 16),
      footerPaddingPx: clampInt(cfg?.modal?.footerPaddingPx, 8, 40, 16),
      itemRadiusPx: clampInt(cfg?.modal?.itemRadiusPx, 0, 30, 8),
      buttonRadiusPx: clampInt(cfg?.modal?.buttonRadiusPx, 0, 40, 8),
      panelRadiusPx: clampInt(cfg?.modal?.panelRadiusPx, 0, 40, 0),
      shadowStyle:
        cfg?.modal?.shadowStyle === "none" ||
        cfg?.modal?.shadowStyle === "soft" ||
        cfg?.modal?.shadowStyle === "medium" ||
        cfg?.modal?.shadowStyle === "strong"
          ? cfg.modal.shadowStyle
          : "medium",
    },

    style: {
      ...cfg.style,
      pageBg:
        typeof cfg?.style?.pageBg === "string" ? cfg.style.pageBg : "#f6d9d1",
      contentMaxWidthPx: clampInt(
        cfg?.style?.contentMaxWidthPx,
        900,
        1800,
        1152,
      ),
      contentTopPaddingPx: clampInt(
        cfg?.style?.contentTopPaddingPx,
        0,
        240,
        28,
      ),

      breadcrumbTextColor:
        typeof cfg?.style?.breadcrumbTextColor === "string"
          ? cfg.style.breadcrumbTextColor
          : "#b3315c",
      breadcrumbLinkColor:
        typeof cfg?.style?.breadcrumbLinkColor === "string"
          ? cfg.style.breadcrumbLinkColor
          : "#b3315c",

      titleTextColor:
        typeof cfg?.style?.titleTextColor === "string"
          ? cfg.style.titleTextColor
          : "#592837",
      titleFontSizePx: clampInt(cfg?.style?.titleFontSizePx, 18, 72, 34),
      titleImageHeightPx: clampInt(cfg?.style?.titleImageHeightPx, 24, 220, 80),

      cardBg:
        typeof cfg?.style?.cardBg === "string" ? cfg.style.cardBg : "#efb9b7",
      cardBorderColor:
        typeof cfg?.style?.cardBorderColor === "string"
          ? cfg.style.cardBorderColor
          : "#fff4ed",
      cardRadiusPx: clampInt(cfg?.style?.cardRadiusPx, 0, 40, 16),
      cardPaddingPx: clampInt(cfg?.style?.cardPaddingPx, 8, 48, 24),

      shadowStyle:
        cfg?.style?.shadowStyle === "none" ||
        cfg?.style?.shadowStyle === "soft" ||
        cfg?.style?.shadowStyle === "medium" ||
        cfg?.style?.shadowStyle === "strong"
          ? cfg.style.shadowStyle
          : "soft",

      textPrimaryColor:
        typeof cfg?.style?.textPrimaryColor === "string"
          ? cfg.style.textPrimaryColor
          : "#592837",
      textSecondaryColor:
        typeof cfg?.style?.textSecondaryColor === "string"
          ? cfg.style.textSecondaryColor
          : "#7a4956",
      accentColor:
        typeof cfg?.style?.accentColor === "string"
          ? cfg.style.accentColor
          : "#b3315c",
      goldColor:
        typeof cfg?.style?.goldColor === "string"
          ? cfg.style.goldColor
          : "#b3315c",

      tableHeaderTextColor:
        typeof cfg?.style?.tableHeaderTextColor === "string"
          ? cfg.style.tableHeaderTextColor
          : "#b3315c",
      tableLineColor:
        typeof cfg?.style?.tableLineColor === "string"
          ? cfg.style.tableLineColor
          : "#b3315c",

      quantityBorderColor:
        typeof cfg?.style?.quantityBorderColor === "string"
          ? cfg.style.quantityBorderColor
          : "#b3315c",
      quantityTextColor:
        typeof cfg?.style?.quantityTextColor === "string"
          ? cfg.style.quantityTextColor
          : "#b3315c",
      quantityRadiusPx: clampInt(cfg?.style?.quantityRadiusPx, 0, 30, 8),

      checkoutButtonBg:
        typeof cfg?.style?.checkoutButtonBg === "string"
          ? cfg.style.checkoutButtonBg
          : "#b3315c",
      checkoutButtonTextColor:
        typeof cfg?.style?.checkoutButtonTextColor === "string"
          ? cfg.style.checkoutButtonTextColor
          : "#ffffff",
      checkoutButtonRadiusPx: clampInt(
        cfg?.style?.checkoutButtonRadiusPx,
        0,
        40,
        999,
      ),
      checkoutButtonStyle:
        cfg?.style?.checkoutButtonStyle === "pill" ||
        cfg?.style?.checkoutButtonStyle === "rounded" ||
        cfg?.style?.checkoutButtonStyle === "square"
          ? cfg.style.checkoutButtonStyle
          : "pill",

      subtotalTextColor:
        typeof cfg?.style?.subtotalTextColor === "string"
          ? cfg.style.subtotalTextColor
          : "#592837",
      subtotalValueColor:
        typeof cfg?.style?.subtotalValueColor === "string"
          ? cfg.style.subtotalValueColor
          : "#b3315c",

      imageRadiusPx: clampInt(cfg?.style?.imageRadiusPx, 0, 30, 12),
      imageWidthPx: clampInt(cfg?.style?.imageWidthPx, 40, 220, 80),
      imageHeightPx: clampInt(cfg?.style?.imageHeightPx, 40, 220, 80),
    },
  };
}
