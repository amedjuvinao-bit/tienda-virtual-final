import React from 'react';

// A single, persistent ornament world belongs to the entire storefront.
// Real content is layered above this world; no per-element visibility masks.
export default function StorefrontDecorativeJourney({config}){
  return <div className="story-journey-pin" data-journey-pin aria-hidden="true">
    <svg className="story-journey-world" data-journey-world viewBox="0 0 1440 900" preserveAspectRatio="none" focusable="false">
      <g>
        <path data-journey-stem className="story-journey-stem" pathLength="1000" fill="none" stroke={config.stemColor || 'var(--color-accent, currentColor)'} strokeWidth="2" strokeLinecap="round"/>
        <path data-journey-trace fill="none" pathLength="1000" stroke={config.stemColor || 'var(--color-accent, currentColor)'} strokeWidth="2.5" strokeLinecap="round" strokeDasharray="125 875"/>
        <g data-journey-ornaments>{Array.from({length:28},(_,i)=>{
          const source=i%3===1 && config.secondaryImage?config.secondaryImage:(config.image || config.secondaryImage);
          return <g data-journey-piece={i} key={i} opacity="0">{source && <>
            <image href={source} data-journey-rigid x="-50" y="-50" width="100" height="100" preserveAspectRatio="xMidYMid meet" onError={event=>event.currentTarget.style.display='none'}/>
          </>}</g>;
        })}</g>
      </g>
    </svg>
  </div>;
}
