import InvoiceCustomerBillingSection from './InvoiceCustomerBillingSection';
import {
  InvoiceEconomicSummary,
  InvoiceSummaryCards,
} from './InvoiceSummaryPresentation';
import useInvoiceCustomerBilling from './useInvoiceCustomerBilling';

function InvoiceIssuedTo({ invoice, order }) {
  const customer = invoice?.customer;
  if (!customer || !Object.keys(customer).length) return null;

  const billedName = customer.personType === 'juridica'
    ? customer.businessName
    : [customer.firstName, customer.lastName].filter(Boolean).join(' ') || customer.businessName;
  const currentBilling = order?.billing || {};
  const currentName = currentBilling.personType === 'juridica'
    ? currentBilling.businessName
    : [
        currentBilling.firstName || currentBilling.name || order?.customer?.name,
        currentBilling.lastName || currentBilling.lastname || order?.customer?.lastname,
      ].filter(Boolean).join(' ');
  const currentDocument = currentBilling.documentNumber || currentBilling.id || order?.customer?.id || '';
  const changed = ['accepted', 'validated'].includes(String(invoice.status || '').toLowerCase()) && (
    (currentName && billedName && currentName.trim() !== billedName.trim()) ||
    (currentDocument && customer.documentNumber && String(currentDocument).trim() !== String(customer.documentNumber).trim())
  );

  return (
    <section className="rounded-3xl border p-5" style={{ background: 'var(--admin-card-bg)', borderColor: 'var(--admin-card-border)', color: 'var(--admin-card-text)' }}>
      <h3 className="text-base font-bold">Comprador registrado al emitir la factura</h3>
      <p className="mt-1 text-sm" style={{ color: 'var(--admin-card-muted-text)' }}>
        Estos datos se guardaron en la factura y no cambian al editar la orden.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div><span className="text-xs font-semibold">Nombre fiscal</span><p className="font-bold">{billedName || '—'}</p></div>
        <div><span className="text-xs font-semibold">Documento</span><p className="font-bold">{customer.documentNumber || '—'}</p></div>
      </div>
      {changed ? (
        <p role="alert" className="mt-4 rounded-xl border p-3 text-sm font-semibold" style={{ background: 'var(--admin-warning-soft-bg)', borderColor: 'var(--admin-warning-border)', color: 'var(--admin-warning-text)' }}>
          Los datos actuales de la orden son diferentes. Revisa el documento emitido antes de cualquier corrección fiscal.
        </p>
      ) : null}
    </section>
  );
}

export default function InvoiceSummaryTab({ order, invoice }) {
  const customerBilling = useInvoiceCustomerBilling(order);

  return (
    <div className="space-y-6">
      <InvoiceSummaryCards invoice={invoice} order={order} />
      <InvoiceIssuedTo invoice={invoice} order={order} />
      <InvoiceCustomerBillingSection controller={customerBilling} />
      <InvoiceEconomicSummary order={order} />
    </div>
  );
}
