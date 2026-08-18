// frontend/src/admin/orders/components/OrderDetailModal.jsx

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../../../lib/api';
import { ORDER_DETAIL_THEME } from './orderDetail/orderDetailTheme';
import OrderDetailProfessionalView from './orderDetail/OrderDetailProfessionalView';
import OrderWhatsAppPreview from './orderDetail/OrderWhatsAppPreview';

function getWhatsAppAvailability(order = {}) {
  const candidates = [
    order?.customer?.phone,
    order?.billing?.phone,
    order?.customer?.emailOrPhone,
  ];

  const hasCandidate = candidates.some((candidate) => {
    const raw = String(candidate || '').trim();
    if (!raw || raw.includes('@')) return false;
    const digits = raw.replace(/\D/g, '').replace(/^00/, '');
    return (
      (digits.length === 10 && digits.startsWith('3')) ||
      (digits.length >= 11 && digits.length <= 15)
    );
  });

  return hasCandidate
    ? { available: true, reason: '' }
    : {
        available: false,
        reason: 'La orden no tiene un celular válido del cliente.',
      };
}

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
  canUpdateFulfillment = false,
  canDownloadBilling = false,
  canRefund = false,
  canAutomateRefund = false,
  canManageReturns = false,
  savingId,
}) {
  const [statusLocal, setStatusLocal] = useState(order?.status || 'pending');
  const [tagsStr, setTagsStr] = useState((order?.tags || []).join(', '));
  const [savingTags, setSavingTags] = useState(false);

  const [timeline, setTimeline] = useState([]);
  const [notes, setNotes] = useState([]);
  const [noteText, setNoteText] = useState('');
  const [loadingAux, setLoadingAux] = useState(false);
  const [refunds, setRefunds] = useState([]);
  const [refundsLoading, setRefundsLoading] = useState(false);
  const [confirmingRefundId, setConfirmingRefundId] = useState('');
  const [automatingRefundId, setAutomatingRefundId] = useState('');
  const [returnsData, setReturnsData] = useState({
    orderId: '',
    policy: {},
    eligibility: [],
    returns: [],
  });
  const [returnsLoading, setReturnsLoading] = useState(false);
  const [returnBusyId, setReturnBusyId] = useState('');

  const [emailMenuOpen, setEmailMenuOpen] = useState(false);
  const [whatsAppPreviewOpen, setWhatsAppPreviewOpen] = useState(false);
  const [whatsAppPreview, setWhatsAppPreview] = useState(null);
  const [whatsAppPreviewLoading, setWhatsAppPreviewLoading] = useState(false);
  const [whatsAppPreviewError, setWhatsAppPreviewError] = useState('');
  const [toast, setToast] = useState(null);
  const [savingCustomerData, setSavingCustomerData] = useState(false);
  const emailBtnRef = useRef(null);

  const printed = !!order?.printed;
  const archived = !!order?.archived;
  const disabled = savingId === order?._id;
  const whatsAppAvailability = useMemo(
    () => getWhatsAppAvailability(order),
    [order]
  );

  const showToast = ({ type = 'info', title = '', message = '', actionLabel = '', onAction = null, persist = false }) => {
    setToast({
      id: Date.now(),
      type,
      title,
      message,
      actionLabel,
      onAction,
      persist,
    });
  };

  const electronicInvoiceUrl = useMemo(() => {
    const factusLinks = order?.factusLinks || {};

    return (
      factusLinks?.pdfUrl ||
      factusLinks?.publicUrl ||
      order?.electronicInvoice?.provider?.links?.public_url ||
      order?.electronicInvoice?.provider?.links?.pdf_url ||
      ''
    );
  }, [order]);

  useEffect(() => {
    if (!open) return;

    setStatusLocal(order?.status || 'pending');
    setTagsStr((Array.isArray(order?.tags) ? order.tags : []).join(', '));
    setEmailMenuOpen(false);
    setWhatsAppPreviewOpen(false);
    setWhatsAppPreview(null);
    setWhatsAppPreviewError('');
    setToast(null);
  }, [open, order?._id]);

  useEffect(() => {
    if (!toast || toast.persist) return undefined;

    const timer = window.setTimeout(() => {
      setToast(null);
    }, 4600);

    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow || '';
    };
  }, [open]);

  useEffect(() => {
    if (!emailMenuOpen) return undefined;

    const handleDocumentClick = (event) => {
      const button = emailBtnRef.current;

      if (button && !button.contains(event.target)) {
        setEmailMenuOpen(false);
      }
    };

    document.addEventListener('click', handleDocumentClick, true);

    return () => {
      document.removeEventListener('click', handleDocumentClick, true);
    };
  }, [emailMenuOpen]);

  const fetchTimeline = async () => {
    if (!order?._id) return;

    try {
      const { data } = await api.get(`/api/orders/${order._id}/timeline`);
      const items = Array.isArray(data?.data) ? data.data : [];
      setTimeline(items);
      return items;
    } catch {
      setTimeline([]);
      return [];
    }
  };

  const fetchNotes = async () => {
    if (!order?._id) return;

    try {
      const { data } = await api.get(`/api/orders/${order._id}/notes`);
      setNotes(Array.isArray(data?.data) ? data.data : []);
    } catch {
      setNotes([]);
    }
  };

  const fetchRefunds = async () => {
    if (!order?._id) return;
    try {
      setRefundsLoading(true);
      const { data } = await api.get(`/api/orders/${order._id}/refunds`);
      setRefunds(Array.isArray(data?.refunds) ? data.refunds : []);
    } catch {
      setRefunds([]);
    } finally {
      setRefundsLoading(false);
    }
  };

  const fetchReturns = async () => {
    if (!order?._id) return;
    try {
      setReturnsLoading(true);
      const { data } = await api.get(`/api/orders/${order._id}/returns`);
      setReturnsData({
        orderId: order._id,
        policy: data?.policy || {},
        eligibility: Array.isArray(data?.eligibility) ? data.eligibility : [],
        returns: Array.isArray(data?.returns) ? data.returns : [],
      });
    } catch {
      setReturnsData({ orderId: order._id, policy: {}, eligibility: [], returns: [] });
    } finally {
      setReturnsLoading(false);
    }
  };

  useEffect(() => {
    if (!open || !order?._id) return;

    fetchTimeline();
    fetchNotes();
    fetchRefunds();
    fetchReturns();
  }, [open, order?._id]);

  const showReturnError = (error, fallback) => {
    showToast({
      type: 'error',
      title: 'No se pudo actualizar el RMA',
      message: error?.response?.data?.message || fallback,
      persist: true,
    });
  };

  const createReturnCase = async (payload) => {
    if (!canManageReturns || !order?._id) return;
    try {
      setReturnBusyId('create');
      await api.post(`/api/orders/${order._id}/returns`, payload);
      showToast({
        type: 'success',
        title: 'RMA creado',
        message: 'Las unidades quedaron reservadas para el proceso posventa.',
      });
      await Promise.all([fetchReturns(), fetchTimeline()]);
    } catch (error) {
      showReturnError(error, 'Revisa la elegibilidad y las cantidades seleccionadas.');
    } finally {
      setReturnBusyId('');
    }
  };

  const updateReturnCase = async (returnCase, action, payload = {}) => {
    if (!canManageReturns || !order?._id || !returnCase?._id) return;
    try {
      setReturnBusyId(String(returnCase._id));
      await api.patch(
        `/api/orders/${order._id}/returns/${returnCase._id}`,
        {
          ...payload,
          action,
          expectedRevision: returnCase.revision,
        }
      );
      showToast({
        type: 'success',
        title: 'RMA actualizado',
        message: 'La etapa quedó registrada con trazabilidad.',
      });
      await Promise.all([fetchReturns(), fetchTimeline()]);
    } catch (error) {
      showReturnError(error, 'Recarga el expediente y vuelve a intentar.');
    } finally {
      setReturnBusyId('');
    }
  };

  const refundReturnCase = async (returnCase, amount) => {
    if (!canRefund || !order?._id || !returnCase?._id) return;
    try {
      setReturnBusyId(String(returnCase._id));
      await api.post(
        `/api/orders/${order._id}/returns/${returnCase._id}/refund`,
        { expectedRevision: returnCase.revision, amount }
      );
      showToast({
        type: 'success',
        title: 'Reembolso creado',
        message: 'La inspección RMA terminó; dinero y documento fiscal siguen visibles hasta cerrar la conciliación.',
      });
      await Promise.all([fetchReturns(), fetchRefunds(), fetchTimeline()]);
    } catch (error) {
      showReturnError(error, 'Verifica el monto aceptado y el estado de la inspección.');
    } finally {
      setReturnBusyId('');
    }
  };

  const exchangeReturnCase = async (returnCase, replacementOrderId, reference) => {
    if (!canManageReturns || !order?._id || !returnCase?._id) return;
    try {
      setReturnBusyId(String(returnCase._id));
      await api.post(
        `/api/orders/${order._id}/returns/${returnCase._id}/exchange`,
        {
          expectedRevision: returnCase.revision,
          replacementOrderId,
          reference,
        }
      );
      showToast({
        type: 'success',
        title: 'Cambio vinculado',
        message: 'El expediente quedó enlazado con una orden de reemplazo real.',
      });
      await Promise.all([fetchReturns(), fetchTimeline()]);
    } catch (error) {
      showReturnError(error, 'Verifica la orden de reemplazo y la sede autorizada.');
    } finally {
      setReturnBusyId('');
    }
  };

  const confirmRefundPayment = async (refund, reference) => {
    if (!canRefund || !order?._id || !refund?._id) return;
    try {
      setConfirmingRefundId(refund._id);
      await api.post(
        `/api/orders/${order._id}/refunds/${refund._id}/confirm-payment`,
        { reference }
      );
      showToast({
        type: 'success',
        title: 'Dinero conciliado',
        message: 'La devolución quedó registrada y la caja fue recalculada.',
      });
      await Promise.all([fetchRefunds(), fetchTimeline()]);
    } catch (error) {
      showToast({
        type: 'error',
        title: 'No se pudo conciliar',
        message:
          error?.response?.data?.message ||
          'Revisa la referencia del reintegro e intenta nuevamente.',
        persist: true,
      });
    } finally {
      setConfirmingRefundId('');
    }
  };

  const automateRefund = async (refund) => {
    if (!canAutomateRefund || !order?._id || !refund?._id) return;
    try {
      setAutomatingRefundId(refund._id);
      const response = await api.post(
        `/api/orders/${order._id}/refunds/${refund._id}/automate`,
        {},
        { timeout: 90000 }
      );
      const completed = response?.data?.completed === true;
      const paymentOutcome = response?.data?.outcomes?.payment || {};
      showToast({
        type: completed ? 'success' : 'info',
        title: completed ? 'Reembolso conciliado' : 'Automatización avanzada',
        message: completed
          ? 'Dinero, inventario y documento fiscal quedaron conciliados con trazabilidad.'
          : paymentOutcome.message ||
            'Se automatizaron las etapas compatibles; las acciones manuales siguen visibles.',
        persist: !completed,
      });
      await Promise.all([fetchRefunds(), fetchReturns(), fetchTimeline()]);
    } catch (error) {
      showToast({
        type: 'error',
        title: 'No se pudo automatizar',
        message:
          error?.response?.data?.message ||
          'No se movió ninguna etapa sin confirmación. Revisa el detalle e intenta nuevamente.',
        persist: true,
      });
      await fetchRefunds();
    } finally {
      setAutomatingRefundId('');
    }
  };

  const addNote = async () => {
    const text = String(noteText || '').trim();

    if (!canAddNotes || !text || !order?._id) return;

    try {
      setLoadingAux(true);

      await api.post(`/api/orders/${order._id}/notes`, { text });

      setNoteText('');
      showToast({
        type: 'success',
        title: 'Nota guardada',
        message: 'La nota interna se agregó correctamente.',
      });
      await fetchNotes();
      await fetchTimeline();
    } catch {
      showToast({
        type: 'error',
        title: 'No se pudo crear la nota',
        message: 'Revisa la conexión o intenta nuevamente.',
      });
    } finally {
      setLoadingAux(false);
    }
  };

  const sendEmail = async (action) => {
    if (!canSendEmail || !order?._id) return;

    try {
      setLoadingAux(true);

      const { data } = await api.post(`/api/orders/${order._id}/email`, {
        action,
      });

      setEmailMenuOpen(false);

      const preview = data?.previewUrl || data?.preview || null;
      const to = data?.to || order?.customer?.emailOrPhone || order?.customer?.email || 'cliente';

      if (preview && typeof preview === 'string') {
        showToast({
          type: 'info',
          title: 'Vista previa de correo lista',
          message: 'El correo fue generado en modo prueba. Puedes abrir la vista previa sin salir del panel.',
          actionLabel: 'Abrir vista previa',
          persist: true,
          onAction: () => {
            window.open(preview, '_blank', 'noopener,noreferrer');
            setToast(null);
          },
        });
      } else {
        showToast({
          type: 'success',
          title: 'Correo enviado',
          message: data?.message || `Correo enviado correctamente a ${to}.`,
        });
      }

      await fetchTimeline();
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        'No se pudo enviar el email.';

      setEmailMenuOpen(false);
      showToast({
        type: 'error',
        title: 'No se pudo enviar el correo',
        message,
        persist: true,
      });
    } finally {
      setLoadingAux(false);
    }
  };

  const prepareWhatsAppPreview = async () => {
    if (!canSendEmail || !order?._id) return;

    setWhatsAppPreviewOpen(true);
    setWhatsAppPreviewLoading(true);
    setWhatsAppPreviewError('');
    setWhatsAppPreview(null);
    setToast(null);

    try {
      const { data } = await api.get(
        `/api/orders/${order._id}/customer-notifications/whatsapp/preview`
      );
      setWhatsAppPreview(data?.preview || null);
      if (!data?.preview) {
        setWhatsAppPreviewError(
          'El servidor no devolvió una vista previa válida.'
        );
      }
    } catch (error) {
      setWhatsAppPreviewError(
        error?.response?.data?.message ||
          'No fue posible preparar el informe de WhatsApp.'
      );
    } finally {
      setWhatsAppPreviewLoading(false);
    }
  };

  const registerWhatsAppOpened = () => {
    if (!order?._id || !whatsAppPreview?.whatsappUrl) return;

    const sourceEventId = whatsAppPreview.sourceEventId || '';
    setWhatsAppPreviewOpen(false);
    showToast({
      type: 'success',
      title: 'WhatsApp abierto',
      message:
        'El informe quedó preparado. Confirma el envío dentro de WhatsApp.',
    });

    api
      .post(
        `/api/orders/${order._id}/customer-notifications/whatsapp/opened`,
        { sourceEventId }
      )
      .then(() => fetchTimeline())
      .catch((error) => {
        showToast({
          type: 'warning',
          title: 'WhatsApp abierto sin registro',
          message:
            error?.response?.data?.message ||
            'El chat se abrió, pero no se pudo registrar la acción en la trazabilidad.',
          persist: true,
        });
      });
  };

  const saveStatusAndOfferWhatsApp = async (orderId, nextStatus) => {
    if (!onSaveStatus) return null;
    const previousStatus = String(order?.status || '').toLowerCase();
    const response = await onSaveStatus(orderId, nextStatus);
    const changed =
      response?.data?.changed !== false &&
      previousStatus !== String(nextStatus || '').toLowerCase();

    if (changed && canSendEmail) {
      showToast({
        type: 'success',
        title: 'Etapa confirmada',
        message: whatsAppAvailability.available
          ? 'El cambio quedó guardado. Puedes informar ahora al cliente.'
          : `El cambio quedó guardado. ${whatsAppAvailability.reason}`,
        actionLabel: whatsAppAvailability.available
          ? 'Informar por WhatsApp'
          : '',
        onAction: whatsAppAvailability.available
          ? prepareWhatsAppPreview
          : null,
        persist: true,
      });
    }

    return response;
  };

  const offerWhatsAppAfterStage = ({ label = 'Etapa confirmada' } = {}) => {
    showToast({
      type: 'success',
      title: label,
      message: whatsAppAvailability.available
        ? 'La trazabilidad quedó actualizada. Puedes informar ahora al cliente.'
        : `La trazabilidad quedó actualizada. ${whatsAppAvailability.reason}`,
      actionLabel: whatsAppAvailability.available
        ? 'Informar por WhatsApp'
        : '',
      onAction: whatsAppAvailability.available
        ? prepareWhatsAppPreview
        : null,
      persist: true,
    });
  };

  const openPdf = async () => {
    if (!canDownloadBilling || !order?._id) return;

    try {
      setLoadingAux(true);

      const response = await api.get(`/api/orders/${order._id}/receipt-pdf`, {
        responseType: 'blob',
      });

      const blob = new Blob([response.data], {
        type: 'application/pdf',
      });

      const url = URL.createObjectURL(blob);

      window.open(url, '_blank', 'noopener,noreferrer');

      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 60_000);
    } catch {
      showToast({
        type: 'error',
        title: 'No se pudo abrir el PDF',
        message: 'No fue posible generar o abrir el documento de la orden.',
      });
    } finally {
      setLoadingAux(false);
    }
  };

  const openElectronicInvoice = () => {
    if (!canDownloadBilling) return;

    if (!electronicInvoiceUrl) {
      showToast({
        type: 'warning',
        title: 'Factura no disponible',
        message: 'Esta orden aún no tiene enlace de factura electrónica.',
      });
      return;
    }

    window.open(electronicInvoiceUrl, '_blank', 'noopener,noreferrer');
  };

  const saveTags = async (orderId, tags) => {
    if (!onSaveTags) return;

    try {
      setSavingTags(true);
      await onSaveTags(orderId, tags);
      showToast({
        type: 'success',
        title: 'Etiquetas guardadas',
        message: 'Las etiquetas internas quedaron actualizadas.',
      });
    } catch {
      showToast({
        type: 'error',
        title: 'No se guardaron las etiquetas',
        message: 'Revisa los datos e intenta nuevamente.',
      });
    } finally {
      setSavingTags(false);
    }
  };

  const saveCustomerData = async (payload) => {
    if (!canEditCustomerData || !order?._id) return null;

    try {
      setSavingCustomerData(true);
      const { data } = await api.patch(
        `/api/orders/${order._id}/customer-data`,
        payload
      );
      const updatedOrder = data?.order || {
        ...order,
        customer: data?.customer || order.customer,
        billing: data?.billing || order.billing,
        customerRelationship:
          data?.customerRelationship || order.customerRelationship,
      };

      onCustomerDataUpdated?.(updatedOrder);
      showToast({
        type: 'success',
        title: 'Datos actualizados',
        message: payload?.syncCustomer
          ? 'La orden y la ficha del cliente quedaron sincronizadas.'
          : 'El cambio quedó guardado únicamente en esta orden.',
      });
      await fetchTimeline();
      return updatedOrder;
    } catch (error) {
      showToast({
        type: 'error',
        title: 'No se pudieron actualizar los datos',
        message:
          error?.response?.data?.message ||
          'Revisa la información e intenta nuevamente.',
        persist: true,
      });
      throw error;
    } finally {
      setSavingCustomerData(false);
    }
  };

  const normalizedNotes = useMemo(() => {
    return notes.map((note) => ({
      ...note,
      content: note?.content || note?.text || note?.note || note?.message || '',
      createdByName:
        note?.createdByName ||
        note?.author?.name ||
        note?.createdBy?.name ||
        note?.createdBy?.username ||
        '',
    }));
  }, [notes]);

  if (!open || !order) return null;

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
          background:
            ORDER_DETAIL_THEME.overlayBg ||
            'rgba(15, 23, 42, 0.56)',
        }}
      />

      {toast ? (
        <OrderDetailToast
          toast={toast}
          onClose={() => setToast(null)}
        />
      ) : null}

      <OrderWhatsAppPreview
        open={whatsAppPreviewOpen}
        preview={whatsAppPreview}
        loading={whatsAppPreviewLoading}
        error={whatsAppPreviewError}
        onClose={() => setWhatsAppPreviewOpen(false)}
        onRetry={prepareWhatsAppPreview}
        onOpenWhatsApp={registerWhatsAppOpened}
      />

      <div className="relative z-[100000]">
        <OrderDetailProfessionalView
          order={order}
          onClose={onClose}
          onDownloadPdf={canDownloadBilling ? openPdf : null}
          onOpenInvoice={canDownloadBilling ? openElectronicInvoice : null}
          downloadingPdf={loadingAux}
          invoiceLoading={false}
          timeline={timeline}
          notes={normalizedNotes}
          tags={order?.tags || []}
          noteText={noteText}
          setNoteText={setNoteText}
          onSaveNote={canAddNotes ? addNote : null}
          savingNote={loadingAux}
          statusLocal={statusLocal}
          setStatusLocal={setStatusLocal}
          onSaveStatus={onSaveStatus ? saveStatusAndOfferWhatsApp : null}
          statusSaving={disabled}
          tagsStr={tagsStr}
          setTagsStr={setTagsStr}
          onSaveTags={saveTags}
          savingTags={savingTags}
          printed={printed}
          archived={archived}
          onTogglePrinted={onTogglePrinted}
          onToggleArchived={onToggleArchived}
          emailMenuOpen={emailMenuOpen}
          setEmailMenuOpen={setEmailMenuOpen}
          emailBtnRef={emailBtnRef}
          onSendEmail={canSendEmail ? sendEmail : null}
          onPrepareWhatsApp={canSendEmail ? prepareWhatsAppPreview : null}
          whatsAppAvailable={whatsAppAvailability.available}
          whatsAppUnavailableReason={whatsAppAvailability.reason}
          onCustomerStageConfirmed={
            canSendEmail ? offerWhatsAppAfterStage : null
          }
          canUpdateFulfillment={canUpdateFulfillment}
          loadingAux={loadingAux}
          onRefreshTimeline={fetchTimeline}
          refunds={refunds}
          refundsLoading={refundsLoading}
          canConfirmRefundPayment={canRefund}
          confirmingRefundId={confirmingRefundId}
          onConfirmRefundPayment={confirmRefundPayment}
          canAutomateRefund={canAutomateRefund}
          automatingRefundId={automatingRefundId}
          onAutomateRefund={automateRefund}
          returnsData={returnsData}
          returnsLoading={returnsLoading}
          returnBusyId={returnBusyId}
          canManageReturns={canManageReturns}
          canRefundReturns={canRefund}
          onCreateReturn={createReturnCase}
          onUpdateReturn={updateReturnCase}
          onRefundReturn={refundReturnCase}
          onExchangeReturn={exchangeReturnCase}
          onSaveCustomerData={
            canEditCustomerData ? saveCustomerData : null
          }
          savingCustomerData={savingCustomerData}
        />
      </div>
    </div>,
    document.body
  );
}

