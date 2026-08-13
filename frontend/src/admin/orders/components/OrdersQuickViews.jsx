import {
  AlertTriangle,
  BadgeCheck,
  Boxes,
  CircleDollarSign,
  Clock3,
  PackageCheck,
  ScanLine,
  Truck,
} from 'lucide-react';

const OPERATIONAL_VIEWS = [
  { key: 'attention', label: 'Atención', countKey: 'attention', Icon: AlertTriangle, tone: 'critical' },
  { key: 'awaiting_payment', label: 'Por pagar', countKey: 'awaitingPayment', Icon: CircleDollarSign, tone: 'neutral' },
  { key: 'prepare', label: 'Preparar', countKey: 'prepare', Icon: Boxes, tone: 'active' },
  { key: 'dispatch', label: 'Despachar', countKey: 'dispatch', Icon: PackageCheck, tone: 'active' },
  { key: 'transit', label: 'En tránsito', countKey: 'transit', Icon: Truck, tone: 'neutral' },
  { key: 'incidents', label: 'Incidencias', countKey: 'incidents', Icon: ScanLine, tone: 'critical' },
  { key: 'sla_risk', label: 'Riesgo SLA', countKey: 'slaRisk', Icon: Clock3, tone: 'warning' },
  { key: 'completed', label: 'Completadas', countKey: 'completed', Icon: BadgeCheck, tone: 'success' },
];

const TONES = {
  critical: { accent: '#be123c', soft: 'color-mix(in srgb, #fb7185 11%, var(--admin-card-bg))' },
  warning: { accent: '#b45309', soft: 'color-mix(in srgb, #fbbf24 12%, var(--admin-card-bg))' },
  active: { accent: 'var(--admin-primary)', soft: 'var(--admin-primary-soft-bg)' },
  neutral: { accent: '#0369a1', soft: 'color-mix(in srgb, #38bdf8 9%, var(--admin-card-bg))' },
  success: { accent: '#047857', soft: 'color-mix(in srgb, #34d399 9%, var(--admin-card-bg))' },
};

export default function OrdersQuickViews({ quickView, onApplyQuickView, operationalSummary }) {
  const current = quickView || 'all';
  const summary = operationalSummary || {};
  const apply = (key) => {
    if (typeof onApplyQuickView === 'function') onApplyQuickView(key);
  };
  const currentView = OPERATIONAL_VIEWS.find((view) => view.key === current);
  const currentLabel = current === 'all' ? 'Todas las órdenes' : currentView?.label || 'Todas las órdenes';
  const currentCount = current === 'all'
    ? Number(summary.total || 0)
    : Number(summary[currentView?.countKey] || 0);

  return (
    <section
      aria-label="Centro de operaciones de órdenes"
      className="mb-4 rounded-2xl border px-3 py-3 shadow-sm"
      style={{
        borderColor: 'var(--admin-card-border)',
        background: 'var(--admin-card-bg)',
        color: 'var(--admin-card-text)',
      }}
    >
      <div className="mb-2 flex items-center justify-between gap-3 px-1">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: 'var(--admin-primary)' }}>
              Flujo operativo
            </span>
            <span className="hidden text-[10px] sm:inline" style={{ color: 'var(--admin-card-muted-text)' }}>
              · selecciona una cola para filtrar
            </span>
          </div>
          <p className="mt-0.5 truncate text-xs font-bold md:hidden">
            {currentLabel} · {currentCount}
          </p>
        </div>
        {current !== 'all' ? (
          <button
            type="button"
            onClick={() => apply('all')}
            className="shrink-0 text-[10px] font-black underline-offset-4 hover:underline"
            style={{ color: 'var(--admin-primary)' }}
          >
            Ver todas
          </button>
        ) : null}
      </div>

      <label className="block md:hidden">
        <span className="sr-only">Cola operativa</span>
        <select
          aria-label="Cola operativa"
          value={current}
          onChange={(event) => apply(event.target.value)}
          className="h-11 w-full rounded-xl border px-3 text-xs font-bold"
          style={{
            borderColor: 'var(--admin-input-border)',
            background: 'var(--admin-input-bg)',
            color: 'var(--admin-input-text)',
          }}
        >
          <option value="all">Todas las órdenes ({Number(summary.total || 0)})</option>
          {OPERATIONAL_VIEWS.map((view) => (
            <option key={view.key} value={view.key}>
              {view.label} ({Number(summary[view.countKey] || 0)})
            </option>
          ))}
        </select>
      </label>

      <div className="hidden grid-cols-3 gap-1.5 md:grid lg:grid-cols-5 xl:grid-cols-9">
        <QueueButton
          active={current === 'all'}
          count={Number(summary.total || 0)}
          label="Todas"
          onClick={() => apply('all')}
        />
        {OPERATIONAL_VIEWS.map((view) => (
          <QueueButton
            key={view.key}
            active={current === view.key}
            count={Number(summary[view.countKey] || 0)}
            Icon={view.Icon}
            label={view.label}
            onClick={() => apply(view.key)}
            tone={TONES[view.tone]}
          />
        ))}
      </div>
    </section>
  );
}

function QueueButton({ active, count, Icon, label, onClick, tone }) {
  const resolvedTone = tone || {
    accent: 'var(--admin-primary)',
    soft: 'var(--admin-primary-soft-bg)',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label} · ${count}`}
      aria-pressed={active}
      className="flex h-11 min-w-0 items-center justify-between gap-1.5 rounded-xl border px-2.5 text-left transition hover:border-[var(--admin-primary)]"
      style={{
        borderColor: active ? resolvedTone.accent : 'var(--admin-card-border)',
        background: active ? resolvedTone.soft : 'var(--admin-input-bg)',
        color: active ? resolvedTone.accent : 'var(--admin-card-text)',
        boxShadow: active ? `inset 0 -2px 0 ${resolvedTone.accent}` : 'none',
      }}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        {Icon ? <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" /> : null}
        <span className="truncate text-[10px] font-black">{label}</span>
      </span>
      <strong className="shrink-0 text-xs font-black tabular-nums">{count}</strong>
    </button>
  );
}
