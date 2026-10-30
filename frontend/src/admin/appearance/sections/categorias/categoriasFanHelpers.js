import { normalizeLookSection } from '../look/lookSectionHelpers';

export const CATEGORIAS_FAN_CONFIG = {
  eyebrow: 'EXPLORA SU MUNDO', subtitleText: '', footerText: 'Una colección para cada momento',
  useTitleImage: false, backgroundImage: '',
};
export const CATEGORIAS_FAN_STYLE = {
  fanWidthMode: 'limited',
  fanSectionHeightMode: 'screen', fanSectionMinHeightPx: 800,
  fanColumns: 5, fanHeightPx: 380, fanGapPx: 12, fanSpreadDeg: 7, fanLiftPx: 22,
  fanHoverLiftPx: 20, fanExpand: 1.4, fanImageZoom: 1.06, fanRadiusPx: 24,
  fanMotionEnabled: true, fanParallax: true, fanGlint: true, fanShadow: true,
  fanTitleColor: '#701b37', fanTextColor: '#793249', fanTitleFont: 'Georgia, serif',
  fanTitleSizePx: 48, fanLabelSizePx: 18, fanTitleWeight: 400,
  fanGlassColor: '#ffffff', fanGlassTint: 14, fanGlassBlurPx: 4, fanGlassBorder: '#fff5f2',
  fanBackgroundMode: 'continuity', fanBackgroundColor: '#f2d6d0', fanBackgroundWash: 28,
  fanShowTitle: true, fanShowEyebrow: true, fanShowSubtitle: true, fanShowFooter: true,
  fanShowArrow: true, fanShowDescription: true,
  fanMobileColumns: 2, fanMobileHeightPx: 240, fanMobileGapPx: 14,
  fanMobileTiltDeg: 2, fanMobileTitleSizePx: 32, fanMobileLabelSizePx: 14,
  fanMobilePaddingXPx: 16,
};
const ranges = {
  fanSectionMinHeightPx: [400, 2000],
  fanColumns: [2, 6], fanHeightPx: [220, 580], fanGapPx: [4, 40], fanSpreadDeg: [0, 12],
  fanLiftPx: [0, 50], fanHoverLiftPx: [0, 40], fanExpand: [1, 1.8], fanImageZoom: [1, 1.2],
  fanRadiusPx: [0, 48], fanTitleSizePx: [24, 80], fanLabelSizePx: [12, 28],
  fanTitleWeight: [100, 900], fanGlassTint: [0, 75], fanGlassBlurPx: [0, 20],
  fanBackgroundWash: [0, 80], fanMobileColumns: [1, 2], fanMobileHeightPx: [180, 440],
  fanMobileGapPx: [6, 32], fanMobileTiltDeg: [0, 5], fanMobileTitleSizePx: [22, 52],
  fanMobileLabelSizePx: [12, 22], fanMobilePaddingXPx: [8, 32],
};
export function normalizeCategoriasFanStyle(input = {}) {
  const next = {};
  for (const [key, fallback] of Object.entries(CATEGORIAS_FAN_STYLE)) {
    const value = input?.[key];
    if (ranges[key]) {
      const n = value === '' || value == null ? NaN : Number(value);
      next[key] = Number.isFinite(n) ? Math.max(ranges[key][0], Math.min(ranges[key][1], n)) : fallback;
    } else if (key === 'fanTitleFont' && typeof value === 'string') next[key] = value;
    else if (typeof fallback === 'boolean') next[key] = typeof value === 'boolean' ? value : fallback;
    else next[key] = typeof value === 'string' && value.trim() ? value : fallback;
  }
  if (!['limited', 'full'].includes(next.fanWidthMode)) next.fanWidthMode = 'limited';
  if (!['auto', 'screen', 'custom'].includes(next.fanSectionHeightMode)) next.fanSectionHeightMode = 'screen';
  next.fanColumns = Math.round(next.fanColumns);
  next.fanMobileColumns = Math.round(next.fanMobileColumns);
  if (!['continuity', 'custom', 'color', 'global'].includes(next.fanBackgroundMode)) next.fanBackgroundMode = 'continuity';
  return next;
}
export function normalizeCategoriasFanConfig(input = {}) {
  return Object.fromEntries(Object.entries(CATEGORIAS_FAN_CONFIG).map(([key, fallback]) => [key,
    typeof input?.[key] === typeof fallback ? input[key] : fallback]));
}
export function normalizeCategoryPhoto(input = {}) {
  const bounded = (key, min, max, fallback) => {
    const value = input?.[key]; const n = value == null || value === '' ? NaN : Number(value);
    return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
  };
  return {
    mobileImage: typeof input?.mobileImage === 'string' ? input.mobileImage.trim() : '',
    imageAlt: typeof input?.imageAlt === 'string' ? input.imageAlt : '',
    imagePositionX: bounded('imagePositionX', 0, 100, 50),
    imagePositionY: bounded('imagePositionY', 0, 100, 50), imageScale: bounded('imageScale', 1, 1.6, 1),
  };
}
export function categoryArtwork(slide) {
  const value = `${slide?.title || ''} ${slide?.href || ''}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/complement|accesorio/.test(value)) return { image: '/categorias/collection-atlas.webp', position: '100%', atlas: true };
  if (/lo.nuevo|novedad/.test(value)) return { image: '/categorias/collection-atlas.webp', position: '0%', atlas: true };
  if (/0.{0,2}12|bebe|meses/.test(value)) return { image: '/categorias/collection-atlas.webp', position: '33.333333%', atlas: true };
  if (/9.{0,2}12/.test(value)) return { image: '/categorias/collection-older.webp', position: '50%', atlas: false };
  if (/2.{0,2}8/.test(value)) return { image: '/categorias/collection-atlas.webp', position: '66.666667%', atlas: true };
  return { image: '/looks-editorial-background.webp', position: '50%', atlas: false };
}
export function categoryPhotoSource(value) {
  const originalDefaults = ['/SeccionCategoria/complementos.jpg', '/SeccionCategoria/lo-nuevo.jpg', '/SeccionCategoria/bebe.jpg', '/SeccionCategoria/niña2-8.jpg', '/SeccionCategoria/niña9-12.jpg'];
  return typeof value === 'string' && !originalDefaults.includes(value.trim()) ? value.trim() : '';
}
export function safeCategoryHref(value) {
  const href = typeof value === 'string' ? value.trim() : '';
  if (href === '/categorias') return '/#categorias';
  return /^\/(?![\/\\])[^\\\s]*$/.test(href) || /^https?:\/\/[^\s]+$/i.test(href) ? href : '/#categorias';
}
export function categoriasBackdrop(theme, config, style) {
  if (style.fanBackgroundMode === 'global') return { color: theme?.colors?.background || '#ffffff', image: '' };
  if (style.fanBackgroundMode === 'custom' || style.fanBackgroundMode === 'color') return {
    color: style.fanBackgroundColor, image: style.fanBackgroundMode === 'custom' ? config.backgroundImage : '',
  };
  const list = Array.isArray(theme?.sections) ? theme.sections : [];
  const look = normalizeLookSection(list.find((item) => item?.id === 'look' || item?.type === 'look'));
  return { color: look.style.editorialBackgroundColor, image: look.config.editorialBackgroundImage || '/looks-editorial-background.webp' };
}
