// frontend/src/admin/appearance/header/HeaderPanel.jsx
import React, { useMemo, useState } from "react";

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

const SectionHeader = ({ title, description, onPreview }) => (
  <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
    <div>
      <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
      <p className="mt-1 text-sm text-gray-500">{description}</p>
    </div>

    <button
      type="button"
      onClick={onPreview}
      className="inline-flex shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-700 transition hover:bg-gray-100"
      title="Aplica cambios en vista previa"
    >
      Ver cambios
    </button>
  </div>
);

const InfoCard = ({ title, text }) => (
  <div className="rounded-2xl border border-pink-100 bg-gradient-to-r from-pink-50 to-rose-50 px-4 py-3">
    <div className="text-sm font-semibold text-pink-700">{title}</div>
    <p className="mt-1 text-sm leading-6 text-gray-600">{text}</p>
  </div>
);

const MainTabButton = ({ active, label, description, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={[
      "rounded-2xl border px-4 py-3 text-left transition-all duration-200",
      active
        ? "border-pink-300 bg-gradient-to-r from-pink-50 to-rose-50 shadow-sm"
        : "border-gray-200 bg-white hover:border-pink-200 hover:bg-pink-50/40",
    ].join(" ")}
  >
    <div className="text-sm font-semibold text-gray-900">{label}</div>
    <div className="mt-1 text-xs leading-5 text-gray-500">{description}</div>
  </button>
);

const SubTabButton = ({ active, label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={[
      "rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200",
      active
        ? "border-pink-300 bg-pink-600 text-white shadow-sm"
        : "border-gray-200 bg-white text-gray-700 hover:border-pink-200 hover:text-pink-700",
    ].join(" ")}
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
  onPreview,
  onUploadLogo,
  setLogoLightFile,
  setLogoDarkFile,
  addHeaderMenuItem,
  removeHeaderMenuItem,
  moveHeaderMenuItem,
  setHeaderMenuItem,
}) {
  const mainTabs = useMemo(
    () => [
      {
        id: "branding",
        label: "Logo y fondo",
        description: "Logo, tamaño, subida, URLs manuales y fondo del header.",
      },
      {
        id: "styles",
        label: "Tipografía y estilos",
        description: "Fuente, tamaños, colores del menú y animaciones visuales.",
      },
      {
        id: "responsive",
        label: "Responsive y menú móvil",
        description:
          "Configura la experiencia en pantallas pequeñas, el botón hamburguesa y la transición del panel.",
      },
      {
        id: "menu",
        label: "Menú del header",
        description: "Botones, textos, rutas, orden y eliminación.",
      },
    ],
    []
  );

  const [activeMainTab, setActiveMainTab] = useState("branding");
  const [brandingSubTab, setBrandingSubTab] = useState("logo");
  const [stylesSubTab, setStylesSubTab] = useState("tipografia");
  const [responsiveSubTab, setResponsiveSubTab] = useState("estructura");

  return (
    <div className="min-w-0 space-y-6">
      <div className="rounded-3xl border border-gray-200 bg-white p-4 md:p-5">
        <SectionHeader
          title="Header"
          description="Organiza el logo, fondo, tipografía, estilos del menú y la configuración responsive del header sin sobrecargar al usuario."
          onPreview={onPreview}
        />

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {mainTabs.map((tab) => (
            <MainTabButton
              key={tab.id}
              active={activeMainTab === tab.id}
              label={tab.label}
              description={tab.description}
              onClick={() => setActiveMainTab(tab.id)}
            />
          ))}
        </div>

        {activeMainTab === "branding" && (
          <section className="mt-6 rounded-3xl border border-gray-200 bg-white p-4 md:p-5">
            <div className="mb-4">
              <InfoCard
                title="Consejo visual"
                text="Primero define el logo y su tamaño. Después sube archivos o pega las URLs. Al final ajusta el fondo y la transparencia del header."
              />
            </div>

            <div className="mb-5 flex flex-wrap gap-2">
              <SubTabButton
                active={brandingSubTab === "logo"}
                label="Logo"
                onClick={() => setBrandingSubTab("logo")}
              />
              <SubTabButton
                active={brandingSubTab === "subida"}
                label="Subida y URLs"
                onClick={() => setBrandingSubTab("subida")}
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
                  <PanelBlock title="Vista previa del logo">
                    <div className="rounded-2xl border bg-white p-3">
                      <div className="mb-2 text-xs text-gray-500">Vista previa (Light)</div>
                      <div className="flex h-20 items-center justify-center rounded-xl border bg-gray-50">
                        {theme.header?.logoLight ? (
                          <img
                            src={theme.header.logoLight}
                            alt="Logo Light"
                            className="max-h-16 max-w-full object-contain"
                          />
                        ) : (
                          <span className="text-xs text-gray-400">Sin logo</span>
                        )}
                      </div>
                    </div>

                    <div className="rounded-2xl border bg-white p-3">
                      <div className="mb-2 text-xs text-gray-500">Vista previa (Dark)</div>
                      <div className="flex h-20 items-center justify-center rounded-xl border bg-gray-50">
                        {theme.header?.logoDark ? (
                          <img
                            src={theme.header.logoDark}
                            alt="Logo Dark"
                            className="max-h-16 max-w-full object-contain"
                          />
                        ) : (
                          <span className="text-xs text-gray-400">Sin logo</span>
                        )}
                      </div>
                    </div>
                  </PanelBlock>

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

                      <div className="mt-2 text-xs text-gray-500">
                        Nota: mueve la barra, luego presiona{" "}
                        <span className="font-medium">Guardar</span>.
                      </div>
                    </div>
                  </PanelBlock>
                </>
              )}

              {brandingSubTab === "subida" && (
                <>
                  <PanelBlock title="Subir logo desde tu PC (Cloudinary)">
                    <div className="rounded-2xl border bg-white p-4">
                      <div className="mb-2 text-sm font-medium text-gray-800">Logo Light</div>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(e) => setLogoLightFile(e.target.files?.[0] || null)}
                        className="block w-full text-sm"
                      />
                      <button
                        type="button"
                        disabled={uploading}
                        onClick={() => onUploadLogo("light")}
                        className="mt-3 w-full rounded-xl bg-pink-600 px-3 py-2 text-sm text-white transition hover:bg-pink-700 disabled:opacity-60"
                      >
                        {uploading ? "Subiendo..." : "Subir a Cloudinary"}
                      </button>
                    </div>

                    <div className="rounded-2xl border bg-white p-4">
                      <div className="mb-2 text-sm font-medium text-gray-800">Logo Dark</div>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(e) => setLogoDarkFile(e.target.files?.[0] || null)}
                        className="block w-full text-sm"
                      />
                      <button
                        type="button"
                        disabled={uploading}
                        onClick={() => onUploadLogo("dark")}
                        className="mt-3 w-full rounded-xl bg-pink-600 px-3 py-2 text-sm text-white transition hover:bg-pink-700 disabled:opacity-60"
                      >
                        {uploading ? "Subiendo..." : "Subir a Cloudinary"}
                      </button>
                    </div>
                  </PanelBlock>

                  <PanelBlock title="URLs manuales del logo">
                    <Input
                      label="Logo del Header (Light) — URL"
                      value={theme.header?.logoLight || ""}
                      onChange={(e) => setPath("header.logoLight", e.target.value)}
                      placeholder="https://.../logo_header_light.png"
                    />

                    <Input
                      label="Logo del Header (Dark) — URL"
                      value={theme.header?.logoDark || ""}
                      onChange={(e) => setPath("header.logoDark", e.target.value)}
                      placeholder="https://.../logo_header_dark.png"
                    />
                  </PanelBlock>

                  <div className="text-xs text-gray-500">
                    Nota: después de subir, presiona <span className="font-medium">Guardar</span>{" "}
                    para que quede fijo.
                  </div>
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
          <section className="mt-6 rounded-3xl border border-gray-200 bg-white p-4 md:p-5">
            <div className="mb-4">
              <InfoCard
                title="Consejo de diseño"
                text="Aquí separé la fuente del header, el estilo del menú y el estilo de los íconos para que el usuario solo abra el grupo que necesita y no haga scroll innecesario."
              />
            </div>

            <div className="mb-5 flex flex-wrap gap-2">
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
                <PanelBlock title="Tipografía del header">
                  <Select
                    label="Preset de fuente del Header"
                    value={theme.header?.fontPreset || ""}
                    onChange={(e) => setPath("header.fontPreset", e.target.value)}
                  >
                    <option value="">(Sin preset)</option>
                    <option value="classic">Classic (Playfair)</option>
                    <option value="modern">Modern (Inter)</option>
                    <option value="elegant">Elegant (Cormorant)</option>
                    <option value="cute">Cute (Baloo)</option>
                  </Select>

                  <Input
                    label="Tamaño de fuente header (px)"
                    type="number"
                    min={12}
                    max={30}
                    step="1"
                    value={theme.header?.fontSizePx ?? 16}
                    onChange={(e) => setPath("header.fontSizePx", Number(e.target.value))}
                  />

                  <div className="xl:col-span-2">
                    <Input
                      label="Fuente personalizada (CSS font-family) — opcional"
                      value={theme.header?.fontFamily || ""}
                      onChange={(e) => setPath("header.fontFamily", e.target.value)}
                      placeholder='"Playfair Display", Georgia, serif'
                    />
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
          <section className="mt-6 rounded-3xl border border-gray-200 bg-white p-4 md:p-5">
            <div className="mb-4">
              <InfoCard
                title="Responsive y menú móvil"
                text="Aquí defines cómo se comporta el header en pantallas pequeñas: estilo del botón hamburguesa, transición del panel, fondo, bordes, botones y acabados visuales."
              />
            </div>

            <div className="mb-5 flex flex-wrap gap-2">
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

        {activeMainTab === "menu" && (
          <section className="mt-6 rounded-3xl border border-gray-200 bg-white p-4 md:p-5">
            <div className="mb-4">
              <InfoCard
                title="Consejo funcional"
                text="Toda la administración de botones del menú quedó concentrada en un solo bloque, con más ancho útil y sin competir con otros formularios del header."
              />
            </div>

            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="text-sm font-semibold text-gray-800">
                    Menú del Header (botones)
                  </div>
                  <p className="mt-1 text-sm text-gray-600">
                    Edita texto y ruta. Luego presiona <span className="font-medium">Guardar</span>.
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
                              Ruta / link
                            </span>

                            <select
                              className="mb-2 w-full min-w-0 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-pink-300 focus:ring-2 focus:ring-pink-200"
                              value={item?.ref || ""}
                              onChange={(e) => setHeaderMenuItem(idx, { ref: e.target.value })}
                            >
                              <option value="">(Selecciona una ruta)</option>
                              <optgroup label="Público">
                                {routeOptions.public.map((r) => (
                                  <option key={r.value} value={r.value}>
                                    {r.label} — {r.value}
                                  </option>
                                ))}
                              </optgroup>
                              <optgroup label="Admin">
                                {routeOptions.admin.map((r) => (
                                  <option key={r.value} value={r.value}>
                                    {r.label} — {r.value}
                                  </option>
                                ))}
                              </optgroup>
                              <optgroup label="Utilidades">
                                {routeOptions.util.map((r) => (
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
                              placeholder="Ej: /lo-nuevo"
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
                        Tip: para productos usa <span className="font-mono">/producto/:id</span>{" "}
                        o <span className="font-mono">/p/:id</span>.
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}