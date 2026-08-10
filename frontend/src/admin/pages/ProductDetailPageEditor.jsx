import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { API_BASE_URL } from "../../config/apiBaseUrl";

const API_BASE = API_BASE_URL;

const EDITOR_TABS = [
  { id: "general", label: "General" },
  { id: "layout", label: "Estructura" },
  { id: "gallery", label: "Galería" },
  { id: "info", label: "Información" },
  { id: "style", label: "Estilo" },
  { id: "reviews", label: "Reseñas" },
  { id: "extra", label: "Bloques extra" },
];

const SHADOW_OPTIONS = [
  { value: "none", label: "Sin sombra" },
  { value: "soft", label: "Suave" },
  { value: "medium", label: "Media" },
  { value: "strong", label: "Fuerte" },
];

const GALLERY_POSITION_OPTIONS = [
  { value: "left", label: "Galería a la izquierda" },
  { value: "right", label: "Galería a la derecha" },
];

const THUMBNAIL_POSITION_OPTIONS = [
  { value: "left", label: "Miniaturas a la izquierda" },
  { value: "bottom", label: "Miniaturas abajo" },
];

const TITLE_MODE_OPTIONS = [
  { value: "text", label: "Título en texto" },
  { value: "image", label: "Título con imagen" },
];

const IMAGE_FIT_OPTIONS = [
  { value: "cover", label: "Cubrir (cover)" },
  { value: "contain", label: "Contener (contain)" },
];

const ANIMATION_OPTIONS = [
  { value: "none", label: "Sin animación" },
  { value: "fade-up", label: "Aparecer hacia arriba" },
  { value: "fade-right", label: "Aparecer desde izquierda" },
  { value: "fade-left", label: "Aparecer desde derecha" },
  { value: "zoom-in", label: "Zoom de entrada" },
];

const THUMB_HOVER_OPTIONS = [
  { value: "none", label: "Sin hover especial" },
  { value: "scale", label: "Escalar miniatura" },
  { value: "lift", label: "Elevar miniatura" },
  { value: "glow", label: "Brillo miniatura" },
];

const REVIEW_FONT_FAMILY_OPTIONS = [
  { value: "inherit", label: "Heredar del sitio" },
  { value: "Arial, sans-serif", label: "Arial" },
  { value: "Helvetica, Arial, sans-serif", label: "Helvetica" },
  { value: "'Inter', sans-serif", label: "Inter" },
  { value: "'Poppins', sans-serif", label: "Poppins" },
  { value: "'Montserrat', sans-serif", label: "Montserrat" },
  { value: "'Playfair Display', serif", label: "Playfair Display" },
  { value: "'Georgia', serif", label: "Georgia" },
];

const REVIEW_STAR_TYPE_OPTIONS = [
  { value: "star", label: "⭐ Estrella" },
  { value: "heart", label: "❤️ Corazón" },
  { value: "fire", label: "🔥 Fuego" },
  { value: "thumb", label: "👍 Like" },
];

const REVIEW_STAR_STYLE_OPTIONS = [
  { value: "fill", label: "Relleno" },
  { value: "outline", label: "Contorno" },
];

const FAVORITE_ICON_OPTIONS = [
  { value: "star", label: "Estrella" },
  { value: "heart", label: "Corazón" },
  { value: "sparkles", label: "Destello" },
];

const CART_ICON_OPTIONS = [
  { value: "shopping-cart", label: "Carrito clásico" },
  { value: "shopping-bag", label: "Bolsa" },
  { value: "bag-heart", label: "Bolsa con corazón" },
];

const Input = ({ label, ...rest }) => (
  <label className="block min-w-0">
    <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
    <input
      className="w-full min-w-0 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-pink-300 focus:ring-2 focus:ring-pink-200"
      {...rest}
    />
  </label>
);

const Textarea = ({ label, ...rest }) => (
  <label className="block min-w-0">
    <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
    <textarea
      className="min-h-[110px] w-full min-w-0 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-pink-300 focus:ring-2 focus:ring-pink-200"
      {...rest}
    />
  </label>
);

const Select = ({ label, children, ...rest }) => (
  <label className="block min-w-0">
    <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
    <select
      className="w-full min-w-0 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-pink-300 focus:ring-2 focus:ring-pink-200"
      {...rest}
    >
      {children}
    </select>
  </label>
);

const Toggle = ({ label, checked, onChange }) => (
  <label className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
    <span className="text-sm text-gray-700">{label}</span>
    <input
      type="checkbox"
      checked={!!checked}
      onChange={(e) => onChange(e.target.checked)}
      className="h-4 w-4 shrink-0 accent-pink-600"
    />
  </label>
);

const ColorInput = ({ label, value, onChange }) => (
  <label className="block min-w-0">
    <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
    <div className="flex items-center gap-3 rounded-xl border border-gray-300 bg-white px-3 py-2.5">
      <input
        type="color"
        value={isHexColor(value) ? value : "#ec4899"}
        onChange={onChange}
        className="h-10 w-12 cursor-pointer rounded border border-gray-200 bg-white"
      />
      <input
        type="text"
        value={value || ""}
        onChange={onChange}
        className="w-full min-w-0 bg-transparent text-sm text-gray-800 outline-none"
        placeholder="#ec4899"
      />
    </div>
  </label>
);

const RangeInput = ({
  label,
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.05,
}) => (
  <label className="block min-w-0">
    <div className="mb-1 flex items-center justify-between gap-3">
      <span className="block text-sm font-medium text-gray-700">{label}</span>
      <span className="text-xs font-medium text-pink-700">
        {Number(value || 0).toFixed(2)}
      </span>
    </div>

    <div className="rounded-xl border border-gray-300 bg-white px-3 py-3">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={onChange}
        className="w-full accent-pink-600"
      />
    </div>
  </label>
);

const TabButton = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={[
      "rounded-2xl border px-4 py-2.5 text-sm font-medium transition",
      active
        ? "border-pink-500 bg-pink-600 text-white shadow-sm"
        : "border-pink-100 bg-white text-pink-700 hover:border-pink-200 hover:bg-pink-50",
    ].join(" ")}
  >
    {children}
  </button>
);

const InfoCard = ({ title, text }) => (
  <div className="rounded-2xl border border-pink-100 bg-gradient-to-r from-pink-50 to-rose-50 px-4 py-3">
    <div className="text-sm font-semibold text-pink-700">{title}</div>
    <p className="mt-1 text-sm leading-6 text-gray-600">{text}</p>
  </div>
);

function SectionCard({ title, text, children, className = "" }) {
  return (
    <section
      className={`space-y-4 rounded-3xl border border-gray-200 bg-white p-4 md:p-5 ${className}`}
    >
      <div>
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        {text ? <p className="mt-1 text-sm text-gray-500">{text}</p> : null}
      </div>
      {children}
    </section>
  );
}

