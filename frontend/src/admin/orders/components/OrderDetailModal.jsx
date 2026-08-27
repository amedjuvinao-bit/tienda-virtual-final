// frontend/src/admin/orders/components/OrderDetailModal.jsx

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ORDER_DETAIL_THEME } from './orderDetail/orderDetailTheme';
import OrderDetailProfessionalView from './orderDetail/OrderDetailProfessionalView';
import OrderDetailToast from './orderDetail/OrderDetailToast';
import OrderWhatsAppPreview from './orderDetail/OrderWhatsAppPreview';
import useOrderCustomerNotifications from './orderDetail/hooks/useOrderCustomerNotifications';
import useOrderDetailManagement from './orderDetail/hooks/useOrderDetailManagement';
import useOrderDetailResources from './orderDetail/hooks/useOrderDetailResources';
import useOrderDocuments from './orderDetail/hooks/useOrderDocuments';
import useOrderManualPaymentConfirmation from './orderDetail/hooks/useOrderManualPaymentConfirmation';
import useOrderRefundActions from './orderDetail/hooks/useOrderRefundActions';
import useOrderReturnActions from './orderDetail/hooks/useOrderReturnActions';

export { synchronizeOrderDetailState } from './orderDetail/hooks/useOrderDetailResources';

export function isolateOrderDetailKeyboardEvent(event = {}) {
  event.stopPropagation?.();
}

export function isolateOrderDetailPointerEvent(event = {}) {
  event.stopPropagation?.();
}

