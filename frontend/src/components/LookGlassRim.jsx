import { useId, useLayoutEffect, useRef, useState } from "react";

/** Decorative optical edge; the measured SVG keeps its curves and strokes intact at any aspect ratio. */
export default function LookGlassRim({ variant = "hero", radius = 26 }) {
  const host = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const id = useId().replace(/:/g, "");

  useLayoutEffect(() => {
    const element = host.current;
    if (!element) return undefined;
    const measure = () => {
      const { width, height } = element.getBoundingClientRect();
      setSize((current) => current.width === width && current.height === height
        ? current : { width, height });
    };
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const { width: w, height: h } = size;
  const card = variant === "card";
  const rim = card ? 2.5 : 4.5;
  const curve = Math.min(Math.max(Number(radius) || 0, 0), w / 2, h / 2);
  const sparkle = (x, y, horizontal = true, scale = 1) => <g key={`${x}-${y}`}>
    <ellipse cx={x} cy={y} rx={(horizontal ? 20 : 4) * scale} ry={(horizontal ? 3.5 : 16) * scale}
      fill={`url(#${id}-light)`} opacity=".82" />
    <ellipse cx={x} cy={y} rx={(horizontal ? 12 : 2.5) * scale} ry={(horizontal ? 1.2 : 10) * scale}
      fill={`url(#${id}-light)`} opacity=".92" />
  </g>;

  return <span ref={host} className={`look-glass-rim look-glass-rim--${variant}`} aria-hidden="true">
    {w > 10 && h > 10 && <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`${id}-edge`} x1="0" y1="0" x2="1" y2=".5">
          <stop offset="0" stopColor="#ffefda" stopOpacity=".8" />
          <stop offset=".1" stopColor="#fff" stopOpacity=".95" />
          <stop offset=".28" stopColor="var(--look-accent)" stopOpacity=".48" />
          <stop offset=".43" stopColor="#fff" stopOpacity=".88" />
          <stop offset=".68" stopColor="#ffe8d4" stopOpacity=".57" />
          <stop offset=".87" stopColor="#fff" stopOpacity=".92" />
          <stop offset="1" stopColor="#ffdfca" stopOpacity=".64" />
        </linearGradient>
        <radialGradient id={`${id}-light`}><stop stopColor="#fff" stopOpacity=".98" /><stop offset=".16" stopColor="#fffaf0" stopOpacity=".85" /><stop offset=".53" stopColor="#ffe1cb" stopOpacity=".3" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></radialGradient>
      </defs>
      <rect x="1" y="1" width={w - 2} height={h - 2} rx={curve} fill="none" stroke="rgba(92,38,37,.45)" strokeWidth="1" />
      <rect x={rim} y={rim} width={w - rim * 2} height={h - rim * 2} rx={Math.max(0, curve - rim)}
        fill="none" stroke="#fff8e9" strokeWidth={card ? 5 : 7} opacity=".13" />
      <rect x={rim} y={rim} width={w - rim * 2} height={h - rim * 2} rx={Math.max(0, curve - rim)}
        fill="none" stroke={`url(#${id}-edge)`} strokeWidth={card ? 1.5 : 1.8} />
      <rect x={rim + 3} y={rim + 3} width={w - (rim + 3) * 2} height={h - (rim + 3) * 2}
        rx={Math.max(0, curve - rim - 3)} fill="none" stroke="rgba(255,255,255,.39)" strokeWidth=".75" />
      <path d={`M ${curve + 4} ${rim - 2} H ${w - curve - 4}`} stroke="rgba(255,250,237,.46)" strokeWidth=".9" />
      <path d={`M ${curve + 4} ${h - rim + 2} H ${w - curve - 4}`} stroke="rgba(134,58,48,.35)" strokeWidth=".8" />
      {sparkle(w * .31, rim, true, card ? .65 : 1.4)}
      {!card && sparkle(w * .81, rim, true, 1.1)}
      {!card && sparkle(rim, h * .4, false, 1)}
      {sparkle(w * .74, h - rim, true, card ? .6 : 1.4)}
    </svg>}
  </span>;
}
