import React, { useContext, useEffect, useRef, useState } from 'react';
import { TiktokEditorFeed, TiktokEditorFeedProvider } from '../../../../components/tiktok/TiktokEditorFeed';
import { Button } from '../ui/UiComponents';
import SectionEditorSteps from '../ui/SectionEditorSteps';
import SectionEditorCardTabs from '../ui/SectionEditorCardTabs';
import SectionEditorSubgroups from '../ui/SectionEditorSubgroups';
import SectionEditorPostPicker from '../ui/SectionEditorPostPicker';
import { JournalText as Text, JournalNumber as Num, JournalSelect as Select, JournalCheck as Check, JournalColor as Color } from '../instagram/JournalFields';
import { normalizeTiktokSection } from './tiktokSectionHelpers';
import { normalizeStage, safeTiktokLink, safeStageAsset } from './tiktokStageHelpers';
import TiktokConnectedPosts from './TiktokConnectedPosts';
const find = theme => normalizeTiktokSection(theme?.sections?.find(s=>s.id==='tiktok'||s.type==='tiktok'));
const box='rounded-2xl border border-neutral-200 bg-white p-4 space-y-4';
function Editor({theme,setPath,uploadToCloudinary,uploading=false}) {
  const [step,setStep]=useState('content'),[active,setActive]=useState(0),[pending,setPending]=useState(false),[error,setError]=useState('');
  const latest=useRef();latest.current={theme,setPath};
  const mounted=useRef(true);useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  const section=find(theme), c=section.config,s=normalizeStage(c), posts=c.posts || [], feed=useContext(TiktokEditorFeed);
  function mutate(edit){const current=latest.current;let found=false;const next=edit(find(current.theme));const sections=(current.theme.sections || []).map(item=>{if(item.id==='tiktok'||item.type==='tiktok'){found=true;return next;}return item;});if(!found)sections.push(next);current.setPath?.('sections',sections);}
  const patch=(key,value)=>mutate(item=>({...item,config:{...item.config,...normalizeStage(item.config),[key]:value}}));
  const patchPost=(id,key,value)=>mutate(item=>({...item,config:{...item.config,posts:item.config.posts.map(p=>p.id===id?{...p,[key]:value}:p)}}));
  const text=(label,key,multiline=false)=><Text {...{label,multiline}} value={s[key]} onChange={v=>patch(key,v)}/>;
  const num=(label,key,min,max,increment=1)=><Num {...{label,min,max}} step={increment} value={s[key]} onChange={v=>patch(key,v)}/>;
  const check=(label,key)=><Check {...{label}} value={s[key]} onChange={v=>patch(key,v)}/>;
  const color=(label,key)=><Color {...{label}} value={s[key]} onChange={v=>patch(key,v)}/>;
  async function upload(file,key,id){if(!file)return;setError('');if(!/^image\/(png|jpeg|webp|avif)$/.test(file.type)){setError('Usa una imagen PNG, JPG, WEBP o AVIF.');return;}if(!uploadToCloudinary){setError('Puedes pegar la URL de la imagen.');return;}setPending(true);try{const url=await uploadToCloudinary(file);if(mounted.current){if(typeof url!=='string'||!url)throw new Error('No se recibió la imagen.');id?patchPost(id,key,url):patch(key,url);}}catch(e){if(mounted.current)setError(e.message || 'No se pudo subir la imagen.');}finally{if(mounted.current)setPending(false);}}
  const image=(label,key,value,id)=><div className="space-y-2"><Text label={label} value={value || ''} onChange={v=>id?patchPost(id,key,v):patch(key,v)}/><label className="inline-flex rounded-lg border p-2 cursor-pointer text-sm">Subir imagen<input className="hidden" type="file" aria-label={`Subir ${label.toLowerCase()}`} accept="image/png,image/jpeg,image/webp,image/avif" disabled={pending||uploading} onChange={e=>{upload(e.target.files?.[0],key,id);e.target.value='';}}/></label>{value && safeStageAsset(value) && <img src={value} alt={label} className="max-h-28 rounded-lg object-contain"/>}</div>;
  const move=(index,delta)=>{const next=[...posts];[next[index],next[index+delta]]=[next[index+delta],next[index]];patch('posts',next);setActive(index+delta);};
  const shownIndex=Math.max(0,Math.min(active,posts.length-1));
  return <div className="space-y-4" style={{color:'var(--admin-card-text,#29202a)'}}>
    <p className="text-sm">Escenario de videos · cristal. Elige el video central y organiza la lista lateral. Los cambios se muestran en la vista previa.</p>
    <SectionEditorSteps value={step} onChange={setStep} sectionName="TikTok" items={[{value:'content',label:'Contenido',hint:'Cuenta, textos y selección de videos.'},{value:'design',label:'Diseño',hint:'Fondo, distribución, cristal y adaptación móvil.'}]}/>
    <div hidden={step!=='content'}><SectionEditorCardTabs label="Contenido de TikTok" labels={['Cuenta','Textos','Videos']}>
      <div className={box}>
        <Select label="Origen de los videos" value={s.stageSource} options={[["manual","Videos y enlaces manuales"],["connected","Cuenta de TikTok conectada"]]} onChange={v=>patch('stageSource',v)}/>
        <div className="rounded-xl border p-3 space-y-2"><strong>{feed?.connected?feed.account?.name || 'Cuenta conectada':'Conecta tu cuenta de TikTok'}</strong><p className="text-xs">La conexión y sus credenciales se administran en Configuración → TikTok. Aquí eliges qué videos mostrar.</p><a className="inline-flex rounded-lg border p-2 text-sm underline" href="/admin/configuracion/tiktok" target="_blank" rel="noopener noreferrer">Abrir conexión de TikTok ↗</a><Button kind="outline" onClick={feed?.refresh} disabled={!feed || feed.loading}>Comprobar conexión</Button></div>
        {check('Usar nombre y foto de la cuenta conectada','stageUseAccount')}
        <SectionEditorSubgroups label="Personalizar perfil" labels={['Identidad','Imagen']}>
          <div className="space-y-3">{text('Nombre del perfil','stageProfileName')}{text('Usuario del perfil','stageProfileUser')}<Text label="Enlace del perfil" value={s.stageProfileLink || c.profileLink || ''} placeholder="https://www.tiktok.com/@tuusuario" onChange={v=>patch('stageProfileLink',v)}/><p className="text-xs">El permiso básico de TikTok entrega nombre y avatar. Completa el usuario y el enlace si la cuenta no los entrega.</p></div>
          <div>{image('Avatar personalizado','stageAvatar',s.stageAvatar)}</div>
        </SectionEditorSubgroups>
        <Check label="Mostrar sección en la tienda" value={section.enabled!==false} onChange={v=>mutate(item=>({...item,enabled:v}))}/>
      </div>
      <div className={box}><SectionEditorSubgroups label="Textos de TikTok" labels={['Encabezados','Botones']}>
        <div className="space-y-3">{text('Título principal','stageTitle',true)}{text('Subtítulo','stageSubtitle')}{text('Texto superior opcional','stageEyebrow')}{text('Título de la lista lateral','stageListTitle')}</div>
        <div className="space-y-3">{text('Texto del botón del perfil','stageFollowText')}{text('Texto del enlace de cada video','stageVideoText')}</div>
      </SectionEditorSubgroups></div>
      <div className={box}>
        <TiktokConnectedPosts config={c} onChange={partial=>mutate(item=>({...item,config:{...item.config,...partial}}))}/>
        {s.stageSource==='manual' && <div className="space-y-4">
          <div className="flex items-center justify-between gap-2"><strong>Videos manuales</strong><Button disabled={pending} onClick={()=>{patch('posts',[...posts,{id:globalThis.crypto?.randomUUID?.() || `video_${Date.now()}`,image:'',title:'',link:'',videoUrl:'',enabled:true}]);setActive(posts.length);}}>Agregar video</Button></div>
          <SectionEditorPostPicker posts={posts} activeIndex={shownIndex} onSelect={setActive} label="TikTok"/>
          {posts.map((p,index)=><div key={p.id} hidden={index!==shownIndex} className="space-y-4 rounded-xl bg-neutral-50 p-3">
            <div className="flex flex-wrap gap-2"><Button kind="outline" disabled={index===0} onClick={()=>move(index,-1)}>Mover antes</Button><Button kind="outline" disabled={index===posts.length-1} onClick={()=>move(index,1)}>Mover después</Button><Button kind="outline" onClick={()=>{patch('posts',posts.filter(item=>item.id!==p.id));setActive(Math.max(0,index-1));}}>Eliminar</Button></div>
            <SectionEditorSubgroups label="Editar video" labels={['Video y portada','Presentación']}>
              <div className="space-y-3"><Text label="Enlace del video de TikTok" value={p.link||''} placeholder="https://www.tiktok.com/@usuario/video/…" onChange={v=>patchPost(p.id,'link',v)}/>{p.link && !safeTiktokLink(p.link) && <p role="alert" className="text-xs">Usa el enlace completo de www.tiktok.com, no el enlace corto de compartir.</p>}<Text label="Archivo de video propio (opcional)" value={p.videoUrl||''} placeholder="https://…/video.mp4" onChange={v=>patchPost(p.id,'videoUrl',v)}/>{image('Portada del video','image',p.image,p.id)}<p className="text-xs">El enlace completo usa el reproductor oficial. Un archivo propio permite reproducción directa. Añade una portada para mostrarla antes de pulsar play.</p></div>
              <div className="space-y-3"><Text label="Título del video" value={p.title||p.caption||''} onChange={v=>patchPost(p.id,'title',v)}/><Num label="Encuadre horizontal (%)" value={p.positionX ?? 50} min={0} max={100} onChange={v=>patchPost(p.id,'positionX',v)}/><Num label="Encuadre vertical (%)" value={p.positionY ?? 50} min={0} max={100} onChange={v=>patchPost(p.id,'positionY',v)}/><Check label="Mostrar este video" value={p.enabled!==false} onChange={v=>patchPost(p.id,'enabled',v)}/><Button kind="outline" onClick={()=>mutate(item=>({...item,config:{...item.config,stageFeaturedId:p.id,stageFeaturedAccount:'',posts:item.config.posts.map(post=>post.id===p.id?{...post,enabled:true}:post)}}))}>{s.stageFeaturedId===p.id?'Video principal':'Usar como principal'}</Button></div>
            </SectionEditorSubgroups>
          </div>)}
        </div>}
      </div>
    </SectionEditorCardTabs></div>
    <div hidden={step!=='design'}><SectionEditorCardTabs label="Diseño de TikTok" labels={['Fondo','Distribución','Tipografía','Cristal','Animaciones','Móvil','Visibilidad']}>
      <div className={box}><Select label="Fondo de la sección" value={s.stageBackgroundMode} options={[["included","Satén floral incluido"],["continuity","Continuar fondo de las demás secciones"],["custom","Imagen propia"],["color","Color sólido"],["global","Fondo global"]]} onChange={v=>patch('stageBackgroundMode',v)}/>{s.stageBackgroundMode==='custom'&&image('Imagen de fondo','stageBackgroundImage',s.stageBackgroundImage)}{color('Color de fondo','stageBackgroundColor')}{num('Velo de color (%)','stageBackgroundWash',0,100)}</div>
      <div className={box}><SectionEditorSubgroups label="Distribución de TikTok" labels={['Ancho y espacios','Video central','Lista lateral']}>
        <div className="space-y-3">{num('Ancho máximo (px)','stageMaxWidth',900,2200)}{num('Margen horizontal (px)','stagePaddingX',0,120)}{num('Margen vertical (px)','stagePaddingY',0,120)}{num('Separación entre columnas (px)','stageGap',12,60)}{num('Ancho de la columna de texto (%)','stageLeftWidth',20,36)}{num('Ancho de la lista lateral (%)','stageRightWidth',26,42)}</div>
        <div className="space-y-3">{num('Altura máxima del video (px)','stageVideoHeight',360,1000)}<Select label="Encuadre del video" value={s.stageFit} options={[["cover","Llenar el contenedor"],["contain","Mostrar el archivo completo"]]} onChange={v=>patch('stageFit',v)}/>{check('Restablecer el principal al volver a la sección','stageResetOnEnter')}{check('Iniciar sin sonido','stageMuted')}{check('Repetir video al terminar','stageLoop')}</div>
        <div className="space-y-3">{num('Videos por página lateral','stageListSize',1,6)}<p className="text-xs">La principal y el orden se eligen en Contenido → Videos.</p></div>
      </SectionEditorSubgroups></div>
      <div className={box}><Select label="Tipografía" value={s.stageFont} options={[["Georgia, serif","Georgia"],["'Bodoni Moda', Georgia, serif","Bodoni"],["Arial, sans-serif","Arial"]]} onChange={v=>patch('stageFont',v)}/>{num('Tamaño del título (px)','stageTitleSize',28,120)}{num('Tamaño del texto (px)','stageTextSize',14,30)}{color('Color del texto','stageInk')}{color('Color de los detalles','stageAccent')}{color('Color del botón','stageButtonColor')}{color('Texto del botón','stageButtonText')}</div>
      <div className={box}><SectionEditorSubgroups label="Acabado de cristal" labels={['Transparencia','Profundidad']}>
        <div className="space-y-3">{color('Tinte del cristal','stageGlassColor')}{num('Opacidad del cristal (%)','stageGlassOpacity',0,90)}{num('Desenfoque del cristal (px)','stageBlur',0,24)}{num('Intensidad del reflejo (%)','stageReflection',0,100)}{num('Textura del cristal (%)','stageTexture',0,30)}</div>
        <div className="space-y-3">{num('Grosor del canto (px)','stageDepth',0,14)}{num('Intensidad de sombra (%)','stageShadow',0,50)}{num('Esquinas redondeadas (px)','stageRadius',0,48)}</div>
      </SectionEditorSubgroups></div>
      <div className={box}>{check('Activar animaciones','stageMotionEnabled')}<Select label="Transición del video principal" value={s.stageMotion} options={[["fade","Fundido"],["glide","Deslizamiento suave"],["focus","Enfoque progresivo"],["zoom","Acercamiento sutil"],["none","Sin transición"]]} onChange={v=>patch('stageMotion',v)}/>{num('Duración de la transición (ms)','stageMotionDuration',150,1000,10)}<Select label="Efecto al pasar el cursor" value={s.stageHover} options={[["light","Luz sobre el cristal"],["lift","Elevación suave"],["zoom","Acercamiento de portada"],["none","Sin efecto"]]} onChange={v=>patch('stageHover',v)}/><p className="text-xs">La transición ocurre dentro del reproductor. Se respeta el movimiento reducido del dispositivo.</p></div>
      <div className={box}>{num('Tamaño del título en móvil (px)','stageMobileTitleSize',24,64)}{num('Margen horizontal en móvil (px)','stageMobilePadding',8,32)}{num('Altura máxima del video en móvil (px)','stageMobileVideoHeight',300,850)}<p className="text-xs">En móvil el encabezado, video y lista se apilan sin desplazamiento horizontal.</p></div>
      <div className={box}>{[['Logo de TikTok','stageShowBrand'],['Perfil','stageShowProfile'],['Foto del perfil','stageShowAvatar'],['Título','stageShowTitle'],['Subtítulo','stageShowSubtitle'],['Botón del perfil','stageShowFollow'],['Lista lateral','stageShowList'],['Controles del reproductor','stageShowControls'],['Tiempo del video','stageShowDuration']].map(([label,key])=><React.Fragment key={key}>{check(`Mostrar ${label.toLowerCase()}`,key)}</React.Fragment>)}</div>
    </SectionEditorCardTabs></div>
    {pending&&<p role="status">Subiendo imagen…</p>}{error&&<p role="alert">{error}</p>}
  </div>;
}
export default function TiktokStageUI(props) {
  const context=useContext(TiktokEditorFeed);
  return context ? <Editor {...props}/> : <TiktokEditorFeedProvider enabled><Editor {...props}/></TiktokEditorFeedProvider>;
}
