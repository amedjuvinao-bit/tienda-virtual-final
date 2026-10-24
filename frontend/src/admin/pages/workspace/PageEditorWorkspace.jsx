import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  FileText,
  LayoutTemplate,
  Save,
  Settings2,
  SlidersHorizontal,
  Eye,
} from "lucide-react";
import PageLivePreview from "./PageLivePreview";
import { EditorSections } from "./EditorSection";
import "./pagesWorkspace.css";
const GROUPS = [
  { id: "content", label: "Contenido", icon: FileText },
  { id: "design", label: "Diseño", icon: LayoutTemplate },
  { id: "options", label: "Opciones", icon: SlidersHorizontal },
  { id: "settings", label: "Ajustes", icon: Settings2 },
];
export default function PageEditorWorkspace({
  form,
  tabs,
  activeTab,
  onTabChange,
  onBack,
  onSave,
  saving,
  uploading = false,
  draft,
  children,
  pageTypeLabel,
  scrollToFieldsOnTabChange = false,
}) {
  const root = useRef(null),
    toolbar = useRef(null);
  useEffect(() => {
    const adminHeader = root.current?.closest('main')?.querySelector('.admin-header-panel');
    const update = () => {
      root.current?.style.setProperty('--pages-toolbar-height', `${toolbar.current?.offsetHeight || 130}px`);
      const headerVisible = adminHeader && getComputedStyle(adminHeader).display !== 'none';
      const offset = headerVisible ? adminHeader.offsetHeight + (parseFloat(getComputedStyle(adminHeader).top) || 0) + 10 : 0;
      root.current?.style.setProperty('--pages-admin-offset', `${offset}px`);
    };
    const observer =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    if (toolbar.current) observer?.observe(toolbar.current);
    if (adminHeader) observer?.observe(adminHeader);
    window.addEventListener('resize', update);
    update();
    return () => { observer?.disconnect(); window.removeEventListener('resize', update); };
  }, []);
  const changeTab = (id) => {
    onTabChange(id);
    requestAnimationFrame(() => {
      const target = scrollToFieldsOnTabChange
        ? root.current?.querySelector('[data-editor-fields]')
        : root.current;
      target?.scrollIntoView?.({ block: "start", behavior: "auto" });
    });
  };
  const [view, setView] = useState("edit");
  const group = tabs.find((tab) => tab.id === activeTab)?.group || "content";
  const closePreview = useCallback(
    () => draft.setPreviewOpen(false),
    [draft.setPreviewOpen],
  );
  useEffect(() => {
    const guard = (event) => {
      const link = event.target.closest("a[href]");
      if (
        !draft.dirty ||
        !link ||
        link.target === "_blank" ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey
      )
        return;
      const target = new URL(link.href, window.location.href);
      if (
        target.pathname === location.pathname &&
        target.search === location.search
      )
        return;
      if (
        !window.confirm(
          "Tienes cambios sin guardar. ¿Quieres salir y descartarlos?",
        )
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    document.addEventListener("click", guard, true);
    return () => document.removeEventListener("click", guard, true);
  }, [draft.dirty]);
  return (
    <div ref={root} className="pages-workspace" data-view={view}>
      <header ref={toolbar} className="pages-workspace__bar">
        <div>
          <button className="pages-back" disabled={saving} onClick={onBack}>
            <ArrowLeft size={15} /> Páginas
          </button>
          <p className="pages-workspace__breadcrumb">
            {pageTypeLabel}
            <ChevronRight size={12} />
            <span>{tabs.find((tab) => tab.id === activeTab)?.label}</span>
          </p>
          <h1>{form.name || "Página sin nombre"}</h1>
        </div>
        <div className="pages-workspace__actions">
          <span className="pages-draft-state" role="status">
            {saving ? (
              "Guardando…"
            ) : uploading ? (
              "Subiendo imagen…"
            ) : draft.dirty ? (
              "Cambios sin guardar"
            ) : (
              <>
                <Check size={14} /> Todo guardado
              </>
            )}
          </span>
          <button
            className="pages-button"
            onClick={() => draft.setPreviewOpen(true)}
          >
            <Eye size={16} /> Vista previa
          </button>
          <button
            className="pages-button pages-button--primary"
            disabled={saving || uploading || !draft.dirty}
            onClick={onSave}
          >
            <Save size={16} />
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </header>
      {draft.notice && (
        <p
          className="pages-feedback"
          role={draft.notice.tone === "error" ? "alert" : "status"}
          data-tone={draft.notice.tone}
        >
          {draft.notice.text}
        </p>
      )}
      <div
        className="pages-workspace__switch"
        role="group"
        aria-label="Modo del editor"
      >
        <button aria-pressed={view === "edit"} onClick={() => setView("edit")}>
          Editar
        </button>
        <button
          aria-pressed={view === "preview"}
          onClick={() => setView("preview")}
        >
          Vista previa
        </button>
      </div>
      <div className="pages-workspace__grid">
        <nav className="pages-workspace__nav" aria-label="Áreas de edición">
          {GROUPS.map(({ id, label, icon: Icon }) => {
            const items = tabs.filter((tab) => tab.group === id);
            if (!items.length) return null;
            return (
              <div key={id}>
                <button
                  className="pages-workspace__group"
                  aria-expanded={group === id}
                  disabled={saving}
                  onClick={() => {
                    changeTab(items[0].id);
                    setView("edit");
                  }}
                >
                  <Icon size={17} />
                  {label}
                </button>
                {group === id && (
                  <div className="pages-workspace__subnav">
                    {items.map((tab) => (
                      <button
                        key={tab.id}
                        aria-current={activeTab === tab.id ? "step" : undefined}
                        disabled={saving}
                        onClick={() => changeTab(tab.id)}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
        <div
          className="pages-workspace__form"
          data-editor-fields
          key={activeTab}
        >
          <EditorSections>{children}</EditorSections>
        </div>
        <aside className="pages-workspace__preview">
          <PageLivePreview
            draft={form}
            expanded={draft.previewOpen}
            onExpand={() => draft.setPreviewOpen(true)}
            onClose={closePreview}
          />
        </aside>
      </div>
    </div>
  );
}
