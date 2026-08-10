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

const INPUT_STYLE_OPTIONS = [
  { value: "rounded", label: "Redondeado" },
  { value: "pill", label: "Píldora" },
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

function buildSafeCheckoutPageConfig(raw) {
  const cfg = raw && typeof raw === "object" ? raw : {};
  return {
    titleMode:
      cfg.titleMode === "text" || cfg.titleMode === "image" ? cfg.titleMode : "text",
    titleText:
      typeof cfg.titleText === "string" && cfg.titleText.trim()
        ? cfg.titleText
        : "Checkout",
    titleImage: typeof cfg.titleImage === "string" ? cfg.titleImage : "",
    titleImageAlt:
      typeof cfg.titleImageAlt === "string" && cfg.titleImageAlt.trim()
        ? cfg.titleImageAlt
        : "Título checkout",

    showHeader: cfg.showHeader !== false,
    showFooter: cfg.showFooter !== false,
    showWhatsAppButton: cfg.showWhatsAppButton !== false,
    showBreadcrumb: cfg.showBreadcrumb !== false,
    showContactSection: cfg.showContactSection !== false,
    showDeliverySection: cfg.showDeliverySection !== false,
    showBillingSection: cfg.showBillingSection !== false,
    showOrderSummary: cfg.showOrderSummary !== false,
    showPaymentMethodsImage: cfg.showPaymentMethodsImage !== false,
    showNewsletterCheckbox: cfg.showNewsletterCheckbox !== false,
    showPoliciesText: cfg.showPoliciesText !== false,
    showConfirmButton: cfg.showConfirmButton !== false,

    breadcrumbHomeText:
      typeof cfg.breadcrumbHomeText === "string" && cfg.breadcrumbHomeText.trim()
        ? cfg.breadcrumbHomeText
        : "Home",
    breadcrumbCurrentText:
      typeof cfg.breadcrumbCurrentText === "string" && cfg.breadcrumbCurrentText.trim()
        ? cfg.breadcrumbCurrentText
        : "Checkout",

    contactSectionTitle:
      typeof cfg.contactSectionTitle === "string" && cfg.contactSectionTitle.trim()
        ? cfg.contactSectionTitle
        : "Información de contacto",
    deliverySectionTitle:
      typeof cfg.deliverySectionTitle === "string" && cfg.deliverySectionTitle.trim()
        ? cfg.deliverySectionTitle
        : "Dirección de entrega",
    billingSectionTitle:
      typeof cfg.billingSectionTitle === "string" && cfg.billingSectionTitle.trim()
        ? cfg.billingSectionTitle
        : "Facturación",
    orderSummaryTitle:
      typeof cfg.orderSummaryTitle === "string" && cfg.orderSummaryTitle.trim()
        ? cfg.orderSummaryTitle
        : "Resumen de tu compra",

    emailLabelText:
      typeof cfg.emailLabelText === "string" && cfg.emailLabelText.trim()
        ? cfg.emailLabelText
        : "Correo electrónico",
    phoneLabelText:
      typeof cfg.phoneLabelText === "string" && cfg.phoneLabelText.trim()
        ? cfg.phoneLabelText
        : "Teléfono",
    documentLabelText:
      typeof cfg.documentLabelText === "string" && cfg.documentLabelText.trim()
        ? cfg.documentLabelText
        : "Cédula",
    nameLabelText:
      typeof cfg.nameLabelText === "string" && cfg.nameLabelText.trim()
        ? cfg.nameLabelText
        : "Nombre completo",
    cityLabelText:
      typeof cfg.cityLabelText === "string" && cfg.cityLabelText.trim()
        ? cfg.cityLabelText
        : "Ciudad",
    addressLabelText:
      typeof cfg.addressLabelText === "string" && cfg.addressLabelText.trim()
        ? cfg.addressLabelText
        : "Dirección",
    neighborhoodLabelText:
      typeof cfg.neighborhoodLabelText === "string" && cfg.neighborhoodLabelText.trim()
        ? cfg.neighborhoodLabelText
        : "Barrio",
    notesLabelText:
      typeof cfg.notesLabelText === "string" && cfg.notesLabelText.trim()
        ? cfg.notesLabelText
        : "Información adicional",
    billingToggleText:
      typeof cfg.billingToggleText === "string" && cfg.billingToggleText.trim()
        ? cfg.billingToggleText
        : "Mi información de facturación es diferente",
    newsletterText:
      typeof cfg.newsletterText === "string" && cfg.newsletterText.trim()
        ? cfg.newsletterText
        : "Quiero recibir novedades por correo electrónico",
    policiesText:
      typeof cfg.policiesText === "string" && cfg.policiesText.trim()
        ? cfg.policiesText
        : "Al confirmar tu orden, aceptas nuestras políticas y términos de servicio.",
    subtotalLabelText:
      typeof cfg.subtotalLabelText === "string" && cfg.subtotalLabelText.trim()
        ? cfg.subtotalLabelText
        : "Subtotal:",
    totalLabelText:
      typeof cfg.totalLabelText === "string" && cfg.totalLabelText.trim()
        ? cfg.totalLabelText
        : "Total:",
    shippingMessageText:
      typeof cfg.shippingMessageText === "string" && cfg.shippingMessageText.trim()
        ? cfg.shippingMessageText
        : "Impuestos y envío calculado al finalizar la compra",
    confirmButtonText:
      typeof cfg.confirmButtonText === "string" && cfg.confirmButtonText.trim()
        ? cfg.confirmButtonText
        : "Confirmar pedido",
    paymentMethodsImage:
      typeof cfg.paymentMethodsImage === "string" ? cfg.paymentMethodsImage : "",
    paymentMethodsImageAlt:
      typeof cfg.paymentMethodsImageAlt === "string" && cfg.paymentMethodsImageAlt.trim()
        ? cfg.paymentMethodsImageAlt
        : "Métodos de pago",

    style: {
      pageBg: typeof cfg?.style?.pageBg === "string" ? cfg.style.pageBg : "#fdf2f8",
      contentMaxWidthPx: clampInt(cfg?.style?.contentMaxWidthPx, 900, 1800, 1280),
      contentTopPaddingPx: clampInt(cfg?.style?.contentTopPaddingPx, 0, 240, 90),

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
      titleImageHeightPx: clampInt(cfg?.style?.titleImageHeightPx, 24, 220, 70),

      sectionCardBg:
        typeof cfg?.style?.sectionCardBg === "string"
          ? cfg.style.sectionCardBg
          : "#ffffff",
      sectionCardBorderColor:
        typeof cfg?.style?.sectionCardBorderColor === "string"
          ? cfg.style.sectionCardBorderColor
          : "#f3c4d8",
      sectionCardRadiusPx: clampInt(cfg?.style?.sectionCardRadiusPx, 0, 40, 18),
      sectionCardPaddingPx: clampInt(cfg?.style?.sectionCardPaddingPx, 8, 48, 24),

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

      inputBg:
        typeof cfg?.style?.inputBg === "string" ? cfg.style.inputBg : "#ffffff",
      inputBorderColor:
        typeof cfg?.style?.inputBorderColor === "string"
          ? cfg.style.inputBorderColor
          : "#e5e7eb",
      inputTextColor:
        typeof cfg?.style?.inputTextColor === "string"
          ? cfg.style.inputTextColor
          : "#111827",
      inputPlaceholderColor:
        typeof cfg?.style?.inputPlaceholderColor === "string"
          ? cfg.style.inputPlaceholderColor
          : "#9ca3af",
      inputRadiusPx: clampInt(cfg?.style?.inputRadiusPx, 0, 40, 14),
      inputHeightPx: clampInt(cfg?.style?.inputHeightPx, 36, 80, 46),
      inputStyle:
        cfg?.style?.inputStyle === "rounded" ||
        cfg?.style?.inputStyle === "pill" ||
        cfg?.style?.inputStyle === "square"
          ? cfg.style.inputStyle
          : "rounded",

      labelTextColor:
        typeof cfg?.style?.labelTextColor === "string"
          ? cfg.style.labelTextColor
          : "#374151",

      summaryBg:
        typeof cfg?.style?.summaryBg === "string"
          ? cfg.style.summaryBg
          : "#fff7fb",
      summaryBorderColor:
        typeof cfg?.style?.summaryBorderColor === "string"
          ? cfg.style.summaryBorderColor
          : "#f3c4d8",
      summaryRadiusPx: clampInt(cfg?.style?.summaryRadiusPx, 0, 40, 18),

      subtotalTextColor:
        typeof cfg?.style?.subtotalTextColor === "string"
          ? cfg.style.subtotalTextColor
          : "#111827",
      subtotalValueColor:
        typeof cfg?.style?.subtotalValueColor === "string"
          ? cfg.style.subtotalValueColor
          : "#ec4899",
      totalTextColor:
        typeof cfg?.style?.totalTextColor === "string"
          ? cfg.style.totalTextColor
          : "#111827",
      totalValueColor:
        typeof cfg?.style?.totalValueColor === "string"
          ? cfg.style.totalValueColor
          : "#db2777",

      confirmButtonBg:
        typeof cfg?.style?.confirmButtonBg === "string"
          ? cfg.style.confirmButtonBg
          : "#ec4899",
      confirmButtonTextColor:
        typeof cfg?.style?.confirmButtonTextColor === "string"
          ? cfg.style.confirmButtonTextColor
          : "#ffffff",
      confirmButtonRadiusPx: clampInt(cfg?.style?.confirmButtonRadiusPx, 0, 40, 999),
      confirmButtonStyle:
        cfg?.style?.confirmButtonStyle === "pill" ||
        cfg?.style?.confirmButtonStyle === "rounded" ||
        cfg?.style?.confirmButtonStyle === "square"
          ? cfg.style.confirmButtonStyle
          : "pill",

      paymentMethodsImageHeightPx: clampInt(
        cfg?.style?.paymentMethodsImageHeightPx,
        24,
        140,
        44
      ),
    },
  };
}

export default function CheckoutPageEditor() {
  const navigate = useNavigate();
  const { id } = useParams();
  const titleImageInputRef = useRef(null);
  const paymentMethodsImageInputRef = useRef(null);

  const [page, setPage] = useState(null);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("general");

  const [titleImageFile, setTitleImageFile] = useState(null);
  const [titleImagePreview, setTitleImagePreview] = useState("");
  const [uploadingTitleImage, setUploadingTitleImage] = useState(false);

  const [paymentMethodsImageFile, setPaymentMethodsImageFile] = useState(null);
  const [paymentMethodsImagePreview, setPaymentMethodsImagePreview] = useState("");
  const [uploadingPaymentMethodsImage, setUploadingPaymentMethodsImage] = useState(false);

  const previewUrl = useMemo(() => "/checkout", []);

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
      const safeConfig = buildSafeCheckoutPageConfig(data?.checkoutPageConfig);

      setPage(data);
      setForm({
        name: typeof data?.name === "string" ? data.name : "Checkout",
        slug: typeof data?.slug === "string" ? data.slug : "checkout",
        pageType: "checkout-page",
        enabled: data?.enabled !== false,
        useHeader: data?.useHeader !== false,
        useFooter: data?.useFooter !== false,
        checkoutPageConfig: safeConfig,
      });

      setTitleImagePreview(String(safeConfig?.titleImage || ""));
      setTitleImageFile(null);

      setPaymentMethodsImagePreview(String(safeConfig?.paymentMethodsImage || ""));
      setPaymentMethodsImageFile(null);
    } catch (error) {
      console.error("Error cargando página checkout:", error);
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

  const updateCheckoutConfig = (patch) => {
    setForm((prev) => ({
      ...prev,
      checkoutPageConfig: {
        ...(prev?.checkoutPageConfig || {}),
        ...patch,
      },
    }));
  };

  const updateStyleConfig = (patch) => {
    setForm((prev) => ({
      ...prev,
      checkoutPageConfig: {
        ...(prev?.checkoutPageConfig || {}),
        style: {
          ...buildSafeCheckoutPageConfig(prev?.checkoutPageConfig)?.style,
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

      updateCheckoutConfig({
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

  const handlePickPaymentMethodsImage = () => {
    paymentMethodsImageInputRef.current?.click();
  };

  const handlePaymentMethodsImageSelected = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setPaymentMethodsImageFile(file);
    setPaymentMethodsImagePreview(URL.createObjectURL(file));
  };

  const handleUploadPaymentMethodsImage = async () => {
    if (!paymentMethodsImageFile) {
      alert("Primero selecciona una imagen.");
      return;
    }

    try {
      setUploadingPaymentMethodsImage(true);

      const body = new FormData();
      body.append("file", paymentMethodsImageFile);

      const res = await fetch(`${API_BASE}/api/uploads`, {
        method: "POST",
        body,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.url) {
        throw new Error(data?.error || "No se pudo subir la imagen.");
      }

      updateCheckoutConfig({
        paymentMethodsImage: data.url,
      });

      setPaymentMethodsImagePreview(data.url);
      setPaymentMethodsImageFile(null);

      if (paymentMethodsImageInputRef.current) {
        paymentMethodsImageInputRef.current.value = "";
      }

      alert("Imagen subida correctamente ✅");
    } catch (error) {
      console.error("Error subiendo imagen de métodos de pago:", error);
      alert(error.message || "No se pudo subir la imagen a Cloudinary.");
    } finally {
      setUploadingPaymentMethodsImage(false);
    }
  };

  const handleSave = async () => {
    if (!form) return;

    try {
      setSaving(true);

      const payload = {
        name: "Checkout",
        slug: "checkout",
        pageType: "checkout-page",
        enabled: form.enabled !== false,
        useHeader: form.useHeader !== false,
        useFooter: form.useFooter !== false,
        blocks: [],
        checkoutPageConfig: buildSafeCheckoutPageConfig(form.checkoutPageConfig),
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

      const safeConfig = buildSafeCheckoutPageConfig(data?.checkoutPageConfig);

      setPage(data);
      setForm({
        name: typeof data?.name === "string" ? data.name : "Checkout",
        slug: typeof data?.slug === "string" ? data.slug : "checkout",
        pageType: "checkout-page",
        enabled: data?.enabled !== false,
        useHeader: data?.useHeader !== false,
        useFooter: data?.useFooter !== false,
        checkoutPageConfig: safeConfig,
      });

      setTitleImagePreview(String(safeConfig?.titleImage || ""));
      setPaymentMethodsImagePreview(String(safeConfig?.paymentMethodsImage || ""));
      alert("Página checkout guardada correctamente ✅");
    } catch (error) {
      console.error("Error guardando página checkout:", error);
      alert(error.message || "No se pudo guardar la página checkout.");
    } finally {
      setSaving(false);
    }
  };

  const handleOpenPreview = () => {
    window.open(previewUrl, "_blank", "noopener,noreferrer");
  };

  if (loading) {
    return <div className="p-6 text-gray-500">Cargando página checkout...</div>;
  }

  if (notFound || !page || !form) {
    return <div className="p-6 text-red-500">Página checkout no encontrada</div>;
  }

  if (String(page?.pageType || "").toLowerCase() !== "checkout-page") {
    return (
      <div className="space-y-4 p-6">
        <div className="text-red-500">Esta página no es de tipo checkout.</div>
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

  const style = form.checkoutPageConfig.style;
  const buttonRadius =
    style.confirmButtonStyle === "pill"
      ? 999
      : style.confirmButtonStyle === "rounded"
      ? Math.min(style.confirmButtonRadiusPx, 18)
      : 8;

  const inputRadius =
    style.inputStyle === "pill"
      ? 999
      : style.inputStyle === "rounded"
      ? Math.min(style.inputRadiusPx, 18)
      : 8;

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
              Editor de página checkout
            </h1>
            <p className="text-sm text-gray-500">
              Configura la página fija del checkout sin crearla ni eliminarla.
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
            text="Datos generales de la página fija checkout."
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
              checked={form.checkoutPageConfig.showWhatsAppButton}
              onChange={(value) =>
                updateCheckoutConfig({ showWhatsAppButton: value })
              }
            />
          </SectionCard>

          <SectionCard
            title="Encabezado visual"
            text="Elige si el título se muestra como imagen o como texto."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Select
                label="Modo de título"
                value={form.checkoutPageConfig.titleMode}
                onChange={(e) =>
                  updateCheckoutConfig({ titleMode: e.target.value })
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
                value={form.checkoutPageConfig.titleText}
                onChange={(e) =>
                  updateCheckoutConfig({ titleText: e.target.value })
                }
                placeholder="Checkout"
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <Input
                  label="URL imagen del título"
                  value={form.checkoutPageConfig.titleImage}
                  onChange={(e) =>
                    updateCheckoutConfig({ titleImage: e.target.value })
                  }
                  placeholder="https://..."
                />

                <Input
                  label="Alt imagen del título"
                  value={form.checkoutPageConfig.titleImageAlt}
                  onChange={(e) =>
                    updateCheckoutConfig({ titleImageAlt: e.target.value })
                  }
                  placeholder="Título checkout"
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
                  {form.checkoutPageConfig.titleMode === "image" &&
                  (titleImagePreview || form.checkoutPageConfig.titleImage) ? (
                    <img
                      src={titleImagePreview || form.checkoutPageConfig.titleImage}
                      alt={form.checkoutPageConfig.titleImageAlt || "Vista previa"}
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
                      {form.checkoutPageConfig.titleText || "Checkout"}
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
                checked={form.checkoutPageConfig.showBreadcrumb}
                onChange={(value) =>
                  updateCheckoutConfig({ showBreadcrumb: value })
                }
              />
              <Toggle
                label="Mostrar sección contacto"
                checked={form.checkoutPageConfig.showContactSection}
                onChange={(value) =>
                  updateCheckoutConfig({ showContactSection: value })
                }
              />
              <Toggle
                label="Mostrar sección entrega"
                checked={form.checkoutPageConfig.showDeliverySection}
                onChange={(value) =>
                  updateCheckoutConfig({ showDeliverySection: value })
                }
              />
              <Toggle
                label="Mostrar sección facturación"
                checked={form.checkoutPageConfig.showBillingSection}
                onChange={(value) =>
                  updateCheckoutConfig({ showBillingSection: value })
                }
              />
              <Toggle
                label="Mostrar resumen de compra"
                checked={form.checkoutPageConfig.showOrderSummary}
                onChange={(value) =>
                  updateCheckoutConfig({ showOrderSummary: value })
                }
              />
              <Toggle
                label="Mostrar imagen métodos de pago"
                checked={form.checkoutPageConfig.showPaymentMethodsImage}
                onChange={(value) =>
                  updateCheckoutConfig({ showPaymentMethodsImage: value })
                }
              />
              <Toggle
                label="Mostrar checkbox novedades"
                checked={form.checkoutPageConfig.showNewsletterCheckbox}
                onChange={(value) =>
                  updateCheckoutConfig({ showNewsletterCheckbox: value })
                }
              />
              <Toggle
                label="Mostrar texto de políticas"
                checked={form.checkoutPageConfig.showPoliciesText}
                onChange={(value) =>
                  updateCheckoutConfig({ showPoliciesText: value })
                }
              />
              <Toggle
                label="Mostrar botón confirmar"
                checked={form.checkoutPageConfig.showConfirmButton}
                onChange={(value) =>
                  updateCheckoutConfig({ showConfirmButton: value })
                }
              />
            </div>
          </SectionCard>

          <SectionCard
            title="Textos editables"
            text="Personaliza los textos internos del checkout."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Breadcrumb Home"
                value={form.checkoutPageConfig.breadcrumbHomeText}
                onChange={(e) =>
                  updateCheckoutConfig({ breadcrumbHomeText: e.target.value })
                }
              />
              <Input
                label="Breadcrumb actual"
                value={form.checkoutPageConfig.breadcrumbCurrentText}
                onChange={(e) =>
                  updateCheckoutConfig({ breadcrumbCurrentText: e.target.value })
                }
              />
              <Input
                label="Título sección contacto"
                value={form.checkoutPageConfig.contactSectionTitle}
                onChange={(e) =>
                  updateCheckoutConfig({ contactSectionTitle: e.target.value })
                }
              />
              <Input
                label="Título sección entrega"
                value={form.checkoutPageConfig.deliverySectionTitle}
                onChange={(e) =>
                  updateCheckoutConfig({ deliverySectionTitle: e.target.value })
                }
              />
              <Input
                label="Título sección facturación"
                value={form.checkoutPageConfig.billingSectionTitle}
                onChange={(e) =>
                  updateCheckoutConfig({ billingSectionTitle: e.target.value })
                }
              />
              <Input
                label="Título resumen"
                value={form.checkoutPageConfig.orderSummaryTitle}
                onChange={(e) =>
                  updateCheckoutConfig({ orderSummaryTitle: e.target.value })
                }
              />
              <Input
                label="Label correo"
                value={form.checkoutPageConfig.emailLabelText}
                onChange={(e) =>
                  updateCheckoutConfig({ emailLabelText: e.target.value })
                }
              />
              <Input
                label="Label teléfono"
                value={form.checkoutPageConfig.phoneLabelText}
                onChange={(e) =>
                  updateCheckoutConfig({ phoneLabelText: e.target.value })
                }
              />
              <Input
                label="Label cédula"
                value={form.checkoutPageConfig.documentLabelText}
                onChange={(e) =>
                  updateCheckoutConfig({ documentLabelText: e.target.value })
                }
              />
              <Input
                label="Label nombre"
                value={form.checkoutPageConfig.nameLabelText}
                onChange={(e) =>
                  updateCheckoutConfig({ nameLabelText: e.target.value })
                }
              />
              <Input
                label="Label ciudad"
                value={form.checkoutPageConfig.cityLabelText}
                onChange={(e) =>
                  updateCheckoutConfig({ cityLabelText: e.target.value })
                }
              />
              <Input
                label="Label dirección"
                value={form.checkoutPageConfig.addressLabelText}
                onChange={(e) =>
                  updateCheckoutConfig({ addressLabelText: e.target.value })
                }
              />
              <Input
                label="Label barrio"
                value={form.checkoutPageConfig.neighborhoodLabelText}
                onChange={(e) =>
                  updateCheckoutConfig({ neighborhoodLabelText: e.target.value })
                }
              />
              <Input
                label="Label información adicional"
                value={form.checkoutPageConfig.notesLabelText}
                onChange={(e) =>
                  updateCheckoutConfig({ notesLabelText: e.target.value })
                }
              />
              <Input
                label="Texto facturación diferente"
                value={form.checkoutPageConfig.billingToggleText}
                onChange={(e) =>
                  updateCheckoutConfig({ billingToggleText: e.target.value })
                }
              />
              <Input
                label="Texto newsletter"
                value={form.checkoutPageConfig.newsletterText}
                onChange={(e) =>
                  updateCheckoutConfig({ newsletterText: e.target.value })
                }
              />
              <Input
                label="Texto subtotal"
                value={form.checkoutPageConfig.subtotalLabelText}
                onChange={(e) =>
                  updateCheckoutConfig({ subtotalLabelText: e.target.value })
                }
              />
              <Input
                label="Texto total"
                value={form.checkoutPageConfig.totalLabelText}
                onChange={(e) =>
                  updateCheckoutConfig({ totalLabelText: e.target.value })
                }
              />
              <Input
                label="Texto botón confirmar"
                value={form.checkoutPageConfig.confirmButtonText}
                onChange={(e) =>
                  updateCheckoutConfig({ confirmButtonText: e.target.value })
                }
              />
              <Input
                label="Alt métodos de pago"
                value={form.checkoutPageConfig.paymentMethodsImageAlt}
                onChange={(e) =>
                  updateCheckoutConfig({ paymentMethodsImageAlt: e.target.value })
                }
              />
            </div>

            <Textarea
              label="Mensaje de envío"
              value={form.checkoutPageConfig.shippingMessageText}
              onChange={(e) =>
                updateCheckoutConfig({ shippingMessageText: e.target.value })
              }
            />

            <Textarea
              label="Texto de políticas"
              value={form.checkoutPageConfig.policiesText}
              onChange={(e) =>
                updateCheckoutConfig({ policiesText: e.target.value })
              }
            />

            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <Input
                  label="URL imagen métodos de pago"
                  value={form.checkoutPageConfig.paymentMethodsImage}
                  onChange={(e) =>
                    updateCheckoutConfig({ paymentMethodsImage: e.target.value })
                  }
                  placeholder="https://..."
                />

                <input
                  ref={paymentMethodsImageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePaymentMethodsImageSelected}
                />

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handlePickPaymentMethodsImage}
                    className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
                  >
                    Escoger imagen
                  </button>

                  <button
                    type="button"
                    onClick={handleUploadPaymentMethodsImage}
                    disabled={
                      uploadingPaymentMethodsImage || !paymentMethodsImageFile
                    }
                    className="rounded-xl bg-pink-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-pink-700 disabled:opacity-50"
                  >
                    {uploadingPaymentMethodsImage ? "Subiendo..." : "Subir a Cloudinary"}
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="mb-3 text-sm font-semibold text-gray-800">
                  Vista previa métodos de pago
                </div>

                <div className="flex min-h-[180px] items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4">
                  {paymentMethodsImagePreview ||
                  form.checkoutPageConfig.paymentMethodsImage ? (
                    <img
                      src={
                        paymentMethodsImagePreview ||
                        form.checkoutPageConfig.paymentMethodsImage
                      }
                      alt={
                        form.checkoutPageConfig.paymentMethodsImageAlt ||
                        "Métodos de pago"
                      }
                      className="max-h-[140px] max-w-full object-contain"
                    />
                  ) : (
                    <div className="text-sm text-gray-400">
                      Aún no hay imagen cargada
                    </div>
                  )}
                </div>
              </div>
            </div>
          </SectionCard>
        </div>
      )}

      {activeTab === "style" && (
        <div className="space-y-6">
          <SectionCard
            title="Estilo general"
            text="Colores, radios, sombras y dimensiones del checkout."
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
                    label="Fondo tarjetas"
                    value={style.sectionCardBg}
                    onChange={(e) =>
                      updateStyleConfig({ sectionCardBg: e.target.value })
                    }
                  />
                  <ColorInput
                    label="Borde tarjetas"
                    value={style.sectionCardBorderColor}
                    onChange={(e) =>
                      updateStyleConfig({
                        sectionCardBorderColor: e.target.value,
                      })
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
                    label="Color labels"
                    value={style.labelTextColor}
                    onChange={(e) =>
                      updateStyleConfig({ labelTextColor: e.target.value })
                    }
                  />
                  <ColorInput
                    label="Fondo inputs"
                    value={style.inputBg}
                    onChange={(e) => updateStyleConfig({ inputBg: e.target.value })}
                  />
                  <ColorInput
                    label="Borde inputs"
                    value={style.inputBorderColor}
                    onChange={(e) =>
                      updateStyleConfig({ inputBorderColor: e.target.value })
                    }
                  />
                  <ColorInput
                    label="Texto inputs"
                    value={style.inputTextColor}
                    onChange={(e) =>
                      updateStyleConfig({ inputTextColor: e.target.value })
                    }
                  />
                  <ColorInput
                    label="Placeholder inputs"
                    value={style.inputPlaceholderColor}
                    onChange={(e) =>
                      updateStyleConfig({
                        inputPlaceholderColor: e.target.value,
                      })
                    }
                  />
                  <ColorInput
                    label="Fondo resumen"
                    value={style.summaryBg}
                    onChange={(e) => updateStyleConfig({ summaryBg: e.target.value })}
                  />
                  <ColorInput
                    label="Borde resumen"
                    value={style.summaryBorderColor}
                    onChange={(e) =>
                      updateStyleConfig({ summaryBorderColor: e.target.value })
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
                    label="Texto total"
                    value={style.totalTextColor}
                    onChange={(e) =>
                      updateStyleConfig({ totalTextColor: e.target.value })
                    }
                  />
                  <ColorInput
                    label="Valor total"
                    value={style.totalValueColor}
                    onChange={(e) =>
                      updateStyleConfig({ totalValueColor: e.target.value })
                    }
                  />
                  <ColorInput
                    label="Fondo botón confirmar"
                    value={style.confirmButtonBg}
                    onChange={(e) =>
                      updateStyleConfig({ confirmButtonBg: e.target.value })
                    }
                  />
                  <ColorInput
                    label="Texto botón confirmar"
                    value={style.confirmButtonTextColor}
                    onChange={(e) =>
                      updateStyleConfig({
                        confirmButtonTextColor: e.target.value,
                      })
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
                        contentMaxWidthPx: clampInt(e.target.value, 900, 1800, 1280),
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
                        contentTopPaddingPx: clampInt(e.target.value, 0, 240, 90),
                      })
                    }
                  />

                  <Input
                    label="Radio tarjetas (px)"
                    type="number"
                    min="0"
                    max="40"
                    value={style.sectionCardRadiusPx}
                    onChange={(e) =>
                      updateStyleConfig({
                        sectionCardRadiusPx: clampInt(e.target.value, 0, 40, 18),
                      })
                    }
                  />

                  <Input
                    label="Padding tarjetas (px)"
                    type="number"
                    min="8"
                    max="48"
                    value={style.sectionCardPaddingPx}
                    onChange={(e) =>
                      updateStyleConfig({
                        sectionCardPaddingPx: clampInt(e.target.value, 8, 48, 24),
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
                        titleImageHeightPx: clampInt(e.target.value, 24, 220, 70),
                      })
                    }
                  />

                  <Input
                    label="Radio inputs (px)"
                    type="number"
                    min="0"
                    max="40"
                    value={style.inputRadiusPx}
                    onChange={(e) =>
                      updateStyleConfig({
                        inputRadiusPx: clampInt(e.target.value, 0, 40, 14),
                      })
                    }
                  />

                  <Input
                    label="Alto inputs (px)"
                    type="number"
                    min="36"
                    max="80"
                    value={style.inputHeightPx}
                    onChange={(e) =>
                      updateStyleConfig({
                        inputHeightPx: clampInt(e.target.value, 36, 80, 46),
                      })
                    }
                  />

                  <Input
                    label="Radio resumen (px)"
                    type="number"
                    min="0"
                    max="40"
                    value={style.summaryRadiusPx}
                    onChange={(e) =>
                      updateStyleConfig({
                        summaryRadiusPx: clampInt(e.target.value, 0, 40, 18),
                      })
                    }
                  />

                  <Input
                    label="Radio botón confirmar (px)"
                    type="number"
                    min="0"
                    max="40"
                    value={style.confirmButtonRadiusPx}
                    onChange={(e) =>
                      updateStyleConfig({
                        confirmButtonRadiusPx: clampInt(e.target.value, 0, 40, 999),
                      })
                    }
                  />

                  <Input
                    label="Alto imagen métodos de pago (px)"
                    type="number"
                    min="24"
                    max="140"
                    value={style.paymentMethodsImageHeightPx}
                    onChange={(e) =>
                      updateStyleConfig({
                        paymentMethodsImageHeightPx: clampInt(
                          e.target.value,
                          24,
                          140,
                          44
                        ),
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
                    label="Forma inputs"
                    value={style.inputStyle}
                    onChange={(e) => updateStyleConfig({ inputStyle: e.target.value })}
                  >
                    {INPUT_STYLE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>

                  <Select
                    label="Forma botón confirmar"
                    value={style.confirmButtonStyle}
                    onChange={(e) =>
                      updateStyleConfig({ confirmButtonStyle: e.target.value })
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
            text="Vista guía aproximada de colores y estilos del checkout."
          >
            <div
              className="rounded-3xl border p-5"
              style={{
                backgroundColor: style.pageBg,
                borderColor: style.sectionCardBorderColor,
              }}
            >
              <div
                className={[
                  "mx-auto",
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
                }}
              >
                <div
                  className="mb-4 text-sm"
                  style={{ color: style.breadcrumbTextColor }}
                >
                  <span style={{ color: style.breadcrumbLinkColor }}>
                    {form.checkoutPageConfig.breadcrumbHomeText}
                  </span>
                  <span className="mx-2">›</span>
                  <span>{form.checkoutPageConfig.breadcrumbCurrentText}</span>
                </div>

                <div className="mb-6 text-center">
                  {form.checkoutPageConfig.titleMode === "image" &&
                  (titleImagePreview || form.checkoutPageConfig.titleImage) ? (
                    <img
                      src={titleImagePreview || form.checkoutPageConfig.titleImage}
                      alt={form.checkoutPageConfig.titleImageAlt || "Título"}
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
                      {form.checkoutPageConfig.titleText}
                    </div>
                  )}
                </div>

                <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                  <div
                    className="border"
                    style={{
                      backgroundColor: style.sectionCardBg,
                      borderColor: style.sectionCardBorderColor,
                      borderRadius: `${style.sectionCardRadiusPx}px`,
                      padding: `${style.sectionCardPaddingPx}px`,
                    }}
                  >
                    <div
                      className="mb-4 text-base font-semibold"
                      style={{ color: style.textPrimaryColor }}
                    >
                      {form.checkoutPageConfig.contactSectionTitle}
                    </div>

                    <div className="grid gap-3">
                      <div>
                        <div
                          className="mb-1 text-sm font-medium"
                          style={{ color: style.labelTextColor }}
                        >
                          {form.checkoutPageConfig.emailLabelText}
                        </div>
                        <div
                          className="w-full border px-4"
                          style={{
                            backgroundColor: style.inputBg,
                            color: style.inputTextColor,
                            borderColor: style.inputBorderColor,
                            borderRadius: `${inputRadius}px`,
                            height: `${style.inputHeightPx}px`,
                            lineHeight: `${style.inputHeightPx - 2}px`,
                          }}
                        >
                          ejemplo@correo.com
                        </div>
                      </div>

                      <div>
                        <div
                          className="mb-1 text-sm font-medium"
                          style={{ color: style.labelTextColor }}
                        >
                          {form.checkoutPageConfig.nameLabelText}
                        </div>
                        <div
                          className="w-full border px-4"
                          style={{
                            backgroundColor: style.inputBg,
                            color: style.inputTextColor,
                            borderColor: style.inputBorderColor,
                            borderRadius: `${inputRadius}px`,
                            height: `${style.inputHeightPx}px`,
                            lineHeight: `${style.inputHeightPx - 2}px`,
                          }}
                        >
                          Nombre ejemplo
                        </div>
                      </div>

                      <div>
                        <div
                          className="mb-1 text-sm font-medium"
                          style={{ color: style.labelTextColor }}
                        >
                          {form.checkoutPageConfig.addressLabelText}
                        </div>
                        <div
                          className="w-full border px-4"
                          style={{
                            backgroundColor: style.inputBg,
                            color: style.inputTextColor,
                            borderColor: style.inputBorderColor,
                            borderRadius: `${inputRadius}px`,
                            height: `${style.inputHeightPx}px`,
                            lineHeight: `${style.inputHeightPx - 2}px`,
                          }}
                        >
                          Dirección ejemplo
                        </div>
                      </div>
                    </div>
                  </div>

                  <div
                    className="border"
                    style={{
                      backgroundColor: style.summaryBg,
                      borderColor: style.summaryBorderColor,
                      borderRadius: `${style.summaryRadiusPx}px`,
                      padding: `${style.sectionCardPaddingPx}px`,
                    }}
                  >
                    <div
                      className="mb-4 text-base font-semibold"
                      style={{ color: style.textPrimaryColor }}
                    >
                      {form.checkoutPageConfig.orderSummaryTitle}
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span style={{ color: style.subtotalTextColor }}>
                          {form.checkoutPageConfig.subtotalLabelText}
                        </span>
                        <span style={{ color: style.subtotalValueColor }}>
                          $120.000
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-base font-bold">
                        <span style={{ color: style.totalTextColor }}>
                          {form.checkoutPageConfig.totalLabelText}
                        </span>
                        <span style={{ color: style.totalValueColor }}>
                          $120.000
                        </span>
                      </div>
                    </div>

                    <div
                      className="mt-3 text-sm"
                      style={{ color: style.textSecondaryColor }}
                    >
                      {form.checkoutPageConfig.shippingMessageText}
                    </div>

                    {(paymentMethodsImagePreview ||
                      form.checkoutPageConfig.paymentMethodsImage) &&
                    form.checkoutPageConfig.showPaymentMethodsImage ? (
                      <div className="mt-4">
                        <img
                          src={
                            paymentMethodsImagePreview ||
                            form.checkoutPageConfig.paymentMethodsImage
                          }
                          alt={
                            form.checkoutPageConfig.paymentMethodsImageAlt ||
                            "Métodos de pago"
                          }
                          className="object-contain"
                          style={{ height: `${style.paymentMethodsImageHeightPx}px` }}
                        />
                      </div>
                    ) : null}

                    <button
                      type="button"
                      className="mt-4 w-full px-6 py-3 font-bold"
                      style={{
                        backgroundColor: style.confirmButtonBg,
                        color: style.confirmButtonTextColor,
                        borderRadius: `${buttonRadius}px`,
                      }}
                    >
                      {form.checkoutPageConfig.confirmButtonText}
                    </button>
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
