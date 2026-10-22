import { journeyScene } from './decorativeJourneyScenes';
import { journeyOrnamentVisibility, journeyTextVisibility } from './decorativeJourneyGeometry';
import { journeyArtworkLayout, applyJourneyArtworkLayout } from './decorativeJourneyArtwork';
import { cinematicOrnament } from './decorativeJourneyCinema';

const occlusionSelector='.info-glass-dialog-backdrop,[role=dialog],dialog,[data-story-actor],.categories-fan__category,.look-editorial__hero,.look-editorial__card-surface,.ig-journal__main,.tk-stage__hero,.tk-stage__item,.info-glass-card,.footer-ed__social,.footer-ed__watermark,h1,h2,h3,p,a,button,input,textarea,select,article,picture,img,video,iframe';
export function mountDecorativeJourney(container,config,{scroller=null,mobileOverride}={}){
  const view=container.ownerDocument.defaultView,doc=container.ownerDocument,world=container.querySelector('[data-journey-world]');
  if(!world)return ()=>{};
  const c=config.journey,reduce=view.matchMedia?.('(prefers-reduced-motion: reduce)'),mobile=view.matchMedia?.('(max-width:767px)');
  // Capture the store's existing artwork before shared-surface CSS hides local layers.
  // No business-specific image or colour is introduced by the journey.
  const backgroundNodes=[...container.querySelectorAll('.trending-section--floating-glass,.look-editorial,.complementos-look-section,.categories-fan__background,.ig-journal,.tk-stage,.info-glass,.footer-ed,.story-preview__content')];
  const previousShared=container.dataset.journeyShared;
  delete container.dataset.journeyShared;
  let inheritedBackground='none';
  for(const node of backgroundNodes){
    const candidates=[view.getComputedStyle(node).backgroundImage];
    if(!/jsdom/i.test(view.navigator.userAgent))candidates.unshift(view.getComputedStyle(node,'::before').backgroundImage);
    const image=candidates.find(value=>value && value.includes('url('));
    if(image){inheritedBackground=image;break;}
  }
  if(previousShared!==undefined)container.dataset.journeyShared=previousShared;
  if(!c.backgroundImage)container.style.setProperty('--journey-shared-image',inheritedBackground);
  const target=scroller || view,pieces=[...world.querySelectorAll('[data-journey-piece]')];
  const masks=[...world.querySelectorAll('[data-journey-occluder]')];
  const stem=world.querySelector('[data-journey-stem]'),trace=world.querySelector('[data-journey-trace]'),mask=world.querySelector('[data-journey-mask]');
  const ornaments=world.querySelector('[data-journey-ornaments]');
  const artworkProbes=[];
  let frame=0,dirty=true,disposed=false,chapters=[],candidates=[],width=0,height=0,movingUntil=0,displayPhase=null,lastPaint=0,ornamentCount=0;
  const scroll=()=>scroller?scroller.scrollTop:view.scrollY;
  const compact=()=>typeof mobileOverride==='boolean'?mobileOverride:Boolean(mobile?.matches);
  const eligible=node=>{
    if(node.closest('[data-journey-pin],[aria-hidden="true"],[hidden]'))return false;
    const closed=node.closest('details:not([open])');
    return !closed || Boolean(closed.querySelector(':scope > summary')?.contains(node));
  };
  function measure(){
    const previousWidth=width,previousHeight=height;
    width=container.offsetWidth || container.getBoundingClientRect().width;height=scroller?scroller.clientHeight:view.innerHeight;
    if(Math.abs(width-previousWidth)>1 || Math.abs(height-previousHeight)>1)displayPhase=null;
    const y=scroll(),base=scroller?scroller.getBoundingClientRect().top:0;
    chapters=[...container.children].filter(node=>node.tagName==='SECTION' && node.offsetHeight>0).map(node=>{
      const saved=Number(node.dataset.storyTop);
      return {id:node.dataset.journeySection || node.id,top:node.dataset.storyTop!==undefined && Number.isFinite(saved)?saved:node.getBoundingClientRect().top+y-base,height:node.offsetHeight};
    });
    const selected=new Set();
    candidates=[...container.querySelectorAll(occlusionSelector)].filter(node=>{
      if(!eligible(node))return false;
      for(let parent=node.parentElement;parent && parent!==container;parent=parent.parentElement)if(selected.has(parent))return false;
      selected.add(node);return true;
    });
    world.setAttribute('viewBox',`0 0 ${width} ${height}`);
    mask?.setAttribute('width',width);mask?.setAttribute('height',height);
    world.style.height=height+'px';dirty=false;
    const adapted=compact() && config.mobileMode==='adapted',previewScale=scroller?Math.min(1,width/(compact()?390:1440)):1;
    const density=adapted?c.mobileDensity:c.density;
    ornamentCount=adapted?(density>=12?6:4):(density>=20?6:4);
  }
  function paint(){
    frame=0;if(disposed)return;
    const enabled=config.enabled && config.experience==='journey' && !(compact() && config.mobileMode==='off');
    const active=enabled && Boolean(c.image || c.secondaryImage || c.stemVisible);
    container.dataset.journeyActive=String(active);container.dataset.journeyShared=String(enabled && c.unifyBackground);if(!active)return;
    if(dirty)measure();if(width<1 || height<1)return;
    const adapted=compact() && config.mobileMode==='adapted',previewScale=scroller?Math.min(1,width/(compact()?390:1440)):1;
    const origin=world.getBoundingClientRect(),scene=journeyScene(scroll(),chapters,height,width,{...c,intensity:config.intensity,compact:compact(),originTop:origin.top},reduce?.matches);
    const visible=rect=>rect.width>=2 && rect.height>=2 && rect.bottom>origin.top && rect.top<origin.top+height && rect.right>origin.left && rect.left<origin.left+width;
    const boxFor=(rect,padding=2,radius=0)=>({x:rect.left-origin.left-padding,y:rect.top-origin.top-padding,width:rect.width+padding*2,height:rect.height+padding*2,radius});
    const boxes=[],headlines=[],range=doc.createRange();
    for(const node of candidates){
      const rect=node.getBoundingClientRect();if(!visible(rect))continue;
      const css=view.getComputedStyle(node);if(css.display==='none' || css.visibility==='hidden' || Number(css.opacity || 1)<.05)continue;
      const textOnly=node.matches('h1,h2,h3,p,.ig-journal__profile');
      if(textOnly && !node.querySelector('img,video,picture')){
        const walker=doc.createTreeWalker(node,view.NodeFilter.SHOW_TEXT);
        for(let text=walker.nextNode();text;text=walker.nextNode()){
          if(!text.textContent.trim())continue;range.selectNodeContents(text);
          for(const line of range.getClientRects?.() || [rect])if(visible(line)){
            const box=boxFor(line,4,2);boxes.push(box);if(node.matches('h1,h2,h3'))headlines.push(box);
          }
        }
        for(const icon of node.querySelectorAll('svg'))if(visible(icon.getBoundingClientRect()))boxes.push(boxFor(icon.getBoundingClientRect(),4,2));
      }else boxes.push(boxFor(rect,4,Math.min(48,(parseFloat(css.borderTopLeftRadius)||0)+4)));
      if(boxes.length>=masks.length-1)break;
    }
    const header=scroller?null:doc.querySelector('.theme-header');
    if(header && visible(header.getBoundingClientRect()))boxes.push(boxFor(header.getBoundingClientRect(),4));
    const desired=reduce?.matches?0:scene.index+scene.progress;
    const now=view.performance.now(),dt=Math.min(34,Math.max(1,now-lastPaint));lastPaint=now;
    let settling=false;
    if(displayPhase===null || reduce?.matches)displayPhase=desired;
    else {
      displayPhase+=(desired-displayPhase)*(1-Math.exp(-dt/90));
      settling=Math.abs(desired-displayPhase)>.0001;if(!settling)displayPhase=desired;
    }
    const size=(adapted?c.mobileSize:c.size)*previewScale*scene.scale;
    const count=ornamentCount;
    const depth=c.depth/100,shadowScale=previewScale*(adapted ? .6 : 1);
    if(ornaments)ornaments.style.filter=`drop-shadow(0 ${(3+depth*5)*shadowScale}px ${(3+depth*3)*shadowScale}px rgb(0 0 0 / .14))`;
    const presence=Math.sin(scene.accent*Math.PI/2)*scene.opacity;
    const opacity=c.opacity/100*presence;
    if(stem)stem.style.opacity='0';if(trace)trace.style.opacity='0';
    pieces.forEach((piece,i)=>{
      if(i>=count || !(c.image || c.secondaryImage)){piece.setAttribute('opacity','0');return;}
      const aspect=Number(piece.dataset.journeyAspect)||1;
      const pose=cinematicOrnament(i,{phase:displayPhase,width,height,size,aspect,depth,compact:compact(),intensity:config.intensity,count});
      const settings=c.sectionSettings || {};
      const sideWeight=id=>{const side=settings[id]?.placement;return side==='left'?(i%2?.15:1):side==='right'?(i%2?1:.15):1;};
      const emphasis=sideWeight(scene.id)*(1-scene.handoff)+sideWeight(scene.nextId)*scene.handoff;
      const {x,y,scale,angle}=pose;
      piece.dataset.journeyBent='false';
      piece.setAttribute('transform',`translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${angle.toFixed(2)}) scale(${scale.toFixed(3)})`);
      const visible=journeyOrnamentVisibility(x,y,scale*100,angle,boxes,width,height,aspect)*journeyTextVisibility(x,y,scale*45/Math.sqrt(Math.max(aspect,1/aspect)),headlines,16*previewScale);
      piece.setAttribute('opacity',String(opacity*pose.opacity*visible*emphasis));
    });
    const writeMask=(nodes,values)=>nodes.forEach((rect,i)=>{const box=values[i];if(!box){rect.setAttribute('width','0');return;}for(const key of ['x','y','width','height'])rect.setAttribute(key,box[key].toFixed(2));rect.setAttribute('rx',box.radius);});
    writeMask(masks,boxes);
    container.dataset.journeyPhase=displayPhase.toFixed(4);container.dataset.journeySection=scene.id;container.dataset.journeyHandoff=scene.handoff.toFixed(4);container.dataset.journeySettled=String(!settling);
    if(settling || view.performance.now()<movingUntil)schedule();
  }
  function schedule(){if(!disposed && !frame)frame=view.requestAnimationFrame(paint);}
  function resize(){dirty=true;schedule();}
  function transition(event){if(!event.target.closest?.('[data-journey-pin]')){movingUntil=view.performance.now()+850;schedule();}}
  // Read intrinsic dimensions once per URL, including independently sized
  // secondary artwork. A metadata reload cannot revive a removed resource.
  for(const piece of pieces)applyJourneyArtworkLayout(piece,journeyArtworkLayout(1,1));
  for(const source of new Set(pieces.map(piece=>piece.querySelector('image')?.getAttribute('href')).filter(Boolean))){
    const image=new view.Image();artworkProbes.push(image);
    const loaded=()=>{
      if(disposed || !image.naturalWidth || !image.naturalHeight)return;
      const layout=journeyArtworkLayout(image.naturalWidth,image.naturalHeight);
      for(const piece of pieces)if(piece.querySelector('image')?.getAttribute('href')===source)applyJourneyArtworkLayout(piece,layout);
      resize();
    };
    image.onload=loaded;image.src=source;if(image.complete)loaded();
  }
  const resizeObserver=view.ResizeObserver?new view.ResizeObserver(resize):null;resizeObserver?.observe(container);if(scroller)resizeObserver?.observe(scroller);
  const mutation=new view.MutationObserver(records=>{if(records.some(record=>!record.target.closest?.('[data-journey-pin]')))resize();});mutation.observe(container,{childList:true,subtree:true});
  target.addEventListener('scroll',schedule,{passive:true});view.addEventListener('resize',resize);container.addEventListener('transitionrun',transition,true);container.addEventListener('load',resize,true);reduce?.addEventListener?.('change',resize);mobile?.addEventListener?.('change',resize);paint();
  return ()=>{
    disposed=true;for(const image of artworkProbes)image.onload=null;if(frame)view.cancelAnimationFrame(frame);resizeObserver?.disconnect();mutation.disconnect();target.removeEventListener('scroll',schedule);view.removeEventListener('resize',resize);container.removeEventListener('load',resize,true);container.removeEventListener('transitionrun',transition,true);reduce?.removeEventListener?.('change',resize);mobile?.removeEventListener?.('change',resize);
    for(const key of ['journeyActive','journeyShared','journeyPhase','journeySection','journeyHandoff','journeySettled'])delete container.dataset[key];
  };
}
