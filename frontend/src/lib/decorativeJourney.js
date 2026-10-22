import { journeyScene, journeyTail } from './decorativeJourneyScenes';
import { fitJourneyOrnament, ornamentClearance } from './decorativeJourneyPlacement';

const occlusionSelector='.info-glass-dialog-backdrop,[role=dialog],dialog,[data-story-actor],.categories-fan__category,.look-editorial__hero,.look-editorial__card-surface,.ig-journal__main,.ig-journal__sidebar,.tk-stage__hero,.tk-stage__item,.info-glass-card,.footer-ed__social,.footer-ed__watermark,h1,h2,h3,p,a,button,input,textarea,select,article,picture,img,video,iframe';
export function mountDecorativeJourney(container,config,{scroller=null,mobileOverride}={}){
  const view=container.ownerDocument.defaultView,doc=container.ownerDocument,world=container.querySelector('[data-journey-world]');
  if(!world)return ()=>{};
  const c=config.journey,reduce=view.matchMedia?.('(prefers-reduced-motion: reduce)'),mobile=view.matchMedia?.('(max-width:767px)');
  const target=scroller || view,pieces=[...world.querySelectorAll('[data-journey-piece]')];
  const masks=[...world.querySelectorAll('[data-journey-occluder]')];
  const stem=world.querySelector('[data-journey-stem]'),mask=world.querySelector('[data-journey-mask]');
  const lead=world.querySelector('[data-journey-lead]');
  let frame=0,dirty=true,disposed=false,chapters=[],candidates=[],width=0,height=0,movingUntil=0,frozenLead=null,leadPose=null,lastPaint=0;
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
    if(Math.abs(width-previousWidth)>1 || Math.abs(height-previousHeight)>1)leadPose=null;
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
    const boxes=[],range=doc.createRange();
    for(const node of candidates){
      const rect=node.getBoundingClientRect();if(!visible(rect))continue;
      const css=view.getComputedStyle(node);if(css.display==='none' || css.visibility==='hidden' || Number(css.opacity || 1)<.05)continue;
      const textOnly=node.matches('h1,h2,h3,p,.ig-journal__profile');
      if(textOnly && !node.querySelector('img,video,picture')){
        const walker=doc.createTreeWalker(node,view.NodeFilter.SHOW_TEXT);
        for(let text=walker.nextNode();text;text=walker.nextNode()){
          if(!text.textContent.trim())continue;range.selectNodeContents(text);
          for(const line of range.getClientRects?.() || [rect])if(visible(line))boxes.push(boxFor(line,4,2));
        }
        for(const icon of node.querySelectorAll('svg'))if(visible(icon.getBoundingClientRect()))boxes.push(boxFor(icon.getBoundingClientRect(),4,2));
      }else boxes.push(boxFor(rect,4,Math.min(48,(parseFloat(css.borderTopLeftRadius)||0)+4)));
      if(boxes.length>=masks.length-1)break;
    }
    const header=scroller?null:doc.querySelector('.theme-header');
    if(header && visible(header.getBoundingClientRect()))boxes.push(boxFor(header.getBoundingClientRect(),4));
    const wanted=(adapted?c.mobileSize:c.size)*previewScale*scene.scale;
    const radians=scene.angle*Math.PI/180,rotation=Math.abs(Math.cos(radians))+Math.abs(Math.sin(radians));
    const top=scene.minY,bottom=Math.max(top+48,scene.maxY);
    let size=Math.max(20,Math.min(wanted,width*(compact() ? .24 : .18),height*.3,(bottom-top-24)/rotation));
    let position=fitJourneyOrnament(scene,width,size*rotation,boxes,top,bottom);size=position.extent/rotation;
    if(reduce?.matches){frozenLead??={...position,size,angle:scene.angle};position=frozenLead;size=frozenLead.size;}else frozenLead=null;
    const now=view.performance.now(),dt=Math.min(34,Math.max(1,now-lastPaint));lastPaint=now;
    const desired={...position,angle:frozenLead?.angle ?? scene.angle,size};let settling=false;
    if(!leadPose || reduce?.matches)leadPose=desired;
    else {
      const distance=Math.hypot(desired.x-leadPose.x,desired.y-leadPose.y),blend=1-Math.exp(-dt/70);
      const step=Math.min(blend,dt*1.1/Math.max(1,distance));
      leadPose={x:leadPose.x+(desired.x-leadPose.x)*step,y:leadPose.y+(desired.y-leadPose.y)*step,angle:leadPose.angle+(desired.angle-leadPose.angle)*blend,size:leadPose.size+(desired.size-leadPose.size)*blend};
      settling=Math.hypot(desired.x-leadPose.x,desired.y-leadPose.y)>.25 || Math.abs(desired.angle-leadPose.angle)>.05 || Math.abs(desired.size-leadPose.size)>.05;
      if(!settling)leadPose=desired;
    }
    position={x:leadPose.x,y:leadPose.y};size=leadPose.size;
    const path=journeyTail(position,width,height),depth=c.depth/100,shadowScale=previewScale*(adapted ? .6 : 1);
    const shadow=`drop-shadow(0 ${(3+depth*5)*shadowScale}px ${(3+depth*3)*shadowScale}px rgb(0 0 0 / .14))`;
    if(lead)lead.style.filter=shadow;
    stem.setAttribute('d',path.d);stem.style.opacity=c.stemVisible?String(c.opacity/100*.35*scene.opacity):'0';
    for(const piece of pieces){
      if(!(c.image || c.secondaryImage)){piece.setAttribute('opacity','0');continue;}
        piece.setAttribute('transform',`translate(${position.x.toFixed(2)} ${position.y.toFixed(2)}) rotate(${leadPose.angle.toFixed(2)}) scale(${(size/100).toFixed(3)})`);
        piece.setAttribute('opacity',String(c.opacity/100*scene.opacity*ornamentClearance(position,size,leadPose.angle,boxes)));
    }
    const writeMask=(nodes,values)=>nodes.forEach((rect,i)=>{const box=values[i];if(!box){rect.setAttribute('width','0');return;}for(const key of ['x','y','width','height'])rect.setAttribute(key,box[key].toFixed(2));rect.setAttribute('rx',box.radius);});
    writeMask(masks,boxes);
    container.dataset.journeyPhase=(scene.index+scene.progress).toFixed(4);container.dataset.journeySection=scene.id;container.dataset.journeyHandoff=scene.handoff.toFixed(4);container.dataset.journeySettled=String(!settling);
    if(settling || view.performance.now()<movingUntil)schedule();
  }
  function schedule(){if(!disposed && !frame)frame=view.requestAnimationFrame(paint);}
  function resize(){dirty=true;frozenLead=null;schedule();}
  function transition(event){if(!event.target.closest?.('[data-journey-pin]')){movingUntil=view.performance.now()+850;schedule();}}
  const resizeObserver=view.ResizeObserver?new view.ResizeObserver(resize):null;resizeObserver?.observe(container);if(scroller)resizeObserver?.observe(scroller);
  const mutation=new view.MutationObserver(records=>{if(records.some(record=>!record.target.closest?.('[data-journey-pin]')))resize();});mutation.observe(container,{childList:true,subtree:true});
  target.addEventListener('scroll',schedule,{passive:true});view.addEventListener('resize',resize);container.addEventListener('transitionrun',transition,true);container.addEventListener('load',resize,true);reduce?.addEventListener?.('change',resize);mobile?.addEventListener?.('change',resize);paint();
  return ()=>{
    disposed=true;if(frame)view.cancelAnimationFrame(frame);resizeObserver?.disconnect();mutation.disconnect();target.removeEventListener('scroll',schedule);view.removeEventListener('resize',resize);container.removeEventListener('load',resize,true);container.removeEventListener('transitionrun',transition,true);reduce?.removeEventListener?.('change',resize);mobile?.removeEventListener?.('change',resize);
    for(const key of ['journeyActive','journeyShared','journeyPhase','journeySection','journeyHandoff','journeySettled'])delete container.dataset[key];
  };
}
