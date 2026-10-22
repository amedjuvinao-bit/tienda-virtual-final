import { normalizeStoryConfig, STORY_VISIBILITY_EVENT } from './storefrontStoryConfig';
import { collectStoryActors, actorPresentation } from './storefrontStoryActors';
import { startStoryFragments, storyFragmentImage, storyWeaveFallback } from './storefrontStoryFragments';
import { journeyActorPresentation, journeyChapterPresentation } from './storefrontJourneyPresentation';

function pauseCoveredMedia(node) {
  const fullscreen=node.ownerDocument.fullscreenElement;
  node.querySelectorAll('video').forEach(video=>{if(!video.paused && !fullscreen?.contains(video))video.pause();});
  node.querySelectorAll('iframe').forEach(frame=>{if(!fullscreen?.contains(frame) && /^https:\/\/www\.tiktok\.com\/player\//i.test(frame.src))frame.contentWindow?.postMessage({'x-tiktok-player':true,type:'pause'},'https://www.tiktok.com');});
}

// Navigation always uses the natural flow, independently of actor animations.
export function storefrontSectionTop(element) {
  if(element?.dataset.storyTop!==undefined && Number.isFinite(Number(element.dataset.storyTop)))return Number(element.dataset.storyTop);
  let top=0;for(let node=element;node;node=node.offsetParent)top+=node.offsetTop;return top;
}

export function mountStorefrontSectionMotion(container,rawConfig,{scroller=null,mobileOverride}={}) {
  if(!container)return ()=>{};
  const view=container.ownerDocument.defaultView, doc=container.ownerDocument, config=normalizeStoryConfig(rawConfig);
  const reduce=view.matchMedia?.('(prefers-reduced-motion: reduce)'), mobile=view.matchMedia?.('(max-width: 767px)');
  const eventTarget=scroller || view, pace={quick:.78,balanced:1,leisurely:1.28}[config.pace];
  let chapters=[],frame=0,dirty=true,disposed=false,active=null,lastY=scroller?scroller.scrollTop:view.scrollY;
  const scroll=()=>scroller?scroller.scrollTop:view.scrollY;
  const viewport=()=>scroller?scroller.clientHeight:view.innerHeight;
  const compact=()=>typeof mobileOverride==='boolean'?mobileOverride:mobile?.matches;
  const enabled=()=>config.enabled && !reduce?.matches && !(compact() && config.mobileMode==='off');
  const canAnimate=()=>enabled() && typeof container.animate==='function';
  const headerClearance=()=>{
    const header=!scroller && doc.querySelector('.theme-header');
    return header && header.dataset.visible!=='false'?header.getBoundingClientRect().height+(parseFloat(view.getComputedStyle(header).top)||0):0;
  };
  function releaseActor(actor) {
    if(actor.animation){actor.animation.onfinish=null;actor.animation.cancel();actor.animation=null;}
    actor.fragments?.();actor.fragments=null;
    actor.state='done';delete actor.element.dataset.storyActing;delete actor.element.dataset.storyWeave;
  }
  function finishChapter(chapter) {
    if(chapter.transition){chapter.transition.onfinish=null;chapter.transition.cancel();chapter.transition=null;}
    delete chapter.surface.dataset.journeyOpening;
    chapter.phase='ready';chapter.node.dataset.storyStage='ready';
    chapter.actors.forEach(releaseActor);
    delete chapter.node.dataset.storyPerforming;
  }
  function releaseChapter(chapter) {
    finishChapter(chapter);
    chapter.actors.forEach(actor=>{delete actor.element.dataset.storyRole;});
    for(const key of ['storyTop','storyIndex','storyVisible','sectionMotion','sectionDirection','storyStage','storyPerforming'])delete chapter.node.dataset[key];
    for(const key of ['--story-pin-top','--story-layer'])chapter.node.style.removeProperty(key);
  }
  function prepareActor(actor) {
    if(!canAnimate() || !actor.element.animate){actor.state='done';return;}
    const adapted=compact() && config.mobileMode==='adapted';
    const plan=config.experience==='journey'?journeyActorPresentation(actor,config.intensity,adapted):actorPresentation(config.preset,actor,config.intensity,adapted);
    if(plan.fragments && !storyFragmentImage(actor)){plan.frames=storyWeaveFallback();plan.fragments=false;plan.easing='cubic-bezier(.65,0,.25,1)';}
    if(plan.fragments)actor.element.dataset.storyWeave='true';
    actor.plan=plan;actor.state='waiting';
    actor.animation=actor.element.animate(plan.frames,{duration:plan.duration*pace,delay:plan.delay*pace,fill:'both',easing:plan.easing});
    actor.animation.id=`story:${actor.role}:${actor.index}`;
    actor.animation.pause();actor.animation.currentTime=0;
  }
  function armChapter(chapter) {
    finishChapter(chapter);chapter.phase='waiting';chapter.node.dataset.storyStage='waiting';
    chapter.actors.forEach(prepareActor);
    prepareChapter(chapter);
  }
  function prepareChapter(chapter){
    if(config.experience!=='journey' || !canAnimate() || !chapter.surface.animate || chapter.transition)return;
    const plan=journeyChapterPresentation(config.intensity,compact() && config.mobileMode==='adapted');
    chapter.transition=chapter.surface.animate(plan.frames,{duration:plan.duration*pace,fill:'both',easing:plan.easing});
    chapter.transition.id='story:journey:chapter';chapter.transition.pause();chapter.transition.currentTime=0;
    chapter.surface.dataset.journeyOpening='true';
    chapter.transition.onfinish=()=>{
      const transition=chapter.transition;chapter.transition=null;transition?.cancel();
      if(!chapter.actors.some(actor=>actor.state==='playing'))delete chapter.surface.dataset.journeyOpening;
    };
  }
  function startActor(chapter,actor,deferred=false) {
    if(actor.state!=='waiting'||!actor.animation)return;
    if(actor.plan.mechanism==='weave' && Boolean(storyFragmentImage(actor))!==actor.plan.fragments){
      actor.animation.cancel();delete actor.element.dataset.storyWeave;prepareActor(actor);
    }
    actor.state='playing';actor.element.dataset.storyActing='true';chapter.node.dataset.storyPerforming='true';
    if(config.experience==='journey')chapter.surface.dataset.journeyOpening='true';
    const delay=deferred?Math.min(100+actor.index*35,240):actor.plan.delay;
    if(deferred)actor.animation.effect?.updateTiming({delay:delay*pace});
    if(actor.plan.fragments)actor.fragments=startStoryFragments(actor,chapter.surface,{delay:delay*pace,duration:actor.plan.duration*pace,compact:compact(),intensity:config.intensity});
    actor.animation.onfinish=()=>{
      releaseActor(actor);
      if(!chapter.actors.some(a=>a.state==='playing')){
        delete chapter.node.dataset.storyPerforming;
        if(!chapter.transition)delete chapter.surface.dataset.journeyOpening;
      }
      if(chapter.phase==='presented' && chapter.actors.every(a=>a.state==='done')){chapter.phase='ready';chapter.node.dataset.storyStage='ready';}
    };
    actor.animation.play();
  }
  function openChapter(chapter) {
    if(chapter.phase!=='waiting')return;
    chapter.openedAt=view.performance.now();chapter.phase='presented';chapter.node.dataset.storyStage='presented';
    chapter.transition?.play();
  }

  function measure() {
    const prior=new Map(chapters.map(chapter=>[chapter.node,chapter]));
    // Read natural section positions without resetting an ongoing presentation.
    delete container.dataset.storyPreset;
    const rootRect=container.getBoundingClientRect(), rootTop=rootRect.top+(scroller?scroller.scrollTop-scroller.getBoundingClientRect().top:scroll());
    const vh=viewport();
    chapters=[...container.children].filter(node=>node.tagName==='SECTION' && node.offsetHeight>0).map((node,index)=>{
      const surface=node.querySelector(':scope>.storefront-chapter-surface') || node, rect=node.getBoundingClientRect();
      const old=prior.get(node);prior.delete(node);
      const chapter=old || {node,surface,actors:[],phase:'waiting',visible:false,replayArmed:false};
      Object.assign(chapter,{top:rootTop+rect.top-rootRect.top,height:rect.height || node.offsetHeight,index});
      node.dataset.storyTop=String(chapter.top);node.dataset.storyIndex=String(index);
      node.style.setProperty('--story-layer',index+1);node.style.setProperty('--story-pin-top',Math.min(0,vh-chapter.height)+'px');
      const existing=new Map(chapter.actors.map(actor=>[actor.element,actor]));
      const nativeBanner=!scroller && node.id==='banner';
      chapter.actors=collectStoryActors(surface,vh).map(item=>{
        const previous=existing.get(item.element);existing.delete(item.element);
        const actor=previous || {...item,state:'done',animation:null};Object.assign(actor,item);actor.element.dataset.storyRole=actor.role;
        if(!previous && !nativeBanner && (chapter.phase==='waiting' || !old))prepareActor(actor);
        return actor;
      });
      existing.forEach(actor=>{releaseActor(actor);delete actor.element.dataset.storyRole;});
      if(!canAnimate() || (!scroller && node.id==='banner'))finishChapter(chapter);
      else if(!old){
        node.dataset.storyStage='waiting';
        if(chapter.top<scroll()-vh*.15){finishChapter(chapter);chapter.replayArmed=true;}
        else prepareChapter(chapter);
      }
      observer?.observe(node);return chapter;
    });
    prior.forEach(releaseChapter);
    if(enabled() && config.experience==='entrances')container.dataset.storyPreset=config.preset;
    dirty=false;
  }
  function update() {
    frame=0;if(disposed)return;if(dirty)measure();if(!enabled())return;
    const y=scroll(),vh=viewport(),clearance=headerClearance();
    const atEnd=y>=Math.max(0,(scroller?scroller.scrollHeight:doc.documentElement.scrollHeight)-vh)-1;
    const direction=y<lastY?'up':'down';
    const current=[...chapters].reverse().find(chapter=>chapter.top<=y+clearance+vh*.25) || chapters[0];
    if(current && current!==active){
      if(active){active.node.dataset.sectionMotion='leaving';active.node.dataset.sectionDirection=direction;}
      current.node.dataset.sectionMotion='entering';current.node.dataset.sectionDirection=direction;container.dataset.storyActive=current.node.id;active=current;
    }
    chapters.forEach((chapter,index)=>{
      const next=chapters[index+1], visible=chapter.top<y+vh && (!next || next.top>y+clearance);
      const wasVisible=chapter.visible;chapter.visible=visible;
      if(chapter.node.dataset.storyVisible!==String(visible)){
        chapter.node.dataset.storyVisible=String(visible);
        if(!visible)pauseCoveredMedia(chapter.node);
        chapter.node.dispatchEvent(new view.CustomEvent(STORY_VISIBILITY_EVENT,{detail:{visible}}));
      }
      if(!visible && wasVisible){finishChapter(chapter);chapter.replayArmed=Boolean(scroller || chapter.node.id!=='banner');}
      if(!visible)return;
      const localTop=chapter.top-y;
      if(chapter.replayArmed && direction==='up' && localTop>=clearance-48){armChapter(chapter);chapter.replayArmed=false;}
      if(chapter.phase==='waiting' && (chapter.actors.length || chapter.transition) && (localTop<=vh*(config.experience==='journey'?.58:.32) || atEnd))openChapter(chapter);
      if(['opening','presented'].includes(chapter.phase)){
        const deferred=view.performance.now()-(chapter.openedAt || 0)>500*pace;
        chapter.actors.forEach(actor=>{if(actor.state==='waiting' && chapter.top+actor.geometry.y<y+vh*.94)startActor(chapter,actor,deferred);});
      }
    });
    lastY=y;
  }
  function schedule(){if(!disposed && !frame)frame=view.requestAnimationFrame(update);}
  function resize(){dirty=true;schedule();}
  function interaction(event){const chapter=chapters.find(item=>item.node.contains(event.target));if(chapter){finishChapter(chapter);chapter.replayArmed=false;}}
  function preference(){chapters.forEach(releaseChapter);chapters=[];active=null;resize();}
  function hide(){if(doc.hidden)chapters.filter(chapter=>['opening','presented'].includes(chapter.phase)).forEach(finishChapter);}
  const mutation=new view.MutationObserver(resize), observer=view.ResizeObserver?new view.ResizeObserver(resize):null;
  mutation.observe(container,{childList:true,subtree:true});observer?.observe(container);if(container.parentElement)observer?.observe(container.parentElement);
  eventTarget.addEventListener('scroll',schedule,{passive:true});view.addEventListener('resize',resize);
  reduce?.addEventListener?.('change',preference);mobile?.addEventListener?.('change',preference);
  container.addEventListener('focusin',interaction,true);container.addEventListener('pointerdown',interaction,true);container.addEventListener('load',resize,true);doc.addEventListener('visibilitychange',hide);
  update();
  return ()=>{
    disposed=true;eventTarget.removeEventListener('scroll',schedule);view.removeEventListener('resize',resize);
    reduce?.removeEventListener?.('change',preference);mobile?.removeEventListener?.('change',preference);
    container.removeEventListener('focusin',interaction,true);container.removeEventListener('pointerdown',interaction,true);container.removeEventListener('load',resize,true);doc.removeEventListener('visibilitychange',hide);
    mutation.disconnect();observer?.disconnect();if(frame)view.cancelAnimationFrame(frame);chapters.forEach(releaseChapter);
    delete container.dataset.storyPreset;delete container.dataset.storyActive;
  };
}
