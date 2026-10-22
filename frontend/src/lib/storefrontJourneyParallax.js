import { collectStoryActors } from './storefrontStoryActors';
import { actorGeometry } from './storefrontSceneGeometry';
import { normalizeStoryConfig } from './storefrontStoryConfig';

const clamp=value=>Math.max(0,Math.min(1,value));
const ease=(from,to,value)=>{const t=clamp((value-from)/(to-from));return t*t*t*(t*(t*6-15)+10);};

// The selected "Capas con parallax" choreography: photographs lead, text
// follows, and secondary pieces cross the outgoing scene on another plane.
export function journeyLayerPose({role,index=0},{entrance=1,handoff=0,width,height,intensity=65,compact=false}={}){
  const strength=(.7+.3*intensity/100)*(compact?.72:1);
  const hero=role==='hero',product=['product','detail','signature'].includes(role);
  const stagger=Math.min(index,5)*.035;
  const arrival=ease(hero?.04:product?.20:.26,hero?.90:1,entrance-stagger*(1-entrance));
  const departure=ease(hero?.30:product?.20:.15,hero?1:.98,handoff);
  const fromX=hero?.32:product?(index%2?.15:-.18):0;
  const fromY=hero?.48:product?.55:.36;
  return {
    x:width*strength*(fromX*(1-arrival)-(hero?.55:product?.44:.16)*departure),
    y:height*strength*(fromY*(1-arrival)+(hero?-.12:product?.06:-.40)*departure),
  };
}

function collectLayers(surface,height){
  const layers=new Map();
  for(const actor of collectStoryActors(surface,height)){
    // A carousel remains one native interactive unit. Its own slide transforms
    // and clipped track must not be displaced independently by the page effect.
    const rail=actor.element.closest('.look-editorial__rail');
    const group=rail || actor.element.closest('.footer-ed__column');
    const element=group || actor.element;
    if(layers.has(element))continue;
    layers.set(element,{...actor,element,role:rail?'product':actor.role,
      geometry:group?actorGeometry(element,surface,surface.offsetWidth,height):actor.geometry});
  }
  return [...layers.values()].filter(actor=>![...layers.keys()].some(parent=>parent!==actor.element && parent.contains(actor.element)));
}

