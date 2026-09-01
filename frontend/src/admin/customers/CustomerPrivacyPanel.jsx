import React, { useEffect, useState } from 'react';
import {
  BadgeCheck,
  Ban,
  FileDown,
  History,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';

import {
  anonymizeAdminCustomer,
  exportAdminCustomerData,
  getAdminCustomerAudit,
  getAdminCustomerPrivacy,
  updateAdminCustomerConsent,
} from '../api/adminCustomersApi';

function formatDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return 'Sin registro';
  return date.toLocaleString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function downloadJson(payload, customerCode) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `cliente-${customerCode || 'expediente'}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

export default function CustomerPrivacyPanel({ customer, access = {}, onUpdated }) {
  const [privacyData, setPrivacyData] = useState(null);
  const [auditData, setAuditData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [consent, setConsent] = useState({
    status: 'granted',
    source: 'admin',
    proofReference: '',
    note: '',
  });
  const [confirmation, setConfirmation] = useState('');

  const load = async () => {
    if (!customer?.id || !access.audit) return;
    try {
      setLoading(true);
      setError('');
      const [privacy, audit] = await Promise.all([
        getAdminCustomerPrivacy(customer.id),
        getAdminCustomerAudit(customer.id, { limit: 100 }),
      ]);
      setPrivacyData(privacy || null);
      setAuditData(audit || null);
    } catch (err) {
      setError(err?.message || 'No fue posible cargar privacidad y auditoría.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [customer?.id, access.audit]);

  if (!access.audit) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        <p className="font-black">Información protegida</p>
        <p className="mt-1">Tu perfil no tiene el permiso `customers:audit`.</p>
      </div>
    );
  }

  const saveConsent = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');
      const response = await updateAdminCustomerConsent(customer.id, consent);
      setSuccess('Consentimiento registrado con trazabilidad.');
      setConsent((current) => ({ ...current, proofReference: '', note: '' }));
      if (response?.customer) onUpdated?.(response.customer);
      await load();
    } catch (err) {
      setError(err?.message || 'No fue posible registrar el consentimiento.');
    } finally {
      setSaving(false);
    }
  };

  const exportData = async () => {
    try {
      setSaving(true);
      setError('');
      const response = await exportAdminCustomerData(customer.id);
      downloadJson(response, customer.customerCode);
      setSuccess('Expediente exportado y auditado.');
      await load();
    } catch (err) {
      setError(err?.message || 'No fue posible exportar el expediente.');
    } finally {
      setSaving(false);
    }
  };

  const anonymize = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');
      const response = await anonymizeAdminCustomer(customer.id, confirmation);
      setSuccess('Ficha anonimizada. Las órdenes legalmente conservadas no se alteraron.');
      setConfirmation('');
      if (response?.customer) onUpdated?.(response.customer);
      await load();
    } catch (err) {
      setError(err?.message || 'No fue posible anonimizar el cliente.');
    } finally {
      setSaving(false);
    }
  };

  const privacy = privacyData?.privacy || {};
  const retention = privacy.retention || {};
  const events = Array.isArray(auditData?.events) ? auditData.events : [];
  const currentConsent = privacyData?.consent || customer?.marketingConsent || {};

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-3xl border bg-white p-5 lg:flex-row lg:items-start lg:justify-between" style={{ borderColor: 'rgba(236,72,153,0.16)' }}>
        <div>
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em]" style={{ color: 'var(--admin-primary)' }}><ShieldCheck className="h-4 w-4" /> Privacidad y conservación</p>
          <p className="mt-2 text-sm font-bold" style={{ color: 'var(--admin-card-text)' }}>Estado: {privacy.status || customer?.privacyStatus || 'active'} · Consentimiento: {currentConsent.status || 'unknown'}</p>
          <p className="mt-1 text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>Conservación hasta: {formatDate(retention.retentionUntil)} · Política: {Number(retention.retentionDays || 0)} días</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={load} disabled={loading} className="inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-xs font-black disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar</button>
          {access.export ? <button type="button" onClick={exportData} disabled={saving} className="inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-xs font-black" style={{ color: 'var(--admin-primary)' }}><FileDown className="h-4 w-4" /> Exportar expediente</button> : null}
        </div>
      </div>

      {error ? <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</p> : null}
      {success ? <p className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">{success}</p> : null}
      {loading && !privacyData ? <div className="rounded-3xl border p-8 text-center"><Loader2 className="mx-auto h-7 w-7 animate-spin" /><p className="mt-2 text-sm font-black">Cargando trazabilidad...</p></div> : null}

      {access.consent ? (
        <section className="rounded-3xl border bg-white p-5" style={{ borderColor: 'rgba(236,72,153,0.16)' }}>
          <h3 className="text-lg font-black">Consentimiento comercial</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <select value={consent.status} onChange={(event) => setConsent((current) => ({ ...current, status: event.target.value }))} className="rounded-2xl border px-4 py-3 text-sm font-bold"><option value="granted">Otorgado</option><option value="withdrawn">Retirado</option></select>
            <select value={consent.source} onChange={(event) => setConsent((current) => ({ ...current, source: event.target.value }))} className="rounded-2xl border px-4 py-3 text-sm font-bold"><option value="admin">Administración</option><option value="web">Web</option><option value="pos">POS</option><option value="whatsapp">WhatsApp</option><option value="phone">Teléfono</option><option value="email">Correo</option><option value="paper">Documento físico</option></select>
            <input value={consent.proofReference} onChange={(event) => setConsent((current) => ({ ...current, proofReference: event.target.value }))} placeholder="Referencia de evidencia" className="rounded-2xl border px-4 py-3 text-sm font-bold" />
            <input value={consent.note} onChange={(event) => setConsent((current) => ({ ...current, note: event.target.value }))} placeholder="Nota de soporte" className="rounded-2xl border px-4 py-3 text-sm font-bold" />
          </div>
          <button type="button" onClick={saveConsent} disabled={saving || (consent.status === 'granted' && consent.proofReference.trim().length < 3)} className="mt-3 inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-xs font-black text-white disabled:opacity-50" style={{ background: 'var(--admin-primary)' }}><BadgeCheck className="h-4 w-4" /> Registrar consentimiento</button>
        </section>
      ) : null}

      {access.anonymize ? (
        <section className="rounded-3xl border border-red-200 bg-red-50 p-5">
          <h3 className="flex items-center gap-2 text-lg font-black text-red-800"><Ban className="h-5 w-5" /> Anonimización controlada</h3>
          <p className="mt-1 text-sm font-bold text-red-700">{retention.eligibleForAnonymization ? 'El cliente es elegible según la política configurada.' : `No es elegible hasta ${formatDate(retention.retentionUntil)}.`}</p>
          {retention.eligibleForAnonymization ? <div className="mt-3 flex flex-col gap-2 md:flex-row"><input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder={privacy.confirmationPhrase || 'Frase de confirmación'} className="min-w-0 flex-1 rounded-2xl border border-red-200 bg-white px-4 py-3 text-sm font-bold" /><button type="button" onClick={anonymize} disabled={saving || confirmation !== privacy.confirmationPhrase} className="rounded-2xl bg-red-700 px-4 py-3 text-xs font-black text-white disabled:opacity-50">Anonimizar definitivamente</button></div> : null}
        </section>
      ) : null}

      <section className="rounded-3xl border bg-white p-5" style={{ borderColor: 'rgba(236,72,153,0.16)' }}>
        <div className="flex items-center justify-between gap-3"><div><h3 className="flex items-center gap-2 text-lg font-black"><History className="h-5 w-5" /> Historial inmutable</h3><p className="mt-1 text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>{auditData?.integrityVerified ? 'Cadena criptográfica verificada' : 'Cadena pendiente de verificación'} · {Number(auditData?.coverage?.total || events.length)} evento(s)</p></div></div>
        <div className="mt-4 space-y-3">
          {!events.length ? <p className="rounded-2xl border p-4 text-sm font-bold">Sin eventos registrados.</p> : events.map((event) => <article key={event.id} className="rounded-2xl border p-4" style={{ borderColor: 'rgba(236,72,153,0.16)' }}><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-sm font-black">{event.action}</p><p className="mt-1 text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>{event.actor?.name || 'Sistema'} · {formatDate(event.createdAt)}</p></div><span className="rounded-xl border px-2.5 py-1 text-[10px] font-black uppercase">{event.eventType}</span></div>{event.changes?.length ? <p className="mt-2 text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>Campos: {event.changes.map((change) => change.path).join(', ')}</p> : null}</article>)}
        </div>
      </section>
    </div>
  );
}
