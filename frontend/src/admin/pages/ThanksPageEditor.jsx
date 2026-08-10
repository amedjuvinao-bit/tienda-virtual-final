import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { API_BASE_URL } from "../../config/apiBaseUrl";

const API_BASE = API_BASE_URL;

const EDITOR_TABS = [
  { id: "general", label: "General" },
  { id: "content", label: "Contenido" },
  { id: "slider", label: "Slider visual" },
  { id: "style", label: "Estilo" },
];

const TITLE_MODE_OPTIONS = [
  { value: "image", label: "Título con imagen" },
  { value: "text", label: "Título en texto" },
];

const SHADOW_OPTIONS = [
  { value: "none", label: "Sin sombra" },
  { value: "soft", label: "Suave" },
  { value: "medium", label: "Media" },
  { value: "strong", label: "Fuerte" },
];

const BUTTON_STYLE_OPTIONS = [
  { value: "pill", label: "Píldora" },
  { value: "rounded", label: "Redondeado" },
  { value: "square", label: "Cuadrado suave" },
];

const ANIMATION_OPTIONS = [
  { value: "fade", label: "Desvanecer" },
  { value: "slide", label: "Deslizar" },
  { value: "zoom", label: "Zoom suave" },
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

const Textarea = ({ label, ...rest }) => (
  <label className="block min-w-0">
    <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
    <textarea
      className="min-h-[110px] w-full min-w-0 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-pink-300 focus:ring-2 focus:ring-pink-200"
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

const ColorInput = ({ label, value, onChange }) => (
  <label className="block min-w-0">
    <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
    <div className="flex items-center gap-3 rounded-xl border border-gray-300 bg-white px-3 py-2.5">
      <input
        type="color"
        value={isHexColor(value) ? value : "#ec4899"}
        onChange={onChange}
        className="h-10 w-12 cursor-pointer rounded border border-gray-200 bg-white"
      />
      <input
        type="text"
        value={value || ""}
        onChange={onChange}
        className="w-full min-w-0 bg-transparent text-sm text-gray-800 outline-none"
        placeholder="#ec4899"
      />
    </div>
  </label>
);

const TabButton = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={[
      "rounded-2xl border px-4 py-2.5 text-sm font-medium transition",
      active
        ? "border-pink-500 bg-pink-600 text-white shadow-sm"
        : "border-pink-100 bg-white text-pink-700 hover:border-pink-200 hover:bg-pink-50",
    ].join(" ")}
  >
    {children}
  </button>
);

const InfoCard = ({ title, text }) => (
  <div className="rounded-2xl border border-pink-100 bg-gradient-to-r from-pink-50 to-rose-50 px-4 py-3">
    <div className="text-sm font-semibold text-pink-700">{title}</div>
    <p className="mt-1 text-sm leading-6 text-gray-600">{text}</p>
  </div>
);

function SectionCard({ title, text, children, className = "" }) {
  return (
    <section
      className={`space-y-4 rounded-3xl border border-gray-200 bg-white p-4 md:p-5 ${className}`}
    >
      <div>
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        {text ? <p className="mt-1 text-sm text-gray-500">{text}</p> : null}
      </div>
      {children}
    </section>
  );
}

function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function isHexColor(value) {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(value || "").trim());
}

function makeEmptySlide(index = 0) {
  return {
    id: `slide-${Date.now()}-${index}`,
    image: "",
    alt: `Imagen ${index + 1}`,
    badge: "",
    caption: "",
  };
}