function OrderDetailToast({ toast, onClose }) {
  const type = toast?.type || 'info';

  const meta = {
    success: {
      label: 'OK',
      color: '#059669',
      bg: 'rgba(236, 253, 245, 0.98)',
      border: 'rgba(16, 185, 129, 0.36)',
    },
    error: {
      label: 'Error',
      color: '#dc2626',
      bg: 'rgba(255, 241, 242, 0.98)',
      border: 'rgba(244, 63, 94, 0.36)',
    },
    warning: {
      label: 'Aviso',
      color: '#d97706',
      bg: 'rgba(255, 251, 235, 0.98)',
      border: 'rgba(245, 158, 11, 0.38)',
    },
    info: {
      label: 'Info',
      color: ORDER_DETAIL_THEME.primary,
      bg: ORDER_DETAIL_THEME.cardBg,
      border: ORDER_DETAIL_THEME.cardBorder,
    },
  }[type] || {
    label: 'Info',
    color: ORDER_DETAIL_THEME.primary,
    bg: ORDER_DETAIL_THEME.cardBg,
    border: ORDER_DETAIL_THEME.cardBorder,
  };

  return (
    <div
      style={{
        position: 'fixed',
        right: 24,
        top: 24,
        zIndex: 100002,
        width: 'min(420px, calc(100vw - 32px))',
        border: `1px solid ${meta.border}`,
        borderRadius: 22,
        background: meta.bg,
        color: ORDER_DETAIL_THEME.cardText,
        boxShadow: '0 24px 70px rgba(15, 23, 42, 0.25)',
        overflow: 'hidden',
        backdropFilter: 'blur(14px)',
      }}
      role="status"
      aria-live="polite"
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 13,
          padding: 16,
        }}
      >
        <div
          style={{
            minWidth: 40,
            height: 40,
            borderRadius: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(255,255,255,0.72)',
            color: meta.color,
            border: `1px solid ${meta.border}`,
            fontSize: 12,
            fontWeight: 950,
            textTransform: 'uppercase',
          }}
        >
          {meta.label}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              margin: 0,
              color: ORDER_DETAIL_THEME.cardText,
              fontSize: 14,
              fontWeight: 950,
              lineHeight: 1.2,
            }}
          >
            {toast?.title || 'Notificación'}
          </div>

          {toast?.message ? (
            <div
              style={{
                marginTop: 5,
                color: ORDER_DETAIL_THEME.mutedText,
                fontSize: 12,
                fontWeight: 700,
                lineHeight: 1.45,
              }}
            >
              {toast.message}
            </div>
          ) : null}

          {toast?.actionLabel && typeof toast?.onAction === 'function' ? (
            <button
              type="button"
              onClick={toast.onAction}
              style={{
                marginTop: 12,
                border: 'none',
                borderRadius: 999,
                background: meta.color,
                color: '#fff',
                padding: '9px 13px',
                fontSize: 11,
                fontWeight: 950,
                cursor: 'pointer',
                boxShadow: '0 12px 30px rgba(15, 23, 42, 0.16)',
              }}
            >
              {toast.actionLabel}
            </button>
          ) : null}
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar notificación"
          style={{
            width: 32,
            height: 32,
            borderRadius: 12,
            border: `1px solid ${meta.border}`,
            background: 'rgba(255,255,255,0.72)',
            color: ORDER_DETAIL_THEME.cardText,
            cursor: 'pointer',
            fontSize: 18,
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
}
