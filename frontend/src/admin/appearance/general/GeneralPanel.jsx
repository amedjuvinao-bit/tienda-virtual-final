// src/admin/appearance/general/GeneralPanel.jsx
import React, { useMemo, useState } from "react";
import { normalizeGlobalConfig } from "./generalHelpers";

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

const Toggle = ({ label, checked, onChange }) => (
  <label className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
    <span className="text-sm text-gray-700">{label}</span>
    <input
      type="checkbox"
      checked={!!checked}
      onChange={(e) => onChange(e.target.checked)}
      className="h-4 w-4 shrink-0 accent-pink-600"
    />
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
  <div className="mb-5">
    <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
    <p className="mt-1 text-sm text-gray-500">{description}</p>
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

export default function GeneralPanel({ theme, setPath }) {
  const globalConfig = normalizeGlobalConfig(theme?.global);

  const mainTabs = useMemo(
    () => [
      {
        id: "whatsapp",
        label: "WhatsApp",
        description: "Botón flotante, contacto, estilo e imagen.",
      },
      {
        id: "scroll",
        label: "Navegación",
        description: "Botones subir y bajar, posición y comportamiento.",
      },
      {
        id: "loader",
        label: "Loader",
        description: "Pantalla de carga, estilos, colores, logo y animaciones.",
      },
    ],
    []
  );

  const [activeMainTab, setActiveMainTab] = useState("whatsapp");
  const [whatsSubTab, setWhatsSubTab] = useState("contacto");
  const [scrollSubTab, setScrollSubTab] = useState("general");
  const [loaderSubTab, setLoaderSubTab] = useState("basico");

  return (
    <div className="min-w-0 space-y-6">
      <div className="rounded-3xl border border-gray-200 bg-white p-4 md:p-5">
        <div className="mb-5">
          <h2 className="text-xl font-semibold text-gray-900">Configuración general</h2>
          <p className="mt-1 text-sm text-gray-500">
            Organiza los elementos globales con una estructura más compacta, clara y rápida de
            usar.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
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

        {activeMainTab === "whatsapp" && (
          <section className="mt-6 rounded-3xl border border-gray-200 bg-white p-4 md:p-5">
            <SectionHeader
              title="Botón de WhatsApp"
              description="Define visibilidad, contacto, apariencia, imagen y animación del botón flotante."
            />

            <div className="mb-4">
              <InfoCard
                title="Consejo visual"
                text="Aquí todo está separado por grupos para que el usuario no tenga que bajar demasiado. Primero configura contacto, luego estilo y por último imagen o animación."
              />
            </div>

            <div className="mb-5 flex flex-wrap gap-2">
              <SubTabButton
                active={whatsSubTab === "contacto"}
                label="Contacto"
                onClick={() => setWhatsSubTab("contacto")}
              />
              <SubTabButton
                active={whatsSubTab === "estilo"}
                label="Estilo"
                onClick={() => setWhatsSubTab("estilo")}
              />
              <SubTabButton
                active={whatsSubTab === "imagen"}
                label="Imagen y animación"
                onClick={() => setWhatsSubTab("imagen")}
              />
            </div>

            <div className="space-y-4">
              {whatsSubTab === "contacto" && (
                <PanelBlock title="Activación y contacto">
                  <Toggle
                    label="Mostrar botón de WhatsApp"
                    checked={globalConfig.whatsapp.enabled}
                    onChange={(value) => setPath("global.whatsapp.enabled", value)}
                  />

                  <Select
                    label="Posición"
                    value={globalConfig.whatsapp.position || "right"}
                    onChange={(e) => setPath("global.whatsapp.position", e.target.value)}
                  >
                    <option value="right">Derecha</option>
                    <option value="left">Izquierda</option>
                  </Select>

                  <Input
                    label="Número de WhatsApp"
                    value={globalConfig.whatsapp.phone || ""}
                    onChange={(e) => setPath("global.whatsapp.phone", e.target.value)}
                    placeholder="Ej: 573154101276"
                  />

                  <Input
                    label="Mensaje predeterminado"
                    value={globalConfig.whatsapp.message || ""}
                    onChange={(e) => setPath("global.whatsapp.message", e.target.value)}
                    placeholder="Hola, quiero más información"
                  />

                  <Input
                    type="number"
                    min={0}
                    max={200}
                    step="1"
                    label="Separación inferior (px)"
                    value={globalConfig.whatsapp.bottomPx ?? 24}
                    onChange={(e) =>
                      setPath("global.whatsapp.bottomPx", Number(e.target.value))
                    }
                  />

                  <Input
                    type="number"
                    min={36}
                    max={120}
                    step="1"
                    label="Tamaño del botón (px)"
                    value={globalConfig.whatsapp.sizePx ?? 56}
                    onChange={(e) => setPath("global.whatsapp.sizePx", Number(e.target.value))}
                  />
                </PanelBlock>
              )}

              {whatsSubTab === "estilo" && (
                <PanelBlock title="Apariencia y bordes">
                  <label className="block min-w-0">
                    <span className="mb-1 block text-sm font-medium text-gray-700">
                      Color de fondo
                    </span>
                    <ColorInput
                      value={globalConfig.whatsapp.bgColor || "#25D366"}
                      onChange={(e) => setPath("global.whatsapp.bgColor", e.target.value)}
                    />
                  </label>

                  <Select
                    label="Sombra"
                    value={globalConfig.whatsapp.shadow || "soft"}
                    onChange={(e) => setPath("global.whatsapp.shadow", e.target.value)}
                  >
                    <option value="none">Sin sombra</option>
                    <option value="soft">Suave</option>
                    <option value="strong">Fuerte</option>
                  </Select>

                  <Input
                    type="number"
                    min={0}
                    max={999}
                    step="1"
                    label="Radio de bordes (px)"
                    value={globalConfig.whatsapp.borderRadiusPx ?? 999}
                    onChange={(e) =>
                      setPath("global.whatsapp.borderRadiusPx", Number(e.target.value))
                    }
                  />

                  <Input
                    type="number"
                    min={0}
                    max={20}
                    step="1"
                    label="Grosor del borde (px)"
                    value={globalConfig.whatsapp.borderWidthPx ?? 0}
                    onChange={(e) =>
                      setPath("global.whatsapp.borderWidthPx", Number(e.target.value))
                    }
                  />

                  <label className="block min-w-0 xl:col-span-2">
                    <span className="mb-1 block text-sm font-medium text-gray-700">
                      Color del borde
                    </span>
                    <ColorInput
                      value={globalConfig.whatsapp.borderColor || "#25D366"}
                      onChange={(e) => setPath("global.whatsapp.borderColor", e.target.value)}
                    />
                  </label>
                </PanelBlock>
              )}

              {whatsSubTab === "imagen" && (
                <PanelBlock title="Ícono e imagen personalizada">
                  <Toggle
                    label="Usar imagen personalizada"
                    checked={globalConfig.whatsapp.useCustomImage}
                    onChange={(value) => setPath("global.whatsapp.useCustomImage", value)}
                  />

                  <Select
                    label="Animación"
                    value={globalConfig.whatsapp.animation || "none"}
                    onChange={(e) => setPath("global.whatsapp.animation", e.target.value)}
                  >
                    <option value="none">Sin animación</option>
                    <option value="pulse">Pulse</option>
                    <option value="float">Flotar</option>
                    <option value="bounce">Bounce</option>
                  </Select>

                  <Input
                    label="URL de imagen personalizada"
                    value={globalConfig.whatsapp.imageUrl || ""}
                    onChange={(e) => setPath("global.whatsapp.imageUrl", e.target.value)}
                    placeholder="https://.../mi-icono-whatsapp.png"
                  />

                  <Input
                    type="number"
                    min={20}
                    max={100}
                    step="1"
                    label="Tamaño del ícono interno (%)"
                    value={globalConfig.whatsapp.iconSizePercent ?? 80}
                    onChange={(e) =>
                      setPath("global.whatsapp.iconSizePercent", Number(e.target.value))
                    }
                  />
                </PanelBlock>
              )}
            </div>
          </section>
        )}

        {activeMainTab === "scroll" && (
          <section className="mt-6 rounded-3xl border border-gray-200 bg-white p-4 md:p-5">
            <SectionHeader
              title="Navegación entre secciones"
              description="Controla visibilidad, posición, estilo, imágenes y animación de los botones flotantes."
            />

            <div className="mb-4">
              <InfoCard
                title="Consejo funcional"
                text="Se dividió esta parte en grupos cortos para evitar formularios largos. Así el usuario entra directo a general, estilo, botón subir o botón bajar."
              />
            </div>

            <div className="mb-5 flex flex-wrap gap-2">
              <SubTabButton
                active={scrollSubTab === "general"}
                label="General"
                onClick={() => setScrollSubTab("general")}
              />
              <SubTabButton
                active={scrollSubTab === "estilo"}
                label="Estilo"
                onClick={() => setScrollSubTab("estilo")}
              />
              <SubTabButton
                active={scrollSubTab === "subir"}
                label="Botón subir"
                onClick={() => setScrollSubTab("subir")}
              />
              <SubTabButton
                active={scrollSubTab === "bajar"}
                label="Botón bajar"
                onClick={() => setScrollSubTab("bajar")}
              />
            </div>

            <div className="space-y-4">
              {scrollSubTab === "general" && (
                <PanelBlock title="Visibilidad y comportamiento">
                  <Toggle
                    label="Mostrar botones de navegación"
                    checked={globalConfig.scrollButtons.enabled}
                    onChange={(value) => setPath("global.scrollButtons.enabled", value)}
                  />

                  <Select
                    label="Comportamiento del scroll"
                    value={globalConfig.scrollButtons.behavior || "smooth"}
                    onChange={(e) => setPath("global.scrollButtons.behavior", e.target.value)}
                  >
                    <option value="smooth">Suave</option>
                    <option value="auto">Instantáneo</option>
                  </Select>

                  <Toggle
                    label="Mostrar botón subir"
                    checked={globalConfig.scrollButtons.showUp}
                    onChange={(value) => setPath("global.scrollButtons.showUp", value)}
                  />

                  <Toggle
                    label="Mostrar botón bajar"
                    checked={globalConfig.scrollButtons.showDown}
                    onChange={(value) => setPath("global.scrollButtons.showDown", value)}
                  />

                  <Input
                    type="number"
                    min={0}
                    max={300}
                    step="1"
                    label="Offset superior (px)"
                    value={globalConfig.scrollButtons.offsetTopPx ?? 80}
                    onChange={(e) =>
                      setPath("global.scrollButtons.offsetTopPx", Number(e.target.value))
                    }
                  />

                  <Select
                    label="Posición horizontal"
                    value={globalConfig.scrollButtons.position || "center"}
                    onChange={(e) => setPath("global.scrollButtons.position", e.target.value)}
                  >
                    <option value="left">Izquierda</option>
                    <option value="center">Centro</option>
                    <option value="right">Derecha</option>
                  </Select>

                  <Input
                    type="number"
                    min={0}
                    max={200}
                    step="1"
                    label="Separación inferior (px)"
                    value={globalConfig.scrollButtons.bottomPx ?? 24}
                    onChange={(e) =>
                      setPath("global.scrollButtons.bottomPx", Number(e.target.value))
                    }
                  />

                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step="1"
                    label="Espacio entre botones (px)"
                    value={globalConfig.scrollButtons.gapPx ?? 16}
                    onChange={(e) =>
                      setPath("global.scrollButtons.gapPx", Number(e.target.value))
                    }
                  />
                </PanelBlock>
              )}

              {scrollSubTab === "estilo" && (
                <PanelBlock title="Estilo general">
                  <Input
                    type="number"
                    min={28}
                    max={140}
                    step="1"
                    label="Tamaño del botón (px)"
                    value={globalConfig.scrollButtons.buttonSizePx ?? 44}
                    onChange={(e) =>
                      setPath("global.scrollButtons.buttonSizePx", Number(e.target.value))
                    }
                  />

                  <Select
                    label="Sombra"
                    value={globalConfig.scrollButtons.shadow || "soft"}
                    onChange={(e) => setPath("global.scrollButtons.shadow", e.target.value)}
                  >
                    <option value="none">Sin sombra</option>
                    <option value="soft">Suave</option>
                    <option value="strong">Fuerte</option>
                  </Select>

                  <label className="block min-w-0">
                    <span className="mb-1 block text-sm font-medium text-gray-700">
                      Color de fondo
                    </span>
                    <Input
                      value={globalConfig.scrollButtons.bgColor || "rgba(252, 231, 243, 0.5)"}
                      onChange={(e) => setPath("global.scrollButtons.bgColor", e.target.value)}
                      placeholder="rgba(252, 231, 243, 0.5) o #FFFFFF"
                    />
                  </label>

                  <label className="block min-w-0">
                    <span className="mb-1 block text-sm font-medium text-gray-700">
                      Color del ícono
                    </span>
                    <ColorInput
                      value={globalConfig.scrollButtons.iconColor || "#D4AF37"}
                      onChange={(e) => setPath("global.scrollButtons.iconColor", e.target.value)}
                    />
                  </label>

                  <Input
                    type="number"
                    min={0}
                    max={20}
                    step="1"
                    label="Grosor del borde (px)"
                    value={globalConfig.scrollButtons.borderWidthPx ?? 2}
                    onChange={(e) =>
                      setPath("global.scrollButtons.borderWidthPx", Number(e.target.value))
                    }
                  />

                  <Input
                    type="number"
                    min={0}
                    max={999}
                    step="1"
                    label="Radio de bordes (px)"
                    value={globalConfig.scrollButtons.borderRadiusPx ?? 999}
                    onChange={(e) =>
                      setPath("global.scrollButtons.borderRadiusPx", Number(e.target.value))
                    }
                  />

                  <label className="block min-w-0 xl:col-span-2">
                    <span className="mb-1 block text-sm font-medium text-gray-700">
                      Color del borde
                    </span>
                    <ColorInput
                      value={globalConfig.scrollButtons.borderColor || "#D4AF37"}
                      onChange={(e) => setPath("global.scrollButtons.borderColor", e.target.value)}
                    />
                  </label>
                </PanelBlock>
              )}

              {scrollSubTab === "subir" && (
                <PanelBlock title="Configuración del botón subir">
                  <Select
                    label="Animación botón subir"
                    value={globalConfig.scrollButtons.upAnimation || "moveUp"}
                    onChange={(e) => setPath("global.scrollButtons.upAnimation", e.target.value)}
                  >
                    <option value="none">Sin animación</option>
                    <option value="moveUp">Movimiento arriba</option>
                    <option value="pulse">Pulse</option>
                    <option value="bounce">Bounce</option>
                  </Select>

                  <Toggle
                    label="Usar imagen personalizada en botón subir"
                    checked={globalConfig.scrollButtons.upUseCustomImage}
                    onChange={(value) => setPath("global.scrollButtons.upUseCustomImage", value)}
                  />

                  <Input
                    label="URL imagen botón subir"
                    value={globalConfig.scrollButtons.upImageUrl || ""}
                    onChange={(e) => setPath("global.scrollButtons.upImageUrl", e.target.value)}
                    placeholder="https://.../boton-subir.png"
                  />

                  <Input
                    type="number"
                    min={20}
                    max={100}
                    step="1"
                    label="Tamaño imagen botón subir (%)"
                    value={globalConfig.scrollButtons.upImageSizePercent ?? 70}
                    onChange={(e) =>
                      setPath("global.scrollButtons.upImageSizePercent", Number(e.target.value))
                    }
                  />
                </PanelBlock>
              )}

              {scrollSubTab === "bajar" && (
                <PanelBlock title="Configuración del botón bajar">
                  <Select
                    label="Animación botón bajar"
                    value={globalConfig.scrollButtons.downAnimation || "moveDown"}
                    onChange={(e) => setPath("global.scrollButtons.downAnimation", e.target.value)}
                  >
                    <option value="none">Sin animación</option>
                    <option value="moveDown">Movimiento abajo</option>
                    <option value="pulse">Pulse</option>
                    <option value="bounce">Bounce</option>
                  </Select>

                  <Toggle
                    label="Usar imagen personalizada en botón bajar"
                    checked={globalConfig.scrollButtons.downUseCustomImage}
                    onChange={(value) => setPath("global.scrollButtons.downUseCustomImage", value)}
                  />

                  <Input
                    label="URL imagen botón bajar"
                    value={globalConfig.scrollButtons.downImageUrl || ""}
                    onChange={(e) => setPath("global.scrollButtons.downImageUrl", e.target.value)}
                    placeholder="https://.../boton-bajar.png"
                  />

                  <Input
                    type="number"
                    min={20}
                    max={100}
                    step="1"
                    label="Tamaño imagen botón bajar (%)"
                    value={globalConfig.scrollButtons.downImageSizePercent ?? 70}
                    onChange={(e) =>
                      setPath("global.scrollButtons.downImageSizePercent", Number(e.target.value))
                    }
                  />
                </PanelBlock>
              )}
            </div>
          </section>
        )}

        {activeMainTab === "loader" && (
          <section className="mt-6 rounded-3xl border border-gray-200 bg-white p-4 md:p-5">
            <SectionHeader
              title="Loader global"
              description="Personaliza la pantalla de carga de la tienda con estilos profesionales, colores, íconos, animaciones y logo opcional."
            />

            <div className="mb-4">
              <InfoCard
                title="Consejo visual"
                text="Esta parte se reorganizó para que el usuario entre solo al grupo que necesita: básico, identidad, visual o movimiento. Así se reduce mucho el scroll."
              />
            </div>

            <div className="mb-5 flex flex-wrap gap-2">
              <SubTabButton
                active={loaderSubTab === "basico"}
                label="Básico"
                onClick={() => setLoaderSubTab("basico")}
              />
              <SubTabButton
                active={loaderSubTab === "identidad"}
                label="Identidad"
                onClick={() => setLoaderSubTab("identidad")}
              />
              <SubTabButton
                active={loaderSubTab === "visual"}
                label="Color y visual"
                onClick={() => setLoaderSubTab("visual")}
              />
              <SubTabButton
                active={loaderSubTab === "movimiento"}
                label="Movimiento"
                onClick={() => setLoaderSubTab("movimiento")}
              />
              <SubTabButton
                active={loaderSubTab === "avanzado"}
                label="Avanzado"
                onClick={() => setLoaderSubTab("avanzado")}
              />
            </div>

            <div className="space-y-4">
              {loaderSubTab === "basico" && (
                <PanelBlock title="Activación general">
                  <Toggle
                    label="Activar loader global"
                    checked={globalConfig.loader?.enabled}
                    onChange={(value) => setPath("global.loader.enabled", value)}
                  />

                  <Toggle
                    label="Mostrar texto de carga"
                    checked={globalConfig.loader?.showText}
                    onChange={(value) => setPath("global.loader.showText", value)}
                  />

                  <Toggle
                    label="Mostrar logo o imagen personalizada"
                    checked={globalConfig.loader?.showLogo}
                    onChange={(value) => setPath("global.loader.showLogo", value)}
                  />

                  <Input
                    label="Texto de carga"
                    value={globalConfig.loader?.text || ""}
                    onChange={(e) => setPath("global.loader.text", e.target.value)}
                    placeholder="Cargando colección..."
                  />
                </PanelBlock>
              )}

              {loaderSubTab === "identidad" && (
                <PanelBlock title="Tipo, ícono y logo">
                  <Select
                    label="Tipo de loader"
                    value={globalConfig.loader?.type || "spinner"}
                    onChange={(e) => setPath("global.loader.type", e.target.value)}
                  >
                    <option value="spinner">Spinner clásico</option>
                    <option value="ring">Ring premium</option>
                    <option value="dual-ring">Dual ring</option>
                    <option value="dots">Dots elegantes</option>
                    <option value="bars">Barras suaves</option>
                    <option value="pulse">Pulse minimal</option>
                    <option value="diamond">Diamante</option>
                    <option value="orbit">Órbita</option>
                  </Select>

                  <Select
                    label="Ícono visual"
                    value={globalConfig.loader?.icon || "none"}
                    onChange={(e) => setPath("global.loader.icon", e.target.value)}
                  >
                    <option value="none">Sin ícono</option>
                    <option value="sparkles">Destellos</option>
                    <option value="star">Estrella</option>
                    <option value="heart">Corazón</option>
                    <option value="diamond">Diamante</option>
                    <option value="crown">Corona</option>
                    <option value="flower">Flor</option>
                    <option value="bag">Bolsa de compras</option>
                  </Select>

                  <Input
                    label="URL logo o imagen"
                    value={globalConfig.loader?.logoUrl || ""}
                    onChange={(e) => setPath("global.loader.logoUrl", e.target.value)}
                    placeholder="https://.../logo-loader.png"
                  />

                  <Input
                    type="number"
                    min={20}
                    max={400}
                    step="1"
                    label="Tamaño del logo (px)"
                    value={globalConfig.loader?.logoSizePx ?? 72}
                    onChange={(e) => setPath("global.loader.logoSizePx", Number(e.target.value))}
                  />
                </PanelBlock>
              )}

              {loaderSubTab === "visual" && (
                <PanelBlock title="Colores, fondo y contraste">
                  <label className="block min-w-0">
                    <span className="mb-1 block text-sm font-medium text-gray-700">
                      Color principal
                    </span>
                    <ColorInput
                      value={globalConfig.loader?.color || "#ec4899"}
                      onChange={(e) => setPath("global.loader.color", e.target.value)}
                    />
                  </label>

                  <label className="block min-w-0">
                    <span className="mb-1 block text-sm font-medium text-gray-700">
                      Color secundario
                    </span>
                    <ColorInput
                      value={globalConfig.loader?.secondaryColor || "#f9a8d4"}
                      onChange={(e) => setPath("global.loader.secondaryColor", e.target.value)}
                    />
                  </label>

                  <label className="block min-w-0">
                    <span className="mb-1 block text-sm font-medium text-gray-700">
                      Color del fondo
                    </span>
                    <ColorInput
                      value={globalConfig.loader?.backgroundColor || "#ffffff"}
                      onChange={(e) => setPath("global.loader.backgroundColor", e.target.value)}
                    />
                  </label>

                  <label className="block min-w-0">
                    <span className="mb-1 block text-sm font-medium text-gray-700">
                      Color del texto
                    </span>
                    <ColorInput
                      value={globalConfig.loader?.textColor || "#111827"}
                      onChange={(e) => setPath("global.loader.textColor", e.target.value)}
                    />
                  </label>

                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step="1"
                    label="Opacidad del fondo (%)"
                    value={globalConfig.loader?.overlayOpacity ?? 100}
                    onChange={(e) =>
                      setPath("global.loader.overlayOpacity", Number(e.target.value))
                    }
                  />

                  <Select
                    label="Estilo visual"
                    value={globalConfig.loader?.visualStyle || "soft"}
                    onChange={(e) => setPath("global.loader.visualStyle", e.target.value)}
                  >
                    <option value="minimal">Minimal</option>
                    <option value="soft">Suave</option>
                    <option value="luxury">Luxury</option>
                    <option value="glass">Glass</option>
                    <option value="dark">Oscuro elegante</option>
                  </Select>
                </PanelBlock>
              )}

              {loaderSubTab === "movimiento" && (
                <PanelBlock title="Tamaño, velocidad y animación">
                  <Input
                    type="number"
                    min={24}
                    max={220}
                    step="1"
                    label="Tamaño del loader (px)"
                    value={globalConfig.loader?.sizePx ?? 64}
                    onChange={(e) => setPath("global.loader.sizePx", Number(e.target.value))}
                  />

                  <Input
                    type="number"
                    min={1}
                    max={20}
                    step="1"
                    label="Grosor del loader (px)"
                    value={globalConfig.loader?.strokeWidth ?? 4}
                    onChange={(e) =>
                      setPath("global.loader.strokeWidth", Number(e.target.value))
                    }
                  />

                  <Select
                    label="Animación principal"
                    value={globalConfig.loader?.animation || "spin"}
                    onChange={(e) => setPath("global.loader.animation", e.target.value)}
                  >
                    <option value="spin">Spin</option>
                    <option value="pulse">Pulse</option>
                    <option value="float">Float</option>
                    <option value="bounce">Bounce</option>
                    <option value="breath">Breath</option>
                    <option value="wave">Wave</option>
                    <option value="orbit">Orbit</option>
                    <option value="shimmer">Shimmer</option>
                  </Select>

                  <Select
                    label="Velocidad"
                    value={globalConfig.loader?.speed || "normal"}
                    onChange={(e) => setPath("global.loader.speed", e.target.value)}
                  >
                    <option value="slow">Lenta</option>
                    <option value="normal">Normal</option>
                    <option value="fast">Rápida</option>
                  </Select>

                  <Input
                    type="number"
                    min={0}
                    max={5000}
                    step="50"
                    label="Duración animación (ms)"
                    value={globalConfig.loader?.durationMs ?? 1200}
                    onChange={(e) => setPath("global.loader.durationMs", Number(e.target.value))}
                  />
                </PanelBlock>
              )}

              {loaderSubTab === "avanzado" && (
                <PanelBlock title="Ajustes avanzados">
                  <Select
                    label="Forma del contenedor"
                    value={globalConfig.loader?.shape || "circle"}
                    onChange={(e) => setPath("global.loader.shape", e.target.value)}
                  >
                    <option value="circle">Circular</option>
                    <option value="rounded">Redondeado</option>
                    <option value="square">Cuadrado</option>
                  </Select>

                  <Select
                    label="Sombra"
                    value={globalConfig.loader?.shadow || "soft"}
                    onChange={(e) => setPath("global.loader.shadow", e.target.value)}
                  >
                    <option value="none">Sin sombra</option>
                    <option value="soft">Suave</option>
                    <option value="strong">Fuerte</option>
                    <option value="glow">Glow</option>
                  </Select>

                  <Input
                    type="number"
                    min={0}
                    max={999}
                    step="1"
                    label="Radio de bordes (px)"
                    value={globalConfig.loader?.borderRadiusPx ?? 999}
                    onChange={(e) =>
                      setPath("global.loader.borderRadiusPx", Number(e.target.value))
                    }
                  />

                  <Input
                    type="number"
                    min={0}
                    max={20}
                    step="1"
                    label="Separación entre logo y loader (px)"
                    value={globalConfig.loader?.gapPx ?? 16}
                    onChange={(e) => setPath("global.loader.gapPx", Number(e.target.value))}
                  />
                </PanelBlock>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}