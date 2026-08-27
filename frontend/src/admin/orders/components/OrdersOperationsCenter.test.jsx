import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import OrdersFilters from './OrdersFilters';
import OrdersQuickViews from './OrdersQuickViews';
import OrdersTable from './OrdersTable';
import {
  buildOrdersFilterMetrics,
  mergeStatusFilters,
} from './ordersFiltersModel';

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

function buildFiltersProps(overrides = {}) {
  return {
    ADMIN_BORDER: '#fbcfe8',
    STATUS_FILTERS: [{ key: 'paid', label: 'Pagadas del comercio' }],
    branchId: 'branch-main',
    branches: [{ _id: 'branch-main', name: 'Sede Principal', code: 'bog' }],
    canExport: true,
    clearStatus: vi.fn(),
    controlsOpen: true,
    dateFrom: '2026-08-01',
    dateTo: '2026-08-31',
    exportCsv: vi.fn(),
    financialSummary: {
      averageTicket: 120000,
      pendingOrders: 2,
      totalOrders: 12,
      totalSales: 1440000,
      validatedDianOrders: 8,
      withoutInvoiceOrders: 4,
    },
    loading: false,
    onCloseControls: vi.fn(),
    populate: false,
    setBranchId: vi.fn(),
    setDateFrom: vi.fn(),
    setDateTo: vi.fn(),
    setPage: vi.fn(),
    setPopulate: vi.fn(),
    setTagsMode: vi.fn(),
    setTagsStr: vi.fn(),
    setTypingQ: vi.fn(),
    statusFilter: ['paid'],
    tagsMode: 'any',
    tagsStr: 'vip',
    toggleStatus: vi.fn(),
    total: 12,
    typingQ: 'ana',
    ...overrides,
  };
}

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
    const slaRisk = screen.getByRole('button', { name: /Riesgo SLA · 2/i });
    expect(slaRisk).toHaveAttribute('title', 'Riesgo SLA · 2');
    expect(slaRisk).toHaveAttribute('aria-describedby', 'orders-queue-riesgo-sla-tooltip');
    expect(screen.getByRole('tooltip', { name: 'Riesgo SLA · 2' })).toBeInTheDocument();

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

  it('identifica una reposición RMA de cero pesos como cambio sin cobro', () => {
    render(
      <OrdersTable
        {...tableProps}
        data={[
          {
            ...ORDER,
            _id: 'exchange-order-1',
            orderNumber: '000239',
            sessionId: 'exchange:return-239',
            source: 'system',
            saleType: 'system_order',
            total: 0,
            tags: ['exchange'],
            payment: { status: 'paid', method: 'exchange' },
          },
        ]}
        openOrderDetail={vi.fn()}
      />
    );

    expect(screen.getByText('Cambio sin cobro')).toBeInTheDocument();
    expect(screen.getByText(/Cambio RMA/i)).toBeInTheDocument();
    expect(screen.queryByText('Pagada')).not.toBeInTheDocument();
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

describe('composición profesional de filtros de órdenes', () => {
  afterEach(() => cleanup());

  it('conserva el DOM, las opciones obligatorias y las métricas del panel original', () => {
    const { container } = render(
      <OrdersFilters {...buildFiltersProps()}>
        <div data-testid="orders-filter-child">Operación</div>
      </OrdersFilters>
    );

    expect(container.querySelectorAll('.orf-card-metric')).toHaveLength(6);
    expect(screen.getByRole('complementary', { name: 'Filtros y estados de órdenes' }))
      .toHaveAttribute('id', 'orders-control-panel');
    expect(screen.getByText('Reembolsadas')).toBeInTheDocument();
    expect(screen.getByText('Sede Principal (BOG)')).toBeInTheDocument();
    expect(screen.getByTestId('orders-filter-child')).toBeInTheDocument();

    const labels = Array.from(
      container.querySelectorAll('.orf-filters > div > label')
    ).map((label) => label.textContent);
    expect(labels).toEqual([
      'Buscar',
      'Desde',
      'Hasta',
      'Estado',
      'Sede',
      'Datos',
      'Limpiar',
      'Tags',
      'Modo tags',
    ]);
  });

  it('mantiene la semántica de búsqueda, estado, sede, vista, tags y limpieza', () => {
    const props = buildFiltersProps();
    const { container } = render(<OrdersFilters {...props} />);

    fireEvent.change(
      screen.getByPlaceholderText('Buscar orden, cliente o email...'),
      { target: { value: 'orden nueva' } }
    );
    expect(props.setTypingQ).toHaveBeenCalledWith('orden nueva');

    const selects = container.querySelectorAll('.orf-filters select');
    fireEvent.change(selects[0], { target: { value: 'refunded' } });
    expect(props.clearStatus).toHaveBeenCalledTimes(1);
    expect(props.toggleStatus).toHaveBeenCalledWith('refunded');

    fireEvent.change(selects[1], { target: { value: '' } });
    expect(props.setBranchId).toHaveBeenCalledWith('');

    fireEvent.click(screen.getByRole('button', { name: 'Full' }));
    expect(props.setPopulate).toHaveBeenCalledWith(true);

    fireEvent.change(screen.getByPlaceholderText('vip, urgente, mayorista...'), {
      target: { value: 'mayorista' },
    });
    expect(props.setTagsStr).toHaveBeenCalledWith('mayorista');

    fireEvent.change(selects[2], { target: { value: 'all' } });
    expect(props.setTagsMode).toHaveBeenCalledWith('all');

    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    expect(props.setTypingQ).toHaveBeenLastCalledWith('');
    expect(props.setDateFrom).toHaveBeenCalledWith('');
    expect(props.setDateTo).toHaveBeenCalledWith('');
    expect(props.setTagsStr).toHaveBeenLastCalledWith('');
    expect(props.setTagsMode).toHaveBeenLastCalledWith('any');
    expect(props.setBranchId).toHaveBeenLastCalledWith('');
    expect(props.clearStatus).toHaveBeenCalledTimes(2);
    expect(props.setPage).toHaveBeenCalledWith(1);
  });

  it('preserva el contrato de orden, extensibilidad y fallbacks del modelo', () => {
    expect(mergeStatusFilters([
      { key: 'custom', label: 'Personalizado' },
      { key: 'paid', label: 'Pago confirmado' },
    ])).toEqual([
      { key: 'pending', label: 'Pendientes' },
      { key: 'processing', label: 'Procesando' },
      { key: 'paid', label: 'Pago confirmado' },
      { key: 'failed', label: 'Fallidas' },
      { key: 'shipped', label: 'Enviadas' },
      { key: 'delivered', label: 'Entregadas' },
      { key: 'cancelled', label: 'Canceladas' },
      { key: 'refunded', label: 'Reembolsadas' },
      { key: 'custom', label: 'Personalizado' },
    ]);

    const metrics = buildOrdersFilterMetrics({
      ordersWithoutInvoice: 3,
      validatedInvoiceOrders: 7,
    }, 11);
    expect(metrics.map(({ key }) => key)).toEqual([
      'total', 'sales', 'ticket', 'pending', 'noinv', 'dian',
    ]);
    expect(metrics.find(({ key }) => key === 'noinv')?.value).toBe('3');
    expect(metrics.find(({ key }) => key === 'dian')?.value).toBe('7');
  });
});
