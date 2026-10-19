import React, { useMemo, useRef, useState } from 'react';
import { Flower2, ArrowUp, ArrowDown, Plus } from 'lucide-react';
import { Button } from '../ui/UiComponents';
import { ColorField, FontFamilyField } from '../ui/SectionsPanelUI';
import { DesignCard, DesignChoice, DesignSlider, DesignText, SectionImageUpload } from '../ui/SectionDesignFields';
import SectionEditorSteps from '../ui/SectionEditorSteps';
import SectionEditorCardTabs from '../ui/SectionEditorCardTabs';
import CategoriaArtwork from '../../../../components/CategoriaArtwork';
import { CATEGORIAS_SECTION_DEFAULTS, normalizeCategoriasSection } from './categoriasSectionHelpers';
import './categoriasEditor.css';
function CategoryPanel({ title, hint, children, current, picker }) {
  return <DesignCard title={title} hint={hint}>
    {picker}
    {current ? children : <p className="section-design-hint">Agrega una categoría para comenzar.</p>}
  </DesignCard>;
}
const yesNo = [[true, 'Mostrar'], [false, 'Ocultar']];
export default function CategoriasSectionUI({ theme, setPath, uploadToCloudinary }) {
  const section = useMemo(() => normalizeCategoriasSection((Array.isArray(theme?.sections) ? theme.sections : []).find((item) => item.id === 'categorias' || item.type === 'categorias')), [theme]);
  const latest = useRef({ theme, section }); latest.current = { theme, section };
  const [tab, setTab] = useState('contenido');
  const [contentGroup, setContentGroup] = useState(0);
  const [pendingUploads, setPendingUploads] = useState(0);
  const onPhotoBusy = (busy) => setPendingUploads((count) => Math.max(0, count + (busy ? 1 : -1)));
  const [activeId, setActiveId] = useState(section.config.slides[0]?.id || '');
  const { config: c, style: s } = section;
  const activeIndex = Math.max(0, c.slides.findIndex((item) => item.id === activeId));
  const current = c.slides[activeIndex];
  const commit = (patch) => {
    const { theme: currentTheme, section: original } = latest.current;
    const next = normalizeCategoriasSection({ ...original, ...patch, config: { ...original.config, ...patch.config }, style: { ...original.style, ...patch.style } });
    const entries = [...(currentTheme?.sections || [])];
    const index = entries.findIndex((item) => item.id === 'categorias' || item.type === 'categorias');
    if (index < 0) entries.push(next); else entries[index] = next;
    setPath('sections', entries);
  };
  const config = (patch) => commit({ config: patch }); const style = (patch) => commit({ style: patch });
  const patchCategory = (id, patch) => {
    const slides = latest.current.section.config.slides.map((item) => item.id === id ? { ...item, ...patch } : item);
    config({ slides });
  };
  const move = (step) => {
    const slides = [...c.slides]; const target = activeIndex + step;
    if (target < 0 || target >= slides.length) return;
    [slides[activeIndex], slides[target]] = [slides[target], slides[activeIndex]];
    config({ slides }); setActiveId(current.id);
  };
  const add = () => {
    const id = globalThis.crypto?.randomUUID?.() || `cat_${Date.now()}_${c.slides.length}`;
    config({ slides: [...c.slides, { id, title: 'Nueva categoría', image: '', subtitle: '', review: '', badge: '', href: '/categorias', enabled: true }] });
    setActiveId(id); setContentGroup(1);
  };
  const slider = (key, label, min, max, step) => <DesignSlider key={key} label={label} value={s[key]} min={min} max={max} step={step} onChange={(value) => style({ [key]: value })} />;
  const color = (key, label) => <ColorField key={key} label={label} value={s[key]} onChange={(value) => style({ [key]: value })} />;
  const choice = (key, label, options = yesNo) => <DesignChoice label={label} value={s[key]} options={options} onChange={(value) => style({ [key]: value })} />;
  const picker = <div className="categories-editor__selection">
    <label className="section-design-field">Categoría que estás editando
      <select value={current?.id || ''} disabled={pendingUploads > 0 || !current} onChange={(event) => setActiveId(event.target.value)}>
        {!current && <option value="">Sin categorías</option>}
        {c.slides.map((item, index) => <option key={item.id} value={item.id}>{index + 1}. {item.title || 'Sin nombre'}{item.enabled === false ? ' · Oculta' : ''}</option>)}
      </select>
    </label>
    <div className="categories-editor__actions">
      <Button kind="outline" disabled={pendingUploads > 0} onClick={add}><Plus size={16} aria-hidden="true" />Agregar categoría</Button>
      <Button kind="outline" aria-label="Subir categoría" disabled={!current || !activeIndex || pendingUploads > 0} onClick={() => move(-1)}><ArrowUp size={16} aria-hidden="true" /></Button>
      <Button kind="outline" aria-label="Bajar categoría" disabled={!current || activeIndex === c.slides.length - 1 || pendingUploads > 0} onClick={() => move(1)}><ArrowDown size={16} aria-hidden="true" /></Button>
    </div>
    {pendingUploads > 0 && <p className="section-design-hint" role="status">Cargando imagen. Puedes seguir editando; espera para cambiar de categoría.</p>}
  </div>;
  return <div className="categories-editor">
    <header className="categories-editor__intro"><Flower2 size={24} aria-hidden="true" /><div><h2>Categorías</h2><p>Elige qué quieres cambiar. Solo verás los ajustes de ese grupo.</p></div></header>
    <SectionEditorSteps value={tab} onChange={setTab} sectionName="Categorías" items={[
      { value: 'contenido', label: 'Contenido', hint: 'Edita los textos y elige una categoría para cambiar su imagen y galería.' },
      { value: 'estilos', label: 'Diseño', hint: 'Ajusta el abanico, el cristal y la vista móvil. Los cambios aparecen en la vista previa.' },
    ]} />
    <div className="categories-editor__stack" hidden={tab !== 'contenido'}>
      <SectionEditorCardTabs label="Contenido de Categorías" value={contentGroup} onChange={setContentGroup}
        labels={['Textos', 'Nombre y enlace', 'Imagen principal', 'Imagen móvil', 'Encuadre', 'Título como imagen']}>
        <DesignCard title="Textos de la sección" hint="Estos ajustes se aplican a toda la sección. Guarda los cambios para publicarlos.">
          <DesignChoice label="Sección en la tienda" value={section.enabled} options={[[true, 'Visible'], [false, 'Oculta']]} onChange={(enabled) => commit({ enabled })} />
          <DesignText label="Texto superior" value={c.eyebrow} onChange={(e) => config({ eyebrow: e.target.value })} />
          <DesignText label="Título de la sección" value={c.titleText} onChange={(e) => config({ titleText: e.target.value })} />
          <DesignText label="Descripción de la sección" value={c.subtitleText} onChange={(e) => config({ subtitleText: e.target.value })} />
          <DesignText label="Texto inferior" value={c.footerText} onChange={(e) => config({ footerText: e.target.value })} />
        </DesignCard>
        <CategoryPanel current={current} picker={picker} title="Nombre y enlace" hint="Cada categoría abre su propia galería.">
          <DesignChoice label="Visibilidad de la categoría" value={current?.enabled} options={[[true, 'Visible'], [false, 'Oculta']]} onChange={(enabled) => patchCategory(current.id, { enabled })} />
          <DesignText label="Nombre de la categoría" value={current?.title || ''} onChange={(e) => patchCategory(current.id, { title: e.target.value })} />
          <DesignText label="Enlace de la galería" placeholder="/categoria/ejemplo" value={current?.href || ''} onChange={(e) => patchCategory(current.id, { href: e.target.value })} />
          <DesignText label="Descripción al explorar" value={current?.subtitle || ''} onChange={(e) => patchCategory(current.id, { subtitle: e.target.value })} />
          <DesignText label="Etiqueta corta" value={current?.badge || ''} onChange={(e) => patchCategory(current.id, { badge: e.target.value })} />
        </CategoryPanel>
        <CategoryPanel current={current} picker={picker} title="Imagen principal" hint="Foto de la categoría seleccionada. El fondo se configura en Diseño → Fondo.">
          <SectionImageUpload key={current?.id} label="Imagen de la categoría" onBusyChange={onPhotoBusy} value={current?.image || ''} fallback={current && <CategoriaArtwork slide={current} />} onChange={(image) => patchCategory(current.id, { image })} uploadToCloudinary={uploadToCloudinary} hint="Vertical, por ejemplo 900 × 1300 px." />
          <DesignText label="Descripción de la imagen" value={current?.imageAlt || ''} onChange={(e) => patchCategory(current.id, { imageAlt: e.target.value })} />
          <Button kind="outline" disabled={pendingUploads > 0} onClick={() => patchCategory(current.id, { image: '', mobileImage: '' })}>Usar imagen predeterminada</Button>
        </CategoryPanel>
        <CategoryPanel current={current} picker={picker} title="Imagen móvil" hint="Opcional. Si la dejas vacía se utiliza la imagen principal.">
          <SectionImageUpload key={current?.id} label="Imagen móvil de la categoría" onBusyChange={onPhotoBusy} value={current?.mobileImage || ''} fallback={current && <CategoriaArtwork slide={current} mobile />} onChange={(mobileImage) => patchCategory(current.id, { mobileImage })} uploadToCloudinary={uploadToCloudinary} />
          {current?.mobileImage && <Button kind="ghost" disabled={pendingUploads > 0} onClick={() => patchCategory(current.id, { mobileImage: '' })}>Usar imagen principal en móvil</Button>}
        </CategoryPanel>
        <CategoryPanel current={current} picker={picker} title="Encuadre de la imagen" hint="Ajusta la foto de la categoría seleccionada y comprueba el resultado en la vista previa.">
          <DesignSlider label="Encuadre horizontal de la foto cargada (%)" value={current?.imagePositionX ?? 50} onChange={(imagePositionX) => patchCategory(current.id, { imagePositionX })} />
          <DesignSlider label="Encuadre vertical de la foto cargada (%)" value={current?.imagePositionY ?? 50} onChange={(imagePositionY) => patchCategory(current.id, { imagePositionY })} />
          <DesignSlider label="Ampliación de la foto" min={1} max={1.6} step={.01} value={current?.imageScale ?? 1} onChange={(imageScale) => patchCategory(current.id, { imageScale })} />
        </CategoryPanel>
        <DesignCard title="Título como imagen" hint="Opcional. El título de texto sirve como respaldo si la imagen no carga.">
          <DesignChoice label="Usar una imagen como título" value={c.useTitleImage} options={[[false, 'Título de texto'], [true, 'Imagen personalizada']]} onChange={(useTitleImage) => config({ useTitleImage })} />
          {c.useTitleImage && <SectionImageUpload label="Imagen del título" value={c.titleImage} onChange={(titleImage) => config({ titleImage })} uploadToCloudinary={uploadToCloudinary} />}
        </DesignCard>
      </SectionEditorCardTabs>
    </div>
    <div hidden={tab !== 'estilos'}>
      <SectionEditorCardTabs label="Diseño de Categorías" labels={['Alto', 'Ancho', 'Abanico', 'Movimiento', 'Espacios', 'Fondo', 'Textos', 'Cristal', 'Móvil', 'Textos móvil', 'Visibilidad']}>
        <DesignCard title="Altura de toda la sección" hint="Aumenta el espacio vertical de Categorías para que la sección siguiente quede más abajo.">
          {choice('fanSectionHeightMode', 'Altura de la sección', [['screen', 'Pantalla completa'], ['custom', 'Altura personalizada'], ['auto', 'Según el contenido']])}
          {s.fanSectionHeightMode === 'custom' && slider('fanSectionMinHeightPx', 'Altura mínima de la sección (px)', 400, 2000, 10)}
          <p className="section-design-hint">Pantalla completa ocupa al menos una pantalla de alto. Si el contenido necesita más espacio, la sección sigue creciendo. El tamaño de las fotos se ajusta por separado en Abanico.</p>
        </DesignCard>
        <DesignCard title="Ancho horizontal" hint="Amplía el contenido hacia ambos lados. El fondo siempre cubre toda la sección.">
          {choice('fanWidthMode', 'Ancho de la sección', [['limited', 'Ancho personalizado'], ['full', 'Ancho completo']])}
          {s.fanWidthMode === 'limited' && slider('sectionMaxWidthPx', 'Ancho máximo (px)', 480, 2560)}
          {slider('sectionPaddingXPx', 'Espacio a los lados (px)', 0, 80)}
          <p className="section-design-hint">Ancho completo aprovecha todo el espacio disponible. El ancho personalizado se adapta si la pantalla es más pequeña. Usa Vista escritorio amplio para comparar en una pantalla de 1920 px.</p>
        </DesignCard>
        <DesignCard title="Forma del abanico" hint="Número de tarjetas, tamaño y apertura en escritorio.">
          {slider('fanColumns', 'Categorías por fila en escritorio', 2, 6)}
          {slider('fanHeightPx', 'Altura de las tarjetas (px)', 220, 580)}{slider('fanGapPx', 'Separación de tarjetas (px)', 4, 40)}
          {slider('fanSpreadDeg', 'Apertura del abanico (grados)', 0, 12)}{slider('fanLiftPx', 'Curvatura del abanico (px)', 0, 50)}
        </DesignCard>
        <DesignCard title="Movimiento al explorar" hint="Controla cómo responden las tarjetas al cursor o al teclado.">
          {choice('fanMotionEnabled', 'Interacción de las tarjetas', [[true, 'Activa'], [false, 'Sin movimiento']])}
          {slider('fanHoverLiftPx', 'Elevación al explorar (px)', 0, 40)}{slider('fanExpand', 'Expansión al explorar', 1, 1.8, .05)}
          {slider('fanImageZoom', 'Acercamiento al explorar', 1, 1.2, .01)}
          {choice('fanParallax', 'Profundidad del fondo', [[true, 'Sigue el cursor'], [false, 'Fondo fijo']])}
          {choice('fanShadow', 'Sombra de las tarjetas', [[true, 'Con sombra'], [false, 'Sin sombra']])}
        </DesignCard>
        <DesignCard title="Tamaño y espacios" hint="Ajusta el contorno de las tarjetas y los márgenes de la sección.">
          {slider('fanRadiusPx', 'Redondeado de las tarjetas (px)', 0, 48)}
          {choice('imageObjectFit', 'Ajuste de imágenes cargadas', [['cover', 'Llenar tarjeta'], ['contain', 'Ver imagen completa']])}
          {slider('sectionPaddingTopPx', 'Espacio superior (px)', 0, 200)}{slider('sectionPaddingBottomPx', 'Espacio inferior (px)', 0, 160)}
        </DesignCard>
        <DesignCard title="Fondo de la sección" hint="El fondo cubre también los márgenes, para conservar la continuidad visual de la tienda.">
          {choice('fanBackgroundMode', 'Origen del fondo', [['continuity', 'Continuar fondo de Looks'], ['global', 'Fondo general'], ['custom', 'Imagen propia'], ['color', 'Color propio']])}
          {s.fanBackgroundMode === 'custom' && <SectionImageUpload label="Fondo de Categorías" value={c.backgroundImage} onChange={(backgroundImage) => config({ backgroundImage })} uploadToCloudinary={uploadToCloudinary} />}
          {['custom','color'].includes(s.fanBackgroundMode) && color('fanBackgroundColor', 'Color de fondo')}
          {slider('fanBackgroundWash', 'Suavidad sobre el fondo (%)', 0, 80)}
        </DesignCard>
        <DesignCard title="Tipografía y colores del texto">
          <FontFamilyField label="Tipografía de títulos y categorías" value={s.fanTitleFont} onChange={(fanTitleFont) => style({ fanTitleFont })} />
          {slider('fanTitleSizePx', 'Tamaño del título (px)', 24, 80)}{slider('fanTitleWeight', 'Grosor del título', 100, 900, 100)}
          {slider('fanLabelSizePx', 'Tamaño del nombre de categoría (px)', 12, 28)}
          {color('fanTitleColor', 'Color del título')}{color('fanTextColor', 'Color de textos y flechas')}
        </DesignCard>
        <DesignCard title="Cristal de las etiquetas" hint="Tinte, transparencia y reflejos sobre las imágenes.">
          {color('fanGlassColor', 'Tinte del cristal')}{slider('fanGlassTint', 'Intensidad del tinte (%)', 0, 75)}
          {slider('fanGlassBlurPx', 'Desenfoque del cristal (px)', 0, 20)}{color('fanGlassBorder', 'Color del borde del cristal')}
          {choice('fanGlint', 'Reflejo en los botones', [[true, 'Destello suave'], [false, 'Sin destello']])}
        </DesignCard>
        <DesignCard title="Diseño para móvil" hint="Las categorías se acomodan en filas. En dos columnas, si la última queda sola, ocupa todo el ancho con formato vertical.">
          {choice('fanMobileColumns', 'Columnas en móvil', [[2, 'Dos columnas'], [1, 'Una columna']])}
          {slider('fanMobileHeightPx', 'Altura móvil de las tarjetas (px)', 180, 440)}
          {slider('fanMobileGapPx', 'Separación móvil (px)', 6, 32)}{slider('fanMobileTiltDeg', 'Inclinación móvil (grados)', 0, 5)}
          {slider('fanMobilePaddingXPx', 'Márgenes móviles (px)', 8, 32)}
        </DesignCard>
        <DesignCard title="Textos en móvil" hint="Tamaños independientes del escritorio.">
          {slider('fanMobileTitleSizePx', 'Tamaño del título móvil (px)', 22, 52)}
          {slider('fanMobileLabelSizePx', 'Tamaño de las categorías móvil (px)', 12, 22)}
        </DesignCard>
        <DesignCard title="Qué se muestra en la sección">
          {choice('fanShowEyebrow', 'Texto superior')}{choice('fanShowTitle', 'Título principal')}{choice('fanShowSubtitle', 'Descripción de la sección')}
          {choice('fanShowFooter', 'Texto inferior')}{choice('fanShowDescription', 'Descripción al explorar')}{choice('showBadge', 'Etiquetas de categoría')}
          {choice('fanShowArrow', 'Flecha de acceso')}
          <p className="section-design-hint">El clic o toque abre directamente la galería configurada en cada categoría. En la vista previa puedes explorar las tarjetas sin salir del editor.</p>
        </DesignCard>
      </SectionEditorCardTabs>
      <div className="categories-editor__restore"><Button kind="outline" onClick={() => style({ ...CATEGORIAS_SECTION_DEFAULTS.style })}>Restaurar diseño predeterminado</Button><p className="section-design-hint">Conserva todas tus categorías, imágenes, textos y enlaces.</p></div>
    </div>
  </div>;
}
