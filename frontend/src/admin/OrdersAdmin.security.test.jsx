import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  auth: {
    isAuthenticated: false,
    adminToken: null,
    authLoading: false,
  },
  permissions: new Set(),
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => state.auth,
}));

vi.mock('./security/useAdminPermissions', () => ({
  default: () => ({
    can: (permission) => state.permissions.has(permission),
  }),
}));

vi.mock('../lib/api', () => ({ default: state.api }));

vi.mock('./orders/components/OrdersFilters', () => ({
  default: ({ canExport }) => (
    <section>
      <h1>Órdenes</h1>
      {canExport ? <button type="button">Exportar CSV</button> : null}
    </section>
  ),
}));

vi.mock('./orders/components/OrdersTable', () => ({
  default: ({ data, selectionEnabled, openOrderDetail }) => (
    <section>
      {selectionEnabled ? <button type="button">Seleccionar</button> : null}
      {data.map((order) => (
        <button
          type="button"
          key={order._id}
          onClick={() => openOrderDetail(order)}
        >
          Abrir {order.orderNumber}
        </button>
      ))}
    </section>
  ),
}));

vi.mock('./orders/components/OrderDetailModal', () => ({
  default: ({
    open,
    onSaveStatus,
    onSaveTags,
    onTogglePrinted,
    onToggleArchived,
    canAddNotes,
    canSendEmail,
    canUpdateFulfillment,
    canDownloadBilling,
  }) =>
    open ? (
      <section aria-label="Detalle de orden">
        {onSaveStatus ? <button type="button">Cambiar estado</button> : null}
        {onSaveTags ? <button type="button">Editar etiquetas</button> : null}
        {onTogglePrinted ? <button type="button">Marcar impresa</button> : null}
        {onToggleArchived ? <button type="button">Archivar</button> : null}
        {canAddNotes ? <button type="button">Agregar nota</button> : null}
        {canSendEmail ? <button type="button">Enviar email</button> : null}
        {canUpdateFulfillment ? <button type="button">Editar prestación</button> : null}
        {canDownloadBilling ? <button type="button">Descargar PDF</button> : null}
      </section>
    ) : null,
}));

vi.mock('./orders/components/OrdersQuickViews', () => ({
  default: () => null,
}));
vi.mock('./orders/components/OrdersActiveFilters', () => ({
  default: () => null,
}));
vi.mock('./orders/components/OrdersInvoiceFilters', () => ({
  default: () => null,
}));

import OrdersAdmin from './OrdersAdmin';

const ORDER = {
  _id: '64c000000000000000000001',
  orderNumber: 'ORD-SEG-001',
  customer: { name: 'Cliente seguro' },
  total: 150000,
  status: 'paid',
};

function renderOrders() {
  return render(
    <MemoryRouter initialEntries={['/admin/ordenes']}>
      <OrdersAdmin />
    </MemoryRouter>
  );
}

describe('OrdersAdmin con seguridad por sesión y permisos', () => {
  beforeEach(() => {
    state.auth = {
      isAuthenticated: false,
      adminToken: null,
      authLoading: false,
    };
    state.permissions = new Set();
    Object.values(state.api).forEach((mock) => mock.mockReset());
    state.api.get.mockImplementation(async (url) => {
      if (url === '/api/orders/admin') {
        return {
          data: {
            data: [ORDER],
            page: 1,
            total: 1,
            totalPages: 1,
            financialSummary: { totalOrders: 1 },
          },
        };
      }
      if (url === '/api/admin/branches') {
        return { data: { data: [] } };
      }
      if (url === `/api/orders/${ORDER._id}`) {
        return { data: ORDER };
      }
      return { data: {} };
    });
  });

  afterEach(() => cleanup());

  it('sin sesión válida no consulta endpoints administrativos', async () => {
    renderOrders();

    expect(await screen.findByText(/sesión administrativa no es válida/i)).toBeInTheDocument();
    expect(state.api.get).not.toHaveBeenCalled();
    expect(state.api.post).not.toHaveBeenCalled();
    expect(state.api.patch).not.toHaveBeenCalled();
    expect(state.api.put).not.toHaveBeenCalled();
  });

  it('un perfil de solo lectura ve órdenes pero no controles de mutación', async () => {
    state.auth = {
      isAuthenticated: true,
      adminToken: 'header.payload.valid-admin-signature',
      authLoading: false,
    };
    state.permissions = new Set(['orders:view']);

    renderOrders();

    const open = await screen.findByRole('button', { name: 'Abrir ORD-SEG-001' });
    expect(screen.queryByRole('button', { name: 'Exportar CSV' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Seleccionar' })).not.toBeInTheDocument();

    fireEvent.click(open);
    expect(await screen.findByRole('region', { name: 'Detalle de orden' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cambiar estado' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enviar email' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Descargar PDF' })).not.toBeInTheDocument();
    expect(state.api.post).not.toHaveBeenCalled();
    expect(state.api.patch).not.toHaveBeenCalled();
    expect(state.api.put).not.toHaveBeenCalled();
  });

  it('mantiene el botón lateral visible y permite mostrar u ocultar los filtros', async () => {
    state.auth = {
      isAuthenticated: true,
      adminToken: 'header.payload.valid-admin-signature',
      authLoading: false,
    };
    state.permissions = new Set(['orders:view']);

    renderOrders();

    await screen.findByRole('button', { name: 'Abrir ORD-SEG-001' });
    const showFilters = screen.getByRole('button', { name: 'Mostrar panel de filtros' });
    expect(showFilters).toHaveAttribute('aria-expanded', 'false');
    expect(showFilters).toHaveAttribute('aria-controls', 'orders-control-panel');

    fireEvent.click(showFilters);
    const hideFilters = screen.getByRole('button', { name: 'Ocultar panel de filtros' });
    expect(hideFilters).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(hideFilters);
    expect(
      screen.getByRole('button', { name: 'Mostrar panel de filtros' })
    ).toHaveAttribute('aria-expanded', 'false');
  });

  it('expone cada capacidad solamente cuando el rol la posee', async () => {
    state.auth = {
      isAuthenticated: true,
      adminToken: 'header.payload.valid-admin-signature',
      authLoading: false,
    };
    state.permissions = new Set([
      'orders:view',
      'orders:export',
      'orders:bulk',
      'orders:status',
      'orders:tags',
      'orders:mark_printed',
      'orders:archive',
      'orders:notes',
      'orders:email',
      'orders:fulfillment',
      'billing:download',
      'branches:view',
    ]);

    renderOrders();

    expect(await screen.findByRole('button', { name: 'Exportar CSV' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Seleccionar' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir ORD-SEG-001' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Cambiar estado' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Enviar email' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Descargar PDF' })).toBeInTheDocument();
    });
  });
});
