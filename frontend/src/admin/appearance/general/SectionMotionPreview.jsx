import React, { useEffect, useId, useRef, useState } from 'react';
import { Monitor, Smartphone, Play, Pause, RotateCcw } from 'lucide-react';
import StorefrontStory from '../../../components/StorefrontStory';
import { STORY_PRESETS, normalizeStoryConfig, storySectionOrder } from '../../../lib/storefrontStoryConfig';
import './sectionMotionPanel.css';

function sceneImages(theme,id){const config=theme.sections?.find(item=>item.id===id)?.config || {};const values=[config.heroImage,config.imageSrc,config.image,config.fanImage,theme.banner?.imageUrl];const found=values.filter(value=>typeof value==='string'&&/^(?:\/(?!\/)|https:\/\/)/i.test(value));return [...new Set(found)];}
const labels={tendencia:'Tendencias',look:'Looks',complementos:'Complementos',categorias:'Categorías',instagram:'Instagram',tiktok:'TikTok',informacion:'Información'};
export default function SectionMotionPreview({config,theme={}}) {
  const c=normalizeStoryConfig(config), viewport=useRef(null), uid=useId().replace(/:/g,'');
  const [device,setDevice]=useState('desktop'), [progress,setProgress]=useState(0), [playing,setPlaying]=useState(false),[replay,setReplay]=useState(0);
  const progressRef=useRef(progress);progressRef.current=progress;
  const [reduced,setReduced]=useState(()=>window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches || false);
  const sections=storySectionOrder(theme.sections).filter(id=>!theme.sections?.some(item=>item.id===id && item.enabled===false));
  const chapters=[{id:'banner',title:theme.banner?.title || 'Portada'},...sections.map(id=>({id,title:theme.sections?.find(item=>item.id===id)?.title || labels[id]})),{id:'footer',title:'Pie de página'}];
  useEffect(()=>{
    const media=window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const update=()=>{setReduced(media.matches);setPlaying(false);};
    media?.addEventListener?.('change',update);return ()=>media?.removeEventListener?.('change',update);
  },[]);
  useEffect(()=>{
    const el=viewport.current;if(el)el.scrollTop=(el.scrollHeight-el.clientHeight)*progress/100;
  },[progress,device]);
  useEffect(()=>{
    const el=viewport.current;
    const observer=window.ResizeObserver?new ResizeObserver(()=>{el.scrollTop=(el.scrollHeight-el.clientHeight)*progressRef.current/100;}):null;
    if(el)observer?.observe(el);return ()=>observer?.disconnect();
  },[]);
  useEffect(()=>{
    setProgress(0);setPlaying(c.enabled && !reduced);
  },[c.preset,c.experience,c.enabled,device,reduced]);
  useEffect(()=>{
    if(!playing || reduced)return;
    let frame=0, start;
    const hold={quick:1850,balanced:2600,leisurely:3400}[c.pace], travel=650, period=hold+travel;
    const animate=time=>{
      start??=time;
      const elapsed=time-start, index=Math.min(chapters.length-1,Math.floor(elapsed/period));
      const local=elapsed-index*period, ratio=Math.max(0,Math.min(1,(local-hold)/travel));
      const ease=ratio*ratio*(3-2*ratio), nodes=[...viewport.current.querySelector('.storefront-sections').children].filter(node=>node.tagName==='SECTION');
      const max=viewport.current.scrollHeight-viewport.current.clientHeight;
      const position=i=>Math.max(0,Math.min(max,Number(nodes[i]?.dataset.storyTop)||0));
      const from=position(index), to=position(Math.min(index+1,chapters.length-1));
      setProgress(max?(from+(to-from)*ease)/max*100:0);
      if(elapsed<(chapters.length-1)*period+hold)frame=requestAnimationFrame(animate);else setPlaying(false);
    };
    const hide=()=>{if(document.hidden)setPlaying(false);};
    document.addEventListener('visibilitychange',hide);
    frame=requestAnimationFrame(animate);
    return ()=>{cancelAnimationFrame(frame);document.removeEventListener('visibilitychange',hide);};
  },[playing,c.pace,reduced,chapters.length]);
  const current=Math.min(chapters.length-1,Math.floor(progress/100*(chapters.length-1)));
  return <aside className="appearance-general__preview story-preview" aria-label="Vista previa de la animación global">
    <div className="appearance-general__preview-header"><span className="appearance-general__preview-live" aria-hidden="true"/><strong>Vista previa del movimiento</strong><small>{c.experience==='journey'?'Camino continuo':STORY_PRESETS.find(item=>item.id===c.preset).name}</small></div>
    <div className="story-preview__devices" role="group" aria-label="Dispositivo del recorrido">{[['desktop','Escritorio',Monitor],['mobile','Móvil',Smartphone]].map(([id,label,Icon])=><button key={id} type="button" aria-label={'Recorrido en '+label.toLowerCase()} aria-pressed={device===id} onClick={()=>setDevice(id)}><Icon size={15}/>{label}</button>)}</div>
    <div className="story-preview__screen" data-device={device} data-admin-storefront-preview="true" style={{'--color-bg':theme.colors?.background || '#ffffff','--color-text':theme.colors?.text || '#111827','--color-accent':theme.colors?.accent || '#64748b',fontFamily:theme.fonts?.base || 'system-ui, sans-serif'}}>
      <div ref={viewport} className="story-preview__viewport" aria-label="Demostración de las transiciones">
        <StorefrontStory config={c} viewportRef={viewport} mobileOverride={device==='mobile'} replayKey={replay}>
          {chapters.map((chapter,index)=>{const images=sceneImages(theme,chapter.id);return <section key={chapter.id} id={'story-preview-'+uid+'-'+chapter.id} className="story-preview__chapter" data-journey-section={chapter.id} data-tone={index%3}>
            <div className="story-preview__content"><span className="story-preview__counter" data-story-actor="eyebrow">{String(index+1).padStart(2,'0')} / {String(chapters.length).padStart(2,'0')}</span><h2>{chapter.title}</h2>{images.length>0?<div className="story-preview__visuals" data-single={images.length===1}><article className="story-preview__hero" data-story-actor="hero" aria-label="Imagen configurada de la sección"><img src={images[0]} alt=""/></article>{images.length>1 && <div className="story-preview__details">{images.slice(1,4).map((src,i)=><article data-story-actor="product" key={src} aria-label={'Imagen configurada '+(i+2)}><img src={src} alt=""/></article>)}</div>}</div>:<p className="story-preview__empty" data-story-actor="hero">Las imágenes que configures en esta tienda aparecerán aquí.</p>}<span className="story-preview__action" data-story-action>Explorar sección <span aria-hidden="true">→</span></span></div>
          </section>;})}
        </StorefrontStory>
      </div>
    </div>
    <div className="story-preview__controls"><button type="button" disabled={reduced} onClick={()=>{if(!playing)setProgress(0);setPlaying(!playing);}}>{playing?<Pause size={15}/>:<Play size={15}/>} {playing?'Pausar':'Reproducir recorrido'}</button><button type="button" aria-label="Reiniciar recorrido" onClick={()=>{setPlaying(false);setProgress(0);setReplay(value=>value+1);}}><RotateCcw size={15}/></button></div>
    <label className="story-preview__scrubber">Recorrer secciones<input type="range" min="0" max="100" value={progress} onChange={event=>{setPlaying(false);setProgress(Number(event.target.value));}}/><span>{chapters[current]?.title}</span></label>
    <p className="appearance-general__preview-note">{reduced?'El dispositivo solicita movimiento reducido: el recorrido aparece sin animaciones.':!c.enabled?'La animación global está apagada. Puedes recorrer las secciones sin efectos.':'Reproduce o arrastra el control: los adornos recorren una misma curva entre secciones y la línea muestra su avance. Al subir, el movimiento se invierte. Ajusta cantidad, tamaño y presencia por sección en los controles.'}</p>
  </aside>;
}
