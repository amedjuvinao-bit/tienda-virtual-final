import { useId, useLayoutEffect, useRef, useState } from "react";
// The relief is confined to the perimeter; the face never receives a white fill.
export default function ContactGlassRim({ config, radius }) {
  const host = useRef(null),
    id = "contact-lens-" + useId().replace(/:/g, "");
  const [size, setSize] = useState({ w: 0, h: 0, r: 0 });
  const width = config.presentation.borderWidth;
  useLayoutEffect(() => {
    const node = host.current;
    if (!node) return;
    const measure = () => {
      const next = {
        w: node.clientWidth,
        h: node.clientHeight,
        r: parseFloat(getComputedStyle(node).borderTopLeftRadius) || 0,
      };
      setSize((old) =>
        old.w === next.w && old.h === next.h && old.r === next.r ? old : next,
      );
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [radius, width]);
  const { w, h, r } = size,
    band = Math.min(width * 2, w / 16, h / 8);
  const contour = (inset, props) => (
    <rect
      x={inset}
      y={inset}
      width={Math.max(0, w - inset * 2)}
      height={Math.max(0, h - inset * 2)}
      rx={Math.max(0, Math.min(r, w / 2, h / 2) - inset)}
      fill="none"
      {...props}
    />
  );
  const corner = Math.min(r, w / 2, h / 2) * (1 - Math.SQRT1_2) + band / 2;
  return (
    <span
      ref={host}
      className="polished-glass-rim contact-liquid-rim"
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
            <linearGradient id={id + "-body"} x1="0" y1="0" x2="1" y2="1">
              <stop
                stopColor="var(--contact-rim-light, var(--cart-light))"
                stopOpacity=".65"
              />
              <stop
                offset=".27"
                stopColor="var(--cart-tint)"
                stopOpacity=".25"
              />
              <stop
                offset=".5"
                stopColor="var(--cart-accent)"
                stopOpacity=".4"
              />
              <stop
                offset=".72"
                stopColor="var(--contact-rim-light, var(--cart-light))"
                stopOpacity=".45"
              />
              <stop
                offset="1"
                stopColor="var(--cart-accent)"
                stopOpacity=".25"
              />
            </linearGradient>
            <linearGradient id={id + "-light"} x1="0" y1="0" x2="1" y2=".7">
              <stop stopColor="var(--contact-rim-light, var(--cart-light))" />
              <stop
                offset=".24"
                stopColor="var(--contact-rim-light, var(--cart-light))"
                stopOpacity=".18"
              />
              <stop
                offset=".5"
                stopColor="var(--contact-rim-light, var(--cart-light))"
                stopOpacity=".75"
              />
              <stop
                offset=".68"
                stopColor="var(--contact-rim-light, var(--cart-light))"
                stopOpacity=".2"
              />
              <stop
                offset="1"
                stopColor="var(--contact-rim-light, var(--cart-light))"
              />
            </linearGradient>
            <linearGradient id={id + "-return"} x1="0" y1="1" x2="1" y2="0">
              <stop stopColor="var(--contact-rim-light, var(--cart-light))" />
              <stop
                offset=".38"
                stopColor="var(--cart-accent)"
                stopOpacity=".55"
              />
              <stop
                offset=".76"
                stopColor="var(--contact-rim-light, var(--cart-light))"
                stopOpacity=".24"
              />
              <stop
                offset="1"
                stopColor="var(--contact-rim-light, var(--cart-light))"
              />
            </linearGradient>
            <radialGradient id={id + "-glow"}>
              <stop stopColor="var(--contact-rim-light, var(--cart-light))" />
              <stop
                offset="1"
                stopColor="var(--contact-rim-light, var(--cart-light))"
                stopOpacity="0"
              />
            </radialGradient>
          </defs>
          {contour(band / 2, { stroke: `url(#${id}-body)`, strokeWidth: band })}
          <g opacity={config.presentation.reflection}>
            {contour(band * 0.22, {
              stroke: `url(#${id}-light)`,
              strokeWidth: band * 0.32,
            })}
            {contour(band * 0.57, {
              stroke: `url(#${id}-return)`,
              strokeWidth: band * 0.42,
              opacity: 0.65,
            })}
            {contour(band * 0.86, {
              stroke: `url(#${id}-light)`,
              strokeWidth: band * 0.14,
              opacity: 0.72,
            })}
            <g fill={`url(#${id}-glow)`}>
              <ellipse
                cx={w - corner}
                cy={corner}
                rx={Math.min(10, w * 0.1)}
                ry={band * 0.65}
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
          </g>
        </svg>
      )}
    </span>
  );
}
