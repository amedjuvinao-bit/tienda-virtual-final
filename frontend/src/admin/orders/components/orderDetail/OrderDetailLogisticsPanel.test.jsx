import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const logisticsApi = vi.hoisted(() => ({
  cancelOrderShipmentLabel: vi.fn(),
  generateOrderShipmentLabel: vi.fn(),
  getOrderLogistics: vi.fn(),
  getShippingProviderStatus: vi.fn(),
  initializeOrderLogistics: vi.fn(),
  quoteOrderShipment: vi.fn(),
  syncOrderShipmentTracking: vi.fn(),
  updateOrderShipment: vi.fn(),
}));

vi.mock('../../orderLogisticsApi', () => logisticsApi);

import OrderDetailLogisticsPanel from './OrderDetailLogisticsPanel';

const SHIPMENT = {
  _id: '66c000000000000000000101',
  code: 'SHP-ORD001-BOG',
  branch: '66c000000000000000000201',
  branchSnapshot: { name: 'Bodega Bogotá', code: 'BOG' },
  allocationIds: ['66c000000000000000000301'],
  quantity: 2,
  status: 'ready_to_pick',
  revision: 0,
  priority: 'normal',
  carrier: {},
  packages: [{ code: 'SHP-ORD001-BOG-P01', weightGrams: 500 }],
  sla: {
    pickingDueAt: '2026-08-13T18:00:00.000Z',
    dispatchDueAt: '2026-08-14T18:00:00.000Z',
    deliveryDueAt: '2026-08-16T18:00:00.000Z',
  },
  incidents: [],
};

const ORDER = {
  _id: '66c000000000000000000001',
  orderNumber: 'ORD-001',
  status: 'paid',
  items: [{ productType: 'physical', requiresShipping: true }],
  inventoryAllocations: [
    {
      _id: '66c000000000000000000301',
      soldQuantity: 2,
      returnedQuantity: 0,
    },
  ],
  fulfillment: {
    shipments: [],
    logisticsSummary: { status: 'not_initialized' },
  },
};

function responseWith(shipment) {
  return {
    ok: true,
    summary: {
      status: shipment.status === 'delivered' ? 'delivered' : 'in_progress',
      shipmentCount: 1,
      readyCount: shipment.status === 'ready_to_pick' ? 1 : 0,
      activeCount: 1,
      dispatchedCount: ['dispatched', 'in_transit', 'delivered'].includes(shipment.status) ? 1 : 0,
      deliveredCount: shipment.status === 'delivered' ? 1 : 0,
      exceptionCount: shipment.status === 'exception' ? 1 : 0,
      slaBreachedCount: 0,
    },
    eligibility: {
      canInitialize: true,
      code: null,
      message: 'Pago confirmado e inventario vendido disponibles para preparar.',
    },
    shipments: [shipment],
  };
}

function eligibilityResponse(overrides = {}) {
  return {
    ok: true,
    summary: { status: 'not_initialized', shipmentCount: 0 },
    shipments: [],
    eligibility: {
      canInitialize: true,
      code: null,
      message: 'Pago confirmado e inventario vendido disponibles para preparar.',
      ...overrides,
    },
  };
}

