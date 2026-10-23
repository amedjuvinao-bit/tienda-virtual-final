import React, { useEffect, useRef } from 'react';

// Responsive optical layers without a fixed-size raster frame.
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
    <div className="catalog-liquid__material"/>
    <div className="catalog-liquid__rim"/>
    <div className="catalog-liquid__shine"/>
    <svg className="catalog-liquid__caustics" viewBox="0 0 1000 160" preserveAspectRatio="none" focusable="false">
      <path d="M600 -12 C790 8 900 24 1020 115"/>
      <path d="M615 -12 C795 12 910 36 1020 125"/>
      <path d="M-30 112 C100 162 260 155 480 168"/>
    </svg>
  </div>;
}
