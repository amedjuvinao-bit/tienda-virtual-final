import { useEffect, useLayoutEffect, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import api from '../../../lib/api';
import { useAuth } from '../../../context/AuthContext';
import { hasAdminPermission } from '../../security/adminPermissions';
import { describeLog } from './logPresentation';

const EMPTY_FILTERS = { username: '', status: '', module: '', fromDate: '', toDate: '' };
const STATUS_LABELS = {
  success: 'Correcto', pending: 'Pendiente', failed: 'Fallido',
  blocked: 'Bloqueado', error: 'Error', unknown: 'Sin estado',
};
function statusStyle(status) {
  if (status === 'success') return 'border border-emerald-500/50 bg-emerald-500/15';
  if (status === 'failed' || status === 'error' || status === 'blocked') return 'border border-red-500/50 bg-red-500/15';
  return 'border border-amber-500/50 bg-amber-500/15';
}
const MODULE_LABELS = {
  'admin-users': 'Usuarios', roles: 'Perfiles', branches: 'Sedes',
  seguridad: 'Seguridad', logs: 'Logs', settings: 'Configuración',
  orders: 'Órdenes', pos: 'POS', inventory: 'Inventario',
  billing: 'Facturación', customers: 'Clientes', products: 'Productos',
  finance: 'Finanzas', payments: 'Pagos', reports: 'Reportes',
  coupons: 'Cupones', carts: 'Carritos', favorites: 'Favoritos',
  pages: 'Páginas', appearance: 'Apariencia', dashboard: 'Panel',
  media: 'Archivos', geo: 'Ubicaciones',
};

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('es-CO');
}

function toQuery(scope, filters) {
  const params = { scope };
  if (filters.username.trim()) params.username = filters.username.trim();
  if (filters.status) params.status = filters.status;
  if (scope === 'operations' && filters.module) params.module = filters.module;
  if (filters.fromDate) params.from = new Date(`${filters.fromDate}T00:00:00`).toISOString();
  if (filters.toDate) {
    const nextDay = new Date(`${filters.toDate}T00:00:00`);
    nextDay.setDate(nextDay.getDate() + 1);
    params.to = nextDay.toISOString();
  }
  return params;
}

