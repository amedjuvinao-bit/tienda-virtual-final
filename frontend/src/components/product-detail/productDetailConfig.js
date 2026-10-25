import { normalizeProductDetailFont } from "./productDetailTypography";
import {
  buildProductDetailPresentation,
  applyContinuousProductDetailPreset,
} from "./productDetailPresentation";

function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function clampFloat(value, min, max, fallback) {
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

export function buildSafeStyleConfig(raw) {
  const cfg = raw && typeof raw === "object" ? raw : {};
  return {
    pageBg: typeof cfg.pageBg === "string" ? cfg.pageBg : "#fff1f2",
    cardBg: typeof cfg.cardBg === "string" ? cfg.cardBg : "#ffffff",
    primaryTextColor:
      typeof cfg.primaryTextColor === "string"
        ? cfg.primaryTextColor
        : "#111827",
    secondaryTextColor:
      typeof cfg.secondaryTextColor === "string"
        ? cfg.secondaryTextColor
        : "#6b7280",
    accentColor:
      typeof cfg.accentColor === "string" ? cfg.accentColor : "#ec4899",
    accentColor2:
      typeof cfg.accentColor2 === "string" ? cfg.accentColor2 : "#d4af37",
    borderColor:
      typeof cfg.borderColor === "string" ? cfg.borderColor : "#e5e7eb",
    radiusPx: clampInt(cfg.radiusPx, 8, 40, 18),
    borderWidthPx: clampFloat(cfg.borderWidthPx, 0, 4, 1.25),
    shadowStyle:
      cfg.shadowStyle === "none" ||
      cfg.shadowStyle === "soft" ||
      cfg.shadowStyle === "medium" ||
      cfg.shadowStyle === "strong"
        ? cfg.shadowStyle
        : "soft",
    titleFontFamily: normalizeProductDetailFont(cfg.titleFontFamily),
    priceFontFamily: normalizeProductDetailFont(cfg.priceFontFamily),
    titleSizePx: clampInt(cfg.titleSizePx, 20, 52, 32),
    priceSizePx: clampInt(cfg.priceSizePx, 20, 48, 30),
    buttonRadiusPx: clampInt(cfg.buttonRadiusPx, 8, 40, 40),
    thumbRadiusPx: clampInt(cfg.thumbRadiusPx, 4, 24, 10),
    thumbBorderColor:
      typeof cfg.thumbBorderColor === "string"
        ? cfg.thumbBorderColor
        : "#d4af37",
    selectedThumbBorderColor:
      typeof cfg.selectedThumbBorderColor === "string"
        ? cfg.selectedThumbBorderColor
        : "#ec4899",

    favoriteButtonBg:
      typeof cfg.favoriteButtonBg === "string"
        ? cfg.favoriteButtonBg
        : "#ffffff",
    favoriteButtonOpacity: clampFloat(cfg.favoriteButtonOpacity, 0, 1, 1),
    favoriteBorderColor:
      typeof cfg.favoriteBorderColor === "string"
        ? cfg.favoriteBorderColor
        : "#e5e7eb",
    favoriteBorderWidthPx: clampInt(cfg.favoriteBorderWidthPx, 0, 4, 1),

    addToCartButtonBg:
      typeof cfg.addToCartButtonBg === "string"
        ? cfg.addToCartButtonBg
        : "#ec4899",
    addToCartButtonOpacity: clampFloat(cfg.addToCartButtonOpacity, 0, 1, 1),
    addToCartBorderColor:
      typeof cfg.addToCartBorderColor === "string"
        ? cfg.addToCartBorderColor
        : "#ec4899",
    addToCartBorderWidthPx: clampInt(cfg.addToCartBorderWidthPx, 0, 4, 0),
    addToCartTextColor:
      typeof cfg.addToCartTextColor === "string"
        ? cfg.addToCartTextColor
        : "#ffffff",
    addToCartIconColor:
      typeof cfg.addToCartIconColor === "string"
        ? cfg.addToCartIconColor
        : "#ffffff",

    reviewSectionBg:
      typeof cfg.reviewSectionBg === "string" ? cfg.reviewSectionBg : "#ffffff",
    reviewFormBg:
      typeof cfg.reviewFormBg === "string" ? cfg.reviewFormBg : "#ffffff",
    reviewListBg:
      typeof cfg.reviewListBg === "string" ? cfg.reviewListBg : "#ffffff",
    reviewTitleColor:
      typeof cfg.reviewTitleColor === "string"
        ? cfg.reviewTitleColor
        : "#111827",
    reviewTextColor:
      typeof cfg.reviewTextColor === "string" ? cfg.reviewTextColor : "#374151",
    reviewMutedColor:
      typeof cfg.reviewMutedColor === "string"
        ? cfg.reviewMutedColor
        : "#6b7280",
    reviewInputBg:
      typeof cfg.reviewInputBg === "string" ? cfg.reviewInputBg : "#ffffff",
    reviewInputBorderColor:
      typeof cfg.reviewInputBorderColor === "string"
        ? cfg.reviewInputBorderColor
        : "#e5e7eb",
    reviewButtonBg:
      typeof cfg.reviewButtonBg === "string" ? cfg.reviewButtonBg : "#ec4899",
    reviewButtonTextColor:
      typeof cfg.reviewButtonTextColor === "string"
        ? cfg.reviewButtonTextColor
        : "#ffffff",
    reviewStarActiveColor:
      typeof cfg.reviewStarActiveColor === "string"
        ? cfg.reviewStarActiveColor
        : "#d4af37",
    reviewStarInactiveColor:
      typeof cfg.reviewStarInactiveColor === "string"
        ? cfg.reviewStarInactiveColor
        : "#d1d5db",
    reviewSuccessBg:
      typeof cfg.reviewSuccessBg === "string" ? cfg.reviewSuccessBg : "#f0fdf4",
    reviewSuccessText:
      typeof cfg.reviewSuccessText === "string"
        ? cfg.reviewSuccessText
        : "#166534",
    reviewErrorBg:
      typeof cfg.reviewErrorBg === "string" ? cfg.reviewErrorBg : "#fff1f2",
    reviewErrorText:
      typeof cfg.reviewErrorText === "string" ? cfg.reviewErrorText : "#be123c",
    reviewSectionRadiusPx: clampInt(cfg.reviewSectionRadiusPx, 8, 40, 18),
    reviewInputRadiusPx: clampInt(cfg.reviewInputRadiusPx, 6, 30, 10),
    reviewTitleSizePx: clampInt(cfg.reviewTitleSizePx, 18, 40, 24),
    reviewBodySizePx: clampInt(cfg.reviewBodySizePx, 12, 22, 14),
    reviewFontFamily:
      typeof cfg.reviewFontFamily === "string" && cfg.reviewFontFamily.trim()
        ? cfg.reviewFontFamily
        : "inherit",
    reviewFontSize: clampInt(cfg.reviewFontSize, 12, 26, 14),
    reviewBorderRadius: clampInt(cfg.reviewBorderRadius, 0, 40, 18),
    reviewBorderColor:
      typeof cfg.reviewBorderColor === "string"
        ? cfg.reviewBorderColor
        : "#e5e7eb",
    reviewBgOpacity: clampFloat(cfg.reviewBgOpacity, 0, 1, 1),
    reviewFormBgImage:
      typeof cfg.reviewFormBgImage === "string" ? cfg.reviewFormBgImage : "",
    reviewFormBgImageOpacity: clampFloat(
      cfg.reviewFormBgImageOpacity,
      0,
      1,
      0.35,
    ),
  };
}

export function buildSafeProductDetailConfig(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  // Existing detail pages receive the chosen composition once. Subsequent edits
  // are normalized without reapplying its palette or resetting saved controls.
  const cfg = source.presentation
    ? { ...source }
    : applyContinuousProductDetailPreset(source);
  if (!source.presentation) {
    if (source.style?.borderWidthPx != null)
      cfg.style.borderWidthPx = source.style.borderWidthPx;
    for (const key of [
      "favoriteButtonOpacity",
      "addToCartButtonOpacity",
      "reviewBgOpacity",
      "addToCartBorderWidthPx",
      "reviewBorderRadius",
    ]) {
      if (source.style?.[key] === 0) cfg.style[key] = 0;
    }
  }

  // Adopt the uncropped gallery once, including existing continuous layouts.
  // A later explicit choice in the editor remains authoritative.
  if (source.presentation?.mediaVersion !== 1) {
    cfg.imageFit = "contain";
    cfg.imageHoverZoom = false;
  }
  const imageFit =
    cfg.imageFit === "contain" || cfg.imageFit === "cover"
      ? cfg.imageFit
      : "contain";

  const imageAnimation = [
    "none",
    "fade-up",
    "fade-right",
    "fade-left",
    "zoom-in",
  ].includes(cfg.imageAnimation)
    ? cfg.imageAnimation
    : "none";

  const contentAnimation = [
    "none",
    "fade-up",
    "fade-right",
    "fade-left",
    "zoom-in",
  ].includes(cfg.contentAnimation)
    ? cfg.contentAnimation
    : "none";

  const thumbHoverEffect = ["none", "scale", "lift", "glow"].includes(
    cfg.thumbHoverEffect,
  )
    ? cfg.thumbHoverEffect
    : "none";

  const thumbnailPosition =
    cfg.thumbnailPosition === "overlay" ||
    cfg.thumbnailPosition === "bottom" ||
    cfg.thumbnailPosition === "left"
      ? cfg.thumbnailPosition
      : "overlay";

  const reviewSectionAnimation = [
    "none",
    "fade-up",
    "fade-right",
    "fade-left",
    "zoom-in",
  ].includes(cfg.reviewSectionAnimation)
    ? cfg.reviewSectionAnimation
    : "none";

  const reviewStarType = ["star", "heart", "fire", "thumb"].includes(
    cfg.reviewStarType,
  )
    ? cfg.reviewStarType
    : "star";

  const reviewStarStyle = ["fill", "outline"].includes(cfg.reviewStarStyle)
    ? cfg.reviewStarStyle
    : "fill";

  return {
    presentation: buildProductDetailPresentation(cfg.presentation),
    titleMode:
      cfg.titleMode === "image" || cfg.titleMode === "text"
        ? cfg.titleMode
        : "text",
    titleImage: typeof cfg.titleImage === "string" ? cfg.titleImage : "",
    titleImageAlt:
      typeof cfg.titleImageAlt === "string" ? cfg.titleImageAlt : "",
    titleOverride:
      typeof cfg.titleOverride === "string" ? cfg.titleOverride : "",
    subtitle: typeof cfg.subtitle === "string" ? cfg.subtitle : "",
    showBreadcrumb: cfg.showBreadcrumb !== false,
    showHeader: cfg.showHeader !== false,
    showFooter: cfg.showFooter !== false,

    galleryPosition:
      cfg.galleryPosition === "right" || cfg.galleryPosition === "left"
        ? cfg.galleryPosition
        : "left",
    thumbnailPosition,
    showMainImage: cfg.showMainImage !== false,
    showThumbnails: cfg.showThumbnails !== false,
    showArrows: cfg.showArrows !== false,
    thumbCount: clampInt(cfg.thumbCount, 1, 10, 5),
    mainImageMaxWidthPx: clampInt(cfg.mainImageMaxWidthPx, 240, 1000, 380),
    mainImageMaxHeightPx: clampInt(cfg.mainImageMaxHeightPx, 260, 1200, 700),
    thumbWidthPx: clampInt(cfg.thumbWidthPx, 40, 180, 64),
    thumbHeightPx: clampInt(cfg.thumbHeightPx, 40, 180, 64),
    thumbGapPx: clampInt(cfg.thumbGapPx, 4, 40, 12),
    imageFit,
    imageAnimation,
    contentAnimation,
    thumbHoverEffect,
    imageHoverZoom: cfg.imageHoverZoom !== false,
    animationDurationMs: clampInt(cfg.animationDurationMs, 100, 3000, 350),

    showFavoriteButton: cfg.showFavoriteButton !== false,
    showPrice: cfg.showPrice !== false,
    showOriginalPrice: cfg.showOriginalPrice !== false,
    showSizes: cfg.showSizes !== false,
    showColors: cfg.showColors !== false,
    showQuantity: cfg.showQuantity !== false,
    showAddToCart: cfg.showAddToCart !== false,
    addToCartText:
      typeof cfg.addToCartText === "string" && cfg.addToCartText.trim()
        ? cfg.addToCartText
        : "Añadir al carrito",
    addToCartIconName:
      cfg.addToCartIconName === "shopping-bag" ||
      cfg.addToCartIconName === "bag-heart" ||
      cfg.addToCartIconName === "shopping-cart"
        ? cfg.addToCartIconName
        : "shopping-cart",
    favoriteIconName:
      cfg.favoriteIconName === "heart" ||
      cfg.favoriteIconName === "sparkles" ||
      cfg.favoriteIconName === "star"
        ? cfg.favoriteIconName
        : "star",
    favoriteIconColor:
      typeof cfg.favoriteIconColor === "string"
        ? cfg.favoriteIconColor
        : "#ec4899",
    favoriteActiveColor:
      typeof cfg.favoriteActiveColor === "string"
        ? cfg.favoriteActiveColor
        : "#d4af37",

    pickupTitle:
      typeof cfg.pickupTitle === "string" && cfg.pickupTitle.trim()
        ? cfg.pickupTitle
        : "✓ Recogida disponible en Tienda",
    pickupText:
      typeof cfg.pickupText === "string" && cfg.pickupText.trim()
        ? cfg.pickupText
        : "Normalmente está listo en 24 horas",
    pickupLinkText:
      typeof cfg.pickupLinkText === "string" && cfg.pickupLinkText.trim()
        ? cfg.pickupLinkText
        : "Ver información de la tienda",
    showPickupBlock: cfg.showPickupBlock !== false,

    showBenefits: cfg.showBenefits !== false,
    benefit1Title:
      typeof cfg.benefit1Title === "string" && cfg.benefit1Title.trim()
        ? cfg.benefit1Title
        : "Hecho con amor",
    benefit1Icon:
      typeof cfg.benefit1Icon === "string"
        ? cfg.benefit1Icon
        : "/icons/HechoConamor.png",
    benefit2Title:
      typeof cfg.benefit2Title === "string" && cfg.benefit2Title.trim()
        ? cfg.benefit2Title
        : "Materiales hipoalergénicos",
    benefit2Icon:
      typeof cfg.benefit2Icon === "string"
        ? cfg.benefit2Icon
        : "/icons/Hipoalergenico.png",
    benefit3Title:
      typeof cfg.benefit3Title === "string" && cfg.benefit3Title.trim()
        ? cfg.benefit3Title
        : "Envíos a toda Colombia",
    benefit3Icon:
      typeof cfg.benefit3Icon === "string"
        ? cfg.benefit3Icon
        : "/icons/Envios.png",

    showAccordionBlock: cfg.showAccordionBlock !== false,
    accordionTitle1:
      typeof cfg.accordionTitle1 === "string" && cfg.accordionTitle1.trim()
        ? cfg.accordionTitle1
        : "1. Conoce más información sobre nuestros envíos",
    accordionText1:
      typeof cfg.accordionText1 === "string" ? cfg.accordionText1 : "",
    accordionTitle2:
      typeof cfg.accordionTitle2 === "string" && cfg.accordionTitle2.trim()
        ? cfg.accordionTitle2
        : "2. Conoce más información sobre nuestras políticas de cambios y garantías",
    accordionText2:
      typeof cfg.accordionText2 === "string" ? cfg.accordionText2 : "",

    showReviewsSection: cfg.showReviewsSection !== false,
    showReviewForm: cfg.showReviewForm !== false,
    showReviewList: cfg.showReviewList !== false,
    showReviewStars: cfg.showReviewStars !== false,
    showReviewDate: cfg.showReviewDate !== false,
    reviewSectionAnimation,
    reviewSectionTitle:
      typeof cfg.reviewSectionTitle === "string" &&
      cfg.reviewSectionTitle.trim()
        ? cfg.reviewSectionTitle
        : "Reseñas y opiniones",
    reviewFormTitle:
      typeof cfg.reviewFormTitle === "string" && cfg.reviewFormTitle.trim()
        ? cfg.reviewFormTitle
        : "Escribe tu reseña",
    reviewListTitle:
      typeof cfg.reviewListTitle === "string" && cfg.reviewListTitle.trim()
        ? cfg.reviewListTitle
        : "Opiniones de clientes",
    reviewNameLabel:
      typeof cfg.reviewNameLabel === "string" && cfg.reviewNameLabel.trim()
        ? cfg.reviewNameLabel
        : "Nombre",
    reviewNamePlaceholder:
      typeof cfg.reviewNamePlaceholder === "string"
        ? cfg.reviewNamePlaceholder
        : "Escribe tu nombre",
    reviewRatingLabel:
      typeof cfg.reviewRatingLabel === "string" && cfg.reviewRatingLabel.trim()
        ? cfg.reviewRatingLabel
        : "Calificación",
    reviewCommentLabel:
      typeof cfg.reviewCommentLabel === "string" &&
      cfg.reviewCommentLabel.trim()
        ? cfg.reviewCommentLabel
        : "Comentario",
    reviewCommentPlaceholder:
      typeof cfg.reviewCommentPlaceholder === "string"
        ? cfg.reviewCommentPlaceholder
        : "Cuéntanos tu experiencia con este producto",
    reviewSubmitText:
      typeof cfg.reviewSubmitText === "string" && cfg.reviewSubmitText.trim()
        ? cfg.reviewSubmitText
        : "Publicar reseña",
    reviewEmptyText:
      typeof cfg.reviewEmptyText === "string" && cfg.reviewEmptyText.trim()
        ? cfg.reviewEmptyText
        : "Este producto aún no tiene reseñas.",
    reviewStarType,
    reviewStarStyle,
    reviewStarSizePx: clampInt(cfg.reviewStarSizePx, 12, 48, 20),

    style: buildSafeStyleConfig(cfg.style),
  };
}
