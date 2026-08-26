import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import OrderDetailStoryOverview, {
  buildOrderOverview,
  buildOrderStory,
} from './OrderDetailStoryOverview';
import OrderDetailPaymentPanel from './OrderDetailPaymentPanel';
import OrderDetailSummaryRail from './OrderDetailSummaryRail';
import OrderDetailHeader from './OrderDetailHeader';
import OrderDetailTabs from './OrderDetailTabs';
import OrderDetailProfessionalView from './OrderDetailProfessionalView';

const BASE_ORDER = {
  _id: 'order-story-001',
  orderNumber: 'ORD-STORY-001',
  createdAt: '2026-08-14T14:00:00.000Z',
  source: 'online',
  total: 200000,
  subtotal: 200000,
  items: [
    {
      title: 'Producto de prueba',
      quantity: 1,
      price: 200000,
      productType: 'physical',
      requiresShipping: true,
    },
  ],
  branchSnapshot: { name: 'Sede Principal', code: 'PRINCIPAL' },
  createdByAdminSnapshot: {
    displayName: 'Administradora',
    role: 'owner',
  },
};

afterEach(() => cleanup());

describe('historia narrativa del detalle de la orden', () => {
  it('presenta una orden POS entregada como proceso completado sin hitos falsamente pendientes', () => {
    const order = {
      ...BASE_ORDER,
      source: 'pos',
      saleType: 'pos_sale',
      status: 'delivered',
      pos: { confirmedAt: '2026-08-14T14:02:00.000Z' },
      payment: {
        status: 'paid',
        paidAt: '2026-08-14T14:02:00.000Z',
      },
      electronicInvoice: {
        invoiceNumber: 'FE-1002',
        cufe: 'cufe-validado-1002',
        status: 'validated',
        validatedAt: '2026-08-14T14:03:00.000Z',
      },
      fulfillment: { status: 'delivered', shipments: [] },
    };

    const story = buildOrderStory(order);
    expect(story.current.title).toBe('Proceso completado');
    expect(story.next.title).toBe('Sin operación pendiente');
    expect(story.phases.every((phase) => phase.state === 'complete')).toBe(true);

    render(<OrderDetailStoryOverview order={order} />);
    expect(screen.getByText('Qué pasó')).toBeInTheDocument();
    expect(screen.getByText('Estado actual')).toBeInTheDocument();
    expect(screen.getByText('Qué sigue')).toBeInTheDocument();
    expect(screen.getByText('Proceso completado')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Recorrido cronológico de la orden' })).not.toBeInTheDocument();
    expect(screen.queryByText('Paso 5 de 5')).not.toBeInTheDocument();
  });

  it('detiene la historia en pago cuando la transacción sigue pendiente', () => {
    const story = buildOrderStory({
      ...BASE_ORDER,
      status: 'pending',
      payment: { status: 'pending_gateway' },
      fulfillment: { status: 'pending', shipments: [] },
    });

    expect(story.phases.map((phase) => phase.state)).toEqual([
      'complete',
      'current',
      'pending',
      'pending',
      'pending',
    ]);
    expect(story.current.title).toBe('Pago pendiente');
    expect(story.next.title).toBe('Confirmar el pago');
  });

  it('cierra la historia del reembolso cuando todas las etapas están conciliadas', () => {
    const order = {
      ...BASE_ORDER,
      status: 'refunded',
      payment: { status: 'paid', paidAt: '2026-08-14T14:02:00.000Z' },
    };
    const refunds = [
      {
        _id: 'refund-complete-1',
        reconciliation: {
          state: 'completed',
          inventory: { state: 'completed' },
          payment: { state: 'completed' },
          cash: { state: 'not_required' },
          billing: { state: 'completed' },
        },
      },
    ];

    const story = buildOrderStory(order, refunds);
    expect(story.next).toMatchObject({
      title: 'Conciliación completada',
      actionLabel: 'Ver trazabilidad',
      tone: 'success',
    });

    render(<OrderDetailStoryOverview order={order} refunds={refunds} />);
    expect(screen.getAllByText('Conciliación completada')).toHaveLength(2);
    expect(screen.getAllByText(/no hay acciones pendientes/i)).toHaveLength(2);
    expect(screen.queryByText('Confirmar conciliación final')).not.toBeInTheDocument();
  });

  it('mantiene pendiente la conciliación si falta cerrar una etapa del reembolso', () => {
    const story = buildOrderStory(
      { ...BASE_ORDER, status: 'refunded' },
      [
        {
          reconciliation: {
            state: 'action_required',
            inventory: { state: 'completed' },
            payment: { state: 'completed' },
            cash: { state: 'not_required' },
            billing: { state: 'action_required' },
          },
        },
      ]
    );

    expect(story.next.title).toBe('Confirmar conciliación final');
  });

  it('aprovecha el resumen con situación, movimientos y una acción navegable', () => {
    const onNavigate = vi.fn();
    const order = {
      ...BASE_ORDER,
      status: 'pending',
      payment: { status: 'pending_gateway' },
      inventoryAllocations: [
        {
          reservedQuantity: 1,
          reservedAt: '2026-08-14T14:01:00.000Z',
          branchSnapshot: { name: 'Sede Principal', code: 'PRINCIPAL' },
        },
      ],
      fulfillment: { status: 'pending', shipments: [] },
    };
    const overview = buildOrderOverview(order);

    expect(overview.situation.map((item) => item.id)).toEqual([
      'order',
      'payment',
      'inventory',
      'preparation',
    ]);
    expect(overview.situation.find((item) => item.id === 'inventory')?.value).toBe(
      'Reservado en Sede Principal'
    );
    expect(overview.action).toMatchObject({
      label: 'Revisar pago',
      targetTab: 'payment',
    });

    render(<OrderDetailStoryOverview order={order} onNavigate={onNavigate} />);
    expect(screen.getByText('Situación de la orden')).toBeInTheDocument();
    expect(screen.getByText('Últimos movimientos')).toBeInTheDocument();
    expect(screen.getByText('Acción recomendada')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Revisar pago' }));
    expect(onNavigate).toHaveBeenCalledWith('payment');
  });

  it('indica preparar logística cuando hay pago e inventario vendido pero aún no existe envío', () => {
    const story = buildOrderStory({
      ...BASE_ORDER,
      status: 'paid',
      payment: { status: 'paid', paidAt: '2026-08-14T14:02:00.000Z' },
      inventoryAllocations: [
        {
          soldQuantity: 1,
          returnedQuantity: 0,
          soldAt: '2026-08-14T14:03:00.000Z',
        },
      ],
      fulfillment: {
        status: 'pending',
        shipments: [],
        logisticsSummary: { status: 'not_initialized' },
      },
    });

    expect(story.next.title).toBe('Preparar logística');
    expect(story.phases.find((phase) => phase.id === 'operation')?.state).toBe('current');
  });

  it('trata el cambio RMA de cero pesos como reposición sin nueva factura', () => {
    const order = {
      ...BASE_ORDER,
      sessionId: 'exchange:return-001',
      source: 'system',
      channel: 'system',
      saleType: 'system_order',
      status: 'paid',
      total: 0,
      subtotal: 0,
      tags: ['exchange'],
      payment: {
        status: 'paid',
        method: 'exchange',
        methodLabel: 'Cambio sin cobro',
        reference: 'RMA-ORD-STORY-001-ABC123',
        paidAt: '2026-08-14T14:02:00.000Z',
      },
      inventoryAllocations: [
        {
          reservedQuantity: 1,
          reservedAt: '2026-08-14T14:03:00.000Z',
        },
      ],
      fulfillment: { status: 'pending', shipments: [] },
    };

    const story = buildOrderStory(order);
    const invoicePhase = story.phases.find((phase) => phase.id === 'invoice');

    expect(invoicePhase).toMatchObject({
      title: 'No requiere una nueva factura',
      state: 'skipped',
    });
    expect(story.phases.find((phase) => phase.id === 'payment')?.title).toBe(
      'Cambio sin cobro confirmado'
    );
    expect(story.next.title).toBe('Preparar logística');

    render(
      <OrderDetailHeader
        order={order}
        onClose={vi.fn()}
        onOpenInvoice={vi.fn()}
      />
    );
    expect(screen.getAllByText(/CAMBIO RMA/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Sin cobro · RMA-ORD-STORY-001-ABC123/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Factura' })).not.toBeInTheDocument();
  });

  it('orienta a confirmar entrega cuando el envío ya está en tránsito', () => {
    const story = buildOrderStory({
      ...BASE_ORDER,
      status: 'shipped',
      payment: { status: 'paid', paidAt: '2026-08-14T14:02:00.000Z' },
      electronicInvoice: {
        invoiceNumber: 'FE-1003',
        status: 'validated',
      },
      fulfillment: {
        status: 'processing',
        shipments: [
          {
            code: 'SHP-1003',
            status: 'in_transit',
            dispatchedAt: '2026-08-14T16:00:00.000Z',
            inTransitAt: '2026-08-14T17:00:00.000Z',
          },
        ],
        logisticsSummary: { status: 'dispatched' },
      },
    });

    expect(story.next.title).toBe('Confirmar la entrega');
    expect(story.phases.find((phase) => phase.id === 'delivery')?.state).toBe('current');
  });
});

describe('resumen decorativo original', () => {
  it('conserva total, pago, factura, CUFE, progreso y datos rápidos', () => {
    const cufe = '751f0cb56df79970f4f1f0e03ada10b68e9a856a079d126124b118abd2102405457bcc0f09485a78e710a859200c4662';
    const order = {
      ...BASE_ORDER,
      status: 'delivered',
      payment: { status: 'paid', provider: 'Simulación interna' },
      electronicInvoice: {
        invoiceNumber: 'FE000022',
        cufe,
        status: 'validated',
      },
    };

    render(<OrderDetailSummaryRail order={order} />);

    expect(screen.getByText('Resumen del pedido')).toBeInTheDocument();
    expect(screen.getByText('Progreso del pedido')).toBeInTheDocument();
    expect(screen.getByText(cufe)).toHaveAttribute('title', cufe);
    expect(screen.getByText(`#${order.orderNumber}`)).toBeInTheDocument();
    expect(screen.getByText('Datos rápidos')).toBeInTheDocument();
  });

  it('muestra que la factura no aplica en una reposición RMA sin cobro', () => {
    render(
      <OrderDetailSummaryRail
        order={{
          ...BASE_ORDER,
          sessionId: 'exchange:return-002',
          source: 'system',
          saleType: 'system_order',
          status: 'paid',
          total: 0,
          subtotal: 0,
          tags: ['exchange'],
          payment: {
            status: 'paid',
            method: 'exchange',
            reference: 'RMA-ORD-STORY-002-ABC123',
          },
        }}
      />
    );

    expect(screen.getByText('No aplica')).toBeInTheDocument();
    expect(screen.getByText('Venta original')).toBeInTheDocument();
    expect(screen.getByText('Sin cobro')).toBeInTheDocument();
  });

  it('reemplaza el estado técnico paid por Sin cobro en el panel de pago RMA', () => {
    render(
      <OrderDetailPaymentPanel
        order={{
          ...BASE_ORDER,
          sessionId: 'exchange:return-003',
          source: 'system',
          saleType: 'system_order',
          status: 'paid',
          total: 0,
          subtotal: 0,
          tags: ['exchange'],
          payment: {
            status: 'paid',
            method: 'exchange',
            methodLabel: 'Cambio sin cobro',
            providerLabel: 'Cambio RMA',
            reference: 'RMA-ORD-STORY-003-ABC123',
          },
        }}
      />
    );

    expect(screen.getByText('Sin cobro')).toBeInTheDocument();
    expect(screen.queryByText('paid')).not.toBeInTheDocument();
  });

  it('separa el saldo a favor del remanente pagado por Wompi', () => {
    render(
      <OrderDetailPaymentPanel
        order={{
          ...BASE_ORDER,
          total: 100000,
          payment: {
            status: 'paid',
            provider: 'wompi',
            providerLabel: 'Wompi',
            currency: 'COP',
            method: 'mixed',
            methodLabel: 'Saldo a favor + Wompi',
            amount: 40000,
            splitPayments: [
              {
                method: 'store_credit',
                methodLabel: 'Saldo a favor',
                amount: 60000,
              },
              { method: 'wompi', methodLabel: 'Wompi', amount: 40000 },
            ],
          },
          storeCredit: {
            applied: true,
            amount: 60000,
            currency: 'COP',
            status: 'consumed',
            references: ['SC-CHECKOUT-001'],
          },
        }}
      />
    );

    expect(screen.getByText('Composición del pago')).toBeInTheDocument();
    expect(screen.getByText('Saldo a favor · Aplicado')).toBeInTheDocument();
    expect(screen.getByText('Saldo utilizado:')).toBeInTheDocument();
    expect(screen.getByText('SC-CHECKOUT-001')).toBeInTheDocument();
    expect(screen.getAllByText('Wompi').length).toBeGreaterThan(0);
  });
});

describe('pestañas del detalle', () => {
  function TabsHarness() {
    const tabs = [
      { id: 'summary', label: 'Resumen' },
      { id: 'products', label: 'Pedido' },
      { id: 'operation', label: 'Operación' },
      { id: 'payment', label: 'Pago y factura' },
      { id: 'customer', label: 'Cliente e historial' },
    ];
    const [activeTab, setActiveTab] = useState('summary');

    return (
      <>
        <OrderDetailTabs
          tabs={tabs}
          activeTab={activeTab}
          onChange={setActiveTab}
        />
        <div data-testid="active-tab">{activeTab}</div>
      </>
    );
  }

  it('separa el contenido y permite navegar con clic y teclado', () => {
    render(<TabsHarness />);

    const summary = screen.getByRole('tab', { name: 'Resumen' });
    const operation = screen.getByRole('tab', { name: 'Operación' });
    expect(summary).toHaveAttribute('aria-selected', 'true');

    fireEvent.click(operation);
    expect(operation).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('active-tab')).toHaveTextContent('operation');

    fireEvent.keyDown(operation, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Pago y factura' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  it('mantiene Gestionar como acción independiente y deja visible todo el encabezado', () => {
    render(
      <OrderDetailProfessionalView
        order={{
          ...BASE_ORDER,
          status: 'pending',
          payment: { status: 'pending_gateway' },
          fulfillment: { status: 'pending', shipments: [] },
        }}
        onClose={vi.fn()}
        statusLocal="pending"
        setStatusLocal={vi.fn()}
        onSaveStatus={vi.fn()}
      />
    );

    expect(screen.queryByRole('tab', { name: 'Gestionar' })).not.toBeInTheDocument();
    expect(screen.getByRole('banner')).toHaveStyle({ flex: '0 0 auto' });

    fireEvent.click(screen.getByRole('button', { name: 'Gestionar' }));
    expect(screen.getByRole('heading', { name: 'Gestionar orden' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cerrar gestión' })).toBeInTheDocument();
  });
});
