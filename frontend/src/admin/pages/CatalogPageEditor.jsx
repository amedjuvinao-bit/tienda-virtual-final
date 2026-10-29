import CollectionCatalogControls from "./workspace/CollectionCatalogControls";
import { pagePublicPath } from "./workspace/pageModel";
import { applyCatalogEditorialPreset, restoreCatalogVisualBackup } from "../../components/catalog/catalogEditorialPreset";
import { adminFetch } from '../../lib/api';
// frontend/src/admin/pages/CatalogPageEditor.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import PageLoadState from "./workspace/PageLoadState";
import PageEditorWorkspace from "./workspace/PageEditorWorkspace";
import SectionCard from "./workspace/EditorSection";
import CatalogAppearancePanel from "./workspace/CatalogAppearancePanel";
import usePageDraft from "./workspace/usePageDraft";
import { buildSafeCatalogConfig, buildSafeCardUiConfig, buildSafeFilterUiConfig, buildSafeColumnControlsUiConfig } from '../../components/catalog/catalogConfig';
import { API_BASE_URL } from "../../config/apiBaseUrl";

const API_BASE = API_BASE_URL;

const EDITOR_TABS = [
  { id: "products", label: "Productos", group: "content" },
  { id: "visual", label: "Fondo y cristal", group: "design" },
  { id: "collection", label: "Ilustración y mensajes", group: "design" },
  { id: "header", label: "Encabezado", group: "design" },
  { id: "grid", label: "Distribución", group: "design" },
  { id: "card-style", label: "Tarjetas de producto", group: "design" },
  { id: "filter-style", label: "Filtros", group: "design" },
  { id: "motion", label: "Animaciones", group: "design" },
  { id: "empty", label: "Sin resultados", group: "options" },
  { id: "general", label: "Datos de la página", group: "settings" },
];

