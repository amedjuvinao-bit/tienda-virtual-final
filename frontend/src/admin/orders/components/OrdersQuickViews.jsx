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
  {
    key: 'attention',
    label: 'Atención inmediata',
    description: 'Fallos, incidencias o SLA comprometido',
    countKey: 'attention',
    Icon: AlertTriangle,
    tone: 'critical',
  },
  {
    key: 'awaiting_payment',
    label: 'Esperando pago',
    description: 'Confirmación financiera pendiente',
    countKey: 'awaitingPayment',
    Icon: CircleDollarSign,
    tone: 'neutral',
  },
  {
    key: 'prepare',
    label: 'Por preparar',
    description: 'Picking y empaque por completar',
    countKey: 'prepare',
    Icon: Boxes,
    tone: 'active',
  },
  {
    key: 'dispatch',
    label: 'Listas para despacho',
    description: 'Paquetes empacados con salida pendiente',
    countKey: 'dispatch',
    Icon: PackageCheck,
    tone: 'active',
  },
  {
    key: 'transit',
    label: 'En tránsito',
    description: 'Seguimiento hasta la entrega',
    countKey: 'transit',
    Icon: Truck,
    tone: 'neutral',
  },
  {
    key: 'incidents',
    label: 'Con incidencias',
    description: 'Excepciones abiertas por resolver',
    countKey: 'incidents',
    Icon: ScanLine,
    tone: 'critical',
  },
  {
    key: 'sla_risk',
    label: 'SLA en riesgo',
    description: 'Vencidas o con menos de 24 horas',
    countKey: 'slaRisk',
    Icon: Clock3,
    tone: 'warning',
  },
  {
    key: 'completed',
    label: 'Completadas',
    description: 'Entregas cerradas correctamente',
    countKey: 'completed',
    Icon: BadgeCheck,
    tone: 'success',
  },
];

const TONES = {
  critical: {
    accent: '#e11d48',
    background: 'color-mix(in srgb, #fb7185 11%, var(--admin-card-bg))',
  },
  warning: {
    accent: '#b45309',
    background: 'color-mix(in srgb, #fbbf24 13%, var(--admin-card-bg))',
  },
  active: {
    accent: 'var(--admin-primary)',
    background: 'var(--admin-primary-soft-bg)',
  },
  neutral: {
    accent: '#0369a1',
    background: 'color-mix(in srgb, #38bdf8 10%, var(--admin-card-bg))',
  },
  success: {
    accent: '#047857',
    background: 'color-mix(in srgb, #34d399 10%, var(--admin-card-bg))',
  },
};

export default function OrdersQuickViews({
  quickView,
  onApplyQuickView,
  operationalSummary,
}) {
  const current = quickView || 'all';
  const summary = operationalSummary || {};
  const apply = (key) => {
    if (typeof onApplyQuickView === 'function') onApplyQuickView(key);
  };

  return (
    <section
      aria-label="Centro de operaciones de órdenes"
      className="mb-5 overflow-hidden rounded-[26px] border shadow-[0_18px_48px_rgba(15,23,42,0.07)]"
      style={{
        borderColor: 'var(--admin-card-border)',
        background: 'var(--admin-card-bg)',
        color: 'var(--admin-card-text)',
      }}
    >
      <div
        className="flex flex-col gap-4 border-b px-5 py-5 lg:flex-row lg:items-end lg:justify-between"
        style={{
          borderColor: 'var(--admin-card-border)',
          background:
            'linear-gradient(120deg, var(--admin-card-bg), var(--admin-primary-soft-bg), var(--admin-card-bg))',
        }}
      >
        <div>
          <p
            className="text-[10px] font-black uppercase tracking-[0.24em]"
            style={{ color: 'var(--admin-primary)' }}
          >
            Centro de operaciones
          </p>
          <h2 className="mt-1 text-xl font-black">Colas comerciales y logísticas</h2>
          <p
            className="mt-1 text-xs"
            style={{ color: 'var(--admin-card-muted-text)' }}
          >
            Prioriza lo que exige acción; cada contador respeta la sede y los filtros activos.
          </p>
        </div>

        <button
          type="button"
          onClick={() => apply('all')}
          aria-pressed={current === 'all'}
          className="h-10 rounded-xl border px-4 text-xs font-black transition hover:-translate-y-0.5"
          style={{
            borderColor:
              current === 'all'
                ? 'var(--admin-primary)'
                : 'var(--admin-card-border)',
            background:
              current === 'all'
                ? 'var(--admin-primary)'
                : 'var(--admin-card-bg)',
            color:
              current === 'all'
                ? 'var(--admin-primary-text)'
                : 'var(--admin-card-text)',
          }}
        >
          Ver operación completa · {Number(summary.total || 0)}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-px bg-[var(--admin-card-border)] sm:grid-cols-2 xl:grid-cols-4">
        {OPERATIONAL_VIEWS.map((view) => {
          const active = current === view.key;
          const tone = TONES[view.tone] || TONES.neutral;
          const count = Number(summary[view.countKey] || 0);
          const Icon = view.Icon;

          return (
            <button
              key={view.key}
              type="button"
              onClick={() => apply(view.key)}
              aria-pressed={active}
              className="group min-h-[112px] px-4 py-4 text-left transition hover:relative hover:z-[1] hover:-translate-y-0.5 hover:shadow-lg"
              style={{
                background: active ? tone.background : 'var(--admin-card-bg)',
                boxShadow: active ? `inset 0 -4px 0 ${tone.accent}` : 'none',
              }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Icon
                      aria-hidden="true"
                      className="h-4 w-4 shrink-0"
                      style={{ color: tone.accent }}
                    />
                    <span className="text-[12px] font-black">{view.label}</span>
                  </div>
                  <p
                    className="mt-2 text-[10px] leading-4"
                    style={{ color: 'var(--admin-card-muted-text)' }}
                  >
                    {view.description}
                  </p>
                </div>
                <strong
                  className="text-2xl font-black tabular-nums"
                  style={{ color: tone.accent }}
                >
                  {count}
                </strong>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
