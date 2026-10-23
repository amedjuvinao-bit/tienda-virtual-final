// Shared by the public catalog and its draft editor. No product data is duplicated.
const number = (value, min, max, fallback) => {
  if (value === '' || value == null) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
};
const color = (value, fallback) => /^#[\da-f]{6}$/i.test(value || '') ? value : fallback;
export function catalogImageUrl(value) {
  const url = String(value || '').trim();
  return url.length <= 2048 && /^(https?:\/\/|\/(?!\/))[^\s"'<>\\]*$/i.test(url) ? url : '';
}
export function buildCatalogPresentation(raw = {}) {
  const cfg = raw && typeof raw === 'object' ? raw : {};
  return {
    styleVersion: number(cfg.styleVersion, 0, 2, 0),
    showPhotoCount: cfg.showPhotoCount === true,
    filterSectionBorders: cfg.filterSectionBorders === true,
    layout: cfg.layout === 'grid' ? 'grid' : 'editorial',
    backgroundColor: color(cfg.backgroundColor, '#f8ece7'),
    backgroundImage: catalogImageUrl(cfg.backgroundImage ?? '/instagram/editorial-satin.webp'),
    backgroundOpacity: number(cfg.backgroundOpacity, 0, 1, .32),
    textColor: color(cfg.textColor, '#562633'),
    accentColor: color(cfg.accentColor, '#984d62'),
    glassColor: color(cfg.glassColor, '#fff6f0'),
    glassOpacity: number(cfg.glassOpacity, 0, 1, .58),
    glassBlur: number(cfg.glassBlur, 0, 32, 16),
    radius: number(cfg.radius, 0, 40, 18),
    gap: number(cfg.gap, 8, 48, 20),
    maxWidth: number(cfg.maxWidth, 960, 1920, 1520),
    topSpacing: number(cfg.topSpacing, 0, 240, 106),
    titleSize: number(cfg.titleSize, 24, 80, 44),
    titleFont: ['inherit', 'serif', 'sans'].includes(cfg.titleFont) ? cfg.titleFont : 'serif',
    featuredEnabled: cfg.featuredEnabled !== false,
    featuredShape: ['arch', 'rounded', 'square'].includes(cfg.featuredShape) ? cfg.featuredShape : 'arch',
    featuredFit: cfg.featuredFit === 'contain' ? 'contain' : 'cover',
    featuredPosition: number(cfg.featuredPosition, 0, 100, 35),
    cardTitleSize: number(cfg.cardTitleSize, 11, 24, 15),
    cardPriceSize: number(cfg.cardPriceSize, 11, 24, 15),
    showDescription: cfg.showDescription === true,
    showOptions: cfg.showOptions !== false,
    motion: ['none', 'reveal', 'parallax'].includes(cfg.motion) ? cfg.motion : 'parallax',
    motionStrength: number(cfg.motionStrength, 0, 40, 18),
  };
}
export function catalogPresentationStyle(config) {
  const font = { inherit: 'var(--font-headings, inherit)', serif: '"Catalog Editorial", Georgia, serif', sans: 'var(--font-base, system-ui, sans-serif)' };
  return {
    '--catalog-bg': config.backgroundColor,
    '--catalog-backdrop': config.backgroundImage ? `url(${JSON.stringify(config.backgroundImage)})` : 'none',
    '--catalog-backdrop-opacity': config.backgroundOpacity,
    '--catalog-ink': config.textColor,
    '--catalog-accent': config.accentColor,
    '--catalog-glass-color': config.glassColor,
    '--catalog-glass-fill': `${config.glassOpacity * 100}%`,
    '--catalog-blur': `${config.glassBlur}px`,
    '--catalog-radius': `${config.radius}px`,
    '--catalog-gap': `${config.gap}px`,
    '--catalog-width': `${config.maxWidth}px`,
    '--catalog-top': `${config.topSpacing}px`,
    '--catalog-title-size': `${config.titleSize}px`,
    '--catalog-title-font': font[config.titleFont],
    '--catalog-card-title': `${config.cardTitleSize}px`,
    '--catalog-card-price': `${config.cardPriceSize}px`,
    '--catalog-feature-fit': config.featuredFit,
    '--catalog-feature-position': `center ${config.featuredPosition}%`,
  };
}
