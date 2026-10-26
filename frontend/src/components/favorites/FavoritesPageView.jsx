import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Heart, Search, RefreshCw, ArrowRight } from "lucide-react";
import Header from "../Header";
import FooterSection from "../FooterSection";
import WhatsAppButton from "../WhatsAppButton";
import useStorefrontBackdrop from "../useStorefrontBackdrop";
import { cartVariables, CartGlass } from "../cart/CartMaterial";
import PolishedGlassRim from "../PolishedGlassRim";
import { favoriteKey, normalizeFavorites } from "../../utils/favoriteModel";
import {
  buildSafeFavoritesPageConfig,
  favoritesMaterialConfig,
} from "./favoritesPageConfig";
import FavoriteCard from "./FavoriteCard";
import "../cart/cartPage.css";
import "../catalog/catalogFooterGlass.css";
import "./favoritesPage.css";
export default function FavoritesPageView({
  page = {},
  favoritesState = {},
  cartState = {},
  configError = "",
  onRetryConfig,
  preview = false,
}) {
  const config = buildSafeFavoritesPageConfig(page.favoritesPageConfig),
    c = config.content,
    s = config.style;
  const material = favoritesMaterialConfig(config);
  const { image, color, settings } = useStorefrontBackdrop(
    config.presentation,
    s.pageBg,
  );
  const {
    favorites = [],
    isInitialized = true,
    loading = false,
    syncError = false,
    error = "",
    message = "",
    pendingCount = 0,
    syncFavorites,
    removeFromFavorites,
  } = favoritesState;
  const [query, setQuery] = useState(""),
    [sort, setSort] = useState("saved"),
    [failedTitle, setFailedTitle] = useState("");
  const items = useMemo(() => normalizeFavorites(favorites), [favorites]);
  const rows = useMemo(() => {
    const search = c.showSearch ? query.trim().toLocaleLowerCase("es") : "";
    const result = items.filter((item) =>
      [
        item.title,
        item.category,
        item.variantLabel,
        ...item.variantAttributes.map((a) => a.value),
      ]
        .join(" ")
        .toLocaleLowerCase("es")
        .includes(search),
    );
    const price = (item) =>
      Number(item.current?.valid ? item.current.price : item.price) || 0;
    if (!c.showSort || sort === "saved") return result.reverse();
    return result.sort(
      sort === "name"
        ? (a, b) => a.title.localeCompare(b.title, "es")
        : (a, b) => (price(a) - price(b)) * (sort === "price-desc" ? -1 : 1),
    );
  }, [items, query, sort, c.showSearch, c.showSort]);
  const header = page.useHeader !== false && c.showHeader;
  return (
    <div
      className="cart-storefront favorites-storefront"
      data-chrome={header}
      style={{
        ...cartVariables(material),
        backgroundColor: color,
        backgroundImage: image ? `url(${JSON.stringify(image)})` : "none",
        "--favorites-gap": `${s.gridGapPx}px`,
        "--favorites-desktop": c.cardsPerRowDesktop,
        "--favorites-tablet": c.cardsPerRowTablet,
        "--favorites-mobile": c.cardsPerRowMobile,
        "--favorites-image-ratio": s.imageRatio,
        "--favorites-image-fit": s.imageFit,
        "--favorites-button": s.buttonBg,
        "--favorites-button-ink": s.buttonTextColor,
        "--favorites-button-radius": `${s.buttonRadiusPx}px`,
        "--favorites-button-alpha": `${config.presentation.checkoutGlassOpacity * 100}%`,
      }}
    >
      {header && <Header />}
      <main
        className="cart-scene favorites-scene"
        style={{
          maxWidth: s.contentMaxWidthPx,
          "--cart-top": `${s.contentTopPaddingPx}px`,
        }}
      >
        {c.showBreadcrumb && (
          <nav className="cart-breadcrumb" aria-label="Ruta de favoritos">
            <Link to="/">{c.breadcrumbRootLabel}</Link>
            <span aria-hidden="true">/</span>
            <span style={{ color: s.badgeTextColor }}>{c.breadcrumbText}</span>
          </nav>
        )}
        <CartGlass config={material} className="favorites-heading">
          <div className="favorites-heading__top">
            <div>
              {c.showTitle && (
                <h1
                  style={{
                    fontSize: s.titleFontSizePx,
                    color: s.titleTextColor,
                  }}
                >
                  {c.titleMode === "image" &&
                  c.titleImage &&
                  failedTitle !== c.titleImage ? (
                    <img
                      src={c.titleImage}
                      alt={c.titleImageAlt}
                      style={{ height: s.titleImageHeightPx }}
                      onError={() => setFailedTitle(c.titleImage)}
                    />
                  ) : (
                    c.titleText
                  )}
                </h1>
              )}
              {c.subtitleText && <p>{c.subtitleText}</p>}
              {c.showCount && (
                <span className="favorites-count" aria-live="polite">
                  {items.length}{" "}
                  {items.length === 1 ? c.countSingularText : c.countLabelText}
                </span>
              )}
            </div>
            <Heart
              className="favorites-heading__icon"
              size={48}
              strokeWidth={1.1}
              aria-hidden="true"
            />
          </div>
          {items.length > 0 && (c.showSearch || c.showSort) && (
            <div className="favorites-tools">
              {c.showSearch && (
                <label className="favorites-search">
                  <Search size={16} aria-hidden="true" />
                  <input
                    type="search"
                    aria-label={c.searchPlaceholder}
                    placeholder={c.searchPlaceholder}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </label>
              )}
              {c.showSort && (
                <label className="favorites-sort">
                  <span>{c.sortLabel}</span>
                  <select
                    aria-label={c.sortLabel}
                    value={sort}
                    onChange={(event) => setSort(event.target.value)}
                  >
                    <option value="saved">{c.sortSavedText}</option>
                    <option value="price-asc">{c.sortPriceAscText}</option>
                    <option value="price-desc">{c.sortPriceDescText}</option>
                    <option value="name">{c.sortNameText}</option>
                  </select>
                </label>
              )}
            </div>
          )}
        </CartGlass>
        {configError && (
          <div className="cart-notice" role="alert">
            <span>{configError}</span>
            {onRetryConfig && (
              <button type="button" onClick={onRetryConfig}>
                <RefreshCw size={14} />
                {c.retryButtonText}
              </button>
            )}
          </div>
        )}
        {syncError && (
          <div className="cart-notice" role="alert">
            <span>{error}</span>
            <button type="button" disabled={loading} onClick={syncFavorites}>
              <RefreshCw size={14} />
              {c.retryButtonText}
            </button>
          </div>
        )}
        {cartState.cartMessage && (
          <p className="cart-notice" role="alert">
            {cartState.cartMessage}
          </p>
        )}
        {message && (
          <p className="favorites-status" role="status">
            {message}
          </p>
        )}
        {loading && isInitialized && (
          <p className="favorites-status" role="status">
            {pendingCount
              ? "Guardando tus cambios…"
              : "Actualizando favoritos…"}
          </p>
        )}
        {page.enabled === false && !preview ? (
          <CartGlass config={material}>
            <p>Esta página no está disponible en este momento.</p>
          </CartGlass>
        ) : items.length === 0 ? (
          <CartGlass config={material} className="favorites-empty">
            <Heart size={46} strokeWidth={1.2} aria-hidden="true" />
            <h2>{c.emptyTitle}</h2>
            <p>{c.emptyText}</p>
            {c.showEmptyButton && (
              <Link className="favorites-action" to={c.emptyButtonLink}>
                {c.emptyButtonText}
                <ArrowRight size={17} />
                <PolishedGlassRim
                  radius={s.buttonRadiusPx}
                  width={material.presentation.borderWidth}
                  reflection={material.presentation.reflection}
                />
              </Link>
            )}
          </CartGlass>
        ) : rows.length ? (
          <div className="favorites-grid" aria-label="Productos favoritos">
            {rows.map((item) => (
              <FavoriteCard
                key={favoriteKey(item)}
                item={item}
                config={config}
                material={material}
                remove={removeFromFavorites}
                addToCart={cartState.addToCart}
                cart={cartState.cart}
                cartBusy={cartState.loading}
                preview={preview}
              />
            ))}
          </div>
        ) : (
          <CartGlass config={material} className="favorites-empty">
            <p>{c.noResultsText}</p>
            <button
              type="button"
              className="favorites-action"
              onClick={() => setQuery("")}
            >
              {c.clearSearchText}
            </button>
          </CartGlass>
        )}
      </main>
      {page.useFooter !== false && c.showFooter && (
        <div className="cart-footer">
          <FooterSection
            theme={settings?.theme}
            store={settings?.store}
            polishedGlass
          />
        </div>
      )}
      {c.showWhatsapp && <WhatsAppButton />}
    </div>
  );
}
