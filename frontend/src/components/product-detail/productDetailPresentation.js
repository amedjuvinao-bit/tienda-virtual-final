const number = (value, min, max, fallback) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed)
    ? Math.max(min, Math.min(max, parsed))
    : fallback;
};
const text = (value, fallback = "") =>
  typeof value === "string" ? value : fallback;

export function buildProductDetailPresentation(raw) {
  const value = raw && typeof raw === "object" ? raw : {};
  return {
    mediaVersion: 1,
    backgroundMode: value.backgroundMode === "custom" ? "custom" : "continuity",
    backgroundImage: text(value.backgroundImage),
    mobileBackgroundImage: text(value.mobileBackgroundImage),
    maxWidth: number(value.maxWidth, 960, 1760, 1440),
    galleryPercent: number(value.galleryPercent, 40, 62, 54),
    glassOpacity: number(value.glassOpacity, 0, 0.8, 0.14),
    glassBlur: number(value.glassBlur, 0, 24, 4),
    reflection: number(value.reflection, 0, 1, 0.85),
    showDescription: value.showDescription !== false,
    showRatingSummary: value.showRatingSummary !== false,
    descriptionLabel: text(value.descriptionLabel, "Descripción"),
    deliveryLabel: text(value.deliveryLabel, "Entrega"),
    deliverySummary: text(
      value.deliverySummary,
      "Consulta las opciones de entrega al finalizar la compra.",
    ),
    reviewsLabel: text(value.reviewsLabel, "Reseñas"),
    catalogLabel: text(value.catalogLabel, "Catálogo"),
    catalogPath: /^\/(?!\/)/.test(value.catalogPath || "")
      ? value.catalogPath
      : "/#categorias",
    showRelated: value.showRelated !== false,
    relatedTitle: text(value.relatedTitle, "Productos relacionados"),
    relatedCount: Math.round(number(value.relatedCount, 2, 6, 5)),
    relatedMobileCount: Math.round(number(value.relatedMobileCount, 1, 2, 2)),
    relatedLimit: Math.round(number(value.relatedLimit, 6, 24, 12)),
  };
}

// Apply deliberately from the editor: content and purchase behavior are retained.
export function applyContinuousProductDetailPreset(config = {}) {
  return {
    ...config,
    presentation: buildProductDetailPresentation(config.presentation),
    thumbnailPosition: "overlay",
    imageFit: "contain",
    imageHoverZoom: false,
    mainImageMaxWidthPx: 1000,
    mainImageMaxHeightPx: 650,
    thumbWidthPx: 88,
    thumbHeightPx: 76,
    thumbGapPx: 8,
    thumbHoverEffect: "lift",
    favoriteIconName: "heart",
    favoriteIconColor: "#b3315c",
    favoriteActiveColor: "#b3315c",
    addToCartIconName: "shopping-bag",
    style: {
      ...config.style,
      pageBg: "#f6d9d1",
      cardBg: "#efb9b7",
      primaryTextColor: "#592837",
      secondaryTextColor: "#7a4956",
      accentColor: "#b3315c",
      accentColor2: "#98465f",
      borderColor: "#fff4ed",
      radiusPx: 32,
      borderWidthPx: 1.25,
      titleFontFamily: "editorial",
      priceFontFamily: "editorial",
      titleSizePx: 36,
      priceSizePx: 34,
      thumbBorderColor: "#fff1e8",
      selectedThumbBorderColor: "#b3315c",
      favoriteIconColor: "#b3315c",
      favoriteActiveColor: "#b3315c",
      favoriteButtonBg: "#efb9b7",
      favoriteButtonOpacity: 0.12,
      favoriteBorderColor: "#fff4ed",
      favoriteBorderWidthPx: 1,
      addToCartButtonBg: "#b3315c",
      addToCartButtonOpacity: 0.86,
      addToCartBorderColor: "#ffe1df",
      addToCartBorderWidthPx: 1,
      addToCartTextColor: "#fff6f0",
      addToCartIconColor: "#fff6f0",
      reviewSectionBg: "#efb9b7",
      reviewFormBg: "#efb9b7",
      reviewListBg: "#efb9b7",
      reviewTitleColor: "#592837",
      reviewTextColor: "#592837",
      reviewMutedColor: "#7a4956",
      reviewInputBg: "#fff4ed",
      reviewInputBorderColor: "#e9b5bb",
      reviewButtonBg: "#b3315c",
      reviewButtonTextColor: "#fff6f0",
      reviewStarActiveColor: "#b3315c",
      reviewStarInactiveColor: "#d0a2ab",
      reviewBgOpacity: 0.12,
      reviewBorderColor: "#f5cdd0",
    },
  };
}
