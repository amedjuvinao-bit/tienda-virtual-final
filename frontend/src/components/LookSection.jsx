// src/components/LookSection.jsx
import { ChevronLeft, ChevronRight, Search, Star, ShoppingCart } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCart } from "../context/CartContext";
import { useFavorites } from "../context/FavoritesContext";
import {
  LOOK_MAX_PRODUCTS,
  LOOK_SECTION_DEFAULTS,
  normalizeLookSection,
} from "../admin/appearance/sections/look/lookSectionHelpers";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

function moneyCOP(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "$0";
  return `$${Math.round(n).toLocaleString("es-CO")}`;
}

function normalizeColorHex(c) {
  const raw =
    (typeof c === "string" ? c : "") ||
    (typeof c?.hex === "string" ? c.hex : "") ||
    (typeof c?.value === "string" ? c.value : "") ||
    (typeof c?.color === "string" ? c.color : "") ||
    "";

  const v = String(raw || "").trim();
  if (!v) return "";

  const ok = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v);
  return ok ? v : "";
}

function buildTextStyleFrom(style, prefix) {
  const out = {};

  const fontFamily =
    typeof style?.[`${prefix}FontFamily`] === "string" && style[`${prefix}FontFamily`].trim()
      ? style[`${prefix}FontFamily`].trim()
      : "";

  const color =
    typeof style?.[`${prefix}Color`] === "string" && style[`${prefix}Color`].trim()
      ? style[`${prefix}Color`].trim()
      : "";

  const sizePx = Number(style?.[`${prefix}SizePx`]);
  const weight = Number(style?.[`${prefix}Weight`]);

  if (fontFamily) out.fontFamily = fontFamily;
  if (color) out.color = color;
  if (Number.isFinite(sizePx) && sizePx > 0) out.fontSize = sizePx;
  if (Number.isFinite(weight) && weight > 0) out.fontWeight = weight;
  if (style?.[`${prefix}Italic`] === true) out.fontStyle = "italic";
  if (style?.[`${prefix}Underline`] === true) out.textDecoration = "underline";

  return out;
}

function getAspectClass(aspect) {
  if (aspect === "1/1") return "aspect-square";
  if (aspect === "4/5") return "aspect-[4/5]";
  if (aspect === "16/9") return "aspect-video";
  return "aspect-[3/4]";
}

function getThumbSizeValues(style) {
  const preset = String(style?.thumbSizePreset || "md").trim().toLowerCase();

  if (preset === "sm") {
    return { heightPx: 190, maxWidthPx: 165 };
  }

  if (preset === "lg") {
    return { heightPx: 290, maxWidthPx: 245 };
  }

  return { heightPx: 240, maxWidthPx: 210 };
}

function mapProductFromApi(product, ref) {
  if (!product) return null;

  const cover =
    ref?.mainImage ||
    product?.images?.cover ||
    product?.cover ||
    product?.image ||
    product?.thumbnail ||
    (Array.isArray(product?.images?.gallery) && product.images.gallery[0]) ||
    (Array.isArray(product?.gallery) && product.gallery[0]) ||
    "";

  const image = cover || "/placeholder.png";

  const colorsRaw = Array.isArray(product?.colors) ? product.colors : [];
  const colors = colorsRaw.map(normalizeColorHex).filter(Boolean);

  return {
    id: String(product?._id || product?.id || ref?.productId || ""),
    image,
    subtitle: product?.title || product?.name || "Producto",
    price: Number(product?.price || 0) || 0,
    colors,
  };
}

