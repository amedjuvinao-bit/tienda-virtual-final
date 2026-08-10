import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { API_BASE_URL } from "../../config/apiBaseUrl";

const API_BASE = API_BASE_URL;

const EDITOR_TABS = [
  { id: "general", label: "General" },
  { id: "content", label: "Contenido" },
  { id: "style", label: "Estilo" },
  { id: "modal", label: "Modal" },
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

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function isHexColor(value) {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(value || "").trim());
}

function hexToRgba(hex, alpha = 1) {
  const safe = String(hex || "").trim();
  if (!isHexColor(safe)) return `rgba(236, 72, 153, ${alpha})`;

  let normalized = safe.replace("#", "");
  if (normalized.length === 3) {
    normalized = normalized
      .split("")
      .map((char) => char + char)
      .join("");
  }

  const int = Number.parseInt(normalized, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function buildSafeCartPageConfig(raw) {
  const cfg = raw && typeof raw === "object" ? raw : {};
  return {
    titleMode:
      cfg.titleMode === "text" || cfg.titleMode === "image" ? cfg.titleMode : "image",
    titleText:
      typeof cfg.titleText === "string" && cfg.titleText.trim()
        ? cfg.titleText
        : "Tu carrito",
    titleImage: typeof cfg.titleImage === "string" ? cfg.titleImage : "",
    titleImageAlt:
      typeof cfg.titleImageAlt === "string" && cfg.titleImageAlt.trim()
        ? cfg.titleImageAlt
        : "Título carrito",

    showHeader: cfg.showHeader !== false,
    showFooter: cfg.showFooter !== false,
    showWhatsAppButton: cfg.showWhatsAppButton !== false,
    showBreadcrumb: cfg.showBreadcrumb !== false,
    showTableHeader: cfg.showTableHeader !== false,
    showRemoveButton: cfg.showRemoveButton !== false,
    showQuantityControls: cfg.showQuantityControls !== false,
    showSubtotal: cfg.showSubtotal !== false,
    showShippingMessage: cfg.showShippingMessage !== false,
    showCheckoutButton: cfg.showCheckoutButton !== false,
    showEmptyState: cfg.showEmptyState !== false,

    breadcrumbHomeText:
      typeof cfg.breadcrumbHomeText === "string" && cfg.breadcrumbHomeText.trim()
        ? cfg.breadcrumbHomeText
        : "Home",
    breadcrumbCurrentText:
      typeof cfg.breadcrumbCurrentText === "string" && cfg.breadcrumbCurrentText.trim()
        ? cfg.breadcrumbCurrentText
        : "Tu carrito",
    tableProductText:
      typeof cfg.tableProductText === "string" && cfg.tableProductText.trim()
        ? cfg.tableProductText
        : "Producto",
    tablePriceText:
      typeof cfg.tablePriceText === "string" && cfg.tablePriceText.trim()
        ? cfg.tablePriceText
        : "Precio",
    tableQuantityText:
      typeof cfg.tableQuantityText === "string" && cfg.tableQuantityText.trim()
        ? cfg.tableQuantityText
        : "Cantidad",
    tableTotalText:
      typeof cfg.tableTotalText === "string" && cfg.tableTotalText.trim()
        ? cfg.tableTotalText
        : "Total",
    removeButtonText:
      typeof cfg.removeButtonText === "string" && cfg.removeButtonText.trim()
        ? cfg.removeButtonText
        : "Eliminar",
    colorLabelText:
      typeof cfg.colorLabelText === "string" && cfg.colorLabelText.trim()
        ? cfg.colorLabelText
        : "Color:",
    sizeLabelText:
      typeof cfg.sizeLabelText === "string" && cfg.sizeLabelText.trim()
        ? cfg.sizeLabelText
        : "Talla:",
    subtotalLabelText:
      typeof cfg.subtotalLabelText === "string" && cfg.subtotalLabelText.trim()
        ? cfg.subtotalLabelText
        : "Subtotal:",
    shippingMessageText:
      typeof cfg.shippingMessageText === "string" && cfg.shippingMessageText.trim()
        ? cfg.shippingMessageText
        : "Impuestos y envío calculado al finalizar la compra",
    checkoutButtonText:
      typeof cfg.checkoutButtonText === "string" && cfg.checkoutButtonText.trim()
        ? cfg.checkoutButtonText
        : "CHECK-OUT",
    emptyStateTitle:
      typeof cfg.emptyStateTitle === "string" && cfg.emptyStateTitle.trim()
        ? cfg.emptyStateTitle
        : "Tu carrito está vacío",
    emptyStateText:
      typeof cfg.emptyStateText === "string" && cfg.emptyStateText.trim()
        ? cfg.emptyStateText
        : "Aún no has agregado productos a tu carrito.",
    continueShoppingText:
      typeof cfg.continueShoppingText === "string" && cfg.continueShoppingText.trim()
        ? cfg.continueShoppingText
        : "Seguir comprando",

    modal: {
      backdropColor:
        typeof cfg?.modal?.backdropColor === "string"
          ? cfg.modal.backdropColor
          : "#000000",
      backdropOpacity: clampInt(cfg?.modal?.backdropOpacity, 0, 100, 50),
      panelBg:
        typeof cfg?.modal?.panelBg === "string"
          ? cfg.modal.panelBg
          : "#FFE3EC",
      panelOpacity: clampInt(cfg?.modal?.panelOpacity, 0, 100, 100),
      textColor:
        typeof cfg?.modal?.textColor === "string"
          ? cfg.modal.textColor
          : "#D4AF37",
      widthPx: clampInt(cfg?.modal?.widthPx, 280, 600, 400),
      checkoutBg:
        typeof cfg?.modal?.checkoutBg === "string"
          ? cfg.modal.checkoutBg
          : "#D4AF37",
      checkoutText:
        typeof cfg?.modal?.checkoutText === "string"
          ? cfg.modal.checkoutText
          : "#ffffff",
      linkColor:
        typeof cfg?.modal?.linkColor === "string"
          ? cfg.modal.linkColor
          : "#D4AF37",
      closeIconColor:
        typeof cfg?.modal?.closeIconColor === "string"
          ? cfg.modal.closeIconColor
          : "#D4AF37",
      emptyTextColor:
        typeof cfg?.modal?.emptyTextColor === "string"
          ? cfg.modal.emptyTextColor
          : "#D4AF37",
      subtotalLabelColor:
        typeof cfg?.modal?.subtotalLabelColor === "string"
          ? cfg.modal.subtotalLabelColor
          : "#D4AF37",
      subtotalValueColor:
        typeof cfg?.modal?.subtotalValueColor === "string"
          ? cfg.modal.subtotalValueColor
          : "#D4AF37",
      quantityButtonBg:
        typeof cfg?.modal?.quantityButtonBg === "string"
          ? cfg.modal.quantityButtonBg
          : "#fcdbe5",
      quantityButtonTextColor:
        typeof cfg?.modal?.quantityButtonTextColor === "string"
          ? cfg.modal.quantityButtonTextColor
          : "#D4AF37",
      removeLinkColor:
        typeof cfg?.modal?.removeLinkColor === "string"
          ? cfg.modal.removeLinkColor
          : "#D4AF37",
      titleImageWidthPx: clampInt(cfg?.modal?.titleImageWidthPx, 80, 260, 160),
      titleImageHeightPx: clampInt(cfg?.modal?.titleImageHeightPx, 40, 180, 80),
      productImageWidthPx: clampInt(cfg?.modal?.productImageWidthPx, 40, 180, 80),
      productImageHeightPx: clampInt(cfg?.modal?.productImageHeightPx, 60, 220, 112),
      panelPaddingPx: clampInt(cfg?.modal?.panelPaddingPx, 8, 40, 16),
      footerPaddingPx: clampInt(cfg?.modal?.footerPaddingPx, 8, 40, 16),
      itemRadiusPx: clampInt(cfg?.modal?.itemRadiusPx, 0, 30, 8),
      buttonRadiusPx: clampInt(cfg?.modal?.buttonRadiusPx, 0, 40, 8),
      panelRadiusPx: clampInt(cfg?.modal?.panelRadiusPx, 0, 40, 0),
      shadowStyle:
        cfg?.modal?.shadowStyle === "none" ||
        cfg?.modal?.shadowStyle === "soft" ||
        cfg?.modal?.shadowStyle === "medium" ||
        cfg?.modal?.shadowStyle === "strong"
          ? cfg.modal.shadowStyle
          : "medium",
    },

    style: {
      pageBg: typeof cfg?.style?.pageBg === "string" ? cfg.style.pageBg : "#fdf2f8",
      contentMaxWidthPx: clampInt(cfg?.style?.contentMaxWidthPx, 900, 1800, 1152),
      contentTopPaddingPx: clampInt(cfg?.style?.contentTopPaddingPx, 0, 240, 100),

      breadcrumbTextColor:
        typeof cfg?.style?.breadcrumbTextColor === "string"
          ? cfg.style.breadcrumbTextColor
          : "#d4af37",
      breadcrumbLinkColor:
        typeof cfg?.style?.breadcrumbLinkColor === "string"
          ? cfg.style.breadcrumbLinkColor
          : "#db2777",

      titleTextColor:
        typeof cfg?.style?.titleTextColor === "string"
          ? cfg.style.titleTextColor
          : "#111827",
      titleFontSizePx: clampInt(cfg?.style?.titleFontSizePx, 18, 72, 34),
      titleImageHeightPx: clampInt(cfg?.style?.titleImageHeightPx, 24, 220, 80),

      cardBg: typeof cfg?.style?.cardBg === "string" ? cfg.style.cardBg : "#ffffff",
      cardBorderColor:
        typeof cfg?.style?.cardBorderColor === "string"
          ? cfg.style.cardBorderColor
          : "#d4af37",
      cardRadiusPx: clampInt(cfg?.style?.cardRadiusPx, 0, 40, 16),
      cardPaddingPx: clampInt(cfg?.style?.cardPaddingPx, 8, 48, 24),

      shadowStyle:
        cfg?.style?.shadowStyle === "none" ||
        cfg?.style?.shadowStyle === "soft" ||
        cfg?.style?.shadowStyle === "medium" ||
        cfg?.style?.shadowStyle === "strong"
          ? cfg.style.shadowStyle
          : "soft",

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
      goldColor:
        typeof cfg?.style?.goldColor === "string"
          ? cfg.style.goldColor
          : "#d4af37",

      tableHeaderTextColor:
        typeof cfg?.style?.tableHeaderTextColor === "string"
          ? cfg.style.tableHeaderTextColor
          : "#d4af37",
      tableLineColor:
        typeof cfg?.style?.tableLineColor === "string"
          ? cfg.style.tableLineColor
          : "#d4af37",

      quantityBorderColor:
        typeof cfg?.style?.quantityBorderColor === "string"
          ? cfg.style.quantityBorderColor
          : "#d4af37",
      quantityTextColor:
        typeof cfg?.style?.quantityTextColor === "string"
          ? cfg.style.quantityTextColor
          : "#ec4899",
      quantityRadiusPx: clampInt(cfg?.style?.quantityRadiusPx, 0, 30, 8),

      checkoutButtonBg:
        typeof cfg?.style?.checkoutButtonBg === "string"
          ? cfg.style.checkoutButtonBg
          : "#f472b6",
      checkoutButtonTextColor:
        typeof cfg?.style?.checkoutButtonTextColor === "string"
          ? cfg.style.checkoutButtonTextColor
          : "#ffffff",
      checkoutButtonRadiusPx: clampInt(cfg?.style?.checkoutButtonRadiusPx, 0, 40, 999),
      checkoutButtonStyle:
        cfg?.style?.checkoutButtonStyle === "pill" ||
        cfg?.style?.checkoutButtonStyle === "rounded" ||
        cfg?.style?.checkoutButtonStyle === "square"
          ? cfg.style.checkoutButtonStyle
          : "pill",

      subtotalTextColor:
        typeof cfg?.style?.subtotalTextColor === "string"
          ? cfg.style.subtotalTextColor
          : "#111827",
      subtotalValueColor:
        typeof cfg?.style?.subtotalValueColor === "string"
          ? cfg.style.subtotalValueColor
          : "#ec4899",

      imageRadiusPx: clampInt(cfg?.style?.imageRadiusPx, 0, 30, 12),
      imageWidthPx: clampInt(cfg?.style?.imageWidthPx, 40, 220, 80),
      imageHeightPx: clampInt(cfg?.style?.imageHeightPx, 40, 220, 80),
    },
  };
}

export default function CartPageEditor() {
  const navigate = useNavigate();
  const { id } = useParams();
  const titleImageInputRef = useRef(null);

  const [page, setPage] = useState(null);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("general");

  const [titleImageFile, setTitleImageFile] = useState(null);
  const [titleImagePreview, setTitleImagePreview] = useState("");
  const [uploadingTitleImage, setUploadingTitleImage] = useState(false);

  const previewUrl = useMemo(() => "/carrito", []);

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
      const safeConfig = buildSafeCartPageConfig(data?.cartPageConfig);

      setPage(data);
      setForm({
        name: typeof data?.name === "string" ? data.name : "Carrito",
        slug: typeof data?.slug === "string" ? data.slug : "carrito",
        pageType: "cart-page",
        enabled: data?.enabled !== false,
        useHeader: data?.useHeader !== false,
        useFooter: data?.useFooter !== false,
        cartPageConfig: safeConfig,
      });

      setTitleImagePreview(String(safeConfig?.titleImage || ""));
      setTitleImageFile(null);
    } catch (error) {
      console.error("Error cargando página carrito:", error);
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

  const updateCartConfig = (patch) => {
    setForm((prev) => ({
      ...prev,
      cartPageConfig: {
        ...(prev?.cartPageConfig || {}),
        ...patch,
      },
    }));
  };

  const updateStyleConfig = (patch) => {
    setForm((prev) => ({
      ...prev,
      cartPageConfig: {
        ...(prev?.cartPageConfig || {}),
        style: {
          ...buildSafeCartPageConfig(prev?.cartPageConfig)?.style,
          ...patch,
        },
      },
    }));
  };

  const updateModalConfig = (patch) => {
    setForm((prev) => ({
      ...prev,
      cartPageConfig: {
        ...(prev?.cartPageConfig || {}),
        modal: {
          ...buildSafeCartPageConfig(prev?.cartPageConfig)?.modal,
          ...patch,
        },
      },
    }));
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

      updateCartConfig({
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

  const handleSave = async () => {
    if (!form) return;

    try {
      setSaving(true);

      const payload = {
        name: "Carrito",
        slug: "carrito",
        pageType: "cart-page",
        enabled: form.enabled !== false,
        useHeader: form.useHeader !== false,
        useFooter: form.useFooter !== false,
        blocks: [],
        cartPageConfig: buildSafeCartPageConfig(form.cartPageConfig),
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

      const safeConfig = buildSafeCartPageConfig(data?.cartPageConfig);

      setPage(data);
      setForm({
        name: typeof data?.name === "string" ? data.name : "Carrito",
        slug: typeof data?.slug === "string" ? data.slug : "carrito",
        pageType: "cart-page",
        enabled: data?.enabled !== false,
        useHeader: data?.useHeader !== false,
        useFooter: data?.useFooter !== false,
        cartPageConfig: safeConfig,
      });

      setTitleImagePreview(String(safeConfig?.titleImage || ""));
      alert("Página carrito guardada correctamente ✅");
    } catch (error) {
      console.error("Error guardando página carrito:", error);
      alert(error.message || "No se pudo guardar la página carrito.");
    } finally {
      setSaving(false);
    }
  };

  const handleOpenPreview = () => {
    window.open(previewUrl, "_blank", "noopener,noreferrer");
  };

  if (loading) {
    return <div className="p-6 text-gray-500">Cargando página carrito...</div>;
  }

  if (notFound || !page || !form) {
    return <div className="p-6 text-red-500">Página carrito no encontrada</div>;
  }

  if (String(page?.pageType || "").toLowerCase() !== "cart-page") {
    return (
      <div className="space-y-4 p-6">
        <div className="text-red-500">Esta página no es de tipo carrito.</div>
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

  const style = form.cartPageConfig.style;
  const modal = form.cartPageConfig.modal;
  const buttonRadius =
    style.checkoutButtonStyle === "pill"
      ? 999
      : style.checkoutButtonStyle === "rounded"
      ? Math.min(style.checkoutButtonRadiusPx, 18)
      : 8;

  const modalShadowClass =
    modal.shadowStyle === "none"
      ? ""
      : modal.shadowStyle === "medium"
      ? "shadow-md"
      : modal.shadowStyle === "strong"
      ? "shadow-xl"
      : "shadow-sm";

  const previewPanelBg = hexToRgba(
    modal.panelBg,
    clampInt(modal.panelOpacity, 0, 100, 100) / 100
  );

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
              Editor de página carrito
            </h1>
            <p className="text-sm text-gray-500">
              Configura la página fija del carrito sin crearla ni eliminarla.
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
        text="Esta página siempre existe. Aquí solo modificas su contenido, visibilidad y estilos."
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
            text="Datos generales de la página fija carrito."
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
              checked={form.cartPageConfig.showWhatsAppButton}
              onChange={(value) => updateCartConfig({ showWhatsAppButton: value })}
            />
          </SectionCard>

          <SectionCard
            title="Encabezado visual"
            text="Elige si el título se muestra como imagen o como texto."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Select
                label="Modo de título"
                value={form.cartPageConfig.titleMode}
                onChange={(e) => updateCartConfig({ titleMode: e.target.value })}
              >
                {TITLE_MODE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>

              <Input
                label="Texto del título"
                value={form.cartPageConfig.titleText}
                onChange={(e) => updateCartConfig({ titleText: e.target.value })}
                placeholder="Tu carrito"
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <Input
                  label="URL imagen del título"
                  value={form.cartPageConfig.titleImage}
                  onChange={(e) => updateCartConfig({ titleImage: e.target.value })}
                  placeholder="https://..."
                />

                <Input
                  label="Alt imagen del título"
                  value={form.cartPageConfig.titleImageAlt}
                  onChange={(e) =>
                    updateCartConfig({ titleImageAlt: e.target.value })
                  }
                  placeholder="Título carrito"
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
                  {form.cartPageConfig.titleMode === "image" &&
                  (titleImagePreview || form.cartPageConfig.titleImage) ? (
                    <img
                      src={titleImagePreview || form.cartPageConfig.titleImage}
                      alt={form.cartPageConfig.titleImageAlt || "Vista previa"}
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
                      {form.cartPageConfig.titleText || "Tu carrito"}
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
            title="Visibilidad de bloques"
            text="Activa o desactiva los elementos de la página."
          >
            <div className="grid gap-3 md:grid-cols-2">
              <Toggle
                label="Mostrar breadcrumb"
                checked={form.cartPageConfig.showBreadcrumb}
                onChange={(value) => updateCartConfig({ showBreadcrumb: value })}
              />
              <Toggle
                label="Mostrar cabecera de tabla"
                checked={form.cartPageConfig.showTableHeader}
                onChange={(value) => updateCartConfig({ showTableHeader: value })}
              />
              <Toggle
                label="Mostrar botón eliminar"
                checked={form.cartPageConfig.showRemoveButton}
                onChange={(value) => updateCartConfig({ showRemoveButton: value })}
              />
              <Toggle
                label="Mostrar controles de cantidad"
                checked={form.cartPageConfig.showQuantityControls}
                onChange={(value) =>
                  updateCartConfig({ showQuantityControls: value })
                }
              />
              <Toggle
                label="Mostrar subtotal"
                checked={form.cartPageConfig.showSubtotal}
                onChange={(value) => updateCartConfig({ showSubtotal: value })}
              />
              <Toggle
                label="Mostrar mensaje de envío"
                checked={form.cartPageConfig.showShippingMessage}
                onChange={(value) =>
                  updateCartConfig({ showShippingMessage: value })
                }
              />
              <Toggle
                label="Mostrar botón checkout"
                checked={form.cartPageConfig.showCheckoutButton}
                onChange={(value) =>
                  updateCartConfig({ showCheckoutButton: value })
                }
              />
              <Toggle
                label="Mostrar estado vacío"
                checked={form.cartPageConfig.showEmptyState}
                onChange={(value) => updateCartConfig({ showEmptyState: value })}
              />
            </div>
          </SectionCard>

          <SectionCard
            title="Textos editables"
            text="Personaliza los textos internos del carrito."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Breadcrumb Home"
                value={form.cartPageConfig.breadcrumbHomeText}
                onChange={(e) =>
                  updateCartConfig({ breadcrumbHomeText: e.target.value })
                }
              />
              <Input
                label="Breadcrumb actual"
                value={form.cartPageConfig.breadcrumbCurrentText}
                onChange={(e) =>
                  updateCartConfig({ breadcrumbCurrentText: e.target.value })
                }
              />
              <Input
                label="Encabezado Producto"
                value={form.cartPageConfig.tableProductText}
                onChange={(e) =>
                  updateCartConfig({ tableProductText: e.target.value })
                }
              />
              <Input
                label="Encabezado Precio"
                value={form.cartPageConfig.tablePriceText}
                onChange={(e) =>
                  updateCartConfig({ tablePriceText: e.target.value })
                }
              />
              <Input
                label="Encabezado Cantidad"
                value={form.cartPageConfig.tableQuantityText}
                onChange={(e) =>
                  updateCartConfig({ tableQuantityText: e.target.value })
                }
              />
              <Input
                label="Encabezado Total"
                value={form.cartPageConfig.tableTotalText}
                onChange={(e) =>
                  updateCartConfig({ tableTotalText: e.target.value })
                }
              />
              <Input
                label="Texto eliminar"
                value={form.cartPageConfig.removeButtonText}
                onChange={(e) =>
                  updateCartConfig({ removeButtonText: e.target.value })
                }
              />
              <Input
                label="Etiqueta color"
                value={form.cartPageConfig.colorLabelText}
                onChange={(e) =>
                  updateCartConfig({ colorLabelText: e.target.value })
                }
              />
              <Input
                label="Etiqueta talla"
                value={form.cartPageConfig.sizeLabelText}
                onChange={(e) =>
                  updateCartConfig({ sizeLabelText: e.target.value })
                }
              />
              <Input
                label="Texto subtotal"
                value={form.cartPageConfig.subtotalLabelText}
                onChange={(e) =>
                  updateCartConfig({ subtotalLabelText: e.target.value })
                }
              />
              <Input
                label="Texto botón checkout"
                value={form.cartPageConfig.checkoutButtonText}
                onChange={(e) =>
                  updateCartConfig({ checkoutButtonText: e.target.value })
                }
              />
              <Input
                label="Título estado vacío"
                value={form.cartPageConfig.emptyStateTitle}
                onChange={(e) =>
                  updateCartConfig({ emptyStateTitle: e.target.value })
                }
              />
            </div>

            <Textarea
              label="Mensaje de envío"
              value={form.cartPageConfig.shippingMessageText}
              onChange={(e) =>
                updateCartConfig({ shippingMessageText: e.target.value })
              }
            />

            <Textarea
              label="Texto estado vacío"
              value={form.cartPageConfig.emptyStateText}
              onChange={(e) =>
                updateCartConfig({ emptyStateText: e.target.value })
              }
            />

            <Input
              label="Texto seguir comprando"
              value={form.cartPageConfig.continueShoppingText}
              onChange={(e) =>
                updateCartConfig({ continueShoppingText: e.target.value })
              }
            />
          </SectionCard>
        </div>
      )}

      {activeTab === "style" && (
        <div className="space-y-6">
          <SectionCard
            title="Estilo general"
            text="Colores, radios, sombras y dimensiones del carrito."
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
                    label="Fondo contenedor"
                    value={style.cardBg}
                    onChange={(e) => updateStyleConfig({ cardBg: e.target.value })}
                  />
                  <ColorInput
                    label="Color borde contenedor"
                    value={style.cardBorderColor}
                    onChange={(e) =>
                      updateStyleConfig({ cardBorderColor: e.target.value })
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
                    label="Color acento rosa"
                    value={style.accentColor}
                    onChange={(e) =>
                      updateStyleConfig({ accentColor: e.target.value })
                    }
                  />
                  <ColorInput
                    label="Color dorado"
                    value={style.goldColor}
                    onChange={(e) => updateStyleConfig({ goldColor: e.target.value })}
                  />
                  <ColorInput
                    label="Color links breadcrumb"
                    value={style.breadcrumbLinkColor}
                    onChange={(e) =>
                      updateStyleConfig({ breadcrumbLinkColor: e.target.value })
                    }
                  />
                  <ColorInput
                    label="Color breadcrumb actual"
                    value={style.breadcrumbTextColor}
                    onChange={(e) =>
                      updateStyleConfig({ breadcrumbTextColor: e.target.value })
                    }
                  />
                  <ColorInput
                    label="Color títulos tabla"
                    value={style.tableHeaderTextColor}
                    onChange={(e) =>
                      updateStyleConfig({ tableHeaderTextColor: e.target.value })
                    }
                  />
                  <ColorInput
                    label="Color líneas tabla"
                    value={style.tableLineColor}
                    onChange={(e) =>
                      updateStyleConfig({ tableLineColor: e.target.value })
                    }
                  />
                  <ColorInput
                    label="Color borde cantidad"
                    value={style.quantityBorderColor}
                    onChange={(e) =>
                      updateStyleConfig({ quantityBorderColor: e.target.value })
                    }
                  />
                  <ColorInput
                    label="Color texto cantidad"
                    value={style.quantityTextColor}
                    onChange={(e) =>
                      updateStyleConfig({ quantityTextColor: e.target.value })
                    }
                  />
                  <ColorInput
                    label="Fondo botón checkout"
                    value={style.checkoutButtonBg}
                    onChange={(e) =>
                      updateStyleConfig({ checkoutButtonBg: e.target.value })
                    }
                  />
                  <ColorInput
                    label="Texto botón checkout"
                    value={style.checkoutButtonTextColor}
                    onChange={(e) =>
                      updateStyleConfig({
                        checkoutButtonTextColor: e.target.value,
                      })
                    }
                  />
                  <ColorInput
                    label="Texto subtotal"
                    value={style.subtotalTextColor}
                    onChange={(e) =>
                      updateStyleConfig({ subtotalTextColor: e.target.value })
                    }
                  />
                  <ColorInput
                    label="Valor subtotal"
                    value={style.subtotalValueColor}
                    onChange={(e) =>
                      updateStyleConfig({ subtotalValueColor: e.target.value })
                    }
                  />
                  <ColorInput
                    label="Color texto título"
                    value={style.titleTextColor}
                    onChange={(e) =>
                      updateStyleConfig({ titleTextColor: e.target.value })
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
                        contentMaxWidthPx: clampInt(e.target.value, 900, 1800, 1152),
                      })
                    }
                  />

                  <Input
                    label="Separación superior (px)"
                    type="number"
                    min="0"
                    max="240"
                    value={style.contentTopPaddingPx}
                    onChange={(e) =>
                      updateStyleConfig({
                        contentTopPaddingPx: clampInt(e.target.value, 0, 240, 100),
                      })
                    }
                  />

                  <Input
                    label="Radio contenedor (px)"
                    type="number"
                    min="0"
                    max="40"
                    value={style.cardRadiusPx}
                    onChange={(e) =>
                      updateStyleConfig({
                        cardRadiusPx: clampInt(e.target.value, 0, 40, 16),
                      })
                    }
                  />

                  <Input
                    label="Padding contenedor (px)"
                    type="number"
                    min="8"
                    max="48"
                    value={style.cardPaddingPx}
                    onChange={(e) =>
                      updateStyleConfig({
                        cardPaddingPx: clampInt(e.target.value, 8, 48, 24),
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
                        titleFontSizePx: clampInt(e.target.value, 18, 72, 34),
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
                        titleImageHeightPx: clampInt(e.target.value, 24, 220, 80),
                      })
                    }
                  />

                  <Input
                    label="Radio cantidad (px)"
                    type="number"
                    min="0"
                    max="30"
                    value={style.quantityRadiusPx}
                    onChange={(e) =>
                      updateStyleConfig({
                        quantityRadiusPx: clampInt(e.target.value, 0, 30, 8),
                      })
                    }
                  />

                  <Input
                    label="Radio botón checkout (px)"
                    type="number"
                    min="0"
                    max="40"
                    value={style.checkoutButtonRadiusPx}
                    onChange={(e) =>
                      updateStyleConfig({
                        checkoutButtonRadiusPx: clampInt(e.target.value, 0, 40, 999),
                      })
                    }
                  />

                  <Input
                    label="Radio imagen producto (px)"
                    type="number"
                    min="0"
                    max="30"
                    value={style.imageRadiusPx}
                    onChange={(e) =>
                      updateStyleConfig({
                        imageRadiusPx: clampInt(e.target.value, 0, 30, 12),
                      })
                    }
                  />

                  <Input
                    label="Ancho imagen producto (px)"
                    type="number"
                    min="40"
                    max="220"
                    value={style.imageWidthPx}
                    onChange={(e) =>
                      updateStyleConfig({
                        imageWidthPx: clampInt(e.target.value, 40, 220, 80),
                      })
                    }
                  />

                  <Input
                    label="Alto imagen producto (px)"
                    type="number"
                    min="40"
                    max="220"
                    value={style.imageHeightPx}
                    onChange={(e) =>
                      updateStyleConfig({
                        imageHeightPx: clampInt(e.target.value, 40, 220, 80),
                      })
                    }
                  />

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

                  <Select
                    label="Forma botón checkout"
                    value={style.checkoutButtonStyle}
                    onChange={(e) =>
                      updateStyleConfig({ checkoutButtonStyle: e.target.value })
                    }
                  >
                    {BUTTON_STYLE_OPTIONS.map((option) => (
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
            text="Vista guía aproximada de colores y estilos del carrito."
          >
            <div
              className="rounded-3xl border p-5"
              style={{
                backgroundColor: style.pageBg,
                borderColor: style.cardBorderColor,
              }}
            >
              <div
                className={[
                  "mx-auto overflow-hidden border",
                  style.shadowStyle === "none"
                    ? ""
                    : style.shadowStyle === "medium"
                    ? "shadow-md"
                    : style.shadowStyle === "strong"
                    ? "shadow-xl"
                    : "shadow-sm",
                ].join(" ")}
                style={{
                  maxWidth: `${style.contentMaxWidthPx}px`,
                  backgroundColor: style.cardBg,
                  borderColor: style.cardBorderColor,
                  borderRadius: `${style.cardRadiusPx}px`,
                  padding: `${style.cardPaddingPx}px`,
                }}
              >
                <div
                  className="mb-4 text-sm"
                  style={{ color: style.breadcrumbTextColor }}
                >
                  <span style={{ color: style.breadcrumbLinkColor }}>
                    {form.cartPageConfig.breadcrumbHomeText}
                  </span>
                  <span className="mx-2">›</span>
                  <span>{form.cartPageConfig.breadcrumbCurrentText}</span>
                </div>

                <div className="mb-6 text-center">
                  {form.cartPageConfig.titleMode === "image" &&
                  (titleImagePreview || form.cartPageConfig.titleImage) ? (
                    <img
                      src={titleImagePreview || form.cartPageConfig.titleImage}
                      alt={form.cartPageConfig.titleImageAlt || "Título"}
                      className="mx-auto object-contain"
                      style={{ height: `${style.titleImageHeightPx}px` }}
                    />
                  ) : (
                    <div
                      className="font-semibold"
                      style={{
                        color: style.titleTextColor,
                        fontSize: `${style.titleFontSizePx}px`,
                      }}
                    >
                      {form.cartPageConfig.titleText}
                    </div>
                  )}
                </div>

                <div className="overflow-hidden rounded-2xl border" style={{ borderColor: style.cardBorderColor }}>
                  <div
                    className="grid grid-cols-4 px-4 py-3 text-sm font-bold"
                    style={{
                      color: style.tableHeaderTextColor,
                      borderBottom: `1px solid ${style.tableLineColor}`,
                    }}
                  >
                    <div>{form.cartPageConfig.tableProductText}</div>
                    <div>{form.cartPageConfig.tablePriceText}</div>
                    <div>{form.cartPageConfig.tableQuantityText}</div>
                    <div>{form.cartPageConfig.tableTotalText}</div>
                  </div>

                  <div className="grid grid-cols-4 items-center px-4 py-4 text-sm">
                    <div className="flex items-center gap-3">
                      <div
                        style={{
                          width: `${style.imageWidthPx}px`,
                          height: `${style.imageHeightPx}px`,
                          borderRadius: `${style.imageRadiusPx}px`,
                          backgroundColor: "#f3f4f6",
                        }}
                      />
                      <div style={{ color: style.textPrimaryColor }}>
                        Vestido ejemplo
                      </div>
                    </div>

                    <div style={{ color: style.accentColor }}>$120.000</div>

                    <div>
                      <div
                        className="inline-grid grid-cols-3 overflow-hidden border"
                        style={{
                          borderColor: style.quantityBorderColor,
                          borderRadius: `${style.quantityRadiusPx}px`,
                          color: style.quantityTextColor,
                        }}
                      >
                        <span className="px-3 py-1">-</span>
                        <span className="px-3 py-1 text-center">1</span>
                        <span className="px-3 py-1">+</span>
                      </div>
                    </div>

                    <div style={{ color: style.accentColor }}>$120.000</div>
                  </div>
                </div>

                <div className="mt-6 text-right">
                  <div
                    className="text-xl font-bold"
                    style={{ color: style.subtotalTextColor }}
                  >
                    {form.cartPageConfig.subtotalLabelText}{" "}
                    <span style={{ color: style.subtotalValueColor }}>
                      $120.000
                    </span>
                  </div>

                  <div className="mt-2 text-sm" style={{ color: style.textSecondaryColor }}>
                    {form.cartPageConfig.shippingMessageText}
                  </div>

                  <button
                    type="button"
                    className="mt-4 px-6 py-2 font-bold"
                    style={{
                      backgroundColor: style.checkoutButtonBg,
                      color: style.checkoutButtonTextColor,
                      borderRadius: `${buttonRadius}px`,
                    }}
                  >
                    {form.cartPageConfig.checkoutButtonText}
                  </button>
                </div>
              </div>
            </div>
          </SectionCard>
        </div>
      )}

      {activeTab === "modal" && (
        <div className="space-y-6">
          <SectionCard
            title="Fondo del modal"
            text="Controla el overlay oscuro detrás del carrito lateral."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <ColorInput
                label="Color del fondo"
                value={modal.backdropColor}
                onChange={(e) => updateModalConfig({ backdropColor: e.target.value })}
              />

              <Input
                label="Transparencia del fondo (%)"
                type="number"
                min="0"
                max="100"
                value={modal.backdropOpacity}
                onChange={(e) =>
                  updateModalConfig({
                    backdropOpacity: clampInt(e.target.value, 0, 100, 50),
                  })
                }
              />
            </div>
          </SectionCard>

          <SectionCard
            title="Panel lateral"
            text="Configura el contenedor principal del modal carrito."
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <ColorInput
                label="Fondo del panel"
                value={modal.panelBg}
                onChange={(e) => updateModalConfig({ panelBg: e.target.value })}
              />

              <Input
                label="Transparencia del panel (%)"
                type="number"
                min="0"
                max="100"
                value={modal.panelOpacity}
                onChange={(e) =>
                  updateModalConfig({
                    panelOpacity: clampInt(e.target.value, 0, 100, 100),
                  })
                }
              />

              <ColorInput
                label="Color texto general"
                value={modal.textColor}
                onChange={(e) => updateModalConfig({ textColor: e.target.value })}
              />

              <ColorInput
                label="Color ícono cerrar"
                value={modal.closeIconColor}
                onChange={(e) =>
                  updateModalConfig({ closeIconColor: e.target.value })
                }
              />

              <Input
                label="Ancho del panel (px)"
                type="number"
                min="280"
                max="600"
                value={modal.widthPx}
                onChange={(e) =>
                  updateModalConfig({
                    widthPx: clampInt(e.target.value, 280, 600, 400),
                  })
                }
              />

              <Input
                label="Padding panel (px)"
                type="number"
                min="8"
                max="40"
                value={modal.panelPaddingPx}
                onChange={(e) =>
                  updateModalConfig({
                    panelPaddingPx: clampInt(e.target.value, 8, 40, 16),
                  })
                }
              />

              <Input
                label="Padding footer (px)"
                type="number"
                min="8"
                max="40"
                value={modal.footerPaddingPx}
                onChange={(e) =>
                  updateModalConfig({
                    footerPaddingPx: clampInt(e.target.value, 8, 40, 16),
                  })
                }
              />

              <Input
                label="Radio items (px)"
                type="number"
                min="0"
                max="30"
                value={modal.itemRadiusPx}
                onChange={(e) =>
                  updateModalConfig({
                    itemRadiusPx: clampInt(e.target.value, 0, 30, 8),
                  })
                }
              />

              <Input
                label="Radio botones (px)"
                type="number"
                min="0"
                max="40"
                value={modal.buttonRadiusPx}
                onChange={(e) =>
                  updateModalConfig({
                    buttonRadiusPx: clampInt(e.target.value, 0, 40, 8),
                  })
                }
              />

              <Input
                label="Radio del modal (px)"
                type="number"
                min="0"
                max="40"
                value={modal.panelRadiusPx}
                onChange={(e) =>
                  updateModalConfig({
                    panelRadiusPx: clampInt(e.target.value, 0, 40, 0),
                  })
                }
              />

              <Select
                label="Sombra del panel"
                value={modal.shadowStyle}
                onChange={(e) => updateModalConfig({ shadowStyle: e.target.value })}
              >
                {SHADOW_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
          </SectionCard>

          <SectionCard
            title="Elementos internos"
            text="Colores de subtotal, botones, links y estado vacío."
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <ColorInput
                label="Texto estado vacío"
                value={modal.emptyTextColor}
                onChange={(e) =>
                  updateModalConfig({ emptyTextColor: e.target.value })
                }
              />

              <ColorInput
                label="Color label subtotal"
                value={modal.subtotalLabelColor}
                onChange={(e) =>
                  updateModalConfig({ subtotalLabelColor: e.target.value })
                }
              />

              <ColorInput
                label="Color valor subtotal"
                value={modal.subtotalValueColor}
                onChange={(e) =>
                  updateModalConfig({ subtotalValueColor: e.target.value })
                }
              />

              <ColorInput
                label="Fondo botón checkout"
                value={modal.checkoutBg}
                onChange={(e) => updateModalConfig({ checkoutBg: e.target.value })}
              />

              <ColorInput
                label="Texto botón checkout"
                value={modal.checkoutText}
                onChange={(e) =>
                  updateModalConfig({ checkoutText: e.target.value })
                }
              />

              <ColorInput
                label="Color link Ver carrito"
                value={modal.linkColor}
                onChange={(e) => updateModalConfig({ linkColor: e.target.value })}
              />

              <ColorInput
                label="Fondo botones cantidad"
                value={modal.quantityButtonBg}
                onChange={(e) =>
                  updateModalConfig({ quantityButtonBg: e.target.value })
                }
              />

              <ColorInput
                label="Texto botones cantidad"
                value={modal.quantityButtonTextColor}
                onChange={(e) =>
                  updateModalConfig({ quantityButtonTextColor: e.target.value })
                }
              />

              <ColorInput
                label="Color link eliminar"
                value={modal.removeLinkColor}
                onChange={(e) =>
                  updateModalConfig({ removeLinkColor: e.target.value })
                }
              />
            </div>
          </SectionCard>

          <SectionCard
            title="Imágenes y tamaños"
            text="Ajusta las dimensiones visuales del modal."
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Input
                label="Ancho imagen título (px)"
                type="number"
                min="80"
                max="260"
                value={modal.titleImageWidthPx}
                onChange={(e) =>
                  updateModalConfig({
                    titleImageWidthPx: clampInt(e.target.value, 80, 260, 160),
                  })
                }
              />

              <Input
                label="Alto imagen título (px)"
                type="number"
                min="40"
                max="180"
                value={modal.titleImageHeightPx}
                onChange={(e) =>
                  updateModalConfig({
                    titleImageHeightPx: clampInt(e.target.value, 40, 180, 80),
                  })
                }
              />

              <Input
                label="Ancho imagen producto (px)"
                type="number"
                min="40"
                max="180"
                value={modal.productImageWidthPx}
                onChange={(e) =>
                  updateModalConfig({
                    productImageWidthPx: clampInt(e.target.value, 40, 180, 80),
                  })
                }
              />

              <Input
                label="Alto imagen producto (px)"
                type="number"
                min="60"
                max="220"
                value={modal.productImageHeightPx}
                onChange={(e) =>
                  updateModalConfig({
                    productImageHeightPx: clampInt(e.target.value, 60, 220, 112),
                  })
                }
              />
            </div>
          </SectionCard>

          <SectionCard
            title="Vista previa rápida del modal"
            text="Vista guía aproximada del carrito lateral."
          >
            <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4">
              <div className="relative mx-auto h-[620px] max-w-[520px] overflow-hidden rounded-3xl border border-gray-300 bg-white">
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundColor: modal.backdropColor,
                    opacity: modal.backdropOpacity / 100,
                  }}
                />

                <div
                  className={`absolute right-0 top-0 flex h-full flex-col ${modalShadowClass}`}
                  style={{
                    width: `${modal.widthPx}px`,
                    maxWidth: "100%",
                    backgroundColor: previewPanelBg,
                    color: modal.textColor,
                    borderTopLeftRadius: `${modal.panelRadiusPx}px`,
                    borderBottomLeftRadius: `${modal.panelRadiusPx}px`,
                  }}
                >
                  <div
                    className="relative"
                    style={{ padding: `${modal.panelPaddingPx}px` }}
                  >
                    <button
                      type="button"
                      className="absolute right-4 top-4 text-sm font-bold"
                      style={{ color: modal.closeIconColor }}
                    >
                      ✕
                    </button>

                    <div className="flex flex-col items-center pt-6">
                      <div
                        className="rounded-lg bg-white/30 object-contain"
                        style={{
                          width: `${modal.titleImageWidthPx}px`,
                          height: `${modal.titleImageHeightPx}px`,
                        }}
                      />
                    </div>
                  </div>

                  <div
                    className="flex-1 space-y-4 overflow-hidden"
                    style={{ padding: `${modal.panelPaddingPx}px` }}
                  >
                    <div
                      className="rounded-lg"
                      style={{ borderRadius: `${modal.itemRadiusPx}px` }}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="shrink-0 rounded bg-white/40"
                          style={{
                            width: `${modal.productImageWidthPx}px`,
                            height: `${modal.productImageHeightPx}px`,
                          }}
                        />

                        <div className="flex-1">
                          <h3 className="font-semibold">Producto ejemplo</h3>
                          <p className="text-sm">Color: Rosa</p>
                          <p className="text-sm">Talla: 8</p>
                          <p className="text-sm">Precio: $120.000</p>

                          <div className="mt-2 flex items-center gap-2">
                            <button
                              type="button"
                              className="flex items-center justify-center"
                              style={{
                                width: 24,
                                height: 24,
                                borderRadius: `${modal.buttonRadiusPx}px`,
                                backgroundColor: modal.quantityButtonBg,
                                color: modal.quantityButtonTextColor,
                              }}
                            >
                              -
                            </button>

                            <span className="text-sm">1</span>

                            <button
                              type="button"
                              className="flex items-center justify-center"
                              style={{
                                width: 24,
                                height: 24,
                                borderRadius: `${modal.buttonRadiusPx}px`,
                                backgroundColor: modal.quantityButtonBg,
                                color: modal.quantityButtonTextColor,
                              }}
                            >
                              +
                            </button>

                            <button
                              type="button"
                              className="ml-2 text-sm underline"
                              style={{ color: modal.removeLinkColor }}
                            >
                              Eliminar
                            </button>
                          </div>

                          <p className="mt-1 text-sm">Total: $120.000</p>
                        </div>
                      </div>
                    </div>

                    <p
                      className="text-sm"
                      style={{ color: modal.emptyTextColor }}
                    >
                      El carrito está vacío.
                    </p>
                  </div>

                  <div
                    className="space-y-3"
                    style={{
                      padding: `${modal.footerPaddingPx}px`,
                      backgroundColor: previewPanelBg,
                    }}
                  >
                    <div className="flex justify-between text-base font-semibold">
                      <span style={{ color: modal.subtotalLabelColor }}>Subtotal:</span>
                      <span style={{ color: modal.subtotalValueColor }}>$0</span>
                    </div>

                    <button
                      type="button"
                      className="w-full py-2 font-semibold transition"
                      style={{
                        backgroundColor: modal.checkoutBg,
                        color: modal.checkoutText,
                        borderRadius: `${modal.buttonRadiusPx}px`,
                      }}
                    >
                      Check-out
                    </button>

                    <div
                      className="text-center text-sm underline"
                      style={{ color: modal.linkColor }}
                    >
                      Ver carrito
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
