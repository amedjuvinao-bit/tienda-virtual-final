import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { adminFetch } from "../../lib/api";
import { API_BASE_URL } from "../../config/apiBaseUrl";
import { buildSafeCartPageConfig } from "../../components/cart/cartPageConfig";
import PageEditorWorkspace from "./workspace/PageEditorWorkspace";
import PageLoadState from "./workspace/PageLoadState";
import usePageDraft from "./workspace/usePageDraft";
import "./workspace/cartEditor.css";
import CartAppearanceControls from "./workspace/CartAppearanceControls";
const tabs = [
  { id: "header", label: "Encabezado", group: "content" },
  { id: "texts", label: "Textos y navegación", group: "content" },
  { id: "background", label: "Fondo y cristal", group: "design" },
  { id: "colors", label: "Colores", group: "design" },
  { id: "dimensions", label: "Medidas y formas", group: "design" },
  { id: "drawer", label: "Carrito lateral", group: "design" },
  { id: "visibility", label: "Visibilidad", group: "options" },
  { id: "settings", label: "Configuración", group: "settings" },
];
function normalizePage(page) {
  return {
    name: page.name || "Carrito",
    slug: "carrito",
    pageType: "cart-page",
    enabled: page.enabled !== false,
    useHeader:
      page.useHeader !== false && page.cartPageConfig?.showHeader !== false,
    useFooter:
      page.useFooter !== false && page.cartPageConfig?.showFooter !== false,
    blocks: page.blocks || [],
    cartPageConfig: buildSafeCartPageConfig(page.cartPageConfig),
  };
}
function sameValue(a, b) {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every((key) => sameValue(a[key], b[key]))
  );
}
export default function CartPageEditor() {
  const { id } = useParams(),
    navigate = useNavigate();
  const [form, setForm] = useState(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0),
    [saving, setSaving] = useState(false),
    [activeTab, setActiveTab] = useState("header"),
    [uploads, setUploads] = useState({});
  const mounted = useRef(false),
    saveRequest = useRef(null);
  const draft = usePageDraft(form);
  const uploading = Object.values(uploads).some(Boolean);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      saveRequest.current?.abort();
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    adminFetch(`${API_BASE_URL}/api/pages/${encodeURIComponent(id)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.message || "No se pudo cargar el carrito.");
        if (data.pageType !== "cart-page")
          throw new Error("Esta página no corresponde al carrito.");
        if (controller.signal.aborted) return;
        const loaded = normalizePage(data);
        setForm(loaded);
        draft.initialize(loaded);
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setError(failure.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [id, retry, draft.initialize]);
  const save = async () => {
    if (!form || saving || uploading) return;
    const payload = { ...normalizePage(form), name: "Carrito" };
    const controller = new AbortController();
    saveRequest.current = controller;
    setSaving(true);
    try {
      const response = await adminFetch(
        `${API_BASE_URL}/api/pages/${encodeURIComponent(id)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || "No se pudo guardar el carrito.");
      const saved = normalizePage(data);
      if (!sameValue(saved, payload))
        throw new Error(
          "El servidor no conservó todos los ajustes. Tus cambios siguen en el editor; vuelve a intentarlo.",
        );
      if (!mounted.current || controller.signal.aborted) return;
      setForm(saved);
      draft.markSaved(saved);
    } catch (failure) {
      if (mounted.current && !controller.signal.aborted)
        draft.notify(failure.message);
    } finally {
      if (mounted.current) setSaving(false);
    }
  };
  if (loading || error || !form)
    return (
      <PageLoadState
        loading={loading}
        error={error}
        onRetry={() => setRetry((value) => value + 1)}
        onBack={() => navigate("/admin/paginas")}
      />
    );
  return (
    <div className="cart-editor">
      <PageEditorWorkspace
        form={{
          ...form,
          cartPreviewMode: activeTab === "drawer" ? "drawer" : "page",
        }}
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onBack={() => draft.leave(() => navigate("/admin/paginas"))}
        onSave={save}
        saving={saving}
        uploading={uploading}
        draft={draft}
        pageTypeLabel="Carrito"
      >
        <fieldset disabled={saving} className="min-w-0">
          <CartAppearanceControls
            form={form}
            onChange={setForm}
            topic={activeTab}
            saving={saving}
            onUploadingChange={(key, busy) =>
              setUploads((current) => ({ ...current, [key]: busy }))
            }
          />
        </fieldset>
      </PageEditorWorkspace>
    </div>
  );
}
