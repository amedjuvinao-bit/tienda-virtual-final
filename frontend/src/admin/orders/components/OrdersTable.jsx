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
  const allocations = Array.isArray(order?.inventoryAllocations)
    ? order.inventoryAllocations
    : [];
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
  return (
    order?.branchSnapshot?.code ||
    order?.branchSnapshot?.name ||
    order?.branch?.code ||
    order?.branch?.name ||
    'Sin sede'
  );
}

function channelLabel(order) {
  const source = String(order?.source || '').toLowerCase();
  const channel = String(order?.channel || '').toLowerCase();
  const provider = String(order?.payment?.provider || '').toLowerCase();
  if (
    source === 'pos' ||
    channel === 'physical_store' ||
    provider === 'pos' ||
    order?.pos?.receiptNumber
  ) return 'POS';
  if (source === 'manual') return 'Manual';
  if (source === 'admin') return 'Admin';
  if (source === 'import') return 'Importada';
  return 'Web';
}

function formatSla(operational) {
  const state = operational?.sla?.state || 'none';
  const remainingMs = Number(operational?.sla?.remainingMs);
  if (state === 'breached') {
    const hours = Number.isFinite(remainingMs)
      ? Math.max(1, Math.ceil(Math.abs(remainingMs) / 3600000))
      : null;
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
      className="overflow-hidden rounded-[26px] border shadow-[0_20px_56px_rgba(15,23,42,0.08)]"
      style={{
        borderColor: ADMIN_BORDER,
        background: 'var(--admin-card-bg)',
        color: 'var(--admin-card-text)',
      }}
    >
      <header
        className="flex flex-col gap-4 border-b px-5 py-5 xl:flex-row xl:items-end xl:justify-between"
        style={{
          borderColor: ADMIN_BORDER,
          background:
            'linear-gradient(105deg, var(--admin-card-bg), var(--admin-primary-soft-bg), var(--admin-card-bg))',
        }}
      >
        <div>
          <p
            className="text-[10px] font-black uppercase tracking-[0.24em]"
            style={{ color: 'var(--admin-primary)' }}
          >
            Bandeja operacional
          </p>
          <h2 className="mt-1 text-xl font-black">Órdenes con prioridad accionable</h2>
          <p className="mt-1 text-xs" style={{ color: 'var(--admin-card-muted-text)' }}>
            Cliente, valor, sede, cumplimiento y siguiente acción en una sola lectura.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {selectionEnabled ? (
            <label
              className="flex h-10 items-center gap-2 rounded-xl border px-3 text-xs font-black"
              style={{ borderColor: ADMIN_BORDER, background: 'var(--admin-card-bg)' }}
            >
              <input
                aria-label="Seleccionar órdenes visibles"
                type="checkbox"
                className="accent-pink-600"
                checked={data.length > 0 && data.every((order) => selectedIds.has(order._id))}
                onChange={toggleSelectAllVisible}
              />
              Seleccionar
            </label>
          ) : null}

          {[
            ['createdAt', 'Fecha'],
            ['orderNumber', 'Orden'],
            ['total', 'Total'],
          ].map(([field, label]) => (
            <button
              key={field}
              type="button"
              onClick={() => toggleSort(field)}
              aria-sort={sortAria(field)}
              className="h-10 rounded-xl border px-3 text-[11px] font-black transition hover:-translate-y-0.5"
              style={{
                borderColor: ADMIN_BORDER,
                background: 'var(--admin-card-bg)',
                color: 'var(--admin-card-text)',
              }}
            >
              {label} {sortIcon(field)}
            </button>
          ))}

          <div
            aria-label="Densidad del listado"
            className="flex h-10 overflow-hidden rounded-xl border"
            style={{ borderColor: ADMIN_BORDER }}
          >
            <button
              type="button"
              aria-label="Vista cómoda"
              aria-pressed={!compact}
              onClick={() => setDensity('comfortable')}
              className="flex w-10 items-center justify-center"
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
              className="flex w-10 items-center justify-center"
              style={{
                background: compact ? 'var(--admin-primary)' : 'var(--admin-card-bg)',
                color: compact ? 'var(--admin-primary-text)' : 'var(--admin-card-muted-text)',
              }}
            >
              <Rows3 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <div
        className="hidden grid-cols-[minmax(230px,1.45fr)_minmax(175px,.85fr)_minmax(250px,1.25fr)_minmax(145px,.72fr)_112px] gap-4 border-b px-5 py-3 text-[9px] font-black uppercase tracking-[0.16em] xl:grid"
        style={{
          borderColor: ADMIN_BORDER,
          background: 'var(--admin-input-bg)',
          color: 'var(--admin-card-muted-text)',
        }}
      >
        <span>Orden y cliente</span>
        <span>Venta</span>
        <span>Operación</span>
        <span>Estado</span>
        <span className="text-right">Acción</span>
      </div>

      <div className="divide-y" style={{ borderColor: ADMIN_BORDER }}>
        {loading
          ? Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className={`animate-pulse px-5 ${compact ? 'py-3' : 'py-5'}`}
              >
                <div className="h-16 rounded-xl" style={{ background: 'var(--admin-primary-soft-bg)' }} />
              </div>
            ))
          : null}

        {!loading && data.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <ShoppingBag
              className="mx-auto h-8 w-8"
              style={{ color: 'var(--admin-card-muted-text)' }}
            />
            <p className="mt-3 text-sm font-black">No hay órdenes para esta cola</p>
            <p className="mt-1 text-xs" style={{ color: 'var(--admin-card-muted-text)' }}>
              Cambia la vista operativa o restablece los filtros.
            </p>
          </div>
        ) : null}

        {!loading
          ? data.map((order) => {
              const customer = order.customer || {};
              const operational = order.operational || {};
              const queue = QUEUE_STYLES[operational.queue] || QUEUE_STYLES.monitor;
              const progress = Math.min(100, Math.max(0, Number(operational.progress || 0)));
              const tags = Array.isArray(order.tags) ? order.tags : [];
              const slaState = operational?.sla?.state || 'none';

              return (
                <article
                  key={order._id}
                  className={`group relative grid grid-cols-1 gap-4 px-5 transition hover:bg-[var(--admin-primary-soft-bg)] xl:grid-cols-[minmax(230px,1.45fr)_minmax(175px,.85fr)_minmax(250px,1.25fr)_minmax(145px,.72fr)_112px] xl:items-center ${compact ? 'py-3' : 'py-5'}`}
                >
                  <span
                    className="absolute bottom-0 left-0 top-0 w-1"
                    style={{ background: queue.color }}
                  />

                  <div className="flex min-w-0 items-start gap-3">
                    {selectionEnabled ? (
                      <input
                        aria-label={`Seleccionar orden ${order.orderNumber || order._id}`}
                        type="checkbox"
                        className="mt-1 accent-pink-600"
                        checked={isSelected(order._id)}
                        onChange={() => toggleOne(order._id)}
                      />
                    ) : null}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <strong
                          className="font-mono text-sm"
                          style={{ color: 'var(--admin-primary)' }}
                        >
                          #{order.orderNumber || '—'}
                        </strong>
                        <span
                          className="rounded-md px-2 py-0.5 text-[9px] font-black uppercase tracking-wide"
                          style={{ background: queue.bg, color: queue.color }}
                        >
                          {queue.label}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-sm font-black">{customerName(order)}</p>
                      <p
                        className="mt-0.5 truncate text-[10px]"
                        style={{ color: 'var(--admin-card-muted-text)' }}
                      >
                        {customer.emailOrPhone || customer.email || customer.phone || 'Sin contacto'} · {fmtDate(order.createdAt)}
                      </p>
                      {!compact && tags.length ? (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="rounded-md border px-1.5 py-0.5 text-[9px] font-bold"
                              style={{ borderColor: ADMIN_BORDER }}
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div>
                    <p className="text-base font-black tabular-nums">{toCOP(order.total || 0)}</p>
                    <div
                      className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px]"
                      style={{ color: 'var(--admin-card-muted-text)' }}
                    >
                      <span>{order.totalItems || 0} unidades</span>
                      <span>{channelLabel(order)}</span>
                    </div>
                    <p className="mt-1 flex items-center gap-1 text-[10px] font-bold">
                      <Building2 className="h-3 w-3" />
                      {branchInfo(order)}
                    </p>
                  </div>

                  <div
                    className="rounded-xl border px-3 py-3"
                    style={{
                      borderColor:
                        slaState === 'breached'
                          ? '#fecdd3'
                          : slaState === 'risk'
                            ? '#fde68a'
                            : ADMIN_BORDER,
                      background: queue.bg,
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-[11px] font-black">
                        {operational.nextAction || 'Revisar orden'}
                      </p>
                      {operational.openIncidentCount ? (
                        <span className="flex items-center gap-1 text-[9px] font-black text-rose-700">
                          <AlertTriangle className="h-3 w-3" />
                          {operational.openIncidentCount}
                        </span>
                      ) : null}
                    </div>
                    <div
                      className="mt-2 h-1.5 overflow-hidden rounded-sm"
                      style={{ background: 'color-mix(in srgb, var(--admin-card-border) 75%, transparent)' }}
                    >
                      <div
                        className="h-full rounded-sm transition-all"
                        style={{ width: `${progress}%`, background: queue.color }}
                      />
                    </div>
                    <div
                      className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[9px] font-bold"
                      style={{ color: 'var(--admin-card-muted-text)' }}
                    >
                      <span className="flex items-center gap-1">
                        <Truck className="h-3 w-3" />
                        {operational.shipmentCount || 0} envío(s) · {progress}%
                      </span>
                      <span
                        className="flex items-center gap-1"
                        style={{
                          color:
                            slaState === 'breached'
                              ? '#be123c'
                              : slaState === 'risk'
                                ? '#b45309'
                                : 'var(--admin-card-muted-text)',
                        }}
                      >
                        <CalendarClock className="h-3 w-3" />
                        {formatSla(operational)}
                      </span>
                    </div>
                  </div>

                  <div>
                    <span
                      className={`inline-flex rounded-md px-2.5 py-1 text-[10px] font-black ${statusBadgeClasses(order.status)}`}
                    >
                      {STATUS_LABELS[String(order.status || '').toLowerCase()] || order.status || '—'}
                    </span>
                    {!compact ? (
                      <p
                        className="mt-2 text-[9px] font-bold"
                        style={{ color: 'var(--admin-card-muted-text)' }}
                      >
                        Actualizada {fmtDate(order.updatedAt || order.createdAt)}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex xl:justify-end">
                    <button
                      type="button"
                      onClick={() => openOrderDetail(order)}
                      className="inline-flex h-10 items-center justify-center gap-1 rounded-xl px-4 text-xs font-black transition hover:-translate-y-0.5 hover:shadow-lg"
                      style={{
                        background: 'var(--admin-primary)',
                        color: 'var(--admin-primary-text)',
                      }}
                    >
                      Gestionar
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </article>
              );
            })
          : null}
      </div>
    </section>
  );
}
