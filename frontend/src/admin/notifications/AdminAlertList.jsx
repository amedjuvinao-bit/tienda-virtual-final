import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function AdminAlertList({ alerts, partial, loading, onNavigate, refresh }) {
  return (
    <section aria-label="Pendientes del panel" className="grid gap-3 pb-4">
      {partial && (
        <p role="status">
          Algunas alertas no se pudieron consultar.{' '}
          <button type="button" className="underline" onClick={refresh}>Reintentar</button>
        </p>
      )}
      {loading && <p role="status">Cargando alertas…</p>}
      {!loading && !partial && !alerts.length && <p>No hay alertas pendientes.</p>}
      {alerts.map((alert) => (
        <Link key={alert.id} to={alert.href} onClick={onNavigate}
          className="admin-review-card flex items-center justify-between gap-3 rounded-xl border px-4 py-3"
          style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-soft-bg)' }}>
          <span className="min-w-0 break-words">
            <strong>{alert.title}</strong>
            {alert.reference && <small className="block">{alert.reference}</small>}
          </span>
          <span className="flex shrink-0 items-center gap-2">
            {alert.count > 0 && <span>{alert.count}</span>}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </span>
        </Link>
      ))}
    </section>
  );
}
