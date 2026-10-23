import { expect, it, vi } from 'vitest';
import { installPageDraftNavigationGuard, registerPageDraftNavigationGuard } from './pageDraftNavigationGuard';

it('cancels navigation before the router receives it and releases the guard on cleanup', () => {
  const addListener = vi.spyOn(window, 'addEventListener');
  installPageDraftNavigationGuard();
  installPageDraftNavigationGuard();
  expect(addListener.mock.calls.filter(([type]) => type === 'popstate')).toHaveLength(1);
  addListener.mockRestore();

  const router = vi.fn();
  window.addEventListener('popstate', router);
  const guard = vi.fn((event) => event.stopImmediatePropagation());
  const unregister = registerPageDraftNavigationGuard(guard);
  try {
    window.dispatchEvent(new PopStateEvent('popstate', { state: { idx: 0 } }));
    expect(guard).toHaveBeenCalledOnce();
    expect(router).not.toHaveBeenCalled();
    unregister();
    window.dispatchEvent(new PopStateEvent('popstate', { state: { idx: 1 } }));
    expect(router).toHaveBeenCalledOnce();
  } finally {
    unregister();
    window.removeEventListener('popstate', router);
  }
});
