import { useState } from 'react';
import { LayoutPanelTop, Link2, Menu, Move, Share2, Sparkles, X } from 'lucide-react';
import CloudinaryImageField from '../general/CloudinaryImageField';
import { headerMenuDestination } from '../../../components/headerPresentation';

const OBJECTS = [
  { id: 'panel', label: 'Panel', detail: 'Forma y fondo', Icon: LayoutPanelTop },
  { id: 'links', label: 'Enlaces', detail: 'Texto y divisiones', Icon: Link2 },
  { id: 'feature', label: 'Tarjeta', detail: 'Destacado', Icon: Sparkles, atelierOnly: true },
  { id: 'trigger', label: 'Abrir menú', detail: 'Botón hamburguesa', Icon: Menu },
  { id: 'close', label: 'Cerrar menú', detail: 'Botón de cierre', Icon: X },
  { id: 'social', label: 'Redes y pie', detail: 'Parte inferior', Icon: Share2, drawerOnly: true },
  { id: 'motion', label: 'Movimiento', detail: 'Fondo y transición', Icon: Move },
];

const ATELIER_PALETTE = {
  mobileMenuBgColor: '#fff4f3',
  mobileMenuTextColor: '#4e1e39',
  mobileMenuMutedColor: '#815269',
  mobileMenuAccentColor: '#ac7950',
  mobileMenuItemBorderColor: '#d2a997',
  mobileMenuOverlayColor: '#54233d',
  mobileMenuOverlayOpacity: 0.22,
};

function Group({ title, description, children }) {
  return <section className="appearance-header__mobile-group">
    <div className="appearance-header__mobile-group-heading"><h4>{title}</h4>{description && <p>{description}</p>}</div>
    <div className="appearance-header__mobile-fields">{children}</div>
  </section>;
}

function Field({ label, children, hint, wide = false }) {
  return <label className="appearance-header__mobile-field" data-wide={wide || undefined}>
    <span>{label}</span>{children}{hint && <small>{hint}</small>}
  </label>;
}

function SelectField({ label, value, onChange, children, wide = false }) {
  return <Field label={label} wide={wide}><select value={value} onChange={onChange}>{children}</select></Field>;
}

function NumberField({ label, value, path, setPath, min, max, hint }) {
  return <Field label={label} hint={hint}>
    <input type="number" min={min} max={max} step="1" value={value}
      onChange={(event) => setPath(`header.${path}`, Number(event.target.value))}
      onBlur={() => setPath(`header.${path}`, Math.max(min, Math.min(max, Number(value) || 0)))} />
  </Field>;
}

function ColorField({ label, value, path, setPath, hint }) {
  const safeColor = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value || '') ? value : '#ffffff';
  const update = (event) => setPath(`header.${path}`, event.target.value);
  return <Field label={label} hint={hint}>
    <span className="appearance-header__mobile-color">
      <input type="color" value={safeColor} aria-label={`${label}: selector de color`} onChange={update} />
      <input type="text" value={value || ''} aria-label={`${label}: código de color`} placeholder="#FFFFFF" onChange={update} />
    </span>
  </Field>;
}

