import React, {
  useMemo,
  useState,
  useEffect,
  useId,
  useRef,
  useLayoutEffect,
} from "react";
import Header from "../Header";
import { Link } from "react-router-dom";
import { normalizeToCss } from "../catalog/catalogColors";
import { getColorDisplayName } from "../../utils/colorDisplay";
import PolishedGlassRim from "../PolishedGlassRim";
import ProductDetailGallery from "./ProductDetailGallery";
import ProductDetailInformation from "./ProductDetailInformation";
import ProductDetailRelatedProducts from "./ProductDetailRelatedProducts";
import useProductDetailBackdrop from "./useProductDetailBackdrop";
import "./productDetailContinuous.css";
import "../catalog/catalogFooterGlass.css";
import "./productDetail.css";
import { buildSafeProductDetailConfig } from "./productDetailConfig";
import FooterSection from "../FooterSection";
import WhatsAppButton from "../WhatsAppButton";
import {
  Star,
  ShoppingCart,
  ShoppingBag,
  Sparkles,
  Heart,
  Leaf,
  Truck,
  Flame,
  ThumbsUp,
  Package,
  Download,
  CalendarDays,
  Boxes,
} from "lucide-react";

/* Shared rendering helpers. */
function moneyCOP(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "$0";
  return `$${Math.round(n).toLocaleString("es-CO")}`;
}

function normalizeColorValue(color) {
  if (typeof color === "string") return color;
  if (typeof color?.name === "string") return color.name;
  if (typeof color?.label === "string") return color.label;
  if (typeof color?.value === "string") return color.value;
  if (typeof color?.hex === "string") return color.hex;
  return "";
}

function normalizeAttributeKey(value) {
  return String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isHexColor(value) {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(String(value || "").trim());
}

function hexToRgba(hex, alpha = 1) {
  const value = String(hex || "").trim();
  if (!isHexColor(value)) return value;
  let normalized = value.replace("#", "");
  if (normalized.length === 3)
    normalized = normalized
      .split("")
      .map((c) => c + c)
      .join("");
  const int = Number.parseInt(normalized, 16);
  const r = (int >> 16) & 255,
    g = (int >> 8) & 255,
    b = int & 255;
  const safeAlpha = Number.isFinite(Number(alpha))
    ? Math.max(0, Math.min(1, Number(alpha)))
    : 1;
  return `rgba(${r}, ${g}, ${b}, ${safeAlpha})`;
}

function getAnimationStyle(type, durationMs) {
  const safeDuration = Number.isFinite(Number(durationMs))
    ? Number(durationMs)
    : 350;
  switch (type) {
    case "fade-up":
      return { animation: `pdFadeUp ${safeDuration}ms ease both` };
    case "fade-right":
      return { animation: `pdFadeRight ${safeDuration}ms ease both` };
    case "fade-left":
      return { animation: `pdFadeLeft ${safeDuration}ms ease both` };
    case "zoom-in":
      return { animation: `pdZoomIn ${safeDuration}ms ease both` };
    default:
      return { animation: "none" };
  }
}

function getFavoriteIconComponent(iconName) {
  if (iconName === "heart") return Heart;
  if (iconName === "sparkles") return Sparkles;
  return Star;
}

function getCartIconComponent(iconName) {
  if (iconName === "shopping-bag") return ShoppingBag;
  if (iconName === "bag-heart") return ShoppingBag;
  return ShoppingCart;
}

function ReviewRatingIcon({
  type = "star",
  iconStyle = "fill",
  active = false,
  activeColor = "#d4af37",
  inactiveColor = "#d1d5db",
  size = 20,
}) {
  const IconComponent =
    type === "heart"
      ? Heart
      : type === "fire"
        ? Flame
        : type === "thumb"
          ? ThumbsUp
          : Star;

  const currentColor = active ? activeColor : inactiveColor;
  const shouldFill = iconStyle === "fill" && active;

  return (
    <IconComponent
      className="transition"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        color: currentColor,
        fill: shouldFill ? currentColor : "transparent",
        strokeWidth: iconStyle === "outline" ? 2 : 1.9,
      }}
    />
  );
}

function BenefitIcon({ source, fallback }) {
  const [failed, setFailed] = useState("");
  return source && source !== failed ? (
    <img
      src={source}
      alt=""
      style={{ width: 24, height: 24, objectFit: "contain" }}
      onError={() => setFailed(source)}
    />
  ) : (
    fallback
  );
}

/* ─── Estilos globales de diseño (layout + micro-interacciones) ─── */

