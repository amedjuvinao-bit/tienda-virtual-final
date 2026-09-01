import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  BadgeCheck,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Loader2,
  RefreshCw,
  Search,
  UserRound,
} from 'lucide-react';

import {
  getAdminCustomerCrmAssignees,
  getAdminCustomerCrmQueue,
  recordAdminCustomerFollowUpResult,
  updateAdminCustomerFollowUp,
} from '../api/adminCustomersApi';
import CustomerFollowUpResultModal from './CustomerFollowUpResultModal';

const DUE_FILTERS = [
  ['all', 'Todos'],
  ['overdue', 'Vencidos'],
  ['today', 'Hoy'],
  ['upcoming', 'Próximos'],
  ['unscheduled', 'Sin fecha'],
];
const PRIORITIES = [
  ['all', 'Todas'],
  ['urgent', 'Urgente'],
  ['high', 'Alta'],
  ['normal', 'Normal'],
  ['low', 'Baja'],
];

function formatDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return 'Sin fecha programada';
  return date.toLocaleString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function priorityTone(priority) {
  if (priority === 'urgent') return 'border-red-200 bg-red-50 text-red-700';
  if (priority === 'high') return 'border-orange-200 bg-orange-50 text-orange-700';
  if (priority === 'low') return 'border-slate-200 bg-slate-50 text-slate-600';
  return 'border-pink-200 bg-pink-50 text-pink-700';
}

function SummaryCard({ label, value, active, onClick, icon: Icon }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="border-b-2 p-4 text-left transition hover:bg-pink-50/50"
      style={{
        borderColor: active ? 'var(--admin-primary)' : 'transparent',
        background: active ? '#fff7fb' : '#fff',
      }}
    >
      <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.13em]" style={{ color: 'var(--admin-card-muted-text)' }}><Icon className="h-4 w-4" /> {label}</p>
      <p className="mt-2 text-2xl font-black" style={{ color: active ? 'var(--admin-primary)' : 'var(--admin-card-text)' }}>{Number(value || 0)}</p>
    </button>
  );
}

