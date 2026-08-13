// src/admin/FavoritosAdmin.jsx
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import api from "../lib/api";
import useAdminPermissions from "./security/useAdminPermissions";

/* ---------- Helpers ---------- */
function money(n) {
  const v = Number(n || 0);
  return v.toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });
}

function formatDateSafe(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
}

function aliasFromSession(sessionId) {
  if (!sessionId) return "Cliente #----";
  const tail = String(sessionId).slice(-4).toUpperCase();
  return `Cliente #${tail}`;
}

// Extras de producto
function readSku(p, it) {
  return (p?.variantSku ?? p?.sku ?? p?.skun ?? it?.sku ?? "—") || "—";
}
function readCategory(p, it) {
  const c = p?.category ?? it?.category;
  if (!c) return "—";
  if (typeof c === "string") return c;
  return c?.name || "—";
}
function readStock(p) {
  if (p?.inventoryTracked === false) return null;
  if (Number.isFinite(Number(p?.availableStock))) return Number(p.availableStock);
  if (Array.isArray(p?.inventory) && p.inventory.length) {
    return p.inventory.reduce(
      (acc, r) => acc + Number(r?.stock ?? r?.qty ?? r?.quantity ?? 0),
      0
    );
  }
  return Number(p?.stock ?? 0);
}

/* =========================================================
   Componente: FavoritosAdmin
   ========================================================= */
