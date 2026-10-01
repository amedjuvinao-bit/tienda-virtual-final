import { describe, expect, it } from 'vitest';
import { headerMenuDestination, normalizeHeaderMenu, resolveHeaderLogo, validateHeaderMenu } from './headerPresentation';

describe('encabezado público y editor', () => {
  it('elige el logo de contraste adecuado con el mismo criterio para tienda y vista previa', () => {
    const logos = { logoLight: '/claro.png', logoDark: '/oscuro.png' };
    expect(resolveHeaderLogo({ ...logos, bgColor: '#18181b' })).toBe('/claro.png');
    expect(resolveHeaderLogo({ ...logos, bgColor: '#fff' })).toBe('/oscuro.png');
    expect(resolveHeaderLogo({ bgColor: '#fff', logoLight: '/solo.png' })).toBe('/solo.png');
    expect(resolveHeaderLogo({ ...logos, bgColor: '#fff', logoMode: 'light' })).toBe('/claro.png');
    expect(resolveHeaderLogo({ ...logos, bgColor: '#18181b', logoMode: 'dark' })).toBe('/oscuro.png');
  });

  it('acepta páginas y URL externas, y evita rutas internas y protocolos inseguros', () => {
    expect(headerMenuDestination('/pagina/contacto')).toEqual({ to: '/pagina/contacto', isExternal: false });
    expect(headerMenuDestination('#tendencia')).toEqual({ to: '#tendencia', isExternal: false });
    expect(headerMenuDestination('https://example.com/coleccion')?.isExternal).toBe(true);
    for (const ref of ['/admin/dashboard', '/producto/:id', '/probe-site-settings', '//example.com', 'javascript:alert(1)', 'https://user:pass@example.com', '']) {
      expect(headerMenuDestination(ref)).toBeNull();
    }
  });

  it('avisa antes de guardar un menú que la tienda no podrá abrir', () => {
    expect(validateHeaderMenu([{ title: 'Producto', ref: '/producto/:id' }])).toMatch(/enlace 1/);
    expect(validateHeaderMenu([{ title: '', ref: '/' }])).toMatch(/nombre/);
    expect(normalizeHeaderMenu([{ title: 'Inicio', ref: '/' }, { title: 'Admin', ref: '/admin' }])).toEqual([
      { name: 'Inicio', to: '/', isExternal: false },
    ]);
  });
});
