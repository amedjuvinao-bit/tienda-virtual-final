import React, { useMemo, useRef, useState } from 'react';
import { Field as BaseField, Input } from '../ui/UiComponents';
import { ColorField } from '../ui/SectionsPanelUI';
import SectionEditorSteps from '../ui/SectionEditorSteps';
import SectionEditorCardTabs from '../ui/SectionEditorCardTabs';
import { normalizeInfoSection, isInfoSection, INFO_FONT_OPTIONS, INFO_ICON_OPTIONS, INFO_ANIMATION_OPTIONS } from './infoSectionHelpers';
import { normalizeInfoGlass, infoGlassCard, INFO_GLASS_DEFAULTS, safeInfoHref, safeInfoImage } from './infoGlassHelpers';

function Toggle({ checked, onChange, 'aria-label': label }) {
  return <button type="button" role="switch" aria-label={label} aria-checked={!!checked} onClick={()=>onChange?.(!checked)} className={'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition '+(checked?'bg-emerald-500 border-emerald-500':'bg-neutral-200 border-neutral-300')}><span className={'h-4 w-4 rounded-full bg-white shadow transition-transform '+(checked?'translate-x-5':'translate-x-1')}/></button>;
}
function Field({ label, children }) {
  return <BaseField label={label}>{React.isValidElement(children) ? React.cloneElement(children, { 'aria-label': label }) : children}</BaseField>;
}
const panel = 'rounded-2xl border border-rose-100 bg-white/65 p-4 space-y-4';
const button = 'min-h-11 rounded-xl border border-rose-200 px-3 py-2 text-sm disabled:opacity-40';
function Select({ value, onChange, options, label, ...props }) {
  return <select {...props} aria-label={label || props['aria-label']} className="w-full min-h-11 rounded-xl border border-rose-200 bg-white/70 px-3 text-sm" value={value} onChange={e => onChange(e.target.value)}>{options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>;
}
function Text({ value, onChange, rows = 3, ...props }) {
  return <textarea {...props} className="w-full rounded-xl border border-rose-200 bg-white/70 p-3 text-sm" value={value ?? ''} onChange={e => onChange(e.target.value)} rows={rows} />;
}
const options = pairs => pairs.map(([value,label]) => ({ value,label }));
const sizes = {
  Medidas: [['maxWidth','Ancho máximo (px)',600,2200],['minHeight','Alto mínimo (px)',0,1400],['paddingX','Margen lateral (px)',0,160],['paddingY','Espacio vertical (px)',0,200],['cardHeight','Alto de los bloques (px)',220,700],['cardPadding','Espacio interior (px)',16,64],['gap','Separación (px)',12,80],['radius','Esquinas (px)',0,60],['featuredLift','Elevación del destacado (px)',0,80],['featuredWidth','Ancho del destacado (%)',100,140]],
  Cristal: [['depth','Separación de capas (px)',0,40],['materialOpacity','Intensidad de la textura (%)',0,100],['glassOpacity','Color del vidrio (%)',0,90],['blur','Desenfoque (px)',0,32]],
  Tipografía: [['titleSize','Tamaño del título (px)',24,100],['cardTitleSize','Títulos de bloque (px)',18,48],['bodySize','Texto de bloque (px)',12,28],['iconSize','Tamaño de iconos (px)',40,160]],
  Móvil: [['mobileTitleSize','Título en móvil (px)',22,60],['mobileCardHeight','Alto mínimo de bloque en móvil (px)',140,600],['mobilePadding','Margen lateral en móvil (px)',12,48],['mobileGap','Separación en móvil (px)',12,64],['mobileIconSize','Icono en móvil (px)',40,120]],
};
export default function InfoSectionUI({ theme, setPath, uploadToCloudinary, uploading }) {
  const sections = Array.isArray(theme?.sections) ? theme.sections : [];
  const index = sections.findIndex(isInfoSection);
  const section = useMemo(() => normalizeInfoSection(sections[index]), [sections,index]);
  const c = normalizeInfoGlass(section.config), cards = section.config.cards.map(infoGlassCard);
  const [tab,setTab] = useState('contenido'), [contentTab,setContentTab] = useState('textos'), [cardId,setCardId] = useState('');
  const [uploadError,setUploadError] = useState(''), [pending,setPending] = useState(false);
  const current = cards.find(card => card.id === cardId) || cards[0];
  const latest = useRef(null); latest.current = { sections,index,section };
  function commit(next) {
    const state = latest.current, list = [...state.sections];
    if (state.index >= 0) list[state.index] = normalizeInfoSection(next); else list.push(normalizeInfoSection(next));
    setPath?.('sections',list);
  }
  function config(patch) { const s=latest.current.section; commit({ ...s,config:{ ...s.config,...patch } }); }
  function glass(patch) { const s=latest.current.section; config({ glass:{ ...normalizeInfoGlass(s.config),...patch },layout:'glass' }); }
  function card(id,patch) { const list=latest.current.section.config.cards.map(infoGlassCard); config({ cards:list.map(item=>item.id===id?{...item,...patch}:item) }); }
  function move(delta) {
    const list=latest.current.section.config.cards.map(infoGlassCard), from=list.findIndex(item=>item.id===current.id), to=from+delta;
    if(to<0 || to>=list.length)return; [list[from],list[to]]=[list[to],list[from]]; config({cards:list});
  }
  async function upload(file,targetId) {
    if(!file || !uploadToCloudinary)return;
    setUploadError('');setPending(true);
    try { const url=await uploadToCloudinary(file); if(!safeInfoImage(url))throw new Error('No se pudo cargar una imagen válida.');
      if(targetId)card(targetId,{iconType:'image',iconUrl:url});else glass({backgroundImage:url,backgroundMode:'image'});
    }catch(error){setUploadError(error?.message || 'No se pudo cargar la imagen.');}finally{setPending(false);}
  }
  const numbers = name => <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{sizes[name].map(([key,label,min,max])=><Field key={key} label={label}><Input type="number" min={min} max={max} value={c[key]} onChange={e=>glass({[key]:Number(e.target.value)})}/></Field>)}</div>;
  const colors = entries => <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{entries.map(([key,label])=><ColorField key={key} label={label} value={c[key]} onChange={value=>glass({[key]:value})}/>)}</div>;
  const active = current ? cards.findIndex(item=>item.id===current.id) : 0;
  return <div className="space-y-4 min-w-0">
    <div className={panel}>
      <div className="flex items-center justify-between gap-3"><strong>Información · Cristal en capas</strong><label className="flex items-center gap-3 text-sm">Activa<Toggle aria-label="Activar Información" checked={section.enabled} onChange={value=>commit({...latest.current.section,enabled:!!value})}/></label></div>
      <SectionEditorSteps value={tab} onChange={setTab} sectionName="Información" items={[
        {value:'contenido',label:'Contenido',hint:'Edita el encabezado y selecciona un bloque para configurar su contenido y su botón.'},
        {value:'general',label:'Diseño',hint:'Ajusta la composición, los materiales, el fondo y las animaciones.'},
      ]}/>
      {tab==='contenido' && <nav className="section-editor-substeps" aria-label="Opciones de contenido">{[['textos','Textos'],['bloques','Bloques']].map(([value,label])=><button type="button" key={value} aria-pressed={contentTab===value} onClick={()=>setContentTab(value)}>{label}</button>)}</nav>}
    </div>
    {uploadError && <p role="alert" className="text-sm text-red-800">{uploadError}</p>}
    {tab==='contenido' && contentTab==='textos' && <div className={panel}>
      <Field label="Texto superior"><Input value={c.eyebrow} onChange={e=>glass({eyebrow:e.target.value})}/></Field>
      <Field label="Texto del título"><Text value={c.title} onChange={value=>glass({title:value})}/></Field>
      <p className="text-xs opacity-65">Puedes dejar el encabezado vacío o insertar un salto de línea. Los textos se adaptan a cualquier negocio.</p>
    </div>}
    {tab==='contenido' && contentTab==='bloques' && <>
      <nav className="section-editor-substeps" aria-label="Elegir bloque">{cards.map((item,i)=><button type="button" key={item.id} aria-pressed={current?.id===item.id} onClick={()=>setCardId(item.id)}>{'Bloque '+(i+1)}</button>)}</nav>
      {current && <SectionEditorCardTabs label="Opciones del bloque" labels={['Contenido','Icono','Botón']}>
        <div className={panel}>
          <div className="flex flex-wrap items-center gap-3"><label className="flex items-center gap-2 text-sm">Mostrar bloque<Toggle aria-label="Mostrar bloque" checked={current.enabled} onChange={value=>card(current.id,{enabled:!!value})}/></label><button className={button} type="button" disabled={active===0} onClick={()=>move(-1)}>← Antes</button><button className={button} type="button" disabled={active===cards.length-1} onClick={()=>move(1)}>Después →</button></div>
          <Field label="Título del bloque"><Input value={current.heading} onChange={e=>card(current.id,{heading:e.target.value})}/></Field>
          <Field label="Texto del bloque"><Text value={current.text} onChange={value=>card(current.id,{text:value})}/></Field>
          <button type="button" className={button} aria-pressed={c.featuredId===current.id} onClick={()=>glass({featuredId:c.featuredId===current.id?'':current.id})}>{c.featuredId===current.id?'★ Bloque destacado':'Destacar este bloque'}</button>
        </div>
        <div className={panel}>
          <Field label="Origen del icono"><Select value={current.iconType==='image'?'image':'lucide'} onChange={value=>card(current.id,{iconType:value})} options={options([['lucide','Biblioteca de iconos'],['image','Imagen personalizada']])}/></Field>
          {current.iconType==='image'?<>{(current.iconUrl || '') && <button type="button" className="rounded-xl border px-3 py-2 text-xs" onClick={() => card(current.id,{iconUrl:""})}>Quitar imagen</button>}<Field label="Subir icono"><input type="file" accept="image/*" disabled={uploading||pending} onChange={e=>upload(e.target.files?.[0],current.id)}/></Field></>:
            <Field label="Icono"><Select value={current.icon} onChange={value=>card(current.id,{icon:value})} options={INFO_ICON_OPTIONS}/></Field>}
          <Field label="Estilo de iconos"><Select value={c.iconStyle} onChange={value=>glass({iconStyle:value})} options={options([['relief','Relieve de la referencia'],['line','Líneas con color editable']])}/></Field>
          <p className="text-xs opacity-65">Camión, atención y tienda incluyen el relieve del modelo. Los otros iconos usan trazos con volumen.</p>
        </div>
        <div className={panel}>
          <label className="flex items-center justify-between text-sm">Mostrar botón<Toggle aria-label="Mostrar botón" checked={current.buttonEnabled} onChange={value=>card(current.id,{buttonEnabled:!!value})}/></label>
          <Field label="Texto del botón"><Input value={current.buttonText} onChange={e=>card(current.id,{buttonText:e.target.value})}/></Field>
          <Field label="Acción del botón"><Select value={current.actionMode} onChange={value=>card(current.id,{actionMode:value})} options={options([['details','Abrir información'],['link','Ir a un enlace o sección'],['whatsapp','Abrir WhatsApp']])}/></Field>
          {current.actionMode==='details'?<Field label="Información al pulsar"><Text value={current.detailText} onChange={value=>card(current.id,{detailText:value})} rows={4}/></Field>:<>
            <Field label={current.actionMode==='whatsapp'?'Número con indicativo (opcional)':'Destino del botón'}><Input value={current.href} placeholder={current.actionMode==='whatsapp'?'Usar WhatsApp de la tienda':'https://… o /ruta o #seccion'} onChange={e=>card(current.id,{href:e.target.value})}/></Field>
            {current.actionMode==='link' && current.href && !safeInfoHref(current.href) && <p role="alert" className="text-xs text-red-700">Introduce un enlace válido. El botón no se activará con este destino.</p>}
            {current.actionMode==='whatsapp' && <><p className="text-xs opacity-65">Si lo dejas vacío, se utiliza el WhatsApp configurado en la tienda.</p><Field label="Mensaje de WhatsApp"><Text value={current.whatsappMessage || ''} onChange={value=>card(current.id,{whatsappMessage:value})} rows={2}/></Field></>}
            <label className="flex items-center justify-between text-sm">Abrir en otra pestaña<Toggle aria-label="Abrir en otra pestaña" checked={current.newTab} onChange={value=>card(current.id,{newTab:!!value})}/></label>
          </>}
          <p className="text-xs opacity-65">La información usa el texto del bloque si no añades un detalle. Los contactos y destinos se toman de lo que configures.</p>
        </div>
      </SectionEditorCardTabs>}
    </>}
    {tab==='general' && <SectionEditorCardTabs label="Diseño de Información" labels={['Modelo','Medidas','Cristal','Fondo','Tipografía','Móvil','Animación']}>
      <div className={panel}>
        <h3 className="font-semibold">Modelo elegido · Cristal en capas</h3><p className="text-sm opacity-75">Tres paneles superpuestos, iconos con relieve y un bloque destacado. Los contenidos siguen siendo editables.</p>
        <Field label="Bloque destacado"><Select value={c.featuredId} onChange={value=>glass({featuredId:value})} options={[{value:'',label:'Ninguno'},...cards.map((item,i)=>({value:item.id,label:'Bloque '+(i+1)+' · '+item.heading}))]}/></Field>
        <label className="flex items-center justify-between text-sm">Mostrar numeración<Toggle aria-label="Mostrar numeración" checked={c.showNumbers} onChange={value=>glass({showNumbers:!!value})}/></label>
        <button className={button} type="button" onClick={()=>config({layout:'glass',glass:{...INFO_GLASS_DEFAULTS,title:c.title,eyebrow:c.eyebrow}})}>Restaurar apariencia de referencia</button>
      </div>
      <div className={panel}>{numbers('Medidas')}</div>
      <div className={panel}>
        <Field label="Material"><Select value={c.material} onChange={value=>glass({material:value})} options={options([['artwork','Textura del modelo elegido'],['css','Cristal con color libre']])}/></Field>
        {numbers('Cristal')}{colors([['cardTint','Tinte del cristal'],['edgeColor','Bordes y reflejos'],['accentColor','Detalles e iconos de líneas'],['buttonColor','Botón destacado'],['buttonTextColor','Texto del botón destacado'],['sideButtonColor','Botones secundarios']])}
        <p className="text-xs opacity-65">La textura conserva el rosa y el dorado de la referencia. Para cambiar completamente su color, elige Cristal con color libre.</p>
      </div>
      <div className={panel}>
        <Field label="Fondo de la sección"><Select value={c.backgroundMode} onChange={value=>glass({backgroundMode:value})} options={options([['satin','Satén del modelo'],['inherit','Continuar fondo de la página'],['color','Color liso'],['image','Imagen personalizada']])}/></Field>
        {colors([['backgroundColor','Color de fondo']])}
        {c.backgroundMode==='image' && <>{(c.backgroundImage) && <button type="button" className="rounded-xl border px-3 py-2 text-xs" onClick={() => glass({backgroundImage:""})}>Quitar imagen</button>}<Field label="Subir fondo"><input type="file" accept="image/*" disabled={uploading||pending} onChange={e=>upload(e.target.files?.[0])}/></Field></>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{[['backgroundPositionX','Posición horizontal (%)',0,100],['backgroundPositionY','Posición vertical (%)',0,100],['backgroundZoom','Zoom del fondo (%)',100,180]].map(([key,label,min,max])=><Field key={key} label={label}><Input type="number" min={min} max={max} value={c[key]} onChange={e=>glass({[key]:Number(e.target.value)})}/></Field>)}</div>
      </div>
      <div className={panel}>
        {numbers('Tipografía')}{colors([['titleColor','Color de títulos'],['bodyColor','Color del texto']])}
        <Field label="Fuente de los títulos"><Select value={c.titleFont} onChange={value=>glass({titleFont:value})} options={[{value:'Georgia, serif',label:'Editorial de la referencia'},...INFO_FONT_OPTIONS]}/></Field>
        <Field label="Fuente de los textos"><Select value={c.bodyFont} onChange={value=>glass({bodyFont:value})} options={[{value:'Inter, system-ui, sans-serif',label:'Inter de la referencia'},...INFO_FONT_OPTIONS]}/></Field>
      </div>
      <div className={panel}><Field label="Composición móvil"><Select value={c.mobileLayout} onChange={value=>glass({mobileLayout:value})} options={options([['compact','Bloques compactos con icono lateral'],['cards','Tarjetas verticales']])}/></Field>{numbers('Móvil')}<p className="text-xs opacity-65">La composición compacta reduce el espacio vertical y da más espacio al contenido y a los botones. El contenido crece si hace falta, sin desplazamiento lateral.</p></div>
      <div className={panel}>
        <Field label="Animación de entrada"><Select value={c.entranceAnimation} onChange={value=>glass({entranceAnimation:value})} options={INFO_ANIMATION_OPTIONS}/></Field>
        <Field label="Al pasar el cursor"><Select value={c.hoverAnimation} onChange={value=>glass({hoverAnimation:value})} options={options([['none','Sin efecto'],['lift','Elevar y reflejar'],['tilt','Perspectiva suave'],['shine','Reflejo de cristal']])}/></Field>
        <Field label="Duración (ms)"><Input type="number" min={150} max={1600} value={c.animationDuration} onChange={e=>glass({animationDuration:Number(e.target.value)})}/></Field>
        <p className="text-xs opacity-65">Las animaciones respetan la preferencia de movimiento reducido del dispositivo.</p>
      </div>
    </SectionEditorCardTabs>}
  </div>;
}