/* ─── Componente principal ─── */
export default function ProductDetailView({
  product,
  config,
  withChrome = true,
  preview = false,
  isFavorite,
  onToggleFavorite,
  onAddToCart,
  selectedSize,
  setSelectedSize,
  selectedColor,
  setSelectedColor,
  variantAxes = [],
  selectedAttributes = {},
  onVariantAttributeChange,
  isVariantOptionAvailable = () => true,
  purchaseUnavailable = false,
  inventoryTracked = false,
  selectedAvailableStock = null,
  quantity,
  setQuantity,
  reviewName,
  setReviewName,
  reviewComment,
  setReviewComment,
  reviewRating,
  setReviewRating,
  reviewLoading,
  reviewError,
  reviewSuccess,
  onSubmitReview,
}) {
  const cfg = useMemo(() => buildSafeProductDetailConfig(config), [config]);
  const presentation = cfg.presentation;
  const {
    image: backdropImage,
    color: backdropColor,
    settings,
  } = useProductDetailBackdrop(presentation, cfg.style.pageBg);
  const [informationTab, setInformationTab] = useState("description");
  const informationRef = useRef(null),
    surfaceRef = useRef(null);
  useLayoutEffect(() => {
    const surface = surfaceRef.current;
    const header = surface?.querySelector(".theme-header");
    if (!surface || !header) return;
    const update = () => {
      const offset = Number.parseFloat(getComputedStyle(header).top) || 0;
      surface.style.setProperty(
        "--storefront-header-height",
        `${header.offsetHeight + offset}px`,
      );
    };
    update();
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(header);
    return () => observer?.disconnect();
  }, [settings, withChrome, cfg.showHeader]);
  const [cartPulse, setCartPulse] = useState(0),
    [favoritePulse, setFavoritePulse] = useState(0);
  useEffect(() => {
    setInformationTab("description");
    setCartPulse(0);
    setFavoritePulse(0);
  }, [product?._id]);
  const reviewId = useId();
  const cannotPurchase =
    purchaseUnavailable || (inventoryTracked && selectedAvailableStock <= 0);

  /* Product images retain the current variant and selected gallery frame. */
  const images = useMemo(() => {
    const list = [];
    if (typeof product?.image === "string" && product.image.trim()) {
      list.push(product.image.trim());
    }
    if (Array.isArray(product?.images)) {
      product.images.forEach((img) => {
        if (typeof img === "string" && img.trim()) list.push(img.trim());
      });
    }
    if (product?.images?.cover && typeof product.images.cover === "string") {
      list.push(product.images.cover.trim());
    }
    if (Array.isArray(product?.images?.gallery)) {
      product.images.gallery.forEach((img) => {
        if (typeof img === "string" && img.trim()) list.push(img.trim());
      });
    }
    const clean = [];
    const seen = new Set();
    for (const img of list) {
      const key = img.trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      clean.push(key);
    }
    return clean;
  }, [product]);

  const [mainImage, setMainImage] = useState(images[0] || "");
  const [failedTitleImage, setFailedTitleImage] = useState("");

  useEffect(() => {
    setMainImage((current) =>
      images.includes(current) ? current : images[0] || "",
    );
  }, [images]);
  useEffect(() => {
    setMainImage(images[0] || "");
  }, [product?._id, product?.selectedVariantKey]);

  const displayedMainImage =
    mainImage && images.includes(mainImage)
      ? mainImage
      : images[0] || product?.image || "";

  const safeColors = Array.isArray(product?.colors) ? product.colors : [];
  const safeSizes = Array.isArray(product?.sizes) ? product.sizes : [];
  const safeVariantAxes = (Array.isArray(variantAxes) ? variantAxes : [])
    .map((axis) => ({
      key: normalizeAttributeKey(axis?.key || axis?.label),
      label: String(axis?.label || axis?.key || "").trim(),
      values: Array.isArray(axis?.values)
        ? [
            ...new Set(
              axis.values
                .map((value) => String(value || "").trim())
                .filter(Boolean),
            ),
          ]
        : [],
    }))
    .filter((axis) => axis.key && axis.label && axis.values.length)
    .slice(0, 4);
  const hasVariantAxes =
    safeVariantAxes.length > 0 &&
    typeof onVariantAttributeChange === "function";
  const safeReviews = Array.isArray(product?.reviews) ? product.reviews : [];
  const validReviews = safeReviews.filter(
    (review) =>
      Number.isFinite(Number(review.rating)) &&
      Number(review.rating) >= 1 &&
      Number(review.rating) <= 5,
  );
  const averageRating = validReviews.length
    ? validReviews.reduce((sum, review) => sum + Number(review.rating), 0) /
      validReviews.length
    : 0;
  const publicCommercialFields = Array.isArray(product?.commercialFields)
    ? product.commercialFields.filter(
        (field) => field?.public !== false && String(field?.label || "").trim(),
      )
    : [];

  const styleCfg = cfg?.style || {};
  const visibleTitle =
    cfg.titleOverride?.trim() || product?.title || "Producto";
  const visiblePrice = product?.price ?? 0;
  const visibleOriginalPrice =
    cfg.showOriginalPrice !== false &&
    product?.originalPrice != null &&
    Number(product.originalPrice) > Number(product.price)
      ? Number(product.originalPrice)
      : null;

  const pageBg = styleCfg.pageBg || "#fffafb";
  const cardBg = styleCfg.cardBg || "#ffffff";
  const textPrimary = styleCfg.primaryTextColor || "#1f172a";
  const textSecondary = styleCfg.secondaryTextColor || "#6b7280";
  const accent1 = styleCfg.accentColor || "#ec4899";
  const accent2 = styleCfg.accentColor2 || "#d4af37";
  const borderColor = styleCfg.borderColor || "#f2d7e6";
  const borderWidthPx = Number.isFinite(Number(styleCfg.borderWidthPx))
    ? Number(styleCfg.borderWidthPx)
    : 1.5;
  const radius = Number(styleCfg.radiusPx) > 0 ? Number(styleCfg.radiusPx) : 18;
  const buttonRadius =
    Number(styleCfg.buttonRadiusPx) > 0 ? Number(styleCfg.buttonRadiusPx) : 14;
  const titleSizePx =
    Number(styleCfg.titleSizePx) > 0 ? Number(styleCfg.titleSizePx) : 32;
  const priceSizePx =
    Number(styleCfg.priceSizePx) > 0 ? Number(styleCfg.priceSizePx) : 30;
  const shadowStyle = styleCfg.shadowStyle || "soft";
  const favoriteButtonBgRaw =
    typeof styleCfg.favoriteButtonBg === "string"
      ? styleCfg.favoriteButtonBg
      : "#ffffff";
  const favoriteButtonOpacity = Number.isFinite(
    Number(styleCfg.favoriteButtonOpacity),
  )
    ? Math.max(0, Math.min(1, Number(styleCfg.favoriteButtonOpacity)))
    : 1;
  const favoriteButtonBg = isHexColor(favoriteButtonBgRaw)
    ? hexToRgba(favoriteButtonBgRaw, favoriteButtonOpacity)
    : favoriteButtonBgRaw;
  const favoriteBorderColor = styleCfg.favoriteBorderColor || borderColor;
  const favoriteBorderWidthPx =
    Number(styleCfg.favoriteBorderWidthPx) >= 0
      ? Number(styleCfg.favoriteBorderWidthPx)
      : 1;
  const favoriteIconName =
    typeof cfg.favoriteIconName === "string" ? cfg.favoriteIconName : "star";
  const FavoriteIcon = getFavoriteIconComponent(favoriteIconName);

  const addToCartIconName =
    typeof cfg.addToCartIconName === "string"
      ? cfg.addToCartIconName
      : "shopping-cart";

  const AddToCartIcon = getCartIconComponent(addToCartIconName);

  const addToCartButtonBgRaw =
    typeof styleCfg.addToCartButtonBg === "string"
      ? styleCfg.addToCartButtonBg
      : "#ec4899";
  const addToCartButtonOpacity = Number.isFinite(
    Number(styleCfg.addToCartButtonOpacity),
  )
    ? Math.max(0, Math.min(1, Number(styleCfg.addToCartButtonOpacity)))
    : 1;
  const addToCartButtonBg = isHexColor(addToCartButtonBgRaw)
    ? hexToRgba(addToCartButtonBgRaw, addToCartButtonOpacity)
    : addToCartButtonBgRaw;
  const addToCartBorderColor = styleCfg.addToCartBorderColor || accent1;
  const addToCartBorderWidthPx =
    Number(styleCfg.addToCartBorderWidthPx) >= 0
      ? Number(styleCfg.addToCartBorderWidthPx)
      : 0;
  const addToCartTextColor = styleCfg.addToCartTextColor || "#ffffff";
  const addToCartIconColor = styleCfg.addToCartIconColor || "#ffffff";

  const showBreadcrumb = cfg.showBreadcrumb !== false;
  const showImage = cfg.showMainImage !== false;
  const showPrice = cfg.showPrice !== false;
  const showFavorite = cfg.showFavoriteButton !== false;
  const showSizes = cfg.showSizes !== false;
  const showColors = cfg.showColors !== false;
  const showQuantity = cfg.showQuantity !== false;
  const showAddToCart = cfg.showAddToCart !== false;
  const showPickup =
    cfg.showPickupBlock !== false && product?.requiresShipping !== false;
  const showBenefits = cfg.showBenefits !== false;
  const showAccordionBlock = cfg.showAccordionBlock !== false;

  const galleryPosition = cfg.galleryPosition;
  const imageAnimation = cfg.imageAnimation || "none";
  const contentAnimation = cfg.contentAnimation || "none";
  const animationDurationMs =
    Number(cfg.animationDurationMs) > 0 ? Number(cfg.animationDurationMs) : 350;

  const pickupTitle = cfg.pickupTitle || "✓ Recogida disponible en Tienda";
  const pickupText = cfg.pickupText || "Normalmente está listo en 24 horas";
  const pickupLinkText = cfg.pickupLinkText || "Ver información de la tienda";
  const fulfillment = product?.fulfillment || null;
  const fulfillmentKind = fulfillment?.kind || "";
  const digitalFulfillment = fulfillment?.digital || null;
  const serviceFulfillment = fulfillment?.service || null;
  const bundleFulfillment = fulfillment?.bundle || null;

  const accordionTitle1 =
    cfg.accordionTitle1 || "1. Conoce más información sobre nuestros envíos";
  const accordionText1 = cfg.accordionText1 || "";
  const accordionTitle2 =
    cfg.accordionTitle2 ||
    "2. Conoce más información sobre nuestras políticas de cambios y garantías";
  const accordionText2 = cfg.accordionText2 || "";

  const benefitItems = [
    {
      icon: <Heart className="w-5 h-5" />,
      image: cfg.benefit1Icon,
      title: cfg.benefit1Title || "Hecho con amor",
    },
    {
      icon: <Leaf className="w-5 h-5" />,
      image: cfg.benefit2Icon,
      title: cfg.benefit2Title || "Materiales hipoalergénicos",
    },
    {
      icon: <Truck className="w-5 h-5" />,
      image: cfg.benefit3Icon,
      title: cfg.benefit3Title || "Envíos a toda Colombia",
    },
  ];

  const showReviewsSection = cfg.showReviewsSection !== false;
  const showReviewForm = cfg.showReviewForm !== false;
  const showReviewList = cfg.showReviewList !== false;
  const showReviewStars = cfg.showReviewStars !== false;
  const showReviewDate = cfg.showReviewDate !== false;
  const reviewSectionAnimation = cfg.reviewSectionAnimation || "none";
  const reviewSectionTitle = cfg.reviewSectionTitle || "Reseñas y opiniones";
  const reviewFormTitle = cfg.reviewFormTitle || "Escribe tu reseña";
  const reviewListTitle = cfg.reviewListTitle || "Opiniones de clientes";
  const reviewNameLabel = cfg.reviewNameLabel || "Nombre";
  const reviewNamePlaceholder =
    cfg.reviewNamePlaceholder || "Escribe tu nombre";
  const reviewRatingLabel = cfg.reviewRatingLabel || "Calificación";
  const reviewCommentLabel = cfg.reviewCommentLabel || "Comentario";
  const reviewCommentPlaceholder =
    cfg.reviewCommentPlaceholder ||
    "Cuéntanos tu experiencia con este producto";
  const reviewSubmitText = cfg.reviewSubmitText || "Publicar reseña";
  const reviewEmptyText =
    cfg.reviewEmptyText || "Este producto aún no tiene reseñas.";

  const reviewSectionBg = styleCfg.reviewSectionBg || "#ffffff";
  const reviewFormBg = styleCfg.reviewFormBg || "#ffffff";
  const reviewListBg = styleCfg.reviewListBg || "#ffffff";
  const reviewTitleColor = styleCfg.reviewTitleColor || textPrimary;
  const reviewTextColor = styleCfg.reviewTextColor || "#374151";
  const reviewMutedColor = styleCfg.reviewMutedColor || textSecondary;
  const reviewInputBg = styleCfg.reviewInputBg || "#ffffff";
  const reviewInputBorderColor = styleCfg.reviewInputBorderColor || borderColor;
  const reviewButtonBg = styleCfg.reviewButtonBg || accent1;
  const reviewButtonTextColor = styleCfg.reviewButtonTextColor || "#ffffff";
  const reviewStarActiveColor = styleCfg.reviewStarActiveColor || accent2;
  const reviewStarInactiveColor = styleCfg.reviewStarInactiveColor || "#d1d5db";
  const reviewSuccessBg = styleCfg.reviewSuccessBg || "#f0fdf4";
  const reviewSuccessText = styleCfg.reviewSuccessText || "#166534";
  const reviewErrorBg = styleCfg.reviewErrorBg || "#fff1f2";
  const reviewErrorText = styleCfg.reviewErrorText || "#be123c";
  const reviewSectionRadiusPx =
    Number(styleCfg.reviewSectionRadiusPx) > 0
      ? Number(styleCfg.reviewSectionRadiusPx)
      : radius;
  const reviewInputRadiusPx =
    Number(styleCfg.reviewInputRadiusPx) > 0
      ? Number(styleCfg.reviewInputRadiusPx)
      : 10;
  const reviewTitleSizePx =
    Number(styleCfg.reviewTitleSizePx) > 0
      ? Number(styleCfg.reviewTitleSizePx)
      : 24;
  const reviewBodySizePx =
    Number(styleCfg.reviewBodySizePx) > 0
      ? Number(styleCfg.reviewBodySizePx)
      : 14;
  const reviewFontFamily =
    typeof styleCfg.reviewFontFamily === "string" &&
    styleCfg.reviewFontFamily.trim()
      ? styleCfg.reviewFontFamily
      : "inherit";
  const reviewFontSize =
    Number(styleCfg.reviewFontSize) > 0
      ? Number(styleCfg.reviewFontSize)
      : reviewBodySizePx;
  const reviewBorderRadius =
    Number(styleCfg.reviewBorderRadius) >= 0
      ? Number(styleCfg.reviewBorderRadius)
      : reviewSectionRadiusPx;
  const reviewBorderColor = styleCfg.reviewBorderColor || borderColor;
  const reviewBgOpacity = Number.isFinite(Number(styleCfg.reviewBgOpacity))
    ? Math.max(0, Math.min(1, Number(styleCfg.reviewBgOpacity)))
    : 1;
  const reviewFormBgImage =
    typeof styleCfg.reviewFormBgImage === "string"
      ? styleCfg.reviewFormBgImage
      : "";
  const reviewFormBgImageOpacity = Number.isFinite(
    Number(styleCfg.reviewFormBgImageOpacity),
  )
    ? Math.max(0, Math.min(1, Number(styleCfg.reviewFormBgImageOpacity)))
    : 0.35;
  const reviewStarType = ["heart", "fire", "thumb", "star"].includes(
    cfg.reviewStarType,
  )
    ? cfg.reviewStarType
    : "star";
  const reviewStarStyle = ["outline", "fill"].includes(cfg.reviewStarStyle)
    ? cfg.reviewStarStyle
    : "fill";
  const reviewStarSizePx =
    Number(cfg.reviewStarSizePx) > 0 ? Number(cfg.reviewStarSizePx) : 20;

  const reviewSectionBgWithOpacity = isHexColor(reviewSectionBg)
    ? hexToRgba(reviewSectionBg, reviewBgOpacity)
    : reviewSectionBg;
  const reviewFormBgWithOpacity = isHexColor(reviewFormBg)
    ? hexToRgba(reviewFormBg, reviewBgOpacity)
    : reviewFormBg;
  const reviewListBgWithOpacity = isHexColor(reviewListBg)
    ? hexToRgba(reviewListBg, reviewBgOpacity)
    : reviewListBg;

  const discountPct = visibleOriginalPrice
    ? Math.round((1 - Number(visiblePrice) / visibleOriginalPrice) * 100)
    : null;

  const imageAnimationStyle = getAnimationStyle(
    imageAnimation,
    animationDurationMs,
  );
  const contentAnimationStyle = getAnimationStyle(
    contentAnimation,
    animationDurationMs,
  );
  const reviewSectionAnimationStyle = getAnimationStyle(
    reviewSectionAnimation,
    animationDurationMs,
  );

  const specifications = publicCommercialFields.length ? (
    <section
      style={{
        marginTop: 20,
        borderRadius: radius,
        border: `${borderWidthPx}px solid ${borderColor}`,
        backgroundColor: "transparent",
        padding: 24,
      }}
      className="pd-specifications"
    >
      <h2
        style={{
          margin: 0,
          color: textPrimary,
          fontSize: 20,
          fontWeight: 700,
        }}
      >
        Especificaciones
      </h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(220px, 100%), 1fr))",
          gap: 12,
          marginTop: 18,
        }}
      >
        {publicCommercialFields.map((field, index) => {
          const fieldValue =
            field.type === "boolean"
              ? String(field.value) === "true"
                ? "Sí"
                : "No"
              : field.value;

          return (
            <div
              key={`${field.group}-${field.key}-${index}`}
              style={{
                borderRadius: 12,
                border: `1px solid ${borderColor}`,
                padding: "12px 14px",
                backgroundColor: "transparent",
              }}
            >
              <p
                style={{
                  margin: 0,
                  color: textSecondary,
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                {field.group || "General"}
              </p>
              <p
                style={{
                  margin: "5px 0 0",
                  color: textPrimary,
                  fontSize: 14,
                  lineHeight: 1.5,
                }}
              >
                <strong>{field.label}:</strong> {fieldValue || "—"}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  ) : null;
  const reviewsBlock = showReviewsSection ? (
    <div
      style={{
        marginTop: 0,
        fontFamily: reviewFontFamily,
        ...reviewSectionAnimationStyle,
      }}
      className="pd-review-section"
    >
      <h2
        style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: `clamp(20px, 3vw, ${reviewTitleSizePx}px)`,
          fontWeight: 700,
          color: reviewTitleColor,
          marginBottom: 24,
          letterSpacing: "-0.01em",
        }}
        className="max-md:mb-5"
      >
        {reviewSectionTitle}
      </h2>

      <div
        className={`pd-reviews-grid ${showReviewForm && showReviewList ? "two-col" : ""}`}
        style={{
          backgroundColor: reviewSectionBgWithOpacity,
          borderRadius: reviewBorderRadius,
          border: `1.5px solid ${reviewBorderColor}`,
          padding: "4px",
          gap: 20,
        }}
      >
        {showReviewForm && (
          <div
            className="relative overflow-hidden"
            style={{
              backgroundColor: reviewFormBgWithOpacity,
              borderRadius: reviewBorderRadius,
              border: `1.5px solid ${reviewBorderColor}`,
            }}
          >
            {reviewFormBgImage && (
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  backgroundImage: `url(${reviewFormBgImage})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  opacity: reviewFormBgImageOpacity,
                }}
              />
            )}

            <div
              style={{ position: "relative", zIndex: 10, padding: "24px 20px" }}
              className="max-md:px-4 max-md:py-5"
            >
              <h3
                style={{
                  fontSize: `${reviewTitleSizePx}px`,
                  fontWeight: 600,
                  color: reviewTitleColor,
                  marginBottom: 20,
                  fontFamily: reviewFontFamily,
                }}
              >
                {reviewFormTitle}
              </h3>

              {reviewError && (
                <div
                  style={{
                    marginBottom: 16,
                    padding: "10px 14px",
                    backgroundColor: reviewErrorBg,
                    color: reviewErrorText,
                    border: `1px solid ${reviewErrorText}33`,
                    borderRadius: reviewBorderRadius,
                    fontSize: `${reviewFontSize}px`,
                    fontFamily: reviewFontFamily,
                  }}
                >
                  {reviewError}
                </div>
              )}

              {reviewSuccess && (
                <div
                  style={{
                    marginBottom: 16,
                    padding: "10px 14px",
                    backgroundColor: reviewSuccessBg,
                    color: reviewSuccessText,
                    border: `1px solid ${reviewSuccessText}33`,
                    borderRadius: reviewBorderRadius,
                    fontSize: `${reviewFontSize}px`,
                    fontFamily: reviewFontFamily,
                  }}
                >
                  {reviewSuccess}
                </div>
              )}

              <div
                style={{ display: "flex", flexDirection: "column", gap: 16 }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      fontWeight: 600,
                      marginBottom: 6,
                      color: reviewTitleColor,
                      fontSize: `${reviewFontSize}px`,
                      fontFamily: reviewFontFamily,
                    }}
                  >
                    {reviewNameLabel}
                  </label>
                  <input
                    id={`${reviewId}-name`}
                    aria-label={reviewNameLabel}
                    type="text"
                    value={reviewName}
                    onChange={(e) => setReviewName(e.target.value)}
                    placeholder={reviewNamePlaceholder}
                    className="pd-input"
                    style={{
                      borderRadius: reviewInputRadiusPx,
                      border: `1.5px solid ${reviewInputBorderColor}`,
                      backgroundColor: hexToRgba(reviewInputBg, 0.28),
                      color: reviewTextColor,
                      fontSize: `${reviewFontSize}px`,
                      fontFamily: reviewFontFamily,
                    }}
                  />
                </div>

                {showReviewStars && (
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontWeight: 600,
                        marginBottom: 8,
                        color: reviewTitleColor,
                        fontSize: `${reviewFontSize}px`,
                        fontFamily: reviewFontFamily,
                      }}
                    >
                      {reviewRatingLabel}
                    </label>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        flexWrap: "wrap",
                      }}
                    >
                      {[1, 2, 3, 4, 5].map((value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setReviewRating(value)}
                          style={{
                            transition: "transform 0.15s",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: 2,
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.transform = "scale(1.2)")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.transform = "scale(1)")
                          }
                          title={`${value} estrella${value > 1 ? "s" : ""}`}
                        >
                          <ReviewRatingIcon
                            type={reviewStarType}
                            iconStyle={reviewStarStyle}
                            active={value <= Number(reviewRating)}
                            activeColor={reviewStarActiveColor}
                            inactiveColor={reviewStarInactiveColor}
                            size={reviewStarSizePx}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label
                    style={{
                      display: "block",
                      fontWeight: 600,
                      marginBottom: 6,
                      color: reviewTitleColor,
                      fontSize: `${reviewFontSize}px`,
                      fontFamily: reviewFontFamily,
                    }}
                  >
                    {reviewCommentLabel}
                  </label>
                  <textarea
                    id={`${reviewId}-comment`}
                    aria-label={reviewCommentLabel}
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder={reviewCommentPlaceholder}
                    rows={5}
                    className="pd-input"
                    style={{
                      borderRadius: reviewInputRadiusPx,
                      border: `1.5px solid ${reviewInputBorderColor}`,
                      backgroundColor: hexToRgba(reviewInputBg, 0.28),
                      color: reviewTextColor,
                      fontSize: `${reviewFontSize}px`,
                      fontFamily: reviewFontFamily,
                      resize: "none",
                    }}
                  />
                </div>

                <button
                  type="button"
                  onClick={onSubmitReview}
                  disabled={reviewLoading}
                  className="pd-add-btn"
                  style={{
                    height: 46,
                    paddingLeft: 24,
                    paddingRight: 24,
                    borderRadius: buttonRadius,
                    backgroundColor: reviewButtonBg,
                    color: reviewButtonTextColor,
                    fontSize: `${reviewFontSize}px`,
                    fontFamily: reviewFontFamily,
                    opacity: reviewLoading ? 0.6 : 1,
                    alignSelf: "flex-start",
                    textTransform: "none",
                    letterSpacing: "0.02em",
                    boxShadow: `0 8px 20px ${hexToRgba(reviewButtonBg, 0.28)}`,
                  }}
                >
                  {reviewLoading ? "Enviando..." : reviewSubmitText}
                </button>
              </div>
            </div>
          </div>
        )}

        {showReviewList && (
          <div
            className="pd-review-list-panel"
            style={{
              backgroundColor: reviewListBgWithOpacity,
              borderRadius: reviewBorderRadius,
              border: `1.5px solid ${reviewBorderColor}`,
            }}
          >
            <div
              style={{ padding: "24px 20px" }}
              className="max-md:px-4 max-md:py-5"
            >
              <h3
                style={{
                  fontSize: `${reviewTitleSizePx}px`,
                  fontWeight: 600,
                  color: reviewTitleColor,
                  marginBottom: 20,
                  fontFamily: reviewFontFamily,
                }}
              >
                {reviewListTitle}
              </h3>

              {safeReviews.length === 0 ? (
                <div style={{ textAlign: "center", padding: "32px 16px" }}>
                  <div
                    style={{
                      fontSize: 40,
                      marginBottom: 12,
                      opacity: 0.3,
                    }}
                  >
                    💬
                  </div>
                  <p
                    style={{
                      color: reviewMutedColor,
                      fontSize: `${reviewFontSize}px`,
                      fontFamily: reviewFontFamily,
                    }}
                  >
                    {reviewEmptyText}
                  </p>
                </div>
              ) : (
                <div
                  className="pd-reviews-list"
                  style={{
                    paddingRight: 4,
                    display: "flex",
                    flexDirection: "column",
                    gap: 20,
                  }}
                >
                  {safeReviews
                    .slice()
                    .reverse()
                    .map((review, index) => {
                      const ratingValue = Number(review?.rating) || 0;
                      const reviewDate = review?.createdAt
                        ? new Date(review.createdAt)
                        : null;

                      return (
                        <div
                          key={`${review?.name || "review"}-${review?.createdAt || index}`}
                          style={{
                            paddingBottom: 20,
                            borderBottom: `1px solid ${reviewBorderColor}`,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "flex-start",
                              justifyContent: "space-between",
                              gap: 12,
                              flexWrap: "wrap",
                              marginBottom: 10,
                            }}
                          >
                            <div>
                              <p
                                style={{
                                  fontWeight: 700,
                                  color: reviewTitleColor,
                                  fontSize: `${reviewFontSize}px`,
                                  fontFamily: reviewFontFamily,
                                  margin: 0,
                                }}
                              >
                                {review?.name || "Cliente"}
                              </p>
                              {showReviewStars && (
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 3,
                                    marginTop: 5,
                                  }}
                                >
                                  {[1, 2, 3, 4, 5].map((starValue) => (
                                    <ReviewRatingIcon
                                      key={starValue}
                                      type={reviewStarType}
                                      iconStyle={reviewStarStyle}
                                      active={starValue <= ratingValue}
                                      activeColor={reviewStarActiveColor}
                                      inactiveColor={reviewStarInactiveColor}
                                      size={Math.max(12, reviewStarSizePx - 4)}
                                    />
                                  ))}
                                </div>
                              )}
                            </div>

                            {showReviewDate &&
                              reviewDate &&
                              !Number.isNaN(reviewDate.getTime()) && (
                                <span
                                  style={{
                                    color: reviewMutedColor,
                                    fontSize: `${Math.max(11, reviewFontSize - 2)}px`,
                                    fontFamily: reviewFontFamily,
                                    backgroundColor: hexToRgba(
                                      borderColor,
                                      0.5,
                                    ),
                                    padding: "2px 10px",
                                    borderRadius: "50px",
                                    flexShrink: 0,
                                  }}
                                >
                                  {reviewDate.toLocaleDateString("es-CO")}
                                </span>
                              )}
                          </div>

                          <p
                            style={{
                              color: reviewTextColor,
                              fontSize: `${reviewBodySizePx}px`,
                              fontFamily: reviewFontFamily,
                              lineHeight: 1.7,
                              whiteSpace: "pre-line",
                              margin: 0,
                            }}
                          >
                            {review?.comment || ""}
                          </p>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  ) : null;
  const delivery = showAccordionBlock ? (
    <div className="pd-delivery-details">
      {!accordionText1 && !accordionText2 && (
        <p>{presentation.deliverySummary}</p>
      )}
      {[
        [accordionTitle1, accordionText1],
        [accordionTitle2, accordionText2],
      ]
        .filter(([, text]) => text)
        .map(([title, text]) => (
          <section key={title}>
            <h3>{title}</h3>
            <p>{text}</p>
          </section>
        ))}
    </div>
  ) : null;
  const variables = {
    "--pd-page-width": `${presentation.maxWidth}px`,
    "--pd-gallery-percent": `${presentation.galleryPercent}%`,
    "--pd-glass-color": cardBg,
    "--pd-glass-opacity": `${presentation.glassOpacity * 100}%`,
    "--pd-glass-blur": `${presentation.glassBlur}px`,
    "--pd-ink": textPrimary,
    "--pd-muted": textSecondary,
    "--pd-accent": accent1,
    "--pd-light": borderColor,
    "--pd-radius": `${radius}px`,
    "--pd-edge-width": `${borderWidthPx}px`,
    "--pd-button-radius": `${buttonRadius}px`,
    "--pd-reflection": presentation.reflection,
    "--pd-edge-shadow":
      borderWidthPx > 0 && presentation.reflection > 0
        ? `inset 0 ${borderWidthPx}px ${borderWidthPx}px ${hexToRgba(borderColor, presentation.reflection)}, inset 0 -${borderWidthPx}px ${borderWidthPx}px ${hexToRgba(borderColor, presentation.reflection * 0.5)}`
        : "0 0 transparent",
    "--pd-frame-shadow":
      shadowStyle === "none"
        ? "none"
        : `0 ${shadowStyle === "strong" ? 24 : 12}px ${shadowStyle === "strong" ? 64 : 32}px -16px ${hexToRgba(textPrimary, shadowStyle === "strong" ? 0.25 : 0.16)}`,
    backgroundColor: backdropColor,
    backgroundImage: backdropImage
      ? `url(${JSON.stringify(backdropImage)})`
      : "none",
    color: textPrimary,
  };
  return (
    <div
      ref={surfaceRef}
      className="pd-storefront"
      style={variables}
      data-background={presentation.backgroundMode}
      data-chrome={withChrome && cfg.showHeader !== false}
    >
      {withChrome && cfg.showHeader !== false && <Header />}
      <main className="pd-page pd-continuous min-h-screen">
        <div className="pd-scene">
          {showBreadcrumb && (
            <nav className="pd-breadcrumb" aria-label="Ruta del producto">
              <Link to="/">Inicio</Link>
              <span aria-hidden="true">/</span>
              <Link to={presentation.catalogPath}>
                {presentation.catalogLabel}
              </Link>
              <span aria-hidden="true">/</span>
              <span aria-current="page">{product.title || visibleTitle}</span>
            </nav>
          )}
          <article
            className="pd-product-frame"
            data-gallery={showImage ? galleryPosition : "none"}
          >
            <PolishedGlassRim
              radius={radius}
              width={borderWidthPx}
              reflection={presentation.reflection}
            />
            <div className="pd-layout">
              {showImage && (
                <ProductDetailGallery
                  images={images}
                  image={displayedMainImage}
                  setImage={setMainImage}
                  title={product.title || visibleTitle}
                  config={cfg}
                  discount={discountPct}
                  animationStyle={imageAnimationStyle}
                />
              )}
              <div
                className="pd-content"
                style={{
                  order: galleryPosition === "right" ? 1 : 2,
                  color: textPrimary,
                  ...contentAnimationStyle,
                }}
              >
                <div
                  className="max-md:gap-3"
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <h1
                    className="pd-product-title"
                    style={{
                      fontSize: `clamp(22px, 4vw, ${titleSizePx}px)`,
                      color: textPrimary,
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    {cfg.titleMode === "image" &&
                    cfg.titleImage &&
                    failedTitleImage !== cfg.titleImage ? (
                      <img
                        src={cfg.titleImage}
                        alt={cfg.titleImageAlt || visibleTitle}
                        style={{
                          maxWidth: "100%",
                          maxHeight: 100,
                          objectFit: "contain",
                        }}
                        onError={() => setFailedTitleImage(cfg.titleImage)}
                      />
                    ) : (
                      visibleTitle
                    )}
                  </h1>
                </div>

                {presentation.showRatingSummary &&
                  showReviewsSection &&
                  validReviews.length > 0 && (
                    <button
                      type="button"
                      className="pd-rating-summary"
                      onClick={() => {
                        setInformationTab("reviews");
                        informationRef.current?.scrollIntoView({
                          block: "nearest",
                          behavior: "auto",
                        });
                      }}
                    >
                      <span aria-label={`${averageRating.toFixed(1)} de 5`}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            size={15}
                            fill={
                              star <= Math.round(averageRating)
                                ? "currentColor"
                                : "none"
                            }
                          />
                        ))}
                      </span>
                      <span>
                        {validReviews.length}{" "}
                        {presentation.reviewsLabel.toLowerCase()}
                      </span>
                    </button>
                  )}
                {cfg.subtitle && (
                  <p
                    className="pd-product-subtitle"
                    style={{ color: textSecondary, marginTop: 10 }}
                  >
                    {cfg.subtitle}
                  </p>
                )}

                {showPrice && (
                  <div className="pd-price-row">
                    {visibleOriginalPrice && (
                      <span className="pd-price-original">
                        {moneyCOP(visibleOriginalPrice)}
                      </span>
                    )}
                    <p
                      className="pd-price-main"
                      style={{
                        color: accent1,
                        fontSize: `clamp(24px, 4vw, ${priceSizePx}px)`,
                      }}
                    >
                      {moneyCOP(visiblePrice)}
                    </p>
                    {discountPct && (
                      <span
                        style={{
                          fontSize: "12px",
                          fontWeight: 700,
                          padding: "3px 10px",
                          borderRadius: "50px",
                          color: "#fff",
                          background: `linear-gradient(135deg, ${accent1}, ${accent2})`,
                        }}
                      >
                        Ahorras {discountPct}%
                      </span>
                    )}
                  </div>
                )}

                {presentation.showDescription &&
                  (product.shortDescription || product.description) && (
                    <p className="pd-short-description">
                      {product.shortDescription || product.description}
                    </p>
                  )}
                <div
                  className="pd-divider"
                  style={{ background: borderColor }}
                />

                <div className="pd-variant-grid">
                  {hasVariantAxes &&
                    safeVariantAxes.map((axis) => {
                      const isColorAxis = ["color", "colour", "tono"].includes(
                        axis.key,
                      );
                      const isLegacySizeAxis = [
                        "size",
                        "talla",
                        "presentacion",
                      ].includes(axis.key);
                      if (isColorAxis && !showColors) return null;
                      if (isLegacySizeAxis && !showSizes) return null;

                      return (
                        <div className="pd-section-gap" key={axis.key}>
                          <span
                            className="pd-section-label"
                            style={{ color: textSecondary }}
                          >
                            {axis.label}
                          </span>
                          <div
                            className="max-md:gap-2"
                            style={{
                              display: "flex",
                              gap: isColorAxis ? 10 : 8,
                              flexWrap: "wrap",
                              alignItems: "center",
                            }}
                          >
                            {axis.values.map((option, index) => {
                              const value = String(option || "").trim();
                              const available = isVariantOptionAvailable(
                                axis.key,
                                value,
                              );
                              const active =
                                String(selectedAttributes?.[axis.key] || "")
                                  .trim()
                                  .toLowerCase() === value.toLowerCase();

                              if (isColorAxis && normalizeToCss(value)) {
                                return (
                                  <button
                                    key={`${axis.key}-${value}-${index}`}
                                    type="button"
                                    onClick={() =>
                                      onVariantAttributeChange(axis.key, value)
                                    }
                                    title={`${axis.label}: ${getColorDisplayName(value)}`}
                                    aria-label={`${axis.label}: ${getColorDisplayName(value)}`}
                                    aria-pressed={active}
                                    aria-disabled={!available}
                                    disabled={!available}
                                    className={`pd-color-dot ${active ? "active" : ""}`}
                                    style={{
                                      backgroundColor:
                                        normalizeToCss(value) || value,
                                      borderColor: active ? accent1 : "#d1d5db",
                                      boxShadow: active
                                        ? `0 0 0 3px ${hexToRgba(accent1, 0.22)}, 0 4px 10px rgba(0,0,0,0.08)`
                                        : "0 2px 6px rgba(0,0,0,0.06)",
                                      opacity: available ? 1 : 0.35,
                                      cursor: available
                                        ? "pointer"
                                        : "not-allowed",
                                    }}
                                  />
                                );
                              }

                              return (
                                <button
                                  key={`${axis.key}-${value}-${index}`}
                                  type="button"
                                  onClick={() =>
                                    onVariantAttributeChange(axis.key, value)
                                  }
                                  aria-pressed={active}
                                  aria-disabled={!available}
                                  disabled={!available}
                                  className={`${isColorAxis ? "pd-color-chip" : "pd-size-btn"} ${active ? "active" : ""}`}
                                  style={{
                                    borderRadius: 10,
                                    borderColor: active ? accent1 : borderColor,
                                    backgroundColor: active
                                      ? hexToRgba(accent1, 0.16)
                                      : "transparent",
                                    color: active ? accent1 : textPrimary,
                                    boxShadow: active
                                      ? `0 8px 20px ${hexToRgba(accent1, 0.22)}`
                                      : "0 2px 8px rgba(31,23,42,0.04)",
                                    opacity: available ? 1 : 0.42,
                                    cursor: available
                                      ? "pointer"
                                      : "not-allowed",
                                  }}
                                >
                                  {value}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}

                  {!hasVariantAxes && showSizes && safeSizes.length > 0 && (
                    <div className="pd-section-gap">
                      <span
                        className="pd-section-label"
                        style={{ color: textSecondary }}
                      >
                        Talla
                      </span>
                      <div
                        className="max-md:gap-2"
                        style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
                      >
                        {safeSizes.map((size) => {
                          const active = selectedSize === size;
                          return (
                            <button
                              key={size}
                              type="button"
                              onClick={() => setSelectedSize(size)}
                              aria-pressed={active}
                              className={`pd-size-btn ${active ? "active" : ""}`}
                              style={{
                                borderRadius: 10,
                                borderColor: active ? accent1 : borderColor,
                                backgroundColor: active
                                  ? hexToRgba(accent1, 0.16)
                                  : "transparent",
                                color: active ? accent1 : textPrimary,
                                boxShadow: active
                                  ? `0 8px 20px ${hexToRgba(accent1, 0.26)}`
                                  : "0 2px 6px rgba(31,23,42,0.04)",
                              }}
                            >
                              {size}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {!hasVariantAxes && showColors && safeColors.length > 0 && (
                    <div className="pd-section-gap">
                      <span
                        className="pd-section-label"
                        style={{ color: textSecondary }}
                      >
                        Color
                      </span>
                      <div
                        className="max-md:gap-2"
                        style={{
                          display: "flex",
                          gap: 10,
                          flexWrap: "wrap",
                          alignItems: "center",
                        }}
                      >
                        {safeColors.map((color, index) => {
                          const value = normalizeColorValue(color);
                          const active = selectedColor === value;

                          if (normalizeToCss(value)) {
                            return (
                              <button
                                key={`${value}-${index}`}
                                type="button"
                                onClick={() => setSelectedColor(value)}
                                title={value}
                                aria-label={`Color: ${value}`}
                                aria-pressed={active}
                                className={`pd-color-dot ${active ? "active" : ""}`}
                                style={{
                                  backgroundColor:
                                    normalizeToCss(value) || value,
                                  borderColor: active ? accent1 : "#d1d5db",
                                  boxShadow: active
                                    ? `0 0 0 3px ${hexToRgba(accent1, 0.22)}, 0 4px 10px rgba(0,0,0,0.08)`
                                    : "0 2px 6px rgba(0,0,0,0.06)",
                                }}
                              />
                            );
                          }

                          return (
                            <button
                              key={`${value}-${index}`}
                              type="button"
                              onClick={() => setSelectedColor(value)}
                              className={`pd-color-chip ${active ? "active" : ""}`}
                              style={{
                                borderRadius: 10,
                                borderColor: active ? accent1 : borderColor,
                                backgroundColor: active
                                  ? hexToRgba(accent1, 0.16)
                                  : "transparent",
                                color: active ? accent1 : textPrimary,
                                boxShadow: active
                                  ? "0 8px 18px rgba(31,23,42,0.16)"
                                  : "0 2px 8px rgba(31,23,42,0.04)",
                              }}
                            >
                              {value}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
                <div className="pd-purchase-row">
                  {showQuantity && (
                    <div className="pd-quantity-block">
                      <span
                        className="pd-section-label"
                        style={{ color: textSecondary }}
                      >
                        Cantidad
                      </span>
                      <div className="pd-quantity-line">
                        <div className="pd-qty-wrap">
                          <button
                            type="button"
                            aria-label="Disminuir cantidad"
                            disabled={quantity <= 1}
                            onClick={() =>
                              setQuantity((q) => Math.max(1, q - 1))
                            }
                            className="pd-qty-btn"
                          >
                            −
                          </button>
                          <span className="pd-qty-val">{quantity}</span>
                          <button
                            type="button"
                            aria-label="Aumentar cantidad"
                            disabled={
                              cannotPurchase ||
                              (inventoryTracked &&
                                quantity >= selectedAvailableStock)
                            }
                            onClick={() => setQuantity((q) => q + 1)}
                            className="pd-qty-btn"
                          >
                            +
                          </button>
                        </div>
                        {inventoryTracked && (
                          <span
                            className="pd-stock"
                            role="status"
                            data-available={selectedAvailableStock > 0}
                          >
                            <i />
                            {selectedAvailableStock > 0
                              ? `${selectedAvailableStock} ${selectedAvailableStock === 1 ? "unidad disponible" : "unidades disponibles"}`
                              : "Agotado"}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="pd-purchase-actions">
                    {showAddToCart && (
                      <button
                        type="button"
                        className="pd-add-btn"
                        disabled={cannotPurchase}
                        data-pulse={
                          cartPulse % 2 ? "a" : cartPulse ? "b" : undefined
                        }
                        onClick={() => {
                          if (!cannotPurchase) {
                            onAddToCart?.();
                            setCartPulse((value) => value + 1);
                          }
                        }}
                        style={{
                          borderRadius: buttonRadius,
                          background: addToCartButtonBg,
                          color: addToCartTextColor,
                          border: `${addToCartBorderWidthPx}px solid ${addToCartBorderColor}`,
                        }}
                      >
                        <AddToCartIcon
                          size={20}
                          style={{ color: addToCartIconColor }}
                        />
                        {cannotPurchase
                          ? inventoryTracked
                            ? "Agotado"
                            : "No disponible"
                          : cfg.addToCartText}
                      </button>
                    )}
                    {showFavorite && (
                      <button
                        type="button"
                        onClick={() => {
                          onToggleFavorite?.();
                          setFavoritePulse((value) => value + 1);
                        }}
                        data-pulse={
                          favoritePulse % 2
                            ? "a"
                            : favoritePulse
                              ? "b"
                              : undefined
                        }
                        className="pd-fav-btn"
                        aria-label="Favorito"
                        aria-pressed={!!isFavorite}
                        style={{
                          borderColor: favoriteBorderColor,
                          borderWidth: `${favoriteBorderWidthPx}px`,
                          borderStyle: "solid",
                          background: favoriteButtonBg,
                          boxShadow: isFavorite
                            ? `0 8px 18px ${hexToRgba(
                                cfg.favoriteActiveColor || accent2,
                                0.18,
                              )}`
                            : "0 4px 12px rgba(31,23,42,0.06)",
                        }}
                      >
                        <FavoriteIcon
                          style={{
                            width: 20,
                            height: 20,
                            color: isFavorite
                              ? cfg.favoriteActiveColor || accent2
                              : cfg.favoriteIconColor || accent1,
                            fill: isFavorite
                              ? cfg.favoriteActiveColor || accent2
                              : "transparent",
                            transition: "all 0.2s",
                          }}
                        />
                      </button>
                    )}
                  </div>
                </div>

                {fulfillmentKind === "digital_delivery" &&
                  digitalFulfillment && (
                    <div
                      className="pd-pickup"
                      style={{
                        background: "transparent",
                      }}
                    >
                      <div
                        className="pd-pickup-icon"
                        style={{
                          background: hexToRgba(accent1, 0.15),
                          color: accent1,
                        }}
                      >
                        <Download style={{ width: 18, height: 18 }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p
                          style={{
                            fontSize: "13px",
                            fontWeight: 700,
                            color: accent1,
                            margin: 0,
                          }}
                        >
                          Entrega digital después del pago
                        </p>
                        <p
                          style={{
                            fontSize: "13px",
                            color: textSecondary,
                            margin: "4px 0 0",
                            lineHeight: 1.5,
                          }}
                        >
                          {digitalFulfillment.deliveryMode === "automatic"
                            ? `Recibirás un enlace seguro con hasta ${Number(digitalFulfillment.downloadLimit || 1)} descargas durante ${Number(digitalFulfillment.accessDays || 1)} días.`
                            : "El comercio coordinará contigo la entrega del contenido digital."}
                        </p>
                      </div>
                    </div>
                  )}

                {fulfillmentKind === "service" && serviceFulfillment && (
                  <div
                    className="pd-pickup"
                    style={{
                      background: "transparent",
                    }}
                  >
                    <div
                      className="pd-pickup-icon"
                      style={{
                        background: hexToRgba(accent1, 0.15),
                        color: accent1,
                      }}
                    >
                      <CalendarDays style={{ width: 18, height: 18 }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          fontSize: "13px",
                          fontWeight: 700,
                          color: accent1,
                          margin: 0,
                        }}
                      >
                        Servicio de{" "}
                        {Number(serviceFulfillment.durationMinutes || 60)}{" "}
                        minutos
                      </p>
                      <p
                        style={{
                          fontSize: "13px",
                          color: textSecondary,
                          margin: "4px 0 0",
                          lineHeight: 1.5,
                        }}
                      >
                        {serviceFulfillment.locationType === "online"
                          ? "Prestación en línea."
                          : serviceFulfillment.locationType === "store"
                            ? "Prestación en el establecimiento."
                            : "Prestación en la ubicación del cliente."}
                        {serviceFulfillment.customerInstructions
                          ? ` ${serviceFulfillment.customerInstructions}`
                          : " Recibirás las instrucciones de coordinación después del pago."}
                      </p>
                    </div>
                  </div>
                )}

                {fulfillmentKind === "bundle" &&
                  Array.isArray(bundleFulfillment?.components) && (
                    <div
                      className="pd-pickup"
                      style={{
                        background: "transparent",
                      }}
                    >
                      <div
                        className="pd-pickup-icon"
                        style={{
                          background: hexToRgba(accent1, 0.15),
                          color: accent1,
                        }}
                      >
                        <Boxes style={{ width: 18, height: 18 }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p
                          style={{
                            fontSize: "13px",
                            fontWeight: 700,
                            color: accent1,
                            margin: 0,
                          }}
                        >
                          Este combo incluye
                        </p>
                        <ul
                          style={{
                            margin: "6px 0 0",
                            paddingLeft: 18,
                            color: textSecondary,
                            fontSize: "13px",
                            lineHeight: 1.6,
                          }}
                        >
                          {bundleFulfillment.components.map(
                            (component, index) => (
                              <li
                                key={`${component.product || component.sku || "item"}-${index}`}
                              >
                                {Number(component.quantity || 1)} ×{" "}
                                {component.title || "Producto"}
                                {component.variantLabel &&
                                component.variantLabel !==
                                  "Presentación general"
                                  ? ` · ${component.variantLabel}`
                                  : ""}
                              </li>
                            ),
                          )}
                        </ul>
                      </div>
                    </div>
                  )}

                {showPickup && (
                  <div
                    className="pd-pickup"
                    style={{
                      background: "transparent",
                    }}
                  >
                    <div
                      className="pd-pickup-icon"
                      style={{
                        background: hexToRgba(accent2, 0.15),
                        color: accent2,
                      }}
                    >
                      <Package style={{ width: 18, height: 18 }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          fontSize: "13px",
                          fontWeight: 700,
                          color: accent2,
                          margin: 0,
                        }}
                      >
                        {pickupTitle}
                      </p>
                      <p
                        style={{
                          fontSize: "13px",
                          color: textSecondary,
                          margin: "4px 0 0",
                          lineHeight: 1.5,
                        }}
                      >
                        {pickupText}
                      </p>
                      <details className="pd-pickup-details">
                        <summary>{pickupLinkText}</summary>
                        <p>
                          {settings?.store?.address ||
                            settings?.store?.name ||
                            pickupText}
                        </p>
                      </details>
                    </div>
                  </div>
                )}

                {showBenefits && (
                  <div className="pd-benefits">
                    {benefitItems.map((item, index) => (
                      <div
                        key={index}
                        className="pd-benefit-card"
                        style={{
                          backgroundColor: "transparent",
                        }}
                      >
                        <div
                          className="pd-benefit-icon"
                          style={{
                            background: "transparent",
                            color: accent1,
                          }}
                        >
                          <BenefitIcon
                            source={item.image}
                            fallback={item.icon}
                          />
                        </div>
                        <p
                          style={{
                            fontSize: "12px",
                            lineHeight: 1.4,
                            color: textPrimary,
                            margin: 0,
                            fontWeight: 500,
                          }}
                        >
                          {item.title}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div ref={informationRef}>
              <ProductDetailInformation
                presentation={presentation}
                product={product}
                active={informationTab}
                onChange={setInformationTab}
                delivery={delivery}
                specifications={specifications}
                reviews={reviewsBlock}
                reviewCount={safeReviews.length}
                showReviews={showReviewsSection}
              />
            </div>
          </article>
          <ProductDetailRelatedProducts product={product} config={cfg} />
        </div>
      </main>
      {withChrome && cfg.showFooter !== false && (
        <div className="pd-footer cpv-page" data-background="continuity">
          <div className="cpv-footer">
            <FooterSection
              theme={settings?.theme}
              store={settings?.store}
              polishedGlass
              preview={preview}
            />
          </div>
        </div>
      )}
      {withChrome && !preview && <WhatsAppButton />}
    </div>
  );
}
