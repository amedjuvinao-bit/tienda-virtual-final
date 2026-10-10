// frontend/src/admin/appearance/header/HeaderPanel.jsx
import React, { useMemo, useState } from "react";
import { ChevronDown, Image, Link2, Palette, Smartphone } from 'lucide-react';
import CloudinaryImageField from '../general/CloudinaryImageField';
import HeaderPreview from './HeaderPreview';
import MobileMenuEditor from './MobileMenuEditor';
import GlassMotionPicker from '../general/GlassMotionPicker';
import { HEADER_FONT_PRESETS, isDarkHeaderBackground, resolveHeaderTypography } from '../../../components/headerPresentation';
import { HEADER_ICON_SETS, HeaderActionGlyph, getHeaderIconSource, resolveHeaderIcons } from '../../../components/HeaderActionIcons';
import { headerSearchColorVariables, resolveHeaderSearchColors } from '../../../components/headerSearchTheme';
import { MOBILE_MENU_ICON_OPTIONS, MobileMenuLinkIcon, normalizeMobileMenuIcon, normalizeMobileMenuIconColor } from '../../../components/mobileMenuIcons';
import { safeBannerButtonAnimation } from '../../../lib/bannerTemplates';
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

const pickerColor = (value) => {
  const hex = normalizeMobileMenuIconColor(value) || '#ac7950';
  return hex.length === 4 ? `#${[...hex.slice(1)].map((digit) => digit + digit).join('')}` : hex;
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
  const [editingHeaderMenuIndex, setEditingHeaderMenuIndex] = useState(0);
  const [customDestinationIndex, setCustomDestinationIndex] = useState(-1);
  const headerMenuItems = menus?.header || [];
  const activeHeaderMenuIndex = Math.min(editingHeaderMenuIndex, headerMenuItems.length - 1);
  const addAndEditHeaderMenuItem = () => {
    addHeaderMenuItem();
    setEditingHeaderMenuIndex(headerMenuItems.length);
    setCustomDestinationIndex(-1);
  };
  const moveAndKeepHeaderMenuItem = (from, to) => {
    if (to < 0 || to >= headerMenuItems.length) return;
    moveHeaderMenuItem(from, to);
    setEditingHeaderMenuIndex((active) => active === from ? to : active === to ? from : active);
    setCustomDestinationIndex((active) => active === from ? to : active === to ? from : active);
  };
  const removeAndSelectHeaderMenuItem = (index) => {
    removeHeaderMenuItem(index);
    setEditingHeaderMenuIndex((active) => active === index ? Math.max(0, index - 1) : active > index ? active - 1 : active);
    setCustomDestinationIndex((active) => active === index ? -1 : active > index ? active - 1 : active);
  };
  const searchColors = resolveHeaderSearchColors(theme.header, theme.colors);
  const iconSelection = resolveHeaderIcons(theme.header);
  const logoMode = theme.header?.logoMode || 'auto';
  const preferredLogo = logoMode === 'auto'
    ? (isDarkHeaderBackground(theme.header?.bgColor) ? 'claro' : 'oscuro')
    : (logoMode === 'light' ? 'claro' : 'oscuro');
  const lightLogo = theme.header?.logoLight || theme.logo?.light || '';
  const darkLogo = theme.header?.logoDark || theme.logo?.dark || '';

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
                  <GlassMotionPicker label="Efecto de vidrio del encabezado" value={theme.header?.glassMotion}
                    inherited={safeBannerButtonAnimation(theme.banner?.templateConfigs?.[theme.banner?.templateId]?.buttonAnimation)}
                    onChange={(value) => setPath('header.glassMotion', value)} />
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

        {activeMainTab === "responsive" && <MobileMenuEditor
          theme={theme} setPath={setPath} menus={menus} uploading={uploading}
          setUploading={setUploading} savedRevision={savedRevision}
          uploadToCloudinaryViaBackend={uploadToCloudinaryViaBackend} />}

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
                  onClick={addAndEditHeaderMenuItem}
                  className="inline-flex shrink-0 items-center justify-center rounded-xl bg-pink-600 px-4 py-2 text-sm text-white transition hover:bg-pink-700"
                >
                  + Agregar
                </button>
              </div>

              {headerMenuItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed bg-white p-4 text-gray-500">
                  No hay botones en el menú. Presiona{" "}
                  <span className="font-medium">“+ Agregar”</span>.
                </div>
              ) : (
                <div className="appearance-header__menu-list">
                  {headerMenuItems.map((item, idx) => (
                    <div key={item?._id || idx} className="appearance-header__menu-entry" data-active={activeHeaderMenuIndex === idx}>
                      <div className="appearance-header__menu-row">
                        <button type="button" className="appearance-header__menu-summary"
                          aria-expanded={activeHeaderMenuIndex === idx}
                          aria-controls={`header-menu-editor-${idx}`}
                          onClick={() => { setEditingHeaderMenuIndex(idx); setCustomDestinationIndex(-1); }}>
                          <span className="appearance-header__menu-number">{idx + 1}</span>
                          <span className="appearance-header__menu-icon-sample"><MobileMenuLinkIcon name={item?.icon} color={item?.iconColor || theme?.header?.mobileMenuAccentColor || '#ac7950'} size={25} /></span>
                          <span className="appearance-header__menu-summary-copy"><strong>{item?.title || `Enlace ${idx + 1}`}</strong><small>{item?.ref || 'Sin destino'}</small></span>
                          <ChevronDown className="appearance-header__menu-chevron" size={18} aria-hidden="true" />
                        </button>
                        <div className="appearance-header__menu-actions">
                          <button type="button" onClick={() => moveAndKeepHeaderMenuItem(idx, idx - 1)} disabled={idx === 0} aria-label={`Subir ${item?.title || `enlace ${idx + 1}`}`} title="Subir">↑</button>
                          <button type="button" onClick={() => moveAndKeepHeaderMenuItem(idx, idx + 1)} disabled={idx === headerMenuItems.length - 1} aria-label={`Bajar ${item?.title || `enlace ${idx + 1}`}`} title="Bajar">↓</button>
                          <button type="button" onClick={() => removeAndSelectHeaderMenuItem(idx)} aria-label={`Eliminar ${item?.title || `enlace ${idx + 1}`}`} title="Eliminar">Eliminar</button>
                        </div>
                      </div>
                      {activeHeaderMenuIndex === idx && <div id={`header-menu-editor-${idx}`} className="appearance-header__menu-details">
                        <div className="grid min-w-0 gap-3 md:grid-cols-2">
                        <Input
                          label="Texto del botón"
                          value={item?.title || ""}
                          onChange={(e) => setHeaderMenuItem(idx, { title: e.target.value })}
                          placeholder="Ej: Lo Nuevo"
                        />

                        <div className="min-w-0">
                          <label className="block min-w-0">
                            <span className="mb-1 block text-sm font-medium text-gray-700">Página o destino</span>
                            <select
                              className="w-full min-w-0 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-pink-300 focus:ring-2 focus:ring-pink-200"
                              value={customDestinationIndex === idx || (item?.ref && !routeOptions.public.some((route) => route.value === item.ref)) ? '__custom__' : item?.ref || ''}
                              onChange={(e) => {
                                if (e.target.value === '__custom__') setCustomDestinationIndex(idx);
                                else { setCustomDestinationIndex(-1); setHeaderMenuItem(idx, { ref: e.target.value }); }
                              }}
                            >
                              <option value="">Selecciona una página</option>
                              <optgroup label="Páginas públicas">
                                {routeOptions.public.map((r) => (
                                  <option key={r.value} value={r.value}>
                                    {r.label} — {r.value}
                                  </option>
                                ))}
                              </optgroup>
                              <option value="__custom__">Escribir enlace personalizado…</option>
                            </select>
                          </label>
                          {(customDestinationIndex === idx || (item?.ref && !routeOptions.public.some((route) => route.value === item.ref))) &&
                            <Input label="Ruta o URL" value={item?.ref || ''}
                              onChange={(e) => setHeaderMenuItem(idx, { ref: e.target.value })}
                              placeholder="/producto/123 o https://sitio.com" />}
                        </div>
                      </div>

                      <div className="appearance-header__menu-icon-editor">
                        <span className="appearance-header__menu-icon-sample"><MobileMenuLinkIcon name={item?.icon} color={item?.iconColor || theme?.header?.mobileMenuAccentColor || '#ac7950'} size={25} /></span>
                        <label className="appearance-header__menu-icon-select">
                          <span>Ícono en menú móvil</span>
                          <select value={normalizeMobileMenuIcon(item?.icon)}
                            onChange={(e) => setHeaderMenuItem(idx, { icon: e.target.value })}
                            aria-label={`Ícono móvil para ${item?.title || `enlace ${idx + 1}`}`}>
                            <optgroup label="Moda y accesorios">
                              {MOBILE_MENU_ICON_OPTIONS.filter((option) => option.group === 'fashion')
                                .map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                            </optgroup>
                            <optgroup label="Otras categorías">
                              {MOBILE_MENU_ICON_OPTIONS.filter((option) => option.group !== 'fashion')
                                .map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                            </optgroup>
                          </select>
                        </label>
                        <label className="appearance-header__menu-icon-color">
                          <span>Color del ícono</span>
                          <span><input type="color" aria-label={`Color del ícono móvil para ${item?.title || `enlace ${idx + 1}`}`}
                            value={pickerColor(item?.iconColor || theme?.header?.mobileMenuAccentColor)}
                            onChange={(e) => setHeaderMenuItem(idx, { iconColor: e.target.value })} />
                            <small>{normalizeMobileMenuIconColor(item?.iconColor) || 'Color general'}</small></span>
                        </label>
                        {item?.iconColor && <button type="button" className="appearance-header__menu-icon-reset"
                          onClick={() => setHeaderMenuItem(idx, { iconColor: '' })}>Usar color general</button>}
                      </div>

                      </div>}
                    </div>
                  ))}
                  <p className="appearance-header__menu-hint">Para enlazar un producto, usa su ruta real (por ejemplo, /producto/123).</p>
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
