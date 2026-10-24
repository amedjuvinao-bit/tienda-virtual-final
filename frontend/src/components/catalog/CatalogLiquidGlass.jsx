import React, { useEffect, useRef } from 'react';
import './catalogLiquidFrame.css';
import PolishedGlassRim from '../PolishedGlassRim';

// All paint is restricted to the perimeter. There is no interior surface.
export default function CatalogLiquidGlass({ presentation }) {
  const layer = useRef(null);
  useEffect(() => {
    const host = layer.current?.parentElement;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!host || presentation.motion === 'none' || reduced?.matches) return;
    let frame = 0;
    const move = event => {
      if (event.pointerType !== 'mouse' || reduced?.matches) return;
      const bounds = host.getBoundingClientRect();
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        host.style.setProperty('--ch-pointer-x', `${(event.clientX - bounds.left) / bounds.width * 100}%`);
        host.style.setProperty('--ch-pointer-y', `${(event.clientY - bounds.top) / bounds.height * 100}%`);
      });
    };
    const reset = () => {
      cancelAnimationFrame(frame);
      host.style.removeProperty('--ch-pointer-x');
      host.style.removeProperty('--ch-pointer-y');
    };
    host.addEventListener('pointermove', move);
    host.addEventListener('pointerleave', reset);
    reduced?.addEventListener?.('change', reset);
    return () => {
      host.removeEventListener('pointermove', move);
      host.removeEventListener('pointerleave', reset);
      reduced?.removeEventListener?.('change', reset);
      reset();
    };
  }, [presentation.motion]);

  return <div ref={layer} className="catalog-liquid" data-empty={presentation.headerEdgeWidth === 0} data-layers={presentation.headerLayers} aria-hidden="true">
    <PolishedGlassRim radius={presentation.headerRadius} width={12 + presentation.headerEdgeWidth * 2} reflection={Math.sqrt(presentation.headerReflection)}/>
  </div>;
}
