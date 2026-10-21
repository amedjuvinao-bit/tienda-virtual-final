import React, { Children, cloneElement, isValidElement, useLayoutEffect, useRef } from 'react';
import { mountStorefrontSectionMotion } from '../lib/storefrontSectionMotion';
import { normalizeStoryConfig } from '../lib/storefrontStoryConfig';
import '../storefrontSectionMotion.css';
import '../storefrontDecorativeJourney.css';
import StorefrontDecorativeJourney from './StorefrontDecorativeJourney';
import { mountDecorativeJourney } from '../lib/decorativeJourney';

export default function StorefrontStory({children,config,viewportRef,mobileOverride,replayKey=0,className=''}) {
  const root=useRef(null), normalized=normalizeStoryConfig(config),key=JSON.stringify(normalized);
  useLayoutEffect(()=>{
    const options={scroller:viewportRef?.current,mobileOverride},settings=JSON.parse(key);
    const stopSections=mountStorefrontSectionMotion(root.current,settings,options);
    const stopJourney=mountDecorativeJourney(root.current,settings,options);
    return ()=>{stopJourney();stopSections();};
  },[key,viewportRef,mobileOverride,replayKey]);
  return <div ref={root} className={'storefront-sections min-w-0 max-w-full flex-grow '+className} style={{'--journey-shared-image':normalized.journey.backgroundImage?`url(${JSON.stringify(normalized.journey.backgroundImage)})`:'none'}}>
    {normalized.experience==='journey' && <StorefrontDecorativeJourney config={normalized.journey}/>}
    {Children.toArray(children).filter(isValidElement).map(child=>cloneElement(child,{
      'data-story-chapter':'true',
      children:<div className="storefront-chapter-surface">{child.props.children}</div>,
    }))}
  </div>;
}
