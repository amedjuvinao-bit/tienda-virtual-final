export function OrdersFiltersStyles() {
  return (
    <style>{`
      .orf-input::placeholder { color: var(--admin-input-placeholder) !important; }
      .orf-select option { background: var(--admin-input-bg); color: var(--admin-input-text); }
      .orf-field {
        border-color: var(--admin-input-border) !important;
        background: var(--admin-input-bg) !important;
        color: var(--admin-input-text) !important;
        transition: border-color 0.18s, box-shadow 0.18s;
      }
      .orf-field:focus {
        outline: none;
        border-color: var(--admin-primary) !important;
        box-shadow: 0 0 0 3px var(--admin-primary-soft-bg);
      }
      .orf-card-metric {
        transition: transform 0.18s, box-shadow 0.18s;
      }
      .orf-card-metric:hover {
        transform: translateY(-3px);
        box-shadow: 0 18px 40px rgba(0,0,0,0.18) !important;
      }
      .orf-icon-wrap {
        transition: transform 0.18s;
      }
      .orf-card-metric:hover .orf-icon-wrap {
        transform: scale(1.1) rotate(-4deg);
      }
      @media (max-width: 1100px) {
        .orf-metrics { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
        .orf-filters { grid-template-columns: repeat(6, minmax(0, 1fr)) !important; }
        .orf-col-4, .orf-col-6, .orf-col-3, .orf-col-2 { grid-column: span 3 !important; }
      }
      @media (max-width: 720px) {
        .orf-metrics, .orf-filters { grid-template-columns: 1fr !important; }
        .orf-col-4, .orf-col-6, .orf-col-3, .orf-col-2 { grid-column: span 1 !important; }
      }
    `}</style>
  );
}

export function OrdersFilterField({ label, children, gridColumn, className = '' }) {
  return (
    <div
      className={className}
      style={{ display: 'flex', flexDirection: 'column', gap: 6, gridColumn }}
    >
      <label
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: 'var(--admin-card-text)',
          letterSpacing: '0.03em',
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

export function ordersFilterInputStyle(extra = {}) {
  return {
    width: '100%',
    height: 40,
    padding: '0 10px',
    border: '1px solid',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 600,
    boxSizing: 'border-box',
    ...extra,
  };
}

export function ordersFilterSelectStyle(extra = {}) {
  return {
    width: '100%',
    height: 40,
    padding: '0 10px',
    border: '1px solid',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 700,
    boxSizing: 'border-box',
    ...extra,
  };
}
