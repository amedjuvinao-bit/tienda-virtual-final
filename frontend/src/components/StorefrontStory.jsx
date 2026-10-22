import React, { Children, cloneElement, isValidElement, useLayoutEffect, useRef } from 'react';
import { mountStorefrontSectionMotion } from '../lib/storefrontSectionMotion';
import { normalizeStoryConfig } from '../lib/storefrontStoryConfig';
import '../storefrontSectionMotion.css';
import '../storefrontDecorativeJourney.css';
import StorefrontDecorativeJourney from './StorefrontDecorativeJourney';
import { mountDecorativeJourney } from '../lib/decorativeJourney';
import { mountJourneyParallax } from '../lib/storefrontJourneyParallax';
import '../storefrontJourneyParallax.css';

export default function StorefrontStory({children,config,viewportRef,mobileOverride,replayKey=0,className=''}) {
  const root=useRef(null), normalized=normalizeStoryConfig(config),key=JSON.stringify(normalized);
  useLayoutEffect(()=>{
    const view=root.current.ownerDocument.defaultView;
    let frame=0,disposed=false,stop=()=>{};
    const mount=()=>{
      if(disposed)return;
      const options={scroller:viewportRef?.current,mobileOverride},settings=JSON.parse(key);
      const stopSections=mountStorefrontSectionMotion(root.current,settings,options);
      const stopJourney=mountDecorativeJourney(root.current,settings,options);
      const stopParallax=mountJourneyParallax(root.current,settings,options);
      stop=()=>{stopParallax();stopJourney();stopSections();};
    };
    // Parent DOM refs attach after child layout effects. Wait for the preview
    // viewport instead of accidentally binding its choreography to the window.
    if(viewportRef && !viewportRef.current)frame=view.requestAnimationFrame(mount);else mount();
    return ()=>{disposed=true;if(frame)view.cancelAnimationFrame(frame);stop();};
  },[key,viewportRef,mobileOverride,replayKey]);
  return <div ref={root} className={'storefront-sections min-w-0 max-w-full flex-grow '+className} style={{'--journey-shared-image':normalized.journey.backgroundImage?`url(${JSON.stringify(normalized.journey.backgroundImage)})`:'none'}}>
    {normalized.experience==='journey' && <StorefrontDecorativeJourney config={normalized.journey}/>}
    {Children.toArray(children).filter(isValidElement).map(child=>cloneElement(child,{
      'data-story-chapter':'true',
      children:<div className="storefront-chapter-surface">{child.props.children}</div>,
    }))}
  </div>;
}
