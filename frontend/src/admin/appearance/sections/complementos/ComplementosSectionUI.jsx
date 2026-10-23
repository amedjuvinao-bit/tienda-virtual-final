import React, { useMemo, useRef, useState } from 'react';
import { Flower2, MousePointer2 } from 'lucide-react';
import { Button, Input } from '../ui/UiComponents';
import { ColorField, FontFamilyField } from '../ui/SectionsPanelUI';
import SectionEditorSteps from '../ui/SectionEditorSteps';
import SectionEditorCardTabs from '../ui/SectionEditorCardTabs';
import SectionEditorSubgroups from '../ui/SectionEditorSubgroups';
import ComplementosImageField from './ComplementosImageField';
import { COMPLEMENTOS_SECTION_DEFAULTS, normalizeComplementosSection } from './complementosSectionHelpers';
import './complementosEditor.css';

function Card({ title, icon: Icon, hint, children }) {
  return <section className="comp-editor__card"><h3>{Icon && <Icon size={18} aria-hidden="true" />}{title}</h3>{hint && <p className="comp-editor__hint">{hint}</p>}<div className="comp-editor__fields">{children}</div></section>;
}
  function Text({ label, ...props }) { return <label className="comp-editor__field">{label}<Input {...props} /></label>; }
function Slider({ label, value, onChange, min = 0, max = 100, step = 1 }) {
  return <div className="comp-editor__field"><span>{label}</span><div className="comp-editor__range"><input type="range" aria-label={label} value={value} onChange={(e) => onChange(Number(e.target.value))} min={min} max={max} step={step} /><input type="number" aria-label={`${label} (valor)`} value={value} onChange={(e) => onChange(Number(e.target.value))} min={min} max={max} step={step} /></div></div>;
}
function Choice({ label, value, options, onChange }) {
  return <div className="comp-editor__field"><span>{label}</span><div className="comp-editor__choices" role="group" aria-label={label}>{options.map(([id, name]) => <button type="button" key={String(id)} aria-pressed={value === id} onClick={() => onChange(id)}>{name}</button>)}</div></div>;
}
const yesNo = [[true, 'Mostrar'], [false, 'Ocultar']];

