import React, { useId } from 'react';

// One lead stays mounted throughout the story. Smaller accents pass behind the
// content; the lead frames the scene and has its own protection for real text.
export default function StorefrontDecorativeJourney({config}){
  const uid='journey-'+useId().replace(/:/g,''),mask=uid+'-mask',textMask=uid+'-text-mask';
  const ornament=i=>{const source=i%3===1 && config.secondaryImage?config.secondaryImage:(config.image || config.secondaryImage);return <g data-journey-piece={i} key={i} opacity="0">{source && <image href={source} x="-50" y="-50" width="100" height="100" preserveAspectRatio="xMidYMid meet" onLoad={event=>event.currentTarget.style.display=''} onError={event=>event.currentTarget.style.display='none'}/>}</g>;};
  return <div className="story-journey-pin" data-journey-pin aria-hidden="true">
    <svg className="story-journey-world" data-journey-world viewBox="0 0 1440 900" preserveAspectRatio="none" focusable="false">
      <defs>{[[mask,'data-journey-mask','data-journey-occluder'],[textMask,'data-journey-text-mask','data-journey-text-occluder']].map(([id,marker,piece])=><mask key={id} id={id} maskUnits="userSpaceOnUse" x="0" y="0" width="1440" height="900" {...{[marker]:true}}><rect width="100%" height="100%" fill="white"/><g fill="black">{Array.from({length:128},(_,i)=><rect {...{[piece]:true}} key={i} width="0" height="0"/>)}</g></mask>)}</defs>
      <g mask={`url(#${mask})`}>
        <path data-journey-stem className="story-journey-stem" fill="none" stroke={config.stemColor || 'var(--color-accent, currentColor)'} strokeWidth="1.5" strokeLinecap="round"/>
        <g data-journey-ornaments>{Array.from({length:27},(_,i)=>ornament(i+1))}</g>
      </g>
      <g mask={`url(#${textMask})`}><g data-journey-lead>{ornament(0)}</g></g>
    </svg>
  </div>;
}
