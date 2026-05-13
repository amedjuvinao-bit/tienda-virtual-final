// src/admin/CarritosAdmin.jsx
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import api, { setAdminToken } from "../lib/api"; // ⬅️ usa la instancia con token

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

// Alias para sesiones anónimas: Cliente #FNHZ
function aliasFromSession(sessionId) {
  if (!sessionId) return "Cliente #----";
  const tail = String(sessionId).slice(-4).toUpperCase();
  return `Cliente #${tail}`;
}

// Qué mostrar como “Cliente”
function displayClient(r) {
  if (r?.userName && r.userName.trim()) return r.userName.trim();
  if (r?.userEmail && r.userEmail.trim()) return r.userEmail.trim();
  return aliasFromSession(r?.sessionId || "");
}

/* ---------------- Helpers de items ---------------- */
function getPid(raw) {
  return typeof raw === "object" && raw ? raw._id || raw.id : raw;
}

function normalizeQty(it) {
  return Number(it.qty ?? it.quantity ?? 0);
}

function setQtyShape(it, newQty) {
  // Conserva las demás propiedades del item
  return {
    ...it,
    qty: newQty,           // usamos qty como canónico
    quantity: newQty,      // redundante por compatibilidad
  };
}

function sameItem(a, b) {
  return (
    String(getPid(a.productId)) === String(getPid(b.productId)) &&
    String(a.color || "") === String(b.color || "") &&
    String(a.size || "") === String(b.size || "")
  );
}

function normalizePrice(it, p) {
  return Number(it.price ?? p?.price ?? 0);
}

function computeSummary(items) {
  return items.reduce(
    (acc, it) => {
      const p = typeof it.productId === "object" ? it.productId : null;
      const qty = normalizeQty(it);
      const price = normalizePrice(it, p);
      acc.totalItems += qty;
      acc.subtotal += qty * price;
      return acc;
    },
    { totalItems: 0, subtotal: 0 }
  );
}

