// src/admin/appearance/general/GeneralPanel.jsx
import React, { useMemo, useState } from "react";
import { CircleOff, Crown, Flower2, Gem, Heart, LoaderCircle, MessageCircle, ShoppingBag, Sparkles, Star, ChevronsUpDown } from "lucide-react";
import { normalizeGlobalConfig } from "./generalHelpers";
import AppearanceToolPreview from "./AppearanceToolPreview";
import CloudinaryImageField from "./CloudinaryImageField";
import "./appearanceGeneral.css";

const LOADER_ICONS = [
  { value: "none", label: "Sin ícono", Icon: CircleOff },
  { value: "sparkles", label: "Destellos", Icon: Sparkles },
  { value: "star", label: "Estrella", Icon: Star },
  { value: "heart", label: "Corazón", Icon: Heart },
  { value: "diamond", label: "Diamante", Icon: Gem },
  { value: "crown", label: "Corona", Icon: Crown },
  { value: "flower", label: "Flor", Icon: Flower2 },
  { value: "bag", label: "Bolsa", Icon: ShoppingBag },
];

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
  <label className="appearance-general__toggle flex items-center justify-between gap-3 rounded-xl px-4 py-3">
    <span className="text-sm text-gray-700">{label}</span>
    <input
      type="checkbox"
      checked={!!checked}
      onChange={(e) => onChange(e.target.checked)}
      className="h-5 w-5 shrink-0 accent-pink-600"
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
  <div className="appearance-general__section-header">
    <h3>{title}</h3>
    <p>{description}</p>
  </div>
);

