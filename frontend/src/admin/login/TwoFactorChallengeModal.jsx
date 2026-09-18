import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { KeyRound, Loader2, ShieldCheck, X } from 'lucide-react';
import {
  cancelAdminTwoFactorChallenge,
  verifyAdminTwoFactor,
} from '../api/adminAuthApi';

export default function TwoFactorChallengeModal({
  open,
  user,
  onSuccess,
  onCancel,
}) {
  const [code, setCode] = useState('');
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setCode('');
      setRecoveryMode(false);
      setError('');
      setSaving(false);
    }
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  const handleCodeChange = (event) => {
    const next = recoveryMode
      ? event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 11)
      : event.target.value.replace(/\D/g, '').slice(0, 6);
    setCode(next);
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const valid = recoveryMode
      ? /^[A-Z0-9]{5}-?[A-Z0-9]{5}$/.test(code)
      : /^\d{6}$/.test(code);

    if (!valid) {
      setError(
        recoveryMode
          ? 'Escribe un código de recuperación de 10 caracteres.'
          : 'Escribe el código de 6 dígitos.'
      );
      return;
    }

    try {
      setSaving(true);
      setError('');
      const response = await verifyAdminTwoFactor(code);
      onSuccess(response);
    } catch (err) {
      const challengeEnded = Boolean(err?.response?.data?.challengeEnded);
      if (challengeEnded) {
        onCancel(
          err?.userMessage ||
            'El desafío de seguridad terminó. Inicia sesión nuevamente.'
        );
        return;
      }
      setError(err?.userMessage || 'El código no es válido.');
      setCode('');
      window.setTimeout(() => inputRef.current?.focus(), 50);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    if (saving) return;
    try {
      await cancelAdminTwoFactorChallenge();
    } catch {
      // La cookie también vence automáticamente; el cierre local es suficiente.
    }
    onCancel('Verificación cancelada. Escribe nuevamente tus credenciales.');
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 backdrop-blur-[8px]"
      style={{ background: 'var(--admin-modal-overlay, rgba(15, 23, 42, 0.62))' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-2fa-title"
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-[30px] border shadow-2xl"
        style={{
          background: 'var(--admin-modal-bg, rgba(255,255,255,0.97))',
          borderColor: 'var(--admin-glass-border, rgba(255,255,255,0.55))',
          color: 'var(--admin-modal-text, #172033)',
        }}
      >
        <div
          className="flex items-start justify-between gap-4 border-b px-6 py-5"
          style={{ borderColor: 'var(--admin-glass-border, #e5e7eb)' }}
        >
          <div className="flex gap-3">
            <span
              className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border"
              style={{
                background: 'var(--admin-primary-soft-bg, #fce7f3)',
                borderColor: 'var(--admin-primary-soft-border, #f9a8d4)',
                color: 'var(--admin-primary-soft-text, #be185d)',
              }}
            >
              <ShieldCheck size={22} />
            </span>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.2em] opacity-60">
                Segundo factor
              </p>
              <h2 id="admin-2fa-title" className="mt-1 text-2xl font-black">
                Confirma que eres tú
              </h2>
              <p className="mt-2 text-sm leading-6 opacity-70">
                Hola, {user?.displayName || user?.username || 'usuario'}. La sesión
                se creará únicamente después de esta verificación.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCancel}
            disabled={saving}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border disabled:opacity-50"
            aria-label="Cancelar verificación"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-4 p-6">
          {error ? (
            <div className="rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
              {error}
            </div>
          ) : null}

          <label className="grid gap-2">
            <span className="text-sm font-bold">
              {recoveryMode ? 'Código de recuperación' : 'Código de 6 dígitos'}
            </span>
            <div className="relative">
              <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 opacity-50" size={18} />
              <input
                ref={inputRef}
                value={code}
                onChange={handleCodeChange}
                inputMode={recoveryMode ? 'text' : 'numeric'}
                autoComplete="one-time-code"
                placeholder={recoveryMode ? 'ABCDE-12345' : '000000'}
                disabled={saving}
                className="w-full rounded-2xl border px-12 py-4 text-center text-xl font-black tracking-[0.24em] outline-none disabled:opacity-60"
                style={{
                  background: 'var(--admin-input-bg, #fff)',
                  borderColor: 'var(--admin-input-border, #d1d5db)',
                  color: 'var(--admin-input-text, #172033)',
                }}
              />
            </div>
          </label>

          <button
            type="button"
            onClick={() => {
              setRecoveryMode((current) => !current);
              setCode('');
              setError('');
            }}
            disabled={saving}
            className="justify-self-start text-sm font-bold underline-offset-4 hover:underline"
          >
            {recoveryMode
              ? 'Usar aplicación de autenticación'
              : 'Usar un código de recuperación'}
          </button>

          <button
            type="submit"
            disabled={saving}
            className="mt-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3.5 text-sm font-black text-white disabled:opacity-60"
          >
            {saving ? <Loader2 className="animate-spin" size={18} /> : <ShieldCheck size={18} />}
            {saving ? 'Verificando…' : 'Verificar e ingresar'}
          </button>
        </form>
      </div>
    </div>,
    document.body
  );
}
