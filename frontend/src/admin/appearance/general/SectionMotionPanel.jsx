import React, { useId } from 'react';
import { STORY_PRESETS, normalizeStoryConfig } from '../../../lib/storefrontStoryConfig';
import './sectionMotionPanel.css';

export default function SectionMotionPanel({config,onChange}) {
  const c=normalizeStoryConfig(config), name=useId();
  const edit=(key,value)=>onChange({...c,[key]:value});
  return <section className="story-editor" aria-label="Animación global de las secciones">
    <header><h3>Presentaciones por objetos</h3><p>Cada sección abre como una tarjeta y presenta sus propios elementos: título, imagen principal, detalles y acción.</p></header>
    <label className="story-editor__toggle"><span>Activar animación global</span><input type="checkbox" checked={c.enabled} onChange={event=>edit('enabled',event.target.checked)}/></label>
    <fieldset className="story-editor__themes"><legend>Tema de animación</legend>
      <div className="story-editor__choices">{STORY_PRESETS.map((item,index)=><label key={item.id} className="story-editor__choice" data-selected={c.preset===item.id} data-preset={item.id}>
        <input type="radio" name={name} value={item.id} checked={c.preset===item.id} onChange={()=>edit('preset',item.id)}/>
        <span className="story-editor__illustration" aria-hidden="true">{Array.from({length:5},(_,i)=><i key={i}/>)}<b>0{index+1}</b></span>
        <strong>{item.name}</strong><small>{item.description}</small>
      </label>)}</div>
    </fieldset>
    <div className="story-editor__settings">
      <label>Intensidad <output>{c.intensity} %</output><input type="range" aria-label="Intensidad de la animación global" min="20" max="100" step="5" value={c.intensity} onChange={event=>edit('intensity',Number(event.target.value))}/></label>
      <label>Ritmo del recorrido<select value={c.pace} onChange={event=>edit('pace',event.target.value)}><option value="quick">Ágil</option><option value="balanced">Equilibrado</option><option value="leisurely">Pausado</option></select></label>
      <label>Comportamiento en móvil<select value={c.mobileMode} onChange={event=>edit('mobileMode',event.target.value)}><option value="adapted">Adaptado y más suave</option><option value="same">Mismo efecto que en escritorio</option><option value="off">Sin animación en móvil</option></select></label>
    </div>
    <p className="story-editor__note">La vista previa usa el mismo efecto de la tienda. El recorrido sigue el orden de las secciones. Las secciones largas se leen completas y se respeta el movimiento reducido del dispositivo. Guarda los cambios para aplicarlo a la tienda.</p>
  </section>;
}
