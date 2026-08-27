import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import api from '../../../../../lib/api';
import useOrderDetailResources from './useOrderDetailResources';

vi.mock('../../../../../lib/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe('recursos auxiliares del detalle de orden', () => {
  it('no mezcla el timeline anterior cuando dos cargas terminan fuera de orden', async () => {
    let resolveFirstTimeline;
    const firstTimeline = new Promise((resolve) => {
      resolveFirstTimeline = resolve;
    });

    api.get.mockImplementation((url) => {
      if (url === '/api/orders/order-a/timeline') return firstTimeline;
      if (url === '/api/orders/order-b/timeline') {
        return Promise.resolve({ data: { data: [{ _id: 'event-b' }] } });
      }
      if (url.endsWith('/refunds')) return Promise.resolve({ data: { refunds: [] } });
      if (url.endsWith('/returns')) {
        return Promise.resolve({
          data: { policy: {}, eligibility: [], returns: [] },
        });
      }
      return Promise.resolve({ data: { data: [] } });
    });

    const { result, rerender } = renderHook(
      ({ orderId }) => useOrderDetailResources({
        open: true,
        orderId,
        showToast: vi.fn(),
      }),
      { initialProps: { orderId: 'order-a' } }
    );

    rerender({ orderId: 'order-b' });

    await waitFor(() => {
      expect(result.current.timeline).toEqual([{ _id: 'event-b' }]);
    });

    await act(async () => {
      resolveFirstTimeline({ data: { data: [{ _id: 'event-a' }] } });
      await firstTimeline;
    });

    expect(result.current.timeline).toEqual([{ _id: 'event-b' }]);
  });

  it('pagina el historial sin duplicar eventos ya cargados', async () => {
    api.get.mockImplementation((url, config = {}) => {
      if (url.endsWith('/timeline')) {
        if (config.params?.cursor === 'event-2') {
          return Promise.resolve({
            data: {
              data: [{ _id: 'event-2' }, { _id: 'event-1' }],
              pagination: { hasMore: false, nextCursor: null },
            },
          });
        }
        return Promise.resolve({
          data: {
            data: [{ _id: 'event-3' }, { _id: 'event-2' }],
            pagination: { hasMore: true, nextCursor: 'event-2' },
          },
        });
      }
      if (url.endsWith('/refunds')) return Promise.resolve({ data: { refunds: [] } });
      if (url.endsWith('/returns')) {
        return Promise.resolve({ data: { policy: {}, eligibility: [], returns: [] } });
      }
      return Promise.resolve({ data: { data: [], pagination: { hasMore: false } } });
    });

    const { result } = renderHook(() => useOrderDetailResources({
      open: true,
      orderId: 'order-page',
      showToast: vi.fn(),
    }));

    await waitFor(() => {
      expect(result.current.timelineHasMore).toBe(true);
    });

    await act(async () => {
      await result.current.loadMoreTimeline();
    });

    expect(result.current.timeline.map((event) => event._id)).toEqual([
      'event-3',
      'event-2',
      'event-1',
    ]);
    expect(result.current.timelineHasMore).toBe(false);
  });
});
