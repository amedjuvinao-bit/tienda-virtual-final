import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import CatalogEditorialCard from "../components/catalog/CatalogEditorialCard";
import { buildSafeCatalogConfig } from "../components/catalog/catalogConfig";
import { CartGlass } from "../components/cart/CartMaterial";
import ServicePageFrame, {
  ServiceButton,
  ServiceHeading,
} from "../components/service-pages/ServicePageFrame";
import { buildServicePageConfig } from "../components/service-pages/servicePageConfig";
import "./searchResults.css";
export default function SearchResultsView({
  page = {},
  config: suppliedConfig,
  preview = false,
  theme,
  q = "",
  category = "",
  categoryName = "",
  state,
  draft = "",
  setDraft,
  submit,
  goToPage,
  retrySearch,
  configError,
  onRetryConfig,
}) {
  const config =
    suppliedConfig ||
    buildServicePageConfig(page.searchPageConfig, "search-page");
  const s = config.style;
  const cards = buildSafeCatalogConfig({
    cardUiConfig: {
      cardBg: s.cardBg,
      cardBorderColor: s.cardBorderColor,
      titleColor: s.textPrimaryColor,
      priceColor: s.accentColor,
      metaColor: s.textSecondaryColor,
      cardBorderWidthPx: config.presentation.borderWidth,
      cardRadiusPx: s.cardRadiusPx,
      imageFit: config.imageFit,
      cardPaddingPx: 0,
      imageRadiusPx: 0,
      showBorder: true,
      showImageBg: false,
      favoriteIconColor: s.accentColor,
      favoriteActiveColor: s.accentColor,
      cartIconColor: s.accentColor,
    },
    presentation: { rimStyle: "optical", rimColor: s.cardBorderColor },
  });
  return (
    <ServicePageFrame
      page={page}
      config={config}
      preview={preview}
      theme={theme}
      className="search-results-page"
    >
      {config.showBreadcrumb && (
        <nav className="cart-breadcrumb" aria-label="Ruta de navegación">
          <Link to="/">{config.homeText}</Link>
          <span aria-hidden="true">/</span>
          <span>{config.breadcrumbText}</span>
        </nav>
      )}
      <ServiceHeading
        config={config}
        title={
          category
            ? categoryName || config.categoryText
            : q
              ? config.titleText
              : config.idleTitle
        }
        icon={Search}
      >
        {(q || category) && (
          <p className="search-results-caption">
            {category ? categoryName : `“${q}”`}
            {!state.loading && !state.error && (
              <>
                {" "}
                · {state.pagination.totalProducts}{" "}
                {state.pagination.totalProducts === 1
                  ? config.productSingular
                  : config.productPlural}
              </>
            )}
          </p>
        )}
        <form className="search-results-form" role="search" onSubmit={submit}>
          <input
            className="service-input"
            aria-label={config.inputLabel}
            type="search"
            maxLength={160}
            value={draft}
            onChange={(event) => setDraft?.(event.target.value)}
            placeholder={config.placeholderText}
          />
          <ServiceButton
            config={config}
            type="submit"
            disabled={!draft.trim() && !category}
          >
            <Search size={16} aria-hidden="true" />
            {config.searchText}
          </ServiceButton>
        </form>
      </ServiceHeading>
      {configError && (
        <div role="alert" className="service-message">
          {configError}{" "}
          <ServiceButton config={config} onClick={onRetryConfig}>
            {config.retryText}
          </ServiceButton>
        </div>
      )}
      {state.loading ? (
        <CartGlass config={config} className="service-message" role="status">
          {config.loadingText}
        </CartGlass>
      ) : state.error ? (
        <CartGlass config={config} className="service-message" role="alert">
          {config.errorText}{" "}
          <ServiceButton config={config} onClick={retrySearch}>
            {config.retryText}
          </ServiceButton>
        </CartGlass>
      ) : !q && !category ? (
        <CartGlass config={config} className="service-message">
          {config.idleText}
        </CartGlass>
      ) : !state.products.length ? (
        <CartGlass config={config} className="service-message">
          {config.emptyText}
        </CartGlass>
      ) : (
        <>
          <div
            className="search-results-grid"
            style={{
              "--search-cols": config.columns,
              "--search-mobile-cols": config.mobileColumns,
              "--catalog-image-ratio": config.imageRatio,
              "--catalog-card-opacity": config.presentation.glassOpacity,
              "--catalog-card-blur": `${config.presentation.glassBlur}px`,
            }}
          >
            {state.products.map((product) => (
              <CatalogEditorialCard
                key={product._id}
                product={product}
                config={cards}
              />
            ))}
          </div>
          {state.pagination.totalPages > 1 && (
            <nav
              className="search-results-pages"
              aria-label="Páginas de resultados"
            >
              <ServiceButton
                config={config}
                disabled={!state.pagination.hasPreviousPage}
                onClick={() => goToPage(state.pagination.page - 1)}
              >
                {config.previousText}
              </ServiceButton>
              <span>
                {config.pageLabel} {state.pagination.page} {config.ofLabel}{" "}
                {state.pagination.totalPages}
              </span>
              <ServiceButton
                config={config}
                disabled={!state.pagination.hasNextPage}
                onClick={() => goToPage(state.pagination.page + 1)}
              >
                {config.nextText}
              </ServiceButton>
            </nav>
          )}
        </>
      )}
    </ServicePageFrame>
  );
}
