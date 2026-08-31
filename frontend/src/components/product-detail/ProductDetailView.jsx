import React, { useMemo, useState, useEffect } from "react";
import Header from "../Header";
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
      return {};
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

/* ─── Estilos globales de diseño (layout + micro-interacciones) ─── */
const PD_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Mulish:wght@300;400;500;600;700&display=swap');

  @keyframes pdFadeUp    { from { opacity:0; transform:translateY(24px); }  to { opacity:1; transform:translateY(0); } }
  @keyframes pdFadeRight { from { opacity:0; transform:translateX(-24px); } to { opacity:1; transform:translateX(0); } }
  @keyframes pdFadeLeft  { from { opacity:0; transform:translateX(24px); }  to { opacity:1; transform:translateX(0); } }
  @keyframes pdZoomIn    { from { opacity:0; transform:scale(0.96); }        to { opacity:1; transform:scale(1); } }
  @keyframes pdSlideIn   { from { opacity:0; transform:translateY(16px); }  to { opacity:1; transform:translateY(0); } }

  .pd-page { font-family: 'Mulish', sans-serif; -webkit-font-smoothing: antialiased; }
  .pd-page * { box-sizing: border-box; }

  .pd-breadcrumb {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    letter-spacing: 0.02em;
    margin-bottom: 28px;
    animation: pdSlideIn 300ms ease both;
  }

  @media (max-width: 767px) {
    .pd-breadcrumb {
      font-size: 11px;
      margin-bottom: 18px;
    }
  }

  .pd-breadcrumb-sep { opacity: 0.4; margin: 0 2px; }

  .pd-layout {
    display: grid;
    grid-template-columns: 1fr;
    gap: 32px;
    align-items: start;
  }

  @media (max-width: 1023px) {
    .pd-layout {
      gap: 20px;
    }
  }

  @media (max-width: 767px) {
    .pd-layout {
      gap: 16px;
    }
  }

  @media (min-width: 1024px) {
    .pd-layout {
      grid-template-columns: minmax(320px, var(--pd-gallery-col, 460px)) minmax(420px, 560px);
      gap: 26px;
      justify-content: center;
      align-items: start;
      width: fit-content;
      max-width: 100%;
      margin-left: auto;
      margin-right: auto;
    }
    .pd-layout.gallery-right {
      grid-template-columns: minmax(420px, 560px) minmax(320px, var(--pd-gallery-col, 460px));
    }
  }

  @media (min-width: 1280px) {
    .pd-layout {
      gap: 30px;
    }
  }

  @media (min-width: 1024px) {
    .pd-gallery-sticky { position: sticky; top: 100px; }
  }

  .pd-main-img-wrap {
    overflow: hidden;
    width: 100%;
    position: relative;
    animation: pdSlideIn 350ms ease both;
  }

  @media (max-width: 1023px) {
    .pd-main-img-wrap {
      margin-left: auto;
      margin-right: auto;
    }
  }

  .pd-main-img {
    width: 100%;
    height: 100%;
    display: block;
    transition: transform 0.5s cubic-bezier(.25,.46,.45,.94);
  }

  .pd-main-img-wrap:hover .pd-main-img-zoom { transform: scale(1.04); }

  .pd-discount-badge {
    position: absolute;
    top: 14px;
    left: 14px;
    z-index: 4;
    padding: 4px 10px;
    border-radius: 50px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: #fff;
    pointer-events: none;
  }

  @media (max-width: 767px) {
    .pd-discount-badge {
      top: 10px;
      left: 10px;
      font-size: 10px;
      padding: 4px 8px;
    }
  }

  .pd-thumbs-left {
    display: none;
    flex-direction: column;
  }

  @media (min-width: 1024px) {
    .pd-thumbs-left { display: flex; }
  }

  .pd-thumbs-bottom {
    display: none;
    flex-wrap: wrap;
    padding-top: 12px;
  }

  @media (min-width: 1024px) {
    .pd-thumbs-bottom { display: flex; }
  }

  .pd-thumbs-mobile {
    display: flex;
    overflow-x: auto;
    padding-bottom: 4px;
    margin-top: 14px;
    scrollbar-width: none;
  }

  .pd-thumbs-mobile::-webkit-scrollbar { display: none; }

  @media (max-width: 1023px) {
    .pd-thumbs-mobile {
      width: 100%;
      justify-content: center;
      align-items: center;
      flex-wrap: wrap;
      overflow-x: visible;
      margin-top: 12px;
      padding-bottom: 0;
    }
  }

  @media (min-width: 1024px) {
    .pd-thumbs-mobile { display: none; }
  }

  .pd-thumb-btn {
    overflow: hidden;
    flex-shrink: 0;
    background: #fff;
    transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s;
    cursor: pointer;
    border: none;
    padding: 0;
  }

  .pd-thumb-btn:hover { transform: translateY(-2px); }

  .pd-content {
    animation: pdSlideIn 400ms 80ms ease both;
    width: 100%;
    max-width: none;
  }

  .pd-divider {
    height: 1px;
    width: 100%;
    margin: 24px 0;
    opacity: 0.15;
  }

  @media (max-width: 767px) {
    .pd-divider {
      margin: 18px 0;
    }
  }

  .pd-product-title {
    font-family: 'Playfair Display', serif;
    font-weight: 700;
    line-height: 1.1;
    letter-spacing: -0.02em;
  }

  .pd-price-row {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    margin-top: 16px;
  }

  @media (max-width: 767px) {
    .pd-price-row {
      gap: 8px;
      margin-top: 12px;
    }
  }

  .pd-price-original {
    font-size: 15px;
    text-decoration: line-through;
    opacity: 0.45;
  }

  @media (max-width: 767px) {
    .pd-price-original {
      font-size: 13px;
    }
  }

  .pd-price-main {
    font-family: 'Playfair Display', serif;
    font-weight: 700;
    letter-spacing: -0.5px;
    line-height: 1;
  }

  .pd-section-label {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    margin-bottom: 12px;
    display: block;
  }

  @media (max-width: 767px) {
    .pd-section-label {
      font-size: 10px;
      margin-bottom: 10px;
    }
  }

  .pd-size-btn {
    min-width: 44px;
    height: 40px;
    padding: 0 14px;
    font-size: 13px;
    font-weight: 600;
    border: 1.5px solid;
    cursor: pointer;
    transition: all 0.18s ease;
    letter-spacing: 0.02em;
    font-family: 'Mulish', sans-serif;
  }

  @media (max-width: 767px) {
    .pd-size-btn {
      min-width: 40px;
      height: 36px;
      padding: 0 12px;
      font-size: 12px;
    }
  }

  .pd-size-btn:hover:not(.active) { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.10); }
  .pd-size-btn:active { transform: scale(0.96); }

  .pd-color-dot {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: 2px solid;
    cursor: pointer;
    transition: transform 0.18s, box-shadow 0.18s;
    padding: 0;
  }

  @media (max-width: 767px) {
    .pd-color-dot {
      width: 28px;
      height: 28px;
    }
  }

  .pd-color-dot:hover { transform: scale(1.15); }
  .pd-color-dot.active { transform: scale(1.1); }

  .pd-color-chip {
    padding: 7px 16px;
    font-size: 13px;
    font-weight: 500;
    border: 1.5px solid;
    cursor: pointer;
    transition: all 0.18s ease;
    font-family: 'Mulish', sans-serif;
  }

  @media (max-width: 767px) {
    .pd-color-chip {
      padding: 6px 12px;
      font-size: 12px;
    }
  }

  .pd-color-chip:hover:not(.active) { transform: translateY(-1px); }

  .pd-qty-wrap {
    display: inline-grid;
    grid-template-columns: 40px 44px 40px;
    overflow: hidden;
  }

  @media (max-width: 767px) {
    .pd-qty-wrap {
      grid-template-columns: 38px 44px 38px;
      width: fit-content;
    }
  }

  .pd-qty-btn {
    height: 44px;
    font-size: 18px;
    font-weight: 300;
    border: none;
    cursor: pointer;
    transition: background 0.15s;
    font-family: 'Mulish', sans-serif;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  @media (max-width: 767px) {
    .pd-qty-btn {
      height: 40px;
      font-size: 16px;
    }
  }

  .pd-qty-btn:hover { filter: brightness(0.94); }

  .pd-qty-val {
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.04em;
  }

  @media (max-width: 767px) {
    .pd-qty-val {
      height: 40px;
      font-size: 13px;
    }
  }

  .pd-add-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    font-weight: 700;
    font-family: 'Mulish', sans-serif;
    letter-spacing: 0.04em;
    font-size: 14px;
    border: none;
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s, opacity 0.2s;
    text-transform: uppercase;
  }

  @media (max-width: 767px) {
    .pd-add-btn {
      width: 100%;
      font-size: 12px;
      gap: 8px;
    }
  }

  .pd-add-btn:hover  { transform: translateY(-2px); }
  .pd-add-btn:active { transform: scale(0.97); opacity: 0.92; }

  .pd-qty-cta {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  @media (min-width: 480px) {
    .pd-qty-cta {
      flex-direction: row;
      align-items: center;
    }
    .pd-add-btn { flex: 1; }
  }

  @media (max-width: 767px) {
    .pd-qty-cta {
      gap: 12px;
    }
  }

  .pd-pickup {
    border-radius: 16px;
    padding: 16px 18px;
    margin-top: 24px;
    display: flex;
    align-items: flex-start;
    gap: 14px;
  }

  @media (max-width: 767px) {
    .pd-pickup {
      padding: 14px;
      gap: 12px;
      margin-top: 20px;
    }
  }

  .pd-pickup-icon {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    font-size: 18px;
  }

  @media (max-width: 767px) {
    .pd-pickup-icon {
      width: 32px;
      height: 32px;
    }
  }

  .pd-benefits {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    margin-top: 28px;
  }

  @media (max-width: 767px) {
    .pd-benefits {
      grid-template-columns: 1fr;
      gap: 8px;
      margin-top: 20px;
    }
  }

  .pd-benefit-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 8px;
    padding: 14px 10px;
    border-radius: 14px;
    transition: transform 0.2s, box-shadow 0.2s;
    cursor: default;
  }

  .pd-benefit-card:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(31,23,42,0.08); }

  .pd-benefit-icon {
    width: 38px;
    height: 38px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  @media (max-width: 767px) {
    .pd-benefit-card {
      flex-direction: row;
      text-align: left;
      padding: 12px 14px;
      justify-content: flex-start;
    }
  }

  .pd-accordion {
    overflow: hidden;
    transition: box-shadow 0.2s;
  }

  .pd-accordion-btn {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 16px 20px;
    text-align: left;
    border: none;
    cursor: pointer;
    background: transparent;
    font-family: 'Mulish', sans-serif;
    transition: background 0.15s;
  }

  @media (max-width: 767px) {
    .pd-accordion-btn {
      padding: 14px 16px;
      gap: 12px;
    }
  }

  .pd-accordion-btn:hover { filter: brightness(0.98); }

  .pd-accordion-chevron {
    transition: transform 0.3s ease;
    flex-shrink: 0;
  }

  .pd-accordion-chevron.open { transform: rotate(180deg); }

  .pd-accordion-body {
    padding: 0 20px 20px;
    font-size: 14px;
    line-height: 1.8;
    white-space: pre-line;
    animation: pdSlideIn 200ms ease both;
  }

  @media (max-width: 767px) {
    .pd-accordion-body {
      padding: 0 16px 16px;
      font-size: 13px;
      line-height: 1.7;
    }
  }

  .pd-reviews-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 24px;
  }

  @media (min-width: 1024px) {
    .pd-reviews-grid.two-col {
      grid-template-columns: 1fr 1fr;
      gap: 28px;
    }
  }

  .pd-reviews-list::-webkit-scrollbar { width: 4px; }
  .pd-reviews-list::-webkit-scrollbar-track { background: transparent; }
  .pd-reviews-list::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 4px; }

  .pd-input {
    width: 100%;
    padding: 11px 14px;
    outline: none;
    font-family: 'Mulish', sans-serif;
    transition: border-color 0.18s, box-shadow 0.18s;
  }

  .pd-input:focus { box-shadow: 0 0 0 3px rgba(236,72,153,0.12); }

  .pd-fav-btn {
    flex-shrink: 0;
    border-radius: 50%;
    padding: 10px;
    border: 1.5px solid;
    background: #fff;
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  @media (max-width: 767px) {
    .pd-fav-btn {
      padding: 8px;
    }
  }

  .pd-fav-btn:hover { transform: scale(1.1); }
  .pd-fav-btn:active { transform: scale(0.94); }

  .pd-section-gap { margin-top: 28px; }

  @media (min-width: 768px) {
    .pd-section-gap { margin-top: 36px; }
  }

  @media (max-width: 767px) {
    .pd-section-gap { margin-top: 20px; }
  }
`;

/* ─── Componente principal ─── */
export default function ProductDetailView({
  product,
  config,
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
  const cfg = config || {};

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
  const [openAccordion1, setOpenAccordion1] = useState(false);
  const [openAccordion2, setOpenAccordion2] = useState(false);

  useEffect(() => {
    setMainImage(images[0] || "");
  }, [images, product?.selectedVariantKey]);

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
      title: cfg.benefit1Title || "Hecho con amor",
    },
    {
      icon: <Leaf className="w-5 h-5" />,
      title: cfg.benefit2Title || "Materiales hipoalergénicos",
    },
    {
      icon: <Truck className="w-5 h-5" />,
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
        border: `1.5px solid ${borderColor}`,
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
        src={displayedMainImage}
        alt={visibleTitle}
        className={`pd-main-img ${imageHoverZoom ? "pd-main-img-zoom" : ""}`}
        style={{
          objectFit: imageFit,
          maxHeight: `${mainImageMaxHeightPx}px`,
        }}
      />
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
      <style>{PD_STYLES}</style>

      <Header />

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
                  {visibleTitle}
                </h1>

                {showFavorite && (
                  <button
                    type="button"
                    onClick={onToggleFavorite}
                    className="pd-fav-btn"
                    aria-label="Favorito"
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
                        border: `1.5px solid ${borderColor}`,
                        backgroundColor: "#ffffff",
                        boxShadow: "inset 0 1px 3px rgba(0,0,0,0.04)",
                      }}
                    >
                      <button
                        type="button"
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
                        onClick={() => setQuantity((q) => q + 1)}
                        disabled={
                          inventoryTracked &&
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
                        disabled={inventoryTracked && selectedAvailableStock <= 0}
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
                          opacity: inventoryTracked && selectedAvailableStock <= 0 ? 0.55 : 1,
                          cursor: inventoryTracked && selectedAvailableStock <= 0 ? "not-allowed" : "pointer",
                        }}
                      >
                        <AddToCartIcon
                          style={{ width: 18, height: 18, color: addToCartIconColor }}
                        />
                        {inventoryTracked && selectedAvailableStock <= 0
                          ? "Agotado"
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
                        {item.icon}
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
                    border: `1.5px solid ${borderColor}`,
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
                border: `1.5px solid ${borderColor}`,
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

      <FooterSection />
      <WhatsAppButton />
    </>
  );
}
