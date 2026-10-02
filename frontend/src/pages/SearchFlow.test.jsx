import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Header from '../components/Header';
import SearchResults from './SearchResults';
import { fetchSiteSettings } from '../lib/siteSettingsApi';

vi.mock('../lib/siteSettingsApi', () => ({ fetchSiteSettings: vi.fn() }));
vi.mock('../context/CartContext', () => ({ useCart: () => ({ cart: [] }) }));
vi.mock('../context/FavoritesContext', () => ({ useFavorites: () => ({ favorites: [] }) }));
vi.mock('../components/CartSidebar', () => ({ default: () => null }));
vi.mock('../components/FooterSection', () => ({ default: () => null }));
vi.mock('../components/ProductCard', () => ({ default: ({ product }) => <article>{product.title}</article> }));

beforeEach(() => {
  fetchSiteSettings.mockResolvedValue({ theme: { header: { bgColor: '#ffe3ec' } }, menus: { header: [] } });
  global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({
    products: [{ _id: 'p1', title: 'Vestido Rosa' }],
    pagination: { page: 1, limit: 24, totalProducts: 1, totalPages: 1 },
  }) });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.restoreAllMocks(); });

it('de la lupa a un producto del catálogo tras buscar y volver a buscar', async () => {
  const user = userEvent.setup();
  render(<MemoryRouter initialEntries={['/']}><Routes>
    <Route path="/" element={<Header />} />
    <Route path="/buscar" element={<SearchResults />} />
  </Routes></MemoryRouter>);
  await user.click(screen.getAllByRole('button', { name: 'Buscar productos' })[0]);
  await user.type(screen.getByRole('searchbox', { name: 'Buscar productos' }), 'vestido rosa');
  await user.click(screen.getByRole('button', { name: 'Ver resultados' }));
  expect(await screen.findByText('Vestido Rosa')).toBeInTheDocument();
  expect(global.fetch.mock.calls[0][0]).toContain('/api/products?q=vestido+rosa&page=1&limit=24');
  expect(screen.getByText('1 producto para “vestido rosa”')).toBeInTheDocument();

  const searchForm = screen.getAllByRole('search').find((form) => form.classList.contains('search-results-form'));
  await user.clear(searchForm.querySelector('input'));
  await user.type(searchForm.querySelector('input'), 'bolso');
  await user.click(searchForm.querySelector('button'));
  await waitFor(() => expect(global.fetch.mock.calls.at(-1)[0]).toContain('/api/products?q=bolso&page=1&limit=24'));
});
