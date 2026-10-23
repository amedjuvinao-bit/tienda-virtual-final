// A coordinated starting palette. Editors can change every value after adoption.
export const CATALOG_GLASS_PALETTE_VERSION = 1;
export const CATALOG_GLASS_PALETTE = Object.freeze({
  glassPaletteVersion: CATALOG_GLASS_PALETTE_VERSION,
  textColor: '#562633', accentColor: '#984d62',
  headerTint: '#ffffff', headerOpacity: .18,
  headerContrastColor: '#a66348', headerContrast: .22,
  headerEdgeColor: '#e9bda3', headerEdgeWidth: 1,
  headerReflectionColor: '#fff9f2', headerReflection: .82,
  headerShadowColor: '#6f2c41', headerShadow: .18,
  headerMaterialOpacity: .82,
  headerTextColor: '#562633', headerBadgeColor: '#713a42', headerBadgeTint: '#fff4e8',
  headerIconColor: '#ac744c', headerIconOpacity: 1,
});
const paletteKeys = Object.keys(CATALOG_GLASS_PALETTE).filter(key => key !== 'glassPaletteVersion');
export function applyCatalogGlassPalette(config) {
  const previous = config.presentation || {};
  return {
    ...config,
    glassPaletteBackup: config.glassPaletteBackup || Object.fromEntries(paletteKeys.filter(key => previous[key] !== undefined).map(key => [key, previous[key]])),
    presentation: { ...previous, ...CATALOG_GLASS_PALETTE },
  };
}
