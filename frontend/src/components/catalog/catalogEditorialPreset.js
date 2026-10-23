import { buildCatalogPresentation } from './catalogPresentation';

export const EDITORIAL_STYLE_VERSION = 3;

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
    presentation: { ...presentation, layout: 'glass-grid', styleVersion: EDITORIAL_STYLE_VERSION, showOptions: false, filterSectionBorders: false },
    cardUiConfig: {
      ...raw.cardUiConfig, cardBg: glass, cardBorderColor: '#ffffff', cardBorderWidthPx: 1,
      cardRadiusPx: 16, cardPaddingPx: 0, cardShadowStyle: 'soft', showBorder: true, showShadow: true,
      imageRadiusPx: 12, showImageBg: true, imageBg: glass, imageFit: 'contain', titleColor: ink, priceColor: ink,
      oldPriceColor: '#987e82', metaColor: '#987e82', titleFontFamily: 'cormorant', priceFontFamily: 'jost',
      favoriteIconName: 'heart', cartIconName: 'shopping-bag', favoriteIconColor: accent, favoriteActiveColor: accent, cartIconColor: accent,
      favoriteButtonBg: glass, cartButtonBg: glass, favoriteButtonOpacity: .85, cartButtonOpacity: .85,
      actionButtonBorderColor: '#ffffff', actionButtonBorderWidthPx: 1,
    },
    filterUiConfig: {
      ...raw.filterUiConfig, panelBg: glass, panelBorderColor: '#ffffff', panelTitleColor: ink, panelSubtitleColor: '#987e82',
      sectionHeaderBg: glass, sectionHeaderTextColor: ink, accentColor: accent, accentColor2: accent,
      chipBg: glass, chipTextColor: ink, radiusPx: 16, sectionRadiusPx: 10, borderWidthPx: 1,
      shadowStyle: 'none', sectionGapPx: 12, titleSizePx: 20, sectionTitleSizePx: 15, contentTextSizePx: 12,
      showSectionIcons: false, showCounters: false, showSelectedSummary: false,
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
  let current = raw;
  if (presentation.styleVersion < EDITORIAL_STYLE_VERSION) {
    const backgroundImage = ['/instagram/editorial-satin.webp', '/catalog/editorial-architecture-v1.webp'].includes(presentation.backgroundImage) ? '' : presentation.backgroundImage;
    current = presentation.styleVersion < 2 ? applyCatalogEditorialPreset(raw) : raw;
    current = { ...current, presentation: { ...presentation, ...current.presentation, layout: 'glass-grid', styleVersion: EDITORIAL_STYLE_VERSION, backgroundImage }, cardUiConfig: { ...current.cardUiConfig, imageFit: 'contain' } };
  }
  // Adopt the approved typographic heading once; keep the uploaded artwork available
  // and allow subsequent explicit changes from the editor to remain authoritative.
  if (presentation.headerVersion < 1) {
    current = { ...current, titleMode: 'text', presentation: { ...current.presentation, headerVersion: 1, titleFont: 'serif', titleSize: 44 } };
  }
  return current;
}
export function restoreCatalogVisualBackup(config) {
  if (!config.visualBackup) return config;
  return { ...config, ...config.visualBackup, presentation: { ...config.presentation, ...config.visualBackup.presentation, styleVersion: EDITORIAL_STYLE_VERSION } };
}
