import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  auth: { isAuthenticated: true, adminToken: 'valid', authLoading: false },
  permissions: new Set(['favorites:view', 'favorites:export', 'favorites:delete']),
  api: {
    list: vi.fn(), summary: vi.fn(), detail: vi.fn(),
    removeItem: vi.fn(), remove: vi.fn(), export: vi.fn(),
  },
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../context/AuthContext', () => ({ useAuth: () => state.auth }));
vi.mock('./security/useAdminPermissions', () => ({
  default: () => ({ can: (permission) => state.permissions.has(permission) }),
}));
vi.mock('./favoriteAdminApi', () => ({ default: state.api }));
vi.mock('react-toastify', () => ({ toast: state.toast }));

import FavoritosAdmin from './FavoritosAdmin';

const favoriteId = '68a4a78a59706e44cade0416';
const itemId = '68a4a78a59706e44cade0417';
const sessionId = `fav_${'a'.repeat(32)}`;
const row = {
  _id: favoriteId,
  sessionId,
  itemsCount: 3,
  potentialValue: 299000,
  lastUpdate: new Date().toISOString(),
  productPreview: [{
    productId: '68a4a78a59706e44cade0316',
    title: 'Vestido principal',
    image: '/vestido.jpg',
  }],
};
const detail = {
  ...row,
  items: [{
    _id: itemId,
    productId: '68a4a78a59706e44cade0316',
    title: 'Vestido principal',
    image: '/vestido.jpg',
    price: 99000,
    variantLabel: 'M / Rosado',
    current: {
      valid: true,
      title: 'Vestido principal',
      image: '/vestido.jpg',
      price: 109000,
      variantSku: 'VES-M-ROS',
      variantLabel: 'M / Rosado',
      availableStock: 4,
      inventoryTracked: true,
    },
    alerts: [{ code: 'PRICE_CHANGED', message: 'El precio vigente cambió' }],
  }],
};
const summary = {
  totalLists: 1,
  totalItems: 3,
  potentialValue: 299000,
  averageListValue: 299000,
  recentLists: 1,
  highIntentLists: 1,
};

describe('panel administrativo profesional de favoritos', () => {
  beforeEach(() => {
    state.auth = { isAuthenticated: true, adminToken: 'valid', authLoading: false };
    state.permissions = new Set(['favorites:view', 'favorites:export', 'favorites:delete']);
    Object.values(state.api).forEach((mock) => mock.mockReset());
    Object.values(state.toast).forEach((mock) => mock.mockReset());
    state.api.list.mockResolvedValue({ data: { data: [row], total: 1, totalPages: 1 } });
    state.api.summary.mockResolvedValue({ data: summary });
    state.api.detail.mockResolvedValue({ data: detail });
    state.api.removeItem.mockResolvedValue({ data: detail });
  });

  afterEach(() => cleanup());

  it('carga indicadores, valor potencial y productos de interés', async () => {
    render(<FavoritosAdmin />);
    expect(await screen.findByText('Vestido principal')).toBeInTheDocument();
    expect(screen.getAllByText('Valor potencial')).toHaveLength(2);
    expect(screen.getAllByText(/299\.000/).length).toBeGreaterThan(0);
    expect(state.api.list).toHaveBeenCalled();
    expect(state.api.summary).toHaveBeenCalled();
  });

  it('aplica vistas rápidas conservando filtros de backend', async () => {
    render(<FavoritosAdmin />);
    await screen.findByText('Vestido principal');
    fireEvent.click(screen.getByRole('button', { name: 'Alta intención' }));
    await waitFor(() => {
      expect(state.api.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ view: 'high_intent' })
      );
    });
  });

  it('abre detalle administrativo con variante, disponibilidad y alerta', async () => {
    render(<FavoritosAdmin />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ver detalle' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('M / Rosado');
    expect(dialog).toHaveTextContent('Disponible: 4');
    expect(dialog).toHaveTextContent('El precio vigente cambió');
    expect(state.api.detail).toHaveBeenCalledWith(favoriteId);
  });

  it('retira un producto por su identificador administrativo', async () => {
    render(<FavoritosAdmin />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ver detalle' }));
    fireEvent.click(await screen.findByTitle('Retirar de favoritos'));
    await waitFor(() => expect(state.api.removeItem).toHaveBeenCalledWith(favoriteId, itemId));
    expect(state.toast.success).toHaveBeenCalled();
  });

  it('mantiene indicadores cuando falla solamente el listado', async () => {
    state.api.list.mockRejectedValue(new Error('list unavailable'));
    render(<FavoritosAdmin />);
    expect(await screen.findByRole('alert')).toHaveTextContent('listado');
    expect(screen.getAllByText(/299\.000/).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Reintentar listado' })).toBeInTheDocument();
  });

  it('respeta perfiles de solo lectura y oculta exportación y borrado', async () => {
    state.permissions = new Set(['favorites:view']);
    render(<FavoritosAdmin />);
    expect(await screen.findByText('Vestido principal')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Exportar' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalle' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).not.toHaveTextContent('Acción destructiva');
    expect(screen.queryByTitle('Retirar de favoritos')).not.toBeInTheDocument();
  });

  it('sin sesión administrativa no consulta endpoints protegidos', async () => {
    state.auth = { isAuthenticated: false, adminToken: '', authLoading: false };
    render(<FavoritosAdmin />);
    expect(await screen.findByRole('alert')).toHaveTextContent('sesión administrativa');
    expect(state.api.list).not.toHaveBeenCalled();
    expect(state.api.summary).not.toHaveBeenCalled();
  });
});