describe('centro logístico avanzado de la orden', () => {
  beforeEach(() => {
    Object.values(logisticsApi).forEach((mock) => mock.mockReset());
    logisticsApi.getOrderLogistics.mockResolvedValue(eligibilityResponse());
    logisticsApi.getShippingProviderStatus.mockResolvedValue({
      ok: true,
      providers: {
        defaultProvider: 'manual',
        manual: { configured: true, enabled: true },
        envia: {
          configured: false,
          enabled: false,
          mode: 'sandbox',
          message: 'Envia Sandbox pendiente de ENVIA_TOKEN; no se realizarán llamadas externas.',
        },
      },
    });
  });

  afterEach(() => cleanup());

  it('crea envíos por sede solamente cuando existe permiso logístico', async () => {
    logisticsApi.initializeOrderLogistics.mockResolvedValue(responseWith(SHIPMENT));
    const onRefreshTimeline = vi.fn();
    const view = render(
      <OrderDetailLogisticsPanel
        order={ORDER}
        canManage={false}
        onRefreshTimeline={onRefreshTimeline}
      />
    );

    expect(screen.getByRole('region', { name: 'Centro logístico de la orden' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Preparar logística' })).not.toBeInTheDocument();

    view.rerender(
      <OrderDetailLogisticsPanel
        order={ORDER}
        canManage
        onRefreshTimeline={onRefreshTimeline}
      />
    );
    const prepareButton = await screen.findByRole('button', {
      name: 'Preparar logística',
    });
    await waitFor(() => expect(prepareButton).toBeEnabled());
    fireEvent.click(prepareButton);

    expect(await screen.findByText(/SHP-ORD001-BOG/)).toBeInTheDocument();
    expect(logisticsApi.initializeOrderLogistics).toHaveBeenCalledWith(ORDER._id);
    expect(onRefreshTimeline).toHaveBeenCalled();
  });

  it('propaga el estado agregado cuando todos los envíos quedan entregados', async () => {
    const deliveredShipment = {
      ...SHIPMENT,
      status: 'delivered',
      revision: 10,
      deliveredAt: '2026-08-18T19:30:00.000Z',
    };
    logisticsApi.getOrderLogistics.mockResolvedValue({
      ...responseWith(deliveredShipment),
      orderStatus: 'delivered',
      fulfillmentStatus: 'delivered',
    });
    const onOrderUpdated = vi.fn();

    render(
      <OrderDetailLogisticsPanel
        order={ORDER}
        canManage
        onOrderUpdated={onOrderUpdated}
      />
    );

    expect(await screen.findByText('Entregada')).toBeInTheDocument();
    await waitFor(() =>
      expect(onOrderUpdated).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: ORDER._id,
          status: 'delivered',
          fulfillmentStatus: 'delivered',
          fulfillment: expect.objectContaining({
            status: 'delivered',
            shipments: [deliveredShipment],
            logisticsSummary: expect.objectContaining({ status: 'delivered' }),
          }),
        })
      )
    );
  });

  it('deshabilita la preparación y explica el pago pendiente', async () => {
    logisticsApi.getOrderLogistics.mockResolvedValue(
      eligibilityResponse({
        canInitialize: false,
        code: 'ORDER_PAYMENT_REQUIRED_FOR_LOGISTICS',
        message: 'Disponible cuando el pago esté confirmado y exista inventario vendido.',
      })
    );

    render(
      <OrderDetailLogisticsPanel
        order={{
          ...ORDER,
          status: 'pending',
          payment: { status: 'pending' },
          inventoryAllocations: [
            {
              ...ORDER.inventoryAllocations[0],
              soldQuantity: 0,
              releasedQuantity: 2,
            },
          ],
        }}
        canManage
      />
    );

    const button = await screen.findByRole('button', {
      name: 'Preparar logística',
    });
    await waitFor(() => expect(button).toBeDisabled());
    expect(
      screen.getByText(
        'Disponible cuando el pago esté confirmado y exista inventario vendido.'
      )
    ).toBeInTheDocument();
    fireEvent.click(button);
    expect(logisticsApi.initializeOrderLogistics).not.toHaveBeenCalled();
  });

  it('deshabilita la preparación cuando la reserva fue liberada', async () => {
    logisticsApi.getOrderLogistics.mockResolvedValue(
      eligibilityResponse({
        canInitialize: false,
        code: 'ORDER_LOGISTICS_ALLOCATIONS_REQUIRED',
        message: 'Disponible cuando el pago esté confirmado y exista inventario vendido.',
      })
    );

    render(
      <OrderDetailLogisticsPanel
        order={{
          ...ORDER,
          inventoryAllocations: [
            {
              ...ORDER.inventoryAllocations[0],
              soldQuantity: 0,
              releasedQuantity: 2,
            },
          ],
        }}
        canManage
      />
    );

    const button = await screen.findByRole('button', {
      name: 'Preparar logística',
    });
    await waitFor(() => expect(button).toBeDisabled());
    expect(logisticsApi.initializeOrderLogistics).not.toHaveBeenCalled();
  });

  it('no presenta centro logístico para una orden únicamente digital', () => {
    render(
      <OrderDetailLogisticsPanel
        order={{
          ...ORDER,
          items: [{ productType: 'digital', requiresShipping: false }],
          inventoryAllocations: [],
        }}
        canManage
      />
    );

    expect(
      screen.queryByRole('region', { name: 'Centro logístico de la orden' })
    ).not.toBeInTheDocument();
    expect(logisticsApi.getOrderLogistics).not.toHaveBeenCalled();
  });

  it('envía revisión optimista y conserva el orden picking antes de packing', async () => {
    const picking = { ...SHIPMENT, status: 'picking', revision: 1 };
    logisticsApi.updateOrderShipment.mockResolvedValue(responseWith(picking));
    render(
      <OrderDetailLogisticsPanel
        order={{
          ...ORDER,
          fulfillment: {
            shipments: [SHIPMENT],
            logisticsSummary: responseWith(SHIPMENT).summary,
          },
        }}
        canManage
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Iniciar picking' }));

    await waitFor(() => {
      expect(logisticsApi.updateOrderShipment).toHaveBeenCalledWith(
        ORDER._id,
        SHIPMENT._id,
        expect.objectContaining({
          action: 'start_picking',
          expectedRevision: 0,
        })
      );
    });
    expect(await screen.findByRole('button', { name: 'Completar picking' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirmar despacho' })).not.toBeInTheDocument();
  });

  it('muestra transportadora, paquetes y SLA en modo de solo lectura', () => {
    render(
      <OrderDetailLogisticsPanel
        order={{
          ...ORDER,
          fulfillment: {
            shipments: [
              {
                ...SHIPMENT,
                carrier: {
                  name: 'Transportadora Comercial',
                  trackingNumber: 'GUIA-001',
                },
              },
            ],
            logisticsSummary: responseWith(SHIPMENT).summary,
          },
        }}
        canManage={false}
      />
    );

    expect(screen.getByLabelText(`Transportadora ${SHIPMENT.code}`)).toHaveValue('Transportadora Comercial');
    expect(screen.getByLabelText(`Transportadora ${SHIPMENT.code}`)).toBeDisabled();
    expect(screen.getByLabelText(`Paquetes ${SHIPMENT.code}`)).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Iniciar picking' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Guardar plan logístico' })).not.toBeInTheDocument();
  });

  it('mantiene Envia Sandbox bloqueado sin token y conserva la operación manual', async () => {
    render(
      <OrderDetailLogisticsPanel
        order={{
          ...ORDER,
          fulfillment: {
            shipments: [SHIPMENT],
            logisticsSummary: responseWith(SHIPMENT).summary,
          },
        }}
        canManage
      />
    );

    expect(await screen.findByText(/Manual activo/)).toBeInTheDocument();
    const quoteButton = screen.getByRole('button', { name: 'Cotizar con Envia' });
    await waitFor(() => expect(quoteButton).toBeDisabled());
    fireEvent.click(quoteButton);
    expect(logisticsApi.quoteOrderShipment).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Guardar plan logístico' })).toBeEnabled();
  });

  it('hace visible una incidencia y exige resolución antes de reanudar', async () => {
    const exception = {
      ...SHIPMENT,
      status: 'exception',
      resumeStatus: 'packing',
      revision: 4,
      incidents: [
        {
          _id: 'incident-1',
          status: 'open',
          type: 'damage',
          severity: 'high',
          description: 'Caja deteriorada.',
        },
      ],
    };
    const resolved = {
      ...exception,
      status: 'packing',
      revision: 5,
      incidents: [{ ...exception.incidents[0], status: 'resolved' }],
    };
    logisticsApi.updateOrderShipment.mockResolvedValue(responseWith(resolved));
    render(
      <OrderDetailLogisticsPanel
        order={{
          ...ORDER,
          fulfillment: {
            shipments: [exception],
            logisticsSummary: { ...responseWith(exception).summary, exceptionCount: 1 },
          },
        }}
        canManage
      />
    );

    expect(screen.getByText('Caja deteriorada.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(`Resolución ${SHIPMENT.code}`), {
      target: { value: 'Producto revisado y reempacado.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Resolver incidencia' }));

    await waitFor(() => {
      expect(logisticsApi.updateOrderShipment).toHaveBeenCalledWith(
        ORDER._id,
        SHIPMENT._id,
        expect.objectContaining({
          action: 'resolve_incident',
          expectedRevision: 4,
          resolution: 'Producto revisado y reempacado.',
        })
      );
    });
  });
});
