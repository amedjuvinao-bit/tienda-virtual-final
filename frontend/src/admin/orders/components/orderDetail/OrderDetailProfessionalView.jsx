// frontend/src/admin/orders/components/orderDetail/OrderDetailProfessionalView.jsx

import { useEffect, useState } from 'react';
import { ORDER_DETAIL_THEME } from './orderDetailTheme';
import OrderDetailHeader from './OrderDetailHeader';
import OrderDetailStoryOverview from './OrderDetailStoryOverview';
import OrderDetailSummaryRail from './OrderDetailSummaryRail';
import OrderDetailCustomerBilling from './OrderDetailCustomerBilling';
import OrderDetailItemsTable from './OrderDetailItemsTable';
import OrderDetailInventoryAllocations from './OrderDetailInventoryAllocations';
import OrderDetailLogisticsPanel from './OrderDetailLogisticsPanel';
import OrderDetailFulfillmentPanel from './OrderDetailFulfillmentPanel';
import OrderDetailPaymentPanel from './OrderDetailPaymentPanel';
import OrderDetailRefundReconciliation from './OrderDetailRefundReconciliation';
import OrderDetailTimelineNotes from './OrderDetailTimelineNotes';
import OrderDetailActionToolbar from './OrderDetailActionToolbar';
import OrderDetailTabs from './OrderDetailTabs';
import { OrderDetailIcons } from './OrderDetailIcons';
import { OrderDetailPanel, SectionTitle } from './OrderDetailPrimitives';

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
  onPrepareWhatsApp,
  whatsAppAvailable = true,
  whatsAppUnavailableReason = '',
  onCustomerStageConfirmed,
  canUpdateFulfillment = false,

  loadingAux = false,
  onRefreshTimeline,
  refunds = [],
  refundsLoading = false,
  canConfirmRefundPayment = false,
  confirmingRefundId = '',
  onConfirmRefundPayment,
}) {
  const [activeTab, setActiveTab] = useState('summary');
  const [managementOpen, setManagementOpen] = useState(false);
  const hasManagementActions = [
    onSaveStatus,
    onSaveTags,
    onTogglePrinted,
    onToggleArchived,
    onSendEmail,
    onPrepareWhatsApp,
  ].some((handler) => typeof handler === 'function');

  useEffect(() => {
    setActiveTab('summary');
    setManagementOpen(false);
  }, [order?._id]);

  const managementPanel = hasManagementActions ? (
    <OrderDetailActionToolbar
      compact
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
      onPrepareWhatsApp={onPrepareWhatsApp}
      whatsAppAvailable={whatsAppAvailable}
      whatsAppUnavailableReason={whatsAppUnavailableReason}
      loadingAux={loadingAux}
      onRefreshTimeline={onRefreshTimeline}
    />
  ) : null;

  const tabs = [
    { id: 'summary', label: 'Resumen', icon: OrderDetailIcons.History },
    { id: 'products', label: 'Pedido', icon: OrderDetailIcons.Package },
    { id: 'operation', label: 'Operación', icon: OrderDetailIcons.Settings2 },
    { id: 'payment', label: 'Pago y factura', icon: OrderDetailIcons.WalletCards },
    { id: 'customer', label: 'Cliente e historial', icon: OrderDetailIcons.User },
  ];

  const tabContent = {
    summary: (
      <OrderDetailStoryOverview
        order={order}
        onNavigate={(tabId) => {
          setManagementOpen(false);
          setActiveTab(tabId);
        }}
      />
    ),
    products: <OrderDetailItemsTable order={order} />,
    operation: (
      <>
        <OrderDetailInventoryAllocations order={order} />
        <OrderDetailLogisticsPanel
          order={order}
          canManage={canUpdateFulfillment}
          onRefreshTimeline={onRefreshTimeline}
          onCustomerStageConfirmed={onCustomerStageConfirmed}
        />
        <OrderDetailFulfillmentPanel
          order={order}
          canUpdate={canUpdateFulfillment}
        />
      </>
    ),
    payment: (
      <>
        <OrderDetailPaymentPanel order={order} />
        <OrderDetailRefundReconciliation
          refunds={refunds}
          loading={refundsLoading}
          canConfirmPayment={canConfirmRefundPayment}
          confirmingId={confirmingRefundId}
          onConfirmPayment={onConfirmRefundPayment}
        />
      </>
    ),
    customer: (
      <>
        <OrderDetailCustomerBilling order={order} />
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
      </>
    ),
  };

  const handleTabChange = (tabId) => {
    setManagementOpen(false);
    setActiveTab(tabId);
  };

  return (
    <div
      className="order-detail-professional-shell"
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
        onManage={hasManagementActions ? () => setManagementOpen((open) => !open) : undefined}
        managementOpen={managementOpen}
      />

      <div
        style={{
          overflowY: 'auto',
          flex: '1 1 auto',
          minHeight: 0,
          padding: 18,
          background: `
            radial-gradient(circle at top left, color-mix(in srgb, var(--admin-primary) 8%, transparent), transparent 28%),
            var(--admin-bg)
          `,
        }}
      >
        <div
          className="order-detail-content-grid"
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
            <OrderDetailTabs
              tabs={tabs}
              activeTab={activeTab}
              onChange={handleTabChange}
            />

            {managementOpen && managementPanel ? (
              <OrderDetailPanel style={{ padding: 18 }}>
                <SectionTitle
                  icon={OrderDetailIcons.Settings2}
                  title="Gestionar orden"
                  subtitle="Estado, etiquetas y acciones administrativas."
                  action={(
                    <button
                      type="button"
                      aria-label="Cerrar gestión de la orden"
                      onClick={() => setManagementOpen(false)}
                      style={{
                        width: 36,
                        height: 36,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 12,
                        border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
                        background: ORDER_DETAIL_THEME.inputBg,
                        color: ORDER_DETAIL_THEME.cardText,
                        cursor: 'pointer',
                      }}
                    >
                      <OrderDetailIcons.X size={17} strokeWidth={2.4} />
                    </button>
                  )}
                />
                {managementPanel}
              </OrderDetailPanel>
            ) : null}

            <div
              id="order-detail-active-panel"
              role="tabpanel"
              aria-labelledby={`order-detail-tab-${activeTab}`}
              tabIndex={0}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                minWidth: 0,
                outline: 'none',
              }}
            >
              {tabContent[activeTab] || tabContent.summary}
            </div>
          </main>

          <OrderDetailSummaryRail order={order} />
        </div>
      </div>

      <style>
        {`
          @media (max-width: 1180px) {
            .order-detail-content-grid {
              grid-template-columns: 1fr !important;
            }

            .order-detail-summary-rail {
              position: static !important;
            }
          }

          @media (max-width: 720px) {
            .order-detail-professional-shell {
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
