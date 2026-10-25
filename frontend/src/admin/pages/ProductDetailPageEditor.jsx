import { adminFetch } from '../../lib/api';
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import PageLoadState from "./workspace/PageLoadState";
import PageEditorWorkspace from "./workspace/PageEditorWorkspace";
import SectionCard from "./workspace/EditorSection";
import {
  Input, Textarea, Select, Toggle, ColorInput, RangeInput,
} from './workspace/ProductDetailEditorFields';
import ProductDetailPurchaseControls from './workspace/ProductDetailPurchaseControls';
import ProductDetailTypographyControls from './workspace/ProductDetailTypographyControls';
import ProductDetailAppearanceControls from "./workspace/ProductDetailAppearanceControls";
import usePageDraft from "./workspace/usePageDraft";
import {buildSafeStyleConfig, buildSafeProductDetailConfig} from "../../components/product-detail/productDetailConfig";
import { API_BASE_URL } from "../../config/apiBaseUrl";

const API_BASE = API_BASE_URL;

const EDITOR_TABS = [
  { id: "gallery", label: "Galería", group: "content" },
  { id: "info", label: "Información y compra", group: "content" },
  { id: "extra", label: "Bloques de apoyo", group: "content" },
  { id: "presentation", label: "Fondo y cristal", group: "design" },
  { id: "layout", label: "Distribución", group: "design" },
  { id: "style", label: "Colores y botones", group: "design" },
  { id: "typography", label: "Tipografía", group: "design" },
  { id: "reviews", label: "Reseñas", group: "options" },
  { id: "general", label: "Datos y título", group: "settings" },
];

const SHADOW_OPTIONS = [
  { value: "none", label: "Sin sombra" },
  { value: "soft", label: "Suave" },
  { value: "medium", label: "Media" },
  { value: "strong", label: "Fuerte" },
];

const GALLERY_POSITION_OPTIONS = [
  { value: "left", label: "Galería a la izquierda" },
  { value: "right", label: "Galería a la derecha" },
];

const THUMBNAIL_POSITION_OPTIONS = [
  { value: "overlay", label: "Sobre la imagen (diseño aprobado)" },
  { value: "left", label: "Miniaturas a la izquierda" },
  { value: "bottom", label: "Miniaturas abajo" },
];

const TITLE_MODE_OPTIONS = [
  { value: "text", label: "Título en texto" },
  { value: "image", label: "Título con imagen" },
];

const IMAGE_FIT_OPTIONS = [
  { value: "cover", label: "Cubrir el espacio" },
  { value: "contain", label: "Mostrar imagen completa" },
];

const ANIMATION_OPTIONS = [
  { value: "none", label: "Sin animación" },
  { value: "fade-up", label: "Aparecer hacia arriba" },
  { value: "fade-right", label: "Aparecer desde izquierda" },
  { value: "fade-left", label: "Aparecer desde derecha" },
  { value: "zoom-in", label: "Zoom de entrada" },
];

const THUMB_HOVER_OPTIONS = [
  { value: "none", label: "Sin efecto al pasar el cursor" },
  { value: "scale", label: "Escalar miniatura" },
  { value: "lift", label: "Elevar miniatura" },
  { value: "glow", label: "Brillo miniatura" },
];

const REVIEW_FONT_FAMILY_OPTIONS = [
  { value: "inherit", label: "Heredar del sitio" },
  { value: "Arial, sans-serif", label: "Arial" },
  { value: "Helvetica, Arial, sans-serif", label: "Helvetica" },
  { value: "'Inter', sans-serif", label: "Inter" },
  { value: "'Poppins', sans-serif", label: "Poppins" },
  { value: "'Montserrat', sans-serif", label: "Montserrat" },
  { value: "'Playfair Display', serif", label: "Playfair Display" },
  { value: "'Georgia', serif", label: "Georgia" },
];

const REVIEW_STAR_TYPE_OPTIONS = [
  { value: "star", label: "⭐ Estrella" },
  { value: "heart", label: "❤️ Corazón" },
  { value: "fire", label: "🔥 Fuego" },
  { value: "thumb", label: "👍 Like" },
];

const REVIEW_STAR_STYLE_OPTIONS = [
  { value: "fill", label: "Relleno" },
  { value: "outline", label: "Contorno" },
];

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


function IconUploadField({
  label,
  value,
  preview,
  inputRef,
  onPick,
  onFileChange,
  onUpload,
  uploading,
  onUrlChange,
  disabledUpload,
}) {
  const previewSrc = preview || value || "";

  return (
    <div className="space-y-3 rounded-2xl border border-gray-200 bg-gray-50 p-4">
      <Input
        label={label}
        value={value || ""}
        onChange={onUrlChange}
        placeholder="https://... o sube una imagen"
      />

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFileChange}
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onPick}
          className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
        >
          Elegir imagen
        </button>

        <button
          type="button"
          onClick={onUpload}
          disabled={uploading || disabledUpload}
          className="rounded-xl bg-pink-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-pink-700 disabled:opacity-50"
        >
          {uploading ? "Subiendo..." : "Cargar imagen"}
        </button>
      </div>

      <div className="rounded-xl border border-dashed border-gray-300 bg-white p-3">
        <div className="mb-2 text-sm font-medium text-gray-700">Vista previa</div>
        <div className="flex min-h-[90px] items-center justify-center rounded-xl bg-gray-50 p-3">
          {previewSrc ? (
            <img
              src={previewSrc}
              alt="Vista previa"
              className="max-h-[80px] max-w-full object-contain"
            />
          ) : (
            <div className="text-sm text-gray-400">Aún no hay imagen seleccionada.</div>
          )}
        </div>
      </div>
    </div>
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

