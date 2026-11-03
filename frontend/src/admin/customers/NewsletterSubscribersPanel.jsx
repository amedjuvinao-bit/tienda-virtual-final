import React, { useEffect, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Eye, Mail, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { getAdminSubscription, getAdminSubscriptions } from '../api/adminSubscriptionsApi';
import './newsletterSubscribers.css';

const STATUS_LABELS = {
  granted: 'Autorizadas',
  withdrawn: 'Retiradas',
  unknown: 'Sin autorización comprobada',
};

function dateLabel(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime())
    ? date.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })
    : 'Sin registro';
}

function methodLabel(value) {
  if (value === 'email_code') return 'Código enviado al correo';
  if (value === 'admin_reference') return 'Referencia administrativa';
  return 'Sin registro';
}

function Status({ value }) {
  const status = Object.hasOwn(STATUS_LABELS, value) ? value : 'unknown';
  return <span className={`subscriber-status subscriber-status--${status}`}>{STATUS_LABELS[status]}</span>;
}

function Pagination({ page, pages, onChange, label }) {
  if (pages <= 1) return null;
  return (
    <nav className="subscriber-pagination" aria-label={label}>
      <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label={`${label}: anterior`}><ChevronLeft size={16} /> Anterior</button>
      <span>Página {page} de {pages}</span>
      <button type="button" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label={`${label}: siguiente`}>Siguiente <ChevronRight size={16} /></button>
    </nav>
  );
}

function Proof({ proof }) {
  if (!proof) return <p className="subscriber-muted">Sin evidencia registrada.</p>;
  return (
    <div className="subscriber-proof">
      <dl>
        <div><dt>Método</dt><dd>{methodLabel(proof.method)}</dd></div>
        <div><dt>Fecha de decisión</dt><dd>{dateLabel(proof.recordedAt || proof.confirmedAt)}</dd></div>
        <div><dt>Referencia de evidencia</dt><dd>{proof.proofReference || 'Sin registro'}</dd></div>
        <div><dt>Versión del aviso</dt><dd>{proof.version || 'Sin registro'}</dd></div>
      </dl>
      {proof.text ? <p className="subscriber-notice">{proof.text}</p> : null}
      {proof.privacyText ? (
        <details><summary>Ver el aviso de privacidad comunicado</summary><p className="subscriber-notice">{proof.privacyText}</p></details>
      ) : null}
      {proof.seller?.legalName ? <p className="subscriber-muted">Responsable informado: {proof.seller.legalName}</p> : null}
    </div>
  );
}

function SubscriptionDetail({ id, reload, onClose }) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    setData(null);
    setError('');
    getAdminSubscription(id, { page }, { signal: controller.signal })
      .then(result => { if (active) setData(result); })
      .catch(err => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [id, page, reload]);

  return (
    <section className="subscriber-detail customer-admin-surface" aria-label="Detalle de suscripción">
      <button type="button" className="subscriber-back" onClick={onClose}><ArrowLeft size={16} /> Volver al listado</button>
      {loading ? <p role="status">Consultando la suscripción…</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      {!loading && data ? (
        <>
          <header className="subscriber-detail-heading"><div><p className="subscriber-eyebrow">Comunicaciones por correo</p><h3>{data.subscriber.email}</h3></div><Status value={data.subscriber.status} /></header>
          <p className="subscriber-muted">
            {data.subscriber.status === 'withdrawn'
              ? 'Esta persona retiró las comunicaciones comerciales por correo. Sus pedidos y notificaciones de compra continúan funcionando.'
              : data.subscriber.status === 'granted'
                ? 'La autorización para recibir comunicaciones comerciales por correo está registrada.'
                : 'Este correo aún no tiene una autorización comprobada para recibir comunicaciones comerciales.'}
          </p>
          <h4>Última decisión registrada</h4>
          <Proof proof={data.subscriber.consent} />
          <div className="subscriber-history-heading"><ShieldCheck size={18} /><h4>Historial de autorizaciones y retiros</h4><span>{data.total}</span></div>
          {data.events.length ? (
            <ol className="subscriber-history">
              {data.events.map(event => (
                <li key={event.id}><details><summary><strong>{event.proof?.status === 'withdrawn' ? 'Retiro' : event.proof?.status === 'granted' ? 'Autorización' : 'Decisión registrada'}</strong><span>{dateLabel(event.proof?.recordedAt || event.createdAt)}</span></summary><Proof proof={event.proof} /></details></li>
              ))}
            </ol>
          ) : <p className="subscriber-muted">No hay decisiones verificadas en el historial.</p>}
          <Pagination page={data.page} pages={data.pages} onChange={setPage} label="Historial" />
        </>
      ) : null}
    </section>
  );
}

