// frontend/src/components/ConfirmDialog.jsx
import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function ConfirmDialog({ show, onClose, onConfirm, message }) {
  useEffect(() => {
    if (!show) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [show, onClose]);

  if (!show) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex min-h-screen items-center justify-center px-4 py-6"
      role="presentation"
    >
      <div
        className="absolute inset-0 bg-black/55 backdrop-blur-[3px]"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className="relative w-full max-w-sm rounded-2xl border p-6 shadow-2xl animate-[confirmZoomIn_.15s_ease-out]"
        style={{
          borderColor: 'var(--admin-card-border, #f9a8d4)',
          background: 'var(--admin-card-bg, #ffffff)',
          color: 'var(--admin-card-text, #111827)',
          boxShadow: '0 28px 90px rgba(0,0,0,0.32)',
        }}
        role="dialog"
        aria-modal="true"
      >
        <h3 className="mb-3 text-lg font-black">
          Confirmación
        </h3>

        <p
          className="mb-5 text-sm font-semibold leading-relaxed"
          style={{ color: 'var(--admin-card-muted-text, #64748b)' }}
        >
          {message}
        </p>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border px-4 py-2 text-sm font-black transition hover:-translate-y-0.5"
            style={{
              borderColor: 'var(--admin-button-soft-border, #f9a8d4)',
              background: 'var(--admin-button-soft-bg, #fff1f2)',
              color: 'var(--admin-card-text, #111827)',
            }}
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={onConfirm}
            className="rounded-xl px-4 py-2 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5"
            style={{
              background:
                'linear-gradient(135deg, var(--admin-danger, #ef4444), color-mix(in srgb, var(--admin-danger, #ef4444) 78%, #0f172a 22%))',
              textShadow: '0 1px 8px rgba(0,0,0,0.35)',
            }}
          >
            Sí, eliminar
          </button>
        </div>

        <style>{`
          @keyframes confirmZoomIn {
            from { transform: scale(0.96); opacity: 0.55; }
            to { transform: scale(1); opacity: 1; }
          }
        `}</style>
      </div>
    </div>,
    document.body
  );
}
