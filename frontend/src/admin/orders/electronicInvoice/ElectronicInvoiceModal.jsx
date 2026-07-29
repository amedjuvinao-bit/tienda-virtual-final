// src/admin/orders/electronicInvoice/ElectronicInvoiceModal.jsx

import CreditNoteForm from './modal/CreditNoteForm';
import ElectronicInvoiceModalContent from './modal/ElectronicInvoiceModalContent';
import ElectronicInvoiceModalFeedback from './modal/ElectronicInvoiceModalFeedback';
import ElectronicInvoiceModalHeader from './modal/ElectronicInvoiceModalHeader';
import ElectronicInvoiceModalTabs from './modal/ElectronicInvoiceModalTabs';
import useElectronicInvoiceModal from './modal/useElectronicInvoiceModal';

export default function ElectronicInvoiceModal({ order, invoice, onClose }) {
  const controller = useElectronicInvoiceModal({ order, invoice });
  const { activeTab, setActiveTab, retryMessage, retryError } = controller;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm"
      style={{ background: 'var(--admin-modal-overlay)' }}
    >
      <div
        className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-3xl border shadow-2xl"
        style={{
          background: 'var(--admin-modal-bg)',
          color: 'var(--admin-modal-text)',
          borderColor: 'var(--admin-glass-border)',
          boxShadow: 'var(--admin-glass-shadow)',
        }}
      >
        <ElectronicInvoiceModalHeader
          order={order}
          onClose={onClose}
          controller={controller}
        />
        <ElectronicInvoiceModalFeedback
          retryMessage={retryMessage}
          retryError={retryError}
        />
        <CreditNoteForm controller={controller} />
        <ElectronicInvoiceModalTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
        <ElectronicInvoiceModalContent
          order={order}
          controller={controller}
        />
      </div>
    </div>
  );
}
