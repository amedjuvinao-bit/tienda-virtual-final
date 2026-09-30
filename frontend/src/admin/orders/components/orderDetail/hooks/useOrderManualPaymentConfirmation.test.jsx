import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import api from '../../../../../lib/api';
import useOrderManualPaymentConfirmation from './useOrderManualPaymentConfirmation';

vi.mock('../../../../../lib/api', () => ({
  default: { post: vi.fn(), get: vi.fn() },
}));

const ORDER = {
  _id: 'order-manual-1',
  status: 'pending',
  payment: {
    provider: 'manual',
    status: 'pending_manual',
    amount: 250000,
    currency: 'COP',
  },
};

function renderManualHook(overrides = {}) {
  const callbacks = {
    synchronizeAfterMutation: vi.fn().mockResolvedValue(ORDER),
    fetchTimeline: vi.fn().mockResolvedValue([]),
    showToast: vi.fn(),
    ...overrides,
  };
  const hook = renderHook((props) => useOrderManualPaymentConfirmation(props), {
    initialProps: {
      open: true,
      order: ORDER,
      canConfirmManualPayment: true,
      ...callbacks,
    },
  });
  return { ...hook, callbacks };
}

function completeForm(result) {
  act(() => {
    result.current.setField('method', 'transfer');
    result.current.setField('reference', 'TRX-2026-001');
    result.current.setField('reason', 'Transferencia verificada en el banco');
    result.current.setField('verified', true);
  });
}

afterEach(() => vi.clearAllMocks());

