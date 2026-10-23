import React from 'react';
import { normalizeEditorialOptions } from '../footer/footerEditorialConfig';
import './catalogGlassTexture.css';

// Reuse the rendered glass artwork, extracting only its optical relief.
// Its opaque face and original gold/brown pigments never reach the page.
function ReliefFilter({ id, color, shadow = false }) {
  return <filter id={id} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
    <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  .2126 .7152 .0722 0 0"/>
    <feComponentTransfer>
      <feFuncA type="table" tableValues={shadow ? '.95 .9 .8 .7 .6 .5 .34 .18 .06 0 0' : '0 0 0 0 0 0 0 0 .04 .5 1'}/>
    </feComponentTransfer>
    <feComposite in2="SourceGraphic" operator="in" result="relief"/>
    <feFlood floodColor={color}/>
    <feComposite in2="relief" operator="in"/>
  </filter>;
}

export function catalogGlassTextureStyle(id) {
  return Object.fromEntries(['heading', 'card', 'footer'].flatMap(surface => ['light', 'shade'].map(tone =>
    [`--cg-${surface}-${tone}`, `url("#${id}-${surface}-${tone}")`],
  )));
}

export default function CatalogGlassTexture({ id, presentation, theme }) {
  const footer = normalizeEditorialOptions(theme?.footer, { theme });
  const palettes = {
    heading: [presentation.headerReflectionColor, presentation.headerMaterialDepthColor],
    card: [presentation.headerReflectionColor, presentation.rimColor],
    footer: [footer.edgeColor, footer.headingColor],
  };
  return <svg className="catalog-glass-defs" aria-hidden="true" focusable="false" width="0" height="0"><defs>
    {Object.entries(palettes).flatMap(([surface, [light, shade]]) => [
      <ReliefFilter key={`${surface}-light`} id={`${id}-${surface}-light`} color={light}/>,
      <ReliefFilter key={`${surface}-shade`} id={`${id}-${surface}-shade`} color={shade} shadow/>,
    ])}
  </defs></svg>;
}
