// frontend/src/admin/users/UserConfirmModal.jsx

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';

export default function UserConfirmModal({
  open,
  title,
  message,
  detail,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'warning',
  loading = false,
  onClose,
  onConfirm,
}) {
  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !loading) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, loading, onClose]);

  if (!open || typeof document === 'undefined') return null;

  const isDanger = variant === 'danger';

  const accentStyle = isDanger
    ? {
        borderColor: 'var(--admin-danger)',
        background: 'var(--admin-danger-soft-bg)',
        color: 'var(--admin-danger-text)',
      }
    : {
        borderColor: 'var(--admin-warning)',
        background: 'var(--admin-warning-soft-bg)',
        color: 'var(--admin-warning-text)',
      };

  const confirmStyle = isDanger
    ? {
        borderColor: 'var(--admin-danger)',
        background: 'var(--admin-danger)',
        color: 'var(--admin-danger-text-on-bg)',
      }
    : {
        borderColor: 'var(--admin-button-bg)',
        background: 'var(--admin-button-bg)',
        color: 'var(--admin-button-text)',
      };

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 backdrop-blur-[7px]"
      style={{
        background: 'var(--admin-modal-overlay)',
      }}
    >
      <button
        type="button"
        aria-label="Cerrar confirmación"
        className="absolute inset-0 h-full w-full cursor-default"
        onClick={loading ? undefined : onClose}
      />

      <div
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-[30px] border shadow-2xl"
        style={{
          background: 'var(--admin-modal-bg)',
          borderColor: 'var(--admin-glass-border)',
          color: 'var(--admin-modal-text)',
          boxShadow: 'var(--admin-glass-shadow-hover)',
        }}
      >
        <div
          className="border-b px-5 py-4"
          style={{
            borderColor: 'var(--admin-glass-border)',
            background: 'var(--admin-glass-strong-bg)',
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border"
                style={accentStyle}
              >
                <AlertTriangle className="h-5 w-5" />
              </div>

              <div>
                <p
                  className="text-xs font-black uppercase tracking-[0.22em]"
                  style={{ color: 'var(--admin-modal-muted-text)' }}
                >
                  Confirmación requerida
                </p>

                <h3
                  className="mt-1 text-xl font-black"
                  style={{ color: 'var(--admin-modal-text)' }}
                >
                  {title}
                </h3>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-60"
              style={{
                borderColor: 'var(--admin-light-panel-border)',
                background: 'var(--admin-light-panel-bg)',
                color: 'var(--admin-light-panel-text)',
              }}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="px-5 py-5">
          <p
            className="text-sm font-bold leading-6"
            style={{ color: 'var(--admin-modal-text)' }}
          >
            {message}
          </p>

          {detail && (
            <div
              className="mt-4 rounded-2xl border px-4 py-3 text-sm leading-6"
              style={{
                borderColor: 'var(--admin-glass-border)',
                background: 'var(--admin-glass-soft-bg)',
                color: 'var(--admin-modal-muted-text)',
              }}
            >
              {detail}
            </div>
          )}
        </div>

        <div
          className="flex flex-col-reverse gap-3 border-t px-5 py-4 sm:flex-row sm:justify-end"
          style={{
            borderColor: 'var(--admin-glass-border)',
            background: 'var(--admin-glass-soft-bg)',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-2xl border px-5 py-2.5 text-sm font-black transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              borderColor: 'var(--admin-light-panel-border)',
              background: 'var(--admin-light-panel-bg)',
              color: 'var(--admin-light-panel-text)',
            }}
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="rounded-2xl border px-5 py-2.5 text-sm font-black transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            style={confirmStyle}
          >
            {loading ? 'Procesando...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}