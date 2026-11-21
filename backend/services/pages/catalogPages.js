"use strict";
const CATALOG_PAGES = require("../../../shared/catalogPages.json");
const complementsConfig = {
  title: "Complementos",
  subtitle: "Detalles para acompañar tu elección.",
  heroBadge: "Explora nuestra selección",
  showHeroBadge: true,
  sourceMode: "categories",
  allowedCategoriesText: "Complementos",
  initialCategoriesText: "",
  manualProductIdsText: "",
  columnsDesktop: 3,
  columnsTablet: 2,
  columnsMobile: 2,
  defaultColsDesktop: 3,
  defaultColsMobile: 2,
  limit: 12,
  emptyTitle: "Pronto encontrarás nuevos complementos",
  emptyText:
    "Estamos preparando esta selección. Vuelve a visitarnos para descubrir las novedades.",
  collection: {
    heroArtwork: "/catalog/crystal-complements.webp",
    heroArtworkAlt: "",
    showArtwork: true,
    artworkWidthPx: 320,
    searchPlaceholder: "Buscar complementos…",
    categoriesTitle: "Tipo de complemento",
  },
  presentation: {
    layout: "glass-grid",
    styleVersion: 5,
    headerVersion: 1,
    filterVersion: 1,
    glassPaletteVersion: 2,
    backgroundMode: "continuity",
    glassColor: "#efb9b7",
    glassOpacity: 0.12,
    glassBlur: 5,
    textColor: "#6b1635",
    accentColor: "#922e50",
    rimColor: "#922e50",
    rimOpacity: 0.9,
    radius: 26,
    maxWidth: 1440,
    titleSize: 58,
    cardTitleSize: 18,
    cardPriceSize: 17,
    imageRatio: "landscape",
    headerTint: "#efb9b7",
    headerOpacity: 0.08,
    headerEdgeColor: "#fff4ed",
    headerEdgeWidth: 1.2,
    headerReflectionColor: "#fff4ed",
    headerReflection: 0.8,
    headerShadowColor: "#6b1635",
    headerShadow: 0.12,
    headerMaterialDepth: 0.2,
    headerMaterialDepthColor: "#922e50",
    headerTextColor: "#6b1635",
    headerBadgeColor: "#922e50",
    showOptions: false,
    filterSectionBorders: false,
  },
  cardUiConfig: {
    cardBg: "#efb9b7",
    cardBorderColor: "#fff4ed",
    cardBorderWidthPx: 1,
    cardRadiusPx: 26,
    cardPaddingPx: 0,
    cardShadowStyle: "soft",
    showBorder: true,
    showShadow: true,
    imageRadiusPx: 0,
    imageFit: "cover",
    imageBg: "#efb9b7",
    titleColor: "#6b1635",
    priceColor: "#6b1635",
    oldPriceColor: "#875a68",
    metaColor: "#71384b",
    favoriteIconName: "heart",
    cartIconName: "shopping-bag",
    favoriteIconColor: "#922e50",
    favoriteActiveColor: "#922e50",
    cartIconColor: "#922e50",
    titleFontFamily: "cormorant",
  },
  filterUiConfig: {
    panelBg: "#efb9b7",
    panelBorderColor: "#fff4ed",
    panelTitleColor: "#6b1635",
    panelSubtitleColor: "#71384b",
    sectionHeaderBg: "#efb9b7",
    sectionHeaderTextColor: "#6b1635",
    accentColor: "#922e50",
    accentColor2: "#922e50",
    chipBg: "#efb9b7",
    chipTextColor: "#6b1635",
    radiusPx: 26,
    borderWidthPx: 1,
    shadowStyle: "none",
    showSectionIcons: false,
    showCounters: false,
    showSelectedSummary: true,
    colorDotSizePx: 24,
  },
};
function buildCategoryCatalogConfig(definition, source = complementsConfig) {
  const base =
    source && typeof source === "object" && !Array.isArray(source) ? source : {};
  // Copy the saved presentation once; product selection belongs to the new page.
  return structuredClone({
    ...complementsConfig,
    ...base,
    title: definition.name,
    subtitle: definition.subtitle,
    sourceMode: definition.sourceMode || "categories",
    allowedCategoriesText: definition.category || "",
    defaultSort: definition.defaultSort || base.defaultSort || "-createdAt",
    initialCategoriesText: "",
    manualProductIdsText: "",
    ...(definition.sourceMode === "all" ? {
      initialColorsText: "",
      initialMinPrice: 0,
      initialMaxPrice: 10_000_000,
    } : {}),
    emptyTitle: definition.emptyTitle || "Pronto encontrarás productos de esta categoría",
    emptyText:
      "Estamos preparando esta selección. Vuelve a visitarnos para descubrir las novedades.",
    presentation: { ...complementsConfig.presentation, ...base.presentation },
    cardUiConfig: { ...complementsConfig.cardUiConfig, ...base.cardUiConfig },
    filterUiConfig: { ...complementsConfig.filterUiConfig, ...base.filterUiConfig },
    collection: {
      ...complementsConfig.collection,
      ...base.collection,
      heroArtwork: definition.heroArtwork || "",
      heroArtworkAlt: "",
      searchPlaceholder: `Buscar en ${definition.name}…`,
      categoriesTitle: "Categorías",
    },
  });
}
async function ensureCatalogPages(Page) {
  for (const definition of CATALOG_PAGES) {
    if (await Page.findOne({ slug: definition.slug })) continue;
    const original =
      definition.slug === "complementos"
        ? null
        : await Page.findOne({ slug: "complementos" });
    const catalogConfig =
      definition.slug === "complementos"
        ? complementsConfig
        : buildCategoryCatalogConfig(
            definition,
            original?.pageType === "catalog" ? original.catalogConfig : undefined,
          );
    try {
      await Page.findOneAndUpdate(
        { slug: definition.slug },
        {
          $setOnInsert: {
            slug: definition.slug,
            name: definition.name,
            pageType: "catalog",
            enabled: true,
            useHeader: true,
            useFooter: true,
            blocks: [],
            catalogConfig,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    } catch (error) {
      if (
        error.code !== 11000 ||
        !(await Page.findOne({ slug: definition.slug }))
      )
        throw error;
    }
  }
}
module.exports = {
  CATALOG_PAGES,
  complementsConfig,
  buildCategoryCatalogConfig,
  ensureCatalogPages,
};