const MainTabButton = ({ active, label, description, status, Icon, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="appearance-panel-main-tab"
    aria-pressed={active}
    data-active={active}
  >
    <span className="appearance-general__tab-icon" aria-hidden="true"><Icon size={23} strokeWidth={1.75} /></span>
    <span className="appearance-general__tab-copy"><strong>{label}</strong><small>{description}</small></span>
    <span className="appearance-general__tab-status">{status}</span>
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
  <div className="appearance-general__block rounded-2xl p-4">
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

export default function GeneralPanel({ theme, setPath, uploading, setUploading, savedRevision, uploadToCloudinaryViaBackend }) {
  const globalConfig = normalizeGlobalConfig(theme?.global);

  const mainTabs = useMemo(
    () => [
      {
        id: "whatsapp",
        label: "WhatsApp",
        description: "Contacto y botón flotante",
        Icon: MessageCircle,
      },
      {
        id: "scroll",
        label: "Navegación",
        description: "Subir y bajar por la tienda",
        Icon: ChevronsUpDown,
      },
      {
        id: "loader",
        label: "Loader",
        description: "Pantalla de carga",
        Icon: LoaderCircle,
      },
    ],
    []
  );

  const [activeMainTab, setActiveMainTab] = useState("whatsapp");
  const [whatsSubTab, setWhatsSubTab] = useState("contacto");
  const [scrollSubTab, setScrollSubTab] = useState("general");
  const [loaderSubTab, setLoaderSubTab] = useState("basico");

  return (
    <div className="appearance-general min-w-0">
      <div className="appearance-general__shell rounded-2xl p-3 md:p-4">
        <div className="appearance-general__intro">
          <div>
            <span className="appearance-general__eyebrow">EXPERIENCIA DE LA TIENDA</span>
            <h2>Herramientas de la tienda</h2>
            <p>Elige una herramienta, ajusta sus opciones y mira el resultado aquí mismo.</p>
          </div>
        </div>

        <div className="appearance-general__tabs">
          {mainTabs.map((tab) => (
            <MainTabButton
              key={tab.id}
              active={activeMainTab === tab.id}
              label={tab.label}
              description={tab.description}
              Icon={tab.Icon}
              status={tab.id === "whatsapp"
                ? (globalConfig.whatsapp.enabled ? (globalConfig.whatsapp.phone ? "Activo" : "Falta número") : "Apagado")
                : tab.id === "scroll" ? (globalConfig.scrollButtons.enabled ? "Activo" : "Apagado")
                : (globalConfig.loader.enabled ? "Activo" : "Apagado")}
              onClick={() => setActiveMainTab(tab.id)}
            />
          ))}
        </div>

        <div className="appearance-general__workspace">
          <div className="appearance-general__form">

        {activeMainTab === "whatsapp" && (
          <section className="appearance-general__section">
            <SectionHeader
              title="Botón de WhatsApp"
              description="Define visibilidad, contacto, apariencia, imagen y animación del botón flotante."
            />

            <div className="mb-3 flex flex-wrap gap-2">
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

                  <div className="min-w-0 xl:col-span-2">
                    <label className="block min-w-0">
                      <span className="mb-1 block text-sm font-medium text-gray-700">Saludo al pasar el cursor</span>
                      <input
                        className="w-full min-w-0 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-pink-300 focus:ring-2 focus:ring-pink-200"
                        value={globalConfig.whatsapp.greeting ?? ""}
                        onChange={(e) => setPath("global.whatsapp.greeting", e.target.value)}
                        placeholder="¡Hola! ¿En qué podemos ayudarte?"
                        maxLength={120}
                      />
                    </label>
                    <p className="mt-1 text-xs text-gray-600">Aparece junto al botón al pasar el cursor. Déjalo vacío para ocultarlo. En celular, el botón abre WhatsApp directamente.</p>
                  </div>

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

                </PanelBlock>
              )}

              {whatsSubTab === "estilo" && (
                <PanelBlock title="Apariencia y bordes">
                  <Toggle
                    label="Mostrar fondo de cristal"
                    checked={globalConfig.whatsapp.showBackground !== false}
                    onChange={(value) => {
                      setPath("global.whatsapp.showBackground", value);
                      if (!value && Number(globalConfig.whatsapp.sizePx) < 90) setPath("global.whatsapp.sizePx", 90);
                    }}
                  />
                  {globalConfig.whatsapp.showBackground === false && <p className="self-center text-xs text-gray-600">Solo se verá la imagen transparente, sin círculo, borde ni sombra de fondo.</p>}
                  {globalConfig.whatsapp.showBackground !== false && <>
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
                  </>}
                </PanelBlock>
              )}

              {whatsSubTab === "imagen" && (
                <PanelBlock title="Ícono e imagen personalizada">
                  <Input
                    type="number"
                    min={44}
                    max={140}
                    step="1"
                    label={globalConfig.whatsapp.showBackground === false ? "Tamaño visible de la imagen (px)" : "Tamaño del botón (px)"}
                    value={globalConfig.whatsapp.sizePx ?? 56}
                    onChange={(e) => setPath("global.whatsapp.sizePx", Number(e.target.value))}
                  />
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

                  {globalConfig.whatsapp.useCustomImage && <CloudinaryImageField
                    label="Botón de WhatsApp"
                    value={globalConfig.whatsapp.imageUrl || ""}
                    onChange={(url) => setPath("global.whatsapp.imageUrl", url)}
                    onUpload={uploadToCloudinaryViaBackend}
                    uploading={uploading}
                    setUploading={setUploading}
                    savedRevision={savedRevision}
                  />}

                  {globalConfig.whatsapp.showBackground !== false && <Input
                    type="number"
                    min={20}
                    max={100}
                    step="1"
                    label="Tamaño del ícono interno (%)"
                    value={globalConfig.whatsapp.iconSizePercent ?? 80}
                    onChange={(e) =>
                      setPath("global.whatsapp.iconSizePercent", Number(e.target.value))
                    }
                  />}
                </PanelBlock>
              )}
            </div>
          </section>
        )}

        {activeMainTab === "scroll" && (
          <section className="appearance-general__section">
            <SectionHeader
              title="Navegación entre secciones"
              description="Controla visibilidad, posición, estilo, imágenes y animación de los botones flotantes."
            />

            <div className="mb-3 flex flex-wrap gap-2">
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

                  {globalConfig.scrollButtons.upUseCustomImage && <CloudinaryImageField
                    label="Botón subir"
                    value={globalConfig.scrollButtons.upImageUrl || ""}
                    onChange={(url) => setPath("global.scrollButtons.upImageUrl", url)}
                    onUpload={uploadToCloudinaryViaBackend}
                    uploading={uploading}
                    setUploading={setUploading}
                    savedRevision={savedRevision}
                  />}

                  {globalConfig.scrollButtons.upUseCustomImage && <Input
                    type="number"
                    min={20}
                    max={100}
                    step="1"
                    label="Tamaño imagen botón subir (%)"
                    value={globalConfig.scrollButtons.upImageSizePercent ?? 70}
                    onChange={(e) =>
                      setPath("global.scrollButtons.upImageSizePercent", Number(e.target.value))
                    }
                  />}
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

                  {globalConfig.scrollButtons.downUseCustomImage && <CloudinaryImageField
                    label="Botón bajar"
                    value={globalConfig.scrollButtons.downImageUrl || ""}
                    onChange={(url) => setPath("global.scrollButtons.downImageUrl", url)}
                    onUpload={uploadToCloudinaryViaBackend}
                    uploading={uploading}
                    setUploading={setUploading}
                    savedRevision={savedRevision}
                  />}

                  {globalConfig.scrollButtons.downUseCustomImage && <Input
                    type="number"
                    min={20}
                    max={100}
                    step="1"
                    label="Tamaño imagen botón bajar (%)"
                    value={globalConfig.scrollButtons.downImageSizePercent ?? 70}
                    onChange={(e) =>
                      setPath("global.scrollButtons.downImageSizePercent", Number(e.target.value))
                    }
                  />}
                </PanelBlock>
              )}
            </div>
          </section>
        )}

        {activeMainTab === "loader" && (
          <section className="appearance-general__section">
            <SectionHeader
              title="Loader global"
              description="Las figuras, los íconos y la imagen se muestran sobre la tienda sin fondo ni tarjeta."
            />

            <div className="mb-3 flex flex-wrap gap-2">
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
                label="Colores"
                onClick={() => setLoaderSubTab("visual")}
              />
              <SubTabButton
                active={loaderSubTab === "movimiento"}
                label="Movimiento"
                onClick={() => setLoaderSubTab("movimiento")}
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
                    label="Añadir mi imagen transparente"
                    checked={globalConfig.loader?.showLogo}
                    onChange={(value) => setPath("global.loader.showLogo", value)}
                  />

                  <Toggle
                    label="Mostrar texto de carga"
                    checked={globalConfig.loader?.showText}
                    onChange={(value) => setPath("global.loader.showText", value)}
                  />

                  {globalConfig.loader?.showText && <Input
                    label="Texto de carga"
                    value={globalConfig.loader?.text || ""}
                    onChange={(e) => setPath("global.loader.text", e.target.value)}
                    placeholder="Cargando colección..."
                  />}
                </PanelBlock>
              )}

              {loaderSubTab === "identidad" && (
                <PanelBlock title="Figura, ícono e imagen">
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

                  <div className="appearance-general__icon-field xl:col-span-2">
                    <span className="mb-2 block text-sm font-medium text-gray-700">Ícono visual</span>
                    <div className="appearance-general__icon-grid" role="group" aria-label="Ícono visual del Loader">
                      {LOADER_ICONS.map(({ value, label, Icon }) => (
                        <button type="button" key={value} className="appearance-general__icon-option"
                          aria-pressed={(globalConfig.loader?.icon || "none") === value}
                          onClick={() => setPath("global.loader.icon", value)}>
                          <span className="appearance-general__icon-orb" aria-hidden="true"><Icon size={22} strokeWidth={1.7} /></span>
                          <span>{label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {globalConfig.loader?.showLogo && <CloudinaryImageField
                    label="Imagen transparente del Loader"
                    value={globalConfig.loader?.logoUrl || ""}
                    onChange={(url) => setPath("global.loader.logoUrl", url)}
                    onUpload={uploadToCloudinaryViaBackend}
                    uploading={uploading}
                    setUploading={setUploading}
                    savedRevision={savedRevision}
                  />}

                  {globalConfig.loader?.showLogo && <p className="appearance-general__loader-hint xl:col-span-2">Usa un PNG o WebP transparente. Se verá junto a la figura elegida, sin cuadros ni fondo.</p>}

                  {globalConfig.loader?.showLogo && <Input
                    type="number"
                    min={20}
                    max={400}
                    step="1"
                    label="Tamaño de la imagen (px)"
                    value={globalConfig.loader?.logoSizePx ?? 72}
                    onChange={(e) => setPath("global.loader.logoSizePx", Number(e.target.value))}
                  />}
                </PanelBlock>
              )}

              {loaderSubTab === "visual" && (
                <PanelBlock title="Colores de la figura y del texto">
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
                      Color del texto
                    </span>
                    <ColorInput
                      value={globalConfig.loader?.textColor || "#111827"}
                      onChange={(e) => setPath("global.loader.textColor", e.target.value)}
                    />
                  </label>

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

            </div>
          </section>
        )}
          </div>
          <AppearanceToolPreview activeTool={activeMainTab} config={globalConfig} />
        </div>
      </div>
    </div>
  );
}
