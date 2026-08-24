import { useState } from 'react';
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  ChevronRight,
  LayoutList,
  Rows3,
  ShoppingBag,
  Truck,
} from 'lucide-react';

const QUEUE_STYLES = {
  attention: { label: 'Atención', color: '#be123c', bg: '#fff1f2' },
  incidents: { label: 'Incidencia', color: '#be123c', bg: '#fff1f2' },
  sla_risk: { label: 'SLA prioritario', color: '#b45309', bg: '#fffbeb' },
  awaiting_payment: { label: 'Esperando pago', color: '#0369a1', bg: '#f0f9ff' },
  prepare: { label: 'Preparación', color: 'var(--admin-primary)', bg: 'var(--admin-primary-soft-bg)' },
  dispatch: { label: 'Despacho', color: '#7c3aed', bg: '#f5f3ff' },
  transit: { label: 'En tránsito', color: '#0369a1', bg: '#f0f9ff' },
  completed: { label: 'Completada', color: '#047857', bg: '#ecfdf5' },
  monitor: { label: 'Seguimiento', color: '#475569', bg: '#f8fafc' },
};

const STATUS_LABELS = {
  pending: 'Pendiente',
  processing: 'Procesando',
  paid: 'Pagada',
  failed: 'Fallida',
  shipped: 'Enviada',
  delivered: 'Entregada',
  cancelled: 'Cancelada',
  canceled: 'Cancelada',
  refunded: 'Reembolsada',
};

function customerName(order) {
  const customer = order?.customer || {};
  return [customer.name, customer.lastname].filter(Boolean).join(' ') || 'Cliente';
}

function branchInfo(order) {
  const allocations = Array.isArray(order?.inventoryAllocations) ? order.inventoryAllocations : [];
  const branches = new Map();
  allocations.forEach((allocation) => {
    const snapshot = allocation?.branchSnapshot || {};
    const branch = allocation?.branch || {};
    const key = String(branch?._id || branch?.id || branch || snapshot.code || snapshot.name || '');
    if (!key || branches.has(key)) return;
    branches.set(key, {
      name: snapshot.name || branch?.name || 'Sede',
      code: String(snapshot.code || branch?.code || '').toUpperCase(),
    });
  });
  if (branches.size > 1) return `${branches.size} sedes`;
  const single = Array.from(branches.values())[0];
  if (single) return single.code || single.name;
  return order?.branchSnapshot?.code || order?.branchSnapshot?.name || order?.branch?.code || order?.branch?.name || 'Sin sede';
}

function channelLabel(order) {
  const source = String(order?.source || '').toLowerCase();
  const channel = String(order?.channel || '').toLowerCase();
  const provider = String(order?.payment?.provider || '').toLowerCase();
  if (source === 'pos' || channel === 'physical_store' || provider === 'pos' || order?.pos?.receiptNumber) return 'POS';
  if (source === 'manual') return 'Manual';
  if (source === 'admin') return 'Admin';
  if (source === 'import') return 'Importada';
  return 'Web';
}

function formatSla(operational) {
  const state = operational?.sla?.state || 'none';
  const remainingMs = Number(operational?.sla?.remainingMs);
  if (state === 'breached') {
    const hours = Number.isFinite(remainingMs) ? Math.max(1, Math.ceil(Math.abs(remainingMs) / 3600000)) : null;
    return hours ? `Vencido hace ${hours} h` : 'SLA vencido';
  }
  if (state === 'risk' && Number.isFinite(remainingMs)) {
    return `Vence en ${Math.max(1, Math.ceil(remainingMs / 3600000))} h`;
  }
  if (state === 'on_track') return 'SLA en tiempo';
  return 'Sin SLA activo';
}

