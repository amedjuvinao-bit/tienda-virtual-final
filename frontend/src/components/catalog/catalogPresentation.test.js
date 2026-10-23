import { describe, expect, it } from 'vitest';
import { buildSafeCatalogConfig } from './catalogConfig';
import { buildCatalogPresentation, catalogImageUrl, catalogPresentationStyle } from './catalogPresentation';

describe('presentación editorial compartida', () => {
  it('conserva ajustes guardados y limita valores inválidos sin perder el cero', () => {
    const config = buildSafeCatalogConfig({ presentation: { styleVersion: 2, glassOpacity: 0, backgroundOpacity: 0, glassBlur: 100, gap: -1, motion: 'invalid', titleSize: 38, backgroundImage: '', rimStyle: "none" }, cardUiConfig: { titleColor: '#123456', cardPaddingPx: 7 } });
    expect(config.presentation).toMatchObject({ glassOpacity: 0, backgroundOpacity: 0, glassBlur: 32, gap: 8, motion: 'parallax', backgroundImage: '', rimStyle: "none" });
    expect(config.cardUiConfig).toMatchObject({ titleColor: '#123456', cardPaddingPx: 7 });
    expect(buildSafeCatalogConfig(config)).toEqual(config);
    expect(catalogPresentationStyle(config.presentation)['--catalog-backdrop']).toBe('none');
  });
  it('permite volver a la cuadrícula clásica y rechaza esquemas o valores CSS inyectados', () => {
    for (const url of ['javascript:alert(1)', '//external.test/photo.png', 'https://test/image");color:red', 'data:image/svg+xml,script', '/image\\bad']) expect(catalogImageUrl(url)).toBe('');
    expect(catalogImageUrl('/instagram/editorial-satin.webp')).toBe('/instagram/editorial-satin.webp');
    expect(catalogImageUrl('https://example.test/image.webp')).toBe('https://example.test/image.webp');
    const config = buildCatalogPresentation({ layout: 'grid', textColor: 'red;display:none', titleFont: 'garbage', motionStrength: Infinity });
    expect(config).toMatchObject({ layout: 'grid', textColor: '#562633', titleFont: 'serif', motionStrength: 18 });
  });
});
