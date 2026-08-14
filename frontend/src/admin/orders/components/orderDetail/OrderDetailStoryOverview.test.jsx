import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import OrderDetailStoryOverview, { buildOrderStory } from './OrderDetailStoryOverview';
import OrderDetailSummaryRail from './OrderDetailSummaryRail';
import OrderDetailTabs from './OrderDetailTabs';

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
});

describe('pestañas del detalle', () => {
  function TabsHarness() {
    const tabs = [
      { id: 'summary', label: 'Resumen' },
      { id: 'products', label: 'Productos' },
      { id: 'operation', label: 'Operación' },
      { id: 'payment', label: 'Pago y factura' },
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
});