function IconUploadField({
  label,
  value,
  preview,
  inputRef,
  onPick,
  onFileChange,
  onUpload,
  uploading,
  onUrlChange,
  disabledUpload,
}) {
  const previewSrc = preview || value || "";

  return (
    <div className="space-y-3 rounded-2xl border border-gray-200 bg-gray-50 p-4">
      <Input
        label={label}
        value={value || ""}
        onChange={onUrlChange}
        placeholder="https://... o sube una imagen"
      />

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFileChange}
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onPick}
          className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
        >
          Escoger imagen
        </button>

        <button
          type="button"
          onClick={onUpload}
          disabled={uploading || disabledUpload}
          className="rounded-xl bg-pink-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-pink-700 disabled:opacity-50"
        >
          {uploading ? "Subiendo..." : "Subir a Cloudinary"}
        </button>
      </div>

      <div className="rounded-xl border border-dashed border-gray-300 bg-white p-3">
        <div className="mb-2 text-sm font-medium text-gray-700">Vista previa</div>
        <div className="flex min-h-[90px] items-center justify-center rounded-xl bg-gray-50 p-3">
          {previewSrc ? (
            <img
              src={previewSrc}
              alt="Vista previa"
              className="max-h-[80px] max-w-full object-contain"
            />
          ) : (
            <div className="text-sm text-gray-400">Aún no hay imagen seleccionada.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

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

function isHexColor(value) {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(value || "").trim());
}

function buildSafeStyleConfig(raw) {
  const cfg = raw && typeof raw === "object" ? raw : {};
  return {
    pageBg: typeof cfg.pageBg === "string" ? cfg.pageBg : "#fff1f2",
    cardBg: typeof cfg.cardBg === "string" ? cfg.cardBg : "#ffffff",
    primaryTextColor:
      typeof cfg.primaryTextColor === "string" ? cfg.primaryTextColor : "#111827",
    secondaryTextColor:
      typeof cfg.secondaryTextColor === "string" ? cfg.secondaryTextColor : "#6b7280",
    accentColor: typeof cfg.accentColor === "string" ? cfg.accentColor : "#ec4899",
    accentColor2: typeof cfg.accentColor2 === "string" ? cfg.accentColor2 : "#d4af37",
    borderColor: typeof cfg.borderColor === "string" ? cfg.borderColor : "#e5e7eb",
    radiusPx: clampInt(cfg.radiusPx, 8, 40, 18),
    borderWidthPx: clampInt(cfg.borderWidthPx, 1, 4, 1),
    shadowStyle:
      cfg.shadowStyle === "none" ||
      cfg.shadowStyle === "soft" ||
      cfg.shadowStyle === "medium" ||
      cfg.shadowStyle === "strong"
        ? cfg.shadowStyle
        : "soft",
    titleSizePx: clampInt(cfg.titleSizePx, 20, 52, 32),
    priceSizePx: clampInt(cfg.priceSizePx, 20, 48, 30),
    buttonRadiusPx: clampInt(cfg.buttonRadiusPx, 8, 40, 999),
    thumbRadiusPx: clampInt(cfg.thumbRadiusPx, 4, 24, 10),
    thumbBorderColor:
      typeof cfg.thumbBorderColor === "string" ? cfg.thumbBorderColor : "#d4af37",
    selectedThumbBorderColor:
      typeof cfg.selectedThumbBorderColor === "string"
        ? cfg.selectedThumbBorderColor
        : "#ec4899",

    favoriteButtonBg:
      typeof cfg.favoriteButtonBg === "string" ? cfg.favoriteButtonBg : "#ffffff",
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
      typeof cfg.reviewTextColor === "string"
        ? cfg.reviewTextColor
        : "#374151",
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
      typeof cfg.reviewErrorText === "string"
        ? cfg.reviewErrorText
        : "#be123c",
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
      0.35
    ),
  };
}

