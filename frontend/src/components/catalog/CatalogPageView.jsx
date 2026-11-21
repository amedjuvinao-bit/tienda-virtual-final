// src/components/catalog/CatalogPageView.jsx
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useStorefrontPending } from '../storefrontLoadingContext';
import FilterSidebar from "../FilterSidebar";
import ProductCard from "../ProductCard";
import CatalogEditorialCard from "./CatalogEditorialCard";
import CatalogIntro from "./CatalogIntro";
import CatalogViewIcon from "./CatalogViewIcon";
import { clampInt, buildSafeCatalogConfig } from "./catalogConfig";
import useCatalogQuery from "./useCatalogQuery";
import useCatalogProducts from "./useCatalogProducts";
import CatalogFilterDrawer from "./CatalogFilterDrawer";
import "./catalogPage.css";
import "./catalogEditorial.css";
import "./catalogFooterGlass.css";
import "./catalogIntro.css";
import { catalogPresentationStyle } from "./catalogPresentation";
import useCatalogDepth from "./useCatalogDepth";
import { catalogContinuityBackdrop } from "./catalogBackdrop";
import CatalogSearchControls from "./CatalogSearchControls";
import PolishedGlassRim from "../PolishedGlassRim";
import "./catalogPolishedGlass.css";
import "./catalogFilters.css";
import {
  ShoppingBag,
  Filter,
  ChevronLeft,
  X,
  SlidersHorizontal,
} from "lucide-react";

// columnas -> clases tailwind
import "./collectionCatalog.css";
const colClasses = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
  6: "grid-cols-6",
};

// precio por defecto
const DEFAULT_MIN = 0;
const DEFAULT_MAX = 10_000_000;

