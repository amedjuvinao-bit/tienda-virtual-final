import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  ExternalLink,
  FileText,
  LockKeyhole,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { adminFetch } from "../../lib/api";
import { API_BASE_URL } from "../../config/apiBaseUrl";
import useAdminPermissions from "../security/useAdminPermissions";
import PageCreateDialog from "./workspace/PageCreateDialog";
import {
  filterPages,
  pageEditorPath,
  pageMeta,
  pagePublicPath,
  sortPages,
} from "./workspace/pageModel";
import "./workspace/pagesWorkspace.css";

export default function PagesAdmin() {
  const navigate = useNavigate(),
    { can } = useAdminPermissions();
  const [pages, setPages] = useState([]),
    [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState(""),
    [type, setType] = useState("all"),
    [state, setState] = useState("all");
  const [creating, setCreating] = useState(false),
    [deleting, setDeleting] = useState(""),
    [message, setMessage] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const requestId = useRef(0);
  const load = useCallback(async () => {
    const sequence = ++requestId.current;
    setLoading(true);
    setLoadError("");
    try {
      const response = await adminFetch(`${API_BASE_URL}/api/pages`);
      if (!response.ok) throw new Error("No se pudieron cargar las páginas.");
      const data = await response.json();
      if (sequence === requestId.current)
        setPages(Array.isArray(data) ? data : []);
    } catch (err) {
      if (sequence === requestId.current) setLoadError(err.message);
    } finally {
      if (sequence === requestId.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
    return () => {
      requestId.current++;
    };
  }, [load]);
  const closeCreate = useCallback(() => setCreating(false), []);
  const visiblePages = useMemo(
    () => filterPages(sortPages(pages), query, type, state),
    [pages, query, type, state],
  );
  const active = pages.filter((page) => page.enabled !== false).length;
  const create = async (form) => {
    if (!can("pages:create"))
      throw new Error("Tu perfil no permite crear páginas.");
    const payload = {
      ...form,
      blocks: [],
      ...(form.pageType === "catalog"
        ? { catalogConfig: {} }
        : form.pageType === "product-detail"
          ? { productDetailConfig: {} }
          : {}),
    };
    const response = await adminFetch(`${API_BASE_URL}/api/pages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(data.message || "No se pudo crear la página.");
    if (!data._id)
      throw new Error(
        "La respuesta no contiene la página creada. Recarga el listado antes de intentarlo otra vez.",
      );
    setCreating(false);
    navigate(pageEditorPath(data));
  };
  const remove = async (page) => {
    if (!can("pages:delete") || pageMeta(page).system || deleting) return;
    setDeleting(page._id);
    setMessage(null);
    try {
      const response = await adminFetch(
        `${API_BASE_URL}/api/pages/${encodeURIComponent(page._id)}`,
        { method: "DELETE" },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.message || "No se pudo eliminar la página.");
      setPages((current) => current.filter((item) => item._id !== page._id));
      setDeleteTarget(null);
      setMessage({ text: "Página eliminada.", tone: "success" });
    } catch (err) {
      setMessage({ text: err.message, tone: "error" });
    } finally {
      setDeleting("");
    }
  };
  return (
    <div className="pages-manager">
      <header className="pages-manager__header">
        <div>
          <span className="pages-eyebrow">Tu sitio, organizado</span>
          <h1>Páginas de tu tienda</h1>
          <p>
            Encuentra una página, ajusta su contenido y comprueba cómo la verán
            tus clientes.
          </p>
        </div>
        {can("pages:create") && (
          <button
            className="pages-button pages-button--primary"
            onClick={() => setCreating(true)}
          >
            <Plus size={18} /> Nueva página
          </button>
        )}
      </header>
      <div
        className="pages-manager__summary"
        aria-label="Configuración general del sitio"
      >
        <a className="pages-button" href="/admin/apariencia">
          Inicio, encabezado y pie → Apariencia
        </a>
        <span>
          Las demás páginas se configuran en el listado. Las devoluciones se
          abren desde una compra.
        </span>
      </div>
      <div className="pages-manager__summary" aria-label="Resumen de páginas">
        <span>
          <strong>{pages.length}</strong> páginas
        </span>
        <span>
          <i /> {active} activas
        </span>
        <span>{pages.length - active} desactivadas</span>
      </div>
      <section className="pages-list" aria-label="Administrar páginas">
        <div className="pages-list__tools">
          <label className="pages-search">
            <Search size={18} />
            <input
              aria-label="Buscar páginas"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por nombre o dirección…"
            />
            {query && (
              <button
                aria-label="Limpiar búsqueda"
                onClick={() => setQuery("")}
              >
                <X size={16} />
              </button>
            )}
          </label>
          <label className="pages-filter">
            <span>Tipo</span>
            <select
              aria-label="Filtrar por tipo"
              value={type}
              onChange={(event) => setType(event.target.value)}
            >
              <option value="all">Todas las páginas</option>
              <option value="system">Del sistema</option>
              <option value="custom">Personalizables</option>
              <option value="catalog">Catálogos</option>
              <option value="information">Informativas</option>
              <option value="product-detail">Detalle de producto</option>
            </select>
          </label>
          <label className="pages-filter">
            <span>Estado</span>
            <select
              aria-label="Filtrar por estado"
              value={state}
              onChange={(event) => setState(event.target.value)}
            >
              <option value="all">Todos</option>
              <option value="active">Activas</option>
              <option value="inactive">Desactivadas</option>
            </select>
          </label>
          <button
            className="pages-icon-button"
            aria-label="Actualizar páginas"
            disabled={loading}
            onClick={load}
          >
            <RefreshCw size={18} className={loading ? "pages-spin" : ""} />
          </button>
        </div>
        {message && (
          <p
            role={message.tone === "error" ? "alert" : "status"}
            className="pages-feedback"
            data-tone={message.tone}
          >
            {message.text}
          </p>
        )}
        {loadError ? (
          <div className="pages-empty" role="alert">
            <h2>No pudimos cargar tus páginas</h2>
            <p>{loadError}</p>
            <button className="pages-button" onClick={load}>
              Volver a intentar
            </button>
          </div>
        ) : loading ? (
          <p role="status" className="pages-empty">
            Cargando páginas…
          </p>
        ) : !visiblePages.length ? (
          <div className="pages-empty">
            <FileText size={32} />
            <h2>
              {pages.length
                ? "No hay coincidencias"
                : "Tu próxima página empieza aquí"}
            </h2>
            <p>
              {pages.length
                ? "Prueba otro nombre o cambia los filtros."
                : "Crea una página personalizada, un catálogo o una ficha de producto."}
            </p>
            {pages.length ? (
              <button
                className="pages-button"
                onClick={() => {
                  setQuery("");
                  setType("all");
                  setState("all");
                }}
              >
                Limpiar filtros
              </button>
            ) : (
              can("pages:create") && (
                <button
                  className="pages-button pages-button--primary"
                  onClick={() => setCreating(true)}
                >
                  Crear mi primera página
                </button>
              )
            )}
          </div>
        ) : (
          <>
            <div className="pages-list__columns" aria-hidden="true">
              <span>Página</span>
              <span>Tipo</span>
              <span>Estado</span>
              <span>Acciones</span>
            </div>
            <ul className="pages-list__rows">
              {visiblePages.map((page) => {
                const meta = pageMeta(page);
                return (
                  <li key={page._id} className="pages-row">
                    <div className="pages-row__identity">
                      <span className="pages-row__icon">
                        <FileText size={21} />
                      </span>
                      <div>
                        <h2>{page.name || "Sin nombre"}</h2>
                        <p>{pagePublicPath(page)}</p>
                        {meta.system && (
                          <small>
                            <LockKeyhole size={11} /> Página del sistema
                          </small>
                        )}
                      </div>
                    </div>
                    <span className="pages-row__type">{meta.label}</span>
                    <span
                      className="pages-state"
                      data-active={page.enabled !== false}
                    >
                      <i />
                      {page.enabled === false ? "Desactivada" : "Activa"}
                    </span>
                    <div className="pages-row__actions">
                      {can("pages:update") && (
                        <button
                          className="pages-button pages-button--edit"
                          aria-label={`Editar ${page.name}`}
                          onClick={() => navigate(pageEditorPath(page))}
                        >
                          <Pencil size={15} /> Editar
                        </button>
                      )}
                      {!meta.requiresOrder && (
                        <a
                          className="pages-icon-button"
                          href={pagePublicPath(page)}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Ver ${page.name}`}
                          title="Ver página pública"
                        >
                          <ExternalLink size={17} />
                        </a>
                      )}
                      {meta.requiresOrder && (
                        <span
                          title="Se abre desde el enlace seguro de una compra. Usa la vista previa del editor para revisar el diseño."
                          className="pages-row__type"
                        >
                          Acceso desde una compra
                        </span>
                      )}
                      {!meta.system && can("pages:delete") && (
                        <button
                          className="pages-icon-button pages-danger"
                          aria-label={`Eliminar ${page.name}`}
                          onClick={() => setDeleteTarget(page)}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                    {deleteTarget?._id === page._id && (
                      <div
                        className="pages-delete"
                        role="group"
                        aria-label={`Confirmar eliminación de ${page.name}`}
                      >
                        <p>
                          ¿Eliminar esta página? Esta acción no se puede
                          deshacer.
                        </p>
                        <button
                          className="pages-button"
                          disabled={!!deleting}
                          onClick={() => setDeleteTarget(null)}
                        >
                          Cancelar
                        </button>
                        <button
                          className="pages-button pages-danger"
                          disabled={!!deleting}
                          onClick={() => remove(page)}
                        >
                          {deleting ? "Eliminando…" : "Sí, eliminar"}
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            <footer className="pages-list__footer">
              {visiblePages.length} de {pages.length} páginas{" "}
              <span>
                Las páginas del sistema se pueden personalizar y conservan su
                función en la tienda.
              </span>
            </footer>
          </>
        )}
      </section>
      {creating && <PageCreateDialog onClose={closeCreate} onCreate={create} />}
    </div>
  );
}
