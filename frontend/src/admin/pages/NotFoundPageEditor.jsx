// src/admin/pages/NotFoundPageEditor.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { API_BASE_URL } from "../../config/apiBaseUrl";

const API_BASE = API_BASE_URL;

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
  { value: "outline", label: "Contorno" },
  { value: "ghost", label: "Fantasma" },
];

const DEFAULT_CONFIG = {
  showHeader: true,
  showFooter: true,
  showWhatsapp: true,
  showBreadcrumb: true,
  showTitle: true,
  showMessage: true,
  showButton: true,
  showImage: true,

  titleMode: "text",
  titleText: "Página no encontrada",
  titleImage: "",
  titleImageAlt: "Página no encontrada",

  breadcrumbRootLabel: "Hogar",
  breadcrumbText: "Página no encontrada",

  messageText:
    "Lo sentimos, la página que intentas abrir no existe o fue movida. Puedes volver al inicio y seguir navegando por la tienda.",
  buttonText: "Volver al inicio",
  buttonLink: "/",

  imageUrl: "",
  imageAlt: "Ilustración página no encontrada",

  pageBg: "#ffffff",
  cardBg: "#fffafc",
  textPrimaryColor: "#111827",
  textSecondaryColor: "#6b7280",
  accentColor: "#ec4899",
  buttonBg: "#ec4899",
  buttonTextColor: "#ffffff",
  buttonBorderColor: "#ec4899",
  titleTextColor: "#111827",
  breadcrumbColor: "#6b7280",

  contentTopPaddingPx: 60,
  contentBottomPaddingPx: 80,
  contentMaxWidthPx: 1200,
  cardRadiusPx: 28,
  cardBorderWidthPx: 1,
  titleFontSizePx: 42,
  messageFontSizePx: 17,
  buttonFontSizePx: 15,
  buttonRadiusPx: 999,
  imageMaxWidthPx: 340,
  imageRadiusPx: 22,
  gapPx: 40,
  buttonStyle: "solid",
};

function mergeConfig(serverConfig) {
  return {
    ...DEFAULT_CONFIG,
    ...(serverConfig && typeof serverConfig === "object" ? serverConfig : {}),
  };
}

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function buildButtonClass(style) {
  if (style === "outline") {
    return "border bg-transparent";
  }
  if (style === "ghost") {
    return "border-0 bg-transparent shadow-none";
  }
  return "border";
}

function normalizeHexColor(value, fallback = "#000000") {
  const safe = String(value || "").trim();
  if (/^#([0-9a-fA-F]{6})$/.test(safe)) return safe;
  return fallback;
}

function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-gray-700">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-gray-500">{hint}</span> : null}
    </label>
  );
}

function TextInput(props) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-pink-300 focus:ring-2 focus:ring-pink-200 ${
        props.className || ""
      }`}
    />
  );
}

function TextArea(props) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-pink-300 focus:ring-2 focus:ring-pink-200 ${
        props.className || ""
      }`}
    />
  );
}

function Select(props) {
  return (
    <select
      {...props}
      className={`w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-pink-300 focus:ring-2 focus:ring-pink-200 ${
        props.className || ""
      }`}
    />
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3">
      <span className="text-sm text-gray-700">{label}</span>
      <input
        type="checkbox"
        checked={!!checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 shrink-0 accent-pink-600"
      />
    </label>
  );
}

function NumberInput({ value, onChange, min, max, step = 1 }) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-pink-300 focus:ring-2 focus:ring-pink-200"
    />
  );
}

