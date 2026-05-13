// frontend/src/admin/OrdersAdmin.jsx
import React, { useEffect, useMemo, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import api, { setAdminToken } from '../lib/api';
import ElectronicInvoiceBox from './orders/electronicInvoice/ElectronicInvoiceBox';

const ADMIN_BORDER = 'var(--admin-table-border)';
const ADMIN_PRIMARY = 'var(--admin-primary)';

const MODAL_FIELD_STYLE = {
  borderColor: 'var(--admin-input-border)',
  backgroundColor: 'var(--admin-input-bg)',
  color: 'var(--admin-input-text)',
};

const MODAL_LIGHT_PANEL_STYLE = {
  borderColor: 'var(--admin-light-panel-border)',
  backgroundColor: 'var(--admin-light-panel-bg)',
  color: 'var(--admin-light-panel-text)',
};

const MODAL_LIGHT_SOFT_STYLE = {
  borderColor: 'var(--admin-light-panel-border)',
  backgroundColor: 'var(--admin-light-panel-soft-bg)',
  color: 'var(--admin-light-panel-text)',
};

const MODAL_LIGHT_MUTED_STYLE = {
  color: 'var(--admin-light-panel-muted-text)',
};

const MODAL_PRIMARY_BUTTON_STYLE = {
  backgroundColor: 'var(--admin-primary)',
  color: 'var(--admin-primary-text)',
};

const OPTION_STYLE = {
  backgroundColor: '#ffffff',
  color: '#111827',
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

function statusBadgeClasses(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'paid') return 'bg-green-100 text-green-700';
  if (s === 'processing') return 'bg-amber-100 text-amber-700';
  if (s === 'shipped') return 'bg-blue-100 text-blue-700';
  if (s === 'failed') return 'bg-red-100 text-red-700';
  if (s === 'cancelled' || s === 'canceled') return 'bg-red-100 text-red-700';
  if (s === 'refunded') return 'bg-purple-100 text-purple-700';
  if (s === 'pending' || s === 'pendiente') return 'bg-gray-100 text-gray-700';
  return 'bg-gray-200 text-gray-700';
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

const STATUS_FILTERS = [
  { key: 'pending', label: 'Pendientes' },
  { key: 'processing', label: 'Procesando' },
  { key: 'paid', label: 'Pagadas' },
  { key: 'failed', label: 'Fallidas' },
  { key: 'shipped', label: 'Enviadas' },
  { key: 'cancelled', label: 'Canceladas' },
  { key: 'refunded', label: 'Reembolsadas' },
];

const normalizeTag = (t) => String(t || '').toLowerCase().trim().replace(/\s+/g, ' ');
const parseTagsInput = (str) =>
  String(str || '')
    .split(',')
    .map((s) => normalizeTag(s))
    .filter(Boolean);

/* ---------- Fallbacks client-side ---------- */
function applyStatusClientFilter(list, statusFilter) {
  if (!Array.isArray(list) || statusFilter.length === 0) return list;
  const want = new Set(statusFilter.map((s) => String(s).toLowerCase()));
  return list.filter((o) => {
    const s = String(o?.status || '').toLowerCase();
    if (want.has('cancelled') || want.has('canceled')) {
      if (s === 'cancelled' || s === 'canceled') return true;
    }
    return want.has(s);
  });
}
function applyTagsClientFilter(list, tags, mode) {
  if (!Array.isArray(list) || tags.length === 0) return list;
  const want = tags.map(normalizeTag);
  const hasAll = (arr) => {
    const ot = (arr || []).map(normalizeTag);
    return want.every((t) => ot.includes(t));
  };
  const hasAny = (arr) => {
    const ot = (arr || []).map(normalizeTag);
    return want.some((t) => ot.includes(t));
  };
  return list.filter((o) => (mode === 'all' ? hasAll(o.tags) : hasAny(o.tags)));
}

/* ---------- UI helpers para TIMELINE (mejorado) ---------- */
function isTagsUpdate(ev) {
  const t = String(ev?.type || '').toLowerCase();
  const msg = String(ev?.message || '');
  const hasArrays = Array.isArray(ev?.meta?.after) || Array.isArray(ev?.meta?.before);
  const saysTags = /^tags\b/i.test(msg) || /tags/i.test(msg);
  return t === 'tags_updated' || (t === 'note_updated' && (hasArrays || saysTags));
}

function uiForEvent(ev = {}) {
  const t = String(ev?.type || '').toLowerCase();

  if (isTagsUpdate(ev)) {
    return { icon: '🏷️', badge: 'bg-fuchsia-100 text-fuchsia-700', label: 'Tags' };
  }
  if (t === 'status_changed') {
    return { icon: '🔄', badge: 'bg-blue-100 text-blue-700', label: 'Estado' };
  }
  if (t === 'note_created') {
    return { icon: '📝', badge: 'bg-emerald-100 text-emerald-700', label: 'Nota' };
  }
  if (t === 'note_updated') {
    return { icon: '✏️', badge: 'bg-amber-100 text-amber-700', label: 'Nota editada' };
  }
  if (t === 'note_deleted') {
    return { icon: '🗑️', badge: 'bg-rose-100 text-rose-700', label: 'Nota eliminada' };
  }
  if (t === 'email_sent') {
    return { icon: '✉️', badge: 'bg-indigo-100 text-indigo-700', label: 'Email' };
  }
  return { icon: '⚙️', badge: 'bg-gray-100 text-gray-700', label: 'Sistema' };
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

/* ===========================
   Modal (header sticky + body scroll)
   =========================== */
function OrderDetailModal({
  open,
  onClose,
  order,
  onSaveStatus,
  onSaveTags,
  onTogglePrinted,    // 👈 NUEVO
  onToggleArchived,   // 👈 NUEVO
  savingId,
  populated
}) {
  const cust = order?.customer || {};
  const bill = order?.billing || {};
  const items = Array.isArray(order?.items) ? order.items : [];

  const shipping = Number(order?.shipping || 0);
  const subtotal = Number(order?.subtotal ?? order?.summary?.subtotal ?? 0);
  const total = Number(order?.total ?? subtotal + shipping);
  const iva = order?.taxes?.iva || {};

  const ivaPercent = Number(iva.percent || 0);
  const taxAmount = Number(iva.amount || 0);
  const ivaName = iva.name || 'IVA';

  const [statusLocal, setStatusLocal] = useState(order?.status || 'pending');
  const [tagsStr, setTagsStr] = useState((order?.tags || []).join(', '));
  const [savingTags, setSavingTags] = useState(false);

  // Flags actuales (por si vienen undefined)
  const printed = !!order?.printed;
  const archived = !!order?.archived;
  const factusLinks = order?.factusLinks || {};
  const electronicInvoiceUrl =
  factusLinks?.pdfUrl ||
  factusLinks?.publicUrl ||
  order?.electronicInvoice?.provider?.links?.public_url ||
  '';

  const hasElectronicInvoice = !!electronicInvoiceUrl;

  // Email menu
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

  // Cerrar menú de email al click fuera
  useEffect(() => {
    if (!emailMenuOpen) return;
    const onDocClick = (e) => {
      const btn = emailBtnRef.current;
      if (btn && !btn.contains(e.target)) {
        setEmailMenuOpen(false);
      }
    };
    document.addEventListener('click', onDocClick, true);
    return () => document.removeEventListener('click', onDocClick, true);
  }, [emailMenuOpen]);

  // --- Timeline y Notas ---
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

  // Envío de emails
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

  // Abrir PDF de la orden (Axios con headers, no window.open directo)
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

  return createPortal(
    <div
      className="fixed left-0 top-0 z-[99999] flex h-screen w-screen items-center justify-center p-3 md:p-5"
      aria-modal="true"
      role="dialog"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm"></div>
      <div
        className="relative z-[100000] w-full max-w-5xl max-h-[92vh] overflow-hidden rounded-xl border shadow-xl"
        style={{
          borderColor: ADMIN_BORDER,
          backgroundColor: 'var(--admin-card-bg)',
          color: 'var(--admin-card-text)',
        }}
      >
        {/* Header fijo */}
        {/* Header fijo */}
        <div
          className="sticky top-0 z-10 flex items-center gap-2 px-4 py-2 border-b backdrop-blur"
          style={{
            borderColor: ADMIN_BORDER,
            backgroundColor: 'var(--admin-card-bg)',
          }}
        >
          <span className={`px-2 py-0.5 rounded text-[11px] ${statusBadgeClasses(order?.status)}`}>
            {order?.status || '—'}
          </span>

          <h2 className="text-base font-semibold" style={{ color: 'var(--admin-card-text)' }}>
            Orden #{order?.orderNumber || '—'}
          </h2>

          {printed && (
            <span className="ml-2 px-2 py-0.5 rounded text-[11px] bg-emerald-100 text-emerald-700">
              🖨️ Impresa
            </span>
          )}

          {archived && (
            <span className="px-2 py-0.5 rounded text-[11px] bg-gray-200 text-gray-700">
              🗂️ Archivada
            </span>
          )}

          <div className="ml-auto flex items-center gap-2">
            <button
              className="rounded px-2 py-1 border text-xs hover:bg-pink-50 disabled:opacity-50"
              style={MODAL_LIGHT_PANEL_STYLE}
              onClick={openPdf}
              title="Imprimir / Descargar PDF"
              disabled={loadingAux}
            >
              PDF
            </button>

            {hasElectronicInvoice && (
              <button
                className="rounded px-2 py-1 border text-xs hover:bg-pink-50"
                style={MODAL_LIGHT_PANEL_STYLE}
                onClick={() =>
                  window.open(
                    electronicInvoiceUrl,
                    '_blank',
                    'noopener,noreferrer'
                  )
                }
                title="Ver factura electrónica oficial"
              >
                Factura electrónica
              </button>
            )}

            <div className="text-xs" style={{ color: 'var(--admin-card-muted-text)' }}>
              {fmtDate(order?.createdAt)}
            </div>

            <button
              className="ml-2 rounded px-2 py-1 border text-xs hover:bg-pink-50"
              style={{
                borderColor: ADMIN_BORDER,
                color: 'var(--admin-card-text)',
              }}
              onClick={onClose}
            >
              Cerrar
            </button>
          </div>
        </div>
        {/* Body con scroll */}
        <div className="max-h-[80vh] overflow-y-auto px-4 py-3">
          {/* Estado + Tags + Email + Flags */}
          <div className="mb-3 grid grid-cols-1 lg:grid-cols-12 gap-3">
            {/* Estado + Guardar + Email */}
            <div className="lg:col-span-6 flex flex-wrap items-center gap-2">
              <label className="text-xs" style={{ color: 'var(--admin-card-muted-text)' }}>Estado:</label>
              <select
                className="border rounded px-2 py-1 text-xs h-8"
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
                className="px-2.5 py-1 rounded text-xs hover:bg-pink-700 disabled:opacity-50 h-8"
                style={MODAL_PRIMARY_BUTTON_STYLE}
                onClick={async () => { try { await onSaveStatus(order._id, statusLocal); await fetchTimeline(); } catch {} }}
                disabled={disabled}
              >
                {disabled ? 'Guardando…' : 'Guardar'}
              </button>

              {/* Botón Email + menú */}
              <div className="relative" ref={emailBtnRef}>
                <button
                  type="button"
                  className="px-2.5 py-1 rounded border text-xs h-8 hover:bg-pink-50 flex items-center gap-1"
                  style={MODAL_LIGHT_PANEL_STYLE}
                  onClick={() => setEmailMenuOpen((v) => !v)}
                  title="Reenviar email"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="inline-block">
                    <path d="M4 6h16v12H4z" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M4 7l8 6 8-6" stroke="currentColor" strokeWidth="1.5" fill="none" />
                  </svg>
                  Email
                </button>

                {emailMenuOpen && (
                  <div
                    className="absolute mt-1 right-0 w-48 rounded-md border shadow-lg z-20 text-xs overflow-hidden"
                    style={MODAL_LIGHT_PANEL_STYLE}
                  >
                    <button
                      className="w-full text-left px-3 py-2 hover:bg-pink-50"
                      style={{
                        color: 'var(--admin-light-panel-text)',
                        backgroundColor: 'var(--admin-light-panel-bg)',
                      }}
                      onClick={() => sendEmail('confirmation')}
                    >
                      Reenviar confirmación
                    </button>
                    <button
                      className="w-full text-left px-3 py-2 hover:bg-pink-50"
                      style={{
                        color: 'var(--admin-light-panel-text)',
                        backgroundColor: 'var(--admin-light-panel-bg)',
                      }}
                      onClick={() => sendEmail('invoice')}
                    >
                      Reenviar factura
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Tags */}
            <div className="lg:col-span-6 flex flex-wrap items-center gap-2">
              <label className="text-xs" style={{ color: 'var(--admin-card-muted-text)' }}>Tags:</label>
              <input
                className="border rounded px-2 py-1 text-xs h-8 w-[280px] max-w-full"
                style={MODAL_FIELD_STYLE}
                placeholder="vip, urgente…"
                value={tagsStr}
                onChange={(e) => setTagsStr(e.target.value)}
              />
              <button
                className="px-2.5 py-1 rounded text-xs hover:bg-pink-700 disabled:opacity-50 h-8"
                style={MODAL_PRIMARY_BUTTON_STYLE}
                onClick={async () => {
                  try {
                    setSavingTags(true);
                    const parts = String(tagsStr || '')
                      .split(',')
                      .map((s) => s.toLowerCase().trim().replace(/\s+/g, ' '))
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
                <div className="flex flex-wrap gap-1 ml-1">
                  {order.tags.map((t) => (
                    <span key={t} className="px-2 py-0.5 rounded-full text-[10px] border bg-pink-50" style={{ borderColor: ADMIN_BORDER }}>
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* ======= NUEVO: Botones Impresa / Archivada ======= */}
            <div className="lg:col-span-12 flex flex-wrap items-center gap-2">
              <span className="text-[11px]" style={{ color: 'var(--admin-card-muted-text)' }}>Operación:</span>
              <button
                className={`px-2.5 py-1 rounded border text-xs h-8 hover:bg-pink-50 ${printed ? 'text-emerald-700' : ''}`}
                style={MODAL_LIGHT_PANEL_STYLE}
                onClick={async () => { try { await onTogglePrinted(order._id, !printed); await fetchTimeline(); } catch {} }}
                disabled={disabled}
                title={printed ? 'Quitar impresa' : 'Marcar impresa'}
              >
                {printed ? 'Quitar impresa' : 'Marcar impresa'}
              </button>
              <button
                className={`px-2.5 py-1 rounded border text-xs h-8 hover:bg-pink-50 ${archived ? 'text-gray-700' : ''}`}
                style={MODAL_LIGHT_PANEL_STYLE}
                onClick={async () => { try { await onToggleArchived(order._id, !archived); await fetchTimeline(); } catch {} }}
                disabled={disabled}
                title={archived ? 'Desarchivar' : 'Archivar'}
              >
                {archived ? 'Desarchivar' : 'Archivar'}
              </button>
            </div>
          </div>

          {/* Factura electrónica */}
          <div className="mb-3">
            <ElectronicInvoiceBox order={order} />
          </div>

          {/* Cliente y Facturación */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <div
              className="rounded-lg p-3 border"
              style={MODAL_LIGHT_PANEL_STYLE}
            >
              <h3 className="text-xs font-semibold mb-2 text-pink-900">Cliente</h3>
              <div className="text-xs grid grid-cols-2 gap-y-1">
                <div><span style={MODAL_LIGHT_MUTED_STYLE}>Nombre: </span>{[cust.name, cust.lastname].filter(Boolean).join(' ') || '—'}</div>
                <div><span style={MODAL_LIGHT_MUTED_STYLE}>Doc.: </span>{cust.id || '—'}</div>
                <div className="col-span-2"><span style={MODAL_LIGHT_MUTED_STYLE}>Email/Teléfono: </span>{cust.emailOrPhone || cust.phone || '—'}</div>
                <div className="col-span-2"><span style={MODAL_LIGHT_MUTED_STYLE}>Dirección: </span>{cust.address || '—'}</div>
                <div><span style={MODAL_LIGHT_MUTED_STYLE}>Ciudad: </span>{cust.city || '—'}</div>
                <div><span style={MODAL_LIGHT_MUTED_STYLE}>País/Depto: </span>{[cust.country, cust.department].filter(Boolean).join(' / ') || '—'}</div>
              </div>
            </div>
            <div className="rounded-lg p-3 border" style={MODAL_LIGHT_PANEL_STYLE}>
              <h3 className="text-xs font-semibold mb-2 text-pink-900">Facturación</h3>
              <div className="text-xs grid grid-cols-2 gap-y-1">
                <div><span style={MODAL_LIGHT_MUTED_STYLE}>Nombre: </span>{[bill.name, bill.lastname].filter(Boolean).join(' ') || '—'}</div>
                <div><span style={MODAL_LIGHT_MUTED_STYLE}>Doc.: </span>{bill.id || '—'}</div>
                <div className="col-span-2"><span style={MODAL_LIGHT_MUTED_STYLE}>Dirección: </span>{bill.address || '—'}</div>
                <div className="col-span-2"><span style={MODAL_LIGHT_MUTED_STYLE}>Ciudad: </span>{bill.city || '—'}</div>
                <div><span style={MODAL_LIGHT_MUTED_STYLE}>País/Depto: </span>{[bill.country, bill.department].filter(Boolean).join(' / ') || '—'}</div>
                <div><span style={MODAL_LIGHT_MUTED_STYLE}>Tel.: </span>{bill.phone || '—'}</div>
              </div>
            </div>
          </div>

          {/* Ítems */}
          <div className="rounded-lg border mb-3" style={MODAL_LIGHT_PANEL_STYLE}>
            <div
              className="px-3 py-1.5 border-b text-xs font-semibold"
              style={{
                borderColor: 'var(--admin-light-panel-border)',
                backgroundColor: 'var(--admin-light-panel-soft-bg)',
                color: 'var(--admin-primary-soft-text)',
              }}
            >
              Ítems {populated ? '(con detalle de producto)' : '(sin populate)'}
            </div>
            <div className="max-h-56 overflow-auto">
              {items.length === 0 ? (
                <div className="p-3 text-xs" style={MODAL_LIGHT_MUTED_STYLE}>Sin ítems.</div>
              ) : (
                <table className="min-w-full text-xs">
                  <thead className="sticky top-0" style={MODAL_LIGHT_SOFT_STYLE}>
                    <tr>
                      <th className="text-left p-2 border-b" style={{ borderColor: 'var(--admin-light-panel-border)', color: 'var(--admin-light-panel-text)' }}>Producto</th>
                      <th className="text-left p-2 border-b" style={{ borderColor: 'var(--admin-light-panel-border)', color: 'var(--admin-light-panel-text)' }}>Variante</th>
                      <th className="text-right p-2 border-b" style={{ borderColor: 'var(--admin-light-panel-border)', color: 'var(--admin-light-panel-text)' }}>Precio</th>
                      <th className="text-right p-2 border-b" style={{ borderColor: 'var(--admin-light-panel-border)', color: 'var(--admin-light-panel-text)' }}>Cant.</th>
                      <th className="text-right p-2 border-b" style={{ borderColor: 'var(--admin-light-panel-border)', color: 'var(--admin-light-panel-text)' }}>Total</th>
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
                      const image = p?.image;
                      const sku = p?.sku || p?.skun || '';
                      const slug = p?.slug;
                      return (
                        <tr key={i} className="hover:bg-pink-50/40">
                          <td className="p-2 border-b" style={{ borderColor: 'var(--admin-light-panel-border)' }}>
                            <div className="flex items-center gap-2">
                              {image ? (
                                <img
                                  src={image}
                                  alt={title}
                                  className="w-8 h-8 object-cover rounded-md border"
                                  style={{ borderColor: 'var(--admin-light-panel-border)' }}
                                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                />
                              ) : null}
                              <div>
                                <div className="font-medium">
                                  {slug ? (
                                    <a href={`/producto/${slug}`} target="_blank" rel="noreferrer" className="hover:underline text-pink-900">
                                      {title}
                                    </a>
                                  ) : (title)}
                                </div>
                                <div className="text-[10px] font-mono" style={MODAL_LIGHT_MUTED_STYLE}>
                                  {sku ? `SKU: ${sku} · ` : ''}{String(it._id || it.productId || '')}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="p-2 border-b" style={{ borderColor: 'var(--admin-light-panel-border)' }}>{varTxt}</td>
                          <td className="p-2 border-b text-right" style={{ borderColor: 'var(--admin-light-panel-border)' }}>{toCOP(price)}</td>
                          <td className="p-2 border-b text-right" style={{ borderColor: 'var(--admin-light-panel-border)' }}>{qty}</td>
                          <td className="p-2 border-b text-right" style={{ borderColor: 'var(--admin-light-panel-border)' }}>{toCOP(line)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Notas y Timeline */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div
              className="rounded-lg p-3 border"
              style={MODAL_LIGHT_PANEL_STYLE}
            >
              <h3 className="text-xs font-semibold mb-2 text-pink-900">Notas internas</h3>
              <div className="flex gap-2 mb-2">
                <input
                  className="border rounded px-2 py-1 text-xs h-8 flex-1"
                  style={MODAL_FIELD_STYLE}
                  placeholder="Escribe una nota…"
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  disabled={loadingAux}
                />
                <button
                  className="px-2.5 py-1 rounded text-xs disabled:opacity-50 h-8 hover:bg-pink-700"
                  style={MODAL_PRIMARY_BUTTON_STYLE}
                  onClick={addNote}
                  disabled={loadingAux || !noteText.trim()}
                >
                  Añadir
                </button>
              </div>
              {notes.length === 0 ? (
                <div className="text-xs" style={MODAL_LIGHT_MUTED_STYLE}>Sin notas.</div>
              ) : (
                <ul className="space-y-2">
                  {notes.map((n) => (
                    <li key={n._id} className="border rounded p-2" style={MODAL_LIGHT_SOFT_STYLE}>
                      <div className="text-[10px] mb-1" style={MODAL_LIGHT_MUTED_STYLE}>
                        {fmtDate(n.createdAt)} {n.author?.name ? `· ${n.author.name}` : ''}{n.pinned ? ' · 📌' : ''}
                      </div>
                      <div className="text-xs whitespace-pre-wrap">{n.text}</div>
                      <div className="mt-2 flex gap-2">
                        <button
                          className="px-2 py-0.5 rounded text-[11px] border hover:bg-pink-50"
                          style={MODAL_LIGHT_PANEL_STYLE}
                          onClick={() => togglePin(n)}
                          disabled={loadingAux}
                        >
                          {n.pinned ? 'Quitar fijado' : 'Fijar'}
                        </button>
                        <button
                          className="px-2 py-0.5 rounded text-[11px] border hover:bg-red-50 text-red-700"
                          style={{ borderColor: 'var(--admin-light-panel-border)' }}
                          onClick={() => deleteNote(n)}
                          disabled={loadingAux}
                        >
                          Eliminar
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Timeline mejorado */}
            <div
              className="rounded-lg p-3 border"
              style={MODAL_LIGHT_PANEL_STYLE}
            >
              <h3 className="text-xs font-semibold mb-2 text-pink-900">Timeline</h3>
              {timeline.length === 0 ? (
                <div className="text-xs" style={MODAL_LIGHT_MUTED_STYLE}>Sin eventos.</div>
              ) : (
                <ul className="space-y-3 relative">
                  {/* línea vertical */}
                  <span
                    className="absolute left-[11px] top-2 bottom-2 w-px"
                    style={{ backgroundColor: 'var(--admin-light-panel-border)' }}
                  />
                  {timeline.map((ev) => {
                    const ui = uiForEvent(ev);
                    const title = titleForEvent(ev);
                    return (
                      <li key={ev._id} className="relative pl-6">
                        {/* punto con icono */}
                        <span
                          className="absolute left-0 top-1 w-6 h-6 rounded-full flex items-center justify-center text-[13px] border"
                          style={MODAL_LIGHT_PANEL_STYLE}
                        >
                          {ui.icon}
                        </span>
                        <div className="border rounded p-2 text-xs" style={MODAL_LIGHT_SOFT_STYLE}>
                          <div className="flex items-center gap-2">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] ${ui.badge}`}>{ui.label}</span>
                            <span className="text-[10px]" style={MODAL_LIGHT_MUTED_STYLE}>{fmtDate(ev.createdAt)}</span>
                            {ev?.meta?.by && (
                              <span className="text-[10px] ml-auto" style={MODAL_LIGHT_MUTED_STYLE}>por {ev.meta.by}</span>
                            )}
                          </div>
                          <div className="mt-1">
                            <div className="font-medium text-pink-900">{title}</div>
                            {ev.message && <div className="text-[11px]" style={{ color: 'var(--admin-light-panel-text)' }}>{ev.message}</div>}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* Totales */}
          <div className="mt-4 flex flex-col items-end gap-0.5 text-xs">
            <div className="flex gap-6"><span style={{ color: 'var(--admin-card-muted-text)' }}>Subtotal</span><span className="font-semibold">{toCOP(subtotal)}</span></div>
            {taxAmount > 0 && (
              <div className="flex gap-6">
                <span style={{ color: 'var(--admin-card-muted-text)' }}>{ivaName} {ivaPercent}%</span>
                <span className="font-semibold">{toCOP(taxAmount)}</span>
              </div>
            )}
            <div className="flex gap-6"><span style={{ color: 'var(--admin-card-muted-text)' }}>Envío</span><span className="font-semibold">{toCOP(shipping)}</span></div>
            <div className="flex gap-6 pt-1 text-sm border-t" style={{ borderColor: ADMIN_BORDER }}>
              <span className="font-semibold text-pink-900">Total</span><span className="font-bold">{toCOP(total)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>,
  document.body
  );
}

/* ===========================
   Listado + FILTROS EN 2 LÍNEAS
   =========================== */
export default function OrdersAdmin() {
   // Cargar token admin desde localStorage
  useEffect(() => {
     const token = localStorage.getItem('admin_token');
     if (token) {
      setAdminToken(token);
     }
  }, []);

  const [data, setData] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(20);
  const [q, setQ] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [populate, setPopulate] = useState(true);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  // ===== ORDENAMIENTO (UI + envío a server) =====
  const [sort, setSort] = useState('createdAt:-1');
  const parseSort = (s) => {
    const [field, raw] = String(s || '').split(':');
    const dir = Number(raw) === 1 ? 1 : -1; // default desc
    return { field, dir };
  };
  const toggleSort = (field) => {
    setSort((prev) => {
      const { field: f, dir } = parseSort(prev);
      if (f === field) return `${field}:${dir === 1 ? -1 : 1}`;
      const defaultDir = (field === 'createdAt' || field === 'orderNumber' || field === 'total') ? -1 : -1;
      return `${field}:${defaultDir}`;
    });
    setPage(1);
  };
  const sortState = useMemo(() => parseSort(sort), [sort]);
  const sortIcon = (field) => {
    if (sortState.field !== field) return '↕';
    return sortState.dir === 1 ? '▲' : '▼';
  };
  const sortAria = (field) =>
    sortState.field === field ? (sortState.dir === 1 ? 'ascending' : 'descending') : 'none';

  // Selección múltiple
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const clearSelection = () => setSelectedIds(new Set());
  const isSelected = (id) => selectedIds.has(id);
  const toggleOne = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const allVisibleSelected =
    data.length > 0 && data.every((o) => selectedIds.has(o._id));
  const toggleSelectAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        data.forEach((o) => next.delete(o._id));
      } else {
        data.forEach((o) => next.add(o._id));
      }
      return next;
    });
  };

  // Modal
  const [showDetail, setShowDetail] = useState(false);
  const [orderSelected, setOrderSelected] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const openOrderDetail = async (order) => {
    try {
      console.log('CLICK ORDEN', order?._id);
      const id = order?._id;
      if (!id) return;

      setOrderSelected(order);
      setShowDetail(true);

      const { data } = await api.get(`/api/orders/${id}`);
      setOrderSelected(data);
    } catch (error) {
      console.error('Error cargando detalle de orden:', error);
      alert('No se pudo cargar el detalle completo de la orden.');
    }
  };

  // Debounce búsqueda
  const [typingQ, setTypingQ] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setQ(typingQ.trim()), 300);
    return () => clearTimeout(t);
  }, [typingQ]);

  // Filtros estado
  const [statusFilter, setStatusFilter] = useState([]);
  const toggleStatus = (k) => {
    setStatusFilter((prev) =>
      prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]
    );
    setPage(1);
  };
  const clearStatus = () => { setStatusFilter([]); setPage(1); };

  // Tags
  const [tagsStr, setTagsStr] = useState('');
  const [tagsMode, setTagsMode] = useState('any'); // any | all
  const parsedTags = useMemo(() => parseTagsInput(tagsStr), [tagsStr]);

  const params = useMemo(
    () => ({
      page,
      limit,
      q,
      populate: populate ? 1 : 0,
      sort,
      ...(dateFrom ? { dateFrom } : {}),
      ...(dateTo ? { dateTo } : {}),
      ...(statusFilter.length ? { status: statusFilter.join(',') } : {}),
      ...(parsedTags.length ? { tags: parsedTags.join(','), tagsMode } : {}),
    }),
    [page, limit, q, populate, sort, dateFrom, dateTo, statusFilter, parsedTags, tagsMode]
  );

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    setErr('');
    api
      .get('/api/orders/admin', { params })
      .then((res) => {
        if (cancel) return;
        const payload = res?.data || {};
        const serverList = Array.isArray(payload.data) ? payload.data : [];
        const afterStatus = applyStatusClientFilter(serverList, statusFilter);
        const finalList = applyTagsClientFilter(afterStatus, parsedTags, tagsMode);
        setData(finalList);
        setPage(Number(payload.page || 1));
        setTotalPages(Number(payload.totalPages || 1));
        setTotal(Number(payload.total || 0));
        setSelectedIds((prev) => {
          const next = new Set();
          finalList.forEach((o) => { if (prev.has(o._id)) next.add(o._id); });
          return next;
        });
      })
      .catch((e) => {
        if (cancel) return;
        if (e?.response?.status === 401) {
          setErr('No autorizado. Inicia sesión de admin o configura VITE_ADMIN_TOKEN.');
        } else {
          setErr('No se pudieron cargar las órdenes.');
        }
      })
      .finally(() => !cancel && setLoading(false));
    return () => { cancel = true; };
  }, [params, statusFilter, parsedTags, tagsMode]);

  const resetAndSearch = () => setPage(1);

  // Exportar CSV (Axios con headers, descarga directa)
  const exportCsv = async () => {
    try {
      const resp = await api.get('/api/orders/admin', {
        params: { ...params, format: 'csv' },
        responseType: 'blob',
      });
      const blob = new Blob([resp.data], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'orders.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert('No se pudo exportar el CSV.');
    }
  };

  // Exportar seleccionadas (CSV - POST /admin/export)
  const exportSelectedCsv = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    try {
      const resp = await api.post('/api/orders/admin/export', { ids }, { responseType: 'blob' });
      const blob = new Blob([resp.data], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'orders-selected.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert('No se pudo exportar el CSV de seleccionadas.');
    }
  };

  // Acciones masivas
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkStatus, setBulkStatus] = useState('processing');
  const [bulkTags, setBulkTags] = useState('');
  const [bulkMode, setBulkMode] = useState('add'); // add | remove

  const runBulkStatus = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    try {
      setBulkBusy(true);
      await api.post('/api/orders/admin/bulk', {
        ids,
        action: { type: 'status', value: bulkStatus },
      });
      setData((prev) => prev.map((o) => (selectedIds.has(o._id) ? { ...o, status: bulkStatus } : o)));
      clearSelection();
    } catch {
      alert('No se pudieron aplicar los cambios de estado.');
    } finally {
      setBulkBusy(false);
    }
  };

  const runBulkTags = async () => {
    const ids = Array.from(selectedIds);
    const tags = parseTagsInput(bulkTags);
    if (ids.length === 0 || tags.length === 0) return;
    try {
      setBulkBusy(true);
      await api.post('/api/orders/admin/bulk', {
        ids,
        action: { type: bulkMode === 'add' ? 'tags_add' : 'tags_remove', value: tags },
      });
      setData((prev) =>
        prev.map((o) => {
          if (!selectedIds.has(o._id)) return o;
          const orig = Array.isArray(o.tags) ? o.tags : [];
          if (bulkMode === 'add') {
            const set = new Set([...orig, ...tags]);
            return { ...o, tags: Array.from(set) };
          } else {
            const set = new Set(orig);
            tags.forEach((t) => set.delete(t));
            return { ...o, tags: Array.from(set) };
          }
        })
      );
      clearSelection();
      setBulkTags('');
    } catch {
      alert('No se pudieron aplicar los cambios de tags.');
    } finally {
      setBulkBusy(false);
    }
  };

  // Guardar estado (individual)
  const saveStatus = async (id, status) => {
    try {
      setSavingId(id);
      const resp = await api.patch(`/api/orders/${id}/status`, { status });
      setData((prev) => prev.map((o) => (o._id === id ? { ...o, status } : o)));
      if (orderSelected && orderSelected._id === id) {
        setOrderSelected((o) => ({ ...o, status }));
      }
      return resp;
    } catch (e) {
      alert('No se pudo guardar el estado.');
      throw e;
    } finally { setSavingId(null); }
  };

  // Guardar tags (individual)
  const saveTags = async (id, tags) => {
    try {
      setSavingId(id);
      const resp = await api.put(`/api/orders/${id}/tags`, { tags });
      const tagsSaved = Array.isArray(resp?.data?.tags) ? resp.data.tags : tags;
      setData((prev) => prev.map((o) => (o._id === id ? { ...o, tags: tagsSaved } : o)));
      if (orderSelected && orderSelected._id === id) {
        setOrderSelected((o) => ({ ...o, tags: tagsSaved }));
      }
      return resp;
    } catch (e) {
      alert('No se pudieron guardar los tags.');
      throw e;
    } finally { setSavingId(null); }
  };

  // ===== NUEVO: toggle impresa / archivada =====
  const togglePrinted = async (id, printed) => {
    try {
      setSavingId(id);
      const resp = await api.patch(`/api/orders/${id}/printed`, { printed });
      setData((prev) => prev.map((o) => (o._id === id ? { ...o, printed: !!printed } : o)));
      if (orderSelected && orderSelected._id === id) {
        setOrderSelected((o) => ({ ...o, printed: !!printed }));
      }
      return resp;
    } catch (e) {
      alert('No se pudo actualizar "impresa".');
      throw e;
    } finally { setSavingId(null); }
  };

  const toggleArchived = async (id, archived) => {
    try {
      setSavingId(id);
      const resp = await api.patch(`/api/orders/${id}/archived`, { archived });
      setData((prev) => prev.map((o) => (o._id === id ? { ...o, archived: !!archived } : o)));
      if (orderSelected && orderSelected._id === id) {
        setOrderSelected((o) => ({ ...o, archived: !!archived }));
      }
      return resp;
    } catch (e) {
      alert('No se pudo actualizar "archivada".');
      throw e;
    } finally { setSavingId(null); }
  };

  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(total, page * limit);

  return (
    <div className="p-4">
      {/* ===== Toolbar (SIEMPRE 2 LÍNEAS EN DESKTOP) ===== */}
      <div className="mb-3 rounded-xl border bg-white" style={{ borderColor: ADMIN_BORDER }}>
        <div className="px-4 py-2 border-b bg-pink-50/70 rounded-t-xl" style={{ borderColor: ADMIN_BORDER }}>
          <h1 className="text-base font-semibold text-pink-900">Órdenes de clientes</h1>
        </div>

        {/* LÍNEA 1 */}
        <div className="px-3 py-2 grid grid-cols-12 gap-2 items-end">
          <div className="col-span-4">
            <label className="text-[10px] text-gray-500">Buscar</label>
            <input
              className="w-full border rounded px-3 py-1 text-sm h-9"
              style={{ borderColor: ADMIN_BORDER }}
              placeholder="Nombre, email/teléfono, # de orden…"
              value={typingQ}
              onChange={(e) => { setTypingQ(e.target.value); setPage(1); }}
            />
          </div>
          <div className="col-span-2">
            <label className="text-[10px] text-gray-500">Desde</label>
            <input
              type="date"
              className="w-full border rounded px-3 py-1 text-sm h-9"
              style={{ borderColor: ADMIN_BORDER }}
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            />
          </div>
          <div className="col-span-2">
            <label className="text-[10px] text-gray-500">Hasta</label>
            <input
              type="date"
              className="w-full border rounded px-3 py-1 text-sm h-9"
              style={{ borderColor: ADMIN_BORDER }}
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            />
          </div>
          <div className="col-span-2">
            <label className="text-[10px] text-gray-500">&nbsp;</label>
            <div className="flex items-center h-9">
              <label className="text-[11px] text-gray-600 flex items-center gap-2">
                <input
                  type="checkbox"
                  className="accent-pink-600"
                  checked={populate}
                  onChange={(e) => { setPopulate(e.target.checked); setPage(1); }}
                />
                Detalle (populate)
              </label>
            </div>
          </div>
          <div className="col-span-2 flex justify-end">
            <button
              onClick={exportCsv}
              disabled={loading || total === 0}
              className="px-3 py-1.5 rounded text-white text-xs disabled:opacity-50 hover:bg-pink-700 h-9"
              style={{ backgroundColor: 'var(--admin-primary)', color: 'white' }}
            >
              Exportar CSV
            </button>
          </div>
        </div>

        {/* LÍNEA 2: SCROLL horizontal */}
        <div className="px-3 pb-3">
          <div className="flex items-center gap-3 overflow-x-auto whitespace-nowrap flex-nowrap scrollbar-thin">
            {/* Estado chips */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-gray-500">Estado:</span>
              {STATUS_FILTERS.map((st) => {
                const active = statusFilter.includes(st.key);
                return (
                  <button
                    key={st.key}
                    type="button"
                    onClick={() => toggleStatus(st.key)}
                    className={`px-2.5 py-1 rounded-full border text-[11px] ${
                      active ? 'bg-black text-white border-black'
                             : 'bg-white text-gray-700 border-gray-300 hover:border-gray-500'
                    }`}
                    title={st.label}
                  >
                    {st.label}
                  </button>
                );
              })}
              {statusFilter.length > 0 && (
                <button
                  type="button"
                  onClick={clearStatus}
                  className="px-2.5 py-1 rounded-full border text-[11px] bg-white text-gray-700 border-gray-300 hover:border-gray-500"
                  title="Limpiar filtros"
                >
                  Limpiar
                </button>
              )}
            </div>

            <span className="w-px h-5 bg-gray-200" />

            {/* Tags inline */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500">Tags:</span>
              <input
                className="border rounded px-3 py-1 text-sm h-9 w-80"
                style={{ borderColor: ADMIN_BORDER }}
                placeholder="vip, urgente…"
                value={tagsStr}
                onChange={(e) => { setTagsStr(e.target.value); setPage(1); }}
              />
              <select
                className="border rounded px-2 py-1 text-xs h-9"
                style={{ borderColor: ADMIN_BORDER }}
                value={tagsMode}
                onChange={(e) => { setTagsMode(e.target.value === 'all' ? 'all' : 'any'); setPage(1); }}
                title="Modo"
              >
                <option value="any">Cualquiera</option>
                <option value="all">Todas</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ====== BARRA DE ACCIONES MASIVAS ====== */}
      {selectedIds.size > 0 && (
        <div className="mb-2 p-2 rounded-lg border bg-pink-50/50 flex flex-col gap-2 md:flex-row md:items-center md:justify-between" style={{ borderColor: ADMIN_BORDER }}>
          <div className="text-xs">
            {selectedIds.size} seleccionada{selectedIds.size === 1 ? '' : 's'}
            <button className="ml-2 underline text-pink-700" onClick={clearSelection}>Limpiar selección</button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Cambiar estado */}
            <div className="flex items-center gap-1">
              <select
                className="border rounded px-2 py-1 text-xs h-8"
                style={{ borderColor: ADMIN_BORDER }}
                value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value)}
                disabled={bulkBusy}
              >
                {STATUS_OPTIONS.map(op => <option key={op.code} value={op.code}>{op.label}</option>)}
              </select>
              <button
                className="px-2.5 py-1 rounded text-white text-xs h-8 disabled:opacity-50 hover:bg-pink-700"
                style={{ backgroundColor: '#ec4899' }}
                onClick={runBulkStatus}
                disabled={bulkBusy}
              >
                Cambiar estado
              </button>
            </div>

            {/* Añadir / Quitar tags */}
            <div className="flex items-center gap-1">
              <select
                className="border rounded px-2 py-1 text-xs h-8"
                style={{ borderColor: ADMIN_BORDER }}
                value={bulkMode}
                onChange={(e) => setBulkMode(e.target.value === 'remove' ? 'remove' : 'add')}
                disabled={bulkBusy}
              >
                <option value="add">Añadir tags</option>
                <option value="remove">Quitar tags</option>
              </select>
              <input
                className="border rounded px-2 py-1 text-xs h-8 w-56"
                style={{ borderColor: ADMIN_BORDER }}
                placeholder="vip, urgente…"
                value={bulkTags}
                onChange={(e) => setBulkTags(e.target.value)}
                disabled={bulkBusy}
              />
              <button
                className="px-2.5 py-1 rounded text-white text-xs h-8 disabled:opacity-50 hover:bg-pink-700"
                style={{ backgroundColor: '#ec4899' }}
                onClick={runBulkTags}
                disabled={bulkBusy || !bulkTags.trim()}
              >
                Aplicar tags
              </button>
            </div>

            {/* Exportar seleccionadas */}
            <div className="flex items-center gap-1">
              <button
                className="px-2.5 py-1 rounded text-white text-xs h-8 disabled:opacity-50 hover:bg-pink-700"
                style={{ backgroundColor: '#ec4899' }}
                onClick={exportSelectedCsv}
                disabled={bulkBusy || selectedIds.size === 0}
              >
                Exportar seleccionadas (CSV)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barra informativa */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs text-gray-700">
          {loading ? 'Cargando…' : `${total} orden${total === 1 ? '' : 'es'} • Mostrando ${from}–${to}`}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-700">Por página</span>
          <select
            className="border rounded px-2 py-1 text-xs h-8"
            style={{ borderColor: ADMIN_BORDER }}
            value={limit}
            onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
          >
            {[10, 20, 50, 100].map((n) => (<option key={n} value={n}>{n}</option>))}
          </select>
        </div>
      </div>

      {/* Error */}
      {err && (
        <div className="mb-2 rounded p-2 text-xs text-red-700 border bg-red-50" style={{ borderColor: '#fecaca' }}>
          {err}
        </div>
      )}

      {/* Tabla */}
      <div className="overflow-x-auto rounded-lg border bg-white" style={{ borderColor: ADMIN_BORDER }}>
        <table className="min-w-full">
          <thead className="text-[11px] bg-pink-50">
            <tr>
              <th className="p-2.5 border-b" style={{ borderColor: ADMIN_BORDER }}>
                <input
                  type="checkbox"
                  className="accent-pink-600"
                  checked={data.length > 0 && data.every((o) => selectedIds.has(o._id))}
                  onChange={toggleSelectAllVisible}
                  aria-label="Seleccionar todos"
                />
              </th>
              {/* Fecha */}
              <th
                className="text-left p-2.5 border-b whitespace-nowrap select-none cursor-pointer"
                style={{ borderColor: ADMIN_BORDER }}
                onClick={() => toggleSort('createdAt')}
                aria-sort={sortAria('createdAt')}
                title="Ordenar por fecha"
              >
                <span className="inline-flex items-center gap-1">
                  Fecha <span className="opacity-70">{sortIcon('createdAt')}</span>
                </span>
              </th>
              {/* # Orden */}
              <th
                className="text-left p-2.5 border-b whitespace-nowrap select-none cursor-pointer font-mono"
                style={{ borderColor: ADMIN_BORDER }}
                onClick={() => toggleSort('orderNumber')}
                aria-sort={sortAria('orderNumber')}
                title="Ordenar por # de orden"
              >
                <span className="inline-flex items-center gap-1">
                  # Orden <span className="opacity-70">{sortIcon('orderNumber')}</span>
                </span>
              </th>
              <th className="text-left p-2.5 border-b whitespace-nowrap" style={{ borderColor: ADMIN_BORDER }}>Cliente</th>
              <th className="text-left p-2.5 border-b whitespace-nowrap" style={{ borderColor: ADMIN_BORDER }}>Email/Teléfono</th>
              <th className="text-left p-2.5 border-b whitespace-nowrap" style={{ borderColor: ADMIN_BORDER }}>Ítems</th>
              <th className="text-left p-2.5 border-b whitespace-nowrap" style={{ borderColor: ADMIN_BORDER }}>Cant. total</th>
              <th className="text-left p-2.5 border-b whitespace-nowrap" style={{ borderColor: ADMIN_BORDER }}>Subtotal</th>
              {/* Total */}
              <th
                className="text-left p-2.5 border-b whitespace-nowrap select-none cursor-pointer"
                style={{ borderColor: ADMIN_BORDER }}
                onClick={() => toggleSort('total')}
                aria-sort={sortAria('total')}
                title="Ordenar por total"
              >
                <span className="inline-flex items-center gap-1">
                  Total <span className="opacity-70">{sortIcon('total')}</span>
                </span>
              </th>
              <th className="text-left p-2.5 border-b whitespace-nowrap" style={{ borderColor: ADMIN_BORDER }}>Estado</th>
              <th className="text-left p-2.5 border-b whitespace-nowrap" style={{ borderColor: ADMIN_BORDER }}>Tags</th>
              <th className="text-left p-2.5 border-b whitespace-nowrap" style={{ borderColor: ADMIN_BORDER }}>Acciones</th>
            </tr>
          </thead>
          <tbody className="text-xs">
            {loading &&
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={`sk-${i}`} className="animate-pulse">
                  {Array.from({ length: 12 }).map((__, j) => (
                    <td key={j} className="p-2.5 border-b text-gray-400" style={{ borderColor: ADMIN_BORDER }}>…</td>
                  ))}
                </tr>
              ))}
            {!loading && data.length === 0 && (
              <tr>
                <td colSpan={12} className="p-4 text-center text-gray-500">Sin resultados</td>
              </tr>
            )}
            {!loading && data.map((o) => {
              const cust = o.customer || {};
              const name = [cust.name, cust.lastname].filter(Boolean).join(' ') || '—';
              const tags = Array.isArray(o.tags) ? o.tags : [];
              return (
                <tr key={o._id} className="hover:bg-pink-50/40 align-top">
                  <td className="p-2.5 border-b" style={{ borderColor: ADMIN_BORDER }}>
                    <input
                      type="checkbox"
                      className="accent-pink-600"
                      checked={isSelected(o._id)}
                      onChange={() => toggleOne(o._id)}
                      aria-label={`Seleccionar orden ${o.orderNumber || o._id}`}
                    />
                  </td>
                  <td className="p-2.5 border-b whitespace-nowrap" style={{ borderColor: ADMIN_BORDER }}>{fmtDate(o.createdAt)}</td>
                  <td className="p-2.5 border-b font-mono text-[11px] whitespace-nowrap" style={{ borderColor: ADMIN_BORDER }}>{o.orderNumber || '—'}</td>
                  <td className="p-2.5 border-b" style={{ borderColor: ADMIN_BORDER }}>{name}</td>
                  <td className="p-2.5 border-b" style={{ borderColor: ADMIN_BORDER }}>{cust.emailOrPhone || cust.email || '—'}</td>
                  <td className="p-2.5 border-b text-right" style={{ borderColor: ADMIN_BORDER }}>{o.itemsCount ?? 0}</td>
                  <td className="p-2.5 border-b text-right" style={{ borderColor: ADMIN_BORDER }}>{o.totalItems ?? 0}</td>
                  <td className="p-2.5 border-b text-right whitespace-nowrap" style={{ borderColor: ADMIN_BORDER }}>{toCOP(o.subtotal ?? 0)}</td>
                  <td className="p-2.5 border-b text-right whitespace-nowrap" style={{ borderColor: ADMIN_BORDER }}>{toCOP(o.total ?? 0)}</td>
                  <td className="p-2.5 border-b" style={{ borderColor: ADMIN_BORDER }}>
                    <span className={`px-2 py-0.5 rounded text-[11px] ${statusBadgeClasses(o.status)}`}>
                      {o.status || '—'}
                    </span>
                  </td>
                  <td className="p-2.5 border-b" style={{ borderColor: ADMIN_BORDER }}>
                    {tags.length === 0 ? (
                      <span className="text-gray-400 text-[11px]">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {tags.map((t) => (
                          <span key={t} className="px-2 py-0.5 rounded-full text-[10px] border bg-pink-50" style={{ borderColor: ADMIN_BORDER }}>
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="p-2.5 border-b" style={{ borderColor: ADMIN_BORDER }}>
                    <button
                      className="px-2.5 py-1 rounded border text-[11px] hover:bg-pink-50 whitespace-nowrap"
                      style={{ borderColor: ADMIN_BORDER }}
                      onClick={() => openOrderDetail(o)}
                    >
                      Ver
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      <div className="mt-2 flex items-center justify-between">
        <div className="text-xs text-gray-600">Página {page} de {totalPages}</div>
        <div className="flex items-center gap-2">
          <button
            className="px-2.5 py-1 rounded border text-xs disabled:opacity-50 hover:bg-pink-50"
            style={{ borderColor: ADMIN_BORDER }}
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ← Anterior
          </button>
          <button
            className="px-2.5 py-1 rounded border text-xs disabled:opacity-50 hover:bg-pink-50"
            style={{ borderColor: ADMIN_BORDER }}
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Siguiente →
          </button>
        </div>
      </div>

      {/* Modal */}
      <OrderDetailModal
        open={showDetail}
        onClose={() => setShowDetail(false)}
        order={orderSelected}
        onSaveStatus={saveStatus}
        onSaveTags={saveTags}
        onTogglePrinted={togglePrinted}     // 👈 pasa handler
        onToggleArchived={toggleArchived}   // 👈 pasa handler
        savingId={savingId}
        populated={populate}
      />
    </div>
  );
}