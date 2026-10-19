import React, { useEffect, useRef, useState } from 'react';
import { Field, Input, Button } from '../ui/UiComponents';
import SectionEditorSteps from '../ui/SectionEditorSteps';
import SectionEditorCardTabs from '../ui/SectionEditorCardTabs';
import SectionEditorSubgroups from '../ui/SectionEditorSubgroups';
import SectionEditorPostPicker from '../ui/SectionEditorPostPicker';
import SectionColorPicker from '../ui/SectionColorPicker';
import { normalizeInstagramSection } from './instagramSectionHelpers';
import { normalizeEditorial, photoLayout, photoCrop, bounded, safeInstagramLink, editorialPhotoSlot } from './instagramEditorialHelpers';
const findSection = theme => normalizeInstagramSection(theme?.sections?.find(s => s?.id === 'instagram' || s?.type === 'instagram'));
const box = 'rounded-2xl border border-neutral-200 bg-white p-4 space-y-4';
function Text({
  label,
  value,
  onChange,
  ...props
}) {
  return <Field label={label}><Input aria-label={label} value={value} onChange={e => onChange(e.target.value)} {...props} /></Field>;
}
function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1
}) {
  return <Text label={label} type="number" value={value} min={min} max={max} step={step} onChange={v => onChange(bounded(v, min, max, value))} />;
}
function Select({
  label,
  value,
  onChange,
  options
}) {
  return <label className="block text-sm font-semibold">{label}<select className="w-full mt-1 rounded-lg border p-2" value={value} onChange={e => onChange(e.target.value)}>{options.map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select></label>;
}
function Check({
  label,
  value,
  onChange
}) {
  return <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={value} onChange={e => onChange(e.target.checked)} />{label}</label>;
}
export default function InstagramEditorialUI({
  theme,
  setPath,
  uploadToCloudinary,
  uploading = false
}) {
  const [step, setStep] = useState('content');
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [active, setActive] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const current = useRef();
  current.current = {
    theme,
    setPath
  };
  const section = findSection(theme);
  const c = section.config;
  const e = normalizeEditorial(c);
  const posts = c.posts;
  // Read latest theme when uploads finish so switching groups or editing another field cannot overwrite changes.
  function mutate(edit) {
    const {
      theme: latest,
      setPath: save
    } = current.current;
    const s = findSection(latest);
    const next = edit(s);
    let found = false;
    const list = (latest?.sections || []).map(item => {
      if (item.id === 'instagram' || item.type === 'instagram') {
        found = true;
        return next;
      }
      return item;
    });
    if (!found) list.push(next);
    save?.('sections', list);
  }
  const patch = (key, value) => mutate(s => ({
    ...s,
    config: {
      ...s.config,
      ...normalizeEditorial(s.config),
      [key]: value
    }
  }));
  const patchPost = (id, key, value) => mutate(s => ({
    ...s,
    config: {
      ...s.config,
      posts: s.config.posts.map(p => p.id === id ? {
        ...p,
        [key]: value
      } : p)
    }
  }));
  async function upload(file, key, id) {
    if (!file) return;
    setError('');
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/avif'].includes(file.type)) {
      setError('Usa una imagen PNG, JPG, WEBP o AVIF.');
      return;
    }
    if (typeof uploadToCloudinary !== 'function') {
      setError('La carga de imágenes no está disponible. Puedes pegar la URL.');
      return;
    }
    setPending(true);
    try {
      const url = await uploadToCloudinary(file);
      if (!mounted.current) return;
      if (typeof url !== 'string' || !url) throw new Error('No se recibió la imagen. Intenta nuevamente.');
      if (id) patchPost(id, key, url);else patch(key, url);
    } catch (err) {
      if (mounted.current) setError(err.message || 'No se pudo subir la imagen.');
    } finally {
      if (mounted.current) setPending(false);
    }
  }
  const imageField = (label, key, value, id) => <Field label={label}><Input aria-label={label} value={value || ''} onChange={ev => id ? patchPost(id, key, ev.target.value) : patch(key, ev.target.value)} placeholder="https://… o /imagen.webp" />
    <label className="inline-flex mt-2 cursor-pointer rounded-lg border p-2 text-sm">{pending ? 'Subiendo…' : 'Subir imagen'}<input aria-label={`Subir ${label.toLowerCase()}`} type="file" accept="image/png,image/jpeg,image/webp,image/avif" className="hidden" disabled={pending || uploading} onChange={ev => {
        upload(ev.target.files?.[0], key, id);
        ev.target.value = '';
      }} /></label>
    {value && <img src={value} alt={label} className="mt-2 max-h-28 max-w-full rounded-lg object-contain" />}</Field>;
  const text = (label, key) => <Text label={label} value={e[key]} onChange={v => patch(key, v)} />;
  const num = (label, key, min, max, step = 1) => <NumberField label={label} value={e[key]} min={min} max={max} step={step} onChange={v => patch(key, v)} />;
  const color = (label, key) => <Field label={label}><SectionColorPicker label={label} value={e[key]} onChange={v => patch(key, v)} /></Field>;
  const check = (label, key) => <Check label={label} value={e[key]} onChange={v => patch(key, v)} />;
  function add() {
    const id = globalThis.crypto?.randomUUID?.() || `post_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    patch('posts', [...posts, {
      id,
      image: '',
      link: '',
      enabled: true
    }]);
    setActive(posts.length);
  }
  function move(index, delta) {
    const list = [...posts];
    [list[index], list[index + delta]] = [list[index + delta], list[index]];
    patch('posts', list);
    setActive(index + delta);
  }
  return <div className="space-y-4">
    <p className="text-sm text-neutral-600">Muro editorial · Cada foto abre su propia publicación. El diseño muestra cinco fotos por defecto; cambia la cantidad en Diseño → Distribución. Todas tus publicaciones se conservan.</p>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <SectionEditorSteps value={step} onChange={setStep} sectionName="Instagram" items={[{
      value: 'content',
      label: 'Contenido',
      hint: 'Edita el perfil, los textos o una publicación a la vez.'
    }, {
      value: 'design',
      label: 'Diseño',
      hint: 'Elige un grupo y revisa el resultado en la vista previa.'
    }]} />
    <div data-editor-step="content" hidden={step !== 'content'}>
      <SectionEditorCardTabs label="Contenido de Instagram" labels={['Perfil', 'Textos', 'Publicaciones']}>
        <div className={box}>
          <Text label="Usuario de Instagram" value={c.profileUser || ''} placeholder="@rosaboutique33" onChange={v => patch('profileUser', v)} />
          <Text label="Enlace del perfil" value={c.profileLink} placeholder="https://instagram.com/tuusuario" onChange={v => patch('profileLink', v)} />
          {c.profileLink && !safeInstagramLink(c.profileLink) && <p role="alert">Escribe un enlace completo que empiece por https://.</p>}
          {check('Mostrar usuario de Instagram', 'editorialShowProfile')}{check('Usar logo personalizado', 'editorialUseProfileLogo')}
          {e.editorialUseProfileLogo && imageField('Logo de Instagram', 'instagramLogo', c.instagramLogo)}
          <Check label="Mostrar sección en la tienda" value={section.enabled !== false} onChange={v => mutate(s => ({
            ...s,
            enabled: v
          }))} />
        </div>
        <div className={box}>
          {text('Título grande', 'editorialTitle')}{text('Frase inferior', 'editorialSubtitle')}
          {text('Texto del botón del perfil', 'editorialFollowText')}{text('Texto del botón de publicación', 'editorialPostText')}
          {check('Usar imagen para el título', 'editorialUseTitleImage')}
          {e.editorialUseTitleImage && imageField('Imagen del título', 'titleImage', c.titleImage)}
          <Text label="Descripción del título" value={c.titleAlt} onChange={v => patch('titleAlt', v)} />
        </div>
        <div className={box}>
          <div className="flex items-center justify-between gap-2"><strong>Publicaciones</strong><Button onClick={add} disabled={pending || uploading}>Agregar publicación</Button></div>
          <SectionEditorPostPicker posts={posts} activeIndex={Math.max(0, Math.min(active, posts.length - 1))} onSelect={setActive} label="Instagram" />
          {!posts.length && <p>Agrega una foto y el enlace de su publicación para comenzar.</p>}
          {posts.map((p, index) => {
            const visible = posts.filter(post => post.enabled !== false && post.image).slice(0, e.editorialVisibleCount);
            const slot = visible.includes(p) ? editorialPhotoSlot(visible, p, e) : index;
            const l = photoLayout(p, slot);
            const crop = photoCrop(p);
            return <div key={p.id} className="rounded-2xl bg-neutral-50 p-3 space-y-3" hidden={index !== Math.max(0, Math.min(active, posts.length - 1))}>
            <strong>Publicación {index + 1}</strong>
            <div className="flex flex-wrap gap-2"><Button kind="outline" disabled={index === 0 || pending} onClick={() => move(index, -1)}>Mover antes</Button><Button kind="outline" disabled={index === posts.length - 1 || pending} onClick={() => move(index, 1)}>Mover después</Button>
              <Button kind="outline" disabled={pending} onClick={() => {
                  patch('posts', posts.filter(item => item.id !== p.id));
                  setActive(Math.max(0, index - 1));
                }}>Eliminar</Button></div>
            <SectionEditorSubgroups label="Configurar esta publicación" labels={['Imagen y enlace', 'Encuadre', 'Posición en escritorio']}>
              <div className="space-y-3">{imageField('Imagen de la publicación', 'image', p.image, p.id)}
                <Text label="Enlace de la publicación" value={p.link || ''} placeholder="https://instagram.com/p/xxxx" onChange={v => patchPost(p.id, 'link', v)} />
                {(!p.link || !safeInstagramLink(p.link)) && <p className="text-xs text-amber-800">Sin un enlace válido, esta foto se muestra sin botón y no abre otra publicación.</p>}
                <Text label="Descripción de la foto" value={p.alt || ''} onChange={v => patchPost(p.id, 'alt', v)} />
                <Check label="Mostrar publicación" value={p.enabled !== false} onChange={v => patchPost(p.id, 'enabled', v)} />
              </div>
              <div className="space-y-3"><Select label="Ajuste de la foto" value={p.imageFit || e.editorialImageFit} onChange={v => patchPost(p.id, 'imageFit', v)} options={[['contain', 'Ver foto completa'], ['cover', 'Llenar marco y recortar']]} />{imageField('Imagen alternativa para móvil', 'mobileImage', p.mobileImage, p.id)}
                {[['Encuadre horizontal (%)', 'imagePositionX', crop.x, 0, 100, 1], ['Encuadre vertical (%)', 'imagePositionY', crop.y, 0, 100, 1], ['Acercamiento', 'imageScale', crop.zoom, 1, 2, .01]].map(([label, key, value, min, max, step]) => <NumberField key={key} {...{
                    label,
                    value,
                    min,
                    max,
                    step
                  }} onChange={v => patchPost(p.id, key, v)} />)}
              </div>
              <div className="space-y-3"><p className="text-xs">Las posiciones se expresan como porcentaje del espacio de escritorio. En móvil se ordenan automáticamente.</p>
                {Object.entries(l).map(([key, value]) => <NumberField key={key} label={{
                    x: 'Posición horizontal (%)',
                    y: 'Posición vertical (%)',
                    width: 'Ancho de la foto (%)',
                    height: 'Alto de la foto (%)',
                    rotate: 'Inclinación (grados)',
                    layer: 'Capa de superposición'
                  }[key]} value={value} min={key === 'rotate' ? -15 : key === 'x' || key === 'y' ? 0 : 1} max={key === 'rotate' ? 15 : key === 'layer' ? 10 : 100} onChange={v => patchPost(p.id, 'editorial' + key[0].toUpperCase() + key.slice(1), v)} />)}
              </div>
            </SectionEditorSubgroups>
          </div>;
          })}
        </div>
      </SectionEditorCardTabs>
    </div>
    <div data-editor-step="design" hidden={step !== 'design'}>
      <SectionEditorCardTabs label="Diseño de Instagram" labels={['Fondo', 'Distribución', 'Tipografía', 'Fotos y efectos', 'Botones', 'Móvil', 'Visibilidad']}>
        <div className={box}>
          <Select label="Fondo de la sección" value={e.editorialBackgroundMode} onChange={v => patch('editorialBackgroundMode', v)} options={[['included', 'Satén floral del diseño'], ['continuity', 'Continuar fondo de las demás secciones'], ['custom', 'Imagen propia'], ['color', 'Color sólido'], ['global', 'Fondo global de la tienda']]} />
          {e.editorialBackgroundMode === 'custom' && imageField('Imagen de fondo', 'editorialBackgroundImage', e.editorialBackgroundImage)}
          <SectionEditorSubgroups label="Ajustes del fondo" labels={['Color y velo', 'Encuadre del fondo']}>
          <div className="space-y-3">{color('Color de fondo', 'editorialBackgroundColor')}{num('Velo de color (%)', 'editorialBackgroundWash', 0, 100)}</div>
          <div className="space-y-3">{num('Posición horizontal del fondo (%)', 'editorialBackgroundX', 0, 100)}{num('Posición vertical del fondo (%)', 'editorialBackgroundY', 0, 100)}</div>
          </SectionEditorSubgroups>
        </div>
        <div className={box}>
          {num('Fotos visibles', 'editorialVisibleCount', 1, 12)}
          <Select label="Foto principal del centro" value={e.editorialFeaturedPostId} onChange={v => patch('editorialFeaturedPostId', v)} options={[["", "Automática (última de las cinco fotos)"], ...posts.filter(p => p.enabled !== false && p.image).slice(0, e.editorialVisibleCount).map((p, i) => [p.id, p.alt || `Publicación ${i + 1}`])]} />
          <Select label="Ancho de la sección" value={e.editorialWidthMode} onChange={v => patch('editorialWidthMode', v)} options={[["full", "Todo el ancho"], ["limited", "Ancho máximo personalizado"]]} />
          {e.editorialWidthMode === 'limited' && num('Ancho máximo (px)', 'editorialMaxWidth', 800, 2560)}{num('Alto de escritorio a 1600 px de ancho', 'editorialHeight', 600, 1600)}
          {num('Margen interior horizontal (px)', 'editorialPaddingX', 0, 120)}{num('Margen interior vertical (px)', 'editorialPaddingY', 0, 120)}
          <p className="text-xs">Para mover una foto: Contenido → Publicaciones → Posición en escritorio.</p>
        </div>
        <div className={box}>
          <SectionEditorSubgroups label="Editar tipografía" labels={['Título', 'Posición del título', 'Usuario y frase', 'Posición del usuario']}>
            <div className="space-y-3">{color('Color del título', 'editorialTitleColor')}
              <Select label="Tipografía" value={e.editorialFont} onChange={v => patch('editorialFont', v)} options={[['"Bodoni Moda", Georgia, serif', "Bodoni · diseño original"], ["Georgia, serif", "Georgia"], ['"Playfair Display", Georgia, serif', 'Playfair Display'], ['"Cormorant Garamond", Georgia, serif', 'Cormorant Garamond'], ['Arial, sans-serif', 'Arial']]} />
              {num('Tamaño del título en escritorio', 'editorialTitleSize', 70, 420)}{num('Grosor del título', 'editorialTitleWeight', 100, 900, 100)}
            </div>
            <div className="space-y-3">{num('Posición superior del título (%)', 'editorialTitleTop', 0, 20)}{num('Posición horizontal del título (%)', 'editorialTitleX', -10, 10)}{num('Altura visual del título (%)', 'editorialTitleHeight', 60, 120)}</div>
            <div className="space-y-3">{color('Color del texto', 'editorialTextColor')}{num('Tamaño del usuario (px)', 'editorialProfileSize', 12, 40)}{num('Tamaño del logo (px)', 'editorialLogoSize', 16, 80)}{num('Tamaño de la frase inferior (px)', 'editorialSubtitleSize', 12, 36)}</div>
            <div className="space-y-3">{num('Posición horizontal del usuario (%)', 'editorialProfileX', 0, 80)}{num('Posición vertical del usuario (%)', 'editorialProfileY', 0, 40)}</div>
          </SectionEditorSubgroups>
        </div>
        <div className={box}>
          <SectionEditorSubgroups label="Editar fotos y efectos" labels={['Marcos', 'Encuadre y luz', 'Profundidad 3D', 'Cristal y luz', 'Movimiento 3D', 'Interacción']}>
            <div className="space-y-3">{color('Color del borde', 'editorialBorderColor')}{num('Grosor del borde (px)', 'editorialBorderWidth', 0, 10)}{num('Esquinas redondeadas (px)', 'editorialRadius', 0, 80)}{num('Intensidad de sombra (%)', 'editorialShadow', 0, 80)}{check('Inclinar las fotos', 'editorialTilt')}</div>
            <div className="space-y-3">
              <Select label="Encuadre de la foto central" value={e.editorialFeaturedFit} onChange={v => patch('editorialFeaturedFit', v)} options={[["contain", "Ver la foto completa"], ["cover", "Llenar marco y recortar"]]} />
              {num('Luminosidad de las fotografías', 'editorialPhotoBrightness', .8, 1.2, .01)}
              {num('Contraste de las fotografías', 'editorialPhotoContrast', .8, 1.2, .01)}
              {num('Calidez de las fotografías (%)', 'editorialPhotoWarmth', 0, 20)}
              <p className="text-xs">El encuadre individual de una publicación tiene prioridad. Estos ajustes no modifican los archivos originales.</p>
            </div>
            <div className="space-y-3">
              {check('Activar profundidad 3D', 'editorialDepthEnabled')}
              {num('Separación entre capas (px)', 'editorialDepth', 0, 160)}
              {num('Perspectiva de la cámara (px)', 'editorialPerspective', 600, 2600)}
              {num('Inclinación en perspectiva (grados)', 'editorialTilt3D', 0, 18)}
              <p className="text-xs">La profundidad se ve incluso sin mover el cursor. Una perspectiva menor acentúa el volumen.</p>
            </div>
            <div className="space-y-3">
              {num('Grosor del cristal (px)', 'editorialThickness', 0, 16)}
              {num('Intensidad de reflejos (%)', 'editorialLighting', 0, 70)}
            </div>
            <div className="space-y-3">
              {check('Seguir el cursor con perspectiva', 'editorialPointer3D')}
              {num('Respuesta al cursor (grados)', 'editorialParallax', 0, 14)}
              {num('Acercamiento de la foto al pasar el cursor (px)', 'editorialHoverDepth', 0, 140)}
            </div>
            <div className="space-y-3"><Select label="Efecto al pasar el cursor" value={e.editorialMotion} onChange={v => patch('editorialMotion', v)} options={[["none", "Sin movimiento"], ["lift", "Elevar foto"], ["zoom", "Acercar imagen"], ["lift-zoom", "Elevar y acercar"]]} />
              {num('Elevación (px)', 'editorialLift', 0, 40)}{num('Acercamiento al pasar el cursor', 'editorialZoom', 1, 1.2, .01)}{num('Duración del efecto (ms)', 'editorialDuration', 100, 1200)}
            </div>
          </SectionEditorSubgroups>
        </div>
        <div className={box}>
          <SectionEditorSubgroups label="Editar botones" labels={['Seguir en Instagram', 'Ver publicación', 'Posición del botón del perfil']}>
            <div className="space-y-3">{color('Color del botón del perfil', 'editorialButtonColor')}
              <Field label="Color del texto del distintivo"><SectionColorPicker label="Color del texto del distintivo" value={e.editorialFollowTextColor} onChange={v => patch('editorialFollowTextColor', v)} /></Field>
              {num('Tamaño del texto del botón (px)', 'editorialButtonSize', 12, 40)}{num('Redondeado del botón (px)', 'editorialButtonRadius', 0, 100)}{num('Desenfoque del cristal (px)', 'editorialButtonBlur', 0, 30)}</div>
            <div className="space-y-3">{color('Color del botón de publicación', 'editorialActionColor')}{color('Color de texto de publicación', 'editorialActionTextColor')}{num('Tamaño del botón de publicación (px)', 'editorialActionSize', 60, 180)}</div>
            <div className="space-y-3">{num('Posición horizontal del botón (%)', 'editorialFooterX', 0, 70)}{num('Separación inferior del botón (%)', 'editorialFooterY', 0, 40)}{num('Ancho máximo del botón (%)', 'editorialFooterWidth', 18, 70)}</div>
          </SectionEditorSubgroups>
        </div>
        <div className={box}>
          <SectionEditorSubgroups label="Editar versión móvil" labels={['Distribución móvil', 'Fondo móvil']}>
            <div className="space-y-3"><Select label="Columnas en móvil" value={e.editorialMobileColumns} onChange={v => patch('editorialMobileColumns', Number(v))} options={[[1, 'Una columna'], [2, 'Dos columnas']]} />
              {num('Separación entre fotos (px)', 'editorialMobileGap', 4, 32)}{num('Márgenes laterales en móvil (px)', 'editorialMobilePadding', 8, 40)}{num('Márgenes verticales en móvil (px)', 'editorialMobilePaddingY', 0, 80)}{num('Tamaño del título en móvil (px)', 'editorialMobileTitleSize', 28, 110)}{num('Proporción ancho/alto de fotos móviles', 'editorialMobilePhotoRatio', .5, 1.5, .05)}
              <p className="text-xs">Si queda una foto sola al final, ocupa toda la fila. Tocar cada foto abre su publicación.</p></div>
            <div>{imageField('Imagen de fondo móvil', 'editorialMobileBackgroundImage', e.editorialMobileBackgroundImage)}</div>
          </SectionEditorSubgroups>
        </div>
        <div className={box}>{check('Mostrar título', 'editorialShowTitle')}{check('Mostrar usuario', 'editorialShowProfile')}{check('Mostrar botón del perfil', 'editorialShowFollow')}{check('Mostrar frase inferior', 'editorialShowSubtitle')}{check('Mostrar botón en cada publicación', 'editorialShowPostAction')}</div>
      </SectionEditorCardTabs>
    </div>
  </div>;
}
