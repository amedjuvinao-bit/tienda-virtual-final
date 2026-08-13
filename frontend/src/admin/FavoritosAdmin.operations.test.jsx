import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  permissions: new Set(['favorites:view', 'favorites:delete']),
  api: { get: vi.fn(), delete: vi.fn() },
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../lib/api', () => ({ default: state.api }));
vi.mock('./security/useAdminPermissions', () => ({
  default: () => ({ can: (permission) => state.permissions.has(permission) }),
}));
vi.mock('react-toastify', () => ({ toast: state.toast }));

import FavoritosAdmin from './FavoritosAdmin';

const favoriteId = '68a4a78a59706e44cade0416';
const itemId = '68a4a78a59706e44cade0417';
const sessionId = `fav_${'a'.repeat(32)}`;
const row = {
  _id: favoriteId,
  sessionId,
  itemsCount: 1,
  potentialValue: 99000,
  lastUpdate: '2026-08-12T15:00:00.000Z',
};
const detail = {
  ...row,
  items: [{
    _id: itemId,
    productId: '68a4a78a59706e44cade0316',
    title: 'Vestido',
    image: '/vestido.jpg',
    price: 99000,
    current: {
      valid: true,
      title: 'Vestido',
      image: '/vestido.jpg',
      price: 99000,
      variantSku: 'VES-01',
      availableStock: 4,
      inventoryTracked: true,
    },
    alerts: [],
  }],
};

describe('operaciones administrativas de favoritos', () => {
  beforeEach(() => {
    state.permissions = new Set(['favorites:view', 'favorites:delete']);
    Object.values(state.api).forEach((mock) => mock.mockReset());
    Object.values(state.toast).forEach((mock) => mock.mockReset());
    state.api.get.mockImplementation((url) => {
      if (url.startsWith('/api/favorites/admin?')) {
        return Promise.resolve({ data: { data: [row], total: 1, totalPages: 1 } });
      }
      return Promise.resolve({ data: detail });
    });
    state.api.delete.mockResolvedValue({ data: detail });
  });

  afterEach(() => cleanup());

  it('abre detalle por la ruta administrativa y nunca por la sesión pública', async () => {
    render(<FavoritosAdmin />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ver detalle' }));
    await screen.findByText('Vestido');
    expect(state.api.get).toHaveBeenCalledWith(`/api/favorites/admin/${favoriteId}`);
    expect(state.api.get).not.toHaveBeenCalledWith(expect.stringContaining(sessionId));
  });

  it('retira un ítem por su identificador administrativo', async () => {
    render(<FavoritosAdmin />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ver detalle' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Quitar' }));
    await waitFor(() => {
      expect(state.api.delete).toHaveBeenCalledWith(
        `/api/favorites/admin/${favoriteId}/items/${itemId}`
      );
    });
    expect(state.toast.success).toHaveBeenCalled();
  });

  it('un perfil de solo lectura no recibe acciones destructivas', async () => {
    state.permissions = new Set(['favorites:view']);
    render(<FavoritosAdmin />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ver detalle' }));
    expect(await screen.findByText('Solo lectura')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Quitar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Eliminar favoritos' })).not.toBeInTheDocument();
  });
});
