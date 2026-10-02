// frontend/src/admin/appearance/header/HeaderPanel.jsx
import React, { useMemo, useState } from "react";
import { Image, Link2, Palette, Smartphone } from 'lucide-react';
import CloudinaryImageField from '../general/CloudinaryImageField';
import HeaderPreview from './HeaderPreview';
import { HEADER_FONT_PRESETS, isDarkHeaderBackground, resolveHeaderTypography } from '../../../components/headerPresentation';
import { HEADER_ICON_SETS, HeaderActionGlyph, getHeaderIconSource, resolveHeaderIcons } from '../../../components/HeaderActionIcons';
import { headerSearchColorVariables, resolveHeaderSearchColors } from '../../../components/headerSearchTheme';
import { MOBILE_MENU_ICON_OPTIONS, MobileMenuLinkIcon, normalizeMobileMenuIcon } from '../../../components/mobileMenuIcons';
import '../../../components/headerSearch.css';
import './headerWorkspace.css';
import '../general/appearanceGeneral.css';

const Input = ({ label, ...rest }) => (
  <label className="block min-w-0">
    <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
    <input
      className="w-full min-w-0 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-pink-300 focus:ring-2 focus:ring-pink-200"
      {...rest}
    />
  </label>
);

const Select = ({ label, children, ...rest }) => (
  <label className="block min-w-0">
    <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
    <select
      className="w-full min-w-0 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-pink-300 focus:ring-2 focus:ring-pink-200"
      {...rest}
    >
      {children}
    </select>
  </label>
);

const ColorInput = ({ value, onChange }) => {
  const isHex = (v) =>
    typeof v === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v.trim());

  const safeColor = isHex(value) ? value : "#ffffff";

  return (
    <div className="grid min-w-0 grid-cols-[56px_1fr] gap-3">
      <input
        type="color"
        className="h-11 w-14 rounded-lg border border-gray-300 bg-white"
        value={safeColor}
        onChange={onChange}
      />
      <input
        className="w-full min-w-0 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-pink-300 focus:ring-2 focus:ring-pink-200"
        value={value || ""}
        onChange={onChange}
        placeholder="#FFFFFF"
      />
    </div>
  );
};

const SectionHeader = ({ title, description }) => (
  <div className="mb-3">
    <div>
      <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
      <p className="mt-1 text-sm text-gray-500">{description}</p>
    </div>

  </div>
);

const MainTabButton = ({ active, label, description, onClick, Icon }) => (
  <button
    type="button"
    onClick={onClick}
    className="appearance-panel-main-tab"
    aria-pressed={active}
    data-active={active}
  >
    <span className="appearance-header__tab-icon"><Icon size={22} aria-hidden="true" /></span>
    <span><strong>{label}</strong><small>{description}</small></span>
  </button>
);

