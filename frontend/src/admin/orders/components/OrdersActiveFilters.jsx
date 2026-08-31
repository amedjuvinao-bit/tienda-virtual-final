// src/admin/orders/components/OrdersActiveFilters.jsx

const QUICK_VIEW_LABELS = {
  all: 'Todas',
  today: 'Hoy',
  last7: 'Últimos 7 días',
  paid: 'Pagadas',
  pending: 'Pendientes',
  notPrinted: 'No impresas',
  archived: 'Archivadas',
  attention: 'Atención inmediata',
  awaiting_payment: 'Esperando pago',
  prepare: 'Por preparar',
  dispatch: 'Listas para despacho',
  transit: 'En tránsito',
  incidents: 'Con incidencias',
  sla_risk: 'SLA en riesgo',
  completed: 'Completadas',
};

function formatDateLabel(value) {
  if (!value) return '';

  const [year, month, day] = String(value).split('-');

  if (!year || !month || !day) return value;

  return `${day}/${month}/${year}`;
}

export default function OrdersActiveFilters({
  quickView,
  onApplyQuickView,

  typingQ,
  setTypingQ,

  dateFrom,
  setDateFrom,

  dateTo,
  setDateTo,

  statusFilter,
  setStatusFilter,
  clearStatus,
  STATUS_FILTERS,

  tagsStr,
  setTagsStr,

  setPage,
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
    dangerSoftBg: 'var(--admin-danger-soft-bg)',
    dangerText: 'var(--admin-danger-text)',
  };

  const safeStatusFilter = Array.isArray(statusFilter)
    ? statusFilter
    : [];

  const safeStatusFilters = Array.isArray(STATUS_FILTERS)
    ? STATUS_FILTERS
    : [];

  const statusLabelMap = safeStatusFilters.reduce((acc, item) => {
    acc[item.key] = item.label;
    return acc;
  }, {});

  const hasQuickView = quickView && quickView !== 'all';
  const hasTypingQ = Boolean(typingQ);
  const hasDateFrom = Boolean(dateFrom);
  const hasDateTo = Boolean(dateTo);
  const hasTags = Boolean(tagsStr);
  const hasStatuses = safeStatusFilter.length > 0;

  const hasActiveFilters =
    hasQuickView ||
    hasTypingQ ||
    hasDateFrom ||
    hasDateTo ||
    hasTags ||
    hasStatuses;

  const goFirstPage = () => {
    if (typeof setPage === 'function') {
      setPage(1);
    }
  };

  const removeQuickView = () => {
    if (typeof onApplyQuickView === 'function') {
      onApplyQuickView('all');
    }

    goFirstPage();
  };

  const removeTypingQ = () => {
    setTypingQ('');
    goFirstPage();
  };

  const removeDateFrom = () => {
    setDateFrom('');
    goFirstPage();
  };

  const removeDateTo = () => {
    setDateTo('');
    goFirstPage();
  };

  const removeTags = () => {
    setTagsStr('');
    goFirstPage();
  };

  const removeStatus = (statusKey) => {
    if (typeof setStatusFilter === 'function') {
      setStatusFilter((prev) =>
        Array.isArray(prev)
          ? prev.filter((item) => item !== statusKey)
          : []
      );
    }

    goFirstPage();
  };

  const clearAllFilters = () => {
    if (typeof onApplyQuickView === 'function') {
      onApplyQuickView('all');
    }

    setTypingQ('');
    setDateFrom('');
    setDateTo('');
    setTagsStr('');

    if (typeof clearStatus === 'function') {
      clearStatus();
    } else if (typeof setStatusFilter === 'function') {
      setStatusFilter([]);
    }

    goFirstPage();
  };

  if (!hasActiveFilters) {
    return null;
  }

  return (
    <div
      className="mb-4 rounded-2xl border px-4 py-3"
      style={{
        borderColor: THEME.primarySoftBorder,
        background: `linear-gradient(135deg, ${THEME.primarySoftBg}, ${THEME.cardBg})`,
        color: THEME.cardText,
      }}
    >
      <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p
            className="text-[10px] font-black uppercase tracking-[0.22em]"
            style={{ color: THEME.primary }}
          >
            Filtros activos
          </p>

          <p
            className="text-xs"
            style={{ color: THEME.mutedText }}
          >
            Quita filtros individuales sin perder el resto de la búsqueda.
          </p>
        </div>

        <button
          type="button"
          onClick={clearAllFilters}
          className="inline-flex h-9 items-center justify-center rounded-xl border px-3 text-xs font-black transition hover:scale-[1.02]"
          style={{
            borderColor: THEME.primarySoftBorder,
            background: THEME.cardBg,
            color: THEME.primary,
          }}
        >
          Limpiar filtros
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {hasQuickView && (
          <FilterChip
            label={`Vista: ${QUICK_VIEW_LABELS[quickView] || quickView}`}
            onRemove={removeQuickView}
            THEME={THEME}
          />
        )}

        {hasTypingQ && (
          <FilterChip
            label={`Búsqueda: ${typingQ}`}
            onRemove={removeTypingQ}
            THEME={THEME}
          />
        )}

        {hasDateFrom && (
          <FilterChip
            label={`Desde: ${formatDateLabel(dateFrom)}`}
            onRemove={removeDateFrom}
            THEME={THEME}
          />
        )}

        {hasDateTo && (
          <FilterChip
            label={`Hasta: ${formatDateLabel(dateTo)}`}
            onRemove={removeDateTo}
            THEME={THEME}
          />
        )}

        {hasStatuses &&
          safeStatusFilter.map((statusKey) => (
            <FilterChip
              key={statusKey}
              label={`Estado: ${statusLabelMap[statusKey] || statusKey}`}
              onRemove={() => removeStatus(statusKey)}
              THEME={THEME}
            />
          ))}

        {hasTags && (
          <FilterChip
            label={`Tags: ${tagsStr}`}
            onRemove={removeTags}
            THEME={THEME}
          />
        )}
      </div>
    </div>
  );
}

function FilterChip({ label, onRemove, THEME }) {
  return (
    <span
      className="inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-bold"
      style={{
        borderColor: THEME.primarySoftBorder,
        background: THEME.cardBg,
        color: THEME.cardText,
        boxShadow:
          '0 10px 24px color-mix(in srgb, var(--admin-primary) 10%, transparent)',
      }}
    >
      <span
        className="h-2 w-2 rounded-full"
        style={{ background: THEME.primary }}
      />

      <span className="max-w-[220px] truncate">{label}</span>

      <button
        type="button"
        onClick={onRemove}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-black transition hover:scale-110"
        style={{
          background: THEME.primarySoftBg,
          color: THEME.primarySoftText,
        }}
        title="Quitar filtro"
      >
        ×
      </button>
    </span>
  );
}
