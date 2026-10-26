import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { adminFetch } from "../../lib/api";
import { API_BASE_URL } from "../../config/apiBaseUrl";
import { buildSafeFavoritesPageConfig } from "../../components/favorites/favoritesPageConfig";
import PageEditorWorkspace from "./workspace/PageEditorWorkspace";
import PageLoadState from "./workspace/PageLoadState";
import usePageDraft from "./workspace/usePageDraft";
import "./workspace/cartEditor.css";
import FavoritesAppearanceControls from "./workspace/FavoritesAppearanceControls";
const tabs = [
  { id: "header", label: "Encabezado", group: "content" },
  { id: "texts", label: "Textos y navegación", group: "content" },
  { id: "background", label: "Fondo y cristal", group: "design" },
  { id: "colors", label: "Colores", group: "design" },
  { id: "cards", label: "Tarjetas y medidas", group: "design" },
  { id: "visibility", label: "Visibilidad", group: "options" },
  { id: "settings", label: "Configuración", group: "settings" },
];
function normalizePage(page) {
  return {
    name: page.name || "Favoritos",
    slug: "favoritos",
    pageType: "favorites-page",
    enabled: page.enabled !== false,
    useHeader:
      page.useHeader !== false &&
      page.favoritesPageConfig?.content?.showHeader !== false,
    useFooter:
      page.useFooter !== false &&
      page.favoritesPageConfig?.content?.showFooter !== false,
    blocks: page.blocks || [],
    favoritesPageConfig: buildSafeFavoritesPageConfig(page.favoritesPageConfig),
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
export default function FavoritesPageEditor() {
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
          throw new Error(data.message || "No se pudo cargar el favoritos.");
        if (data.pageType !== "favorites-page")
          throw new Error("Esta página no corresponde al favoritos.");
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
    const payload = { ...normalizePage(form), name: "Favoritos" };
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
        throw new Error(data.message || "No se pudo guardar el favoritos.");
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
    <div className="favorites-editor">
      <PageEditorWorkspace
        form={form}
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onBack={() => draft.leave(() => navigate("/admin/paginas"))}
        onSave={save}
        saving={saving}
        uploading={uploading}
        draft={draft}
        pageTypeLabel="Favoritos"
      >
        <fieldset disabled={saving} className="min-w-0">
          <FavoritesAppearanceControls
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