const SubTabButton = ({ active, label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="appearance-panel-sub-tab"
    aria-pressed={active}
    data-active={active}
  >
    {label}
  </button>
);

const PanelBlock = ({ title, children, columns = 2 }) => (
  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
    <div className="mb-4 text-sm font-semibold text-gray-800">{title}</div>
    <div
      className={[
        "grid min-w-0 gap-4",
        columns === 1 ? "grid-cols-1" : "grid-cols-1 xl:grid-cols-2",
      ].join(" ")}
    >
      {children}
    </div>
  </div>
);

export default function HeaderPanel({
  theme,
  setPath,
  menus,
  routeOptions,
  uploading,
  setUploading,
  savedRevision,
  uploadToCloudinaryViaBackend,
  addHeaderMenuItem,
  removeHeaderMenuItem,
  moveHeaderMenuItem,
  setHeaderMenuItem,
  canEditTheme = true,
  canEditMenus = true,
}) {
  const mainTabs = useMemo(
    () => [
      {
        id: "branding",
        label: "Identidad",
        description: "Logos, tamaño y fondo.",
        Icon: Image,
      },
      {
        id: "styles",
        label: "Estilo",
        description: "Fuente, colores y movimiento.",
        Icon: Palette,
      },
      {
        id: "responsive",
        label: "Menú móvil",
        description: "Panel, controles y transición.",
        Icon: Smartphone,
      },
      {
        id: "menu",
        label: "Enlaces",
        description: "Destinos y orden visibles.",
        Icon: Link2,
      },
    ],
    []
  );

  const [activeMainTab, setActiveMainTab] = useState("branding");
  const [brandingSubTab, setBrandingSubTab] = useState("logo");
  const [stylesSubTab, setStylesSubTab] = useState("tipografia");
  const [responsiveSubTab, setResponsiveSubTab] = useState("estructura");
  const searchColors = resolveHeaderSearchColors(theme.header, theme.colors);
  const iconSelection = resolveHeaderIcons(theme.header);
  const logoMode = theme.header?.logoMode || 'auto';
  const preferredLogo = logoMode === 'auto'
    ? (isDarkHeaderBackground(theme.header?.bgColor) ? 'claro' : 'oscuro')
    : (logoMode === 'light' ? 'claro' : 'oscuro');
  const lightLogo = theme.header?.logoLight || theme.logo?.light || '';
  const darkLogo = theme.header?.logoDark || theme.logo?.dark || '';
  const isAtelierLayout = (theme.header?.mobileMenuLayout || 'atelier-sheet') === 'atelier-sheet';

  return (
    <div className="appearance-header min-w-0">
      <div className="appearance-header__shell rounded-2xl p-3 md:p-4">
        <SectionHeader
          title="Logo y menú"
          description="Diseña y comprueba cómo queda el encabezado en escritorio y móvil."
        />

        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {mainTabs.map((tab) => (
            <MainTabButton
              key={tab.id}
              active={activeMainTab === tab.id}
              label={tab.label}
              description={tab.description}
              Icon={tab.Icon}
              onClick={() => setActiveMainTab(tab.id)}
            />
          ))}
        </div>

        <div data-admin-storefront-preview="true"><HeaderPreview theme={theme} menus={menus} /></div>

        <fieldset disabled={!canEditTheme}>
        {activeMainTab === "branding" && (
          <section className="mt-3 rounded-2xl border border-gray-200 bg-white p-3 md:p-4">
            <div className="mb-3 flex flex-wrap gap-2">
              <SubTabButton
                active={brandingSubTab === "logo"}
                label="Logo"
                onClick={() => setBrandingSubTab("logo")}
              />
              <SubTabButton
                active={brandingSubTab === "fondo"}
                label="Fondo"
                onClick={() => setBrandingSubTab("fondo")}
              />
              <SubTabButton
                active={brandingSubTab === "forma"}
                label="Forma y vidrio"
                onClick={() => setBrandingSubTab("forma")}
              />
            </div>

            <div className="space-y-4">
              {brandingSubTab === "logo" && (
                <>
                  <div className="appearance-header__logo-grid">
                    <div><p className="appearance-header__logo-hint">Para fondos oscuros · logo claro</p>
                      <CloudinaryImageField label="Logo claro" value={theme.header?.logoLight || ''}
                        onChange={(url) => setPath('header.logoLight', url)} onUpload={uploadToCloudinaryViaBackend}
                        uploading={uploading} setUploading={setUploading} savedRevision={savedRevision} /></div>
                    <div><p className="appearance-header__logo-hint">Para fondos claros · logo oscuro</p>
                      <CloudinaryImageField label="Logo oscuro" value={theme.header?.logoDark || ''}
                        onChange={(url) => setPath('header.logoDark', url)} onUpload={uploadToCloudinaryViaBackend}
                        uploading={uploading} setUploading={setUploading} savedRevision={savedRevision} /></div>
                  </div>
                  <div className="appearance-header__logo-choice">
                    <strong>¿Qué logo debe mostrar el encabezado?</strong>
                    <div role="group" aria-label="Versión de logo visible" className="appearance-header__logo-options">
                      {[
                        { value: 'auto', title: 'Automático', detail: 'Según el color del fondo' },
                        { value: 'light', title: 'Logo claro', detail: 'Siempre priorizar claro' },
                        { value: 'dark', title: 'Logo oscuro', detail: 'Siempre priorizar oscuro' },
                      ].map(({ value, title, detail }) => <button type="button" key={value} aria-pressed={logoMode === value}
                        onClick={() => setPath('header.logoMode', value)}><strong>{title}</strong><small>{detail}</small></button>)}
                    </div>
                    <p className="appearance-header__logo-current">Ahora se prioriza el <strong>logo {preferredLogo}</strong>.{logoMode === 'auto' && ' En fondos transparentes puedes elegir una versión fija.'}</p>
                    {preferredLogo === 'claro' && !lightLogo && darkLogo && <p role="status" className="appearance-header__logo-warning">No has cargado el logo claro. Se verá el oscuro hasta que lo cargues.</p>}
                    {preferredLogo === 'oscuro' && !darkLogo && lightLogo && <p role="status" className="appearance-header__logo-warning">No has cargado el logo oscuro. Se verá el claro hasta que lo cargues.</p>}
                    {lightLogo && darkLogo && lightLogo === darkLogo && <p role="status" className="appearance-header__logo-warning">Ambas versiones usan la misma imagen. Carga archivos diferentes para ver el cambio.</p>}
                  </div>

                  <PanelBlock title="Tamaño del logo" columns={1}>
                    <div className="rounded-2xl border bg-white p-4">
                      <div className="mb-2 text-sm font-medium text-gray-800">
                        Tamaño del logo (alto en px)
                      </div>

                      <div className="grid min-w-0 grid-cols-[1fr_96px] items-center gap-3">
                        <input
                          type="range"
                          min="30"
                          max="160"
                          step="1"
                          value={theme.header?.logoHeightPx ?? 80}
                          onChange={(e) =>
                            setPath("header.logoHeightPx", Number(e.target.value))
                          }
                          className="w-full min-w-0"
                        />
                        <input
                          type="number"
                          min="30"
                          max="160"
                          step="1"
                          value={theme.header?.logoHeightPx ?? 80}
                          onChange={(e) =>
                            setPath("header.logoHeightPx", Number(e.target.value))
                          }
                          className="w-24 rounded-xl border border-gray-300 bg-white px-3 py-2.5"
                        />
                      </div>

                      <div className="mt-2 text-xs text-gray-500">La vista previa cambia al mover la barra. Guarda para publicarlo.</div>
                    </div>
                  </PanelBlock>
                </>
              )}

              {brandingSubTab === "fondo" && (
                <PanelBlock title="Fondo del header" columns={1}>
                  <label className="block min-w-0">
                    <span className="mb-1 block text-sm font-medium text-gray-700">
                      Color de fondo del header
                    </span>
                    <ColorInput
                      value={theme.header?.bgColor || ""}
                      onChange={(e) => setPath("header.bgColor", e.target.value)}
                    />
                  </label>

                  <div className="rounded-2xl border bg-white p-4">
                    <div className="mb-1 text-sm font-medium text-gray-700">
                      Transparencia (0 = invisible, 1 = sólido)
                    </div>
                    <div className="grid min-w-0 grid-cols-[1fr_96px] items-center gap-3">
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={theme.header?.bgOpacity ?? 1}
                        onChange={(e) => setPath("header.bgOpacity", Number(e.target.value))}
                        className="w-full min-w-0"
                      />
                      <input
                        type="number"
                        min="0"
                        max="1"
                        step="0.01"
                        value={theme.header?.bgOpacity ?? 1}
                        onChange={(e) => setPath("header.bgOpacity", Number(e.target.value))}
                        className="w-24 rounded-xl border border-gray-300 bg-white px-3 py-2.5"
                      />
                    </div>
                  </div>
                </PanelBlock>
              )}

              {brandingSubTab === "forma" && (
                <div className="appearance-header__surface-editor">
                  <div>
                    <h3>Forma del encabezado</h3>
                    <p>Elige cómo se integra con la parte superior de la tienda.</p>
                  </div>
                  <div className="appearance-header__surface-options" role="group" aria-label="Forma del encabezado">
                    {[
                      { value: 'attached', label: 'Ancho completo', detail: 'Unido a los bordes de la pantalla.' },
                      { value: 'floating', label: 'Flotante', detail: 'Separado del borde, con relieve alrededor.' },
                    ].map(({ value, label, detail }) => (
                      <button key={value} type="button" aria-pressed={(theme.header?.surfaceShape || 'attached') === value}
                        onClick={() => setPath('header.surfaceShape', value)}>
                        <span className={`appearance-header__shape-icon appearance-header__shape-icon--${value}`} aria-hidden="true" />
                        <strong>{label}</strong><small>{detail}</small>
                      </button>
                    ))}
                  </div>
                  <label className="appearance-header__surface-slider">
                    <span><strong>Redondeo de bordes</strong><output>{theme.header?.cornerRadiusPx ?? 16} px</output></span>
                    <input type="range" aria-label="Redondeo de bordes" min="0" max="48" step="1" value={theme.header?.cornerRadiusPx ?? 16}
                      onChange={(event) => setPath('header.cornerRadiusPx', Number(event.target.value))} />
                  </label>
                  <label className="appearance-header__glass-switch">
                    <span><strong>Vidrio líquido con relieve 3D</strong><small>Reflejos, profundidad y transparencia sobre la imagen de la tienda.</small></span>
                    <input type="checkbox" aria-label="Vidrio líquido con relieve 3D" checked={theme.header?.liquidGlassEnabled === true}
                      onChange={(event) => setPath('header.liquidGlassEnabled', event.target.checked)} />
                  </label>
                  {theme.header?.liquidGlassEnabled && (
                    <label className="appearance-header__surface-slider">
                      <span><strong>Intensidad del brillo y desenfoque</strong><output>{theme.header?.glassStrength ?? 75}%</output></span>
                      <input type="range" aria-label="Intensidad del brillo y desenfoque" min="0" max="100" step="1" value={theme.header?.glassStrength ?? 75}
                        onChange={(event) => setPath('header.glassStrength', Number(event.target.value))} />
                    </label>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {activeMainTab === "styles" && (
          <section className="mt-3 rounded-2xl border border-gray-200 bg-white p-3 md:p-4">
            <div className="mb-3 flex flex-wrap gap-2">
              <SubTabButton
                active={stylesSubTab === "tipografia"}
                label="Tipografía"
                onClick={() => setStylesSubTab("tipografia")}
              />
              <SubTabButton
                active={stylesSubTab === "menu"}
                label="Menú"
                onClick={() => setStylesSubTab("menu")}
              />
              <SubTabButton
                active={stylesSubTab === "buscador"}
                label="Buscador"
                onClick={() => setStylesSubTab("buscador")}
              />
              <SubTabButton
                active={stylesSubTab === "iconos"}
                label="Íconos"
                onClick={() => setStylesSubTab("iconos")}
              />
            </div>

            <div className="space-y-4">
              {stylesSubTab === "tipografia" && (
                <PanelBlock title="Personalidad del menú" columns={1}>
                  <p className="appearance-header__font-intro">Cuatro formas de letra distintas, mostradas a tamaño de menú. Elige una y mira arriba cómo queda.</p>
                  <div className="appearance-header__font-grid" role="group" aria-label="Modelos de tipografía">
                    {Object.entries(HEADER_FONT_PRESETS).map(([key, preset]) => (
                      <button key={key} type="button" className="appearance-header__font-option"
                        aria-pressed={theme.header?.fontPreset === key && !theme.header?.fontFamily}
                        onClick={() => { setPath('header.fontPreset', key); setPath('header.fontFamily', ''); }}>
                        <span className="appearance-header__font-option-heading"><strong>{preset.label}</strong><small>{preset.description}</small></span>
                        <span className="appearance-header__font-example" style={{ fontFamily: preset.family, fontWeight: preset.weight, fontStyle: preset.style, letterSpacing: preset.spacing, textTransform: preset.transform }}>Lo Nuevo · Boutique</span>
                      </button>
                    ))}
                  </div>
                  <div className="appearance-header__font-detail">
                    <strong>Texto seleccionado · tamaño real</strong>
                    <span style={{ ...resolveHeaderTypography(theme.header), fontSize: `${theme.header?.fontSizePx ?? 16}px` }}>Lo Nuevo · Colecciones · Boutique</span>
                  </div>
                  <Input label="Tamaño del texto del menú (px)" type="number" min={12} max={30} step="1"
                    value={theme.header?.fontSizePx ?? 16}
                    onChange={(e) => setPath("header.fontSizePx", Number(e.target.value))} />
                  <div>
                    <Input
                      label="Fuente personalizada (CSS font-family) — opcional"
                      value={theme.header?.fontFamily || ""}
                      onChange={(e) => setPath("header.fontFamily", e.target.value)}
                      placeholder='"Playfair Display", Georgia, serif'
                    />
                    {theme.header?.fontFamily && <p className="mt-2 text-xs text-gray-500">La fuente personalizada tiene prioridad. Selecciona un modelo para volver a usarlo.</p>}
                  </div>
                </PanelBlock>
              )}

              {stylesSubTab === "menu" && (
                <PanelBlock title="Menú (colores y animación)">
                  <label className="block min-w-0">
                    <span className="mb-1 block text-sm font-medium text-gray-700">
                      Color de texto (menú)
                    </span>
                    <ColorInput
                      value={theme.header?.textColor || ""}
                      onChange={(e) => setPath("header.textColor", e.target.value)}
                    />
                  </label>

                  <label className="block min-w-0">
                    <span className="mb-1 block text-sm font-medium text-gray-700">
                      Color hover (menú)
                    </span>
                    <ColorInput
                      value={theme.header?.linkColor || ""}
                      onChange={(e) => setPath("header.linkColor", e.target.value)}
                    />
                  </label>

                  <div className="xl:col-span-2">
                    <Select
                      label="Animación del menú"
                      value={theme.header?.menuAnimation || "soft"}
                      onChange={(e) => setPath("header.menuAnimation", e.target.value)}
                    >
                      <option value="none">Sin animación</option>
                      <option value="soft">Suave</option>
                      <option value="float">Flotar</option>
                      <option value="rotate">Giro suave</option>
                      <option value="pop">Pop (más fuerte)</option>
                    </Select>
                  </div>
                </PanelBlock>
              )}

              {stylesSubTab === "buscador" && (
                <PanelBlock title="Colores de la barra de búsqueda">
                  <p className="xl:col-span-2 text-xs text-gray-600">Por defecto, el buscador sigue los colores del encabezado. Cambia solo los que quieras personalizar; al pulsar «Usar colores del tema», vuelve a seguirlos.</p>
                  {[
                    ['searchBgColor', 'Fondo', searchColors.background],
                    ['searchTextColor', 'Texto', searchColors.text],
                    ['searchAccentColor', 'Flecha y enfoque', searchColors.accent],
                    ['searchBorderColor', 'Borde', searchColors.border],
                  ].map(([key, label, fallback]) => <label className="block min-w-0" key={key}>
                    <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
                    <ColorInput value={theme.header?.[key] || fallback} onChange={(event) => setPath(`header.${key}`, event.target.value)} />
                  </label>)}
                  <button type="button" className="w-fit rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 xl:col-span-2" onClick={() => {
                    ['searchBgColor', 'searchTextColor', 'searchAccentColor', 'searchBorderColor'].forEach((key) => setPath(`header.${key}`, ''));
                  }}>Usar colores del tema</button>
                  <div className="relative min-h-16 rounded-xl p-3 xl:col-span-2" style={{ ...headerSearchColorVariables(theme.header, theme.colors), background: theme.header?.bgColor || '#ffe3ec' }}>
                    <div className="header-search-form max-w-[244px]" aria-label="Vista previa de colores del buscador">
                      <span style={{ flex: 1, color: searchColors.text, fontSize: 12 }}>Buscar productos...</span>
                      <span className="grid h-[31px] w-[31px] place-items-center rounded-full" style={{ color: searchColors.accent, background: `color-mix(in srgb, ${searchColors.background} 70%, white)` }} aria-hidden="true">→</span>
                    </div>
                  </div>
                </PanelBlock>
              )}

              {stylesSubTab === "iconos" && (
                <div className="appearance-header__icon-editor">
                  <div className="appearance-header__icon-heading"><strong>Elige tus íconos</strong><span>Compara búsqueda, favoritos y carrito en cuatro estilos. Puedes cambiar cada imagen por separado.</span></div>
                  <div className="appearance-header__icon-options" role="group" aria-label="Modelo de íconos">
                    {HEADER_ICON_SETS.map(({ value, label, description }) => <button key={value} type="button" aria-pressed={iconSelection === value}
                      onClick={() => setPath('header.iconSet', value)} className="appearance-header__icon-option">
                      <span className="appearance-header__icon-samples" aria-hidden="true">
                        {['search', 'favorites', 'cart'].map((kind) => <span className="storefront-action-button" key={kind}>
                          <HeaderActionGlyph kind={kind} iconSet={value} iconOverrides={theme.header?.iconOverrides} /></span>)}
                      </span><strong>{label}</strong><small>{description}</small>
                    </button>)}
                  </div>
                  <div className="appearance-header__custom-icons">
                    <strong>Personaliza {HEADER_ICON_SETS.find(({ value }) => value === iconSelection)?.label || 'este juego'}</strong>
                    <p>Selecciona una imagen para reemplazar solo ese icono. Si la quitas, vuelve al diseño original del juego. Se recomienda PNG o WebP transparente y cuadrado.</p>
                    <div className="appearance-header__custom-icon-fields">
                      {[
                        ['search', 'Búsqueda'],
                        ['favorites', 'Favoritos'],
                        ['cart', 'Bolsa de compras'],
                      ].map(([kind, label]) => <CloudinaryImageField key={`${iconSelection}-${kind}`} label={`Icono de ${label}`}
                        value={theme.header?.iconOverrides?.[iconSelection]?.[kind] || ''}
                        fallbackPreview={getHeaderIconSource(iconSelection, kind)}
                        onChange={(url) => setPath(`header.iconOverrides.${iconSelection}.${kind}`, url)}
                        onUpload={uploadToCloudinaryViaBackend} uploading={uploading} setUploading={setUploading} savedRevision={savedRevision} transparentOnly />)}
                    </div>
                  </div>
                  <div className="appearance-header__icon-controls">
                    <strong>Tamaño y movimiento</strong>
                    <label className="appearance-header__icon-size">
                      <span>Tamaño en la tienda <output>{theme.header?.iconSizePx ?? 34} px</output></span>
                      <input type="range" aria-label="Tamaño en la tienda" min="28" max="40" step="1" value={theme.header?.iconSizePx ?? 34}
                        onChange={(e) => setPath('header.iconSizePx', Number(e.target.value))} />
                    </label>
                  <div>
                    <Select
                      label="Animación de íconos"
                      value={theme.header?.iconAnimation || "soft"}
                      onChange={(e) => setPath("header.iconAnimation", e.target.value)}
                    >
                      <option value="none">Sin animación</option>
                      <option value="soft">Suave</option>
                      <option value="float">Flotar</option>
                      <option value="rotate">Giro suave</option>
                      <option value="pop">Pop (más fuerte)</option>
                    </Select>
                  </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {activeMainTab === "responsive" && (
          <section className="mt-3 rounded-2xl border border-gray-200 bg-white p-3 md:p-4">
            <div className="mb-3 flex flex-wrap gap-2">
              <SubTabButton
                active={responsiveSubTab === "estructura"}
                label="Estructura"
                onClick={() => setResponsiveSubTab("estructura")}
              />
              <SubTabButton
                active={responsiveSubTab === "estilo"}
                label="Estilo visual"
                onClick={() => setResponsiveSubTab("estilo")}
              />
              <SubTabButton
                active={responsiveSubTab === "bordes"}
                label="Bordes y radios"
                onClick={() => setResponsiveSubTab("bordes")}
              />
              <SubTabButton
                active={responsiveSubTab === "botones"}
                label="Redes y pie"
                onClick={() => setResponsiveSubTab("botones")}
              />
              <SubTabButton
                active={responsiveSubTab === "animacion"}
                label="Animación"
                onClick={() => setResponsiveSubTab("animacion")}
              />
            </div>

            <div className="space-y-4">
              {responsiveSubTab === "estructura" && (
                <>
                  <PanelBlock title="Botón hamburguesa">
                    <Select
                      label="Estilo del botón hamburguesa"
                      value={theme.header?.mobileMenuTriggerStyle || "soft-circle"}
                      onChange={(e) => setPath("header.mobileMenuTriggerStyle", e.target.value)}
                    >
                      <option value="soft-circle">Círculo suave</option>
                      <option value="outline-circle">Círculo con borde</option>
                      <option value="soft-square">Cuadrado suave</option>
                      <option value="minimal">Minimalista</option>
                      <option value="luxury">Elegante / lujo</option>
                    </Select>

                    <Select
                      label="Tipo de icono hamburguesa"
                      value={theme.header?.mobileMenuTriggerIcon || "classic"}
                      onChange={(e) => setPath("header.mobileMenuTriggerIcon", e.target.value)}
                    >
                      <option value="classic">Tres líneas clásicas</option>
                      <option value="rounded">Tres líneas redondeadas</option>
                      <option value="thin">Tres líneas finas</option>
                      <option value="bold">Tres líneas gruesas</option>
                    </Select>

                    <Input
                      label="Tamaño del botón hamburguesa (px)"
                      type="number"
                      min={32}
                      max={80}
                      step="1"
                      value={theme.header?.mobileMenuTriggerSizePx ?? 44}
                      onChange={(e) =>
                        setPath("header.mobileMenuTriggerSizePx", Number(e.target.value))
                      }
                    />

                    <Input
                      label="Tamaño del icono hamburguesa (px)"
                      type="number"
                      min={14}
                      max={36}
                      step="1"
                      value={theme.header?.mobileMenuTriggerIconSizePx ?? 20}
                      onChange={(e) =>
                        setPath("header.mobileMenuTriggerIconSizePx", Number(e.target.value))
                      }
                    />
                  </PanelBlock>

                  <PanelBlock title="Panel móvil">
                    <Select
                      label="Comportamiento del panel móvil"
                      value={theme.header?.mobileMenuLayout || 'atelier-sheet'}
                      onChange={(e) => {
                        setPath("header.mobileMenuLayout", e.target.value);
                        if (e.target.value === 'atelier-sheet') {
                          setPath('header.mobileMenuBgColor', '#fff4f3');
                          setPath('header.mobileMenuTextColor', '#4e1e39');
                          setPath('header.mobileMenuMutedColor', '#815269');
                          setPath('header.mobileMenuAccentColor', '#ac7950');
                          setPath('header.mobileMenuItemBorderColor', '#d2a997');
                          setPath('header.mobileMenuOverlayColor', '#54233d');
                          setPath('header.mobileMenuOverlayOpacity', 0.22);
                        }
                      }}
                    >
                      <option value="drawer-left">Drawer desde la izquierda</option>
                      <option value="drawer-right">Drawer desde la derecha</option>
                      <option value="center-panel">Panel centrado</option>
                      <option value="full-screen">Pantalla completa</option>
                      <option value="atelier-sheet">Atelier · cristal inferior</option>
                    </Select>
                    {isAtelierLayout ? <p className="self-center text-sm text-gray-700">Panel inferior de cristal con los enlaces reales de tu tienda. Elige los íconos en <strong>Enlaces</strong> y revisa la vista <strong>Móvil</strong> arriba.</p> : <>
                      <Input
                        label="Ancho del menú móvil (%)" type="number" min={60} max={100} step="1"
                        value={theme.header?.mobileMenuWidthPercent ?? 88}
                        onChange={(e) => setPath("header.mobileMenuWidthPercent", Number(e.target.value))}
                      />
                      <Input
                        label="Radio general del panel (px)" type="number" min={0} max={40} step="1"
                        value={theme.header?.mobileMenuRadiusPx ?? 0}
                        onChange={(e) => setPath("header.mobileMenuRadiusPx", Number(e.target.value))}
                      />
                      <Input
                        label="Separación interna del panel (px)" type="number" min={8} max={40} step="1"
                        value={theme.header?.mobileMenuPaddingPx ?? 20}
                        onChange={(e) => setPath("header.mobileMenuPaddingPx", Number(e.target.value))}
                      />
                    </>}
                  </PanelBlock>
                </>
              )}

              {responsiveSubTab === "estilo" && (
                <>
                  <PanelBlock title="Colores base del menú móvil">
                    <label className="block min-w-0">
                      <span className="mb-1 block text-sm font-medium text-gray-700">
                        Fondo del menú móvil
                      </span>
                      <ColorInput
                        value={theme.header?.mobileMenuBgColor || ""}
                        onChange={(e) => setPath("header.mobileMenuBgColor", e.target.value)}
                      />
                    </label>

                    <label className="block min-w-0">
                      <span className="mb-1 block text-sm font-medium text-gray-700">
                        Color de texto principal
                      </span>
                      <ColorInput
                        value={theme.header?.mobileMenuTextColor || ""}
                        onChange={(e) => setPath("header.mobileMenuTextColor", e.target.value)}
                      />
                    </label>

                    <label className="block min-w-0">
                      <span className="mb-1 block text-sm font-medium text-gray-700">
                        Color acento / hover
                      </span>
                      <ColorInput
                        value={theme.header?.mobileMenuAccentColor || ""}
                        onChange={(e) => setPath("header.mobileMenuAccentColor", e.target.value)}
                      />
                    </label>

                    <label className="block min-w-0">
                      <span className="mb-1 block text-sm font-medium text-gray-700">
                        Color de texto suave
                      </span>
                      <ColorInput
                        value={theme.header?.mobileMenuMutedColor || ""}
                        onChange={(e) => setPath("header.mobileMenuMutedColor", e.target.value)}
                      />
                    </label>

                    <Input
                      label="Fuente personalizada del menú móvil"
                      value={theme.header?.mobileMenuFontFamily || ""}
                      onChange={(e) => setPath("header.mobileMenuFontFamily", e.target.value)}
                      placeholder='"Playfair Display", Georgia, serif'
                    />
                  </PanelBlock>

                  <PanelBlock title="Botón hamburguesa y botón cerrar">
                    <label className="block min-w-0">
                      <span className="mb-1 block text-sm font-medium text-gray-700">
                        Fondo del botón hamburguesa
                      </span>
                      <ColorInput
                        value={theme.header?.mobileMenuTriggerBgColor || ""}
                        onChange={(e) => setPath("header.mobileMenuTriggerBgColor", e.target.value)}
                      />
                    </label>

                    <label className="block min-w-0">
                      <span className="mb-1 block text-sm font-medium text-gray-700">
                        Color del icono hamburguesa
                      </span>
                      <ColorInput
                        value={theme.header?.mobileMenuTriggerIconColor || ""}
                        onChange={(e) =>
                          setPath("header.mobileMenuTriggerIconColor", e.target.value)
                        }
                      />
                    </label>

                    <label className="block min-w-0">
                      <span className="mb-1 block text-sm font-medium text-gray-700">
                        Fondo del botón cerrar
                      </span>
                      <ColorInput
                        value={theme.header?.mobileMenuCloseBgColor || ""}
                        onChange={(e) => setPath("header.mobileMenuCloseBgColor", e.target.value)}
                      />
                    </label>

                    <label className="block min-w-0">
                      <span className="mb-1 block text-sm font-medium text-gray-700">
                        Color del icono cerrar
                      </span>
                      <ColorInput
                        value={theme.header?.mobileMenuCloseIconColor || ""}
                        onChange={(e) =>
                          setPath("header.mobileMenuCloseIconColor", e.target.value)
                        }
                      />
                    </label>
                  </PanelBlock>
                </>
              )}

              {responsiveSubTab === "bordes" && (
                <>
                  <PanelBlock title="Bordes del panel y separadores">
                    <label className="block min-w-0">
                      <span className="mb-1 block text-sm font-medium text-gray-700">
                        Color de borde del panel
                      </span>
                      <ColorInput
                        value={theme.header?.mobileMenuBorderColor || ""}
                        onChange={(e) => setPath("header.mobileMenuBorderColor", e.target.value)}
                      />
                    </label>

                    <Input
                      label="Grosor del borde del panel (px)"
                      type="number"
                      min={0}
                      max={8}
                      step="1"
                      value={theme.header?.mobileMenuBorderWidthPx ?? 0}
                      onChange={(e) =>
                        setPath("header.mobileMenuBorderWidthPx", Number(e.target.value))
                      }
                    />

                    <label className="block min-w-0">
                      <span className="mb-1 block text-sm font-medium text-gray-700">
                        Color de separadores de items
                      </span>
                      <ColorInput
                        value={theme.header?.mobileMenuItemBorderColor || ""}
                        onChange={(e) =>
                          setPath("header.mobileMenuItemBorderColor", e.target.value)
                        }
                      />
                    </label>

                    <Input
                      label="Grosor de separadores de items (px)"
                      type="number"
                      min={0}
                      max={6}
                      step="1"
                      value={theme.header?.mobileMenuItemBorderWidthPx ?? 1}
                      onChange={(e) =>
                        setPath("header.mobileMenuItemBorderWidthPx", Number(e.target.value))
                      }
                    />
                  </PanelBlock>

                  <PanelBlock title="Bordes del botón hamburguesa y botón cerrar">
                    <label className="block min-w-0">
                      <span className="mb-1 block text-sm font-medium text-gray-700">
                        Color de borde del botón hamburguesa
                      </span>
                      <ColorInput
                        value={theme.header?.mobileMenuTriggerBorderColor || ""}
                        onChange={(e) =>
                          setPath("header.mobileMenuTriggerBorderColor", e.target.value)
                        }
                      />
                    </label>

                    <Input
                      label="Grosor del borde hamburguesa (px)"
                      type="number"
                      min={0}
                      max={8}
                      step="1"
                      value={theme.header?.mobileMenuTriggerBorderWidthPx ?? 1}
                      onChange={(e) =>
                        setPath("header.mobileMenuTriggerBorderWidthPx", Number(e.target.value))
                      }
                    />

                    <label className="block min-w-0">
                      <span className="mb-1 block text-sm font-medium text-gray-700">
                        Color de borde del botón cerrar
                      </span>
                      <ColorInput
                        value={theme.header?.mobileMenuCloseBorderColor || ""}
                        onChange={(e) =>
                          setPath("header.mobileMenuCloseBorderColor", e.target.value)
                        }
                      />
                    </label>

                    <Input
                      label="Grosor del borde cerrar (px)"
                      type="number"
                      min={0}
                      max={8}
                      step="1"
                      value={theme.header?.mobileMenuCloseBorderWidthPx ?? 1}
                      onChange={(e) =>
                        setPath("header.mobileMenuCloseBorderWidthPx", Number(e.target.value))
                      }
                    />
                  </PanelBlock>

                  <PanelBlock title="Redondeo de los botones del menú">
                    <Input
                      label="Radio botón hamburguesa (px)"
                      type="number"
                      min={0}
                      max={40}
                      step="1"
                      value={theme.header?.mobileMenuTriggerRadiusPx ?? 999}
                      onChange={(e) =>
                        setPath("header.mobileMenuTriggerRadiusPx", Number(e.target.value))
                      }
                    />

                    <Input
                      label="Radio botón cerrar (px)"
                      type="number"
                      min={0}
                      max={40}
                      step="1"
                      value={theme.header?.mobileMenuCloseRadiusPx ?? 999}
                      onChange={(e) =>
                        setPath("header.mobileMenuCloseRadiusPx", Number(e.target.value))
                      }
                    />

                  </PanelBlock>
                </>
              )}

              {responsiveSubTab === "botones" && (
                <>
                  <PanelBlock title="Redes sociales y pie">
                    <label className="block min-w-0">
                      <span className="mb-1 block text-sm font-medium text-gray-700">
                        Fondo de botones sociales
                      </span>
                      <ColorInput
                        value={theme.header?.mobileMenuSocialBg || ""}
                        onChange={(e) => setPath("header.mobileMenuSocialBg", e.target.value)}
                      />
                    </label>

                    <label className="block min-w-0">
                      <span className="mb-1 block text-sm font-medium text-gray-700">
                        Color de íconos sociales
                      </span>
                      <ColorInput
                        value={theme.header?.mobileMenuSocialIconColor || ""}
                        onChange={(e) =>
                          setPath("header.mobileMenuSocialIconColor", e.target.value)
                        }
                      />
                    </label>

                    <Input
                      label="Tamaño de botones sociales (px)"
                      type="number"
                      min={28}
                      max={72}
                      step="1"
                      value={theme.header?.mobileMenuSocialSizePx ?? 44}
                      onChange={(e) =>
                        setPath("header.mobileMenuSocialSizePx", Number(e.target.value))
                      }
                    />

                    <Input
                      label="Tamaño texto pie inferior (px)"
                      type="number"
                      min={10}
                      max={20}
                      step="1"
                      value={theme.header?.mobileMenuFooterTextSizePx ?? 13}
                      onChange={(e) =>
                        setPath("header.mobileMenuFooterTextSizePx", Number(e.target.value))
                      }
                    />
                  </PanelBlock>
                </>
              )}

              {responsiveSubTab === "animacion" && (
                <>
                  <PanelBlock title="Overlay y transición">
                    <label className="block min-w-0">
                      <span className="mb-1 block text-sm font-medium text-gray-700">
                        Color del overlay
                      </span>
                      <ColorInput
                        value={theme.header?.mobileMenuOverlayColor || ""}
                        onChange={(e) => setPath("header.mobileMenuOverlayColor", e.target.value)}
                      />
                    </label>

                    <div className="rounded-2xl border bg-white p-4">
                      <div className="mb-1 text-sm font-medium text-gray-700">
                        Opacidad del overlay (0 a 1)
                      </div>
                      <div className="grid min-w-0 grid-cols-[1fr_96px] items-center gap-3">
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={theme.header?.mobileMenuOverlayOpacity ?? 0.35}
                          onChange={(e) =>
                            setPath("header.mobileMenuOverlayOpacity", Number(e.target.value))
                          }
                          className="w-full min-w-0"
                        />
                        <input
                          type="number"
                          min="0"
                          max="1"
                          step="0.01"
                          value={theme.header?.mobileMenuOverlayOpacity ?? 0.35}
                          onChange={(e) =>
                            setPath("header.mobileMenuOverlayOpacity", Number(e.target.value))
                          }
                          className="w-24 rounded-xl border border-gray-300 bg-white px-3 py-2.5"
                        />
                      </div>
                    </div>

                    <Select
                      label="Transición del menú"
                      value={theme.header?.mobileMenuAnimation || "slide-left"}
                      onChange={(e) => setPath("header.mobileMenuAnimation", e.target.value)}
                    >
                      <option value="slide-left">Deslizar desde la izquierda</option>
                      <option value="slide-right">Deslizar desde la derecha</option>
                      <option value="fade">Desvanecer</option>
                      <option value="scale">Escala suave</option>
                      <option value="slide-fade">Deslizar + desvanecer</option>
                      <option value="luxury-soft">Suave elegante</option>
                    </Select>

                    <Input
                      label="Duración de transición (ms)"
                      type="number"
                      min={120}
                      max={1200}
                      step="10"
                      value={theme.header?.mobileMenuAnimationDurationMs ?? 300}
                      onChange={(e) =>
                        setPath(
                          "header.mobileMenuAnimationDurationMs",
                          Number(e.target.value)
                        )
                      }
                    />
                  </PanelBlock>

                  <PanelBlock title="Animación del botón hamburguesa">
                    <Select
                      label="Animación del botón hamburguesa"
                      value={theme.header?.mobileMenuTriggerAnimation || "soft"}
                      onChange={(e) =>
                        setPath("header.mobileMenuTriggerAnimation", e.target.value)
                      }
                    >
                      <option value="none">Sin animación</option>
                      <option value="soft">Suave</option>
                      <option value="pop">Pop</option>
                      <option value="rotate">Giro suave</option>
                      <option value="pulse">Pulso</option>
                    </Select>

                    <Select
                      label="Transformación al abrir"
                      value={theme.header?.mobileMenuTriggerOpenEffect || "to-x"}
                      onChange={(e) =>
                        setPath("header.mobileMenuTriggerOpenEffect", e.target.value)
                      }
                    >
                      <option value="none">Ninguna</option>
                      <option value="to-x">Se transforma en X</option>
                      <option value="fade">Se desvanece</option>
                      <option value="rotate">Rota suavemente</option>
                    </Select>
                  </PanelBlock>
                </>
              )}
            </div>
          </section>
        )}

        </fieldset>

        <fieldset disabled={!canEditMenus}>
        {activeMainTab === "menu" && (
          <section className="mt-3 rounded-2xl border border-gray-200 bg-white p-3 md:p-4">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="text-sm font-semibold text-gray-800">
                    Menú del Header (botones)
                  </div>
                  <p className="mt-1 text-sm text-gray-600">
                    Elige una página pública o escribe un enlace externo seguro. El orden se refleja arriba.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={addHeaderMenuItem}
                  className="inline-flex shrink-0 items-center justify-center rounded-xl bg-pink-600 px-4 py-2 text-sm text-white transition hover:bg-pink-700"
                >
                  + Agregar
                </button>
              </div>

              {!menus?.header || menus.header.length === 0 ? (
                <div className="rounded-2xl border border-dashed bg-white p-4 text-gray-500">
                  No hay botones en el menú. Presiona{" "}
                  <span className="font-medium">“+ Agregar”</span>.
                </div>
              ) : (
                <div className="space-y-3">
                  {menus.header.map((item, idx) => (
                    <div key={item?._id || idx} className="rounded-2xl border bg-white p-4 min-w-0">
                      <div className="grid min-w-0 gap-4 xl:grid-cols-[1fr_1.2fr_auto] xl:items-end">
                        <Input
                          label={`Texto del botón #${idx + 1}`}
                          value={item?.title || ""}
                          onChange={(e) => setHeaderMenuItem(idx, { title: e.target.value })}
                          placeholder="Ej: Lo Nuevo"
                        />

                        <div className="min-w-0">
                          <label className="block min-w-0">
                            <span className="mb-1 block text-sm font-medium text-gray-700">
                              Página o destino
                            </span>

                            <select
                              className="mb-2 w-full min-w-0 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-pink-300 focus:ring-2 focus:ring-pink-200"
                              value={item?.ref || ""}
                              onChange={(e) => setHeaderMenuItem(idx, { ref: e.target.value })}
                            >
                              <option value="">Selecciona una página</option>
                              {item?.ref && !routeOptions.public.some((route) => route.value === item.ref) && <option value={item.ref}>Enlace personalizado: {item.ref}</option>}
                              <optgroup label="Páginas públicas">
                                {routeOptions.public.map((r) => (
                                  <option key={r.value} value={r.value}>
                                    {r.label} — {r.value}
                                  </option>
                                ))}
                              </optgroup>
                            </select>

                            <input
                              className="w-full min-w-0 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-pink-300 focus:ring-2 focus:ring-pink-200"
                              value={item?.ref || ""}
                              onChange={(e) => setHeaderMenuItem(idx, { ref: e.target.value })}
                              placeholder="/lo-nuevo, #tendencia o https://sitio.com"
                            />
                          </label>
                        </div>

                        <div className="flex flex-wrap gap-2 xl:justify-end">
                          <button
                            type="button"
                            onClick={() => moveHeaderMenuItem(idx, idx - 1)}
                            className="rounded-xl border border-gray-300 px-3 py-2 text-sm transition hover:bg-gray-50"
                            title="Subir"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => moveHeaderMenuItem(idx, idx + 1)}
                            className="rounded-xl border border-gray-300 px-3 py-2 text-sm transition hover:bg-gray-50"
                            title="Bajar"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            onClick={() => removeHeaderMenuItem(idx)}
                            className="rounded-xl border border-red-300 px-3 py-2 text-sm text-red-700 transition hover:bg-red-50"
                            title="Eliminar"
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>

                      <label className="mt-3 flex max-w-sm items-center gap-3 text-sm text-gray-700">
                        <span className="shrink-0 text-pink-700"><MobileMenuLinkIcon name={item?.icon} size={20} /></span>
                        <span className="shrink-0">Ícono en menú móvil</span>
                        <select
                          className="min-w-0 flex-1 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800"
                          value={normalizeMobileMenuIcon(item?.icon)}
                          onChange={(e) => setHeaderMenuItem(idx, { icon: e.target.value })}
                          aria-label={`Ícono móvil para ${item?.title || `enlace ${idx + 1}`}`}
                        >
                          {MOBILE_MENU_ICON_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                      </label>

                      <div className="mt-2 text-xs text-gray-500">
                        Para un producto específico, pega su ruta real, por ejemplo <span className="font-mono">/producto/123</span>. Las rutas con <span className="font-mono">:id</span> no sirven como enlace público.
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}
        </fieldset>
      </div>
    </div>
  );
}
