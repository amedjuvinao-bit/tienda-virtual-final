import { journeyCurve, pointOnJourney, journeyPhase } from './decorativeJourneyGeometry';

const occlusionSelector='.info-glass-dialog-backdrop,[role=dialog],dialog,[data-story-actor],.categories-fan__category,.look-editorial__hero,.look-editorial__card-surface,.ig-journal__main,.tk-stage__hero,.tk-stage__item,.info-glass-card,.footer-ed__social,.footer-ed__watermark,h1,h2,h3,p,a,button,input,textarea,select,article,picture,img,video,iframe';

export function mountDecorativeJourney(container,config,{scroller=null,mobileOverride}={}){
  const view=container.ownerDocument.defaultView,world=container.querySelector('[data-journey-world]');
  if(!world)return ()=>{};
  const c=config.journey,reduce=view.matchMedia?.('(prefers-reduced-motion: reduce)'),mobile=view.matchMedia?.('(max-width:767px)');
  const target=scroller || view,pieces=[...world.querySelectorAll('[data-journey-piece]')],masks=[...world.querySelectorAll('[data-journey-occluder]')];
  const stem=world.querySelector('[data-journey-stem]'),mask=world.querySelector('[data-journey-mask]');
  let frame=0,dirty=true,disposed=false,tops=[],candidates=[],width=0,height=0,movingUntil=0;
  const scroll=()=>scroller?scroller.scrollTop:view.scrollY;
  const compact=()=>typeof mobileOverride==='boolean'?mobileOverride:Boolean(mobile?.matches);
  function measure(){
    width=container.offsetWidth || container.getBoundingClientRect().width;
    height=scroller?scroller.clientHeight:view.innerHeight;
    const y=scroll(),base=scroller?scroller.getBoundingClientRect().top:0;
    tops=[...container.children].filter(node=>node.tagName==='SECTION' && node.offsetHeight>0).map(node=>{
      const saved=Number(node.dataset.storyTop);
      return node.dataset.storyTop!==undefined && Number.isFinite(saved)?saved:node.getBoundingClientRect().top+y-base;
    });
    const selected=new Set();
    candidates=[...container.querySelectorAll(occlusionSelector)].filter(node=>{
      if(node.closest('[data-journey-pin],[aria-hidden="true"],[hidden]'))return false;
      for(let parent=node.parentElement;parent && parent!==container;parent=parent.parentElement)if(selected.has(parent))return false;
      selected.add(node);return true;
    });
    world.setAttribute('viewBox',`0 0 ${width} ${height}`);
    mask.setAttribute('width',width);mask.setAttribute('height',height);
    world.style.height=height+'px';dirty=false;
  }
  function paint(){
    frame=0;if(disposed)return;
    const enabled=config.enabled && config.experience==='journey' && !(compact() && config.mobileMode==='off');
    const active=enabled && Boolean(c.image || c.secondaryImage || c.stemVisible);
    container.dataset.journeyActive=String(active);
    container.dataset.journeyShared=String(enabled && c.unifyBackground);
    if(!active)return;
    if(dirty)measure();if(width<1 || height<1)return;
    const phase=reduce?.matches?0:journeyPhase(scroll(),tops,height);
    const adapted=compact() && config.mobileMode==='adapted';
    const previewScale=scroller?Math.min(1,width/(compact()?390:1440)):1;
    const count=adapted?c.mobileDensity:c.density,size=(adapted?c.mobileSize:c.size)*previewScale;
    const path=journeyCurve(phase*.8,width,height,c.path,config.intensity),origin=world.getBoundingClientRect();
    // Read content geometry before writing the SVG. Nothing intercepts input.
    const boxes=[];
    for(const node of candidates){
      const rect=node.getBoundingClientRect();
      if(rect.width<4 || rect.height<4 || rect.bottom<=origin.top || rect.top>=origin.top+height || rect.right<=origin.left || rect.left>=origin.left+width)continue;
      const css=view.getComputedStyle(node);
      if(css.display==='none' || css.visibility==='hidden' || Number(css.opacity || 1)<.05)continue;
      boxes.push({x:rect.left-origin.left-5,y:rect.top-origin.top-5,width:rect.width+10,height:rect.height+10,radius:Math.max(6,Math.min(48,parseFloat(css.borderTopLeftRadius)||0))});
      if(boxes.length===masks.length)break;
    }
    stem.setAttribute('d',path.d);stem.style.opacity=c.stemVisible?String(c.opacity/100*.65):'0';
    stem.setAttribute('stroke-width',adapted?'1.2':'2');
    pieces.forEach((piece,i)=>{
      if(i>=count || !(c.image || c.secondaryImage)){piece.setAttribute('opacity','0');return;}
      const u=((i/count+phase*.028)%1+1)%1,p=pointOnJourney(path,u);
      const z=Math.sin(u*Math.PI*2+phase*.45),depth=c.depth/100;
      const scale=size/100*(.78+(i*7%11)/22)*(1+z*depth*.24);
      const mirror=i%4===1?-1:1,angle=p.angle+(mirror<0?-50:50)+(i%2?-7:10);
      piece.setAttribute('transform',`translate(${p.x.toFixed(2)} ${p.y.toFixed(2)}) rotate(${angle.toFixed(2)}) scale(${(scale*mirror).toFixed(3)} ${scale.toFixed(3)})`);
      piece.setAttribute('opacity',String(c.opacity/100*(.86+z*depth*.12)));
      piece.style.filter=`blur(${Math.max(0,-z)*depth*(adapted ? .6 : 1.1)}px) drop-shadow(0 ${4+depth*6}px ${4+depth*3}px rgb(0 0 0 / .14))`;
    });
    masks.forEach((rect,i)=>{
      const box=boxes[i];if(!box){rect.setAttribute('width','0');return;}
      for(const key of ['x','y','width','height'])rect.setAttribute(key,box[key].toFixed(2));
      rect.setAttribute('rx',box.radius);
    });
    container.dataset.journeyPhase=phase.toFixed(4);
    if(view.performance.now()<movingUntil)schedule();
  }
  function schedule(){if(!disposed && !frame)frame=view.requestAnimationFrame(paint);}
  function resize(){dirty=true;schedule();}
  function transition(event){if(!event.target.closest?.('[data-journey-pin]')){movingUntil=view.performance.now()+850;schedule();}}
  const resizeObserver=view.ResizeObserver?new view.ResizeObserver(resize):null;
  resizeObserver?.observe(container);if(scroller)resizeObserver?.observe(scroller);
  const mutation=new view.MutationObserver(records=>{if(records.some(record=>!record.target.closest?.('[data-journey-pin]')))resize();});
  mutation.observe(container,{childList:true,subtree:true});
  target.addEventListener('scroll',schedule,{passive:true});view.addEventListener('resize',resize);
  container.addEventListener('transitionrun',transition,true);container.addEventListener('load',resize,true);reduce?.addEventListener?.('change',resize);mobile?.addEventListener?.('change',resize);
  paint();
  return ()=>{
    disposed=true;if(frame)view.cancelAnimationFrame(frame);resizeObserver?.disconnect();mutation.disconnect();
    target.removeEventListener('scroll',schedule);view.removeEventListener('resize',resize);container.removeEventListener('load',resize,true);container.removeEventListener('transitionrun',transition,true);
    reduce?.removeEventListener?.('change',resize);mobile?.removeEventListener?.('change',resize);
    for(const key of ['journeyActive','journeyShared','journeyPhase'])delete container.dataset[key];
  };
}
