import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '../../../../../lib/api';

export function getWhatsAppAvailability(order = {}) {
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

export default function useOrderCustomerNotifications({
  open,
  order,
  canSendEmail = false,
  onSaveStatus,
  fetchTimeline,
  showToast,
  clearToast,
}) {
  const normalizedOrderId = String(order?._id || '');
  const orderIdRef = useRef(normalizedOrderId);
  const openRef = useRef(open);
  const previewRequestRef = useRef(0);
  const emailBtnRef = useRef(null);
  const [emailMenuOpen, setEmailMenuOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [loading, setLoading] = useState(false);

  orderIdRef.current = normalizedOrderId;
  openRef.current = open;

  const availability = useMemo(() => getWhatsAppAvailability(order), [order]);

  useEffect(() => {
    previewRequestRef.current += 1;
    setEmailMenuOpen(false);
    setPreviewOpen(false);
    setPreview(null);
    setPreviewError('');
    setPreviewLoading(false);
    setLoading(false);
  }, [normalizedOrderId, open]);

  useEffect(() => {
    if (!emailMenuOpen) return undefined;

    const handleDocumentClick = (event) => {
      const button = emailBtnRef.current;
      if (button && !button.contains(event.target)) setEmailMenuOpen(false);
    };

    document.addEventListener('click', handleDocumentClick, true);
    return () => document.removeEventListener('click', handleDocumentClick, true);
  }, [emailMenuOpen]);

  const prepareWhatsAppPreview = useCallback(async () => {
    const targetOrderId = orderIdRef.current;
    if (!canSendEmail || !targetOrderId || !openRef.current) return;

    const requestId = ++previewRequestRef.current;
    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewError('');
    setPreview(null);
    clearToast();

    try {
      const { data } = await api.get(
        `/api/orders/${targetOrderId}/customer-notifications/whatsapp/preview`
      );
      if (
        requestId !== previewRequestRef.current ||
        orderIdRef.current !== targetOrderId ||
        !openRef.current
      ) return;
      setPreview(data?.preview || null);
      if (!data?.preview) {
        setPreviewError('El servidor no devolvió una vista previa válida.');
      }
    } catch (error) {
      if (
        requestId === previewRequestRef.current &&
        orderIdRef.current === targetOrderId &&
        openRef.current
      ) {
        setPreviewError(
          error?.response?.data?.message ||
            'No fue posible preparar el informe de WhatsApp.'
        );
      }
    } finally {
      if (
        requestId === previewRequestRef.current &&
        orderIdRef.current === targetOrderId &&
        openRef.current
      ) {
        setPreviewLoading(false);
      }
    }
  }, [canSendEmail, clearToast]);

  const sendEmail = useCallback(async (action) => {
    const targetOrderId = orderIdRef.current;
    if (!canSendEmail || !targetOrderId || !openRef.current) return;

    try {
      setLoading(true);
      const { data } = await api.post(`/api/orders/${targetOrderId}/email`, { action });
      if (orderIdRef.current !== targetOrderId || !openRef.current) return;
      setEmailMenuOpen(false);

      const generatedPreview = data?.previewUrl || data?.preview || null;
      const to = data?.to || order?.customer?.emailOrPhone || order?.customer?.email || 'cliente';

      if (generatedPreview && typeof generatedPreview === 'string') {
        showToast({
          type: 'info',
          title: 'Vista previa de correo lista',
          message: 'El correo fue generado en modo prueba. Puedes abrir la vista previa sin salir del panel.',
          actionLabel: 'Abrir vista previa',
          persist: true,
          onAction: () => {
            window.open(generatedPreview, '_blank', 'noopener,noreferrer');
            clearToast();
          },
        });
      } else {
        showToast({
          type: 'success',
          title: 'Correo enviado',
          message: data?.message || `Correo enviado correctamente a ${to}.`,
        });
      }

      await fetchTimeline(targetOrderId);
    } catch (error) {
      if (orderIdRef.current !== targetOrderId || !openRef.current) return;
      setEmailMenuOpen(false);
      showToast({
        type: 'error',
        title: 'No se pudo enviar el correo',
        message:
          error?.response?.data?.message ||
          error?.response?.data?.error ||
          error?.message ||
          'No se pudo enviar el email.',
        persist: true,
      });
    } finally {
      if (orderIdRef.current === targetOrderId && openRef.current) setLoading(false);
    }
  }, [canSendEmail, clearToast, fetchTimeline, order, showToast]);

  const registerWhatsAppOpened = useCallback(() => {
    const targetOrderId = orderIdRef.current;
    if (!targetOrderId || !preview?.whatsappUrl) return;

    const sourceEventId = preview.sourceEventId || '';
    setPreviewOpen(false);
    showToast({
      type: 'success',
      title: 'WhatsApp abierto',
      message: 'El informe quedó preparado. Confirma el envío dentro de WhatsApp.',
    });

    api
      .post(
        `/api/orders/${targetOrderId}/customer-notifications/whatsapp/opened`,
        { sourceEventId }
      )
      .then(() => {
        if (orderIdRef.current === targetOrderId && openRef.current) {
          return fetchTimeline(targetOrderId);
        }
        return null;
      })
      .catch((error) => {
        if (orderIdRef.current !== targetOrderId || !openRef.current) return;
        showToast({
          type: 'warning',
          title: 'WhatsApp abierto sin registro',
          message:
            error?.response?.data?.message ||
            'El chat se abrió, pero no se pudo registrar la acción en la trazabilidad.',
          persist: true,
        });
      });
  }, [fetchTimeline, preview, showToast]);

  const saveStatusAndOfferWhatsApp = useCallback(async (orderId, nextStatus) => {
    if (!onSaveStatus) return null;
    const targetOrderId = String(orderId || orderIdRef.current || '');
    const previousStatus = String(order?.status || '').toLowerCase();
    const response = await onSaveStatus(orderId, nextStatus);
    if (orderIdRef.current !== targetOrderId || !openRef.current) return response;

    const changed =
      response?.data?.changed !== false &&
      previousStatus !== String(nextStatus || '').toLowerCase();

    if (changed && canSendEmail) {
      showToast({
        type: 'success',
        title: 'Etapa confirmada',
        message: availability.available
          ? 'El cambio quedó guardado. Puedes informar ahora al cliente.'
          : `El cambio quedó guardado. ${availability.reason}`,
        actionLabel: availability.available ? 'Informar por WhatsApp' : '',
        onAction: availability.available ? prepareWhatsAppPreview : null,
        persist: true,
      });
    }

    return response;
  }, [availability, canSendEmail, onSaveStatus, order?.status, prepareWhatsAppPreview, showToast]);

  const offerWhatsAppAfterStage = useCallback(({ label = 'Etapa confirmada' } = {}) => {
    showToast({
      type: 'success',
      title: label,
      message: availability.available
        ? 'La trazabilidad quedó actualizada. Puedes informar ahora al cliente.'
        : `La trazabilidad quedó actualizada. ${availability.reason}`,
      actionLabel: availability.available ? 'Informar por WhatsApp' : '',
      onAction: availability.available ? prepareWhatsAppPreview : null,
      persist: true,
    });
  }, [availability, prepareWhatsAppPreview, showToast]);

  return {
    loading,
    emailMenuOpen,
    setEmailMenuOpen,
    emailBtnRef,
    sendEmail,
    availability,
    previewOpen,
    setPreviewOpen,
    preview,
    previewLoading,
    previewError,
    prepareWhatsAppPreview,
    registerWhatsAppOpened,
    saveStatusAndOfferWhatsApp,
    offerWhatsAppAfterStage,
  };
}
