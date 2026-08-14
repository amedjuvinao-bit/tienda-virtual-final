// frontend/src/admin/OrdersAdmin.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SlidersHorizontal } from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import useAdminPermissions from './security/useAdminPermissions';
import OrdersFilters from './orders/components/OrdersFilters';
import OrdersTable from './orders/components/OrdersTable';
import OrderDetailModal from './orders/components/OrderDetailModal';
import OrdersQuickViews from './orders/components/OrdersQuickViews';
import useOrdersQuickViews from './orders/hooks/useOrdersQuickViews';
import OrdersActiveFilters from './orders/components/OrdersActiveFilters';
import OrdersInvoiceFilters from './orders/components/OrdersInvoiceFilters';
import useOrdersInvoiceFilters from './orders/hooks/useOrdersInvoiceFilters';
import useOrdersAdminQuery from './orders/hooks/useOrdersAdminQuery';

const ADMIN_BORDER = 'var(--admin-table-border)';

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

/* ===========================
   Modal (header sticky + body scroll)
   =========================== */


/* ===========================
   Listado + FILTROS EN 2 LÍNEAS
   =========================== */
export default function OrdersAdmin() {
  const [searchParams] = useSearchParams();
  const { isAuthenticated, adminToken, authLoading } = useAuth();
  const { can } = useAdminPermissions();
  const hasSession = !authLoading && isAuthenticated && Boolean(adminToken);
  const canView = can('orders:view');
  const canExport = can('orders:export');
  const canBulk = can('orders:bulk');
  const canUpdateStatus = can('orders:status');
  const canUpdateTags = can('orders:tags');
  const canMarkPrinted = can('orders:mark_printed');
  const canArchive = can('orders:archive');
  const canAddNotes = can('orders:notes');
  const canSendEmail = can('orders:email');
  const canUpdateFulfillment = can('orders:fulfillment');
  const canDownloadBilling = can('billing:download');
  const canRefund = can('orders:refund');
  const canViewBranches = can('branches:view');
  const selectionEnabled = canBulk || canExport;

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [q, setQ] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [populate, setPopulate] = useState(true);
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState('');
  const [controlsOpen, setControlsOpen] = useState(false);

  const requireSessionAndPermission = (allowed, message) => {
    if (hasSession && allowed) return true;
    setErr(
      hasSession
        ? message
        : 'Tu sesión administrativa no es válida. Inicia sesión nuevamente.'
    );
    return false;
  };

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
    if (!selectionEnabled) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  // Modal
  const [showDetail, setShowDetail] = useState(false);
  const [orderSelected, setOrderSelected] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const openOrderDetail = async (order) => {
    if (
      !requireSessionAndPermission(
        canView,
        'No tienes permiso para consultar órdenes.'
      )
    ) return;

    try {
      const id = order?._id;
      if (!id) return;

      setOrderSelected(order);
      setShowDetail(true);

      const { data } = await api.get(`/api/orders/${id}`);
      setOrderSelected(data);
    } catch {
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
    applyQuickView,
    printedFilter,
    archivedFilter,
    operationalView,
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

    if (authLoading || !hasSession || !canView || !canViewBranches) {
      setBranches([]);
      return () => {
        cancel = true;
      };
    }

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
      .catch(() => {
        if (cancel) return;
        setBranches([]);
      });

    return () => {
      cancel = true;
    };
  }, [authLoading, hasSession, canView, canViewBranches]);

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
      ...(operationalView && operationalView !== 'all'
        ? { operationalView }
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
      operationalView,
    ]
  );

  const {
    data,
    setData,
    totalPages,
    total,
    financialSummary,
    operationalSummary,
    loading,
    err,
    setErr,
  } = useOrdersAdminQuery({
    authLoading,
    hasSession,
    canView,
    params,
  });

  const allVisibleSelected =
    data.length > 0 && data.every((order) => selectedIds.has(order._id));
  const toggleSelectAllVisible = () => {
    if (!selectionEnabled) return;
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (allVisibleSelected) {
        data.forEach((order) => next.delete(order._id));
      } else {
        data.forEach((order) => next.add(order._id));
      }
      return next;
    });
  };

  useEffect(() => {
    setSelectedIds((previous) => {
      const visibleIds = new Set(data.map((order) => order._id));
      return new Set(Array.from(previous).filter((id) => visibleIds.has(id)));
    });
  }, [data]);

  useEffect(() => {
    if (!selectionEnabled) clearSelection();
  }, [selectionEnabled]);

  const resetAndSearch = () => setPage(1);

  // Exportar CSV (Axios con headers, descarga directa)
  const exportCsv = async () => {
    if (
      !requireSessionAndPermission(
        canExport,
        'No tienes permiso para exportar órdenes.'
      )
    ) return;

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
    if (
      !requireSessionAndPermission(
        canExport,
        'No tienes permiso para exportar órdenes.'
      )
    ) return;

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
    if (
      !requireSessionAndPermission(
        canBulk,
        'No tienes permiso para ejecutar acciones masivas.'
      )
    ) return;

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
    if (
      !requireSessionAndPermission(
        canBulk,
        'No tienes permiso para ejecutar acciones masivas.'
      )
    ) return;

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
    if (
      !requireSessionAndPermission(
        canUpdateStatus,
        'No tienes permiso para cambiar el estado de una orden.'
      )
    ) return null;

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
    if (
      !requireSessionAndPermission(
        canUpdateTags,
        'No tienes permiso para editar las etiquetas de una orden.'
      )
    ) return null;

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
    if (
      !requireSessionAndPermission(
        canMarkPrinted,
        'No tienes permiso para marcar órdenes como impresas.'
      )
    ) return null;

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
    if (
      !requireSessionAndPermission(
        canArchive,
        'No tienes permiso para archivar órdenes.'
      )
    ) return null;

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
    <div className={`orders-admin-shell p-4 ${controlsOpen ? 'controls-open' : 'controls-closed'}`}>
      <style>{`
        .orders-admin-shell {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 44px;
          grid-template-areas:
            "heading heading"
            "metrics metrics"
            "table toggle";
          gap: 16px;
          align-items: start;
        }
        .orders-admin-shell.controls-open {
          grid-template-columns: minmax(0, 1fr) 44px minmax(310px, 360px);
          grid-template-areas:
            "heading heading heading"
            "metrics toggle controls"
            "table toggle controls";
        }
        .orders-filter-fragments { display: contents; }
        .orders-admin-heading { grid-area: heading; }
        .orders-admin-metrics { grid-area: metrics; min-width: 0; }
        .orders-table-workspace { grid-area: table; min-width: 0; }
        .orders-admin-shell.controls-open .orders-admin-metrics {
          grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
        }
        .orders-admin-shell.controls-open .orf-card-metric {
          gap: 7px !important;
          padding: 11px 12px !important;
        }
        .orders-control-panel {
          grid-area: controls;
          display: flex;
          flex-direction: column;
          gap: 12px;
          position: static;
          width: 100%;
          min-width: 0;
          padding: 14px;
          overflow: visible;
          border: 1px solid var(--admin-card-border);
          border-radius: 20px;
          background: var(--admin-page-bg, var(--admin-card-bg));
          box-shadow: 0 16px 42px rgba(15, 23, 42, 0.12);
          opacity: 1;
          transition: opacity 160ms ease;
        }
        .orders-control-panel.is-closed {
          display: none;
        }
        .orders-control-mobile-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 2px 2px 4px;
        }
        .orders-control-mobile-heading p {
          margin: 0;
          color: var(--admin-card-text);
          font-size: 14px;
          font-weight: 900;
        }
        .orders-control-mobile-heading span {
          color: var(--admin-card-muted-text);
          font-size: 10px;
        }
        .orders-control-mobile-heading button {
          display: inline-flex;
          width: 36px;
          height: 36px;
          align-items: center;
          justify-content: center;
          border: 1px solid var(--admin-card-border);
          border-radius: 10px;
          background: var(--admin-card-bg);
          color: var(--admin-card-text);
          cursor: pointer;
        }
        .orders-control-backdrop { display: none; }
        .orders-control-toggle {
          grid-area: toggle;
          position: sticky;
          top: 16px;
          z-index: 20;
          align-self: start;
          width: 44px;
          height: auto !important;
          min-width: 0;
          min-height: 118px;
          padding: 10px 0 !important;
          flex-direction: column;
          justify-content: center;
          border-radius: 14px !important;
          box-shadow: 0 12px 34px color-mix(in srgb, var(--admin-primary) 24%, transparent);
        }
        .orders-control-toggle span {
          writing-mode: vertical-rl;
          transform: rotate(180deg);
          letter-spacing: 0.06em;
        }
        .orders-control-panel .orf-filters {
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        }
        .orders-control-panel .orf-col-2,
        .orders-control-panel .orf-col-3,
        .orders-control-panel .orf-col-4,
        .orders-control-panel .orf-col-6 {
          grid-column: span 1 !important;
          min-width: 0;
        }
        .orders-control-panel .orf-sidebar-wide,
        .orders-control-panel .orf-sidebar-clear {
          grid-column: span 2 !important;
        }
        .orders-control-panel > section,
        .orders-control-panel > div { margin-bottom: 0 !important; }

        @media (max-width: 1180px) {
          .orders-admin-shell.controls-open {
            grid-template-columns: minmax(0, 1fr) 44px;
            grid-template-areas:
              "heading heading"
              "metrics metrics"
              "controls toggle"
              "table toggle";
          }
          .orders-admin-shell.controls-open .orders-admin-metrics {
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 720px) {
          .orders-admin-shell { padding: 12px !important; gap: 12px; }
          .orders-admin-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
          .orders-admin-shell.controls-open .orders-admin-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
          .orders-control-panel { padding: 12px; }
          .orders-control-toggle {
            top: 10px;
            min-height: 104px;
          }
          .orders-control-panel .orf-filters {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
          .orders-control-panel .orf-col-2,
          .orders-control-panel .orf-col-3,
          .orders-control-panel .orf-col-4,
          .orders-control-panel .orf-col-6 {
            grid-column: span 1 !important;
          }
          .orders-control-panel .orf-sidebar-wide,
          .orders-control-panel .orf-sidebar-clear {
            grid-column: span 2 !important;
          }
        }
      `}</style>

      <button
        type="button"
        aria-controls="orders-control-panel"
        aria-expanded={controlsOpen}
        aria-label={controlsOpen ? 'Ocultar panel de filtros' : 'Mostrar panel de filtros'}
        onClick={() => setControlsOpen((open) => !open)}
        className="orders-control-toggle inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-[11px] font-black transition hover:-translate-y-0.5"
        style={{
          borderColor: 'var(--admin-primary)',
          background: 'var(--admin-primary)',
          color: 'var(--admin-primary-text)',
        }}
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        <span>{controlsOpen ? 'Ocultar filtros' : 'Mostrar filtros'}</span>
      </button>

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
        canExport={canExport}
        loading={loading}
        total={total}
        financialSummary={financialSummary}
        controlsOpen={controlsOpen}
        onCloseControls={() => setControlsOpen(false)}
      >
        <OrdersQuickViews
          compact
          quickView={quickView}
          onApplyQuickView={applyQuickView}
          operationalSummary={operationalSummary}
        />

        <OrdersInvoiceFilters
          compact
          invoiceFilter={invoiceFilter}
          setInvoiceFilter={setInvoiceFilter}
          onApplyInvoiceFilter={applyInvoiceFilter}
        />
      </OrdersFilters>

      <main className="orders-table-workspace">

      <OrdersActiveFilters
        quickView={quickView}
        onApplyQuickView={applyQuickView}
        typingQ={typingQ}
        setTypingQ={setTypingQ}
        dateFrom={dateFrom}
        setDateFrom={setDateFrom}
        dateTo={dateTo}
        setDateTo={setDateTo}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        clearStatus={clearStatus}
        STATUS_FILTERS={STATUS_FILTERS}
        tagsStr={tagsStr}
        setTagsStr={setTagsStr}
        setPage={setPage}
      />
      {/* ====== BARRA DE ACCIONES MASIVAS ====== */}
      {selectionEnabled && selectedIds.size > 0 && (
        <div className="mb-2 p-2 rounded-lg border bg-pink-50/50 flex flex-col gap-2 md:flex-row md:items-center md:justify-between" style={{ borderColor: ADMIN_BORDER }}>
          <div className="text-xs">
            {selectedIds.size} seleccionada{selectedIds.size === 1 ? '' : 's'}
            <button className="ml-2 underline text-pink-700" onClick={clearSelection}>Limpiar selección</button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canBulk && (
              <>
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
              </>
            )}

            {canExport && (
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
            )}
          </div>
        </div>
      )}

      {/* Error */}
      {err && (
        <div className="mb-2 rounded p-2 text-xs text-red-700 border bg-red-50" style={{ borderColor: '#fecaca' }}>
          {err}
        </div>
      )}

      {/* Tabla */}
      <OrdersTable
          ADMIN_BORDER={ADMIN_BORDER}
          data={data}
          loading={loading}
          total={total}
          from={from}
          to={to}
          limit={limit}
          onLimitChange={(nextLimit) => {
            setLimit(nextLimit);
            setPage(1);
          }}
          selectedIds={selectedIds}
          selectionEnabled={selectionEnabled}
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
      </main>

      {/* Modal */}
      <OrderDetailModal
        open={showDetail}
        onClose={() => setShowDetail(false)}
        order={orderSelected}
        onSaveStatus={canUpdateStatus ? saveStatus : null}
        onSaveTags={canUpdateTags ? saveTags : null}
        onTogglePrinted={canMarkPrinted ? togglePrinted : null}
        onToggleArchived={canArchive ? toggleArchived : null}
        canAddNotes={canAddNotes}
        canSendEmail={canSendEmail}
        canUpdateFulfillment={canUpdateFulfillment}
        canDownloadBilling={canDownloadBilling}
        canRefund={canRefund}
        savingId={savingId}
        populated={populate}
      />
    </div>
  );
}
