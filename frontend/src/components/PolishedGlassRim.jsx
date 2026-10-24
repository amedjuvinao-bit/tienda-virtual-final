import React, { useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import './polishedGlassRim.css';
import { glassRefractionMap } from './glassRefractionMap';
import { glassBevelMasks } from './glassBevelMasks';

// A broad, softly lit lip follows the actual corner radius. Its center stays
// unpainted; only the edge catches light, never the image or the panel face.
export default function PolishedGlassRim({ radius = 24, width = 10, reflection = 1, className = '' }) {
  const host = useRef(null), id = `polished-${useId().replace(/:/g, '')}`;
  const [size, setSize] = useState({ w: 0, h: 0, r: radius });
  useLayoutEffect(() => {
    const node = host.current;
    if (!node) return;
    const measure = () => {
      const corner = parseFloat(node.ownerDocument.defaultView.getComputedStyle(node).borderTopLeftRadius);
      const next = {
        w: node.clientWidth, h: node.clientHeight,
        r: Number.isFinite(corner) ? corner : radius,
      };
      setSize(old => old.w === next.w && old.h === next.h && old.r === next.r ? old : next);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [radius]);
  const { w, h } = size, rim = Math.min(width, w / 16, h / 8);
  const refraction = useMemo(() => glassRefractionMap(w, h, size.r, rim), [w, h, size.r, rim]);
  const bevel = useMemo(() => glassBevelMasks(w, h, size.r, rim), [w, h, size.r, rim]);
  const contour = (inset, props) => <rect x={inset} y={inset}
    width={Math.max(0, w - inset * 2)} height={Math.max(0, h - inset * 2)}
    rx={Math.max(0, Math.min(size.r, w / 2, h / 2) - inset)} fill="none" {...props}/>;
  return <span ref={host} className={`polished-glass-rim ${className}`} style={{ '--pg-shine': reflection, '--pg-width': `${rim}px` }} aria-hidden="true">
    {refraction && <span className="polished-glass-rim__refraction" style={{ backdropFilter: `url(#${id}-refract) saturate(1.12)`, WebkitBackdropFilter: `url(#${id}-refract) saturate(1.12)` }}/>}
    {bevel && <>
      <span className="polished-glass-rim__depth" style={{ maskImage: `url(${bevel.shade})`, WebkitMaskImage: `url(${bevel.shade})` }}/>
      <span className="polished-glass-rim__shine" style={{ maskImage: `url(${bevel.light})`, WebkitMaskImage: `url(${bevel.light})` }}/>
    </>}
    {w > 12 && h > 12 && <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%" preserveAspectRatio="none" focusable="false">
      <defs>
        {refraction && <filter id={`${id}-refract`} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feImage href={refraction} x="0" y="0" width={w} height={h} preserveAspectRatio="none" result="displacement"/>
          <feDisplacementMap in="SourceGraphic" in2="displacement" scale={rim * 3.8} xChannelSelector="R" yChannelSelector="G"/>
        </filter>}
        <linearGradient id={`${id}-lip`} x1="0" y1="0" x2="1" y2=".7">
          <stop stopColor="var(--pg-highlight)"/>
          <stop offset=".35" stopColor="var(--pg-highlight)" stopOpacity=".28"/>
          <stop offset=".65" stopColor="var(--pg-highlight)" stopOpacity=".45"/>
          <stop offset="1" stopColor="var(--pg-highlight)"/>
        </linearGradient>
        <radialGradient id={`${id}-glint`}>
          <stop stopColor="var(--pg-highlight)"/>
          <stop offset="1" stopColor="var(--pg-highlight)" stopOpacity="0"/>
        </radialGradient>
        <mask id={`${id}-perimeter`} maskUnits="userSpaceOnUse" x="0" y="0" width={w} height={h}>
          {contour(rim * .5, { stroke: '#fff', strokeWidth: rim })}
        </mask>
      </defs>
      {!bevel && contour(.8, { stroke: 'var(--pg-edge)', strokeWidth: 1.1, opacity: .35 })}
      <g opacity="var(--pg-shine)">
        {!bevel && contour(rim * .5, { stroke: `url(#${id}-lip)`, strokeWidth: 1.3 })}
        <g mask={`url(#${id}-perimeter)`} opacity=".45">
          <ellipse className="polished-glass-rim__glint" cx={w * .22} cy="0" rx={Math.min(100, w * .2)} ry={rim * 1.4} fill={`url(#${id}-glint)`}/>
        </g>
        <g mask={`url(#${id}-perimeter)`}>
          <ellipse cx="0" cy={h} rx={Math.max(42, size.r * 2.4)} ry={Math.max(42, size.r * 2.4)} fill={`url(#${id}-glint)`} opacity=".9"/>
          <ellipse cx={w} cy="0" rx={Math.max(36, size.r * 2)} ry={Math.max(36, size.r * 2)} fill={`url(#${id}-glint)`} opacity=".8"/>
        </g>
      </g>
    </svg>}
  </span>;
}
