import { clampStory, normalizeStoryConfig, storyVisual, STORY_VISIBILITY_EVENT } from './storefrontStoryConfig';

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
  let chapters=[], frame=0, dirty=true, active=null, disposed=false;
  const scroll=()=>scroller?scroller.scrollTop:view.scrollY;
  const viewportHeight=()=>scroller?scroller.clientHeight:view.innerHeight;
  const isMobile=()=>typeof mobileOverride==='boolean'?mobileOverride:mobile?.matches;
  const enabled=()=>config.enabled && !reduce?.matches && !(isMobile() && config.mobileMode==='off');
  const strength=()=>config.intensity/100*(isMobile() && config.mobileMode==='adapted' ? .55 : 1);
  const header=()=>scroller?0:Math.min(180,parseFloat(view.getComputedStyle(container.ownerDocument.documentElement).getPropertyValue('--site-header-height'))||0);
  const cancelGroups=chapter=>chapter.groups.forEach(item=>item.animation.cancel());
  const clear=()=>{
    chapters.forEach(chapter=>{
      cancelGroups(chapter);
      for(const key of ['storyTop','storyIndex','storyVisible','sectionMotion','sectionDirection'])delete chapter.node.dataset[key];
      chapter.node.style.removeProperty('--story-pin-top');
      chapter.node.style.removeProperty('--story-layer');
      for(const key of ['transform','opacity','clip-path','border-radius','box-shadow'])chapter.surface.style.removeProperty(key);
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
      const chapter={node,surface,top:rootTop+rect.top-rootRect.top,height,groups:[]};
      node.dataset.storyTop=String(chapter.top);
      node.dataset.storyIndex=String(index);
      node.style.setProperty('--story-layer',index+1);
      node.style.setProperty('--story-pin-top',Math.min(0,viewportHeight()-height)+'px');
      if(enabled() && typeof surface.animate==='function') {
        const headings=Array.from(surface.querySelectorAll('h1,h2')).slice(0,1);
        const blocks=Array.from(surface.querySelectorAll('[data-story-visual],article,figure')).filter(el=>!el.parentElement.closest('article,figure'));
        const media=blocks.length?blocks:Array.from(surface.querySelectorAll('picture,img,video')).filter(el=>{const box=el.getBoundingClientRect();return !el.parentElement.closest('picture') && box.width>=100 && box.height>=80;});
        const visuals=media.slice(0,config.preset==='cascade'?4:1);
        const actions=Array.from(surface.querySelectorAll('[data-story-action],a,button')).filter(el=>!el.closest('article,figure,nav,[role="tablist"]') && !el.closest('.footer-ed__navigation') && !el.querySelector('img,picture,video')).slice(0,1);
        const targets=[...new Set([...headings,...visuals,...actions])];
        chapter.groups=targets.map((element,order)=>{
          const animation=element.animate([{opacity:.12,translate:`0 ${strength()*(config.preset==='cascade'?48:22)}px`},{opacity:1,translate:'0 0'}],{duration:1000,fill:'both',easing:'cubic-bezier(.16,1,.3,1)'});
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
    const y=scroll(), vh=viewportHeight(), offset=header();
    const range=vh*({quick:.32,balanced:.5,leisurely:.7}[config.pace]);
    const anchor=y+vh*.42;
    const current=[...chapters].reverse().find(chapter=>chapter.top<=anchor) || chapters[0];
    if(current && current!==active) {
      const direction=active && current.top<active.top?'up':'down';
      if(active){active.node.dataset.sectionMotion='leaving';active.node.dataset.sectionDirection=direction;}
      current.node.dataset.sectionMotion='entering';current.node.dataset.sectionDirection=direction;
      container.dataset.storyActive=current.node.id;
      active=current;
    }
    chapters.forEach((chapter,index)=>{
      const enter=index===0?1:clampStory((y+vh-chapter.top)/range);
      const next=chapters[index+1];
      const visible=chapter.top<y+vh && (config.preset==='stack'?(!next || next.top>y):chapter.top+chapter.height>y);
      if(chapter.node.dataset.storyVisible!==String(visible)) {
        chapter.node.dataset.storyVisible=String(visible);
        if(!visible)pauseCoveredMedia(chapter.node);
        chapter.node.dispatchEvent(new view.CustomEvent(STORY_VISIBILITY_EVENT,{detail:{visible}}));
      }
      const exit=next?clampStory((y+vh-next.top)/Math.max(1,vh-offset)):0;
      const visual=storyVisual(config.preset,enter,exit,strength());
      chapter.surface.style.transform=visual.transform;
      chapter.surface.style.opacity=String(visual.opacity);
      chapter.surface.style.clipPath=visual.clip;
      chapter.surface.style.borderRadius=visual.radius?`${visual.radius}px ${visual.radius}px 0 0`:'0px';
      chapter.surface.style.boxShadow=config.preset==='stack' && index>0?'0 -12px 34px -18px #56233550':'none';
      chapter.groups.forEach(group=>{
        const {animation,order}=group;
        const delay=order*(config.preset==='cascade' ? .16 : .09);
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
    if(!enabled() || config.preset!=='stack')return;
    const chapter=chapters.find(item=>item.node.contains(event.target));
    const index=chapters.indexOf(chapter), next=chapters[index+1];
    if(chapter && next && next.top<scroll()+header()+40) {
      if(scroller)scroller.scrollTop=chapter.top;
      else view.scrollTo({top:Math.max(0,chapter.top-header()),behavior:'instant'});
    }
  }
  const mutation=new view.MutationObserver(resize);
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
  container.addEventListener('load',resize,true);
  update();
  return ()=>{
    disposed=true;
    eventTarget.removeEventListener('scroll',schedule);
    view.removeEventListener('resize',resize);
    reduce?.removeEventListener?.('change',resize);
    mobile?.removeEventListener?.('change',resize);
    container.removeEventListener('focusin',focus);
    container.removeEventListener('load',resize,true);
    mutation.disconnect();observer?.disconnect();
    if(frame)view.cancelAnimationFrame(frame);
    clear();
  };
}
