import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import CatalogEditorialCard from './CatalogEditorialCard';
import { buildSafeCatalogConfig } from './catalogConfig';
const state = vi.hoisted(() => ({ cart: [], favorites: [], add: vi.fn(), toggle: vi.fn(), isFavorite: vi.fn() }));
vi.mock('../../context/CartContext', () => ({ useCart: () => ({ cart: state.cart, addToCart: state.add }) }));
vi.mock('../../context/FavoritesContext', () => ({ useFavorites: () => ({ isFavorite: state.isFavorite, toggleFavorite: state.toggle }) }));
const product = { _id: 'p1', slug: 'producto', title: 'Producto', price: 10000, inventoryTracked: true, variants: [{ variantKey: 'unica', availableStock: 3, price: 12000 }] };
const config = buildSafeCatalogConfig({ presentation: { styleVersion: 5 } });
const card = (item = product) => <MemoryRouter><Routes><Route path="/" element={<CatalogEditorialCard product={item} config={config}/>} /><Route path="/producto/:slug" element={<p>Selecciona una opción</p>} /></Routes></MemoryRouter>;
beforeEach(() => {
  vi.clearAllMocks(); state.cart = []; state.favorites = [];
  // Match the real provider: an id string cannot resolve the product's favorite key.
  state.isFavorite.mockImplementation(item => state.favorites.includes(item?._id));
  state.toggle.mockImplementation(item => { state.favorites = state.favorites.includes(item._id) ? [] : [item._id]; });
  state.add.mockImplementation(item => { state.cart = [{ ...item, quantity: 1 }]; });
});
afterEach(cleanup);
it('marca y desmarca favoritos y repite el efecto al volver a pulsar', () => {
  render(card()); const favorite = screen.getByRole('button', { name: 'Favorito' });
  fireEvent.click(favorite);
  expect(state.isFavorite).toHaveBeenLastCalledWith(product);
  expect(favorite).toHaveAttribute('aria-pressed', 'true');
  expect(favorite.querySelector('svg')).toHaveAttribute('fill', 'currentColor');
  expect(favorite).toHaveAttribute('data-pulse', 'a');
  fireEvent.click(favorite);
  expect(favorite).toHaveAttribute('aria-pressed', 'false');
  expect(favorite).toHaveAttribute('data-pulse', 'b');
});
it('marca el carrito real, compra la variante correcta y se desmarca al retirarla externamente', () => {
  const view = render(card()); const button = screen.getByRole('button', { name: 'Agregar al carrito' });
  fireEvent.click(button);
  expect(state.add).toHaveBeenCalledWith(expect.objectContaining({ _id: 'p1', variantKey: 'unica', price: 12000 }));
  expect(button).toHaveAttribute('aria-pressed', 'true');
  expect(button.querySelector('.catalog-ecard__cart-check')).not.toBeNull();
  fireEvent.click(button); expect(button).toHaveAttribute('data-pulse', 'b');
  state.cart = []; view.rerender(card());
  expect(button).toHaveAttribute('aria-pressed', 'false');
  expect(button.querySelector('.catalog-ecard__cart-check')).toBeNull();
});
it('restaura las marcas desde los estados existentes de la tienda', () => {
  state.favorites = ['p1']; state.cart = [{ _id: 'p1', variantKey: 'otra', quantity: 2 }]; render(card());
  expect(screen.getByRole('button', { name: 'Favorito' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('button', { name: 'Agregar al carrito' })).toHaveAttribute('aria-pressed', 'true');
});
it('solicita variantes sin simular compras y respeta los productos agotados', () => {
  const view = render(card({ ...product, variants: [...product.variants, { variantKey: 'otra', availableStock: 2 }] }));
  fireEvent.click(screen.getByRole('button', { name: 'Seleccionar opciones' }));
  expect(screen.getByText('Selecciona una opción')).toBeInTheDocument(); expect(state.add).not.toHaveBeenCalled();
  view.unmount(); render(card({ ...product, variants: [{ variantKey: 'unica', availableStock: 0 }] }));
  const button = screen.getByRole('button', { name: 'Agotado' });
  expect(button).toBeDisabled(); fireEvent.click(button);
  expect(button).toHaveAttribute('aria-pressed', 'false'); expect(button).not.toHaveAttribute('data-pulse');
  expect(state.add).not.toHaveBeenCalled();
});