export default function CustomerCrmWorkspace({ onOpenCustomer }) {
  const [queue, setQueue] = useState([]);
  const [summary, setSummary] = useState({});
  const [assignees, setAssignees] = useState([]);
  const [filters, setFilters] = useState({
    q: '',
    dueScope: 'all',
    priority: 'all',
    assignedTo: 'all',
    status: 'pending',
  });
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState('');
  const [resultItem, setResultItem] = useState(null);
  const [error, setError] = useState('');
  const requestSequence = useRef(0);

  const loadQueue = async () => {
    const requestId = requestSequence.current + 1;
    requestSequence.current = requestId;
    try {
      setLoading(true);
      setError('');
      const response = await getAdminCustomerCrmQueue({
        ...filters,
        page,
        limit: 25,
      });
      if (requestId !== requestSequence.current) return;
      setQueue(Array.isArray(response?.followUps) ? response.followUps : []);
      setSummary(response?.summary || {});
      setPages(Math.max(1, Number(response?.pages || 1)));
    } catch (err) {
      if (requestId !== requestSequence.current) return;
      setError(err?.message || 'No fue posible cargar la bandeja CRM.');
      setQueue([]);
    } finally {
      if (requestId === requestSequence.current) setLoading(false);
    }
  };

  useEffect(() => {
    getAdminCustomerCrmAssignees()
      .then((response) => setAssignees(
        Array.isArray(response?.assignees) ? response.assignees : []
      ))
      .catch(() => setAssignees([]));
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(loadQueue, 250);
    return () => {
      window.clearTimeout(timeout);
      requestSequence.current += 1;
    };
  }, [filters, page]);

  const changeFilter = (key, value) => {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const updateTask = async (item, patch) => {
    try {
      setSavingId(item.id);
      setError('');
      await updateAdminCustomerFollowUp(item.customerId, item.id, {
        ...item,
        ...patch,
      });
      await loadQueue();
    } catch (err) {
      setError(err?.message || 'No fue posible actualizar la gestión.');
    } finally {
      setSavingId('');
    }
  };

  const recordResult = async (payload) => {
    if (!resultItem?.customerId || !resultItem?.id) return;
    try {
      setSavingId(resultItem.id);
      await recordAdminCustomerFollowUpResult(
        resultItem.customerId,
        resultItem.id,
        payload
      );
      setResultItem(null);
      await loadQueue();
    } finally {
      setSavingId('');
    }
  };

  return (
    <section className="rounded-xl border bg-white p-5 lg:p-6" style={{ borderColor: 'var(--admin-card-border)', boxShadow: '0 10px 30px rgba(15,23,42,0.05)' }}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: 'var(--admin-primary)' }}>Centro de trabajo CRM</p>
          <h2 className="mt-1 text-2xl font-black" style={{ color: 'var(--admin-card-text)' }}>Bandeja de seguimientos</h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--admin-card-muted-text)' }}>Prioriza tareas vencidas, responsables y próximas acciones sin abrir cliente por cliente.</p>
        </div>
        <button type="button" onClick={loadQueue} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border bg-white px-4 py-2.5 text-xs font-black disabled:opacity-50" style={{ borderColor: 'rgba(236,72,153,0.22)', color: 'var(--admin-primary)' }}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar</button>
      </div>

      <div className="mt-5 grid overflow-hidden rounded-lg border sm:grid-cols-2 xl:grid-cols-5 xl:divide-x" style={{ borderColor: 'rgba(148,163,184,0.22)' }}>
        <SummaryCard icon={Clock3} label="Pendientes" value={summary.pending} active={filters.dueScope === 'all'} onClick={() => changeFilter('dueScope', 'all')} />
        <SummaryCard icon={AlertCircle} label="Vencidos" value={summary.overdue} active={filters.dueScope === 'overdue'} onClick={() => changeFilter('dueScope', 'overdue')} />
        <SummaryCard icon={CalendarClock} label="Para hoy" value={summary.today} active={filters.dueScope === 'today'} onClick={() => changeFilter('dueScope', 'today')} />
        <SummaryCard icon={CalendarClock} label="Próximos" value={summary.upcoming} active={filters.dueScope === 'upcoming'} onClick={() => changeFilter('dueScope', 'upcoming')} />
        <SummaryCard icon={Clock3} label="Sin fecha" value={summary.unscheduled} active={filters.dueScope === 'unscheduled'} onClick={() => changeFilter('dueScope', 'unscheduled')} />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_190px_220px_170px]">
        <label className="flex items-center gap-2 rounded-lg border bg-white px-4 py-3" style={{ borderColor: 'rgba(148,163,184,0.24)' }}><Search className="h-4 w-4" style={{ color: 'var(--admin-primary)' }} /><input value={filters.q} onChange={(event) => changeFilter('q', event.target.value)} className="w-full bg-transparent text-sm font-bold outline-none" placeholder="Buscar cliente o gestión" /></label>
        <select value={filters.priority} onChange={(event) => changeFilter('priority', event.target.value)} className="rounded-lg border bg-white px-4 py-3 text-sm font-bold" style={{ borderColor: 'rgba(148,163,184,0.24)' }}>{PRIORITIES.map(([value, label]) => <option key={value} value={value}>Prioridad: {label}</option>)}</select>
        <select value={filters.assignedTo} onChange={(event) => changeFilter('assignedTo', event.target.value)} className="rounded-lg border bg-white px-4 py-3 text-sm font-bold" style={{ borderColor: 'rgba(148,163,184,0.24)' }}><option value="all">Todos los responsables</option><option value="me">Asignadas a mí</option><option value="unassigned">Sin responsable</option>{assignees.map((admin) => <option key={admin.id} value={admin.id}>{admin.name}</option>)}</select>
        <select value={filters.status} onChange={(event) => changeFilter('status', event.target.value)} className="rounded-lg border bg-white px-4 py-3 text-sm font-bold" style={{ borderColor: 'rgba(148,163,184,0.24)' }}><option value="pending">Pendientes</option><option value="done">Realizadas</option><option value="cancelled">Canceladas</option><option value="all">Todos los estados</option></select>
      </div>

      {error ? <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div> : null}
      <div className="mt-4 overflow-hidden rounded-lg border" style={{ borderColor: 'rgba(148,163,184,0.22)' }}>
        {loading ? <div className="bg-white p-8 text-center"><Loader2 className="mx-auto h-7 w-7 animate-spin" style={{ color: 'var(--admin-primary)' }} /><p className="mt-2 text-sm font-black">Cargando seguimientos...</p></div> : null}
        {!loading && !queue.length ? <div className="bg-white p-8 text-center text-sm font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>No hay gestiones para estos filtros.</div> : null}
        {!loading ? queue.map((item) => (
          <article key={item.id} className="grid gap-4 border-b bg-white p-4 last:border-b-0 hover:bg-pink-50/30 xl:grid-cols-[1.2fr_1fr_220px_auto] xl:items-center" style={{ borderColor: 'rgba(148,163,184,0.18)' }}>
            <div className="min-w-0">
              <button type="button" onClick={() => item.customer && onOpenCustomer?.(item.customer)} className="flex items-center gap-2 text-left font-black" style={{ color: 'var(--admin-card-text)' }}><UserRound className="h-4 w-4" style={{ color: 'var(--admin-primary)' }} /> {item.customer?.fullName || 'Cliente no disponible'}</button>
              <p className="mt-2 text-sm font-bold leading-relaxed" style={{ color: 'var(--admin-card-text)' }}>{item.note}</p>
              <p className="mt-1 text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>{item.nextAction || item.typeLabel} · {formatDate(item.dueAt)}</p>
              {item.outcomeLabel ? <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3"><p className="text-[10px] font-black uppercase text-emerald-700">Último resultado: {item.outcomeLabel}</p>{item.outcomeNote ? <p className="mt-1 text-xs font-bold text-emerald-900">{item.outcomeNote}</p> : null}{item.outcomeAt ? <p className="mt-1 text-[10px] font-bold text-emerald-700">Registrado: {formatDate(item.outcomeAt)} · {item.outcomeByAdmin?.name || 'Administrador'}</p> : null}</div> : null}
            </div>
            <div className="flex flex-wrap gap-2"><span className={`rounded-xl border px-3 py-1.5 text-[10px] font-black uppercase ${priorityTone(item.priority)}`}>{item.priorityLabel}</span><span className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-black uppercase text-slate-600">{item.statusLabel}</span></div>
            <div className="grid gap-2">
              <select disabled={savingId === item.id || item.status !== 'pending'} value={item.assignedToAdmin?.id || 'unassigned'} onChange={(event) => updateTask(item, { assignedToAdmin: event.target.value })} className="rounded-xl border px-3 py-2 text-xs font-bold disabled:opacity-60" style={{ borderColor: 'rgba(236,72,153,0.18)' }}><option value="unassigned">Sin responsable</option>{assignees.map((admin) => <option key={admin.id} value={admin.id}>{admin.name}</option>)}</select>
              <select disabled={savingId === item.id || item.status !== 'pending'} value={item.priority || 'normal'} onChange={(event) => updateTask(item, { priority: event.target.value })} className="rounded-xl border px-3 py-2 text-xs font-bold disabled:opacity-60" style={{ borderColor: 'rgba(236,72,153,0.18)' }}>{PRIORITIES.filter(([value]) => value !== 'all').map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            </div>
            {item.status === 'pending' ? <button type="button" disabled={savingId === item.id} onClick={() => setResultItem(item)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 disabled:opacity-50">{savingId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />} Registrar resultado</button> : <span className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-600"><BadgeCheck className="h-4 w-4" /> {item.outcomeLabel || 'Cierre sin resultado'}</span>}
          </article>
        )) : null}
      </div>

      {pages > 1 ? <div className="mt-4 flex items-center justify-end gap-3"><button type="button" disabled={page <= 1 || loading} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-xl border bg-white p-2 disabled:opacity-40" aria-label="Página anterior CRM"><ChevronLeft className="h-4 w-4" /></button><span className="text-xs font-black" style={{ color: 'var(--admin-card-muted-text)' }}>Página {page} de {pages}</span><button type="button" disabled={page >= pages || loading} onClick={() => setPage((current) => Math.min(pages, current + 1))} className="rounded-xl border bg-white p-2 disabled:opacity-40" aria-label="Siguiente página CRM"><ChevronRight className="h-4 w-4" /></button></div> : null}
      <CustomerFollowUpResultModal item={resultItem} saving={savingId === resultItem?.id} onClose={() => setResultItem(null)} onSubmit={recordResult} />
    </section>
  );
}
