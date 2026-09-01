import React, { StrictMode } from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, renderHook, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const apiState = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock('../../../lib/api', () => ({
  default: apiState,
}));

import useOrdersAdminQuery, {
  buildOrdersAdminRequestParams,
  clearOrdersAdminQueryInflight,
} from './useOrdersAdminQuery';
import useOrdersAdminFilters from './useOrdersAdminFilters';
import useOrdersAdminSelectionActions from './useOrdersAdminSelectionActions';

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

  it('navega con cursores canónicos, conserva el resumen y permite volver atrás', async () => {
    apiState.get
      .mockResolvedValueOnce({
        data: {
          data: [{ _id: 'cursor-page-1' }],
          total: 41,
          totalPages: 3,
          financialSummary: { totalOrders: 41, totalSales: 900000 },
          operationalSummary: { total: 41, attention: 4 },
          summaryIncluded: true,
          paginationMode: 'cursor',
          hasMore: true,
          nextCursor: 'cursor-after-page-1',
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: [{ _id: 'cursor-page-2' }],
          summaryIncluded: false,
          paginationMode: 'cursor',
          hasMore: true,
          nextCursor: 'cursor-after-page-2',
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: [{ _id: 'cursor-page-1-again' }],
          summaryIncluded: false,
          paginationMode: 'cursor',
          hasMore: true,
          nextCursor: 'cursor-after-page-1',
        },
      });

    const params = {
      page: 1,
      pagination: 'cursor',
      limit: 20,
      sort: 'createdAt:-1',
      status: 'paid',
    };
    const { result } = renderHook(() =>
      useOrdersAdminQuery({ ...authenticated, params })
    );

    await waitFor(() => expect(result.current.canGoNext).toBe(true));
    expect(apiState.get.mock.calls[0][1].params).toMatchObject({
      pagination: 'cursor',
      limit: 20,
      sort: 'createdAt:-1',
      status: 'paid',
      includeSummary: 1,
    });
    expect(apiState.get.mock.calls[0][1].params).not.toHaveProperty('page');
    expect(apiState.get.mock.calls[0][1].params).not.toHaveProperty('cursor');

    act(() => result.current.goToNextCursorPage());
    await waitFor(() => expect(result.current.data[0]?._id).toBe('cursor-page-2'));

    expect(result.current.page).toBe(2);
    expect(result.current.canGoPrevious).toBe(true);
    expect(apiState.get.mock.calls[1][1].params).toMatchObject({
      pagination: 'cursor',
      cursor: 'cursor-after-page-1',
      sort: 'createdAt:-1',
      includeSummary: 0,
    });
    expect(apiState.get.mock.calls[1][1].params).not.toHaveProperty('page');
    expect(result.current.financialSummary.totalSales).toBe(900000);

    act(() => result.current.goToPreviousCursorPage());
    await waitFor(() =>
      expect(result.current.data[0]?._id).toBe('cursor-page-1-again')
    );

    expect(result.current.page).toBe(1);
    expect(result.current.canGoPrevious).toBe(false);
    expect(apiState.get.mock.calls[2][1].params.includeSummary).toBe(0);
    expect(apiState.get.mock.calls[2][1].params).not.toHaveProperty('cursor');
  });

  it('reinicia la pila al cambiar filtros, sort o límite y conserva page como fallback', async () => {
    apiState.get
      .mockResolvedValueOnce({
        data: {
          data: [{ _id: 'first' }],
          total: 30,
          totalPages: 2,
          summaryIncluded: true,
          hasMore: true,
          nextCursor: 'next-first',
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: [{ _id: 'second' }],
          summaryIncluded: false,
          hasMore: false,
          nextCursor: null,
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: [{ _id: 'filtered' }],
          total: 30,
          totalPages: 2,
          summaryIncluded: true,
          hasMore: true,
          nextCursor: 'next-filtered',
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: [{ _id: 'filtered-second' }],
          summaryIncluded: false,
          hasMore: false,
          nextCursor: null,
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: [{ _id: 'limit-reset' }],
          summaryIncluded: false,
          hasMore: false,
          nextCursor: null,
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: [{ _id: 'page-fallback' }],
          summaryIncluded: false,
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: [{ _id: 'canonical-again' }],
          summaryIncluded: false,
          hasMore: false,
          nextCursor: null,
        },
      });

    const initialProps = {
      params: {
        page: 1,
        pagination: 'cursor',
        limit: 20,
        sort: 'createdAt:-1',
      },
    };
    const { result, rerender } = renderHook(
      ({ params }) => useOrdersAdminQuery({ ...authenticated, params }),
      { initialProps }
    );

    await waitFor(() => expect(result.current.canGoNext).toBe(true));
    act(() => result.current.goToNextCursorPage());
    await waitFor(() => expect(result.current.page).toBe(2));

    rerender({
      params: {
        ...initialProps.params,
        q: 'cliente nuevo',
      },
    });
    expect(result.current.page).toBe(1);
    await waitFor(() => expect(result.current.data[0]?._id).toBe('filtered'));
    expect(apiState.get.mock.calls[2][1].params).not.toHaveProperty('cursor');
    expect(apiState.get.mock.calls[2][1].params.includeSummary).toBe(1);

    act(() => result.current.goToNextCursorPage());
    await waitFor(() => expect(result.current.data[0]?._id).toBe('filtered-second'));
    expect(result.current.page).toBe(2);

    rerender({
      params: {
        ...initialProps.params,
        q: 'cliente nuevo',
        limit: 50,
      },
    });
    expect(result.current.page).toBe(1);
    await waitFor(() => expect(result.current.data[0]?._id).toBe('limit-reset'));
    expect(apiState.get.mock.calls[4][1].params.includeSummary).toBe(0);
    expect(apiState.get.mock.calls[4][1].params).not.toHaveProperty('cursor');

    rerender({
      params: {
        ...initialProps.params,
        q: 'cliente nuevo',
        limit: 50,
        sort: 'total:-1',
      },
    });
    await waitFor(() => expect(result.current.data[0]?._id).toBe('page-fallback'));
    expect(result.current.cursorMode).toBe(false);
    expect(apiState.get.mock.calls[5][1].params).toMatchObject({
      page: 1,
      limit: 50,
      sort: 'total:-1',
    });
    expect(apiState.get.mock.calls[5][1].params).not.toHaveProperty('pagination');

    rerender({
      params: {
        ...initialProps.params,
        q: 'cliente nuevo',
        limit: 50,
      },
    });
    expect(result.current.page).toBe(1);
    await waitFor(() => expect(result.current.data[0]?._id).toBe('canonical-again'));
    expect(apiState.get.mock.calls[6][1].params).not.toHaveProperty('cursor');

    expect(buildOrdersAdminRequestParams({
      page: 4,
      pagination: 'cursor',
      limit: 50,
      sort: 'total:-1',
    }, 'cursor-that-must-not-leak')).toEqual({
      cursorMode: false,
      params: {
        page: 4,
        limit: 50,
        sort: 'total:-1',
      },
    });
  });
});

