import React, { useId, useLayoutEffect, useRef, useState } from 'react';
import './polishedGlassRim.css';

// Measured, unfilled contours keep a smooth bevel at every aspect ratio.
// No bitmap is stretched over the panel or its contents.
export default function PolishedGlassRim({ radius = 24, width = 10, reflection = 1, className = '' }) {
  const host = useRef(null), id = `polished-${useId().replace(/:/g, '')}`;
  const [size, setSize] = useState({ w: 0, h: 0, r: radius });
  useLayoutEffect(() => {
    const node = host.current;
    if (!node) return;
    const measure = () => {
      const next = {
        w: node.clientWidth, h: node.clientHeight,
        r: parseFloat(node.ownerDocument.defaultView.getComputedStyle(node).borderTopLeftRadius) || radius,
      };
      setSize(old => old.w === next.w && old.h === next.h && old.r === next.r ? old : next);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [radius]);
  const { w, h } = size, rim = Math.min(width, w / 8, h / 8);
  const contour = (inset, props) => <rect x={inset} y={inset}
    width={Math.max(0, w - inset * 2)} height={Math.max(0, h - inset * 2)}
    rx={Math.max(0, Math.min(size.r, w / 2, h / 2) - inset)} fill="none" {...props}/>;
  return <span ref={host} className={`polished-glass-rim ${className}`} aria-hidden="true">
    {w > 12 && h > 12 && <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%" preserveAspectRatio="none" focusable="false">
      <defs>
        <linearGradient id={`${id}-bevel`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="var(--pg-depth)" stopOpacity=".7"/>
          <stop offset=".12" stopColor="var(--pg-light)"/>
          <stop offset=".35" stopColor="var(--pg-edge)" stopOpacity=".3"/>
          <stop offset=".57" stopColor="var(--pg-depth)" stopOpacity=".65"/>
          <stop offset=".8" stopColor="var(--pg-light)"/>
          <stop offset="1" stopColor="var(--pg-edge)" stopOpacity=".5"/>
        </linearGradient>
        <radialGradient id={`${id}-glint`}>
          <stop stopColor="var(--pg-light)"/>
          <stop offset=".3" stopColor="var(--pg-light)" stopOpacity=".7"/>
          <stop offset="1" stopColor="var(--pg-light)" stopOpacity="0"/>
        </radialGradient>
        <filter id={`${id}-polish`} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceAlpha" stdDeviation={rim / 5} result="bevel"/>
          <feSpecularLighting in="bevel" surfaceScale="4" specularConstant={1.1 * reflection} specularExponent="18" style={{ lightingColor: 'var(--pg-light)' }} result="light">
            <fePointLight x={w * .22} y={-h * .25} z={Math.max(120, w * .4)}/>
          </feSpecularLighting>
          <feComposite in="light" in2="SourceAlpha" operator="in" result="reflection"/>
          <feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="reflection"/></feMerge>
        </filter>
      </defs>
      {contour(.7, { stroke: 'var(--pg-depth)', strokeWidth: 1.1, opacity: .65 })}
      {contour(rim * .5, { stroke: `url(#${id}-bevel)`, strokeWidth: rim * .8, filter: `url(#${id}-polish)` })}
      {contour(1.8, { stroke: 'var(--pg-light)', strokeWidth: 1.35, opacity: .85 })}
      {contour(rim * .9, { stroke: 'var(--pg-light)', strokeWidth: 1.25, opacity: .88 })}
      <ellipse cx={w * .26} cy={rim * .45} rx={Math.min(70, w * .12)} ry={1.7} fill={`url(#${id}-glint)`}/>
      <ellipse cx={w * .8} cy={h - rim * .4} rx={Math.min(48, w * .1)} ry={1.6} fill={`url(#${id}-glint)`}/>
    </svg>}
  </span>;
}
