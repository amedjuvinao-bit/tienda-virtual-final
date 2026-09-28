import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import useOrderInvoiceStatusWatcher from './useOrderInvoiceStatusWatcher';

const pendingOrder = {
  _id: 'order-1',
  payment: { status: 'paid' },
  invoiceAutomation: { status: 'pending' },
};

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('seguimiento de la factura posterior al pago', () => {
  it('actualiza una orden abierta y avisa una sola vez cuando Factus acepta', async () => {
    vi.useFakeTimers();
    const synchronizeAfterMutation = vi.fn().mockResolvedValue({
      ...pendingOrder,
      invoiceAutomation: { status: 'scheduled' },
      electronicInvoice: { status: 'accepted' },
    });
    const showToast = vi.fn();
    renderHook(() => useOrderInvoiceStatusWatcher({
      open: true,
      order: pendingOrder,
      synchronizeAfterMutation,
      showToast,
    }));

    await act(async () => vi.advanceTimersByTimeAsync(5000));
    expect(synchronizeAfterMutation).toHaveBeenCalledWith(null, []);
    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Factura electrónica aceptada',
    }));
    await act(async () => vi.advanceTimersByTimeAsync(60000));
    expect(synchronizeAfterMutation).toHaveBeenCalledTimes(1);
  });

  it('muestra corrección requerida y detiene consultas al cerrar el detalle', async () => {
    vi.useFakeTimers();
    const synchronizeAfterMutation = vi.fn().mockResolvedValue({
      ...pendingOrder,
      invoiceAutomation: {
        status: 'needs_review',
        failureReason: 'Falta el apellido fiscal.',
      },
    });
    const showToast = vi.fn();
    const { unmount } = renderHook(() => useOrderInvoiceStatusWatcher({
      open: true,
      order: pendingOrder,
      synchronizeAfterMutation,
      showToast,
    }));

    await act(async () => vi.advanceTimersByTimeAsync(5000));
    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({
      type: 'warning',
      message: 'Falta el apellido fiscal.',
    }));
    unmount();
    await act(async () => vi.advanceTimersByTimeAsync(60000));
    expect(synchronizeAfterMutation).toHaveBeenCalledTimes(1);
  });
});
