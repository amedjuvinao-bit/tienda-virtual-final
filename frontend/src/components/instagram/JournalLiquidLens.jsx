import React, { useEffect, useId, useRef, useState } from 'react';
import { createLiquidLensMap } from './liquidLensMap';

export default function JournalLiquidLens({ settings, strength = 1 }) {
  const ref = useRef(null);
  const id = `igj-lens-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [map, setMap] = useState(null);
  const active = settings.journalGlassEnabled && settings.journalGlassFinish === 'liquid';
  // Native backdrop SVG filters are an enhancement; clear frost and the rim
  // remain available on engines that cannot apply SVG to a backdrop.
  const native = typeof navigator !== 'undefined' && /Chrom(e|ium)\//.test(navigator.userAgent);
  useEffect(() => {
    if (!active || !native || !ref.current) return;
    const el = ref.current;
    const measure = () => {
      const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
      const width = el.clientWidth, height = el.clientHeight;
      const src = createLiquidLensMap(width, height, radius, settings.journalLiquidEdge);
      if (src) setMap(previous => previous?.src === src && previous.width === width && previous.height === height ? previous : { src, width, height });
    };
    measure();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(el);
    if (!observer) window.addEventListener('resize', measure);
    return () => { observer?.disconnect(); if (!observer) window.removeEventListener('resize', measure); };
  }, [active, native, settings.journalLiquidEdge, settings.journalRadius]);
  if (!active) return null;
  return <span ref={ref} className="ig-journal__liquid" aria-hidden="true" data-liquid-ready={map ? 'true' : 'false'}>
    {map && <svg width="0" height="0" className="ig-journal__lens-defs" focusable="false"><defs>
      <filter id={id} filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" x="0" y="0" width={map.width} height={map.height} colorInterpolationFilters="sRGB">
        <feImage href={map.src} x="0" y="0" width={map.width} height={map.height} preserveAspectRatio="none" result="lens" />
        <feDisplacementMap in="SourceGraphic" in2="lens" scale={settings.journalLiquidRefraction * strength} xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </defs></svg>}
    <span className="ig-journal__liquid-frost" />
    {map && <span className="ig-journal__liquid-bend" style={{ backdropFilter: `url(#${id})`, WebkitBackdropFilter: `url(#${id})` }} />}
    <span className="ig-journal__liquid-shine" />
  </span>;
}
