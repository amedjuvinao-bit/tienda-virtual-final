// Header-specific appearance shared by the editor, preview and public page.
const bounded = (value, min, max, fallback) => value === '' || value == null || !Number.isFinite(Number(value)) ? fallback : Math.min(max, Math.max(min, Number(value)));
const hex = (value, fallback) => /^#[\da-f]{6}$/i.test(value || '') ? value : fallback;
export function buildCatalogHeaderAppearance(cfg = {}) {
  return {
    headerTint: hex(cfg.headerTint, '#fff6f0'),
    headerOpacity: bounded(cfg.headerOpacity, 0, 1, .35),
    headerContrastColor: hex(cfg.headerContrastColor, '#b57560'),
    headerContrast: bounded(cfg.headerContrast, 0, 1, .38),
    headerEdgeColor: hex(cfg.headerEdgeColor, '#c49b7b'),
    headerEdgeWidth: bounded(cfg.headerEdgeWidth, 0, 6, 1),
    headerReflectionColor: hex(cfg.headerReflectionColor, '#ffffff'),
    headerReflection: bounded(cfg.headerReflection, 0, 1, .57),
    headerShadowColor: hex(cfg.headerShadowColor, '#633329'),
    headerShadow: bounded(cfg.headerShadow, 0, 1, .16),
    headerBlur: bounded(cfg.headerBlur, 0, 32, 16),
    headerRadius: bounded(cfg.headerRadius, 0, 40, 22),
    headerHeight: bounded(cfg.headerHeight, 80, 240, 116),
    headerPadding: bounded(cfg.headerPadding, 8, 40, 18),
    headerLayers: cfg.headerLayers !== false,
    headerTextColor: hex(cfg.headerTextColor, hex(cfg.textColor, '#562633')),
    headerBadgeColor: hex(cfg.headerBadgeColor, hex(cfg.accentColor, '#984d62')),
    headerBadgeTint: hex(cfg.headerBadgeTint, '#fff6f0'),
    headerIcon: ['bags', 'none'].includes(cfg.headerIcon) ? cfg.headerIcon : 'bags',
    headerIconColor: hex(cfg.headerIconColor, '#a66742'),
    headerIconSize: bounded(cfg.headerIconSize, 80, 240, 180),
    headerIconOpacity: bounded(cfg.headerIconOpacity, 0, 1, 1),
  };
}
export function catalogHeaderAppearanceStyle(cfg) {
  const c = buildCatalogHeaderAppearance(cfg);
  const mix = (color, opacity) => `color-mix(in srgb, ${color} ${opacity * 100}%, transparent)`;
  return {
    '--ch-tint': c.headerTint, '--ch-fill': mix(c.headerTint, c.headerOpacity),
    '--ch-contrast': mix(c.headerContrastColor, c.headerContrast),
    '--ch-edge': c.headerEdgeColor, '--ch-edge-width': `${c.headerEdgeWidth}px`,
    '--ch-light': c.headerReflectionColor, '--ch-reflection': mix(c.headerReflectionColor, c.headerReflection),
    '--ch-shadow': mix(c.headerShadowColor, c.headerShadow),
    '--ch-blur': `${c.headerBlur}px`, '--ch-radius': `${c.headerRadius}px`,
    '--ch-height': `${c.headerHeight}px`, '--ch-padding': `${c.headerPadding}px`,
    '--ch-layer-opacity': c.headerLayers ? 1 : 0,
    '--ch-text': c.headerTextColor, '--ch-badge-text': c.headerBadgeColor, '--ch-badge-tint': c.headerBadgeTint,
    '--ch-icon-color': c.headerIconColor, '--ch-icon-size': `${c.headerIconSize}px`, '--ch-icon-opacity': c.headerIconOpacity,
  };
}
