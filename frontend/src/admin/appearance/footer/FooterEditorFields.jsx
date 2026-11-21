import React, { useState } from 'react';

export function FooterField({label,children}) {return <label className="footer-editor__field"><span>{label}</span>{children}</label>;}
export function TextField({label,value,onChange,area=false,...props}) {
  const Tag=area?'textarea':'input';
  return <FooterField label={label}><Tag {...props} rows={area?2:undefined} value={value ?? ''} onChange={e=>onChange(e.target.value)}/></FooterField>;
}
export function NumberField({label,value,onChange,min,max}) {return <TextField label={label} type="number" min={min} max={max} value={value} onChange={value=>onChange(value===''?'':Number(value))}/>;}
export function RangeField({label,value,onChange,min=0,max=100}) {
  return <FooterField label={label}><div className="footer-editor__range"><input type="range" min={min} max={max} step={1} value={value} aria-label={label} aria-valuetext={value+' % de transparencia'} onChange={e=>onChange(Number(e.target.value))}/><output aria-hidden="true">{value}%</output></div></FooterField>;
}
export function SelectField({label,value,onChange,options}) {return <FooterField label={label}><select value={value} onChange={e=>onChange(e.target.value)}>{options.map(([key,text])=><option key={key} value={key}>{text}</option>)}</select></FooterField>;}
export function CheckField({label,checked,onChange}) {return <label className="footer-editor__check"><span>{label}</span><input type="checkbox" checked={!!checked} onChange={e=>onChange(e.target.checked)}/></label>;}
export function ImageField({label,value,onChange,onUpload,pending}) {
  return <div className="footer-editor__image"><strong>{label}</strong>{(value) && <button type="button" className="rounded-xl border px-3 py-2 text-xs" onClick={() => onChange("")}>Quitar imagen</button>}<FooterField label="Subir imagen"><input type="file" accept="image/*" disabled={pending} onChange={e=>{const file=e.currentTarget.files?.[0];e.currentTarget.value='';onUpload(file);}}/></FooterField></div>;
}
export function FooterLinkEditor({links,onChange}) {
  const [selected,setSelected]=useState(0), index=Math.max(0,Math.min(selected,links.length-1)), current=links[index];
  function patch(patch){onChange(links.map((link,i)=>i===index?{...link,...patch}:link));}
  function move(delta){const to=index+delta;if(to<0||to>=links.length)return;const next=[...links];[next[index],next[to]]=[next[to],next[index]];setSelected(to);onChange(next);}
  return <div className="footer-editor__links">
    <div className="footer-editor__actions"><strong>Enlaces</strong><button type="button" onClick={()=>{setSelected(links.length);onChange([...links,{label:'Nuevo enlace',href:'/'}]);}}>+ Agregar enlace</button></div>
    {current ? <>
      <SelectField label="Editar enlace" value={index} onChange={value=>setSelected(Number(value))} options={links.map((link,i)=>[i,(i+1)+'. '+(link.label || 'Sin título')])}/>
      <TextField label="Texto del enlace" value={current.label} onChange={value=>patch({label:value})}/>
      <TextField label="Destino del enlace" value={current.href} onChange={value=>patch({href:value})} placeholder="/ruta, #seccion o https://…"/>
      <CheckField label="Abrir en otra pestaña" checked={current.newTab} onChange={value=>patch({newTab:value})}/>
      <div className="footer-editor__actions"><button type="button" disabled={index===0} onClick={()=>move(-1)}>↑ Antes</button><button type="button" disabled={index===links.length-1} onClick={()=>move(1)}>Después ↓</button><button type="button" onClick={()=>{setSelected(Math.max(0,index-1));onChange(links.filter((_,i)=>i!==index));}}>Eliminar enlace</button></div>
    </>:<p>No hay enlaces. Agrega el primero para mostrarlo en la tienda.</p>}
  </div>;
}