export default function MobileMenuEditor({ theme, setPath, menus, uploading, setUploading, savedRevision, uploadToCloudinaryViaBackend }) {
  const header = theme.header || {};
  const atelier = (header.mobileMenuLayout || 'atelier-sheet') === 'atelier-sheet';
  const [selected, setSelected] = useState('panel');
  const objects = OBJECTS.filter(({ atelierOnly, drawerOnly }) => (!atelierOnly || atelier) && (!drawerOnly || !atelier));
  const active = objects.find(({ id }) => id === selected) || objects[0];
  const change = (path) => (event) => setPath(`header.${path}`, event.target.value);
  const color = (label, path, fallback, hint) => <ColorField label={label} path={path} value={header[path] || fallback} setPath={setPath} hint={hint} />;
  const number = (label, path, fallback, min, max, hint) => <NumberField label={label} path={path} value={header[path] ?? fallback} min={min} max={max} setPath={setPath} hint={hint} />;

  return <div className="appearance-header__mobile-editor">
    <div className="appearance-header__mobile-intro">
      <strong>¿Qué quieres cambiar?</strong>
      <p>Elige una pieza del menú y edita aquí su forma, colores y tamaño. Para comprobarla, abre la vista previa en Móvil.</p>
    </div>
    <nav className="appearance-header__mobile-objects" aria-label="Piezas del menú móvil">
      {objects.map(({ id, label, detail, Icon }) => <button key={id} type="button" aria-pressed={active.id === id}
        onClick={() => setSelected(id)}>
        <Icon size={19} strokeWidth={1.7} aria-hidden="true" />
        <span><strong>{label}</strong><small>{detail}</small></span>
      </button>)}
    </nav>
    <div className="appearance-header__mobile-active" role="region" aria-label={`Editar ${active.label}`}>
      <div className="appearance-header__mobile-active-heading">
        <span>EDITANDO · {active.label.toUpperCase()}</span>
        <h3>{active.label}</h3><p>{active.detail}. Comprueba los cambios arriba antes de guardar.</p>
      </div>

      {active.id === 'panel' && <>
        <Group title="Diseño del menú" description="Define primero dónde se abre el menú.">
          <SelectField label="Comportamiento del panel móvil" value={header.mobileMenuLayout || 'atelier-sheet'} onChange={change('mobileMenuLayout')} wide>
            <option value="atelier-sheet">Atelier · cristal inferior</option>
            <option value="drawer-left">Panel desde la izquierda</option>
            <option value="drawer-right">Panel desde la derecha</option>
            <option value="center-panel">Panel centrado</option>
            <option value="full-screen">Pantalla completa</option>
          </SelectField>
          <p className="appearance-header__mobile-help">{atelier
            ? 'Atelier usa un contorno de cristal integrado. El color de fondo se mezcla con la imagen de la tienda.'
            : 'Este diseño usa un panel lateral o central; puedes ajustar su ancho, esquinas y borde.'}</p>
        </Group>
        <Group title="Superficie" description="Estos colores pertenecen solo al panel del menú.">
          {color('Color de fondo', 'mobileMenuBgColor', atelier ? '#fff4f3' : '#fffdfd')}
          {!atelier && <>
            {number('Ancho del panel (%)', 'mobileMenuWidthPercent', 88, 60, 100)}
            {number('Esquinas del panel (px)', 'mobileMenuRadiusPx', 0, 0, 40)}
            {number('Espacio interior (px)', 'mobileMenuPaddingPx', 20, 8, 40)}
            {number('Grosor del borde (px)', 'mobileMenuBorderWidthPx', 0, 0, 8, 'En 0 el borde no se muestra.')}
            {Number(header.mobileMenuBorderWidthPx ?? 0) > 0 && color('Color del borde', 'mobileMenuBorderColor', '#e7c2cf')}
          </>}
        </Group>
        {atelier && <button type="button" className="appearance-header__mobile-palette" onClick={() => {
          Object.entries(ATELIER_PALETTE).forEach(([key, value]) => setPath(`header.${key}`, value));
        }}>Aplicar paleta equilibrada de Atelier <span>Fondo, textos, separadores y sombra</span></button>}
      </>}

      {active.id === 'links' && <>
        <Group title="Lectura de los enlaces" description="Texto, acentos y fuente del contenido del menú.">
          {color('Texto principal', 'mobileMenuTextColor', atelier ? '#4e1e39' : '#1f1f1f')}
          {color('Texto secundario', 'mobileMenuMutedColor', atelier ? '#815269' : '#8a6b74')}
          {atelier && color('Íconos y acentos', 'mobileMenuAccentColor', '#ac7950')}
          <Field label="Fuente del menú" wide><input type="text" value={header.mobileMenuFontFamily || ''}
            onChange={change('mobileMenuFontFamily')} placeholder="Georgia, serif" /></Field>
        </Group>
        <Group title="Divisiones entre enlaces" description="Una sola línea separa los enlaces y las acciones del pie.">
          {number('Grosor de las divisiones (px)', 'mobileMenuItemBorderWidthPx', 1, 0, 6, 'En 0 desaparecen las líneas.')}
          {Number(header.mobileMenuItemBorderWidthPx ?? 1) > 0 && color('Color de las divisiones', 'mobileMenuItemBorderColor', atelier ? '#d2a997' : '#e7c2cf')}
        </Group>
      </>}

      {active.id === 'feature' && <Group title="Tarjeta destacada" description="Aparece dentro del menú Atelier y abre uno de tus enlaces públicos.">
        <SelectField label="Enlace que abre la tarjeta" value={header.mobileMenuFeatureRef || ''} onChange={change('mobileMenuFeatureRef')} wide>
          <option value="">Automático: primer enlace disponible</option>
          {(menus?.header || []).filter((item) => item?.ref !== '/' && headerMenuDestination(item?.ref)?.isExternal === false)
            .map((item, index) => <option value={item.ref} key={`${item.ref}-${index}`}>{item.title || item.ref}</option>)}
        </SelectField>
        <div className="appearance-header__mobile-upload"><CloudinaryImageField label="Imagen de tarjeta destacada del menú móvil"
          value={header.mobileMenuFeatureImage || ''} fallbackPreview="/atelier/feature-satin.webp"
          onChange={(url) => setPath('header.mobileMenuFeatureImage', url)} onUpload={uploadToCloudinaryViaBackend}
          uploading={uploading} setUploading={setUploading} savedRevision={savedRevision} /></div>
        <p className="appearance-header__mobile-help">Si no cargas una imagen, se muestra la textura satinada incluida en el diseño.</p>
      </Group>}

      {active.id === 'trigger' && <>
        <Group title="Tamaño y forma" description="Este botón abre el menú desde el encabezado.">
          {number('Tamaño del botón (px)', 'mobileMenuTriggerSizePx', 40, 32, 80)}
          {number('Tamaño del ícono (px)', 'mobileMenuTriggerIconSizePx', 20, 14, 36)}
          {number('Redondeo (px)', 'mobileMenuTriggerRadiusPx', 999, 0, 999, '999 = completamente redondo.')}
        </Group>
        <Group title="Colores y borde" description="Solo afectan al botón que abre el menú.">
          {color('Fondo del botón', 'mobileMenuTriggerBgColor', '#ffffff')}
          {color('Ícono del botón', 'mobileMenuTriggerIconColor', '#8d5c6b')}
          {number('Grosor del borde (px)', 'mobileMenuTriggerBorderWidthPx', 1, 0, 8)}
          {Number(header.mobileMenuTriggerBorderWidthPx ?? 1) > 0 && color('Color del borde', 'mobileMenuTriggerBorderColor', '#d3a7b7')}
        </Group>
      </>}

      {active.id === 'close' && <Group title="Botón de cierre" description="La X para cerrar el menú está dentro del panel.">
        {color('Color de la X', 'mobileMenuCloseIconColor', '#8d5c6b')}
        {!atelier && <>
          {color('Fondo del botón', 'mobileMenuCloseBgColor', '#ffffff')}
          {number('Grosor del borde (px)', 'mobileMenuCloseBorderWidthPx', 1, 0, 8)}
          {Number(header.mobileMenuCloseBorderWidthPx ?? 1) > 0 && color('Color del borde', 'mobileMenuCloseBorderColor', '#e7c2cf')}
          {number('Redondeo (px)', 'mobileMenuCloseRadiusPx', 999, 0, 999, '999 = completamente redondo.')}
        </>}
        {atelier && <p className="appearance-header__mobile-help">En Atelier, la X conserva el cristal transparente del panel. Puedes personalizar su color aquí.</p>}
      </Group>}

      {active.id === 'social' && <Group title="Redes sociales y pie" description="Solo aparecen cuando hay redes configuradas en la tienda.">
        {color('Fondo de los botones', 'mobileMenuSocialBg', '#c98ea2')}
        {color('Color de los íconos', 'mobileMenuSocialIconColor', '#ffffff')}
        {number('Tamaño de los botones (px)', 'mobileMenuSocialSizePx', 44, 28, 72)}
        {number('Tamaño del texto del pie (px)', 'mobileMenuFooterTextSizePx', 13, 10, 20)}
      </Group>}

      {active.id === 'motion' && <>
        <Group title="Fondo al abrir" description="Se aplica detrás del panel para distinguirlo de la tienda.">
          {color('Color del fondo detrás del menú', 'mobileMenuOverlayColor', atelier ? '#54233d' : '#000000')}
          <Field label="Intensidad del fondo" wide>
            <span className="appearance-header__mobile-range">
              <input type="range" min="0" max="1" step="0.01" value={header.mobileMenuOverlayOpacity ?? (atelier ? 0.22 : 0.35)}
                onChange={(event) => setPath('header.mobileMenuOverlayOpacity', Number(event.target.value))} />
              <output>{Math.round((header.mobileMenuOverlayOpacity ?? (atelier ? 0.22 : 0.35)) * 100)}%</output>
            </span>
          </Field>
        </Group>
        <Group title="Entrada del menú" description="La duración afecta la apertura y el cierre.">
          {!atelier && <SelectField label="Efecto de entrada" value={['fade', 'scale', 'slide-fade'].includes(header.mobileMenuAnimation) ? header.mobileMenuAnimation : 'slide-left'} onChange={change('mobileMenuAnimation')}>
            <option value="slide-left">Deslizar desde el lado del panel</option>
            <option value="fade">Desvanecer</option><option value="scale">Escala suave</option>
            <option value="slide-fade">Deslizar y desvanecer</option>
          </SelectField>}
          {number('Duración (ms)', 'mobileMenuAnimationDurationMs', 300, 120, 1200)}
          {atelier && <p className="appearance-header__mobile-help">Atelier siempre se desliza desde abajo para conservar su diseño.</p>}
        </Group>
      </>}
    </div>
  </div>;
}
