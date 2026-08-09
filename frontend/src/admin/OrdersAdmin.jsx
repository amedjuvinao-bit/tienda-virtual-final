// frontend/src/admin/OrdersAdmin.jsx
import React, { useEffect, useMemo, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import api, { setAdminToken } from '../lib/api';
import ElectronicInvoiceBox from './orders/electronicInvoice/ElectronicInvoiceBox';
import OrdersFilters from './orders/components/OrdersFilters';
import OrdersTable from './orders/components/OrdersTable';
import OrderDetailModal from './orders/components/OrderDetailModal';
import OrdersQuickViews from './orders/components/OrdersQuickViews';
import useOrdersQuickViews from './orders/hooks/useOrdersQuickViews';
import OrdersActiveFilters from './orders/components/OrdersActiveFilters';
import OrdersInvoiceFilters from './orders/components/OrdersInvoiceFilters';
import useOrdersInvoiceFilters from './orders/hooks/useOrdersInvoiceFilters';

const ADMIN_BORDER = 'var(--admin-table-border)';
const ADMIN_PRIMARY = 'var(--admin-primary)';

const MODAL_FIELD_STYLE = {
  borderColor: 'var(--admin-input-border)',
  backgroundColor: 'var(--admin-input-bg)',
  color: 'var(--admin-input-text)',
};

const MODAL_LIGHT_PANEL_STYLE = {
  borderColor: 'var(--admin-light-panel-border)',
  backgroundColor: 'var(--admin-light-panel-bg)',
  color: 'var(--admin-light-panel-text)',
};

const MODAL_LIGHT_SOFT_STYLE = {
  borderColor: 'var(--admin-light-panel-border)',
  backgroundColor: 'var(--admin-light-panel-soft-bg)',
  color: 'var(--admin-light-panel-text)',
};

const MODAL_LIGHT_MUTED_STYLE = {
  color: 'var(--admin-light-panel-muted-text)',
};

const MODAL_PRIMARY_BUTTON_STYLE = {
  backgroundColor: 'var(--admin-primary)',
  color: 'var(--admin-primary-text)',
};

const OPTION_STYLE = {
  backgroundColor: '#ffffff',
  color: '#111827',
};




const toCOP = (n) =>
  Number(n || 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP' });

const fmtDate = (d) => {
  try {
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return '—';
    return dt.toLocaleString('es-CO', {
      year: '2-digit',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
};

function statusBadgeClasses(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'paid') return 'bg-green-100 text-green-700';
  if (s === 'processing') return 'bg-amber-100 text-amber-700';
  if (s === 'shipped') return 'bg-blue-100 text-blue-700';
  if (s === 'delivered') return 'bg-green-100 text-green-700';
  if (s === 'failed') return 'bg-red-100 text-red-700';
  if (s === 'cancelled' || s === 'canceled') return 'bg-red-100 text-red-700';
  if (s === 'refunded') return 'bg-purple-100 text-purple-700';
  if (s === 'pending' || s === 'pendiente') return 'bg-gray-100 text-gray-700';
  return 'bg-gray-200 text-gray-700';
}

const STATUS_OPTIONS = [
  { code: 'pending', label: 'Pendiente' },
  { code: 'processing', label: 'Procesando' },
  { code: 'paid', label: 'Pagado' },
  { code: 'failed', label: 'Fallido / Rechazado' },
  { code: 'shipped', label: 'Enviado' },
  { code: 'delivered', label: 'Entregado' },
  { code: 'cancelled', label: 'Cancelado' },
];

const STATUS_FILTERS = [
  { key: 'pending', label: 'Pendientes' },
  { key: 'processing', label: 'Procesando' },
  { key: 'paid', label: 'Pagadas' },
  { key: 'failed', label: 'Fallidas' },
  { key: 'shipped', label: 'Enviadas' },
  { key: 'delivered', label: 'Entregadas' },
  { key: 'cancelled', label: 'Canceladas' },
  { key: 'refunded', label: 'Reembolsadas' },
];

const normalizeTag = (t) => String(t || '').toLowerCase().trim().replace(/\s+/g, ' ');
const parseTagsInput = (str) =>
  String(str || '')
    .split(',')
    .map((s) => normalizeTag(s))
    .filter(Boolean);


const parseDashboardStatusParam = (rawStatus) => {
  const allowedStatuses = new Set(STATUS_FILTERS.map((item) => item.key));

  return Array.from(
    new Set(
      String(rawStatus || '')
        .split(',')
        .map((item) => item.trim().toLowerCase())
        .filter((item) => allowedStatuses.has(item))
    )
  );
};

/* ---------- Fallbacks client-side ---------- */
function applyStatusClientFilter(list, statusFilter) {
  if (!Array.isArray(list) || statusFilter.length === 0) return list;
  const want = new Set(statusFilter.map((s) => String(s).toLowerCase()));
  return list.filter((o) => {
    const s = String(o?.status || '').toLowerCase();
    if (want.has('cancelled') || want.has('canceled')) {
      if (s === 'cancelled' || s === 'canceled') return true;
    }
    return want.has(s);
  });
}
function applyTagsClientFilter(list, tags, mode) {
  if (!Array.isArray(list) || tags.length === 0) return list;
  const want = tags.map(normalizeTag);
  const hasAll = (arr) => {
    const ot = (arr || []).map(normalizeTag);
    return want.every((t) => ot.includes(t));
  };
  const hasAny = (arr) => {
    const ot = (arr || []).map(normalizeTag);
    return want.some((t) => ot.includes(t));
  };
  return list.filter((o) => (mode === 'all' ? hasAll(o.tags) : hasAny(o.tags)));
}

/* ---------- UI helpers para TIMELINE (mejorado) ---------- */
function isTagsUpdate(ev) {
  const t = String(ev?.type || '').toLowerCase();
  const msg = String(ev?.message || '');
  const hasArrays = Array.isArray(ev?.meta?.after) || Array.isArray(ev?.meta?.before);
  const saysTags = /^tags\b/i.test(msg) || /tags/i.test(msg);
  return t === 'tags_updated' || (t === 'note_updated' && (hasArrays || saysTags));
}

function uiForEvent(ev = {}) {
  const t = String(ev?.type || '').toLowerCase();

  if (isTagsUpdate(ev)) {
    return { icon: '🏷️', badge: 'bg-fuchsia-100 text-fuchsia-700', label: 'Tags' };
  }
  if (t === 'status_changed') {
    return { icon: '🔄', badge: 'bg-blue-100 text-blue-700', label: 'Estado' };
  }
  if (t === 'note_created') {
    return { icon: '📝', badge: 'bg-emerald-100 text-emerald-700', label: 'Nota' };
  }
  if (t === 'note_updated') {
    return { icon: '✏️', badge: 'bg-amber-100 text-amber-700', label: 'Nota editada' };
  }
  if (t === 'note_deleted') {
    return { icon: '🗑️', badge: 'bg-rose-100 text-rose-700', label: 'Nota eliminada' };
  }
  if (t === 'email_sent') {
    return { icon: '✉️', badge: 'bg-indigo-100 text-indigo-700', label: 'Email' };
  }
  return { icon: '⚙️', badge: 'bg-gray-100 text-gray-700', label: 'Sistema' };
}

function titleForEvent(ev) {
  const t = String(ev?.type || '').toLowerCase();

  if (isTagsUpdate(ev)) {
    const after =
      Array.isArray(ev?.meta?.after) ? ev.meta.after.join(', ') :
      (ev?.message && ev.message.replace(/^Tags(?:\s+\w+)?:\s*/i, '')) ||
      '—';
    return `Tags: ${after || '—'}`;
  }

  if (t === 'status_changed') {
    const from = ev?.meta?.from || '—';
    const to = ev?.meta?.to || '—';
    return `Estado: ${from} → ${to}`;
  }
  if (t === 'note_created') return 'Nota creada';
  if (t === 'note_updated') return 'Nota actualizada';
  if (t === 'note_deleted') return 'Nota eliminada';
  if (t === 'email_sent') {
    return ev?.meta?.template ? `Correo: ${ev.meta.template}` : 'Correo enviado';
  }
  return ev?.message || 'Evento';
}

/* ===========================
   Modal (header sticky + body scroll)
   =========================== */


/* ===========================
   Listado + FILTROS EN 2 LÍNEAS
   =========================== */
export default function OrdersAdmin() {
  const [searchParams] = useSearchParams();
  const [showQuickViewsFloating, setShowQuickViewsFloating] = useState(false);
  
   // Cargar token admin desde localStorage
  useEffect(() => {
     const token = localStorage.getItem('admin_token');
     if (token) {
      setAdminToken(token);
     }
  }, []);

  const [data, setData] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [financialSummary, setFinancialSummary] = useState(null);
  const [limit, setLimit] = useState(20);
  const [q, setQ] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [populate, setPopulate] = useState(true);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState('');

  // ===== ORDENAMIENTO (UI + envío a server) =====
  const [sort, setSort] = useState('createdAt:-1');
  const parseSort = (s) => {
    const [field, raw] = String(s || '').split(':');
    const dir = Number(raw) === 1 ? 1 : -1; // default desc
    return { field, dir };
  };
  const toggleSort = (field) => {
    setSort((prev) => {
      const { field: f, dir } = parseSort(prev);
      if (f === field) return `${field}:${dir === 1 ? -1 : 1}`;
      const defaultDir = (field === 'createdAt' || field === 'orderNumber' || field === 'total') ? -1 : -1;
      return `${field}:${defaultDir}`;
    });
    setPage(1);
  };
  const sortState = useMemo(() => parseSort(sort), [sort]);
  const sortIcon = (field) => {
    if (sortState.field !== field) return '↕';
    return sortState.dir === 1 ? '▲' : '▼';
  };
  const sortAria = (field) =>
    sortState.field === field ? (sortState.dir === 1 ? 'ascending' : 'descending') : 'none';

  // Selección múltiple
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const clearSelection = () => setSelectedIds(new Set());
  const isSelected = (id) => selectedIds.has(id);
  const toggleOne = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const allVisibleSelected =
    data.length > 0 && data.every((o) => selectedIds.has(o._id));
  const toggleSelectAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        data.forEach((o) => next.delete(o._id));
      } else {
        data.forEach((o) => next.add(o._id));
      }
      return next;
    });
  };

  // Modal
  const [showDetail, setShowDetail] = useState(false);
  const [orderSelected, setOrderSelected] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const openOrderDetail = async (order) => {
    try {
      console.log('CLICK ORDEN', order?._id);
      const id = order?._id;
      if (!id) return;

      setOrderSelected(order);
      setShowDetail(true);

      const { data } = await api.get(`/api/orders/${id}`);
      setOrderSelected(data);
    } catch (error) {
      console.error('Error cargando detalle de orden:', error);
      alert('No se pudo cargar el detalle completo de la orden.');
    }
  };

  // Debounce búsqueda
  const [typingQ, setTypingQ] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setQ(typingQ.trim()), 300);
    return () => clearTimeout(t);
  }, [typingQ]);

  // Filtros estado
  const [statusFilter, setStatusFilter] = useState(() =>
    parseDashboardStatusParam(searchParams.get('status'))
  );
  const toggleStatus = (k) => {
    setStatusFilter((prev) =>
      prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]
    );
    setPage(1);
  };
  const clearStatus = () => { setStatusFilter([]); setPage(1); };

  useEffect(() => {
    const statusFromDashboard = parseDashboardStatusParam(searchParams.get('status'));

    if (!statusFromDashboard.length) return;

    setStatusFilter((prev) => {
      const sameLength = prev.length === statusFromDashboard.length;
      const sameValues =
        sameLength && statusFromDashboard.every((status) => prev.includes(status));

      return sameValues ? prev : statusFromDashboard;
    });

  setPage(1);
}, [searchParams]);

  const {
    quickView,
    setQuickView,
    applyQuickView,
    printedFilter,
    archivedFilter,
  } = useOrdersQuickViews({
    setPage,
    setDateFrom,
    setDateTo,
    setStatusFilter,
    clearStatus,
  });

  const {
    invoiceFilter,
    setInvoiceFilter,
    applyInvoiceFilter,
  } = useOrdersInvoiceFilters({
    setPage,
  });

  // Tags
  const [tagsStr, setTagsStr] = useState('');
  const [tagsMode, setTagsMode] = useState('any'); // any | all
  const parsedTags = useMemo(() => parseTagsInput(tagsStr), [tagsStr]);

  useEffect(() => {
    let cancel = false;

    api
      .get('/api/admin/branches', {
        params: {
          limit: 100,
          status: 'active',
        },
      })
      .then((res) => {
        if (cancel) return;

        const payload = res?.data || {};
        const list = Array.isArray(payload.data)
          ? payload.data
          : Array.isArray(payload.branches)
            ? payload.branches
            : Array.isArray(payload.items)
              ? payload.items
              : Array.isArray(payload)
                ? payload
                : [];

        setBranches(list);
      })
      .catch((error) => {
        if (cancel) return;
        console.warn('No se pudieron cargar las sedes para el filtro de órdenes:', error);
        setBranches([]);
      });

    return () => {
      cancel = true;
    };
  }, []);

  const params = useMemo(
    () => ({
      page,
      limit,
      q,
      populate: populate ? 1 : 0,
      sort,
      ...(dateFrom ? { dateFrom } : {}),
      ...(dateTo ? { dateTo } : {}),
      ...(statusFilter.length ? { status: statusFilter.join(',') } : {}),
      ...(parsedTags.length ? { tags: parsedTags.join(','), tagsMode } : {}),
      ...(branchId ? { branchId } : {}),

      ...(printedFilter === 'not_printed' ? { printed: 0 } : {}),
      ...(printedFilter === 'printed' ? { printed: 1 } : {}),

      ...(archivedFilter === 'active' ? { archived: 0 } : {}),
      ...(archivedFilter === 'archived' ? { archived: 1 } : {}),
      ...(invoiceFilter && invoiceFilter !== 'all'
      ? { invoiceFilter }
      : {}),
        }),
    [
      page,
      limit,
      q,
      populate,
      sort,
      dateFrom,
      dateTo,
      statusFilter,
      parsedTags,
      tagsMode,
      branchId,
      printedFilter,
      archivedFilter,
      invoiceFilter,
    ]
  );

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    setErr('');
    api
      .get('/api/orders/admin', { params })
      .then((res) => {
        if (cancel) return;
        const payload = res?.data || {};
        const serverList = Array.isArray(payload.data) ? payload.data : [];
        const afterStatus = applyStatusClientFilter(serverList, statusFilter);
        const finalList = applyTagsClientFilter(afterStatus, parsedTags, tagsMode);
        setData(finalList);
        setPage(Number(payload.page || 1));
        setTotalPages(Number(payload.totalPages || 1));
        setTotal(Number(payload.total || 0));
        setFinancialSummary(payload.financialSummary || null);
        setSelectedIds((prev) => {
          const next = new Set();
          finalList.forEach((o) => { if (prev.has(o._id)) next.add(o._id); });
          return next;
        });
      })
      .catch((e) => {
        if (cancel) return;
        if (e?.response?.status === 401) {
          setErr('No autorizado. Inicia sesión de admin o configura VITE_ADMIN_TOKEN.');
        } else {
          setErr('No se pudieron cargar las órdenes.');
        }
      })
      .finally(() => !cancel && setLoading(false));
    return () => { cancel = true; };
  }, [params, statusFilter, parsedTags, tagsMode]);

  const resetAndSearch = () => setPage(1);

  // Exportar CSV (Axios con headers, descarga directa)
  const exportCsv = async () => {
    try {
      const resp = await api.get('/api/orders/admin', {
        params: { ...params, format: 'csv' },
        responseType: 'blob',
      });
      const blob = new Blob([resp.data], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'orders.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert('No se pudo exportar el CSV.');
    }
  };

  // Exportar seleccionadas (CSV - POST /admin/export)
  const exportSelectedCsv = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    try {
      const resp = await api.post('/api/orders/admin/export', { ids }, { responseType: 'blob' });
      const blob = new Blob([resp.data], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'orders-selected.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert('No se pudo exportar el CSV de seleccionadas.');
    }
  };

  // Acciones masivas
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkStatus, setBulkStatus] = useState('processing');
  const [bulkTags, setBulkTags] = useState('');
  const [bulkMode, setBulkMode] = useState('add'); // add | remove

  const runBulkStatus = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    try {
      setBulkBusy(true);
      const resp = await api.post('/api/orders/admin/bulk', {
        ids,
        action: { type: 'status', value: bulkStatus },
      });

      const results = Array.isArray(resp?.data?.results)
        ? resp.data.results
        : [];
      const successful = new Map(
        results
          .filter((result) => result?.ok)
          .map((result) => [String(result.orderId), result])
      );
      const failedIds = new Set(
        results
          .filter((result) => !result?.ok)
          .map((result) => String(result.orderId))
      );

      setData((prev) =>
        prev.map((order) => {
          const result = successful.get(String(order._id));
          if (!result) return order;

          return {
            ...order,
            status: result.status || bulkStatus,
            payment: {
              ...(order.payment || {}),
              ...(result.paymentStatus
                ? { status: result.paymentStatus }
                : {}),
            },
            fulfillmentStatus:
              result.fulfillmentStatus ||
              order.fulfillmentStatus,
          };
        })
      );
      setSelectedIds(failedIds);

      if (Number(resp?.data?.failed || 0) > 0) {
        const firstFailure = results.find((result) => !result?.ok);
        alert(
          `${resp.data.modified || 0} orden(es) actualizada(s) y ` +
            `${resp.data.failed} sin cambiar. ` +
            `${firstFailure?.message || 'Revisa las órdenes seleccionadas.'}`
        );
      }
    } catch (error) {
      alert(
        error?.response?.data?.message ||
          'No se pudieron aplicar los cambios de estado.'
      );
    } finally {
      setBulkBusy(false);
    }
  };

  const runBulkTags = async () => {
    const ids = Array.from(selectedIds);
    const tags = parseTagsInput(bulkTags);
    if (ids.length === 0 || tags.length === 0) return;
    try {
      setBulkBusy(true);
      await api.post('/api/orders/admin/bulk', {
        ids,
        action: { type: bulkMode === 'add' ? 'tags_add' : 'tags_remove', value: tags },
      });
      setData((prev) =>
        prev.map((o) => {
          if (!selectedIds.has(o._id)) return o;
          const orig = Array.isArray(o.tags) ? o.tags : [];
          if (bulkMode === 'add') {
            const set = new Set([...orig, ...tags]);
            return { ...o, tags: Array.from(set) };
          } else {
            const set = new Set(orig);
            tags.forEach((t) => set.delete(t));
            return { ...o, tags: Array.from(set) };
          }
        })
      );
      clearSelection();
      setBulkTags('');
    } catch {
      alert('No se pudieron aplicar los cambios de tags.');
    } finally {
      setBulkBusy(false);
    }
  };

  // Guardar estado (individual)
  const saveStatus = async (id, status) => {
    try {
      setSavingId(id);
      const resp = await api.patch(`/api/orders/${id}/status`, { status });
      const updatedOrder = resp?.data?.order || null;
      const savedStatus = updatedOrder?.status || status;
      setData((prev) =>
        prev.map((o) =>
          o._id === id
            ? {
                ...o,
                ...(updatedOrder || {}),
                status: savedStatus,
              }
            : o
        )
      );
      if (orderSelected && orderSelected._id === id) {
        setOrderSelected((o) => ({
          ...o,
          ...(updatedOrder || {}),
          status: savedStatus,
        }));
      }
      return resp;
    } catch (e) {
      alert(
        e?.response?.data?.message ||
          'No se pudo guardar el estado.'
      );
      throw e;
    } finally { setSavingId(null); }
  };

  // Guardar tags (individual)
  const saveTags = async (id, tags) => {
    try {
      setSavingId(id);
      const resp = await api.put(`/api/orders/${id}/tags`, { tags });
      const tagsSaved = Array.isArray(resp?.data?.tags) ? resp.data.tags : tags;
      setData((prev) => prev.map((o) => (o._id === id ? { ...o, tags: tagsSaved } : o)));
      if (orderSelected && orderSelected._id === id) {
        setOrderSelected((o) => ({ ...o, tags: tagsSaved }));
      }
      return resp;
    } catch (e) {
      alert('No se pudieron guardar los tags.');
      throw e;
    } finally { setSavingId(null); }
  };

  // ===== NUEVO: toggle impresa / archivada =====
  const togglePrinted = async (id, printed) => {
    try {
      setSavingId(id);
      const resp = await api.patch(`/api/orders/${id}/printed`, { printed });
      setData((prev) => prev.map((o) => (o._id === id ? { ...o, printed: !!printed } : o)));
      if (orderSelected && orderSelected._id === id) {
        setOrderSelected((o) => ({ ...o, printed: !!printed }));
      }
      return resp;
    } catch (e) {
      alert('No se pudo actualizar "impresa".');
      throw e;
    } finally { setSavingId(null); }
  };

  const toggleArchived = async (id, archived) => {
    try {
      setSavingId(id);
      const resp = await api.patch(`/api/orders/${id}/archived`, { archived });
      setData((prev) => prev.map((o) => (o._id === id ? { ...o, archived: !!archived } : o)));
      if (orderSelected && orderSelected._id === id) {
        setOrderSelected((o) => ({ ...o, archived: !!archived }));
      }
      return resp;
    } catch (e) {
      alert('No se pudo actualizar "archivada".');
      throw e;
    } finally { setSavingId(null); }
  };

  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(total, page * limit);

  return (
    <div className="p-4">

      {/* ===== Toolbar (SIEMPRE 2 LÍNEAS EN DESKTOP) ===== */}
      <OrdersFilters
        ADMIN_BORDER={ADMIN_BORDER}
        STATUS_FILTERS={STATUS_FILTERS}
        typingQ={typingQ}
        setTypingQ={setTypingQ}
        dateFrom={dateFrom}
        setDateFrom={setDateFrom}
        dateTo={dateTo}
        setDateTo={setDateTo}
        populate={populate}
        setPopulate={setPopulate}

        statusFilter={statusFilter}
        toggleStatus={toggleStatus}
        clearStatus={clearStatus}

        tagsStr={tagsStr}
        setTagsStr={setTagsStr}
        tagsMode={tagsMode}
        setTagsMode={setTagsMode}

        branchId={branchId}
        setBranchId={setBranchId}
        branches={branches}

        setPage={setPage}
        exportCsv={exportCsv}
        loading={loading}
        total={total}
        financialSummary={financialSummary}
      />

      <section className="mb-5">
        <OrdersInvoiceFilters
          invoiceFilter={invoiceFilter}
          setInvoiceFilter={setInvoiceFilter}
          onApplyInvoiceFilter={applyInvoiceFilter}
        />

        {typeof document !== 'undefined' &&
          createPortal(
            <div
              className="flex flex-col items-end gap-3"
              style={{
                position: 'fixed',
                right: '28px',
                bottom: '28px',
                zIndex: 2147483647,
              }}
            >
              {showQuickViewsFloating && (
                <div
                  className="rounded-[26px] border p-3 shadow-[0_24px_70px_rgba(15,23,42,0.28)]"
                  style={{
                    width: 'min(92vw, 460px)',
                    maxHeight: '72vh',
                    overflow: 'auto',
                    borderColor: ADMIN_BORDER,
                    background: 'var(--admin-card-bg)',
                    color: 'var(--admin-card-text)',
                  }}
                >
                  <div className="mb-3 flex items-center justify-between gap-3 px-1">
                    <div>
                      <p
                        className="text-[10px] font-black uppercase tracking-[0.22em]"
                        style={{ color: ADMIN_PRIMARY }}
                      >
                        Vistas rápidas
                      </p>

                      <p
                        className="text-xs"
                        style={{ color: 'var(--admin-card-muted-text)' }}
                      >
                        Accesos flotantes de órdenes
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowQuickViewsFloating(false)}
                      className="rounded-xl border px-3 py-1.5 text-xs font-black transition hover:scale-[1.02]"
                      style={{
                        borderColor: ADMIN_BORDER,
                        background: 'var(--admin-primary-soft-bg)',
                        color: 'var(--admin-primary-soft-text)',
                      }}
                    >
                      Cerrar
                    </button>
                  </div>

                  <OrdersQuickViews
                    quickView={quickView}
                    setQuickView={setQuickView}
                    onApplyQuickView={applyQuickView}
                  />
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowQuickViewsFloating((prev) => !prev)}
                className="group relative overflow-hidden rounded-[18px] border px-4 py-3 text-sm font-black transition duration-300 hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.98]"
                style={{
                  borderColor: 'color-mix(in srgb, var(--admin-primary) 55%, #ffffff)',
                  background:
                    'linear-gradient(135deg, rgba(255,255,255,0.96), color-mix(in srgb, var(--admin-primary-soft-bg) 72%, #ffffff 28%))',
                  color: 'var(--admin-card-text)',
                  boxShadow:
                    '0 16px 38px rgba(15,23,42,0.16), 0 0 22px color-mix(in srgb, var(--admin-primary) 26%, transparent)',
                  backdropFilter: 'blur(16px)',
                }}
              >
                <span
                  className="pointer-events-none absolute left-0 top-0 h-full w-[5px]"
                  style={{
                    background: 'var(--admin-primary)',
                  }}
                />

                <span
                  className="pointer-events-none absolute inset-0 opacity-0 transition duration-300 group-hover:opacity-100"
                  style={{
                    background:
                      'linear-gradient(120deg, transparent 0%, rgba(255,255,255,0.55) 45%, transparent 75%)',
                  }}
                />

                <span className="relative flex items-center gap-3 pl-1">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] border"
                    style={{
                      borderColor: 'color-mix(in srgb, var(--admin-primary) 42%, #ffffff)',
                      background:
                        'linear-gradient(135deg, color-mix(in srgb, var(--admin-primary-soft-bg) 86%, #ffffff), #ffffff)',
                      color: 'var(--admin-primary)',
                      boxShadow:
                        'inset 0 0 12px rgba(255,255,255,0.75), 0 8px 18px color-mix(in srgb, var(--admin-primary) 20%, transparent)',
                    }}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M4 7h16" />
                      <path d="M7 12h10" />
                      <path d="M10 17h4" />
                      <path d="M18 4l2 2-2 2" />
                    </svg>
                  </span>

                  <span className="flex flex-col items-start leading-none">
                    <span
                      className="text-[9px] font-black uppercase tracking-[0.22em]"
                      style={{ color: 'var(--admin-card-muted-text)' }}
                    >
                      Panel rápido
                    </span>

                    <span
                      className="mt-1 text-sm font-black"
                      style={{ color: 'var(--admin-card-text)' }}
                    >
                      {showQuickViewsFloating ? 'Ocultar vistas' : 'Vistas rápidas'}
                    </span>
                  </span>
                </span>
              </button>
            </div>,
            document.body
          )}
      </section>
      {/* ====== BARRA DE ACCIONES MASIVAS ====== */}
      {selectedIds.size > 0 && (
        <div className="mb-2 p-2 rounded-lg border bg-pink-50/50 flex flex-col gap-2 md:flex-row md:items-center md:justify-between" style={{ borderColor: ADMIN_BORDER }}>
          <div className="text-xs">
            {selectedIds.size} seleccionada{selectedIds.size === 1 ? '' : 's'}
            <button className="ml-2 underline text-pink-700" onClick={clearSelection}>Limpiar selección</button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Cambiar estado */}
            <div className="flex items-center gap-1">
              <select
                className="border rounded px-2 py-1 text-xs h-8"
                style={{ borderColor: ADMIN_BORDER }}
                value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value)}
                disabled={bulkBusy}
              >
                {STATUS_OPTIONS.map(op => <option key={op.code} value={op.code}>{op.label}</option>)}
              </select>
              <button
                className="px-2.5 py-1 rounded text-white text-xs h-8 disabled:opacity-50 hover:bg-pink-700"
                style={{ backgroundColor: '#ec4899' }}
                onClick={runBulkStatus}
                disabled={bulkBusy}
              >
                Cambiar estado
              </button>
            </div>

            {/* Añadir / Quitar tags */}
            <div className="flex items-center gap-1">
              <select
                className="border rounded px-2 py-1 text-xs h-8"
                style={{ borderColor: ADMIN_BORDER }}
                value={bulkMode}
                onChange={(e) => setBulkMode(e.target.value === 'remove' ? 'remove' : 'add')}
                disabled={bulkBusy}
              >
                <option value="add">Añadir tags</option>
                <option value="remove">Quitar tags</option>
              </select>
              <input
                className="border rounded px-2 py-1 text-xs h-8 w-56"
                style={{ borderColor: ADMIN_BORDER }}
                placeholder="vip, urgente…"
                value={bulkTags}
                onChange={(e) => setBulkTags(e.target.value)}
                disabled={bulkBusy}
              />
              <button
                className="px-2.5 py-1 rounded text-white text-xs h-8 disabled:opacity-50 hover:bg-pink-700"
                style={{ backgroundColor: '#ec4899' }}
                onClick={runBulkTags}
                disabled={bulkBusy || !bulkTags.trim()}
              >
                Aplicar tags
              </button>
            </div>

            {/* Exportar seleccionadas */}
            <div className="flex items-center gap-1">
              <button
                className="px-2.5 py-1 rounded text-white text-xs h-8 disabled:opacity-50 hover:bg-pink-700"
                style={{ backgroundColor: '#ec4899' }}
                onClick={exportSelectedCsv}
                disabled={bulkBusy || selectedIds.size === 0}
              >
                Exportar seleccionadas (CSV)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barra informativa */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs text-gray-700">
          {loading ? 'Cargando…' : `${total} orden${total === 1 ? '' : 'es'} • Mostrando ${from}–${to}`}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-700">Por página</span>
          <select
            className="border rounded px-2 py-1 text-xs h-8"
            style={{ borderColor: ADMIN_BORDER }}
            value={limit}
            onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
          >
            {[10, 20, 50, 100].map((n) => (<option key={n} value={n}>{n}</option>))}
          </select>
        </div>
      </div>

      {/* Error */}
      {err && (
        <div className="mb-2 rounded p-2 text-xs text-red-700 border bg-red-50" style={{ borderColor: '#fecaca' }}>
          {err}
        </div>
      )}

      {/* Tabla */}
      <div className="overflow-x-auto rounded-lg border bg-white" style={{ borderColor: ADMIN_BORDER }}>
        <OrdersTable
          ADMIN_BORDER={ADMIN_BORDER}
          data={data}
          loading={loading}
          selectedIds={selectedIds}
          toggleSelectAllVisible={toggleSelectAllVisible}
          toggleOne={toggleOne}
          isSelected={isSelected}
          toggleSort={toggleSort}
          sortAria={sortAria}
          sortIcon={sortIcon}
          fmtDate={fmtDate}
          toCOP={toCOP}
          statusBadgeClasses={statusBadgeClasses}
          openOrderDetail={openOrderDetail}
        />
      </div>

      {/* Paginación */}
      <div
        className="mt-3 flex flex-col gap-3 rounded-2xl border px-4 py-3 shadow-sm backdrop-blur-xl md:flex-row md:items-center md:justify-between"
        style={{
          borderColor: 'var(--admin-glass-border, var(--admin-card-border))',
          background: 'var(--admin-glass-soft-bg, var(--admin-card-bg))',
          color: 'var(--admin-card-text)',
          boxShadow: '0 14px 34px color-mix(in srgb, var(--admin-primary) 10%, transparent)',
        }}
      >
        <div className="flex items-center gap-2 text-xs">
          <span
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border font-semibold"
            style={{
              borderColor: 'var(--admin-primary-soft-border)',
              backgroundColor: 'var(--admin-primary-soft-bg)',
              color: 'var(--admin-primary-soft-text)',
            }}
          >
            {page}
          </span>

          <span style={{ color: 'var(--admin-card-muted-text)' }}>
            Página <strong style={{ color: 'var(--admin-card-text)' }}>{page}</strong> de{' '}
            <strong style={{ color: 'var(--admin-card-text)' }}>{totalPages}</strong>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="group inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-xs font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-45"
            style={{
              borderColor: 'var(--admin-button-soft-border)',
              backgroundColor: 'var(--admin-button-soft-bg)',
              color: 'var(--admin-button-soft-text)',
            }}
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <span className="transition-transform duration-200 group-hover:-translate-x-0.5">←</span>
            Anterior
          </button>

          <button
            className="group inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-xs font-semibold shadow-sm transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-45"
            style={{
              borderColor: 'var(--admin-primary)',
              backgroundColor: 'var(--admin-primary)',
              color: 'var(--admin-primary-text)',
              boxShadow: '0 12px 26px color-mix(in srgb, var(--admin-primary) 24%, transparent)',
            }}
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Siguiente
            <span className="transition-transform duration-200 group-hover:translate-x-0.5">→</span>
          </button>
        </div>
      </div>

      {/* Modal */}
      <OrderDetailModal
        open={showDetail}
        onClose={() => setShowDetail(false)}
        order={orderSelected}
        onSaveStatus={saveStatus}
        onSaveTags={saveTags}
        onTogglePrinted={togglePrinted}     // 👈 pasa handler
        onToggleArchived={toggleArchived}   // 👈 pasa handler
        savingId={savingId}
        populated={populate}
      />
    </div>
  );
}
