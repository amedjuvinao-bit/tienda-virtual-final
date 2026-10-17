import { describe, expect, it } from 'vitest';
import { DEFAULT_TRENDING_MOBILE_COLORS, normalizeTrendingPresentation, trendingMobileColorsVars } from './trendingPresentation';

describe('persistencia de colores de Pasarela', () => {
  it('abre colores ya guardados con cristal transparente y limita el tinte para evitar un relleno opaco', () => {
    const legacy = normalizeTrendingPresentation({ mobileButtonColor: '#ffffff' });
    expect(trendingMobileColorsVars(legacy)).toMatchObject({ '--runway-button-rgb': '255, 255, 255', '--runway-button-tint': .08, '--runway-button-blur': '2px' });
    const custom = normalizeTrendingPresentation({ mobileButtonTintOpacity: .15, mobileButtonBlurPx: 4 });
    expect(normalizeTrendingPresentation(JSON.parse(JSON.stringify(custom)))).toMatchObject({ mobileButtonTintOpacity: .15, mobileButtonBlurPx: 4 });
    expect(normalizeTrendingPresentation({ mobileButtonTintOpacity: 1, mobileButtonBlurPx: -2 })).toMatchObject({ mobileButtonTintOpacity: .35, mobileButtonBlurPx: 0 });
  });

  it('preserva la imagen móvil al guardar y rechaza direcciones no admitidas', () => {
    const mobileBackgroundImage = 'https://res.cloudinary.com/tienda/image/upload/v1/movil.webp';
    const config = normalizeTrendingPresentation({ mobileBackgroundMode: 'custom', mobileBackgroundImage });
    expect(normalizeTrendingPresentation(JSON.parse(JSON.stringify(config)))).toMatchObject({ mobileBackgroundMode: 'custom', mobileBackgroundImage });
    expect(normalizeTrendingPresentation({ mobileBackgroundImage: 'javascript:alert(1)' }).mobileBackgroundImage).toBe('');
    expect(normalizeTrendingPresentation({ mobileBackgroundImage: 'https://otro.test/fondo.png' }).mobileBackgroundImage).toBe('');
  });

  it('conserva la apariencia original al abrir configuraciones anteriores', () => {
    const presentation = normalizeTrendingPresentation({ mode: 'floatingGlass', titleColor: '#113355', cardPriceColor: '#442211' });
    expect(presentation).toMatchObject({ ...DEFAULT_TRENDING_MOBILE_COLORS, mobileBackgroundMode: 'inherit', titleColor: '#113355', cardPriceColor: '#442211' });
    expect(normalizeTrendingPresentation(JSON.parse(JSON.stringify(presentation)))).toEqual(presentation);
  });
  it('rechaza valores de color inseguros y preserva las elecciones válidas al guardar', () => {
    const presentation = normalizeTrendingPresentation({ mobileTitleColor: 'url(https://ejemplo.test/)', mobilePriceColor: '#135',
      mobileButtonColor: '#246789', mobileFavoriteColor: '', mobileBackgroundMode: 'color', mobileBackgroundColor: '#fdf0f7' });
    expect(presentation).toMatchObject({ mobileTitleColor: '#65001e', mobilePriceColor: '#135', mobileButtonColor: '#246789',
      mobileFavoriteColor: '#ba1652', mobileBackgroundMode: 'color', mobileBackgroundColor: '#fdf0f7' });
    const saved = normalizeTrendingPresentation(JSON.parse(JSON.stringify(presentation)));
    expect(trendingMobileColorsVars(saved)).toMatchObject({ '--runway-title': '#65001e', '--runway-price': '#135', '--runway-button': '#246789' });
  });
});
