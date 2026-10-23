import { useEffect, useRef } from 'react';

// One passive listener and one frame, independent of React renders and navigation.
export default function useCatalogDepth(config) {
  const ref = useRef(null);
  useEffect(() => {
    const node = ref.current;
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    let frame;
    const update = () => {
      frame = undefined;
      if (!node) return;
      const allowed = config.layout === 'glass-grid' && config.motion === 'parallax' && !media?.matches && window.innerWidth >= 768;
      const offset = allowed ? Math.max(-1, Math.min(1, -node.getBoundingClientRect().top / window.innerHeight)) * config.motionStrength : 0;
      node.style.setProperty('--catalog-depth', `${offset}px`);
    };
    const schedule = () => { if (frame === undefined) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    media?.addEventListener?.('change', schedule);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      media?.removeEventListener?.('change', schedule);
      if (frame !== undefined) cancelAnimationFrame(frame);
    };
  }, [config.layout, config.motion, config.motionStrength]);
  return ref;
}