function buildSafeThanksPageConfig(raw) {
  const cfg = raw && typeof raw === "object" ? raw : {};
  const slides = Array.isArray(cfg.slider?.slides) && cfg.slider.slides.length
    ? cfg.slider.slides.map((slide, index) => ({
        id:
          typeof slide?.id === "string" && slide.id.trim()
            ? slide.id
            : `slide-${index}`,
        image: typeof slide?.image === "string" ? slide.image : "",
        alt:
          typeof slide?.alt === "string" && slide.alt.trim()
            ? slide.alt
            : `Imagen ${index + 1}`,
        badge: typeof slide?.badge === "string" ? slide.badge : "",
        caption: typeof slide?.caption === "string" ? slide.caption : "",
      }))
    : [makeEmptySlide(0), makeEmptySlide(1)];

  return {
    titleMode:
      cfg.titleMode === "text" || cfg.titleMode === "image" ? cfg.titleMode : "text",
    titleText:
      typeof cfg.titleText === "string" && cfg.titleText.trim()
        ? cfg.titleText
        : "¡Gracias por tu compra!",
    titleImage: typeof cfg.titleImage === "string" ? cfg.titleImage : "",
    titleImageAlt:
      typeof cfg.titleImageAlt === "string" && cfg.titleImageAlt.trim()
        ? cfg.titleImageAlt
        : "Título gracias",

    showHeader: cfg.showHeader !== false,
    showFooter: cfg.showFooter !== false,
    showWhatsAppButton: cfg.showWhatsAppButton !== false,
    showOrderNumber: cfg.showOrderNumber !== false,
    showCustomerName: cfg.showCustomerName !== false,
    showItemCount: cfg.showItemCount !== false,
    showSubtotal: cfg.showSubtotal !== false,
    showShipping: cfg.showShipping !== false,
    showTotal: cfg.showTotal !== false,
    showContinueButton: cfg.showContinueButton !== false,
    showHelpText: cfg.showHelpText !== false,
    showVisualPanel: cfg.showVisualPanel !== false,

    mainMessage:
      typeof cfg.mainMessage === "string" && cfg.mainMessage.trim()
        ? cfg.mainMessage
        : "Hemos recibido tu pedido correctamente. Te enviaremos un mensaje cuando esté en camino.",
    summaryTitle:
      typeof cfg.summaryTitle === "string" && cfg.summaryTitle.trim()
        ? cfg.summaryTitle
        : "Resumen de tu orden",
    orderNumberLabel:
      typeof cfg.orderNumberLabel === "string" && cfg.orderNumberLabel.trim()
        ? cfg.orderNumberLabel
        : "Número de orden:",
    customerLabel:
      typeof cfg.customerLabel === "string" && cfg.customerLabel.trim()
        ? cfg.customerLabel
        : "Cliente:",
    itemCountLabel:
      typeof cfg.itemCountLabel === "string" && cfg.itemCountLabel.trim()
        ? cfg.itemCountLabel
        : "Productos comprados:",
    subtotalLabel:
      typeof cfg.subtotalLabel === "string" && cfg.subtotalLabel.trim()
        ? cfg.subtotalLabel
        : "Subtotal:",
    shippingLabel:
      typeof cfg.shippingLabel === "string" && cfg.shippingLabel.trim()
        ? cfg.shippingLabel
        : "Envío:",
    totalLabel:
      typeof cfg.totalLabel === "string" && cfg.totalLabel.trim()
        ? cfg.totalLabel
        : "Total pagado:",
    continueButtonText:
      typeof cfg.continueButtonText === "string" && cfg.continueButtonText.trim()
        ? cfg.continueButtonText
        : "Seguir comprando",
    helpText:
      typeof cfg.helpText === "string" && cfg.helpText.trim()
        ? cfg.helpText
        : "¿Tienes dudas? Contáctanos por WhatsApp o revisa tu correo electrónico para más detalles.",

    slider: {
      enabled: cfg?.slider?.enabled !== false,
      autoplay: cfg?.slider?.autoplay !== false,
      intervalMs: clampInt(cfg?.slider?.intervalMs, 1500, 12000, 3500),
      animation:
        cfg?.slider?.animation === "slide" ||
        cfg?.slider?.animation === "zoom" ||
        cfg?.slider?.animation === "fade"
          ? cfg.slider.animation
          : "fade",
      slides,
    },

    style: {
      pageBg: typeof cfg?.style?.pageBg === "string" ? cfg.style.pageBg : "#f4f4f5",
      contentMaxWidthPx: clampInt(cfg?.style?.contentMaxWidthPx, 900, 1800, 1200),
      contentTopPaddingPx: clampInt(cfg?.style?.contentTopPaddingPx, 0, 240, 70),

      titleTextColor:
        typeof cfg?.style?.titleTextColor === "string"
          ? cfg.style.titleTextColor
          : "#db2777",
      titleFontSizePx: clampInt(cfg?.style?.titleFontSizePx, 18, 72, 28),
      titleImageHeightPx: clampInt(cfg?.style?.titleImageHeightPx, 24, 220, 72),

      panelBg:
        typeof cfg?.style?.panelBg === "string" ? cfg.style.panelBg : "#fdf2f8",
      panelBorderColor:
        typeof cfg?.style?.panelBorderColor === "string"
          ? cfg.style.panelBorderColor
          : "#f3c4d8",
      panelRadiusPx: clampInt(cfg?.style?.panelRadiusPx, 0, 40, 14),
      panelPaddingPx: clampInt(cfg?.style?.panelPaddingPx, 8, 48, 24),
      panelWidthPx: clampInt(cfg?.style?.panelWidthPx, 280, 900, 540),
      panelMinHeightPx: clampInt(cfg?.style?.panelMinHeightPx, 240, 900, 420),

      visualBorderColor:
        typeof cfg?.style?.visualBorderColor === "string"
          ? cfg.style.visualBorderColor
          : "#f59ad0",
      visualRadiusPx: clampInt(cfg?.style?.visualRadiusPx, 0, 40, 16),
      visualWidthPx: clampInt(cfg?.style?.visualWidthPx, 220, 900, 400),
      visualHeightPx: clampInt(cfg?.style?.visualHeightPx, 220, 760, 520),

      badgeBg:
        typeof cfg?.style?.badgeBg === "string" ? cfg.style.badgeBg : "#ffffffcc",
      badgeTextColor:
        typeof cfg?.style?.badgeTextColor === "string"
          ? cfg.style.badgeTextColor
          : "#db2777",
      captionBg:
        typeof cfg?.style?.captionBg === "string"
          ? cfg.style.captionBg
          : "#ffffffcc",
      captionTextColor:
        typeof cfg?.style?.captionTextColor === "string"
          ? cfg.style.captionTextColor
          : "#374151",

      textPrimaryColor:
        typeof cfg?.style?.textPrimaryColor === "string"
          ? cfg.style.textPrimaryColor
          : "#111827",
      textSecondaryColor:
        typeof cfg?.style?.textSecondaryColor === "string"
          ? cfg.style.textSecondaryColor
          : "#4b5563",
      accentColor:
        typeof cfg?.style?.accentColor === "string"
          ? cfg.style.accentColor
          : "#ec4899",

      buttonBg:
        typeof cfg?.style?.buttonBg === "string" ? cfg.style.buttonBg : "#ec4899",
      buttonTextColor:
        typeof cfg?.style?.buttonTextColor === "string"
          ? cfg.style.buttonTextColor
          : "#ffffff",
      buttonRadiusPx: clampInt(cfg?.style?.buttonRadiusPx, 0, 40, 14),
      buttonStyle:
        cfg?.style?.buttonStyle === "pill" ||
        cfg?.style?.buttonStyle === "rounded" ||
        cfg?.style?.buttonStyle === "square"
          ? cfg.style.buttonStyle
          : "rounded",

      shadowStyle:
        cfg?.style?.shadowStyle === "none" ||
        cfg?.style?.shadowStyle === "soft" ||
        cfg?.style?.shadowStyle === "medium" ||
        cfg?.style?.shadowStyle === "strong"
          ? cfg.style.shadowStyle
          : "soft",
    },
  };
}