export default function LookSection({ theme }) {
  const { addToCart } = useCart();
  const { toggleFavorite, isFavorite } = useFavorites();
  const mobileSliderRef = useRef(null);

  const fallbackSection = LOOK_SECTION_DEFAULTS;

  const lookSection = useMemo(() => {
    const list = Array.isArray(theme?.sections) ? theme.sections : [];
    const found = list.find((s) => {
      const id = typeof s?.id === "string" ? s.id.trim().toLowerCase() : "";
      const type = typeof s?.type === "string" ? s.type.trim().toLowerCase() : "";
      return id === "look" || type === "look";
    });

    return normalizeLookSection(found || fallbackSection);
  }, [theme]);

  const config = lookSection.config;
  const style = lookSection.style;

  const [products, setProducts] = useState([]);
  const [selectedId, setSelectedId] = useState(config.selectedProductId || "");
  const [loading, setLoading] = useState(false);

  const [zoomActive, setZoomActive] = useState(false);
  const [zoomPosition, setZoomPosition] = useState({ x: 50, y: 50 });
  const [lensPosition, setLensPosition] = useState({ x: 50, y: 50 });

  const { heightPx: thumbHeightPx, maxWidthPx: thumbCardMaxWidthPx } = useMemo(
    () => getThumbSizeValues(style),
    [style]
  );

  const safeMobileSliderGapPx = useMemo(() => {
    const n = Number(style?.mobileSliderGapPx);
    if (!Number.isFinite(n)) return Number(style?.thumbGapPx) || 12;
    return Math.min(60, Math.max(0, n));
  }, [style?.mobileSliderGapPx, style?.thumbGapPx]);

  const safeMobileSliderControlMarginTopPx = useMemo(() => {
    const n = Number(style?.mobileSliderControlMarginTopPx);
    if (!Number.isFinite(n)) return 12;
    return Math.min(80, Math.max(0, n));
  }, [style?.mobileSliderControlMarginTopPx]);

  const safeMobileSliderControlRadiusPx = useMemo(() => {
    const n = Number(style?.mobileSliderControlRadiusPx);
    if (!Number.isFinite(n)) return 999;
    return Math.min(999, Math.max(0, n));
  }, [style?.mobileSliderControlRadiusPx]);

  const safeMobileSliderControlButtonWidthPx = useMemo(() => {
    const n = Number(style?.mobileSliderControlButtonWidthPx);
    if (!Number.isFinite(n)) return 44;
    return Math.min(120, Math.max(20, n));
  }, [style?.mobileSliderControlButtonWidthPx]);

  const safeMobileSliderControlButtonHeightPx = useMemo(() => {
    const n = Number(style?.mobileSliderControlButtonHeightPx);
    if (!Number.isFinite(n)) return 36;
    return Math.min(120, Math.max(20, n));
  }, [style?.mobileSliderControlButtonHeightPx]);

  const safeMobileSliderControlSeparatorWidthPx = useMemo(() => {
    const n = Number(style?.mobileSliderControlSeparatorWidthPx);
    if (!Number.isFinite(n)) return 1;
    return Math.min(12, Math.max(0, n));
  }, [style?.mobileSliderControlSeparatorWidthPx]);

  useEffect(() => {
    let cancelled = false;

    async function loadProducts() {
      const refs = Array.isArray(config?.products) ? config.products.slice(0, LOOK_MAX_PRODUCTS) : [];

      if (!refs.length) {
        setProducts([]);
        return;
      }

      setLoading(true);

      try {
        const results = await Promise.all(
          refs.map(async (ref) => {
            const productId = String(ref?.productId || "").trim();
            if (!productId) return null;

            try {
              const res = await fetch(`${API_BASE}/api/products/${encodeURIComponent(productId)}`);
              if (!res.ok) return null;
              const data = await res.json();
              const payload = data?.product || data?.data || data;
              return mapProductFromApi(payload, ref);
            } catch {
              return null;
            }
          })
        );

        if (cancelled) return;

        const clean = results.filter(Boolean).slice(0, LOOK_MAX_PRODUCTS);
        setProducts(clean);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadProducts();

    return () => {
      cancelled = true;
    };
  }, [config?.products]);

  useEffect(() => {
    if (!products.length) {
      setSelectedId("");
      return;
    }

    const exists = products.some((p) => String(p.id) === String(selectedId));
    if (exists) return;

    const preferred =
      (config?.selectedProductId &&
        products.find((p) => String(p.id) === String(config.selectedProductId))) ||
      products[0];

    setSelectedId(preferred?.id || "");
  }, [products, selectedId, config?.selectedProductId]);

  useEffect(() => {
    setZoomActive(false);
    setZoomPosition({ x: 50, y: 50 });
    setLensPosition({ x: 50, y: 50 });
  }, [selectedId]);

  const selected = useMemo(() => {
    return products.find((p) => String(p.id) === String(selectedId)) || products[0] || null;
  }, [products, selectedId]);

  const titleStyle = useMemo(() => buildTextStyleFrom(style, "title"), [style]);
  const descStyle = useMemo(() => buildTextStyleFrom(style, "desc"), [style]);
  const thumbTitleStyle = useMemo(() => buildTextStyleFrom(style, "thumbTitle"), [style]);
  const thumbPriceStyle = useMemo(() => buildTextStyleFrom(style, "thumbPrice"), [style]);

  const wrapperStyle = {
    paddingTop: style.sectionPaddingTopPx,
    paddingBottom: style.sectionPaddingBottomPx,
    paddingLeft: style.sectionPaddingXPx,
    paddingRight: style.sectionPaddingXPx,
  };

  const contentStyle = {
    maxWidth: style.contentMaxWidthPx,
    gap: style.contentGapPx,
  };

  function buildCartPayload(product) {
    return {
      _id: String(product?.id || ""),
      title: product?.subtitle || "",
      image: product?.image || "",
      color: "",
      size: "",
      quantity: 1,
      price: Number(product?.price || 0) || 0,
    };
  }

  function buildFavoritePayload(product) {
    return {
      productId: String(product?.id || ""),
      title: product?.subtitle || "",
      image: product?.image || "",
      color: "",
      size: "",
      price: Number(product?.price || 0) || 0,
    };
  }

  function handleMainImageMouseMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();

    const rawX = ((e.clientX - rect.left) / rect.width) * 100;
    const rawY = ((e.clientY - rect.top) / rect.height) * 100;

    const x = Math.max(0, Math.min(100, rawX));
    const y = Math.max(0, Math.min(100, rawY));

    setZoomPosition({ x, y });
    setLensPosition({ x, y });
  }

  function scrollMobileSlider(direction) {
    const el = mobileSliderRef.current;
    if (!el) return;

    const amount = el.clientWidth * 0.88;
    el.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  }

  function renderProductCard(prod, isMobile = false) {
    const favoritePayload = buildFavoritePayload(prod);
    const cartPayload = buildCartPayload(prod);
    const favoriteActive = isFavorite(favoritePayload);

    return (
      <div
        key={prod.id}
        className={isMobile ? "w-[calc(50%-6px)] shrink-0 snap-start" : "w-full"}
        style={isMobile ? undefined : { maxWidth: thumbCardMaxWidthPx }}
      >
        <div
          className="relative transition-transform duration-300 cursor-pointer"
          style={{
            transform: "scale(1) rotate(0deg)",
          }}
          onClick={() => setSelectedId(prod.id)}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = `scale(${style.thumbHoverScale}) rotate(${style.thumbHoverRotateDeg}deg)`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1) rotate(0deg)";
          }}
        >
          <div
            className="w-full overflow-hidden"
            style={{
              height: isMobile ? Math.max(150, Math.round(thumbHeightPx * 0.9)) : thumbHeightPx,
              borderRadius: style.thumbRadiusPx,
              boxShadow: style.thumbShadow ? "0 10px 24px rgba(0,0,0,0.12)" : "none",
            }}
          >
            <img
              src={prod.image}
              alt={prod.subtitle}
              className="w-full h-full object-cover"
              draggable={false}
            />
          </div>

          <div className="absolute top-2 right-2 flex flex-col items-center space-y-2 overflow-visible">
            {config?.actions?.favorite?.enabled ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFavorite(favoritePayload);
                }}
                className="relative group p-1 rounded-full shadow focus:outline-none"
                style={{
                  backgroundColor: style.actionButtonBg,
                  border: `1px solid ${style.actionButtonBorderColor}`,
                }}
              >
                <Star
                  className={isMobile ? "w-4 h-4" : "w-5 h-5"}
                  style={{
                    color: favoriteActive ? "#eab308" : style.actionFavoriteColor,
                    fill: favoriteActive ? "#eab308" : "transparent",
                  }}
                />
                <span
                  className="pointer-events-none absolute top-1/2 right-full mr-2 -translate-y-1/2 whitespace-nowrap rounded-lg px-2 py-1 text-xs opacity-0 transition-opacity group-hover:opacity-100"
                  style={{
                    background: style.actionTooltipBg,
                    color: style.actionTooltipTextColor,
                  }}
                >
                  Favoritos
                </span>
              </button>
            ) : null}

            {config?.actions?.cart?.enabled ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  addToCart(cartPayload);
                }}
                className="relative group p-1 rounded-full shadow focus:outline-none"
                style={{
                  backgroundColor: style.actionButtonBg,
                  border: `1px solid ${style.actionButtonBorderColor}`,
                }}
              >
                <ShoppingCart
                  className={isMobile ? "w-4 h-4" : "w-5 h-5"}
                  style={{ color: style.actionCartColor }}
                />
                <span
                  className="pointer-events-none absolute top-1/2 right-full mr-2 -translate-y-1/2 whitespace-nowrap rounded-lg px-2 py-1 text-xs opacity-0 transition-opacity group-hover:opacity-100"
                  style={{
                    background: style.actionTooltipBg,
                    color: style.actionTooltipTextColor,
                  }}
                >
                  Compra
                </span>
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-2 text-center">
          <p
            style={thumbTitleStyle}
            className={isMobile ? "leading-tight min-h-[38px] text-[11px]" : undefined}
          >
            {prod.subtitle}
          </p>

          <div className="flex justify-center space-x-2 mt-1">
            {prod.colors.map((col, i) => (
              <button
                key={`${prod.id}_${i}`}
                type="button"
                aria-label={`Color option ${i + 1}`}
                style={{
                  backgroundColor: col,
                  width: isMobile ? Math.max(12, style.colorDotSizePx - 2) : style.colorDotSizePx,
                  height: isMobile ? Math.max(12, style.colorDotSizePx - 2) : style.colorDotSizePx,
                  borderColor: style.colorDotBorderColor,
                }}
                className="rounded-full border-2 focus:outline-none"
              />
            ))}
          </div>

          <p className="mt-1" style={thumbPriceStyle}>
            {moneyCOP(prod.price)}
          </p>
        </div>
      </div>
    );
  }

  return (
    <section style={wrapperStyle}>
      <div className="mx-auto md:hidden w-full mb-5">
        <div
          className={`w-full ${
            style.titleAlign === "left"
              ? "text-left"
              : style.titleAlign === "right"
              ? "text-right"
              : "text-center"
          }`}
        >
          {config.titleImage ? (
            <div className="mb-3 px-1">
              <img
                src={config.titleImage}
                alt="Título de la sección look"
                className="mx-auto h-auto"
                style={{ maxWidth: Math.min(style.titleImageWidthPx, 260) }}
                draggable={false}
              />
            </div>
          ) : config.titleText ? (
            <h2 style={titleStyle}>{config.titleText}</h2>
          ) : null}

          {config.description ? (
            <p className="max-w-xl mx-auto mt-2 px-1" style={descStyle}>
              {config.description}
            </p>
          ) : null}
        </div>
      </div>

      <div
        className="mx-auto grid grid-cols-1 md:grid-cols-[2fr_1fr] items-start"
        style={contentStyle}
      >
        <div className="relative">
          <div
            className={`${getAspectClass(style.mainImageAspect)} relative w-full overflow-hidden group ${
              selected ? "cursor-none" : ""
            }`}
            style={{
              borderRadius: style.mainImageRadiusPx,
              borderWidth: style.mainImageBorderPx,
              borderStyle: "solid",
              borderColor: style.mainImageBorderColor,
              boxShadow: style.mainImageShadow ? "0 20px 40px rgba(0,0,0,0.12)" : "none",
            }}
            onMouseEnter={() => {
              if (selected) setZoomActive(true);
            }}
            onMouseMove={handleMainImageMouseMove}
            onMouseLeave={() => {
              setZoomActive(false);
              setZoomPosition({ x: 50, y: 50 });
              setLensPosition({ x: 50, y: 50 });
            }}
          >
            {selected ? (
              <>
                <img
                  src={selected.image}
                  alt={selected.subtitle}
                  className="w-full h-full object-cover select-none transition-transform duration-150 ease-out"
                  draggable={false}
                  style={{
                    transform: zoomActive ? "scale(1.8)" : "scale(1)",
                    transformOrigin: `${zoomPosition.x}% ${zoomPosition.y}%`,
                  }}
                />

                <div
                  className="pointer-events-none absolute inset-0 transition-opacity duration-200"
                  style={{
                    opacity: zoomActive ? 1 : 0,
                    background:
                      "radial-gradient(circle at center, rgba(255,255,255,0.02) 0%, rgba(0,0,0,0.06) 100%)",
                  }}
                />

                <div
                  className="pointer-events-none absolute z-20 flex items-center justify-center transition-all duration-75 ease-out"
                  style={{
                    opacity: zoomActive ? 1 : 0,
                    left: `${lensPosition.x}%`,
                    top: `${lensPosition.y}%`,
                    width: 74,
                    height: 74,
                    transform: "translate(-50%, -50%)",
                    borderRadius: "9999px",
                    border: "1px solid rgba(255,255,255,0.72)",
                    background: "rgba(255,255,255,0.12)",
                    boxShadow:
                      "0 8px 20px rgba(0,0,0,0.10), inset 0 0 0 1px rgba(255,255,255,0.10)",
                    backdropFilter: "blur(1.5px)",
                  }}
                >
                  <Search
                    className="w-4 h-4"
                    style={{
                      color: "#ffffff",
                      opacity: 0.92,
                      filter: "drop-shadow(0 1px 4px rgba(0,0,0,0.18))",
                    }}
                  />
                </div>
              </>
            ) : (
              <div className="w-full h-full bg-pink-50 flex items-center justify-center text-sm text-gray-500">
                {loading ? "Cargando..." : "Sin producto seleccionado"}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col items-center w-full mt-5 md:mt-16">
          <div
            className={`hidden md:block w-full mb-6 ${
              style.titleAlign === "left"
                ? "text-left"
                : style.titleAlign === "right"
                ? "text-right"
                : "text-center"
            }`}
          >
            {config.titleImage ? (
              <div className="mb-2 px-1">
                <img
                  src={config.titleImage}
                  alt="Título de la sección look"
                  className="mx-auto h-auto"
                  style={{ maxWidth: style.titleImageWidthPx }}
                  draggable={false}
                />
              </div>
            ) : config.titleText ? (
              <h2 style={titleStyle}>{config.titleText}</h2>
            ) : null}

            {config.description ? (
              <p className="max-w-xl mx-auto mt-2" style={descStyle}>
                {config.description}
              </p>
            ) : null}
          </div>

          <style>{`
            @media (min-width: 768px) {
              .look-thumb-grid {
                grid-template-columns: repeat(${style.thumbGridColsDesktop}, minmax(0, 1fr)) !important;
              }
            }

            .look-mobile-slider::-webkit-scrollbar {
              display: none;
            }

            .look-mobile-slider {
              -ms-overflow-style: none;
              scrollbar-width: none;
            }
          `}</style>

          <div className="w-full md:hidden">
            <div
              ref={mobileSliderRef}
              className="look-mobile-slider flex overflow-x-auto snap-x snap-mandatory"
              style={{
                gap: safeMobileSliderGapPx,
                paddingBottom: 4,
              }}
            >
              {products.map((prod) => renderProductCard(prod, true))}
            </div>

            {products.length > 2 ? (
              <div
                className="flex items-center justify-center"
                style={{ marginTop: safeMobileSliderControlMarginTopPx }}
              >
                <div
                  className="inline-flex items-center overflow-hidden"
                  style={{
                    border: `1px solid ${style.mobileSliderControlBorderColor || "#d4d4d8"}`,
                    backgroundColor: style.mobileSliderControlBg || "#ffffff",
                    borderRadius: safeMobileSliderControlRadiusPx,
                  }}
                >
                  <button
                    type="button"
                    aria-label="Deslizar productos a la izquierda"
                    onClick={() => scrollMobileSlider("left")}
                    className="flex items-center justify-center transition"
                    style={{
                      width: safeMobileSliderControlButtonWidthPx,
                      height: safeMobileSliderControlButtonHeightPx,
                    }}
                  >
                    <ChevronLeft
                      className="w-5 h-5"
                      style={{ color: style.mobileSliderControlIconColor || "#111827" }}
                    />
                  </button>

                  <div
                    style={{
                      width: safeMobileSliderControlSeparatorWidthPx,
                      height: Math.max(16, safeMobileSliderControlButtonHeightPx - 10),
                      backgroundColor: style.mobileSliderControlSeparatorColor || "#d4d4d8",
                    }}
                  />

                  <button
                    type="button"
                    aria-label="Deslizar productos a la derecha"
                    onClick={() => scrollMobileSlider("right")}
                    className="flex items-center justify-center transition"
                    style={{
                      width: safeMobileSliderControlButtonWidthPx,
                      height: safeMobileSliderControlButtonHeightPx,
                    }}
                  >
                    <ChevronRight
                      className="w-5 h-5"
                      style={{ color: style.mobileSliderControlIconColor || "#111827" }}
                    />
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <div
            className="look-thumb-grid hidden md:grid w-full"
            style={{
              gap: style.thumbGapPx,
              gridTemplateColumns: `repeat(${style.thumbGridColsMobile}, minmax(0, 1fr))`,
              justifyItems: "center",
            }}
          >
            {products.map((prod) => renderProductCard(prod, false))}
          </div>
        </div>
      </div>
    </section>
  );
}