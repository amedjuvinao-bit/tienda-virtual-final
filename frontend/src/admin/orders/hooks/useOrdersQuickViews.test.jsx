import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import useOrdersQuickViews from './useOrdersQuickViews';

function setup() {
  const callbacks = {
    setPage: vi.fn(),
    setDateFrom: vi.fn(),
    setDateTo: vi.fn(),
    setStatusFilter: vi.fn(),
    clearStatus: vi.fn(),
  };
  const view = renderHook(() => useOrdersQuickViews(callbacks));
  return { ...callbacks, ...view };
}

describe('colas operativas de órdenes', () => {
  it('aplica una cola logística y limpia filtros incompatibles', () => {
    const state = setup();

    act(() => state.result.current.applyQuickView('dispatch'));

    expect(state.result.current.quickView).toBe('dispatch');
    expect(state.result.current.operationalView).toBe('dispatch');
    expect(state.setDateFrom).toHaveBeenCalledWith('');
    expect(state.setDateTo).toHaveBeenCalledWith('');
    expect(state.clearStatus).toHaveBeenCalled();
    expect(state.setPage).toHaveBeenCalledWith(1);
  });

  it('restablece la operación completa sin conservar la cola anterior', () => {
    const state = setup();

    act(() => state.result.current.applyQuickView('incidents'));
    expect(state.result.current.operationalView).toBe('incidents');

    act(() => state.result.current.applyQuickView('all'));
    expect(state.result.current.quickView).toBe('all');
    expect(state.result.current.operationalView).toBe('all');
    expect(state.result.current.archivedFilter).toBe('active');
  });
});
