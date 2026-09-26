import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Clock3, X } from 'lucide-react';

export default function UserActivityModal({ user, events, pagination, loading, error, onPageChange, onClose }) {
  useEffect(() => {
    if (!user) return undefined;
    const onEscape = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [user, onClose]);

  if (!user || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[99999] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <section role="dialog" aria-modal="true" aria-labelledby="user-activity-title"
        className="flex max-h-[88vh] w-full max-w-2xl flex-col rounded-3xl border p-5 shadow-2xl"
        style={{ background: 'var(--admin-modal-bg)', color: 'var(--admin-modal-text)', borderColor: 'var(--admin-card-border)' }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--admin-primary)' }}>Trazabilidad</p>
            <h2 id="user-activity-title" className="mt-1 text-xl font-black">Actividad de @{user.username}</h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--admin-modal-muted-text)' }}>
              Cambios de acceso, perfil, contraseña y 2FA registrados para esta cuenta.
            </p>
          </div>
          <button type="button" aria-label="Cerrar actividad" onClick={onClose}
            className="rounded-xl border p-2" style={{ borderColor: 'var(--admin-card-border)' }}>
            <X size={18} />
          </button>
        </div>

        <div className="mt-5 min-h-0 overflow-y-auto" aria-live="polite">
          {loading && <p className="py-5 text-sm">Cargando actividad...</p>}
          {error && <p role="alert" className="rounded-xl p-3 text-sm"
            style={{ color: 'var(--admin-danger-text)', background: 'var(--admin-danger-soft-bg)' }}>{error}</p>}
          {!loading && !error && events.length === 0 &&
            <p className="rounded-xl border p-4 text-sm" style={{ borderColor: 'var(--admin-card-border)' }}>
              Aún no hay cambios administrativos registrados para esta cuenta.
            </p>}
          {!loading && !error && events.map((event) => (
            <article key={event._id} className="mb-2 rounded-xl border p-3"
              style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-card-bg)' }}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong className="text-sm">{event.description || event.action || 'Cambio administrativo'}</strong>
                <span className="text-xs font-bold" style={{ color: event.success === false
                  ? 'var(--admin-danger-text)' : 'var(--admin-primary-soft-text)' }}>
                  {event.success === false ? 'No realizado' : 'Realizado'}
                </span>
              </div>
              <p className="mt-1 flex flex-wrap items-center gap-1 text-xs"
                style={{ color: 'var(--admin-card-muted-text)' }}>
                <Clock3 size={13} aria-hidden="true" />
                {event.createdAt ? new Date(event.createdAt).toLocaleString('es-CO') : 'Sin fecha'}
                {' · '}Por @{event.adminUsername || 'sistema'}
              </p>
            </article>
          ))}
        </div>

        {!loading && !error && pagination.pages > 1 &&
          <nav aria-label="Páginas de actividad" className="mt-4 flex items-center justify-between gap-3 text-sm">
            <button type="button" disabled={pagination.page <= 1}
              onClick={() => onPageChange(pagination.page - 1)} className="rounded-xl border px-3 py-2 disabled:opacity-50"
              style={{ borderColor: 'var(--admin-card-border)' }}>Anterior</button>
            <span>Página {pagination.page} de {pagination.pages}</span>
            <button type="button" disabled={pagination.page >= pagination.pages}
              onClick={() => onPageChange(pagination.page + 1)} className="rounded-xl border px-3 py-2 disabled:opacity-50"
              style={{ borderColor: 'var(--admin-card-border)' }}>Siguiente</button>
          </nav>}
      </section>
    </div>,
    document.body
  );
}
