// Each contour is open at the floating symbol: no paint exists underneath it.
export function glassRimPath(width, height, radius, inset, topGap = 0) {
  const left = inset,
    top = inset;
  const right = Math.max(left, width - inset);
  const bottom = Math.max(top, height - inset);
  const r = Math.max(
    0,
    Math.min(radius - inset, (right - left) / 2, (bottom - top) / 2),
  );
  const gap = Math.min(
    Math.max(0, topGap / 2 + (topGap ? 2 : 0)),
    Math.max(0, width / 2 - r - inset),
  );
  const start = gap ? width / 2 + gap : left + r;
  const end = gap ? width / 2 - gap : start;
  return `M ${start} ${top} H ${right - r} A ${r} ${r} 0 0 1 ${right} ${top + r} V ${bottom - r} A ${r} ${r} 0 0 1 ${right - r} ${bottom} H ${left + r} A ${r} ${r} 0 0 1 ${left} ${bottom - r} V ${top + r} A ${r} ${r} 0 0 1 ${left + r} ${top} H ${end}${gap ? "" : " Z"}`;
}
