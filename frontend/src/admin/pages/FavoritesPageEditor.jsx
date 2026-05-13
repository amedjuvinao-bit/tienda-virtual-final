// src/admin/pages/FavoritesPageEditor.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const EDITOR_TABS = [
  { id: "general", label: "General" },
  { id: "content", label: "Contenido" },
  { id: "style", label: "Estilo" },
];

const TITLE_MODE_OPTIONS = [
  { value: "image", label: "Título con imagen" },
  { value: "text", label: "Título en texto" },
];

const BUTTON_STYLE_OPTIONS = [
  { value: "solid", label: "Sólido" },
  { value: "outline", label: "Borde" },
  { value: "soft", label: "Suave" },
];

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function safeString(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function safeBoolean(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function buildSafeFavoritesPageConfig(input = {}) {
  const content = input?.content && typeof input.content === "object" ? input.content : {};
  const style = input?.style && typeof input.style === "object" ? input.style : {};

  return {
    content: {
      titleMode: TITLE_MODE_OPTIONS.some((item) => item.value === content.titleMode)
        ? content.titleMode
        : "image",
      titleText: safeString(content.titleText, "Tus Favoritos"),
      titleImage: safeString(content.titleImage, "/PaginaFavorito/TituloFavorito.png"),
      titleImageAlt: safeString(content.titleImageAlt, "Favoritos"),
      breadcrumbText: safeString(content.breadcrumbText, "Favoritos"),
      breadcrumbRootLabel: safeString(content.breadcrumbRootLabel, "Home"),
      emptyTitle: safeString(content.emptyTitle, "No hay productos en tu lista de favoritos."),
      emptyButtonText: safeString(content.emptyButtonText, "Ver lo nuevo"),
      emptyButtonLink: safeString(content.emptyButtonLink, "/lo-nuevo"),
      showHeader: safeBoolean(content.showHeader, true),
      showFooter: safeBoolean(content.showFooter, true),
      showWhatsapp: safeBoolean(content.showWhatsapp, true),
      showBreadcrumb: safeBoolean(content.showBreadcrumb, true),
      showTitle: safeBoolean(content.showTitle, true),
      showEmptyButton: safeBoolean(content.showEmptyButton, true),
      cardsPerRowDesktop: clampNumber(content.cardsPerRowDesktop, 1, 6, 4),
      cardsPerRowTablet: clampNumber(content.cardsPerRowTablet, 1, 4, 2),
      cardsPerRowMobile: clampNumber(content.cardsPerRowMobile, 1, 2, 1),
    },

    style: {
      pageBg: safeString(style.pageBg, "#FFF0F5"),
      textPrimaryColor: safeString(style.textPrimaryColor, "#111827"),
      textSecondaryColor: safeString(style.textSecondaryColor, "#6B7280"),
      accentColor: safeString(style.accentColor, "#EC4899"),
      titleTextColor: safeString(style.titleTextColor, "#111827"),
      badgeTextColor: safeString(style.badgeTextColor, "#D4AF37"),
      buttonBg: safeString(style.buttonBg, "#EC4899"),
      buttonTextColor: safeString(style.buttonTextColor, "#FFFFFF"),
      contentTopPaddingPx: clampNumber(style.contentTopPaddingPx, 0, 300, 112),
      contentMaxWidthPx: clampNumber(style.contentMaxWidthPx, 600, 1800, 1280),
      titleFontSizePx: clampNumber(style.titleFontSizePx, 18, 90, 32),
      titleImageHeightPx: clampNumber(style.titleImageHeightPx, 40, 300, 100),
      buttonRadiusPx: clampNumber(style.buttonRadiusPx, 0, 999, 999),
      gridGapPx: clampNumber(style.gridGapPx, 8, 80, 24),
      buttonStyle: BUTTON_STYLE_OPTIONS.some((item) => item.value === style.buttonStyle)
        ? style.buttonStyle
        : "solid",
    },
  };
}

function getButtonStyles(style) {
  if (style.buttonStyle === "outline") {
    return {
      background: "transparent",
      color: style.buttonBg,
      border: `1px solid ${style.buttonBg}`,
    };
  }

  if (style.buttonStyle === "soft") {
    return {
      background: `${style.buttonBg}22`,
      color: style.buttonBg,
      border: `1px solid ${style.buttonBg}33`,
    };
  }

  return {
    background: style.buttonBg,
    color: style.buttonTextColor,
    border: `1px solid ${style.buttonBg}`,
  };
}

const SectionCard = ({ title, children }) => (
  <section className="rounded-3xl border border-gray-200 bg-white p-4 md:p-5">
    <h3 className="mb-4 text-base font-semibold text-gray-900">{title}</h3>
    <div className="space-y-4">{children}</div>
  </section>
);

const Field = ({ label, children, hint = "" }) => (
  <label className="block">
    <div className="mb-1.5 text-sm font-medium text-gray-700">{label}</div>
    {children}
    {hint ? <div className="mt-1 text-xs text-gray-500">{hint}</div> : null}
  </label>
);

const TextInput = ({ value, onChange, placeholder = "", readOnly = false }) => (
  <input
    type="text"
    value={value}
    onChange={onChange}
    placeholder={placeholder}
    readOnly={readOnly}
    className="w-full rounded-2xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-pink-300 focus:ring-2 focus:ring-pink-200 read-only:bg-gray-50 read-only:text-gray-500"
  />
);

const NumberInput = ({ value, onChange, min, max, step = 1 }) => (
  <input
    type="number"
    value={value}
    min={min}
    max={max}
    step={step}
    onChange={onChange}
    className="w-full rounded-2xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-pink-300 focus:ring-2 focus:ring-pink-200"
  />
);

const SelectInput = ({ value, onChange, options }) => (
  <select
    value={value}
    onChange={onChange}
    className="w-full rounded-2xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-pink-300 focus:ring-2 focus:ring-pink-200"
  >
    {options.map((option) => (
      <option key={option.value} value={option.value}>
        {option.label}
      </option>
    ))}
  </select>
);

const Toggle = ({ label, checked, onChange }) => (
  <label className="flex items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white px-4 py-3">
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
  const safeColor =
    typeof value === "string" && value.trim() ? value : "#000000";

  return (
    <div className="grid grid-cols-[60px_minmax(0,1fr)] gap-3">
      <input
        type="color"
        value={safeColor.startsWith("#") ? safeColor : "#000000"}
        onChange={onChange}
        className="h-11 w-full rounded-xl border border-gray-300 bg-white p-1"
      />
      <input
        type="text"
        value={value}
        onChange={onChange}
        className="w-full rounded-2xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-pink-300 focus:ring-2 focus:ring-pink-200"
      />
    </div>
  );
};

export default function FavoritesPageEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const fileInputRefs = useRef({});
  const [page, setPage] = useState(null);
  const [form, setForm] = useState({
    name: "Favoritos",
    slug: "favoritos",
    enabled: true,
    useHeader: true,
    useFooter: true,
    pageType: "favorites-page",
    favoritesPageConfig: buildSafeFavoritesPageConfig(),
  });
  const [activeTab, setActiveTab] = useState("general");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const config = useMemo(
    () => buildSafeFavoritesPageConfig(form?.favoritesPageConfig),
    [form?.favoritesPageConfig]
  );

  useEffect(() => {
    async function loadPage() {
      try {
        setLoading(true);

        const res = await fetch(`${API_BASE}/api/pages/${id}`);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();

        setPage(data);
        setForm({
          name: safeString(data?.name, "Favoritos"),
          slug: safeString(data?.slug, "favoritos"),
          enabled: safeBoolean(data?.enabled, true),
          useHeader: safeBoolean(data?.useHeader, true),
          useFooter: safeBoolean(data?.useFooter, true),
          pageType: "favorites-page",
          favoritesPageConfig: buildSafeFavoritesPageConfig(data?.favoritesPageConfig),
        });
      } catch (error) {
        console.error("Error cargando página favoritos:", error);
        alert("No se pudo cargar la página de favoritos.");
      } finally {
        setLoading(false);
      }
    }

    if (id) {
      loadPage();
    }
  }, [id]);

  const setConfig = (updater) => {
    setForm((prev) => ({
      ...prev,
      favoritesPageConfig:
        typeof updater === "function"
          ? updater(buildSafeFavoritesPageConfig(prev.favoritesPageConfig))
          : updater,
    }));
  };

  const setContent = (key, value) => {
    setConfig((prev) => ({
      ...prev,
      content: {
        ...prev.content,
        [key]: value,
      },
    }));
  };

  const setStyle = (key, value) => {
    setConfig((prev) => ({
      ...prev,
      style: {
        ...prev.style,
        [key]: value,
      },
    }));
  };

  const uploadImageToCloudinary = async (file) => {
    const data = new FormData();
    data.append("file", file);

    const res = await fetch(`${API_BASE}/api/uploads`, {
      method: "POST",
      body: data,
    });

    const contentType = res.headers.get("content-type") || "";
    const isJson = contentType.includes("application/json");
    const json = isJson ? await res.json().catch(() => ({})) : null;

    if (!res.ok) {
      throw new Error(
        json?.error ||
          json?.message ||
          `No se pudo subir la imagen (HTTP ${res.status})`
      );
    }

    const url = json?.url || "";
    if (!url) {
      throw new Error("La subida no devolvió una URL válida");
    }

    return url;
  };

  const handleImageUpload = async () => {
    const input = fileInputRefs.current.titleImage;
    const file = input?.files?.[0];
    if (!file) return;

    try {
      const url = await uploadImageToCloudinary(file);
      setContent("titleImage", url);
      input.value = "";
    } catch (error) {
      console.error("Error subiendo imagen:", error);
      alert(error.message || "No se pudo subir la imagen.");
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const payload = {
        name: "Favoritos",
        slug: "favoritos",
        enabled: form.enabled,
        useHeader: form.useHeader,
        useFooter: form.useFooter,
        pageType: "favorites-page",
        favoritesPageConfig: buildSafeFavoritesPageConfig(form.favoritesPageConfig),
      };

      const res = await fetch(`${API_BASE}/api/pages/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.message || `HTTP ${res.status}`);
      }

      setPage(data);
      setForm((prev) => ({
        ...prev,
        favoritesPageConfig: buildSafeFavoritesPageConfig(
          data?.favoritesPageConfig || prev.favoritesPageConfig
        ),
      }));

      alert("Página Favoritos guardada correctamente ✅");
    } catch (error) {
      console.error("Error guardando página favoritos:", error);
      alert(error.message || "No se pudo guardar la página Favoritos.");
    } finally {
      setSaving(false);
    }
  };

  const previewButtonStyles = getButtonStyles(config.style);

  if (loading) {
    return (
      <div className="rounded-3xl border border-gray-200 bg-white p-6 text-sm text-gray-500">
        Cargando editor de Favoritos...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-gray-200 bg-white p-4 md:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Editor de página fija: Favoritos
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Esta página es fija del sistema. Se puede editar, pero no crear ni eliminar.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate("/admin/paginas")}
              className="rounded-2xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Volver
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-2xl bg-pink-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-pink-700 disabled:opacity-60"
            >
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {EDITOR_TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${
                active
                  ? "bg-pink-600 text-white"
                  : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "general" ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <SectionCard title="Configuración general">
            <Field label="Nombre" hint="Esta página es fija del sistema.">
              <TextInput value="Favoritos" onChange={() => {}} readOnly />
            </Field>

            <Field label="Slug / ruta" hint="Ruta fija del sistema: /favoritos">
              <TextInput value="favoritos" onChange={() => {}} readOnly />
            </Field>

            <Toggle
              label="Página activa"
              checked={form.enabled}
              onChange={(value) => setForm((prev) => ({ ...prev, enabled: value }))}
            />

            <Toggle
              label="Usar header"
              checked={form.useHeader}
              onChange={(value) => setForm((prev) => ({ ...prev, useHeader: value }))}
            />

            <Toggle
              label="Usar footer"
              checked={form.useFooter}
              onChange={(value) => setForm((prev) => ({ ...prev, useFooter: value }))}
            />

            <Toggle
              label="Mostrar botón de WhatsApp"
              checked={config.content.showWhatsapp}
              onChange={(value) => setContent("showWhatsapp", value)}
            />

            <Toggle
              label="Mostrar breadcrumb"
              checked={config.content.showBreadcrumb}
              onChange={(value) => setContent("showBreadcrumb", value)}
            />

            <Toggle
              label="Mostrar título"
              checked={config.content.showTitle}
              onChange={(value) => setContent("showTitle", value)}
            />

            <Field label="Modo del título">
              <SelectInput
                value={config.content.titleMode}
                onChange={(e) => setContent("titleMode", e.target.value)}
                options={TITLE_MODE_OPTIONS}
              />
            </Field>
          </SectionCard>

          <SectionCard title="Vista previa rápida">
            <div
              className="overflow-hidden rounded-[28px] border"
              style={{
                background: config.style.pageBg,
                borderColor: "#f3d1dc",
              }}
            >
              <div
                style={{
                  paddingTop: `${config.style.contentTopPaddingPx}px`,
                  paddingLeft: "20px",
                  paddingRight: "20px",
                  paddingBottom: "20px",
                }}
              >
                {config.content.showBreadcrumb ? (
                  <div className="mb-4 text-sm" style={{ color: config.style.accentColor }}>
                    {config.content.breadcrumbRootLabel} › {config.content.breadcrumbText}
                  </div>
                ) : null}

                {config.content.showTitle ? (
                  <div className="mb-6 flex justify-center">
                    {config.content.titleMode === "image" ? (
                      <img
                        src={config.content.titleImage}
                        alt={config.content.titleImageAlt}
                        style={{ height: `${config.style.titleImageHeightPx}px` }}
                        className="max-w-full object-contain"
                      />
                    ) : (
                      <h2
                        style={{
                          fontSize: `${config.style.titleFontSizePx}px`,
                          color: config.style.titleTextColor,
                        }}
                        className="text-center font-semibold"
                      >
                        {config.content.titleText}
                      </h2>
                    )}
                  </div>
                ) : null}

                <div
                  className="rounded-3xl border bg-white p-5"
                  style={{ borderColor: "#f3d1dc" }}
                >
                  <div className="space-y-2 text-sm">
                    <div style={{ color: config.style.textPrimaryColor }}>
                      ♥ Producto favorito 1
                    </div>
                    <div style={{ color: config.style.textPrimaryColor }}>
                      ♥ Producto favorito 2
                    </div>
                    <div style={{ color: config.style.textSecondaryColor }}>
                      Vista previa del listado
                    </div>
                  </div>

                  <div className="mt-5">
                    <button
                      type="button"
                      className="px-5 py-2.5 text-sm font-medium"
                      style={{
                        ...previewButtonStyles,
                        borderRadius: `${config.style.buttonRadiusPx}px`,
                      }}
                    >
                      {config.content.emptyButtonText}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>
        </div>
      ) : null}

      {activeTab === "content" ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <SectionCard title="Textos y contenido">
            <Field label="Texto del breadcrumb">
              <TextInput
                value={config.content.breadcrumbText}
                onChange={(e) => setContent("breadcrumbText", e.target.value)}
              />
            </Field>

            <Field label="Texto del enlace inicial del breadcrumb">
              <TextInput
                value={config.content.breadcrumbRootLabel}
                onChange={(e) => setContent("breadcrumbRootLabel", e.target.value)}
              />
            </Field>

            <Field label="Título en texto">
              <TextInput
                value={config.content.titleText}
                onChange={(e) => setContent("titleText", e.target.value)}
              />
            </Field>

            <Field label="Texto alternativo del título imagen">
              <TextInput
                value={config.content.titleImageAlt}
                onChange={(e) => setContent("titleImageAlt", e.target.value)}
              />
            </Field>

            <Field label="Mensaje cuando no hay favoritos">
              <TextInput
                value={config.content.emptyTitle}
                onChange={(e) => setContent("emptyTitle", e.target.value)}
              />
            </Field>

            <Field label="Texto del botón vacío">
              <TextInput
                value={config.content.emptyButtonText}
                onChange={(e) => setContent("emptyButtonText", e.target.value)}
              />
            </Field>

            <Field label="Link del botón vacío">
              <TextInput
                value={config.content.emptyButtonLink}
                onChange={(e) => setContent("emptyButtonLink", e.target.value)}
              />
            </Field>

            <Toggle
              label="Mostrar botón en estado vacío"
              checked={config.content.showEmptyButton}
              onChange={(value) => setContent("showEmptyButton", value)}
            />
          </SectionCard>

          <SectionCard title="Título y rejilla de productos">
            <Field label="Imagen del título">
              <TextInput
                value={config.content.titleImage}
                onChange={(e) => setContent("titleImage", e.target.value)}
                placeholder="/PaginaFavorito/TituloFavorito.png"
              />
              <div className="mt-2 flex gap-2">
                <input
                  ref={(el) => {
                    fileInputRefs.current.titleImage = el;
                  }}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                />
                <button
                  type="button"
                  onClick={() => fileInputRefs.current.titleImage?.click()}
                  className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Subir imagen
                </button>
              </div>
            </Field>

            <Field label="Columnas escritorio">
              <NumberInput
                value={config.content.cardsPerRowDesktop}
                min={1}
                max={6}
                onChange={(e) =>
                  setContent("cardsPerRowDesktop", clampNumber(e.target.value, 1, 6, 4))
                }
              />
            </Field>

            <Field label="Columnas tablet">
              <NumberInput
                value={config.content.cardsPerRowTablet}
                min={1}
                max={4}
                onChange={(e) =>
                  setContent("cardsPerRowTablet", clampNumber(e.target.value, 1, 4, 2))
                }
              />
            </Field>

            <Field label="Columnas móvil">
              <NumberInput
                value={config.content.cardsPerRowMobile}
                min={1}
                max={2}
                onChange={(e) =>
                  setContent("cardsPerRowMobile", clampNumber(e.target.value, 1, 2, 1))
                }
              />
            </Field>
          </SectionCard>
        </div>
      ) : null}

      {activeTab === "style" ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <SectionCard title="Colores">
            <Field label="Fondo de página">
              <ColorInput
                value={config.style.pageBg}
                onChange={(e) => setStyle("pageBg", e.target.value)}
              />
            </Field>

            <Field label="Texto principal">
              <ColorInput
                value={config.style.textPrimaryColor}
                onChange={(e) => setStyle("textPrimaryColor", e.target.value)}
              />
            </Field>

            <Field label="Texto secundario">
              <ColorInput
                value={config.style.textSecondaryColor}
                onChange={(e) => setStyle("textSecondaryColor", e.target.value)}
              />
            </Field>

            <Field label="Color acento">
              <ColorInput
                value={config.style.accentColor}
                onChange={(e) => setStyle("accentColor", e.target.value)}
              />
            </Field>

            <Field label="Color del título">
              <ColorInput
                value={config.style.titleTextColor}
                onChange={(e) => setStyle("titleTextColor", e.target.value)}
              />
            </Field>

            <Field label="Color del texto breadcrumb actual">
              <ColorInput
                value={config.style.badgeTextColor}
                onChange={(e) => setStyle("badgeTextColor", e.target.value)}
              />
            </Field>

            <Field label="Fondo botón">
              <ColorInput
                value={config.style.buttonBg}
                onChange={(e) => setStyle("buttonBg", e.target.value)}
              />
            </Field>

            <Field label="Texto botón">
              <ColorInput
                value={config.style.buttonTextColor}
                onChange={(e) => setStyle("buttonTextColor", e.target.value)}
              />
            </Field>
          </SectionCard>

          <SectionCard title="Medidas y apariencia">
            <Field label="Espacio debajo del header (px)">
              <NumberInput
                value={config.style.contentTopPaddingPx}
                min={0}
                max={300}
                onChange={(e) =>
                  setStyle("contentTopPaddingPx", clampNumber(e.target.value, 0, 300, 112))
                }
              />
            </Field>

            <Field label="Ancho máximo del contenido (px)">
              <NumberInput
                value={config.style.contentMaxWidthPx}
                min={600}
                max={1800}
                onChange={(e) =>
                  setStyle("contentMaxWidthPx", clampNumber(e.target.value, 600, 1800, 1280))
                }
              />
            </Field>

            <Field label="Tamaño del título (px)">
              <NumberInput
                value={config.style.titleFontSizePx}
                min={18}
                max={90}
                onChange={(e) =>
                  setStyle("titleFontSizePx", clampNumber(e.target.value, 18, 90, 32))
                }
              />
            </Field>

            <Field label="Alto imagen del título (px)">
              <NumberInput
                value={config.style.titleImageHeightPx}
                min={40}
                max={300}
                onChange={(e) =>
                  setStyle("titleImageHeightPx", clampNumber(e.target.value, 40, 300, 100))
                }
              />
            </Field>

            <Field label="Radio botón">
              <NumberInput
                value={config.style.buttonRadiusPx}
                min={0}
                max={999}
                onChange={(e) =>
                  setStyle("buttonRadiusPx", clampNumber(e.target.value, 0, 999, 999))
                }
              />
            </Field>

            <Field label="Separación rejilla productos (px)">
              <NumberInput
                value={config.style.gridGapPx}
                min={8}
                max={80}
                onChange={(e) =>
                  setStyle("gridGapPx", clampNumber(e.target.value, 8, 80, 24))
                }
              />
            </Field>

            <Field label="Estilo del botón">
              <SelectInput
                value={config.style.buttonStyle}
                onChange={(e) => setStyle("buttonStyle", e.target.value)}
                options={BUTTON_STYLE_OPTIONS}
              />
            </Field>
          </SectionCard>
        </div>
      ) : null}
    </div>
  );
}