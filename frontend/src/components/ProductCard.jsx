// src/components/ProductCard.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShoppingCart,
  ShoppingBag,
  Star,
  Heart,
  Sparkles,
} from 'lucide-react';
import { useCart } from '../context/CartContext.jsx';
import { useFavorites } from '../context/FavoritesContext';

function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function resolveFontFamily(value) {
  const safe = String(value || '').trim().toLowerCase();

  if (safe === 'jost') return 'Jost, sans-serif';
  if (safe === 'cormorant') return '"Cormorant Garamond", serif';
  if (safe === 'playfair') return '"Playfair Display", serif';
  if (safe === 'inter') return 'Inter, sans-serif';

  return undefined;
}

function hexToRgba(hex, alpha = 1) {
  const safe = String(hex || '').trim();

  if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(safe)) {
    return `rgba(255,255,255,${alpha})`;
  }

  let value = safe.slice(1);

  if (value.length === 3) {
    value = value
      .split('')
      .map((x) => x + x)
      .join('');
  }

  const num = Number.parseInt(value, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function buildCatalogCartIntent(product = {}) {
  const variants = (Array.isArray(product.variants) ? product.variants : [])
    .filter((variant) => variant?.active !== false);

  if (variants.length > 1) {
    return { requiresSelection: true, payload: null };
  }

  const variant = variants[0] || null;
  return {
    requiresSelection: false,
    payload: {
      ...product,
      color: variant?.colorLabel || variant?.color || '',
      colorValue: variant?.color || '',
      size: variant?.size || '',
      variantId: variant?.variantId || variant?.variantKey || '',
      variantKey: variant?.variantKey || '',
      variantLabel: variant?.label || '',
      variantAttributes: Array.isArray(variant?.attributes)
        ? variant.attributes
        : [],
      variantSku: variant?.sku || product.sku || '',
      variantBarcode: variant?.barcode || product.barcode || '',
      quantity: 1,
      price: Number(variant?.price ?? product.price ?? 0) || 0,
    },
  };
}

function buildSafeCardUiConfig(raw) {
  const cfg = raw && typeof raw === 'object' ? raw : {};

  return {
    cardBg: typeof cfg.cardBg === 'string' ? cfg.cardBg : '#ffffff',
    cardBorderColor:
      typeof cfg.cardBorderColor === 'string' ? cfg.cardBorderColor : '#ecdcb6',
    cardBorderWidthPx: clampInt(cfg.cardBorderWidthPx, 0, 6, 1),
    cardRadiusPx: clampInt(cfg.cardRadiusPx, 8, 40, 28),
    cardPaddingPx: clampInt(cfg.cardPaddingPx, 0, 40, 12),

    imageBg: typeof cfg.imageBg === 'string' ? cfg.imageBg : '#faf8f3',
    imageRadiusPx: clampInt(cfg.imageRadiusPx, 0, 40, 24),
    imageFit:
      cfg.imageFit === 'contain' || cfg.imageFit === 'cover'
        ? cfg.imageFit
        : 'cover',

    titleColor: typeof cfg.titleColor === 'string' ? cfg.titleColor : '#2f3440',
    priceColor: typeof cfg.priceColor === 'string' ? cfg.priceColor : '#e54497',
    oldPriceColor:
      typeof cfg.oldPriceColor === 'string' ? cfg.oldPriceColor : '#9ca3af',
    metaColor: typeof cfg.metaColor === 'string' ? cfg.metaColor : '#6b7280',

    titleFontFamily:
      typeof cfg.titleFontFamily === 'string' ? cfg.titleFontFamily : '',
    priceFontFamily:
      typeof cfg.priceFontFamily === 'string' ? cfg.priceFontFamily : '',
    metaFontFamily:
      typeof cfg.metaFontFamily === 'string' ? cfg.metaFontFamily : '',

    favoriteButtonBg:
      typeof cfg.favoriteButtonBg === 'string' ? cfg.favoriteButtonBg : '#ffffff',
    cartButtonBg:
      typeof cfg.cartButtonBg === 'string' ? cfg.cartButtonBg : '#ffffff',
    favoriteButtonOpacity: clampNumber(cfg.favoriteButtonOpacity, 0, 1, 1),
    cartButtonOpacity: clampNumber(cfg.cartButtonOpacity, 0, 1, 1),

    actionButtonBorderColor:
      typeof cfg.actionButtonBorderColor === 'string'
        ? cfg.actionButtonBorderColor
        : '#ffffff',
    actionButtonBorderWidthPx: clampInt(cfg.actionButtonBorderWidthPx, 0, 4, 1),

    favoriteIconColor:
      typeof cfg.favoriteIconColor === 'string' ? cfg.favoriteIconColor : '#d946ef',
    favoriteActiveColor:
      typeof cfg.favoriteActiveColor === 'string'
        ? cfg.favoriteActiveColor
        : '#D4AF37',
    cartIconColor:
      typeof cfg.cartIconColor === 'string' ? cfg.cartIconColor : '#D4AF37',

    favoriteIconName:
      cfg.favoriteIconName === 'heart' ||
      cfg.favoriteIconName === 'sparkles' ||
      cfg.favoriteIconName === 'star'
        ? cfg.favoriteIconName
        : 'star',

    cartIconName:
      cfg.cartIconName === 'shopping-bag' ||
      cfg.cartIconName === 'bag-heart' ||
      cfg.cartIconName === 'shopping-cart'
        ? cfg.cartIconName
        : 'shopping-cart',
  };
}

const COLOR_LABELS = {
  '#d4af37': 'Dorado',
  '#6fd2c5': 'Aqua pastel',
  '#ffe991': 'Amarillo pastel',
  '#a9d4ed': 'Azul pastel',
  '#fae1b8': 'Durazno',
  '#ffffff': 'Blanco',
  '#cfa8e0': 'Lila',
  '#eacbcb': 'Rosa claro',
  '#ff7bac': 'Rosa',
  '#fbb2d3': 'Rosa suave',
  '#ff8c94': 'Coral',
  '#000000': 'Negro',
  '#ff69b4': 'Rosa',
  '#ff1493': 'Fucsia',
  '#0000ff': 'Azul',
  '#00ff00': 'Verde',
  '#ff0000': 'Rojo',
};

function prettyColor(c) {
  const key = String(c || '').toLowerCase();
  return COLOR_LABELS[key] || c;
}

function renderFavoriteIcon(iconName, isActive, iconStyle) {
  const fillValue = isActive ? 'currentColor' : 'none';

  if (iconName === 'heart') {
    return (
      <Heart
        className="h-[15px] w-[15px] sm:h-4 sm:w-4"
        style={iconStyle}
        fill={fillValue}
        strokeWidth={1.8}
      />
    );
  }

  if (iconName === 'sparkles') {
    return (
      <Sparkles
        className="h-[15px] w-[15px] sm:h-4 sm:w-4"
        style={iconStyle}
        strokeWidth={1.8}
      />
    );
  }

  return (
    <Star
      className="h-[15px] w-[15px] sm:h-4 sm:w-4"
      style={iconStyle}
      fill={fillValue}
      strokeWidth={1.8}
    />
  );
}

function renderCartIcon(iconName, iconStyle) {
  if (iconName === 'shopping-bag') {
    return (
      <ShoppingBag
        className="h-[15px] w-[15px] sm:h-4 sm:w-4"
        style={iconStyle}
        strokeWidth={1.8}
      />
    );
  }

  if (iconName === 'bag-heart') {
    return (
      <span className="relative flex h-[15px] w-[15px] items-center justify-center sm:h-4 sm:w-4">
        <ShoppingBag
          className="h-[15px] w-[15px] sm:h-4 sm:w-4"
          style={iconStyle}
          strokeWidth={1.8}
        />
        <Heart
          className="absolute bottom-[-1px] right-[-1px] h-[7px] w-[7px] sm:h-[8px] sm:w-[8px]"
          style={iconStyle}
          fill="currentColor"
          strokeWidth={1.8}
        />
      </span>
    );
  }

  return (
    <ShoppingCart
      className="h-[15px] w-[15px] sm:h-4 sm:w-4"
      style={iconStyle}
      strokeWidth={1.8}
    />
  );
}

export default function ProductCard({
  product = null,
  cols = 3,
  cardUiConfig = {},
}) {
  if (!product || typeof product !== 'object') return null;

  const {
    _id = '',
    slug = '',
    title = '',
    image = '',
    images = [],
    price = 0,
    originalPrice,
    description = '',
    colors = [],
    sizes = [],
    active = true,
  } = product;

  if (!_id) return null;

  const { addToCart } = useCart();
  const { toggleFavorite, isFavorite } = useFavorites();
  const navigate = useNavigate();

  const [hovered, setHovered] = useState(null);
  const [isMobile, setIsMobile] = useState(false);

  const safeCardUi = useMemo(
    () => buildSafeCardUiConfig(cardUiConfig),
    [cardUiConfig]
  );

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const isList = cols === 1;
  const cover = String(image || '').trim();
  const linkTo = `/producto/${encodeURIComponent(slug || _id)}`;
  const isFavoriteActive = isFavorite(_id);
  const cartIntent = useMemo(
    () => buildCatalogCartIntent(product),
    [product]
  );
  const cartActionLabel = cartIntent.requiresSelection
    ? 'Seleccionar opciones'
    : 'Agregar al carrito';

  const normalizedColors = Array.isArray(colors)
    ? colors
        .map((c) => {
          if (typeof c === 'string') return { value: c, label: c };
          const value = c?.hex || c?.value || c?.name || '';
          const label = c?.name || c?.label || c?.hex || value;
          return value ? { value, label } : null;
        })
        .filter(Boolean)
    : [];

  const visibleColors = normalizedColors.slice(0, 6);

  const totalImgs = useMemo(() => {
    const gallery = Array.isArray(images)
      ? images.filter((u) => typeof u === 'string' && u.trim() && u !== cover)
      : [];
    return (cover ? 1 : 0) + gallery.length;
  }, [cover, images]);

  const cardStyle = {
    backgroundColor: safeCardUi.cardBg,
    borderColor: safeCardUi.cardBorderColor,
    borderWidth: `${safeCardUi.cardBorderWidthPx}px`,
    borderRadius: `${safeCardUi.cardRadiusPx}px`,
    padding: `${safeCardUi.cardPaddingPx}px`,
  };

  const imageStyle = {
    backgroundColor: safeCardUi.imageBg,
    borderRadius: `${safeCardUi.imageRadiusPx}px`,
  };

  const titleStyle = {
    color: safeCardUi.titleColor,
    fontFamily: resolveFontFamily(safeCardUi.titleFontFamily),
  };

  const priceStyle = {
    color: safeCardUi.priceColor,
    fontFamily: resolveFontFamily(safeCardUi.priceFontFamily),
  };

  const oldPriceStyle = {
    color: safeCardUi.oldPriceColor,
    fontFamily: resolveFontFamily(safeCardUi.priceFontFamily),
  };

  const metaStyle = {
    color: safeCardUi.metaColor,
    fontFamily: resolveFontFamily(safeCardUi.metaFontFamily),
  };

  const favoriteButtonStyle = {
    backgroundColor: hexToRgba(
      safeCardUi.favoriteButtonBg,
      safeCardUi.favoriteButtonOpacity
    ),
    borderColor: hexToRgba(safeCardUi.actionButtonBorderColor, 0.72),
    borderWidth: `${safeCardUi.actionButtonBorderWidthPx}px`,
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  };

  const cartButtonStyle = {
    backgroundColor: hexToRgba(
      safeCardUi.cartButtonBg,
      safeCardUi.cartButtonOpacity
    ),
    borderColor: hexToRgba(safeCardUi.actionButtonBorderColor, 0.72),
    borderWidth: `${safeCardUi.actionButtonBorderWidthPx}px`,
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  };

  const favoriteIconStyle = {
    color: isFavoriteActive
      ? safeCardUi.favoriteActiveColor
      : safeCardUi.favoriteIconColor,
  };

  const cartIconStyle = {
    color: safeCardUi.cartIconColor,
  };

  const handleAddToCart = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (cartIntent.requiresSelection) {
      navigate(linkTo);
      return;
    }
    addToCart(cartIntent.payload);
  };

  const handleToggleFavorite = (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite(product);
  };

  return (
    <div className="w-full">
      <div
        className={`group border bg-white transition hover:shadow-lg ${
          isList ? 'overflow-hidden rounded-[28px]' : 'rounded-[28px]'
        }`}
        style={cardStyle}
      >
        <div
          className={
            isList
              ? 'flex flex-col md:flex-row md:items-start md:gap-8'
              : ''
          }
        >
          <div
            className={`relative overflow-hidden border border-[#eeddb8] ${
              isList ? 'w-full md:w-[290px] md:min-w-[290px] md:max-w-[290px]' : ''
            }`}
            style={imageStyle}
          >
            <Link to={linkTo}>
              <div
                className={`overflow-hidden ${
                  isList ? 'aspect-[4/5] md:h-[340px] md:aspect-auto' : 'aspect-[4/5]'
                }`}
                style={imageStyle}
              >
                {cover ? (
                  <img
                    src={cover}
                    alt={title}
                    className="h-full w-full transition-transform duration-500 group-hover:scale-[1.035]"
                    style={{ objectFit: safeCardUi.imageFit }}
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm text-gray-400">
                    Sin imagen
                  </div>
                )}
              </div>
            </Link>

            {totalImgs > 1 && (
              <span className="absolute bottom-2 right-2 rounded-full border border-white/70 bg-white/90 px-2.5 py-1 text-[10px] font-medium text-[#5f6673] shadow-sm backdrop-blur">
                {totalImgs} fotos
              </span>
            )}

            {active === false && (
              <span className="absolute left-2 top-2 rounded-full bg-gray-700/85 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-white">
                Inactivo
              </span>
            )}

            {!isList && (
              <div className="absolute right-2 top-2 flex flex-col gap-1.5">
                <div
                  className="relative"
                  onMouseEnter={() => setHovered('favorito')}
                  onMouseLeave={() => setHovered(null)}
                >
                  <button
                    onClick={handleToggleFavorite}
                    className="flex h-8 w-8 items-center justify-center rounded-full border transition duration-200 hover:scale-[1.05] hover:shadow-sm"
                    style={favoriteButtonStyle}
                    aria-label="Favorito"
                  >
                    {renderFavoriteIcon(
                      safeCardUi.favoriteIconName,
                      isFavoriteActive,
                      favoriteIconStyle
                    )}
                  </button>

                  {hovered === 'favorito' && !isMobile && (
                    <span className="absolute right-full top-1/2 mr-2 -translate-y-1/2 whitespace-nowrap rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-pink-700 shadow">
                      Favorito
                    </span>
                  )}
                </div>

                <div
                  className="relative"
                  onMouseEnter={() => setHovered('comprar')}
                  onMouseLeave={() => setHovered(null)}
                >
                  <button
                    onClick={handleAddToCart}
                    className="flex h-8 w-8 items-center justify-center rounded-full border transition duration-200 hover:scale-[1.05] hover:shadow-sm"
                    style={cartButtonStyle}
                    aria-label={cartActionLabel}
                  >
                    {renderCartIcon(safeCardUi.cartIconName, cartIconStyle)}
                  </button>

                  {hovered === 'comprar' && !isMobile && (
                    <span className="absolute right-full top-1/2 mr-2 -translate-y-1/2 whitespace-nowrap rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-pink-700 shadow">
                      {cartActionLabel}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          <div
            className={`min-w-0 text-left ${
              isList
                ? 'flex flex-1 flex-col px-1 pt-4 pb-1 md:pt-4 md:pr-6 md:pb-4'
                : 'px-1 pt-2 pb-1'
            }`}
          >
            <h3
              className={`font-semibold leading-[1.2] ${
                isList
                  ? 'max-w-[520px] text-[18px] sm:text-[20px] md:text-[22px]'
                  : 'line-clamp-2 text-[16px] sm:text-[18px] md:text-[20px]'
              }`}
              style={titleStyle}
            >
              {title}
            </h3>

            {visibleColors.length > 0 && (
              <div className={`${isList ? 'mt-3' : 'mt-1'} flex items-center gap-1.5`}>
                {!isList && (
                  <span
                    className="text-[9px] font-semibold uppercase tracking-[0.14em]"
                    style={metaStyle}
                  >
                    Colores
                  </span>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  {visibleColors.map((c, i) => (
                    <span
                      key={`${c.value}-${i}`}
                      title={prettyColor(c.value)}
                      className={`${isList ? 'h-5 w-5' : 'h-3 w-3'} rounded-full border border-gray-300`}
                      style={{ backgroundColor: c.value }}
                    />
                  ))}
                </div>
              </div>
            )}

            <div
              className={`flex flex-wrap items-center gap-x-2 gap-y-1 ${
                isList ? 'mt-4' : 'mt-0.5'
              }`}
            >
              {originalPrice > 0 && (
                <span
                  className={
                    isList
                      ? 'text-[13px] line-through md:text-[14px]'
                      : 'text-[11px] line-through sm:text-xs'
                  }
                  style={oldPriceStyle}
                >
                  ${Number(originalPrice).toLocaleString()}
                </span>
              )}

              <span
                className={
                  isList
                    ? 'text-[24px] font-semibold md:text-[26px]'
                    : 'text-[15px] font-semibold sm:text-[16px]'
                }
                style={priceStyle}
              >
                ${Number(price).toLocaleString()}
              </span>
            </div>

            {description ? (
              <p
                className={`opacity-85 ${
                  isList
                    ? 'mt-3 max-w-[520px] text-[13px] leading-6 md:text-[14px]'
                    : 'mt-1 text-[10px] leading-4 sm:text-[11px]'
                }`}
                style={metaStyle}
              >
                {description}
              </p>
            ) : null}

            {isList && (
              <div className="mt-5 flex items-center gap-2.5">
                <div
                  className="relative"
                  onMouseEnter={() => setHovered('favorito')}
                  onMouseLeave={() => setHovered(null)}
                >
                  <button
                    onClick={handleToggleFavorite}
                    className="flex h-9 w-9 items-center justify-center rounded-full border transition duration-200 hover:scale-[1.04] hover:shadow-sm"
                    style={favoriteButtonStyle}
                    aria-label="Favorito"
                  >
                    {renderFavoriteIcon(
                      safeCardUi.favoriteIconName,
                      isFavoriteActive,
                      favoriteIconStyle
                    )}
                  </button>

                  {hovered === 'favorito' && !isMobile && (
                    <span className="absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-pink-700 shadow">
                      Favorito
                    </span>
                  )}
                </div>

                <div
                  className="relative"
                  onMouseEnter={() => setHovered('comprar')}
                  onMouseLeave={() => setHovered(null)}
                >
                  <button
                    onClick={handleAddToCart}
                    className="flex h-9 w-9 items-center justify-center rounded-full border transition duration-200 hover:scale-[1.04] hover:shadow-sm"
                    style={cartButtonStyle}
                    aria-label={cartActionLabel}
                  >
                    {renderCartIcon(safeCardUi.cartIconName, cartIconStyle)}
                  </button>

                  {hovered === 'comprar' && !isMobile && (
                    <span className="absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-pink-700 shadow">
                      {cartActionLabel}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
