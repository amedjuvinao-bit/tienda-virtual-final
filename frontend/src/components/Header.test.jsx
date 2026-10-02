import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import Header from './Header';
import { fetchSiteSettings } from '../lib/siteSettingsApi';

vi.mock('../lib/siteSettingsApi', () => ({ fetchSiteSettings: vi.fn() }));
vi.mock('../context/CartContext', () => ({ useCart: () => ({ cart: [] }) }));
vi.mock('../context/FavoritesContext', () => ({ useFavorites: () => ({ favorites: [] }) }));
vi.mock('./CartSidebar', () => ({ default: () => null }));

const settings = (name) => ({
  theme: { header: { bgColor: '#141414', logoLight: '/claro.png', logoDark: '/oscuro.png' }, footer: {} },
  menus: { header: [{ title: name, ref: '/lo-nuevo' }, { title: 'Inseguro', ref: 'javascript:alert(1)' }] },
});

beforeEach(() => { vi.clearAllMocks(); fetchSiteSettings.mockResolvedValue(settings('Lo Nuevo')); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('encabezado de la tienda', () => {
  it('abre la búsqueda desde la lupa, permite cerrarla y envía la consulta a resultados', async () => {
    const user = userEvent.setup();
    function Location() { const location = useLocation(); return <output data-testid="location">{location.pathname}{location.search}</output>; }
    render(<MemoryRouter><Header /><Location /></MemoryRouter>);
    const buttons = screen.getAllByRole('button', { name: 'Buscar productos' });
    expect(buttons).toHaveLength(2);
    expect(buttons[0].querySelector('img').getAttribute('src')).toContain('gold-search');
    expect(buttons[0].querySelector('img')).toHaveAttribute('data-icon-source', 'builtin');
    await user.click(buttons[0]);
    expect(within(buttons[0].closest('.header-search-anchor')).getByRole('dialog', { name: 'Buscar productos' })).toBeInTheDocument();
    expect(document.querySelector('.header-search-backdrop')).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Buscar productos' })).toHaveFocus();
    fireEvent.mouseLeave(buttons[0].closest('.header-search-anchor'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await user.click(buttons[0]);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(buttons[1]);
    const input = screen.getByRole('combobox', { name: 'Buscar productos' });
    await user.type(input, 'vestido rosa');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(input).toHaveValue('vestido rosa');
    await user.keyboard('{Enter}');
    expect(screen.getByTestId('location')).toHaveTextContent('/buscar?q=vestido%20rosa');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('cierra el widget compacto al pulsar fuera de la lupa', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><Header /></MemoryRouter>);
    await user.click(screen.getAllByRole('button', { name: 'Buscar productos' })[0]);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('muestra productos del catálogo al escribir y abre el producto seleccionado', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({
      products: [{ _id: 'p1', slug: 'vestido-rosa', title: 'Vestido Rosa', image: '/vestido.webp', price: 125000 }],
      pagination: { totalProducts: 1 },
    }) }));
    const user = userEvent.setup();
    function Location() { const location = useLocation(); return <output data-testid="location">{location.pathname}{location.search}</output>; }
    render(<MemoryRouter><Header /><Location /></MemoryRouter>);
    await user.click(screen.getAllByRole('button', { name: 'Buscar productos' })[0]);
    await user.type(screen.getByRole('combobox', { name: 'Buscar productos' }), 'vest');
    const option = await screen.findByRole('option', { name: /Vestido Rosa/ });
    expect(global.fetch.mock.calls[0][0]).toContain('/api/products?q=vest&page=1&limit=5');
    expect(option.querySelector('img')).toHaveAttribute('src', '/vestido.webp');
    expect(option).toHaveTextContent('125.000');
    await user.click(option);
    expect(screen.getByTestId('location')).toHaveTextContent('/producto/vestido-rosa');
    expect(screen.queryByRole('dialog', { name: 'Buscar productos' })).not.toBeInTheDocument();
  });
  it('permite elegir una sugerencia con flechas y Enter y cambiar la consulta', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url) => ({ ok: true, json: async () => ({
      products: String(url).includes('q=bol')
        ? [{ _id: 'b2', title: 'Bolso Azul', price: 50000 }]
        : [{ _id: 'p1', title: 'Vestido Rosa', price: 125000 }],
      pagination: { totalProducts: 1 },
    }) })));
    const user = userEvent.setup();
    function Location() { const location = useLocation(); return <output data-testid="location">{location.pathname}</output>; }
    render(<MemoryRouter><Header /><Location /></MemoryRouter>);
    await user.click(screen.getAllByRole('button', { name: 'Buscar productos' })[1]);
    const input = screen.getByRole('combobox', { name: 'Buscar productos' });
    await user.type(input, 'ves');
    expect(await screen.findByRole('option', { name: /Vestido Rosa/ })).toBeInTheDocument();
    await user.clear(input);
    await user.type(input, 'bol');
    expect(await screen.findByRole('option', { name: /Bolso Azul/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Vestido Rosa/ })).not.toBeInTheDocument();
    await user.keyboard('{ArrowDown}{Enter}');
    expect(screen.getByTestId('location')).toHaveTextContent('/producto/b2');
  });
  it('indica cuando no hay coincidencias y permite ver la búsqueda completa', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ products: [], pagination: { totalProducts: 0 } }) }));
    const user = userEvent.setup();
    function Location() { const location = useLocation(); return <output data-testid="location">{location.pathname}{location.search}</output>; }
    render(<MemoryRouter><Header /><Location /></MemoryRouter>);
    await user.click(screen.getAllByRole('button', { name: 'Buscar productos' })[0]);
    await user.type(screen.getByRole('combobox', { name: 'Buscar productos' }), 'inexistente');
    expect(await screen.findByText('No encontramos productos para “inexistente”.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Ver todos los resultados/ }));
    expect(screen.getByTestId('location')).toHaveTextContent('/buscar?q=inexistente');
  });
  it('aplica al buscador los colores guardados en Apariencia y actualiza el tema', async () => {
    fetchSiteSettings.mockResolvedValue({ ...settings('Lo Nuevo'), theme: { header: {
      ...settings('Lo Nuevo').theme.header,
      searchBgColor: '#254254', searchTextColor: '#f0f0f0', searchAccentColor: '#facc15', searchBorderColor: '#efefef',
    } } });
    render(<MemoryRouter><Header /></MemoryRouter>);
    const header = screen.getByRole('banner');
    await waitFor(() => expect(header.style.getPropertyValue('--header-search-bg')).toBe('#254254'));
    expect(header.style.getPropertyValue('--header-search-text')).toBe('#f0f0f0');
    expect(header.style.getPropertyValue('--header-search-accent')).toBe('#facc15');
    expect(header.style.getPropertyValue('--header-search-border')).toBe('#efefef');
    fetchSiteSettings.mockResolvedValue(settings('Lo Nuevo'));
    fireEvent(window, new Event('rb_site_settings_updated'));
    await waitFor(() => expect(header.style.getPropertyValue('--header-search-bg')).toBe('#141414'));
    expect(header.style.getPropertyValue('--header-search-text')).toBe('#ffffff');
    expect(header.style.getPropertyValue('--header-search-accent')).toBe('#ffffff');
  });
  it('usa el logo de contraste, conserva enlaces seguros y actualiza el menú después de guardar', async () => {
    render(<MemoryRouter><Header /></MemoryRouter>);
    const nav = await screen.findByRole('navigation', { name: 'Navegación principal' });
    expect(within(nav).getByRole('link', { name: 'Lo Nuevo' })).toHaveAttribute('href', '/lo-nuevo');
    expect(within(nav).queryByText('Inseguro')).not.toBeInTheDocument();
    expect(screen.getAllByAltText('Logo Rosa Boutique')[0]).toHaveAttribute('src', '/claro.png');

    fetchSiteSettings.mockResolvedValue(settings('Nueva colección'));
    fireEvent(window, new Event('rb_site_settings_updated'));
    expect(await within(nav).findByRole('link', { name: 'Nueva colección' })).toBeInTheDocument();
    expect(fetchSiteSettings).toHaveBeenCalledTimes(2);
  });

  it('permite abrir y cerrar el menú con teclado sin mostrar registro ni redes sin configurar', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><Header /></MemoryRouter>);
    await waitFor(() => expect(fetchSiteSettings).toHaveBeenCalled());
    await user.click(screen.getByRole('button', { name: 'Abrir menú' }));
    const drawer = document.getElementById('storefront-mobile-menu');
    expect(drawer).toHaveAttribute('aria-hidden', 'false');
    expect(screen.queryByRole('button', { name: 'Administración' })).not.toBeInTheDocument();
    expect(within(drawer).queryByText('Mi cuenta')).not.toBeInTheDocument();
    expect(within(drawer).queryByRole('button', { name: 'Inicia sesión' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Favoritos' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Abrir carrito' })).toHaveLength(2);
    expect(within(drawer).queryByText('Registro')).not.toBeInTheDocument();
    expect(within(drawer).queryByRole('link', { name: 'Facebook' })).not.toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(drawer).toHaveAttribute('aria-hidden', 'true');
  });

  it('muestra el cristal inferior con las categorías e íconos configurados, sin asumir que vende ropa', async () => {
    fetchSiteSettings.mockResolvedValue({
      ...settings('Lo Nuevo'),
      store: { name: 'Tienda de prueba' },
      theme: { header: { mobileMenuLayout: 'atelier-sheet', logoLight: '/claro.png', mobileMenuFeatureImage: '/promocion.webp', mobileMenuFeatureRef: '/pagina/cafe' }, banner: { slides: [{ image: '/campana.webp' }] } },
      menus: { header: [
        { title: 'Libros', ref: '/pagina/libros', icon: 'books' },
        { title: 'Café', ref: '/pagina/cafe', icon: 'food' },
        { title: 'Otra categoría', ref: '/pagina/otra' },
      ] },
    });
    const user = userEvent.setup();
    function Location() { const location = useLocation(); return <output data-testid="location">{location.pathname}</output>; }
    render(<MemoryRouter><Header /><Location /></MemoryRouter>);
    await user.click(screen.getByRole('button', { name: 'Abrir menú' }));
    const drawer = document.getElementById('storefront-mobile-menu');
    expect(drawer).toHaveAttribute('aria-hidden', 'false');
    expect(drawer).toHaveStyle({ bottom: '0px', width: '100%' });
    expect(within(drawer).getByRole('navigation', { name: 'Navegación móvil' })).toBeInTheDocument();
    expect(drawer.querySelector('.atelier-menu__brand')).toHaveTextContent('Tienda de prueba');
    expect(within(drawer).getByRole('button', { name: 'Libros' }).querySelector('[data-menu-icon]')).toHaveAttribute('data-menu-icon', 'books');
    expect(within(drawer).getByRole('button', { name: 'Café' }).querySelector('[data-menu-icon]')).toHaveAttribute('data-menu-icon', 'food');
    expect(within(drawer).getByRole('button', { name: 'Otra categoría' }).querySelector('[data-menu-icon]')).toHaveAttribute('data-menu-icon', 'grid');
    expect(drawer.querySelector('.atelier-menu__feature').style.backgroundImage).toContain('/promocion.webp');
    expect(drawer.querySelector('.atelier-menu__feature').style.backgroundImage).not.toContain('/campana.webp');
    expect(drawer.querySelector('.atelier-menu__feature')).toHaveTextContent('Café');
    expect(within(drawer).getByRole('button', { name: 'Buscar desde el menú' })).toBeInTheDocument();
    expect(within(drawer).getByRole('button', { name: 'Carrito desde el menú' })).toBeInTheDocument();
    await user.click(within(drawer).getByRole('button', { name: 'Café' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/pagina/cafe');
    expect(drawer).toHaveAttribute('aria-hidden', 'true');
  });

  it('ancla el encabezado y el menú al viewport aunque la página contenga un panel recortado', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><div style={{ overflow: 'hidden', width: 420 }}><Header /></div></MemoryRouter>);
    await user.click(screen.getByRole('button', { name: 'Abrir menú' }));
    const drawer = document.getElementById('storefront-mobile-menu');
    expect(screen.getByRole('banner').parentElement).toBe(document.body);
    expect(drawer.parentElement).toBe(document.body);
    expect(drawer).toHaveStyle({ bottom: '0px', width: '100%' });
    expect(drawer.previousElementSibling.style.opacity).toBe('1');
    expect(drawer.previousElementSibling.style.backdropFilter).toBe('blur(4px)');
  });

  it('prueba el otro logo y muestra la marca en texto si ambos archivos fallan', async () => {
    render(<MemoryRouter><Header /></MemoryRouter>);
    const image = (await screen.findAllByAltText('Logo Rosa Boutique'))[0];
    fireEvent.error(image);
    expect(screen.getAllByAltText('Logo Rosa Boutique')[0]).toHaveAttribute('src', '/oscuro.png');
    fireEvent.error(screen.getAllByAltText('Logo Rosa Boutique')[0]);
    expect(screen.getAllByRole('img', { name: 'Rosa Boutique' })[0]).toHaveTextContent('Rosa Boutique');
  });

  it('respeta la versión clara elegida aunque el fondo sea claro', async () => {
    fetchSiteSettings.mockResolvedValue({
      ...settings('Lo Nuevo'),
      theme: { header: { bgColor: '#ffffff', logoMode: 'light', logoLight: '/claro.png', logoDark: '/oscuro.png' } },
    });
    render(<MemoryRouter><Header /></MemoryRouter>);
    const image = (await screen.findAllByAltText('Logo Rosa Boutique'))[0];
    expect(image).toHaveAttribute('src', '/claro.png');
  });

  it('muestra la forma flotante y el vidrio configurados en la tienda pública', async () => {
    fetchSiteSettings.mockResolvedValue({
      ...settings('Lo Nuevo'),
      theme: { header: { ...settings('Lo Nuevo').theme.header, surfaceShape: 'floating', cornerRadiusPx: 38, liquidGlassEnabled: true, glassStrength: 90, bgOpacity: 1 } },
    });
    render(<MemoryRouter><Header /></MemoryRouter>);
    const header = screen.getByRole('banner');
    await waitFor(() => expect(header).toHaveAttribute('data-shape', 'floating'));
    expect(header).toHaveAttribute('data-glass', 'true');
    expect(header.style.getPropertyValue('--header-surface-radius')).toBe('38px');
    expect(header.style.backgroundColor).toContain('0.62');
  });

  it('usa los iconos tridimensionales guardados en escritorio y móvil sin contenedores', async () => {
    fetchSiteSettings.mockResolvedValue({
      ...settings('Lo Nuevo'),
      theme: { header: { ...settings('Lo Nuevo').theme.header, iconSet: 'wine', iconSizePx: 32 } },
    });
    render(<MemoryRouter><Header /></MemoryRouter>);
    await waitFor(() => expect(screen.getByRole('banner').querySelector('[data-icon-style="wine"]')).toBeInTheDocument());
    expect(screen.getByRole('banner').style.getPropertyValue('--storefront-action-size')).toBe('32px');
    expect(screen.queryByRole('button', { name: 'Administración' })).not.toBeInTheDocument();
    const cartButtons = screen.getAllByRole('button', { name: 'Abrir carrito' });
    expect(cartButtons).toHaveLength(2);
    cartButtons.forEach((button) => {
      expect(button.querySelector('img')).toHaveAttribute('data-icon-style', 'wine');
      expect(button.querySelector('img')).toHaveAttribute('width', '34');
      expect(button.querySelector('img').getAttribute('src')).toContain('wine-cart');
    });
  });

  it('muestra las imágenes propias guardadas en escritorio y móvil', async () => {
    const image = 'https://res.cloudinary.com/tienda/image/upload/v1/carrito.webp';
    fetchSiteSettings.mockResolvedValue({ ...settings('Lo Nuevo'), theme: { header: {
      ...settings('Lo Nuevo').theme.header, iconSet: 'custom', iconImages: { cart: image },
    } } });
    render(<MemoryRouter><Header /></MemoryRouter>);
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Abrir carrito' })[0].querySelector('img')).toHaveAttribute('src', image));
    screen.getAllByRole('button', { name: 'Abrir carrito' }).forEach((button) => expect(button.querySelector('img')).toHaveAttribute('src', image));
  });

  it('aplica una imagen propia solo al icono elegido dentro del juego', async () => {
    const image = 'https://res.cloudinary.com/tienda/image/upload/v1/corazon.webp';
    fetchSiteSettings.mockResolvedValue({ ...settings('Lo Nuevo'), theme: { header: {
      ...settings('Lo Nuevo').theme.header, iconSet: 'satin', iconOverrides: { satin: { favorites: image } },
    } } });
    render(<MemoryRouter><Header /></MemoryRouter>);
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Favoritos' })[0].querySelector('img')).toHaveAttribute('src', image));
    expect(screen.getAllByRole('button', { name: 'Abrir carrito' })[0].querySelector('img').getAttribute('src')).toContain('satin-cart');
  });

  it('conserva el tamaño original de una lupa personalizada', async () => {
    const image = 'https://res.cloudinary.com/tienda/image/upload/v1/lupa.webp';
    fetchSiteSettings.mockResolvedValue({ ...settings('Lo Nuevo'), theme: { header: {
      ...settings('Lo Nuevo').theme.header, iconSet: 'gold', iconOverrides: { gold: { search: image } },
    } } });
    render(<MemoryRouter><Header /></MemoryRouter>);
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Buscar productos' })[0].querySelector('img')).toHaveAttribute('src', image));
    screen.getAllByRole('button', { name: 'Buscar productos' }).forEach((button) => {
      expect(button.querySelector('img')).toHaveAttribute('data-icon-source', 'custom');
    });
  });
});
