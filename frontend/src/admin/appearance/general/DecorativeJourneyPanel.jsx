import React, { useState } from 'react';
import CloudinaryImageField from './CloudinaryImageField';
import { DECORATIVE_JOURNEY_DEFAULTS, JOURNEY_FLOWERS } from '../../../lib/decorativeJourneyConfig';

function Range({label,value,min,max,step=1,onChange,suffix=''}){
  return <label className="journey-editor__range">{label}<output>{value}{suffix}</output><input type="range" aria-label={label} value={value} min={min} max={max} step={step} onChange={event=>onChange(Number(event.target.value))}/></label>;
}
export default function DecorativeJourneyPanel({config,onChange,uploadToCloudinaryViaBackend,uploading,setUploading,savedRevision}){
  const [tab,setTab]=useState('adornos'),c=config.journey;
  const edit=(key,value)=>onChange({...config,journey:{...c,[key]:value}});
  const uploadProps={onUpload:uploadToCloudinaryViaBackend,uploading,setUploading,savedRevision};
  return <div className="journey-editor">
    <div className="journey-editor__tabs" role="group" aria-label="Ajustes del camino">{[['adornos','Adornos'],['recorrido','Recorrido'],['fondo','Fondo'],['movil','Móvil']].map(([id,label])=><button type="button" key={id} aria-pressed={tab===id} onClick={()=>setTab(id)}>{label}</button>)}</div>
    {tab==='adornos' && <div className="journey-editor__fields">
      <p>Estas imágenes forman un único adorno que continúa entre todas las secciones. Usa PNG o WebP sin fondo.</p>
      <CloudinaryImageField label="Adorno principal" value={c.image} onChange={value=>edit('image',value)} transparentOnly {...uploadProps}/>
      <button type="button" className="journey-editor__restore" onClick={()=>edit('image',JOURNEY_FLOWERS)}>Usar flores incluidas</button>
      <details><summary>Segundo adorno · opcional</summary><CloudinaryImageField label="Adorno secundario" value={c.secondaryImage} onChange={value=>edit('secondaryImage',value)} transparentOnly {...uploadProps}/></details>
    </div>}
    {tab==='recorrido' && <div className="journey-editor__fields">
      <label>Forma del camino<select value={c.path} onChange={event=>edit('path',event.target.value)}><option value="flowing">Curvas envolventes</option><option value="edges">Por los laterales</option></select></label>
      <Range label="Tamaño de los adornos" value={c.size} min={60} max={320} step={5} suffix=" px" onChange={value=>edit('size',value)}/>
      <Range label="Cantidad de adornos" value={c.density} min={8} max={28} onChange={value=>edit('density',value)}/>
      <Range label="Profundidad del camino" value={c.depth} min={0} max={100} step={5} suffix=" %" onChange={value=>edit('depth',value)}/>
      <Range label="Opacidad de los adornos" value={c.opacity} min={20} max={100} step={5} suffix=" %" onChange={value=>edit('opacity',value)}/>
      <label className="journey-editor__check"><span>Mostrar hilo que une los adornos</span><input type="checkbox" checked={c.stemVisible} onChange={event=>edit('stemVisible',event.target.checked)}/></label>
      {c.stemVisible && <label className="journey-editor__color">Color del hilo<input type="color" value={c.stemColor} onChange={event=>edit('stemColor',event.target.value)}/></label>}
    </div>}
    {tab==='fondo' && <div className="journey-editor__fields">
      <label className="journey-editor__check"><span>Usar un fondo continuo para toda la tienda</span><input type="checkbox" checked={c.unifyBackground} onChange={event=>edit('unifyBackground',event.target.checked)}/></label>
      <p>El fondo continuo une las secciones y da espacio al adorno en movimiento. Las fotografías de productos conservan su imagen.</p>
      {c.unifyBackground && <><CloudinaryImageField label="Fondo continuo" value={c.backgroundImage} onChange={value=>edit('backgroundImage',value)} {...uploadProps}/><button type="button" className="journey-editor__restore" onClick={()=>edit('backgroundImage',DECORATIVE_JOURNEY_DEFAULTS.backgroundImage)}>Usar fondo incluido</button><button type="button" className="journey-editor__restore" onClick={()=>edit('backgroundImage','')}>Usar solo el color de la tienda</button></>}
    </div>}
    {tab==='movil' && <div className="journey-editor__fields">
      <p>En el modo adaptado, el camino utiliza estos tamaños y esta cantidad para dejar espacio al contenido.</p>
      <Range label="Tamaño de adornos en móvil" value={c.mobileSize} min={36} max={150} step={2} suffix=" px" onChange={value=>edit('mobileSize',value)}/>
      <Range label="Cantidad de adornos en móvil" value={c.mobileDensity} min={4} max={14} onChange={value=>edit('mobileDensity',value)}/>
    </div>}
  </div>;
}
