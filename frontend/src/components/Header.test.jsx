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
afterEach(cleanup);

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
    expect(screen.getByRole('searchbox', { name: 'Buscar productos' })).toHaveFocus();
    fireEvent.mouseLeave(buttons[0].closest('.header-search-anchor'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await user.click(buttons[0]);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(buttons[1]);
    const input = screen.getByRole('searchbox', { name: 'Buscar productos' });
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
