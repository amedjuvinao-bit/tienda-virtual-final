// frontend/src/admin/OrdersAdmin.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { Pin, SlidersHorizontal } from 'lucide-react';
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
const CONTROL_TOGGLE_POSITION_KEY = 'orders-admin-control-toggle-position-v1';

function clampControlTogglePosition(position, width = 132, height = 40) {
  if (typeof window === 'undefined') return position;

  const safeWidth = Number(width) > 0 ? Number(width) : 132;
  const safeHeight = Number(height) > 0 ? Number(height) : 40;
  const viewportLeft = Number(window.visualViewport?.offsetLeft) || 0;
  const viewportTop = Number(window.visualViewport?.offsetTop) || 0;
  const viewportWidth = Number(window.visualViewport?.width) || window.innerWidth;
  const viewportHeight = Number(window.visualViewport?.height) || window.innerHeight;
  const margin = 12;
  const minX = viewportLeft + margin;
  const minY = viewportTop + margin;
  const maxX = Math.max(minX, viewportLeft + viewportWidth - safeWidth - margin);
  const maxY = Math.max(minY, viewportTop + viewportHeight - safeHeight - margin);

  return {
    x: Math.min(maxX, Math.max(minX, Number(position?.x) || minX)),
    y: Math.min(maxY, Math.max(minY, Number(position?.y) || minY)),
  };
}

