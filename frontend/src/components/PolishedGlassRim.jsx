import React, { useId, useLayoutEffect, useRef, useState } from 'react';
import './polishedGlassRim.css';

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
  const { w, h } = size, rim = Math.min(width, w / 20, h / 8);
  const contour = (inset, props) => <rect x={inset} y={inset}
    width={Math.max(0, w - inset * 2)} height={Math.max(0, h - inset * 2)}
    rx={Math.max(0, Math.min(size.r, w / 2, h / 2) - inset)} fill="none" {...props}/>;
  return <span ref={host} className={`polished-glass-rim ${className}`} style={{ '--pg-shine': reflection }} aria-hidden="true">
    {w > 12 && h > 12 && <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%" preserveAspectRatio="none" focusable="false">
      <defs>
        <linearGradient id={`${id}-bevel`} x1="0" y1="0" x2=".25" y2="1">
          <stop stopColor="var(--pg-highlight)" stopOpacity=".94"/>
          <stop offset=".18" stopColor="var(--pg-highlight)" stopOpacity=".28"/>
          <stop offset=".48" stopColor="var(--pg-highlight)" stopOpacity=".08"/>
          <stop offset=".76" stopColor="var(--pg-highlight)" stopOpacity=".28"/>
          <stop offset="1" stopColor="var(--pg-highlight)"/>
        </linearGradient>
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
        <filter id={`${id}-soften`} x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation={rim * .09}/>
        </filter>
        <filter id={`${id}-diffuse`} x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation={rim * .22}/>
        </filter>
      </defs>
      {contour(.8, { stroke: 'var(--pg-edge)', strokeWidth: 1.3, opacity: .35 })}
      {contour(rim * .39, { stroke: 'var(--pg-depth)', strokeWidth: rim * .38, opacity: .35, filter: `url(#${id}-soften)` })}
      <g opacity="var(--pg-shine)">
        {contour(rim * .57, { className: 'polished-glass-rim__diffusion', stroke: `url(#${id}-bevel)`, strokeWidth: rim, opacity: .65, filter: `url(#${id}-diffuse)` })}
        {contour(rim * .64, { stroke: `url(#${id}-bevel)`, strokeWidth: rim * .46, filter: `url(#${id}-soften)` })}
        {contour(rim * .19, { stroke: `url(#${id}-lip)`, strokeWidth: rim * .16, opacity: .95 })}
        <g mask={`url(#${id}-perimeter)`} opacity=".45">
          <ellipse className="polished-glass-rim__glint" cx={w * .22} cy="0" rx={Math.min(100, w * .2)} ry={rim * 1.4} fill={`url(#${id}-glint)`}/>
        </g>
      </g>
    </svg>}
  </span>;
}
