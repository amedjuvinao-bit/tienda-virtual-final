// src/components/TrendingSection.jsx
import { Star, ShoppingCart } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useFavorites } from "../context/FavoritesContext";
import { API_BASE_URL } from "../config/apiBaseUrl";

function moneyCOP(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "$0";
  return `$${Math.round(n).toLocaleString("es-CO")}`;
}

const API_BASE = API_BASE_URL;

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

function buildTextStyleFrom(st, prefix, fallback) {
  const s = {};

  const fontFamily =
    typeof st?.[`${prefix}FontFamily`] === "string" && st[`${prefix}FontFamily`].trim()
      ? st[`${prefix}FontFamily`].trim()
      : "";

  const color =
    typeof st?.[`${prefix}Color`] === "string" && st[`${prefix}Color`].trim()
      ? st[`${prefix}Color`].trim()
      : "";

  const sizePx = Number.isFinite(Number(st?.[`${prefix}SizePx`])) ? Number(st[`${prefix}SizePx`]) : 0;
  const weight = Number.isFinite(Number(st?.[`${prefix}Weight`])) ? Number(st[`${prefix}Weight`]) : 0;

  const italic = typeof st?.[`${prefix}Italic`] === "boolean" ? st[`${prefix}Italic`] : null;
  const underline = typeof st?.[`${prefix}Underline`] === "boolean" ? st[`${prefix}Underline`] : null;

  if (fontFamily) s.fontFamily = fontFamily;
  if (color) s.color = color;
  if (sizePx > 0) s.fontSize = sizePx;
  if (weight > 0) s.fontWeight = weight;
  if (italic === true) s.fontStyle = "italic";
  if (underline === true) s.textDecoration = "underline";

  if (Object.keys(s).length) return s;
  return fallback;
}

