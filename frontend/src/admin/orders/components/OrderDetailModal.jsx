// frontend/src/admin/orders/components/OrderDetailModal.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../../../lib/api';
import ElectronicInvoiceBox from '../electronicInvoice/ElectronicInvoiceBox';

const THEME = {
  primary: 'var(--admin-primary)',
  primaryHover: 'var(--admin-primary-hover)',
  primaryText: 'var(--admin-primary-text)',
  primarySoftBg: 'var(--admin-primary-soft-bg)',
  primarySoftText: 'var(--admin-primary-soft-text)',
  primarySoftBorder: 'var(--admin-primary-soft-border)',

  cardBg: 'var(--admin-card-bg)',
  cardText: 'var(--admin-card-text)',
  cardMutedText: 'var(--admin-card-muted-text)',
  cardBorder: 'var(--admin-card-border)',

  modalBg: 'var(--admin-modal-bg)',
  modalText: 'var(--admin-modal-text)',
  modalMutedText: 'var(--admin-modal-muted-text)',
  modalOverlay: 'var(--admin-modal-overlay)',

  inputBg: 'var(--admin-input-bg)',
  inputText: 'var(--admin-input-text)',
  inputBorder: 'var(--admin-input-border)',
  inputPlaceholder: 'var(--admin-input-placeholder)',
  inputFocus: 'var(--admin-input-focus)',

  tableHeadBg: 'var(--admin-table-head-bg)',
  tableHeadText: 'var(--admin-table-head-text)',
  tableBorder: 'var(--admin-table-border)',
  tableText: 'var(--admin-table-text)',
  tableMutedText: 'var(--admin-table-muted-text)',
  tableRowHover: 'var(--admin-table-row-hover)',

  buttonBg: 'var(--admin-button-bg)',
  buttonHover: 'var(--admin-button-hover)',
  buttonText: 'var(--admin-button-text)',
  buttonSoftBg: 'var(--admin-button-soft-bg)',
  buttonSoftText: 'var(--admin-button-soft-text)',
  buttonSoftBorder: 'var(--admin-button-soft-border)',

  glassBg: 'var(--admin-glass-bg)',
  glassStrongBg: 'var(--admin-glass-strong-bg)',
  glassSoftBg: 'var(--admin-glass-soft-bg)',
  glassBorder: 'var(--admin-glass-border)',
  glassShadow: 'var(--admin-glass-shadow)',
  glassShadowHover: 'var(--admin-glass-shadow-hover)',

  danger: 'var(--admin-danger)',
  dangerSoftBg: 'var(--admin-danger-soft-bg)',
  dangerText: 'var(--admin-danger-text)',
  warning: 'var(--admin-warning)',
  warningSoftBg: 'var(--admin-warning-soft-bg)',
  warningText: 'var(--admin-warning-text)',
};

const MODAL_FIELD_STYLE = {
  borderColor: THEME.inputBorder,
  backgroundColor: THEME.inputBg,
  color: THEME.inputText,
};

const SOFT_CARD_STYLE = {
  borderColor: THEME.glassBorder,
  background: THEME.glassSoftBg,
  color: THEME.cardText,
};

const PANEL_STYLE = {
  borderColor: THEME.cardBorder,
  backgroundColor: THEME.cardBg,
  color: THEME.cardText,
};

const PRIMARY_BUTTON_STYLE = {
  background: `linear-gradient(135deg, ${THEME.primary}, ${THEME.primaryHover})`,
  color: THEME.primaryText,
  borderColor: 'color-mix(in srgb, var(--admin-primary) 70%, transparent)',
};

const SOFT_BUTTON_STYLE = {
  backgroundColor: THEME.buttonSoftBg,
  color: THEME.buttonSoftText,
  borderColor: THEME.buttonSoftBorder,
};

const OPTION_STYLE = {
  backgroundColor: THEME.inputBg,
  color: THEME.inputText,
};

