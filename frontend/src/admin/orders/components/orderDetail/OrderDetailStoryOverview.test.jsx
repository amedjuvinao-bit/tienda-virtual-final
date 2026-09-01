import React, { useState } from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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
import { OrderDetailIcons } from './OrderDetailIcons';
import { buildOrderOverview as buildOrderOverviewInternal } from './orderOverviewBuilder';
import { buildOrderStory as buildOrderStoryInternal } from './orderStoryBuilder';
import * as orderStoryViewModel from './orderStoryViewModel';
import { buildOrderSummaryRailModel } from './orderSummaryRailModel';

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

describe('paridad y composición del modelo narrativo', () => {
  const storyCases = [
    {
      name: 'pago fallido',
      order: {
        ...BASE_ORDER,
        status: 'failed',
        payment: {
          status: 'declined',
          paymentDate: '2026-08-14T14:04:00.000Z',
        },
        fulfillment: { status: 'pending', shipments: [] },
      },
      refunds: [],
      expected: {
        titles: [
          'Orden recibida',
          'Pago rechazado o fallido',
          'Facturación aún no iniciada',
          'Preparación pendiente',
          'Entrega no realizada',
        ],
        states: ['complete', 'attention', 'pending', 'skipped', 'skipped'],
        dates: [
          '2026-08-14T14:00:00.000Z',
          '2026-08-14T14:04:00.000Z',
          null,
          null,
          null,
        ],
        current: {
          title: 'Orden fallida',
          description: 'La transacción no completó el recorrido esperado.',
          tone: 'danger',
        },
        next: {
          title: 'Revisar pago y trazabilidad',
          description: 'Valida el motivo del fallo antes de reintentar o cerrar la orden.',
          tone: 'danger',
          targetTab: 'payment',
          actionLabel: 'Revisar pago',
        },
        operationIcon: OrderDetailIcons.PackageCheck,
        isFinal: true,
      },
    },
    {
      name: 'factura rechazada después del pago',
      order: {
        ...BASE_ORDER,
        status: 'paid',
        payment: {
          status: 'approved',
          paidAt: '2026-08-14T14:02:00.000Z',
        },
        electronicInvoice: {
          invoiceNumber: 'FE-REJ-01',
          status: 'rejected',
          issuedAt: '2026-08-14T14:03:00.000Z',
        },
        fulfillment: { status: 'pending', shipments: [] },
      },
      refunds: [],
      expected: {
        titles: [
          'Orden recibida',
          'Pago confirmado',
          'Facturación con novedad',
          'Preparación pendiente',
          'Entrega pendiente',
        ],
        states: ['complete', 'complete', 'attention', 'pending', 'pending'],
        dates: [
          '2026-08-14T14:00:00.000Z',
          '2026-08-14T14:02:00.000Z',
          '2026-08-14T14:03:00.000Z',
          null,
          null,
        ],
        current: {
          title: 'Facturación con novedad',
          description: 'Estado reportado: rejected.',
          tone: 'danger',
        },
        next: {
          title: 'Preparar logística',
          description: 'Crea el envío por sede usando el inventario vendido y confirmado.',
          tone: 'primary',
          targetTab: 'operation',
          actionLabel: 'Preparar logística',
        },
        operationIcon: OrderDetailIcons.PackageCheck,
        isFinal: false,
      },
    },
    {
      name: 'envío físico en tránsito',
      order: {
        ...BASE_ORDER,
        status: 'shipped',
        payment: {
          status: 'paid',
          paidAt: '2026-08-14T14:02:00.000Z',
        },
        electronicInvoice: {
          invoiceNumber: 'FE-TRANSIT-01',
          status: 'validated',
          validatedAt: '2026-08-14T14:03:00.000Z',
        },
        fulfillment: {
          status: 'processing',
          shipments: [
            {
              code: 'SHP-TRANSIT-01',
              status: 'in_transit',
              dispatchedAt: '2026-08-14T15:00:00.000Z',
              inTransitAt: '2026-08-14T16:00:00.000Z',
            },
          ],
        },
      },
      refunds: [],
      expected: {
        titles: [
          'Orden recibida',
          'Pago confirmado',
          'Factura FE-TRANSIT-01',
          'En tránsito',
          'Entrega en curso',
        ],
        states: ['complete', 'complete', 'complete', 'complete', 'current'],
        dates: [
          '2026-08-14T14:00:00.000Z',
          '2026-08-14T14:02:00.000Z',
          '2026-08-14T14:03:00.000Z',
          '2026-08-14T16:00:00.000Z',
          null,
        ],
        current: {
          title: 'Entrega en curso',
          description: 'La orden se encuentra camino al destino final.',
          tone: 'primary',
        },
        next: {
          title: 'Confirmar la entrega',
          description: 'Registra la evidencia del destinatario cuando el envío llegue.',
          tone: 'primary',
          targetTab: 'operation',
          actionLabel: 'Abrir operación',
        },
        operationIcon: OrderDetailIcons.PackageCheck,
        isFinal: false,
      },
    },
    {
      name: 'venta POS entregada',
      order: {
        ...BASE_ORDER,
        source: 'pos',
        saleType: 'pos_sale',
        status: 'delivered',
        deliveredAt: '2026-08-14T14:05:00.000Z',
        pos: { confirmedAt: '2026-08-14T14:02:00.000Z' },
        payment: {
          status: 'paid',
          paidAt: '2026-08-14T14:02:00.000Z',
        },
        electronicInvoice: {
          invoiceNumber: 'FE-POS-01',
          status: 'validated',
          validatedAt: '2026-08-14T14:03:00.000Z',
        },
        fulfillment: { status: 'delivered', shipments: [] },
      },
      refunds: [],
      expected: {
        titles: [
          'Orden recibida',
          'Pago confirmado',
          'Factura FE-POS-01',
          'Venta física completada en sede',
          'Entrega confirmada',
        ],
        states: ['complete', 'complete', 'complete', 'complete', 'complete'],
        dates: [
          '2026-08-14T14:00:00.000Z',
          '2026-08-14T14:02:00.000Z',
          '2026-08-14T14:03:00.000Z',
          '2026-08-14T14:02:00.000Z',
          '2026-08-14T14:05:00.000Z',
        ],
        current: {
          title: 'Proceso completado',
          description: 'Pago, documento fiscal y entrega están registrados.',
          tone: 'success',
        },
        next: {
          title: 'Sin operación pendiente',
          description: 'Puedes consultar PDF, factura, notas o gestionar una devolución.',
          tone: 'success',
          targetTab: 'customer',
          actionLabel: 'Ver historial',
        },
        operationIcon: OrderDetailIcons.PackageCheck,
        isFinal: true,
      },
    },
    {
      name: 'entrega digital y servicio completados',
      order: {
        ...BASE_ORDER,
        status: 'processing',
        items: [
          {
            title: 'Curso digital',
            quantity: 1,
            price: 120000,
            productType: 'digital',
            requiresShipping: false,
          },
          {
            title: 'Consultoría',
            quantity: 1,
            price: 80000,
            productType: 'service',
            requiresShipping: false,
          },
        ],
        payment: {
          status: 'paid',
          paidAt: '2026-08-14T14:02:00.000Z',
        },
        electronicInvoice: {
          invoiceNumber: 'FE-DIGITAL-01',
          status: 'accepted',
          acceptedAt: '2026-08-14T14:03:00.000Z',
        },
        fulfillment: {
          status: 'processing',
          processedAt: '2026-08-14T14:04:00.000Z',
          shipments: [],
          digitalDeliveries: [
            {
              status: 'delivered',
              deliveredAt: '2026-08-14T14:05:00.000Z',
            },
          ],
          services: [
            {
              status: 'completed',
              completedAt: '2026-08-14T14:06:00.000Z',
            },
          ],
        },
      },
      refunds: [],
      expected: {
        titles: [
          'Orden recibida',
          'Pago confirmado',
          'Factura FE-DIGITAL-01',
          'Cumplimiento completado',
          'Entrega confirmada',
        ],
        states: ['complete', 'complete', 'complete', 'complete', 'complete'],
        dates: [
          '2026-08-14T14:00:00.000Z',
          '2026-08-14T14:02:00.000Z',
          '2026-08-14T14:03:00.000Z',
          '2026-08-14T14:04:00.000Z',
          '2026-08-14T14:06:00.000Z',
        ],
        current: {
          title: 'Proceso completado',
          description: 'Pago, documento fiscal y entrega están registrados.',
          tone: 'success',
        },
        next: {
          title: 'Sin operación pendiente',
          description: 'Puedes consultar PDF, factura, notas o gestionar una devolución.',
          tone: 'success',
          targetTab: 'customer',
          actionLabel: 'Ver historial',
        },
        operationIcon: OrderDetailIcons.Zap,
        isFinal: false,
        inventoryValue: 'No requiere inventario físico',
      },
    },
    {
      name: 'reembolso completamente conciliado',
      order: {
        ...BASE_ORDER,
        status: 'refunded',
        payment: {
          status: 'paid',
          paidAt: '2026-08-14T14:02:00.000Z',
        },
        fulfillment: { status: 'pending', shipments: [] },
      },
      refunds: [
        {
          reconciliation: {
            state: 'completed',
            inventory: { state: 'completed' },
            payment: { state: 'completed' },
            cash: { state: 'not_required' },
            billing: { state: 'completed' },
          },
        },
      ],
      expected: {
        titles: [
          'Orden recibida',
          'Pago confirmado',
          'Factura pendiente de emisión o validación',
          'Preparación pendiente',
          'Entrega pendiente',
        ],
        states: ['complete', 'complete', 'current', 'pending', 'pending'],
        dates: [
          '2026-08-14T14:00:00.000Z',
          '2026-08-14T14:02:00.000Z',
          null,
          null,
          null,
        ],
        current: {
          title: 'Orden reembolsada',
          description: 'El ciclo comercial terminó con devolución del dinero.',
          tone: 'warning',
        },
        next: {
          title: 'Conciliación completada',
          description: 'Inventario, dinero y documento fiscal quedaron conciliados; no hay acciones pendientes.',
          tone: 'success',
          targetTab: 'payment',
          actionLabel: 'Ver trazabilidad',
        },
        operationIcon: OrderDetailIcons.PackageCheck,
        isFinal: true,
      },
    },
    {
      name: 'incidencia logística no resuelta',
      order: {
        ...BASE_ORDER,
        status: 'processing',
        payment: {
          status: 'paid',
          paidAt: '2026-08-14T14:02:00.000Z',
        },
        electronicInvoice: {
          invoiceNumber: 'FE-INCIDENT-01',
          status: 'validated',
          validatedAt: '2026-08-14T14:03:00.000Z',
        },
        fulfillment: {
          status: 'processing',
          shipments: [
            {
              code: 'SHP-INCIDENT-01',
              status: 'picking',
              startedAt: '2026-08-14T14:05:00.000Z',
              incidents: [{ code: 'DAMAGED_PACKAGE' }],
            },
          ],
          logisticsSummary: { status: 'exception', exceptionCount: 1 },
        },
      },
      refunds: [],
      expected: {
        titles: [
          'Orden recibida',
          'Pago confirmado',
          'Factura FE-INCIDENT-01',
          'Incidencia logística activa',
          'Entrega pendiente',
        ],
        states: ['complete', 'complete', 'complete', 'attention', 'pending'],
        dates: [
          '2026-08-14T14:00:00.000Z',
          '2026-08-14T14:02:00.000Z',
          '2026-08-14T14:03:00.000Z',
          '2026-08-14T14:05:00.000Z',
          null,
        ],
        current: {
          title: 'Operación con incidencia',
          description: 'Hay una novedad logística que requiere atención administrativa.',
          tone: 'danger',
        },
        next: {
          title: 'Resolver la incidencia',
          description: 'Abre el centro logístico, registra la solución y reanuda el envío.',
          tone: 'danger',
          targetTab: 'operation',
          actionLabel: 'Resolver incidencia',
        },
        operationIcon: OrderDetailIcons.PackageCheck,
        isFinal: false,
      },
    },
  ];

  it('mantiene una fachada mínima con los mismos dos exports públicos', () => {
    const files = [
      ['orderStoryViewModel.js', 120],
      ['orderStoryStateModel.js', 400],
      ['orderStoryBuilder.js', 400],
      ['orderOverviewBuilder.js', 400],
    ];

    files.forEach(([fileName, limit]) => {
      const source = readFileSync(
        resolve(
          process.cwd(),
          'src/admin/orders/components/orderDetail',
          fileName
        ),
        'utf8'
      );
      expect(source.trimEnd().split(/\r?\n/).length).toBeLessThanOrEqual(limit);
    });

    expect(Object.keys(orderStoryViewModel).sort()).toEqual([
      'buildOrderOverview',
      'buildOrderStory',
    ]);
    expect(orderStoryViewModel.buildOrderStory).toBe(buildOrderStoryInternal);
    expect(orderStoryViewModel.buildOrderOverview).toBe(buildOrderOverviewInternal);
  });

  it.each(storyCases)(
    'conserva textos, estados, íconos, fechas y acción para $name',
    ({ order, refunds, expected }) => {
      const story = orderStoryViewModel.buildOrderStory(order, refunds);
      const overview = orderStoryViewModel.buildOrderOverview(order, refunds);

      expect(story.phases.map((phase) => phase.id)).toEqual([
        'received',
        'payment',
        'invoice',
        'operation',
        'delivery',
      ]);
      expect(story.phases.map((phase) => phase.label)).toEqual([
        '01 · Pedido',
        '02 · Pago',
        '03 · Factura',
        '04 · Operación',
        '05 · Entrega',
      ]);
      expect(story.phases.map((phase) => phase.title)).toEqual(expected.titles);
      expect(story.phases.map((phase) => phase.state)).toEqual(expected.states);
      expect(
        story.phases.map((phase) => phase.date?.toISOString() || null)
      ).toEqual(expected.dates);
      expect(story.phases.map((phase) => phase.icon)).toEqual([
        OrderDetailIcons.ShoppingBag,
        OrderDetailIcons.CreditCard,
        OrderDetailIcons.ReceiptText,
        expected.operationIcon,
        OrderDetailIcons.Truck,
      ]);
      expect(story.current).toEqual(expected.current);
      expect(story.next).toEqual(expected.next);
      expect(story.isFinal).toBe(expected.isFinal);
      expect(overview.story).toEqual(story);
      expect(overview.action).toEqual({
        title: expected.next.title,
        description: expected.next.description,
        label: expected.next.actionLabel,
        targetTab: expected.next.targetTab,
        tone: expected.next.tone,
      });

      if (expected.inventoryValue) {
        expect(
          overview.situation.find((item) => item.id === 'inventory')?.value
        ).toBe(expected.inventoryValue);
      }
    }
  );
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

  it('muestra una venta POS pagada y entregada como 100% completada', () => {
    const order = {
      ...BASE_ORDER,
      source: 'pos',
      saleType: 'pos_sale',
      status: 'paid',
      fulfillmentStatus: 'delivered',
      payment: { status: 'paid', method: 'cash' },
    };
    const model = buildOrderSummaryRailModel(order);

    expect(model.progress).toMatchObject({
      kind: 'delivery',
      percent: 100,
      summary: '100% completado',
    });

    render(<OrderDetailSummaryRail order={order} />);
    expect(screen.getByText('100% completado')).toBeInTheDocument();
    expect(screen.queryByText('40% completado')).not.toBeInTheDocument();
  });

  it.each([
    ['refunded', 'Ciclo cerrado por reembolso', 'Reembolso conciliado'],
    ['cancelled', 'Ciclo cerrado por cancelación', 'Orden cancelada'],
  ])(
    'presenta %s como cierre terminal sin simular envío ni entrega',
    (status, summary, title) => {
      const order = { ...BASE_ORDER, status };
      const model = buildOrderSummaryRailModel(order);

      expect(model.progress).toMatchObject({
        kind: 'terminal',
        percent: null,
        summary,
        title,
      });

      render(<OrderDetailSummaryRail order={order} />);
      expect(screen.getByText(summary)).toBeInTheDocument();
      expect(screen.getByText(title)).toBeInTheDocument();
      expect(screen.queryByText(/% completado/i)).not.toBeInTheDocument();
      expect(screen.queryByText('Enviada')).not.toBeInTheDocument();
      expect(screen.queryByText('Entregada')).not.toBeInTheDocument();
    }
  );

  it('explica correctamente un reembolso posterior a la entrega', () => {
    const order = {
      ...BASE_ORDER,
      status: 'refunded',
      fulfillmentStatus: 'delivered',
      fulfillment: {
        logisticsSummary: { status: 'delivered' },
        shipments: [{ status: 'delivered', deliveredAt: '2026-08-29T20:00:00.000Z' }],
      },
    };
    const model = buildOrderSummaryRailModel(order);

    expect(model.progress).toMatchObject({
      kind: 'terminal',
      title: 'Reembolso conciliado',
      description:
        'La venta fue entregada y después se reembolsó; el ciclo comercial quedó conciliado.',
    });
    render(<OrderDetailSummaryRail order={order} />);
    expect(screen.getByText(/La venta fue entregada y después se reembolsó/)).toBeInTheDocument();
    expect(screen.queryByText(/cerró antes de completar la entrega/)).not.toBeInTheDocument();
  });

  it('mantiene el contenedor delgado y módulos cohesivos dentro de sus límites', () => {
    const files = [
      ['OrderDetailSummaryRail.jsx', 220],
      ['OrderDetailSummaryHero.jsx', 350],
      ['OrderDetailSummaryPanels.jsx', 350],
      ['orderSummaryRailModel.js', 350],
    ];

    files.forEach(([fileName, limit]) => {
      const source = readFileSync(
        resolve(
          process.cwd(),
          'src/admin/orders/components/orderDetail',
          fileName
        ),
        'utf8'
      );
      expect(source.trimEnd().split(/\r?\n/).length).toBeLessThanOrEqual(limit);
    });
  });

  it('conserva el cálculo monetario y el orden semántico de los cuatro paneles', () => {
    const order = {
      ...BASE_ORDER,
      status: 'shipped',
      subtotal: 200000,
      shipping: 20000,
      total: 238000,
      pricing: {
        productDiscount: 15000,
        shippingDiscount: 10000,
        originalShipping: 30000,
      },
      coupon: { code: 'PLUS15' },
      taxes: { iva: { amount: 38000, percent: 19 } },
      surcharge: 5000,
      prepayment: 10000,
      payment: { status: 'paid', provider: 'Wompi' },
      electronicInvoice: {
        invoiceNumber: 'FE-PLUS-001',
        cufe: 'CUFE-PLUS-001',
        status: 'validated',
      },
    };
    const model = buildOrderSummaryRailModel(order);

    expect(model.breakdown).toEqual({
      subtotal: 200000,
      discount: 15000,
      shippingDiscount: 10000,
      couponCode: 'PLUS15',
      ivaAmount: 38000,
      ivaRate: 19,
      shipping: 20000,
      originalShipping: 30000,
      surcharge: 5000,
      prepayment: 10000,
      total: 238000,
    });
    expect(model).toMatchObject({
      statusLabel: 'Enviada',
      progress: {
        kind: 'delivery',
        percent: 75,
        summary: '75% completado',
      },
      sourceLabel: 'Tienda online',
      branchInfo: { name: 'Sede Principal', code: 'PRINCIPAL' },
      admin: { displayName: 'Administradora', role: 'owner' },
      invoice: { number: 'FE-PLUS-001', cufe: 'CUFE-PLUS-001' },
    });

    const { container } = render(<OrderDetailSummaryRail order={order} />);
    const rail = container.querySelector('aside.order-detail-summary-rail');
    const panels = Array.from(rail?.children || []);

    expect(rail).toBeInTheDocument();
    expect(rail?.tagName).toBe('ASIDE');
    expect(panels).toHaveLength(4);
    expect(panels.map((panel) => panel.tagName)).toEqual([
      'SECTION',
      'SECTION',
      'SECTION',
      'SECTION',
    ]);
    expect(panels[0]).toHaveTextContent('Resumen del pedido');
    expect(panels[1]).toHaveTextContent('Progreso del pedido');
    expect(panels[2]).toHaveTextContent('Datos rápidos');
    expect(panels[3]).toHaveTextContent('Trazabilidad');
    expect(screen.getByText('Descuento · PLUS15')).toBeInTheDocument();
    expect(screen.getByText('Descuento de envío')).toBeInTheDocument();
    expect(screen.getByText('Recargo')).toBeInTheDocument();
    expect(screen.getByText('Anticipo')).toBeInTheDocument();
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
