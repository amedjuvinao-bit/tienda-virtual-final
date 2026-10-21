import { storefrontSectionTop } from './storefrontSectionMotion';

export function journeyTargets(sectionIds, doc=document) {
  const story=doc.querySelector('.storefront-sections');
  return [...new Set(sectionIds)].map(id=>doc.getElementById(id))
    .filter(el=>el && (!story || el.parentElement===story) && !el.hidden && !el.matches('.storefront-section-shell:empty') && (!el.hasAttribute('data-story-chapter') || el.offsetHeight>0))
    .map(element=>({element,id:element.id,top:storefrontSectionTop(element)})).sort((a,b)=>a.top-b.top);
}

export function journeyMaxScroll(view=window) {
  return Math.max(0,view.document.documentElement.scrollHeight-view.innerHeight);
}

export function journeyDuration(distance,viewport,pace='balanced') {
  const base={quick:950,balanced:1450,leisurely:1950}[pace] || 1450;
  return base+Math.min(1100,Math.max(0,Math.abs(distance)/Math.max(1,viewport)-1)*300);
}

// Native smooth scrolling has a browser-defined speed. This timeline controls
// the trip, and the scene engine follows those same real scroll coordinates.
export function animateJourneyTo(element,{offset=0,pace='balanced',instant=false,onProgress=()=>{},onFinish=()=>{},view=window}={}) {
  let frame=0, stopped=false, started;
  const start=view.scrollY;
  const destination=()=>Math.max(0,Math.min(journeyMaxScroll(view),storefrontSectionTop(element)-offset));
  const duration=journeyDuration(destination()-start,view.innerHeight,pace);
  const reduce=view.matchMedia?.('(prefers-reduced-motion: reduce)');
  const detach=()=>{
    view.removeEventListener('wheel',interrupt);view.removeEventListener('touchstart',interrupt);
    view.removeEventListener('pointerdown',interrupt);view.removeEventListener('keydown',key);
    view.document.removeEventListener('visibilitychange',hidden);reduce?.removeEventListener?.('change',preference);
    if(frame)view.cancelAnimationFrame(frame);
  };
  function finish(completed){if(stopped)return;stopped=true;detach();onFinish(completed);}
  function interrupt(){finish(false);}
  function key(event){if(['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' ','Escape','Tab'].includes(event.key))interrupt();}
  function hidden(){if(view.document.hidden)interrupt();}
  function preference(){if(reduce.matches){view.scrollTo({top:destination(),behavior:'instant'});onProgress(1);finish(true);}}
  function tick(time){
    if(stopped)return;
    if(!element.isConnected){finish(false);return;}
    started??=time;
    const p=Math.min(1,(time-started)/duration);
    const ease=p<.5?4*p*p*p:1-Math.pow(-2*p+2,3)/2;
    view.scrollTo({top:start+(destination()-start)*ease,behavior:'instant'});
    onProgress(p);
    if(p<1)frame=view.requestAnimationFrame(tick);
    else {
      // Re-read after the final scroll/layout pass, including a lazy image resize.
      frame=view.requestAnimationFrame(()=>{if(stopped)return;view.scrollTo({top:destination(),behavior:'instant'});finish(true);});
    }
  }
  if(instant || reduce?.matches || Math.abs(destination()-start)<1){view.scrollTo({top:destination(),behavior:'instant'});onProgress(1);onFinish(true);return ()=>{};}
  view.addEventListener('wheel',interrupt,{passive:true});view.addEventListener('touchstart',interrupt,{passive:true});
  view.addEventListener('pointerdown',interrupt,{passive:true});view.addEventListener('keydown',key);
  view.document.addEventListener('visibilitychange',hidden);reduce?.addEventListener?.('change',preference);
  frame=view.requestAnimationFrame(tick);
  return interrupt;
}
