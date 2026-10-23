import React from 'react';
import { catalogGlassToneTables } from './catalogGlassToneMap';

// Only the artwork's luminance describes the relief. Its painted RGB colors
// never reach the result; both colored contours and light come from the editor.
export default function CatalogGlassMaterialFilter({ id, color, reflectionColor, reflection, depthColor, depth, shadeScale = 1 }) {
  const [red, green, blue] = catalogGlassToneTables({ color, depthColor, depth, reflectionColor, reflection, shadeScale });
  return <filter id={id} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
    <feColorMatrix in="SourceGraphic" type="saturate" values="0" result="luminance"/>
    <feComponentTransfer in="luminance">
      <feFuncR type="table" tableValues={red}/>
      <feFuncG type="table" tableValues={green}/>
      <feFuncB type="table" tableValues={blue}/>
      <feFuncA type="identity"/>
    </feComponentTransfer>
  </filter>;
}
