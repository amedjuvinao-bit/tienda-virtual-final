import React, { useMemo, useState, useEffect, useId } from "react";
import Header from "../Header";
import "./productDetail.css";
import {buildSafeProductDetailConfig} from "./productDetailConfig";
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
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Flame,
  ThumbsUp,
  Package,
  Download,
  CalendarDays,
  Boxes,
} from "lucide-react";

/* ─── Helpers (sin cambios) ─── */
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
  if (normalized.length === 3) normalized = normalized.split("").map(c => c + c).join("");
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
      return {animation:"none"};
  }
}

function getThumbHoverClass(effect) {
  if (effect === "scale") return "hover:scale-105";
  if (effect === "lift") return "hover:-translate-y-1";
  if (effect === "glow") return "hover:shadow-lg";
  return "";
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

function BenefitIcon({source,fallback}) {
  const [failed,setFailed]=useState('');
  return source&&source!==failed?<img src={source} alt="" style={{width:24,height:24,objectFit:'contain'}} onError={()=>setFailed(source)}/>:fallback;
}

/* ─── Estilos globales de diseño (layout + micro-interacciones) ─── */


/* ─── Componente principal ─── */
export default function ProductDetailView({
  product,
  config,
  withChrome = true,
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
  const cfg = useMemo(()=>config?buildSafeProductDetailConfig(config):{},[config]);
  const reviewId=useId();
  const cannotPurchase=purchaseUnavailable||(inventoryTracked&&selectedAvailableStock<=0);

  /* ── Imágenes (sin cambios) ── */
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
  const [failedTitleImage,setFailedTitleImage]=useState('');
  const [openAccordion1, setOpenAccordion1] = useState(false);
  const [openAccordion2, setOpenAccordion2] = useState(false);

  useEffect(() => {
    setMainImage(current=>images.includes(current)?current:images[0]||'');
  }, [images]);
  useEffect(()=>{setMainImage(images[0]||'');},[product?._id,product?.selectedVariantKey]);

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
        ? [...new Set(axis.values.map((value) => String(value || "").trim()).filter(Boolean))]
        : [],
    }))
    .filter((axis) => axis.key && axis.label && axis.values.length)
    .slice(0, 4);
  const hasVariantAxes =
    safeVariantAxes.length > 0 &&
    typeof onVariantAttributeChange === "function";
  const safeReviews = Array.isArray(product?.reviews) ? product.reviews : [];
  const publicCommercialFields = Array.isArray(
    product?.commercialFields
  )
    ? product.commercialFields.filter(
        (field) =>
          field?.public !== false &&
          String(field?.label || '').trim()
      )
    : [];

  const styleCfg = cfg?.style || {};
  const visibleTitle = cfg.titleOverride?.trim() || product?.title || "Producto";
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
  const borderWidthPx=Number.isFinite(Number(styleCfg.borderWidthPx))?Number(styleCfg.borderWidthPx):1.5;
  const radius = Number(styleCfg.radiusPx) > 0 ? Number(styleCfg.radiusPx) : 18;
  const buttonRadius =
    Number(styleCfg.buttonRadiusPx) > 0 ? Number(styleCfg.buttonRadiusPx) : 14;
  const thumbRadius =
    Number(styleCfg.thumbRadiusPx) > 0 ? Number(styleCfg.thumbRadiusPx) : 12;
  const thumbBorderColor = styleCfg.thumbBorderColor || "#f1bfd9";
  const selectedThumbBorderColor =
    styleCfg.selectedThumbBorderColor || accent1;
  const titleSizePx =
    Number(styleCfg.titleSizePx) > 0 ? Number(styleCfg.titleSizePx) : 32;
  const priceSizePx =
    Number(styleCfg.priceSizePx) > 0 ? Number(styleCfg.priceSizePx) : 30;
  const shadowStyle = styleCfg.shadowStyle || "soft";
  const shadowClass =
    shadowStyle === "none"
      ? ""
      : shadowStyle === "medium"
        ? "shadow-md"
        : shadowStyle === "strong"
          ? "shadow-xl"
          : "shadow-sm";

  const favoriteButtonBgRaw =
    typeof styleCfg.favoriteButtonBg === "string"
      ? styleCfg.favoriteButtonBg
      : "#ffffff";
  const favoriteButtonOpacity = Number.isFinite(
    Number(styleCfg.favoriteButtonOpacity)
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
    Number(styleCfg.addToCartButtonOpacity)
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
  const showThumbnails = cfg.showThumbnails !== false;
  const showPrice = cfg.showPrice !== false;
  const showFavorite = cfg.showFavoriteButton !== false;
  const showSizes = cfg.showSizes !== false;
  const showColors = cfg.showColors !== false;
  const showQuantity = cfg.showQuantity !== false;
  const showAddToCart = cfg.showAddToCart !== false;
  const showPickup =
    cfg.showPickupBlock !== false &&
    product?.requiresShipping !== false;
  const showBenefits = cfg.showBenefits !== false;
  const showAccordionBlock = cfg.showAccordionBlock !== false;

  const galleryPosition = cfg.galleryPosition === "right" ? "right" : "left";
  const thumbnailPosition =
    cfg.thumbnailPosition === "bottom" ? "bottom" : "left";
  const thumbCount = Number(cfg.thumbCount) > 0 ? Number(cfg.thumbCount) : 5;
  const mainImageMaxWidthPx =
    Number(cfg.mainImageMaxWidthPx) > 0 ? Number(cfg.mainImageMaxWidthPx) : 380;
  const mainImageMaxHeightPx =
    Number(cfg.mainImageMaxHeightPx) > 0
      ? Number(cfg.mainImageMaxHeightPx)
      : 700;
  const thumbWidthPx = Number(cfg.thumbWidthPx) > 0 ? Number(cfg.thumbWidthPx) : 64;
  const thumbHeightPx =
    Number(cfg.thumbHeightPx) > 0 ? Number(cfg.thumbHeightPx) : 64;
  const thumbGapPx = Number(cfg.thumbGapPx) > 0 ? Number(cfg.thumbGapPx) : 12;
  const imageFit = cfg.imageFit === "contain" ? "contain" : "cover";
  const imageAnimation = cfg.imageAnimation || "none";
  const contentAnimation = cfg.contentAnimation || "none";
  const imageHoverZoom = cfg.imageHoverZoom !== false;
  const animationDurationMs =
    Number(cfg.animationDurationMs) > 0 ? Number(cfg.animationDurationMs) : 350;
  const thumbHoverEffect = cfg.thumbHoverEffect || "none";

  const pickupTitle = cfg.pickupTitle || "✓ Recogida disponible en Tienda";
  const pickupText = cfg.pickupText || "Normalmente está listo en 24 horas";
  const pickupLinkText =
    cfg.pickupLinkText || "Ver información de la tienda";
  const fulfillment = product?.fulfillment || null;
  const fulfillmentKind = fulfillment?.kind || "";
  const digitalFulfillment = fulfillment?.digital || null;
  const serviceFulfillment = fulfillment?.service || null;
  const bundleFulfillment = fulfillment?.bundle || null;

  const accordionTitle1 =
    cfg.accordionTitle1 ||
    "1. Conoce más información sobre nuestros envíos";
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
  const reviewSectionTitle =
    cfg.reviewSectionTitle || "Reseñas y opiniones";
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
  const reviewInputBorderColor =
    styleCfg.reviewInputBorderColor || borderColor;
  const reviewButtonBg = styleCfg.reviewButtonBg || accent1;
  const reviewButtonTextColor = styleCfg.reviewButtonTextColor || "#ffffff";
  const reviewStarActiveColor =
    styleCfg.reviewStarActiveColor || accent2;
  const reviewStarInactiveColor =
    styleCfg.reviewStarInactiveColor || "#d1d5db";
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
    Number(styleCfg.reviewFormBgImageOpacity)
  )
    ? Math.max(0, Math.min(1, Number(styleCfg.reviewFormBgImageOpacity)))
    : 0.35;
  const reviewStarType = ["heart", "fire", "thumb", "star"].includes(
    cfg.reviewStarType
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
    animationDurationMs
  );
  const contentAnimationStyle = getAnimationStyle(
    contentAnimation,
    animationDurationMs
  );
  const reviewSectionAnimationStyle = getAnimationStyle(
    reviewSectionAnimation,
    animationDurationMs
  );
  const thumbHoverClass = getThumbHoverClass(thumbHoverEffect);

  const desktopThumbs = images.slice(0, thumbCount);
  const mobileThumbs = images.slice(0, thumbCount);

  const mobileThumbWidthPx = Math.min(thumbWidthPx, 58);
  const mobileThumbHeightPx = Math.min(thumbHeightPx, 58);
  const mobileMainImageMaxWidthPx = Math.min(mainImageMaxWidthPx, 360);
  const mobileMainImageMaxHeightPx = Math.min(mainImageMaxHeightPx, 430);

  const galleryColumnPx = Math.min(
    680,
    Math.max(
      340,
      thumbnailPosition === "left" && showThumbnails && images.length > 1
        ? mainImageMaxWidthPx + thumbWidthPx + thumbGapPx + 24
        : mainImageMaxWidthPx + 24
    )
  );

  const desktopLeftThumbsBlock =
    showThumbnails && thumbnailPosition === "left" && images.length > 1 ? (
      <div className="pd-thumbs-left" style={{ gap: `${thumbGapPx}px` }}>
        {desktopThumbs.map((img, index) => {
          const active = displayedMainImage === img;
          return (
            <button
              key={`${img}-${index}`}
              type="button"
              onClick={() => setMainImage(img)}
              className={`pd-thumb-btn ${thumbHoverClass}`}
              style={{
                width: thumbWidthPx,
                height: thumbHeightPx,
                borderRadius: thumbRadius,
                border: `2px solid ${active ? selectedThumbBorderColor : thumbBorderColor}`,
                boxShadow: active
                  ? `0 0 0 3px ${hexToRgba(selectedThumbBorderColor, 0.18)}`
                  : undefined,
              }}
            >
              <img
                src={img}
                alt={`Miniatura ${index + 1}`}
                className="w-full h-full"
                style={{ objectFit: imageFit }}
              />
            </button>
          );
        })}
      </div>
    ) : null;

  const bottomThumbsBlock =
    showThumbnails && thumbnailPosition === "bottom" && images.length > 1 ? (
      <div className="pd-thumbs-bottom" style={{ gap: `${thumbGapPx}px` }}>
        {desktopThumbs.map((img, index) => {
          const active = displayedMainImage === img;
          return (
            <button
              key={`${img}-bottom-${index}`}
              type="button"
              onClick={() => setMainImage(img)}
              className={`pd-thumb-btn ${thumbHoverClass}`}
              style={{
                width: thumbWidthPx,
                height: thumbHeightPx,
                borderRadius: thumbRadius,
                border: `2px solid ${active ? selectedThumbBorderColor : thumbBorderColor}`,
                boxShadow: active
                  ? `0 0 0 3px ${hexToRgba(selectedThumbBorderColor, 0.18)}`
                  : undefined,
              }}
            >
              <img
                src={img}
                alt={`Miniatura inferior ${index + 1}`}
                className="w-full h-full"
                style={{ objectFit: imageFit }}
              />
            </button>
          );
        })}
      </div>
    ) : null;

  const mainImageBlock = (
    <div
      className={`pd-main-img-wrap ${shadowClass} max-md:max-w-[360px] max-md:w-full`}
      style={{
        backgroundColor: cardBg,
        borderRadius: radius,
        border: `${borderWidthPx}px solid ${borderColor}`,
        boxShadow: "0 14px 40px rgba(31,23,42,0.09)",
        maxWidth: `${mainImageMaxWidthPx}px`,
        maxHeight: `${mainImageMaxHeightPx}px`,
        width: "100%",
        ...imageAnimationStyle,
      }}
    >
      {discountPct && (
        <div
          className="pd-discount-badge"
          style={{
            background: `linear-gradient(135deg, ${accent1}, ${accent2})`,
          }}
        >
          -{discountPct}%
        </div>
      )}

      <img
        src={displayedMainImage||"/placeholder.png"}
        alt={visibleTitle}
        className={`pd-main-img ${imageHoverZoom ? "pd-main-img-zoom" : ""}`}
        style={{
          objectFit: imageFit,
          maxHeight: `${mainImageMaxHeightPx}px`,
        }}
      />
      {cfg.showArrows!==false&&images.length>1&&<div style={{position:'absolute',right:12,bottom:12,display:'flex',gap:8}}>
        {[[-1,'Ver imagen anterior',ChevronLeft],[1,'Ver imagen siguiente',ChevronRight]].map(([step,label,Icon])=><button key={label} type="button" aria-label={label} onClick={()=>setMainImage(images[(Math.max(0,images.indexOf(displayedMainImage))+step+images.length)%images.length])} style={{width:34,height:34,borderRadius:buttonRadius,background:cardBg,color:textPrimary,border:`1px solid ${borderColor}`,display:'grid',placeItems:'center'}}><Icon size={18}/></button>)}
      </div>}
    </div>
  );

  const galleryInner =
    thumbnailPosition === "bottom" ? (
      <div
        className="max-md:mx-auto max-md:flex max-md:flex-col max-md:items-center"
        style={{
          display: "inline-flex",
          flexDirection: "column",
          alignItems: "flex-start",
          width: "100%",
          maxWidth: `${mainImageMaxWidthPx}px`,
        }}
      >
        {mainImageBlock}
        {bottomThumbsBlock}
      </div>
    ) : galleryPosition === "right" ? (
      <div
        className="max-md:mx-auto max-md:flex max-md:flex-col max-md:items-center"
        style={{
          display: "inline-flex",
          alignItems: "flex-start",
          gap: `${thumbGapPx}px`,
          width: "100%",
          maxWidth: `${galleryColumnPx}px`,
          justifyContent: "flex-end",
        }}
      >
        {mainImageBlock}
        {desktopLeftThumbsBlock}
      </div>
    ) : (
      <div
        className="max-md:mx-auto max-md:flex max-md:flex-col max-md:items-center"
        style={{
          display: "inline-flex",
          alignItems: "flex-start",
          gap: `${thumbGapPx}px`,
          width: "100%",
          maxWidth: `${galleryColumnPx}px`,
          justifyContent: "flex-start",
        }}
      >
        {desktopLeftThumbsBlock}
        {mainImageBlock}
      </div>
    );

  const galleryBlock = showImage ? galleryInner : null;

  return (
    <>

      {withChrome && cfg.showHeader !== false && <Header />}

      <main
        className="pd-page min-h-screen"
        style={{ backgroundColor: pageBg, color: textPrimary }}
      >
        <div
          style={{
            maxWidth: "1280px",
            margin: "0 auto",
            padding: "24px 16px 60px",
          }}
          className="max-md:px-4 max-md:pt-4 max-md:pb-10"
        >
          {showBreadcrumb && (
            <div className="pd-breadcrumb">
              <span style={{ color: accent1, cursor: "pointer" }}>Home</span>
              <span
                className="pd-breadcrumb-sep"
                style={{ color: textSecondary }}
              >
                ›
              </span>
              <span style={{ color: accent1, cursor: "pointer" }}>
                Lo Nuevo
              </span>
              <span
                className="pd-breadcrumb-sep"
                style={{ color: textSecondary }}
              >
                ›
              </span>
              <span style={{ color: accent2, fontWeight: 600 }}>
                {visibleTitle}
              </span>
            </div>
          )}

          <div
            className={`pd-layout ${galleryPosition === "right" ? "gallery-right" : ""}`}
            style={{ "--pd-gallery-col": `${galleryColumnPx}px` }}
          >
            {galleryBlock && (
              <div
                className="pd-gallery-sticky max-md:w-full"
                style={{
                  order: galleryPosition === "right" ? 2 : 1,
                  display: "flex",
                  justifyContent:
                    galleryPosition === "right" ? "flex-end" : "center",
                }}
              >
                <div className="w-full max-md:flex max-md:flex-col max-md:items-center">
                  {galleryBlock}

                  {showThumbnails && images.length > 1 && (
                    <div
                      className="pd-thumbs-mobile"
                      style={{ gap: `${Math.min(thumbGapPx, 10)}px` }}
                    >
                      {mobileThumbs.map((img, index) => {
                        const active = displayedMainImage === img;
                        return (
                          <button
                            key={`${img}-mobile-${index}`}
                            type="button"
                            onClick={() => setMainImage(img)}
                            className={`pd-thumb-btn ${thumbHoverClass}`}
                            style={{
                              width: mobileThumbWidthPx,
                              height: mobileThumbHeightPx,
                              borderRadius: thumbRadius,
                              border: `2px solid ${active ? selectedThumbBorderColor : thumbBorderColor}`,
                              boxShadow: active
                                ? `0 0 0 3px ${hexToRgba(selectedThumbBorderColor, 0.18)}`
                                : undefined,
                            }}
                          >
                            <img
                              src={img}
                              alt={`Miniatura móvil ${index + 1}`}
                              className="w-full h-full"
                              style={{ objectFit: imageFit }}
                            />
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div
              className="pd-content max-md:px-0"
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
                  {cfg.titleMode==='image'&&cfg.titleImage&&failedTitleImage!==cfg.titleImage?
                    <img src={cfg.titleImage} alt={cfg.titleImageAlt||visibleTitle} style={{maxWidth:'100%',maxHeight:100,objectFit:'contain'}} onError={()=>setFailedTitleImage(cfg.titleImage)}/>:visibleTitle}
                </h1>

                {showFavorite && (
                  <button
                    type="button"
                    onClick={onToggleFavorite}
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
                            0.18
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

              {cfg.subtitle&&<p className="pd-product-subtitle" style={{color:textSecondary,marginTop:10}}>{cfg.subtitle}</p>}

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

              <div className="pd-divider" style={{ background: borderColor }} />

              {hasVariantAxes &&
                safeVariantAxes.map((axis) => {
                  const isColorAxis = ["color", "colour", "tono"].includes(axis.key);
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
                          const available = isVariantOptionAvailable(axis.key, value);
                          const active =
                            String(selectedAttributes?.[axis.key] || "")
                              .trim()
                              .toLowerCase() === value.toLowerCase();

                          if (isColorAxis && isHexColor(value)) {
                            return (
                              <button
                                key={`${axis.key}-${value}-${index}`}
                                type="button"
                                onClick={() =>
                                  onVariantAttributeChange(axis.key, value)
                                }
                                title={`${axis.label}: ${value}`}
                                aria-label={`${axis.label}: ${value}`}
                                aria-pressed={active}
                                aria-disabled={!available}
                                disabled={!available}
                                className={`pd-color-dot ${active ? "active" : ""}`}
                                style={{
                                  backgroundColor: value,
                                  borderColor: active ? accent1 : "#d1d5db",
                                  boxShadow: active
                                    ? `0 0 0 3px ${hexToRgba(accent1, 0.22)}, 0 4px 10px rgba(0,0,0,0.08)`
                                    : "0 2px 6px rgba(0,0,0,0.06)",
                                  opacity: available ? 1 : 0.35,
                                  cursor: available ? "pointer" : "not-allowed",
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
                              className={isColorAxis ? "pd-color-chip" : "pd-size-btn"}
                              style={{
                                borderRadius: 10,
                                borderColor: active ? accent1 : borderColor,
                                backgroundColor: active
                                  ? isColorAxis
                                    ? textPrimary
                                    : accent1
                                  : "#ffffff",
                                color: active ? "#ffffff" : textPrimary,
                                boxShadow: active
                                  ? `0 8px 20px ${hexToRgba(accent1, 0.22)}`
                                  : "0 2px 8px rgba(31,23,42,0.04)",
                                opacity: available ? 1 : 0.42,
                                cursor: available ? "pointer" : "not-allowed",
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
                  <span className="pd-section-label" style={{ color: textSecondary }}>
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
                          className="pd-size-btn"
                          style={{
                            borderRadius: 10,
                            borderColor: active ? accent1 : borderColor,
                            backgroundColor: active ? accent1 : "#ffffff",
                            color: active ? "#ffffff" : textPrimary,
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
                  <span className="pd-section-label" style={{ color: textSecondary }}>
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

                      if (isHexColor(value)) {
                        return (
                          <button
                            key={`${value}-${index}`}
                            type="button"
                            onClick={() => setSelectedColor(value)}
                            title={value}
                            className={`pd-color-dot ${active ? "active" : ""}`}
                            style={{
                              backgroundColor: value,
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
                            backgroundColor: active ? textPrimary : "#ffffff",
                            color: active ? "#ffffff" : textPrimary,
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

              {showQuantity && (
                <div className="pd-section-gap">
                  <span className="pd-section-label" style={{ color: textSecondary }}>
                    Cantidad
                  </span>
                  {inventoryTracked && (
                    <div
                      role="status"
                      style={{
                        marginBottom: 10,
                        color: selectedAvailableStock > 0 ? "#15803d" : "#92400e",
                        fontSize: 13,
                        fontWeight: 700,
                      }}
                    >
                      {selectedAvailableStock > 0
                        ? `${selectedAvailableStock} ${selectedAvailableStock === 1 ? "unidad disponible" : "unidades disponibles"}`
                        : "Esta combinación está agotada"}
                    </div>
                  )}
                  <div className="pd-qty-cta">
                    <div
                      className="pd-qty-wrap"
                      style={{
                        borderRadius: 10,
                        border: `${borderWidthPx}px solid ${borderColor}`,
                        backgroundColor: "#ffffff",
                        boxShadow: "inset 0 1px 3px rgba(0,0,0,0.04)",
                      }}
                    >
                      <button
                        type="button"
                        aria-label="Disminuir cantidad"
                        disabled={quantity<=1}
                        onClick={() => setQuantity((q) => (q > 1 ? q - 1 : 1))}
                        className="pd-qty-btn"
                        style={{
                          color: textSecondary,
                          backgroundColor: "transparent",
                        }}
                      >
                        −
                      </button>
                      <div className="pd-qty-val" style={{ color: textPrimary }}>
                        {quantity}
                      </div>
                      <button
                        type="button"
                        aria-label="Aumentar cantidad"
                        onClick={() => setQuantity((q) => q + 1)}
                        disabled={
                          cannotPurchase || inventoryTracked &&
                          quantity >= Number(selectedAvailableStock || 0)
                        }
                        className="pd-qty-btn"
                        style={{
                          color: textSecondary,
                          backgroundColor: "transparent",
                        }}
                      >
                        +
                      </button>
                    </div>

                    {showAddToCart && (
                      <button
                        type="button"
                        onClick={onAddToCart}
                        disabled={cannotPurchase}
                        className="pd-add-btn"
                        style={{
                          height: 48,
                          paddingLeft: 28,
                          paddingRight: 28,
                          borderRadius: buttonRadius,
                          background: addToCartButtonBg,
                          boxShadow: `0 12px 28px ${hexToRgba(addToCartBorderColor, 0.28)}`,
                          color: addToCartTextColor,
                          border: `${addToCartBorderWidthPx}px solid ${addToCartBorderColor}`,
                          opacity: cannotPurchase ? 0.55 : 1,
                          cursor: cannotPurchase ? "not-allowed" : "pointer",
                        }}
                      >
                        <AddToCartIcon
                          style={{ width: 18, height: 18, color: addToCartIconColor }}
                        />
                        {cannotPurchase
                          ? inventoryTracked ? "Agotado" : "No disponible"
                          : cfg.addToCartText || "Añadir al carrito"}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {fulfillmentKind === "digital_delivery" && digitalFulfillment && (
                <div
                  className="pd-pickup"
                  style={{
                    background: `linear-gradient(135deg, ${hexToRgba(accent1, 0.10)}, ${hexToRgba(accent2, 0.07)})`,
                    border: `1.5px solid ${hexToRgba(borderColor, 0.9)}`,
                  }}
                >
                  <div className="pd-pickup-icon" style={{ background: hexToRgba(accent1, 0.15), color: accent1 }}>
                    <Download style={{ width: 18, height: 18 }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: "13px", fontWeight: 700, color: accent1, margin: 0 }}>
                      Entrega digital después del pago
                    </p>
                    <p style={{ fontSize: "13px", color: textSecondary, margin: "4px 0 0", lineHeight: 1.5 }}>
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
                    background: `linear-gradient(135deg, ${hexToRgba(accent1, 0.10)}, ${hexToRgba(accent2, 0.07)})`,
                    border: `1.5px solid ${hexToRgba(borderColor, 0.9)}`,
                  }}
                >
                  <div className="pd-pickup-icon" style={{ background: hexToRgba(accent1, 0.15), color: accent1 }}>
                    <CalendarDays style={{ width: 18, height: 18 }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: "13px", fontWeight: 700, color: accent1, margin: 0 }}>
                      Servicio de {Number(serviceFulfillment.durationMinutes || 60)} minutos
                    </p>
                    <p style={{ fontSize: "13px", color: textSecondary, margin: "4px 0 0", lineHeight: 1.5 }}>
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

              {fulfillmentKind === "bundle" && Array.isArray(bundleFulfillment?.components) && (
                <div
                  className="pd-pickup"
                  style={{
                    background: `linear-gradient(135deg, ${hexToRgba(accent1, 0.10)}, ${hexToRgba(accent2, 0.07)})`,
                    border: `1.5px solid ${hexToRgba(borderColor, 0.9)}`,
                  }}
                >
                  <div className="pd-pickup-icon" style={{ background: hexToRgba(accent1, 0.15), color: accent1 }}>
                    <Boxes style={{ width: 18, height: 18 }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: "13px", fontWeight: 700, color: accent1, margin: 0 }}>
                      Este combo incluye
                    </p>
                    <ul style={{ margin: "6px 0 0", paddingLeft: 18, color: textSecondary, fontSize: "13px", lineHeight: 1.6 }}>
                      {bundleFulfillment.components.map((component, index) => (
                        <li key={`${component.product || component.sku || "item"}-${index}`}>
                          {Number(component.quantity || 1)} × {component.title || "Producto"}
                          {component.variantLabel && component.variantLabel !== "Presentación general"
                            ? ` · ${component.variantLabel}`
                            : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {showPickup && (
                <div
                  className="pd-pickup"
                  style={{
                    background: `linear-gradient(135deg, ${hexToRgba(accent2, 0.10)}, ${hexToRgba(accent1, 0.07)})`,
                    border: `1.5px solid ${hexToRgba(borderColor, 0.9)}`,
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
                    <button
                      type="button"
                      style={{
                        marginTop: 6,
                        fontSize: "12px",
                        color: accent2,
                        textDecoration: "underline",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: 0,
                        fontFamily: "inherit",
                      }}
                    >
                      {pickupLinkText}
                    </button>
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
                        border: `1.5px solid ${hexToRgba(borderColor, 0.85)}`,
                        backgroundColor: "#ffffff",
                        boxShadow: "0 6px 18px rgba(31,23,42,0.04)",
                      }}
                    >
                      <div
                        className="pd-benefit-icon"
                        style={{
                          background: hexToRgba(accent1, 0.10),
                          color: accent1,
                        }}
                      >
                        <BenefitIcon source={item.image} fallback={item.icon}/>
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

          {showAccordionBlock && (
            <div
              style={{
                marginTop: 48,
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
              className="max-md:mt-8"
            >
              {[
                {
                  title: accordionTitle1,
                  text: accordionText1,
                  open: openAccordion1,
                  setOpen: setOpenAccordion1,
                },
                {
                  title: accordionTitle2,
                  text: accordionText2,
                  open: openAccordion2,
                  setOpen: setOpenAccordion2,
                },
              ].map((acc, i) => (
                <div
                  key={i}
                  className={`pd-accordion ${shadowClass}`}
                  style={{
                    borderRadius: radius,
                    border: `${borderWidthPx}px solid ${borderColor}`,
                    backgroundColor: "#ffffff",
                    boxShadow: "0 4px 16px rgba(31,23,42,0.05)",
                  }}
                >
                  <button
                    type="button"
                    className="pd-accordion-btn"
                    onClick={() => acc.setOpen((v) => !v)}
                    style={{ color: textPrimary }}
                  >
                    <span
                      style={{
                        fontWeight: 600,
                        fontSize: "14px",
                        flex: 1,
                        minWidth: 0,
                        textAlign: "left",
                      }}
                    >
                      {acc.title}
                    </span>
                    <ChevronDown
                      className={`pd-accordion-chevron ${acc.open ? "open" : ""}`}
                      style={{ width: 20, height: 20, color: accent1 }}
                    />
                  </button>

                  {acc.open && (
                    <div
                      className="pd-accordion-body"
                      style={{ color: textSecondary }}
                    >
                      {acc.text || "Aún no hay contenido en este acordeón."}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {publicCommercialFields.length > 0 && (
            <section
              style={{
                marginTop: 48,
                borderRadius: radius,
                border: `${borderWidthPx}px solid ${borderColor}`,
                backgroundColor: cardBg,
                padding: 24,
              }}
              className={shadowClass}
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
                  display: 'grid',
                  gridTemplateColumns:
                    'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: 12,
                  marginTop: 18,
                }}
              >
                {publicCommercialFields.map((field, index) => {
                  const fieldValue =
                    field.type === 'boolean'
                      ? String(field.value) === 'true'
                        ? 'Sí'
                        : 'No'
                      : field.value;

                  return (
                    <div
                      key={`${field.group}-${field.key}-${index}`}
                      style={{
                        borderRadius: 12,
                        border: `1px solid ${borderColor}`,
                        padding: '12px 14px',
                        backgroundColor: pageBg,
                      }}
                    >
                      <p
                        style={{
                          margin: 0,
                          color: textSecondary,
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.08em',
                        }}
                      >
                        {field.group || 'General'}
                      </p>
                      <p
                        style={{
                          margin: '5px 0 0',
                          color: textPrimary,
                          fontSize: 14,
                          lineHeight: 1.5,
                        }}
                      >
                        <strong>{field.label}:</strong>{' '}
                        {fieldValue || '—'}
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {showReviewsSection && (
            <div
              style={{
                marginTop: 56,
                fontFamily: reviewFontFamily,
                ...reviewSectionAnimationStyle,
              }}
              className="max-md:mt-10"
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
                    className={`${shadowClass} relative overflow-hidden`}
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
                              backgroundColor: reviewInputBg,
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
                              backgroundColor: reviewInputBg,
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
                    className={shadowClass}
                    style={{
                      backgroundColor: reviewListBgWithOpacity,
                      borderRadius: reviewBorderRadius,
                      border: `1.5px solid ${reviewBorderColor}`,
                    }}
                  >
                    <div style={{ padding: "24px 20px" }} className="max-md:px-4 max-md:py-5">
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
                            maxHeight: "520px",
                            overflowY: "auto",
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
                                              size={Math.max(
                                                12,
                                                reviewStarSizePx - 4
                                              )}
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
                                              0.5
                                            ),
                                            padding: "2px 10px",
                                            borderRadius: "50px",
                                            flexShrink: 0,
                                          }}
                                        >
                                          {reviewDate.toLocaleDateString(
                                            "es-CO"
                                          )}
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
          )}
        </div>
      </main>

      {withChrome && cfg.showFooter !== false && <FooterSection />}
      {withChrome && <WhatsAppButton />}
    </>
  );
}
