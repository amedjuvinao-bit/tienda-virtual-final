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
});
