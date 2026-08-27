import InvoiceCustomerBillingSection from './InvoiceCustomerBillingSection';
import {
  InvoiceEconomicSummary,
  InvoiceSummaryCards,
} from './InvoiceSummaryPresentation';
import useInvoiceCustomerBilling from './useInvoiceCustomerBilling';

export default function InvoiceSummaryTab({ order, invoice }) {
  const customerBilling = useInvoiceCustomerBilling(order);

  return (
    <div className="space-y-6">
      <InvoiceSummaryCards invoice={invoice} order={order} />
      <InvoiceCustomerBillingSection controller={customerBilling} />
      <InvoiceEconomicSummary order={order} />
    </div>
  );
}
