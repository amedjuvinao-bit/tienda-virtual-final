import { prepareCatalogEditorialConfig } from "./catalogEditorialPreset";
import { buildCatalogPresentation } from "./catalogPresentation";
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

function normalizeCsvText(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .join(", ");
}

function parseCsvArray(value) {
  return normalizeCsvText(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildSafeFilterUiConfig(raw) {
  const cfg = raw && typeof raw === "object" ? raw : {};

  return {
    panelBg: typeof cfg.panelBg === "string" ? cfg.panelBg : "#ffffff",
    panelBorderColor:
      typeof cfg.panelBorderColor === "string"
        ? cfg.panelBorderColor
        : "#ead7aa",
    panelTitleColor:
      typeof cfg.panelTitleColor === "string" ? cfg.panelTitleColor : "#111827",
    panelSubtitleColor:
      typeof cfg.panelSubtitleColor === "string"
        ? cfg.panelSubtitleColor
        : "#6b7280",
    sectionHeaderBg:
      typeof cfg.sectionHeaderBg === "string" ? cfg.sectionHeaderBg : "#fff8fb",
    sectionHeaderTextColor:
      typeof cfg.sectionHeaderTextColor === "string"
        ? cfg.sectionHeaderTextColor
        : "#1f2937",
    accentColor:
      typeof cfg.accentColor === "string" ? cfg.accentColor : "#ec4899",
    accentColor2:
      typeof cfg.accentColor2 === "string" ? cfg.accentColor2 : "#d4af37",
    chipBg: typeof cfg.chipBg === "string" ? cfg.chipBg : "#ffffff",
    chipTextColor:
      typeof cfg.chipTextColor === "string" ? cfg.chipTextColor : "#374151",
    radiusPx: clampInt(cfg.radiusPx, 8, 40, 22),
    sectionRadiusPx: clampInt(cfg.sectionRadiusPx, 6, 32, 18),
    borderWidthPx: clampInt(cfg.borderWidthPx, 1, 4, 1),
    shadowStyle:
      cfg.shadowStyle === "none" ||
      cfg.shadowStyle === "soft" ||
      cfg.shadowStyle === "medium" ||
      cfg.shadowStyle === "strong"
        ? cfg.shadowStyle
        : "soft",
    sectionGapPx: clampInt(cfg.sectionGapPx, 8, 40, 20),
    colorDotSizePx: clampInt(cfg.colorDotSizePx, 16, 40, 26),
    titleSizePx: clampInt(cfg.titleSizePx, 16, 32, 22),
    sectionTitleSizePx: clampInt(cfg.sectionTitleSizePx, 13, 24, 17),
    contentTextSizePx: clampInt(cfg.contentTextSizePx, 11, 20, 14),
    animation:
      cfg.animation === "none" ||
      cfg.animation === "soft" ||
      cfg.animation === "fade" ||
      cfg.animation === "slide"
        ? cfg.animation
        : "soft",
    showSectionIcons: cfg.showSectionIcons !== false,
    showCounters: cfg.showCounters !== false,
    showSelectedSummary: cfg.showSelectedSummary !== false,
    categoriesSearchEnabled: cfg.categoriesSearchEnabled !== false,
    stickyHeader: cfg.stickyHeader === true,
  };
}

function buildSafeCardUiConfig(raw) {
  const cfg = raw && typeof raw === "object" ? raw : {};

  return {
    cardBg: typeof cfg.cardBg === "string" ? cfg.cardBg : "#ffffff",
    cardBorderColor:
      typeof cfg.cardBorderColor === "string" ? cfg.cardBorderColor : "#ecdcb6",
    cardBorderWidthPx: clampInt(cfg.cardBorderWidthPx, 0, 6, 1),
    cardRadiusPx: clampInt(cfg.cardRadiusPx, 8, 40, 28),
    cardPaddingPx: clampInt(cfg.cardPaddingPx, 0, 40, 12),
    cardShadowStyle:
      cfg.cardShadowStyle === "none" ||
      cfg.cardShadowStyle === "soft" ||
      cfg.cardShadowStyle === "medium" ||
      cfg.cardShadowStyle === "strong"
        ? cfg.cardShadowStyle
        : "soft",

    imageBg: typeof cfg.imageBg === "string" ? cfg.imageBg : "#faf8f3",
    imageRadiusPx: clampInt(cfg.imageRadiusPx, 0, 40, 24),
    imageFit:
      cfg.imageFit === "cover" || cfg.imageFit === "contain"
        ? cfg.imageFit
        : "cover",

    titleColor: typeof cfg.titleColor === "string" ? cfg.titleColor : "#2f3440",
    priceColor: typeof cfg.priceColor === "string" ? cfg.priceColor : "#e54497",
    oldPriceColor:
      typeof cfg.oldPriceColor === "string" ? cfg.oldPriceColor : "#9ca3af",
    metaColor: typeof cfg.metaColor === "string" ? cfg.metaColor : "#6b7280",

    buttonBg: typeof cfg.buttonBg === "string" ? cfg.buttonBg : "#ffffff",
    favoriteButtonBg:
      typeof cfg.favoriteButtonBg === "string"
        ? cfg.favoriteButtonBg
        : "#ffffff",
    cartButtonBg:
      typeof cfg.cartButtonBg === "string" ? cfg.cartButtonBg : "#ffffff",

    favoriteButtonOpacity: clampNumber(cfg.favoriteButtonOpacity, 0, 1, 1),
    cartButtonOpacity: clampNumber(cfg.cartButtonOpacity, 0, 1, 1),

    buttonTextColor:
      typeof cfg.buttonTextColor === "string" ? cfg.buttonTextColor : "#ffffff",
    actionButtonBorderColor:
      typeof cfg.actionButtonBorderColor === "string"
        ? cfg.actionButtonBorderColor
        : typeof cfg.buttonBorderColor === "string"
          ? cfg.buttonBorderColor
          : "#ffffff",
    actionButtonBorderWidthPx: clampInt(
      cfg.actionButtonBorderWidthPx ?? cfg.buttonBorderWidthPx,
      0,
      4,
      1,
    ),

    cartIconColor:
      typeof cfg.cartIconColor === "string" ? cfg.cartIconColor : "#D4AF37",

    favoriteIconColor:
      typeof cfg.favoriteIconColor === "string"
        ? cfg.favoriteIconColor
        : "#d946ef",
    favoriteActiveColor:
      typeof cfg.favoriteActiveColor === "string"
        ? cfg.favoriteActiveColor
        : "#D4AF37",

    favoriteIconName:
      cfg.favoriteIconName === "heart" ||
      cfg.favoriteIconName === "sparkles" ||
      cfg.favoriteIconName === "star"
        ? cfg.favoriteIconName
        : "star",

    cartIconName:
      cfg.cartIconName === "shopping-bag" ||
      cfg.cartIconName === "bag-heart" ||
      cfg.cartIconName === "shopping-cart"
        ? cfg.cartIconName
        : "shopping-cart",

    titleFontFamily:
      cfg.titleFontFamily === "jost" ||
      cfg.titleFontFamily === "cormorant" ||
      cfg.titleFontFamily === "playfair" ||
      cfg.titleFontFamily === "inter" ||
      cfg.titleFontFamily === "inherit"
        ? cfg.titleFontFamily
        : "inherit",

    priceFontFamily:
      cfg.priceFontFamily === "jost" ||
      cfg.priceFontFamily === "cormorant" ||
      cfg.priceFontFamily === "playfair" ||
      cfg.priceFontFamily === "inter" ||
      cfg.priceFontFamily === "inherit"
        ? cfg.priceFontFamily
        : "inherit",

    metaFontFamily:
      cfg.metaFontFamily === "jost" ||
      cfg.metaFontFamily === "cormorant" ||
      cfg.metaFontFamily === "playfair" ||
      cfg.metaFontFamily === "inter" ||
      cfg.metaFontFamily === "inherit"
        ? cfg.metaFontFamily
        : "inherit",

    showBorder: cfg.showBorder !== false,
    showShadow: cfg.showShadow !== false,
    showImageBg: cfg.showImageBg !== false,
  };
}

function buildSafeColumnControlsUiConfig(raw) {
  const cfg = raw && typeof raw === "object" ? raw : {};

  return {
    buttonBgColor:
      typeof cfg.buttonBgColor === "string" ? cfg.buttonBgColor : "#ffffff",
    buttonBorderColor:
      typeof cfg.buttonBorderColor === "string"
        ? cfg.buttonBorderColor
        : "#e8e7eb",
    buttonIconColor:
      typeof cfg.buttonIconColor === "string" ? cfg.buttonIconColor : "#D4AF37",

    hoverButtonBgColor:
      typeof cfg.hoverButtonBgColor === "string"
        ? cfg.hoverButtonBgColor
        : "#ffffff",
    hoverButtonBorderColor:
      typeof cfg.hoverButtonBorderColor === "string"
        ? cfg.hoverButtonBorderColor
        : "#D4AF37",
    hoverButtonIconColor:
      typeof cfg.hoverButtonIconColor === "string"
        ? cfg.hoverButtonIconColor
        : "#D4AF37",

    activeButtonBgColor:
      typeof cfg.activeButtonBgColor === "string"
        ? cfg.activeButtonBgColor
        : "#fff5fa",
    activeButtonBorderColor:
      typeof cfg.activeButtonBorderColor === "string"
        ? cfg.activeButtonBorderColor
        : "#ec4899",
    activeButtonIconColor:
      typeof cfg.activeButtonIconColor === "string"
        ? cfg.activeButtonIconColor
        : "#ec4899",

    buttonRadiusPx: clampInt(cfg.buttonRadiusPx, 8, 24, 12),
    buttonBorderWidthPx: clampInt(cfg.buttonBorderWidthPx, 1, 4, 1),
  };
}

function buildSafeCatalogConfig(raw) {
  const cfg = prepareCatalogEditorialConfig(raw && typeof raw === "object" ? raw : {});
  const presentation = buildCatalogPresentation(cfg.presentation);

  return {
    presentation,
    visualBackup: cfg.visualBackup || null,
    glassPaletteBackup: cfg.glassPaletteBackup || null,
    title: typeof cfg.title === "string" ? cfg.title : "",
    subtitle: typeof cfg.subtitle === "string" ? cfg.subtitle : "",
    description: typeof cfg.description === "string" ? cfg.description : "",
    titleMode:
      cfg.titleMode === "image" || cfg.titleMode === "text"
        ? cfg.titleMode
        : "text",
    titleImage: typeof cfg.titleImage === "string" ? cfg.titleImage : "",
    titleImageAlt:
      typeof cfg.titleImageAlt === "string" ? cfg.titleImageAlt : "",
    showBreadcrumb: cfg.showBreadcrumb !== false,
    showFilters: cfg.showFilters !== false,
    showToolbar: cfg.showToolbar !== false,
    showFilterFab: cfg.showFilterFab !== false,
    showResultCount: cfg.showResultCount !== false,
    showSearch: cfg.showSearch !== false,
    showSort: cfg.showSort !== false,
    defaultSort: [
      "-createdAt",
      "createdAt",
      "title",
      "-title",
      "price",
      "-price",
    ].includes(cfg.defaultSort)
      ? cfg.defaultSort
      : "-createdAt",
    heroBadge:
      typeof cfg.heroBadge === "string" ? cfg.heroBadge : "Selección destacada",
    showHeroBadge: cfg.showHeroBadge !== false,
    columnsDesktop: clampInt(cfg.columnsDesktop, 1, 6, 4),
    columnsTablet: clampInt(cfg.columnsTablet, 1, 4, 3),
    columnsMobile: clampInt(cfg.columnsMobile, 1, 2, 2),
    defaultColsDesktop: clampInt(
      cfg.defaultColsDesktop ?? cfg.columnsDesktop,
      1,
      6,
      clampInt(cfg.columnsDesktop, 1, 6, 4),
    ),
    defaultColsMobile: clampInt(
      cfg.defaultColsMobile ?? cfg.columnsMobile,
      1,
      2,
      clampInt(cfg.columnsMobile, 1, 2, 2),
    ),
    limit: clampInt(cfg.limit, 0, 100, 0),

    sourceMode:
      cfg.sourceMode === "categories" || cfg.sourceMode === "manual"
        ? cfg.sourceMode
        : "all",

    allowedCategoriesText:
      typeof cfg.allowedCategoriesText === "string"
        ? normalizeCsvText(cfg.allowedCategoriesText)
        : "",

    manualProductIdsText:
      typeof cfg.manualProductIdsText === "string"
        ? normalizeCsvText(cfg.manualProductIdsText)
        : "",

    onlyActive: true,

    initialCategoriesText:
      typeof cfg.initialCategoriesText === "string"
        ? normalizeCsvText(cfg.initialCategoriesText)
        : "",
    initialColorsText:
      typeof cfg.initialColorsText === "string"
        ? normalizeCsvText(cfg.initialColorsText)
        : "",
    initialMinPrice: clampNumber(cfg.initialMinPrice, 0, 10000000, 0),
    initialMaxPrice: clampNumber(cfg.initialMaxPrice, 0, 10000000, 10000000),
    emptyTitle:
      typeof cfg.emptyTitle === "string" && cfg.emptyTitle.trim()
        ? cfg.emptyTitle
        : "No se encontraron productos",
    emptyText:
      typeof cfg.emptyText === "string" && cfg.emptyText.trim()
        ? cfg.emptyText
        : "Intenta cambiar los filtros para ver más resultados.",
    filterUiConfig: buildSafeFilterUiConfig({
      ...(presentation.layout === 'glass-grid' ? {
        panelBg: presentation.glassColor, panelBorderColor: '#ffffff', panelTitleColor: presentation.textColor,
        sectionHeaderBg: presentation.glassColor, sectionHeaderTextColor: presentation.textColor,
        accentColor: presentation.accentColor, accentColor2: presentation.accentColor,
        chipTextColor: presentation.textColor, sectionTitleSizePx: 15, contentTextSizePx: 12,
      } : {}),
      ...cfg.filterUiConfig,
    }),
    cardUiConfig: buildSafeCardUiConfig({
      ...(presentation.layout === 'glass-grid' ? {
        cardBg: presentation.glassColor, cardBorderColor: '#ffffff', cardRadiusPx: 18, cardPaddingPx: 0,
        imageRadiusPx: 0, titleColor: presentation.textColor, priceColor: presentation.textColor,
        cartIconColor: presentation.accentColor, favoriteIconColor: presentation.accentColor,
        favoriteActiveColor: presentation.accentColor, favoriteIconName: 'heart', cartIconName: 'shopping-bag',
      } : {}),
      ...cfg.cardUiConfig,
    }),
    columnControlsUiConfig: buildSafeColumnControlsUiConfig(
      { ...(presentation.layout === 'glass-grid' ? {
        buttonBgColor: presentation.glassColor, buttonBorderColor: '#ffffff', buttonIconColor: presentation.accentColor,
        activeButtonBorderColor: presentation.accentColor, activeButtonIconColor: presentation.accentColor,
        hoverButtonIconColor: presentation.accentColor, hoverButtonBorderColor: presentation.accentColor,
      } : {}), ...cfg.columnControlsUiConfig },
    ),
  };
}

export {
  clampInt,
  clampNumber,
  parseCsvArray,
  buildSafeCatalogConfig,
  buildSafeCardUiConfig,
  buildSafeFilterUiConfig,
  buildSafeColumnControlsUiConfig,
};