function clampFloat(value, min, max, fallback) {
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

export default function ProductDetailPageEditor() {
  const navigate = useNavigate();
  const { id } = useParams();
  const titleImageInputRef = useRef(null);

  const benefit1IconInputRef = useRef(null);
  const benefit2IconInputRef = useRef(null);
  const benefit3IconInputRef = useRef(null);
  const reviewFormBgImageInputRef = useRef(null);

  const [page, setPage] = useState(null);
  const [form, setForm] = useState(null);
  const draft = usePageDraft(form);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState("");
  const loadSequence = useRef(0);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("gallery");

  const [titleImageFile, setTitleImageFile] = useState(null);
  const [titleImagePreview, setTitleImagePreview] = useState("");
  const [uploadingTitleImage, setUploadingTitleImage] = useState(false);

  const [benefit1IconFile, setBenefit1IconFile] = useState(null);
  const [benefit2IconFile, setBenefit2IconFile] = useState(null);
  const [benefit3IconFile, setBenefit3IconFile] = useState(null);
  const [reviewFormBgImageFile, setReviewFormBgImageFile] = useState(null);

  const [benefit1IconPreview, setBenefit1IconPreview] = useState("");
  const [benefit2IconPreview, setBenefit2IconPreview] = useState("");
  const [benefit3IconPreview, setBenefit3IconPreview] = useState("");
  const [reviewFormBgImagePreview, setReviewFormBgImagePreview] = useState("");

  const [uploadingBenefit1Icon, setUploadingBenefit1Icon] = useState(false);
  const [uploadingBenefit2Icon, setUploadingBenefit2Icon] = useState(false);
  const [uploadingBenefit3Icon, setUploadingBenefit3Icon] = useState(false);
  const [uploadingReviewFormBgImage, setUploadingReviewFormBgImage] =
    useState(false);

  const previewUrl = useMemo(() => {
    const slug = String(form?.slug || page?.slug || "").trim();
    if (!slug) return "";
    return `/pagina/${slug}`;
  }, [form?.slug, page?.slug]);

  const fetchPage = async () => {
    const sequence = ++loadSequence.current;
    try {
      setLoading(true);
      setNotFound(false);
      setLoadError("");

      const res = await adminFetch(`${API_BASE}/api/pages/${id}`);

      if (sequence !== loadSequence.current) return;
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
      if (sequence !== loadSequence.current) return;
      const safeConfig = buildSafeProductDetailConfig(data?.productDetailConfig);

      setPage(data);
      const loadedForm = {
        name: typeof data?.name === "string" ? data.name : "",
        slug: typeof data?.slug === "string" ? data.slug : "",
        pageType: "product-detail",
        enabled: data?.enabled !== false,
        useHeader: data?.useHeader !== false,
        useFooter: data?.useFooter !== false,
        productDetailConfig: safeConfig,
      };
      setForm(loadedForm);
      draft.initialize(loadedForm);
      setTitleImagePreview(String(safeConfig?.titleImage || ""));
      setTitleImageFile(null);

      setBenefit1IconPreview(String(safeConfig?.benefit1Icon || ""));
      setBenefit2IconPreview(String(safeConfig?.benefit2Icon || ""));
      setBenefit3IconPreview(String(safeConfig?.benefit3Icon || ""));
      setReviewFormBgImagePreview(
        String(safeConfig?.style?.reviewFormBgImage || "")
      );

      setBenefit1IconFile(null);
      setBenefit2IconFile(null);
      setBenefit3IconFile(null);
      setReviewFormBgImageFile(null);
    } catch (error) {
      if (sequence !== loadSequence.current) return;
      setLoadError(error.message || "Error de conexión");
      console.error("Error cargando página detalle:", error);
      setPage(null);
      setForm(null);
      setNotFound(true);
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchPage();
    return () => { loadSequence.current++; };
  }, [id]);

  const updateRoot = (patch) => {
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const updateDetailConfig = (patch) => {
    setForm((prev) => ({
      ...prev,
      productDetailConfig: {
        ...(prev?.productDetailConfig || {}),
        ...patch,
      },
    }));
  };

  const updateStyleConfig = (patch) => {
    setForm((prev) => ({
      ...prev,
      productDetailConfig: {
        ...(prev?.productDetailConfig || {}),
        style: {
          ...buildSafeStyleConfig(prev?.productDetailConfig?.style),
          ...patch,
        },
      },
    }));
  };

  const handleNameChange = (value) => setForm(previous => ({ ...previous, name: value }));

  const handlePickTitleImage = () => {
    titleImageInputRef.current?.click();
  };

  const handleTitleImageSelected = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setTitleImageFile(file);
    const localUrl = URL.createObjectURL(file);
    setTitleImagePreview(localUrl);
  };

  const handleUploadTitleImage = async () => {
    if (!titleImageFile) {
      draft.notify("Primero selecciona una imagen.");
      return;
    }

    try {
      setUploadingTitleImage(true);

      const body = new FormData();
      body.append("file", titleImageFile);

      const res = await adminFetch(`${API_BASE}/api/uploads`, {
        method: "POST",
        body,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.url) {
        throw new Error(data?.error || "No se pudo subir la imagen.");
      }

      updateDetailConfig({ titleImage: data.url, titleMode: "image" });
      setTitleImagePreview(data.url);
      setTitleImageFile(null);

      if (titleImageInputRef.current) {
        titleImageInputRef.current.value = "";
      }

      draft.inform("Imagen subida correctamente ✅");
    } catch (error) {
      console.error("Error subiendo imagen de título:", error);
      draft.notify(error.message || "No se pudo subir la imagen a Cloudinary.");
    } finally {
      setUploadingTitleImage(false);
    }
  };

  const handlePickBenefitIcon = (index) => {
    if (index === 1) benefit1IconInputRef.current?.click();
    if (index === 2) benefit2IconInputRef.current?.click();
    if (index === 3) benefit3IconInputRef.current?.click();
  };

  const handleBenefitIconSelected = (index, event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const localUrl = URL.createObjectURL(file);

    if (index === 1) {
      setBenefit1IconFile(file);
      setBenefit1IconPreview(localUrl);
    }

    if (index === 2) {
      setBenefit2IconFile(file);
      setBenefit2IconPreview(localUrl);
    }

    if (index === 3) {
      setBenefit3IconFile(file);
      setBenefit3IconPreview(localUrl);
    }
  };

  const handleUploadBenefitIcon = async (index) => {
    const file =
      index === 1
        ? benefit1IconFile
        : index === 2
        ? benefit2IconFile
        : benefit3IconFile;

    if (!file) {
      draft.notify("Primero selecciona una imagen.");
      return;
    }

    try {
      if (index === 1) setUploadingBenefit1Icon(true);
      if (index === 2) setUploadingBenefit2Icon(true);
      if (index === 3) setUploadingBenefit3Icon(true);

      const body = new FormData();
      body.append("file", file);

      const res = await adminFetch(`${API_BASE}/api/uploads`, {
        method: "POST",
        body,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.url) {
        throw new Error(data?.error || "No se pudo subir la imagen.");
      }

      if (index === 1) {
        updateDetailConfig({ benefit1Icon: data.url });
        setBenefit1IconPreview(data.url);
        setBenefit1IconFile(null);
        if (benefit1IconInputRef.current) {
          benefit1IconInputRef.current.value = "";
        }
      }

      if (index === 2) {
        updateDetailConfig({ benefit2Icon: data.url });
        setBenefit2IconPreview(data.url);
        setBenefit2IconFile(null);
        if (benefit2IconInputRef.current) {
          benefit2IconInputRef.current.value = "";
        }
      }

      if (index === 3) {
        updateDetailConfig({ benefit3Icon: data.url });
        setBenefit3IconPreview(data.url);
        setBenefit3IconFile(null);
        if (benefit3IconInputRef.current) {
          benefit3IconInputRef.current.value = "";
        }
      }

      draft.inform("Ícono subido correctamente ✅");
    } catch (error) {
      console.error("Error subiendo ícono del beneficio:", error);
      draft.notify(error.message || "No se pudo subir el ícono a Cloudinary.");
    } finally {
      if (index === 1) setUploadingBenefit1Icon(false);
      if (index === 2) setUploadingBenefit2Icon(false);
      if (index === 3) setUploadingBenefit3Icon(false);
    }
  };

  const handlePickReviewFormBgImage = () => {
    reviewFormBgImageInputRef.current?.click();
  };

  const handleReviewFormBgImageSelected = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setReviewFormBgImageFile(file);
    const localUrl = URL.createObjectURL(file);
    setReviewFormBgImagePreview(localUrl);
  };

  const handleUploadReviewFormBgImage = async () => {
    if (!reviewFormBgImageFile) {
      draft.notify("Primero selecciona una imagen.");
      return;
    }

    try {
      setUploadingReviewFormBgImage(true);

      const body = new FormData();
      body.append("file", reviewFormBgImageFile);

      const res = await adminFetch(`${API_BASE}/api/uploads`, {
        method: "POST",
        body,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.url) {
        throw new Error(data?.error || "No se pudo subir la imagen.");
      }

      updateStyleConfig({ reviewFormBgImage: data.url });
      setReviewFormBgImagePreview(data.url);
      setReviewFormBgImageFile(null);

      if (reviewFormBgImageInputRef.current) {
        reviewFormBgImageInputRef.current.value = "";
      }

      draft.inform("Fondo del formulario subido correctamente ✅");
    } catch (error) {
      console.error("Error subiendo fondo del formulario de reseñas:", error);
      draft.notify(error.message || "No se pudo subir la imagen a Cloudinary.");
    } finally {
      setUploadingReviewFormBgImage(false);
    }
  };

  const handleSave = async () => {
    if (!form) return;

    const name = String(form.name || "").trim();
    const slug = slugify(form.slug || form.name);

    if (!name) {
      draft.notify("El nombre de la página es obligatorio.");
      return;
    }

    if (!slug) {
      draft.notify("Escribe una dirección válida para la página.");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        name,
        slug,
        pageType: "product-detail",
        enabled: form.enabled !== false,
        useHeader: form.useHeader !== false,
        useFooter: form.useFooter !== false,
        blocks: Array.isArray(page?.blocks) ? page.blocks : [],
        productDetailConfig: buildSafeProductDetailConfig(form.productDetailConfig),
      };

      const res = await adminFetch(`${API_BASE}/api/pages/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.message || `HTTP ${res.status}`);
      }

      if (JSON.stringify(buildSafeProductDetailConfig(data?.productDetailConfig)) !== JSON.stringify(payload.productDetailConfig)) {
        throw new Error("El servidor no conservó todos los ajustes. Tus cambios siguen en el editor; vuelve a intentarlo.");
      }

      setPage(data);
      const savedForm = {
        name: typeof data?.name === "string" ? data.name : "",
        slug: typeof data?.slug === "string" ? data.slug : "",
        pageType: "product-detail",
        enabled: data?.enabled !== false,
        useHeader: data?.useHeader !== false,
        useFooter: data?.useFooter !== false,
        productDetailConfig: buildSafeProductDetailConfig(data?.productDetailConfig),
      };
      setForm(savedForm);
      draft.markSaved(savedForm);

      setBenefit1IconPreview(String(data?.productDetailConfig?.benefit1Icon || ""));
      setBenefit2IconPreview(String(data?.productDetailConfig?.benefit2Icon || ""));
      setBenefit3IconPreview(String(data?.productDetailConfig?.benefit3Icon || ""));
      setReviewFormBgImagePreview(
        String(data?.productDetailConfig?.style?.reviewFormBgImage || "")
      );

    } catch (error) {
      console.error("Error guardando página detalle:", error);
      draft.notify(error.message || "No se pudo guardar la página detalle.");
    } finally {
      setSaving(false);
    }
  };


  if (loading || notFound || !page || !form) {
    return <PageLoadState loading={loading} error={loadError} onRetry={fetchPage} onBack={() => navigate("/admin/paginas")}/>;
  }

  if (String(page?.pageType || "").toLowerCase() !== "product-detail") {
    return (
      <div className="space-y-4 p-6">
        <div className="text-red-500">Esta página no es de tipo detalle de producto.</div>
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

  return (
    <PageEditorWorkspace
      form={form}
      tabs={EDITOR_TABS}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onBack={() => draft.leave(() => navigate("/admin/paginas"))}
      onSave={handleSave}
      saving={saving}
      uploading={uploadingTitleImage || uploadingBenefit1Icon || uploadingBenefit2Icon || uploadingBenefit3Icon || uploadingReviewFormBgImage}
      draft={draft}
      pageTypeLabel="Detalle del producto"
    >
      <fieldset disabled={saving} className="pages-editor-fields">
      {activeTab === "general" && (
        <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <SectionCard
            title="Configuración general"
            text="Datos principales de la página detalle."
            className="bg-gray-50"
          >
            <Input
              label="Nombre de la página"
              value={form.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Ej: Detalle principal"
            />

            <Input
              label="Dirección de la página"
              value={form.slug}
              onChange={(e) => updateRoot({ slug: slugify(e.target.value) })}
              placeholder="Ej: detalle-principal"
            />

            <Toggle
              label="Página activa"
              checked={form.enabled}
              onChange={(value) => updateRoot({ enabled: value })}
            />

            <Toggle
              label="Mostrar encabezado"
              checked={form.useHeader}
              onChange={(value) => updateRoot({ useHeader: value })}
            />

            <Toggle
              label="Mostrar pie de página"
              checked={form.useFooter}
              onChange={(value) => updateRoot({ useFooter: value })}
            />
          </SectionCard>

          <SectionCard
            title="Encabezado del detalle"
            text="Puedes dejar el título original del producto o usar uno visual adicional."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Select
                label="Modo de título visual"
                value={form.productDetailConfig.titleMode}
                onChange={(e) => updateDetailConfig({ titleMode: e.target.value })}
              >
                {TITLE_MODE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>

              <Input
                label="Título alternativo"
                value={form.productDetailConfig.titleOverride}
                onChange={(e) =>
                  updateDetailConfig({ titleOverride: e.target.value })
                }
                placeholder="Déjalo vacío para usar el nombre del producto"
              />
            </div>

            <Input
              label="Subtítulo"
              value={form.productDetailConfig.subtitle}
              onChange={(e) => updateDetailConfig({ subtitle: e.target.value })}
              placeholder="Texto corto opcional"
            />

            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <Input
                  label="Enlace de la imagen del título"
                  value={form.productDetailConfig.titleImage}
                  onChange={(e) =>
                    updateDetailConfig({ titleImage: e.target.value })
                  }
                  placeholder="https://..."
                />

                <Input
                  label="Descripción de la imagen"
                  value={form.productDetailConfig.titleImageAlt}
                  onChange={(e) =>
                    updateDetailConfig({ titleImageAlt: e.target.value })
                  }
                  placeholder="Texto alternativo"
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
                    Elegir imagen
                  </button>

                  <button
                    type="button"
                    onClick={handleUploadTitleImage}
                    disabled={uploadingTitleImage || !titleImageFile}
                    className="rounded-xl bg-pink-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-pink-700 disabled:opacity-50"
                  >
                    {uploadingTitleImage ? "Subiendo..." : "Cargar imagen"}
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="mb-3 text-sm font-semibold text-gray-800">
                  Vista previa de imagen
                </div>

                <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4">
                  {titleImagePreview || form.productDetailConfig.titleImage ? (
                    <img
                      src={titleImagePreview || form.productDetailConfig.titleImage}
                      alt={form.productDetailConfig.titleImageAlt || "Vista previa"}
                      className="max-h-[220px] max-w-full object-contain"
                    />
                  ) : (
                    <div className="text-center text-sm text-gray-500">
                      Aún no hay imagen seleccionada.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </SectionCard>
        </div>
      )}

      {activeTab === "presentation" && <ProductDetailAppearanceControls config={form.productDetailConfig} onChange={value => updateRoot({ productDetailConfig: buildSafeProductDetailConfig(value) })}/>}
      {activeTab === "layout" && (
        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <SectionCard
            title="Distribución principal"
            text="Controla el acomodo general de la galería y la información."
          >
            <Select
              label="Posición de la galería"
              value={form.productDetailConfig.galleryPosition}
              onChange={(e) =>
                updateDetailConfig({ galleryPosition: e.target.value })
              }
            >
              {GALLERY_POSITION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>

            <Select
              label="Posición de miniaturas"
              value={form.productDetailConfig.thumbnailPosition}
              onChange={(e) =>
                updateDetailConfig({ thumbnailPosition: e.target.value })
              }
            >
              {THUMBNAIL_POSITION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>

            <div className="grid gap-3 md:grid-cols-2">
              <Toggle
                label="Mostrar breadcrumb"
                checked={form.productDetailConfig.showBreadcrumb}
                onChange={(value) => updateDetailConfig({ showBreadcrumb: value })}
              />
              <Toggle
                label="Mostrar imagen principal"
                checked={form.productDetailConfig.showMainImage}
                onChange={(value) => updateDetailConfig({ showMainImage: value })}
              />
              <Toggle
                label="Mostrar miniaturas"
                checked={form.productDetailConfig.showThumbnails}
                onChange={(value) => updateDetailConfig({ showThumbnails: value })}
              />
              <Toggle
                label="Mostrar flechas de galería"
                checked={form.productDetailConfig.showArrows}
                onChange={(value) => updateDetailConfig({ showArrows: value })}
              />
            </div>
          </SectionCard>

          <SectionCard
            title="Medidas visuales"
            text="Tamaño base del bloque visual de imágenes."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Máximo miniaturas visibles"
                type="number"
                min="1"
                max="10"
                value={form.productDetailConfig.thumbCount}
                onChange={(e) =>
                  updateDetailConfig({
                    thumbCount: clampInt(e.target.value, 1, 10, 5),
                  })
                }
              />

              <Input
                label="Ancho máximo imagen principal (px)"
                type="number"
                min="240"
                max="1000"
                value={form.productDetailConfig.mainImageMaxWidthPx}
                onChange={(e) =>
                  updateDetailConfig({
                    mainImageMaxWidthPx: clampInt(e.target.value, 240, 1000, 380),
                  })
                }
              />

              <Input
                label="Alto máximo imagen principal (px)"
                type="number"
                min="260"
                max="1200"
                value={form.productDetailConfig.mainImageMaxHeightPx}
                onChange={(e) =>
                  updateDetailConfig({
                    mainImageMaxHeightPx: clampInt(e.target.value, 260, 1200, 700),
                  })
                }
              />

              <Select
                label="Ajuste de imagen"
                value={form.productDetailConfig.imageFit}
                onChange={(e) => updateDetailConfig({ imageFit: e.target.value })}
              >
                {IMAGE_FIT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
          </SectionCard>
        </div>
      )}

      {activeTab === "gallery" && (
        <SectionCard
          title="Galería y miniaturas"
          text="Estilo visual de miniaturas e imagen principal."
        >
          <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <div className="space-y-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <Input
                label="Radio miniaturas (px)"
                type="number"
                min="4"
                max="24"
                value={form.productDetailConfig.style.thumbRadiusPx}
                onChange={(e) =>
                  updateStyleConfig({
                    thumbRadiusPx: clampInt(e.target.value, 4, 24, 10),
                  })
                }
              />

              <Input
                label="Ancho miniaturas (px)"
                type="number"
                min="40"
                max="180"
                value={form.productDetailConfig.thumbWidthPx}
                onChange={(e) =>
                  updateDetailConfig({
                    thumbWidthPx: clampInt(e.target.value, 40, 180, 64),
                  })
                }
              />

              <Input
                label="Alto miniaturas (px)"
                type="number"
                min="40"
                max="180"
                value={form.productDetailConfig.thumbHeightPx}
                onChange={(e) =>
                  updateDetailConfig({
                    thumbHeightPx: clampInt(e.target.value, 40, 180, 64),
                  })
                }
              />

              <Input
                label="Separación entre miniaturas (px)"
                type="number"
                min="4"
                max="40"
                value={form.productDetailConfig.thumbGapPx}
                onChange={(e) =>
                  updateDetailConfig({
                    thumbGapPx: clampInt(e.target.value, 4, 40, 12),
                  })
                }
              />

              <ColorInput
                label="Borde miniaturas"
                value={form.productDetailConfig.style.thumbBorderColor}
                onChange={(e) =>
                  updateStyleConfig({ thumbBorderColor: e.target.value })
                }
              />

              <ColorInput
                label="Borde miniatura seleccionada"
                value={form.productDetailConfig.style.selectedThumbBorderColor}
                onChange={(e) =>
                  updateStyleConfig({
                    selectedThumbBorderColor: e.target.value,
                  })
                }
              />
            </div>

            <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4">
              <div className="text-sm font-semibold text-gray-800">
                Animaciones de galería
              </div>

              <Select
                label="Animación de entrada de imagen"
                value={form.productDetailConfig.imageAnimation}
                onChange={(e) =>
                  updateDetailConfig({ imageAnimation: e.target.value })
                }
              >
                {ANIMATION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>

              <Select
                label="Hover de miniaturas"
                value={form.productDetailConfig.thumbHoverEffect}
                onChange={(e) =>
                  updateDetailConfig({ thumbHoverEffect: e.target.value })
                }
              >
                {THUMB_HOVER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>

              <Toggle
                label="Ampliar imagen al pasar el cursor"
                checked={form.productDetailConfig.imageHoverZoom}
                onChange={(value) =>
                  updateDetailConfig({ imageHoverZoom: value })
                }
              />

              <Input
                label="Duración animación (ms)"
                type="number"
                min="100"
                max="3000"
                value={form.productDetailConfig.animationDurationMs}
                onChange={(e) =>
                  updateDetailConfig({
                    animationDurationMs: clampInt(e.target.value, 100, 3000, 350),
                  })
                }
              />
            </div>
          </div>
        </SectionCard>
      )}

      {activeTab === "info" && (
        <ProductDetailPurchaseControls config={form.productDetailConfig} onChange={updateDetailConfig}/>
      )}
      {activeTab === "typography" && (
        <ProductDetailTypographyControls style={form.productDetailConfig.style} onChange={updateStyleConfig}/>
      )}

      {activeTab === "style" && (
        <div className="space-y-6">
          <SectionCard
            title="Estilo general"
            text="Personaliza los colores, textos y acabados de la ficha del producto."
          >
            <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
              <div className="space-y-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="text-sm font-semibold text-gray-800">Colores</div>

                <div className="grid gap-4 md:grid-cols-2">
                  <ColorInput
                    label="Fondo página"
                    value={form.productDetailConfig.style.pageBg}
                    onChange={(e) => updateStyleConfig({ pageBg: e.target.value })}
                  />
                  <ColorInput
                    label="Fondo tarjetas"
                    value={form.productDetailConfig.style.cardBg}
                    onChange={(e) => updateStyleConfig({ cardBg: e.target.value })}
                  />
                  <ColorInput
                    label="Texto principal"
                    value={form.productDetailConfig.style.primaryTextColor}
                    onChange={(e) =>
                      updateStyleConfig({ primaryTextColor: e.target.value })
                    }
                  />
                  <ColorInput
                    label="Texto secundario"
                    value={form.productDetailConfig.style.secondaryTextColor}
                    onChange={(e) =>
                      updateStyleConfig({ secondaryTextColor: e.target.value })
                    }
                  />
                  <ColorInput
                    label="Acento 1"
                    value={form.productDetailConfig.style.accentColor}
                    onChange={(e) =>
                      updateStyleConfig({ accentColor: e.target.value })
                    }
                  />
                  <ColorInput
                    label="Acento 2"
                    value={form.productDetailConfig.style.accentColor2}
                    onChange={(e) =>
                      updateStyleConfig({ accentColor2: e.target.value })
                    }
                  />
                  <ColorInput
                    label="Color de borde"
                    value={form.productDetailConfig.style.borderColor}
                    onChange={(e) =>
                      updateStyleConfig({ borderColor: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="text-sm font-semibold text-gray-800">
                  Marcos y profundidad
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    label="Radio general (px)"
                    type="number"
                    min="8"
                    max="40"
                    value={form.productDetailConfig.style.radiusPx}
                    onChange={(e) =>
                      updateStyleConfig({
                        radiusPx: clampInt(e.target.value, 8, 40, 18),
                      })
                    }
                  />

                  <Input
                    label="Ancho borde (px)"
                    type="number"
                    min="0"
                    step="0.25"
                    max="4"
                    value={form.productDetailConfig.style.borderWidthPx}
                    onChange={(e) =>
                      updateStyleConfig({
                        borderWidthPx: clampFloat(e.target.value, 0, 4, 1.25),
                      })
                    }
                  />







                  <Select
                    label="Tipo de sombra"
                    value={form.productDetailConfig.style.shadowStyle}
                    onChange={(e) =>
                      updateStyleConfig({ shadowStyle: e.target.value })
                    }
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
              title="Controles visuales"
              text="Aquí controlas por separado la apariencia del botón favorito y del botón grande de añadir al carrito."
            >
              <div className="grid gap-6 xl:grid-cols-2">
                <div className="space-y-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-sm font-semibold text-gray-800">
                    Botón favorito
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <ColorInput
                      label="Fondo botón favorito"
                      value={form.productDetailConfig.style.favoriteButtonBg}
                      onChange={(e) =>
                        updateStyleConfig({ favoriteButtonBg: e.target.value })
                      }
                    />

                    <Input
                      label="Transparencia botón favorito"
                      type="number"
                      min="0"
                      max="1"
                      step="0.05"
                      value={form.productDetailConfig.style.favoriteButtonOpacity}
                      onChange={(e) =>
                        updateStyleConfig({
                          favoriteButtonOpacity: clampFloat(
                            e.target.value,
                            0,
                            1,
                            1
                          ),
                        })
                      }
                    />

                    <ColorInput
                      label="Borde botón favorito"
                      value={form.productDetailConfig.style.favoriteBorderColor}
                      onChange={(e) =>
                        updateStyleConfig({ favoriteBorderColor: e.target.value })
                      }
                    />

                    <Input
                      label="Grosor borde favorito (px)"
                      type="number"
                      min="0"
                      max="4"
                      value={form.productDetailConfig.style.favoriteBorderWidthPx}
                      onChange={(e) =>
                        updateStyleConfig({
                          favoriteBorderWidthPx: clampInt(
                            e.target.value,
                            0,
                            4,
                            1
                          ),
                        })
                      }
                    />

                    <ColorInput
                      label="Color icono favorito"
                      value={form.productDetailConfig.favoriteIconColor}
                      onChange={(e) =>
                        updateDetailConfig({ favoriteIconColor: e.target.value })
                      }
                    />

                    <ColorInput
                      label="Color favorito activo"
                      value={form.productDetailConfig.favoriteActiveColor}
                      onChange={(e) =>
                        updateDetailConfig({ favoriteActiveColor: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-sm font-semibold text-gray-800">
                    Botón añadir al carrito
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <ColorInput
                      label="Fondo botón carrito"
                      value={form.productDetailConfig.style.addToCartButtonBg}
                      onChange={(e) =>
                        updateStyleConfig({ addToCartButtonBg: e.target.value })
                      }
                    />

                    <Input
                      label="Transparencia botón carrito"
                      type="number"
                      min="0"
                      max="1"
                      step="0.05"
                      value={form.productDetailConfig.style.addToCartButtonOpacity}
                      onChange={(e) =>
                        updateStyleConfig({
                          addToCartButtonOpacity: clampFloat(
                            e.target.value,
                            0,
                            1,
                            1
                          ),
                        })
                      }
                    />

                    <ColorInput
                      label="Borde botón carrito"
                      value={form.productDetailConfig.style.addToCartBorderColor}
                      onChange={(e) =>
                        updateStyleConfig({ addToCartBorderColor: e.target.value })
                      }
                    />

                    <Input
                      label="Grosor borde carrito (px)"
                      type="number"
                      min="0"
                      max="4"
                      value={form.productDetailConfig.style.addToCartBorderWidthPx}
                      onChange={(e) =>
                        updateStyleConfig({
                          addToCartBorderWidthPx: clampInt(
                            e.target.value,
                            0,
                            4,
                            0
                          ),
                        })
                      }
                    />

                    <ColorInput
                      label="Color texto botón carrito"
                      value={form.productDetailConfig.style.addToCartTextColor}
                      onChange={(e) =>
                        updateStyleConfig({ addToCartTextColor: e.target.value })
                      }
                    />

                    <ColorInput
                      label="Color icono botón carrito"
                      value={form.productDetailConfig.style.addToCartIconColor}
                      onChange={(e) =>
                        updateStyleConfig({ addToCartIconColor: e.target.value })
                      }
                    />

                    <Input
                      label="Radio botón carrito (px)"
                      type="number"
                      min="8"
                      max="40"
                      value={
                        form.productDetailConfig.style.buttonRadiusPx === 999
                          ? 40
                          : form.productDetailConfig.style.buttonRadiusPx
                      }
                      onChange={(e) =>
                        updateStyleConfig({
                          buttonRadiusPx: clampInt(e.target.value, 8, 40, 40),
                        })
                      }
                    />
                  </div>
                </div>
              </div>
          </SectionCard>
         
        </div>
      )}

      {activeTab === "reviews" && (
        <div className="space-y-6">
          <SectionCard
            title="Bloque de reseñas"
            text="Aquí configuras textos, visibilidad, animación y personalización avanzada de la sección de reseñas."
          >
            <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
              <div className="space-y-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <Toggle
                    label="Mostrar sección de reseñas"
                    checked={form.productDetailConfig.showReviewsSection}
                    onChange={(value) =>
                      updateDetailConfig({ showReviewsSection: value })
                    }
                  />

                  <Toggle
                    label="Mostrar formulario"
                    checked={form.productDetailConfig.showReviewForm}
                    onChange={(value) =>
                      updateDetailConfig({ showReviewForm: value })
                    }
                  />

                  <Toggle
                    label="Mostrar listado"
                    checked={form.productDetailConfig.showReviewList}
                    onChange={(value) =>
                      updateDetailConfig({ showReviewList: value })
                    }
                  />

                  <Toggle
                    label="Mostrar estrellas"
                    checked={form.productDetailConfig.showReviewStars}
                    onChange={(value) =>
                      updateDetailConfig({ showReviewStars: value })
                    }
                  />

                  <Toggle
                    label="Mostrar fecha"
                    checked={form.productDetailConfig.showReviewDate}
                    onChange={(value) =>
                      updateDetailConfig({ showReviewDate: value })
                    }
                  />
                </div>

                <Select
                  label="Animación de entrada reseñas"
                  value={form.productDetailConfig.reviewSectionAnimation}
                  onChange={(e) =>
                    updateDetailConfig({
                      reviewSectionAnimation: e.target.value,
                    })
                  }
                >
                  {ANIMATION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>

                <Input
                  label="Título general de reseñas"
                  value={form.productDetailConfig.reviewSectionTitle}
                  onChange={(e) =>
                    updateDetailConfig({ reviewSectionTitle: e.target.value })
                  }
                />

                <Input
                  label="Título formulario"
                  value={form.productDetailConfig.reviewFormTitle}
                  onChange={(e) =>
                    updateDetailConfig({ reviewFormTitle: e.target.value })
                  }
                />

                <Input
                  label="Título listado"
                  value={form.productDetailConfig.reviewListTitle}
                  onChange={(e) =>
                    updateDetailConfig({ reviewListTitle: e.target.value })
                  }
                />

                <Input
                  label="Texto vacío sin reseñas"
                  value={form.productDetailConfig.reviewEmptyText}
                  onChange={(e) =>
                    updateDetailConfig({ reviewEmptyText: e.target.value })
                  }
                />
              </div>

              <div className="space-y-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <Input
                  label="Label nombre"
                  value={form.productDetailConfig.reviewNameLabel}
                  onChange={(e) =>
                    updateDetailConfig({ reviewNameLabel: e.target.value })
                  }
                />

                <Input
                  label="Placeholder nombre"
                  value={form.productDetailConfig.reviewNamePlaceholder}
                  onChange={(e) =>
                    updateDetailConfig({
                      reviewNamePlaceholder: e.target.value,
                    })
                  }
                />

                <Input
                  label="Label calificación"
                  value={form.productDetailConfig.reviewRatingLabel}
                  onChange={(e) =>
                    updateDetailConfig({ reviewRatingLabel: e.target.value })
                  }
                />

                <Input
                  label="Label comentario"
                  value={form.productDetailConfig.reviewCommentLabel}
                  onChange={(e) =>
                    updateDetailConfig({ reviewCommentLabel: e.target.value })
                  }
                />

                <Textarea
                  label="Placeholder comentario"
                  value={form.productDetailConfig.reviewCommentPlaceholder}
                  onChange={(e) =>
                    updateDetailConfig({
                      reviewCommentPlaceholder: e.target.value,
                    })
                  }
                />

                <Input
                  label="Texto botón publicar"
                  value={form.productDetailConfig.reviewSubmitText}
                  onChange={(e) =>
                    updateDetailConfig({ reviewSubmitText: e.target.value })
                  }
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Estilos visuales de reseñas"
            text="Aquí controlas colores, bordes, tipografía y tamaños de toda la sección de reseñas."
          >
            <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
              <div className="space-y-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="text-sm font-semibold text-gray-800">
                  Colores de reseñas
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <ColorInput
                    label="Fondo contenedor reseñas"
                    value={form.productDetailConfig.style.reviewSectionBg}
                    onChange={(e) =>
                      updateStyleConfig({ reviewSectionBg: e.target.value })
                    }
                  />
                  <ColorInput
                    label="Fondo formulario"
                    value={form.productDetailConfig.style.reviewFormBg}
                    onChange={(e) =>
                      updateStyleConfig({ reviewFormBg: e.target.value })
                    }
                  />
                  <ColorInput
                    label="Fondo listado"
                    value={form.productDetailConfig.style.reviewListBg}
                    onChange={(e) =>
                      updateStyleConfig({ reviewListBg: e.target.value })
                    }
                  />
                  <ColorInput
                    label="Color títulos reseñas"
                    value={form.productDetailConfig.style.reviewTitleColor}
                    onChange={(e) =>
                      updateStyleConfig({ reviewTitleColor: e.target.value })
                    }
                  />
                  <ColorInput
                    label="Color texto reseñas"
                    value={form.productDetailConfig.style.reviewTextColor}
                    onChange={(e) =>
                      updateStyleConfig({ reviewTextColor: e.target.value })
                    }
                  />
                  <ColorInput
                    label="Color texto secundario"
                    value={form.productDetailConfig.style.reviewMutedColor}
                    onChange={(e) =>
                      updateStyleConfig({ reviewMutedColor: e.target.value })
                    }
                  />
                  <ColorInput
                    label="Fondo inputs"
                    value={form.productDetailConfig.style.reviewInputBg}
                    onChange={(e) =>
                      updateStyleConfig({ reviewInputBg: e.target.value })
                    }
                  />
                  <ColorInput
                    label="Borde inputs"
                    value={form.productDetailConfig.style.reviewInputBorderColor}
                    onChange={(e) =>
                      updateStyleConfig({
                        reviewInputBorderColor: e.target.value,
                      })
                    }
                  />
                  <ColorInput
                    label="Fondo botón reseña"
                    value={form.productDetailConfig.style.reviewButtonBg}
                    onChange={(e) =>
                      updateStyleConfig({ reviewButtonBg: e.target.value })
                    }
                  />
                  <ColorInput
                    label="Texto botón reseña"
                    value={form.productDetailConfig.style.reviewButtonTextColor}
                    onChange={(e) =>
                      updateStyleConfig({ reviewButtonTextColor: e.target.value })
                    }
                  />
                  <ColorInput
                    label="Estrella activa"
                    value={form.productDetailConfig.style.reviewStarActiveColor}
                    onChange={(e) =>
                      updateStyleConfig({ reviewStarActiveColor: e.target.value })
                    }
                  />
                  <ColorInput
                    label="Estrella inactiva"
                    value={form.productDetailConfig.style.reviewStarInactiveColor}
                    onChange={(e) =>
                      updateStyleConfig({
                        reviewStarInactiveColor: e.target.value,
                      })
                    }
                  />
                  <ColorInput
                    label="Fondo mensaje éxito"
                    value={form.productDetailConfig.style.reviewSuccessBg}
                    onChange={(e) =>
                      updateStyleConfig({ reviewSuccessBg: e.target.value })
                    }
                  />
                  <ColorInput
                    label="Texto mensaje éxito"
                    value={form.productDetailConfig.style.reviewSuccessText}
                    onChange={(e) =>
                      updateStyleConfig({ reviewSuccessText: e.target.value })
                    }
                  />
                  <ColorInput
                    label="Fondo mensaje error"
                    value={form.productDetailConfig.style.reviewErrorBg}
                    onChange={(e) =>
                      updateStyleConfig({ reviewErrorBg: e.target.value })
                    }
                  />
                  <ColorInput
                    label="Texto mensaje error"
                    value={form.productDetailConfig.style.reviewErrorText}
                    onChange={(e) =>
                      updateStyleConfig({ reviewErrorText: e.target.value })
                    }
                  />
                  <ColorInput
                    label="Color borde reseñas"
                    value={form.productDetailConfig.style.reviewBorderColor}
                    onChange={(e) =>
                      updateStyleConfig({ reviewBorderColor: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="text-sm font-semibold text-gray-800">
                  Medidas y tipografía
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    label="Radio bloque reseñas (px)"
                    type="number"
                    min="8"
                    max="40"
                    value={form.productDetailConfig.style.reviewSectionRadiusPx}
                    onChange={(e) =>
                      updateStyleConfig({
                        reviewSectionRadiusPx: clampInt(e.target.value, 8, 40, 18),
                      })
                    }
                  />

                  <Input
                    label="Radio inputs reseñas (px)"
                    type="number"
                    min="6"
                    max="30"
                    value={form.productDetailConfig.style.reviewInputRadiusPx}
                    onChange={(e) =>
                      updateStyleConfig({
                        reviewInputRadiusPx: clampInt(e.target.value, 6, 30, 10),
                      })
                    }
                  />

                  <Input
                    label="Tamaño título reseñas (px)"
                    type="number"
                    min="18"
                    max="40"
                    value={form.productDetailConfig.style.reviewTitleSizePx}
                    onChange={(e) =>
                      updateStyleConfig({
                        reviewTitleSizePx: clampInt(e.target.value, 18, 40, 24),
                      })
                    }
                  />

                  <Input
                    label="Tamaño texto reseñas (px)"
                    type="number"
                    min="12"
                    max="22"
                    value={form.productDetailConfig.style.reviewBodySizePx}
                    onChange={(e) =>
                      updateStyleConfig({
                        reviewBodySizePx: clampInt(e.target.value, 12, 22, 14),
                      })
                    }
                  />

                  <Input
                    label="Tamaño global fuente reseñas (px)"
                    type="number"
                    min="12"
                    max="26"
                    value={form.productDetailConfig.style.reviewFontSize}
                    onChange={(e) =>
                      updateStyleConfig({
                        reviewFontSize: clampInt(e.target.value, 12, 26, 14),
                      })
                    }
                  />

                  <Input
                    label="Radio borde avanzado reseñas (px)"
                    type="number"
                    min="0"
                    max="40"
                    value={form.productDetailConfig.style.reviewBorderRadius}
                    onChange={(e) =>
                      updateStyleConfig({
                        reviewBorderRadius: clampInt(e.target.value, 0, 40, 18),
                      })
                    }
                  />

                  <Input
                    label="Opacidad fondo reseñas (0 a 1)"
                    type="number"
                    min="0"
                    max="1"
                    step="0.05"
                    value={form.productDetailConfig.style.reviewBgOpacity}
                    onChange={(e) =>
                      updateStyleConfig({
                        reviewBgOpacity: clampFloat(e.target.value, 0, 1, 1),
                      })
                    }
                  />

                  <Select
                    label="Tipografía reseñas"
                    value={form.productDetailConfig.style.reviewFontFamily}
                    onChange={(e) =>
                      updateStyleConfig({ reviewFontFamily: e.target.value })
                    }
                  >
                    {REVIEW_FONT_FAMILY_OPTIONS.map((option) => (
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
            title="Fondo visual del formulario de reseñas"
            text="Aquí puedes colocar una imagen de fondo solo para el formulario de reseñas y controlar su transparencia."
          >
            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-4">
                <IconUploadField
                  label="Imagen de fondo del formulario"
                  value={form.productDetailConfig.style.reviewFormBgImage}
                  preview={reviewFormBgImagePreview}
                  inputRef={reviewFormBgImageInputRef}
                  onPick={handlePickReviewFormBgImage}
                  onFileChange={handleReviewFormBgImageSelected}
                  onUpload={handleUploadReviewFormBgImage}
                  uploading={uploadingReviewFormBgImage}
                  onUrlChange={(e) =>
                    updateStyleConfig({ reviewFormBgImage: e.target.value })
                  }
                  disabledUpload={!reviewFormBgImageFile}
                />

                <RangeInput
                  label="Transparencia de la imagen de fondo"
                  min={0}
                  max={1}
                  step={0.05}
                  value={form.productDetailConfig.style.reviewFormBgImageOpacity}
                  onChange={(e) =>
                    updateStyleConfig({
                      reviewFormBgImageOpacity: clampFloat(
                        e.target.value,
                        0,
                        1,
                        0.35
                      ),
                    })
                  }
                />
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="mb-3 text-sm font-semibold text-gray-800">
                  Vista previa rápida
                </div>

                <div
                  data-admin-storefront-preview="true"
                  className="relative overflow-hidden rounded-2xl border border-dashed border-gray-300 min-h-[260px] p-4"
                  style={{
                    backgroundColor:
                      form.productDetailConfig.style.reviewFormBg || "#ffffff",
                  }}
                >
                  {(
                    reviewFormBgImagePreview ||
                    form.productDetailConfig.style.reviewFormBgImage
                  ) ? (
                    <div
                      className="absolute inset-0 bg-center bg-cover bg-no-repeat"
                      style={{
                        backgroundImage: `url(${ 
                          reviewFormBgImagePreview ||
                          form.productDetailConfig.style.reviewFormBgImage
                        })`,
                        opacity:
                          form.productDetailConfig.style.reviewFormBgImageOpacity,
                      }}
                    />
                  ) : null}

                  <div className="relative z-10 space-y-3">
                    <div className="text-sm font-semibold text-gray-800">
                      Ejemplo formulario
                    </div>

                    <div className="h-10 rounded-lg border border-gray-300 bg-white/80" />
                    <div className="h-24 rounded-lg border border-gray-300 bg-white/80" />
                    <div className="h-10 w-40 rounded-lg bg-pink-500/80" />
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Iconos de calificación"
            text="Aquí decides qué ícono usar en el rating y cómo debe verse."
          >
            <div className="grid gap-4 md:grid-cols-3">
              <Select
                label="Tipo de icono"
                value={form.productDetailConfig.reviewStarType}
                onChange={(e) =>
                  updateDetailConfig({ reviewStarType: e.target.value })
                }
              >
                {REVIEW_STAR_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>

              <Select
                label="Estilo del icono"
                value={form.productDetailConfig.reviewStarStyle}
                onChange={(e) =>
                  updateDetailConfig({ reviewStarStyle: e.target.value })
                }
              >
                {REVIEW_STAR_STYLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>

              <Input
                label="Tamaño del icono (px)"
                type="number"
                min="12"
                max="48"
                value={form.productDetailConfig.reviewStarSizePx}
                onChange={(e) =>
                  updateDetailConfig({
                    reviewStarSizePx: clampInt(e.target.value, 12, 48, 20),
                  })
                }
              />
            </div>
          </SectionCard>
        </div>
      )}

      {activeTab === "extra" && (
        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <SectionCard
            title="Beneficios inferiores"
            text="Íconos y títulos debajo del bloque de compra."
          >
            <Toggle
              label="Mostrar bloque de beneficios"
              checked={form.productDetailConfig.showBenefits}
              onChange={(value) => updateDetailConfig({ showBenefits: value })}
            />

            <div className="grid gap-4">
              <Input
                label="Beneficio 1 texto"
                value={form.productDetailConfig.benefit1Title}
                onChange={(e) =>
                  updateDetailConfig({ benefit1Title: e.target.value })
                }
              />

              <IconUploadField
                label="Beneficio 1 icono"
                value={form.productDetailConfig.benefit1Icon}
                preview={benefit1IconPreview}
                inputRef={benefit1IconInputRef}
                onPick={() => handlePickBenefitIcon(1)}
                onFileChange={(e) => handleBenefitIconSelected(1, e)}
                onUpload={() => handleUploadBenefitIcon(1)}
                uploading={uploadingBenefit1Icon}
                onUrlChange={(e) =>
                  updateDetailConfig({ benefit1Icon: e.target.value })
                }
                disabledUpload={!benefit1IconFile}
              />

              <Input
                label="Beneficio 2 texto"
                value={form.productDetailConfig.benefit2Title}
                onChange={(e) =>
                  updateDetailConfig({ benefit2Title: e.target.value })
                }
              />

              <IconUploadField
                label="Beneficio 2 icono"
                value={form.productDetailConfig.benefit2Icon}
                preview={benefit2IconPreview}
                inputRef={benefit2IconInputRef}
                onPick={() => handlePickBenefitIcon(2)}
                onFileChange={(e) => handleBenefitIconSelected(2, e)}
                onUpload={() => handleUploadBenefitIcon(2)}
                uploading={uploadingBenefit2Icon}
                onUrlChange={(e) =>
                  updateDetailConfig({ benefit2Icon: e.target.value })
                }
                disabledUpload={!benefit2IconFile}
              />

              <Input
                label="Beneficio 3 texto"
                value={form.productDetailConfig.benefit3Title}
                onChange={(e) =>
                  updateDetailConfig({ benefit3Title: e.target.value })
                }
              />

              <IconUploadField
                label="Beneficio 3 icono"
                value={form.productDetailConfig.benefit3Icon}
                preview={benefit3IconPreview}
                inputRef={benefit3IconInputRef}
                onPick={() => handlePickBenefitIcon(3)}
                onFileChange={(e) => handleBenefitIconSelected(3, e)}
                onUpload={() => handleUploadBenefitIcon(3)}
                uploading={uploadingBenefit3Icon}
                onUrlChange={(e) =>
                  updateDetailConfig({ benefit3Icon: e.target.value })
                }
                disabledUpload={!benefit3IconFile}
              />
            </div>
          </SectionCard>

          <SectionCard
            title="Acordeones inferiores"
            text="Bloque informativo expansible al final de la página."
          >
            <Toggle
              label="Mostrar acordeones"
              checked={form.productDetailConfig.showAccordionBlock}
              onChange={(value) =>
                updateDetailConfig({ showAccordionBlock: value })
              }
            />

            <Input
              label="Título acordeón 1"
              value={form.productDetailConfig.accordionTitle1}
              onChange={(e) =>
                updateDetailConfig({ accordionTitle1: e.target.value })
              }
            />

            <Textarea
              label="Texto acordeón 1"
              value={form.productDetailConfig.accordionText1}
              onChange={(e) =>
                updateDetailConfig({ accordionText1: e.target.value })
              }
              placeholder="Escribe aquí el contenido del acordeón 1"
            />

            <Input
              label="Título acordeón 2"
              value={form.productDetailConfig.accordionTitle2}
              onChange={(e) =>
                updateDetailConfig({ accordionTitle2: e.target.value })
              }
            />

            <Textarea
              label="Texto acordeón 2"
              value={form.productDetailConfig.accordionText2}
              onChange={(e) =>
                updateDetailConfig({ accordionText2: e.target.value })
              }
              placeholder="Escribe aquí el contenido del acordeón 2"
            />
          </SectionCard>
        </div>
      )}
      </fieldset>
    </PageEditorWorkspace>
  );
}
