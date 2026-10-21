import React, { Children, cloneElement, isValidElement, useLayoutEffect, useRef } from 'react';
import { mountStorefrontSectionMotion } from '../lib/storefrontSectionMotion';
import { normalizeStoryConfig } from '../lib/storefrontStoryConfig';
import '../storefrontSectionMotion.css';

export default function StorefrontStory({children,config,viewportRef,mobileOverride,replayKey=0,className=''}) {
  const root=useRef(null), key=JSON.stringify(normalizeStoryConfig(config));
  useLayoutEffect(()=>mountStorefrontSectionMotion(root.current,JSON.parse(key),{scroller:viewportRef?.current,mobileOverride}),[key,viewportRef,mobileOverride,replayKey]);
  return <div ref={root} className={'storefront-sections min-w-0 max-w-full flex-grow '+className}>
    {Children.toArray(children).filter(isValidElement).map(child=>cloneElement(child,{
      'data-story-chapter':'true',
      children:<div className="storefront-chapter-surface">{child.props.children}</div>,
    }))}
  </div>;
}
