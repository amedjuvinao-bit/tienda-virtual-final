// frontend/src/admin/orders/components/OrderDetailModal.jsx

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../../../lib/api';
import { ORDER_DETAIL_THEME } from './orderDetail/orderDetailTheme';
import OrderDetailProfessionalView from './orderDetail/OrderDetailProfessionalView';

export default function OrderDetailModal({
  open,
  onClose,
  order,
  onSaveStatus,
  onSaveTags,
  onTogglePrinted,
  onToggleArchived,
  savingId,
}) {
  const [statusLocal, setStatusLocal] = useState(order?.status || 'pending');
  const [tagsStr, setTagsStr] = useState((order?.tags || []).join(', '));
  const [savingTags, setSavingTags] = useState(false);

  const [timeline, setTimeline] = useState([]);
  const [notes, setNotes] = useState([]);
  const [noteText, setNoteText] = useState('');
  const [loadingAux, setLoadingAux] = useState(false);

  const [emailMenuOpen, setEmailMenuOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const emailBtnRef = useRef(null);

  const printed = !!order?.printed;
  const archived = !!order?.archived;
  const disabled = savingId === order?._id;

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
    setToast(null);
  }, [open, order]);

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
    if (!open) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

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
      setTimeline(Array.isArray(data?.data) ? data.data : []);
    } catch {
      setTimeline([]);
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

  useEffect(() => {
    if (!open || !order?._id) return;

    fetchTimeline();
    fetchNotes();
  }, [open, order?._id]);

  const addNote = async () => {
    const text = String(noteText || '').trim();

    if (!text || !order?._id) return;

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
    if (!order?._id) return;

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
      console.error('email error', error);
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

  const openPdf = async () => {
    if (!order?._id) return;

    try {
      setLoadingAux(true);

      const response = await api.get(`/api/orders/${order._id}/pdf`, {
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
    } catch (error) {
      console.error('PDF error', error);
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
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
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

      <div className="relative z-[100000]">
        <OrderDetailProfessionalView
          order={order}
          onClose={onClose}
          onDownloadPdf={openPdf}
          onOpenInvoice={openElectronicInvoice}
          downloadingPdf={loadingAux}
          invoiceLoading={false}
          timeline={timeline}
          notes={normalizedNotes}
          tags={order?.tags || []}
          noteText={noteText}
          setNoteText={setNoteText}
          onSaveNote={addNote}
          savingNote={loadingAux}
          statusLocal={statusLocal}
          setStatusLocal={setStatusLocal}
          onSaveStatus={onSaveStatus}
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
          onSendEmail={sendEmail}
          loadingAux={loadingAux}
          onRefreshTimeline={fetchTimeline}
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
