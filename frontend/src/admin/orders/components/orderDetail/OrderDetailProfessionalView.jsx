// frontend/src/admin/orders/components/orderDetail/OrderDetailProfessionalView.jsx

import { ORDER_DETAIL_THEME } from './orderDetailTheme';
import OrderDetailHeader from './OrderDetailHeader';
import OrderDetailProgressStepper from './OrderDetailProgressStepper';
import OrderDetailSummaryRail from './OrderDetailSummaryRail';
import OrderDetailCustomerBilling from './OrderDetailCustomerBilling';
import OrderDetailItemsTable from './OrderDetailItemsTable';
import OrderDetailInventoryAllocations from './OrderDetailInventoryAllocations';
import OrderDetailFulfillmentPanel from './OrderDetailFulfillmentPanel';
import OrderDetailPaymentPanel from './OrderDetailPaymentPanel';
import OrderDetailTimelineNotes from './OrderDetailTimelineNotes';
import OrderDetailActionToolbar from './OrderDetailActionToolbar';

export default function OrderDetailProfessionalView({
  order,
  onClose,

  onDownloadPdf,
  onOpenInvoice,
  downloadingPdf = false,
  invoiceLoading = false,

  timeline = [],
  notes = [],
  tags = [],

  noteText = '',
  setNoteText,
  onSaveNote,
  savingNote = false,

  statusLocal,
  setStatusLocal,
  onSaveStatus,
  statusSaving = false,

  tagsStr = '',
  setTagsStr,
  onSaveTags,
  savingTags = false,

  printed = false,
  archived = false,
  onTogglePrinted,
  onToggleArchived,

  emailMenuOpen = false,
  setEmailMenuOpen,
  emailBtnRef,
  onSendEmail,
  canUpdateFulfillment = false,

  loadingAux = false,
  onRefreshTimeline,
}) {
  return (
    <div
      style={{
        width: 'min(1480px, calc(100vw - 34px))',
        maxHeight: 'calc(100vh - 34px)',
        overflow: 'hidden',
        borderRadius: 30,
        border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
        background: ORDER_DETAIL_THEME.cardBg,
        color: ORDER_DETAIL_THEME.cardText,
        boxShadow: '0 34px 110px rgba(15, 23, 42, 0.34)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <OrderDetailHeader
        order={order}
        onClose={onClose}
        onDownloadPdf={onDownloadPdf}
        onOpenInvoice={onOpenInvoice}
        downloadingPdf={downloadingPdf}
        invoiceLoading={invoiceLoading}
      />

      <div
        style={{
          overflowY: 'auto',
          padding: 18,
          background: `
            radial-gradient(circle at top left, color-mix(in srgb, var(--admin-primary) 8%, transparent), transparent 28%),
            var(--admin-bg)
          `,
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) 360px',
            gap: 16,
            alignItems: 'start',
          }}
        >
          <main
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              minWidth: 0,
            }}
          >
            <OrderDetailProgressStepper order={order} />

            <OrderDetailActionToolbar
              order={order}
              statusLocal={statusLocal}
              setStatusLocal={setStatusLocal}
              onSaveStatus={onSaveStatus}
              disabled={statusSaving}
              tagsStr={tagsStr}
              setTagsStr={setTagsStr}
              onSaveTags={onSaveTags}
              savingTags={savingTags}
              printed={printed}
              archived={archived}
              onTogglePrinted={onTogglePrinted}
              onToggleArchived={onToggleArchived}
              emailMenuOpen={emailMenuOpen}
              setEmailMenuOpen={setEmailMenuOpen}
              emailBtnRef={emailBtnRef}
              onSendEmail={onSendEmail}
              loadingAux={loadingAux}
              onRefreshTimeline={onRefreshTimeline}
            />

            <OrderDetailCustomerBilling order={order} />

            <OrderDetailItemsTable order={order} />

            <OrderDetailInventoryAllocations order={order} />

            <OrderDetailFulfillmentPanel
              order={order}
              canUpdate={canUpdateFulfillment}
            />

            <OrderDetailPaymentPanel order={order} />

            <OrderDetailTimelineNotes
              order={order}
              timeline={timeline}
              notes={notes}
              tags={tags}
              noteText={noteText}
              setNoteText={setNoteText}
              onSaveNote={onSaveNote}
              savingNote={savingNote}
            />
          </main>

          <OrderDetailSummaryRail order={order} />
        </div>
      </div>

      <style>
        {`
          @media (max-width: 1180px) {
            div[style*="grid-template-columns: minmax(0, 1fr) 360px"] {
              grid-template-columns: 1fr !important;
            }
          }

          @media (max-width: 720px) {
            div[style*="width: min(1480px, calc(100vw - 34px))"] {
              width: calc(100vw - 18px) !important;
              max-height: calc(100vh - 18px) !important;
              border-radius: 22px !important;
            }
          }
        `}
      </style>
    </div>
  );
}
