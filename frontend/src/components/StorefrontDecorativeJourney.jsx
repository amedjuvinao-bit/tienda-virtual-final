import React, { useId } from 'react';

// A single store-owned ornament travels through the background. Content is
// protected as a complete surface, including photos and transparent panels.
export default function StorefrontDecorativeJourney({config}){
  const uid='journey-'+useId().replace(/:/g,''),mask=uid+'-mask',source=config.image || config.secondaryImage;
  return <div className="story-journey-pin" data-journey-pin aria-hidden="true">
    <svg className="story-journey-world" data-journey-world viewBox="0 0 1440 900" preserveAspectRatio="none" focusable="false">
      <defs><mask id={mask} maskUnits="userSpaceOnUse" x="0" y="0" width="1440" height="900" data-journey-mask><rect width="100%" height="100%" fill="white"/><g fill="black">{Array.from({length:128},(_,i)=><rect data-journey-occluder key={i} width="0" height="0"/>)}</g></mask></defs>
      <g mask={`url(#${mask})`}>
        <path data-journey-stem className="story-journey-stem" fill="none" stroke={config.stemColor || 'var(--color-accent, currentColor)'} strokeWidth="1.5" strokeLinecap="round"/>
        <g data-journey-lead><g data-journey-piece="0" opacity="0">{source && <image href={source} x="-50" y="-50" width="100" height="100" preserveAspectRatio="xMidYMid meet" onLoad={event=>event.currentTarget.style.display=''} onError={event=>event.currentTarget.style.display='none'}/>}</g></g>
      </g>
    </svg>
  </div>;
}
