import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import { afterEach, expect, it } from 'vitest';
import {
  rememberStorefrontLoadingAppearance,
  rememberPageLoadingAppearance,
  rememberedLoadingBackdrop,
  readLoadingAppearance,
  STOREFRONT_LOADING_KEY,
} from './storefrontLoadingAppearance';
afterEach(() => localStorage.clear());
const theme = {
  colors: { background: '#113355' },
  global: {
    loader: { type: 'ring', showText: false, secret: 'never-cache' },
    sectionMotion: { journey: { backgroundImage: '/home.webp' } },
  },
};
it('recuerda solo apariencia pública y actualiza el fondo continuo sin fijar una imagen antigua', () => {
  rememberStorefrontLoadingAppearance(theme);
  rememberPageLoadingAppearance('/pagina/novedades', theme);
  rememberStorefrontLoadingAppearance({
    ...theme,
    global: {
      ...theme.global,
      sectionMotion: { journey: { backgroundImage: '/home-new.webp' } },
    },
  });
  expect(rememberedLoadingBackdrop('/pagina/novedades').image).toBe(
    '/home-new.webp'
  );
  expect(readLoadingAppearance().loader).toEqual({
    type: 'ring',
    showText: false,
  });
});
it('comparte la apariencia del detalle entre productos y mantiene las imágenes propias móvil y escritorio', () => {
  rememberStorefrontLoadingAppearance(theme);
  rememberPageLoadingAppearance(
    '/producto/uno',
    theme,
    {
      backgroundMode: 'custom',
      backgroundImage: '/detail-wide.webp',
      mobileBackgroundImage: '/detail-phone.webp',
    },
    '#735374'
  );
  expect(rememberedLoadingBackdrop('/p/otro', true)).toMatchObject({
    color: '#735374',
    image: '/detail-phone.webp',
  });
  expect(rememberedLoadingBackdrop('/producto/otro').image).toBe(
    '/detail-wide.webp'
  );
});
it('pinta el fondo recordado en el HTML antes de que arranque React', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  const page = new JSDOM(html, {
    url: 'http://localhost:5173/producto/uno',
    runScripts: 'dangerously',
    beforeParse(window) {
      window.matchMedia = () => ({ matches: true });
      window.CSS = { supports: () => true };
      window.localStorage.setItem(
        STOREFRONT_LOADING_KEY,
        JSON.stringify({
          home: { mobile: { color: '#113355', image: '/home-phone.webp' } },
          pages: {
            'product-detail': {
              mode: 'custom',
              mobile: { color: '#735374', image: '/detail-phone.webp' },
            },
          },
        })
      );
    },
  });
  const root = page.window.document.documentElement;
  expect(root.dataset.storefrontBoot).toBe('true');
  expect(root.style.getPropertyValue('--storefront-boot-color')).toBe(
    '#735374'
  );
  expect(root.style.getPropertyValue('--storefront-boot-image')).toContain(
    '/detail-phone.webp'
  );
  page.window.close();
});