export default function ComplementosSectionUI({ theme, setPath, uploadToCloudinary }) {
  const section = useMemo(() => normalizeComplementosSection(theme?.sections?.find((s) => s.id === 'complementos' || s.type === 'complementos')), [theme]);
  const latest = useRef({ theme, section });
  latest.current = { theme, section };
  const [tab, setTab] = useState('contenido');
  const { config: c, style: s } = section;
  const commit = (patch) => {
    const { theme: currentTheme, section: current } = latest.current;
    const next = normalizeComplementosSection({ ...current, ...patch, config: { ...current.config, ...patch.config }, style: { ...current.style, ...patch.style } });
    const entries = [...(currentTheme?.sections || [])];
    const index = entries.findIndex((item) => item.id === 'complementos' || item.type === 'complementos');
    if (index < 0) entries.push(next); else entries[index] = next;
    setPath('sections', entries);
  };
  const config = (patch) => commit({ config: patch });
  const style = (patch) => commit({ style: patch });
  const range = (key, label, min, max, step) => <Slider key={key} label={label} min={min} max={max} step={step} value={s[key]} onChange={(v) => style({ [key]: v })} />;
  const color = (key, label) => <ColorField key={key} label={label} value={s[key]} onChange={(v) => style({ [key]: v })} />;
  const choose = (key, label, options) => <Choice label={label} value={s[key]} options={options} onChange={(v) => style({ [key]: v })} />;
  return <div className="comp-editor">
    <header className="comp-editor__intro"><Flower2 size={24} aria-hidden="true" /><div><h2>Complementos</h2><p>Elige qué quieres cambiar. Cada grupo muestra solo sus propios ajustes.</p></div></header>
    <SectionEditorSteps sectionName="Complementos" value={tab} onChange={setTab} items={[
      { value: 'contenido', label: 'Contenido', hint: 'Carga las imágenes, escribe los textos y elige la galería de destino.' },
      { value: 'estilos', label: 'Diseño', hint: 'Ajusta la composición y el cristal. Alterna Vista escritorio y Vista móvil en la vista previa.' },
    ]} />
    <div hidden={tab !== 'contenido'} className="comp-editor__stack">
      <SectionEditorCardTabs label="Contenido de Complementos" labels={['Textos', 'Imagen escritorio', 'Imagen móvil', 'Botón y galería']}>
        <Card title="Textos y visibilidad" hint="Guarda los cambios para aplicarlos en la tienda.">
          <Choice label="Sección en la tienda" value={section.enabled} options={[[true, 'Visible'], [false, 'Oculta']]} onChange={(enabled) => commit({ enabled })} />
          <Text label="Título" value={c.title} onChange={(e) => config({ title: e.target.value })} />
          <Choice label="Mostrar título" value={c.titleEnabled} options={yesNo} onChange={(titleEnabled) => config({ titleEnabled })} />
          <label className="comp-editor__field">Descripción<textarea value={c.subtitle} onChange={(e) => config({ subtitle: e.target.value })} rows={3} /></label>
          <Choice label="Mostrar descripción" value={c.subtitleEnabled} options={yesNo} onChange={(subtitleEnabled) => config({ subtitleEnabled })} />
          <Choice label="Adorno floral" value={c.dividerEnabled} options={yesNo} onChange={(dividerEnabled) => config({ dividerEnabled })} />
        </Card>
        <Card title="Imagen de escritorio" hint="La foto horizontal del banner. El encuadre se ajusta en Diseño → Composición → Foto y encuadre.">
          <ComplementosImageField label="Imagen de escritorio" value={c.imageSrc} onChange={(imageSrc) => config({ imageSrc })} uploadToCloudinary={uploadToCloudinary} />
          <Text label="Descripción de la imagen" value={c.imageAlt} onChange={(e) => config({ imageAlt: e.target.value })} />
          <Button kind="outline" onClick={() => config({ imageSrc: COMPLEMENTOS_SECTION_DEFAULTS.config.imageSrc, mobileImageSrc: COMPLEMENTOS_SECTION_DEFAULTS.config.mobileImageSrc })}>Usar imágenes predeterminadas</Button>
        </Card>
        <Card title="Imagen para móvil" hint="Una imagen vertical opcional. Los tamaños se ajustan en Diseño → Móvil.">
          <ComplementosImageField label="Imagen de móvil" value={c.mobileImageSrc} fallback={c.imageSrc} mobile onChange={(mobileImageSrc) => config({ mobileImageSrc })} uploadToCloudinary={uploadToCloudinary} />
        </Card>
        <Card title="Botón y galería" icon={MousePointer2}>
          <Text label="Texto del botón" placeholder="Conócelos" value={c.buttonText} onChange={(e) => config({ buttonText: e.target.value })} />
          <Text label="Enlace de la galería" placeholder="/complementos" value={c.linkHref} onChange={(e) => config({ linkHref: e.target.value })} />
          <p className="comp-editor__hint">Usa /complementos para la galería actual o pega una dirección https:// completa.</p>
          <Choice label="Mostrar botón" value={c.buttonEnabled} options={yesNo} onChange={(buttonEnabled) => config({ buttonEnabled })} />
        </Card>
      </SectionEditorCardTabs>
    </div>
    <div hidden={tab !== 'estilos'}>
      <SectionEditorCardTabs label="Diseño de Complementos" labels={['Composición', 'Textos y colores', 'Marco de cristal', 'Móvil', 'Botón y efectos']}>
        <SectionEditorSubgroups label="Qué ajustar en la composición" labels={["Distribución","Tamaño del banner","Foto y encuadre","Fondo de la sección","Márgenes y espacios"]}>
          <Card title="Distribución">
            {choose('layout', 'Presentación', [['frame', 'Marco de cristal'], ['immersive', 'Portada inmersiva'], ['floating', 'Cristal flotante']])}
            {choose('contentPosition', 'Ubicación del texto', [['left', 'Izquierda'], ['center', 'Centro'], ['right', 'Derecha']])}
            {choose('contentAlign', 'Alineación del texto', [['left', 'Izquierda'], ['center', 'Centro'], ['right', 'Derecha']])}
            {range('contentWidthPercent', 'Espacio para el texto (%)', 25, 70)}
          </Card>
          <Card title="Tamaño del banner">
            {range('imageHeightPx', 'Altura del banner (px)', 120, 800)}
            {range('contentMaxWidthPx', 'Ancho máximo (px)', 320, 1800)}
            {range('imageWidthPercent', 'Ancho del banner (%)', 20, 100)}
          </Card>
          <Card title="Foto y encuadre">
            {choose('imageObjectFit', 'Ajuste de la foto', [['cover', 'Llenar'], ['contain', 'Ver completa'], ['fill', 'Estirar']])}
            {range('imagePositionX', 'Encuadre horizontal (%)', 0, 100)}
            {range('imagePositionY', 'Encuadre vertical (%)', 0, 100)}
            {range('imageRadiusPx', 'Esquinas de escritorio (px)', 0, 48)}
            {choose('imageShadow', 'Sombra del banner', [[true, 'Con sombra'], [false, 'Sin sombra']])}
          </Card>
          <Card title="Fondo de la sección">
            {choose('sectionBackgroundMode', 'Fondo exterior de la sección', [['continuity', 'Continuar fondo de la selección de productos'], ['global', 'Fondo general de la tienda'], ['custom', 'Imagen propia'], ['color', 'Color propio']])}
            <p className="comp-editor__hint">El fondo cubre el espacio sobre el banner, los laterales y la parte inferior. Si cambias el fondo de la selección de productos, la continuidad se actualiza automáticamente.</p>
            {s.sectionBackgroundMode === 'custom' && <ComplementosImageField label="Fondo de la sección" value={c.sectionBackgroundImage} onChange={(sectionBackgroundImage) => config({ sectionBackgroundImage })} uploadToCloudinary={uploadToCloudinary} />}
            {['custom', 'color'].includes(s.sectionBackgroundMode) && color('sectionBackgroundColor', 'Color del fondo exterior')}
          </Card>
          <Card title="Márgenes y espacios">
            {range('contentPaddingPx', 'Espacio interior (px)', 16, 80)}
            {range('contentGapPx', 'Separación entre elementos (px)', 4, 40)}
            {range('sectionMarginTopPx', 'Espacio superior con fondo (px)', 0, 200)}
            {range('sectionPaddingBottomPx', 'Espacio inferior con fondo (px)', 0, 160)}
            {range('sectionPaddingXPx', 'Márgenes laterales de escritorio (px)', 0, 80)}
          </Card>
        </SectionEditorSubgroups>
        <SectionEditorSubgroups label="Qué ajustar: Textos y colores" labels={["Tipografía","Colores"]}>
          <Card title="Tipografía">
            <FontFamilyField label="Tipografía del título y botón" value={s.titleFontFamily} onChange={(v) => style({ titleFontFamily: v })} />
            {range('titleFontSizePx', 'Tamaño del título de escritorio (px)', 20, 100)}
            {range('titleWeight', 'Grosor del título', 100, 900, 100)}
            {range('subtitleFontSizePx', 'Tamaño de la descripción (px)', 10, 28)}
            {range('subtitleLetterSpacingPx', 'Separación de letras (px)', 0, 6, .1)}
          </Card>
          <Card title="Colores">
            {color('titleColor', 'Color del título y adorno')}
            {color('subtitleColor', 'Color de la descripción')}
            {color('bannerBg', 'Fondo detrás de la foto')}
            {color('overlayColor', 'Color sobre la foto')}
            {range('overlayOpacity', 'Intensidad del color sobre la foto (%)', 0, 80)}
          </Card>
        </SectionEditorSubgroups>
        <SectionEditorSubgroups label="Qué ajustar: Marco de cristal" labels={["Marco interior","Borde y contorno","Panel flotante"]}>
          <Card title="Marco interior">
            {choose('frameEnabled', 'Marco interior', yesNo)}
            {color('frameColor', 'Color del cristal')}
            {range('frameOpacity', 'Intensidad del marco (%)', 0, 100)}
            {range('frameWidthPx', 'Grosor del marco (px)', 0, 4, .5)}
            {range('frameInsetPx', 'Distancia del marco al borde (px)', 0, 48)}
          </Card>
          <Card title="Borde y contorno">
            {range('imageBorderPx', 'Grosor del borde exterior (px)', 0, 16)}
            {color('imageBorderColor', 'Color del borde exterior')}
            {range('ringWidthPx', 'Grosor del contorno exterior (px)', 0, 16)}
            {color('ringColor', 'Color del contorno exterior')}
          </Card>
          <Card title="Panel flotante">
            <p className="comp-editor__hint">El panel de cristal se usa en la presentación Cristal flotante.</p>
            {range('panelTintPercent', 'Tinte del panel flotante (%)', 0, 70)}
            {range('panelBlurPx', 'Desenfoque del panel flotante (px)', 0, 20)}
          </Card>
        </SectionEditorSubgroups>
        <SectionEditorSubgroups label="Qué ajustar en móvil" labels={["Imagen y encuadre","Tamaño de textos","Márgenes y espacios"]}>
          <Card title="Imagen y encuadre">
            {range('mobileHeightPx', 'Altura móvil (px)', 360, 900)}
            {choose('mobileContentPosition', 'Textos en móvil', [['bottom', 'Abajo'], ['top', 'Arriba']])}
            {choose('mobileImageObjectFit', 'Ajuste de la foto móvil', [['cover', 'Llenar'], ['contain', 'Ver completa']])}
            {range('mobileImagePositionX', 'Encuadre móvil horizontal (%)', 0, 100)}
            {range('mobileImagePositionY', 'Encuadre móvil vertical (%)', 0, 100)}
          </Card>
          <Card title="Tamaño de textos">
            {range('mobileTitleFontSizePx', 'Tamaño del título móvil (px)', 20, 64)}
            {range('mobileSubtitleFontSizePx', 'Tamaño de la descripción móvil (px)', 10, 24)}
            {range('mobileButtonFontSizePx', 'Tamaño del botón móvil (px)', 12, 24)}
          </Card>
          <Card title="Márgenes y espacios">
            {range('mobileContentPaddingPx', 'Espacio interior móvil (px)', 16, 48)}
            {range('mobileSectionPaddingXPx', 'Márgenes laterales móviles (px)', 0, 32)}
            {range('mobileImageRadiusPx', 'Esquinas móviles (px)', 0, 48)}
          </Card>
        </SectionEditorSubgroups>
        <SectionEditorSubgroups label="Qué ajustar: Botón de vidrio líquido" labels={["Cristal y colores","Tamaño y tipografía","Flecha y animación","Al pasar el cursor"]}>
          <Card title="Cristal y colores">
            {color('buttonBg', 'Color del tinte del botón')}
            {color('buttonTextColor', 'Color del texto del botón')}
            {range('buttonTintPercent', 'Intensidad del tinte (%)', 0, 85)}
            {range('buttonBlurPx', 'Desenfoque del botón (px)', 0, 20)}
            {color('buttonBorderColor', 'Color del borde del botón')}
            {range('buttonBorderPx', 'Grosor del borde del botón (px)', 0, 4, .5)}
            <Button kind="outline" onClick={() => style({ buttonTintPercent: 8, buttonBlurPx: 2, buttonBg: '#ffffff', buttonBorderColor: '#fff4ee', buttonBorderPx: 1 })}>Restaurar cristal transparente</Button>
          </Card>
          <Card title="Tamaño y tipografía">
            {range('buttonRadiusPx', 'Redondeado del botón (px)', 0, 32)}
            {range('buttonFontSizePx', 'Tamaño del texto del botón (px)', 10, 32)}
            {range('buttonFontWeight', 'Grosor del texto del botón', 100, 900, 100)}
            {range('buttonPx', 'Espacio a los lados del botón (px)', 8, 48)}
            {range('buttonPy', 'Espacio arriba y abajo del botón (px)', 6, 32)}
            {range('buttonGapPx', 'Separación de la flecha (px)', 0, 24)}
          </Card>
          <Card title="Flecha y animación">
            {choose('buttonArrowStyle', 'Flecha del botón', [['none', 'Sin flecha'], ['arrow-right', 'Clásica'], ['long-arrow', 'Larga'], ['chevron-right', 'Simple'], ['double-chevron', 'Doble'], ['spark-arrow', 'Con destello']])}
            {choose('buttonAnimation', 'Animación del botón', [['none', 'Sin animación'], ['glint', 'Destello de cristal'], ['soft-float', 'Flotación suave'], ['pulse', 'Pulso']])}
            {choose('buttonShadow', 'Sombra del botón', [[true, 'Con sombra'], [false, 'Sin sombra']])}
          </Card>
          <Card title="Al pasar el cursor">
            {color('buttonHoverBg', 'Tinte con el cursor')}
            {color('buttonHoverTextColor', 'Texto con el cursor')}
            {range('buttonHoverScale', 'Ampliación con el cursor', 1, 1.3, .01)}
            {choose('buttonHoverShadow', 'Sombra con el cursor', [[true, 'Con sombra'], [false, 'Sin sombra']])}
          </Card>
        </SectionEditorSubgroups>
      </SectionEditorCardTabs>
      <div className="comp-editor__restore"><Button kind="outline" onClick={() => style({ ...COMPLEMENTOS_SECTION_DEFAULTS.style })}>Restaurar diseño predeterminado</Button><p>Conserva las imágenes, los textos y el enlace que elegiste.</p></div>
    </div>
    <details className="comp-editor__reset"><summary>Restablecer toda la sección</summary><div className="comp-editor__preset"><Button kind="outline" onClick={() => commit({
      config: { ...COMPLEMENTOS_SECTION_DEFAULTS.config, linkHref: c.linkHref },
      style: { ...COMPLEMENTOS_SECTION_DEFAULTS.style },
    })}>Aplicar diseño predeterminado</Button><p className="comp-editor__hint">Restablece las imágenes y el diseño de la sección. Conserva el enlace de tu galería.</p></div></details>
  </div>;
}
