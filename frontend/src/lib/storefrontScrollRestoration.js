import { storefrontSectionTop } from './storefrontSectionMotion';

export const SCROLL_RESTORE_START = 'storefront:scroll-restore-start';
export const SCROLL_RESTORED = 'storefront:scroll-restored';
export const SCROLL_POSITIONS_KEY = 'rb_storefront_scroll_v1';

export function storefrontHistoryKey(view, routerKey) {
  const state = view.history.state || {};
  if (typeof state.storefrontEntry === 'string') return state.storefrontEntry;
  // Native <a> navigations create separate documents whose router key is
  // always "default". Keep a unique identity on the actual browser entry.
  const key = routerKey && routerKey !== 'default' ? routerKey : `store-${view.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
  view.history.replaceState({ ...state, storefrontEntry: key }, '');
  return key;
}

export function captureStorefrontPosition(view, home = false) {
  const y = Math.max(0, view.scrollY), sections = home
    ? [...view.document.querySelectorAll('.storefront-sections > section[id]')].filter(node => node.offsetHeight > 0)
    : [];
  const section = sections.filter(node => storefrontSectionTop(node) <= y + 1).at(-1);
  return {
    y, width: view.innerWidth, section: section?.id || '',
    offset: section ? y - storefrontSectionTop(section) : 0,
    height: section?.offsetHeight || 0,
    heights: sections.slice(0, section ? sections.indexOf(section) + 1 : 0).map(node => [node.id, node.offsetHeight]),
  };
}

export function readScrollPositions(view) {
  try {
    const saved = JSON.parse(view.sessionStorage.getItem(SCROLL_POSITIONS_KEY) || '[]');
    return new Map(Array.isArray(saved) ? saved.filter(([key, value]) => typeof key === 'string' && value && Number.isFinite(value.y) && value.y >= 0).slice(-50) : []);
  } catch { return new Map(); }
}

export function writeScrollPositions(view, positions) {
  while (positions.size > 50) positions.delete(positions.keys().next().value);
  try { view.sessionStorage.setItem(SCROLL_POSITIONS_KEY, JSON.stringify([...positions])); } catch { /* Scroll still works with in-memory history. */ }
}

export function hashSection(doc, hash) {
  try { return hash ? doc.getElementById(decodeURIComponent(hash.slice(1))) : null; } catch { return null; }
}

// A POP restores an entry's actual section and local offset, never an old URL
// hash. While lazy sections settle, choreography is unmounted rather than
// running through the intermediate chapters behind a smooth scroll.
export function restoreStorefrontPosition(view, { snapshot, hash = '', home = false, isReady = () => true, onFinish = () => {} }) {
  const doc = view.document, html = doc.documentElement;
  let frame = 0, stopped = false, last = '', stableSince = view.performance.now();
  const started = stableSince;
  html.dataset.storefrontRestoring = 'true';
  doc.dispatchEvent(new view.CustomEvent(SCROLL_RESTORE_START));

  function destination() {
    const root = home ? doc.querySelector('.storefront-sections') : doc.getElementById('root');
    const section = snapshot ? snapshot.section ? doc.getElementById(snapshot.section) : null : hashSection(doc, hash);
    let top = snapshot?.y || 0;
    const sameWidth = !snapshot?.width || Math.abs(snapshot.width - view.innerWidth) < 40;
    if (section) {
      const offset = snapshot
        ? sameWidth ? snapshot.offset || 0 : (snapshot.offset || 0) / Math.max(1, snapshot.height || 1) * section.offsetHeight
        : -(parseFloat(view.getComputedStyle(section).scrollMarginTop) || 0);
      top = Math.max(0, storefrontSectionTop(section) + offset);
    }
    const max = Math.max(0, doc.documentElement.scrollHeight - view.innerHeight);
    const targetExists = !home || Boolean(root && (snapshot ? !snapshot.section || section?.offsetHeight > 0 : !hash || section?.offsetHeight > 0));
    const heightsReady = !sameWidth || !Array.isArray(snapshot?.heights) || snapshot.heights.every(([id, height]) => {
      const node = doc.getElementById(id);
      return node && Math.abs(node.offsetHeight - height) <= Math.max(24, height * .02);
    });
    const imagesReady = !root || [...root.querySelectorAll('img')].every(image => image.loading === 'lazy' || image.complete || image.getBoundingClientRect().top + view.scrollY > top + view.innerHeight);
    const fontsReady = !doc.fonts || doc.fonts.status !== 'loading';
    return { top, max, ready: isReady() && targetExists && heightsReady && imagesReady && fontsReady && max >= top - 2 };
  }

  function finish(completed) {
    if (stopped) return;
    stopped = true;
    view.cancelAnimationFrame(frame);
    for (const name of ['wheel', 'touchstart', 'pointerdown', 'keydown']) view.removeEventListener(name, interrupt, true);
    // Listeners rebuild the scene at the restored position before it is shown.
    doc.dispatchEvent(new view.CustomEvent(SCROLL_RESTORED));
    delete html.dataset.storefrontRestoring;
    if (completed) onFinish();
  }

  function tick() {
    if (stopped) return;
    const next = destination(), now = view.performance.now();
    const signature = `${next.top}:${next.max}:${next.ready}`;
    if (signature !== last) { last = signature; stableSince = now; }
    view.scrollTo({ top: Math.min(next.top, next.max), behavior: 'instant' });
    if (next.ready && now - stableSince >= 220 || now - started >= 4000) return finish(true);
    frame = view.requestAnimationFrame(tick);
  }
  function interrupt(event) {
    if (event.type === 'keydown' && !['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' ', 'Tab'].includes(event.key)) return;
    finish(true);
  }
  for (const name of ['wheel', 'touchstart', 'pointerdown', 'keydown']) view.addEventListener(name, interrupt, { capture: true, passive: true });
  tick();
  return () => finish(false);
}
