import React from 'react';

// Only the artwork's luminance describes the relief. Its painted RGB colors
// never reach the result; both colored contours and light come from the editor.
export default function CatalogGlassMaterialFilter({ id, color, reflectionColor, reflection, density = 1 }) {
  return <filter id={id} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
    <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  .2126 .7152 .0722 0 0" result="luminance"/>
    <feComponentTransfer in="luminance" result="contour">
      <feFuncA type="linear" slope={-density} intercept={density}/>
    </feComponentTransfer>
    <feComposite in="contour" in2="SourceAlpha" operator="in" result="contourMask"/>
    <feFlood floodColor={color} result="contourColor"/>
    <feComposite in="contourColor" in2="contourMask" operator="in" result="coloredContour"/>
    <feComponentTransfer in="luminance" result="highlight">
      <feFuncA type="linear" slope="5" intercept="-4"/>
    </feComponentTransfer>
    <feComposite in="highlight" in2="SourceAlpha" operator="in" result="highlightMask"/>
    <feFlood floodColor={reflectionColor} floodOpacity={reflection} result="highlightColor"/>
    <feComposite in="highlightColor" in2="highlightMask" operator="in" result="coloredHighlight"/>
    <feMerge><feMergeNode in="coloredContour"/><feMergeNode in="coloredHighlight"/></feMerge>
  </filter>;
}
