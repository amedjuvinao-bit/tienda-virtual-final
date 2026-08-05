import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  ChevronDown,
  CircleDollarSign,
  Download,
  MailCheck,
  PackageCheck,
  RefreshCw,
  RotateCcw,
  Search,
  ShoppingCart,
  SlidersHorizontal,
  TimerReset,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import useAdminPermissions from './security/useAdminPermissions';
import cartAdminApi from './cartAdminApi';
import './CarritosAdmin.css';

const EMPTY_FILTERS = Object.freeze({
  lifecycle: '',
  customerType: '',
  recoverable: '',
  dateFrom: '',
  dateTo: '',
  minSubtotal: '',
  maxSubtotal: '',
  minUnits: '',
  maxUnits: '',
  recoveryAttempts: '',
  sort: 'recent_activity',
});

const QUICK_VIEWS = [
  ['all', 'Todos'],
  ['active', 'Activos'],
  ['abandoned', 'Abandonados'],
  ['recoverable', 'Recuperables'],
  ['high_value', 'Alto valor'],
  ['empty', 'Vacios'],
  ['converted', 'Convertidos'],
];

const LIFECYCLE_LABELS = {
  empty: 'Vacio',
  active: 'Activo',
  inactive: 'Inactivo',
  abandoned: 'Abandonado',
  recoverable: 'Recuperable',
  converted: 'Convertido',
};

const METRIC_CARDS = [
  {
    key: 'cartsWithProducts',
    label: 'Con productos',
    description: 'Oportunidades con unidades',
    icon: PackageCheck,
    tone: 'neutral',
  },
  {
    key: 'active',
    label: 'Activos',
    description: 'Actividad menor a 30 min',
    icon: Activity,
    tone: 'success',
  },
  {
    key: 'abandoned',
    label: 'Abandonados',
    description: 'Sin actividad por 24 h',
    icon: TimerReset,
    tone: 'warning',
  },
  {
    key: 'recoverable',
    label: 'Recuperables',
    description: 'Con contacto disponible',
    icon: MailCheck,
    tone: 'info',
  },
  {
    key: 'abandonedValue',
    label: 'Valor abandonado',
    description: 'Potencial comercial pendiente',
    icon: CircleDollarSign,
    tone: 'value',
    money: true,
  },
  {
    key: 'averageCartValue',
    label: 'Valor promedio',
    description: 'Promedio con productos',
    icon: BarChart3,
    tone: 'neutral',
    money: true,
  },
];

function money(value) {
  return Number(value || 0).toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  });
}

function formatDate(value) {
  if (!value) return 'Sin registro';
  const date = new Date(value || 0);
  return Number.isNaN(date.getTime())
    ? 'Sin registro'
    : date.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
}

function elapsed(value, now = Date.now()) {
  if (!value) return 'Sin registro';
  const time = new Date(value || 0).getTime();
  if (!Number.isFinite(time)) return 'Sin registro';
  const minutes = Math.max(0, Math.floor((now - time) / 60000));
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  return `Hace ${Math.floor(hours / 24)} d`;
}

function displayClient(cart = {}) {
  return cart.userName || cart.userEmail || `Invitado ${String(cart.sessionId || '').slice(-6)}`;
}

function toMutationItems(detail) {
  return (detail?.items || []).map((item) => ({
    productId: item.stored.productId,
    qty: item.stored.qty,
    quantity: item.stored.qty,
    variantKey: item.stored.variantKey,
    variantId: item.stored.variantKey,
    variantLabel: item.stored.variantLabel,
    variantAttributes: item.stored.variantAttributes,
  }));
}

