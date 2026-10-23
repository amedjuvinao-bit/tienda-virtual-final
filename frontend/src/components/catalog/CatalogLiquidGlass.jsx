import React, { useEffect, useRef } from 'react';

// Horizontal optical surface with a separate shared bevel; no texture stretching.
export default function CatalogLiquidGlass({ presentation }) {
  const layer = useRef(null);
  useEffect(() => {
    const host = layer.current?.parentElement;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!host || presentation.motion === 'none' || reduced?.matches) return;
    let frame = 0;
    const move = event => {
      if (event.pointerType !== 'mouse' || reduced?.matches) return;
      const bounds = host.getBoundingClientRect(), x = (event.clientX - bounds.left) / bounds.width * 100, y = (event.clientY - bounds.top) / bounds.height * 100;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => { host.style.setProperty('--ch-pointer-x', `${x}%`); host.style.setProperty('--ch-pointer-y', `${y}%`); });
    };
    const reset = () => { cancelAnimationFrame(frame); host.style.removeProperty('--ch-pointer-x'); host.style.removeProperty('--ch-pointer-y'); };
    host.addEventListener('pointermove', move); host.addEventListener('pointerleave', reset); reduced?.addEventListener?.('change', reset);
    return () => { host.removeEventListener('pointermove', move); host.removeEventListener('pointerleave', reset); reduced?.removeEventListener?.('change', reset); reset(); };
  }, [presentation.motion]);
  return <div ref={layer} className="catalog-liquid" aria-hidden="true">
    <div className="catalog-liquid__material">
      <div className="catalog-liquid__surface"/>
      <div className="catalog-liquid__bevel"/>
    </div>
    <div className="catalog-liquid__rim"/>
    <div className="catalog-liquid__shine"/>
  </div>;
}
