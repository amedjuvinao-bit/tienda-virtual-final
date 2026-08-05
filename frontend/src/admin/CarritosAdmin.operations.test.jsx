import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  auth: { isAuthenticated: true, adminToken: 'valid', authLoading: false },
  permissions: new Set(['carts:view', 'carts:export', 'carts:recover', 'carts:delete']),
  api: {
    list: vi.fn(), summary: vi.fn(), detail: vi.fn(), updateItems: vi.fn(),
    addNote: vi.fn(), updateTags: vi.fn(), clear: vi.fn(), remove: vi.fn(),
    generateRecoveryLink: vi.fn(), sendRecovery: vi.fn(), registerFollowUps: vi.fn(), export: vi.fn(),
  },
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

vi.mock('../context/AuthContext', () => ({ useAuth: () => state.auth }));
vi.mock('./security/useAdminPermissions', () => ({
  default: () => ({ can: (permission) => state.permissions.has(permission) }),
}));
vi.mock('./cartAdminApi', () => ({ default: state.api }));
vi.mock('react-toastify', () => ({ toast: state.toast }));

import CarritosAdmin from './CarritosAdmin';

const row = {
  sessionId: 'cart_example', userName: 'Ana', userEmail: 'ana@example.com',
  identified: true, lifecycle: 'recoverable', differentProducts: 1, totalUnits: 2,
  subtotal: 80000, activityAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z',
  recoveryAttemptsCount: 1,
};
const detail = {
  ...row, version: row.updatedAt, adminTags: ['vip'], adminNotes: [],
  summary: { differentProducts: 1, totalUnits: 2, subtotal: 80000 },
  items: [{
    stored: { productId: '64b000000000000000000001', title: 'Vestido', image: '', price: 40000, qty: 2, variantKey: '4__royalblue', variantLabel: '4 / Azul rey', variantAttributes: [] },
    current: { valid: true, title: 'Vestido', image: '', price: 40000, sku: 'VEST-4-RB', availableStock: 5 },
    alerts: [],
  }],
  recovery: { attempts: [], attemptsCount: 0, emailAvailable: false, emailUnavailableReason: 'Correo no configurado.' },
};

describe('supervision administrativa profesional de carritos', () => {
  beforeEach(() => {
    state.auth = { isAuthenticated: true, adminToken: 'valid', authLoading: false };
    state.permissions = new Set(['carts:view', 'carts:export', 'carts:recover', 'carts:delete']);
    Object.values(state.api).forEach((mock) => mock.mockReset());
    Object.values(state.toast).forEach((mock) => mock.mockReset());
    state.api.list.mockResolvedValue({ data: { data: [row], total: 1, totalPages: 1 } });
    state.api.summary.mockResolvedValue({ data: { cartsWithProducts: 1, active: 0, abandoned: 1, recoverable: 1, abandonedValue: 80000, averageCartValue: 80000 } });
    state.api.detail.mockResolvedValue({ data: detail });
  });
  afterEach(() => cleanup());

  it('carga indicadores globales y tabla operativa', async () => {
    render(<CarritosAdmin />);
    expect(await screen.findByText('Ana')).toBeInTheDocument();
    expect(screen.getByText('Valor abandonado')).toBeInTheDocument();
    expect(state.api.list).toHaveBeenCalled();
    expect(state.api.summary).toHaveBeenCalled();
  });

  it('aplica vistas rapidas conservando el contrato de filtros', async () => {
    render(<CarritosAdmin />);
    await screen.findByText('Ana');
    fireEvent.click(screen.getByRole('button', { name: 'Activos' }));
    await waitFor(() => expect(state.api.list).toHaveBeenLastCalledWith(expect.objectContaining({ view: 'active' })));
  });

  it('muestra estado vacio controlado', async () => {
    state.api.list.mockResolvedValue({ data: { data: [], total: 0, totalPages: 1 } });
    render(<CarritosAdmin />);
    expect(await screen.findByText('No hay carritos para estos filtros.')).toBeInTheDocument();
  });

  it('muestra error y reintento cuando falla la carga', async () => {
    state.api.list.mockRejectedValue(new Error('offline'));
    render(<CarritosAdmin />);
    expect(await screen.findByRole('alert')).toHaveTextContent('No fue posible cargar');
    expect(screen.getByRole('button', { name: 'Reintentar listado' })).toBeInTheDocument();
  });

  it('mantiene el listado cuando falla solamente el resumen', async () => {
    state.api.summary.mockRejectedValue(new Error('summary unavailable'));
    render(<CarritosAdmin />);
    expect(await screen.findByText('Ana')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('resumen');
    expect(screen.getAllByText('—')).toHaveLength(6);
  });

  it('mantiene el resumen cuando falla solamente el listado', async () => {
    state.api.list.mockRejectedValue(new Error('list unavailable'));
    render(<CarritosAdmin />);
    expect(await screen.findByRole('alert')).toHaveTextContent('listado');
    expect(screen.getAllByText('80.000', { exact: false })).toHaveLength(2);
  });

  it('abre un detalle amplio con variante canonica y disponibilidad', async () => {
    render(<CarritosAdmin />);
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir detalle' }));
    expect(await screen.findByRole('dialog')).toHaveTextContent('4__royalblue');
    expect(screen.getByRole('dialog')).toHaveTextContent('Disponible: 5');
  });

  it('un conflicto 409 recarga y obliga a revisar antes de reintentar', async () => {
    state.api.updateItems.mockRejectedValue({ response: { status: 409 } });
    render(<CarritosAdmin />);
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir detalle' }));
    const plus = await screen.findByRole('button', { name: '+' });
    fireEvent.click(plus);
    await waitFor(() => expect(state.api.detail).toHaveBeenCalledTimes(2));
    expect(state.toast.warning).toHaveBeenCalled();
    expect(state.api.updateItems).toHaveBeenCalledTimes(1);
  });

  it('respeta permisos de exportacion, recuperacion y eliminacion', async () => {
    state.permissions = new Set(['carts:view']);
    render(<CarritosAdmin />);
    expect(await screen.findByText('Ana')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Exportar/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir detalle' }));
    expect(await screen.findByRole('dialog')).not.toHaveTextContent('Acciones destructivas');
  });

  it('deshabilita correo cuando no existe configuracion', async () => {
    render(<CarritosAdmin />);
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir detalle' }));
    expect(await screen.findByRole('button', { name: 'Enviar correo' })).toBeDisabled();
    expect(screen.getByText('Correo no configurado.')).toBeInTheDocument();
  });

  it('no registra respuestas ni datos sensibles en consola', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
    render(<CarritosAdmin />);
    await screen.findByText('Ana');
    expect(log).not.toHaveBeenCalled();
    expect(debug).not.toHaveBeenCalled();
    log.mockRestore();
    debug.mockRestore();
  });
});
