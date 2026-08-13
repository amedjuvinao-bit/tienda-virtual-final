import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

vi.mock('../lib/api', () => ({ default: state.api }));

import { FavoritesProvider, useFavorites } from './FavoritesContext';

const sessionId = `fav_${'a'.repeat(32)}`;
const token = `ft1_${'b'.repeat(43)}.${'c'.repeat(43)}`;
const product = {
  _id: '68a4a78a59706e44cade0316',
  title: 'Vestido',
  image: '/vestido.jpg',
  price: 99000,
};

function Probe() {
  const { addToFavorites, favorites, isInitialized } = useFavorites();
  return (
    <div>
      <span data-testid="status">{isInitialized ? 'ready' : 'loading'}</span>
      <span data-testid="count">{favorites.length}</span>
      <button type="button" onClick={() => addToFavorites(product)}>Agregar</button>
    </div>
  );
}

function renderProvider() {
  return render(
    <FavoritesProvider>
      <Probe />
    </FavoritesProvider>
  );
}

describe('FavoritesContext con propiedad segura', () => {
  beforeEach(() => {
    localStorage.clear();
    Object.values(state.api).forEach((mock) => mock.mockReset());
    state.api.post.mockResolvedValue({
      data: { sessionId, favoriteAccessToken: token },
    });
    state.api.get.mockRejectedValue({ response: { status: 404 } });
    state.api.put.mockResolvedValue({ data: { persisted: true } });
  });

  afterEach(() => cleanup());

  it('no crea una sesión ni un documento cuando la lista está vacía', async () => {
    renderProvider();
    expect(await screen.findByText('ready')).toBeInTheDocument();
    expect(state.api.post).not.toHaveBeenCalled();
    expect(state.api.get).not.toHaveBeenCalled();
    expect(state.api.put).not.toHaveBeenCalled();
  });

  it('crea acceso al primer favorito y sincroniza con encabezados, no con la URL', async () => {
    renderProvider();
    fireEvent.click(await screen.findByRole('button', { name: 'Agregar' }));
    expect(await screen.findByText('1')).toBeInTheDocument();
    await waitFor(() => expect(state.api.post).toHaveBeenCalledWith('/api/favorites/access'));
    await waitFor(() => expect(state.api.get).toHaveBeenCalled());
    await waitFor(() => expect(state.api.put).toHaveBeenCalled());
    const [url, body, config] = state.api.put.mock.calls.at(-1);
    expect(url).toBe(`/api/favorites/${sessionId}`);
    expect(body.items).toHaveLength(1);
    expect(config.headers).toEqual({
      'X-Favorite-Session-Id': sessionId,
      'X-Favorite-Access-Token': token,
    });
    expect(url).not.toContain(token);
  });
});