const toCOP = (n) =>
  Number(n || 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP' });

const fmtDate = (d) => {
  try {
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return '—';
    return dt.toLocaleString('es-CO', {
      year: '2-digit',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
};

function statusMeta(status) {
  const s = String(status || '').toLowerCase();

  if (s === 'paid') {
    return {
      label: 'Pagado',
      bg: 'color-mix(in srgb, #22c55e 16%, var(--admin-card-bg))',
      color: '#15803d',
      border: 'color-mix(in srgb, #22c55e 35%, transparent)',
    };
  }
  if (s === 'processing') {
    return {
      label: 'Procesando',
      bg: 'color-mix(in srgb, var(--admin-warning) 16%, var(--admin-card-bg))',
      color: THEME.warningText,
      border: 'color-mix(in srgb, var(--admin-warning) 35%, transparent)',
    };
  }
  if (s === 'shipped') {
    return {
      label: 'Enviado',
      bg: 'color-mix(in srgb, #3b82f6 15%, var(--admin-card-bg))',
      color: '#1d4ed8',
      border: 'color-mix(in srgb, #3b82f6 35%, transparent)',
    };
  }
  if (s === 'failed') {
    return {
      label: 'Fallido',
      bg: THEME.dangerSoftBg,
      color: THEME.dangerText,
      border: 'color-mix(in srgb, var(--admin-danger) 35%, transparent)',
    };
  }
  if (s === 'cancelled' || s === 'canceled') {
    return {
      label: 'Cancelado',
      bg: THEME.dangerSoftBg,
      color: THEME.dangerText,
      border: 'color-mix(in srgb, var(--admin-danger) 35%, transparent)',
    };
  }
  if (s === 'refunded') {
    return {
      label: 'Reembolsado',
      bg: 'color-mix(in srgb, #8b5cf6 15%, var(--admin-card-bg))',
      color: '#7c3aed',
      border: 'color-mix(in srgb, #8b5cf6 35%, transparent)',
    };
  }

  return {
    label: status || 'Pendiente',
    bg: THEME.primarySoftBg,
    color: THEME.primarySoftText,
    border: THEME.primarySoftBorder,
  };
}

const STATUS_OPTIONS = [
  { code: 'pending', label: 'Pendiente' },
  { code: 'processing', label: 'Procesando' },
  { code: 'paid', label: 'Pagado' },
  { code: 'failed', label: 'Fallido / Rechazado' },
  { code: 'shipped', label: 'Enviado' },
  { code: 'cancelled', label: 'Cancelado' },
  { code: 'refunded', label: 'Reembolsado' },
];

const normalizeTag = (t) => String(t || '').toLowerCase().trim().replace(/\s+/g, ' ');

function isTagsUpdate(ev) {
  const t = String(ev?.type || '').toLowerCase();
  const msg = String(ev?.message || '');
  const hasArrays = Array.isArray(ev?.meta?.after) || Array.isArray(ev?.meta?.before);
  const saysTags = /^tags\b/i.test(msg) || /tags/i.test(msg);
  return t === 'tags_updated' || (t === 'note_updated' && (hasArrays || saysTags));
}

function uiForEvent(ev = {}) {
  const t = String(ev?.type || '').toLowerCase();

  if (isTagsUpdate(ev)) return { icon: '🏷️', label: 'Tags', tone: 'primary' };
  if (t === 'status_changed') return { icon: '🔄', label: 'Estado', tone: 'blue' };
  if (t === 'note_created') return { icon: '📝', label: 'Nota', tone: 'green' };
  if (t === 'note_updated') return { icon: '✏️', label: 'Nota editada', tone: 'warning' };
  if (t === 'note_deleted') return { icon: '🗑️', label: 'Nota eliminada', tone: 'danger' };
  if (t === 'email_sent') return { icon: '✉️', label: 'Email', tone: 'violet' };
  return { icon: '⚙️', label: 'Sistema', tone: 'neutral' };
}

function titleForEvent(ev) {
  const t = String(ev?.type || '').toLowerCase();

  if (isTagsUpdate(ev)) {
    const after =
      Array.isArray(ev?.meta?.after) ? ev.meta.after.join(', ') :
      (ev?.message && ev.message.replace(/^Tags(?:\s+\w+)?:\s*/i, '')) ||
      '—';
    return `Tags: ${after || '—'}`;
  }

  if (t === 'status_changed') {
    const from = ev?.meta?.from || '—';
    const to = ev?.meta?.to || '—';
    return `Estado: ${from} → ${to}`;
  }
  if (t === 'note_created') return 'Nota creada';
  if (t === 'note_updated') return 'Nota actualizada';
  if (t === 'note_deleted') return 'Nota eliminada';
  if (t === 'email_sent') {
    return ev?.meta?.template ? `Correo: ${ev.meta.template}` : 'Correo enviado';
  }
  return ev?.message || 'Evento';
}

function Icon({ name, className = 'h-4 w-4' }) {
  const common = {
    width: '1em',
    height: '1em',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '1.8',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    className,
  };

  if (name === 'pdf') {
    return (
      <svg {...common}>
        <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
        <path d="M14 2v5h5" />
        <path d="M8 15h1.5a1.5 1.5 0 0 0 0-3H8v6" />
        <path d="M13 12v6" />
        <path d="M13 12h1a2 2 0 0 1 0 4h-1" />
      </svg>
    );
  }

  if (name === 'invoice') {
    return (
      <svg {...common}>
        <path d="M7 3h10a2 2 0 0 1 2 2v16l-3-2-3 2-3-2-3 2V5a2 2 0 0 1 2-2z" />
        <path d="M9 8h6" />
        <path d="M9 12h6" />
        <path d="M9 16h4" />
      </svg>
    );
  }

  if (name === 'close') {
    return (
      <svg {...common}>
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
      </svg>
    );
  }

  if (name === 'mail') {
    return (
      <svg {...common}>
        <path d="M4 6h16v12H4z" />
        <path d="m4 7 8 6 8-6" />
      </svg>
    );
  }

  if (name === 'printer') {
    return (
      <svg {...common}>
        <path d="M7 8V4h10v4" />
        <path d="M7 17H5a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2" />
        <path d="M7 14h10v7H7z" />
      </svg>
    );
  }

  if (name === 'archive') {
    return (
      <svg {...common}>
        <path d="M3 7h18" />
        <path d="M5 7v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7" />
        <path d="M8 3h8l2 4H6z" />
        <path d="M10 12h4" />
      </svg>
    );
  }

  if (name === 'user') {
    return (
      <svg {...common}>
        <path d="M20 21a8 8 0 0 0-16 0" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    );
  }

  if (name === 'billing') {
    return (
      <svg {...common}>
        <path d="M9 3h6l2 2h2a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h2z" />
        <path d="M9 12h6" />
        <path d="M9 16h4" />
      </svg>
    );
  }

  if (name === 'cart') {
    return (
      <svg {...common}>
        <path d="M6 6h15l-1.5 8h-12z" />
        <path d="M6 6 5 3H2" />
        <circle cx="9" cy="20" r="1" />
        <circle cx="18" cy="20" r="1" />
      </svg>
    );
  }

  if (name === 'note') {
    return (
      <svg {...common}>
        <path d="M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
        <path d="M8 8h8" />
        <path d="M8 12h8" />
        <path d="M8 16h5" />
      </svg>
    );
  }

  if (name === 'clock') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    );
  }

  if (name === 'eye') {
    return (
      <svg {...common}>
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }

  if (name === 'chevron') {
    return (
      <svg {...common}>
        <path d="m9 18 6-6-6-6" />
      </svg>
    );
  }

  if (name === 'copy') {
    return (
      <svg {...common}>
        <rect x="9" y="9" width="11" height="11" rx="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </svg>
    );
  }

  if (name === 'wallet') {
    return (
      <svg {...common}>
        <path d="M4 7h15a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h13" />
        <path d="M16 13h5" />
      </svg>
    );
  }

  if (name === 'truck') {
    return (
      <svg {...common}>
        <path d="M3 7h11v10H3z" />
        <path d="M14 11h4l3 3v3h-7" />
        <circle cx="7" cy="19" r="2" />
        <circle cx="17" cy="19" r="2" />
      </svg>
    );
  }

  if (name === 'tag') {
    return (
      <svg {...common}>
        <path d="M20 12 12 20 4 12V4h8z" />
        <circle cx="8.5" cy="8.5" r="1.5" />
      </svg>
    );
  }

  return null;
}

function SectionTitle({ icon, title, subtitle }) {
  return (
    <div className="order-detail-section-title">
      <span className="order-detail-section-icon">
        <Icon name={icon} className="h-4 w-4" />
      </span>
      <div>
        <h3>{title}</h3>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
    </div>
  );
}

function InfoLine({ label, value, span = false }) {
  return (
    <div className={span ? 'order-detail-info-line md:col-span-2' : 'order-detail-info-line'}>
      <span>{label}</span>
      <strong>{value || '—'}</strong>
    </div>
  );
}

function SummaryMetric({ icon, label, value, strong = false }) {
  return (
    <div className={strong ? 'order-detail-summary-metric order-detail-summary-metric-strong' : 'order-detail-summary-metric'}>
      <span className="order-detail-summary-icon">
        <Icon name={icon} className="h-4 w-4" />
      </span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

export default function OrderDetailModal({
  open,
  onClose,
  order,
  onSaveStatus,
  onSaveTags,
  onTogglePrinted,
  onToggleArchived,
  savingId,
  populated,
}) {
  const cust = order?.customer || {};
  const bill = order?.billing || {};
  const items = Array.isArray(order?.items) ? order.items : [];

  const shipping = Number(order?.shipping || 0);
  const subtotal = Number(order?.subtotal ?? order?.summary?.subtotal ?? 0);
  const discounts = Number(order?.discounts ?? order?.summary?.discounts ?? 0);
  const total = Number(order?.total ?? subtotal + shipping - discounts);
  const iva = order?.taxes?.iva || {};

  const ivaPercent = Number(iva.percent || 0);
  const taxAmount = Number(iva.amount || 0);
  const ivaName = iva.name || 'IVA';

  const [statusLocal, setStatusLocal] = useState(order?.status || 'pending');
  const [tagsStr, setTagsStr] = useState((order?.tags || []).join(', '));
  const [savingTags, setSavingTags] = useState(false);

  const printed = !!order?.printed;
  const archived = !!order?.archived;
  const factusLinks = order?.factusLinks || {};
  const electronicInvoiceUrl =
    factusLinks?.pdfUrl ||
    factusLinks?.publicUrl ||
    order?.electronicInvoice?.provider?.links?.public_url ||
    '';

  const hasElectronicInvoice = !!electronicInvoiceUrl;
  const badge = useMemo(() => statusMeta(order?.status), [order?.status]);

  const [emailMenuOpen, setEmailMenuOpen] = useState(false);
  const emailBtnRef = useRef(null);

  useEffect(() => {
    if (open) {
      setStatusLocal(order?.status || 'pending');
      setTagsStr((Array.isArray(order?.tags) ? order.tags : []).join(', '));
    }
  }, [open, order]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev || ''; };
  }, [open]);

  useEffect(() => {
    if (!emailMenuOpen) return;
    const onDocClick = (e) => {
      const btn = emailBtnRef.current;
      if (btn && !btn.contains(e.target)) setEmailMenuOpen(false);
    };
    document.addEventListener('click', onDocClick, true);
    return () => document.removeEventListener('click', onDocClick, true);
  }, [emailMenuOpen]);

  const [timeline, setTimeline] = useState([]);
  const [notes, setNotes] = useState([]);
  const [noteText, setNoteText] = useState('');
  const [loadingAux, setLoadingAux] = useState(false);

  const fetchTimeline = async () => {
    if (!order?._id) return;
    try {
      const { data } = await api.get(`/api/orders/${order._id}/timeline`);
      setTimeline(Array.isArray(data?.data) ? data.data : []);
    } catch {}
  };

  const fetchNotes = async () => {
    if (!order?._id) return;
    try {
      const { data } = await api.get(`/api/orders/${order._id}/notes`);
      setNotes(Array.isArray(data?.data) ? data.data : []);
    } catch {}
  };

  useEffect(() => {
    if (open && order?._id) {
      fetchTimeline();
      fetchNotes();
    }
  }, [open, order?._id]);

  const addNote = async () => {
    const text = String(noteText || '').trim();
    if (!text) return;
    try {
      setLoadingAux(true);
      await api.post(`/api/orders/${order._id}/notes`, { text });
      setNoteText('');
      await fetchNotes();
      await fetchTimeline();
    } catch {
      alert('No se pudo crear la nota');
    } finally {
      setLoadingAux(false);
    }
  };

  const togglePin = async (note) => {
    try {
      setLoadingAux(true);
      await api.patch(`/api/orders/${order._id}/notes/${note._id}`, { pinned: !note.pinned });
      await fetchNotes();
    } catch {} finally { setLoadingAux(false); }
  };

  const deleteNote = async (note) => {
    if (!confirm('¿Eliminar esta nota?')) return;
    try {
      setLoadingAux(true);
      await api.delete(`/api/orders/${order._id}/notes/${note._id}`);
      await fetchNotes();
      await fetchTimeline();
    } catch {} finally { setLoadingAux(false); }
  };

  const sendEmail = async (action) => {
    if (!order?._id) return;
    try {
      setLoadingAux(true);
      const { data } = await api.post(`/api/orders/${order._id}/email`, { action });
      setEmailMenuOpen(false);

      const preview = data?.previewUrl || data?.preview || null;
      if (preview && typeof preview === 'string') {
        const ok = confirm('Email generado en modo prueba (Ethereal). ¿Abrir vista previa?');
        if (ok) window.open(preview, '_blank', 'noopener,noreferrer');
      } else {
        alert('Email enviado.');
      }
      await fetchTimeline();
    } catch (e) {
      console.error('email error', e);
      alert('No se pudo enviar el email.');
    } finally {
      setLoadingAux(false);
    }
  };

  const openPdf = async () => {
    if (!order?._id) return;
    try {
      setLoadingAux(true);
      const resp = await api.get(`/api/orders/${order._id}/pdf`, { responseType: 'blob' });
      const blob = new Blob([resp.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      console.error('PDF error', e);
      alert('No se pudo generar/abrir el PDF.');
    } finally {
      setLoadingAux(false);
    }
  };

  if (!open) return null;

  const disabled = savingId === order?._id;
  const customerName = [cust.name, cust.lastname].filter(Boolean).join(' ') || '—';
  const billingName = [bill.name, bill.lastname].filter(Boolean).join(' ') || '—';

  return createPortal(
    <div
      className="fixed left-0 top-0 z-[99999] flex h-screen w-screen items-center justify-center p-3 md:p-5"
      aria-modal="true"
      role="dialog"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <style>{`
        .order-detail-modal-shell,
        .order-detail-modal-shell * {
          box-sizing: border-box;
        }

        .order-detail-modal-shell {
          --od-radius-lg: calc(var(--admin-radius, 18px) + 6px);
          --od-radius-md: var(--admin-radius, 18px);
          --od-radius-sm: 14px;
          --od-border: var(--admin-card-border);
          --od-line: color-mix(in srgb, var(--admin-card-border) 72%, transparent);
          --od-soft-line: color-mix(in srgb, var(--admin-card-border) 50%, transparent);
          --od-card-bg: color-mix(in srgb, var(--admin-card-bg) 88%, transparent);
          --od-card-soft-bg: color-mix(in srgb, var(--admin-primary-soft-bg) 35%, var(--admin-card-bg));
          --od-field-bg: color-mix(in srgb, var(--admin-input-bg) 92%, transparent);
          --od-shadow-soft: 0 22px 72px rgba(15, 23, 42, 0.16), 0 14px 36px color-mix(in srgb, var(--admin-primary) 15%, transparent);
          color: var(--admin-card-text);
        }

        .order-detail-modal-panel {
          width: min(100%, 1180px);
          max-height: 92vh;
          overflow: hidden;
          border: 1px solid var(--admin-glass-border);
          border-radius: var(--od-radius-lg);
          background:
            radial-gradient(circle at 12% 0%, color-mix(in srgb, var(--admin-primary) 13%, transparent), transparent 34%),
            radial-gradient(circle at 95% 8%, color-mix(in srgb, var(--admin-primary) 9%, transparent), transparent 28%),
            var(--admin-card-bg);
          box-shadow: var(--admin-glass-shadow);
          backdrop-filter: blur(var(--admin-glass-blur, 24px)) saturate(var(--admin-glass-saturation, 1.5));
        }

        .order-detail-header {
          position: sticky;
          top: 0;
          z-index: 20;
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 18px 22px;
          border-bottom: 1px solid var(--od-line);
          background:
            linear-gradient(135deg, color-mix(in srgb, var(--admin-card-bg) 88%, transparent), color-mix(in srgb, var(--admin-primary-soft-bg) 24%, transparent));
          backdrop-filter: blur(22px) saturate(1.45);
        }

        .order-detail-status-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 34px;
          padding: 8px 12px;
          border: 1px solid transparent;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: -0.01em;
          white-space: nowrap;
        }

        .order-detail-title-wrap {
          min-width: 0;
          flex: 1;
        }

        .order-detail-title-wrap h2 {
          margin: 0;
          color: var(--admin-card-text);
          font-size: clamp(18px, 2vw, 22px);
          font-weight: 850;
          letter-spacing: -0.035em;
          line-height: 1.1;
        }

        .order-detail-title-wrap p {
          margin: 4px 0 0;
          color: var(--admin-card-muted-text);
          font-size: 12px;
          font-weight: 600;
        }

        .order-detail-header-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .order-detail-body {
          max-height: calc(92vh - 82px);
          overflow-y: auto;
          padding: 18px 22px 20px;
        }

        .order-detail-body::-webkit-scrollbar {
          width: 10px;
        }

        .order-detail-body::-webkit-scrollbar-thumb {
          border-radius: 999px;
          background: color-mix(in srgb, var(--admin-primary) 35%, transparent);
          border: 3px solid transparent;
          background-clip: content-box;
        }

        .order-detail-toolbar {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: 16px;
          margin-bottom: 16px;
          padding: 16px;
          border: 1px solid var(--od-line);
          border-radius: var(--od-radius-md);
          background: var(--admin-glass-soft-bg);
        }

        .order-detail-control-group {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .order-detail-control-group label,
        .order-detail-control-group > span {
          color: var(--admin-card-muted-text);
          font-size: 12px;
          font-weight: 750;
        }

        .order-detail-input,
        .order-detail-select {
          min-height: 42px;
          border: 1px solid var(--admin-input-border);
          border-radius: 13px;
          background: var(--od-field-bg);
          color: var(--admin-input-text);
          padding: 0 14px;
          font-size: 13px;
          font-weight: 650;
          outline: none;
          transition: border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease;
        }

        .order-detail-input::placeholder {
          color: var(--admin-input-placeholder);
          font-weight: 600;
        }

        .order-detail-input:focus,
        .order-detail-select:focus {
          border-color: var(--admin-input-focus);
          box-shadow: 0 0 0 4px color-mix(in srgb, var(--admin-primary) 14%, transparent);
        }

        .order-detail-select {
          width: 170px;
        }

        .order-detail-tags-input {
          width: min(100%, 360px);
          flex: 1;
        }

        .order-detail-btn {
          min-height: 42px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border: 1px solid transparent;
          border-radius: 13px;
          padding: 0 15px;
          font-size: 13px;
          font-weight: 800;
          white-space: nowrap;
          transition: transform 180ms ease, box-shadow 180ms ease, background-color 180ms ease, border-color 180ms ease;
        }

        .order-detail-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 12px 28px color-mix(in srgb, var(--admin-primary) 18%, transparent);
        }

        .order-detail-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .order-detail-btn-primary {
          background: linear-gradient(135deg, var(--admin-primary), var(--admin-primary-hover));
          color: var(--admin-primary-text);
          border-color: color-mix(in srgb, var(--admin-primary) 70%, transparent);
        }

        .order-detail-btn-soft {
          background: color-mix(in srgb, var(--admin-button-soft-bg) 80%, var(--admin-card-bg));
          color: var(--admin-button-soft-text);
          border-color: var(--admin-button-soft-border);
        }

        .order-detail-btn-ghost {
          background: color-mix(in srgb, var(--admin-card-bg) 75%, transparent);
          color: var(--admin-card-text);
          border-color: var(--od-line);
        }

        .order-detail-close-btn {
          min-width: 98px;
        }

        .order-detail-menu {
          position: absolute;
          right: 0;
          top: calc(100% + 8px);
          width: 230px;
          overflow: hidden;
          border: 1px solid var(--od-line);
          border-radius: 16px;
          background: var(--admin-card-bg);
          box-shadow: var(--od-shadow-soft);
          z-index: 40;
        }

        .order-detail-menu button {
          width: 100%;
          padding: 12px 14px;
          border: 0;
          background: transparent;
          color: var(--admin-card-text);
          text-align: left;
          font-size: 13px;
          font-weight: 700;
        }

        .order-detail-menu button:hover {
          background: var(--admin-primary-soft-bg);
          color: var(--admin-primary-soft-text);
        }

        .order-detail-tags-list {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          width: 100%;
          padding-left: 52px;
        }

        .order-detail-tag-chip {
          display: inline-flex;
          align-items: center;
          border: 1px solid var(--admin-primary-soft-border);
          border-radius: 999px;
          padding: 4px 9px;
          background: var(--admin-primary-soft-bg);
          color: var(--admin-primary-soft-text);
          font-size: 11px;
          font-weight: 800;
        }

        .order-detail-invoice-premium-scope {
          margin-bottom: 16px;
        }

        .order-detail-invoice-premium-scope > * {
          border-radius: var(--od-radius-md) !important;
          border-color: var(--od-line) !important;
          background:
            radial-gradient(circle at 0% 0%, color-mix(in srgb, var(--admin-primary) 12%, transparent), transparent 32%),
            color-mix(in srgb, var(--admin-card-bg) 92%, transparent) !important;
          box-shadow: 0 14px 34px color-mix(in srgb, var(--admin-primary) 8%, transparent) !important;
        }

        .order-detail-invoice-premium-scope button {
          min-height: 54px !important;
          border-radius: 16px !important;
          border: 1px solid var(--admin-primary) !important;
          background: color-mix(in srgb, var(--admin-card-bg) 92%, var(--admin-primary-soft-bg)) !important;
          color: var(--admin-primary) !important;
          font-size: 14px !important;
          font-weight: 850 !important;
          box-shadow: 0 14px 30px color-mix(in srgb, var(--admin-primary) 9%, transparent) !important;
          transition: transform 180ms ease, box-shadow 180ms ease, background 180ms ease !important;
        }

        .order-detail-invoice-premium-scope button:hover {
          transform: translateY(-1px) !important;
          background: var(--admin-primary-soft-bg) !important;
          box-shadow: 0 18px 40px color-mix(in srgb, var(--admin-primary) 18%, transparent) !important;
        }

        .order-detail-grid-2 {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
          margin-bottom: 16px;
        }

        .order-detail-card {
          border: 1px solid var(--od-line);
          border-radius: var(--od-radius-md);
          background: color-mix(in srgb, var(--admin-card-bg) 88%, transparent);
          box-shadow: 0 14px 34px rgba(15, 23, 42, 0.045);
          overflow: hidden;
        }

        .order-detail-card-inner {
          padding: 16px;
        }

        .order-detail-section-title {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 14px;
        }

        .order-detail-section-icon {
          width: 38px;
          height: 38px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid var(--admin-primary-soft-border);
          border-radius: 13px;
          background: color-mix(in srgb, var(--admin-primary-soft-bg) 88%, var(--admin-card-bg));
          color: var(--admin-primary);
        }

        .order-detail-section-title h3 {
          margin: 0;
          color: var(--admin-card-text);
          font-size: 15px;
          font-weight: 850;
          letter-spacing: -0.02em;
        }

        .order-detail-section-title p {
          margin: 2px 0 0;
          color: var(--admin-card-muted-text);
          font-size: 12px;
          font-weight: 600;
        }

        .order-detail-info-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px 16px;
        }

        .order-detail-info-line {
          min-width: 0;
          color: var(--admin-card-text);
          font-size: 13px;
          line-height: 1.35;
        }

        .order-detail-info-line span {
          display: inline;
          color: var(--admin-card-muted-text);
          font-weight: 650;
        }

        .order-detail-info-line strong {
          color: var(--admin-card-text);
          font-weight: 750;
          overflow-wrap: anywhere;
        }

        .order-detail-table-wrap {
          overflow: hidden;
          margin-bottom: 16px;
        }

        .order-detail-table-title {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 16px;
          border-bottom: 1px solid var(--od-line);
          background: color-mix(in srgb, var(--admin-primary-soft-bg) 35%, var(--admin-card-bg));
          color: var(--admin-card-text);
          font-size: 15px;
          font-weight: 850;
        }

        .order-detail-table-title span {
          color: var(--admin-primary);
        }

        .order-detail-table-scroller {
          max-height: 260px;
          overflow: auto;
        }

        .order-detail-table {
          min-width: 760px;
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          font-size: 13px;
        }

        .order-detail-table thead th {
          position: sticky;
          top: 0;
          z-index: 1;
          padding: 12px 14px;
          background: var(--admin-table-head-bg);
          color: var(--admin-table-head-text);
          border-bottom: 1px solid var(--admin-table-border);
          font-size: 12px;
          font-weight: 850;
          text-align: left;
        }

        .order-detail-table thead th:nth-child(3),
        .order-detail-table thead th:nth-child(4),
        .order-detail-table thead th:nth-child(5),
        .order-detail-table tbody td:nth-child(3),
        .order-detail-table tbody td:nth-child(4),
        .order-detail-table tbody td:nth-child(5) {
          text-align: right;
        }

        .order-detail-table tbody td {
          padding: 12px 14px;
          border-bottom: 1px solid var(--od-soft-line);
          color: var(--admin-table-text);
          vertical-align: middle;
        }

        .order-detail-table tbody tr:hover td {
          background: color-mix(in srgb, var(--admin-table-row-hover) 55%, transparent);
        }

        .order-detail-product-cell {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }

        .order-detail-product-cell img {
          width: 42px;
          height: 42px;
          flex: 0 0 auto;
          border: 1px solid var(--od-line);
          border-radius: 12px;
          object-fit: cover;
          background: var(--admin-primary-soft-bg);
        }

        .order-detail-product-title {
          color: var(--admin-card-text);
          font-weight: 850;
          text-decoration: none;
        }

        .order-detail-product-title:hover {
          color: var(--admin-primary);
          text-decoration: underline;
        }

        .order-detail-product-code {
          margin-top: 3px;
          color: var(--admin-table-muted-text);
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 11px;
          overflow-wrap: anywhere;
        }

        .order-detail-variant-pill {
          display: inline-flex;
          align-items: center;
          padding: 6px 10px;
          border-radius: 999px;
          background: color-mix(in srgb, var(--admin-primary-soft-bg) 55%, var(--admin-card-bg));
          color: var(--admin-card-text);
          font-weight: 800;
        }

        .order-detail-empty {
          padding: 18px;
          color: var(--admin-card-muted-text);
          font-size: 13px;
          font-weight: 650;
        }

        .order-detail-summary-strip {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 16px;
        }

        .order-detail-summary-metric {
          display: flex;
          align-items: center;
          gap: 12px;
          min-height: 70px;
          padding: 14px;
          border: 1px solid var(--od-line);
          border-radius: var(--od-radius-sm);
          background: color-mix(in srgb, var(--admin-card-bg) 88%, transparent);
        }

        .order-detail-summary-metric-strong {
          background: linear-gradient(135deg, color-mix(in srgb, var(--admin-primary) 12%, var(--admin-card-bg)), color-mix(in srgb, var(--admin-primary-soft-bg) 74%, var(--admin-card-bg)));
          border-color: var(--admin-primary-soft-border);
        }

        .order-detail-summary-icon {
          width: 36px;
          height: 36px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 auto;
          border-radius: 13px;
          background: var(--admin-primary-soft-bg);
          color: var(--admin-primary);
        }

        .order-detail-summary-metric p {
          margin: 0;
          color: var(--admin-card-muted-text);
          font-size: 12px;
          font-weight: 750;
        }

        .order-detail-summary-metric strong {
          display: block;
          margin-top: 2px;
          color: var(--admin-card-text);
          font-size: 15px;
          font-weight: 900;
        }

        .order-detail-summary-metric-strong strong,
        .order-detail-summary-metric-strong p {
          color: var(--admin-primary-soft-text);
        }

        .order-detail-textarea {
          min-height: 78px;
          width: 100%;
          resize: vertical;
          padding: 12px 14px;
          border: 1px solid var(--admin-input-border);
          border-radius: 14px;
          background: var(--od-field-bg);
          color: var(--admin-input-text);
          font-size: 13px;
          outline: none;
        }

        .order-detail-textarea::placeholder {
          color: var(--admin-input-placeholder);
        }

        .order-detail-note-form {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 10px;
          margin-bottom: 14px;
        }

        .order-detail-notes-list {
          display: grid;
          gap: 10px;
        }

        .order-detail-note-item {
          border: 1px solid var(--od-line);
          border-radius: 14px;
          padding: 12px;
          background: color-mix(in srgb, var(--admin-primary-soft-bg) 18%, var(--admin-card-bg));
        }

        .order-detail-note-meta {
          margin-bottom: 7px;
          color: var(--admin-card-muted-text);
          font-size: 11px;
          font-weight: 700;
        }

        .order-detail-note-text {
          white-space: pre-wrap;
          color: var(--admin-card-text);
          font-size: 13px;
          font-weight: 650;
        }

        .order-detail-note-actions {
          display: flex;
          gap: 8px;
          margin-top: 10px;
        }

        .order-detail-danger-btn {
          color: var(--admin-danger-text);
          border-color: color-mix(in srgb, var(--admin-danger) 26%, transparent);
          background: var(--admin-danger-soft-bg);
        }

        .order-detail-timeline-list {
          position: relative;
          display: grid;
          gap: 12px;
          padding-left: 4px;
        }

        .order-detail-timeline-list::before {
          content: '';
          position: absolute;
          left: 15px;
          top: 8px;
          bottom: 8px;
          width: 1px;
          background: var(--od-line);
        }

        .order-detail-timeline-item {
          position: relative;
          padding-left: 40px;
        }

        .order-detail-timeline-dot {
          position: absolute;
          left: 0;
          top: 3px;
          width: 31px;
          height: 31px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid var(--od-line);
          border-radius: 999px;
          background: var(--admin-card-bg);
          box-shadow: 0 6px 16px rgba(15, 23, 42, 0.08);
          font-size: 14px;
        }

        .order-detail-timeline-box {
          border: 1px solid var(--od-line);
          border-radius: 15px;
          padding: 11px 12px;
          background: color-mix(in srgb, var(--admin-card-bg) 90%, transparent);
        }

        .order-detail-timeline-meta {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          color: var(--admin-card-muted-text);
          font-size: 11px;
          font-weight: 700;
        }

        .order-detail-event-badge {
          display: inline-flex;
          align-items: center;
          padding: 3px 8px;
          border-radius: 999px;
          background: var(--admin-primary-soft-bg);
          color: var(--admin-primary-soft-text);
          font-size: 10px;
          font-weight: 850;
        }

        .order-detail-event-title {
          margin-top: 8px;
          color: var(--admin-card-text);
          font-size: 13px;
          font-weight: 850;
        }

        .order-detail-event-message {
          margin-top: 3px;
          color: var(--admin-card-muted-text);
          font-size: 12px;
          font-weight: 600;
          overflow-wrap: anywhere;
        }

        .order-detail-internal-id {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: 16px;
          padding-top: 14px;
          border-top: 1px solid var(--od-line);
          color: var(--admin-card-muted-text);
          font-size: 12px;
          font-weight: 700;
        }

        @media (max-width: 900px) {
          .order-detail-header {
            align-items: flex-start;
            flex-wrap: wrap;
          }

          .order-detail-header-actions {
            width: 100%;
            justify-content: flex-start;
          }

          .order-detail-toolbar,
          .order-detail-grid-2,
          .order-detail-summary-strip {
            grid-template-columns: 1fr;
          }

          .order-detail-info-grid {
            grid-template-columns: 1fr;
          }

          .order-detail-tags-list {
            padding-left: 0;
          }

          .order-detail-note-form {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div
        className="absolute inset-0 backdrop-blur-sm"
        style={{ background: THEME.modalOverlay }}
      />

      <div className="relative z-[100000] order-detail-modal-shell order-detail-modal-panel">
        <div className="order-detail-header">
          <span
            className="order-detail-status-badge"
            style={{ background: badge.bg, color: badge.color, borderColor: badge.border }}
          >
            {badge.label}
          </span>

          <div className="order-detail-title-wrap">
            <h2>Orden #{order?.orderNumber || '—'}</h2>
            <p>Creada el {fmtDate(order?.createdAt)}</p>
          </div>

          <div className="order-detail-header-actions">
            {printed && (
              <span className="order-detail-status-badge" style={{ background: 'var(--admin-primary-soft-bg)', color: 'var(--admin-primary-soft-text)', borderColor: 'var(--admin-primary-soft-border)' }}>
                Impresa
              </span>
            )}

            {archived && (
              <span className="order-detail-status-badge" style={{ background: 'var(--admin-button-soft-bg)', color: 'var(--admin-button-soft-text)', borderColor: 'var(--admin-button-soft-border)' }}>
                Archivada
              </span>
            )}

            <button
              type="button"
              className="order-detail-btn order-detail-btn-ghost"
              onClick={openPdf}
              title="Imprimir / Descargar PDF"
              disabled={loadingAux}
            >
              <Icon name="pdf" />
              PDF
            </button>

            {hasElectronicInvoice && (
              <button
                type="button"
                className="order-detail-btn order-detail-btn-ghost"
                onClick={() => window.open(electronicInvoiceUrl, '_blank', 'noopener,noreferrer')}
                title="Ver factura electrónica oficial"
              >
                <Icon name="invoice" />
                Factura electrónica
              </button>
            )}

            <button
              type="button"
              className="order-detail-btn order-detail-btn-ghost order-detail-close-btn"
              onClick={onClose}
            >
              <Icon name="close" />
              Cerrar
            </button>
          </div>
        </div>

        <div className="order-detail-body">
          <div className="order-detail-toolbar">
            <div className="order-detail-control-group">
              <label>Estado</label>
              <select
                className="order-detail-select"
                style={MODAL_FIELD_STYLE}
                value={statusLocal}
                onChange={(e) => setStatusLocal(e.target.value)}
                disabled={disabled}
              >
                {STATUS_OPTIONS.map((op) => (
                  <option key={op.code} value={op.code} style={OPTION_STYLE}>
                    {op.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="order-detail-btn order-detail-btn-primary"
                style={PRIMARY_BUTTON_STYLE}
                onClick={async () => { try { await onSaveStatus(order._id, statusLocal); await fetchTimeline(); } catch {} }}
                disabled={disabled}
              >
                {disabled ? 'Guardando…' : 'Guardar'}
              </button>

              <div className="relative" ref={emailBtnRef}>
                <button
                  type="button"
                  className="order-detail-btn order-detail-btn-ghost"
                  onClick={() => setEmailMenuOpen((v) => !v)}
                  title="Reenviar email"
                >
                  <Icon name="mail" />
                  Enviar email
                </button>

                {emailMenuOpen && (
                  <div className="order-detail-menu">
                    <button type="button" onClick={() => sendEmail('confirmation')}>
                      Reenviar confirmación
                    </button>
                    <button type="button" onClick={() => sendEmail('invoice')}>
                      Reenviar factura
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="order-detail-control-group">
              <label>Tags</label>
              <input
                className="order-detail-input order-detail-tags-input"
                style={MODAL_FIELD_STYLE}
                placeholder="vip, urgente..."
                value={tagsStr}
                onChange={(e) => setTagsStr(e.target.value)}
              />
              <button
                type="button"
                className="order-detail-btn order-detail-btn-primary"
                style={PRIMARY_BUTTON_STYLE}
                onClick={async () => {
                  try {
                    setSavingTags(true);
                    const parts = String(tagsStr || '')
                      .split(',')
                      .map((s) => normalizeTag(s))
                      .filter(Boolean);
                    await onSaveTags(order._id, parts);
                    await fetchTimeline();
                  } finally { setSavingTags(false); }
                }}
                disabled={savingTags}
              >
                {savingTags ? 'Guardando…' : 'Guardar tags'}
              </button>

              {Array.isArray(order?.tags) && order.tags.length > 0 && (
                <div className="order-detail-tags-list">
                  {order.tags.map((t) => (
                    <span key={t} className="order-detail-tag-chip">#{t}</span>
                  ))}
                </div>
              )}
            </div>

            <div className="order-detail-control-group">
              <span>Operación</span>
              <button
                type="button"
                className="order-detail-btn order-detail-btn-ghost"
                onClick={async () => { try { await onTogglePrinted(order._id, !printed); await fetchTimeline(); } catch {} }}
                disabled={disabled}
                title={printed ? 'Quitar impresa' : 'Marcar impresa'}
              >
                <Icon name="printer" />
                {printed ? 'Quitar impresa' : 'Marcar impresa'}
              </button>
              <button
                type="button"
                className="order-detail-btn order-detail-btn-ghost"
                onClick={async () => { try { await onToggleArchived(order._id, !archived); await fetchTimeline(); } catch {} }}
                disabled={disabled}
                title={archived ? 'Desarchivar' : 'Archivar'}
              >
                <Icon name="archive" />
                {archived ? 'Desarchivar' : 'Archivar'}
              </button>
            </div>
          </div>

          <div className="order-detail-invoice-premium-scope">
            <ElectronicInvoiceBox order={order} />
          </div>

          <div className="order-detail-grid-2">
            <div className="order-detail-card" style={SOFT_CARD_STYLE}>
              <div className="order-detail-card-inner">
                <SectionTitle icon="user" title="Cliente" />
                <div className="order-detail-info-grid">
                  <InfoLine label="Nombre:" value={customerName} />
                  <InfoLine label="Doc.:" value={cust.id} />
                  <InfoLine label="Email/Teléfono:" value={cust.emailOrPhone || cust.phone} span />
                  <InfoLine label="Dirección:" value={cust.address} span />
                  <InfoLine label="Ciudad:" value={cust.city} />
                  <InfoLine label="País/Depto:" value={[cust.country, cust.department].filter(Boolean).join(' / ')} />
                </div>
              </div>
            </div>

            <div className="order-detail-card" style={SOFT_CARD_STYLE}>
              <div className="order-detail-card-inner">
                <SectionTitle icon="billing" title="Facturación" />
                <div className="order-detail-info-grid">
                  <InfoLine label="Nombre:" value={billingName} />
                  <InfoLine label="Doc.:" value={bill.id} />
                  <InfoLine label="Dirección:" value={bill.address} span />
                  <InfoLine label="Ciudad:" value={bill.city} span />
                  <InfoLine label="País/Depto:" value={[bill.country, bill.department].filter(Boolean).join(' / ')} />
                  <InfoLine label="Tel.:" value={bill.phone} />
                </div>
              </div>
            </div>
          </div>

          <div className="order-detail-card order-detail-table-wrap" style={PANEL_STYLE}>
            <div className="order-detail-table-title">
              <span><Icon name="cart" /></span>
              Ítems {populated ? '(con detalle de producto)' : '(sin populate)'}
            </div>
            <div className="order-detail-table-scroller">
              {items.length === 0 ? (
                <div className="order-detail-empty">Sin ítems.</div>
              ) : (
                <table className="order-detail-table">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Variante</th>
                      <th>Precio</th>
                      <th>Cant.</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, i) => {
                      const p = populated ? it.product : null;
                      const title = p?.title || it.title || 'Producto';
                      const price = Number((p?.price ?? it.price) || 0);
                      const qty = Number(it.qty ?? it.quantity ?? 0);
                      const line = price * qty;
                      const varTxt = [it.color, it.size].filter(Boolean).join(' / ') || '—';
                      const image = p?.image || it.image;
                      const sku = p?.sku || p?.skun || '';
                      const slug = p?.slug;

                      return (
                        <tr key={i}>
                          <td>
                            <div className="order-detail-product-cell">
                              {image ? (
                                <img
                                  src={image}
                                  alt={title}
                                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                />
                              ) : null}
                              <div>
                                {slug ? (
                                  <a href={`/producto/${slug}`} target="_blank" rel="noreferrer" className="order-detail-product-title">
                                    {title}
                                  </a>
                                ) : (
                                  <div className="order-detail-product-title">{title}</div>
                                )}
                                <div className="order-detail-product-code">
                                  {sku ? `SKU: ${sku} · ` : ''}{String(it._id || it.productId || '')}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td><span className="order-detail-variant-pill">{varTxt}</span></td>
                          <td>{toCOP(price)}</td>
                          <td>{qty}</td>
                          <td><strong>{toCOP(line)}</strong></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="order-detail-summary-strip">
            <SummaryMetric icon="wallet" label="Subtotal" value={toCOP(subtotal)} />
            <SummaryMetric icon="truck" label="Envío" value={toCOP(shipping)} />
            <SummaryMetric icon="tag" label="Descuentos" value={toCOP(discounts)} />
            <SummaryMetric icon="wallet" label="Total pagado" value={toCOP(total)} strong />
          </div>

          {taxAmount > 0 && (
            <div className="order-detail-summary-strip" style={{ gridTemplateColumns: '1fr' }}>
              <SummaryMetric icon="invoice" label={`${ivaName} ${ivaPercent}%`} value={toCOP(taxAmount)} />
            </div>
          )}

          <div className="order-detail-grid-2">
            <div className="order-detail-card" style={PANEL_STYLE}>
              <div className="order-detail-card-inner">
                <SectionTitle icon="note" title="Notas internas" />
                <div className="order-detail-note-form">
                  <textarea
                    className="order-detail-textarea"
                    style={MODAL_FIELD_STYLE}
                    placeholder="Escribe una nota interna..."
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    disabled={loadingAux}
                  />
                  <button
                    type="button"
                    className="order-detail-btn order-detail-btn-primary"
                    style={PRIMARY_BUTTON_STYLE}
                    onClick={addNote}
                    disabled={loadingAux || !noteText.trim()}
                  >
                    Añadir
                  </button>
                </div>

                {notes.length === 0 ? (
                  <div className="order-detail-empty">Sin notas internas.</div>
                ) : (
                  <div className="order-detail-notes-list">
                    {notes.map((n) => (
                      <div key={n._id} className="order-detail-note-item">
                        <div className="order-detail-note-meta">
                          {fmtDate(n.createdAt)} {n.author?.name ? `· ${n.author.name}` : ''}{n.pinned ? ' · 📌' : ''}
                        </div>
                        <div className="order-detail-note-text">{n.text}</div>
                        <div className="order-detail-note-actions">
                          <button
                            type="button"
                            className="order-detail-btn order-detail-btn-soft"
                            style={SOFT_BUTTON_STYLE}
                            onClick={() => togglePin(n)}
                            disabled={loadingAux}
                          >
                            {n.pinned ? 'Quitar fijado' : 'Fijar'}
                          </button>
                          <button
                            type="button"
                            className="order-detail-btn order-detail-danger-btn"
                            onClick={() => deleteNote(n)}
                            disabled={loadingAux}
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="order-detail-card" style={PANEL_STYLE}>
              <div className="order-detail-card-inner">
                <SectionTitle icon="clock" title="Timeline" />
                {timeline.length === 0 ? (
                  <div className="order-detail-empty">Sin eventos.</div>
                ) : (
                  <div className="order-detail-timeline-list">
                    {timeline.map((ev) => {
                      const ui = uiForEvent(ev);
                      const title = titleForEvent(ev);
                      return (
                        <div key={ev._id} className="order-detail-timeline-item">
                          <span className="order-detail-timeline-dot">{ui.icon}</span>
                          <div className="order-detail-timeline-box">
                            <div className="order-detail-timeline-meta">
                              <span className="order-detail-event-badge">{ui.label}</span>
                              <span>{fmtDate(ev.createdAt)}</span>
                              {ev?.meta?.by && <span className="ml-auto">por {ev.meta.by}</span>}
                            </div>
                            <div className="order-detail-event-title">{title}</div>
                            {ev.message && <div className="order-detail-event-message">{ev.message}</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="order-detail-internal-id">
            <span>ID Interno:</span>
            <strong>{order?._id || '—'}</strong>
            {order?._id ? <Icon name="copy" className="h-3.5 w-3.5" /> : null}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
