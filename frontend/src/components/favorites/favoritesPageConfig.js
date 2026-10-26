import { buildSafeCartPageConfig, safePath } from "../cart/cartPageConfig";
const object = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};
const number = (value, min, max, fallback) =>
  Number.isFinite(Number.parseFloat(value))
    ? Math.min(max, Math.max(min, Number.parseFloat(value)))
    : fallback;
export function buildSafeFavoritesPageConfig(raw = {}) {
  const cfg = object(raw),
    content = object(cfg.content),
    style = object(cfg.style);
  const material = buildSafeCartPageConfig({
    ...cfg,
    style: {
      ...style,
      cardBg: style.cardBg || "#efb9b7",
      textPrimaryColor: style.textPrimaryColor || "#652d42",
      textSecondaryColor: style.textSecondaryColor || "#875a68",
      accentColor: style.accentColor || "#b3315c",
    },
  });
  const defaults = {
    titleMode: "text",
    titleText: "Tus favoritos",
    titleImage: "",
    titleImageAlt: "Favoritos",
    subtitleText: "Tu selección, lista para volver a ella.",
    breadcrumbRootLabel: "Inicio",
    breadcrumbText: "Favoritos",
    emptyTitle: "Tu lista de favoritos está esperando",
    emptyText: "Guarda los productos que te interesan para encontrarlos aquí.",
    emptyButtonText: "Explorar productos",
    emptyButtonLink: "/#categorias",
    countSingularText: "producto guardado",
    countLabelText: "productos guardados",
    searchPlaceholder: "Buscar en tus favoritos",
    sortLabel: "Ordenar por",
    sortSavedText: "Guardados recientemente",
    sortPriceAscText: "Menor precio",
    sortPriceDescText: "Mayor precio",
    sortNameText: "Nombre",
    noResultsText: "No encontramos productos con esa búsqueda.",
    clearSearchText: "Limpiar búsqueda",
    addButtonText: "Agregar al carrito",
    selectOptionsText: "Seleccionar opciones",
    removeButtonText: "Quitar de favoritos",
    detailButtonText: "Ver producto",
    unavailableText: "No disponible",
    retryButtonText: "Reintentar",
  };
  const normalized = Object.fromEntries(
    Object.entries(defaults).map(([key, fallback]) => [
      key,
      typeof content[key] === "string" ? content[key] : fallback,
    ]),
  );
  return {
    ...cfg,
    content: {
      ...content,
      ...normalized,
      titleMode: content.titleMode === "image" ? "image" : "text",
      emptyButtonLink: safePath(content.emptyButtonLink, "/#categorias"),
      ...Object.fromEntries(
        [
          "showHeader",
          "showFooter",
          "showWhatsapp",
          "showBreadcrumb",
          "showTitle",
          "showEmptyButton",
          "showSearch",
          "showSort",
          "showCount",
          "showPrice",
          "showVariants",
          "showCartButton",
          "showRemoveButton",
        ].map((key) => [key, content[key] !== false]),
      ),
      cardsPerRowDesktop: Math.round(
        number(content.cardsPerRowDesktop, 1, 6, 4),
      ),
      cardsPerRowTablet: Math.round(number(content.cardsPerRowTablet, 1, 4, 2)),
      cardsPerRowMobile: Math.round(number(content.cardsPerRowMobile, 1, 2, 1)),
    },
    presentation: material.presentation,
    style: {
      ...material.style,
      titleTextColor: style.titleTextColor || material.style.textPrimaryColor,
      badgeTextColor: style.badgeTextColor || material.style.accentColor,
      buttonBg: style.buttonBg || material.style.accentColor,
      buttonTextColor: style.buttonTextColor || material.style.textPrimaryColor,
      favoriteIconColor: style.favoriteIconColor || material.style.accentColor,
      priceColor: style.priceColor || material.style.accentColor,
      titleFontSizePx: number(style.titleFontSizePx, 18, 90, 32),
      titleImageHeightPx: number(style.titleImageHeightPx, 40, 300, 100),
      buttonRadiusPx: number(style.buttonRadiusPx, 0, 999, 999),
      buttonStyle: ["solid", "outline", "soft"].includes(style.buttonStyle)
        ? style.buttonStyle
        : "soft",
      gridGapPx: number(style.gridGapPx, 8, 80, 22),
      imageRatio: number(style.imageRatio, 0.55, 1.5, 0.8),
      imageFit: style.imageFit === "cover" ? "cover" : "contain",
      cardTitleSizePx: number(style.cardTitleSizePx, 12, 28, 17),
    },
  };
}
export function favoritesMaterialConfig(config) {
  return buildSafeCartPageConfig({
    style: config.style,
    presentation: config.presentation,
  });
}
