import {
  CheckCircle2,
  CreditCard,
  DollarSign,
  Download,
  FileText,
  ShoppingBag,
  Truck,
} from 'lucide-react';

const METRIC_ICONS = {
  dian: CheckCircle2,
  noinv: FileText,
  pending: Truck,
  sales: DollarSign,
  ticket: CreditCard,
  total: ShoppingBag,
};

export default function OrdersFiltersSummary({
  ADMIN_BORDER,
  canExport,
  cards,
  exportCsv,
  loading,
  total,
}) {
  return (
    <>
      <div
        className="orders-admin-heading"
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 900,
              lineHeight: 1.1,
              color: 'var(--admin-card-text)',
              margin: 0,
            }}
          >
            Órdenes
          </h1>
          <p
            style={{
              marginTop: 4,
              fontSize: 13,
              color: 'var(--admin-card-muted-text)',
              lineHeight: 1.5,
            }}
          >
            Gestiona tus ventas, revisa estados, sedes y controla la facturación electrónica.
          </p>
        </div>

        {canExport ? (
          <button
            onClick={exportCsv}
            disabled={loading || total === 0}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              height: 42,
              padding: '0 22px',
              background: 'var(--admin-primary)',
              color: 'var(--admin-primary-text)',
              border: 'none',
              borderRadius: 12,
              fontSize: 13,
              fontWeight: 800,
              cursor: loading || total === 0 ? 'not-allowed' : 'pointer',
              letterSpacing: '0.01em',
              boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
              opacity: loading || total === 0 ? 0.5 : 1,
            }}
          >
            <Download size={16} strokeWidth={2.5} />
            Exportar CSV
          </button>
        ) : null}
      </div>

      <div className="orders-admin-metrics orf-metrics" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
        {cards.map(({ key, label, value, helper, accent }) => {
          const Icon = METRIC_ICONS[key];
          return (
            <article
              key={key}
              className="orf-card-metric"
              style={{
                background: 'var(--admin-card-bg)',
                border: `1px solid ${ADMIN_BORDER}`,
                borderRadius: 16,
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {accent ? (
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'var(--admin-primary)', borderRadius: '16px 16px 0 0' }} />
              ) : null}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--admin-card-muted-text)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  {label}
                </span>
                <div className="orf-icon-wrap" style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--admin-primary-soft-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--admin-primary)', flexShrink: 0 }}>
                  <Icon size={17} strokeWidth={2.3} />
                </div>
              </div>
              <div>
                <div style={{ fontSize: accent ? 18 : 22, fontWeight: 900, color: accent ? 'var(--admin-primary)' : 'var(--admin-card-text)', lineHeight: 1, letterSpacing: '-0.02em' }}>
                  {value}
                </div>
                <div style={{ fontSize: 11, color: 'var(--admin-card-muted-text)', marginTop: 5, fontWeight: 500 }}>
                  {helper}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
