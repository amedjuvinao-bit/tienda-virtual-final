import React, { useId } from 'react';
import { JOURNEY_ARTWORK_BANDS, journeyArtworkTriangles, journeyArtworkClipPoints } from '../lib/decorativeJourneyMesh';

// A single, persistent ornament world belongs to the entire storefront.
// Occlusion makes the configured ornaments pass behind the real content, even when a
// section uses its own container queries or stacking contexts.
export default function StorefrontDecorativeJourney({config}){
  const uid='journey-'+useId().replace(/:/g,''),mask=uid+'-mask';
  return <div className="story-journey-pin" data-journey-pin aria-hidden="true">
    <svg className="story-journey-world" data-journey-world viewBox="0 0 1440 900" preserveAspectRatio="none" focusable="false">
      <defs>
        {[['main',config.image || config.secondaryImage],['secondary',config.secondaryImage]].map(([id,source])=>source && <image key={id} id={uid+'-'+id} href={source} x="0" y="0" width="1" height="1" preserveAspectRatio="none"/>)}
        {['vertical','horizontal'].flatMap(axis=>Array.from({length:JOURNEY_ARTWORK_BANDS},(_,index)=>journeyArtworkTriangles(index,axis==='vertical').map((points,triangle)=><clipPath key={axis+index+triangle} id={`${uid}-${axis}-${index*2+triangle}`} clipPathUnits="userSpaceOnUse"><polygon points={journeyArtworkClipPoints(points)}/></clipPath>)))}
        <mask id={mask} maskUnits="userSpaceOnUse" x="0" y="0" width="1440" height="900" data-journey-mask>
          <rect width="100%" height="100%" fill="white"/>
          <g fill="black">{Array.from({length:128},(_,i)=><rect data-journey-occluder key={i} width="0" height="0"/>)}</g>
        </mask>
      </defs>
      <g mask={`url(#${mask})`}>
        <path data-journey-stem className="story-journey-stem" pathLength="1000" fill="none" stroke={config.stemColor || 'var(--color-accent, currentColor)'} strokeWidth="2" strokeLinecap="round"/>
        <path data-journey-trace fill="none" pathLength="1000" stroke={config.stemColor || 'var(--color-accent, currentColor)'} strokeWidth="2.5" strokeLinecap="round" strokeDasharray="125 875"/>
        <g data-journey-ornaments>{Array.from({length:28},(_,i)=>{
          const source=i%3===1 && config.secondaryImage?config.secondaryImage:(config.image || config.secondaryImage);
          const sourceId=i%3===1 && config.secondaryImage?'secondary':'main';
          return <g data-journey-piece={i} data-journey-mesh-prefix={uid} data-journey-artwork-source={`${uid}-${sourceId}`} key={i} opacity="0">{source && <>
            <image href={source} data-journey-rigid x="-50" y="-50" width="100" height="100" preserveAspectRatio="xMidYMid meet" onLoad={event=>event.currentTarget.style.display=event.currentTarget.parentElement.dataset.journeyBent==='true'?'none':''} onError={event=>event.currentTarget.style.display='none'}/>
            <g data-journey-mesh style={{display:'none'}}/>
          </>}</g>;
        })}</g>
      </g>
    </svg>
  </div>;
}