describe('composición de filtros de OrdersAdmin', () => {
  it('mantiene el orquestador y sus módulos dentro de los límites arquitectónicos', () => {
    const mainSource = readFileSync(
      resolve(process.cwd(), 'src/admin/OrdersAdmin.jsx'),
      'utf8'
    );
    const modulePaths = [
      'src/admin/orders/hooks/useOrdersAdminCapabilities.js',
      'src/admin/orders/hooks/useOrdersAdminDetail.js',
      'src/admin/orders/hooks/useOrdersAdminFilters.js',
      'src/admin/orders/hooks/useOrdersAdminSelectionActions.js',
      'src/admin/orders/ordersAdminModel.js',
    ];

    expect(mainSource.split(/\r?\n/).length).toBeLessThanOrEqual(500);
    expect(mainSource).not.toContain("from '../lib/api'");
    expect(mainSource).not.toContain('useState(');
    expect(mainSource).toContain('useOrdersAdminFilters');
    expect(mainSource).toContain('useOrdersAdminSelectionActions');
    expect(mainSource).toContain('useOrdersAdminDetail');

    modulePaths.forEach((modulePath) => {
      const source = readFileSync(resolve(process.cwd(), modulePath), 'utf8');
      expect(source.split(/\r?\n/).length).toBeLessThanOrEqual(400);
    });
  });

  it('mantiene OrdersFilters como orquestador pequeño con módulos cohesivos', () => {
    const filtersSource = readFileSync(
      resolve(process.cwd(), 'src/admin/orders/components/OrdersFilters.jsx'),
      'utf8'
    );
    const controlPanelSource = readFileSync(
      resolve(process.cwd(), 'src/admin/orders/components/OrdersFiltersControlPanel.jsx'),
      'utf8'
    );
    const filterModulePaths = [
      'src/admin/orders/components/OrdersFilterUi.jsx',
      'src/admin/orders/components/OrdersFiltersControlPanel.jsx',
      'src/admin/orders/components/OrdersFiltersSummary.jsx',
      'src/admin/orders/components/OrdersSearchDateFields.jsx',
      'src/admin/orders/components/OrdersStatusTagsFields.jsx',
      'src/admin/orders/components/OrdersViewOptionsFields.jsx',
      'src/admin/orders/components/ordersFiltersModel.js',
    ];

    expect(filtersSource.split(/\r?\n/).length).toBeLessThanOrEqual(250);
    expect(filtersSource).toContain('OrdersFiltersControlPanel');
    expect(filtersSource).toContain('OrdersFiltersSummary');
    expect(filtersSource).toContain('buildOrdersFilterMetrics');
    expect(filtersSource).not.toContain('lucide-react');
    expect(controlPanelSource).toContain('OrdersSearchDateFields');
    expect(controlPanelSource).toContain('OrdersStatusField');
    expect(controlPanelSource).toContain('OrdersTagsFields');
    expect(controlPanelSource).toContain('OrdersViewOptionsFields');

    filterModulePaths.forEach((modulePath) => {
      const source = readFileSync(resolve(process.cwd(), modulePath), 'utf8');
      expect(source.split(/\r?\n/).length).toBeLessThanOrEqual(350);
    });
  });

  it('normaliza el filtro del dashboard y compone una cola operativa compatible', () => {
    const wrapper = ({ children }) => (
      <MemoryRouter initialEntries={['/admin/ordenes?status=paid,failed,desconocido']}>
        {children}
      </MemoryRouter>
    );
    const { result } = renderHook(
      () => useOrdersAdminFilters({
        authLoading: false,
        canView: true,
        canViewBranches: false,
        hasSession: true,
      }),
      { wrapper }
    );

    expect(result.current.params).toMatchObject({
      archived: 0,
      page: 1,
      pagination: 'cursor',
      status: 'paid,failed',
    });

    act(() => result.current.quickViews.applyQuickView('dispatch'));

    expect(result.current.params).toMatchObject({
      archived: 0,
      operationalView: 'dispatch',
      page: 1,
      pagination: 'cursor',
    });
    expect(result.current.params).not.toHaveProperty('status');
  });

  it('inicia la búsqueda con la orden recibida por enlace profundo', () => {
    const wrapper = ({ children }) => (
      <MemoryRouter initialEntries={['/admin/ordenes?q=ORD-360-001']}>
        {children}
      </MemoryRouter>
    );
    const { result } = renderHook(
      () => useOrdersAdminFilters({
        authLoading: false,
        canView: true,
        canViewBranches: false,
        hasSession: true,
      }),
      { wrapper }
    );

    expect(result.current.typingQuery).toBe('ORD-360-001');
    expect(result.current.params.q).toBe('ORD-360-001');
  });

  it('limita la selección a las órdenes visibles y la revoca sin capacidad', () => {
    const initialProps = {
      data: [{ _id: 'order-1' }, { _id: 'order-2' }],
      selectionEnabled: true,
    };
    const { result, rerender } = renderHook(
      ({ data, selectionEnabled }) => useOrdersAdminSelectionActions({
        canBulk: true,
        canExport: false,
        data,
        params: { page: 1 },
        requireSessionAndPermission: () => true,
        selectionEnabled,
        setData: vi.fn(),
      }),
      { initialProps }
    );

    act(() => result.current.toggleOne('order-1'));
    expect(Array.from(result.current.selectedIds)).toEqual(['order-1']);

    rerender({ data: [{ _id: 'order-2' }], selectionEnabled: true });
    expect(result.current.selectedIds.size).toBe(0);

    act(() => result.current.toggleOne('order-2'));
    expect(result.current.selectedIds.has('order-2')).toBe(true);
    rerender({ data: [{ _id: 'order-2' }], selectionEnabled: false });
    expect(result.current.selectedIds.size).toBe(0);
  });
});