function uniqueStrings(arr) {
  const out = [];
  const seen = new Set();
  for (const v of Array.isArray(arr) ? arr : []) {
    const s = String(v ?? "").trim();
    if (!s) continue;
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out;
}

export default function TrendingSection({ theme }) {
  const { addToCart } = useCart();
  const { toggleFavorite, isFavorite } = useFavorites();

  const fallbackProducts = [
    {
      id: 1,
      image1: "/Tendencia1a.jpg",
      image2: "/Tendencia1b.jpg",
      name: "Vestido Rosado Elegante",
      price: 129000,
      finalPrice: 103200,
      hasDiscount: true,
      discountPercent: 20,
      features: ["Talla S/M/L", "Tela lino", "Edición limitada"],
    },
    {
      id: 2,
      image1: "/Tendencia2b.jpg",
      image2: "/Tendencia2a.jpg",
      name: "Bolso Floral Chic",
      price: 95000,
      finalPrice: 95000,
      hasDiscount: false,
      discountPercent: 0,
      features: ["Cuero sintético", "Color rosa pastel", "Correa ajustable"],
    },
    {
      id: 3,
      image1: "/Tendencia3a.jpg",
      image2: "/Tendencia3b.jpg",
      name: "Vestido Largo Vintage",
      price: 165000,
      finalPrice: 132000,
      hasDiscount: true,
      discountPercent: 20,
      features: ["Encaje", "Colores tierra", "Talla única"],
    },
    {
      id: 4,
      image1: "/Tendencia4b.jpg",
      image2: "/Tendencia4a.jpg",
      name: "Perfume Rosa Gardenia",
      price: 72000,
      finalPrice: 72000,
      hasDiscount: false,
      discountPercent: 0,
      features: ["50 ml", "Aroma floral", "Duración 12h+"],
    },
  ];

  const tendenciaSection = useMemo(() => {
    const list = Array.isArray(theme?.sections) ? theme.sections : [];
    return list.find((s) => (typeof s?.id === "string" ? s.id.trim() : "") === "tendencia");
  }, [theme]);

  const config = useMemo(() => {
    return tendenciaSection?.config && typeof tendenciaSection.config === "object" ? tendenciaSection.config : null;
  }, [tendenciaSection]);

  const sectionStyle = useMemo(() => {
    const st = tendenciaSection?.style && typeof tendenciaSection.style === "object" ? tendenciaSection.style : {};
    const cardRadiusPx = Number.isFinite(Number(st.cardRadiusPx)) ? Number(st.cardRadiusPx) : 18;
    const imageHeightPx = Number.isFinite(Number(st.imageHeightPx)) ? Number(st.imageHeightPx) : 285;
    const spacingPx = Number.isFinite(Number(st.spacingPx)) ? Number(st.spacingPx) : 16;

    const baseCardText = {};
    const baseFont =
      typeof st.cardTextFontFamily === "string" && st.cardTextFontFamily.trim()
        ? st.cardTextFontFamily.trim()
        : typeof st.fontFamily === "string" && st.fontFamily.trim()
        ? st.fontFamily.trim()
        : "";

    const baseColor = typeof st.cardTextColor === "string" && st.cardTextColor.trim() ? st.cardTextColor.trim() : "";
    const baseSize = Number.isFinite(Number(st.cardTextSizePx)) ? Number(st.cardTextSizePx) : 0;
    const baseWeight = Number.isFinite(Number(st.cardTextWeight)) ? Number(st.cardTextWeight) : 0;
    const baseItalic = typeof st.cardTextItalic === "boolean" ? st.cardTextItalic : false;
    const baseUnderline = typeof st.cardTextUnderline === "boolean" ? st.cardTextUnderline : false;

    if (baseFont) baseCardText.fontFamily = baseFont;
    if (baseColor) baseCardText.color = baseColor;
    if (baseSize > 0) baseCardText.fontSize = baseSize;
    if (baseWeight > 0) baseCardText.fontWeight = baseWeight;
    if (baseItalic) baseCardText.fontStyle = "italic";
    if (baseUnderline) baseCardText.textDecoration = "underline";

    const baseCardTextStyle = Object.keys(baseCardText).length ? baseCardText : undefined;

    const titleStyle = buildTextStyleFrom(st, "cardTitle", baseCardTextStyle);
    const priceStyle = buildTextStyleFrom(st, "cardPrice", undefined);
    const metaStyle = buildTextStyleFrom(st, "cardMeta", baseCardTextStyle);
    const descStyle = buildTextStyleFrom(st, "cardDesc", baseCardTextStyle);

    const fields = config?.cardFields && typeof config.cardFields === "object" ? config.cardFields : {};
    const showSizes = typeof fields.showSizes === "boolean" ? fields.showSizes : true;
    const showColors = typeof fields.showColors === "boolean" ? fields.showColors : true;
    const showFeatures = typeof fields.showFeatures === "boolean" ? fields.showFeatures : true;
    const showDescription = typeof fields.showDescription === "boolean" ? fields.showDescription : true;

    const maxSizesToShow = Number.isFinite(Number(fields.maxSizesToShow)) ? Number(fields.maxSizesToShow) : 6;

    return {
      cardRadiusPx,
      imageHeightPx,
      spacingPx,
      baseCardTextStyle,
      titleStyle,
      priceStyle,
      metaStyle,
      descStyle,
      showSizes,
      showColors,
      showFeatures,
      showDescription,
      maxSizesToShow: Math.max(2, Math.min(20, maxSizesToShow)),
    };
  }, [tendenciaSection, config]);

  const actions = useMemo(() => {
    const raw = config?.actions && typeof config.actions === "object" ? config.actions : {};
    const fav = raw.favorite && typeof raw.favorite === "object" ? raw.favorite : {};
    const cart = raw.cart && typeof raw.cart === "object" ? raw.cart : {};

    return {
      favorite: {
        enabled: typeof fav.enabled === "boolean" ? fav.enabled : true,
        link: typeof fav.link === "string" && fav.link.trim() ? fav.link.trim() : "/favoritos",
      },
      cart: {
        enabled: typeof cart.enabled === "boolean" ? cart.enabled : true,
        link: typeof cart.link === "string" && cart.link.trim() ? cart.link.trim() : "/carrito",
      },
    };
  }, [config]);

  const titleImage =
    typeof config?.titleImage === "string" && config.titleImage.trim() ? config.titleImage : "/EnTendencia.png";

  const watermarkImage =
    typeof config?.watermarkImage === "string" && config.watermarkImage.trim()
      ? config.watermarkImage
      : "/icons/ROSA.png";

  const watermark = useMemo(() => {
    const sizePx = Number.isFinite(Number(config?.watermarkSizePx)) ? Number(config.watermarkSizePx) : 140;
    const opacity = Number.isFinite(Number(config?.watermarkOpacity)) ? Number(config.watermarkOpacity) : 0.12;

    const posRaw = typeof config?.watermarkPosition === "string" ? config.watermarkPosition : "br";
    const position = ["br", "tr", "bl", "tl"].includes(posRaw) ? posRaw : "br";

    const offsetX = Number.isFinite(Number(config?.watermarkOffsetXPx)) ? Number(config.watermarkOffsetXPx) : 0;
    const offsetY = Number.isFinite(Number(config?.watermarkOffsetYPx)) ? Number(config.watermarkOffsetYPx) : 0;

    const free =
      typeof config?.watermarkFree === "boolean"
        ? config.watermarkFree
        : Number.isFinite(Number(config?.watermarkPosXPct)) || Number.isFinite(Number(config?.watermarkPosYPct));

    const posXPct = Number.isFinite(Number(config?.watermarkPosXPct)) ? Number(config.watermarkPosXPct) : 50;
    const posYPct = Number.isFinite(Number(config?.watermarkPosYPct)) ? Number(config.watermarkPosYPct) : 72;
    const rotateDeg = Number.isFinite(Number(config?.watermarkRotateDeg)) ? Number(config.watermarkRotateDeg) : 0;

    return {
      sizePx: Math.max(40, Math.min(320, sizePx)),
      opacity: Math.max(0, Math.min(1, opacity)),
      position,
      offsetX: Math.max(-120, Math.min(180, offsetX)),
      offsetY: Math.max(-120, Math.min(180, offsetY)),
      free: !!free,
      posXPct: Math.max(0, Math.min(100, posXPct)),
      posYPct: Math.max(0, Math.min(100, posYPct)),
      rotateDeg: Math.max(-180, Math.min(180, rotateDeg)),
    };
  }, [config]);

  const maxItems = useMemo(() => {
    const n = Number(config?.maxItems);
    if (!Number.isFinite(n)) return 4;
    return Math.max(0, Math.min(24, n));
  }, [config]);

  const refs = useMemo(() => {
    const arr = Array.isArray(config?.products) ? config.products : [];

    return arr
      .map((r) => {
        if (typeof r === "string") {
          return {
            productId: r.trim(),
            mainImage: "",
            hoverImage: "",
            discountEnabled: false,
            discountPercent: 0,
          };
        }

        const discountEnabled =
          typeof r?.discountEnabled === "boolean"
            ? r.discountEnabled
            : typeof r?.hasDiscount === "boolean"
            ? r.hasDiscount
            : false;

        const discountPercent = Number.isFinite(Number(r?.discountPercent)) ? Number(r.discountPercent) : 0;

        return {
          productId: typeof r?.productId === "string" ? r.productId.trim() : "",
          mainImage: typeof r?.mainImage === "string" ? r.mainImage.trim() : "",
          hoverImage: typeof r?.hoverImage === "string" ? r.hoverImage.trim() : "",
          discountEnabled,
          discountPercent,
        };
      })
      .filter((r) => r.productId)
      .slice(0, maxItems);
  }, [config, maxItems]);

  const shouldUseConfig = !!config && tendenciaSection?.enabled !== false && refs.length > 0;

  const [remoteProducts, setRemoteProducts] = useState([]);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [remoteError, setRemoteError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!shouldUseConfig) {
        setRemoteProducts([]);
        setRemoteLoading(false);
        setRemoteError(null);
        return;
      }

      setRemoteLoading(true);
      setRemoteError(null);

      try {
        const uniqueIds = Array.from(new Set(refs.map((r) => r.productId)));

        const results = await Promise.all(
          uniqueIds.map(async (id) => {
            const url = `${API_BASE}/api/products/${encodeURIComponent(id)}`;

            try {
              const res = await fetch(url);

              if (!res.ok) {
                let bodyText = "";
                try {
                  bodyText = await res.text();
                } catch {
                  bodyText = "";
                }
                return { __error: true, id, url, status: res.status, body: bodyText };
              }

              const data = await res.json();
              return { __error: false, id, url, data };
            } catch (err) {
              return {
                __error: true,
                id,
                url,
                status: 0,
                body: err?.message || "Fetch failed",
              };
            }
          })
        );

        if (cancelled) return;

        const errors = results.filter((r) => r && r.__error);
        const oks = results.filter((r) => r && !r.__error).map((r) => r.data);

        if (oks.length === 0) {
          setRemoteProducts([]);
          setRemoteLoading(false);

          const first = errors[0];
          setRemoteError({
            message: "No se pudo cargar ningún producto desde /api/products/:id",
            firstFail: first || null,
            totalFails: errors.length,
            totalIds: uniqueIds.length,
          });
          return;
        }

        const byId = new Map();
        for (const p of oks) {
          if (!p) continue;
          const pid = p?._id || p?.id || p?.product?._id || p?.product?.id;
          const obj = p?.product || p?.data || p;
          if (pid && obj) byId.set(String(pid), obj);
        }

        const normalized = refs
          .map((r) => {
            const p = byId.get(String(r.productId));
            if (!p) return null;

            const cover =
              p?.images?.cover ||
              p?.cover ||
              p?.image ||
              p?.thumbnail ||
              (Array.isArray(p?.images?.gallery) && p.images.gallery[0]) ||
              (Array.isArray(p?.gallery) && p.gallery[0]) ||
              "";

            const altImg =
              (Array.isArray(p?.images?.gallery) && p.images.gallery[1]) ||
              (Array.isArray(p?.gallery) && p.gallery[1]) ||
              cover ||
              "";

            const image1 = r.mainImage ? r.mainImage : cover || "/placeholder.png";
            const image2 = r.hoverImage ? r.hoverImage : altImg || image1 || "/placeholder.png";

            const name = p?.title || p?.name || "Producto";
            const description = typeof p?.description === "string" ? p.description.trim() : "";

            const price = Number.isFinite(Number(p?.price)) ? Number(p.price) : 0;

            const sizes = Array.isArray(p?.sizes) ? p.sizes.filter(Boolean) : [];
            const colors = Array.isArray(p?.colors) ? p.colors : [];
            const features = Array.isArray(p?.features) ? p.features.filter(Boolean) : [];

            const hasDiscount = r.discountEnabled === true && r.discountPercent > 0;
            const discountPercent = hasDiscount ? Math.round(r.discountPercent) : 0;
            const finalPrice = hasDiscount ? Math.round(price * (1 - r.discountPercent / 100)) : price;

            return {
              id: String(r.productId),
              image1,
              image2,
              name,
              description,
              price,
              finalPrice,
              hasDiscount,
              discountPercent,
              sizes,
              colors,
              features,
            };
          })
          .filter(Boolean);

        setRemoteProducts(normalized);
        setRemoteLoading(false);

        const missing = refs.filter((r) => !byId.has(String(r.productId))).map((r) => r.productId);
        if (missing.length > 0) {
          setRemoteError({
            message:
              "Algunos IDs no devolvieron producto (revisa si existen en MongoDB o si el endpoint retorna otro formato).",
            missingIds: missing.slice(0, 10),
            totalMissing: missing.length,
          });
        }
      } catch (err) {
        if (cancelled) return;
        setRemoteProducts([]);
        setRemoteLoading(false);
        setRemoteError({
          message: "Error general cargando productos de tendencia.",
          details: err?.message || String(err),
        });
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [refs, shouldUseConfig]);

  const mustUseRemoteOnly = shouldUseConfig;

  const productsToRender = useMemo(() => {
    if (!mustUseRemoteOnly) return fallbackProducts;
    return remoteProducts;
  }, [mustUseRemoteOnly, remoteProducts]);

  function buildCartPayload(product) {
    return {
      _id: String(product.id || ""),
      title: product.name || "",
      image: product.image1 || "",
      color: "",
      size: "",
      quantity: 1,
      price: Number(product.hasDiscount ? product.finalPrice : product.price) || 0,
    };
  }

  function buildFavoritePayload(product) {
    return {
      productId: String(product.id || ""),
      title: product.name || "",
      image: product.image1 || "",
      color: "",
      size: "",
      price: Number(product.hasDiscount ? product.finalPrice : product.price) || 0,
    };
  }

  if (mustUseRemoteOnly && remoteError && (!remoteProducts || remoteProducts.length === 0)) {
    return (
      <section id="tendencia" className="pb-24 pt-5 relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-5">
            <div className="flex items-center justify-center">
              <img
                src={titleImage}
                alt="En tendencia"
                className="w-[230px] md:w-[280px] object-contain pointer-events-none select-none"
              />
            </div>
          </div>

          <div className="border border-red-300 bg-red-50 rounded-xl p-4 text-sm text-red-800">
            <div className="font-extrabold mb-2">Error cargando productos de “En Tendencia”</div>
            <div className="mb-2">{remoteError.message}</div>

            {remoteError.firstFail ? (
              <div className="text-xs whitespace-pre-wrap bg-white/70 border border-red-200 rounded-lg p-3">
                <div>
                  <b>URL:</b> {remoteError.firstFail.url}
                </div>
                <div>
                  <b>Status:</b> {remoteError.firstFail.status}
                </div>
                {remoteError.firstFail.body ? (
                  <div className="mt-2">
                    <b>Body:</b>
                    <div className="mt-1">{remoteError.firstFail.body.slice(0, 300)}</div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="mt-3 text-xs text-red-700">
              <b>API_BASE usado:</b> {API_BASE}
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="tendencia" className="pb-24 pt-5 relative overflow-hidden">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-5">
          <div className="flex items-center justify-center">
            <img
              src={titleImage}
              alt="En tendencia"
              className="w-[230px] md:w-[280px] object-contain pointer-events-none select-none"
            />
          </div>
        </div>

        {mustUseRemoteOnly && remoteError && remoteProducts.length > 0 ? (
          <div className="mb-3 border border-amber-200 bg-amber-50 rounded-xl p-3 text-xs text-amber-900">
            <div className="font-extrabold">Aviso</div>
            <div>{remoteError.message}</div>
            {remoteError.missingIds ? (
              <div className="mt-1">
                <b>IDs faltantes (muestra):</b> {remoteError.missingIds.join(", ")}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="grid grid-cols-2 md:grid-cols-4" style={{ gap: sectionStyle.spacingPx }}>
          {productsToRender.map((product, index) => {
            const radius = sectionStyle.cardRadiusPx;
            const imgH = sectionStyle.imageHeightPx;

            const mobileImgHeight = Math.max(145, Math.round(imgH * 0.66));
            const tabletImgHeight = Math.max(165, Math.round(imgH * 0.78));

            const sizesArrAll = uniqueStrings(product.sizes);
            const sizesToShow = sizesArrAll.slice(0, sectionStyle.maxSizesToShow);
            const extraSizes = Math.max(0, sizesArrAll.length - sizesToShow.length);

            const allColors = Array.isArray(product.colors) ? product.colors : [];
            const colorsHex = uniqueStrings(allColors.map(normalizeColorHex).filter(Boolean));
            const colorsToShow = colorsHex.slice(0, 6);

            const featuresList =
              Array.isArray(product.features) && product.features.length ? product.features.slice(0, 2) : [];

            const showDescription =
              sectionStyle.showDescription &&
              !featuresList.length &&
              typeof product.description === "string" &&
              product.description.trim();

            const showMetaBlock =
              (sectionStyle.showSizes && sizesArrAll.length > 0) || (sectionStyle.showColors && colorsHex.length > 0);

            const watermarkStyle = watermark.free
              ? {
                  left: `${watermark.posXPct}%`,
                  top: `${watermark.posYPct}%`,
                  transform: `translate(-50%, -50%) rotate(${watermark.rotateDeg}deg)`,
                }
              : watermark.position === "tr"
              ? {
                  right: 10 + watermark.offsetX,
                  top: 10 + watermark.offsetY,
                  transform: `rotate(${watermark.rotateDeg}deg)`,
                }
              : watermark.position === "bl"
              ? {
                  left: 10 + watermark.offsetX,
                  bottom: 10 + watermark.offsetY,
                  transform: `rotate(${watermark.rotateDeg}deg)`,
                }
              : watermark.position === "tl"
              ? {
                  left: 10 + watermark.offsetX,
                  top: 10 + watermark.offsetY,
                  transform: `rotate(${watermark.rotateDeg}deg)`,
                }
              : {
                  right: 10 + watermark.offsetX,
                  bottom: 10 + watermark.offsetY,
                  transform: `rotate(${watermark.rotateDeg}deg)`,
                };

            const favoritePayload = buildFavoritePayload(product);
            const cartPayload = buildCartPayload(product);
            const favoriteActive = isFavorite(favoritePayload);

            return (
              <Link key={product.id ?? index} to={`/producto/${product.id}`} className="block">
                <div
                  className="relative group bg-white border border-gray-200 shadow-sm hover:shadow-md transition flex flex-col"
                  style={{ borderRadius: radius, overflow: "hidden" }}
                >
                  {product.hasDiscount ? (
                    <div className="absolute top-2 left-2 z-30 bg-pink-100 text-pink-700 text-[9px] md:text-[11px] font-extrabold px-2 py-[3px] md:py-1 rounded-full border border-pink-200">
                      -{product.discountPercent}%
                    </div>
                  ) : null}

                  <div className="absolute top-2 right-2 z-30 flex flex-col gap-1.5 md:gap-2">
                    {actions.favorite.enabled ? (
                      <button
                        type="button"
                        title={favoriteActive ? "Quitar de favoritos" : "Agregar a favoritos"}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleFavorite(favoritePayload);
                        }}
                        className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-white/90 border border-gray-200 flex items-center justify-center hover:scale-105 transition"
                      >
                        <Star
                          className={`w-3.5 h-3.5 md:w-4 md:h-4 transition ${
                            favoriteActive ? "text-yellow-500 fill-yellow-500" : "text-pink-600"
                          }`}
                        />
                      </button>
                    ) : null}

                    {actions.cart.enabled ? (
                      <button
                        type="button"
                        title="Agregar al carrito"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          addToCart(cartPayload);
                        }}
                        className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-white/90 border border-gray-200 flex items-center justify-center hover:scale-105 transition"
                      >
                        <ShoppingCart className="w-3.5 h-3.5 md:w-4 md:h-4 text-pink-600" />
                      </button>
                    ) : null}
                  </div>

                  <div
                    className="relative md:h-[var(--img-h-desktop)] sm:h-[var(--img-h-tablet)] h-[var(--img-h-mobile)]"
                    style={{
                      "--img-h-mobile": `${mobileImgHeight}px`,
                      "--img-h-tablet": `${tabletImgHeight}px`,
                      "--img-h-desktop": `${imgH}px`,
                    }}
                  >
                    <img
                      src={product.image1}
                      alt={product.name}
                      className="absolute inset-0 w-full h-full object-cover opacity-100 group-hover:opacity-0 transition duration-300"
                      draggable={false}
                    />
                    <img
                      src={product.image2}
                      alt={product.name}
                      className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition duration-300"
                      draggable={false}
                    />
                  </div>

                  <div className="px-2.5 md:px-3 pt-2 md:pt-2.5 pb-2 relative overflow-hidden flex-1 min-h-[108px] sm:min-h-[126px] md:min-h-[180px]">
                    {watermarkImage ? (
                      <img
                        src={watermarkImage}
                        alt=""
                        className="absolute pointer-events-none select-none"
                        style={{
                          width: watermark.sizePx,
                          height: "auto",
                          opacity: watermark.opacity,
                          zIndex: 0,
                          ...watermarkStyle,
                        }}
                        draggable={false}
                      />
                    ) : null}

                    <div className="relative z-10">
                      <h3
                        className="text-[10px] md:text-sm font-extrabold text-gray-900 leading-snug line-clamp-1"
                        style={sectionStyle.titleStyle}
                      >
                        {product.name}
                      </h3>

                      <div className="mt-1 flex items-end justify-between gap-1.5 md:gap-2">
                        <div className="flex items-end gap-1.5 md:gap-2 min-w-0">
                          {product.hasDiscount ? (
                            <>
                              <span className="text-[9px] md:text-[12px] text-gray-400 line-through font-bold">
                                {moneyCOP(product.price)}
                              </span>
                              <span
                                className="text-[12px] md:text-base text-pink-700 font-extrabold tracking-tight"
                                style={sectionStyle.priceStyle}
                              >
                                {moneyCOP(product.finalPrice)}
                              </span>
                            </>
                          ) : (
                            <span
                              className="text-[12px] md:text-base text-gray-900 font-extrabold tracking-tight"
                              style={sectionStyle.priceStyle}
                            >
                              {moneyCOP(product.price)}
                            </span>
                          )}
                        </div>

                        {product.hasDiscount ? (
                          <span className="text-[8px] md:text-[11px] font-extrabold text-pink-700 bg-pink-50 border border-pink-100 px-1.5 md:px-2 py-[2px] rounded-full whitespace-nowrap">
                            Ahorra {product.discountPercent}%
                          </span>
                        ) : null}
                      </div>

                      {showMetaBlock ? (
                        <div className="mt-1.5 md:mt-2 rounded-xl bg-transparent px-0 py-0 border-0 shadow-none">
                          {sectionStyle.showSizes && sizesArrAll.length ? (
                            <div className="flex items-start gap-1.5 md:gap-2">
                              <div
                                className="shrink-0 text-[9px] md:text-[11px] font-extrabold tracking-wide text-gray-700"
                                style={sectionStyle.metaStyle}
                              >
                                TALLAS
                              </div>

                              <div className="flex flex-wrap gap-1">
                                {sizesToShow.map((sz) => (
                                  <span
                                    key={sz}
                                    className="px-1.5 md:px-2 py-[2px] md:py-[3px] text-[9px] md:text-[11px] font-extrabold text-gray-800 border border-[#ead1db] bg-transparent rounded-lg"
                                    style={sectionStyle.metaStyle}
                                    title={`Talla ${sz}`}
                                  >
                                    {sz}
                                  </span>
                                ))}

                                {extraSizes > 0 ? (
                                  <span
                                    className="px-1.5 md:px-2 py-[2px] md:py-[3px] text-[9px] md:text-[11px] font-extrabold text-gray-500 border border-[#ead1db] bg-transparent rounded-lg"
                                    style={sectionStyle.metaStyle}
                                    title={`${extraSizes} tallas más`}
                                  >
                                    +{extraSizes}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          ) : null}

                          {sectionStyle.showColors && colorsHex.length ? (
                            <div className={sectionStyle.showSizes && sizesArrAll.length ? "mt-1" : ""}>
                              <div className="flex items-center justify-between gap-1.5 md:gap-2">
                                <div
                                  className="text-[9px] md:text-[11px] font-extrabold tracking-wide text-gray-700"
                                  style={sectionStyle.metaStyle}
                                >
                                  COLORES
                                </div>

                                <div className="flex items-center gap-1">
                                  {colorsToShow.map((hex, i) => (
                                    <span
                                      key={`${hex}_${i}`}
                                      className="w-3.5 h-3.5 md:w-[18px] md:h-[18px] rounded-full border border-gray-200 shadow-[0_1px_0_rgba(0,0,0,0.05)] ring-1 ring-white"
                                      style={{ backgroundColor: hex }}
                                      title={hex}
                                    />
                                  ))}
                                  {colorsHex.length > colorsToShow.length ? (
                                    <span
                                      className="text-[9px] md:text-[11px] font-extrabold text-gray-500 ml-1"
                                      style={sectionStyle.metaStyle}
                                      title={`${colorsHex.length - colorsToShow.length} colores más`}
                                    >
                                      +{colorsHex.length - colorsToShow.length}
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      {sectionStyle.showFeatures && featuresList.length ? (
                        <ul className="mt-1.5 text-[9px] md:text-[11px] text-gray-600 space-y-0.5">
                          {featuresList.map((f, i) => (
                            <li key={i} className="flex gap-1.5 md:gap-2 leading-snug line-clamp-1">
                              <span className="text-pink-600 font-extrabold">•</span>
                              <span className="font-semibold" style={sectionStyle.descStyle}>
                                {f}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : null}

                      {showDescription ? (
                        <p
                          className="mt-1.5 text-[9px] md:text-[11px] text-gray-600 leading-snug line-clamp-1"
                          style={sectionStyle.descStyle}
                        >
                          {product.description}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {mustUseRemoteOnly && remoteLoading ? (
          <div className="mt-4 text-center text-xs text-gray-500">Cargando productos…</div>
        ) : null}
      </div>
    </section>
  );
}
