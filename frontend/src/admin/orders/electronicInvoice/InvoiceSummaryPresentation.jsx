import {
  formatMoneyCOP,
  getInvoiceCufe,
  getInvoiceNumber,
  getInvoiceStatusInfo,
  shortText,
} from './invoiceStatusUtils';

const PANEL_STYLE = {
  background: 'var(--admin-card-bg)',
  borderColor: 'var(--admin-card-border)',
  color: 'var(--admin-card-text)',
  boxShadow: 'var(--admin-card-shadow, 0 18px 40px rgba(15, 23, 42, 0.06))',
};

export function InvoiceInfo({ label, value }) {
  return (
    <div
      className="rounded-2xl border p-4"
      style={{
        background: 'var(--admin-button-soft-bg, var(--admin-primary-soft-bg))',
        borderColor: 'var(--admin-card-border)',
        color: 'var(--admin-card-text)',
      }}
    >
      <p
        className="text-xs font-semibold uppercase tracking-wide"
        style={{ color: 'var(--admin-card-muted-text)' }}
      >
        {label}
      </p>
      <p
        className="mt-2 break-words text-sm font-medium"
        style={{ color: 'var(--admin-card-text)' }}
      >
        {value || '—'}
      </p>
    </div>
  );
}

function InvoiceMetricCard({ title, value, badgeClass }) {
  return (
    <div
      className="rounded-2xl border p-4"
      style={{
        background: 'var(--admin-primary-soft-bg)',
        borderColor: 'var(--admin-card-border)',
        color: 'var(--admin-card-text)',
      }}
    >
      <p
        className="text-xs font-semibold uppercase tracking-wide"
        style={{ color: 'var(--admin-card-muted-text)' }}
      >
        {title}
      </p>
      <div className="mt-3">
        {badgeClass ? (
          <span
            className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${badgeClass}`}
          >
            {value}
          </span>
        ) : (
          <p
            className="text-sm font-bold"
            style={{ color: 'var(--admin-card-text)' }}
          >
            {value || '—'}
          </p>
        )}
      </div>
    </div>
  );
}

export function InvoiceSummaryCards({ invoice, order }) {
  const statusInfo = getInvoiceStatusInfo(invoice);
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <InvoiceMetricCard
        title="Estado DIAN"
        value={statusInfo.label}
        badgeClass={statusInfo.className}
      />
      <InvoiceMetricCard title="Factura" value={getInvoiceNumber(invoice)} />
      <InvoiceMetricCard
        title="CUFE"
        value={shortText(getInvoiceCufe(invoice), 30)}
      />
      <InvoiceMetricCard title="Total" value={formatMoneyCOP(order?.total)} />
    </div>
  );
}

export function InvoiceEconomicSummary({ order }) {
  return (
    <section className="rounded-3xl border p-5" style={PANEL_STYLE}>
      <h3
        className="text-base font-bold"
        style={{ color: 'var(--admin-card-text)' }}
      >
        Resumen económico
      </h3>
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <InvoiceInfo label="Subtotal" value={formatMoneyCOP(order?.subtotal)} />
        <InvoiceInfo label="IVA" value={formatMoneyCOP(order?.taxes?.iva?.amount)} />
        <InvoiceInfo label="Envío" value={formatMoneyCOP(order?.shipping)} />
        <InvoiceInfo label="Total pagado" value={formatMoneyCOP(order?.total)} />
        <InvoiceInfo
          label="Método pago"
          value={order?.payment?.providerLabel || order?.payment?.provider}
        />
        <InvoiceInfo label="Moneda" value={order?.payment?.currency || 'COP'} />
      </div>
    </section>
  );
}