function clampPinnedControlTogglePosition(position, width = 132) {
  if (typeof window === 'undefined') return position;

  const safeWidth = Number(width) > 0 ? Number(width) : 132;
  const documentScrollX = Number(window.scrollX) || 0;
  const viewportOffsetLeft = Number(window.visualViewport?.offsetLeft) || 0;
  const viewportWidth = Number(window.visualViewport?.width) || window.innerWidth;
  const margin = 12;
  const minX = documentScrollX + viewportOffsetLeft + margin;
  const maxX = Math.max(
    minX,
    documentScrollX + viewportOffsetLeft + viewportWidth - safeWidth - margin
  );

  return {
    x: Math.min(maxX, Math.max(minX, Number(position?.x) || minX)),
    y: Number(position?.y) || 0,
  };
}

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
  const canEditCustomerData = can('orders:customer_data');
  const canUpdateFulfillment = can('orders:fulfillment');
  const canDownloadBilling = can('billing:download');
  const canRefund = can('orders:refund');
  const canAutomateRefund = canRefund && can('billing:credit_note');
  const canManageReturns = can('orders:returns');
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
  const [controlTogglePosition, setControlTogglePosition] = useState(null);
  const [controlTogglePinned, setControlTogglePinned] = useState(false);
  const [draggingControlToggle, setDraggingControlToggle] = useState(false);
  const controlToggleRef = useRef(null);
  const controlTogglePositionRef = useRef(null);
  const controlTogglePinnedRef = useRef(false);
  const controlToggleDragRef = useRef(null);
  const lastControlToggleDragAtRef = useRef(0);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    try {
      const stored = JSON.parse(window.localStorage.getItem(CONTROL_TOGGLE_POSITION_KEY));
      if (Number.isFinite(stored?.x) && Number.isFinite(stored?.y)) {
        const rect = controlToggleRef.current?.getBoundingClientRect();
        const nextPinned = stored?.pinned === true;
        const restoredPosition = nextPinned
          ? stored?.coordinateSpace === 'document'
            ? { x: Number(stored.x), y: Number(stored.y) }
            : {
              x: Number(stored.x) + (Number(window.scrollX) || 0),
              y: Number(stored.y) + (Number(window.scrollY) || 0),
            }
          : stored;
        const next = nextPinned
          ? clampPinnedControlTogglePosition(restoredPosition, rect?.width)
          : clampControlTogglePosition(restoredPosition, rect?.width, rect?.height);
        controlTogglePositionRef.current = next;
        controlTogglePinnedRef.current = nextPinned;
        setControlTogglePosition(next);
        setControlTogglePinned(nextPinned);
        window.localStorage.setItem(
          CONTROL_TOGGLE_POSITION_KEY,
          JSON.stringify({
            ...next,
            pinned: nextPinned,
            coordinateSpace: nextPinned ? 'document' : 'viewport',
          })
        );
      }
    } catch {
      window.localStorage.removeItem(CONTROL_TOGGLE_POSITION_KEY);
    }

    const keepToggleInsideViewport = () => {
      if (!controlTogglePositionRef.current) return;
      const rect = controlToggleRef.current?.getBoundingClientRect();
      const next = controlTogglePinnedRef.current
        ? clampPinnedControlTogglePosition(controlTogglePositionRef.current, rect?.width)
        : clampControlTogglePosition(
          controlTogglePositionRef.current,
          rect?.width,
          rect?.height
        );
      controlTogglePositionRef.current = next;
      setControlTogglePosition(next);
      window.localStorage.setItem(
        CONTROL_TOGGLE_POSITION_KEY,
        JSON.stringify({
          ...next,
          pinned: controlTogglePinnedRef.current,
          coordinateSpace: controlTogglePinnedRef.current ? 'document' : 'viewport',
        })
      );
    };

    window.addEventListener('resize', keepToggleInsideViewport);
    window.addEventListener('pageshow', keepToggleInsideViewport);
    window.visualViewport?.addEventListener('resize', keepToggleInsideViewport);
    return () => {
      window.removeEventListener('resize', keepToggleInsideViewport);
      window.removeEventListener('pageshow', keepToggleInsideViewport);
      window.visualViewport?.removeEventListener('resize', keepToggleInsideViewport);
    };
  }, []);

  useEffect(() => {
    if (
      typeof window === 'undefined'
      || !controlTogglePositionRef.current
    ) return undefined;

    const frameId = window.requestAnimationFrame(() => {
      const rect = controlToggleRef.current?.getBoundingClientRect();
      const next = controlTogglePinnedRef.current
        ? clampPinnedControlTogglePosition(controlTogglePositionRef.current, rect?.width)
        : clampControlTogglePosition(
          controlTogglePositionRef.current,
          rect?.width,
          rect?.height
        );
      controlTogglePositionRef.current = next;
      setControlTogglePosition(next);
      window.localStorage.setItem(
        CONTROL_TOGGLE_POSITION_KEY,
        JSON.stringify({
          ...next,
          pinned: controlTogglePinnedRef.current,
          coordinateSpace: controlTogglePinnedRef.current ? 'document' : 'viewport',
        })
      );
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [controlsOpen, controlTogglePinned]);

  const handleControlTogglePointerDown = (event) => {
    if (controlTogglePinnedRef.current) return;
    if (event.button != null && event.button !== 0) return;

    const rect = controlToggleRef.current?.getBoundingClientRect()
      || event.currentTarget.getBoundingClientRect();
    controlToggleDragRef.current = {
      pointerId: event.pointerId ?? 'primary',
      startX: event.clientX,
      startY: event.clientY,
      originX: rect.left,
      originY: rect.top,
      width: rect.width,
      height: rect.height,
      moved: false,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handleControlTogglePointerMove = (event) => {
    if (controlTogglePinnedRef.current) return;
    const drag = controlToggleDragRef.current;
    if (!drag || drag.pointerId !== (event.pointerId ?? 'primary')) return;

    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(deltaX, deltaY) < 4) return;

    drag.moved = true;
    setDraggingControlToggle(true);
    const next = clampControlTogglePosition(
      { x: drag.originX + deltaX, y: drag.originY + deltaY },
      drag.width,
      drag.height
    );
    controlTogglePositionRef.current = next;
    setControlTogglePosition(next);
    event.preventDefault();
  };

  const finishControlToggleDrag = (event) => {
    const drag = controlToggleDragRef.current;
    if (!drag || drag.pointerId !== (event.pointerId ?? 'primary')) return;

    const cancelled = event.type === 'pointercancel';
    if (drag.moved && !cancelled) lastControlToggleDragAtRef.current = Date.now();
    controlToggleDragRef.current = null;
    setDraggingControlToggle(false);
    event.currentTarget.releasePointerCapture?.(event.pointerId);

    if (drag.moved && !cancelled && controlTogglePositionRef.current && typeof window !== 'undefined') {
      window.localStorage.setItem(
        CONTROL_TOGGLE_POSITION_KEY,
        JSON.stringify({
          ...controlTogglePositionRef.current,
          pinned: false,
          coordinateSpace: 'viewport',
        })
      );
    }
  };

  const handleControlToggleClick = () => {
    if (Date.now() - lastControlToggleDragAtRef.current < 300) {
      return;
    }
    setControlsOpen((open) => !open);
  };

  const handleControlTogglePin = () => {
    if (typeof window === 'undefined') return;

    const rect = controlToggleRef.current?.getBoundingClientRect();
    const nextPinned = !controlTogglePinnedRef.current;
    const scrollX = Number(window.scrollX) || 0;
    const scrollY = Number(window.scrollY) || 0;
    const currentPosition = controlTogglePositionRef.current
      || clampControlTogglePosition(
        { x: rect?.left, y: rect?.top },
        rect?.width,
        rect?.height
      );
    const nextPosition = nextPinned
      ? {
        x: (Number.isFinite(rect?.left) ? rect.left : currentPosition.x) + scrollX,
        y: (Number.isFinite(rect?.top) ? rect.top : currentPosition.y) + scrollY,
      }
      : clampControlTogglePosition(
        {
          x: Number.isFinite(rect?.left) ? rect.left : currentPosition.x - scrollX,
          y: Number.isFinite(rect?.top) ? rect.top : currentPosition.y - scrollY,
        },
        rect?.width,
        rect?.height
      );

    controlToggleDragRef.current = null;
    setDraggingControlToggle(false);
    controlTogglePositionRef.current = nextPosition;
    controlTogglePinnedRef.current = nextPinned;
    setControlTogglePosition(nextPosition);
    setControlTogglePinned(nextPinned);
    window.localStorage.setItem(
      CONTROL_TOGGLE_POSITION_KEY,
      JSON.stringify({
        ...nextPosition,
        pinned: nextPinned,
        coordinateSpace: nextPinned ? 'document' : 'viewport',
      })
    );
  };

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

  const handleOrderUpdated = (updatedOrder) => {
    if (!updatedOrder?._id) return;

    const mergeOrder = (current) => {
      if (!current || current._id !== updatedOrder._id) return current;
      return {
        ...current,
        ...updatedOrder,
        fulfillment: updatedOrder.fulfillment
          ? {
              ...(current.fulfillment || {}),
              ...updatedOrder.fulfillment,
            }
          : current.fulfillment,
      };
    };

    setOrderSelected(mergeOrder);
    setData((current) => current.map(mergeOrder));
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
  const controlToggleButton = (
    <div
      ref={controlToggleRef}
      className={`orders-control-toggle ${
        draggingControlToggle ? 'is-dragging' : ''
      } ${controlTogglePinned ? 'is-pinned' : ''}`}
      style={{
        position: controlTogglePinned ? 'absolute' : 'fixed',
        ...(controlTogglePosition
          ? { left: controlTogglePosition.x, top: controlTogglePosition.y, right: 'auto', bottom: 'auto' }
          : {}),
      }}
    >
      <button
        type="button"
        aria-controls="orders-control-panel"
        aria-expanded={controlsOpen}
        aria-label={controlsOpen ? 'Ocultar panel de filtros' : 'Mostrar panel de filtros'}
        title={controlTogglePinned
          ? 'Botón anclado. Haz clic para mostrar u ocultar los filtros.'
          : 'Arrastra para mover. Haz clic para mostrar u ocultar los filtros.'}
        onClick={handleControlToggleClick}
        onPointerDown={handleControlTogglePointerDown}
        onPointerMove={handleControlTogglePointerMove}
        onPointerUp={finishControlToggleDrag}
        onPointerCancel={finishControlToggleDrag}
        className="orders-control-toggle-action"
      >
        <SlidersHorizontal aria-hidden="true" className="h-3.5 w-3.5" />
        <span>{controlsOpen ? 'Ocultar filtros' : 'Mostrar filtros'}</span>
      </button>
      <button
        type="button"
        className="orders-control-toggle-pin"
        aria-label={controlTogglePinned
          ? 'Quitar anclaje del botón de filtros'
          : 'Anclar botón de filtros en esta posición'}
        aria-pressed={controlTogglePinned}
        title={controlTogglePinned
          ? 'Anclado aquí. Pulsa para volver a moverlo.'
          : 'Anclar el botón en esta posición.'}
        onClick={handleControlTogglePin}
      >
        <Pin
          aria-hidden="true"
          className="h-3.5 w-3.5"
          fill={controlTogglePinned ? 'currentColor' : 'none'}
        />
      </button>
    </div>
  );

  return (
    <div className={`orders-admin-shell p-4 ${controlsOpen ? 'controls-open' : 'controls-closed'}`}>
      <style>{`
        .orders-admin-shell {
          display: grid;
          position: relative;
          grid-template-columns: minmax(0, 1fr);
          grid-template-areas:
            "heading"
            "metrics"
            "table";
          gap: 16px;
          align-items: start;
        }
        .orders-admin-shell.controls-open {
          grid-template-columns: minmax(0, 1fr) minmax(310px, 360px);
          grid-template-rows: auto min-content auto;
          grid-template-areas:
            "heading heading"
            "metrics controls"
            "table controls";
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
          position: relative;
          inset: auto;
          align-self: start;
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
          position: fixed;
          right: 22px;
          bottom: 22px;
          z-index: 120;
          display: inline-flex;
          height: 36px;
          align-items: stretch;
          overflow: hidden;
          border: 1px solid;
          border-radius: 12px;
          user-select: none;
          border-color: color-mix(in srgb, var(--admin-primary) 34%, rgba(255,255,255,0.72)) !important;
          background: linear-gradient(135deg,
            color-mix(in srgb, var(--admin-card-bg) 82%, transparent),
            color-mix(in srgb, var(--admin-primary-soft-bg) 68%, transparent)
          ) !important;
          color: var(--admin-card-text) !important;
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.78),
            0 10px 26px color-mix(in srgb, var(--admin-primary) 16%, transparent);
          backdrop-filter: blur(18px) saturate(150%);
          -webkit-backdrop-filter: blur(18px) saturate(150%);
          transition: border-color 160ms ease, box-shadow 160ms ease;
        }
        .orders-control-toggle:hover {
          border-color: color-mix(in srgb, var(--admin-primary) 58%, rgba(255,255,255,0.82)) !important;
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.9),
            0 12px 30px color-mix(in srgb, var(--admin-primary) 22%, transparent);
        }
        .orders-control-toggle-action,
        .orders-control-toggle-pin {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 0;
          background: transparent;
          color: var(--admin-card-text);
          font: inherit;
        }
        .orders-control-toggle-action {
          min-width: 118px;
          gap: 8px;
          padding: 0 12px;
          touch-action: none;
          cursor: grab;
          font-size: 11px;
          font-weight: 900;
          white-space: nowrap;
        }
        .orders-control-toggle-pin {
          width: 35px;
          flex: 0 0 35px;
          border-left: 1px solid color-mix(in srgb, var(--admin-primary) 22%, rgba(255,255,255,0.72));
          color: var(--admin-primary);
          cursor: pointer;
          transition: background 160ms ease, color 160ms ease;
        }
        .orders-control-toggle-pin:hover,
        .orders-control-toggle-pin:focus-visible,
        .orders-control-toggle.is-pinned .orders-control-toggle-pin {
          background: color-mix(in srgb, var(--admin-primary-soft-bg) 82%, transparent);
        }
        .orders-control-toggle-action:focus-visible,
        .orders-control-toggle-pin:focus-visible {
          outline: 2px solid var(--admin-primary);
          outline-offset: -3px;
        }
        .orders-control-toggle svg {
          color: var(--admin-primary);
        }
        .orders-control-toggle.is-pinned .orders-control-toggle-action {
          cursor: pointer;
        }
        .orders-control-toggle.is-dragging {
          transition: none !important;
        }
        .orders-control-toggle.is-dragging .orders-control-toggle-action {
          cursor: grabbing;
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
            grid-template-columns: minmax(0, 1fr);
            grid-template-rows: auto auto auto auto;
            grid-template-areas:
              "heading"
              "metrics"
              "controls"
              "table";
          }
          .orders-admin-shell.controls-open .orders-admin-metrics {
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          }
          .orders-control-panel {
            position: static;
            inset: auto;
          }
        }

        @media (max-width: 720px) {
          .orders-admin-shell { padding: 12px !important; gap: 12px; }
          .orders-admin-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
          .orders-admin-shell.controls-open .orders-admin-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
          .orders-control-panel { padding: 12px; }
          .orders-control-toggle-action { min-width: 110px; padding-inline: 10px; }
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

      {typeof document === 'undefined'
        ? controlToggleButton
        : createPortal(controlToggleButton, document.body)}

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
        <div
          className="mb-2 flex flex-col gap-2 rounded-lg border p-2 md:flex-row md:items-center md:justify-between"
          style={{
            borderColor: 'var(--admin-primary-soft-border)',
            background: 'var(--admin-primary-soft-bg)',
            color: 'var(--admin-card-text)',
          }}
        >
          <div className="text-xs">
            {selectedIds.size} seleccionada{selectedIds.size === 1 ? '' : 's'}
            <button
              className="ml-2 underline"
              style={{ color: 'var(--admin-primary)' }}
              onClick={clearSelection}
            >
              Limpiar selección
            </button>
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
                className="h-8 rounded px-2.5 py-1 text-xs disabled:opacity-50"
                style={{
                  backgroundColor: 'var(--admin-primary)',
                  color: 'var(--admin-primary-text)',
                }}
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
                className="h-8 rounded px-2.5 py-1 text-xs disabled:opacity-50"
                style={{
                  backgroundColor: 'var(--admin-primary)',
                  color: 'var(--admin-primary-text)',
                }}
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
                className="h-8 rounded px-2.5 py-1 text-xs disabled:opacity-50"
                style={{
                  backgroundColor: 'var(--admin-primary)',
                  color: 'var(--admin-primary-text)',
                }}
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
            aria-label="Página anterior"
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
            aria-label="Siguiente página"
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
        canEditCustomerData={canEditCustomerData}
        onCustomerDataUpdated={handleOrderUpdated}
        onOrderUpdated={handleOrderUpdated}
        canUpdateFulfillment={canUpdateFulfillment}
        canDownloadBilling={canDownloadBilling}
        canRefund={canRefund}
        canAutomateRefund={canAutomateRefund}
        canManageReturns={canManageReturns}
        savingId={savingId}
        populated={populate}
      />
    </div>
  );
}
