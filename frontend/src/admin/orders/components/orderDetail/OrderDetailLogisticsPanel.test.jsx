import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const logisticsApi = vi.hoisted(() => ({
  cancelOrderShipmentLabel: vi.fn(),
  confirmOrderShipmentDropoff: vi.fn(),
  generateOrderShipmentLabel: vi.fn(),
  getOrderLogistics: vi.fn(),
  getShippingProviderStatus: vi.fn(),
  initializeOrderLogistics: vi.fn(),
  quoteOrderShipment: vi.fn(),
  scheduleOrderShipmentPickup: vi.fn(),
  syncOrderShipmentTracking: vi.fn(),
  testOrderShipmentWebhook: vi.fn(),
  updateOrderShipment: vi.fn(),
}));

vi.mock('../../orderLogisticsApi', () => logisticsApi);

import OrderDetailLogisticsPanel from './OrderDetailLogisticsPanel';
import {
  deliveryDays,
  recommendedShippingRate,
} from './shippingRateRecommendation';

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
    expect(screen.queryByRole('button', { name: 'Preparar logística manual' })).not.toBeInTheDocument();

    view.rerender(
      <OrderDetailLogisticsPanel
        order={ORDER}
        canManage
        onRefreshTimeline={onRefreshTimeline}
      />
    );
    const prepareButton = await screen.findByRole('button', {
      name: 'Preparar logística manual',
    });
    await waitFor(() => expect(prepareButton).toBeEnabled());
    fireEvent.click(prepareButton);

    expect(await screen.findByText(/SHP-ORD001-BOG/)).toBeInTheDocument();
    expect(logisticsApi.initializeOrderLogistics).toHaveBeenCalledWith(ORDER._id);
    expect(onRefreshTimeline).toHaveBeenCalled();
  });

  it('inicia el envío automático con una sola acción cuando Envia está activo', async () => {
    logisticsApi.getShippingProviderStatus.mockResolvedValue({
      ok: true,
      providers: {
        defaultProvider: 'envia',
        manual: { configured: true, enabled: true },
        envia: {
          configured: true,
          enabled: true,
          mode: 'sandbox',
          message: 'Envia Sandbox activo.',
        },
      },
    });
    logisticsApi.initializeOrderLogistics.mockResolvedValue(responseWith(SHIPMENT));

    render(
      <OrderDetailLogisticsPanel
        order={ORDER}
        canManage
      />
    );

    const startButton = await screen.findByRole('button', {
      name: 'Iniciar envío automático',
    });
    await waitFor(() => expect(startButton).toBeEnabled());
    fireEvent.click(startButton);

    expect(await screen.findByText('Despacha este pedido en 3 pasos')).toBeInTheDocument();
    expect(screen.getByText('Haz esto ahora')).toBeInTheDocument();
    expect(
      screen.getByText('Envíos creados por sede. Continúa con la validación automática de datos y tarifas.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {
      name: 'Buscar opciones de envío',
    })).toBeInTheDocument();
  });

  it('conserva la elegibilidad cuando el resumen se sincroniza en la misma orden', async () => {
    logisticsApi.getOrderLogistics.mockResolvedValue({
      ...eligibilityResponse(),
      summary: {
        status: 'not_initialized',
        shipmentCount: 0,
        updatedAt: '2026-08-18T23:25:00.000Z',
      },
    });
    const onOrderUpdated = vi.fn();
    const view = render(
      <OrderDetailLogisticsPanel
        order={ORDER}
        canManage
        onOrderUpdated={onOrderUpdated}
      />
    );

    const prepareButton = await screen.findByRole('button', {
      name: 'Preparar logística manual',
    });
    await waitFor(() => expect(prepareButton).toBeEnabled());
    await waitFor(() => expect(onOrderUpdated).toHaveBeenCalled());

    const synchronized = onOrderUpdated.mock.calls.at(-1)[0];
    view.rerender(
      <OrderDetailLogisticsPanel
        order={{
          ...ORDER,
          fulfillment: synchronized.fulfillment,
        }}
        canManage
        onOrderUpdated={onOrderUpdated}
      />
    );

    await waitFor(() => expect(prepareButton).toBeEnabled());
    expect(
      screen.getByText('Pago confirmado e inventario vendido disponibles para preparar.')
    ).toBeInTheDocument();
    expect(logisticsApi.getOrderLogistics).toHaveBeenCalledTimes(1);
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
      name: 'Preparar logística manual',
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
      name: 'Preparar logística manual',
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

    fireEvent.click(screen.getByRole('button', { name: 'Comenzar a reunir productos' }));

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
    expect(await screen.findByRole('button', { name: 'Confirmar productos reunidos' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirmar entrega a la transportadora' })).not.toBeInTheDocument();
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
    expect(screen.queryByRole('button', { name: 'Comenzar a reunir productos' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Guardar plan manual' })).not.toBeInTheDocument();
  });

  it('identifica visualmente cada campo del plan y sus unidades', () => {
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

    expect(screen.getByText('Número de paquetes')).toBeInTheDocument();
    expect(screen.getByText('Peso por paquete (g)')).toBeInTheDocument();
    expect(screen.getByText('Largo (cm)')).toBeInTheDocument();
    expect(screen.getByText('Ancho (cm)')).toBeInTheDocument();
    expect(screen.getByText('Alto (cm)')).toBeInTheDocument();
  });

  it('recomienda tarifas con criterios deterministas y tiempos normalizados', () => {
    const rates = [
      { carrier: 'economica', service: 'ground', deliveryEstimate: '4-5 días', totalPrice: 10000 },
      { carrier: 'equilibrada', service: 'standard', deliveryEstimate: '1-2 días', totalPrice: 14000 },
      { carrier: 'express', service: 'next', deliveryEstimate: 'Día siguiente', totalPrice: 30000 },
    ];

    expect(deliveryDays(rates[0])).toBe(5);
    expect(deliveryDays(rates[2])).toBe(1);
    expect(recommendedShippingRate(rates, 'balanced')?.carrier).toBe('equilibrada');
    expect(recommendedShippingRate(rates, 'cheapest')?.carrier).toBe('economica');
    expect(recommendedShippingRate(rates, 'fastest')?.carrier).toBe('express');
  });

  it('guía al administrador en tres pasos y exige definir la entrega física antes del picking', async () => {
    const rates = [
      { carrier: 'economica', service: 'ground', serviceDescription: 'Económico', deliveryEstimate: '4-5 días', totalPrice: 10000, currency: 'COP' },
      { carrier: 'equilibrada', service: 'standard', serviceDescription: 'Estándar', deliveryEstimate: '1-2 días', totalPrice: 14000, currency: 'COP' },
      { carrier: 'express', service: 'next', serviceDescription: 'Día siguiente', deliveryEstimate: 'Día siguiente', totalPrice: 30000, currency: 'COP' },
    ];
    const planned = { ...SHIPMENT, revision: 1 };
    const quoted = {
      ...SHIPMENT,
      revision: 2,
      shippingIntegration: { provider: 'envia', mode: 'sandbox', status: 'quoted' },
    };
    const generated = {
      ...quoted,
      revision: 3,
      carrier: {
        code: 'EXPRESS',
        name: 'express',
        serviceLevel: 'next',
        trackingNumber: 'GUIA-123',
        trackingUrl: 'https://example.com/track/GUIA-123',
      },
      shippingIntegration: {
        provider: 'envia',
        mode: 'sandbox',
        status: 'label_generated',
        labelUrl: 'https://example.com/label.pdf',
        selectedRate: rates[2],
      },
    };
    const tracked = {
      ...generated,
      revision: 4,
      shippingIntegration: {
        ...generated.shippingIntegration,
        status: 'tracking',
        lastSyncedAt: '2026-08-19T18:00:00.000Z',
      },
    };
    const droppedOff = {
      ...tracked,
      revision: 5,
      shippingIntegration: {
        ...tracked.shippingIntegration,
        handoffMode: 'dropoff',
        handoffConfirmedAt: '2026-08-19T18:05:00.000Z',
      },
    };
    logisticsApi.getShippingProviderStatus.mockResolvedValue({
      ok: true,
      providers: {
        defaultProvider: 'envia',
        envia: {
          configured: true,
          enabled: true,
          mode: 'sandbox',
          webhookRegistered: true,
          message: 'Envia Sandbox activo.',
        },
      },
    });
    logisticsApi.testOrderShipmentWebhook.mockResolvedValue({ ok: true });
    logisticsApi.updateOrderShipment.mockResolvedValue({
      ...responseWith(planned),
      shipment: planned,
    });
    logisticsApi.quoteOrderShipment.mockResolvedValue({
      ...responseWith(quoted),
      shipment: quoted,
      rates,
    });
    logisticsApi.generateOrderShipmentLabel.mockResolvedValue({
      ...responseWith(generated),
      shipment: generated,
    });
    logisticsApi.syncOrderShipmentTracking.mockResolvedValue({
      ...responseWith(tracked),
      shipment: tracked,
    });
    logisticsApi.confirmOrderShipmentDropoff.mockResolvedValue({
      ...responseWith(droppedOff),
      shipment: droppedOff,
    });

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

    expect(await screen.findByText('PASO ACTUAL 1 DE 3')).toBeInTheDocument();
    expect(screen.getByText('Busca el mejor envío para este pedido')).toBeInTheDocument();
    expect(screen.getByText('Crear la guía')).toBeInTheDocument();
    expect(screen.getByText('Preparar el paquete')).toBeInTheDocument();
    expect(screen.getByText('Esperar la entrega')).toBeInTheDocument();
    expect(screen.getByText('Ver avance detallado del paquete').closest('details')).not.toHaveAttribute('open');
    expect(screen.queryByLabelText(`Transportadora ${SHIPMENT.code}`)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(`Guía ${SHIPMENT.code}`)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Comenzar a reunir productos' })).not.toBeInTheDocument();
    expect(
      screen.getByText('Primero genera la guía y define cómo llegará el paquete a la transportadora. Después podrás comenzar a reunir los productos.')
    ).toBeInTheDocument();
    const quoteButton = screen.getByRole('button', { name: 'Buscar opciones de envío' });
    await waitFor(() => expect(quoteButton).toBeEnabled());
    fireEvent.click(quoteButton);

    expect(await screen.findByLabelText(`Tarifa seleccionada ${SHIPMENT.code}`)).toHaveTextContent('equilibrada');
    expect(await screen.findByText('PASO ACTUAL 1 DE 3')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Cambiar recomendación o ver alternativas'));
    fireEvent.change(screen.getByLabelText(`Criterio de tarifa ${SHIPMENT.code}`), {
      target: { value: 'fastest' },
    });
    expect(screen.getByLabelText(`Tarifa seleccionada ${SHIPMENT.code}`)).toHaveTextContent('express');

    fireEvent.click(screen.getByRole('button', { name: 'Crear guía de prueba' }));

    await waitFor(() => {
      expect(logisticsApi.generateOrderShipmentLabel).toHaveBeenCalledWith(
        ORDER._id,
        SHIPMENT._id,
        expect.objectContaining({
          provider: 'envia',
          expectedRevision: 2,
          rate: expect.objectContaining({ carrier: 'express', service: 'next' }),
        }),
        expect.any(String)
      );
    });
    await waitFor(() => {
      expect(logisticsApi.syncOrderShipmentTracking).toHaveBeenCalledWith(
        ORDER._id,
        SHIPMENT._id,
        { provider: 'envia', expectedRevision: 3 }
      );
    });
    expect(await screen.findByText('Guía lista')).toBeInTheDocument();
    expect(screen.getByText('Descarga la etiqueta y elige cómo entregar el paquete')).toBeInTheDocument();
    expect(screen.getByText('PASO ACTUAL 2 DE 3')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Descargar etiqueta' })).toHaveAttribute(
      'href',
      'https://example.com/label.pdf'
    );
    fireEvent.click(screen.getByText('Pruebas Sandbox · solo para verificar la integración'));
    fireEvent.change(screen.getByLabelText(`Estado de webhook de prueba ${SHIPMENT.code}`), {
      target: { value: 'Delivered' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar aviso de prueba' }));
    await waitFor(() => expect(logisticsApi.testOrderShipmentWebhook).toHaveBeenCalledWith(
      ORDER._id,
      SHIPMENT._id,
      {
        provider: 'envia',
        expectedRevision: 4,
        testStatus: 'Delivered',
      }
    ));
    expect(await screen.findByText(/Prueba enviada: estamos imitando que Envia informó que el paquete fue entregado/)).toBeInTheDocument();
    expect(screen.getByText('PASO ACTUAL 2 DE 3')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Ver seguimiento público' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Comenzar a reunir productos' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Elegir entrega en punto' }));
    await waitFor(() => expect(logisticsApi.confirmOrderShipmentDropoff).toHaveBeenCalledWith(
      ORDER._id,
      SHIPMENT._id,
      { expectedRevision: 4 }
    ));
    expect(await screen.findByText('PASO ACTUAL 2 DE 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Comenzar a reunir productos' })).toBeInTheDocument();
    expect(
      screen.getByText('El seguimiento público se habilitará únicamente para las guías reales de producción.')
    ).toBeInTheDocument();
  });

  it('mantiene la preparación activa hasta que la transportadora recibe el paquete', async () => {
    logisticsApi.getShippingProviderStatus.mockResolvedValue({
      ok: true,
      providers: {
        defaultProvider: 'envia',
        envia: {
          configured: true,
          enabled: true,
          mode: 'sandbox',
          webhookRegistered: true,
          message: 'Envia Sandbox activo.',
        },
      },
    });
    const preparedForDropoff = {
      ...SHIPMENT,
      revision: 5,
      carrier: { name: 'fedex', trackingNumber: '794853990273' },
      shippingIntegration: {
        status: 'label_created',
        mode: 'sandbox',
        labelUrl: 'https://example.com/label.pdf',
        handoffMode: 'dropoff',
        providerStatus: 'Delivered',
      },
    };
    const orderWithShipment = (shipment) => ({
      ...ORDER,
      fulfillment: {
        shipments: [shipment],
        logisticsSummary: responseWith(shipment).summary,
      },
    });

    const preparationView = render(
      <OrderDetailLogisticsPanel order={orderWithShipment(preparedForDropoff)} canManage />
    );

    expect(await screen.findByText('PASO ACTUAL 2 DE 3')).toBeInTheDocument();
    expect(screen.getByText('Prepara el paquete y llévalo al punto elegido')).toBeInTheDocument();
    expect(screen.getByText(/simulación, no cambia el paquete real/)).toBeInTheDocument();
    preparationView.unmount();

    const dispatched = { ...preparedForDropoff, status: 'dispatched', revision: 6 };
    const transitView = render(
      <OrderDetailLogisticsPanel order={orderWithShipment(dispatched)} canManage />
    );

    expect(await screen.findByText('PASO ACTUAL 3 DE 3')).toBeInTheDocument();
    expect(screen.getByText('No hagas nada: espera la actualización')).toBeInTheDocument();
    transitView.unmount();

    const delivered = { ...preparedForDropoff, status: 'delivered', revision: 7 };
    render(<OrderDetailLogisticsPanel order={orderWithShipment(delivered)} canManage />);

    expect(await screen.findByText('3 PASOS LISTOS')).toBeInTheDocument();
    expect(screen.getByText('Listo: el pedido ya fue entregado')).toBeInTheDocument();
    expect(screen.getAllByText('LISTO')).toHaveLength(3);
  });

  it('programa la recolección junto con la guía cuando la transportadora lo exige', async () => {
    const pickupRate = {
      carrier: 'carrier-pickup',
      service: 'standard',
      serviceDescription: 'Servicio con recolección',
      deliveryEstimate: '2-3 días',
      totalPrice: 18000,
      currency: 'COP',
      carrierActions: ['pickup_on_generate'],
    };
    const planned = { ...SHIPMENT, revision: 1 };
    const quoted = {
      ...SHIPMENT,
      revision: 2,
      shippingIntegration: { provider: 'envia', mode: 'sandbox', status: 'quoted' },
    };
    const generated = {
      ...quoted,
      revision: 3,
      carrier: {
        code: 'CARRIER-PICKUP',
        name: 'carrier-pickup',
        serviceLevel: 'standard',
        trackingNumber: 'PICKUP-123',
      },
      shippingIntegration: {
        provider: 'envia',
        mode: 'sandbox',
        status: 'label_generated',
        labelUrl: 'https://example.com/pickup-label.pdf',
        selectedRate: pickupRate,
        carrierActions: ['pickup_on_generate'],
        handoffMode: 'pickup',
        handoffConfirmedAt: '2026-08-22T12:00:00.000Z',
        pickup: {
          status: 'scheduled',
          confirmation: 'REC-123',
          requestedDate: '2026-08-22',
        },
      },
    };
    const tracked = { ...generated, revision: 4 };
    logisticsApi.getShippingProviderStatus.mockResolvedValue({
      ok: true,
      providers: {
        defaultProvider: 'envia',
        envia: { configured: true, enabled: true, mode: 'sandbox', message: 'Envia Sandbox activo.' },
      },
    });
    logisticsApi.updateOrderShipment.mockResolvedValue({ ...responseWith(planned), shipment: planned });
    logisticsApi.quoteOrderShipment.mockResolvedValue({
      ...responseWith(quoted),
      shipment: quoted,
      rates: [pickupRate],
    });
    logisticsApi.generateOrderShipmentLabel.mockResolvedValue({
      ...responseWith(generated),
      shipment: generated,
    });
    logisticsApi.syncOrderShipmentTracking.mockResolvedValue({
      ...responseWith(tracked),
      shipment: tracked,
    });

    render(
      <OrderDetailLogisticsPanel
        order={{
          ...ORDER,
          fulfillment: { shipments: [SHIPMENT], logisticsSummary: responseWith(SHIPMENT).summary },
        }}
        canManage
      />
    );

    const quoteButton = await screen.findByRole('button', { name: 'Buscar opciones de envío' });
    await waitFor(() => expect(quoteButton).toBeEnabled());
    fireEvent.click(quoteButton);
    const pickupDate = await screen.findByLabelText(`Fecha de recolección al generar ${SHIPMENT.code}`);
    fireEvent.change(pickupDate, { target: { value: '2026-08-22' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear guía de prueba y pedir recolección' }));

    await waitFor(() => expect(logisticsApi.generateOrderShipmentLabel).toHaveBeenCalledWith(
      ORDER._id,
      SHIPMENT._id,
      expect.objectContaining({
        provider: 'envia',
        pickupDate: '2026-08-22',
        rate: expect.objectContaining({ carrierActions: ['pickup_on_generate'] }),
      }),
      expect.any(String)
    ));
    expect(await screen.findByText(/Recolección confirmada/)).toHaveTextContent('REC-123');
    expect(screen.getByText('PASO ACTUAL 2 DE 3')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Elegir entrega en punto' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Comenzar a reunir productos' })).toBeInTheDocument();
  });

  it('muestra seguimiento público únicamente para una guía de producción', async () => {
    const productionShipment = {
      ...SHIPMENT,
      revision: 3,
      carrier: {
        code: 'FEDEX',
        name: 'fedex',
        serviceLevel: 'ground',
        trackingNumber: 'PROD-123',
        trackingUrl: 'https://envia.com/rastreo?label=PROD-123',
      },
      shippingIntegration: {
        provider: 'envia',
        mode: 'production',
        status: 'label_generated',
        labelUrl: 'https://example.com/production-label.pdf',
      },
    };
    logisticsApi.getShippingProviderStatus.mockResolvedValue({
      ok: true,
      providers: {
        defaultProvider: 'envia',
        envia: { configured: true, enabled: true, mode: 'production', message: 'Envia Producción activo.' },
      },
    });

    render(
      <OrderDetailLogisticsPanel
        order={{
          ...ORDER,
          fulfillment: {
            shipments: [productionShipment],
            logisticsSummary: responseWith(productionShipment).summary,
          },
        }}
        canManage
      />
    );

    const trackingLink = await screen.findByRole('link', { name: 'Ver seguimiento público' });
    expect(trackingLink).toHaveAttribute('href', 'https://envia.com/rastreo?label=PROD-123');
    expect(screen.queryByText(/Modo de prueba/)).not.toBeInTheDocument();
  });

  it('exige confirmación explícita antes de generar una guía de producción', async () => {
    const rate = { carrier: 'fedex', service: 'ground', deliveryEstimate: '2-4 días', totalPrice: 3060, currency: 'COP' };
    const planned = { ...SHIPMENT, revision: 1 };
    const quoted = { ...SHIPMENT, revision: 2 };
    logisticsApi.getShippingProviderStatus.mockResolvedValue({
      ok: true,
      providers: {
        defaultProvider: 'envia',
        envia: { configured: true, enabled: true, mode: 'production', message: 'Envia Producción activo.' },
      },
    });
    logisticsApi.updateOrderShipment.mockResolvedValue({ ...responseWith(planned), shipment: planned });
    logisticsApi.quoteOrderShipment.mockResolvedValue({ ...responseWith(quoted), shipment: quoted, rates: [rate] });
    logisticsApi.generateOrderShipmentLabel.mockResolvedValue({
      ...responseWith({ ...quoted, revision: 3 }),
      shipment: { ...quoted, revision: 3 },
    });

    render(
      <OrderDetailLogisticsPanel
        order={{
          ...ORDER,
          fulfillment: { shipments: [SHIPMENT], logisticsSummary: responseWith(SHIPMENT).summary },
        }}
        canManage
      />
    );

    const quoteButton = await screen.findByRole('button', { name: 'Buscar opciones de envío' });
    await waitFor(() => expect(quoteButton).toBeEnabled());
    fireEvent.click(quoteButton);
    fireEvent.click(await screen.findByRole('button', { name: 'Crear guía real' }));

    expect(await screen.findByText('Esta acción puede generar cobros reales')).toBeInTheDocument();
    expect(logisticsApi.generateOrderShipmentLabel).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Sí, generar guía real' }));
    await waitFor(() => expect(logisticsApi.generateOrderShipmentLabel).toHaveBeenCalledTimes(1));
  });

  it('ofrece acceso a Sedes cuando faltan datos del origen para cotizar', async () => {
    logisticsApi.getShippingProviderStatus.mockResolvedValue({
      ok: true,
      providers: {
        defaultProvider: 'envia',
        envia: { configured: true, enabled: true, mode: 'sandbox', message: 'Envia Sandbox activo.' },
      },
    });
    logisticsApi.updateOrderShipment.mockResolvedValue(
      responseWith({ ...SHIPMENT, revision: 1 })
    );
    logisticsApi.quoteOrderShipment.mockRejectedValue({
      response: {
        data: {
          error: 'SHIPPING_CITY_NOT_RESOLVED',
          message: 'Envia no pudo validar la ciudad y el departamento de la sede Sede Principal: Santa Marta (DC). Corrige la ubicación en Configuración → Sedes.',
          details: { address: 'origin', city: 'Santa Marta', state: 'DC' },
        },
      },
    });

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

    const quoteButton = await screen.findByRole('button', { name: 'Buscar opciones de envío' });
    await waitFor(() => expect(quoteButton).toBeEnabled());
    fireEvent.click(quoteButton);

    const configureLink = await screen.findByRole('link', {
      name: 'Configurar datos de la sede',
    });
    expect(configureLink).toHaveAttribute('href', '/admin/configuracion/sedes');
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

    expect(await screen.findByText('Configura Envia para comenzar')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Configurar Envia' })).toHaveAttribute(
      'href',
      '/admin/configuracion/envios'
    );
    expect(screen.queryByRole('button', { name: 'Buscar opciones de envío' })).not.toBeInTheDocument();
    expect(logisticsApi.quoteOrderShipment).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Guardar plan manual' })).toBeEnabled();
  });

  it('no mezcla acciones de Envia cuando la conexión está configurada pero sigue inactiva', async () => {
    logisticsApi.getShippingProviderStatus.mockResolvedValue({
      ok: true,
      providers: {
        defaultProvider: 'manual',
        manual: { configured: true, enabled: true },
        envia: {
          configured: true,
          enabled: false,
          mode: 'sandbox',
          message: 'Envia Sandbox configurado, pero la operación manual continúa activa.',
        },
      },
    });

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

    expect(await screen.findByText('Activa Envia para comenzar')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Activar Envia' })).toHaveAttribute(
      'href',
      '/admin/configuracion/envios'
    );
    expect(screen.getByLabelText(`Transportadora ${SHIPMENT.code}`)).toBeInTheDocument();
    expect(screen.queryByRole('button', {
      name: 'Buscar opciones de envío',
    })).not.toBeInTheDocument();
    expect(logisticsApi.quoteOrderShipment).not.toHaveBeenCalled();
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
