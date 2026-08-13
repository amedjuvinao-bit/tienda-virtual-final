import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import OrdersQuickViews from './OrdersQuickViews';
import OrdersTable from './OrdersTable';

const ORDER = {
  _id: 'order-operations-1',
  orderNumber: 'ORD-OPS-001',
  status: 'paid',
  total: 480000,
  subtotal: 450000,
  createdAt: '2026-08-13T12:00:00.000Z',
  updatedAt: '2026-08-13T15:00:00.000Z',
  customer: {
    name: 'Ana',
    lastname: 'Martínez',
    email: 'ana@example.com',
  },
  branchSnapshot: { name: 'Sede Principal', code: 'PRINCIPAL' },
  totalItems: 3,
  itemsCount: 2,
  tags: ['vip', 'urgente'],
  operational: {
    queue: 'sla_risk',
    urgency: 'critical',
    nextAction: 'Atender SLA vencido',
    shipmentCount: 1,
    openIncidentCount: 1,
    progress: 48,
    sla: {
      state: 'breached',
      remainingMs: -7200000,
    },
  },
};

const tableProps = {
  ADMIN_BORDER: '#fbcfe8',
  loading: false,
  selectedIds: new Set(),
  selectionEnabled: false,
  toggleSelectAllVisible: vi.fn(),
  toggleOne: vi.fn(),
  isSelected: () => false,
  toggleSort: vi.fn(),
  sortAria: () => 'none',
  sortIcon: () => '↕',
  fmtDate: () => '13/08/26, 12:00',
  toCOP: (value) => `$ ${Number(value).toLocaleString('es-CO')}`,
  statusBadgeClasses: () => 'status-test',
};

describe('centro operativo avanzado de órdenes', () => {
  afterEach(() => cleanup());

  it('presenta contadores operativos y aplica una cola sin usar panel flotante', () => {
    const onApplyQuickView = vi.fn();
    render(
      <OrdersQuickViews
        quickView="all"
        onApplyQuickView={onApplyQuickView}
        operationalSummary={{
          total: 28,
          attention: 4,
          awaitingPayment: 6,
          prepare: 8,
          dispatch: 2,
          transit: 3,
          incidents: 1,
          slaRisk: 2,
          completed: 9,
        }}
      />
    );

    expect(
      screen.getByRole('region', { name: 'Centro de operaciones de órdenes' })
    ).toBeInTheDocument();
    expect(screen.getByText('Flujo operativo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Todas · 28/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Cola operativa' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Preparar · 8/i }));
    expect(onApplyQuickView).toHaveBeenCalledWith('prepare');
  });

  it('muestra prioridad, siguiente acción, progreso, SLA y sede en cada orden', () => {
    const openOrderDetail = vi.fn();
    render(
      <OrdersTable
        {...tableProps}
        data={[ORDER]}
        openOrderDetail={openOrderDetail}
      />
    );

    expect(screen.getByText('#ORD-OPS-001')).toBeInTheDocument();
    expect(screen.getByText('Ana Martínez')).toBeInTheDocument();
    expect(screen.getByText('Atender SLA vencido')).toBeInTheDocument();
    expect(screen.getByText('Vencido hace 2 h')).toBeInTheDocument();
    expect(screen.getByText(/1 envío\(s\) · 48%/i)).toBeInTheDocument();
    expect(screen.getByText('PRINCIPAL')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Gestionar/i }));
    expect(openOrderDetail).toHaveBeenCalledWith(ORDER);
  });

  it('permite alternar entre lectura cómoda y compacta', () => {
    render(
      <OrdersTable
        {...tableProps}
        data={[ORDER]}
        openOrderDetail={vi.fn()}
      />
    );

    const comfortable = screen.getByRole('button', { name: 'Vista cómoda' });
    const compact = screen.getByRole('button', { name: 'Vista compacta' });
    expect(comfortable).toHaveAttribute('aria-pressed', 'true');
    expect(compact).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(compact);
    expect(compact).toHaveAttribute('aria-pressed', 'true');
    expect(comfortable).toHaveAttribute('aria-pressed', 'false');
  });

  it('permite ocultar y volver a mostrar la consola lateral desde el listado', () => {
    const onToggleControls = vi.fn();
    const { rerender } = render(
      <OrdersTable
        {...tableProps}
        data={[ORDER]}
        openOrderDetail={vi.fn()}
        controlsOpen
        onToggleControls={onToggleControls}
      />
    );

    const hideButton = screen.getByRole('button', { name: 'Ocultar panel de filtros' });
    expect(hideButton).toHaveAttribute('aria-expanded', 'true');
    expect(hideButton).toHaveAttribute('aria-controls', 'orders-control-panel');
    expect(hideButton).toHaveClass('orders-control-toggle');
    fireEvent.click(hideButton);
    expect(onToggleControls).toHaveBeenCalledTimes(1);

    rerender(
      <OrdersTable
        {...tableProps}
        data={[ORDER]}
        openOrderDetail={vi.fn()}
        controlsOpen={false}
        onToggleControls={onToggleControls}
      />
    );

    expect(
      screen.getByRole('button', { name: 'Mostrar panel de filtros' })
    ).toHaveAttribute('aria-expanded', 'false');
  });

  it('usa una tabla semántica en escritorio y conserva la acción dentro de la fila responsive', () => {
    render(
      <OrdersTable
        {...tableProps}
        total={1}
        from={1}
        to={1}
        data={[ORDER]}
        openOrderDetail={vi.fn()}
      />
    );

    expect(screen.getByRole('table', { name: 'Órdenes operativas' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Orden y cliente/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Gestionar/i })).toBeInTheDocument();
    expect(screen.getByText('1 total · 1–1')).toBeInTheDocument();
  });

  it('explica el estado vacío de la cola seleccionada', () => {
    render(
      <OrdersTable
        {...tableProps}
        data={[]}
        openOrderDetail={vi.fn()}
      />
    );

    expect(screen.getByText('No hay órdenes para esta cola')).toBeInTheDocument();
    expect(
      screen.getByText('Cambia la vista operativa o restablece los filtros.')
    ).toBeInTheDocument();
  });
});
