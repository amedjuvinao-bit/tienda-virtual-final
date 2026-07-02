// frontend/src/admin/users/UserPasswordModal.jsx

import { useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function UserPasswordModal({
  open,
  user,
  form,
  setForm,
  saving,
  error,
  onClose,
  onSubmit,
}) {
  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  const updateField = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const userName =
    user?.displayName ||
    `${user?.firstName || ''} ${user?.lastName || ''}`.trim() ||
    user?.username ||
    'Usuario';

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-pink-950/20 p-4 backdrop-blur-[6px]">
      <button
        type="button"
        aria-label="Cerrar cambio de contraseña"
        className="absolute inset-0 h-full w-full cursor-default"
        onClick={onClose}
      />

      <form
        onSubmit={onSubmit}
        className="relative z-10 w-full max-w-xl overflow-hidden rounded-[32px] border shadow-2xl"
        style={{
          background: 'var(--admin-card-bg)',
          borderColor: 'var(--admin-card-border)',
          color: 'var(--admin-card-text)',
        }}
      >
        <div
          className="border-b px-5 py-4 md:px-6"
          style={{
            borderColor: 'var(--admin-card-border)',
            background:
              'linear-gradient(135deg, rgba(255,255,255,0.42), rgba(255,255,255,0.10))',
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p
                className="text-xs font-black uppercase tracking-[0.25em]"
                style={{ color: 'var(--admin-card-muted)' }}
              >
                Seguridad de acceso
              </p>

              <h3 className="mt-2 text-2xl font-black">
                Cambiar contraseña
              </h3>

              <p
                className="mt-1 text-sm leading-6"
                style={{ color: 'var(--admin-card-muted)' }}
              >
                Usuario: <strong>{userName}</strong>
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border text-xl font-black transition hover:scale-105 disabled:opacity-60"
              style={{
                borderColor: 'var(--admin-card-border)',
                color: 'var(--admin-card-text)',
                background: 'rgba(255,255,255,0.35)',
              }}
            >
              ×
            </button>
          </div>
        </div>

        <div className="grid gap-4 p-5 md:p-6">
          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {error}
            </div>
          )}

          <label className="grid gap-2">
            <span className="text-sm font-bold">Nueva contraseña *</span>
            <input
              type="password"
              value={form.password}
              onChange={(event) => updateField('password', event.target.value)}
              className="rounded-2xl border px-4 py-3 text-sm outline-none"
              placeholder="Mínimo 8 caracteres"
              required
              style={{
                background: 'var(--admin-input-bg)',
                borderColor: 'var(--admin-card-border)',
                color: 'var(--admin-card-text)',
              }}
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-bold">Confirmar contraseña *</span>
            <input
              type="password"
              value={form.confirmPassword}
              onChange={(event) =>
                updateField('confirmPassword', event.target.value)
              }
              className="rounded-2xl border px-4 py-3 text-sm outline-none"
              placeholder="Repite la nueva contraseña"
              required
              style={{
                background: 'var(--admin-input-bg)',
                borderColor: 'var(--admin-card-border)',
                color: 'var(--admin-card-text)',
              }}
            />
          </label>

          <label
            className="flex items-center gap-3 rounded-2xl border px-4 py-3"
            style={{
              borderColor: 'var(--admin-card-border)',
              background: 'rgba(255,255,255,0.14)',
            }}
          >
            <input
              type="checkbox"
              checked={form.mustChangePassword}
              onChange={(event) =>
                updateField('mustChangePassword', event.target.checked)
              }
              className="h-4 w-4 accent-pink-500"
            />

            <span className="text-sm font-bold">
              Obligar a cambiar contraseña al próximo ingreso
            </span>
          </label>
        </div>

        <div
          className="flex flex-col-reverse gap-3 border-t px-5 py-4 sm:flex-row sm:justify-end md:px-6"
          style={{ borderColor: 'var(--admin-card-border)' }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-2xl border px-5 py-2.5 text-sm font-bold transition disabled:opacity-60"
            style={{
              borderColor: 'var(--admin-card-border)',
              color: 'var(--admin-card-text)',
              background: 'rgba(255,255,255,0.20)',
            }}
          >
            Cancelar
          </button>

          <button
            type="submit"
            disabled={saving}
            className="rounded-2xl bg-pink-500 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-pink-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Guardando...' : 'Cambiar contraseña'}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}