const PRODUCT_SUBTABS = [
  { id: "universe", label: "Origen de productos" },
  { id: "categories", label: "Categorías" },
  { id: "manual", label: "Selección manual" },
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

function normalizeCsvText(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .join(", ");
}

function parseCsvArray(value) {
  return normalizeCsvText(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function dedupeCaseInsensitive(list) {
  const out = [];
  const seen = new Set();

  for (const item of Array.isArray(list) ? list : []) {
    const clean = String(item || "").trim();
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
  }

  return out;
}

function listToCsv(list) {
  return dedupeCaseInsensitive(list).join(", ");
}

function MiniTabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-xl border px-3 py-2 text-xs font-semibold transition",
        active
          ? "border-pink-500 bg-pink-50 text-pink-700"
          : "border-gray-200 bg-white text-gray-600 hover:border-pink-200 hover:text-pink-600",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function CategoryPicker({
  label,
  helper,
  options = [],
  selected = [],
  onToggle = () => {},
  onClear = () => {},
}) {
  return (
    <div className="space-y-3">
      <div>
        <div className="text-sm font-medium text-gray-700">{label}</div>
        {helper ? <p className="mt-1 text-xs text-gray-500">{helper}</p> : null}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
        {selected.length > 0 ? (
          <div className="mb-3 flex flex-wrap gap-2">
            {selected.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => onToggle(item)}
                className="inline-flex items-center gap-2 rounded-full border border-pink-200 bg-pink-50 px-3 py-1.5 text-xs font-medium text-pink-700 hover:bg-pink-100"
              >
                {item}
                <span className="text-sm leading-none">×</span>
              </button>
            ))}

            <button
              type="button"
              onClick={onClear}
              className="rounded-full border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
            >
              Limpiar
            </button>
          </div>
        ) : (
          <div className="mb-3 rounded-xl border border-dashed border-gray-300 bg-white px-3 py-3 text-sm text-gray-500">
            No hay categorías seleccionadas todavía.
          </div>
        )}

        <div className="max-h-64 overflow-auto rounded-xl border border-gray-200 bg-white p-3">
          <div className="flex flex-wrap gap-2">
            {options.length === 0 ? (
              <div className="text-sm text-gray-500">
                No se encontraron categorías en productos.
              </div>
            ) : (
              options.map((option) => {
                const selectedNow = selected.some(
                  (item) => item.toLowerCase() === option.toLowerCase()
                );

                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => onToggle(option)}
                    className={[
                      "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                      selectedNow
                        ? "border-pink-500 bg-pink-600 text-white"
                        : "border-gray-200 bg-gray-50 text-gray-700 hover:border-pink-200 hover:bg-pink-50",
                    ].join(" ")}
                  >
                    {option}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ManualProductsPicker({
  allProducts = [],
  selectedKeys = [],
  onAdd = () => {},
  onRemove = () => {},
  onSearch = () => {},
}) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    const cleanQuery = query.trim();
    if (!cleanQuery) return undefined;
    const timer = window.setTimeout(() => onSearch(cleanQuery), 300);
    return () => window.clearTimeout(timer);
  }, [query, onSearch]);

  const filtered = useMemo(() => {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return allProducts.slice(0, 20);

    return allProducts
      .filter((product) => {
        const title = String(product?.title || product?.name || "").toLowerCase();
        const slug = String(product?.slug || "").toLowerCase();
        const id = String(product?._id || "").toLowerCase();
        return [title, slug, id, product.sku, product.barcode, ...(product.variants || []).flatMap(v => [v.sku, v.barcode])].some(value => String(value || '').toLowerCase().includes(q));
      })
      .slice(0, 20);
  }, [allProducts, query]);

  const selectedProducts = useMemo(() => {
    const lowerSet = new Set(selectedKeys.map((item) => String(item).toLowerCase()));
    return allProducts.filter((product) => {
      const id = String(product?._id || "").toLowerCase();
      const slug = String(product?.slug || "").toLowerCase();
      return lowerSet.has(id) || lowerSet.has(slug);
    });
  }, [allProducts, selectedKeys]);

  return (
    <div className="space-y-4">
      <Input
        label="Buscar productos"
        value={query}
        maxLength={160}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Busca por nombre o referencia"
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
          <div className="mb-3 text-sm font-semibold text-gray-800">Resultados</div>
          <div className="max-h-80 space-y-2 overflow-auto">
            {filtered.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 bg-white px-3 py-4 text-sm text-gray-500">
                No se encontraron productos.
              </div>
            ) : (
              filtered.map((product) => {
                const productId = String(product?._id || "");
                const selectedNow = selectedKeys.some(
                  (item) => item.toLowerCase() === productId.toLowerCase()
                );

                return (
                  <div
                    key={productId || product?.slug}
                    className="rounded-xl border border-gray-200 bg-white p-3"
                  >
                    <div className="text-sm font-semibold text-gray-800">
                      {product?.title || product?.name || "Producto sin nombre"}
                    </div>
                    <div className="mt-1 break-all text-xs text-gray-500">
                      ID: {productId || "—"}
                    </div>
                    <div className="mt-1 break-all text-xs text-gray-500">
                      Dirección: {product?.slug || "—"}
                    </div>

                    <button
                      type="button"
                      onClick={() => onAdd(product)}
                      className={[
                        "mt-3 rounded-xl px-3 py-2 text-xs font-semibold transition",
                        selectedNow
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-pink-600 text-white hover:bg-pink-700",
                      ].join(" ")}
                    >
                      {selectedNow ? "Ya agregado" : "Agregar"}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
          <div className="mb-3 text-sm font-semibold text-gray-800">
            Seleccionados
          </div>
          <div className="max-h-80 space-y-2 overflow-auto">
            {selectedProducts.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 bg-white px-3 py-4 text-sm text-gray-500">
                No hay productos seleccionados.
              </div>
            ) : (
              selectedProducts.map((product) => (
                <div
                  key={String(product?._id || product?.slug)}
                  className="rounded-xl border border-gray-200 bg-white p-3"
                >
                  <div className="text-sm font-semibold text-gray-800">
                    {product?.title || product?.name || "Producto sin nombre"}
                  </div>
                  <div className="mt-1 break-all text-xs text-gray-500">
                    ID: {product?._id || "—"}
                  </div>
                  <div className="mt-1 break-all text-xs text-gray-500">
                    Dirección: {product?.slug || "—"}
                  </div>

                  <button
                    type="button"
                    onClick={() => onRemove(String(product?._id || product?.slug || ""))}
                    className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-100"
                  >
                    Quitar
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CatalogPageEditor() {
  const navigate = useNavigate();
  const { id } = useParams();
  const titleImageInputRef = useRef(null);

  const [page, setPage] = useState(null);
  const [form, setForm] = useState(null);
  const draft = usePageDraft(form);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState("");
  const loadSequence = useRef(0);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("products");
  const [productsSubtab, setProductsSubtab] = useState("universe");
  const [uploadingAppearance, setUploadingAppearance] = useState(false);

  const [allProducts, setAllProducts] = useState([]);
  const [availableProductCategories, setAvailableProductCategories] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productsError, setProductsError] = useState('');
  const selectedKeysRef = useRef([]), productRequests = useRef(0);

  const [titleImageFile, setTitleImageFile] = useState(null);
  const [titleImagePreview, setTitleImagePreview] = useState("");
  const [uploadingTitleImage, setUploadingTitleImage] = useState(false);

  const previewUrl = useMemo(() => {
    const slug = String(form?.slug || page?.slug || "").trim();
    if (!slug) return "";
    return pagePublicPath({...(page || {}),...(form || {}),slug});
  }, [form?.slug, page?.slug]);

  const allCategoryOptions = useMemo(() => {
    const collected = [];

    for (const product of allProducts) {
      const cats =
        Array.isArray(product?.categories) && product.categories.length
          ? product.categories
          : product?.category
          ? [product.category]
          : [];

      for (const item of cats) {
        collected.push(item);
      }
    }

    return dedupeCaseInsensitive([
      ...availableProductCategories,
      ...collected,
    ]).sort((a, b) => a.localeCompare(b));
  }, [allProducts, availableProductCategories]);

  const selectedAllowedCategories = useMemo(
    () => parseCsvArray(form?.catalogConfig?.allowedCategoriesText || ""),
    [form?.catalogConfig?.allowedCategoriesText]
  );

  const selectedInitialCategories = useMemo(
    () => parseCsvArray(form?.catalogConfig?.initialCategoriesText || ""),
    [form?.catalogConfig?.initialCategoriesText]
  );

  const selectedManualKeys = useMemo(
    () => parseCsvArray(form?.catalogConfig?.manualProductIdsText || ""),
    [form?.catalogConfig?.manualProductIdsText]
  );

  selectedKeysRef.current = selectedManualKeys;

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
      const safeCatalogConfig = buildSafeCatalogConfig(data?.catalogConfig);

      setPage(data);
      const loadedForm = {
        name: typeof data?.name === "string" ? data.name : "",
        slug: typeof data?.slug === "string" ? data.slug : "",
        pageType: "catalog",
        enabled: data?.enabled !== false,
        useHeader: data?.useHeader !== false,
        useFooter: data?.useFooter !== false,
        catalogConfig: safeCatalogConfig,
      };
      setForm(loadedForm);
      draft.initialize(loadedForm);
      setTitleImagePreview(String(safeCatalogConfig?.titleImage || ""));
      setTitleImageFile(null);
    } catch (error) {
      if (sequence !== loadSequence.current) return;
      setLoadError(error.message || "Error de conexión");
      console.error("Error cargando página catálogo:", error);
      setPage(null);
      setForm(null);
      setNotFound(true);
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  };

  const fetchProducts = useCallback(async (query = '', productKeys = []) => {
    productRequests.current++;
    try {
      setLoadingProducts(true);
      setProductsError('');
      const params = new URLSearchParams({
        page: '1',
        limit: query ? '20' : '40',
        sort: 'title',
      });
      if (query) params.set('q', query.trim().slice(0, 160));
      productKeys.forEach((value) => params.append('productKeys', value));
      const [productsResponse, metaResponse, taxonomyResponse] = await Promise.all([
        adminFetch(`${API_BASE}/api/products?${params.toString()}`),
        query || productKeys.length
          ? Promise.resolve(null)
          : adminFetch(`${API_BASE}/api/products/meta`),
        query || productKeys.length
          ? Promise.resolve(null)
          : adminFetch(`${API_BASE}/api/products/catalog-categories`).catch(() => null),
      ]);
      if (!productsResponse.ok) throw new Error(`HTTP ${productsResponse.status}`);
      const data = await productsResponse.json();
      const incoming = Array.isArray(data?.products) ? data.products : [];
      setAllProducts((current) => {
        const byId = new Map(
          [...incoming, ...current].map((product) => [
            String(product?._id || product?.slug || ''),
            product,
          ])
        );
        byId.delete('');
        const values = [...byId.values()];
        const selected = values.filter(p => selectedKeysRef.current.includes(String(p._id)) || selectedKeysRef.current.includes(p.slug));
        const bounded = new Map([...selected, ...values.slice(0, 100)].map(p => [String(p._id || p.slug), p]));
        return [...bounded.values()];
      });
      if (taxonomyResponse?.ok || metaResponse?.ok) {
        const meta = metaResponse?.ok ? await metaResponse.json() : {};
        const taxonomy = taxonomyResponse?.ok ? await taxonomyResponse.json() : {};
        setAvailableProductCategories(
          [
            ...(Array.isArray(meta?.categories) ? meta.categories : []),
            ...(Array.isArray(taxonomy?.categories)
              ? taxonomy.categories.map(item => item.name).filter(Boolean)
              : []),
          ]
        );
      }
    } catch (error) {
      console.error("Error cargando productos del editor catálogo:", error);
      setProductsError('No pudimos cargar los productos disponibles. Revisa tu conexión y vuelve a intentarlo.');
    } finally {
      productRequests.current--;
      setLoadingProducts(productRequests.current > 0);
    }
  }, []);

  useEffect(() => {
    if (id) {
      fetchPage();
    }
  }, [id]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    if (selectedManualKeys.length) {
      fetchProducts('', selectedManualKeys);
    }
  }, [fetchProducts, selectedManualKeys]);

  const updateRoot = (patch) => {
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const updateCatalogConfig = (patch) => {
    setForm((prev) => ({
      ...prev,
      catalogConfig: {
        ...(prev?.catalogConfig || {}),
        ...patch,
      },
    }));
  };

  const updateCatalogPresentation = (patch) => {
    setForm(prev => {
      const catalogConfig = { ...prev.catalogConfig, presentation: { ...prev.catalogConfig.presentation, ...patch } };
      return { ...prev, catalogConfig: patch.layout === 'glass-grid' && catalogConfig.presentation.styleVersion < 3 ? buildSafeCatalogConfig(catalogConfig) : catalogConfig };
    });
  };

  const updateFilterUiConfig = (patch) => {
    setForm((prev) => ({
      ...prev,
      catalogConfig: {
        ...(prev?.catalogConfig || {}),
        filterUiConfig: {
          ...buildSafeFilterUiConfig(prev?.catalogConfig?.filterUiConfig),
          ...patch,
        },
      },
    }));
  };

  const updateCardUiConfig = (patch) => {
    setForm((prev) => ({
      ...prev,
      catalogConfig: {
        ...(prev?.catalogConfig || {}),
        cardUiConfig: {
          ...buildSafeCardUiConfig(prev?.catalogConfig?.cardUiConfig),
          ...patch,
        },
      },
    }));
  };

  const updateColumnControlsUiConfig = (patch) => {
    setForm((prev) => ({
      ...prev,
      catalogConfig: {
        ...(prev?.catalogConfig || {}),
        columnControlsUiConfig: {
          ...buildSafeColumnControlsUiConfig(
            prev?.catalogConfig?.columnControlsUiConfig
          ),
          ...patch,
        },
      },
    }));
  };

  const updateAppearance = (scope, patch) => {
    const handlers = { catalog: updateCatalogConfig, presentation: updateCatalogPresentation,
      cardUiConfig: updateCardUiConfig, filterUiConfig: updateFilterUiConfig,
      columnControlsUiConfig: updateColumnControlsUiConfig };
    handlers[scope](patch);
  };

  const handleNameChange = (value) => setForm(previous => ({ ...previous, name: value }));

  const toggleCsvCategoryField = (fieldName, category) => {
    const current = parseCsvArray(form?.catalogConfig?.[fieldName] || "");
    const exists = current.some(
      (item) => item.toLowerCase() === String(category || "").toLowerCase()
    );
    const next = exists
      ? current.filter(
          (item) => item.toLowerCase() !== String(category || "").toLowerCase()
        )
      : [...current, category];

    updateCatalogConfig({
      [fieldName]: listToCsv(next),
    });
  };

  const clearCsvCategoryField = (fieldName) => {
    updateCatalogConfig({ [fieldName]: "" });
  };

  const addManualProduct = (product) => {
    const productId = String(product?._id || "").trim();
    if (!productId) return;

    const current = parseCsvArray(form?.catalogConfig?.manualProductIdsText || "");
    const exists = current.some(
      (item) => item.toLowerCase() === productId.toLowerCase()
    );
    if (exists) return;

    updateCatalogConfig({
      manualProductIdsText: listToCsv([...current, productId]),
    });
  };

  const removeManualProduct = (keyToRemove) => {
    const current = parseCsvArray(form?.catalogConfig?.manualProductIdsText || "");
    const lowerKey = String(keyToRemove || "").toLowerCase();

    const next = current.filter((item) => {
      const safeItem = String(item || "").toLowerCase();
      if (safeItem === lowerKey) return false;

      const product = allProducts.find((p) => {
        const idMatch = String(p?._id || "").toLowerCase() === safeItem;
        const slugMatch = String(p?.slug || "").toLowerCase() === safeItem;
        return idMatch || slugMatch;
      });

      if (!product) return true;

      const productId = String(product?._id || "").toLowerCase();
      const productSlug = String(product?.slug || "").toLowerCase();

      return !(productId === lowerKey || productSlug === lowerKey);
    });

    updateCatalogConfig({
      manualProductIdsText: listToCsv(next),
    });
  };

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

      updateCatalogConfig({ titleImage: data.url, titleMode: "image" });
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

  const handleSave = async () => {
    if (uploadingTitleImage || uploadingAppearance) return;
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

      const safeCatalogConfig = buildSafeCatalogConfig(form.catalogConfig);
      const allowed = parseCsvArray(safeCatalogConfig.allowedCategoriesText);
      const manual = parseCsvArray(safeCatalogConfig.manualProductIdsText);
      if (safeCatalogConfig.sourceMode === 'categories' && (!allowed.length || allowed.length > 30)) {
        draft.notify('Selecciona entre 1 y 30 categorías para este catálogo.'); return;
      }
      if (safeCatalogConfig.sourceMode === 'manual' && (!manual.length || manual.length > 100)) {
        draft.notify('Selecciona entre 1 y 100 productos para este catálogo.'); return;
      }

      if (safeCatalogConfig.initialMinPrice > safeCatalogConfig.initialMaxPrice) {
        draft.notify("El precio mínimo inicial no puede ser mayor que el precio máximo inicial.");
        return;
      }

      const payload = {
        name,
        slug,
        pageType: "catalog",
        enabled: form.enabled !== false,
        useHeader: form.useHeader !== false,
        useFooter: form.useFooter !== false,
        blocks: Array.isArray(page?.blocks) ? page.blocks : [],
        catalogConfig: safeCatalogConfig,
      };

      const res = await adminFetch(`${API_BASE}/api/pages/${id}`, {
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

      if (JSON.stringify(buildSafeCatalogConfig(data?.catalogConfig)) !== JSON.stringify(payload.catalogConfig)) {
        throw new Error("El servidor no conservó todos los ajustes. Tus cambios siguen en el editor; vuelve a intentarlo.");
      }

      setPage(data);
      const savedForm = {
        name: typeof data?.name === "string" ? data.name : "",
        slug: typeof data?.slug === "string" ? data.slug : "",
        pageType: "catalog",
        enabled: data?.enabled !== false,
        useHeader: data?.useHeader !== false,
        useFooter: data?.useFooter !== false,
        catalogConfig: buildSafeCatalogConfig(data?.catalogConfig),
      };
      setForm(savedForm);
      draft.markSaved(savedForm);

    } catch (error) {
      console.error("Error guardando página catálogo:", error);
      draft.notify(error.message || "No se pudo guardar la página catálogo.");
    } finally {
      setSaving(false);
    }
  };


  if (loading || notFound || !page || !form) {
    return <PageLoadState loading={loading} error={loadError} onRetry={fetchPage} onBack={() => navigate("/admin/paginas")}/>;
  }

  if (String(page?.pageType || "custom").toLowerCase() !== "catalog") {
    return (
      <div className="space-y-4 p-6">
        <div className="text-red-500">Esta página no es de tipo catálogo.</div>

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
      tabs={EDITOR_TABS.filter(tab => tab.id !== "collection" || form.catalogConfig.collection)}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onBack={() => draft.leave(() => navigate("/admin/paginas"))}
      onSave={handleSave}
      saving={saving}
      uploading={uploadingTitleImage || uploadingAppearance}
      lockNavigationDuringUpload
      draft={draft}
      pageTypeLabel="Catálogo"
      scrollToFieldsOnTabChange
    >
      <fieldset disabled={saving} className="pages-editor-fields">
      {activeTab === "general" && (
        <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <SectionCard
            title="Configuración general"
            text="Datos principales de la página catálogo."
            className="bg-gray-50"
          >
            <Input
              label="Nombre de la página"
              value={form.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Ej: Lo Nuevo"
            />

            <Input
              label="Dirección de la página"
              readOnly={page?.slug === "complementos"}
              value={form.slug}
              onChange={(e) => updateRoot({ slug: slugify(e.target.value) })}
              placeholder="Ej: lo-nuevo"
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
            title="Resumen rápido"
            text="Datos clave del catálogo para validar antes de guardar."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Ruta pública
                </div>
                <div className="mt-2 break-all text-sm text-gray-800">
                  {previewUrl || "Todavía no disponible"}
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Tipo de página
                </div>
                <div className="mt-2 text-sm text-gray-800">Catálogo</div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Estado
                </div>
                <div className="mt-2 text-sm text-gray-800">
                  {form.enabled ? "Activa" : "Inactiva"}
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Encabezado y pie de página
                </div>
                <div className="mt-2 text-sm text-gray-800">
                  {form.useHeader ? "Encabezado activo" : "Sin encabezado"} ·{" "}
                  {form.useFooter ? "Pie de página activo" : "Sin pie de página"}
                </div>
              </div>
            </div>
          </SectionCard>
        </div>
      )}

      {activeTab === "collection" && form.catalogConfig.collection && <CollectionCatalogControls value={form.catalogConfig.collection} saving={saving} onUploadingChange={setUploadingAppearance} onChange={patch=>updateCatalogConfig({collection:{...form.catalogConfig.collection,...patch}})}/>}
      {activeTab === "header" && (
        <CatalogAppearancePanel key="header" section="header" config={form.catalogConfig} onChange={updateAppearance} onUploadingChange={setUploadingAppearance}
          onApplyPreset={() => setForm(prev => ({ ...prev, catalogConfig: buildSafeCatalogConfig(applyCatalogEditorialPreset(prev.catalogConfig)) }))}
          onRestore={() => setForm(prev => ({ ...prev, catalogConfig: buildSafeCatalogConfig(restoreCatalogVisualBackup(prev.catalogConfig)) }))}
          content={<>
          <Select label="Formato del título" value={form.catalogConfig.titleMode} onChange={event=>updateCatalogConfig({titleMode:event.target.value})}>
            <option value="text">Texto</option><option value="image">Imagen</option>
          </Select>
          <div className="grid gap-4 md:grid-cols-2">
            <Toggle label="Mostrar distintivo del catálogo" checked={form.catalogConfig.showHeroBadge} onChange={value => updateCatalogConfig({ showHeroBadge: value })}/>
            <Input label="Texto del distintivo" value={form.catalogConfig.heroBadge} onChange={e => updateCatalogConfig({ heroBadge: e.target.value })}/>
            <Input
              label="Título del catálogo"
              value={form.catalogConfig.title}
              onChange={(e) => updateCatalogConfig({ title: e.target.value })}
              placeholder="Ej: Lo Nuevo"
            />

            <Input
              label="Subtítulo"
              value={form.catalogConfig.subtitle}
              onChange={(e) => updateCatalogConfig({ subtitle: e.target.value })}
              placeholder="Ej: Descubre nuestras novedades"
            />
          </div>

          <Textarea
            label="Descripción"
            value={form.catalogConfig.description}
            onChange={(e) => updateCatalogConfig({ description: e.target.value })}
            placeholder="Texto descriptivo del catálogo"
          />

          {form.catalogConfig.titleMode === "image" && (
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
              {(form.catalogConfig.titleImage) && <button type="button" className="rounded-xl border px-3 py-2 text-xs" onClick={() => updateCatalogConfig({ titleImage: "" })}>Quitar imagen</button>}

              <Input
                label="Descripción de la imagen"
                value={form.catalogConfig.titleImageAlt}
                onChange={(e) =>
                  updateCatalogConfig({ titleImageAlt: e.target.value })
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

              {titleImageFile ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                  Archivo listo para subir: <strong>{titleImageFile.name}</strong>
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="mb-3 text-sm font-semibold text-gray-800">
                Vista previa de imagen
              </div>

              <div
                data-admin-storefront-preview="true"
                className="flex min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4"
              >
                {titleImagePreview || form.catalogConfig.titleImage ? (
                  <img
                    src={titleImagePreview || form.catalogConfig.titleImage}
                    alt={form.catalogConfig.titleImageAlt || "Vista previa"}
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
          )}
          </>}/>
      )}

      {activeTab === "products" && (
        <div className="space-y-4">
          {productsError && <p role="alert" className="text-sm">{productsError} <button type="button" onClick={() => fetchProducts()}>Reintentar productos</button></p>}
          <div className="rounded-2xl border border-gray-200 bg-white p-3">
            <div className="flex flex-wrap gap-2">
              {PRODUCT_SUBTABS.map((tab) => (
                <MiniTabButton
                  key={tab.id}
                  active={productsSubtab === tab.id}
                  onClick={() => setProductsSubtab(tab.id)}
                >
                  {tab.label}
                </MiniTabButton>
              ))}
            </div>
          </div>

          {productsSubtab === "universe" && (
            <SectionCard
              title="Productos de este catálogo"
              text={page?.slug === "complementos" ? "Esta selección parte de la categoría Complementos. Los productos publicados aparecerán cuando los asignes a esa categoría. Puedes cambiar las categorías en el apartado Categorías." : "Define qué conjunto de productos puede mostrar esta página antes de aplicar filtros del cliente."}
            >
              <Select
                label="Origen de productos"
                value={form.catalogConfig.sourceMode}
                onChange={(e) =>
                  updateCatalogConfig({ sourceMode: e.target.value })
                }
              >
                <option value="all">Todos los productos</option>
                <option value="categories">Solo categorías permitidas</option>
                <option value="manual">Selección manual</option>
              </Select>

              <p className="text-sm text-gray-500">La tienda muestra únicamente productos activos, visibles y sin archivar.</p>
            </SectionCard>
          )}

          {productsSubtab === "categories" && (
            <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
              <SectionCard
                title="Categorías permitidas"
                text="Elige entre las categorías de tu catálogo."
              >
                {loadingProducts ? (
                  <div className="text-sm text-gray-500">Cargando categorías...</div>
                ) : (
                  <>
                    <CategoryPicker
                      label="Selecciona categorías permitidas"
                      helper="Elige las categorías cuyos productos se mostrarán en esta página."
                      options={allCategoryOptions}
                      selected={selectedAllowedCategories}
                      onToggle={(category) =>
                        toggleCsvCategoryField("allowedCategoriesText", category)
                      }
                      onClear={() => clearCsvCategoryField("allowedCategoriesText")}
                    />

                    <Textarea
                      label="Valor guardado (avanzado)"
                      value={form.catalogConfig.allowedCategoriesText}
                      onChange={(e) =>
                        updateCatalogConfig({
                          allowedCategoriesText: normalizeCsvText(e.target.value),
                        })
                      }
                      placeholder="Ej: Novedades, Destacados, Ofertas"
                    />
                  </>
                )}
              </SectionCard>

              <SectionCard
                title="Categorías iniciales"
                text="Con qué categorías debe abrir el catálogo cuando entre el usuario."
              >
                {loadingProducts ? (
                  <div className="text-sm text-gray-500">Cargando categorías...</div>
                ) : (
                  <>
                    <CategoryPicker
                      label="Selecciona categorías iniciales"
                      helper="Estas categorías estarán seleccionadas al abrir el catálogo."
                      options={allCategoryOptions}
                      selected={selectedInitialCategories}
                      onToggle={(category) =>
                        toggleCsvCategoryField("initialCategoriesText", category)
                      }
                      onClear={() => clearCsvCategoryField("initialCategoriesText")}
                    />

                    <Textarea
                      label="Valor guardado (avanzado)"
                      value={form.catalogConfig.initialCategoriesText}
                      onChange={(e) =>
                        updateCatalogConfig({
                          initialCategoriesText: normalizeCsvText(e.target.value),
                        })
                      }
                      placeholder="Ej: Categoría principal, Subcategoría"
                    />
                  </>
                )}
              </SectionCard>
            </div>
          )}

          {productsSubtab === "manual" && (
            <SectionCard
              title="Selección manual de productos"
              text="Busca los productos que quieres mostrar y añádelos a tu selección."
            >
              {loadingProducts ? (
                <div className="text-sm text-gray-500">Cargando productos...</div>
              ) : (
                <>
                  <ManualProductsPicker
                    allProducts={allProducts}
                    selectedKeys={selectedManualKeys}
                    onAdd={addManualProduct}
                    onRemove={removeManualProduct}
                    onSearch={fetchProducts}
                  />

                  <Textarea
                    label="Referencias de productos (avanzado)"
                    value={form.catalogConfig.manualProductIdsText}
                    onChange={(e) =>
                      updateCatalogConfig({
                        manualProductIdsText: normalizeCsvText(e.target.value),
                      })
                    }
                    placeholder="Ej: 67a1bc..., producto-destacado, 67f9de..."
                  />
                </>
              )}
            </SectionCard>
          )}
        </div>
      )}

      {["visual", "grid", "card-style", "filter-style", "motion"].includes(activeTab) && (
        <CatalogAppearancePanel key={activeTab} section={activeTab} config={form.catalogConfig} onChange={updateAppearance} onUploadingChange={setUploadingAppearance}
          onApplyPreset={() => setForm(prev => ({ ...prev, catalogConfig: buildSafeCatalogConfig(applyCatalogEditorialPreset(prev.catalogConfig)) }))}
          onRestore={() => setForm(prev => ({ ...prev, catalogConfig: buildSafeCatalogConfig(restoreCatalogVisualBackup(prev.catalogConfig)) }))}/>
      )}

      {activeTab === "empty" && (
        <SectionCard
          title="Estado vacío"
          text="Mensajes para cuando no haya productos visibles."
        >
          <Input
            label="Título cuando no hay resultados"
            value={form.catalogConfig.emptyTitle}
            onChange={(e) =>
              updateCatalogConfig({ emptyTitle: e.target.value })
            }
            placeholder="Ej: No se encontraron productos"
          />

          <Textarea
            label="Texto cuando no hay resultados"
            value={form.catalogConfig.emptyText}
            onChange={(e) =>
              updateCatalogConfig({ emptyText: e.target.value })
            }
            placeholder="Ej: Intenta cambiar los filtros para ver más resultados."
          />
        </SectionCard>
      )}
      </fieldset>
    </PageEditorWorkspace>
  );
}
