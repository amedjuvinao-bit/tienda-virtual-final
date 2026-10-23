import { describe, expect, it } from 'vitest';
import { isStorefrontSectionVisible } from './storefrontSectionVisibility';

const themeWith = (id, config, enabled = true) => ({
  sections: [{ id, type: id, enabled, config }],
});

describe('secciones publicadas en la portada', () => {
  it('no publica productos de muestra ni bloques de catálogo vacíos', () => {
    expect(isStorefrontSectionVisible(themeWith('tendencia', { products: [] }), 'tendencia')).toBe(false);
    expect(isStorefrontSectionVisible(themeWith('look', { products: [] }), 'look')).toBe(false);
    expect(isStorefrontSectionVisible(themeWith('tendencia', { products: [{ productId: 'abc' }], maxItems: 0 }), 'tendencia')).toBe(false);
    expect(isStorefrontSectionVisible(themeWith('tendencia', { products: [{ productId: 'abc' }] }), 'tendencia')).toBe(true);
    expect(isStorefrontSectionVisible(themeWith('look', { products: [{ productId: 'abc' }] }), 'look')).toBe(true);
  });

  it('respeta las secciones desactivadas y solo muestra contenido activo', () => {
    expect(isStorefrontSectionVisible(themeWith('look', { products: [{ productId: 'abc' }] }, false), 'look')).toBe(false);
    expect(isStorefrontSectionVisible(themeWith('categorias', { slides: [{ enabled: false }] }), 'categorias')).toBe(false);
    expect(isStorefrontSectionVisible(themeWith('instagram', { posts: [{ image: '/foto.jpg', enabled: false }] }), 'instagram')).toBe(false);
    expect(isStorefrontSectionVisible(themeWith('tiktok', { posts: [{ thumb: '/foto.jpg' }] }), 'tiktok')).toBe(true);
    expect(isStorefrontSectionVisible(themeWith('informacion', {}, false), 'informacion')).toBe(false);
  });
});
