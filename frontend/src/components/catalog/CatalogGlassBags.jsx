import React, { useId } from 'react';

// Decorative vector artwork: no uploaded image or business-specific asset required.
export default function CatalogGlassBags() {
  const id = useId().replace(/:/g, '');
  return <svg className="cpv-glass-bags" viewBox="0 0 220 150" fill="none" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`${id}-edge`} x1="30" y1="10" x2="190" y2="145" gradientUnits="userSpaceOnUse">
        <stop stopColor="#fffaf2"/><stop offset=".18" stopColor="#bd8564"/><stop offset=".32" stopColor="#fffaf4"/><stop offset=".53" stopColor="#d1a07e"/><stop offset=".72" stopColor="#fff"/><stop offset="1" stopColor="#ad735d"/>
      </linearGradient>
      <linearGradient id={`${id}-glass`} x1="40" y1="45" x2="185" y2="140" gradientUnits="userSpaceOnUse">
        <stop stopColor="#fff" stopOpacity=".65"/><stop offset=".45" stopColor="currentColor" stopOpacity=".08"/><stop offset=".8" stopColor="#fff" stopOpacity=".32"/><stop offset="1" stopColor="currentColor" stopOpacity=".16"/>
      </linearGradient>
    </defs>
    <ellipse cx="119" cy="139" rx="78" ry="5" fill="currentColor" opacity=".08"/>
    <g stroke={`url(#${id}-edge)`} strokeWidth="2" strokeLinejoin="round">
      <path d="M111 48 178 52 188 128 111 135 99 124Z" fill={`url(#${id}-glass)`}/>
      <path d="m111 48 1 87m66-83-10 8-56-4m56 4 5 66 15 2m-15-2-61 9"/>
      <path d="M126 58V31c0-28 35-27 35 1v29m-30-3V32c0-20 25-20 25 0v28"/>
      <path d="m39 77 59-5 14 63-66 7-15-10Z" fill={`url(#${id}-glass)`}/>
      <path d="m39 77 7 65m52-70-9 9-50 5m50-5 9 52 14 2m-14-2-52 9"/>
      <path d="M50 85V61c0-26 29-27 31-3l2 24M55 85V62c0-19 21-20 22-3l2 23"/>
    </g>
    <path d="m115 61 2 59m-74-30 5 40m68-79 49 4" stroke="#fff" strokeOpacity=".75" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>;
}
