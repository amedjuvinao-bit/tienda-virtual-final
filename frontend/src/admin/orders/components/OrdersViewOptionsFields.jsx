import { FilterX } from 'lucide-react';

import { OrdersFilterField } from './OrdersFilterUi';

export default function OrdersViewOptionsFields({
  ADMIN_BORDER,
  hasActiveFilters,
  onClearFilters,
  populate,
  setPage,
  setPopulate,
}) {
  return (
    <>
      <OrdersFilterField className="orf-col-3" label="Datos" gridColumn="span 3">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            height: 40,
            borderRadius: 10,
            border: '1px solid var(--admin-input-border)',
            overflow: 'hidden',
            background: 'var(--admin-input-bg)',
          }}
        >
          {[
            { val: false, label: 'Simple' },
            { val: true, label: 'Full' },
          ].map((option) => (
            <button
              key={String(option.val)}
              type="button"
              onClick={() => {
                setPopulate(option.val);
                setPage(1);
              }}
              style={{
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 800,
                background: populate === option.val ? 'var(--admin-primary)' : 'transparent',
                color: populate === option.val
                  ? 'var(--admin-primary-text)'
                  : 'var(--admin-input-text)',
                letterSpacing: '0.02em',
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </OrdersFilterField>

      <OrdersFilterField className="orf-col-3 orf-sidebar-clear" label="Limpiar" gridColumn="span 3">
        <button
          type="button"
          disabled={!hasActiveFilters}
          onClick={onClearFilters}
          style={{
            width: '100%',
            height: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            border: `1px solid ${ADMIN_BORDER}`,
            borderRadius: 10,
            background: hasActiveFilters ? 'var(--admin-primary-soft-bg)' : 'var(--admin-input-bg)',
            color: hasActiveFilters ? 'var(--admin-primary-soft-text)' : 'var(--admin-card-muted-text)',
            cursor: hasActiveFilters ? 'pointer' : 'not-allowed',
            fontSize: 12,
            fontWeight: 850,
          }}
        >
          <FilterX size={15} strokeWidth={2.4} />
          Limpiar filtros
        </button>
      </OrdersFilterField>
    </>
  );
}
