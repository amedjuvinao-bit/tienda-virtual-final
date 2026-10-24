import { upgradeCatalogGlassPalette, CATALOG_GLASS_PALETTE_VERSION } from './catalogGlassPalette';
import { buildCatalogPresentation } from './catalogPresentation';

export const EDITORIAL_STYLE_VERSION = 5;

// Upgrade the visual settings together, once. Subsequent individual edits remain authoritative.
// Keep the earlier settings recoverable; no products, text, source or query options are changed.
export function applyCatalogEditorialPreset(raw = {}) {
  const presentation = buildCatalogPresentation(raw.presentation);
  const ink = presentation.textColor, accent = presentation.accentColor, glass = presentation.glassColor;
  return {
    ...raw,
    visualBackup: raw.visualBackup || (raw.cardUiConfig || raw.filterUiConfig || raw.columnControlsUiConfig ? {
      cardUiConfig: raw.cardUiConfig || {}, filterUiConfig: raw.filterUiConfig || {},
      columnControlsUiConfig: raw.columnControlsUiConfig || {}, presentation: raw.presentation || {},
    } : null),
    presentation: { ...presentation, layout: 'glass-grid', styleVersion: EDITORIAL_STYLE_VERSION, filterVersion: 1, showOptions: false, filterSectionBorders: false },
    cardUiConfig: {
      ...raw.cardUiConfig, cardBg: glass, cardBorderColor: '#ffffff', cardBorderWidthPx: 1,
      cardRadiusPx: 26, cardPaddingPx: 0, cardShadowStyle: 'soft', showBorder: true, showShadow: true,
      imageRadiusPx: 12, showImageBg: true, imageBg: glass, imageFit: 'cover', titleColor: ink, priceColor: ink,
      oldPriceColor: '#987e82', metaColor: '#987e82', titleFontFamily: 'cormorant', priceFontFamily: 'jost',
      favoriteIconName: 'heart', cartIconName: 'shopping-bag', favoriteIconColor: accent, favoriteActiveColor: accent, cartIconColor: accent,
      favoriteButtonBg: glass, cartButtonBg: glass, favoriteButtonOpacity: .18, cartButtonOpacity: .18,
      actionButtonBorderColor: '#ffffff', actionButtonBorderWidthPx: 1,
    },
    filterUiConfig: {
      ...raw.filterUiConfig, panelBg: glass, panelBorderColor: '#ffffff', panelTitleColor: ink, panelSubtitleColor: '#987e82',
      sectionHeaderBg: glass, sectionHeaderTextColor: ink, accentColor: accent, accentColor2: accent,
      chipBg: glass, chipTextColor: ink, radiusPx: 16, sectionRadiusPx: 10, borderWidthPx: 1,
      shadowStyle: 'none', sectionGapPx: 12, titleSizePx: 20, sectionTitleSizePx: 15, contentTextSizePx: 12,
      showSectionIcons: false, showCounters: false, showSelectedSummary: true, colorDotSizePx: 20,
    },
    columnControlsUiConfig: {
      ...raw.columnControlsUiConfig, buttonBgColor: glass, buttonBorderColor: '#ffffff', buttonIconColor: accent,
      activeButtonBgColor: glass, activeButtonBorderColor: accent, activeButtonIconColor: accent,
      hoverButtonBgColor: glass, hoverButtonBorderColor: accent, hoverButtonIconColor: accent,
      buttonRadiusPx: 12, buttonBorderWidthPx: 1,
    },
  };
}
export function prepareCatalogEditorialConfig(raw) {
  const presentation = buildCatalogPresentation(raw.presentation);
  if (presentation.layout !== 'glass-grid') return raw;
  // Remove the old preset's warm defaults without recalibrating user colors.
  let current = presentation.glassPaletteVersion < CATALOG_GLASS_PALETTE_VERSION ? upgradeCatalogGlassPalette(raw) : raw;
  if (presentation.styleVersion < EDITORIAL_STYLE_VERSION) {
    const backgroundImage = presentation.styleVersion < 4 && ['/instagram/editorial-satin.webp', '/catalog/editorial-architecture-v1.webp'].includes(presentation.backgroundImage) ? '' : presentation.backgroundImage;
    current = presentation.styleVersion < 2 ? applyCatalogEditorialPreset(current) : current;
    const card = current.cardUiConfig || {};
    const glassButtonOpacity = value => value == null || [1, .85].includes(Number(value)) ? .18 : value;
    const optical = presentation.styleVersion < 4 && presentation.rimStyle === 'optical' && card.showBorder !== false;
    const oldCardRadius = card.cardRadiusPx == null || [16, 18].includes(Number(card.cardRadiusPx));
    // Replace only the old automatic corners. Once version 4 is adopted,
    // later radius edits remain authoritative within the editor's bounds.
    const corners = optical ? {
      ...(presentation.radius === 18 ? { radius: 26 } : {}),
      ...(presentation.headerRadius === 22 ? { headerRadius: 40 } : {}),
    } : {};
    current = {
      ...current,
      visualBackup: current.visualBackup || {
        cardUiConfig: current.cardUiConfig || {}, filterUiConfig: current.filterUiConfig || {},
        columnControlsUiConfig: current.columnControlsUiConfig || {}, presentation: current.presentation || {},
      },
      presentation: { ...presentation, ...current.presentation, ...corners, layout: 'glass-grid', styleVersion: EDITORIAL_STYLE_VERSION, backgroundImage },
      cardUiConfig: {
        ...card, imageFit: 'cover',
        favoriteButtonOpacity: glassButtonOpacity(card.favoriteButtonOpacity),
        cartButtonOpacity: glassButtonOpacity(card.cartButtonOpacity),
        ...(optical && oldCardRadius ? { cardRadiusPx: 26 } : {}),
      },
    };
  }
  // Adopt the approved typographic heading once; keep the uploaded artwork available
  // and allow subsequent explicit changes from the editor to remain authoritative.
  if (presentation.headerVersion < 1) {
    current = { ...current, titleMode: 'text', presentation: { ...current.presentation, headerVersion: 1, titleFont: 'serif', titleSize: 44 } };
  }
  if (presentation.filterVersion < 1) {
    current = { ...current,
      presentation: { ...current.presentation, filterVersion: 1 },
      filterUiConfig: { ...current.filterUiConfig, showSelectedSummary: true, showSectionIcons: false, showCounters: false,
        colorDotSizePx: current.filterUiConfig?.colorDotSizePx ?? 20, sectionGapPx: current.filterUiConfig?.sectionGapPx ?? 12 },
    };
  }
  return current;
}
export function restoreCatalogVisualBackup(config) {
  if (!config.visualBackup) return config;
  return { ...config, ...config.visualBackup, presentation: { ...config.presentation, ...config.visualBackup.presentation, styleVersion: EDITORIAL_STYLE_VERSION, glassPaletteVersion: CATALOG_GLASS_PALETTE_VERSION } };
}
