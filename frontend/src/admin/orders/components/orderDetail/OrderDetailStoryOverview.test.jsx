import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import OrderDetailStoryOverview, { buildOrderStory } from './OrderDetailStoryOverview';
import OrderDetailManagementDisclosure from './OrderDetailManagementDisclosure';
import OrderDetailSummaryRail from './OrderDetailSummaryRail';

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
    expect(screen.getByRole('list', { name: 'Recorrido cronológico de la orden' })).toBeInTheDocument();
    expect(screen.getByText('Proceso completado')).toBeInTheDocument();
    expect(screen.getByText('Venta física completada en sede')).toBeInTheDocument();
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

describe('resumen lateral simplificado', () => {
  it('oculta la gestión por defecto y abrevia el CUFE sin perder el valor completo', () => {
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

    render(
      <>
        <OrderDetailManagementDisclosure>
          <div>Controles administrativos</div>
        </OrderDetailManagementDisclosure>
        <OrderDetailSummaryRail order={order} />
      </>
    );

    const manageSummary = screen.getByText('Gestionar orden').closest('summary');
    expect(manageSummary?.parentElement).not.toHaveAttribute('open');
    expect(screen.getByText('Pago y facturación')).toBeInTheDocument();
    expect(screen.getByText('751f0cb56df7…200c4662')).toHaveAttribute('title', cufe);
    expect(screen.getByRole('button', { name: 'Copiar CUFE' })).toHaveAttribute('title', cufe);
    expect(screen.queryByText('Progreso del pedido')).not.toBeInTheDocument();
    expect(screen.queryByText(`#${order.orderNumber}`)).not.toBeInTheDocument();
  });
});