export function mountJourneyParallax(container,rawConfig,{scroller=null,mobileOverride,restored=false}={}){
  if(!container)return ()=>{};
  const config=normalizeStoryConfig(rawConfig),view=container.ownerDocument.defaultView,doc=container.ownerDocument;
  const reduced=view.matchMedia?.('(prefers-reduced-motion: reduce)'),mobile=view.matchMedia?.('(max-width:767px)');
  const compact=()=>typeof mobileOverride==='boolean'?mobileOverride:Boolean(mobile?.matches);
  const enabled=()=>config.enabled && config.experience==='journey' && !reduced?.matches && !(compact() && config.mobileMode==='off');
  const target=scroller || view,scroll=()=>scroller?scroller.scrollTop:view.scrollY;
  const restoredTop=restored?scroll():null;
  const viewport=()=>scroller?scroller.clientHeight:view.innerHeight;
  const pace={quick:.78,balanced:1,leisurely:1.28}[config.pace];
  let chapters=[],frame=0,dirty=true,disposed=false,lastTime=0,held=null;

  function restore(actor){
    if(actor.originalTranslate)actor.element.style.setProperty('translate',actor.originalTranslate,actor.originalPriority);
    else actor.element.style.removeProperty('translate');
    delete actor.element.dataset.journeyLayer;delete actor.element.dataset.journeyLayerMoving;
  }
  function restoreClip(chapter){
    if(chapter.originalClip)chapter.surface.style.setProperty('clip-path',chapter.originalClip,chapter.originalClipPriority);
    else chapter.surface.style.removeProperty('clip-path');
  }
  function clearChapter(chapter){
    chapter.actors.forEach(restore);restoreClip(chapter);
    for(const [key,value] of Object.entries(chapter.originalStyles)){
      if(value)chapter.node.style.setProperty(key,value);else chapter.node.style.removeProperty(key);
    }
  }
  function disable(){chapters.forEach(clearChapter);delete container.dataset.journeyParallax;delete container.dataset.journeyParallaxSettled;}
  function measure(){
    const previous=new Map(chapters.map(chapter=>[chapter.node,chapter]));
    // Read the original layout, never a temporarily pinned rectangle.
    delete container.dataset.journeyParallax;
    const height=viewport(),base=scroller?scroller.getBoundingClientRect().top:0,y=scroll();
    chapters=[...container.children].filter(node=>node.tagName==='SECTION' && node.offsetHeight>0).map((node,index)=>{
      const surface=node.querySelector(':scope>.storefront-chapter-surface') || node;
      const old=previous.get(node);previous.delete(node);
      const prior=new Map((old?.actors || []).map(actor=>[actor.element,actor]));
      const top=Number.isFinite(Number(node.dataset.storyTop))?Number(node.dataset.storyTop):node.getBoundingClientRect().top+y-base;
      const actors=(!scroller && node.id==='banner'?[]:collectLayers(surface,height)).map(item=>{
        const saved=prior.get(item.element);prior.delete(item.element);
        if(saved){Object.assign(saved,item);return saved;}
        const css=view.getComputedStyle(item.element),baseTranslate=css.translate || 'none';
        const parts=baseTranslate==='none'?['0px','0px']:baseTranslate.match(/calc\([^)]*\)|\S+/g);
        return {...item,x:null,y:null,arrivalAt:null,baseX:parts[0] || '0px',baseY:parts[1] || '0px',baseZ:parts[2] || '0px',
          originalTranslate:item.element.style.getPropertyValue('translate'),originalPriority:item.element.style.getPropertyPriority('translate')};
      });
      prior.forEach(restore);
      const originalStyles=old?.originalStyles || Object.fromEntries(['--story-layer','--story-pin-top'].map(key=>[key,node.style.getPropertyValue(key)]));
      node.style.setProperty('--story-layer',index+1);
      node.style.setProperty('--story-pin-top',Math.min(0,height-node.offsetHeight)+'px');
      return {node,surface,top,height:node.offsetHeight,actors,originalStyles,
        originalClip:old?.originalClip ?? surface.style.getPropertyValue('clip-path'),originalClipPriority:old?.originalClipPriority ?? surface.style.getPropertyPriority('clip-path'),
        entryAt:old?.entryAt ?? null,released:old?.released || restoredTop!==null && top<=restoredTop+1};
    });
    previous.forEach(clearChapter);dirty=false;container.dataset.journeyParallax='true';
  }
  function paint(time=view.performance.now()){
    frame=0;if(disposed)return;
    if(!enabled()){disable();return;}
    if(dirty)measure();
    const now=Number.isFinite(time)?time:view.performance.now(),dt=lastTime?Math.min(50,Math.max(1,now-lastTime)):16;
    lastTime=now;
    const y=scroll(),height=viewport(),width=container.clientWidth || container.getBoundingClientRect().width;
    const atEnd=y>=Math.max(0,(scroller?scroller.scrollHeight:doc.documentElement.scrollHeight)-height)-1;
    const blend=1-Math.exp(-dt/(105*pace));let moving=false;
    chapters.forEach((chapter,index)=>{
      const next=chapters[index+1],top=chapter.top-y;
      const outside=top>height*1.4 || top+chapter.height<-height*.25;
      if(outside){
        chapter.released=false;chapter.entryAt=null;
        if(top+chapter.height<0)chapter.surface.style.clipPath='inset(0px 0px 100% 0px)';else restoreClip(chapter);
        for(const actor of chapter.actors){actor.arrivalAt=null;actor.x=null;actor.y=null;restore(actor);}return;
      }
      if(chapter.entryAt===null && top<height*.92)chapter.entryAt=now;
      const handoff=next?clamp((height*.92-(next.top-y))/(height*.82)):0;
      const rect=chapter.node.getBoundingClientRect(),origin=rect.top-(scroller?scroller.getBoundingClientRect().top:0);
      // Occlude only the outgoing content. Painting an opaque backdrop here
      // would hide the continuous ornament world behind every section.
      const covered=config.journey.unifyBackground && next?Math.max(0,chapter.height-(next.top-y-origin)):0;
      if(covered>.1)chapter.surface.style.clipPath=`inset(0px 0px ${Math.min(chapter.height,covered).toFixed(2)}px 0px)`;
      else if(chapter.originalClip)chapter.surface.style.setProperty('clip-path',chapter.originalClip,chapter.originalClipPriority);
      else chapter.surface.style.removeProperty('clip-path');
      chapter.actors.forEach(actor=>{
        if(held===chapter.node)return;
        const naturalTop=top+actor.geometry.y;
        if(actor.arrivalAt===null && naturalTop<height*.97)actor.arrivalAt=now;
        const firstPlane=actor.geometry.y<height*.82,arrivalAt=firstPlane?chapter.entryAt:actor.arrivalAt;
        const timed=arrivalAt===null?0:clamp((now-arrivalAt)/(1650*pace));
        const scrollArrival=clamp((height*.97-(firstPlane?top:naturalTop))/(height*(firstPlane?.95:.69)));
        const entrance=(chapter.released || (atEnd && !next))?1:Math.max(timed,scrollArrival);
        const pose=chapter.released?{x:0,y:0}:journeyLayerPose(actor,{entrance,handoff,width,height,intensity:config.intensity,compact:compact() && config.mobileMode==='adapted'});
        // Deep objects wait until they enter the viewport; long sections keep
        // their full natural height and remain readable from top to bottom.
        if(origin+actor.geometry.y>height*1.15 && actor.arrivalAt===null)return;
        actor.x=actor.x===null?pose.x:actor.x+(pose.x-actor.x)*blend;
        actor.y=actor.y===null?pose.y:actor.y+(pose.y-actor.y)*blend;
        if(Math.abs(pose.x-actor.x)<.08)actor.x=pose.x;
        if(Math.abs(pose.y-actor.y)<.08)actor.y=pose.y;
        if(Math.abs(pose.x-actor.x)>.08 || Math.abs(pose.y-actor.y)>.08 || (arrivalAt!==null && timed<1 && !chapter.released))moving=true;
        if(Math.abs(actor.x)<.08 && Math.abs(actor.y)<.08){restore(actor);return;}
        actor.element.dataset.journeyLayer=actor.role;actor.element.dataset.journeyLayerMoving='true';
        actor.element.style.setProperty('translate',`calc(${actor.baseX} + ${actor.x.toFixed(2)}px) calc(${actor.baseY} + ${actor.y.toFixed(2)}px) ${actor.baseZ}`);
      });
    });
    container.dataset.journeyParallaxSettled=String(!moving);
    if(moving)schedule();
  }
  function schedule(){if(!disposed && !frame)frame=view.requestAnimationFrame(paint);}
  function resize(){dirty=true;schedule();}
  function chapterFor(element){return chapters.find(chapter=>chapter.node.contains(element));}
  function pointer(event){
    if(!event.target.closest?.('a,button,input,textarea,select,summary,video,iframe,[contenteditable="true"],[role="button"],.keen-slider'))return;
    const chapter=chapterFor(event.target);if(chapter){held=chapter.node;chapter.released=true;}
  }
  function release(){held=null;schedule();}
  function focus(event){
    const chapter=chapterFor(event.target);if(!chapter)return;
    chapter.released=true;
    if(!held){
      chapter.actors.forEach(actor=>{actor.x=0;actor.y=0;restore(actor);});
      const next=chapters[chapters.indexOf(chapter)+1],rect=event.target.getBoundingClientRect();
      const base=scroller?scroller.getBoundingClientRect().top:0;
      const limit=next?Math.min(viewport(),next.top-scroll()):viewport();
      if(next && rect.height>0 && rect.bottom-base>limit){
        const top=Math.max(chapter.top,scroll()-(rect.bottom-base-limit+24));
        (scroller || view).scrollTo?.({top,behavior:'instant'});
      }
    }
    schedule();
  }
  function preference(){disable();chapters.forEach(chapter=>{chapter.entryAt=null;chapter.actors.forEach(actor=>{actor.x=null;actor.y=null;actor.arrivalAt=null;});});resize();}
  function visibility(){if(doc.hidden){if(frame)view.cancelAnimationFrame(frame);frame=0;}else{lastTime=0;schedule();}}
  const observer=view.ResizeObserver?new view.ResizeObserver(resize):null;
  observer?.observe(container);if(scroller)observer?.observe(scroller);
  const mutation=new view.MutationObserver(records=>{if(records.some(record=>!record.target.closest?.('[data-journey-pin]')))resize();});
  mutation.observe(container,{childList:true,subtree:true});
  target.addEventListener('scroll',schedule,{passive:true});view.addEventListener('resize',resize);
  container.addEventListener('load',resize,true);container.addEventListener('pointerdown',pointer,true);container.addEventListener('focusin',focus,true);
  view.addEventListener('pointerup',release,true);view.addEventListener('pointercancel',release,true);
  reduced?.addEventListener?.('change',preference);mobile?.addEventListener?.('change',preference);doc.addEventListener('visibilitychange',visibility);
  paint();
  return ()=>{
    disposed=true;if(frame)view.cancelAnimationFrame(frame);disable();observer?.disconnect();mutation.disconnect();
    target.removeEventListener('scroll',schedule);view.removeEventListener('resize',resize);
    container.removeEventListener('load',resize,true);container.removeEventListener('pointerdown',pointer,true);container.removeEventListener('focusin',focus,true);
    view.removeEventListener('pointerup',release,true);view.removeEventListener('pointercancel',release,true);
    reduced?.removeEventListener?.('change',preference);mobile?.removeEventListener?.('change',preference);doc.removeEventListener('visibilitychange',visibility);
    delete container.dataset.journeyParallaxSettled;
  };
}
