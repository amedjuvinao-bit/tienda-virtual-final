// src/admin/orders/components/OrdersQuickViews.jsx

const QUICK_VIEWS = [
  {
    key: 'all',
    label: 'Todas',
    description: 'Ver todas las órdenes',
  },
  {
    key: 'today',
    label: 'Hoy',
    description: 'Órdenes creadas hoy',
  },
  {
    key: 'last7',
    label: 'Últimos 7 días',
    description: 'Órdenes recientes',
  },
  {
    key: 'paid',
    label: 'Pagadas',
    description: 'Órdenes pagadas',
  },
  {
    key: 'pending',
    label: 'Pendientes',
    description: 'Órdenes pendientes',
  },
  {
    key: 'notPrinted',
    label: 'No impresas',
    description: 'Órdenes sin marcar como impresas',
  },
  {
    key: 'archived',
    label: 'Archivadas',
    description: 'Órdenes archivadas',
  },
];

export default function OrdersQuickViews({
  quickView,
  setQuickView,
  onApplyQuickView,
}) {
  const THEME = {
    cardBg: 'var(--admin-card-bg)',
    cardText: 'var(--admin-card-text)',
    mutedText: 'var(--admin-card-muted-text)',
    primary: 'var(--admin-primary)',
    primaryText: 'var(--admin-primary-text)',
    primarySoftBg: 'var(--admin-primary-soft-bg)',
    primarySoftText: 'var(--admin-primary-soft-text)',
    primarySoftBorder: 'var(--admin-primary-soft-border)',
    cardBorder: 'var(--admin-card-border)',
    inputBg: 'var(--admin-input-bg)',
    inputText: 'var(--admin-input-text)',
    inputBorder: 'var(--admin-input-border)',
  };

  const currentQuickView = quickView || 'all';

  const activeView =
    QUICK_VIEWS.find((view) => view.key === currentQuickView) ||
    QUICK_VIEWS[0];

  const handleChange = (event) => {
    const viewKey = event.target.value;

    setQuickView(viewKey);

    if (typeof onApplyQuickView === 'function') {
      onApplyQuickView(viewKey);
    }
  };

  return (
    <div
      className="h-full rounded-[22px] border p-4 shadow-[0_14px_34px_rgba(15,23,42,0.05)]"
      style={{
        borderColor: THEME.cardBorder,
        background: THEME.cardBg,
        color: THEME.cardText,
      }}
    >
      <div className="grid h-full grid-cols-1 gap-4 lg:grid-cols-[1fr_260px] lg:items-center">
        <div className="min-w-0">
          <p
            className="text-[11px] font-black uppercase tracking-[0.18em]"
            style={{ color: THEME.primary }}
          >
            Vistas rápidas
          </p>

          <h3
            className="mt-2 text-lg font-black leading-tight"
            style={{ color: THEME.cardText }}
          >
            {activeView.label}
          </h3>

          <p
            className="mt-1 text-sm leading-5"
            style={{ color: THEME.mutedText }}
          >
            {activeView.description}
          </p>
        </div>

        <div>
          <label
            className="mb-2 block text-xs font-black"
            style={{ color: THEME.cardText }}
          >
            Seleccionar vista
          </label>

          <select
            value={currentQuickView}
            onChange={handleChange}
            className="h-12 w-full rounded-2xl border px-4 text-sm font-black outline-none transition focus:ring-4"
            style={{
              borderColor: THEME.inputBorder || THEME.cardBorder,
              background: THEME.inputBg || THEME.cardBg,
              color: THEME.inputText || THEME.cardText,
              '--tw-ring-color': 'var(--admin-primary-soft-bg)',
            }}
          >
            {QUICK_VIEWS.map((view) => (
              <option key={view.key} value={view.key}>
                {view.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}