export default function ThanksPageEditor() {
  const navigate = useNavigate();
  const { id } = useParams();

  const titleImageInputRef = useRef(null);
  const slideFileRefs = useRef({});

  const [page, setPage] = useState(null);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("general");

  const [titleImageFile, setTitleImageFile] = useState(null);
  const [titleImagePreview, setTitleImagePreview] = useState("");
  const [uploadingTitleImage, setUploadingTitleImage] = useState(false);
  const [uploadingSlideId, setUploadingSlideId] = useState("");

  const previewUrl = useMemo(() => "/gracias", []);

  const fetchPage = async () => {
    try {
      setLoading(true);
      setNotFound(false);

      const res = await fetch(`${API_BASE}/api/pages/${id}`);

      if (res.status === 404) {
        setPage(null);
        setForm(null);
        setNotFound(true);
        return;
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      const safeConfig = buildSafeThanksPageConfig(data?.thanksPageConfig);

      setPage(data);
      setForm({
        name: typeof data?.name === "string" ? data.name : "Gracias",
        slug: typeof data?.slug === "string" ? data.slug : "gracias",
        pageType: "thanks-page",
        enabled: data?.enabled !== false,
        useHeader: data?.useHeader !== false,
        useFooter: data?.useFooter !== false,
        thanksPageConfig: safeConfig,
      });

      setTitleImagePreview(String(safeConfig?.titleImage || ""));
      setTitleImageFile(null);
    } catch (error) {
      console.error("Error cargando página gracias:", error);
      setPage(null);
      setForm(null);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchPage();
  }, [id]);

  const updateRoot = (patch) => {
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const updateThanksConfig = (patch) => {
    setForm((prev) => ({
      ...prev,
      thanksPageConfig: {
        ...(prev?.thanksPageConfig || {}),
        ...patch,
      },
    }));
  };

  const updateStyleConfig = (patch) => {
    setForm((prev) => ({
      ...prev,
      thanksPageConfig: {
        ...(prev?.thanksPageConfig || {}),
        style: {
          ...buildSafeThanksPageConfig(prev?.thanksPageConfig)?.style,
          ...patch,
        },
      },
    }));
  };

  const updateSliderConfig = (patch) => {
    setForm((prev) => ({
      ...prev,
      thanksPageConfig: {
        ...(prev?.thanksPageConfig || {}),
        slider: {
          ...buildSafeThanksPageConfig(prev?.thanksPageConfig)?.slider,
          ...patch,
        },
      },
    }));
  };

  const updateSlide = (slideId, patch) => {
    setForm((prev) => {
      const safe = buildSafeThanksPageConfig(prev?.thanksPageConfig);
      const nextSlides = safe.slider.slides.map((slide) =>
        slide.id === slideId ? { ...slide, ...patch } : slide
      );

      return {
        ...prev,
        thanksPageConfig: {
          ...safe,
          slider: {
            ...safe.slider,
            slides: nextSlides,
          },
        },
      };
    });
  };

  const handleAddSlide = () => {
    setForm((prev) => {
      const safe = buildSafeThanksPageConfig(prev?.thanksPageConfig);
      return {
        ...prev,
        thanksPageConfig: {
          ...safe,
          slider: {
            ...safe.slider,
            slides: [...safe.slider.slides, makeEmptySlide(safe.slider.slides.length)],
          },
        },
      };
    });
  };

  const handleRemoveSlide = (slideId) => {
    setForm((prev) => {
      const safe = buildSafeThanksPageConfig(prev?.thanksPageConfig);
      const nextSlides = safe.slider.slides.filter((slide) => slide.id !== slideId);
      return {
        ...prev,
        thanksPageConfig: {
          ...safe,
          slider: {
            ...safe.slider,
            slides: nextSlides.length ? nextSlides : [makeEmptySlide(0)],
          },
        },
      };
    });
  };

  const handlePickTitleImage = () => {
    titleImageInputRef.current?.click();
  };

  const handleTitleImageSelected = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setTitleImageFile(file);
    setTitleImagePreview(URL.createObjectURL(file));
  };

  const handleUploadTitleImage = async () => {
    if (!titleImageFile) {
      alert("Primero selecciona una imagen.");
      return;
    }

    try {
      setUploadingTitleImage(true);

      const body = new FormData();
      body.append("file", titleImageFile);

      const res = await fetch(`${API_BASE}/api/uploads`, {
        method: "POST",
        body,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.url) {
        throw new Error(data?.error || "No se pudo subir la imagen.");
      }

      updateThanksConfig({
        titleImage: data.url,
        titleMode: "image",
      });

      setTitleImagePreview(data.url);
      setTitleImageFile(null);

      if (titleImageInputRef.current) {
        titleImageInputRef.current.value = "";
      }

      alert("Imagen subida correctamente ✅");
    } catch (error) {
      console.error("Error subiendo imagen del título:", error);
      alert(error.message || "No se pudo subir la imagen a Cloudinary.");
    } finally {
      setUploadingTitleImage(false);
    }
  };

  const handlePickSlideImage = (slideId) => {
    slideFileRefs.current[slideId]?.click();
  };

  const handleUploadSlideImage = async (slideId, file) => {
    if (!file) return;

    try {
      setUploadingSlideId(slideId);

      const body = new FormData();
      body.append("file", file);

      const res = await fetch(`${API_BASE}/api/uploads`, {
        method: "POST",
        body,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.url) {
        throw new Error(data?.error || "No se pudo subir la imagen.");
      }

      updateSlide(slideId, { image: data.url });
      alert("Imagen del slide subida correctamente ✅");
    } catch (error) {
      console.error("Error subiendo imagen del slide:", error);
      alert(error.message || "No se pudo subir la imagen del slide.");
    } finally {
      setUploadingSlideId("");
    }
  };

  const handleSave = async () => {
    if (!form) return;

    try {
      setSaving(true);

      const payload = {
        name: "Gracias",
        slug: "gracias",
        pageType: "thanks-page",
        enabled: form.enabled !== false,
        useHeader: form.useHeader !== false,
        useFooter: form.useFooter !== false,
        blocks: [],
        thanksPageConfig: buildSafeThanksPageConfig(form.thanksPageConfig),
      };

      const res = await fetch(`${API_BASE}/api/pages/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.message || `HTTP ${res.status}`);
      }

      const safeConfig = buildSafeThanksPageConfig(data?.thanksPageConfig);

      setPage(data);
      setForm({
        name: typeof data?.name === "string" ? data.name : "Gracias",
        slug: typeof data?.slug === "string" ? data.slug : "gracias",
        pageType: "thanks-page",
        enabled: data?.enabled !== false,
        useHeader: data?.useHeader !== false,
        useFooter: data?.useFooter !== false,
        thanksPageConfig: safeConfig,
      });

      setTitleImagePreview(String(safeConfig?.titleImage || ""));
      alert("Página gracias guardada correctamente ✅");
    } catch (error) {
      console.error("Error guardando página gracias:", error);
      alert(error.message || "No se pudo guardar la página gracias.");
    } finally {
      setSaving(false);
    }
  };

  const handleOpenPreview = () => {
    window.open(previewUrl, "_blank", "noopener,noreferrer");
  };

  if (loading) {
    return <div className="p-6 text-gray-500">Cargando página gracias...</div>;
  }

  if (notFound || !page || !form) {
    return <div className="p-6 text-red-500">Página gracias no encontrada</div>;
  }

  if (String(page?.pageType || "").toLowerCase() !== "thanks-page") {
    return (
      <div className="space-y-4 p-6">
        <div className="text-red-500">Esta página no es de tipo gracias.</div>
        <button
          type="button"
          onClick={() => navigate("/admin/paginas")}
          className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm"
        >
          ← Volver
        </button>
      </div>
    );
  }

  const style = form.thanksPageConfig.style;
  const slider = form.thanksPageConfig.slider;

  const buttonRadius =
    style.buttonStyle === "pill"
      ? 999
      : style.buttonStyle === "rounded"
      ? Math.min(style.buttonRadiusPx, 18)
      : 8;

  const previewShadowClass =
    style.shadowStyle === "none"
      ? ""
      : style.shadowStyle === "medium"
      ? "shadow-md"
      : style.shadowStyle === "strong"
      ? "shadow-xl"
      : "shadow-sm";

  return (
    <div className="min-w-0 space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => navigate("/admin/paginas")}
            className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm"
          >
            ← Volver
          </button>

          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Editor de página gracias
            </h1>
            <p className="text-sm text-gray-500">
              Configura la página fija de agradecimiento con diseño visual más llamativo.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleOpenPreview}
            className="inline-flex items-center gap-2 rounded-xl border border-pink-300 bg-pink-50 px-4 py-2 text-sm font-medium text-pink-700 hover:bg-pink-100"
          >
            Vista previa
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-pink-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-pink-700 disabled:opacity-60"
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>

      <InfoCard
        title="Página fija del sistema"
        text="Esta página siempre existe. Aquí controlas su contenido, el panel visual y el estilo general."
      />

      <div className="rounded-3xl border border-pink-100 bg-gradient-to-br from-white to-pink-50/60 p-3 md:p-4">
        <div className="flex flex-wrap gap-2">
          {EDITOR_TABS.map((tab) => (
            <TabButton
              key={tab.id}
              active={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </TabButton>
          ))}
        </div>
      </div>

      {activeTab === "general" && (
        <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
          <SectionCard
            title="Configuración base"
            text="Datos generales de la página fija gracias."
            className="bg-gray-50"
          >
            <Input label="Nombre" value={form.name} disabled />
            <Input label="Slug / ruta" value={form.slug} disabled />

            <Toggle
              label="Página activa"
              checked={form.enabled}
              onChange={(value) => updateRoot({ enabled: value })}
            />

            <Toggle
              label="Usar header"
              checked={form.useHeader}
              onChange={(value) => updateRoot({ useHeader: value })}
            />

            <Toggle
              label="Usar footer"
              checked={form.useFooter}
              onChange={(value) => updateRoot({ useFooter: value })}
            />

            <Toggle
              label="Mostrar botón WhatsApp"
              checked={form.thanksPageConfig.showWhatsAppButton}
              onChange={(value) =>
                updateThanksConfig({ showWhatsAppButton: value })
              }
            />

            <Toggle
              label="Mostrar panel visual izquierdo"
              checked={form.thanksPageConfig.showVisualPanel}
              onChange={(value) =>
                updateThanksConfig({ showVisualPanel: value })
              }
            />
          </SectionCard>

          <SectionCard
            title="Encabezado visual"
            text="Elige si el título principal se muestra como imagen o texto."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Select
                label="Modo de título"
                value={form.thanksPageConfig.titleMode}
                onChange={(e) =>
                  updateThanksConfig({ titleMode: e.target.value })
                }
              >
                {TITLE_MODE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>

              <Input
                label="Texto del título"
                value={form.thanksPageConfig.titleText}
                onChange={(e) =>
                  updateThanksConfig({ titleText: e.target.value })
                }
                placeholder="¡Gracias por tu compra!"
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <Input
                  label="URL imagen del título"
                  value={form.thanksPageConfig.titleImage}
                  onChange={(e) =>
                    updateThanksConfig({ titleImage: e.target.value })
                  }
                  placeholder="https://..."
                />

                <Input
                  label="Alt imagen del título"
                  value={form.thanksPageConfig.titleImageAlt}
                  onChange={(e) =>
                    updateThanksConfig({ titleImageAlt: e.target.value })
                  }
                  placeholder="Título gracias"
                />

                <input
                  ref={titleImageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleTitleImageSelected}
                />

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handlePickTitleImage}
                    className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
                  >
                    Escoger imagen
                  </button>

                  <button
                    type="button"
                    onClick={handleUploadTitleImage}
                    disabled={uploadingTitleImage || !titleImageFile}
                    className="rounded-xl bg-pink-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-pink-700 disabled:opacity-50"
                  >
                    {uploadingTitleImage ? "Subiendo..." : "Subir a Cloudinary"}
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="mb-3 text-sm font-semibold text-gray-800">
                  Vista previa del título
                </div>

                <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4">
                  {form.thanksPageConfig.titleMode === "image" &&
                  (titleImagePreview || form.thanksPageConfig.titleImage) ? (
                    <img
                      src={titleImagePreview || form.thanksPageConfig.titleImage}
                      alt={form.thanksPageConfig.titleImageAlt || "Vista previa"}
                      className="max-h-[180px] max-w-full object-contain"
                    />
                  ) : (
                    <div
                      className="text-center font-semibold"
                      style={{
                        color: style.titleTextColor,
                        fontSize: `${style.titleFontSizePx}px`,
                      }}
                    >
                      {form.thanksPageConfig.titleText || "¡Gracias por tu compra!"}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </SectionCard>
        </div>
      )}

      {activeTab === "content" && (
        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <SectionCard
            title="Visibilidad de contenido"
            text="Activa o desactiva elementos del resumen de compra."
          >
            <div className="grid gap-3 md:grid-cols-2">
              <Toggle
                label="Mostrar número de orden"
                checked={form.thanksPageConfig.showOrderNumber}
                onChange={(value) =>
                  updateThanksConfig({ showOrderNumber: value })
                }
              />
              <Toggle
                label="Mostrar cliente"
                checked={form.thanksPageConfig.showCustomerName}
                onChange={(value) =>
                  updateThanksConfig({ showCustomerName: value })
                }
              />
              <Toggle
                label="Mostrar productos comprados"
                checked={form.thanksPageConfig.showItemCount}
                onChange={(value) =>
                  updateThanksConfig({ showItemCount: value })
                }
              />
              <Toggle
                label="Mostrar subtotal"
                checked={form.thanksPageConfig.showSubtotal}
                onChange={(value) =>
                  updateThanksConfig({ showSubtotal: value })
                }
              />
              <Toggle
                label="Mostrar envío"
                checked={form.thanksPageConfig.showShipping}
                onChange={(value) =>
                  updateThanksConfig({ showShipping: value })
                }
              />
              <Toggle
                label="Mostrar total pagado"
                checked={form.thanksPageConfig.showTotal}
                onChange={(value) =>
                  updateThanksConfig({ showTotal: value })
                }
              />
              <Toggle
                label="Mostrar botón continuar"
                checked={form.thanksPageConfig.showContinueButton}
                onChange={(value) =>
                  updateThanksConfig({ showContinueButton: value })
                }
              />
              <Toggle
                label="Mostrar texto inferior"
                checked={form.thanksPageConfig.showHelpText}
                onChange={(value) =>
                  updateThanksConfig({ showHelpText: value })
                }
              />
            </div>
          </SectionCard>

          <SectionCard
            title="Textos editables"
            text="Personaliza los textos internos de la página gracias."
          >
            <Input
              label="Mensaje principal"
              value={form.thanksPageConfig.mainMessage}
              onChange={(e) =>
                updateThanksConfig({ mainMessage: e.target.value })
              }
            />

            <Input
              label="Título del resumen"
              value={form.thanksPageConfig.summaryTitle}
              onChange={(e) =>
                updateThanksConfig({ summaryTitle: e.target.value })
              }
            />

            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Texto número de orden"
                value={form.thanksPageConfig.orderNumberLabel}
                onChange={(e) =>
                  updateThanksConfig({ orderNumberLabel: e.target.value })
                }
              />
              <Input
                label="Texto cliente"
                value={form.thanksPageConfig.customerLabel}
                onChange={(e) =>
                  updateThanksConfig({ customerLabel: e.target.value })
                }
              />
              <Input
                label="Texto productos comprados"
                value={form.thanksPageConfig.itemCountLabel}
                onChange={(e) =>
                  updateThanksConfig({ itemCountLabel: e.target.value })
                }
              />
              <Input
                label="Texto subtotal"
                value={form.thanksPageConfig.subtotalLabel}
                onChange={(e) =>
                  updateThanksConfig({ subtotalLabel: e.target.value })
                }
              />
              <Input
                label="Texto envío"
                value={form.thanksPageConfig.shippingLabel}
                onChange={(e) =>
                  updateThanksConfig({ shippingLabel: e.target.value })
                }
              />
              <Input
                label="Texto total pagado"
                value={form.thanksPageConfig.totalLabel}
                onChange={(e) =>
                  updateThanksConfig({ totalLabel: e.target.value })
                }
              />
              <Input
                label="Texto botón"
                value={form.thanksPageConfig.continueButtonText}
                onChange={(e) =>
                  updateThanksConfig({ continueButtonText: e.target.value })
                }
              />
            </div>

            <Textarea
              label="Texto inferior"
              value={form.thanksPageConfig.helpText}
              onChange={(e) =>
                updateThanksConfig({ helpText: e.target.value })
              }
            />
          </SectionCard>
        </div>
      )}

      {activeTab === "slider" && (
        <div className="space-y-6">
          <SectionCard
            title="Configuración del slider visual"
            text="Controla el panel visual izquierdo con imágenes, badges y animación."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Toggle
                label="Activar slider"
                checked={slider.enabled}
                onChange={(value) => updateSliderConfig({ enabled: value })}
              />
              <Toggle
                label="Autoplay"
                checked={slider.autoplay}
                onChange={(value) => updateSliderConfig({ autoplay: value })}
              />

              <Input
                label="Intervalo automático (ms)"
                type="number"
                min="1500"
                max="12000"
                value={slider.intervalMs}
                onChange={(e) =>
                  updateSliderConfig({
                    intervalMs: clampInt(e.target.value, 1500, 12000, 3500),
                  })
                }
              />

              <Select
                label="Animación"
                value={slider.animation}
                onChange={(e) => updateSliderConfig({ animation: e.target.value })}
              >
                {ANIMATION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
          </SectionCard>

          <SectionCard
            title="Slides"
            text="Agrega imágenes, badges y subtítulos para hacer la página más impactante."
          >
            <div className="space-y-5">
              {slider.slides.map((slide, index) => (
                <div
                  key={slide.id}
                  className="rounded-2xl border border-gray-200 bg-gray-50 p-4 space-y-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-gray-800">
                      Slide #{index + 1}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveSlide(slide.id)}
                      className="rounded-xl border border-red-300 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      Eliminar
                    </button>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
                    <div className="space-y-4">
                      <Input
                        label="URL imagen"
                        value={slide.image}
                        onChange={(e) =>
                          updateSlide(slide.id, { image: e.target.value })
                        }
                        placeholder="https://..."
                      />

                      <Input
                        label="Alt imagen"
                        value={slide.alt}
                        onChange={(e) =>
                          updateSlide(slide.id, { alt: e.target.value })
                        }
                      />

                      <Input
                        label="Badge"
                        value={slide.badge}
                        onChange={(e) =>
                          updateSlide(slide.id, { badge: e.target.value })
                        }
                        placeholder="Ej: Nueva colección"
                      />

                      <Textarea
                        label="Subtítulo"
                        value={slide.caption}
                        onChange={(e) =>
                          updateSlide(slide.id, { caption: e.target.value })
                        }
                        placeholder="Texto decorativo del slide"
                      />

                      <input
                        ref={(el) => {
                          slideFileRefs.current[slide.id] = el;
                        }}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) =>
                          handleUploadSlideImage(slide.id, e.target.files?.[0])
                        }
                      />

                      <button
                        type="button"
                        onClick={() => handlePickSlideImage(slide.id)}
                        disabled={uploadingSlideId === slide.id}
                        className="rounded-xl bg-pink-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-pink-700 disabled:opacity-50"
                      >
                        {uploadingSlideId === slide.id ? "Subiendo..." : "Subir imagen"}
                      </button>
                    </div>

                    <div className="rounded-2xl border border-gray-200 bg-white p-3">
                      <div className="mb-3 text-sm font-semibold text-gray-800">
                        Vista previa
                      </div>

                      <div
                        className="relative overflow-hidden border mx-auto"
                        style={{
                          borderColor: style.visualBorderColor,
                          borderRadius: `${style.visualRadiusPx}px`,
                          width: `${Math.min(style.visualWidthPx, 260)}px`,
                          height: "260px",
                        }}
                      >
                        {slide.image ? (
                          <img
                            src={slide.image}
                            alt={slide.alt || `Slide ${index + 1}`}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center bg-gray-100 text-sm text-gray-400">
                            Sin imagen
                          </div>
                        )}

                        {slide.badge ? (
                          <div
                            className="absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-semibold shadow-sm"
                            style={{
                              backgroundColor: style.badgeBg,
                              color: style.badgeTextColor,
                            }}
                          >
                            {slide.badge}
                          </div>
                        ) : null}

                        {slide.caption ? (
                          <div
                            className="absolute inset-x-3 bottom-3 rounded-xl px-3 py-2 text-sm"
                            style={{
                              backgroundColor: style.captionBg,
                              color: style.captionTextColor,
                            }}
                          >
                            {slide.caption}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={handleAddSlide}
              className="rounded-xl border border-pink-300 px-4 py-2 text-sm font-medium text-pink-700 hover:bg-pink-50"
            >
              Agregar slide
            </button>
          </SectionCard>
        </div>
      )}

      {activeTab === "style" && (
        <div className="space-y-6">
          <SectionCard
            title="Estilo general"
            text="Colores, radios, sombras y medidas principales de la página gracias."
          >
            <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
              <div className="space-y-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="text-sm font-semibold text-gray-800">Colores</div>

                <div className="grid gap-4 md:grid-cols-2">
                  <ColorInput
                    label="Fondo página"
                    value={style.pageBg}
                    onChange={(e) => updateStyleConfig({ pageBg: e.target.value })}
                  />
                  <ColorInput
                    label="Fondo panel"
                    value={style.panelBg}
                    onChange={(e) => updateStyleConfig({ panelBg: e.target.value })}
                  />
                  <ColorInput
                    label="Borde panel"
                    value={style.panelBorderColor}
                    onChange={(e) =>
                      updateStyleConfig({ panelBorderColor: e.target.value })
                    }
                  />
                  <ColorInput
                    label="Borde visual"
                    value={style.visualBorderColor}
                    onChange={(e) =>
                      updateStyleConfig({ visualBorderColor: e.target.value })
                    }
                  />
                  <ColorInput
                    label="Texto principal"
                    value={style.textPrimaryColor}
                    onChange={(e) =>
                      updateStyleConfig({ textPrimaryColor: e.target.value })
                    }
                  />
                  <ColorInput
                    label="Texto secundario"
                    value={style.textSecondaryColor}
                    onChange={(e) =>
                      updateStyleConfig({ textSecondaryColor: e.target.value })
                    }
                  />
                  <ColorInput
                    label="Color acento"
                    value={style.accentColor}
                    onChange={(e) =>
                      updateStyleConfig({ accentColor: e.target.value })
                    }
                  />
                  <ColorInput
                    label="Texto título"
                    value={style.titleTextColor}
                    onChange={(e) =>
                      updateStyleConfig({ titleTextColor: e.target.value })
                    }
                  />
                  <ColorInput
                    label="Fondo badge"
                    value={style.badgeBg}
                    onChange={(e) => updateStyleConfig({ badgeBg: e.target.value })}
                  />
                  <ColorInput
                    label="Texto badge"
                    value={style.badgeTextColor}
                    onChange={(e) =>
                      updateStyleConfig({ badgeTextColor: e.target.value })
                    }
                  />
                  <ColorInput
                    label="Fondo subtítulo"
                    value={style.captionBg}
                    onChange={(e) =>
                      updateStyleConfig({ captionBg: e.target.value })
                    }
                  />
                  <ColorInput
                    label="Texto subtítulo"
                    value={style.captionTextColor}
                    onChange={(e) =>
                      updateStyleConfig({ captionTextColor: e.target.value })
                    }
                  />
                  <ColorInput
                    label="Fondo botón"
                    value={style.buttonBg}
                    onChange={(e) => updateStyleConfig({ buttonBg: e.target.value })}
                  />
                  <ColorInput
                    label="Texto botón"
                    value={style.buttonTextColor}
                    onChange={(e) =>
                      updateStyleConfig({ buttonTextColor: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="text-sm font-semibold text-gray-800">
                  Medidas y bordes
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    label="Ancho máximo contenido (px)"
                    type="number"
                    min="900"
                    max="1800"
                    value={style.contentMaxWidthPx}
                    onChange={(e) =>
                      updateStyleConfig({
                        contentMaxWidthPx: clampInt(e.target.value, 900, 1800, 1200),
                      })
                    }
                  />

                  <Input
                    label="Espacio debajo del header (px)"
                    type="number"
                    min="0"
                    max="240"
                    value={style.contentTopPaddingPx}
                    onChange={(e) =>
                      updateStyleConfig({
                        contentTopPaddingPx: clampInt(e.target.value, 0, 240, 70),
                      })
                    }
                  />

                  <Input
                    label="Tamaño fuente título (px)"
                    type="number"
                    min="18"
                    max="72"
                    value={style.titleFontSizePx}
                    onChange={(e) =>
                      updateStyleConfig({
                        titleFontSizePx: clampInt(e.target.value, 18, 72, 28),
                      })
                    }
                  />

                  <Input
                    label="Alto imagen título (px)"
                    type="number"
                    min="24"
                    max="220"
                    value={style.titleImageHeightPx}
                    onChange={(e) =>
                      updateStyleConfig({
                        titleImageHeightPx: clampInt(e.target.value, 24, 220, 72),
                      })
                    }
                  />

                  <Input
                    label="Ancho caja de texto (px)"
                    type="number"
                    min="280"
                    max="900"
                    value={style.panelWidthPx}
                    onChange={(e) =>
                      updateStyleConfig({
                        panelWidthPx: clampInt(e.target.value, 280, 900, 540),
                      })
                    }
                  />

                  <Input
                    label="Alto mínimo caja de texto (px)"
                    type="number"
                    min="240"
                    max="900"
                    value={style.panelMinHeightPx}
                    onChange={(e) =>
                      updateStyleConfig({
                        panelMinHeightPx: clampInt(e.target.value, 240, 900, 420),
                      })
                    }
                  />

                  <Input
                    label="Radio panel resumen (px)"
                    type="number"
                    min="0"
                    max="40"
                    value={style.panelRadiusPx}
                    onChange={(e) =>
                      updateStyleConfig({
                        panelRadiusPx: clampInt(e.target.value, 0, 40, 14),
                      })
                    }
                  />

                  <Input
                    label="Padding panel resumen (px)"
                    type="number"
                    min="8"
                    max="48"
                    value={style.panelPaddingPx}
                    onChange={(e) =>
                      updateStyleConfig({
                        panelPaddingPx: clampInt(e.target.value, 8, 48, 24),
                      })
                    }
                  />

                  <Input
                    label="Ancho visual slider (px)"
                    type="number"
                    min="220"
                    max="900"
                    value={style.visualWidthPx}
                    onChange={(e) =>
                      updateStyleConfig({
                        visualWidthPx: clampInt(e.target.value, 220, 900, 400),
                      })
                    }
                  />

                  <Input
                    label="Alto visual slider (px)"
                    type="number"
                    min="220"
                    max="760"
                    value={style.visualHeightPx}
                    onChange={(e) =>
                      updateStyleConfig({
                        visualHeightPx: clampInt(e.target.value, 220, 760, 520),
                      })
                    }
                  />

                  <Input
                    label="Radio visual slider (px)"
                    type="number"
                    min="0"
                    max="40"
                    value={style.visualRadiusPx}
                    onChange={(e) =>
                      updateStyleConfig({
                        visualRadiusPx: clampInt(e.target.value, 0, 40, 16),
                      })
                    }
                  />

                  <Input
                    label="Radio botón (px)"
                    type="number"
                    min="0"
                    max="40"
                    value={style.buttonRadiusPx}
                    onChange={(e) =>
                      updateStyleConfig({
                        buttonRadiusPx: clampInt(e.target.value, 0, 40, 14),
                      })
                    }
                  />

                  <Select
                    label="Forma botón"
                    value={style.buttonStyle}
                    onChange={(e) =>
                      updateStyleConfig({ buttonStyle: e.target.value })
                    }
                  >
                    {BUTTON_STYLE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>

                  <Select
                    label="Tipo de sombra"
                    value={style.shadowStyle}
                    onChange={(e) => updateStyleConfig({ shadowStyle: e.target.value })}
                  >
                    {SHADOW_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Vista previa rápida"
            text="Aquí puedes ver cómo responden el espacio debajo del header, el ancho y el alto del slider y de la caja de texto."
          >
            <div
              className="rounded-3xl border p-5"
              style={{
                backgroundColor: style.pageBg,
                borderColor: style.panelBorderColor,
              }}
            >
              <div
                className="mx-auto"
                style={{
                  maxWidth: `${style.contentMaxWidthPx}px`,
                  paddingTop: `${style.contentTopPaddingPx}px`,
                }}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                  <div className="flex justify-center">
                    <div
                      className={`relative overflow-hidden border ${previewShadowClass}`}
                      style={{
                        borderColor: style.visualBorderColor,
                        borderRadius: `${style.visualRadiusPx}px`,
                        width: `${style.visualWidthPx}px`,
                        height: `${style.visualHeightPx}px`,
                        maxWidth: "100%",
                      }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-pink-100 via-rose-50 to-pink-200" />
                      <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-500">
                        Vista del slider
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-center md:justify-start">
                    <div
                      className={`border ${previewShadowClass} w-full`}
                      style={{
                        backgroundColor: style.panelBg,
                        borderColor: style.panelBorderColor,
                        borderRadius: `${style.panelRadiusPx}px`,
                        padding: `${style.panelPaddingPx}px`,
                        width: `${style.panelWidthPx}px`,
                        minHeight: `${style.panelMinHeightPx}px`,
                        maxWidth: "100%",
                      }}
                    >
                      <div
                        className="font-bold mb-3"
                        style={{
                          color: style.titleTextColor,
                          fontSize: `${style.titleFontSizePx}px`,
                        }}
                      >
                        {form.thanksPageConfig.titleText || "¡Gracias por tu compra!"}
                      </div>

                      <div
                        className="mb-4 text-sm"
                        style={{ color: style.textPrimaryColor }}
                      >
                        {form.thanksPageConfig.mainMessage}
                      </div>

                      <div
                        className="space-y-2 text-sm"
                        style={{ color: style.textPrimaryColor }}
                      >
                        <div>
                          <strong>{form.thanksPageConfig.orderNumberLabel}</strong> 000123
                        </div>
                        <div>
                          <strong>{form.thanksPageConfig.customerLabel}</strong> Cliente ejemplo
                        </div>
                        <div>
                          <strong>{form.thanksPageConfig.itemCountLabel}</strong> 2 artículo(s)
                        </div>
                        <div>
                          <strong>{form.thanksPageConfig.subtotalLabel}</strong> $90.000
                        </div>
                        <div>
                          <strong>{form.thanksPageConfig.shippingLabel}</strong> $20.000
                        </div>
                        <div className="font-bold">
                          <strong>{form.thanksPageConfig.totalLabel}</strong> $110.000
                        </div>
                      </div>

                      <button
                        type="button"
                        className="mt-5 w-full px-6 py-3 font-semibold"
                        style={{
                          backgroundColor: style.buttonBg,
                          color: style.buttonTextColor,
                          borderRadius: `${buttonRadius}px`,
                        }}
                      >
                        {form.thanksPageConfig.continueButtonText}
                      </button>

                      <div
                        className="mt-4 text-xs text-center"
                        style={{ color: style.textSecondaryColor }}
                      >
                        {form.thanksPageConfig.helpText}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>
        </div>
      )}
    </div>
  );
}