function downloadCsv(blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'carritos.csv';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function CarritosAdmin() {
  const { isAuthenticated, adminToken, authLoading } = useAuth();
  const { can } = useAdminPermissions();
  const hasSession = !authLoading && isAuthenticated && Boolean(adminToken);
  const canExport = can('carts:export');
  const canRecover = can('carts:recover');
  const canDelete = can('carts:delete');

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [view, setView] = useState('all');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [listError, setListError] = useState('');
  const [summaryError, setSummaryError] = useState('');
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [recoveryLink, setRecoveryLink] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  const requestFilters = useMemo(() => ({
    ...filters,
    q: debouncedSearch,
    view,
    page,
    limit,
  }), [filters, debouncedSearch, view, page, limit]);

  const requireSession = () => {
    if (hasSession) return true;
    setError('Tu sesion administrativa no es valida. Inicia sesion nuevamente.');
    return false;
  };

  const load = async () => {
    if (authLoading || !requireSession()) return;
    setLoading(true);
    setError('');
    setListError('');
    setSummaryError('');
    const [listResult, summaryResult] = await Promise.allSettled([
        cartAdminApi.list(requestFilters),
        cartAdminApi.summary(requestFilters),
    ]);
    if (listResult.status === 'fulfilled') {
      const listResponse = listResult.value;
      setRows(Array.isArray(listResponse.data?.data) ? listResponse.data.data : []);
      setTotal(Number(listResponse.data?.total || 0));
      setTotalPages(Number(listResponse.data?.totalPages || 1));
      setSelected((current) => new Set(
        [...current].filter((sessionId) =>
          (listResponse.data?.data || []).some((row) => row.sessionId === sessionId)
        )
      ));
    } else {
      setRows([]);
      setTotal(0);
      setTotalPages(1);
      setListError('No fue posible cargar el listado de carritos.');
    }
    if (summaryResult.status === 'fulfilled') {
      setSummary(summaryResult.value.data || null);
    } else {
      setSummary(null);
      setSummaryError('No fue posible cargar el resumen de carritos.');
    }
    setLoading(false);
  };

  useEffect(() => {
    if (hasSession) load();
    else if (!authLoading) {
      setRows([]);
      setSummary(null);
      setError('Tu sesion administrativa no es valida. Inicia sesion nuevamente.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSession, authLoading, requestFilters]);

  const openDetail = async (sessionId) => {
    if (!requireSession()) return;
    setDetailLoading(true);
    setDetail({ sessionId });
    setRecoveryLink(null);
    try {
      const response = await cartAdminApi.detail(sessionId);
      setDetail(response.data);
      setTagsText((response.data?.adminTags || []).join(', '));
    } catch {
      setDetail(null);
      toast.error('No fue posible cargar el detalle del carrito.');
    } finally {
      setDetailLoading(false);
    }
  };

  const reloadAfterConflict = async (sessionId) => {
    const response = await cartAdminApi.detail(sessionId);
    setDetail(response.data);
    toast.warning('El carrito cambio. Revisa la version actual antes de repetir la accion.');
  };

  const runMutation = async (action, successMessage) => {
    if (!detail || !requireSession()) return false;
    setBusy(true);
    try {
      const response = await action();
      if (response?.data?.cart) setDetail(response.data.cart);
      toast.success(successMessage);
      await load();
      return true;
    } catch (requestError) {
      if (requestError?.response?.status === 409) {
        await reloadAfterConflict(detail.sessionId);
      } else {
        toast.error(requestError?.response?.data?.message || 'No fue posible completar la accion.');
      }
      return false;
    } finally {
      setBusy(false);
    }
  };

  const changeQuantity = (index, nextQuantity) => {
    const items = toMutationItems(detail);
    if (nextQuantity <= 0) items.splice(index, 1);
    else items[index] = { ...items[index], qty: nextQuantity, quantity: nextQuantity };
    return runMutation(
      () => cartAdminApi.updateItems(detail.sessionId, detail.version, items),
      nextQuantity <= 0 ? 'Producto eliminado del carrito.' : 'Cantidad actualizada.'
    );
  };

  const clearCart = async () => {
    if (!canDelete || !window.confirm('¿Vaciar este carrito conservando su historial?')) return;
    await runMutation(
      () => cartAdminApi.clear(detail.sessionId, detail.version),
      'Carrito vaciado.'
    );
  };

  const deleteCart = async () => {
    if (!canDelete || !window.confirm('¿Eliminar definitivamente este carrito?')) return;
    const removed = await runMutation(
      () => cartAdminApi.remove(detail.sessionId, detail.version),
      'Carrito eliminado.'
    );
    if (removed) setDetail(null);
  };

  const saveNote = async () => {
    if (!canRecover || !note.trim()) return;
    const saved = await runMutation(
      () => cartAdminApi.addNote(detail.sessionId, detail.version, note.trim()),
      'Nota interna registrada.'
    );
    if (saved) setNote('');
  };

  const saveTags = () => {
    if (!canRecover) return;
    const tags = tagsText.split(',').map((value) => value.trim()).filter(Boolean);
    return runMutation(
      () => cartAdminApi.updateTags(detail.sessionId, detail.version, tags),
      'Etiquetas actualizadas.'
    );
  };

  const generateLink = async () => {
    if (!canRecover || !detail) return;
    setBusy(true);
    try {
      const response = await cartAdminApi.generateRecoveryLink(detail.sessionId, 2880);
      setRecoveryLink(response.data);
      toast.success('Enlace seguro generado.');
      await openDetail(detail.sessionId);
      setRecoveryLink(response.data);
    } catch (requestError) {
      toast.error(requestError?.response?.data?.message || 'No fue posible generar el enlace.');
    } finally {
      setBusy(false);
    }
  };

  const copyRecoveryLink = async () => {
    if (!recoveryLink?.link) return;
    try {
      await navigator.clipboard.writeText(recoveryLink.link);
      toast.success('Enlace copiado.');
    } catch {
      toast.error('No fue posible copiar el enlace.');
    }
  };

  const sendRecoveryEmail = async () => {
    if (!canRecover || !detail?.recovery?.emailAvailable) return;
    if (!window.confirm(`¿Enviar recuperacion a ${detail.userEmail}?`)) return;
    const idempotencyKey = globalThis.crypto?.randomUUID?.() ||
      `cart-recovery-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setBusy(true);
    try {
      await cartAdminApi.sendRecovery(
        detail.sessionId,
        { subject: recoveryLink?.subject || 'Completa tu compra', expirationMinutes: 2880 },
        idempotencyKey
      );
      toast.success('Correo de recuperacion enviado.');
      await openDetail(detail.sessionId);
    } catch (requestError) {
      toast.error(requestError?.response?.data?.message || 'No fue posible enviar el correo.');
    } finally {
      setBusy(false);
    }
  };

  const exportRows = async () => {
    if (!canExport || !requireSession()) return;
    try {
      const response = await cartAdminApi.export(requestFilters, [...selected]);
      downloadCsv(response.data);
    } catch {
      toast.error('No fue posible exportar los carritos.');
    }
  };

  const registerSelectedFollowUp = async () => {
    if (!canRecover || selected.size === 0) return;
    const text = window.prompt('Seguimiento interno para los carritos seleccionados:');
    if (!text?.trim()) return;
    const targets = rows
      .filter((row) => selected.has(row.sessionId))
      .map((row) => ({ sessionId: row.sessionId, version: row.updatedAt }));
    try {
      const response = await cartAdminApi.registerFollowUps(targets, text.trim());
      const successful = (response.data?.results || []).filter((item) => item.ok).length;
      toast.success(`${successful} seguimiento(s) registrado(s).`);
      await load();
    } catch {
      toast.error('No fue posible registrar los seguimientos.');
    }
  };

  const clearFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setFilters(EMPTY_FILTERS);
    setView('all');
    setPage(1);
    setAdvancedFiltersOpen(false);
  };

  const setFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };

  return (
    <main className="cart-admin-page">
      <header className="cart-admin-header">
        <div className="cart-admin-heading">
          <span className="cart-admin-eyebrow">Operacion comercial</span>
          <h1>Supervision de carritos</h1>
          <p>Prioriza oportunidades, revisa alertas y recupera compras sin alterar la actividad del cliente.</p>
        </div>
        <div className="cart-admin-header-actions">
          <button type="button" className="cart-admin-button secondary" onClick={load} disabled={loading}>
            <RefreshCw size={16} aria-hidden="true" className={loading ? 'is-spinning' : ''} />
            Actualizar
          </button>
          {canExport && (
            <button type="button" className="cart-admin-button primary" onClick={exportRows}>
              <Download size={16} aria-hidden="true" />
              Exportar{selected.size ? ` (${selected.size})` : ''}
            </button>
          )}
        </div>
      </header>

      {error && <div className="cart-admin-feedback error cart-admin-glass" role="alert"><span>{error}</span><button type="button" onClick={load}>Reintentar</button></div>}
      {listError && <div className="cart-admin-feedback error cart-admin-glass" role="alert"><span>{listError}</span><button type="button" onClick={load}>Reintentar listado</button></div>}
      {summaryError && <div className="cart-admin-feedback error cart-admin-glass" role="alert"><span>{summaryError}</span><button type="button" onClick={load}>Reintentar resumen</button></div>}

      <section className="cart-admin-metrics" aria-label="Resumen ejecutivo">
        {METRIC_CARDS.map(({ key, label, description, icon: Icon, tone, money: isMoney }) => {
          const value = summary
            ? isMoney
              ? money(summary[key])
              : summary[key]
            : '\u2014';
          return (
            <article key={key} className={`cart-admin-metric cart-admin-glass ${tone}`}>
              <div className="cart-admin-metric-topline">
                <span>{label}</span>
                <span className="cart-admin-metric-icon" aria-hidden="true"><Icon size={17} /></span>
              </div>
              <strong>{value}</strong>
              <small>{description}</small>
            </article>
          );
        })}
      </section>

      <section className="cart-admin-controls cart-admin-glass" aria-label="Filtros de carritos">
        <div className="cart-admin-controls-topline">
          <nav className="cart-admin-quick-views" aria-label="Vistas rapidas">
          {QUICK_VIEWS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={view === value}
                onClick={() => { setView(value); setPage(1); }}
              >
                {label}
              </button>
          ))}
          </nav>
          <button type="button" className="cart-admin-reset" onClick={clearFilters}>
            <RotateCcw size={14} aria-hidden="true" />
            Limpiar filtros
          </button>
        </div>

        <div className="cart-admin-filter-grid primary-filters">
          <label className="search-field">
            <span>Buscar</span>
            <span className="cart-admin-search-input">
              <Search size={16} aria-hidden="true" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cliente, correo, sesion o producto" />
            </span>
          </label>
          <label>Estado<select value={filters.lifecycle} onChange={(event) => setFilter('lifecycle', event.target.value)}><option value="">Todos</option>{Object.entries(LIFECYCLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Cliente<select value={filters.customerType} onChange={(event) => setFilter('customerType', event.target.value)}><option value="">Todos</option><option value="identified">Identificado</option><option value="guest">Invitado</option></select></label>
          <label>Orden<select value={filters.sort} onChange={(event) => setFilter('sort', event.target.value)}><option value="recent_activity">Actividad reciente</option><option value="oldest_activity">Mayor antiguedad</option><option value="highest_value">Mayor valor</option><option value="highest_quantity">Mayor cantidad</option></select></label>
          <label className="page-size-field">Por pagina<select value={limit} onChange={(event) => { setLimit(Number(event.target.value)); setPage(1); }}>{[10, 20, 50, 100].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <button
            type="button"
            className="cart-admin-advanced-toggle"
            aria-expanded={advancedFiltersOpen}
            aria-controls="cart-admin-advanced-filters"
            onClick={() => setAdvancedFiltersOpen((current) => !current)}
          >
            <SlidersHorizontal size={15} aria-hidden="true" />
            Filtros avanzados
            <ChevronDown size={15} aria-hidden="true" className={advancedFiltersOpen ? 'is-open' : ''} />
          </button>
        </div>

        {advancedFiltersOpen && (
          <div className="cart-admin-filter-grid advanced-filters" id="cart-admin-advanced-filters">
            <label>Recuperable<select value={filters.recoverable} onChange={(event) => setFilter('recoverable', event.target.value)}><option value="">Todos</option><option value="yes">Si</option><option value="no">No</option></select></label>
            <label>Desde<input type="date" value={filters.dateFrom} onChange={(event) => setFilter('dateFrom', event.target.value)} /></label>
            <label>Hasta<input type="date" value={filters.dateTo} onChange={(event) => setFilter('dateTo', event.target.value)} /></label>
            <label>Subtotal min.<input type="number" min="0" value={filters.minSubtotal} onChange={(event) => setFilter('minSubtotal', event.target.value)} /></label>
            <label>Subtotal max.<input type="number" min="0" value={filters.maxSubtotal} onChange={(event) => setFilter('maxSubtotal', event.target.value)} /></label>
            <label>Unidades min.<input type="number" min="0" value={filters.minUnits} onChange={(event) => setFilter('minUnits', event.target.value)} /></label>
            <label>Unidades max.<input type="number" min="0" value={filters.maxUnits} onChange={(event) => setFilter('maxUnits', event.target.value)} /></label>
            <label>Seguimientos<select value={filters.recoveryAttempts} onChange={(event) => setFilter('recoveryAttempts', event.target.value)}><option value="">Todos</option><option value="with">Con intentos</option><option value="without">Sin intentos</option></select></label>
          </div>
        )}
      </section>

      {selected.size > 0 && (
        <div className="cart-admin-selection cart-admin-glass">
          <span><strong>{selected.size}</strong> seleccionados</span>
          <div>
            {canExport && <button type="button" onClick={exportRows}><Download size={14} aria-hidden="true" />Exportar seleccionados</button>}
            {canRecover && <button type="button" onClick={registerSelectedFollowUp}><TimerReset size={14} aria-hidden="true" />Registrar seguimiento</button>}
          </div>
        </div>
      )}

      <section className="cart-admin-table-wrap cart-admin-glass" aria-busy={loading}>
        <table className="cart-admin-table">
          <colgroup>
            <col className="col-select" /><col className="col-client" /><col className="col-type" />
            <col className="col-status" /><col className="col-count" /><col className="col-count" />
            <col className="col-total" /><col className="col-activity" /><col className="col-elapsed" />
            <col className="col-attempts" /><col className="col-action" />
          </colgroup>
          <thead><tr><th><input type="checkbox" aria-label="Seleccionar pagina" checked={rows.length > 0 && rows.every((row) => selected.has(row.sessionId))} onChange={(event) => setSelected(event.target.checked ? new Set(rows.map((row) => row.sessionId)) : new Set())} /></th><th>Cliente</th><th>Tipo</th><th>Estado</th><th>Productos</th><th>Unidades</th><th>Subtotal</th><th>Ultima actividad</th><th>Antiguedad</th><th>Intentos</th><th>Accion</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan="11" className="cart-admin-empty"><RefreshCw size={22} aria-hidden="true" className="is-spinning" /><strong>Cargando carritos...</strong></td></tr> : rows.length === 0 ? <tr><td colSpan="11" className="cart-admin-empty"><ShoppingCart size={24} aria-hidden="true" /><strong>No hay carritos para estos filtros.</strong><span>Prueba ajustando la busqueda o limpiando los filtros.</span></td></tr> : rows.map((row) => (
              <tr key={row.sessionId}>
                <td><input type="checkbox" aria-label={`Seleccionar ${displayClient(row)}`} checked={selected.has(row.sessionId)} onChange={() => setSelected((current) => { const next = new Set(current); if (next.has(row.sessionId)) next.delete(row.sessionId); else next.add(row.sessionId); return next; })} /></td>
                <td><strong>{displayClient(row)}</strong><small title={row.userEmail || row.sessionId}>{row.userEmail || row.sessionId}</small></td>
                <td>{row.identified ? 'Identificado' : 'Invitado'}</td>
                <td><span className={`cart-admin-status ${row.lifecycle}`}>{LIFECYCLE_LABELS[row.lifecycle] || row.lifecycle}</span></td>
                <td>{row.differentProducts}</td><td>{row.totalUnits}</td><td>{money(row.subtotal)}</td>
                <td>{formatDate(row.activityAt)}</td><td>{elapsed(row.activityAt)}</td><td>{row.recoveryAttemptsCount || 0}</td>
                <td><button type="button" className="cart-admin-link-button" onClick={() => openDetail(row.sessionId)}>Abrir detalle<ArrowUpRight size={14} aria-hidden="true" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <footer className="cart-admin-pagination"><span>{total} registros · Pagina {page} de {totalPages}</span><div><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Anterior</button><button type="button" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Siguiente</button></div></footer>

      {detail && <div className="cart-admin-drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetail(null); }}><aside className="cart-admin-drawer cart-admin-glass" role="dialog" aria-modal="true" aria-labelledby="cart-detail-title">
        <header><div><span className="cart-admin-eyebrow">Detalle del carrito</span><h2 id="cart-detail-title">{displayClient(detail)}</h2><p title={detail.sessionId}>{detail.sessionId}</p></div><button type="button" aria-label="Cerrar detalle" onClick={() => setDetail(null)}><X size={17} aria-hidden="true" />Cerrar</button></header>
        {detailLoading ? <div className="cart-admin-empty"><RefreshCw size={22} aria-hidden="true" className="is-spinning" /><strong>Cargando detalle...</strong></div> : <div className="cart-admin-drawer-content">
          <section className="cart-admin-detail-summary"><div><span>Estado</span><strong>{LIFECYCLE_LABELS[detail.lifecycle] || detail.lifecycle}</strong></div><div><span>Productos</span><strong>{detail.summary?.differentProducts || 0}</strong></div><div><span>Unidades</span><strong>{detail.summary?.totalUnits || 0}</strong></div><div><span>Subtotal registrado</span><strong>{money(detail.summary?.subtotal)}</strong></div></section>
          <section className="cart-admin-detail-section"><h3>Cliente y actividad</h3><dl><div><dt>Nombre</dt><dd>{detail.userName || 'Invitado'}</dd></div><div><dt>Correo</dt><dd>{detail.userEmail || 'No disponible'}</dd></div><div><dt>Actividad del cliente</dt><dd>{formatDate(detail.activityAt)} · {elapsed(detail.activityAt)}</dd></div><div><dt>Actividad administrativa</dt><dd>{formatDate(detail.lastAdminActivityAt)}</dd></div>{detail.relatedOrder && <div><dt>Orden convertida</dt><dd>{detail.relatedOrder.orderNumber} · {detail.relatedOrder.status}</dd></div>}</dl></section>
          <section className="cart-admin-detail-section"><h3>Productos y alertas</h3><div className="cart-admin-products">{(detail.items || []).map((item, index) => <article key={`${item.stored.productId}-${item.stored.variantKey}`}><img src={item.current.image || item.stored.image || '/placeholder.png'} alt="" /><div className="cart-admin-product-info"><strong>{item.current.title || item.stored.title || 'Producto no disponible'}</strong><span>{item.current.variantLabel || item.stored.variantLabel || 'Presentacion general'}</span><span>Clave: {item.current.variantKey || item.stored.variantKey || 'default__default'}</span><span>SKU: {item.current.sku || 'Sin SKU'} · Disponible: {item.current.availableStock ?? 'No controlado'}</span><span>Registrado {money(item.stored.price)} · Actual {money(item.current.price)}</span>{item.alerts?.map((alert) => <b key={alert.code} className="cart-admin-alert">{alert.message}</b>)}</div><div className="cart-admin-quantity"><button type="button" disabled={!canDelete || busy} onClick={() => changeQuantity(index, item.stored.qty - 1)}>-</button><span>{item.stored.qty}</span><button type="button" disabled={!canDelete || busy} onClick={() => changeQuantity(index, item.stored.qty + 1)}>+</button><button type="button" disabled={!canDelete || busy} onClick={() => changeQuantity(index, 0)}>Eliminar</button></div></article>)}</div></section>
          <section className="cart-admin-detail-section"><h3>Etiquetas y notas internas</h3><label>Etiquetas separadas por coma<input value={tagsText} onChange={(event) => setTagsText(event.target.value)} disabled={!canRecover} /></label><button type="button" className="cart-admin-button secondary" disabled={!canRecover || busy} onClick={saveTags}>Guardar etiquetas</button><label>Nueva nota<textarea value={note} onChange={(event) => setNote(event.target.value)} rows="3" disabled={!canRecover} /></label><button type="button" className="cart-admin-button secondary" disabled={!canRecover || !note.trim() || busy} onClick={saveNote}>Registrar nota</button><div className="cart-admin-history">{(detail.adminNotes || []).map((entry) => <article key={entry._id || entry.createdAt}><strong>{entry.authorName || 'Administrador'}</strong><span>{formatDate(entry.createdAt)}</span><p>{entry.text}</p></article>)}</div></section>
          <section className="cart-admin-detail-section"><h3>Recuperacion comercial</h3><p>Destinatario: {detail.userEmail || 'Sin correo valido'} · Asunto: Completa tu compra</p><div className="cart-admin-recovery-actions"><button type="button" className="cart-admin-button" disabled={!canRecover || detail.lifecycle !== 'recoverable' || busy} onClick={generateLink}>Generar enlace seguro</button><button type="button" className="cart-admin-button secondary" disabled={!recoveryLink?.link} onClick={copyRecoveryLink}>Copiar enlace</button><button type="button" className="cart-admin-button secondary" disabled={!canRecover || !detail.recovery?.emailAvailable || detail.lifecycle !== 'recoverable' || busy} onClick={sendRecoveryEmail}>Enviar correo</button></div>{!detail.userEmail && <p className="cart-admin-help">El carrito no tiene un correo valido.</p>}{detail.userEmail && !detail.recovery?.emailAvailable && <p className="cart-admin-help">{detail.recovery?.emailUnavailableReason}</p>}{recoveryLink && <p className="cart-admin-help">Enlace listo. Expira: {formatDate(recoveryLink.expiresAt)}.</p>}<div className="cart-admin-history">{(detail.recovery?.attempts || []).slice().reverse().map((entry) => <article key={entry._id || entry.createdAt}><strong>{entry.channel} · {entry.result}</strong><span>{formatDate(entry.createdAt)}</span><p>{entry.subject || entry.detail || 'Seguimiento registrado'}</p></article>)}</div></section>
          {canDelete && <section className="cart-admin-detail-section danger"><h3>Acciones destructivas</h3><div><button type="button" disabled={busy} onClick={clearCart}>Vaciar carrito</button><button type="button" disabled={busy} onClick={deleteCart}>Eliminar carrito</button></div></section>}
        </div>}
      </aside></div>}
    </main>
  );
}
