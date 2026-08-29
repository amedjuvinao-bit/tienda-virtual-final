import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import OrderDetailReturnsPanel from './OrderDetailReturnsPanel';

const LINE_ID = '64d000000000000000000001';
const RETURN_ID = '64e000000000000000000001';

const eligibility = {
  orderItemId: LINE_ID,
  title: 'Tenis Plus',
  deliveredQuantity: 2,
  availableQuantity: 2,
  eligible: true,
  expired: false,
  eligibleUntil: '2026-09-01T12:00:00.000Z',
};

const receivedReturn = {
  _id: RETURN_ID,
  returnNumber: 'RMA-ORD-1',
  status: 'received',
  revision: 3,
  requestedResolution: 'refund',
  requestedAt: '2026-08-17T12:00:00.000Z',
  estimatedRefundAmount: 120000,
  items: [{
    orderItemId: LINE_ID,
    title: 'Tenis Plus',
    requestedQuantity: 2,
    authorizedQuantity: 2,
    receivedQuantity: 2,
  }],
};

describe('OrderDetailReturnsPanel', () => {
  afterEach(() => cleanup());

  it('crea un expediente con línea, cantidad, motivo y resolución', () => {
    const onCreate = vi.fn();
    render(
      <OrderDetailReturnsPanel
        data={{ orderId: 'order-1', eligibility: [eligibility], returns: [] }}
        canManage
        onCreate={onCreate}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Nueva devolución o cambio' }));
    fireEvent.change(screen.getByLabelText('Cantidad Tenis Plus'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Motivo Tenis Plus'), { target: { value: 'wrong_size' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear expediente RMA' }));

    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({
      requestedResolution: 'refund',
      items: [expect.objectContaining({
        orderItemId: LINE_ID,
        quantity: 1,
        reasonCode: 'wrong_size',
      })],
    }));
  });

  it('descarta el borrador local al cambiar de orden', () => {
    const { rerender } = render(
      <OrderDetailReturnsPanel
        data={{ orderId: 'order-1', eligibility: [eligibility], returns: [] }}
        canManage
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Nueva devolución o cambio' }));
    fireEvent.change(screen.getByLabelText('Cantidad Tenis Plus'), { target: { value: '2' } });
    expect(screen.getByLabelText('Cantidad Tenis Plus')).toHaveValue(2);

    rerender(
      <OrderDetailReturnsPanel
        data={{ orderId: 'order-2', eligibility: [eligibility], returns: [] }}
        canManage
      />
    );

    expect(screen.getByRole('button', { name: 'Nueva devolución o cambio' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Cantidad Tenis Plus')).not.toBeInTheDocument();
  });

  it('clasifica toda recepción para el cierre de inspección', () => {
    const onAction = vi.fn();
    render(
      <OrderDetailReturnsPanel
        data={{ orderId: 'order-1', eligibility: [], returns: [receivedReturn] }}
        canManage
        onAction={onAction}
      />
    );

    fireEvent.change(screen.getByLabelText('Aptas Tenis Plus'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Cuarentena Tenis Plus'), { target: { value: '1' } });

    expect(screen.getByText('Aptas')).toBeInTheDocument();
    expect(screen.getByText('Vuelven al inventario disponible.')).toBeInTheDocument();
    expect(screen.getByText('Averiadas')).toBeInTheDocument();
    expect(screen.getByText('En cuarentena')).toBeInTheDocument();
    expect(screen.getByText('Rechazadas')).toBeInTheDocument();
    expect(screen.getByText(/La suma de Aptas, Averiadas, En cuarentena y Rechazadas debe ser exactamente 2/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar inspección' }));

    expect(onAction).toHaveBeenCalledWith(
      receivedReturn,
      'inspect',
      {
        items: [expect.objectContaining({
          orderItemId: LINE_ID,
          sellableQuantity: 1,
          quarantineQuantity: 1,
          rejectedQuantity: 0,
        })],
      }
    );
  });

  it('registra únicamente la cantidad recibida elegida por bodega', () => {
    const onAction = vi.fn();
    const authorizedReturn = {
      ...receivedReturn,
      status: 'authorized',
    };
    render(
      <OrderDetailReturnsPanel
        data={{ orderId: 'order-1', eligibility: [], returns: [authorizedReturn] }}
        canManage
        onAction={onAction}
      />
    );

    fireEvent.change(screen.getByLabelText('Recibir Tenis Plus'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar recepción' }));

    expect(onAction).toHaveBeenCalledWith(
      authorizedReturn,
      'receive',
      {
        items: [{ orderItemId: LINE_ID, receivedQuantity: 1 }],
      }
    );
  });

  it('cotiza y genera una guía RMA con ruta cliente a sede', async () => {
    const onShipping = vi.fn()
      .mockResolvedValueOnce({
        rates: [{
          carrier: 'coordinadora',
          service: 'standard',
          serviceDescription: 'Nacional',
          totalPrice: 18500,
          currency: 'COP',
        }],
      })
      .mockResolvedValueOnce({ ok: true });
    const authorizedReturn = {
      ...receivedReturn,
      status: 'authorized',
      policySnapshot: { returnShippingPaidBy: 'store' },
      shipping: { method: 'pending', integration: { status: 'manual' } },
    };
    render(
      <OrderDetailReturnsPanel
        data={{
          orderId: 'order-1',
          eligibility: [],
          returns: [authorizedReturn],
          shippingProviders: { envia: { enabled: true, mode: 'sandbox' } },
          shippingDestinations: [{
            _id: 'branch-1',
            name: 'Sede Principal',
            code: 'MAIN',
            defaultPackages: [{
              weightGrams: 900,
              lengthCm: 30,
              widthCm: 20,
              heightCm: 12,
            }],
          }],
        }}
        canManage
        onShipping={onShipping}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cotizar devolución' }));
    await waitFor(() => expect(screen.getByText('coordinadora')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Generar guía RMA Sandbox' }));

    expect(onShipping).toHaveBeenNthCalledWith(
      1,
      authorizedReturn,
      'quote',
      expect.objectContaining({ destinationBranchId: 'branch-1' })
    );
    await waitFor(() => expect(onShipping).toHaveBeenNthCalledWith(
      2,
      authorizedReturn,
      'label',
      expect.objectContaining({
        confirmStorePaidShipping: true,
        rate: expect.objectContaining({ carrier: 'coordinadora' }),
      })
    ));
  });

  it('bloquea acciones contradictorias después de la llegada reportada por Envia', () => {
    const deliveredReturn = {
      ...receivedReturn,
      status: 'in_transit',
      shipping: {
        carrierName: 'coordinadora',
        trackingNumber: 'RET-DELIVERED-1',
        labelUrl: 'https://labels.example/RET-DELIVERED-1.pdf',
        awaitingWarehouseReceipt: true,
        integration: {
          provider: 'envia',
          status: 'tracking',
          handoffMode: 'pickup',
          pickup: { status: 'completed' },
        },
      },
    };
    render(
      <OrderDetailReturnsPanel
        data={{
          orderId: 'order-1',
          eligibility: [],
          returns: [deliveredReturn],
          shippingProviders: { envia: { enabled: true, mode: 'sandbox' } },
          shippingDestinations: [],
        }}
        canManage
        onShipping={vi.fn()}
      />
    );

    fireEvent.change(
      screen.getByLabelText(`Motivo cancelación ${deliveredReturn.returnNumber}`),
      { target: { value: 'El cliente cambió de decisión' } }
    );
    expect(screen.getByRole('button', { name: 'Cancelar RMA' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Entrega en punto' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancelar guía' })).not.toBeInTheDocument();
    expect(screen.getByText(/falta confirmar las unidades físicas/i)).toBeInTheDocument();
  });

  it('mantiene visible la confirmación de una recolección RMA programada', () => {
    const scheduledReturn = {
      ...receivedReturn,
      status: 'authorized',
      shipping: {
        carrierName: 'coordinadora',
        trackingNumber: 'COORSBX725217',
        labelUrl: 'https://labels.example/COORSBX725217.pdf',
        integration: {
          provider: 'envia',
          status: 'pickup_scheduled',
          handoffMode: 'pickup',
          pickup: {
            status: 'scheduled',
            confirmation: 'AME260831000130',
            requestedDate: '2026-08-31',
            timeFrom: '14:03',
            timeTo: '15:03',
          },
        },
      },
    };
    render(
      <OrderDetailReturnsPanel
        data={{
          orderId: 'order-1',
          eligibility: [],
          returns: [scheduledReturn],
          shippingProviders: { envia: { enabled: true, mode: 'sandbox' } },
          shippingDestinations: [],
        }}
        canManage
        onShipping={vi.fn()}
      />
    );

    expect(screen.getByRole('status', { name: 'Recolección de devolución confirmada' })).toBeInTheDocument();
    expect(screen.getByText('Recolección programada')).toBeInTheDocument();
    expect(screen.getByText('31/08/2026')).toBeInTheDocument();
    expect(screen.getByText('2:03 p. m. a 3:03 p. m.')).toBeInTheDocument();
    expect(screen.getByText('AME260831000130')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Solicitar recolección' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Entrega en punto' })).not.toBeInTheDocument();
  });

  it('muestra un RMA listo para dinero sin habilitarlo a un rol de bodega', () => {
    render(
      <OrderDetailReturnsPanel
        data={{
          orderId: 'order-1',
          eligibility: [],
          returns: [{
            ...receivedReturn,
            status: 'resolution_required',
            estimatedRefundAmount: 120000,
          }],
        }}
        canManage
        canRefund={false}
      />
    );

    expect(screen.getByRole('button', { name: 'Crear reembolso' })).toBeDisabled();
  });

  it('emite saldo a favor por el monto administrado', () => {
    const onStoreCredit = vi.fn();
    const storeCreditReturn = {
      ...receivedReturn,
      status: 'resolution_required',
      requestedResolution: 'store_credit',
    };
    render(
      <OrderDetailReturnsPanel
        data={{ orderId: 'order-1', eligibility: [], returns: [storeCreditReturn] }}
        canRefund
        onStoreCredit={onStoreCredit}
      />
    );

    fireEvent.change(screen.getByLabelText('Monto saldo a favor RMA-ORD-1'), {
      target: { value: '90000' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Emitir saldo a favor' }));

    expect(onStoreCredit).toHaveBeenCalledWith(storeCreditReturn, 90000);
  });

  it('guarda una política versionada y conserva los colores heredados', () => {
    const onSavePolicy = vi.fn();
    render(
      <OrderDetailReturnsPanel
        data={{
          orderId: 'order-1',
          policy: {
            revision: 4,
            windowDays: 30,
            allowedResolutions: ['refund', 'exchange', 'store_credit'],
            customerPortalEnabled: true,
            returnShippingPaidBy: 'case_by_case',
            storeCreditExpirationDays: 365,
          },
          eligibility: [],
          returns: [],
        }}
        canManagePolicy
        onSavePolicy={onSavePolicy}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Configurar política' }));
    fireEvent.change(screen.getByLabelText('Ventana de devoluciones'), { target: { value: '45' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar política' }));

    expect(onSavePolicy).toHaveBeenCalledWith(expect.objectContaining({
      expectedRevision: 4,
      windowDays: 45,
    }));
    expect(document.body.innerHTML).toContain('var(--admin-');
  });

  it('guarda umbrales antifraude y una política especial', () => {
    const onSavePolicy = vi.fn();
    render(
      <OrderDetailReturnsPanel
        data={{
          orderId: 'order-risk',
          policy: {
            revision: 7,
            windowDays: 30,
            allowedResolutions: ['refund', 'exchange'],
            riskControls: {
              enabled: true,
              reviewRequestCount: 3,
              blockRequestCount: 8,
            },
            rules: [],
          },
          eligibility: [],
          returns: [],
        }}
        canManagePolicy
        onSavePolicy={onSavePolicy}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Configurar política' }));
    fireEvent.change(screen.getByLabelText('Solicitudes para revisión'), { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar política especial' }));
    fireEvent.change(screen.getByLabelText('Nombre regla 1'), { target: { value: 'Tecnología sensible' } });
    fireEvent.change(screen.getByLabelText('Valores regla 1'), { target: { value: 'tecnología, tablets' } });
    fireEvent.blur(screen.getByLabelText('Valores regla 1'));
    fireEvent.change(screen.getByLabelText('Resultado regla 1'), { target: { value: 'manual_review' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar política' }));

    expect(onSavePolicy).toHaveBeenCalledWith(expect.objectContaining({
      expectedRevision: 7,
      riskControls: expect.objectContaining({ reviewRequestCount: 4 }),
      rules: [expect.objectContaining({
        name: 'Tecnología sensible',
        requireManualReview: true,
        scope: { type: 'category', values: ['tecnología', 'tablets'] },
      })],
    }));
  });

  it('obliga a documentar la revisión antifraude antes de autorizar', () => {
    const onAction = vi.fn();
    const riskReturn = {
      ...receivedReturn,
      status: 'requested',
      riskAssessment: {
        level: 'high',
        decision: 'manual_review',
        score: 35,
        signals: [{ code: 'policy_manual_review', message: 'La política especial exige revisión manual.' }],
        history: { requestCount: 2, unitCount: 3, amount: 240000, lookbackDays: 90 },
      },
    };
    render(
      <OrderDetailReturnsPanel
        data={{ orderId: 'order-risk', eligibility: [], returns: [riskReturn] }}
        canManage
        onAction={onAction}
      />
    );

    expect(screen.getByText('Revisión antifraude requerida')).toBeInTheDocument();
    const authorize = screen.getByRole('button', { name: 'Autorizar' });
    expect(authorize).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Conclusión antifraude RMA-ORD-1'), {
      target: { value: 'Identidad y compra verificadas.' },
    });
    fireEvent.click(authorize);

    expect(onAction).toHaveBeenCalledWith(
      riskReturn,
      'authorize',
      expect.objectContaining({ riskReviewNote: 'Identidad y compra verificadas.' })
    );
  });

  it('ofrece creación automática para un cambio inspeccionado', () => {
    const onAutomaticExchange = vi.fn();
    const exchange = {
      ...receivedReturn,
      status: 'resolution_required',
      requestedResolution: 'exchange',
      revision: 6,
    };
    render(
      <OrderDetailReturnsPanel
        data={{ orderId: 'order-1', policy: { automaticExchangeEnabled: true }, eligibility: [], returns: [exchange] }}
        canManage
        onAutomaticExchange={onAutomaticExchange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Crear orden de cambio' }));
    expect(onAutomaticExchange).toHaveBeenCalledWith(exchange, 'Cambio automático por RMA');
  });
});