describe('confirmación manual de pago', () => {
  it('envía el contrato exacto, refresca orden/timeline y notifica éxito', async () => {
    api.post.mockResolvedValue({
      data: { confirmed: true, duplicate: false, order: { ...ORDER, status: 'paid' } },
    });
    const { result, callbacks } = renderManualHook();
    completeForm(result);

    await act(async () => result.current.submit());

    expect(api.post).toHaveBeenCalledWith(
      '/api/orders/order-manual-1/payments/manual-confirmation',
      {
        method: 'transfer',
        reference: 'TRX-2026-001',
        amount: 250000,
        currency: 'COP',
        reason: 'Transferencia verificada en el banco',
      },
      { timeout: 90000 }
    );
    expect(callbacks.synchronizeAfterMutation).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'paid' }),
      [callbacks.fetchTimeline]
    );
    expect(callbacks.showToast).toHaveBeenCalledWith(expect.objectContaining({
      type: 'success',
      title: 'Pago manual confirmado',
    }));
  });

  it('trata el replay idéntico como éxito informativo, no como error', async () => {
    api.post.mockResolvedValue({
      data: { confirmed: false, duplicate: true, order: { ...ORDER, status: 'paid' } },
    });
    const { result, callbacks } = renderManualHook();
    completeForm(result);

    await act(async () => result.current.submit());

    expect(callbacks.showToast).toHaveBeenCalledWith(expect.objectContaining({
      type: 'info',
      title: 'Pago ya confirmado',
    }));
  });

  it('muestra el mensaje seguro del backend y no refresca ante error', async () => {
    api.post.mockRejectedValue({
      response: { data: { message: 'La referencia ya fue utilizada.' } },
    });
    const { result, callbacks } = renderManualHook();
    completeForm(result);

    await act(async () => result.current.submit());

    expect(callbacks.synchronizeAfterMutation).not.toHaveBeenCalled();
    expect(api.get).not.toHaveBeenCalled();
    expect(callbacks.showToast).toHaveBeenCalledWith(expect.objectContaining({
      type: 'error',
      message: 'La referencia ya fue utilizada.',
    }));
  });

  it('reconcilia un timeout con la evidencia guardada sin requerir un segundo clic', async () => {
    api.post.mockRejectedValue({ code: 'ECONNABORTED' });
    const paidOrder = {
      ...ORDER,
      status: 'paid',
      payment: {
        ...ORDER.payment,
        status: 'paid',
        manualConfirmation: {
          method: 'transfer',
          reference: 'TRX-2026-001',
          amount: 250000,
          currency: 'COP',
          reason: 'Transferencia verificada en el banco',
        },
      },
    };
    api.get.mockResolvedValue({ data: paidOrder });
    const { result, callbacks } = renderManualHook();
    completeForm(result);

    const outcome = await act(async () => result.current.submit());

    expect(outcome).toMatchObject({ confirmed: true, reconciled: true });
    expect(api.get).toHaveBeenCalledWith('/api/orders/order-manual-1');
    expect(callbacks.synchronizeAfterMutation).toHaveBeenCalledWith(
      paidOrder,
      [callbacks.fetchTimeline]
    );
    expect(callbacks.showToast).toHaveBeenCalledWith(expect.objectContaining({
      type: 'success',
      title: 'Pago manual confirmado',
    }));
  });

  it('no reporta éxito si otra evidencia pagó la orden', async () => {
    api.post.mockRejectedValue({ response: { status: 500 } });
    api.get.mockResolvedValue({ data: {
      ...ORDER,
      status: 'paid',
      payment: { ...ORDER.payment, status: 'paid', manualConfirmation: {
        method: 'transfer', reference: 'OTRA-REFERENCIA', amount: 250000,
        currency: 'COP', reason: 'Transferencia verificada en el banco',
      } },
    } });
    const { result, callbacks } = renderManualHook();
    completeForm(result);

    const outcome = await act(async () => result.current.submit());

    expect(outcome.confirmed).toBeUndefined();
    expect(callbacks.showToast).toHaveBeenCalledWith(expect.objectContaining({
      type: 'warning', title: 'Revisa el pago de la orden',
    }));
  });

  it('mantiene el resultado incierto si no puede consultar la orden', async () => {
    api.post.mockRejectedValue({ code: 'ECONNABORTED' });
    api.get.mockRejectedValue(new Error('network down'));
    const { result, callbacks } = renderManualHook();
    completeForm(result);

    const outcome = await act(async () => result.current.submit());

    expect(outcome.unverified).toBe(true);
    expect(callbacks.showToast).toHaveBeenCalledWith(expect.objectContaining({
      type: 'warning', title: 'Verifica el estado del pago',
    }));
  });

  it('un fallo al refrescar no cambia el éxito ya confirmado por el servidor', async () => {
    api.post.mockResolvedValue({ data: { confirmed: true, order: { ...ORDER, status: 'paid' } } });
    const { result, callbacks } = renderManualHook({
      synchronizeAfterMutation: vi.fn().mockRejectedValue(new Error('refresh failed')),
    });
    completeForm(result);

    const outcome = await act(async () => result.current.submit());

    expect(outcome.confirmed).toBe(true);
    expect(callbacks.showToast).toHaveBeenCalledWith(expect.objectContaining({
      type: 'success', title: 'Pago manual confirmado',
    }));
  });

  it('bloquea doble envío e ignora una respuesta si cambia la orden', async () => {
    let resolveRequest;
    api.post.mockImplementation(() => new Promise((resolve) => {
      resolveRequest = resolve;
    }));
    const { result, rerender, callbacks } = renderManualHook();
    completeForm(result);

    let first;
    await act(async () => {
      first = result.current.submit();
      const second = await result.current.submit();
      expect(second).toBeNull();
    });
    expect(api.post).toHaveBeenCalledTimes(1);

    rerender({
      open: true,
      order: { ...ORDER, _id: 'order-manual-2' },
      canConfirmManualPayment: true,
      ...callbacks,
    });
    await act(async () => {
      resolveRequest({ data: { confirmed: true, order: { ...ORDER, status: 'paid' } } });
      await first;
    });

    await waitFor(() => expect(result.current.submitting).toBe(false));
    expect(callbacks.synchronizeAfterMutation).not.toHaveBeenCalled();
    expect(callbacks.showToast).not.toHaveBeenCalled();
  });

  it('ignora también la respuesta si el detalle se cierra', async () => {
    let resolveRequest;
    api.post.mockImplementation(() => new Promise((resolve) => {
      resolveRequest = resolve;
    }));
    const { result, rerender, callbacks } = renderManualHook();
    completeForm(result);

    let pending;
    await act(async () => {
      pending = result.current.submit();
    });
    rerender({
      open: false,
      order: ORDER,
      canConfirmManualPayment: true,
      ...callbacks,
    });
    await act(async () => {
      resolveRequest({ data: { confirmed: true, order: { ...ORDER, status: 'paid' } } });
      await pending;
    });

    expect(callbacks.synchronizeAfterMutation).not.toHaveBeenCalled();
    expect(callbacks.showToast).not.toHaveBeenCalled();
  });

  it('nunca llama el endpoint para Wompi, PayU o sin permiso', async () => {
    const { result, rerender } = renderManualHook();
    rerender({
      open: true,
      order: { ...ORDER, payment: { ...ORDER.payment, provider: 'wompi' } },
      canConfirmManualPayment: true,
      synchronizeAfterMutation: vi.fn(),
      fetchTimeline: vi.fn(),
      showToast: vi.fn(),
    });
    expect(result.current.eligible).toBe(false);
    await act(async () => result.current.submit());

    rerender({
      open: true,
      order: { ...ORDER, payment: { ...ORDER.payment, provider: 'payu' } },
      canConfirmManualPayment: false,
      synchronizeAfterMutation: vi.fn(),
      fetchTimeline: vi.fn(),
      showToast: vi.fn(),
    });
    await act(async () => result.current.submit());
    expect(api.post).not.toHaveBeenCalled();
  });
});