export default function OrderDetailModal({
  open,
  onClose,
  order,
  onSaveStatus,
  onSaveTags,
  onTogglePrinted,
  onToggleArchived,
  canAddNotes = false,
  canSendEmail = false,
  canEditCustomerData = false,
  onCustomerDataUpdated,
  onOrderUpdated,
  canUpdateFulfillment = false,
  canDownloadBilling = false,
  canConfirmManualPayment = false,
  canRefund = false,
  canAutomateRefund = false,
  canManageReturns = false,
  canManageReturnPolicy = false,
  savingId,
}) {
  const [toast, setToast] = useState(null);
  const showToast = useCallback(({
    type = 'info',
    title = '',
    message = '',
    actionLabel = '',
    onAction = null,
    persist = false,
  }) => {
    setToast({
      id: Date.now(),
      type,
      title,
      message,
      actionLabel,
      onAction,
      persist,
    });
  }, []);
  const clearToast = useCallback(() => setToast(null), []);

  const resources = useOrderDetailResources({
    open,
    orderId: order?._id,
    canAddNotes,
    onOrderUpdated,
    showToast,
  });

  const manualPaymentConfirmation = useOrderManualPaymentConfirmation({
    open,
    order,
    canConfirmManualPayment,
    synchronizeAfterMutation: resources.synchronizeAfterMutation,
    fetchTimeline: resources.fetchTimeline,
    showToast,
  });

  const notifications = useOrderCustomerNotifications({
    open,
    order,
    canSendEmail,
    onSaveStatus,
    fetchTimeline: resources.fetchTimeline,
    showToast,
    clearToast,
  });

  const documents = useOrderDocuments({
    order,
    open,
    canDownloadBilling,
    showToast,
  });

  const management = useOrderDetailManagement({
    open,
    order,
    savingId,
    onSaveTags,
    canEditCustomerData,
    onCustomerDataUpdated,
    fetchTimeline: resources.fetchTimeline,
    showToast,
  });

  const refundActions = useOrderRefundActions({
    orderId: order?._id,
    canRefund,
    canAutomateRefund,
    synchronizeAfterMutation: resources.synchronizeAfterMutation,
    fetchRefunds: resources.fetchRefunds,
    showToast,
  });

  const returnActions = useOrderReturnActions({
    orderId: order?._id,
    canManageReturns,
    canManageReturnPolicy,
    canRefund,
    synchronizeAfterMutation: resources.synchronizeAfterMutation,
    fetchReturns: resources.fetchReturns,
    showToast,
  });

  useEffect(() => {
    if (open) clearToast();
  }, [clearToast, open, order?._id]);

  useEffect(() => {
    if (!toast || toast.persist) return undefined;
    const timer = window.setTimeout(clearToast, 4600);
    return () => window.clearTimeout(timer);
  }, [clearToast, toast]);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow || '';
    };
  }, [open]);

  if (!open || !order) return null;

  const loadingAux =
    resources.savingNote || notifications.loading || documents.loading;

  return createPortal(
    <div
      className="fixed left-0 top-0 z-[99999] flex h-screen w-screen items-center justify-center p-2 md:p-4"
      aria-modal="true"
      role="dialog"
      onKeyDown={isolateOrderDetailKeyboardEvent}
      onKeyUp={isolateOrderDetailKeyboardEvent}
      onCopy={isolateOrderDetailKeyboardEvent}
      onCut={isolateOrderDetailKeyboardEvent}
      onPaste={isolateOrderDetailKeyboardEvent}
      onPointerDown={isolateOrderDetailPointerEvent}
      onPointerUp={isolateOrderDetailPointerEvent}
      onMouseDown={isolateOrderDetailPointerEvent}
      onMouseUp={isolateOrderDetailPointerEvent}
      onContextMenu={isolateOrderDetailPointerEvent}
      onClick={isolateOrderDetailPointerEvent}
    >
      <div
        className="absolute inset-0 backdrop-blur-sm"
        style={{
          background: ORDER_DETAIL_THEME.overlayBg || 'rgba(15, 23, 42, 0.56)',
        }}
      />

      {toast ? <OrderDetailToast toast={toast} onClose={clearToast} /> : null}

      <OrderWhatsAppPreview
        open={notifications.previewOpen}
        preview={notifications.preview}
        loading={notifications.previewLoading}
        error={notifications.previewError}
        onClose={() => notifications.setPreviewOpen(false)}
        onRetry={notifications.prepareWhatsAppPreview}
        onOpenWhatsApp={notifications.registerWhatsAppOpened}
      />

      <div className="relative z-[100000]">
        <OrderDetailProfessionalView
          order={order}
          onClose={onClose}
          onDownloadPdf={canDownloadBilling ? documents.openPdf : null}
          onOpenInvoice={
            canDownloadBilling ? documents.openElectronicInvoice : null
          }
          downloadingPdf={documents.loading}
          invoiceLoading={false}
          timeline={resources.timeline}
          notes={resources.notes}
          timelineHasMore={resources.timelineHasMore}
          notesHasMore={resources.notesHasMore}
          timelineMoreLoading={resources.timelineMoreLoading}
          notesMoreLoading={resources.notesMoreLoading}
          onLoadMoreTimeline={resources.loadMoreTimeline}
          onLoadMoreNotes={resources.loadMoreNotes}
          tags={order?.tags || []}
          noteText={resources.noteText}
          setNoteText={resources.setNoteText}
          onSaveNote={canAddNotes ? resources.addNote : null}
          savingNote={resources.savingNote}
          statusLocal={management.statusLocal}
          setStatusLocal={management.setStatusLocal}
          onSaveStatus={
            onSaveStatus ? notifications.saveStatusAndOfferWhatsApp : null
          }
          statusSaving={management.disabled}
          tagsStr={management.tagsStr}
          setTagsStr={management.setTagsStr}
          onSaveTags={onSaveTags ? management.saveTags : null}
          savingTags={management.savingTags}
          printed={management.printed}
          archived={management.archived}
          onTogglePrinted={onTogglePrinted}
          onToggleArchived={onToggleArchived}
          emailMenuOpen={notifications.emailMenuOpen}
          setEmailMenuOpen={notifications.setEmailMenuOpen}
          emailBtnRef={notifications.emailBtnRef}
          onSendEmail={canSendEmail ? notifications.sendEmail : null}
          onPrepareWhatsApp={
            canSendEmail ? notifications.prepareWhatsAppPreview : null
          }
          whatsAppAvailable={notifications.availability.available}
          whatsAppUnavailableReason={notifications.availability.reason}
          onCustomerStageConfirmed={
            canSendEmail ? notifications.offerWhatsAppAfterStage : null
          }
          onOrderUpdated={resources.synchronizeAfterMutation}
          canUpdateFulfillment={canUpdateFulfillment}
          canConfirmManualPayment={canConfirmManualPayment}
          manualPaymentConfirmation={manualPaymentConfirmation}
          loadingAux={loadingAux}
          onRefreshTimeline={resources.fetchTimeline}
          refunds={resources.refunds}
          refundsLoading={resources.refundsLoading}
          canConfirmRefundPayment={canRefund}
          confirmingRefundId={refundActions.confirmingId}
          onConfirmRefundPayment={refundActions.confirmPayment}
          canAutomateRefund={canAutomateRefund}
          automatingRefundId={refundActions.automatingId}
          onAutomateRefund={refundActions.automate}
          returnsData={resources.returnsData}
          returnsLoading={resources.returnsLoading}
          returnBusyId={returnActions.busyId}
          canManageReturns={canManageReturns}
          canManageReturnPolicy={canManageReturnPolicy}
          canRefundReturns={canRefund}
          onCreateReturn={returnActions.createReturn}
          onUpdateReturn={returnActions.updateReturn}
          onRefundReturn={returnActions.refundReturn}
          onExchangeReturn={returnActions.exchangeReturn}
          onAutomaticExchangeReturn={returnActions.automaticExchange}
          onStoreCreditReturn={returnActions.createStoreCredit}
          onSaveReturnPolicy={returnActions.savePolicy}
          onSaveCustomerData={
            canEditCustomerData ? management.saveCustomerData : null
          }
          savingCustomerData={management.savingCustomerData}
        />
      </div>
    </div>,
    document.body
  );
}
