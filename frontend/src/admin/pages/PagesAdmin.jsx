// src/admin/pages/PagesAdmin.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
const SYSTEM_CART_SLUG = "carrito";
const SYSTEM_CART_PAGE_TYPE = "cart-page";
const SYSTEM_CHECKOUT_SLUG = "checkout";
const SYSTEM_CHECKOUT_PAGE_TYPE = "checkout-page";
const SYSTEM_THANKS_SLUG = "gracias";
const SYSTEM_THANKS_PAGE_TYPE = "thanks-page";
const SYSTEM_FAVORITES_SLUG = "favoritos";
const SYSTEM_FAVORITES_PAGE_TYPE = "favorites-page";
const SYSTEM_NOT_FOUND_SLUG = "not-found";
const SYSTEM_NOT_FOUND_PAGE_TYPE = "notfound-page";

const Input = ({ label, ...rest }) => (
  <label className="block min-w-0">
    <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
    <input
      className="w-full min-w-0 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-pink-300 focus:ring-2 focus:ring-pink-200"
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

const PageTypeSelector = ({ value, onChange }) => (
  <div className="rounded-2xl border border-gray-200 bg-white px-4 py-4">
    <div className="mb-3 text-sm font-medium text-gray-700">Tipo de página</div>

    <div className="space-y-3">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="radio"
          name="pageType"
          checked={value === "custom"}
          onChange={() => onChange("custom")}
          className="mt-1 h-4 w-4 shrink-0 accent-pink-600"
        />
        <div>
          <div className="text-sm font-medium text-gray-800">
            Página personalizada
          </div>
          <div className="text-xs leading-5 text-gray-500">
            Usa el editor actual por bloques: banner, tendencia, look, categorías,
            complementos, Instagram, TikTok e información.
          </div>
        </div>
      </label>

      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="radio"
          name="pageType"
          checked={value === "catalog"}
          onChange={() => onChange("catalog")}
          className="mt-1 h-4 w-4 shrink-0 accent-pink-600"
        />
        <div>
          <div className="text-sm font-medium text-gray-800">
            Página catálogo
          </div>
          <div className="text-xs leading-5 text-gray-500">
            Crea una página tipo catálogo como “Lo Nuevo”, con editor separado y
            configuración enfocada en productos.
          </div>
        </div>
      </label>

      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="radio"
          name="pageType"
          checked={value === "product-detail"}
          onChange={() => onChange("product-detail")}
          className="mt-1 h-4 w-4 shrink-0 accent-pink-600"
        />
        <div>
          <div className="text-sm font-medium text-gray-800">
            Página detalle de producto
          </div>
          <div className="text-xs leading-5 text-gray-500">
            Crea un molde especializado para la vista de detalle del producto, con
            editor separado y control total de estructura y estética.
          </div>
        </div>
      </label>
    </div>
  </div>
);

const InfoCard = ({ title, text }) => (
  <div className="rounded-2xl border border-pink-100 bg-gradient-to-r from-pink-50 to-rose-50 px-4 py-3">
    <div className="text-sm font-semibold text-pink-700">{title}</div>
    <p className="mt-1 text-sm leading-6 text-gray-600">{text}</p>
  </div>
);

const EmptyState = () => (
  <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center">
    <div className="text-base font-semibold text-gray-800">Aún no hay páginas creadas</div>
    <p className="mt-2 text-sm text-gray-500">
      Crea tu primera página dinámica para luego agregarle bloques como banner,
      tendencia, look, categorías, Instagram, TikTok e información.
    </p>
  </div>
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

export default function PagesAdmin() {
  const navigate = useNavigate();

  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingPageId, setDeletingPageId] = useState("");

  const [form, setForm] = useState({
    name: "",
    slug: "",
    enabled: true,
    useHeader: true,
    useFooter: true,
    pageType: "custom",
  });

  const sortedPages = useMemo(() => {
    return [...pages].sort((a, b) => {
      const aIsCart =
        String(a?.slug || "").toLowerCase() === SYSTEM_CART_SLUG ||
        String(a?.pageType || "").toLowerCase() === SYSTEM_CART_PAGE_TYPE;
      const bIsCart =
        String(b?.slug || "").toLowerCase() === SYSTEM_CART_SLUG ||
        String(b?.pageType || "").toLowerCase() === SYSTEM_CART_PAGE_TYPE;

      const aIsCheckout =
        String(a?.slug || "").toLowerCase() === SYSTEM_CHECKOUT_SLUG ||
        String(a?.pageType || "").toLowerCase() === SYSTEM_CHECKOUT_PAGE_TYPE;
      const bIsCheckout =
        String(b?.slug || "").toLowerCase() === SYSTEM_CHECKOUT_SLUG ||
        String(b?.pageType || "").toLowerCase() === SYSTEM_CHECKOUT_PAGE_TYPE;

      const aIsThanks =
        String(a?.slug || "").toLowerCase() === SYSTEM_THANKS_SLUG ||
        String(a?.pageType || "").toLowerCase() === SYSTEM_THANKS_PAGE_TYPE;
      const bIsThanks =
        String(b?.slug || "").toLowerCase() === SYSTEM_THANKS_SLUG ||
        String(b?.pageType || "").toLowerCase() === SYSTEM_THANKS_PAGE_TYPE;

      const aIsFavorites =
        String(a?.slug || "").toLowerCase() === SYSTEM_FAVORITES_SLUG ||
        String(a?.pageType || "").toLowerCase() === SYSTEM_FAVORITES_PAGE_TYPE;
      const bIsFavorites =
        String(b?.slug || "").toLowerCase() === SYSTEM_FAVORITES_SLUG ||
        String(b?.pageType || "").toLowerCase() === SYSTEM_FAVORITES_PAGE_TYPE;

      const aIsNotFound =
        String(a?.slug || "").toLowerCase() === SYSTEM_NOT_FOUND_SLUG ||
        String(a?.pageType || "").toLowerCase() === SYSTEM_NOT_FOUND_PAGE_TYPE;
      const bIsNotFound =
        String(b?.slug || "").toLowerCase() === SYSTEM_NOT_FOUND_SLUG ||
        String(b?.pageType || "").toLowerCase() === SYSTEM_NOT_FOUND_PAGE_TYPE;

      const aIsSystemPage = aIsCart || aIsCheckout || aIsThanks || aIsFavorites || aIsNotFound;
      const bIsSystemPage = bIsCart || bIsCheckout || bIsThanks || bIsFavorites || bIsNotFound;

      if (aIsSystemPage && !bIsSystemPage) return -1;
      if (!aIsSystemPage && bIsSystemPage) return 1;

      if (aIsCart && (bIsCheckout || bIsThanks || bIsFavorites || bIsNotFound)) return -1;
      if (aIsCheckout && (bIsThanks || bIsFavorites || bIsNotFound)) return -1;
      if (aIsCheckout && bIsCart) return 1;
      if (aIsThanks && (bIsFavorites || bIsNotFound)) return -1;
      if (aIsThanks && (bIsCart || bIsCheckout)) return 1;
      if (aIsFavorites && bIsNotFound) return -1;
      if (aIsFavorites && (bIsCart || bIsCheckout || bIsThanks)) return 1;
      if (aIsNotFound && (bIsCart || bIsCheckout || bIsThanks || bIsFavorites)) return 1;

      const da = new Date(a?.createdAt || 0).getTime();
      const db = new Date(b?.createdAt || 0).getTime();
      return db - da;
    });
  }, [pages]);

  const loadPages = async () => {
    try {
      setLoading(true);

      const res = await fetch(`${API_BASE}/api/pages`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      setPages(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error cargando páginas:", error);
      alert("No se pudieron cargar las páginas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPages();
  }, []);

  const updateForm = (patch) => {
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const handleNameChange = (value) => {
    setForm((prev) => {
      const nextName = value;
      const currentSlug = String(prev.slug || "").trim();
      const autoSlug = slugify(nextName);

      return {
        ...prev,
        name: nextName,
        slug: currentSlug ? currentSlug : autoSlug,
      };
    });
  };

  const handleCreatePage = async (e) => {
    e.preventDefault();

    const name = String(form.name || "").trim();
    const slug = slugify(form.slug || form.name);

    const allowedPageTypes = ["custom", "catalog", "product-detail"];
    const pageType = allowedPageTypes.includes(form.pageType)
      ? form.pageType
      : "custom";

    if (!name) {
      alert("El nombre de la página es obligatorio.");
      return;
    }

    if (!slug) {
      alert("El slug de la página es obligatorio.");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        name,
        slug,
        pageType,
        enabled: form.enabled,
        useHeader: form.useHeader,
        useFooter: form.useFooter,
        blocks: [],
      };

      if (pageType === "catalog") {
        payload.catalogConfig = {};
      }

      if (pageType === "product-detail") {
        payload.productDetailConfig = {};
      }

      const res = await fetch(`${API_BASE}/api/pages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.message || `HTTP ${res.status}`);
      }

      setPages((prev) => [data, ...prev]);

      setForm({
        name: "",
        slug: "",
        enabled: true,
        useHeader: true,
        useFooter: true,
        pageType: "custom",
      });

      alert("Página creada correctamente ✅");
    } catch (error) {
      console.error("Error creando página:", error);
      alert(error.message || "No se pudo crear la página.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePage = async (page) => {
    const pageId = String(page?._id || "");
    if (!pageId) return;

    const isSystemCartPage =
      String(page?.slug || "").toLowerCase() === SYSTEM_CART_SLUG ||
      String(page?.pageType || "").toLowerCase() === SYSTEM_CART_PAGE_TYPE;

    const isSystemCheckoutPage =
      String(page?.slug || "").toLowerCase() === SYSTEM_CHECKOUT_SLUG ||
      String(page?.pageType || "").toLowerCase() === SYSTEM_CHECKOUT_PAGE_TYPE;

    const isSystemThanksPage =
      String(page?.slug || "").toLowerCase() === SYSTEM_THANKS_SLUG ||
      String(page?.pageType || "").toLowerCase() === SYSTEM_THANKS_PAGE_TYPE;

    const isSystemFavoritesPage =
      String(page?.slug || "").toLowerCase() === SYSTEM_FAVORITES_SLUG ||
      String(page?.pageType || "").toLowerCase() === SYSTEM_FAVORITES_PAGE_TYPE;

    const isSystemNotFoundPage =
      String(page?.slug || "").toLowerCase() === SYSTEM_NOT_FOUND_SLUG ||
      String(page?.pageType || "").toLowerCase() === SYSTEM_NOT_FOUND_PAGE_TYPE;

    if (isSystemCartPage || isSystemCheckoutPage || isSystemThanksPage || isSystemFavoritesPage || isSystemNotFoundPage) {
      alert("Las páginas Carrito, Checkout, Gracias, Favoritos y Not Found son fijas del sistema y no se pueden eliminar.");
      return;
    }

    const pageName = String(page?.name || "esta página").trim();

    const confirmed = window.confirm(
      `¿Seguro que deseas eliminar "${pageName}"?\n\nEsta acción no se puede deshacer.`
    );

    if (!confirmed) return;

    try {
      setDeletingPageId(pageId);

      const res = await fetch(`${API_BASE}/api/pages/${pageId}`, {
        method: "DELETE",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.message || `HTTP ${res.status}`);
      }

      setPages((prev) => prev.filter((item) => String(item?._id) !== pageId));
      alert("Página eliminada correctamente ✅");
    } catch (error) {
      console.error("Error eliminando página:", error);
      alert(error.message || "No se pudo eliminar la página.");
    } finally {
      setDeletingPageId("");
    }
  };

  const goToEditor = (page) => {
    if (!page?._id) return;

    const pageType = String(page?.pageType || "custom").toLowerCase();

    if (pageType === "catalog") {
      navigate(`/admin/catalogo/${page._id}`);
      return;
    }

    if (pageType === "product-detail") {
      navigate(`/admin/product-detail/${page._id}`);
      return;
    }

    if (pageType === "cart-page") {
      navigate(`/admin/cart-page/${page._id}`);
      return;
    }

    if (pageType === "checkout-page") {
      navigate(`/admin/checkout-page/${page._id}`);
      return;
    }

    if (pageType === "thanks-page") {
      navigate(`/admin/thanks-page/${page._id}`);
      return;
    }

    if (pageType === "favorites-page") {
      navigate(`/admin/favorites-page/${page._id}`);
      return;
    }

    if (pageType === "notfound-page") {
      navigate(`/admin/notfound-page/${page._id}`);
      return;
    }

    navigate(`/admin/paginas/${page._id}`);
  };

  return (
    <div className="min-w-0 space-y-6">
      <div className="rounded-3xl border border-gray-200 bg-white p-4 md:p-5">
        <div className="mb-5">
          <h1 className="text-2xl font-semibold text-gray-900">Páginas dinámicas</h1>
          <p className="mt-1 text-sm text-gray-500">
            Crea páginas nuevas independientes del Home. Después podrás agregarles
            bloques con configuración propia.
          </p>
        </div>

        <div className="mb-6">
          <InfoCard
            title="Cómo funciona"
            text="Cada página creada aquí tendrá su propia configuración y su propio editor según el tipo de página. Las páginas Carrito, Checkout, Gracias, Favoritos y Not Found aparecerán aquí como páginas fijas del sistema: se pueden editar, pero no crear ni eliminar."
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
          <section className="rounded-3xl border border-gray-200 bg-gray-50 p-4">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Crear página</h2>
              <p className="mt-1 text-sm text-gray-500">
                Crea la base de la página. En el siguiente paso se le agregará el
                editor correcto según el tipo seleccionado.
              </p>
            </div>

            <form onSubmit={handleCreatePage} className="space-y-4">
              <Input
                label="Nombre de la página"
                value={form.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Ej: Bautizos"
              />

              <Input
                label="Slug / ruta"
                value={form.slug}
                onChange={(e) => updateForm({ slug: slugify(e.target.value) })}
                placeholder="Ej: bautizos"
              />

              <PageTypeSelector
                value={form.pageType}
                onChange={(value) => updateForm({ pageType: value })}
              />

              <Toggle
                label="Página activa"
                checked={form.enabled}
                onChange={(value) => updateForm({ enabled: value })}
              />

              <Toggle
                label="Usar header"
                checked={form.useHeader}
                onChange={(value) => updateForm({ useHeader: value })}
              />

              <Toggle
                label="Usar footer"
                checked={form.useFooter}
                onChange={(value) => updateForm({ useFooter: value })}
              />

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-xl bg-pink-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-pink-700 disabled:opacity-60"
              >
                {saving ? "Creando..." : "Crear página"}
              </button>
            </form>
          </section>

          <section className="min-w-0 rounded-3xl border border-gray-200 bg-white p-4 md:p-5">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Listado de páginas</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Aquí verás las páginas creadas. Luego conectaremos el editor correcto
                  según el tipo de página.
                </p>
              </div>

              <button
                type="button"
                onClick={loadPages}
                className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 transition hover:bg-gray-50"
              >
                Recargar
              </button>
            </div>

            {loading ? (
              <div className="rounded-2xl border bg-gray-50 p-6 text-sm text-gray-500">
                Cargando páginas...
              </div>
            ) : sortedPages.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="space-y-3">
                {sortedPages.map((page) => {
                  const pageType = String(page?.pageType || "custom").toLowerCase();

                  const isSystemCartPage =
                    String(page?.slug || "").toLowerCase() === SYSTEM_CART_SLUG ||
                    pageType === SYSTEM_CART_PAGE_TYPE;

                  const isSystemCheckoutPage =
                    String(page?.slug || "").toLowerCase() === SYSTEM_CHECKOUT_SLUG ||
                    pageType === SYSTEM_CHECKOUT_PAGE_TYPE;

                  const isSystemThanksPage =
                    String(page?.slug || "").toLowerCase() === SYSTEM_THANKS_SLUG ||
                    pageType === SYSTEM_THANKS_PAGE_TYPE;

                  const isSystemFavoritesPage =
                    String(page?.slug || "").toLowerCase() === SYSTEM_FAVORITES_SLUG ||
                    pageType === SYSTEM_FAVORITES_PAGE_TYPE;

                  const isSystemNotFoundPage =
                    String(page?.slug || "").toLowerCase() === SYSTEM_NOT_FOUND_SLUG ||
                    pageType === SYSTEM_NOT_FOUND_PAGE_TYPE;

                  const isSystemFixedPage =
                    isSystemCartPage || isSystemCheckoutPage || isSystemThanksPage || isSystemFavoritesPage || isSystemNotFoundPage;

                  const pageTypeLabel =
                    pageType === "catalog"
                      ? "Catálogo"
                      : pageType === "product-detail"
                      ? "Detalle de producto"
                      : pageType === "cart-page"
                      ? "Carrito"
                      : pageType === "checkout-page"
                      ? "Checkout"
                      : pageType === "thanks-page"
                      ? "Gracias"
                      : pageType === "favorites-page"
                      ? "Favoritos"
                      : pageType === "notfound-page"
                      ? "Not Found"
                      : "Personalizada";

                  const isDeleting = deletingPageId === String(page?._id || "");

                  return (
                    <div
                      key={page?._id}
                      className={`rounded-2xl border p-4 ${
                        isSystemFixedPage
                          ? "border-pink-200 bg-pink-50/40"
                          : "border-gray-200 bg-white"
                      }`}
                    >
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-base font-semibold text-gray-900">
                              {page?.name || "Sin nombre"}
                            </div>

                            {isSystemFixedPage ? (
                              <span className="inline-flex rounded-full border border-pink-200 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-pink-700">
                                Página fija
                              </span>
                            ) : null}
                          </div>

                          <div className="mt-1 break-all text-xs font-mono text-gray-500">
                            {isSystemFixedPage
                              ? `/${page?.slug || ""}`
                              : `/pagina/${page?.slug || ""}`}
                          </div>

                          <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-gray-600 md:grid-cols-5">
                            <div>
                              <span className="font-medium text-gray-800">Tipo:</span>{" "}
                              {pageTypeLabel}
                            </div>
                            <div>
                              <span className="font-medium text-gray-800">Estado:</span>{" "}
                              {page?.enabled === false ? "Inactiva" : "Activa"}
                            </div>
                            <div>
                              <span className="font-medium text-gray-800">Header:</span>{" "}
                              {page?.useHeader === false ? "No" : "Sí"}
                            </div>
                            <div>
                              <span className="font-medium text-gray-800">Footer:</span>{" "}
                              {page?.useFooter === false ? "No" : "Sí"}
                            </div>
                            <div>
                              <span className="font-medium text-gray-800">Bloques:</span>{" "}
                              {isSystemFixedPage
                                ? "Sistema"
                                : Array.isArray(page?.blocks)
                                ? page.blocks.length
                                : 0}
                            </div>
                          </div>
                        </div>

                        <div className="flex shrink-0 flex-wrap justify-start gap-2 xl:justify-end">
                          <button
                            type="button"
                            onClick={() => goToEditor(page)}
                            className="rounded-xl border border-pink-300 px-4 py-2 text-sm font-medium text-pink-700 transition hover:bg-pink-50"
                          >
                            Editar
                          </button>

                          {!isSystemFixedPage ? (
                            <button
                              type="button"
                              onClick={() => handleDeletePage(page)}
                              disabled={isDeleting}
                              className="rounded-xl border border-red-300 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-60"
                            >
                              {isDeleting ? "Eliminando..." : "Eliminar"}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}