function ColorControl({ label, value, onChange }) {
  const pickerRef = useRef(null);
  const safeColor = normalizeHexColor(value, "#000000");

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-3">
      <div className="mb-2 text-sm font-medium text-gray-700">{label}</div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => pickerRef.current?.click()}
          className="h-11 w-11 shrink-0 rounded-xl border border-gray-300 shadow-sm transition hover:scale-[1.03]"
          style={{ backgroundColor: safeColor }}
          title={`Seleccionar color ${safeColor}`}
        />

        <div className="min-w-0 flex-1">
          <input
            type="text"
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder="#000000"
            className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm uppercase text-gray-800 outline-none transition focus:border-pink-300 focus:ring-2 focus:ring-pink-200"
          />
        </div>

        <button
          type="button"
          onClick={() => pickerRef.current?.click()}
          className="rounded-xl border border-pink-300 bg-pink-50 px-3 py-2 text-xs font-medium text-pink-700 transition hover:bg-pink-100"
        >
          Elegir
        </button>

        <input
          ref={pickerRef}
          type="color"
          value={safeColor}
          onChange={(e) => onChange(e.target.value)}
          className="sr-only"
        />
      </div>
    </div>
  );
}

export default function NotFoundPageEditor() {
  const navigate = useNavigate();
  const { id } = useParams();

  const titleImageInputRef = useRef(null);
  const illustrationInputRef = useRef(null);

  const [activeTab, setActiveTab] = useState("general");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingTitleImage, setUploadingTitleImage] = useState(false);
  const [uploadingIllustration, setUploadingIllustration] = useState(false);

  const [pageId, setPageId] = useState("");
  const [form, setForm] = useState({
    name: "Not Found",
    slug: "not-found",
    enabled: true,
    useHeader: true,
    useFooter: true,
    pageType: "notfound-page",
    notFoundPageConfig: mergeConfig(),
  });

  const config = useMemo(
    () => mergeConfig(form?.notFoundPageConfig),
    [form?.notFoundPageConfig]
  );

  useEffect(() => {
    const loadPage = async () => {
      try {
        setLoading(true);

        const target = String(id || "").trim() || "not-found";
        const res = await fetch(`${API_BASE}/api/pages/${target}`);

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data?.message || `HTTP ${res.status}`);
        }

        const incomingConfig = mergeConfig(data?.notFoundPageConfig);

        setPageId(String(data?._id || ""));
        setForm({
          name: data?.name || "Not Found",
          slug: data?.slug || "not-found",
          enabled: data?.enabled !== false,
          useHeader: data?.useHeader !== false,
          useFooter: data?.useFooter !== false,
          pageType: data?.pageType || "notfound-page",
          notFoundPageConfig: incomingConfig,
        });
      } catch (error) {
        console.error("Error cargando la página Not Found:", error);
        alert(error.message || "No se pudo cargar la página Not Found.");
      } finally {
        setLoading(false);
      }
    };

    loadPage();
  }, [id]);

  const updateRootForm = (patch) => {
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const setConfigValue = (key, value) => {
    setForm((prev) => ({
      ...prev,
      notFoundPageConfig: {
        ...mergeConfig(prev?.notFoundPageConfig),
        [key]: value,
      },
    }));
  };

  const uploadImage = async (file) => {
    const body = new FormData();
    body.append("file", file);

    const response = await fetch(`${API_BASE}/api/uploads`, {
      method: "POST",
      body,
    });

    const text = await response.text();
    let data = {};

    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new Error("La respuesta del servidor no fue JSON válido.");
    }

    if (!response.ok) {
      throw new Error(data?.message || `HTTP ${response.status}`);
    }

    if (!data?.url) {
      throw new Error("El servidor no devolvió la URL de la imagen.");
    }

    return data.url;
  };

  const handleUploadTitleImage = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      setUploadingTitleImage(true);
      const url = await uploadImage(file);
      setConfigValue("titleImage", url);
    } catch (error) {
      console.error("Error subiendo imagen de título:", error);
      alert(error.message || "No se pudo subir la imagen de título.");
    } finally {
      setUploadingTitleImage(false);
    }
  };

  const handleUploadIllustration = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      setUploadingIllustration(true);
      const url = await uploadImage(file);
      setConfigValue("imageUrl", url);
    } catch (error) {
      console.error("Error subiendo ilustración:", error);
      alert(error.message || "No se pudo subir la ilustración.");
    } finally {
      setUploadingIllustration(false);
    }
  };

  const handleSave = async () => {
    try {
      if (!pageId) {
        alert("No se encontró el ID de la página Not Found.");
        return;
      }

      setSaving(true);

      const normalizedConfig = {
        ...mergeConfig(form?.notFoundPageConfig),
        contentTopPaddingPx: clampNumber(config.contentTopPaddingPx, 0, 300, DEFAULT_CONFIG.contentTopPaddingPx),
        contentBottomPaddingPx: clampNumber(
          config.contentBottomPaddingPx,
          0,
          300,
          DEFAULT_CONFIG.contentBottomPaddingPx
        ),
        contentMaxWidthPx: clampNumber(config.contentMaxWidthPx, 320, 1800, DEFAULT_CONFIG.contentMaxWidthPx),
        cardRadiusPx: clampNumber(config.cardRadiusPx, 0, 80, DEFAULT_CONFIG.cardRadiusPx),
        cardBorderWidthPx: clampNumber(
          config.cardBorderWidthPx,
          0,
          12,
          DEFAULT_CONFIG.cardBorderWidthPx
        ),
        titleFontSizePx: clampNumber(config.titleFontSizePx, 18, 90, DEFAULT_CONFIG.titleFontSizePx),
        messageFontSizePx: clampNumber(
          config.messageFontSizePx,
          12,
          40,
          DEFAULT_CONFIG.messageFontSizePx
        ),
        buttonFontSizePx: clampNumber(
          config.buttonFontSizePx,
          10,
          28,
          DEFAULT_CONFIG.buttonFontSizePx
        ),
        buttonRadiusPx: clampNumber(config.buttonRadiusPx, 0, 999, DEFAULT_CONFIG.buttonRadiusPx),
        imageMaxWidthPx: clampNumber(config.imageMaxWidthPx, 120, 800, DEFAULT_CONFIG.imageMaxWidthPx),
        imageRadiusPx: clampNumber(config.imageRadiusPx, 0, 80, DEFAULT_CONFIG.imageRadiusPx),
        gapPx: clampNumber(config.gapPx, 0, 120, DEFAULT_CONFIG.gapPx),
      };

      const payload = {
        name: "Not Found",
        slug: "not-found",
        enabled: form.enabled !== false,
        useHeader: form.useHeader !== false,
        useFooter: form.useFooter !== false,
        pageType: "notfound-page",
        notFoundPageConfig: normalizedConfig,
      };

      const res = await fetch(`${API_BASE}/api/pages/${pageId}`, {
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

      alert("Página Not Found guardada correctamente ✅");
    } catch (error) {
      console.error("Error guardando Not Found:", error);
      alert(error.message || "No se pudo guardar la página Not Found.");
    } finally {
      setSaving(false);
    }
  };

  const previewButtonStyle = {
    backgroundColor:
      config.buttonStyle === "outline" || config.buttonStyle === "ghost"
        ? "transparent"
        : config.buttonBg,
    color:
      config.buttonStyle === "ghost"
        ? config.accentColor
        : config.buttonStyle === "outline"
        ? config.buttonBg
        : config.buttonTextColor,
    borderColor: config.buttonStyle === "ghost" ? "transparent" : config.buttonBorderColor,
    borderWidth: config.buttonStyle === "ghost" ? 0 : 1,
    borderStyle: "solid",
    borderRadius: `${config.buttonRadiusPx}px`,
    fontSize: `${config.buttonFontSizePx}px`,
  };

  if (loading) {
    return (
      <div className="rounded-3xl border border-gray-200 bg-white p-6 text-sm text-gray-500">
        Cargando editor de página Not Found...
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-6">
      <div className="rounded-3xl border border-gray-200 bg-white p-4 md:p-5">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Editor página Not Found</h1>
            <p className="mt-1 text-sm text-gray-500">
              Configura la página fija del sistema para rutas no encontradas.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate("/admin/paginas")}
              className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Volver
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-xl bg-pink-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-pink-700 disabled:opacity-60"
            >
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          {EDITOR_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                activeTab === tab.id
                  ? "bg-pink-600 text-white"
                  : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <section className="space-y-6">
            {activeTab === "general" ? (
              <>
                <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4">
                  <h2 className="mb-4 text-lg font-semibold text-gray-900">Configuración base</h2>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Nombre de la página">
                      <TextInput value={form.name} readOnly />
                    </Field>

                    <Field label="Slug fijo">
                      <TextInput value={form.slug} readOnly />
                    </Field>
                  </div>
                </div>

                <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4">
                  <h2 className="mb-4 text-lg font-semibold text-gray-900">Visibilidad del sistema</h2>

                  <div className="grid gap-3 md:grid-cols-2">
                    <Toggle
                      label="Página activa"
                      checked={form.enabled}
                      onChange={(value) => updateRootForm({ enabled: value })}
                    />
                    <Toggle
                      label="Usar header"
                      checked={form.useHeader}
                      onChange={(value) => {
                        updateRootForm({ useHeader: value });
                        setConfigValue("showHeader", value);
                      }}
                    />
                    <Toggle
                      label="Usar footer"
                      checked={form.useFooter}
                      onChange={(value) => {
                        updateRootForm({ useFooter: value });
                        setConfigValue("showFooter", value);
                      }}
                    />
                    <Toggle
                      label="Mostrar botón de WhatsApp"
                      checked={config.showWhatsapp}
                      onChange={(value) => setConfigValue("showWhatsapp", value)}
                    />
                    <Toggle
                      label="Mostrar breadcrumb"
                      checked={config.showBreadcrumb}
                      onChange={(value) => setConfigValue("showBreadcrumb", value)}
                    />
                    <Toggle
                      label="Mostrar título"
                      checked={config.showTitle}
                      onChange={(value) => setConfigValue("showTitle", value)}
                    />
                    <Toggle
                      label="Mostrar mensaje"
                      checked={config.showMessage}
                      onChange={(value) => setConfigValue("showMessage", value)}
                    />
                    <Toggle
                      label="Mostrar botón"
                      checked={config.showButton}
                      onChange={(value) => setConfigValue("showButton", value)}
                    />
                    <Toggle
                      label="Mostrar imagen"
                      checked={config.showImage}
                      onChange={(value) => setConfigValue("showImage", value)}
                    />
                  </div>
                </div>
              </>
            ) : null}

            {activeTab === "content" ? (
              <>
                <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4">
                  <h2 className="mb-4 text-lg font-semibold text-gray-900">Título</h2>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Modo del título">
                      <Select
                        value={config.titleMode}
                        onChange={(e) => setConfigValue("titleMode", e.target.value)}
                      >
                        {TITLE_MODE_OPTIONS.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </Select>
                    </Field>

                    <Field label="Texto alternativo del título">
                      <TextInput
                        value={config.titleImageAlt}
                        onChange={(e) => setConfigValue("titleImageAlt", e.target.value)}
                        placeholder="Texto alternativo del título"
                      />
                    </Field>
                  </div>

                  {config.titleMode === "text" ? (
                    <div className="mt-4">
                      <Field label="Texto del título">
                        <TextInput
                          value={config.titleText}
                          onChange={(e) => setConfigValue("titleText", e.target.value)}
                          placeholder="Página no encontrada"
                        />
                      </Field>
                    </div>
                  ) : (
                    <div className="mt-4 grid gap-4">
                      <Field label="URL imagen del título">
                        <TextInput
                          value={config.titleImage}
                          onChange={(e) => setConfigValue("titleImage", e.target.value)}
                          placeholder="https://..."
                        />
                      </Field>

                      <div className="flex flex-wrap gap-3">
                        <input
                          ref={titleImageInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleUploadTitleImage}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => titleImageInputRef.current?.click()}
                          disabled={uploadingTitleImage}
                          className="rounded-xl border border-pink-300 bg-white px-4 py-2 text-sm font-medium text-pink-700 transition hover:bg-pink-50 disabled:opacity-60"
                        >
                          {uploadingTitleImage ? "Subiendo..." : "Subir imagen"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4">
                  <h2 className="mb-4 text-lg font-semibold text-gray-900">Breadcrumb y textos</h2>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Texto raíz breadcrumb">
                      <TextInput
                        value={config.breadcrumbRootLabel}
                        onChange={(e) => setConfigValue("breadcrumbRootLabel", e.target.value)}
                        placeholder="Hogar"
                      />
                    </Field>

                    <Field label="Texto breadcrumb actual">
                      <TextInput
                        value={config.breadcrumbText}
                        onChange={(e) => setConfigValue("breadcrumbText", e.target.value)}
                        placeholder="Página no encontrada"
                      />
                    </Field>
                  </div>

                  <div className="mt-4">
                    <Field label="Mensaje principal">
                      <TextArea
                        rows={4}
                        value={config.messageText}
                        onChange={(e) => setConfigValue("messageText", e.target.value)}
                        placeholder="Mensaje principal de la página 404"
                      />
                    </Field>
                  </div>
                </div>

                <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4">
                  <h2 className="mb-4 text-lg font-semibold text-gray-900">Botón de acción</h2>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Texto del botón">
                      <TextInput
                        value={config.buttonText}
                        onChange={(e) => setConfigValue("buttonText", e.target.value)}
                        placeholder="Volver al inicio"
                      />
                    </Field>

                    <Field label="Ruta del botón">
                      <TextInput
                        value={config.buttonLink}
                        onChange={(e) => setConfigValue("buttonLink", e.target.value)}
                        placeholder="/"
                      />
                    </Field>
                  </div>
                </div>

                <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4">
                  <h2 className="mb-4 text-lg font-semibold text-gray-900">Imagen decorativa</h2>

                  <div className="grid gap-4">
                    <Field label="URL de imagen">
                      <TextInput
                        value={config.imageUrl}
                        onChange={(e) => setConfigValue("imageUrl", e.target.value)}
                        placeholder="https://..."
                      />
                    </Field>

                    <Field label="Texto alternativo de imagen">
                      <TextInput
                        value={config.imageAlt}
                        onChange={(e) => setConfigValue("imageAlt", e.target.value)}
                        placeholder="Ilustración página no encontrada"
                      />
                    </Field>

                    <div className="flex flex-wrap gap-3">
                      <input
                        ref={illustrationInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleUploadIllustration}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => illustrationInputRef.current?.click()}
                        disabled={uploadingIllustration}
                        className="rounded-xl border border-pink-300 bg-white px-4 py-2 text-sm font-medium text-pink-700 transition hover:bg-pink-50 disabled:opacity-60"
                      >
                        {uploadingIllustration ? "Subiendo..." : "Subir imagen"}
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : null}

            {activeTab === "style" ? (
              <>
                <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4">
                  <h2 className="mb-4 text-lg font-semibold text-gray-900">Colores</h2>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-2">
                    <ColorControl
                      label="Fondo página"
                      value={config.pageBg}
                      onChange={(value) => setConfigValue("pageBg", value)}
                    />

                    <ColorControl
                      label="Fondo tarjeta"
                      value={config.cardBg}
                      onChange={(value) => setConfigValue("cardBg", value)}
                    />

                    <ColorControl
                      label="Color principal texto"
                      value={config.textPrimaryColor}
                      onChange={(value) => setConfigValue("textPrimaryColor", value)}
                    />

                    <ColorControl
                      label="Color secundario texto"
                      value={config.textSecondaryColor}
                      onChange={(value) => setConfigValue("textSecondaryColor", value)}
                    />

                    <ColorControl
                      label="Color de acento"
                      value={config.accentColor}
                      onChange={(value) => setConfigValue("accentColor", value)}
                    />

                    <ColorControl
                      label="Color título texto"
                      value={config.titleTextColor}
                      onChange={(value) => setConfigValue("titleTextColor", value)}
                    />

                    <ColorControl
                      label="Color breadcrumb"
                      value={config.breadcrumbColor}
                      onChange={(value) => setConfigValue("breadcrumbColor", value)}
                    />

                    <ColorControl
                      label="Color fondo botón"
                      value={config.buttonBg}
                      onChange={(value) => setConfigValue("buttonBg", value)}
                    />

                    <ColorControl
                      label="Color texto botón"
                      value={config.buttonTextColor}
                      onChange={(value) => setConfigValue("buttonTextColor", value)}
                    />

                    <ColorControl
                      label="Color borde botón"
                      value={config.buttonBorderColor}
                      onChange={(value) => setConfigValue("buttonBorderColor", value)}
                    />
                  </div>
                </div>

                <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4">
                  <h2 className="mb-4 text-lg font-semibold text-gray-900">Tamaños y espacios</h2>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <Field label="Padding superior (px)">
                      <NumberInput
                        min={0}
                        max={300}
                        value={config.contentTopPaddingPx}
                        onChange={(value) => setConfigValue("contentTopPaddingPx", value)}
                      />
                    </Field>

                    <Field label="Padding inferior (px)">
                      <NumberInput
                        min={0}
                        max={300}
                        value={config.contentBottomPaddingPx}
                        onChange={(value) => setConfigValue("contentBottomPaddingPx", value)}
                      />
                    </Field>

                    <Field label="Ancho máximo contenido (px)">
                      <NumberInput
                        min={320}
                        max={1800}
                        value={config.contentMaxWidthPx}
                        onChange={(value) => setConfigValue("contentMaxWidthPx", value)}
                      />
                    </Field>

                    <Field label="Gap entre columnas (px)">
                      <NumberInput
                        min={0}
                        max={120}
                        value={config.gapPx}
                        onChange={(value) => setConfigValue("gapPx", value)}
                      />
                    </Field>

                    <Field label="Radio tarjeta (px)">
                      <NumberInput
                        min={0}
                        max={80}
                        value={config.cardRadiusPx}
                        onChange={(value) => setConfigValue("cardRadiusPx", value)}
                      />
                    </Field>

                    <Field label="Borde tarjeta (px)">
                      <NumberInput
                        min={0}
                        max={12}
                        value={config.cardBorderWidthPx}
                        onChange={(value) => setConfigValue("cardBorderWidthPx", value)}
                      />
                    </Field>

                    <Field label="Tamaño título (px)">
                      <NumberInput
                        min={18}
                        max={90}
                        value={config.titleFontSizePx}
                        onChange={(value) => setConfigValue("titleFontSizePx", value)}
                      />
                    </Field>

                    <Field label="Tamaño mensaje (px)">
                      <NumberInput
                        min={12}
                        max={40}
                        value={config.messageFontSizePx}
                        onChange={(value) => setConfigValue("messageFontSizePx", value)}
                      />
                    </Field>

                    <Field label="Tamaño texto botón (px)">
                      <NumberInput
                        min={10}
                        max={28}
                        value={config.buttonFontSizePx}
                        onChange={(value) => setConfigValue("buttonFontSizePx", value)}
                      />
                    </Field>

                    <Field label="Radio botón (px)">
                      <NumberInput
                        min={0}
                        max={999}
                        value={config.buttonRadiusPx}
                        onChange={(value) => setConfigValue("buttonRadiusPx", value)}
                      />
                    </Field>

                    <Field label="Ancho máximo imagen (px)">
                      <NumberInput
                        min={120}
                        max={800}
                        value={config.imageMaxWidthPx}
                        onChange={(value) => setConfigValue("imageMaxWidthPx", value)}
                      />
                    </Field>

                    <Field label="Radio imagen (px)">
                      <NumberInput
                        min={0}
                        max={80}
                        value={config.imageRadiusPx}
                        onChange={(value) => setConfigValue("imageRadiusPx", value)}
                      />
                    </Field>
                  </div>
                </div>

                <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4">
                  <h2 className="mb-4 text-lg font-semibold text-gray-900">Estilo del botón</h2>

                  <div className="max-w-sm">
                    <Field label="Tipo de botón">
                      <Select
                        value={config.buttonStyle}
                        onChange={(e) => setConfigValue("buttonStyle", e.target.value)}
                      >
                        {BUTTON_STYLE_OPTIONS.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </div>
                </div>
              </>
            ) : null}
          </section>

          <aside className="xl:sticky xl:top-6 xl:self-start">
            <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Vista previa</h2>
                <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-500">
                  /not-found
                </span>
              </div>

              <div
                className="overflow-hidden rounded-[28px] border border-gray-200"
                style={{ backgroundColor: config.pageBg }}
              >
                <div className="border-b border-gray-200 bg-white/90 px-4 py-3 text-xs text-gray-400">
                  {config.showHeader || form.useHeader ? "Header visible" : "Header oculto"}
                </div>

                <div
                  className="px-4"
                  style={{
                    paddingTop: `${config.contentTopPaddingPx}px`,
                    paddingBottom: `${config.contentBottomPaddingPx}px`,
                  }}
                >
                  <div
                    className="mx-auto overflow-hidden border shadow-sm"
                    style={{
                      maxWidth: `${config.contentMaxWidthPx}px`,
                      backgroundColor: config.cardBg,
                      borderRadius: `${config.cardRadiusPx}px`,
                      borderWidth: `${config.cardBorderWidthPx}px`,
                      borderColor: `${config.accentColor}30`,
                    }}
                  >
                    <div
                      className="grid items-center p-6"
                      style={{
                        gap: `${config.gapPx}px`,
                        gridTemplateColumns: "1fr",
                      }}
                    >
                      {config.showBreadcrumb ? (
                        <div
                          className="text-xs"
                          style={{ color: config.breadcrumbColor }}
                        >
                          {config.breadcrumbRootLabel} {"›"} {config.breadcrumbText}
                        </div>
                      ) : null}

                      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                        <div className="space-y-4">
                          {config.showTitle ? (
                            config.titleMode === "image" && config.titleImage ? (
                              <img
                                src={config.titleImage}
                                alt={config.titleImageAlt || "Título"}
                                className="h-auto max-w-full object-contain"
                                style={{ maxHeight: `${config.titleFontSizePx + 20}px` }}
                              />
                            ) : (
                              <h3
                                className="font-semibold leading-tight"
                                style={{
                                  color: config.titleTextColor,
                                  fontSize: `${config.titleFontSizePx}px`,
                                }}
                              >
                                {config.titleText || "Página no encontrada"}
                              </h3>
                            )
                          ) : null}

                          {config.showMessage ? (
                            <p
                              className="leading-7"
                              style={{
                                color: config.textSecondaryColor,
                                fontSize: `${config.messageFontSizePx}px`,
                              }}
                            >
                              {config.messageText}
                            </p>
                          ) : null}

                          {config.showButton ? (
                            <a
                              href={config.buttonLink || "/"}
                              className={`inline-flex items-center justify-center px-5 py-3 font-medium transition ${buildButtonClass(
                                config.buttonStyle
                              )}`}
                              style={previewButtonStyle}
                            >
                              {config.buttonText || "Volver al inicio"}
                            </a>
                          ) : null}
                        </div>

                        {config.showImage && config.imageUrl ? (
                          <div className="flex justify-center md:justify-end">
                            <img
                              src={config.imageUrl}
                              alt={config.imageAlt || "Imagen decorativa"}
                              className="h-auto w-full object-cover"
                              style={{
                                maxWidth: `${config.imageMaxWidthPx}px`,
                                borderRadius: `${config.imageRadiusPx}px`,
                              }}
                            />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-200 bg-white/90 px-4 py-3 text-xs text-gray-400">
                  {config.showFooter || form.useFooter ? "Footer visible" : "Footer oculto"}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
