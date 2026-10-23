import React, { useEffect, useId, useRef, useState } from 'react';
import { animateJourneyTo, journeyMaxScroll, journeyTargets } from '../lib/storefrontJourneyNavigation';
import './mobileSectionJourney.css';

export default function MobileSectionJourney({config={},motion={},sectionIds}) {
  const root=useRef(null), cancel=useRef(()=>{}), busyRef=useRef(false), arrived=useRef(null);
  const [state,setState]=useState({index:0,total:0,atStart:true,atEnd:false});
  const [busy,setBusy]=useState(false), [announcement,setAnnouncement]=useState('');
  const offset=Math.max(0,Number(config.offsetTopPx)||0);
  const bottom=Math.max(12,Math.min(160,Number(config.bottomPx)||24));
  const color=config.iconColor || '#b47d3f';
  const metalId='journey-metal-'+useId().replace(/:/g,'');
  const refresh=useRef(()=>{});
  const currentIndex=targets=>{
    const y=window.scrollY, max=journeyMaxScroll();
    if(arrived.current){
      const found=targets.findIndex(item=>item.id===arrived.current.id);
      if(found>=0 && y>=Math.min(arrived.current.y,targets[found].top)-3 && y<(targets[found+1]?.top ?? Infinity)-3)return found;
    }
    arrived.current=null;
    const header=document.querySelector('.theme-header');
    const headerOffset=header?.dataset.visible==='false'?0:Math.max(offset,header?.getBoundingClientRect().height || 0);
    if(max>0 && y>=max-2)return Math.max(0,targets.length-1);
    return targets.reduce((last,item,i)=>item.top<=y+headerOffset+4?i:last,0);
  };
  useEffect(()=>{
    let frame=0,disposed=false,layoutDirty=true;
    const update=()=>{
      frame=0;if(disposed || !root.current)return;
      const targets=journeyTargets(sectionIds), y=window.scrollY;
      const index=currentIndex(targets);
      const next=targets[index+1];
      const progress=next?Math.max(0,Math.min(1,(y-targets[index].top)/Math.max(1,next.top-targets[index].top))):1;
      if(!busyRef.current)root.current.style.setProperty('--journey-progress',String(progress));
      const nextState={index,total:targets.length,atStart:index===0,atEnd:index>=targets.length-1};
      setState(old=>Object.keys(nextState).every(key=>old[key]===nextState[key])?old:nextState);
      if(!layoutDirty)return;
      layoutDirty=false;
      // Keep the edge guide clear of a floating WhatsApp action if present.
      const box=root.current.getBoundingClientRect();
      const style=getComputedStyle(root.current), clearance=parseFloat(style.getPropertyValue('--journey-clearance'))||0;
      const baseBottom=(parseFloat(style.bottom)||bottom)-clearance;
      const desired={left:box.left,right:box.right,top:innerHeight-baseBottom-box.height,bottom:innerHeight-baseBottom};
      const whatsapp=document.querySelector('.whatsapp-button')?.getBoundingClientRect();
      const overlaps=whatsapp && desired.left<whatsapp.right+8 && desired.right>whatsapp.left-8 && desired.top<whatsapp.bottom+8 && desired.bottom>whatsapp.top-8;
      const extra=overlaps?Math.max(0,desired.bottom-whatsapp.top+12):0;
      root.current.style.setProperty('--journey-clearance',extra+'px');
    };
    const schedule=()=>{if(!disposed && !frame)frame=requestAnimationFrame(update);};
    refresh.current=schedule;
    const layout=()=>{layoutDirty=true;schedule();};
    const observer=window.ResizeObserver?new ResizeObserver(layout):null;
    observer?.observe(root.current);
    const story=document.querySelector('.storefront-sections');
    if(story)observer?.observe(story);
    const whatsapp=document.querySelector('.whatsapp-button');if(whatsapp)observer?.observe(whatsapp);
    const mutation=new MutationObserver(layout);mutation.observe(document.getElementById('root') || document.body,{childList:true,subtree:true});
    window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',layout);
    document.addEventListener('load',layout,true);update();
    return ()=>{disposed=true;cancel.current();observer?.disconnect();mutation.disconnect();window.removeEventListener('scroll',schedule);window.removeEventListener('resize',layout);document.removeEventListener('load',layout,true);if(frame)cancelAnimationFrame(frame);document.documentElement.style.removeProperty('--rb-mobile-scroll-dock-height');};
  },[sectionIds,offset,bottom,config.mobilePosition]);

  const navigate=direction=>{
    if(busyRef.current)return;
    const targets=journeyTargets(sectionIds);
    const target=targets[currentIndex(targets)+(direction==='next'?1:-1)];
    if(!target)return;
    const margin=parseFloat(getComputedStyle(target.element).scrollMarginTop)||0;
    const header=document.querySelector('.theme-header');
    const headerHeight=header?(header.getBoundingClientRect().height+(parseFloat(getComputedStyle(header).top)||0)):0;
    setAnnouncement('');busyRef.current=true;setBusy(true);
    cancel.current=animateJourneyTo(target.element,{
      offset:direction==='prev'?Math.max(offset,margin,headerHeight):0,
      pace:motion?.pace,
      instant:config.behavior==='auto',
      onProgress:progress=>root.current?.style.setProperty('--journey-progress',String(progress)),
      onFinish:completed=>{busyRef.current=false;setBusy(false);if(completed){arrived.current={id:target.id,y:window.scrollY};setAnnouncement(`Sección ${targets.indexOf(target)+1} de ${targets.length}`);}refresh.current();},
    });
  };
  const glyph=direction=>{
    const url=config[direction+'UseCustomImage'] && String(config[direction+'ImageUrl']||'').trim();
    return url?<img src={url} alt=""/>:<svg className="mobile-section-journey__glyph" data-direction={direction} viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 4v16M6 14l6 6 6-6" stroke={`url(#${metalId})`} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>;
  };
  return <nav ref={root} className="mobile-section-journey" aria-label="Recorrido por las secciones" aria-busy={busy}
    data-align={config.mobilePosition==='left'?'left':'right'} data-moving={busy} hidden={state.total<2 || (config.showUp===false && config.showDown===false)} style={{'--journey-ink':color,'--journey-tint':config.bgColor || '#f7d9d0','--journey-bottom':bottom+'px'}}>
    <svg className="mobile-section-journey__metal-defs" width="0" height="0" aria-hidden="true"><defs><linearGradient id={metalId} x1="0" y1="0" x2=".8" y2="1"><stop offset="0" stopColor="color-mix(in srgb,var(--journey-ink) 65%,#fff1bf)"/><stop offset=".3" stopColor="var(--journey-ink)"/><stop offset=".52" stopColor="color-mix(in srgb,var(--journey-ink) 70%,#593018)"/><stop offset=".7" stopColor="color-mix(in srgb,var(--journey-ink) 50%,#ffe7ac)"/><stop offset="1" stopColor="color-mix(in srgb,var(--journey-ink) 70%,#593018)"/></linearGradient></defs></svg>
    {config.showUp!==false && <button type="button" className="mobile-section-journey__previous" aria-label="Sección anterior" disabled={busy || state.atStart || state.total<2} onClick={()=>navigate('prev')}>{glyph('up')}</button>}
    <span className="mobile-section-journey__count" aria-label={`Sección ${state.index+1} de ${state.total}`}><b>{String(state.index+1).padStart(2,'0')}</b><span>/ {String(state.total).padStart(2,'0')}</span></span>
    <span className="mobile-section-journey__track" aria-hidden="true"><i/></span>
    {config.showDown!==false && <button type="button" className="mobile-section-journey__next" aria-label="Siguiente sección" disabled={busy || state.atEnd || state.total<2} onClick={()=>navigate('next')}>
      {glyph('down')}
    </button>}
    <span className="mobile-section-journey__announcement" role="status">{announcement}</span>
  </nav>;
}
