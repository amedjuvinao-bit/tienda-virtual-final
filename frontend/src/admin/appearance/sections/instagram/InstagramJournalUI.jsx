import React, { useEffect, useRef, useState } from 'react';
import { Button } from '../ui/UiComponents';
import SectionEditorSteps from '../ui/SectionEditorSteps';
import SectionEditorCardTabs from '../ui/SectionEditorCardTabs';
import SectionEditorSubgroups from '../ui/SectionEditorSubgroups';
import SectionEditorPostPicker from '../ui/SectionEditorPostPicker';
import { normalizeInstagramSection } from './instagramSectionHelpers';
import { normalizeJournal, journalPosts, journalHighlights, safeJournalVideo } from './instagramJournalHelpers';
import { photoCrop, safeInstagramLink } from './instagramEditorialHelpers';
import { JournalText as Text, JournalNumber as Num, JournalSelect as Select, JournalCheck as Check, JournalColor as Color } from './JournalFields';

const find = theme => normalizeInstagramSection(theme?.sections?.find(s => s?.id === 'instagram' || s?.type === 'instagram'));
const box = 'rounded-2xl border border-neutral-200 bg-white p-4 space-y-4';
const uid = prefix => globalThis.crypto?.randomUUID?.() || `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
export default function InstagramJournalUI({ theme, setPath, uploadToCloudinary, uploading = false }) {
  const [step, setStep] = useState('content');
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [active, setActive] = useState(0);
  const [activeHighlight, setActiveHighlight] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const latest = useRef(); latest.current = { theme, setPath };
  const section = find(theme), c = section.config, j = normalizeJournal(c), posts = c.posts;
  const available = journalPosts(posts, j.journalLimit);
  const highlightsFor = config => Array.isArray(config.journalHighlights) ? config.journalHighlights : journalHighlights(config, journalPosts(config.posts, normalizeJournal(config).journalLimit));
  const highlights = highlightsFor(c);
  function mutate(edit) {
    const { theme: current, setPath: save } = latest.current;
    const next = edit(find(current));
    let found = false;
    const sections = (current?.sections || []).map(s => {
      if (s.id === 'instagram' || s.type === 'instagram') { found = true; return next; }
      return s;
    });
    if (!found) sections.push(next);
    save?.('sections', sections);
  }
  const patch = (key, value) => mutate(s => ({ ...s, config: { ...s.config, ...normalizeJournal(s.config), [key]: value } }));
  const patchPost = (id, key, value) => mutate(s => ({ ...s, config: { ...s.config, posts: s.config.posts.map(p => p.id === id ? { ...p, [key]: value } : p) } }));
  const patchHighlight = (id, key, value) => mutate(s => ({ ...s, config: { ...s.config, journalHighlights: highlightsFor(s.config).map(h => h.id === id ? { ...h, [key]: value } : h) } }));
  async function upload(file, key, target) {
    if (!file) return;
    setError('');
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/avif'].includes(file.type)) { setError('Usa una imagen PNG, JPG, WEBP o AVIF.'); return; }
    if (typeof uploadToCloudinary !== 'function') { setError('No se pudo iniciar la carga. Puedes pegar la URL de la imagen.'); return; }
    setPending(true);
    try {
      const url = await uploadToCloudinary(file);
      if (!mounted.current) return;
      if (typeof url !== 'string' || !url) throw new Error('No se recibió la imagen. Intenta nuevamente.');
      if (target?.post) patchPost(target.post, key, url);
      else if (target?.highlight) patchHighlight(target.highlight, key, url);
      else patch(key, url);
    } catch (err) { if (mounted.current) setError(err.message || 'No se pudo subir la imagen.'); }
    finally { if (mounted.current) setPending(false); }
  }
  const image = (label, key, value, target) => {
    const change = v => target?.post ? patchPost(target.post, key, v) : target?.highlight ? patchHighlight(target.highlight, key, v) : patch(key, v);
    return <div><Text label={label} value={value || ''} placeholder="https://… o /imagen.webp" onChange={change} />
      <label className="inline-flex mt-2 cursor-pointer rounded-lg border p-2 text-sm">{pending ? 'Subiendo…' : 'Subir imagen'}<input type="file" className="hidden" aria-label={`Subir ${label.toLowerCase()}`} accept="image/png,image/jpeg,image/webp,image/avif" disabled={pending || uploading} onChange={e => { upload(e.target.files?.[0], key, target); e.target.value = ''; }} /></label>
      {value && <img src={value} alt={label} className="mt-2 max-h-28 max-w-full rounded-lg object-contain" />}
    </div>;
  };
  const text = (label, key) => <Text {...{ label }} value={j[key]} onChange={v => patch(key, v)} />;
  const num = (label, key, min, max, step = 1) => <Num {...{ label, min, max, step }} value={j[key]} onChange={v => patch(key, v)} />;
  const color = (label, key) => <Color {...{ label }} value={j[key]} onChange={v => patch(key, v)} />;
  const check = (label, key) => <Check {...{ label }} value={j[key]} onChange={v => patch(key, v)} />;
  const postOptions = [['', 'Automática'], ...available.map((p, i) => [p.id, p.alt || `Publicación ${i + 1}`])];
  function addPost() {
    patch('posts', [...posts, { id: uid('post'), image: '', link: '', enabled: true, kind: 'photo' }]); setActive(posts.length);
  }
  function movePost(index, delta) {
    const next = [...posts]; [next[index], next[index + delta]] = [next[index + delta], next[index]];
    patch('posts', next); setActive(index + delta);
  }
  return <div className="space-y-4">
    <p className="text-sm text-neutral-600">Diario social · Fotos y enlaces administrados desde aquí. Cada publicación conserva su enlace de Instagram; las guardadas se almacenan en el navegador del visitante.</p>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <SectionEditorSteps value={step} onChange={setStep} sectionName="Instagram" items={[{ value: 'content', label: 'Contenido', hint: 'Edita un elemento a la vez.' }, { value: 'design', label: 'Diseño', hint: 'Ajusta un grupo y comprueba la vista previa.' }]} />
    <div hidden={step !== 'content'} data-editor-step="content">
      <SectionEditorCardTabs label="Contenido de Instagram" labels={['Perfil', 'Textos', 'Publicaciones', 'Destacados']}>
        <div className={box}>
          <SectionEditorSubgroups label="Editar perfil" labels={['Cuenta', 'Identidad']}>
            <div className="space-y-3"><Text label="Usuario de Instagram" value={c.profileUser || ''} placeholder="@rosaboutique33" onChange={v => patch('profileUser', v)} /><Text label="Enlace del perfil" value={c.profileLink} placeholder="https://instagram.com/tuusuario" onChange={v => patch('profileLink', v)} />
              {c.profileLink && !safeInstagramLink(c.profileLink) && <p role="alert">Escribe un enlace completo que empiece por https://.</p>}
              <Check label="Mostrar sección en la tienda" value={section.enabled !== false} onChange={v => mutate(s => ({ ...s, enabled: v }))} /></div>
            <div className="space-y-3">{text('Nombre de la tienda en publicaciones', 'journalName')}{text('Iniciales del avatar', 'journalMonogram')}{image('Avatar de la cuenta', 'journalAvatarImage', j.journalAvatarImage)}</div>
          </SectionEditorSubgroups>
        </div>
        <div className={box}><SectionEditorSubgroups label="Editar textos" labels={['Encabezados', 'Botones']}>
          <div className="space-y-3">{text('Título del diario', 'journalTitle')}{text('Título del panel lateral', 'journalSidebarTitle')}{text('Frase inferior', 'journalSubtitle')}</div>
          <div className="space-y-3">{text('Texto del botón del perfil', 'journalFollowText')}{text('Texto del enlace de publicación', 'journalPostText')}</div>
        </SectionEditorSubgroups></div>
        <div className={box}>
          <div className="flex items-center justify-between gap-2"><strong>Publicaciones</strong><Button onClick={addPost} disabled={pending || uploading}>Agregar publicación</Button></div>
          <SectionEditorPostPicker posts={posts} activeIndex={Math.max(0, Math.min(active, posts.length - 1))} onSelect={setActive} label="Instagram" />
          {posts.map((p, index) => { const crop = photoCrop(p); return <div key={p.id} className="rounded-2xl bg-neutral-50 p-3 space-y-3" hidden={index !== Math.max(0, Math.min(active, posts.length - 1))}>
            <strong>Publicación {index + 1}</strong>
            <div className="flex flex-wrap gap-2"><Button kind="outline" disabled={index === 0 || pending} onClick={() => movePost(index, -1)}>Mover antes</Button><Button kind="outline" disabled={index === posts.length - 1 || pending} onClick={() => movePost(index, 1)}>Mover después</Button><Button kind="outline" disabled={pending} onClick={() => { patch('posts', posts.filter(post => post.id !== p.id)); setActive(Math.max(0, index - 1)); }}>Eliminar</Button></div>
            <SectionEditorSubgroups label="Configurar esta publicación" labels={['Imagen y enlace', 'Texto y reel', 'Encuadre']}>
              <div className="space-y-3">{image('Imagen de la publicación', 'image', p.image, { post: p.id })}
                <Text label="Enlace de la publicación" value={p.link || ''} placeholder="https://instagram.com/p/xxxx" onChange={v => patchPost(p.id, 'link', v)} />
                {(!p.link || !safeInstagramLink(p.link)) && <p className="text-xs text-amber-800">La foto se mostrará, pero el enlace a Instagram solo aparece al escribir una URL válida.</p>}
                <Text label="Descripción de la foto" value={p.alt || ''} onChange={v => patchPost(p.id, 'alt', v)} />
                <Check label="Mostrar publicación" value={p.enabled !== false} onChange={v => patchPost(p.id, 'enabled', v)} />
              </div>
              <div className="space-y-3"><Text label="Texto de la publicación" value={p.caption || ''} multiline onChange={v => patchPost(p.id, 'caption', v)} />
                <Select label="Tipo de publicación" value={p.kind || (/\/reels?\//i.test(p.link || '') ? 'reel' : 'photo')} onChange={v => patchPost(p.id, 'kind', v)} options={[["photo", 'Fotografía'], ['reel', 'Reel']]} />
                <Text label="URL del archivo de video (opcional)" value={p.videoUrl || ''} placeholder="https://…/video.mp4" onChange={v => patchPost(p.id, 'videoUrl', v)} />
                {p.videoUrl && !safeJournalVideo(p.videoUrl) && <p role="alert">Escribe una URL válida del archivo de video.</p>}
                <p className="text-xs">Un enlace de reel de Instagram abre Instagram. Para reproducirlo aquí, agrega la URL directa de un video propio.</p>
              </div>
              <div className="space-y-3"><Select label="Ajuste de la foto" value={p.imageFit || 'cover'} onChange={v => patchPost(p.id, 'imageFit', v)} options={[["cover", 'Llenar marco y recortar'], ['contain', 'Ver foto completa']]} />
                {image('Imagen alternativa para móvil', 'mobileImage', p.mobileImage, { post: p.id })}
                <Num label="Encuadre horizontal (%)" value={crop.x} min={0} max={100} onChange={v => patchPost(p.id, 'imagePositionX', v)} />
                <Num label="Encuadre vertical (%)" value={crop.y} min={0} max={100} onChange={v => patchPost(p.id, 'imagePositionY', v)} />
                <Num label="Acercamiento" value={crop.zoom} min={1} max={2} step={.01} onChange={v => patchPost(p.id, 'imageScale', v)} />
              </div>
            </SectionEditorSubgroups>
          </div>; })}
        </div>
        <div className={box}>
          <div className="flex items-center justify-between gap-2"><strong>Destacados</strong><Button disabled={highlights.length >= 8 || pending} onClick={() => { patch('journalHighlights', [...highlights, { id: uid('highlight'), title: '', image: '', postId: available[0]?.id || '', enabled: true }]); setActiveHighlight(highlights.length); }}>Agregar destacado</Button></div>
          <p className="text-xs">Cada círculo muestra en grande la publicación que elijas. La imagen del círculo puede ser distinta a la publicación.</p>
          <SectionEditorPostPicker posts={highlights.map(h => ({ ...h, image: h.image || available.find(p => p.id === h.postId)?.image }))} activeIndex={Math.max(0, Math.min(activeHighlight, highlights.length - 1))} onSelect={setActiveHighlight} label="Instagram" itemName="destacado" />
          {highlights.map((h, i) => <div key={h.id} className="space-y-3" hidden={i !== Math.max(0, Math.min(activeHighlight, highlights.length - 1))}>
            <Text label="Nombre del destacado" value={h.title || ''} onChange={v => patchHighlight(h.id, 'title', v)} />
            <Select label="Publicación del destacado" value={h.postId || ''} onChange={v => patchHighlight(h.id, 'postId', v)} options={[["", 'Seleccionar publicación'], ...postOptions.slice(1)]} />
            {!available.some(p => p.id === h.postId) && <p className="text-xs text-amber-800">Selecciona una publicación visible para que este destacado aparezca en la tienda.</p>}
            {image('Imagen del destacado (opcional)', 'image', h.image, { highlight: h.id })}
            <Check label="Mostrar destacado" value={h.enabled !== false} onChange={v => patchHighlight(h.id, 'enabled', v)} />
            <div className="flex flex-wrap gap-2"><Button kind="outline" disabled={i === 0 || pending} onClick={() => { const next = [...highlights]; [next[i], next[i - 1]] = [next[i - 1], next[i]]; patch('journalHighlights', next); setActiveHighlight(i - 1); }}>Mover antes</Button><Button kind="outline" disabled={i === highlights.length - 1 || pending} onClick={() => { const next = [...highlights]; [next[i], next[i + 1]] = [next[i + 1], next[i]]; patch('journalHighlights', next); setActiveHighlight(i + 1); }}>Mover después</Button><Button kind="outline" disabled={pending} onClick={() => { patch('journalHighlights', highlights.filter(item => item.id !== h.id)); setActiveHighlight(Math.max(0, i - 1)); }}>Eliminar destacado</Button></div>
          </div>)}
        </div>
      </SectionEditorCardTabs>
    </div>
    <div hidden={step !== 'design'} data-editor-step="design">
      <SectionEditorCardTabs label="Diseño de Instagram" labels={['Fondo', 'Distribución', 'Tipografía', 'Cristal', 'Botones', 'Móvil', 'Visibilidad']}>
        <div className={box}><Select label="Fondo de la sección" value={j.journalBackgroundMode} onChange={v => patch('journalBackgroundMode', v)} options={[["included", 'Satén suave del diario'], ['continuity', 'Continuar fondo de las demás secciones'], ['custom', 'Imagen propia'], ['color', 'Color sólido'], ['global', 'Fondo global de la tienda']]} />
          {j.journalBackgroundMode === 'custom' && image('Imagen de fondo', 'journalBackgroundImage', j.journalBackgroundImage)}
          {color('Color de fondo', 'journalBackgroundColor')}{num('Velo de color (%)', 'journalBackgroundWash', 0, 100)}</div>
        <div className={box}><SectionEditorSubgroups label="Editar distribución" labels={['Publicaciones', 'Ancho y espacios', 'Fotografía principal']}>
          <div className="space-y-3"><Select label="Publicación principal" value={j.journalFeaturedPostId} onChange={v => patch('journalFeaturedPostId', v)} options={postOptions} />{num('Publicaciones disponibles en el diario', 'journalLimit', 1, 48)}{num('Miniaturas por página lateral', 'journalPageSize', 1, 6)}<p className="text-xs">Las demás publicaciones se recorren con los botones del panel lateral. Todos los registros guardados se conservan.</p></div>
          <div className="space-y-3">{num('Ancho máximo (px)', 'journalMaxWidth', 800, 2000)}{num('Margen interior horizontal (px)', 'journalPaddingX', 0, 100)}{num('Margen interior vertical (px)', 'journalPaddingY', 0, 100)}{num('Separación entre paneles (px)', 'journalGap', 12, 60)}{num('Ancho del panel principal (%)', 'journalMainWidth', 50, 70)}</div>
          <div className="space-y-3">{num('Proporción ancho/alto de la imagen principal', 'journalImageRatio', .65, 1.8, .01)}<p className="text-xs">Para ajustar una prenda: Contenido → Publicaciones → Encuadre. El diseño calcula su altura automáticamente.</p></div>
        </SectionEditorSubgroups></div>
        <div className={box}><Select label="Tipografía" value={j.journalFont} onChange={v => patch('journalFont', v)} options={[[JOURNAL_FONT, 'Bodoni'], ['Georgia, serif', 'Georgia'], ['Arial, sans-serif', 'Arial']]} />{color('Color del texto', 'journalInk')}{num('Tamaño del título (px)', 'journalTitleSize', 24, 80)}{num('Tamaño de texto (px)', 'journalTextSize', 13, 24)}</div>
        <div className={box}><SectionEditorSubgroups label="Editar cristal" labels={['Color y transparencia', 'Forma y sombra', 'Relieve y textura', 'Reflejos y movimiento']}>
          <div className="space-y-3">{color('Color de los paneles', 'journalCardColor')}{color('Color de los detalles y bordes', 'journalAccent')}{num('Opacidad del cristal (%)', 'journalCardOpacity', 20, 100)}{num('Desenfoque del cristal (px)', 'journalBlur', 0, 30)}</div>
          <div className="space-y-3">{num('Esquinas redondeadas (px)', 'journalRadius', 0, 40)}{num('Intensidad de sombra (%)', 'journalShadow', 0, 50)}{num('Elevación al pasar el cursor (px)', 'journalHoverLift', 0, 8)}</div>
          <div className="space-y-3">{check('Activar relieve de cristal', 'journalGlassEnabled')}{num('Grosor del canto de cristal (px)', 'journalGlassDepth', 0, 16)}{num('Textura del cristal (%)', 'journalGlassTexture', 0, 60)}<p className="text-xs">El relieve añade cantos biselados y capas de cristal. La textura se aplica al marco y al panel, conservando limpias las fotografías.</p></div>
          <div className="space-y-3">{num('Reflejos del cristal (%)', 'journalGlassReflection', 0, 80)}{check('Mover luz y perspectiva con el cursor', 'journalGlassInteractive')}{num('Inclinación máxima con el cursor (grados)', 'journalGlassTilt', 0, 3, .1)}<p className="text-xs">En móvil se conserva el acabado de cristal. El movimiento se desactiva con la preferencia de movimiento reducido del dispositivo.</p></div>
        </SectionEditorSubgroups></div>
        <div className={box}>{color('Color del botón del perfil', 'journalButtonColor')}{color('Color del texto del botón', 'journalButtonTextColor')}<p className="text-xs">Compartir utiliza las opciones del dispositivo o copia el enlace. El marcador guarda en este navegador. Me gusta y comentarios abren la publicación en Instagram.</p></div>
        <div className={box}>{num('Márgenes laterales en móvil (px)', 'journalMobilePadding', 8, 32)}{num('Tamaño del título en móvil (px)', 'journalMobileTitleSize', 24, 48)}{num('Proporción de la foto principal en móvil', 'journalMobileImageRatio', .65, 1.5, .01)}{image('Imagen de fondo móvil', 'journalMobileBackgroundImage', j.journalMobileBackgroundImage)}<p className="text-xs">En móvil, la publicación principal aparece primero y los destacados y miniaturas debajo. Tocar una miniatura la muestra en grande.</p></div>
        <div className={box}><SectionEditorSubgroups label="Editar visibilidad" labels={['Encabezado', 'Panel lateral', 'Publicación']}>
          <div className="space-y-3">{check('Mostrar título', 'journalShowTitle')}{check('Mostrar usuario', 'journalShowProfile')}{check('Mostrar botón del perfil', 'journalShowFollow')}{check('Mostrar frase inferior', 'journalShowSubtitle')}</div>
          <div className="space-y-3">{check('Mostrar panel lateral', 'journalShowSidebar')}{check('Mostrar destacados', 'journalShowHighlights')}{check('Mostrar filtros', 'journalShowFilters')}</div>
          <div className="space-y-3">{check('Mostrar iconos de interacción', 'journalShowActions')}{check('Mostrar textos de publicaciones', 'journalShowCaptions')}</div>
        </SectionEditorSubgroups></div>
      </SectionEditorCardTabs>
    </div>
  </div>;
}
const JOURNAL_FONT = '"Bodoni Moda", Georgia, serif';
