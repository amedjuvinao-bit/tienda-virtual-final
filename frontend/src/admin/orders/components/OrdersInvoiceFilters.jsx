// frontend/src/admin/orders/components/OrdersInvoiceFilters.jsx

import { FileCheck2, RotateCcw } from 'lucide-react';

const INVOICE_FILTERS = [
  {
    key: 'all',
    label: 'Todas',
    description: 'No filtrar por factura electrónica',
  },
  {
    key: 'without_invoice',
    label: 'Sin factura',
    description: 'Órdenes que todavía no tienen factura electrónica',
  },
  {
    key: 'pending',
    label: 'Pendiente',
    description: 'Facturas pendientes o en proceso',
  },
  {
    key: 'validated',
    label: 'Validada',
    description: 'Facturas validadas correctamente',
  },
  {
    key: 'rejected',
    label: 'Rechazada',
    description: 'Facturas rechazadas por el proveedor o DIAN',
  },
  {
    key: 'error',
    label: 'Error DIAN',
    description: 'Facturas con errores de validación DIAN',
  },
  {
    key: 'credit_note',
    label: 'Nota crédito',
    description: 'Órdenes con nota crédito asociada',
  },
];

export default function OrdersInvoiceFilters({
  invoiceFilter,
  setInvoiceFilter,
  onApplyInvoiceFilter,
  compact = false,
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
  };

  const currentFilter = invoiceFilter || 'all';

  const activeFilter =
    INVOICE_FILTERS.find((item) => item.key === currentFilter) ||
    INVOICE_FILTERS[0];

  const hasActiveInvoiceFilter = currentFilter !== 'all';

  const handleClick = (filterKey) => {
    if (typeof setInvoiceFilter === 'function') {
      setInvoiceFilter(filterKey);
    }

    if (typeof onApplyInvoiceFilter === 'function') {
      onApplyInvoiceFilter(filterKey);
    }
  };

  const clearInvoiceFilter = () => {
    handleClick('all');
  };

  return (
    <div
      className={`relative overflow-hidden border shadow-[0_18px_48px_rgba(15,23,42,0.06)] ${
        compact ? 'rounded-2xl p-3' : 'rounded-[28px] p-4'
      }`}
      style={{
        borderColor: THEME.cardBorder,
        background: compact
          ? THEME.cardBg
          : 'linear-gradient(135deg, rgba(255,255,255,0.46), rgba(255,255,255,0.16))',
        color: THEME.cardText,
        backdropFilter: compact ? 'none' : 'blur(22px)',
        WebkitBackdropFilter: compact ? 'none' : 'blur(22px)',
      }}
    >
      <style>{`
        .invoice-crystal-panel {
          position: relative;
          isolation: isolate;
        }

        .invoice-crystal-panel::before {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background:
            radial-gradient(circle at 9% 0%, rgba(255,255,255,0.92), transparent 28%),
            radial-gradient(circle at 88% 130%, color-mix(in srgb, var(--admin-primary) 28%, transparent), transparent 38%),
            linear-gradient(135deg, rgba(255,255,255,0.34), rgba(255,255,255,0.06));
          pointer-events: none;
          z-index: 0;
        }

        .invoice-crystal-panel::after {
          content: "";
          position: absolute;
          left: 18px;
          right: 18px;
          top: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.98), transparent);
          pointer-events: none;
          z-index: 1;
        }

        .invoice-crystal-btn {
          position: relative;
          isolation: isolate;
          overflow: hidden;
        }

        .invoice-crystal-btn::before {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background:
            radial-gradient(circle at 20% 0%, rgba(255,255,255,0.92), transparent 34%),
            linear-gradient(145deg, rgba(255,255,255,0.34), rgba(255,255,255,0.08) 52%, rgba(255,255,255,0.04));
          z-index: 0;
          pointer-events: none;
        }

        .invoice-crystal-btn::after {
          content: "";
          position: absolute;
          left: 12px;
          right: 12px;
          top: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.96), transparent);
          z-index: 1;
          pointer-events: none;
        }

        .invoice-crystal-shine {
          position: absolute;
          inset: 0;
          z-index: 1;
          border-radius: inherit;
          background: linear-gradient(115deg, transparent 0%, rgba(255,255,255,0.58) 42%, transparent 68%);
          transform: translateX(-120%);
          transition: transform 700ms ease;
          pointer-events: none;
        }

        .invoice-crystal-btn:hover .invoice-crystal-shine {
          transform: translateX(120%);
        }
      `}</style>

      <div className="relative z-10 mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={`flex shrink-0 items-center justify-center border ${
              compact ? 'h-8 w-8 rounded-lg' : 'h-11 w-11 rounded-[18px]'
            }`}
            style={{
              borderColor: compact ? THEME.primarySoftBorder : 'rgba(255,255,255,0.76)',
              background: compact
                ? THEME.primarySoftBg
                : 'linear-gradient(145deg, rgba(255,255,255,0.86), rgba(255,255,255,0.26))',
              color: THEME.primary,
              boxShadow: compact
                ? 'none'
                : 'inset 0 1px 0 rgba(255,255,255,0.95), inset 0 -1px 0 rgba(255,255,255,0.24), 0 12px 26px color-mix(in srgb, var(--admin-primary) 16%, transparent)',
              backdropFilter: compact ? 'none' : 'blur(18px)',
              WebkitBackdropFilter: compact ? 'none' : 'blur(18px)',
            }}
          >
            <FileCheck2 size={18} strokeWidth={2.4} />
          </div>

          <div className="min-w-0">
            <p
              className="text-[11px] font-black uppercase tracking-[0.2em]"
              style={{ color: THEME.primary }}
            >
              Facturación electrónica
            </p>

            <p
              className="mt-1 text-xs leading-5"
              style={{ color: THEME.mutedText }}
            >
              Estado DIAN activo:{' '}
              <span
                className="font-black"
                style={{
                  color: hasActiveInvoiceFilter
                    ? THEME.primary
                    : THEME.cardText,
                }}
              >
                {activeFilter.label}
              </span>
            </p>
          </div>
        </div>

        {hasActiveInvoiceFilter && (
          <button
            type="button"
            onClick={clearInvoiceFilter}
            className="invoice-crystal-btn inline-flex w-fit items-center gap-2 rounded-2xl border px-3.5 py-2 text-[11px] font-black transition duration-300 hover:-translate-y-0.5"
            style={{
              borderColor: 'rgba(255,255,255,0.78)',
              background:
                'linear-gradient(145deg, rgba(255,255,255,0.42), rgba(255,255,255,0.12))',
              color: THEME.primarySoftText,
              boxShadow:
                'inset 0 1px 0 rgba(255,255,255,0.95), inset 0 -1px 0 rgba(255,255,255,0.22), 0 10px 24px rgba(15,23,42,0.08)',
              backdropFilter: 'blur(18px)',
              WebkitBackdropFilter: 'blur(18px)',
            }}
          >
            <span className="invoice-crystal-shine" />
            <RotateCcw size={13} strokeWidth={2.3} className="relative z-10" />
            <span className="relative z-10">Limpiar DIAN</span>
          </button>
        )}
      </div>

      <div
        className={`invoice-crystal-panel relative z-10 border p-2.5 ${
          compact ? 'rounded-xl' : 'rounded-[26px]'
        }`}
        style={{
          borderColor: compact ? THEME.cardBorder : 'rgba(255,255,255,0.64)',
          background: compact
            ? 'var(--admin-input-bg)'
            : 'linear-gradient(135deg, rgba(255,255,255,0.20), rgba(255,255,255,0.06))',
          boxShadow: compact
            ? 'none'
            : 'inset 0 1px 0 rgba(255,255,255,0.95), inset 0 -1px 0 rgba(255,255,255,0.20), 0 16px 34px rgba(15,23,42,0.045)',
          backdropFilter: compact ? 'none' : 'blur(24px)',
          WebkitBackdropFilter: compact ? 'none' : 'blur(24px)',
        }}
      >
        <div
          className="relative z-10 grid gap-2"
          style={{
            gridTemplateColumns: compact
              ? 'repeat(2, minmax(0, 1fr))'
              : `repeat(${INVOICE_FILTERS.length}, minmax(0, 1fr))`,
          }}
        >
          {INVOICE_FILTERS.map((item, index) => {
            const active = currentFilter === item.key;
            const spansCompactRow = compact && index === INVOICE_FILTERS.length - 1;

            return (
              <button
                key={item.key}
                type="button"
                onClick={() => handleClick(item.key)}
                title={item.label}
                className={`invoice-crystal-btn group min-h-[48px] rounded-xl border px-2.5 py-2.5 text-center text-[11px] font-black transition duration-300 hover:-translate-y-[2px] active:scale-[0.985] ${
                  spansCompactRow ? 'col-span-2' : ''
                }`}
                style={{
                  borderColor: compact
                    ? active
                      ? THEME.primary
                      : THEME.cardBorder
                    : active
                    ? 'rgba(255,255,255,0.92)'
                    : 'color-mix(in srgb, var(--admin-primary) 38%, rgba(255,255,255,0.72))',
                  background: compact
                    ? active
                      ? THEME.primarySoftBg
                      : THEME.cardBg
                    : active
                    ? `linear-gradient(145deg,
                        color-mix(in srgb, var(--admin-primary) 86%, #ffffff 14%),
                        color-mix(in srgb, var(--admin-primary) 96%, #ffffff 4%)
                      )`
                    : `linear-gradient(145deg,
                        color-mix(in srgb, var(--admin-primary-soft-bg) 68%, rgba(255,255,255,0.20)),
                        rgba(255,255,255,0.10)
                      )`,
                  color: compact
                    ? active
                      ? THEME.primarySoftText
                      : THEME.cardText
                    : active
                      ? THEME.primaryText
                      : THEME.cardText,
                  boxShadow: compact
                    ? active
                      ? `inset 0 -2px 0 ${THEME.primary}`
                      : 'none'
                    : active
                    ? 'inset 0 1px 0 rgba(255,255,255,0.46), inset 0 -1px 0 rgba(0,0,0,0.08), 0 14px 30px color-mix(in srgb, var(--admin-primary) 34%, transparent), 0 0 18px color-mix(in srgb, var(--admin-primary) 22%, transparent)'
                    : 'inset 0 1px 0 rgba(255,255,255,0.88), inset 0 -1px 0 color-mix(in srgb, var(--admin-primary) 22%, transparent), 0 10px 22px color-mix(in srgb, var(--admin-primary) 10%, transparent)',
                  backdropFilter: compact ? 'none' : 'blur(20px)',
                  WebkitBackdropFilter: compact ? 'none' : 'blur(20px)',
                }}
              >
                {!compact ? <span className="invoice-crystal-shine" /> : null}

                <span className="relative z-10 block truncate">
                  {item.label}
                </span>

                <span
                  className="absolute bottom-2 left-1/2 h-[3px] -translate-x-1/2 rounded-full transition-all duration-300"
                  style={{
                    width: active ? '34px' : '18px',
                    background: active
                      ? 'rgba(255,255,255,0.95)'
                      : 'color-mix(in srgb, var(--admin-primary) 34%, transparent)',
                    boxShadow: active
                      ? '0 0 12px rgba(255,255,255,0.45)'
                      : 'none',
                    opacity: active ? 1 : 0.75,
                  }}
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