export default function LogsSection() {
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  const { adminUser } = useAuth();
  const canExport = hasAdminPermission(adminUser, 'logs:export');
  const [scope, setScope] = useState('login');
  const [draft, setDraft] = useState(EMPTY_FILTERS);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError('');
    api.get('/api/admin/audit-logs', {
      params: { ...toQuery(scope, filters), page, limit: 25 },
    }).then((res) => {
      if (!current) return;
      setLogs(res.data.data || []);
      setPagination(res.data.pagination || { page, pages: 1, total: 0 });
    }).catch((err) => {
      if (!current) return;
      setLogs([]);
      setError(err?.userMessage || 'No se pudieron cargar los registros.');
    }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [scope, filters, page, refresh]);

  function changeScope(nextScope) {
    setScope(nextScope);
    setPage(1);
    setDraft(EMPTY_FILTERS);
    setFilters(EMPTY_FILTERS);
  }

  function applyFilters(event) {
    event.preventDefault();
    if (draft.fromDate && draft.toDate && draft.fromDate > draft.toDate) {
      setError('La fecha final debe ser igual o posterior a la inicial.');
      return;
    }
    setPage(1);
    setFilters({ ...draft });
  }

  async function exportLogs() {
    if (!canExport || exporting) return;
    setExporting(true);
    setError('');
    try {
      const response = await api.get('/api/admin/audit-logs/export', {
        params: { ...toQuery(scope, filters), limit: 5000 },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `auditoria-${scope}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err?.userMessage || 'No se pudo exportar el registro.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <section className="rounded-3xl border p-4 shadow-sm sm:p-6" style={{
      background: 'var(--admin-card-bg, #fff)', color: 'var(--admin-card-text, #111827)',
      borderColor: 'var(--admin-card-border, #e5e7eb)',
    }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Auditoría administrativa</h2>
          <p className="mt-1 text-sm opacity-75">Consulta accesos y cambios protegidos en el panel.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setRefresh((value) => value + 1)} disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold disabled:opacity-50">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Actualizar
          </button>
          {canExport && <button type="button" onClick={exportLogs} disabled={exporting || loading}
            className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold disabled:opacity-50">
            <Download size={16} /> {exporting ? 'Exportando…' : 'Exportar CSV'}
          </button>}
        </div>
      </div>

      <div className="mt-5 flex gap-2" role="tablist" aria-label="Tipo de registro">
        {[['login', 'Accesos'], ['operations', 'Operaciones']].map(([value, label]) => (
          <button key={value} type="button" role="tab" aria-selected={scope === value}
            onClick={() => changeScope(value)}
            className={`rounded-xl border px-4 py-2 text-sm font-semibold ${scope === value ? 'border-cyan-500 bg-cyan-500/15' : 'opacity-70'}`}>
            {label}
          </button>
        ))}
      </div>

      <form onSubmit={applyFilters} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-sm">Usuario
          <input className="mt-1 w-full rounded-xl border bg-transparent p-2" value={draft.username} maxLength={80}
            onChange={(event) => setDraft({ ...draft, username: event.target.value })} placeholder="Nombre de usuario" />
        </label>
        <label className="text-sm">Estado
          <select className="mt-1 w-full rounded-xl border bg-transparent p-2" value={draft.status}
            onChange={(event) => setDraft({ ...draft, status: event.target.value })}>
            <option value="">Todos</option>
            {(scope === 'login' ? ['success', 'pending', 'failed', 'blocked', 'error'] : ['success', 'failed'])
              .map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
          </select>
        </label>
        {scope === 'operations' && <label className="text-sm">Módulo
          <select className="mt-1 w-full rounded-xl border bg-transparent p-2" value={draft.module}
            onChange={(event) => setDraft({ ...draft, module: event.target.value })}>
            <option value="">Todos</option>
            {Object.entries(MODULE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>}
        <label className="text-sm">Desde
          <input type="date" className="mt-1 w-full rounded-xl border bg-transparent p-2" value={draft.fromDate}
            onChange={(event) => setDraft({ ...draft, fromDate: event.target.value })} />
        </label>
        <label className="text-sm">Hasta
          <input type="date" className="mt-1 w-full rounded-xl border bg-transparent p-2" value={draft.toDate}
            onChange={(event) => setDraft({ ...draft, toDate: event.target.value })} />
        </label>
        <div className="flex items-end gap-2">
          <button type="submit" className="rounded-xl bg-cyan-700 px-4 py-2 text-sm font-semibold text-white">Buscar</button>
          <button type="button" className="rounded-xl border px-3 py-2 text-sm" onClick={() => {
            setDraft(EMPTY_FILTERS); setFilters(EMPTY_FILTERS); setPage(1); setRefresh((value) => value + 1);
          }}>Limpiar</button>
        </div>
      </form>

      {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <p className="mt-4 text-sm opacity-75" aria-live="polite">
        {loading ? 'Cargando registros…' : `${pagination.total} registro(s) · página ${pagination.page} de ${pagination.pages}`}
        {canExport && ' · La exportación incluye hasta 5000 registros que coincidan con la búsqueda.'}
      </p>

      <div className="mt-3 space-y-3 md:hidden">
        {!loading && !error && logs.length === 0 && <p className="rounded-xl border p-5 text-center text-sm opacity-70">
          No hay registros con estos filtros.
        </p>}
        {!loading && logs.map((log) => <article key={log._id} className="rounded-xl border p-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <strong>{log.username || 'Usuario desconocido'}</strong>
            <span className={`rounded-lg px-2 py-1 ${statusStyle(log.status)}`}>{STATUS_LABELS[log.status] || log.status}</span>
          </div>
          <p className="mt-1 opacity-70">{formatDate(log.createdAt)} · IP: {log.ip || '—'}</p>
          <p className="mt-3">{describeLog(log)}</p>
          {scope === 'operations' && <p className="mt-2 break-all opacity-70">
            {MODULE_LABELS[log.module] || log.module || 'Operación'} · Recurso: {log.resourceId || '—'}
          </p>}
        </article>)}
      </div>
      <div className="mt-3 hidden overflow-x-auto rounded-xl border md:block">
        <table className="w-full min-w-[700px] text-sm">
          <thead className="bg-cyan-500/10"><tr>
            {['Fecha', 'Usuario', 'IP', 'Estado', 'Acción', ...(scope === 'operations' ? ['Módulo', 'Recurso'] : [])]
              .map((label) => <th key={label} className="p-3 text-left font-semibold">{label}</th>)}
          </tr></thead>
          <tbody>
            {!loading && !error && logs.length === 0 && <tr><td colSpan={scope === 'operations' ? 7 : 5}
              className="p-6 text-center opacity-70">No hay registros con estos filtros.</td></tr>}
            {!loading && logs.map((log) => <tr key={log._id} className="border-t align-top">
              <td className="whitespace-nowrap p-3">{formatDate(log.createdAt)}</td>
              <td className="p-3">{log.username || '—'}</td>
              <td className="p-3">{log.ip || '—'}</td>
              <td className="p-3"><span className={`rounded-lg px-2 py-1 font-medium ${statusStyle(log.status)}`}>
                {STATUS_LABELS[log.status] || log.status}</span></td>
              <td className="min-w-48 p-3">{describeLog(log)}</td>
              {scope === 'operations' && <><td className="p-3">{MODULE_LABELS[log.module] || log.module || '—'}</td>
                <td className="max-w-48 break-all p-3" title={log.resourceId}>{log.resourceId || '—'}</td></>}
            </tr>)}
          </tbody>
        </table>
      </div>
      <nav className="mt-4 flex items-center justify-end gap-2" aria-label="Páginas de auditoría">
        <button type="button" className="rounded-xl border px-3 py-2 text-sm disabled:opacity-40"
          disabled={loading || page <= 1} onClick={() => setPage((value) => value - 1)}>Anterior</button>
        <span className="text-sm">{page} / {pagination.pages}</span>
        <button type="button" className="rounded-xl border px-3 py-2 text-sm disabled:opacity-40"
          disabled={loading || page >= pagination.pages} onClick={() => setPage((value) => value + 1)}>Siguiente</button>
      </nav>
    </section>
  );
}
