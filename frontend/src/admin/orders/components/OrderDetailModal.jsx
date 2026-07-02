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
  const emailBtnRef = useRef(null);

  const printed = !!order?.printed;
  const archived = !!order?.archived;
  const disabled = savingId === order?._id;

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
  }, [open, order]);

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
      await fetchNotes();
      await fetchTimeline();
    } catch {
      alert('No se pudo crear la nota.');
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

      if (preview && typeof preview === 'string') {
        const openPreview = confirm(
          'Email generado en modo prueba. ¿Abrir vista previa?'
        );

        if (openPreview) {
          window.open(preview, '_blank', 'noopener,noreferrer');
        }
      } else {
        alert('Email enviado.');
      }

      await fetchTimeline();
    } catch (error) {
      console.error('email error', error);
      alert('No se pudo enviar el email.');
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
      alert('No se pudo generar o abrir el PDF.');
    } finally {
      setLoadingAux(false);
    }
  };

  const openElectronicInvoice = () => {
    if (!electronicInvoiceUrl) {
      alert('Esta orden aún no tiene enlace de factura electrónica.');
      return;
    }

    window.open(electronicInvoiceUrl, '_blank', 'noopener,noreferrer');
  };

  const saveTags = async (orderId, tags) => {
    if (!onSaveTags) return;

    try {
      setSavingTags(true);
      await onSaveTags(orderId, tags);
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