export default function NewsletterSubscribersPanel({ initialSearch = '' }) {
  const [search, setSearch] = useState(initialSearch);
  const [q, setQ] = useState(initialSearch);
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    setData(null);
    setError('');
    getAdminSubscriptions({ q, status, page }, { signal: controller.signal })
      .then(result => { if (active) setData(result); })
      .catch(err => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [q, status, page, reload]);

  function searchSubscribers(event) {
    event.preventDefault();
    setSelectedId(null);
    setPage(1);
    setQ(search.trim());
    setReload(value => value + 1);
  }

  return (
    <div className="subscriber-workspace">
      <section className="subscriber-panel customer-admin-surface" aria-label="Suscriptores por correo">
        <header className="subscriber-heading">
          <div><p className="subscriber-eyebrow">Comunicaciones por correo</p><h2>Suscriptores</h2><p className="subscriber-muted">Consulta las autorizaciones y los retiros, también de personas que todavía no son clientes.</p></div>
          <button type="button" onClick={() => setReload(value => value + 1)} disabled={loading}><RefreshCw size={16} /> Actualizar suscriptores</button>
        </header>
        <form className="subscriber-filters" onSubmit={searchSubscribers}>
          <label><span>Buscar por correo</span><div className="subscriber-search"><Search size={17} aria-hidden="true" /><input type="search" maxLength={254} value={search} onChange={event => setSearch(event.target.value)} placeholder="nombre@correo.com" /></div></label>
          <label><span>Estado de comunicaciones</span><select value={status} onChange={event => { setSelectedId(null); setPage(1); setQ(search.trim()); setStatus(event.target.value); }}><option value="all">Todos los estados</option><option value="granted">Autorizadas</option><option value="withdrawn">Retiradas</option><option value="unknown">Sin autorización comprobada</option></select></label>
          <button type="submit" className="subscriber-primary">Buscar</button>
        </form>
        {loading ? <p role="status" className="subscriber-feedback">Consultando suscriptores…</p> : null}
        {error ? <p role="alert" className="subscriber-feedback">{error}</p> : null}
        {!loading && data && !selectedId ? (
          <>
            <p className="subscriber-count" role="status">{data.total} resultado{data.total === 1 ? '' : 's'}</p>
            {data.subscribers.length ? (
              <ul className="subscriber-list">
                {data.subscribers.map(subscriber => (
                  <li key={subscriber.id}>
                    <div className="subscriber-contact"><Mail size={18} aria-hidden="true" /><div><strong>{subscriber.email}</strong><small>Última decisión: {dateLabel(subscriber.decisionAt)}</small></div></div>
                    <Status value={subscriber.status} />
                    <button type="button" onClick={() => setSelectedId(subscriber.id)} aria-expanded={selectedId === subscriber.id} aria-label={`Ver evidencia de ${subscriber.email}`}><Eye size={16} /> Ver evidencia</button>
                  </li>
                ))}
              </ul>
            ) : <p className="subscriber-feedback">No se encontraron suscripciones con estos filtros.</p>}
            <Pagination page={data.page} pages={data.pages} onChange={next => { setSelectedId(null); setPage(next); }} label="Suscriptores" />
          </>
        ) : null}
      </section>
      {selectedId ? <SubscriptionDetail key={selectedId} id={selectedId} reload={reload} onClose={() => setSelectedId(null)} /> : null}
    </div>
  );
}
