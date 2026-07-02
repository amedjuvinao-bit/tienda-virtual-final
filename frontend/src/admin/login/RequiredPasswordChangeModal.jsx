// frontend/src/admin/login/RequiredPasswordChangeModal.jsx

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { KeyRound, ShieldCheck, X } from 'lucide-react';
import { changeRequiredAdminPassword } from '../api/adminAuthApi';

const EMPTY_FORM = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

function validateForm(form) {
  if (!form.currentPassword) {
    return 'Escribe la contraseña temporal actual.';
  }

  if (!form.newPassword) {
    return 'Escribe la nueva contraseña.';
  }

  if (form.newPassword.length < 8) {
    return 'La nueva contraseña debe tener mínimo 8 caracteres.';
  }

  if (!form.confirmPassword) {
    return 'Confirma la nueva contraseña.';
  }

  if (form.newPassword !== form.confirmPassword) {
    return 'La confirmación de contraseña no coincide.';
  }

  if (form.currentPassword === form.newPassword) {
    return 'La nueva contraseña debe ser diferente a la contraseña temporal.';
  }

  return '';
}

export default function RequiredPasswordChangeModal({
  open,
  user,
  onSuccess,
  onCancel,
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setForm(EMPTY_FORM);
      setError('');
      setSaving(false);
    }
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  const updateField = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const validationError = validateForm(form);

    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setSaving(true);
      setError('');

      const response = await changeRequiredAdminPassword(form);

      setForm(EMPTY_FORM);
      onSuccess(response);
    } catch (err) {
      console.error('❌ Error cambiando contraseña obligatoria:', err);
      setError(
        err?.userMessage ||
          'No se pudo cambiar la contraseña. Revisa los datos e intenta nuevamente.'
      );
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 backdrop-blur-[7px]"
      style={{
        background: 'var(--admin-modal-overlay)',
      }}
    >
      <div
        className="relative z-10 w-full max-w-xl overflow-hidden rounded-[32px] border shadow-2xl"
        style={{
          background: 'var(--admin-modal-bg)',
          borderColor: 'var(--admin-glass-border)',
          color: 'var(--admin-modal-text)',
          boxShadow: 'var(--admin-glass-shadow-hover)',
        }}
      >
        <div
          className="border-b px-5 py-5 md:px-6"
          style={{
            borderColor: 'var(--admin-glass-border)',
            background: 'var(--admin-glass-strong-bg)',
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border"
                style={{
                  borderColor: 'var(--admin-primary-soft-border)',
                  background: 'var(--admin-primary-soft-bg)',
                  color: 'var(--admin-primary-soft-text)',
                }}
              >
                <ShieldCheck className="h-5 w-5" />
              </div>

              <div>
                <p
                  className="text-xs font-black uppercase tracking-[0.22em]"
                  style={{ color: 'var(--admin-modal-muted-text)' }}
                >
                  Seguridad obligatoria
                </p>

                <h2
                  className="mt-1 text-2xl font-black"
                  style={{ color: 'var(--admin-modal-text)' }}
                >
                  Cambia tu contraseña
                </h2>

                <p
                  className="mt-2 text-sm leading-6"
                  style={{ color: 'var(--admin-modal-muted-text)' }}
                >
                  Hola, {user?.displayName || user?.username || 'usuario'}. Para
                  continuar debes reemplazar tu contraseña temporal por una
                  contraseña nueva.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
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

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 px-5 py-5 md:px-6">
            {error && (
              <div
                className="rounded-2xl border px-4 py-3 text-sm font-semibold"
                style={{
                  borderColor: 'var(--admin-danger)',
                  background: 'var(--admin-danger-soft-bg)',
                  color: 'var(--admin-danger-text)',
                }}
              >
                {error}
              </div>
            )}

            <label className="grid gap-2">
              <span
                className="text-sm font-bold"
                style={{ color: 'var(--admin-modal-text)' }}
              >
                Contraseña temporal actual
              </span>

              <input
                type="password"
                value={form.currentPassword}
                onChange={(event) =>
                  updateField('currentPassword', event.target.value)
                }
                className="rounded-2xl border px-4 py-3 text-sm outline-none"
                placeholder="Escribe la contraseña temporal"
                autoComplete="current-password"
                disabled={saving}
                style={{
                  background: 'var(--admin-input-bg)',
                  borderColor: 'var(--admin-input-border)',
                  color: 'var(--admin-input-text)',
                }}
              />
            </label>

            <label className="grid gap-2">
              <span
                className="text-sm font-bold"
                style={{ color: 'var(--admin-modal-text)' }}
              >
                Nueva contraseña
              </span>

              <input
                type="password"
                value={form.newPassword}
                onChange={(event) =>
                  updateField('newPassword', event.target.value)
                }
                className="rounded-2xl border px-4 py-3 text-sm outline-none"
                placeholder="Mínimo 8 caracteres"
                autoComplete="new-password"
                disabled={saving}
                style={{
                  background: 'var(--admin-input-bg)',
                  borderColor: 'var(--admin-input-border)',
                  color: 'var(--admin-input-text)',
                }}
              />
            </label>

            <label className="grid gap-2">
              <span
                className="text-sm font-bold"
                style={{ color: 'var(--admin-modal-text)' }}
              >
                Confirmar nueva contraseña
              </span>

              <input
                type="password"
                value={form.confirmPassword}
                onChange={(event) =>
                  updateField('confirmPassword', event.target.value)
                }
                className="rounded-2xl border px-4 py-3 text-sm outline-none"
                placeholder="Repite la nueva contraseña"
                autoComplete="new-password"
                disabled={saving}
                style={{
                  background: 'var(--admin-input-bg)',
                  borderColor: 'var(--admin-input-border)',
                  color: 'var(--admin-input-text)',
                }}
              />
            </label>

            <div
              className="flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm leading-6"
              style={{
                borderColor: 'var(--admin-glass-border)',
                background: 'var(--admin-glass-soft-bg)',
                color: 'var(--admin-modal-muted-text)',
              }}
            >
              <KeyRound
                className="mt-0.5 h-4 w-4 shrink-0"
                style={{ color: 'var(--admin-primary)' }}
              />

              <p>
                Después de guardar, tu sesión se actualizará automáticamente y
                podrás ingresar al panel administrativo.
              </p>
            </div>
          </div>

          <div
            className="flex flex-col-reverse gap-3 border-t px-5 py-4 sm:flex-row sm:justify-end md:px-6"
            style={{
              borderColor: 'var(--admin-glass-border)',
              background: 'var(--admin-glass-soft-bg)',
            }}
          >
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="rounded-2xl border px-5 py-2.5 text-sm font-black transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
              style={{
                borderColor: 'var(--admin-light-panel-border)',
                background: 'var(--admin-light-panel-bg)',
                color: 'var(--admin-light-panel-text)',
              }}
            >
              Volver al login
            </button>

            <button
              type="submit"
              disabled={saving}
              className="rounded-2xl border px-5 py-2.5 text-sm font-black transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
              style={{
                borderColor: 'var(--admin-button-bg)',
                background: 'var(--admin-button-bg)',
                color: 'var(--admin-button-text)',
              }}
            >
              {saving ? 'Guardando...' : 'Cambiar contraseña'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}