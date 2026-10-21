import { clampStory, normalizeStoryConfig, storyVisual, storyContentFrames, STORY_VISIBILITY_EVENT } from './storefrontStoryConfig';
import { sceneEntry, mosaicClip } from './storefrontSceneGeometry';

function pauseCoveredMedia(node) {
  const fullscreen=node.ownerDocument.fullscreenElement;
  node.querySelectorAll('video').forEach(video=>{if(!video.paused && !fullscreen?.contains(video))video.pause();});
  node.querySelectorAll('iframe').forEach(frame=>{
    if(!fullscreen?.contains(frame) && /^https:\/\/www\.tiktok\.com\/player\//i.test(frame.src))frame.contentWindow?.postMessage({'x-tiktok-player':true,type:'pause'},'https://www.tiktok.com');
  });
}

// Flow coordinates stay independent of sticky/animated geometry. Navigation can
// use these same coordinates instead of the panel's temporary screen position.
export function storefrontSectionTop(element) {
  if(element?.dataset.storyTop!==undefined && Number.isFinite(Number(element.dataset.storyTop)))return Number(element.dataset.storyTop);
  let top=0;
  for(let node=element;node;node=node.offsetParent)top+=node.offsetTop;
  return top;
}

export function mountStorefrontSectionMotion(container,rawConfig,{scroller=null,mobileOverride}={}) {
  if(!container)return ()=>{};
  const view=container.ownerDocument.defaultView, config=normalizeStoryConfig(rawConfig);
  const reduce=view.matchMedia?.('(prefers-reduced-motion: reduce)'), mobile=view.matchMedia?.('(max-width: 767px)');
  const eventTarget=scroller || view;
  let chapters=[], frame=0, dirty=true, active=null, disposed=false, observedHeader=null;
  const scroll=()=>scroller?scroller.scrollTop:view.scrollY;
  const viewportHeight=()=>scroller?scroller.clientHeight:view.innerHeight;
  const isMobile=()=>typeof mobileOverride==='boolean'?mobileOverride:mobile?.matches;
  const enabled=()=>config.enabled && !reduce?.matches && !(isMobile() && config.mobileMode==='off');
  const strength=()=>config.intensity/100*(isMobile() && config.mobileMode==='adapted' ? .66 : 1);
  const header=()=>scroller?0:Math.min(180,parseFloat(view.getComputedStyle(container.ownerDocument.documentElement).getPropertyValue('--site-header-height'))||0);
  const cancelGroups=chapter=>chapter.groups.forEach(item=>item.animation.cancel());
  const clear=()=>{
    chapters.forEach(chapter=>{
      cancelGroups(chapter);
      for(const key of ['storyTop','storyIndex','storyVisible','sectionMotion','sectionDirection'])delete chapter.node.dataset[key];
      chapter.node.style.removeProperty('--story-pin-top');
      chapter.node.style.removeProperty('--story-layer');
      for(const key of ['transform','transform-origin','opacity','clip-path','border-radius','box-shadow','--story-light','--story-edge','--story-sweep','--story-opening','--story-fold','will-change'])chapter.surface.style.removeProperty(key);
    });
    delete container.dataset.storyPreset;
    delete container.dataset.storyActive;
    active=null;
  };
  function measure() {
    clear();
    const rootRect=container.getBoundingClientRect();
    const rootTop=rootRect.top+(scroller?scroller.scrollTop-scroller.getBoundingClientRect().top:scroll());
    chapters=Array.from(container.children).filter(node=>node.tagName==='SECTION' && node.offsetHeight>0).map((node,index)=>{
      const surface=node.querySelector(':scope > .storefront-chapter-surface') || node;
      observer?.observe(node);
      const rect=node.getBoundingClientRect(), height=rect.height || node.offsetHeight;
      const chapter={node,surface,top:rootTop+rect.top-rootRect.top,height,width:node.offsetWidth || container.clientWidth || view.innerWidth,margin:parseFloat(view.getComputedStyle(node).scrollMarginTop)||0,groups:[],side:index%2?-1:1};
      node.dataset.storyTop=String(chapter.top);
      node.dataset.storyIndex=String(index);
      node.style.setProperty('--story-layer',index+1);
      node.style.setProperty('--story-pin-top',Math.min(0,viewportHeight()-height)+'px');
      if(enabled() && typeof surface.animate==='function') {
        const headings=Array.from(surface.querySelectorAll('h1,h2')).slice(0,1);
        const blockSelector='[data-story-visual],article,figure';
        const blocks=Array.from(surface.querySelectorAll(blockSelector)).filter(el=>!el.parentElement.closest(blockSelector));
        const media=blocks.length?blocks:Array.from(surface.querySelectorAll('picture,img,video')).filter(el=>{const box=el.getBoundingClientRect();return !el.parentElement.closest('picture') && box.width>=100 && box.height>=80;});
        const visuals=media.slice(0,config.preset==='cascade'?4:config.preset==='depth'?3:2);
        const actions=Array.from(surface.querySelectorAll('[data-story-action],a,button')).filter(el=>!el.closest('article,figure,nav,[role="tablist"]') && !el.closest('.footer-ed__navigation') && !el.querySelector('img,picture,video')).slice(0,1);
        const seen=new Set();
        const targets=[...headings.map(element=>({element,kind:'heading'})),...visuals.map(element=>({element,kind:'visual'})),...actions.map(element=>({element,kind:'action'}))].filter(({element})=>{if(seen.has(element))return false;seen.add(element);return true;});
        chapter.groups=targets.map(({element,kind},order)=>{
          const animation=element.animate(storyContentFrames(config.preset,kind,strength(),chapter.side*(order%2?-1:1)),{duration:1000,fill:'both',easing:'cubic-bezier(.22,.68,.2,1)'});
          animation.pause();
          return {animation,order,complete:false};
        });
      }
      return chapter;
    });
    if(enabled())container.dataset.storyPreset=config.preset;
    dirty=false;
  }
  function update() {
    frame=0;
    if(disposed)return;
    if(dirty)measure();
    if(!enabled())return;
    const y=scroll(), vh=viewportHeight();
    const maxScroll=Math.max(0,(scroller?scroller.scrollHeight:container.ownerDocument.documentElement.scrollHeight)-vh);
    const anchor=y+vh*.42;
    const current=[...chapters].reverse().find(chapter=>chapter.top<=anchor) || chapters[0];
    if(current && current!==active) {
      const direction=active && current.top<active.top?'up':'down';
      if(active){active.node.dataset.sectionMotion='leaving';active.node.dataset.sectionDirection=direction;}
      current.node.dataset.sectionMotion='entering';current.node.dataset.sectionDirection=direction;
      container.dataset.storyActive=current.node.id;
      active=current;
    }
    const visibleHeader=!scroller && container.ownerDocument.querySelector('.theme-header');
    if(visibleHeader!==observedHeader){
      headerMutation.disconnect();observedHeader=visibleHeader;
      if(visibleHeader)headerMutation.observe(visibleHeader,{attributes:true,attributeFilter:['data-visible']});
    }
    const clearance=visibleHeader && visibleHeader.dataset.visible!=='false'?Math.max(header(),visibleHeader.getBoundingClientRect().height+(parseFloat(view.getComputedStyle(visibleHeader).top)||0)):0;
    const entries=chapters.map((chapter,index)=>sceneEntry(chapter,chapters[index-1],y,vh,maxScroll,config.pace,clearance?Math.max(clearance,chapter.margin):0));
    chapters.forEach((chapter,index)=>{
      let {progress:enter,lift}=entries[index];
      // Focused controls remain readable and usable when reached by keyboard.
      if(chapter.node.contains(container.ownerDocument.activeElement)){enter=1;lift=0;}
      const next=chapters[index+1];
      const visible=chapter.top<y+vh && (!next || next.top>y);
      if(chapter.node.dataset.storyVisible!==String(visible)) {
        chapter.node.dataset.storyVisible=String(visible);
        if(!visible)pauseCoveredMedia(chapter.node);
        chapter.node.dispatchEvent(new view.CustomEvent(STORY_VISIBILITY_EVENT,{detail:{visible}}));
      }
      const exit=next?entries[index+1].progress:0;
      const visual=storyVisual(config.preset,enter,exit,strength(),chapter.side);
      chapter.surface.style.transform=lift?`translate3d(0,${-lift}px,0) ${visual.transform==='none'?'':visual.transform}`:visual.transform;
      const stagedTop=Math.max(chapter.top-y,Math.min(0,vh-chapter.height))-lift;
      chapter.surface.style.transformOrigin=`${visual.originX} ${Math.max(0,Math.min(chapter.height,vh*.5-stagedTop))}px`;
      chapter.surface.style.setProperty('--story-light',visual.light.toFixed(3));
      chapter.surface.style.setProperty('--story-edge',visual.edge.toFixed(3));
      chapter.surface.style.setProperty('--story-sweep',visual.sweep+'%');
      chapter.surface.style.setProperty('--story-opening',visual.opening+'%');
      chapter.surface.style.setProperty('--story-fold',visual.fold.toFixed(3));
      chapter.surface.style.willChange=visible && (enter<1 || exit>0)?'transform,clip-path':'auto';
      const clip=config.preset==='cascade' && enter<1 && visible?mosaicClip(enter,chapter.width,chapter.height,vh,chapter.side):visual.clip;
      chapter.surface.style.opacity=String(visual.opacity);
      chapter.surface.style.clipPath=clip;
      chapter.surface.style.borderRadius=visual.radius?`${visual.radius}px`:'0px';
      chapter.surface.style.boxShadow=(visual.edge>.005 || (index>0 && enter<1))?'0 -22px 70px -28px var(--story-shadow), 0 32px 90px -30px var(--story-shadow), inset 0 1px 0 #fff9':'none';
      chapter.groups.forEach(group=>{
        const {animation,order}=group;
        const delay=Math.min(.42,order*(config.preset==='cascade' ? .1 : .07));
        const time=clampStory((enter-delay)/(1-delay))*1000, complete=time>=1000;
        // Return control to the section's own hover, slider and media effects
        // once its entrance finishes; restore the timeline when scrolling back.
        if(group.complete!==complete){animation.effect?.updateTiming({fill:complete?'none':'both'});group.complete=complete;}
        animation.currentTime=time;
      });
    });
  }
  function schedule(){if(!disposed && !frame)frame=view.requestAnimationFrame(update);}
  function resize(){dirty=true;schedule();}
  function focus(event) {
    if(!enabled())return;
    const chapter=chapters.find(item=>item.node.contains(event.target));
    const index=chapters.indexOf(chapter), next=chapters[index+1];
    if(chapter && (chapter.top>scroll()+header()+1 || (next && next.top<scroll()+header()+40))) {
      if(scroller)scroller.scrollTop=chapter.top;
      else view.scrollTo({top:Math.max(0,chapter.top-header()),behavior:'instant'});
    }
    schedule();
  }
  const mutation=new view.MutationObserver(resize);
  // The header can reappear after a scroll frame without changing its size.
  const headerMutation=new view.MutationObserver(schedule);
  mutation.observe(container,{childList:true,subtree:true});
  const observer=view.ResizeObserver?new view.ResizeObserver(resize):null;
  observer?.observe(container);
  if(container.parentElement)observer?.observe(container.parentElement);
  const siteHeader=!scroller && container.ownerDocument.querySelector('header');
  if(siteHeader)observer?.observe(siteHeader);
  Array.from(container.children).forEach(node=>observer?.observe(node));
  eventTarget.addEventListener('scroll',schedule,{passive:true});
  view.addEventListener('resize',resize);
  reduce?.addEventListener?.('change',resize);
  mobile?.addEventListener?.('change',resize);
  container.addEventListener('focusin',focus);
  container.addEventListener('focusout',schedule);
  container.addEventListener('load',resize,true);
  update();
  return ()=>{
    disposed=true;
    eventTarget.removeEventListener('scroll',schedule);
    view.removeEventListener('resize',resize);
    reduce?.removeEventListener?.('change',resize);
    mobile?.removeEventListener?.('change',resize);
    container.removeEventListener('focusin',focus);
    container.removeEventListener('focusout',schedule);
    container.removeEventListener('load',resize,true);
    mutation.disconnect();headerMutation.disconnect();observer?.disconnect();
    if(frame)view.cancelAnimationFrame(frame);
    clear();
  };
}
