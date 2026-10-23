import { useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import { storefrontSectionTop } from '../lib/storefrontSectionMotion';
import { captureStorefrontPosition, hashSection, readScrollPositions, restoreStorefrontPosition, storefrontHistoryKey, writeScrollPositions } from '../lib/storefrontScrollRestoration';
import '../storefrontScrollRestoration.css';

export default function StorefrontScrollRestoration({ ready = true }) {
  const location = useLocation(), navigation = useNavigationType();
  const positions = useRef(null), previous = useRef(null), nativeMode = useRef(null);
  const readyRef = useRef(ready);
  readyRef.current = ready;
  if (!positions.current) positions.current = readScrollPositions(window);

  useLayoutEffect(() => {
    nativeMode.current = window.history.scrollRestoration;
    return () => { window.history.scrollRestoration = nativeMode.current; };
  }, []);

  useLayoutEffect(() => {
    const { pathname, search, hash } = location, url = pathname + search + hash;
    const prior = previous.current;
    previous.current = location;
    if (pathname.startsWith('/admin')) { window.history.scrollRestoration = nativeMode.current; return; }
    const key = storefrontHistoryKey(window, location.key);
    window.history.scrollRestoration = 'manual';
    let pending = false, cancel = () => {};
    const record = () => {
      if (pending || document.documentElement.dataset.storefrontRestoring === 'true') return;
      positions.current.set(key, { ...captureStorefrontPosition(window, pathname === '/'), url });
    };
    const persist = () => { record(); writeScrollPositions(window, positions.current); };
    const saved = positions.current.get(key);
    const snapshot = saved?.url === url ? saved : null;
    const target = hashSection(document, hash);
    if (navigation === 'POP' && snapshot || hash && !(navigation !== 'POP' && prior?.pathname === pathname && target)) {
      pending = true;
      cancel = restoreStorefrontPosition(window, {
        snapshot: navigation === 'POP' ? snapshot : null, hash, home: pathname === '/',
        isReady: () => readyRef.current,
        onFinish: () => { pending = false; record(); },
      });
    } else {
      const top = target ? Math.max(0, storefrontSectionTop(target) - (parseFloat(window.getComputedStyle(target).scrollMarginTop) || 0)) : 0;
      window.scrollTo({ top, behavior: target && !window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ? 'smooth' : 'instant' });
      record();
    }
    window.addEventListener('scroll', record, { passive: true });
    window.addEventListener('pagehide', persist);
    document.addEventListener('click', persist, true);
    return () => {
      window.removeEventListener('scroll', record);
      window.removeEventListener('pagehide', persist);
      document.removeEventListener('click', persist, true);
      // Use the last live snapshot. Route DOM may already be removed here.
      writeScrollPositions(window, positions.current);
      cancel();
    };
  }, [location.key, location.pathname, location.search, location.hash, navigation]);
  return null;
}
