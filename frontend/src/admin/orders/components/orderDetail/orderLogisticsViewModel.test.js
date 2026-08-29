import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  carrierActions,
  hasPhysicalFulfillment,
  planPayload,
  shipmentForm,
  shipmentIdempotencyKey,
} from './orderLogisticsViewModel';
import { buildShipmentCardViewModel } from './orderLogisticsShipmentCardModel';

describe('orderLogisticsViewModel', () => {
  it('mantiene el panel como orquestador y los hooks logísticos dentro de sus límites', () => {
    const limits = {
      'src/admin/orders/components/orderDetail/OrderDetailLogisticsPanel.jsx': 300,
      'src/admin/orders/components/orderDetail/hooks/useOrderLogisticsController.js': 350,
      'src/admin/orders/components/orderDetail/hooks/useOrderShippingProviderActions.js': 350,
    };

    Object.entries(limits).forEach(([file, maximum]) => {
      const lines = readFileSync(resolve(process.cwd(), file), 'utf8')
        .trimEnd()
        .split(/\r?\n/).length;
      expect(lines, file).toBeLessThanOrEqual(maximum);
    });
  });

  it('normaliza el formulario sin mutar el envío recibido', () => {
    const shipment = {
      code: 'SHIP-1',
      packages: [{ weightGrams: 900, lengthCm: 20 }],
      carrier: { name: 'Envia', trackingNumber: 'ABC' },
      sla: { pickingDueAt: '2026-08-26T10:00:00.000Z' },
    };

    const form = shipmentForm(shipment);

    expect(form).toMatchObject({
      carrierName: 'Envia',
      trackingNumber: 'ABC',
      packageCount: 1,
      weightGrams: 900,
      lengthCm: 20,
      rateStrategy: 'balanced',
    });
    expect(shipment).not.toHaveProperty('priority');
  });

  it('construye como máximo veinte paquetes y conserva sus códigos existentes', () => {
    const shipment = {
      code: 'SHIP-2',
      packages: [{ code: 'PK-EXISTENTE' }],
    };

    const payload = planPayload(shipment, {
      packageCount: 25,
      priority: 'high',
      weightGrams: 1000,
      lengthCm: 10,
      widthCm: 20,
      heightCm: 30,
    });

    expect(payload.packages).toHaveLength(20);
    expect(payload.packages[0].code).toBe('PK-EXISTENTE');
    expect(payload.packages[1].code).toBe('SHIP-2-P02');
    expect(payload.packages[19]).toMatchObject({
      code: 'SHIP-2-P20',
      weightGrams: 1000,
      lengthCm: 10,
      widthCm: 20,
      heightCm: 30,
    });
  });

  it('detecta cumplimiento físico por inventario vendido o por tipo de artículo', () => {
    expect(hasPhysicalFulfillment({
      inventoryAllocations: [{ soldQuantity: 2, returnedQuantity: 1 }],
    })).toBe(true);
    expect(hasPhysicalFulfillment({
      items: [{ productType: 'digital' }, { productType: 'service' }],
    })).toBe(false);
    expect(hasPhysicalFulfillment({
      items: [{ productType: 'physical', requiresShipping: true }],
    })).toBe(true);
  });

  it('normaliza acciones de transportadora sin duplicados', () => {
    expect(carrierActions([' Pickup ', 'pickup', '', 'DROPOFF'])).toEqual([
      'pickup',
      'dropoff',
    ]);
  });

  it('genera una clave idempotente estable y segura por revisión', () => {
    const shipment = { _id: 'ship/1', revision: 4 };
    const rate = { carrier: 'Mi Carrier', service: 'same/day' };

    expect(shipmentIdempotencyKey('order/1', shipment, 'label', rate)).toBe(
      'label:order-1:ship-1:r4:Mi-Carrier:same-day'
    );
    expect(shipmentIdempotencyKey('order/1', { ...shipment, revision: 5 }, 'label', rate))
      .not.toBe(shipmentIdempotencyKey('order/1', shipment, 'label', rate));

    const firstPickup = shipmentIdempotencyKey(
      'order/1',
      shipment,
      'pickup',
      null,
      { pickupDate: '2026-08-30', pickupTimeStart: '09:00', pickupTimeEnd: '14:00' }
    );
    expect(firstPickup).toBe(shipmentIdempotencyKey(
      'order/1',
      shipment,
      'pickup',
      null,
      { pickupDate: '2026-08-30', pickupTimeStart: '09:00', pickupTimeEnd: '14:00' }
    ));
    expect(firstPickup).not.toBe(shipmentIdempotencyKey(
      'order/1',
      shipment,
      'pickup',
      null,
      { pickupDate: '2026-08-31', pickupTimeStart: '09:00', pickupTimeEnd: '14:00' }
    ));
  });

  it('deriva el paso guiado sin mutar el envío ni mezclarlo con la vista', () => {
    const shipment = {
      _id: 'ship-1',
      code: 'SHIP-1',
      status: 'ready_to_pick',
      carrier: {
        trackingNumber: 'TRACK-1',
        trackingUrl: 'https://example.com/track/TRACK-1',
      },
      shippingIntegration: {
        mode: 'sandbox',
        status: 'label_generated',
        labelUrl: 'https://example.com/label.pdf',
        carrierActions: ['dropoff'],
      },
    };

    const view = buildShipmentCardViewModel({
      shipment,
      providedRates: [],
      providers: {
        envia: {
          configured: true,
          enabled: true,
          mode: 'sandbox',
          webhookRegistered: true,
        },
      },
      busy: 'ship-1:provider:track',
    });

    expect(view).toMatchObject({
      assistantTitle: 'Descarga la etiqueta y elige cómo entregar el paquete',
      automaticTrackingEnabled: true,
      dropoffAvailable: true,
      hasActiveLabel: true,
      isBusy: true,
      showPublicTracking: false,
      visualStep: 2,
      waitingForAutomaticHandoff: true,
    });
    expect(shipment.shippingIntegration).not.toHaveProperty('handoffMode');
  });
});