export default function OrdersTable({
  ADMIN_BORDER,
  data,
  loading,
  total = 0,
  from = 0,
  to = 0,
  limit = 20,
  onLimitChange,
  selectedIds,
  selectionEnabled = false,
  toggleSelectAllVisible,
  toggleOne,
  isSelected,
  toggleSort,
  sortAria,
  sortIcon,
  fmtDate,
  toCOP,
  statusBadgeClasses,
  openOrderDetail,
}) {
  const [density, setDensity] = useState('comfortable');
  const compact = density === 'compact';

  return (
    <section
      aria-label="Bandeja operacional de órdenes"
      className="overflow-hidden rounded-2xl border shadow-sm"
      style={{
        borderColor: ADMIN_BORDER,
        background: 'var(--admin-card-bg)',
        color: 'var(--admin-card-text)',
      }}
    >
      <header
        className="flex flex-col gap-3 border-b px-4 py-3 lg:flex-row lg:items-center lg:justify-between"
        style={{ borderColor: ADMIN_BORDER, background: 'var(--admin-card-bg)' }}
      >
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <h2 className="text-base font-black">Listado de órdenes</h2>
            <span className="text-[10px] font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>
              {loading ? 'Cargando…' : `${total} total · ${from}–${to}`}
            </span>
          </div>
          <p className="mt-0.5 text-[10px]" style={{ color: 'var(--admin-card-muted-text)' }}>
            La prioridad y la siguiente acción aparecen dentro de cada fila.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {selectionEnabled ? (
            <label className="flex h-9 items-center gap-2 rounded-lg border px-2.5 text-[10px] font-black" style={{ borderColor: ADMIN_BORDER }}>
              <input
                aria-label="Seleccionar órdenes visibles"
                type="checkbox"
                style={{ accentColor: 'var(--admin-primary)' }}
                checked={data.length > 0 && data.every((order) => selectedIds.has(order._id))}
                onChange={toggleSelectAllVisible}
              />
              Seleccionar página
            </label>
          ) : null}

          <label className="flex h-9 items-center gap-2 rounded-lg border px-2.5 text-[10px] font-bold" style={{ borderColor: ADMIN_BORDER }}>
            <span>Filas</span>
            <select
              aria-label="Órdenes por página"
              value={limit}
              onChange={(event) => onLimitChange?.(Number(event.target.value))}
              className="bg-transparent font-black outline-none"
              style={{ color: 'var(--admin-card-text)' }}
            >
              {[10, 20, 50, 100].map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>

          <div aria-label="Densidad del listado" className="flex h-9 overflow-hidden rounded-lg border" style={{ borderColor: ADMIN_BORDER }}>
            <button
              type="button"
              aria-label="Vista cómoda"
              aria-pressed={!compact}
              onClick={() => setDensity('comfortable')}
              className="flex w-9 items-center justify-center"
              style={{
                background: !compact ? 'var(--admin-primary)' : 'var(--admin-card-bg)',
                color: !compact ? 'var(--admin-primary-text)' : 'var(--admin-card-muted-text)',
              }}
            >
              <LayoutList className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Vista compacta"
              aria-pressed={compact}
              onClick={() => setDensity('compact')}
              className="flex w-9 items-center justify-center"
              style={{
                background: compact ? 'var(--admin-primary)' : 'var(--admin-card-bg)',
                color: compact ? 'var(--admin-primary-text)' : 'var(--admin-card-muted-text)',
              }}
            >
              <Rows3 className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex gap-1.5 xl:hidden">
          {[
            ['createdAt', 'Fecha'],
            ['orderNumber', 'Orden'],
            ['total', 'Total'],
          ].map(([field, label]) => (
            <button
              key={field}
              type="button"
              onClick={() => toggleSort(field)}
              className="h-8 rounded-lg border px-2 text-[10px] font-black"
              style={{ borderColor: ADMIN_BORDER }}
            >
              {label} {sortIcon(field)}
            </button>
          ))}
        </div>
      </header>

      {loading ? (
        <div className="space-y-2 p-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-16 animate-pulse rounded-xl" style={{ background: 'var(--admin-primary-soft-bg)' }} />
          ))}
        </div>
      ) : null}

      {!loading && data.length === 0 ? (
        <div className="px-6 py-14 text-center">
          <ShoppingBag className="mx-auto h-8 w-8" style={{ color: 'var(--admin-card-muted-text)' }} />
          <p className="mt-3 text-sm font-black">No hay órdenes para esta cola</p>
          <p className="mt-1 text-xs" style={{ color: 'var(--admin-card-muted-text)' }}>
            Cambia la vista operativa o restablece los filtros.
          </p>
        </div>
      ) : null}

      {!loading && data.length > 0 ? (
        <table className="block w-full table-fixed xl:table" aria-label="Órdenes operativas">
          <colgroup className="hidden xl:table-column-group">
            <col style={{ width: '28%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '31%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '12%' }} />
          </colgroup>
          <thead className="hidden xl:table-header-group">
            <tr style={{ background: 'var(--admin-input-bg)' }}>
              <SortableHeader field="orderNumber" label="Orden y cliente" {...{ ADMIN_BORDER, toggleSort, sortAria, sortIcon }} />
              <SortableHeader field="total" label="Venta" {...{ ADMIN_BORDER, toggleSort, sortAria, sortIcon }} />
              <HeaderCell label="Operación" ADMIN_BORDER={ADMIN_BORDER} />
              <SortableHeader field="createdAt" label="Estado / fecha" {...{ ADMIN_BORDER, toggleSort, sortAria, sortIcon }} />
              <HeaderCell label="Acción" ADMIN_BORDER={ADMIN_BORDER} align="right" />
            </tr>
          </thead>
          <tbody className="block space-y-2 p-2 xl:table-row-group xl:space-y-0 xl:p-0">
            {data.map((order) => (
              <OrderRow
                key={order._id}
                order={order}
                compact={compact}
                {...{
                  ADMIN_BORDER,
                  selectionEnabled,
                  toggleOne,
                  isSelected,
                  fmtDate,
                  toCOP,
                  statusBadgeClasses,
                  openOrderDetail,
                }}
              />
            ))}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}

function SortableHeader({ ADMIN_BORDER, field, label, toggleSort, sortAria, sortIcon }) {
  return (
    <th
      scope="col"
      aria-sort={sortAria(field)}
      className="border-b px-3 py-2.5 text-left"
      style={{ borderColor: ADMIN_BORDER }}
    >
      <button type="button" onClick={() => toggleSort(field)} className="text-[9px] font-black uppercase tracking-[0.14em]">
        {label} {sortIcon(field)}
      </button>
    </th>
  );
}

function HeaderCell({ ADMIN_BORDER, label, align = 'left' }) {
  return (
    <th
      scope="col"
      className={`border-b px-3 py-2.5 text-[9px] font-black uppercase tracking-[0.14em] ${align === 'right' ? 'text-right' : 'text-left'}`}
      style={{ borderColor: ADMIN_BORDER }}
    >
      {label}
    </th>
  );
}

function OrderRow({
  order,
  compact,
  ADMIN_BORDER,
  selectionEnabled,
  toggleOne,
  isSelected,
  fmtDate,
  toCOP,
  statusBadgeClasses,
  openOrderDetail,
}) {
  const customer = order.customer || {};
  const operational = order.operational || {};
  const queue = QUEUE_STYLES[operational.queue] || QUEUE_STYLES.monitor;
  const progress = Math.min(100, Math.max(0, Number(operational.progress || 0)));
  const tags = Array.isArray(order.tags) ? order.tags : [];
  const slaState = operational?.sla?.state || 'none';
  const cellPadding = compact ? 'xl:py-2.5' : 'xl:py-3.5';

  return (
    <tr
      className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-xl border p-3 transition hover:bg-[var(--admin-primary-soft-bg)] xl:table-row xl:rounded-none xl:border-0 xl:p-0"
      style={{ borderColor: ADMIN_BORDER }}
    >
      <td
        className={`order-1 col-span-2 block min-w-0 border-b-0 xl:table-cell xl:border-b xl:px-3 ${cellPadding}`}
        style={{ borderColor: ADMIN_BORDER, borderLeft: `3px solid ${queue.color}` }}
      >
        <div className="flex min-w-0 items-start gap-2.5">
          {selectionEnabled ? (
            <input
              aria-label={`Seleccionar orden ${order.orderNumber || order._id}`}
              type="checkbox"
              className="mt-1 shrink-0"
              style={{ accentColor: 'var(--admin-primary)' }}
              checked={isSelected(order._id)}
              onChange={() => toggleOne(order._id)}
            />
          ) : null}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <strong className="font-mono text-xs" style={{ color: 'var(--admin-primary)' }}>
                #{order.orderNumber || '—'}
              </strong>
              <span className="rounded-md px-1.5 py-0.5 text-[8px] font-black uppercase" style={{ background: queue.bg, color: queue.color }}>
                {queue.label}
              </span>
            </div>
            <p className="mt-1 truncate text-xs font-black">{customerName(order)}</p>
            <p className="mt-0.5 truncate text-[9px]" style={{ color: 'var(--admin-card-muted-text)' }}>
              {customer.emailOrPhone || customer.email || customer.phone || 'Sin contacto'}
            </p>
            {!compact && tags.length ? (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {tags.slice(0, 2).map((tag) => (
                  <span key={tag} className="rounded border px-1 py-0.5 text-[8px] font-bold" style={{ borderColor: ADMIN_BORDER }}>#{tag}</span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </td>

      <td className={`order-2 block min-w-0 border-b-0 xl:table-cell xl:border-b xl:px-3 ${cellPadding}`} style={{ borderColor: ADMIN_BORDER }}>
        <p className="truncate text-sm font-black tabular-nums">{toCOP(order.total || 0)}</p>
        <p className="mt-1 truncate text-[9px]" style={{ color: 'var(--admin-card-muted-text)' }}>
          {order.totalItems || 0} ud. · {channelLabel(order)}
        </p>
        <p className="mt-1 flex items-center gap-1 truncate text-[9px] font-bold">
          <Building2 className="h-3 w-3 shrink-0" />
          {branchInfo(order)}
        </p>
      </td>

      <td className={`order-4 col-span-2 block min-w-0 border-b-0 xl:table-cell xl:border-b xl:px-3 ${cellPadding}`} style={{ borderColor: ADMIN_BORDER }}>
        <div className="min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-[10px] font-black">{operational.nextAction || 'Revisar orden'}</p>
            {operational.openIncidentCount ? (
              <span className="flex shrink-0 items-center gap-1 text-[8px] font-black text-rose-700">
                <AlertTriangle className="h-3 w-3" />
                {operational.openIncidentCount}
              </span>
            ) : null}
          </div>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full" style={{ background: 'var(--admin-primary-soft-bg)' }}>
            <div className="h-full rounded-full" style={{ width: `${progress}%`, background: queue.color }} />
          </div>
          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[8px] font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>
            <span className="flex items-center gap-1">
              <Truck className="h-3 w-3" />
              {operational.shipmentCount || 0} envío(s) · {progress}%
            </span>
            <span
              className="flex items-center gap-1"
              style={{ color: slaState === 'breached' ? '#be123c' : slaState === 'risk' ? '#b45309' : 'var(--admin-card-muted-text)' }}
            >
              <CalendarClock className="h-3 w-3" />
              {formatSla(operational)}
            </span>
          </div>
        </div>
      </td>

      <td className={`order-3 block min-w-0 border-b-0 text-right xl:table-cell xl:border-b xl:px-3 xl:text-left ${cellPadding}`} style={{ borderColor: ADMIN_BORDER }}>
        <span className={`inline-flex rounded-md px-2 py-1 text-[9px] font-black ${statusBadgeClasses(order.status)}`}>
          {STATUS_LABELS[String(order.status || '').toLowerCase()] || order.status || '—'}
        </span>
        {!compact ? (
          <p className="mt-1.5 truncate text-[8px] font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>
            {fmtDate(order.updatedAt || order.createdAt)}
          </p>
        ) : null}
      </td>

      <td className={`order-5 col-span-2 block border-b-0 xl:table-cell xl:border-b xl:px-2 ${cellPadding}`} style={{ borderColor: ADMIN_BORDER }}>
        <button
          type="button"
          onClick={() => openOrderDetail(order)}
          className="inline-flex h-9 w-full items-center justify-center whitespace-nowrap rounded-lg px-1.5 text-[10px] font-black transition hover:shadow-md"
          style={{ background: 'var(--admin-primary)', color: 'var(--admin-primary-text)' }}
        >
          Gestionar
          <ChevronRight className="hidden h-3.5 w-3.5 2xl:block" />
        </button>
      </td>
    </tr>
  );
}
