import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TrendingSection from './TrendingSection';
import LookSection from './LookSection';

vi.mock('../context/CartContext', () => ({ useCart: () => ({ addToCart: vi.fn() }) }));
vi.mock('../context/FavoritesContext', () => ({ useFavorites: () => ({ toggleFavorite: vi.fn(), isFavorite: () => false }) }));

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('contenido real de las secciones', () => {
  it('no muestra Tendencia sin selección ni cuando la selección está desactivada', () => {
    const { container, rerender } = render(<MemoryRouter><TrendingSection theme={{ sections: [] }} /></MemoryRouter>);
    expect(container).toBeEmptyDOMElement();
    rerender(<MemoryRouter><TrendingSection theme={{ sections: [{ id: 'tendencia', enabled: false, config: { products: [{ productId: 'abc' }] } }] }} /></MemoryRouter>);
    expect(container).toBeEmptyDOMElement();
  });

  it('oculta Tendencia cuando el catálogo no devuelve productos, sin exponer diagnósticos al cliente', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ products: [] }) }));
    const { container } = render(<MemoryRouter><TrendingSection theme={{ sections: [{ id: 'tendencia', enabled: true, config: { products: [{ productId: 'abc' }] } }] }} /></MemoryRouter>);
    await act(async () => { await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1)); });
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText(/API_BASE|error cargando productos/i)).not.toBeInTheDocument();
  });

  it('muestra únicamente productos reales de Tendencia con enlaces al catálogo', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({
      products: [{ _id: 'abc', title: 'Artículo real', price: 123000, image: '/producto.jpg' }],
    }) }));
    render(<MemoryRouter><TrendingSection theme={{ sections: [{ id: 'tendencia', config: { products: [{ productId: 'abc' }] } }] }} /></MemoryRouter>);
    const product = await screen.findByText('Artículo real');
    expect(product.closest('a')).toHaveAttribute('href', '/producto/abc');
    expect(screen.queryByText('Vestido Rosado Elegante')).not.toBeInTheDocument();
  });

  it('oculta Looks si la sección está desactivada aunque tenga productos', () => {
    const { container } = render(<LookSection theme={{ sections: [{ id: 'look', enabled: false, config: { products: [{ productId: 'abc' }] } }] }} />);
    expect(container).toBeEmptyDOMElement();
  });
});
