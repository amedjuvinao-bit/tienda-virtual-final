import { describe, expect, it } from 'vitest';
import { DEFAULT_TRENDING_MOBILE_COLORS, normalizeTrendingPresentation, trendingMobileColorsVars } from './trendingPresentation';

describe('persistencia de colores de Pasarela', () => {
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
