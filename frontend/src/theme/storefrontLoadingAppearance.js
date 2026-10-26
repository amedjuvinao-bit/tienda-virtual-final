import { catalogContinuityBackdrop } from '../components/catalog/catalogBackdrop';
import { catalogImageUrl } from '../components/catalog/catalogPresentation';

export const STOREFRONT_LOADING_KEY = 'storefront_loading_appearance';
const loaderKeys = [
  'enabled',
  'type',
  'color',
  'secondaryColor',
  'textColor',
  'sizePx',
  'strokeWidth',
  'speed',
  'durationMs',
  'logoUrl',
  'logoSizePx',
  'gapPx',
  'showLogo',
  'showText',
  'text',
  'animation',
  'icon',
];
const routeKey = (pathname) =>
  /^\/(producto|p)\//.test(pathname) ? 'product-detail' : /^\/devoluciones\//.test(pathname) ? 'returns-page' : pathname;
export function readLoadingAppearance() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(STOREFRONT_LOADING_KEY) || 'null'
    );
    return saved && typeof saved === 'object' && !Array.isArray(saved)
      ? saved
      : {};
  } catch {
    return {};
  }
}
function write(value) {
  try {
    localStorage.setItem(STOREFRONT_LOADING_KEY, JSON.stringify(value));
  } catch {
    /* Current appearance remains available in memory. */
  }
}
export function resolveLoadingBackdrop(
  theme,
  presentation = {},
  pageBg,
  mobile = false
) {
  if (presentation.backgroundMode === 'custom')
    return {
      color:
        pageBg || presentation.backgroundColor || 'var(--color-bg, Canvas)',
      image: catalogImageUrl(
        (mobile && presentation.mobileBackgroundImage) ||
          presentation.backgroundImage
      ),
    };
  return catalogContinuityBackdrop(theme, mobile);
}
export function rememberStorefrontLoadingAppearance(theme) {
  if (!theme) return;
  const previous = readLoadingAppearance();
  write({
    ...previous,
    home: {
      desktop: resolveLoadingBackdrop(theme),
      mobile: resolveLoadingBackdrop(theme, {}, undefined, true),
    },
    loader: Object.fromEntries(
      loaderKeys
        .filter((key) => theme.global?.loader?.[key] !== undefined)
        .map((key) => [key, theme.global.loader[key]])
    ),
  });
}
export function rememberPageLoadingAppearance(
  pathname,
  theme,
  presentation = {},
  pageBg
) {
  if (!pathname || pathname.startsWith('/admin') || !theme) return;
  const previous = readLoadingAppearance();
  const pages = {
    ...previous.pages,
    [routeKey(pathname)]: {
      mode: presentation.backgroundMode || 'continuity',
      desktop: resolveLoadingBackdrop(theme, presentation, pageBg),
      mobile: resolveLoadingBackdrop(theme, presentation, pageBg, true),
    },
  };
  write({
    ...previous,
    pages: Object.fromEntries(Object.entries(pages).slice(-16)),
  });
}
export function rememberedLoadingBackdrop(pathname, mobile = false) {
  const saved = readLoadingAppearance(),
    page = saved.pages?.[routeKey(pathname)];
  const value = (page?.mode === 'custom' ? page : saved.home)?.[
    mobile ? 'mobile' : 'desktop'
  ];
  return {
    color:
      typeof value?.color === 'string'
        ? value.color
        : 'var(--color-bg, Canvas)',
    image: catalogImageUrl(value?.image),
    custom: page?.mode === 'custom',
  };
}
