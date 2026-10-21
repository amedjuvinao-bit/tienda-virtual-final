import React, { useState } from 'react';
import { JOURNEY_SECTION_IDS } from '../../../lib/decorativeJourneyConfig';
import CloudinaryImageField from './CloudinaryImageField';

function Range({label,value,min,max,step=1,onChange,suffix=''}){
  return <label className="journey-editor__range">{label}<output>{value}{suffix}</output><input type="range" aria-label={label} value={value} min={min} max={max} step={step} onChange={event=>onChange(Number(event.target.value))}/></label>;
}
export default function DecorativeJourneyPanel({config,onChange,theme={},uploadToCloudinaryViaBackend,uploading,setUploading,savedRevision}){
  const [tab,setTab]=useState('adornos'),[sectionId,setSectionId]=useState('banner'),c=config.journey;
  const labels={banner:'Portada',tendencia:'Tendencias',look:'Look',complementos:'Complementos',categorias:'Categorías',instagram:'Instagram',tiktok:'TikTok',informacion:'Información',footer:'Pie de página'};
  const current={placement:'auto',scale:100,accent:65,enabled:true,...c.sectionSettings?.[sectionId]};
  const editSection=(key,value)=>edit('sectionSettings',{...c.sectionSettings,[sectionId]:{...current,[key]:value}});
  const edit=(key,value)=>onChange({...config,journey:{...c,[key]:value}});
  const themeAccent=/^#[\da-f]{6}$/i.test(theme.colors?.accent)?theme.colors.accent:'#111827';
  const uploadProps={onUpload:uploadToCloudinaryViaBackend,uploading,setUploading,savedRevision};
  return <div className="journey-editor">
    <div className="journey-editor__tabs" role="group" aria-label="Ajustes del camino">{[['adornos','Adornos'],['recorrido','Recorrido'],['secciones','Secciones'],['fondo','Fondo'],['movil','Móvil']].map(([id,label])=><button type="button" key={id} aria-pressed={tab===id} onClick={()=>setTab(id)}>{label}</button>)}</div>
    {tab==='adornos' && <div className="journey-editor__fields">
      <p>Carga los recursos visuales de esta tienda para que se muevan entre las secciones. Usa PNG o WebP sin fondo. Sin imágenes cargadas, no aparecen adornos.</p>
      <CloudinaryImageField label="Adorno principal" value={c.image} onChange={value=>edit('image',value)} transparentOnly {...uploadProps}/>
      <details><summary>Segundo adorno · opcional</summary><CloudinaryImageField label="Adorno secundario" value={c.secondaryImage} onChange={value=>edit('secondaryImage',value)} transparentOnly {...uploadProps}/></details>
    </div>}
    {tab==='recorrido' && <div className="journey-editor__fields">
      <label>Forma del camino<select value={c.path} onChange={event=>edit('path',event.target.value)}><option value="flowing">Curvas envolventes</option><option value="edges">Por los laterales</option></select></label>
      <Range label="Tamaño de los adornos" value={c.size} min={60} max={320} step={5} suffix=" px" onChange={value=>edit('size',value)}/>
      <Range label="Densidad del acompañamiento" value={c.density} min={8} max={28} onChange={value=>edit('density',value)}/>
      <Range label="Profundidad del camino" value={c.depth} min={0} max={100} step={5} suffix=" %" onChange={value=>edit('depth',value)}/>
      <Range label="Opacidad de los adornos" value={c.opacity} min={20} max={100} step={5} suffix=" %" onChange={value=>edit('opacity',value)}/>
      <label className="journey-editor__check"><span>Mostrar hilo que une los adornos</span><input type="checkbox" checked={c.stemVisible} onChange={event=>edit('stemVisible',event.target.checked)}/></label>
      {c.stemVisible && <><label className="journey-editor__color">Color del hilo<input type="color" value={c.stemColor || themeAccent} onChange={event=>edit('stemColor',event.target.value)}/></label><button type="button" className="journey-editor__restore" onClick={()=>edit('stemColor','')}>Usar el color de la tienda</button></>}
    </div>}
    {tab==='secciones' && <div className="journey-editor__fields">
      <p>La imagen principal continúa de una sección a otra. Cada sección tiene una composición propia; ajusta una a la vez.</p>
      <label>Sección del recorrido<select value={sectionId} onChange={event=>setSectionId(event.target.value)}>{JOURNEY_SECTION_IDS.map(id=><option key={id} value={id}>{(theme.sections?.find(section=>section.id===id)?.title || theme.sections?.find(section=>section.id===id)?.name || theme.sections?.find(section=>section.id===id)?.label) || (id==='banner'?theme.banner?.title:'') || labels[id]}</option>)}</select></label>
      <label className="journey-editor__check"><span>Mostrar el adorno en esta sección</span><input type="checkbox" checked={current.enabled} onChange={event=>editSection('enabled',event.target.checked)}/></label>
      <label>Composición de esta sección<select value={current.placement} onChange={event=>editSection('placement',event.target.value)}><option value="auto">Adaptada a su estructura</option><option value="left">Enmarcar por la izquierda</option><option value="right">Enmarcar por la derecha</option><option value="bottom">Acompañar el borde inferior</option></select></label>
      <Range label="Tamaño relativo en esta sección" value={current.scale} min={60} max={150} step={5} suffix=" %" onChange={value=>editSection('scale',value)}/>
      <Range label="Acompañamiento en esta sección" value={current.accent} min={0} max={100} step={5} suffix=" %" onChange={value=>editSection('accent',value)}/>
      <button type="button" className="journey-editor__restore" onClick={()=>{const next={...c.sectionSettings};delete next[sectionId];edit('sectionSettings',next);}}>Restablecer composición de esta sección</button>
    </div>}
    {tab==='fondo' && <div className="journey-editor__fields">
      <label className="journey-editor__check"><span>Usar un fondo continuo para toda la tienda</span><input type="checkbox" checked={c.unifyBackground} onChange={event=>edit('unifyBackground',event.target.checked)}/></label>
      <p>El fondo continuo une las secciones y da espacio al adorno en movimiento. Las fotografías de productos conservan su imagen.</p>
      {c.unifyBackground && <><CloudinaryImageField label="Fondo continuo" value={c.backgroundImage} onChange={value=>edit('backgroundImage',value)} {...uploadProps}/><button type="button" className="journey-editor__restore" onClick={()=>edit('backgroundImage','')}>Usar solo el color de la tienda</button></>}
    </div>}
    {tab==='movil' && <div className="journey-editor__fields">
      <p>En el modo adaptado, el camino utiliza estos tamaños y esta cantidad para dejar espacio al contenido.</p>
      <Range label="Tamaño de adornos en móvil" value={c.mobileSize} min={36} max={150} step={2} suffix=" px" onChange={value=>edit('mobileSize',value)}/>
      <Range label="Densidad del acompañamiento en móvil" value={c.mobileDensity} min={4} max={14} onChange={value=>edit('mobileDensity',value)}/>
    </div>}
  </div>;
}
