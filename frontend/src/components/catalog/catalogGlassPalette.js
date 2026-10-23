// A coordinated starting palette. Editors can change every value after adoption.
export const CATALOG_GLASS_PALETTE_VERSION = 2;
export const CATALOG_GLASS_PALETTE = Object.freeze({
  glassPaletteVersion: CATALOG_GLASS_PALETTE_VERSION,
  textColor: '#562633', accentColor: '#984d62',
  headerTint: '#ffffff', headerOpacity: .18,
  headerContrastColor: '#984d62', headerContrast: .22,
  headerEdgeColor: '#984d62', headerEdgeWidth: 1,
  headerReflectionColor: '#ffffff', headerReflection: .82,
  headerShadowColor: '#562633', headerShadow: .18,
  headerMaterialOpacity: .82,
  headerTextColor: '#562633', headerBadgeColor: '#984d62', headerBadgeTint: '#ffffff',
  headerIconColor: '#984d62', headerIconOpacity: 1,
});
const paletteKeys = Object.keys(CATALOG_GLASS_PALETTE).filter(key => key !== 'glassPaletteVersion');
export function buildCatalogGlassPalette(presentation = {}) {
  return {
    ...CATALOG_GLASS_PALETTE,
    textColor: presentation.textColor || CATALOG_GLASS_PALETTE.textColor,
    accentColor: presentation.accentColor || CATALOG_GLASS_PALETTE.accentColor,
    headerTint: presentation.glassColor || '#ffffff',
    headerContrastColor: presentation.accentColor || CATALOG_GLASS_PALETTE.accentColor,
    headerEdgeColor: presentation.accentColor || CATALOG_GLASS_PALETTE.accentColor,
    headerReflectionColor: '#ffffff',
    headerShadowColor: presentation.textColor || CATALOG_GLASS_PALETTE.textColor,
    headerTextColor: presentation.textColor || CATALOG_GLASS_PALETTE.textColor,
    headerBadgeColor: presentation.accentColor || CATALOG_GLASS_PALETTE.accentColor,
    headerBadgeTint: presentation.glassColor || '#ffffff',
    headerIconColor: presentation.accentColor || CATALOG_GLASS_PALETTE.accentColor,
  };
}
export function applyCatalogGlassPalette(config) {
  const previous = config.presentation || {};
  return {
    ...config,
    glassPaletteBackup: config.glassPaletteBackup || Object.fromEntries(paletteKeys.filter(key => previous[key] !== undefined).map(key => [key, previous[key]])),
    presentation: { ...previous, ...buildCatalogGlassPalette(previous) },
  };
}

// Replace only colors matching the old automatic warm palette. Other colors
// remain unchanged; subsequent edits are authoritative after this upgrade.
export function upgradeCatalogGlassPalette(config) {
  const previous = config.presentation || {};
  const next = buildCatalogGlassPalette(previous);
  const oldDefaults = {
    headerContrastColor: '#a66348', headerEdgeColor: '#e9bda3',
    headerReflectionColor: '#fff9f2', headerShadowColor: '#6f2c41',
    headerBadgeColor: '#713a42', headerBadgeTint: '#fff4e8', headerIconColor: '#ac744c',
  };
  const replacements = previous.glassPaletteVersion === 1
    ? Object.fromEntries(Object.entries(oldDefaults).filter(([key, value]) => previous[key]?.toLowerCase() === value).map(([key]) => [key, next[key]]))
    : {};
  return {
    ...config,
    glassPaletteBackup: config.glassPaletteBackup || Object.fromEntries(paletteKeys.filter(key => previous[key] !== undefined).map(key => [key, previous[key]])),
    presentation: { ...previous, ...replacements, glassPaletteVersion: CATALOG_GLASS_PALETTE_VERSION },
  };
}