function buildSafeProductDetailConfig(raw) {
  const cfg = raw && typeof raw === "object" ? raw : {};

  const imageFit =
    cfg.imageFit === "contain" || cfg.imageFit === "cover"
      ? cfg.imageFit
      : "cover";

  const imageAnimation =
    ["none", "fade-up", "fade-right", "fade-left", "zoom-in"].includes(
      cfg.imageAnimation
    )
      ? cfg.imageAnimation
      : "none";

  const contentAnimation =
    ["none", "fade-up", "fade-right", "fade-left", "zoom-in"].includes(
      cfg.contentAnimation
    )
      ? cfg.contentAnimation
      : "none";

  const thumbHoverEffect =
    ["none", "scale", "lift", "glow"].includes(cfg.thumbHoverEffect)
      ? cfg.thumbHoverEffect
      : "none";

  const thumbnailPosition =
    cfg.thumbnailPosition === "bottom" || cfg.thumbnailPosition === "left"
      ? cfg.thumbnailPosition
      : "left";

  const reviewSectionAnimation =
    ["none", "fade-up", "fade-right", "fade-left", "zoom-in"].includes(
      cfg.reviewSectionAnimation
    )
      ? cfg.reviewSectionAnimation
      : "none";

  const reviewStarType =
    ["star", "heart", "fire", "thumb"].includes(cfg.reviewStarType)
      ? cfg.reviewStarType
      : "star";

  const reviewStarStyle =
    ["fill", "outline"].includes(cfg.reviewStarStyle)
      ? cfg.reviewStarStyle
      : "fill";

  return {
    titleMode:
      cfg.titleMode === "image" || cfg.titleMode === "text" ? cfg.titleMode : "text",
    titleImage: typeof cfg.titleImage === "string" ? cfg.titleImage : "",
    titleImageAlt: typeof cfg.titleImageAlt === "string" ? cfg.titleImageAlt : "",
    titleOverride: typeof cfg.titleOverride === "string" ? cfg.titleOverride : "",
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
      typeof cfg.favoriteIconColor === "string" ? cfg.favoriteIconColor : "#ec4899",
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
      typeof cfg.benefit3Icon === "string" ? cfg.benefit3Icon : "/icons/Envios.png",

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
      typeof cfg.reviewSectionTitle === "string" && cfg.reviewSectionTitle.trim()
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
      typeof cfg.reviewCommentLabel === "string" && cfg.reviewCommentLabel.trim()
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

export default function ProductDetailPageEditor() {
  const navigate = useNavigate();
  const { id } = useParams();
  const titleImageInputRef = useRef(null);

  const benefit1IconInputRef = useRef(null);
  const benefit2IconInputRef = useRef(null);
  const benefit3IconInputRef = useRef(null);
  const reviewFormBgImageInputRef = useRef(null);

  const [page, setPage] = useState(null);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("general");

  const [titleImageFile, setTitleImageFile] = useState(null);
  const [titleImagePreview, setTitleImagePreview] = useState("");
  const [uploadingTitleImage, setUploadingTitleImage] = useState(false);

  const [benefit1IconFile, setBenefit1IconFile] = useState(null);
  const [benefit2IconFile, setBenefit2IconFile] = useState(null);
  const [benefit3IconFile, setBenefit3IconFile] = useState(null);
  const [reviewFormBgImageFile, setReviewFormBgImageFile] = useState(null);

  const [benefit1IconPreview, setBenefit1IconPreview] = useState("");
  const [benefit2IconPreview, setBenefit2IconPreview] = useState("");
  const [benefit3IconPreview, setBenefit3IconPreview] = useState("");
  const [reviewFormBgImagePreview, setReviewFormBgImagePreview] = useState("");

  const [uploadingBenefit1Icon, setUploadingBenefit1Icon] = useState(false);
  const [uploadingBenefit2Icon, setUploadingBenefit2Icon] = useState(false);
  const [uploadingBenefit3Icon, setUploadingBenefit3Icon] = useState(false);
  const [uploadingReviewFormBgImage, setUploadingReviewFormBgImage] =
    useState(false);

  const previewUrl = useMemo(() => {
    const slug = String(form?.slug || page?.slug || "").trim();
    if (!slug) return "";
    return `/pagina/${slug}`;
  }, [form?.slug, page?.slug]);

  const fetchPage = async () => {
    try {
      setLoading(true);
      setNotFound(false);

      const res = await fetch(`${API_BASE}/api/pages/${id}`);

      if (res.status === 404) {
        setPage(null);
        setForm(null);
        setNotFound(true);
        return;
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      const safeConfig = buildSafeProductDetailConfig(data?.productDetailConfig);

      setPage(data);
      setForm({
        name: typeof data?.name === "string" ? data.name : "",
        slug: typeof data?.slug === "string" ? data.slug : "",
        pageType: "product-detail",
        enabled: data?.enabled !== false,
        useHeader: data?.useHeader !== false,
        useFooter: data?.useFooter !== false,
        productDetailConfig: safeConfig,
      });
      setTitleImagePreview(String(safeConfig?.titleImage || ""));
      setTitleImageFile(null);

      setBenefit1IconPreview(String(safeConfig?.benefit1Icon || ""));
      setBenefit2IconPreview(String(safeConfig?.benefit2Icon || ""));
      setBenefit3IconPreview(String(safeConfig?.benefit3Icon || ""));
      setReviewFormBgImagePreview(
        String(safeConfig?.style?.reviewFormBgImage || "")
      );

      setBenefit1IconFile(null);
      setBenefit2IconFile(null);
      setBenefit3IconFile(null);
      setReviewFormBgImageFile(null);
    } catch (error) {
      console.error("Error cargando página detalle:", error);
      setPage(null);
      setForm(null);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchPage();
  }, [id]);

  const updateRoot = (patch) => {
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const updateDetailConfig = (patch) => {
    setForm((prev) => ({
      ...prev,
      productDetailConfig: {
        ...(prev?.productDetailConfig || {}),
        ...patch,
      },
    }));
  };

  const updateStyleConfig = (patch) => {
    setForm((prev) => ({
      ...prev,
      productDetailConfig: {
        ...(prev?.productDetailConfig || {}),
        style: {
          ...buildSafeStyleConfig(prev?.productDetailConfig?.style),
          ...patch,
        },
      },
    }));
  };

  const handleNameChange = (value) => {
    setForm((prev) => {
      const currentSlug = String(prev?.slug || "").trim();
      const autoSlug = slugify(value);

      return {
        ...prev,
        name: value,
        slug: currentSlug ? currentSlug : autoSlug,
      };
    });
  };

  const handlePickTitleImage = () => {
    titleImageInputRef.current?.click();
  };

  const handleTitleImageSelected = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setTitleImageFile(file);
    const localUrl = URL.createObjectURL(file);
    setTitleImagePreview(localUrl);
  };

  const handleUploadTitleImage = async () => {
    if (!titleImageFile) {
      alert("Primero selecciona una imagen.");
      return;
    }

    try {
      setUploadingTitleImage(true);

      const body = new FormData();
      body.append("file", titleImageFile);

      const res = await fetch(`${API_BASE}/api/uploads`, {
        method: "POST",
        body,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.url) {
        throw new Error(data?.error || "No se pudo subir la imagen.");
      }

      updateDetailConfig({ titleImage: data.url, titleMode: "image" });
      setTitleImagePreview(data.url);
      setTitleImageFile(null);

      if (titleImageInputRef.current) {
        titleImageInputRef.current.value = "";
      }

      alert("Imagen subida correctamente ✅");
    } catch (error) {
      console.error("Error subiendo imagen de título:", error);
      alert(error.message || "No se pudo subir la imagen a Cloudinary.");
    } finally {
      setUploadingTitleImage(false);
    }
  };

  const handlePickBenefitIcon = (index) => {
    if (index === 1) benefit1IconInputRef.current?.click();
    if (index === 2) benefit2IconInputRef.current?.click();
    if (index === 3) benefit3IconInputRef.current?.click();
  };

  const handleBenefitIconSelected = (index, event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const localUrl = URL.createObjectURL(file);

    if (index === 1) {
      setBenefit1IconFile(file);
      setBenefit1IconPreview(localUrl);
    }

    if (index === 2) {
      setBenefit2IconFile(file);
      setBenefit2IconPreview(localUrl);
    }

    if (index === 3) {
      setBenefit3IconFile(file);
      setBenefit3IconPreview(localUrl);
    }
  };

  const handleUploadBenefitIcon = async (index) => {
    const file =
      index === 1
        ? benefit1IconFile
        : index === 2
        ? benefit2IconFile
        : benefit3IconFile;

    if (!file) {
      alert("Primero selecciona una imagen.");
      return;
    }

    try {
      if (index === 1) setUploadingBenefit1Icon(true);
      if (index === 2) setUploadingBenefit2Icon(true);
      if (index === 3) setUploadingBenefit3Icon(true);

      const body = new FormData();
      body.append("file", file);

      const res = await fetch(`${API_BASE}/api/uploads`, {
        method: "POST",
        body,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.url) {
        throw new Error(data?.error || "No se pudo subir la imagen.");
      }

      if (index === 1) {
        updateDetailConfig({ benefit1Icon: data.url });
        setBenefit1IconPreview(data.url);
        setBenefit1IconFile(null);
        if (benefit1IconInputRef.current) {
          benefit1IconInputRef.current.value = "";
        }
      }

      if (index === 2) {
        updateDetailConfig({ benefit2Icon: data.url });
        setBenefit2IconPreview(data.url);
        setBenefit2IconFile(null);
        if (benefit2IconInputRef.current) {
          benefit2IconInputRef.current.value = "";
        }
      }

      if (index === 3) {
        updateDetailConfig({ benefit3Icon: data.url });
        setBenefit3IconPreview(data.url);
        setBenefit3IconFile(null);
        if (benefit3IconInputRef.current) {
          benefit3IconInputRef.current.value = "";
        }
      }

      alert("Ícono subido correctamente ✅");
    } catch (error) {
      console.error("Error subiendo ícono del beneficio:", error);
      alert(error.message || "No se pudo subir el ícono a Cloudinary.");
    } finally {
      if (index === 1) setUploadingBenefit1Icon(false);
      if (index === 2) setUploadingBenefit2Icon(false);
      if (index === 3) setUploadingBenefit3Icon(false);
    }
  };

  const handlePickReviewFormBgImage = () => {
    reviewFormBgImageInputRef.current?.click();
  };

  const handleReviewFormBgImageSelected = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setReviewFormBgImageFile(file);
    const localUrl = URL.createObjectURL(file);
    setReviewFormBgImagePreview(localUrl);
  };

  const handleUploadReviewFormBgImage = async () => {
    if (!reviewFormBgImageFile) {
      alert("Primero selecciona una imagen.");
      return;
    }

    try {
      setUploadingReviewFormBgImage(true);

      const body = new FormData();
      body.append("file", reviewFormBgImageFile);

      const res = await fetch(`${API_BASE}/api/uploads`, {
        method: "POST",
        body,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.url) {
        throw new Error(data?.error || "No se pudo subir la imagen.");
      }

      updateStyleConfig({ reviewFormBgImage: data.url });
      setReviewFormBgImagePreview(data.url);
      setReviewFormBgImageFile(null);

      if (reviewFormBgImageInputRef.current) {
        reviewFormBgImageInputRef.current.value = "";
      }

      alert("Fondo del formulario subido correctamente ✅");
    } catch (error) {
      console.error("Error subiendo fondo del formulario de reseñas:", error);
      alert(error.message || "No se pudo subir la imagen a Cloudinary.");
    } finally {
      setUploadingReviewFormBgImage(false);
    }
  };

  const handleSave = async () => {
    if (!form) return;

    const name = String(form.name || "").trim();
    const slug = slugify(form.slug || form.name);

    if (!name) {
      alert("El nombre de la página es obligatorio.");
      return;
    }

    if (!slug) {
      alert("El slug de la página es obligatorio.");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        name,
        slug,
        pageType: "product-detail",
        enabled: form.enabled !== false,
        useHeader: form.useHeader !== false,
        useFooter: form.useFooter !== false,
        blocks: Array.isArray(page?.blocks) ? page.blocks : [],
        productDetailConfig: buildSafeProductDetailConfig(form.productDetailConfig),
      };

      const res = await fetch(`${API_BASE}/api/pages/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.message || `HTTP ${res.status}`);
      }

      setPage(data);
      setForm({
        name: typeof data?.name === "string" ? data.name : "",
        slug: typeof data?.slug === "string" ? data.slug : "",
        pageType: "product-detail",
        enabled: data?.enabled !== false,
        useHeader: data?.useHeader !== false,
        useFooter: data?.useFooter !== false,
        productDetailConfig: buildSafeProductDetailConfig(data?.productDetailConfig),
      });

      setBenefit1IconPreview(String(data?.productDetailConfig?.benefit1Icon || ""));
      setBenefit2IconPreview(String(data?.productDetailConfig?.benefit2Icon || ""));
      setBenefit3IconPreview(String(data?.productDetailConfig?.benefit3Icon || ""));
      setReviewFormBgImagePreview(
        String(data?.productDetailConfig?.style?.reviewFormBgImage || "")
      );

      alert("Página detalle guardada correctamente ✅");
    } catch (error) {
      console.error("Error guardando página detalle:", error);
      alert(error.message || "No se pudo guardar la página detalle.");
    } finally {
      setSaving(false);
    }
  };

  const handleOpenPreview = () => {
    if (!previewUrl) {
      alert("La página todavía no tiene un slug válido para vista previa.");
      return;
    }
    window.open(previewUrl, "_blank", "noopener,noreferrer");
  };

  if (loading) {
    return <div className="p-6 text-gray-500">Cargando página detalle...</div>;
  }

  if (notFound || !page || !form) {
    return <div className="p-6 text-red-500">Página detalle no encontrada</div>;
  }

  if (String(page?.pageType || "").toLowerCase() !== "product-detail") {
    return (
      <div className="space-y-4 p-6">
        <div className="text-red-500">Esta página no es de tipo detalle de producto.</div>
        <button
          type="button"
          onClick={() => navigate("/admin/paginas")}
          className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm"
        >
          ← Volver
        </button>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => navigate("/admin/paginas")}
            className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm"
          >
            ← Volver
          </button>

          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Editor de página detalle de producto
            </h1>
            <p className="text-sm text-gray-500">
              Configura estructura y estilo de un molde para la vista detalle.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleOpenPreview}
            className="inline-flex items-center gap-2 rounded-xl border border-pink-300 bg-pink-50 px-4 py-2 text-sm font-medium text-pink-700 hover:bg-pink-100"
          >
            Vista previa
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-pink-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-pink-700 disabled:opacity-60"
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>

      <InfoCard
        title="Molde detalle de producto"
        text="Desde aquí controlas galería, información, botones, estilos, bloques de beneficios, acordeones y ahora también el bloque de reseñas."
      />

      <div className="rounded-3xl border border-pink-100 bg-gradient-to-br from-white to-pink-50/60 p-3 md:p-4">
        <div className="flex flex-wrap gap-2">
          {EDITOR_TABS.map((tab) => (
            <TabButton
              key={tab.id}
              active={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </TabButton>
          ))}
        </div>
      </div>

      {activeTab === "general" && (
        <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <SectionCard
            title="Configuración general"
            text="Datos principales de la página detalle."
            className="bg-gray-50"
          >
            <Input
              label="Nombre de la página"
              value={form.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Ej: Detalle principal"
            />

            <Input
              label="Slug / ruta"
              value={form.slug}
              onChange={(e) => updateRoot({ slug: slugify(e.target.value) })}
              placeholder="Ej: detalle-principal"
            />

            <Toggle
              label="Página activa"
              checked={form.enabled}
              onChange={(value) => updateRoot({ enabled: value })}
            />

            <Toggle
              label="Usar header"
              checked={form.useHeader}
              onChange={(value) => updateRoot({ useHeader: value })}
            />

            <Toggle
              label="Usar footer"
              checked={form.useFooter}
              onChange={(value) => updateRoot({ useFooter: value })}
            />
          </SectionCard>

          <SectionCard
            title="Encabezado del detalle"
            text="Puedes dejar el título original del producto o usar uno visual adicional."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Select
                label="Modo de título visual"
                value={form.productDetailConfig.titleMode}
                onChange={(e) => updateDetailConfig({ titleMode: e.target.value })}
              >
                {TITLE_MODE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>

              <Input
                label="Título alternativo"
                value={form.productDetailConfig.titleOverride}
                onChange={(e) =>
                  updateDetailConfig({ titleOverride: e.target.value })
                }
                placeholder="Déjalo vacío para usar el nombre del producto"
              />
            </div>

            <Input
              label="Subtítulo"
              value={form.productDetailConfig.subtitle}
              onChange={(e) => updateDetailConfig({ subtitle: e.target.value })}
              placeholder="Texto corto opcional"
            />

            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <Input
                  label="URL imagen de título"
                  value={form.productDetailConfig.titleImage}
                  onChange={(e) =>
                    updateDetailConfig({ titleImage: e.target.value })
                  }
                  placeholder="https://..."
                />

                <Input
                  label="Alt imagen de título"
                  value={form.productDetailConfig.titleImageAlt}
                  onChange={(e) =>
                    updateDetailConfig({ titleImageAlt: e.target.value })
                  }
                  placeholder="Texto alternativo"
                />

                <input
                  ref={titleImageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleTitleImageSelected}
                />

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handlePickTitleImage}
                    className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
                  >
                    Escoger imagen
                  </button>

                  <button
                    type="button"
                    onClick={handleUploadTitleImage}
                    disabled={uploadingTitleImage || !titleImageFile}
                    className="rounded-xl bg-pink-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-pink-700 disabled:opacity-50"
                  >
                    {uploadingTitleImage ? "Subiendo..." : "Subir a Cloudinary"}
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="mb-3 text-sm font-semibold text-gray-800">
                  Vista previa de imagen
                </div>

                <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4">
                  {titleImagePreview || form.productDetailConfig.titleImage ? (
                    <img
                      src={titleImagePreview || form.productDetailConfig.titleImage}
                      alt={form.productDetailConfig.titleImageAlt || "Vista previa"}
                      className="max-h-[220px] max-w-full object-contain"
                    />
                  ) : (
                    <div className="text-center text-sm text-gray-500">
                      Aún no hay imagen seleccionada.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </SectionCard>
        </div>
      )}

      {activeTab === "layout" && (
        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <SectionCard
            title="Distribución principal"
            text="Controla el acomodo general de la galería y la información."
          >
            <Select
              label="Posición de la galería"
              value={form.productDetailConfig.galleryPosition}
              onChange={(e) =>
                updateDetailConfig({ galleryPosition: e.target.value })
              }
            >
              {GALLERY_POSITION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>

            <Select
              label="Posición de miniaturas"
              value={form.productDetailConfig.thumbnailPosition}
              onChange={(e) =>
                updateDetailConfig({ thumbnailPosition: e.target.value })
              }
            >
              {THUMBNAIL_POSITION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>

            <div className="grid gap-3 md:grid-cols-2">
              <Toggle
                label="Mostrar breadcrumb"
                checked={form.productDetailConfig.showBreadcrumb}
                onChange={(value) => updateDetailConfig({ showBreadcrumb: value })}
              />
              <Toggle
                label="Mostrar imagen principal"
                checked={form.productDetailConfig.showMainImage}
                onChange={(value) => updateDetailConfig({ showMainImage: value })}
              />
              <Toggle
                label="Mostrar miniaturas"
                checked={form.productDetailConfig.showThumbnails}
                onChange={(value) => updateDetailConfig({ showThumbnails: value })}
              />
              <Toggle
                label="Mostrar flechas de galería"
                checked={form.productDetailConfig.showArrows}
                onChange={(value) => updateDetailConfig({ showArrows: value })}
              />
            </div>
          </SectionCard>

          <SectionCard
            title="Medidas visuales"
            text="Tamaño base del bloque visual de imágenes."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Máximo miniaturas visibles"
                type="number"
                min="1"
                max="10"
                value={form.productDetailConfig.thumbCount}
                onChange={(e) =>
                  updateDetailConfig({
                    thumbCount: clampInt(e.target.value, 1, 10, 5),
                  })
                }
              />

              <Input
                label="Ancho máximo imagen principal (px)"
                type="number"
                min="240"
                max="1000"
                value={form.productDetailConfig.mainImageMaxWidthPx}
                onChange={(e) =>
                  updateDetailConfig({
                    mainImageMaxWidthPx: clampInt(e.target.value, 240, 1000, 380),
                  })
                }
              />

              <Input
                label="Alto máximo imagen principal (px)"
                type="number"
                min="260"
                max="1200"
                value={form.productDetailConfig.mainImageMaxHeightPx}
                onChange={(e) =>
                  updateDetailConfig({
                    mainImageMaxHeightPx: clampInt(e.target.value, 260, 1200, 700),
                  })
                }
              />

              <Select
                label="Ajuste de imagen"
                value={form.productDetailConfig.imageFit}
                onChange={(e) => updateDetailConfig({ imageFit: e.target.value })}
              >
                {IMAGE_FIT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
          </SectionCard>
        </div>
      )}

      {activeTab === "gallery" && (
        <SectionCard
          title="Galería y miniaturas"
          text="Estilo visual de miniaturas e imagen principal."
        >
          <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <div className="space-y-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <Input
                label="Radio miniaturas (px)"
                type="number"
                min="4"
                max="24"
                value={form.productDetailConfig.style.thumbRadiusPx}
                onChange={(e) =>
                  updateStyleConfig({
                    thumbRadiusPx: clampInt(e.target.value, 4, 24, 10),
                  })
                }
              />

              <Input
                label="Ancho miniaturas (px)"
                type="number"
                min="40"
                max="180"
                value={form.productDetailConfig.thumbWidthPx}
                onChange={(e) =>
                  updateDetailConfig({
                    thumbWidthPx: clampInt(e.target.value, 40, 180, 64),
                  })
                }
              />

              <Input
                label="Alto miniaturas (px)"
                type="number"
                min="40"
                max="180"
                value={form.productDetailConfig.thumbHeightPx}
                onChange={(e) =>
                  updateDetailConfig({
                    thumbHeightPx: clampInt(e.target.value, 40, 180, 64),
                  })
                }
              />

              <Input
                label="Separación entre miniaturas (px)"
                type="number"
                min="4"
                max="40"
                value={form.productDetailConfig.thumbGapPx}
                onChange={(e) =>
                  updateDetailConfig({
                    thumbGapPx: clampInt(e.target.value, 4, 40, 12),
                  })
                }
              />

              <ColorInput
                label="Borde miniaturas"
                value={form.productDetailConfig.style.thumbBorderColor}
                onChange={(e) =>
                  updateStyleConfig({ thumbBorderColor: e.target.value })
                }
              />

              <ColorInput
                label="Borde miniatura seleccionada"
                value={form.productDetailConfig.style.selectedThumbBorderColor}
                onChange={(e) =>
                  updateStyleConfig({
                    selectedThumbBorderColor: e.target.value,
                  })
                }
              />
            </div>

            <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4">
              <div className="text-sm font-semibold text-gray-800">
                Animaciones de galería
              </div>

              <Select
                label="Animación de entrada de imagen"
                value={form.productDetailConfig.imageAnimation}
                onChange={(e) =>
                  updateDetailConfig({ imageAnimation: e.target.value })
                }
              >
                {ANIMATION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>

              <Select
                label="Hover de miniaturas"
                value={form.productDetailConfig.thumbHoverEffect}
                onChange={(e) =>
                  updateDetailConfig({ thumbHoverEffect: e.target.value })
                }
              >
                {THUMB_HOVER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>

              <Toggle
                label="Zoom hover en imagen principal"
                checked={form.productDetailConfig.imageHoverZoom}
                onChange={(value) =>
                  updateDetailConfig({ imageHoverZoom: value })
                }
              />

              <Input
                label="Duración animación (ms)"
                type="number"
                min="100"
                max="3000"
                value={form.productDetailConfig.animationDurationMs}
                onChange={(e) =>
                  updateDetailConfig({
                    animationDurationMs: clampInt(e.target.value, 100, 3000, 350),
                  })
                }
              />
            </div>
          </div>
        </SectionCard>
      )}

      {activeTab === "info" && (
        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <SectionCard
            title="Información de compra"
            text="Controla qué se muestra al lado de la galería."
          >
            <div className="grid gap-3 md:grid-cols-2">
              <Toggle
                label="Mostrar botón favorito"
                checked={form.productDetailConfig.showFavoriteButton}
                onChange={(value) =>
                  updateDetailConfig({ showFavoriteButton: value })
                }
              />
              <Toggle
                label="Mostrar precio"
                checked={form.productDetailConfig.showPrice}
                onChange={(value) => updateDetailConfig({ showPrice: value })}
              />
              <Toggle
                label="Mostrar precio original"
                checked={form.productDetailConfig.showOriginalPrice}
                onChange={(value) =>
                  updateDetailConfig({ showOriginalPrice: value })
                }
              />
              <Toggle
                label="Mostrar tallas"
                checked={form.productDetailConfig.showSizes}
                onChange={(value) => updateDetailConfig({ showSizes: value })}
              />
              <Toggle
                label="Mostrar colores"
                checked={form.productDetailConfig.showColors}
                onChange={(value) => updateDetailConfig({ showColors: value })}
              />
              <Toggle
                label="Mostrar cantidad"
                checked={form.productDetailConfig.showQuantity}
                onChange={(value) => updateDetailConfig({ showQuantity: value })}
              />

              <Toggle
                label="Mostrar bloque de recogida"
                checked={form.productDetailConfig.showPickupBlock}
                onChange={(value) =>
                  updateDetailConfig({ showPickupBlock: value })
                }
              />
            </div>

            <Select
              label="Animación de entrada del contenido"
              value={form.productDetailConfig.contentAnimation}
              onChange={(e) =>
                updateDetailConfig({ contentAnimation: e.target.value })
              }
            >
              {ANIMATION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>

            <div className="grid gap-4 md:grid-cols-2">
              <Select
                label="Ícono de favorito"
                value={form.productDetailConfig.favoriteIconName}
                onChange={(e) =>
                  updateDetailConfig({ favoriteIconName: e.target.value })
                }
              >
                {FAVORITE_ICON_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
          </SectionCard>

          <SectionCard
            title="Bloque de recogida"
            text="Textos debajo del botón de compra."
          >
            <Input
              label="Título recogida"
              value={form.productDetailConfig.pickupTitle}
              onChange={(e) =>
                updateDetailConfig({ pickupTitle: e.target.value })
              }
            />

            <Input
              label="Texto secundario"
              value={form.productDetailConfig.pickupText}
              onChange={(e) =>
                updateDetailConfig({ pickupText: e.target.value })
              }
            />

            <Input
              label="Texto del link"
              value={form.productDetailConfig.pickupLinkText}
              onChange={(e) =>
                updateDetailConfig({ pickupLinkText: e.target.value })
              }
            />
          </SectionCard>
        </div>
      )}

      {activeTab === "style" && (
        <div className="space-y-6">
          <SectionCard
            title="Estilo general"
            text="Colores, bordes, radios, tamaños y sombras del molde detalle."
          >
            <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
              <div className="space-y-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="text-sm font-semibold text-gray-800">Colores</div>

                <div className="grid gap-4 md:grid-cols-2">
                  <ColorInput
                    label="Fondo página"
                    value={form.productDetailConfig.style.pageBg}
                    onChange={(e) => updateStyleConfig({ pageBg: e.target.value })}
                  />
                  <ColorInput
                    label="Fondo tarjetas"
                    value={form.productDetailConfig.style.cardBg}
                    onChange={(e) => updateStyleConfig({ cardBg: e.target.value })}
                  />
                  <ColorInput
                    label="Texto principal"
                    value={form.productDetailConfig.style.primaryTextColor}
                    onChange={(e) =>
                      updateStyleConfig({ primaryTextColor: e.target.value })
                    }
                  />
                  <ColorInput
                    label="Texto secundario"
                    value={form.productDetailConfig.style.secondaryTextColor}
                    onChange={(e) =>
                      updateStyleConfig({ secondaryTextColor: e.target.value })
                    }
                  />
                  <ColorInput
                    label="Acento 1"
                    value={form.productDetailConfig.style.accentColor}
                    onChange={(e) =>
                      updateStyleConfig({ accentColor: e.target.value })
                    }
                  />
                  <ColorInput
                    label="Acento 2"
                    value={form.productDetailConfig.style.accentColor2}
                    onChange={(e) =>
                      updateStyleConfig({ accentColor2: e.target.value })
                    }
                  />
                  <ColorInput
                    label="Color de borde"
                    value={form.productDetailConfig.style.borderColor}
                    onChange={(e) =>
                      updateStyleConfig({ borderColor: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="text-sm font-semibold text-gray-800">
                  Tamaños y bordes
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    label="Radio general (px)"
                    type="number"
                    min="8"
                    max="40"
                    value={form.productDetailConfig.style.radiusPx}
                    onChange={(e) =>
                      updateStyleConfig({
                        radiusPx: clampInt(e.target.value, 8, 40, 18),
                      })
                    }
                  />

                  <Input
                    label="Ancho borde (px)"
                    type="number"
                    min="1"
                    max="4"
                    value={form.productDetailConfig.style.borderWidthPx}
                    onChange={(e) =>
                      updateStyleConfig({
                        borderWidthPx: clampInt(e.target.value, 1, 4, 1),
                      })
                    }
                  />

                  <Input
                    label="Tamaño título (px)"
                    type="number"
                    min="20"
                    max="52"
                    value={form.productDetailConfig.style.titleSizePx}
                    onChange={(e) =>
                      updateStyleConfig({
                        titleSizePx: clampInt(e.target.value, 20, 52, 32),
                      })
                    }
                  />

                  <Input
                    label="Tamaño precio (px)"
                    type="number"
                    min="20"
                    max="48"
                    value={form.productDetailConfig.style.priceSizePx}
                    onChange={(e) =>
                      updateStyleConfig({
                        priceSizePx: clampInt(e.target.value, 20, 48, 30),
                      })
                    }
                  />

                  <Input
                    label="Radio botón carrito"
                    type="number"
                    min="8"
                    max="40"
                    value={
                      form.productDetailConfig.style.buttonRadiusPx === 999
                        ? 40
                        : form.productDetailConfig.style.buttonRadiusPx
                    }
                    onChange={(e) =>
                      updateStyleConfig({
                        buttonRadiusPx: clampInt(e.target.value, 8, 40, 40),
                      })
                    }
                  />

                  <Select
                    label="Tipo de sombra"
                    value={form.productDetailConfig.style.shadowStyle}
                    onChange={(e) =>
                      updateStyleConfig({ shadowStyle: e.target.value })
                    }
                  >
                    {SHADOW_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            </div>
          </SectionCard>
          <SectionCard
              title="Controles visuales"
              text="Aquí controlas por separado la apariencia del botón favorito y del botón grande de añadir al carrito."
            >
              <div className="grid gap-6 xl:grid-cols-2">
                <div className="space-y-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-sm font-semibold text-gray-800">
                    Botón favorito
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <ColorInput
                      label="Fondo botón favorito"
                      value={form.productDetailConfig.style.favoriteButtonBg}
                      onChange={(e) =>
                        updateStyleConfig({ favoriteButtonBg: e.target.value })
                      }
                    />

                    <Input
                      label="Transparencia botón favorito"
                      type="number"
                      min="0"
                      max="1"
                      step="0.05"
                      value={form.productDetailConfig.style.favoriteButtonOpacity}
                      onChange={(e) =>
                        updateStyleConfig({
                          favoriteButtonOpacity: clampFloat(
                            e.target.value,
                            0,
                            1,
                            1
                          ),
                        })
                      }
                    />

                    <ColorInput
                      label="Borde botón favorito"
                      value={form.productDetailConfig.style.favoriteBorderColor}
                      onChange={(e) =>
                        updateStyleConfig({ favoriteBorderColor: e.target.value })
                      }
                    />

                    <Input
                      label="Grosor borde favorito (px)"
                      type="number"
                      min="0"
                      max="4"
                      value={form.productDetailConfig.style.favoriteBorderWidthPx}
                      onChange={(e) =>
                        updateStyleConfig({
                          favoriteBorderWidthPx: clampInt(
                            e.target.value,
                            0,
                            4,
                            1
                          ),
                        })
                      }
                    />

                    <ColorInput
                      label="Color icono favorito"
                      value={form.productDetailConfig.favoriteIconColor}
                      onChange={(e) =>
                        updateDetailConfig({ favoriteIconColor: e.target.value })
                      }
                    />

                    <ColorInput
                      label="Color favorito activo"
                      value={form.productDetailConfig.favoriteActiveColor}
                      onChange={(e) =>
                        updateDetailConfig({ favoriteActiveColor: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-sm font-semibold text-gray-800">
                    Botón añadir al carrito
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <ColorInput
                      label="Fondo botón carrito"
                      value={form.productDetailConfig.style.addToCartButtonBg}
                      onChange={(e) =>
                        updateStyleConfig({ addToCartButtonBg: e.target.value })
                      }
                    />

                    <Input
                      label="Transparencia botón carrito"
                      type="number"
                      min="0"
                      max="1"
                      step="0.05"
                      value={form.productDetailConfig.style.addToCartButtonOpacity}
                      onChange={(e) =>
                        updateStyleConfig({
                          addToCartButtonOpacity: clampFloat(
                            e.target.value,
                            0,
                            1,
                            1
                          ),
                        })
                      }
                    />

                    <ColorInput
                      label="Borde botón carrito"
                      value={form.productDetailConfig.style.addToCartBorderColor}
                      onChange={(e) =>
                        updateStyleConfig({ addToCartBorderColor: e.target.value })
                      }
                    />

                    <Input
                      label="Grosor borde carrito (px)"
                      type="number"
                      min="0"
                      max="4"
                      value={form.productDetailConfig.style.addToCartBorderWidthPx}
                      onChange={(e) =>
                        updateStyleConfig({
                          addToCartBorderWidthPx: clampInt(
                            e.target.value,
                            0,
                            4,
                            0
                          ),
                        })
                      }
                    />

                    <ColorInput
                      label="Color texto botón carrito"
                      value={form.productDetailConfig.style.addToCartTextColor}
                      onChange={(e) =>
                        updateStyleConfig({ addToCartTextColor: e.target.value })
                      }
                    />

                    <ColorInput
                      label="Color icono botón carrito"
                      value={form.productDetailConfig.style.addToCartIconColor}
                      onChange={(e) =>
                        updateStyleConfig({ addToCartIconColor: e.target.value })
                      }
                    />

                    <Input
                      label="Radio botón carrito (px)"
                      type="number"
                      min="8"
                      max="40"
                      value={
                        form.productDetailConfig.style.buttonRadiusPx === 999
                          ? 40
                          : form.productDetailConfig.style.buttonRadiusPx
                      }
                      onChange={(e) =>
                        updateStyleConfig({
                          buttonRadiusPx: clampInt(e.target.value, 8, 40, 40),
                        })
                      }
                    />
                  </div>
                </div>
              </div>
          </SectionCard>
         
        </div>
      )}

      {activeTab === "reviews" && (
        <div className="space-y-6">
          <SectionCard
            title="Bloque de reseñas"
            text="Aquí configuras textos, visibilidad, animación y personalización avanzada de la sección de reseñas."
          >
            <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
              <div className="space-y-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <Toggle
                    label="Mostrar sección de reseñas"
                    checked={form.productDetailConfig.showReviewsSection}
                    onChange={(value) =>
                      updateDetailConfig({ showReviewsSection: value })
                    }
                  />

                  <Toggle
                    label="Mostrar formulario"
                    checked={form.productDetailConfig.showReviewForm}
                    onChange={(value) =>
                      updateDetailConfig({ showReviewForm: value })
                    }
                  />

                  <Toggle
                    label="Mostrar listado"
                    checked={form.productDetailConfig.showReviewList}
                    onChange={(value) =>
                      updateDetailConfig({ showReviewList: value })
                    }
                  />

                  <Toggle
                    label="Mostrar estrellas"
                    checked={form.productDetailConfig.showReviewStars}
                    onChange={(value) =>
                      updateDetailConfig({ showReviewStars: value })
                    }
                  />

                  <Toggle
                    label="Mostrar fecha"
                    checked={form.productDetailConfig.showReviewDate}
                    onChange={(value) =>
                      updateDetailConfig({ showReviewDate: value })
                    }
                  />
                </div>

                <Select
                  label="Animación de entrada reseñas"
                  value={form.productDetailConfig.reviewSectionAnimation}
                  onChange={(e) =>
                    updateDetailConfig({
                      reviewSectionAnimation: e.target.value,
                    })
                  }
                >
                  {ANIMATION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>

                <Input
                  label="Título general de reseñas"
                  value={form.productDetailConfig.reviewSectionTitle}
                  onChange={(e) =>
                    updateDetailConfig({ reviewSectionTitle: e.target.value })
                  }
                />

                <Input
                  label="Título formulario"
                  value={form.productDetailConfig.reviewFormTitle}
                  onChange={(e) =>
                    updateDetailConfig({ reviewFormTitle: e.target.value })
                  }
                />

                <Input
                  label="Título listado"
                  value={form.productDetailConfig.reviewListTitle}
                  onChange={(e) =>
                    updateDetailConfig({ reviewListTitle: e.target.value })
                  }
                />

                <Input
                  label="Texto vacío sin reseñas"
                  value={form.productDetailConfig.reviewEmptyText}
                  onChange={(e) =>
                    updateDetailConfig({ reviewEmptyText: e.target.value })
                  }
                />
              </div>

              <div className="space-y-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <Input
                  label="Label nombre"
                  value={form.productDetailConfig.reviewNameLabel}
                  onChange={(e) =>
                    updateDetailConfig({ reviewNameLabel: e.target.value })
                  }
                />

                <Input
                  label="Placeholder nombre"
                  value={form.productDetailConfig.reviewNamePlaceholder}
                  onChange={(e) =>
                    updateDetailConfig({
                      reviewNamePlaceholder: e.target.value,
                    })
                  }
                />

                <Input
                  label="Label calificación"
                  value={form.productDetailConfig.reviewRatingLabel}
                  onChange={(e) =>
                    updateDetailConfig({ reviewRatingLabel: e.target.value })
                  }
                />

                <Input
                  label="Label comentario"
                  value={form.productDetailConfig.reviewCommentLabel}
                  onChange={(e) =>
                    updateDetailConfig({ reviewCommentLabel: e.target.value })
                  }
                />

                <Textarea
                  label="Placeholder comentario"
                  value={form.productDetailConfig.reviewCommentPlaceholder}
                  onChange={(e) =>
                    updateDetailConfig({
                      reviewCommentPlaceholder: e.target.value,
                    })
                  }
                />

                <Input
                  label="Texto botón publicar"
                  value={form.productDetailConfig.reviewSubmitText}
                  onChange={(e) =>
                    updateDetailConfig({ reviewSubmitText: e.target.value })
                  }
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Estilos visuales de reseñas"
            text="Aquí controlas colores, bordes, tipografía y tamaños de toda la sección de reseñas."
          >
            <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
              <div className="space-y-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="text-sm font-semibold text-gray-800">
                  Colores de reseñas
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <ColorInput
                    label="Fondo contenedor reseñas"
                    value={form.productDetailConfig.style.reviewSectionBg}
                    onChange={(e) =>
                      updateStyleConfig({ reviewSectionBg: e.target.value })
                    }
                  />
                  <ColorInput
                    label="Fondo formulario"
                    value={form.productDetailConfig.style.reviewFormBg}
                    onChange={(e) =>
                      updateStyleConfig({ reviewFormBg: e.target.value })
                    }
                  />
                  <ColorInput
                    label="Fondo listado"
                    value={form.productDetailConfig.style.reviewListBg}
                    onChange={(e) =>
                      updateStyleConfig({ reviewListBg: e.target.value })
                    }
                  />
                  <ColorInput
                    label="Color títulos reseñas"
                    value={form.productDetailConfig.style.reviewTitleColor}
                    onChange={(e) =>
                      updateStyleConfig({ reviewTitleColor: e.target.value })
                    }
                  />
                  <ColorInput
                    label="Color texto reseñas"
                    value={form.productDetailConfig.style.reviewTextColor}
                    onChange={(e) =>
                      updateStyleConfig({ reviewTextColor: e.target.value })
                    }
                  />
                  <ColorInput
                    label="Color texto secundario"
                    value={form.productDetailConfig.style.reviewMutedColor}
                    onChange={(e) =>
                      updateStyleConfig({ reviewMutedColor: e.target.value })
                    }
                  />
                  <ColorInput
                    label="Fondo inputs"
                    value={form.productDetailConfig.style.reviewInputBg}
                    onChange={(e) =>
                      updateStyleConfig({ reviewInputBg: e.target.value })
                    }
                  />
                  <ColorInput
                    label="Borde inputs"
                    value={form.productDetailConfig.style.reviewInputBorderColor}
                    onChange={(e) =>
                      updateStyleConfig({
                        reviewInputBorderColor: e.target.value,
                      })
                    }
                  />
                  <ColorInput
                    label="Fondo botón reseña"
                    value={form.productDetailConfig.style.reviewButtonBg}
                    onChange={(e) =>
                      updateStyleConfig({ reviewButtonBg: e.target.value })
                    }
                  />
                  <ColorInput
                    label="Texto botón reseña"
                    value={form.productDetailConfig.style.reviewButtonTextColor}
                    onChange={(e) =>
                      updateStyleConfig({ reviewButtonTextColor: e.target.value })
                    }
                  />
                  <ColorInput
                    label="Estrella activa"
                    value={form.productDetailConfig.style.reviewStarActiveColor}
                    onChange={(e) =>
                      updateStyleConfig({ reviewStarActiveColor: e.target.value })
                    }
                  />
                  <ColorInput
                    label="Estrella inactiva"
                    value={form.productDetailConfig.style.reviewStarInactiveColor}
                    onChange={(e) =>
                      updateStyleConfig({
                        reviewStarInactiveColor: e.target.value,
                      })
                    }
                  />
                  <ColorInput
                    label="Fondo mensaje éxito"
                    value={form.productDetailConfig.style.reviewSuccessBg}
                    onChange={(e) =>
                      updateStyleConfig({ reviewSuccessBg: e.target.value })
                    }
                  />
                  <ColorInput
                    label="Texto mensaje éxito"
                    value={form.productDetailConfig.style.reviewSuccessText}
                    onChange={(e) =>
                      updateStyleConfig({ reviewSuccessText: e.target.value })
                    }
                  />
                  <ColorInput
                    label="Fondo mensaje error"
                    value={form.productDetailConfig.style.reviewErrorBg}
                    onChange={(e) =>
                      updateStyleConfig({ reviewErrorBg: e.target.value })
                    }
                  />
                  <ColorInput
                    label="Texto mensaje error"
                    value={form.productDetailConfig.style.reviewErrorText}
                    onChange={(e) =>
                      updateStyleConfig({ reviewErrorText: e.target.value })
                    }
                  />
                  <ColorInput
                    label="Color borde reseñas"
                    value={form.productDetailConfig.style.reviewBorderColor}
                    onChange={(e) =>
                      updateStyleConfig({ reviewBorderColor: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="text-sm font-semibold text-gray-800">
                  Medidas y tipografía
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    label="Radio bloque reseñas (px)"
                    type="number"
                    min="8"
                    max="40"
                    value={form.productDetailConfig.style.reviewSectionRadiusPx}
                    onChange={(e) =>
                      updateStyleConfig({
                        reviewSectionRadiusPx: clampInt(e.target.value, 8, 40, 18),
                      })
                    }
                  />

                  <Input
                    label="Radio inputs reseñas (px)"
                    type="number"
                    min="6"
                    max="30"
                    value={form.productDetailConfig.style.reviewInputRadiusPx}
                    onChange={(e) =>
                      updateStyleConfig({
                        reviewInputRadiusPx: clampInt(e.target.value, 6, 30, 10),
                      })
                    }
                  />

                  <Input
                    label="Tamaño título reseñas (px)"
                    type="number"
                    min="18"
                    max="40"
                    value={form.productDetailConfig.style.reviewTitleSizePx}
                    onChange={(e) =>
                      updateStyleConfig({
                        reviewTitleSizePx: clampInt(e.target.value, 18, 40, 24),
                      })
                    }
                  />

                  <Input
                    label="Tamaño texto reseñas (px)"
                    type="number"
                    min="12"
                    max="22"
                    value={form.productDetailConfig.style.reviewBodySizePx}
                    onChange={(e) =>
                      updateStyleConfig({
                        reviewBodySizePx: clampInt(e.target.value, 12, 22, 14),
                      })
                    }
                  />

                  <Input
                    label="Tamaño global fuente reseñas (px)"
                    type="number"
                    min="12"
                    max="26"
                    value={form.productDetailConfig.style.reviewFontSize}
                    onChange={(e) =>
                      updateStyleConfig({
                        reviewFontSize: clampInt(e.target.value, 12, 26, 14),
                      })
                    }
                  />

                  <Input
                    label="Radio borde avanzado reseñas (px)"
                    type="number"
                    min="0"
                    max="40"
                    value={form.productDetailConfig.style.reviewBorderRadius}
                    onChange={(e) =>
                      updateStyleConfig({
                        reviewBorderRadius: clampInt(e.target.value, 0, 40, 18),
                      })
                    }
                  />

                  <Input
                    label="Opacidad fondo reseñas (0 a 1)"
                    type="number"
                    min="0"
                    max="1"
                    step="0.05"
                    value={form.productDetailConfig.style.reviewBgOpacity}
                    onChange={(e) =>
                      updateStyleConfig({
                        reviewBgOpacity: clampFloat(e.target.value, 0, 1, 1),
                      })
                    }
                  />

                  <Select
                    label="Tipografía reseñas"
                    value={form.productDetailConfig.style.reviewFontFamily}
                    onChange={(e) =>
                      updateStyleConfig({ reviewFontFamily: e.target.value })
                    }
                  >
                    {REVIEW_FONT_FAMILY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Fondo visual del formulario de reseñas"
            text="Aquí puedes colocar una imagen de fondo solo para el formulario de reseñas y controlar su transparencia."
          >
            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-4">
                <IconUploadField
                  label="Imagen de fondo del formulario"
                  value={form.productDetailConfig.style.reviewFormBgImage}
                  preview={reviewFormBgImagePreview}
                  inputRef={reviewFormBgImageInputRef}
                  onPick={handlePickReviewFormBgImage}
                  onFileChange={handleReviewFormBgImageSelected}
                  onUpload={handleUploadReviewFormBgImage}
                  uploading={uploadingReviewFormBgImage}
                  onUrlChange={(e) =>
                    updateStyleConfig({ reviewFormBgImage: e.target.value })
                  }
                  disabledUpload={!reviewFormBgImageFile}
                />

                <RangeInput
                  label="Transparencia de la imagen de fondo"
                  min={0}
                  max={1}
                  step={0.05}
                  value={form.productDetailConfig.style.reviewFormBgImageOpacity}
                  onChange={(e) =>
                    updateStyleConfig({
                      reviewFormBgImageOpacity: clampFloat(
                        e.target.value,
                        0,
                        1,
                        0.35
                      ),
                    })
                  }
                />
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="mb-3 text-sm font-semibold text-gray-800">
                  Vista previa rápida
                </div>

                <div
                  className="relative overflow-hidden rounded-2xl border border-dashed border-gray-300 min-h-[260px] p-4"
                  style={{
                    backgroundColor:
                      form.productDetailConfig.style.reviewFormBg || "#ffffff",
                  }}
                >
                  {(
                    reviewFormBgImagePreview ||
                    form.productDetailConfig.style.reviewFormBgImage
                  ) ? (
                    <div
                      className="absolute inset-0 bg-center bg-cover bg-no-repeat"
                      style={{
                        backgroundImage: `url(${ 
                          reviewFormBgImagePreview ||
                          form.productDetailConfig.style.reviewFormBgImage
                        })`,
                        opacity:
                          form.productDetailConfig.style.reviewFormBgImageOpacity,
                      }}
                    />
                  ) : null}

                  <div className="relative z-10 space-y-3">
                    <div className="text-sm font-semibold text-gray-800">
                      Ejemplo formulario
                    </div>

                    <div className="h-10 rounded-lg border border-gray-300 bg-white/80" />
                    <div className="h-24 rounded-lg border border-gray-300 bg-white/80" />
                    <div className="h-10 w-40 rounded-lg bg-pink-500/80" />
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Iconos de calificación"
            text="Aquí decides qué ícono usar en el rating y cómo debe verse."
          >
            <div className="grid gap-4 md:grid-cols-3">
              <Select
                label="Tipo de icono"
                value={form.productDetailConfig.reviewStarType}
                onChange={(e) =>
                  updateDetailConfig({ reviewStarType: e.target.value })
                }
              >
                {REVIEW_STAR_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>

              <Select
                label="Estilo del icono"
                value={form.productDetailConfig.reviewStarStyle}
                onChange={(e) =>
                  updateDetailConfig({ reviewStarStyle: e.target.value })
                }
              >
                {REVIEW_STAR_STYLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>

              <Input
                label="Tamaño del icono (px)"
                type="number"
                min="12"
                max="48"
                value={form.productDetailConfig.reviewStarSizePx}
                onChange={(e) =>
                  updateDetailConfig({
                    reviewStarSizePx: clampInt(e.target.value, 12, 48, 20),
                  })
                }
              />
            </div>
          </SectionCard>
        </div>
      )}

      {activeTab === "extra" && (
        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <SectionCard
            title="Beneficios inferiores"
            text="Íconos y títulos debajo del bloque de compra."
          >
            <Toggle
              label="Mostrar bloque de beneficios"
              checked={form.productDetailConfig.showBenefits}
              onChange={(value) => updateDetailConfig({ showBenefits: value })}
            />

            <div className="grid gap-4">
              <Input
                label="Beneficio 1 texto"
                value={form.productDetailConfig.benefit1Title}
                onChange={(e) =>
                  updateDetailConfig({ benefit1Title: e.target.value })
                }
              />

              <IconUploadField
                label="Beneficio 1 icono"
                value={form.productDetailConfig.benefit1Icon}
                preview={benefit1IconPreview}
                inputRef={benefit1IconInputRef}
                onPick={() => handlePickBenefitIcon(1)}
                onFileChange={(e) => handleBenefitIconSelected(1, e)}
                onUpload={() => handleUploadBenefitIcon(1)}
                uploading={uploadingBenefit1Icon}
                onUrlChange={(e) =>
                  updateDetailConfig({ benefit1Icon: e.target.value })
                }
                disabledUpload={!benefit1IconFile}
              />

              <Input
                label="Beneficio 2 texto"
                value={form.productDetailConfig.benefit2Title}
                onChange={(e) =>
                  updateDetailConfig({ benefit2Title: e.target.value })
                }
              />

              <IconUploadField
                label="Beneficio 2 icono"
                value={form.productDetailConfig.benefit2Icon}
                preview={benefit2IconPreview}
                inputRef={benefit2IconInputRef}
                onPick={() => handlePickBenefitIcon(2)}
                onFileChange={(e) => handleBenefitIconSelected(2, e)}
                onUpload={() => handleUploadBenefitIcon(2)}
                uploading={uploadingBenefit2Icon}
                onUrlChange={(e) =>
                  updateDetailConfig({ benefit2Icon: e.target.value })
                }
                disabledUpload={!benefit2IconFile}
              />

              <Input
                label="Beneficio 3 texto"
                value={form.productDetailConfig.benefit3Title}
                onChange={(e) =>
                  updateDetailConfig({ benefit3Title: e.target.value })
                }
              />

              <IconUploadField
                label="Beneficio 3 icono"
                value={form.productDetailConfig.benefit3Icon}
                preview={benefit3IconPreview}
                inputRef={benefit3IconInputRef}
                onPick={() => handlePickBenefitIcon(3)}
                onFileChange={(e) => handleBenefitIconSelected(3, e)}
                onUpload={() => handleUploadBenefitIcon(3)}
                uploading={uploadingBenefit3Icon}
                onUrlChange={(e) =>
                  updateDetailConfig({ benefit3Icon: e.target.value })
                }
                disabledUpload={!benefit3IconFile}
              />
            </div>
          </SectionCard>

          <SectionCard
            title="Acordeones inferiores"
            text="Bloque informativo expansible al final de la página."
          >
            <Toggle
              label="Mostrar acordeones"
              checked={form.productDetailConfig.showAccordionBlock}
              onChange={(value) =>
                updateDetailConfig({ showAccordionBlock: value })
              }
            />

            <Input
              label="Título acordeón 1"
              value={form.productDetailConfig.accordionTitle1}
              onChange={(e) =>
                updateDetailConfig({ accordionTitle1: e.target.value })
              }
            />

            <Textarea
              label="Texto acordeón 1"
              value={form.productDetailConfig.accordionText1}
              onChange={(e) =>
                updateDetailConfig({ accordionText1: e.target.value })
              }
              placeholder="Escribe aquí el contenido del acordeón 1"
            />

            <Input
              label="Título acordeón 2"
              value={form.productDetailConfig.accordionTitle2}
              onChange={(e) =>
                updateDetailConfig({ accordionTitle2: e.target.value })
              }
            />

            <Textarea
              label="Texto acordeón 2"
              value={form.productDetailConfig.accordionText2}
              onChange={(e) =>
                updateDetailConfig({ accordionText2: e.target.value })
              }
              placeholder="Escribe aquí el contenido del acordeón 2"
            />
          </SectionCard>
        </div>
      )}
    </div>
  );
}
