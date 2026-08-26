import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
