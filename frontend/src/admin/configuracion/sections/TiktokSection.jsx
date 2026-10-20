import React, { useEffect, useRef, useState } from 'react';
import { Link2, RefreshCw, ExternalLink, ShieldCheck } from 'lucide-react';
import api from '../../../lib/api';
import TiktokBrand from '../../../components/tiktok/TiktokBrand';
import TiktokQrConnection from './tiktok/TiktokQrConnection';
const BASE='/api/admin/tiktok-settings';
const blank={clientKey:'',clientSecret:'',redirectUri:'',enabled:false};
const button='inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-40';
const input='mt-1 w-full min-w-0 rounded-xl border bg-white px-3 py-2 text-sm text-neutral-900';
export default function TiktokSettingsSection() {
  const [data,setData]=useState(null),[draft,setDraft]=useState(blank),[tab,setTab]=useState('account');
  const [busy,setBusy]=useState(false),[waiting,setWaiting]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[message,setMessage]=useState('');
  const [qrWaiting,setQrWaiting]=useState(false);
  const mounted=useRef(true), popup=useRef(null),timer=useRef(null);
  const stop=()=>{clearInterval(timer.current);popup.current=null;if(mounted.current)setWaiting(false);};
  async function read(replace=false,quiet=false){
    if(!quiet)setLoading(true);
    try{const {data:result}=await api.get(BASE);if(!result?.settings||!Number.isInteger(result.settings.revision))throw new Error('INVALID_RESPONSE');if(!mounted.current)return;setData(result.settings);if(replace)setDraft({...blank,...result.settings,clientSecret:''});if(!quiet)setError('');return result.settings;}
    catch(e){if(mounted.current && !quiet)setError(e.response?.data?.message || (e.response?.status===404?'El backend todavía no tiene registrada la conexión de TikTok. Actualiza y reinicia el backend.':e.response?.status===403?'Tu usuario necesita permiso para administrar la conexión de TikTok.':'No se pudo cargar la configuración de TikTok.'));}
    finally{if(mounted.current && !quiet)setLoading(false);}
  }
  useEffect(()=>{mounted.current=true;read(true);return()=>{mounted.current=false;clearInterval(timer.current);};},[]);
  const dirty=Boolean(data && (['clientKey','redirectUri','enabled'].some(k=>draft[k]!==data[k])||draft.clientSecret));
  async function run(path,payload,success,method='post'){
    setBusy(true);setError('');setMessage('');
    try{const {data:result}=await api[method](BASE+path,payload,{timeout:45000});if(!mounted.current)return null;if(result.settings){setData(result.settings);setDraft({...blank,...result.settings,clientSecret:''});}setMessage(success);return result;}
    catch(e){if(mounted.current)setError(e.response?.data?.message || 'No se pudo completar la operación.');return null;}
    finally{if(mounted.current)setBusy(false);}
  }
  async function connect(){
    const win=window.open('about:blank','store-tiktok-connect','width=620,height=780');
    if(!win){setError('Permite abrir la ventana de TikTok y vuelve a intentar.');return;}
    popup.current=win;
    const result=await run('/authorize',{revision:data.revision},'Autoriza el acceso en la ventana de TikTok.');
    if(!result){win.close();popup.current=null;return;}
    win.location.href=result.url;const started=Date.now(),revision=data.revision;setWaiting(true);let checking=false;
    clearInterval(timer.current);timer.current=setInterval(async()=>{
      if(checking)return;
      if(Date.now()-started>10*60000){stop();setMessage('La autorización sigue pendiente. Puedes volver a conectar.');return;}
      checking=true;
      try{const current=await read(false,true);if(current && current.revision!==revision){stop();setDraft({...blank,...current,clientSecret:''});setMessage(current.connected?'Cuenta conectada. Ya puedes seleccionar sus videos en Apariencia → TikTok.':'La conexión cambió. Comprueba el estado.');}}
      finally{checking=false;}
    },3000);
  }
  function connectedQr(settings){if(!settings){read(true,true);return;}setData(settings);setDraft({...blank,...settings,clientSecret:''});setError('');setMessage('Cuenta conectada por QR. Ya puedes seleccionar sus videos en Apariencia → TikTok.');}
  const field=(label,key,type='text',placeholder='')=><label className="block text-sm font-medium">{label}<input className={input} aria-label={label} type={type} autoComplete="off" value={draft[key]} placeholder={placeholder} disabled={busy||waiting||qrWaiting} onChange={e=>setDraft(d=>({...d,[key]:e.target.value}))}/></label>;
  return <div className="space-y-4" style={{color:'var(--admin-card-text,#29202a)'}}>
    <header className="rounded-2xl border p-5" style={{background:'var(--admin-card-bg,white)'}}><TiktokBrand/><h1 className="mt-3 text-xl font-semibold">Conexión de la cuenta</h1><p className="text-sm opacity-70">Perfil y videos públicos para la sección de la tienda.</p></header>
    {!data ? <section className="rounded-2xl border p-5">{loading?<p role="status">Cargando configuración de TikTok…</p>:<button className={button} onClick={()=>read(true)}>Volver a intentar</button>}</section>:<>
      <nav className="flex flex-wrap gap-2" aria-label="Ajustes de TikTok">{[['account','Cuenta'],['credentials','Credenciales'],['help','Cómo conectar']].map(([id,label])=><button type="button" className={button} key={id} aria-pressed={id===tab} onClick={()=>setTab(id)} style={id===tab?{background:'var(--admin-primary,#790d2d)',color:'white'}:{}}>{label}</button>)}</nav>
      <section className="rounded-2xl border p-4 md:p-6 space-y-4" style={{background:'var(--admin-card-bg,white)'}}>
        {tab==='account' && <>
          <div className="flex items-center gap-4">{data.account?.avatar && <img className="h-16 w-16 rounded-full object-cover" src={data.account.avatar} alt="Foto de perfil de TikTok"/>}<div><h2 className="font-semibold">{data.account?.name || 'Tu cuenta de TikTok'}</h2><p className="text-sm opacity-70">{data.connected?data.enabled?'Conectada y disponible para la tienda':'Conectada · publicación pausada':'Pendiente de conectar'}</p></div></div>
          {data.lastError&&<p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950">{data.lastError}</p>}
          {!data.encryptionReady&&<p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950">El servidor necesita TIKTOK_ENCRYPTION_KEY de al menos 32 caracteres para proteger las credenciales. Si ya configuraste INSTAGRAM_ENCRYPTION_KEY o MAIL_ENCRYPTION_KEY con esa longitud, se puede reutilizar.</p>}
          <TiktokQrConnection revision={data.revision} connected={data.connected} disabled={busy||waiting||dirty||!data.encryptionReady||!data.clientKey||!data.hasClientSecret} onWaiting={setQrWaiting} onConnected={connectedQr}/>
          <div className="flex flex-wrap gap-2"><button className={button} onClick={()=>setTab('credentials')}>Configurar credenciales</button><button className={button} disabled={busy||qrWaiting} onClick={()=>read(false)}>Comprobar estado</button>
            {data.connected&&<><button className={button} disabled={busy||waiting||qrWaiting||dirty} onClick={()=>run('/sync',{},'Perfil y videos actualizados.')}><RefreshCw size={16}/>Actualizar videos</button><button className={button} disabled={busy||waiting||qrWaiting||dirty} onClick={()=>run('/disconnect',{revision:data.revision},'Cuenta desconectada. Los videos manuales se conservan.')}>Desconectar</button></>}
            {waiting&&<button className={button} onClick={()=>{stop();setMessage('Espera detenida. Puedes volver a conectar.');}}>Dejar de esperar</button>}
          </div>
          <details className="rounded-xl border p-3"><summary className="cursor-pointer text-sm font-medium">Otra opción: autorización en una ventana web</summary><p className="my-3 text-xs opacity-70">Este método requiere una URL HTTPS de retorno configurada. Para trabajar desde tu PC usa el QR.</p><button className={button} disabled={busy||waiting||qrWaiting||dirty||!data.encryptionReady||!data.clientKey||!data.hasClientSecret||!data.redirectUri} onClick={connect}><Link2 size={17}/>Conectar con TikTok en ventana web</button></details>
          {dirty&&<p className="text-sm">Guarda los cambios en Credenciales antes de conectar.</p>}
          {data.connected&&<p className="text-xs opacity-70">Última actualización: {data.syncedAt?new Date(data.syncedAt).toLocaleString('es-CO'):'Pendiente'}. El servidor renueva el acceso al consultar los videos mientras la autorización siga vigente.</p>}
          <a className={button} href="/admin/apariencia">Elegir videos y editar diseño <ExternalLink size={16}/></a>
        </>}
        {tab==='credentials'&&<form className="space-y-4" onSubmit={e=>{e.preventDefault();run('',{revision:data.revision,clientKey:draft.clientKey,clientSecret:draft.clientSecret,redirectUri:draft.redirectUri,enabled:draft.enabled},'Ajustes guardados. Ya puedes conectar la cuenta.','put');}}>
          <h2 className="font-semibold">App de TikTok for Developers</h2><div className="grid gap-4 md:grid-cols-2">{field('Client Key','clientKey','text','Clave de tu app')}{field('Client Secret','clientSecret','password',data.hasClientSecret?'Guardado · vacío para conservarlo':'Secreto de tu app')}</div>
          <p className="text-sm opacity-75">Para conectar por QR basta guardar estas dos credenciales y volver a Cuenta.</p>
          <details className="rounded-xl border p-3"><summary className="cursor-pointer text-sm font-medium">URL de retorno · solo para conexión en ventana web</summary><div className="mt-3 space-y-2">{field('URL de retorno del backend','redirectUri','url','https://api.tutienda.com/api/tiktok/callback')}<p className="text-xs opacity-70">Opcional para iniciar el QR. Para autorización web usa el dominio HTTPS permanente del backend y registra la misma URL en Login Kit → Web → Redirect URI.</p></div></details>
          <label className="flex gap-2 items-center text-sm"><input type="checkbox" checked={draft.enabled} disabled={busy||waiting} onChange={e=>setDraft(d=>({...d,enabled:e.target.checked}))}/>Permitir mostrar la cuenta conectada en la tienda</label>
          <div className="sticky bottom-0 border-t pt-3" style={{background:'var(--admin-card-bg,white)'}}><button className={button} type="submit" disabled={busy||waiting||!dirty||!data.encryptionReady}>{busy?'Guardando…':'Guardar ajustes'}</button></div>
          <p className="flex items-center gap-2 text-xs opacity-70"><ShieldCheck size={17}/>Secreto y tokens cifrados en el servidor. No se incluyen en la apariencia pública.</p>
        </form>}
        {tab==='help'&&<><h2 className="font-semibold">Conectar desde tu PC con un QR</h2><ol className="list-decimal pl-5 space-y-3 text-sm"><li>En TikTok for Developers configura tu app con Login Kit y Display API. Necesita los permisos <code>user.info.basic</code> y <code>video.list</code>, y su aprobación o acceso de prueba autorizado.</li><li>Copia Client Key y Client Secret del mismo entorno en Credenciales y pulsa Guardar ajustes. Puedes dejar vacía la URL de retorno para iniciar el QR.</li><li>En Cuenta pulsa Generar QR de TikTok, escanéalo con TikTok en tu teléfono y confirma los permisos. Mantén el panel abierto hasta que indique Cuenta conectada.</li><li>En Apariencia → TikTok → Videos elige cuáles mostrar, el orden y el principal.</li></ol><p className="text-sm">La conexión por QR se comprueba desde el servidor; no abre una URL de tu PC en el teléfono. TikTok debe habilitar el acceso de tu app y de la cuenta. Solo se importan videos públicos. No se pide la contraseña de tu cuenta.</p><a className={button} href="https://developers.tiktok.com/docs/en/login-kit-qr-code-authorization" target="_blank" rel="noopener noreferrer">Guía oficial del QR <ExternalLink size={16}/></a></>}
      </section>
    </>}
    {message&&<p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">{message}</p>}{error&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">{error}</p>}
  </div>;
}
