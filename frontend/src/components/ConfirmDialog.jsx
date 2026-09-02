// frontend/src/components/ConfirmDialog.jsx
import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

const TONE_CONFIG = {
  danger: {
    icon: AlertTriangle,
    accent: 'var(--admin-danger, #ef4444)',
    softBg: 'var(--admin-danger-soft-bg, rgba(239,68,68,0.12))',
    text: 'var(--admin-danger-text, #b91c1c)',
    confirmText: 'Sí, continuar',
  },
  warning: {
    icon: AlertTriangle,
    accent: 'var(--admin-warning, #f59e0b)',
    softBg: 'var(--admin-warning-soft-bg, rgba(245,158,11,0.13))',
    text: 'var(--admin-warning-text, #92400e)',
    confirmText: 'Continuar',
  },
  success: {
    icon: CheckCircle2,
    accent: '#22c55e',
    softBg: 'color-mix(in srgb, #22c55e 13%, var(--admin-card-bg, #fff))',
    text: 'color-mix(in srgb, #22c55e 78%, var(--admin-card-text, #111827))',
    confirmText: 'Aceptar',
  },
  info: {
    icon: Info,
    accent: 'var(--admin-primary, #ec4899)',
    softBg: 'var(--admin-primary-soft-bg, rgba(236,72,153,0.12))',
    text: 'var(--admin-primary, #ec4899)',
    confirmText: 'Aceptar',
  },
};

export default function ConfirmDialog({
  show,
  onClose,
  onConfirm,
  title = 'Confirmación',
  message,
  children,
  confirmLabel,
  cancelLabel = 'Cancelar',
  tone = 'danger',
  confirmDisabled = false,
  loading = false,
}) {
  const config = TONE_CONFIG[tone] || TONE_CONFIG.danger;
  const Icon = config.icon;

  useEffect(() => {
    if (!show) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !loading) onClose?.();
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [show, onClose, loading]);

  if (!show) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100000] flex min-h-screen items-center justify-center px-4 py-6"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-black/55 backdrop-blur-[4px]"
        onClick={loading ? undefined : onClose}
        aria-label="Cerrar confirmación"
      />

      <section
        className="relative w-full max-w-md overflow-hidden rounded-[28px] border p-0 shadow-2xl animate-[confirmZoomIn_.16s_ease-out]"
        style={{
          borderColor: 'var(--admin-card-border, #f9a8d4)',
          background:
            'linear-gradient(135deg, color-mix(in srgb, var(--admin-card-bg, #fff) 94%, var(--admin-primary, #ec4899) 6%), var(--admin-card-bg, #fff))',
          color: 'var(--admin-card-text, #111827)',
          boxShadow: '0 32px 110px rgba(0,0,0,0.34)',
        }}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start gap-4 px-6 pb-5 pt-6">
          <span
            className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border"
            style={{
              borderColor: 'color-mix(in srgb, var(--admin-card-border, #f9a8d4) 75%, transparent)',
              background: config.softBg,
              color: config.text,
            }}
          >
            <Icon className="h-6 w-6" />
          </span>

          <div className="min-w-0 flex-1">
            <p
              className="text-[10px] font-black uppercase tracking-[0.22em]"
              style={{ color: 'var(--admin-primary, #ec4899)' }}
            >
              Acción requerida
            </p>
            <h3 className="mt-1 text-xl font-black leading-tight">
              {title}
            </h3>
            {!children ? (
              <p
                className="mt-3 text-sm font-semibold leading-relaxed"
                style={{ color: 'var(--admin-card-muted-text, #64748b)' }}
              >
                {message || '¿Deseas continuar con esta acción?'}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              borderColor: 'var(--admin-button-soft-border, #f9a8d4)',
              background: 'var(--admin-button-soft-bg, #fff1f2)',
              color: 'var(--admin-card-text, #111827)',
            }}
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {children ? <div className="px-6 pb-6">{children}</div> : null}

        <div
          className="flex flex-wrap justify-end gap-3 border-t px-6 py-4"
          style={{ borderColor: 'var(--admin-card-border, #f9a8d4)' }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="inline-flex min-h-11 items-center justify-center rounded-full border px-5 text-sm font-black transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              borderColor: 'var(--admin-button-soft-border, #f9a8d4)',
              background: 'var(--admin-button-soft-bg, #fff1f2)',
              color: 'var(--admin-card-text, #111827)',
            }}
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={loading || confirmDisabled}
            className="inline-flex min-h-11 items-center justify-center rounded-full px-5 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              background:
                'linear-gradient(135deg, var(--admin-button-bg, var(--admin-primary, #ec4899)), color-mix(in srgb, var(--admin-button-bg, var(--admin-primary, #ec4899)) 72%, #0f172a 28%))',
              boxShadow: '0 16px 36px color-mix(in srgb, var(--admin-button-bg, var(--admin-primary, #ec4899)) 24%, transparent)',
              textShadow: '0 1px 8px rgba(0,0,0,0.35)',
            }}
          >
            {loading ? 'Procesando…' : (confirmLabel || config.confirmText)}
          </button>
        </div>

        <div
          className="h-1 w-full"
          style={{ background: `linear-gradient(90deg, ${config.accent}, transparent)` }}
        />

        <style>{`
          @keyframes confirmZoomIn {
            from { transform: translateY(8px) scale(0.96); opacity: 0.55; }
            to { transform: translateY(0) scale(1); opacity: 1; }
          }
        `}</style>
      </section>
    </div>,
    document.body
  );
}
