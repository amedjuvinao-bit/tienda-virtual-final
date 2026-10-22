import { STORY_CHAPTER_CHANGE_EVENT } from './storefrontStoryConfig';
import { journeyCurtainFrame } from './storefrontJourneyPresentation';

export function mountJourneyCurtain(container,config,{scroller=null,mobileOverride}={}){
  const curtain=container.querySelector('[data-journey-curtain]');if(!curtain)return ()=>{};
  const view=container.ownerDocument.defaultView,doc=container.ownerDocument;
  const reduced=view.matchMedia?.('(prefers-reduced-motion: reduce)'),mobile=view.matchMedia?.('(max-width:767px)');
  const compact=()=>typeof mobileOverride==='boolean'?mobileOverride:Boolean(mobile?.matches);
  const enabled=()=>config.enabled && config.experience==='journey' && !reduced?.matches && !(compact() && config.mobileMode==='off');
  const duration=1400*({quick:.78,balanced:1,leisurely:1.28}[config.pace] || 1);
  let frame=0,start=0,running=false,direction='down',disposed=false;
  function stop(){
    if(frame)view.cancelAnimationFrame(frame);frame=0;running=false;curtain.hidden=true;
    curtain.style.removeProperty('clip-path');delete container.dataset.journeyTransition;
  }
  function paint(time){
    frame=0;if(disposed || !enabled()){stop();return;}
    const progress=Math.min(1,Math.max(0,(time-start)/duration));
    if(progress>=1){stop();return;}
    const width=container.clientWidth || container.getBoundingClientRect().width,height=scroller?scroller.clientHeight:view.innerHeight;
    const pose=journeyCurtainFrame(progress,width,height,{direction,intensity:config.intensity,compact:compact() && config.mobileMode==='adapted'});
    curtain.style.width=width+'px';curtain.style.height=height+'px';curtain.style.clipPath=`path('${pose.path}')`;
    container.dataset.journeyTransition=pose.phase;frame=view.requestAnimationFrame(paint);
  }
  function begin(event){
    if(!enabled() || running || !event.detail?.from || event.detail.from===event.detail.to)return;
    // Resolve after the decorative world has captured the configured/inherited
    // backdrop. Each store supplies its own image and colours; no black layer.
    const css=view.getComputedStyle(container),configured=config.journey.backgroundImage;
    let image=configured?`url(${JSON.stringify(configured)})`:css.getPropertyValue('--journey-shared-image').trim();
    if(!image || image==='none'){
      const next=[...container.children].find(node=>node.id===event.detail.to);
      const candidates=next?[next,...next.querySelectorAll('.storefront-chapter-surface,.ig-journal,.tk-stage,.info-glass,.footer-ed,.look-editorial,.categories-fan__background,.trending-section--floating-glass,.complementos-look-section,.story-preview__content')]:[];
      image=candidates.map(node=>view.getComputedStyle(node).backgroundImage).find(value=>value?.includes('url(')) || 'none';
    }
    curtain.style.backgroundImage=image;
    curtain.style.backgroundColor=css.getPropertyValue('--color-bg').trim() || css.backgroundColor;
    direction=event.detail.direction==='up'?'up':'down';curtain.dataset.direction=direction;
    start=view.performance.now();running=true;curtain.hidden=false;paint(start);
  }
  function preference(){if(!enabled())stop();}
  function visibility(){if(doc.hidden)stop();}
  container.addEventListener(STORY_CHAPTER_CHANGE_EVENT,begin);
  container.addEventListener('pointerdown',stop,true);container.addEventListener('focusin',stop,true);
  reduced?.addEventListener?.('change',preference);mobile?.addEventListener?.('change',preference);doc.addEventListener('visibilitychange',visibility);
  return ()=>{
    disposed=true;stop();curtain.removeAttribute('style');delete curtain.dataset.direction;
    container.removeEventListener(STORY_CHAPTER_CHANGE_EVENT,begin);
    container.removeEventListener('pointerdown',stop,true);container.removeEventListener('focusin',stop,true);
    reduced?.removeEventListener?.('change',preference);mobile?.removeEventListener?.('change',preference);doc.removeEventListener('visibilitychange',visibility);
  };
}
