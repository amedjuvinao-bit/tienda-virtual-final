import InvoiceDocumentsTab from '../InvoiceDocumentsTab';
import InvoiceErrorsTab from '../InvoiceErrorsTab';
import InvoiceSummaryTab from '../InvoiceSummaryTab';
import InvoiceTimelineTab from '../InvoiceTimelineTab';
import InvoiceCreditNotesTab from './InvoiceCreditNotesTab';

export default function ElectronicInvoiceModalContent({ order, controller }) {
  const { activeTab, currentInvoice } = controller;

  return (
    <div
      className="max-h-[65vh] overflow-y-auto px-6 py-5"
      style={{
        background: 'var(--admin-page-glass-overlay)',
        color: 'var(--admin-card-text)',
      }}
    >
      {activeTab === 'summary' && (
        <InvoiceSummaryTab order={order} invoice={currentInvoice} />
      )}

      {activeTab === 'errors' && (
        <InvoiceErrorsTab invoice={currentInvoice} />
      )}

      {activeTab === 'documents' && (
        <InvoiceDocumentsTab order={order} invoice={currentInvoice} />
      )}

      {activeTab === 'creditNotes' && (
        <InvoiceCreditNotesTab controller={controller} />
      )}

      {activeTab === 'timeline' && (
        <InvoiceTimelineTab order={order} invoice={currentInvoice} />
      )}
    </div>
  );
}
