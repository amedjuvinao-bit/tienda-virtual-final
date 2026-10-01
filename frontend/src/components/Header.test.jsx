import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
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
      theme: { header: { ...settings('Lo Nuevo').theme.header, iconSet: 'noir' } },
    });
    render(<MemoryRouter><Header /></MemoryRouter>);
    await waitFor(() => expect(screen.getByRole('banner').querySelector('[data-icon-style="noir"]')).toBeInTheDocument());
    const cartButtons = screen.getAllByRole('button', { name: 'Abrir carrito' });
    expect(cartButtons).toHaveLength(2);
    cartButtons.forEach((button) => {
      expect(button.querySelector('img')).toHaveAttribute('data-icon-style', 'noir');
      expect(button.querySelector('img')).toHaveAttribute('width', '40');
      expect(button.querySelector('img').getAttribute('src')).toContain('noir-cart');
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
});
