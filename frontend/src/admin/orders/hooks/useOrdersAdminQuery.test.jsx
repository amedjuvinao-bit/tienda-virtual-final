import React, { StrictMode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const apiState = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock('../../../lib/api', () => ({
  default: apiState,
}));

import useOrdersAdminQuery, {
  clearOrdersAdminQueryInflight,
} from './useOrdersAdminQuery';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

const authenticated = {
  authLoading: false,
  hasSession: true,
  canView: true,
};

describe('useOrdersAdminQuery', () => {
  beforeEach(() => {
    apiState.get.mockReset();
    clearOrdersAdminQueryInflight();
  });

  afterEach(() => {
    clearOrdersAdminQueryInflight();
  });

  it('reutiliza una única solicitud durante el doble efecto de StrictMode', async () => {
    const pending = deferred();
    apiState.get.mockReturnValue(pending.promise);
    const params = { page: 1, limit: 20, sort: 'createdAt:-1' };
    const wrapper = ({ children }) => <StrictMode>{children}</StrictMode>;

    const { result } = renderHook(
      () => useOrdersAdminQuery({ ...authenticated, params }),
      { wrapper }
    );

    expect(apiState.get).toHaveBeenCalledTimes(1);
    const strictModeSignal = apiState.get.mock.calls[0][1].signal;
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(strictModeSignal.aborted).toBe(false);

    await act(async () => {
      pending.resolve({
        data: {
          data: [{ _id: 'order-1', orderNumber: 'ORD-001' }],
          total: 1,
          totalPages: 1,
          financialSummary: { totalOrders: 1 },
          summaryIncluded: true,
        },
      });
      await pending.promise;
    });

    await waitFor(() => expect(result.current.data).toHaveLength(1));
    expect(result.current.total).toBe(1);
    expect(result.current.loading).toBe(false);
  });

  it('ignora una respuesta antigua cuando los filtros cambian rápidamente', async () => {
    const oldRequest = deferred();
    const newRequest = deferred();
    apiState.get
      .mockReturnValueOnce(oldRequest.promise)
      .mockReturnValueOnce(newRequest.promise);

    const initialProps = {
      params: { page: 1, limit: 20, q: 'anterior' },
    };
    const { result, rerender } = renderHook(
      ({ params }) => useOrdersAdminQuery({ ...authenticated, params }),
      { initialProps }
    );

    rerender({ params: { page: 1, limit: 20, q: 'actual' } });
    expect(apiState.get).toHaveBeenCalledTimes(2);
    const obsoleteSignal = apiState.get.mock.calls[0][1].signal;
    const currentSignal = apiState.get.mock.calls[1][1].signal;

    await waitFor(() => expect(obsoleteSignal.aborted).toBe(true));
    expect(currentSignal.aborted).toBe(false);

    await act(async () => {
      newRequest.resolve({
        data: {
          data: [{ _id: 'new', orderNumber: 'ORD-ACTUAL' }],
          total: 1,
          totalPages: 1,
          financialSummary: { totalOrders: 1 },
          summaryIncluded: true,
        },
      });
      await newRequest.promise;
    });

    await waitFor(() =>
      expect(result.current.data[0]?.orderNumber).toBe('ORD-ACTUAL')
    );

    await act(async () => {
      oldRequest.resolve({
        data: {
          data: [{ _id: 'old', orderNumber: 'ORD-ANTERIOR' }],
          total: 99,
          totalPages: 5,
          financialSummary: { totalOrders: 99 },
          summaryIncluded: true,
        },
      });
      await oldRequest.promise;
    });

    expect(result.current.data[0]?.orderNumber).toBe('ORD-ACTUAL');
    expect(result.current.total).toBe(1);
  });

  it('conserva métricas al paginar y solicita únicamente la nueva página', async () => {
    apiState.get
      .mockResolvedValueOnce({
        data: {
          data: [{ _id: 'page-1' }],
          total: 41,
          totalPages: 3,
          financialSummary: { totalOrders: 41, totalSales: 900000 },
          operationalSummary: { total: 41, attention: 4, prepare: 8 },
          summaryIncluded: true,
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: [{ _id: 'page-2' }],
          summaryIncluded: false,
        },
      });

    const { result, rerender } = renderHook(
      ({ params }) => useOrdersAdminQuery({ ...authenticated, params }),
      {
        initialProps: {
          params: { page: 1, limit: 20, sort: 'createdAt:-1', status: 'paid' },
        },
      }
    );

    await waitFor(() => expect(result.current.total).toBe(41));
    rerender({
      params: { page: 2, limit: 20, sort: 'createdAt:-1', status: 'paid' },
    });
    await waitFor(() => expect(result.current.data[0]?._id).toBe('page-2'));

    expect(apiState.get.mock.calls[1][1].params.includeSummary).toBe(0);
    expect(result.current.total).toBe(41);
    expect(result.current.financialSummary.totalSales).toBe(900000);
    expect(result.current.operationalSummary.attention).toBe(4);
  });
});