export default function CatalogPageView({ page = null, catalogConfig = {}, theme, footer = null }) {
  const safeConfig = useMemo(
    () => buildSafeCatalogConfig(catalogConfig),
    [catalogConfig],
  );
  const presentation = safeConfig.presentation;
  const depthRef = useCatalogDepth(presentation);
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window === "undefined" ? 1280 : window.innerWidth,
  );
  useEffect(() => {
    const resize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  const isMobile = viewportWidth < 768;
  const backdrop = useMemo(() => presentation.backgroundMode === 'continuity' ? catalogContinuityBackdrop(theme, isMobile) : null, [presentation.backgroundMode, theme, isMobile]);
  const presentationStyle = {
    ...catalogPresentationStyle(presentation),
    ...(backdrop ? {
      '--catalog-bg': backdrop.color,
      '--catalog-backdrop': backdrop.image ? `url(${JSON.stringify(backdrop.image)})` : 'none',
    } : {}),
  };

  const {
    state: query,
    setCategories: setSelectedCategories,
    setColors: setSelectedColors,
    setPriceRange,
    setCols,
    setPage: setCatalogPage,
    setSearch,
    setSort,
    clear,
    clearFilters,
  } = useCatalogQuery(safeConfig, viewportWidth);
  const {
    categories: selectedCategories,
    colors: selectedColors,
    priceRange,
    cols,
  } = query;
  const {
    products: filteredProducts,
    pagination: productPagination,
    loading: productsLoading,
    error: productsError,
    retry,
  } = useCatalogProducts(safeConfig, query, setCatalogPage);
  useStorefrontPending(productsLoading);
  const contentRef = useRef(null);
  const settledHeight = useRef(0);
  useLayoutEffect(() => {
    if (!productsLoading) settledHeight.current = contentRef.current?.getBoundingClientRect().height || 0;
  }, [productsLoading, filteredProducts, cols, viewportWidth]);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [hoveredColButton, setHoveredColButton] = useState(null);
  const closeDrawer = useCallback(() => setMobileDrawerOpen(false), []);
  useEffect(() => {
    if (!isMobile) setMobileDrawerOpen(false);
  }, [isMobile]);
  const activeFilters = [
    ...selectedCategories.map((c) => ({ type: "cat", label: c })),
    ...selectedColors.map((c) => ({ type: "color", label: c })),
    ...(priceRange[0] > DEFAULT_MIN || priceRange[1] < DEFAULT_MAX
      ? [
          {
            type: "price",
            label: `${priceRange[0].toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 })} – ${priceRange[1].toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 })}`,
          },
        ]
      : []),
  ];

  const removeFilter = (filter) => {
    if (filter.type === "cat") {
      setSelectedCategories((prev) =>
        prev.filter((item) => item !== filter.label),
      );
    }
    if (filter.type === "color") {
      setSelectedColors((prev) => prev.filter((item) => item !== filter.label));
    }
    if (filter.type === "price") {
      setPriceRange([DEFAULT_MIN, DEFAULT_MAX]);
    }
  };

  const maxDesktopCols =
    viewportWidth < 1024 ? safeConfig.columnsTablet : safeConfig.columnsDesktop;
  const maxMobileCols = safeConfig.columnsMobile;
  const effectiveCols = cols;
  const renderedCols = effectiveCols;

  const editorial = presentation.layout === "glass-grid";
  const gridStyle = {
    "--catalog-columns": renderedCols,
    gap: isMobile ? "14px" : renderedCols === 1 ? "18px" : "22px",
    maxWidth: (() => {
      if (renderedCols === 1) {
        return isMobile ? "340px" : "720px";
      }
      return isMobile ? "470px" : "100%";
    })(),
    margin: renderedCols === 1 ? "0 auto" : undefined,
    width: "100%",
  };

  const columnControlsUi = safeConfig.columnControlsUiConfig || {};

  const normalButtonBgColor =
    typeof columnControlsUi.buttonBgColor === "string"
      ? columnControlsUi.buttonBgColor
      : "#ffffff";

  const normalButtonBorderColor =
    typeof columnControlsUi.buttonBorderColor === "string"
      ? columnControlsUi.buttonBorderColor
      : "#e8e7eb";

  const normalButtonIconColor =
    typeof columnControlsUi.buttonIconColor === "string"
      ? columnControlsUi.buttonIconColor
      : "#D4AF37";

  const activeButtonBgColor =
    typeof columnControlsUi.activeButtonBgColor === "string"
      ? columnControlsUi.activeButtonBgColor
      : "#fff5fa";

  const activeButtonBorderColor =
    typeof columnControlsUi.activeButtonBorderColor === "string"
      ? columnControlsUi.activeButtonBorderColor
      : "#ec4899";

  const activeButtonIconColor =
    typeof columnControlsUi.activeButtonIconColor === "string"
      ? columnControlsUi.activeButtonIconColor
      : "#ec4899";

  const hoverButtonBgColor =
    typeof columnControlsUi.hoverButtonBgColor === "string"
      ? columnControlsUi.hoverButtonBgColor
      : "#ffffff";

  const hoverButtonBorderColor =
    typeof columnControlsUi.hoverButtonBorderColor === "string"
      ? columnControlsUi.hoverButtonBorderColor
      : "#D4AF37";

  const hoverButtonIconColor =
    typeof columnControlsUi.hoverButtonIconColor === "string"
      ? columnControlsUi.hoverButtonIconColor
      : "#D4AF37";

  const columnButtonRadiusPx = clampInt(
    columnControlsUi.buttonRadiusPx,
    8,
    24,
    12,
  );

  const columnButtonBorderWidthPx = clampInt(
    columnControlsUi.buttonBorderWidthPx,
    1,
    4,
    1,
  );

  const navigateViews = (event) => {
    const buttons = [...event.currentTarget.querySelectorAll('button')];
    const current = buttons.indexOf(document.activeElement);
    let next;
    if (event.key === 'ArrowRight') next = (current + 1) % buttons.length;
    if (event.key === 'ArrowLeft') next = (current - 1 + buttons.length) % buttons.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = buttons.length - 1;
    if (next === undefined) return;
    event.preventDefault();
    setCols(Number(buttons[next].dataset.columns));
    buttons[next].focus();
  };

  const resultCount = safeConfig.showToolbar && safeConfig.showResultCount ? (
    <span className="cpv-result-pill" role="status" aria-live="polite">
      <strong>{productsLoading ? "…" : productPagination.totalProducts}</strong>
      {productPagination.totalProducts === 1 ? " producto" : " productos"}
    </span>
  ) : null;

  const hasCommandBar = safeConfig.showSearch || safeConfig.showSort || safeConfig.showToolbar || activeFilters.length > 0 || query.q;
  const commandBar = hasCommandBar ? (
    <div className="cpv-commandbar">
      <CatalogSearchControls
        config={safeConfig}
        query={query}
        onSearch={setSearch}
        onSort={setSort}
      />
      {(activeFilters.length > 0 || query.q) && (
        <div className="cpv-active-filters">
          {activeFilters.map((filter, index) => (
            <button
              key={`${filter.type}-${filter.label}-${index}`}
              className="cpv-filter-chip"
              onClick={() => removeFilter(filter)}
            >
              <span>{filter.label}</span>
              <X size={12} />
            </button>
          ))}

          <button
            className="cpv-filter-chip cpv-filter-chip--clear"
            style={editorial ? undefined : {
              background: "#f9fafb",
              borderColor: "#e5e7eb",
              color: "#6b7280",
            }}
            onClick={clear}
          >
            Limpiar todo
          </button>
        </div>
      )}

      {safeConfig.showToolbar && (
        <div className="cpv-toolbar">
          <div className="cpv-toolbar-left">
            {editorial && safeConfig.showFilters && safeConfig.showFilterFab && <button type="button" className="cpv-inline-filter" aria-label="Mostrar/ocultar filtros" aria-expanded={isMobile ? mobileDrawerOpen : sidebarVisible} onClick={() => isMobile ? setMobileDrawerOpen(true) : setSidebarVisible(value => !value)}><Filter size={15}/><span>Filtros</span></button>}
            {!editorial && resultCount}
          </div>

          <div className={`cpv-col-controls${editorial ? ' cpv-view-dock' : ''}`} role="group" aria-label="Vista de productos" onKeyDown={editorial ? navigateViews : undefined} style={editorial ? {
            '--catalog-view-index': effectiveCols - 1,
            '--catalog-view-extra': effectiveCols > 1 ? '8px' : '0px',
            '--catalog-view-bg': normalButtonBgColor,
            '--catalog-view-edge': normalButtonBorderColor,
            '--catalog-view-edge-width': `${columnButtonBorderWidthPx}px`,
            '--catalog-view-active-bg': activeButtonBgColor,
            '--catalog-view-active-edge': activeButtonBorderColor,
            '--catalog-view-radius': `${columnButtonRadiusPx}px`,
          } : undefined}>
            {editorial && <span className="cpv-view-indicator" aria-hidden="true"/>}
            {[1, 2, 3, 4, 5, 6].map((n) => {
              if (isMobile && n > maxMobileCols) return null;
              if (!isMobile && n > maxDesktopCols) return null;

              const isActive = effectiveCols === n;
              const isHovered = hoveredColButton === n;

              const currentButtonBg = isActive
                ? activeButtonBgColor
                : isHovered
                  ? hoverButtonBgColor
                  : normalButtonBgColor;

              const currentButtonBorder = isActive
                ? activeButtonBorderColor
                : isHovered
                  ? hoverButtonBorderColor
                  : normalButtonBorderColor;

              const currentIconColor = isActive
                ? activeButtonIconColor
                : isHovered
                  ? hoverButtonIconColor
                  : normalButtonIconColor;

              return (
                <div key={n} style={{ position: "relative" }}>
                  <button
                    type="button"
                    className={`cpv-col-btn ${isActive ? "active" : ""}`}
                    onClick={() => setCols(n)}
                    onMouseEnter={() => setHoveredColButton(n)}
                    onMouseLeave={() => setHoveredColButton(null)}
                    aria-pressed={isActive}
                    data-columns={n}
                    tabIndex={editorial ? (isActive ? 0 : -1) : undefined}
                    aria-label={
                      n === 1 ? "Vista lista" : `${n} columnas`
                    }
                    style={{
                      '--catalog-control-bg': currentButtonBg,
                      background: editorial ? undefined : currentButtonBg,
                      borderColor: editorial ? "transparent" : currentButtonBorder,
                      borderWidth: `${columnButtonBorderWidthPx}px`,
                      borderRadius: `${columnButtonRadiusPx}px`,
                    }}
                  >
                    {editorial ? <CatalogViewIcon columns={n} color={currentIconColor}/> : <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: n === 1 ? 0 : "3px",
                        flexDirection: n === 1 ? "column" : "row",
                        width: "100%",
                        height: "100%",
                        padding: "6px",
                      }}
                    >
                      {n === 1
                        ? [...Array(3)].map((_, i) => (
                            <span
                              key={i}
                              style={{
                                display: "block",
                                width: "20px",
                                height: "2px",
                                background: currentIconColor,
                                borderRadius: "2px",
                                margin: "1.5px 0",
                              }}
                            />
                          ))
                        : Array.from({ length: n }).map((_, i) => (
                            <span
                              key={i}
                              style={{
                                display: "block",
                                width: "2px",
                                height: "16px",
                                background: currentIconColor,
                                borderRadius: "2px",
                              }}
                            />
                          ))}
                    </div>}

                    <span className="cpv-tooltip">
                      {n === 1 ? "Lista" : `${n} columnas`}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  ) : null;

  return (
    <>
      <div ref={depthRef} className="cpv-page flex min-h-screen flex-col" data-collection={!!safeConfig.collection && editorial} data-layout={presentation.layout} data-background={backdrop ? "continuity" : "custom"} data-motion={presentation.motion} data-show-description={presentation.showDescription} data-show-options={presentation.showOptions} style={editorial || backdrop ? presentationStyle : undefined}>
        <div className="cpv-shell">
          {editorial && <div className="cpv-editorial-heading"><CatalogIntro config={safeConfig} page={page} resultCount={resultCount}>{commandBar}</CatalogIntro></div>}
          <div className="cpv-main-grid">
            {safeConfig.showFilters && !isMobile && (
              <aside
                className={`cpv-sidebar ${
                  sidebarVisible ? "visible" : "hidden-side"
                }`}
                style={{
                  "--catalog-filter-top": page?.useHeader === false
                    ? "12px"
                    : "calc(var(--site-header-height, 92px) + 12px)",
                }}
              >
                {sidebarVisible && (
                  <>
                    {editorial && <PolishedGlassRim radius={presentation.radius} width={safeConfig.filterUiConfig.borderWidthPx}/>}
                    <button
                      className="cpv-collapse-btn"
                      onClick={() => setSidebarVisible(false)}
                      title="Ocultar filtros"
                      aria-label="Ocultar filtros"
                    >
                      <ChevronLeft size={16} />
                    </button>

                    <div className="cpv-sidebar-body">
                      {!editorial && <div className="cpv-sidebar-title">
                        <SlidersHorizontal size={18} />
                        Filtros
                      </div>}

                      <FilterSidebar
                        selectedCategories={selectedCategories}
                        onCategoryChange={setSelectedCategories}
                        selectedColors={selectedColors}
                        onColorChange={setSelectedColors}
                        priceRange={priceRange}
                        onPriceChange={setPriceRange}
                        onClearFilters={clearFilters}
                        filterUiConfig={safeConfig.filterUiConfig}
                        catalogConfig={safeConfig}
                      />
                    </div>
                  </>
                )}
              </aside>
            )}

            <main ref={contentRef} className="cpv-content" style={{ minHeight: productsLoading && settledHeight.current ? `${settledHeight.current}px` : undefined }}>
              {!editorial && <CatalogIntro config={safeConfig} page={page}/>}

              {!editorial && commandBar}
              <div
                className={`cpv-grid ${colClasses[renderedCols] || colClasses[4]}`}
                style={gridStyle}
                data-columns={renderedCols}
                aria-busy={productsLoading}
                aria-label="Productos del catálogo"
              >
                {productsLoading ? (
                  <div className="cpv-empty">
                    <p role="status" className="sr-only">Cargando productos…</p>
                  </div>
                ) : productsError ? (
                  <div className="cpv-empty" role="alert">
                    <h3>No pudimos cargar el catálogo</h3>
                    <p>{productsError}</p>
                    <button
                      type="button"
                      className="cpv-filter-chip"
                      onClick={retry}
                    >
                      Reintentar
                    </button>
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="cpv-empty">
                    {safeConfig.collection ? <ShoppingBag className="collection-empty-icon" aria-hidden="true"/> : <div className="cpv-empty-icon">🔍</div>}
                    <h3>{safeConfig.collection && (query.q || activeFilters.length) ? safeConfig.collection.filteredEmptyTitle : safeConfig.emptyTitle}</h3>
                    <p>{safeConfig.collection && (query.q || activeFilters.length) ? safeConfig.collection.filteredEmptyText : safeConfig.emptyText}</p>
                  </div>
                ) : (
                  filteredProducts.map((product, idx) => (
                    <div
                      key={product._id}
                      className="cpv-product-item"
                      style={{
                        animationDelay: `${Math.min(idx * 45, 420)}ms`,
                      }}
                    >
                      {editorial ? <CatalogEditorialCard product={product} config={safeConfig}/> : <ProductCard product={product} cols={renderedCols} cardUiConfig={safeConfig.cardUiConfig}/>}

                    </div>
                  ))
                )}
              </div>

              {!productsError && productPagination.totalPages > 1 && (
                <nav
                  aria-label="Páginas del catálogo"
                  className="cpv-pagination"
                >
                  <button
                    type="button"
                    className="cpv-filter-chip"
                    disabled={
                      !productPagination.hasPreviousPage || productsLoading
                    }
                    onClick={() =>
                      setCatalogPage((current) => Math.max(1, current - 1))
                    }
                  >
                    Anterior
                  </button>
                  <span className="text-sm text-gray-600">
                    Página {productPagination.page} de{" "}
                    {productPagination.totalPages}
                  </span>
                  <button
                    type="button"
                    className="cpv-filter-chip"
                    disabled={!productPagination.hasNextPage || productsLoading}
                    onClick={() => setCatalogPage((current) => current + 1)}
                  >
                    Siguiente
                  </button>
                </nav>
              )}
            </main>
          </div>

          {(isMobile || !editorial || !safeConfig.showToolbar) && safeConfig.showFilters && safeConfig.showFilterFab && (
            <button
              className="cpv-fab"
              onClick={() =>
                isMobile
                  ? setMobileDrawerOpen(true)
                  : setSidebarVisible((v) => !v)
              }
              title="Mostrar/ocultar filtros"
              aria-label={isMobile ? "Abrir filtros" : "Mostrar/ocultar filtros"}
            >
              <Filter className="h-5 w-5" />
              <span style={{ display: isMobile ? "none" : undefined }}>
                {sidebarVisible ? "Ocultar filtros" : "Filtros"}
              </span>

              {(activeFilters.length > 0 || query.q) && (
                <span
                  style={{
                    background: "rgba(255,255,255,0.26)",
                    borderRadius: "999px",
                    padding: "1px 8px",
                    fontSize: "12px",
                    fontWeight: 700,
                  }}
                >
                  {activeFilters.length}
                </span>
              )}
            </button>
          )}

          {safeConfig.showFilters && isMobile && mobileDrawerOpen && (
            <CatalogFilterDrawer onClose={closeDrawer}>
              <FilterSidebar
                selectedCategories={selectedCategories}
                onCategoryChange={setSelectedCategories}
                selectedColors={selectedColors}
                onColorChange={setSelectedColors}
                priceRange={priceRange}
                onPriceChange={setPriceRange}
                onClearFilters={clearFilters}
                filterUiConfig={safeConfig.filterUiConfig}
                catalogConfig={safeConfig}
              />
            </CatalogFilterDrawer>
          )}
        </div>
        {backdrop && footer && <div className="cpv-footer">{footer}</div>}
      </div>
      {!backdrop && footer}
    </>
  );
}
