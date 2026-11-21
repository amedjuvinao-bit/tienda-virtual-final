import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { adminFetch } from "../../../lib/api";
import { API_BASE_URL } from "../../../config/apiBaseUrl";
import PageEditorWorkspace from "./PageEditorWorkspace";
import PageLoadState from "./PageLoadState";
import usePageDraft from "./usePageDraft";
import "./cartEditor.css";
function sameValue(a, b) {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every((key) => sameValue(a[key], b[key]))
  );
}
export default function SystemPageEditor({
  pageType,
  label,
  normalizePage,
  tabs,
  resolveTabs,
  Controls,
  validatePage,
  usePageName = false,
  lockNavigationDuringUpload = false,
  className = "system-page-editor",
}) {
  const { id } = useParams(),
    navigate = useNavigate();
  const [form, setForm] = useState(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0),
    [saving, setSaving] = useState(false),
    [activeTab, setActiveTab] = useState(tabs[0].id),
    [uploads, setUploads] = useState({});
  const mounted = useRef(false),
    saveRequest = useRef(null);
  const draft = usePageDraft(form),
    uploading = Object.values(uploads).some(Boolean);
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
          throw new Error(data.message || "No se pudo cargar la página.");
        if (data.pageType !== pageType)
          throw new Error("La página no corresponde a este editor.");
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
  }, [id, pageType, normalizePage, retry, draft.initialize]);
  const save = async () => {
    if (!form || saving || uploading) return;
    const validationError = validatePage?.(form);
    if (validationError) {
      draft.notify(validationError);
      return;
    }
    const payload = normalizePage(form),
      controller = new AbortController();
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
        throw new Error(data.message || "No se pudo guardar la página.");
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
  const visibleTabs = resolveTabs ? resolveTabs(tabs, form) : tabs;
  const topic = visibleTabs.some(tab => tab.id === activeTab) ? activeTab : visibleTabs[0].id;
  return (
    <div className={className}>
      <PageEditorWorkspace
        form={usePageName ? form : { ...form, name: label }}
        tabs={visibleTabs}
        activeTab={topic}
        onTabChange={setActiveTab}
        onBack={() => draft.leave(() => navigate("/admin/paginas"))}
        onSave={save}
        saving={saving}
        uploading={uploading}
        draft={draft}
        pageTypeLabel={label}
        lockNavigationDuringUpload={lockNavigationDuringUpload}
      >
        <fieldset disabled={saving} className="min-w-0">
          <Controls
            form={form}
            onChange={setForm}
            topic={topic}
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
