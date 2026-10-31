import { useId, useLayoutEffect, useRef, useState } from "react";
import "../../components/polishedGlassRim.css";
import { glassRimPath } from "./thanksGlassGeometry";

// Vector relief stays sharp at narrow widths. The open top contour physically
// omits the medallion area, including every reflection.
export default function ThanksGlassRim({ config, radius, topGap = 0 }) {
  const host = useRef(null);
  const id = `thanks-lens-${useId().replace(/:/g, "")}`;
  const [size, setSize] = useState({ w: 0, h: 0, r: 0 });
  const width = config.presentation.borderWidth;
  const actualRadius = radius ?? config.style.panelRadiusPx;
  useLayoutEffect(() => {
    const node = host.current;
    if (!node) return;
    const measure = () => {
      const r = parseFloat(getComputedStyle(node).borderTopLeftRadius) || 0;
      const next = { w: node.clientWidth, h: node.clientHeight, r };
      setSize((old) =>
        old.w === next.w && old.h === next.h && old.r === r ? old : next,
      );
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [actualRadius, width]);
  if (width <= 0) return null;
  const { w, h, r } = size;
  const band = Math.min(width * 2, w / 16, h / 8);
  const path = (inset) => glassRimPath(w, h, r, inset, topGap);
  const opticalRadius = Math.min(r, w / 2, h / 2);
  const corner = opticalRadius * (1 - Math.SQRT1_2) + band / 2;
  return (
    <span
      ref={host}
      className="polished-glass-rim gp-liquid-rim"
      style={{
        "--pg-shine": config.presentation.reflection,
        "--pg-width": `${band}px`,
      }}
      aria-hidden="true"
    >
      {w > 12 && h > 12 && band > 0 && (
        <svg
          viewBox={`0 0 ${w} ${h}`}
          width="100%"
          height="100%"
          focusable="false"
        >
          <defs>
            <linearGradient id={`${id}-body`} x1="0" y1="0" x2="1" y2="1">
              <stop stopColor="var(--cart-light)" stopOpacity=".75" />
              <stop
                offset=".2"
                stopColor="var(--cart-tint)"
                stopOpacity=".35"
              />
              <stop
                offset=".5"
                stopColor="var(--cart-accent)"
                stopOpacity=".32"
              />
              <stop
                offset=".72"
                stopColor="var(--cart-light)"
                stopOpacity=".4"
              />
              <stop offset="1" stopColor="var(--cart-tint)" stopOpacity=".7" />
            </linearGradient>
            <linearGradient id={`${id}-light`} x1="0" y1="0" x2="1" y2=".7">
              <stop stopColor="var(--cart-light)" />
              <stop
                offset=".24"
                stopColor="var(--cart-light)"
                stopOpacity=".18"
              />
              <stop
                offset=".46"
                stopColor="var(--cart-light)"
                stopOpacity=".7"
              />
              <stop
                offset=".66"
                stopColor="var(--cart-light)"
                stopOpacity=".25"
              />
              <stop offset="1" stopColor="var(--cart-light)" />
            </linearGradient>
            <linearGradient id={`${id}-return`} x1="0" y1="1" x2="1" y2="0">
              <stop stopColor="var(--cart-light)" />
              <stop
                offset=".4"
                stopColor="var(--cart-accent)"
                stopOpacity=".48"
              />
              <stop
                offset=".72"
                stopColor="var(--cart-light)"
                stopOpacity=".24"
              />
              <stop offset="1" stopColor="var(--cart-light)" />
            </linearGradient>
            <radialGradient id={`${id}-glow`}>
              <stop stopColor="var(--cart-light)" />
              <stop
                offset=".25"
                stopColor="var(--cart-light)"
                stopOpacity=".8"
              />
              <stop offset="1" stopColor="var(--cart-light)" stopOpacity="0" />
            </radialGradient>
          </defs>
          <g fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path
              d={path(band / 2)}
              stroke={`url(#${id}-body)`}
              strokeWidth={band}
            />
            <g className="gp-glass-highlights" opacity="var(--pg-shine)">
              <path
                d={path(band * 0.22)}
                stroke={`url(#${id}-light)`}
                strokeWidth={band * 0.32}
              />
              <path
                d={path(band * 0.57)}
                stroke={`url(#${id}-return)`}
                strokeWidth={band * 0.42}
                opacity=".62"
              />
              <path
                d={path(band * 0.86)}
                stroke={`url(#${id}-light)`}
                strokeWidth={band * 0.14}
                opacity=".72"
              />
            </g>
          </g>
          <g
            className="gp-glass-highlights gp-glass-glints"
            opacity="var(--pg-shine)"
            fill={`url(#${id}-glow)`}
          >
            <ellipse
              cx={w - corner}
              cy={corner}
              rx={Math.min(10, w * 0.1)}
              ry={band * 0.7}
              transform={`rotate(-30 ${w - corner} ${corner})`}
            />
            <ellipse
              cx={corner}
              cy={h - corner}
              rx={Math.min(11, w * 0.1)}
              ry={band * 0.65}
              transform={`rotate(-35 ${corner} ${h - corner})`}
            />
          </g>
        </svg>
      )}
    </span>
  );
}