export default function CarritosAdmin() {
  // ⚠️ si no hay token en localStorage, sembrar uno desde .env (igual que Orders)
  useEffect(() => {
    const has = localStorage.getItem('admin_token');
    if (!has) {
      const envToken = import.meta.env.VITE_ADMIN_TOKEN || 'rosa_boutique_123_secreto';
      setAdminToken(envToken);
    }
  }, []);

  // filtros y paginación
  const [q, setQ] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // datos
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  // modal detalle
  const [showModal, setShowModal] = useState(false);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // loading por ítem y para acciones globales
  const [itemBusy, setItemBusy] = useState({}); // key -> bool
  const [clearing, setClearing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", page);
    params.set("limit", limit);
    if (q.trim()) params.set("q", q.trim());
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    params.set("populate", "1");
    return params.toString();
  }, [page, limit, q, dateFrom, dateTo]);

  const load = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/api/cart/admin?${queryString}`); // ⬅️ api (con token)
      setRows(Array.isArray(data?.data) ? data.data : []);
      setTotal(Number(data?.total || 0));
      setTotalPages(Number(data?.totalPages || 1));
    } catch (e) {
      console.error(e);
      toast.error("Error cargando carritos");
    } finally {
      setLoading(false);
    }
  };

  const fetchDetail = async (sessionId) => {
    const { data } = await api.get( // ⬅️ api (con token y baseURL)
      `/api/cart/${encodeURIComponent(sessionId)}?populate=1`
    );
    return data;
  };

  const openDetail = async (sessionId) => {
    try {
      setLoadingDetail(true);
      setShowModal(true);
      const data = await fetchDetail(sessionId);
      setDetail(data);
    } catch (e) {
      console.error(e);
      toast.error("No se pudo cargar el detalle del carrito");
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

  /* ---------- Acciones admin: PUT /api/cart/:sessionId con items ---------- */
  function makeKey(it) {
    const pid = getPid(it.productId);
    return `${pid}__${it.color || ""}__${it.size || ""}`;
  }

  async function putCartWithItems(sessionId, items, extra = {}) {
    await api.put(`/api/cart/${encodeURIComponent(sessionId)}`, { // ⬅️ api
      items,
      ...extra,
    });
  }

  async function updateItemQty({ sessionId, item, newQty }) {
    const key = makeKey(item);
    try {
      setItemBusy((m) => ({ ...m, [key]: true }));

      const current = Array.isArray(detail?.items) ? detail.items : [];
      let items;

      if (newQty <= 0) {
        items = current.filter((it) => !sameItem(it, item));
      } else {
        items = current.map((it) =>
          sameItem(it, item) ? setQtyShape(it, newQty) : it
        );
      }

      await putCartWithItems(sessionId, items);
      toast.success(newQty <= 0 ? "Producto eliminado" : "Cantidad actualizada");

      const fresh = await fetchDetail(sessionId);
      if (!fresh?.summary) fresh.summary = computeSummary(fresh.items || []);
      setDetail(fresh);
      load();
    } catch (e) {
      console.error(e);
      toast.error("No se pudo actualizar el ítem");
    } finally {
      setItemBusy((m) => ({ ...m, [key]: false }));
    }
  }

  async function removeItem({ sessionId, item }) {
    return updateItemQty({ sessionId, item, newQty: 0 });
  }

  // --------- Vaciar carrito completo (PUT items: []) ----------
  async function clearCart(sessionId) {
    if (!detail) return;
    const confirmMsg =
      `¿Vaciar el carrito de ${displayClient(detail)}?\n\n` +
      `• Se conservará el documento del carrito (histórico, createdAt, user info).\n` +
      `• Los ítems pasarán a estar vacíos.\n\n` +
      `Puedes usar "Eliminar carrito" si quieres borrar el documento por completo.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      setClearing(true);
      const extra = {};
      if (detail.userId) extra.userId = detail.userId;
      if (detail.userName) extra.userName = detail.userName;
      if (detail.userEmail) extra.userEmail = detail.userEmail;

      await putCartWithItems(sessionId, [], extra);
      toast.success("🧹 Carrito vaciado");

      const fresh = await fetchDetail(sessionId);
      if (!fresh?.summary) fresh.summary = computeSummary(fresh.items || []);
      setDetail(fresh);
      load();
    } catch (e) {
      console.error(e);
      toast.error("No se pudo vaciar el carrito");
    } finally {
      setClearing(false);
    }
  }

  // --------- Eliminar carrito (DELETE documento) ----------
  async function deleteCart(sessionId) {
    if (!detail) return;
    const warning =
      `⚠️ Vas a ELIMINAR el carrito de ${displayClient(detail)}.\n\n` +
      `Esto borrará el documento completo (createdAt, updatedAt y metadata).\n` +
      `Si el cliente agrega algo después, se creará un nuevo carrito.\n\n` +
      `¿Deseas continuar?`;
    if (!window.confirm(warning)) return;

    try {
      setDeleting(true);
      await api.delete(`/api/cart/${encodeURIComponent(sessionId)}`); // ⬅️ api
      toast.success("🗑️ Carrito eliminado definitivamente");

      setShowModal(false);
      setDetail(null);
      load();
    } catch (e) {
      console.error(e);
      if (e?.response?.status === 404) {
        toast.info("El carrito ya no existía (404). Lista actualizada.");
        setShowModal(false);
        setDetail(null);
        load();
      } else {
        toast.error("No se pudo eliminar el carrito");
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div
        className="rounded-2xl shadow border"
        style={{
          backgroundColor: 'var(--admin-card-bg)',
          borderColor: 'var(--admin-card-border)',
          color: 'var(--admin-card-text)',
        }}
      >
        <div
          className="px-6 py-4 border-b rounded-t-2xl"
          style={{
            backgroundColor: 'var(--admin-card-header-bg)',
            borderColor: 'var(--admin-card-border)',
          }}
        >
          <h2
            className="text-xl font-bold"
            style={{ color: 'var(--admin-primary-soft-text)' }}
          >
            Carritos de clientes
          </h2>
          <p
            className="text-sm"
            style={{ color: 'var(--admin-card-muted-text)' }}
          >
            Verás nombre o correo si el cliente inició sesión. Si no, se muestra un alias.
          </p>
        </div>

        {/* Filtros */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="md:col-span-2">
            <label className="text-xs text-gray-600">Buscar</label>
            <input
              type="text"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="nombre, correo o sessionId"
              className="w-full rounded-xl px-3 py-2 focus:outline-none"
              style={{
                backgroundColor: 'var(--admin-input-bg)',
                borderColor: 'var(--admin-input-border)',
                color: 'var(--admin-input-text)',
              }}
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
              className="w-full rounded-xl px-3 py-2 focus:outline-none"
              style={{
                backgroundColor: 'var(--admin-input-bg)',
                borderColor: 'var(--admin-input-border)',
                color: 'var(--admin-input-text)',
              }}
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
              className="w-full rounded-xl px-3 py-2 focus:outline-none"
              style={{
                backgroundColor: 'var(--admin-input-bg)',
                borderColor: 'var(--admin-input-border)',
                color: 'var(--admin-input-text)',
              }}
            />
          </div>
          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={clearFilters}
              className="px-4 py-2 rounded-xl border"
              style={{
                backgroundColor: 'var(--admin-card-bg)',
                borderColor: 'var(--admin-card-border)',
                color: 'var(--admin-card-text)',
              }}
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

        {/* Tabla */}
        <div className="px-6 pb-4 overflow-auto">
          <table className="min-w-full text-sm border rounded-lg overflow-hidden">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="p-2 text-left w-[28rem]">Cliente</th>
                <th className="p-2 text-center w-[7rem]">Ítems</th>
                <th className="p-2 text-center w-[8rem]">Cant. Total</th>
                <th className="p-2 text-right w-[10rem]">Subtotal</th>
                <th className="p-2 text-center w-[14rem]">Actualizado</th>
                <th className="p-2 text-center w-[10rem]">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="p-6 text-center text-gray-500" colSpan={6}>
                    Cargando…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td className="p-6 text-center text-gray-500" colSpan={6}>
                    Sin resultados
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const lastDate = r.updatedAt || r.createdAt || null;
                  const label = displayClient(r);
                  return (
                    <tr key={r._id} className="border-t">
                      {/* Cliente */}
                      <td className="p-2">
                        <div className="flex flex-col">
                          <span className="font-medium">{label}</span>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span
                              className="font-mono truncate max-w-[220px]"
                              title={r.sessionId}
                            >
                              {r.sessionId}
                            </span>
                            <button
                              onClick={() => navigator.clipboard.writeText(r.sessionId).then(
                                () => toast.success("SessionId copiado"),
                                () => toast.error("No se pudo copiar")
                              )}
                              className="px-2 py-0.5 rounded border hover:bg-gray-50"
                              title="Copiar sessionId"
                            >
                              Copiar ID
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* Ítems (número de líneas distintas) */}
                      <td
                        className="p-2 text-center"
                        style={{ fontVariantNumeric: "tabular-nums" }}
                      >
                        {r.itemsCount}
                      </td>

                      {/* Cantidad total (sumatoria de cantidades) */}
                      <td
                        className="p-2 text-center"
                        style={{ fontVariantNumeric: "tabular-nums" }}
                      >
                        {r.totalItems}
                      </td>

                      {/* Subtotal */}
                      <td
                        className="p-2 text-right whitespace-nowrap"
                        style={{ fontVariantNumeric: "tabular-nums" }}
                      >
                        {money(r.subtotal)}
                      </td>

                      {/* Fecha */}
                      <td className="p-2 text-center whitespace-nowrap">
                        <span title={String(lastDate || "")}>
                          {formatDateSafe(lastDate)}
                        </span>
                      </td>

                      {/* Acciones */}
                      <td className="p-2 text-center">
                       <button
                        onClick={() => openDetail(r.sessionId)}
                        className="px-3 py-1.5 rounded-lg"
                        style={{
                          backgroundColor: 'var(--admin-primary)',
                          color: '#ffffff',
                        }}
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
                Carrito — {displayClient(detail || {})}
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
                    {formatDateSafe(detail?.updatedAt || detail?.createdAt)}
                  </div>
                  <table className="min-w-full text-sm border rounded">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="p-2 text-left">Producto</th>
                        <th className="p-2">Color</th>
                        <th className="p-2">Talla</th>
                        <th className="p-2 text-right">Cantidad</th>
                        <th className="p-2 text-right">Precio</th>
                        <th className="p-2 text-right">Subtotal</th>
                        <th className="p-2 text-center">Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(detail.items || []).map((it, idx) => {
                        const p =
                          typeof it.productId === "object" ? it.productId : null;
                        const title = p?.title || it.title || "—";
                        const img = p?.image || it.image || "";
                        const price = normalizePrice(it, p);
                        const qty = normalizeQty(it);
                        const sub = price * qty;
                        const key = `${getPid(it.productId)}__${it.color || ""}__${it.size || ""}`;
                        const sessionId = detail?.sessionId || detail?.id || "";

                        return (
                          <tr key={key || idx} className="border-t">
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
                                <div className="leading-tight">
                                  <div className="font-medium">{title}</div>
                                  <div className="text-xs text-gray-500 break-all">
                                    {String(
                                      it.productId?._id || it.productId || ""
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="p-2 text-center">
                              {it.color || "—"}
                            </td>
                            <td className="p-2 text-center">
                              {it.size || "—"}
                            </td>

                            {/* Cantidad con controles */}
                            <td
                              className="p-2 text-right"
                              style={{ fontVariantNumeric: "tabular-nums" }}
                            >
                              <div className="inline-flex items-center gap-2">
                                <button
                                  className="px-2 py-1 rounded-lg border hover:bg-gray-50 disabled:opacity-50"
                                  disabled={itemBusy[key]}
                                  onClick={() =>
                                    updateItemQty({
                                      sessionId,
                                      item: it,
                                      newQty: qty - 1,
                                    })
                                  }
                                  title="Disminuir"
                                >
                                  −
                                </button>
                                <span className="min-w-[2ch] text-right">
                                  {qty}
                                </span>
                                <button
                                  className="px-2 py-1 rounded-lg border hover:bg-gray-50 disabled:opacity-50"
                                  disabled={itemBusy[key]}
                                  onClick={() =>
                                    updateItemQty({
                                      sessionId,
                                      item: it,
                                      newQty: qty + 1,
                                    })
                                  }
                                  title="Aumentar"
                                >
                                  +
                                </button>
                              </div>
                            </td>

                            <td
                              className="p-2 text-right whitespace-nowrap"
                              style={{ fontVariantNumeric: "tabular-nums" }}
                            >
                              {money(price)}
                            </td>
                            <td
                              className="p-2 text-right whitespace-nowrap"
                              style={{ fontVariantNumeric: "tabular-nums" }}
                            >
                              {money(sub)}
                            </td>

                            {/* Acciones por fila */}
                            <td className="p-2 text-center">
                              <button
                                className="px-2 py-1 rounded-lg border disabled:opacity-50"
                                style={{
                                  borderColor: 'var(--admin-primary)',
                                  color: 'var(--admin-primary)',
                                }}
                                disabled={itemBusy[key]}
                                onClick={() => removeItem({ sessionId, item: it })}
                                title="Eliminar del carrito"
                              >
                                Eliminar
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* Totales */}
                  <div className="mt-4 text-right">
                    <div className="text-sm">
                      Ítems:{" "}
                      <b style={{ fontVariantNumeric: "tabular-nums" }}>
                        {detail?.summary?.totalItems ??
                          computeSummary(detail.items || []).totalItems}
                      </b>
                    </div>
                    <div
                      className="text-lg font-bold"
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      Subtotal:{" "}
                      {money(
                        detail?.summary?.subtotal ??
                          computeSummary(detail.items || []).subtotal
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="px-5 py-3 border-t flex flex-wrap gap-2 justify-between">
              <div className="flex gap-2">
                {/* Botón Vaciar carrito */}
               <button
                disabled={clearing || !detail}
                onClick={() => clearCart(detail?.sessionId)}
                className="px-4 py-2 rounded-xl border disabled:opacity-50"
                style={{
                  borderColor: 'var(--admin-primary)',
                  color: 'var(--admin-primary)',
                }}
                title="Vaciar todo el carrito (mantiene el documento)"
              >
                {clearing ? "Vaciando…" : "Vaciar carrito"}
              </button>

                {/* Botón Eliminar carrito (DELETE) */}
              <button
                disabled={deleting || !detail}
                onClick={() => deleteCart(detail?.sessionId)}
                className="px-4 py-2 rounded-xl border disabled:opacity-50"
                style={{
                  borderColor: 'var(--admin-primary)',
                  color: 'var(--admin-primary)',
                }}
                title="Eliminar documento de carrito"
              >
                {deleting ? "Eliminando…" : "Eliminar carrito"}
              </button>
              </div>

              <button
                onClick={() => {
                  setShowModal(false);
                  setDetail(null);
                }}
                className="px-4 py-2 rounded-xl border"
                style={{
                  borderColor: 'var(--admin-primary)',
                  color: 'var(--admin-primary)',
                }}
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
