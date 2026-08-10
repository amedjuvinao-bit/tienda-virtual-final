// src/pages/Favoritos.jsx
import React, { useEffect, useState } from 'react';
import { useFavorites } from '../context/FavoritesContext';
import ProductCard from '../components/ProductCard';
import Header from '../components/Header';
import FooterSection from '../components/FooterSection';
import WhatsAppButton from '../components/WhatsAppButton';
import { Link } from 'react-router-dom';
import { API_BASE_URL } from '../config/apiBaseUrl';

const API_BASE = API_BASE_URL;

// Normaliza un ítem de favoritos (sin importar si viene del backend o del front)
// para que ProductCard reciba un "product" con la forma esperada.
function normalizeFavItem(it) {
  // Caso A: ya es un producto completo (lo que guardas desde el front)
  if (it && (it._id || it.id)) {
    return {
      _id: it._id || it.id,
      title: it.title || it.name || 'Producto',
      image: it.image || it.images?.[0] || '/placeholders/no-image.png',
      price: Number(it.price || 0),
      slug: it.slug || undefined,
      // extras (para mostrar debajo del título)
      __color: it.color || undefined,
      __size: it.size || undefined,
    };
  }

  // Caso B: viene del backend: { productId, title, image, price, color, size }
  const pid = typeof it?.productId === 'object' ? it.productId?._id : it?.productId;
  const ptitle = typeof it?.productId === 'object' ? (it.productId?.title || it?.title) : it?.title;
  const pimage = typeof it?.productId === 'object' ? (it.productId?.image || it?.image) : it?.image;
  const pprice = typeof it?.productId === 'object' ? (it.productId?.price ?? it?.price) : it?.price;
  const pslug = typeof it?.productId === 'object' ? it.productId?.slug : undefined;

  if (!pid) return null;

  return {
    _id: pid,
    title: ptitle || 'Producto',
    image: pimage || '/placeholders/no-image.png',
    price: Number(pprice || 0),
    slug: pslug || undefined,
    __color: it?.color || undefined,
    __size: it?.size || undefined,
  };
}

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function safeString(value, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function safeBoolean(value, fallback = false) {
  return typeof value === 'boolean' ? value : fallback;
}

function buildSafeFavoritesPageConfig(input = {}) {
  const content = input?.content && typeof input.content === 'object' ? input.content : {};
  const style = input?.style && typeof input.style === 'object' ? input.style : {};

  return {
    content: {
      titleMode: content.titleMode === 'text' ? 'text' : 'image',
      titleText: safeString(content.titleText, 'Tus Favoritos'),
      titleImage: safeString(content.titleImage, '/PaginaFavorito/TituloFavorito.png'),
      titleImageAlt: safeString(content.titleImageAlt, 'Favoritos'),
      breadcrumbText: safeString(content.breadcrumbText, 'Favoritos'),
      breadcrumbRootLabel: safeString(content.breadcrumbRootLabel, 'Home'),
      emptyTitle: safeString(content.emptyTitle, 'No hay productos en tu lista de favoritos.'),
      emptyButtonText: safeString(content.emptyButtonText, 'Ver lo nuevo'),
      emptyButtonLink: safeString(content.emptyButtonLink, '/lo-nuevo'),
      showHeader: safeBoolean(content.showHeader, true),
      showFooter: safeBoolean(content.showFooter, true),
      showWhatsapp: safeBoolean(content.showWhatsapp, true),
      showBreadcrumb: safeBoolean(content.showBreadcrumb, true),
      showTitle: safeBoolean(content.showTitle, true),
      showEmptyButton: safeBoolean(content.showEmptyButton, true),
      cardsPerRowDesktop: clampNumber(content.cardsPerRowDesktop, 1, 6, 4),
      cardsPerRowTablet: clampNumber(content.cardsPerRowTablet, 1, 4, 2),
      cardsPerRowMobile: clampNumber(content.cardsPerRowMobile, 1, 2, 1),
    },

    style: {
      pageBg: safeString(style.pageBg, '#FFF0F5'),
      textPrimaryColor: safeString(style.textPrimaryColor, '#111827'),
      textSecondaryColor: safeString(style.textSecondaryColor, '#6B7280'),
      accentColor: safeString(style.accentColor, '#EC4899'),
      titleTextColor: safeString(style.titleTextColor, '#111827'),
      badgeTextColor: safeString(style.badgeTextColor, '#D4AF37'),
      buttonBg: safeString(style.buttonBg, '#EC4899'),
      buttonTextColor: safeString(style.buttonTextColor, '#FFFFFF'),
      contentTopPaddingPx: clampNumber(style.contentTopPaddingPx, 0, 300, 112),
      contentMaxWidthPx: clampNumber(style.contentMaxWidthPx, 600, 1800, 1280),
      titleFontSizePx: clampNumber(style.titleFontSizePx, 18, 90, 32),
      titleImageHeightPx: clampNumber(style.titleImageHeightPx, 40, 300, 100),
      buttonRadiusPx: clampNumber(style.buttonRadiusPx, 0, 999, 999),
      gridGapPx: clampNumber(style.gridGapPx, 8, 80, 24),
      buttonStyle: ['solid', 'outline', 'soft'].includes(style.buttonStyle)
        ? style.buttonStyle
        : 'solid',
    },
  };
}

function getButtonStyles(style) {
  if (style.buttonStyle === 'outline') {
    return {
      background: 'transparent',
      color: style.buttonBg,
      border: `1px solid ${style.buttonBg}`,
    };
  }

  if (style.buttonStyle === 'soft') {
    return {
      background: `${style.buttonBg}22`,
      color: style.buttonBg,
      border: `1px solid ${style.buttonBg}33`,
    };
  }

  return {
    background: style.buttonBg,
    color: style.buttonTextColor,
    border: `1px solid ${style.buttonBg}`,
  };
}

export default function Favoritos() {
  const { favorites } = useFavorites();
  const [pageData, setPageData] = useState(null);
  const [config, setConfig] = useState(buildSafeFavoritesPageConfig());

  useEffect(() => {
    let isMounted = true;

    async function loadFavoritesPage() {
      try {
        const res = await fetch(`${API_BASE}/api/pages/favoritos`);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();

        if (!isMounted) return;

        setPageData(data);
        setConfig(buildSafeFavoritesPageConfig(data?.favoritesPageConfig));
      } catch (error) {
        console.error('Error cargando configuración de Favoritos:', error);
      }
    }

    loadFavoritesPage();

    return () => {
      isMounted = false;
    };
  }, []);

  const normalized = (Array.isArray(favorites) ? favorites : [])
    .map(normalizeFavItem)
    .filter(Boolean);

  const buttonStyles = getButtonStyles(config.style);

  const gridClassName =
    config.content.cardsPerRowDesktop === 1
      ? 'xl:grid-cols-1'
      : config.content.cardsPerRowDesktop === 2
      ? 'xl:grid-cols-2'
      : config.content.cardsPerRowDesktop === 3
      ? 'xl:grid-cols-3'
      : config.content.cardsPerRowDesktop === 5
      ? 'xl:grid-cols-5'
      : config.content.cardsPerRowDesktop === 6
      ? 'xl:grid-cols-6'
      : 'xl:grid-cols-4';

  const tabletGridClassName =
    config.content.cardsPerRowTablet === 1
      ? 'sm:grid-cols-1 md:grid-cols-1'
      : config.content.cardsPerRowTablet === 3
      ? 'sm:grid-cols-2 md:grid-cols-3'
      : config.content.cardsPerRowTablet === 4
      ? 'sm:grid-cols-2 md:grid-cols-4'
      : 'sm:grid-cols-2 md:grid-cols-2';

  const mobileGridClassName =
    config.content.cardsPerRowMobile === 2 ? 'grid-cols-2' : 'grid-cols-1';

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: config.style.pageBg }}
    >
      {(pageData?.useHeader ?? true) && config.content.showHeader ? <Header /> : null}

      <div
        className="w-full mx-auto px-4 pb-8"
        style={{
          maxWidth: `${config.style.contentMaxWidthPx}px`,
          paddingTop: `${config.style.contentTopPaddingPx}px`,
        }}
      >
        {config.content.showBreadcrumb ? (
          <div className="mb-3 text-sm" style={{ color: config.style.accentColor }}>
            <Link
              to="/"
              className="font-medium transition"
              style={{ color: config.style.accentColor }}
            >
              {config.content.breadcrumbRootLabel}
            </Link>
            <span className="mx-2">›</span>
            <span className="font-semibold" style={{ color: config.style.badgeTextColor }}>
              {config.content.breadcrumbText}
            </span>
          </div>
        ) : null}

        {config.content.showTitle ? (
          <div className="flex justify-center mb-8">
            {config.content.titleMode === 'image' ? (
              <img
                src={config.content.titleImage}
                alt={config.content.titleImageAlt}
                className="h-auto object-contain max-w-full"
                style={{ height: `${config.style.titleImageHeightPx}px` }}
                draggable={false}
              />
            ) : (
              <h1
                className="text-center font-semibold"
                style={{
                  fontSize: `${config.style.titleFontSizePx}px`,
                  color: config.style.titleTextColor,
                }}
              >
                {config.content.titleText}
              </h1>
            )}
          </div>
        ) : null}

        {normalized.length === 0 ? (
          <div className="text-center">
            <p
              className="text-lg mb-4"
              style={{ color: config.style.accentColor }}
            >
              {config.content.emptyTitle}
            </p>

            {config.content.showEmptyButton ? (
              <Link
                to={config.content.emptyButtonLink || '/lo-nuevo'}
                className="inline-block px-5 py-2 transition"
                style={{
                  ...buttonStyles,
                  borderRadius: `${config.style.buttonRadiusPx}px`,
                }}
              >
                {config.content.emptyButtonText}
              </Link>
            ) : null}
          </div>
        ) : (
          <div
            className={`grid ${mobileGridClassName} ${tabletGridClassName} ${gridClassName}`}
            style={{ gap: `${config.style.gridGapPx}px` }}
          >
            {normalized.map((product) => (
              <div key={product._id} className="flex flex-col">
                <ProductCard product={product} cols={config.content.cardsPerRowDesktop} />
                {(product.__color || product.__size) && (
                  <div
                    className="mt-1 text-xs px-1"
                    style={{ color: config.style.textSecondaryColor }}
                  >
                    {product.__color && <span>Color: <b>{product.__color}</b></span>}
                    {product.__color && product.__size && <span> · </span>}
                    {product.__size && <span>Talla: <b>{product.__size}</b></span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {(pageData?.useFooter ?? true) && config.content.showFooter ? <FooterSection /> : null}
      {config.content.showWhatsapp ? <WhatsAppButton /> : null}
    </div>
  );
}
