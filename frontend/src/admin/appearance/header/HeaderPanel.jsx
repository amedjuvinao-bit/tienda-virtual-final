// frontend/src/admin/appearance/header/HeaderPanel.jsx
import React, { useMemo, useState } from "react";
import { Image, Link2, Palette, Smartphone } from 'lucide-react';
import CloudinaryImageField from '../general/CloudinaryImageField';
import HeaderPreview from './HeaderPreview';
import { HEADER_FONT_PRESETS, isDarkHeaderBackground, resolveHeaderTypography } from '../../../components/headerPresentation';
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
  const preferredLogo = isDarkHeaderBackground(theme.header?.bgColor) ? 'claro' : 'oscuro';

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
                  <p className="appearance-header__logo-current">Con el fondo actual se muestra primero el <strong>logo {preferredLogo}</strong>. Si falta, se utiliza la otra versión.</p>

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
                active={stylesSubTab === "iconos"}
                label="Íconos"
                onClick={() => setStylesSubTab("iconos")}
              />
            </div>

            <div className="space-y-4">
              {stylesSubTab === "tipografia" && (
                <PanelBlock title="Personalidad del menú" columns={1}>
                  <div className="appearance-header__font-grid" role="group" aria-label="Modelos de tipografía">
                    {Object.entries(HEADER_FONT_PRESETS).map(([key, preset]) => (
                      <button key={key} type="button" className="appearance-header__font-option"
                        aria-pressed={theme.header?.fontPreset === key && !theme.header?.fontFamily}
                        onClick={() => { setPath('header.fontPreset', key); setPath('header.fontFamily', ''); }}>
                        <span className="appearance-header__font-example" style={{ fontFamily: preset.family, fontWeight: preset.weight, fontStyle: preset.style, letterSpacing: preset.spacing, textTransform: preset.transform }}>Lo Nuevo</span>
                        <strong>{preset.label}</strong><small>{preset.description}</small>
                      </button>
                    ))}
                  </div>
                  <div className="appearance-header__font-detail">
                    <strong>Así se leerá el menú</strong>
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

              {stylesSubTab === "iconos" && (
                <PanelBlock title="Íconos (colores y animación)">
                  <label className="block min-w-0">
                    <span className="mb-1 block text-sm font-medium text-gray-700">
                      Color de íconos
                    </span>
                    <ColorInput
                      value={theme.header?.iconColor || ""}
                      onChange={(e) => setPath("header.iconColor", e.target.value)}
                    />
                  </label>

                  <label className="block min-w-0">
                    <span className="mb-1 block text-sm font-medium text-gray-700">
                      Color hover (íconos)
                    </span>
                    <ColorInput
                      value={theme.header?.iconHoverColor || ""}
                      onChange={(e) => setPath("header.iconHoverColor", e.target.value)}
                    />
                  </label>

                  <div className="xl:col-span-2">
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
                </PanelBlock>
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
                label="Botones y redes"
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
                    <Input
                      label="Ancho del menú móvil (%)"
                      type="number"
                      min={60}
                      max={100}
                      step="1"
                      value={theme.header?.mobileMenuWidthPercent ?? 88}
                      onChange={(e) =>
                        setPath("header.mobileMenuWidthPercent", Number(e.target.value))
                      }
                    />

                    <Input
                      label="Radio general del panel (px)"
                      type="number"
                      min={0}
                      max={40}
                      step="1"
                      value={theme.header?.mobileMenuRadiusPx ?? 0}
                      onChange={(e) =>
                        setPath("header.mobileMenuRadiusPx", Number(e.target.value))
                      }
                    />

                    <Input
                      label="Separación interna del panel (px)"
                      type="number"
                      min={8}
                      max={40}
                      step="1"
                      value={theme.header?.mobileMenuPaddingPx ?? 20}
                      onChange={(e) =>
                        setPath("header.mobileMenuPaddingPx", Number(e.target.value))
                      }
                    />

                    <Select
                      label="Comportamiento del panel móvil"
                      value={theme.header?.mobileMenuLayout || "drawer-left"}
                      onChange={(e) => setPath("header.mobileMenuLayout", e.target.value)}
                    >
                      <option value="drawer-left">Drawer desde la izquierda</option>
                      <option value="drawer-right">Drawer desde la derecha</option>
                      <option value="center-panel">Panel centrado</option>
                      <option value="full-screen">Pantalla completa</option>
                    </Select>
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

                    <label className="block min-w-0">
                      <span className="mb-1 block text-sm font-medium text-gray-700">
                        Color del título
                      </span>
                      <ColorInput
                        value={theme.header?.mobileMenuTitleColor || ""}
                        onChange={(e) => setPath("header.mobileMenuTitleColor", e.target.value)}
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

                  <PanelBlock title="Radios de botones y panel">
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

                    <Input
                      label="Radio botón principal (px)"
                      type="number"
                      min={0}
                      max={40}
                      step="1"
                      value={theme.header?.mobileMenuButtonRadiusPx ?? 999}
                      onChange={(e) =>
                        setPath("header.mobileMenuButtonRadiusPx", Number(e.target.value))
                      }
                    />

                    <Input
                      label="Radio botón secundario (px)"
                      type="number"
                      min={0}
                      max={40}
                      step="1"
                      value={theme.header?.mobileMenuSecondaryButtonRadiusPx ?? 999}
                      onChange={(e) =>
                        setPath(
                          "header.mobileMenuSecondaryButtonRadiusPx",
                          Number(e.target.value)
                        )
                      }
                    />
                  </PanelBlock>
                </>
              )}

              {responsiveSubTab === "botones" && (
                <>
                  <PanelBlock title="Botón principal">
                    <label className="block min-w-0">
                      <span className="mb-1 block text-sm font-medium text-gray-700">
                        Fondo botón principal
                      </span>
                      <ColorInput
                        value={theme.header?.mobileMenuButtonBg || ""}
                        onChange={(e) => setPath("header.mobileMenuButtonBg", e.target.value)}
                      />
                    </label>

                    <label className="block min-w-0">
                      <span className="mb-1 block text-sm font-medium text-gray-700">
                        Texto botón principal
                      </span>
                      <ColorInput
                        value={theme.header?.mobileMenuButtonTextColor || ""}
                        onChange={(e) =>
                          setPath("header.mobileMenuButtonTextColor", e.target.value)
                        }
                      />
                    </label>

                    <label className="block min-w-0">
                      <span className="mb-1 block text-sm font-medium text-gray-700">
                        Color borde botón principal
                      </span>
                      <ColorInput
                        value={theme.header?.mobileMenuButtonBorderColor || ""}
                        onChange={(e) =>
                          setPath("header.mobileMenuButtonBorderColor", e.target.value)
                        }
                      />
                    </label>

                    <Input
                      label="Grosor borde botón principal (px)"
                      type="number"
                      min={0}
                      max={8}
                      step="1"
                      value={theme.header?.mobileMenuButtonBorderWidthPx ?? 0}
                      onChange={(e) =>
                        setPath("header.mobileMenuButtonBorderWidthPx", Number(e.target.value))
                      }
                    />
                  </PanelBlock>

                  <PanelBlock title="Botón secundario">
                    <label className="block min-w-0">
                      <span className="mb-1 block text-sm font-medium text-gray-700">
                        Fondo botón secundario
                      </span>
                      <ColorInput
                        value={theme.header?.mobileMenuSecondaryButtonBg || ""}
                        onChange={(e) =>
                          setPath("header.mobileMenuSecondaryButtonBg", e.target.value)
                        }
                      />
                    </label>

                    <label className="block min-w-0">
                      <span className="mb-1 block text-sm font-medium text-gray-700">
                        Texto botón secundario
                      </span>
                      <ColorInput
                        value={theme.header?.mobileMenuSecondaryButtonTextColor || ""}
                        onChange={(e) =>
                          setPath("header.mobileMenuSecondaryButtonTextColor", e.target.value)
                        }
                      />
                    </label>

                    <label className="block min-w-0">
                      <span className="mb-1 block text-sm font-medium text-gray-700">
                        Color borde botón secundario
                      </span>
                      <ColorInput
                        value={theme.header?.mobileMenuSecondaryButtonBorderColor || ""}
                        onChange={(e) =>
                          setPath(
                            "header.mobileMenuSecondaryButtonBorderColor",
                            e.target.value
                          )
                        }
                      />
                    </label>

                    <Input
                      label="Grosor borde botón secundario (px)"
                      type="number"
                      min={0}
                      max={8}
                      step="1"
                      value={theme.header?.mobileMenuSecondaryButtonBorderWidthPx ?? 1}
                      onChange={(e) =>
                        setPath(
                          "header.mobileMenuSecondaryButtonBorderWidthPx",
                          Number(e.target.value)
                        )
                      }
                    />
                  </PanelBlock>

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
