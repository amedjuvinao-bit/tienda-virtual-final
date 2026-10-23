import { afterEach, expect, it, vi } from 'vitest';
import { captureStorefrontPosition, readScrollPositions, restoreStorefrontPosition, storefrontHistoryKey, writeScrollPositions, SCROLL_POSITIONS_KEY, SCROLL_RESTORE_START, SCROLL_RESTORED } from './storefrontScrollRestoration';

let cancel;
afterEach(() => { cancel?.(); cancel = null; document.body.innerHTML = ''; delete document.documentElement.dataset.storefrontRestoring; sessionStorage.clear(); window.history.replaceState(null, ''); vi.restoreAllMocks(); });

function fixture() {
  let y = 0, now = 0, id = 0;
  const queue = new Map(), heights = [800, 1000, 800];
  vi.spyOn(window, 'scrollY', 'get').mockImplementation(() => y);
  vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1200);
  vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(800);
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => { queue.set(++id, cb); return id; });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(key => queue.delete(key));
  vi.spyOn(document.documentElement, 'scrollHeight', 'get').mockImplementation(() => heights.reduce((a, b) => a + b, 0));
  vi.spyOn(window, 'scrollTo').mockImplementation(({ top }) => { y = top; });
  document.body.innerHTML = '<div id="root"><div class="storefront-sections"><section id="banner"></section><section id="categorias"></section><section id="informacion"></section></div></div>';
  const nodes = [...document.querySelectorAll('section')];
  nodes.forEach((node, index) => {
    Object.defineProperty(node, 'offsetHeight', { get: () => heights[index] });
    Object.defineProperty(node, 'offsetTop', { get: () => heights.slice(0, index).reduce((a, b) => a + b, 0) });
  });
  const advance = (ms = 300) => { const end = now + ms; while (now < end) { now += 25; const callbacks = [...queue.values()]; queue.clear(); callbacks.forEach(cb => cb(now)); } };
  return { nodes, heights, advance, setY: value => { y = value; }, getY: () => y, queue };
}

it('captures the actual section and local offset independently of a stale URL hash and sticky rectangles', () => {
  const f = fixture(); f.setY(1060); f.nodes[1].dataset.storyTop = '800';
  f.nodes[1].getBoundingClientRect = () => ({ top: -40 });
  expect(captureStorefrontPosition(window, true)).toMatchObject({ y: 1060, section: 'categorias', offset: 260, height: 1000, heights: [['banner', 800], ['categorias', 1000]] });
});

it('restores the saved section instantly, never runs through a different URL anchor, and signals before revealing it', () => {
  const f = fixture(); f.setY(1060); const snapshot = captureStorefrontPosition(window, true); f.setY(0);
  const start = vi.fn(), finish = vi.fn(() => expect(document.documentElement.dataset.storefrontRestoring).toBe('true'));
  document.addEventListener(SCROLL_RESTORE_START, start, { once: true }); document.addEventListener(SCROLL_RESTORED, finish, { once: true });
  cancel = restoreStorefrontPosition(window, { snapshot, hash: '#informacion', home: true });
  f.advance(); expect(f.getY()).toBe(1060); expect(start).toHaveBeenCalledOnce(); expect(finish).toHaveBeenCalledOnce();
  expect(window.scrollTo.mock.calls.every(([call]) => call.behavior === 'instant' && call.top === 1060)).toBe(true);
  expect(document.documentElement.dataset.storefrontRestoring).toBeUndefined(); expect(f.queue.size).toBe(0);
});

it('waits for async sections and changed upstream heights rather than saving a clamped early position', () => {
  const f = fixture(); f.setY(1060); const snapshot = captureStorefrontPosition(window, true); f.setY(0);
  f.heights[0] = 200; f.nodes[1].remove(); const done = vi.fn();
  cancel = restoreStorefrontPosition(window, { snapshot, home: true, onFinish: done });
  f.advance(600); expect(done).not.toHaveBeenCalled();
  f.nodes[2].before(f.nodes[1]); f.advance(400); expect(done).not.toHaveBeenCalled();
  f.heights[0] = 800; f.advance(); expect(done).toHaveBeenCalledOnce(); expect(f.getY()).toBe(1060);
});

it('keeps the same relative point inside a section after a viewport change', () => {
  const f = fixture(); f.setY(1300); const snapshot = captureStorefrontPosition(window, true);
  vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(390); f.heights[0] = 1200; f.heights[1] = 1800;
  cancel = restoreStorefrontPosition(window, { snapshot, home: true }); f.advance();
  expect(f.getY()).toBe(2100);
});

it('uses an anchor for a fresh deep link, but respects a saved top-of-page position ahead of the hash', () => {
  const f = fixture(); cancel = restoreStorefrontPosition(window, { hash: '#informacion', home: true }); f.advance();
  expect(f.getY()).toBe(1800); cancel();
  cancel = restoreStorefrontPosition(window, { snapshot: { y: 0, section: '', offset: 0 }, hash: '#informacion', home: true }); f.advance(); expect(f.getY()).toBe(0);
});

it('waits for site settings, yields to the user, and cleans every pending frame on navigation', () => {
  const f = fixture(); let ready = false; const done = vi.fn();
  cancel = restoreStorefrontPosition(window, { snapshot: { y: 1000 }, isReady: () => ready, onFinish: done }); f.advance(500); expect(done).not.toHaveBeenCalled();
  ready = true; f.advance(100); window.dispatchEvent(new WheelEvent('wheel'));
  expect(done).toHaveBeenCalledOnce(); expect(f.queue.size).toBe(0); expect(document.documentElement.dataset.storefrontRestoring).toBeUndefined();
  cancel = restoreStorefrontPosition(window, { hash: '#missing', home: true }); expect(f.queue.size).toBe(1); cancel(); expect(f.queue.size).toBe(0);
});

it('bounds missing-content retries and persists separate entries without trusting malformed storage', () => {
  const f = fixture(); const done = vi.fn(); cancel = restoreStorefrontPosition(window, { hash: '#missing', home: true, onFinish: done }); f.advance(4100); expect(done).toHaveBeenCalledOnce();
  const entries = new Map(Array.from({ length: 60 }, (_, i) => [String(i), { y: i * 10, url: '/' }])); writeScrollPositions(window, entries);
  expect(readScrollPositions(window).size).toBe(50); expect(readScrollPositions(window).get('59').y).toBe(590);
  sessionStorage.setItem(SCROLL_POSITIONS_KEY, '{bad'); expect(readScrollPositions(window).size).toBe(0);
});

it('distinguishes native document entries with default router keys and preserves router history state', () => {
  window.history.replaceState({ idx: 3, usr: { filter: 'vestidos' } }, '');
  const first = storefrontHistoryKey(window, 'default');
  expect(storefrontHistoryKey(window, 'default')).toBe(first);
  expect(window.history.state).toMatchObject({ idx: 3, usr: { filter: 'vestidos' }, storefrontEntry: first });
  window.history.replaceState({ idx: 4 }, '');
  expect(storefrontHistoryKey(window, 'default')).not.toBe(first);
  window.history.replaceState({ idx: 5, key: 'spa-key' }, ''); expect(storefrontHistoryKey(window, 'spa-key')).toBe('spa-key');
});
