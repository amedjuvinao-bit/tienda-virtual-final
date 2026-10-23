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

it('conserva y normaliza la personalización completa del encabezado sin perder valores cero', () => {
  const config = buildSafeCatalogConfig({ presentation:{ glassPaletteVersion:1, headerVersion:1, styleVersion:3, headerTint:'#123456', headerOpacity:0, headerReflection:0, headerContrast:0, headerShadow:0, headerLayers:false, headerIcon:'none', headerIconColor:'#abcdef', headerEdgeWidth:0, headerRadius:0, headerHeight:999 } });
  expect(config.presentation).toMatchObject({ headerTint:'#123456', headerOpacity:0, headerReflection:0, headerContrast:0, headerShadow:0, headerLayers:false, headerIcon:'none', headerIconColor:'#abcdef', headerEdgeWidth:0, headerRadius:0, headerHeight:240 });
  expect(buildSafeCatalogConfig(config)).toEqual(config);
  const style = catalogPresentationStyle(config.presentation);
  expect(style['--ch-fill']).toContain('#123456 0%');
  expect(style['--ch-layer-opacity']).toBe(0);
  expect(style['--ch-edge-width']).toBe('0px');
  expect(buildCatalogPresentation({ headerTint:'red;display:none', headerIcon:'invalid' })).toMatchObject({headerTint:'#ffffff',headerIcon:'bags'});
});

it('permite ajustar y desactivar el acabado de cristal', () => {
  expect(buildCatalogPresentation({headerMaterialOpacity:0}).headerMaterialOpacity).toBe(0);
  expect(buildCatalogPresentation({headerMaterialOpacity:900}).headerMaterialOpacity).toBe(1);
  expect(buildCatalogPresentation({headerMaterialOpacity:'invalid'}).headerMaterialOpacity).toBe(.9);
});

it('conserva el color y profundidad del relieve, incluido el cero, en el contrato del catálogo', () => {
  const config = buildSafeCatalogConfig({presentation:{styleVersion:3,glassPaletteVersion:2,headerMaterialDepthColor:'#2244cc',headerMaterialDepth:0}});
  expect(config.presentation).toMatchObject({headerMaterialDepthColor:'#2244cc',headerMaterialDepth:0});
  expect(buildSafeCatalogConfig(config)).toEqual(config);
  expect(buildCatalogPresentation({headerMaterialDepth:4,headerMaterialDepthColor:'invalid',headerEdgeColor:'#123456'})).toMatchObject({headerMaterialDepth:1,headerMaterialDepthColor:'#123456'});
});

it('hereda los colores de la escena sin introducir bordes o reflejos dorados', () => {
  const config = buildCatalogPresentation({glassColor:'#ffffff',accentColor:'#2244cc',textColor:'#112244'});
  const style = catalogPresentationStyle(config);
  expect(config).toMatchObject({headerTint:'#ffffff',headerEdgeColor:'#2244cc',headerContrastColor:'#2244cc',headerReflectionColor:'#ffffff',headerShadowColor:'#112244',headerIconColor:'#2244cc'});
  expect(style).not.toHaveProperty('--ch-material-hue');
  expect(style['--ch-fill']).toContain('#ffffff');
});