export default function FavoritosAdmin() {
  const { can } = useAdminPermissions();
  const canDelete = can("favorites:delete");
  // filtros y paginación
  const [q, setQ] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // datos listados
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  // modal detalle
  const [showModal, setShowModal] = useState(false);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving, setSaving] = useState(false);

  // construir querystring según filtros
  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", page);
    params.set("limit", limit);
    if (q.trim()) params.set("q", q.trim());
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    return params.toString();
  }, [page, limit, q, dateFrom, dateTo]);

  // cargar lista
  const load = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/api/favorites/admin?${queryString}`);
      setRows(Array.isArray(data?.data) ? data.data : []);
      setTotal(Number(data?.total || 0));
      setTotalPages(Number(data?.totalPages || 1));
    } catch (e) {
      toast.error("Error cargando favoritos");
    } finally {
      setLoading(false);
    }
  };

  // abrir modal de detalle por identificador interno, nunca por la sesión pública
  const openDetail = async (id) => {
    try {
      setLoadingDetail(true);
      setShowModal(true);
      const { data } = await api.get(`/api/favorites/admin/${encodeURIComponent(id)}`);
      setDetail(data);
    } catch (e) {
      toast.error("No se pudo cargar el detalle de favoritos");
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryString]);

  const clearFilters = () => {
    setQ("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("SessionId copiado");
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  // --------- Acciones administrativas del modal ---------

  const removeFavorite = async (it) => {
    if (!detail?._id || !it?._id || !canDelete) return;
    try {
      setSaving(true);
      const { data } = await api.delete(
        `/api/favorites/admin/${encodeURIComponent(detail._id)}/items/${encodeURIComponent(it._id)}`
      );
      if (data?.deleted) {
        setShowModal(false);
        setDetail(null);
      } else {
        setDetail(data);
      }
      await load();
      toast.success("Favorito eliminado");
    } catch (e) {
      toast.error("No se pudo eliminar el favorito");
    } finally {
      setSaving(false);
    }
  };

  const deleteFavorites = async () => {
    if (!detail?._id || !canDelete) return;
    const ok = window.confirm(
      "Esta acción ELIMINA el documento de favoritos de esta sesión. ¿Deseas continuar?"
    );
    if (!ok) return;

    try {
      setSaving(true);
      await api.delete(`/api/favorites/admin/${encodeURIComponent(detail._id)}`);
      setShowModal(false);
      setDetail(null);
      await load();
      toast.success("Favoritos eliminados");
    } catch (e) {
      toast.error("No se pudo eliminar el documento de favoritos");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="bg-white rounded-2xl shadow border border-amber-200">
        {/* Header */}
        <div className="px-6 py-4 border-b bg-[#fff8fb] rounded-t-2xl">
          <h2 className="text-xl font-bold text-pink-600">Favoritos de clientes</h2>
          <p className="text-sm text-gray-500">
            Lista de productos que los clientes guardaron como favoritos (por sesión).
          </p>
        </div>

        {/* Filtros */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="md:col-span-2">
            <label className="text-xs text-gray-600">Buscar por sessionId</label>
            <input
              type="text"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="sess_abc123..."
              className="w-full border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-300"
            />
          </div>
          <div>
            <label className="text-xs text-gray-600">Desde</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              className="w-full border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-300"
            />
          </div>
          <div>
            <label className="text-xs text-gray-600">Hasta</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              className="w-full border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-300"
            />
          </div>
          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={clearFilters}
              className="px-4 py-2 rounded-xl border bg-white hover:bg-gray-50"
            >
              Limpiar
            </button>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="px-3 py-2 border rounded-xl"
              title="Elementos por página"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
            </select>
          </div>
        </div>

        {/* Tabla principal */}
        <div className="px-6 pb-4 overflow-x-auto">
          <table className="min-w-full table-fixed text-sm border rounded-lg overflow-hidden">
            <colgroup>
              <col className="w-auto" />
              <col className="w-16" />
              <col className="w-56" />
              <col className="w-28" />
            </colgroup>

            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="p-2 text-left">Cliente (sesión)</th>
                <th className="p-2 text-center">Ítems</th>
                <th className="p-2 text-center">Última actualización</th>
                <th className="p-2 text-center">Acciones</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td className="p-6 text-center text-gray-500" colSpan={4}>
                    Cargando…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td className="p-6 text-center text-gray-500" colSpan={4}>
                    Sin resultados
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const label = aliasFromSession(r.sessionId);
                  const lastDate = r.lastUpdate || r.updatedAt || r.createdAt || null;
                  return (
                    <tr key={r._id} className="border-t">
                      {/* Cliente */}
                      <td className="p-2 align-middle">
                        <div className="flex flex-col min-w-0">
                          <span className="font-medium">{label}</span>
                          <div className="flex items-center gap-2 text-xs text-gray-500 min-w-0">
                            <span className="font-mono truncate" title={r.sessionId}>
                              {r.sessionId}
                            </span>
                            <button
                              onClick={() => copy(r.sessionId)}
                              className="px-2 py-0.5 rounded border shrink-0 hover:bg-gray-50"
                              title="Copiar sessionId"
                            >
                              Copiar ID
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* Ítems */}
                      <td className="p-2 text-center align-middle">{r.itemsCount || 0}</td>

                      {/* Última actualización */}
                      <td className="p-2 whitespace-nowrap text-center align-middle">
                        <span title={String(lastDate || "")}>{formatDateSafe(lastDate)}</span>
                      </td>

                      {/* Acciones */}
                      <td className="p-2 text-center align-middle">
                        <button
                          onClick={() => openDetail(r._id)}
                          className="px-3 py-1.5 rounded-lg bg-pink-500 text-white hover:bg-pink-600 w-full"
                        >
                          Ver detalle
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        <div className="px-6 pb-6 flex items-center justify-between text-sm">
          <div className="text-gray-600">
            Total: <b>{total}</b> • Página {page} de {totalPages}
          </div>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-lg border disabled:opacity-50"
            >
              Anterior
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 rounded-lg border disabled:opacity-50"
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>

      {/* Modal Detalle */}
      {showModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-xl overflow-hidden">
            <div className="px-5 py-3 border-b flex items-center justify-between">
              <h3 className="font-semibold">
                Favoritos — {aliasFromSession(detail?.sessionId || "")}
              </h3>
              <button
                onClick={() => {
                  setShowModal(false);
                  setDetail(null);
                }}
                className="text-gray-600 hover:text-gray-900"
              >
                ✕
              </button>
            </div>

            <div className="p-5 max-h-[70vh] overflow-auto">
              {loadingDetail ? (
                <div className="text-gray-500">Cargando detalle…</div>
              ) : !detail ? (
                <div className="text-gray-500">Sin datos</div>
              ) : (
                <>
                  <div className="text-sm text-gray-600 mb-3">
                    Actualizado:{" "}
                    {formatDateSafe(
                      detail?.lastUpdate || detail?.updatedAt || detail?.createdAt
                    )}
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full table-fixed text-sm border rounded">
                      <colgroup>
                        <col className="w-auto" />
                        <col className="w-28" />
                        <col className="w-40" />
                        <col className="w-28" />
                        <col className="w-24" />
                        <col className="w-28" />
                      </colgroup>

                      <thead className="bg-gray-50">
                        <tr>
                          <th className="p-2 text-left">Producto</th>
                          <th className="p-2">SKU</th>
                          <th className="p-2">Categoría</th>
                          <th className="p-2 text-right">Precio</th>
                          <th className="p-2 text-right">Stock</th>
                          <th className="p-2 text-center">Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(detail.items || []).map((it, idx) => {
                          const p = it?.current || null;
                          const title = p?.title || it.title || "—";
                          const img = p?.image || it.image || "";
                          const price = Number(p?.valid ? p.price : it.price || 0);
                          const sku = readSku(p, it);
                          const category = readCategory(p, it);
                          const stock = readStock(p);

                          return (
                            <tr key={idx} className="border-t">
                              <td className="p-2">
                                <div className="flex items-center gap-2">
                                  {img ? (
                                    <img
                                      src={img}
                                      alt=""
                                      className="w-10 h-10 rounded object-cover border"
                                    />
                                  ) : (
                                    <div className="w-10 h-10 rounded bg-gray-100 border" />
                                  )}
                                  <div className="leading-tight min-w-0">
                                    <div className="font-medium truncate">{title}</div>
                                    <div className="text-xs text-gray-500 break-all">
                                      {String(it.productId || "")}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="p-2 text-center">{sku}</td>
                              <td className="p-2 text-center">{category}</td>
                              <td className="p-2 text-right">{money(price)}</td>
                              <td className="p-2 text-right">
                                {stock == null ? "No aplica" : Number(stock || 0)}
                              </td>
                              <td className="p-2 text-center">
                                {canDelete ? (
                                  <button
                                    disabled={saving}
                                    onClick={() => removeFavorite(it)}
                                    className="px-3 py-1 rounded border hover:bg-gray-50"
                                  >
                                    Quitar
                                  </button>
                                ) : (
                                  <span className="text-gray-400">Solo lectura</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 text-right text-sm text-gray-600">
                    Total de favoritos:{" "}
                    <b>{detail?.itemsCount ?? (detail?.items?.length || 0)}</b>
                  </div>
                </>
              )}
            </div>

            <div className="px-5 py-3 border-t flex items-center justify-between">
              <div className="flex gap-2">
                {canDelete && (
                <button
                  disabled={saving}
                  onClick={deleteFavorites}
                  className="px-4 py-2 rounded-xl border border-red-200 bg-white text-red-700 hover:bg-red-50"
                >
                  Eliminar favoritos
                </button>
                )}
              </div>

              <button
                onClick={() => {
                  setShowModal(false);
                  setDetail(null);
                }}
                className="px-4 py-2 rounded-xl border bg-white hover:bg-gray-50"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
