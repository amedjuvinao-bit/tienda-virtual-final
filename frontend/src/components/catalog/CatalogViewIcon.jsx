import React from 'react';

// Miniature layouts make each density recognizable without reading a tooltip.
export default function CatalogViewIcon({ columns, color }) {
  const tileWidth = (18 - (columns - 1) * 2) / columns;
  return <svg className="cpv-view-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false" style={{color}}>
    {columns === 1 ? [4, 10, 16].map(y => <g key={y}>
      <rect x="3" y={y} width="4" height="4" rx="1" fill="currentColor" fillOpacity=".2" stroke="currentColor" strokeWidth=".9"/>
      <path d={`M10 ${y+1}H21M10 ${y+3}H17`} stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
    </g>) : [5, 13].flatMap(y => Array.from({length:columns}, (_,index) => <rect key={`${y}-${index}`} x={3+index*(tileWidth+2)} y={y} width={tileWidth} height="6" rx={Math.min(1,tileWidth/3)} fill="currentColor" fillOpacity=".2" stroke="currentColor" strokeWidth=".8"/>))}
  </svg>;
}
