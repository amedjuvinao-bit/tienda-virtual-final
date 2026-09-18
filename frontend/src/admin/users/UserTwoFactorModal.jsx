import {
  KeyRound,
  Loader2,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
  X,
} from 'lucide-react';

const ACTIONS = [
  {
    value: 'require',
    title: 'Exigir 2FA',
    detail: 'El usuario deberá vincular su propia aplicación antes de usar el panel.',
    icon: ShieldCheck,
  },
  {
    value: 'reset',
    title: 'Restablecer 2FA',
    detail: 'Invalida la vinculación actual y exige configurar una nueva.',
    icon: RefreshCw,
    needsEnabled: true,
  },
  {
    value: 'disable',
    title: 'Desactivar 2FA',
    detail: 'Elimina la vinculación y deja el segundo factor como opcional.',
    icon: ShieldOff,
    danger: true,
  },
];

export default function UserTwoFactorModal({
  open,
  user,
  form,
  setForm,
  saving,
  error,
  ownerTwoFactorEnabled,
  onClose,
  onSubmit,
}) {
  if (!open || !user) return null;

  const availableActions = ACTIONS.filter(
    (item) => !item.needsEnabled || user.twoFactorEnabled
  );
  const isCurrentUser =
    String(user._id || user.id || '') === String(form.currentUserId || '');
  const ownerMustEnableTwoFactor = !ownerTwoFactorEnabled && !isCurrentUser;

  return (
    <div className="fixed inset-0 z-[1200] grid place-items-center overflow-y-auto bg-slate-950/55 p-4 backdrop-blur-sm">
      <section
        className="w-full max-w-2xl rounded-[30px] border p-5 shadow-2xl md:p-6"
        style={{
          background: 'var(--admin-card-bg)',
          borderColor: 'var(--admin-glass-border)',
          color: 'var(--admin-card-text)',
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="two-factor-owner-title"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] opacity-60">
              Control exclusivo del propietario
            </p>
            <h2 id="two-factor-owner-title" className="mt-1 text-2xl font-black">
              Seguridad 2FA de @{user.username}
            </h2>
            <p className="mt-2 text-sm leading-6 opacity-70">
              Estado actual: {user.twoFactorEnabled ? 'vinculado' : 'sin vincular'} ·{' '}
              {user.twoFactorRequired ? 'obligatorio' : 'opcional'}.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border disabled:opacity-50"
            style={{ borderColor: 'var(--admin-glass-border)' }}
            aria-label="Cerrar administración 2FA"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="mt-6 grid gap-5">
          <div className="grid gap-3 md:grid-cols-3">
            {availableActions.map((item) => {
              const Icon = item.icon;
              const selected = form.action === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setForm((current) => ({ ...current, action: item.value }))}
                  disabled={saving}
                  className={`rounded-2xl border p-4 text-left transition disabled:opacity-50 ${
                    selected ? 'ring-2 ring-pink-400' : ''
                  }`}
                  style={{
                    borderColor: item.danger
                      ? 'var(--admin-danger)'
                      : 'var(--admin-glass-border)',
                    background: item.danger
                      ? 'var(--admin-danger-soft-bg)'
                      : 'var(--admin-glass-soft-bg)',
                  }}
                >
                  <Icon size={19} />
                  <strong className="mt-3 block text-sm">{item.title}</strong>
                  <span className="mt-1 block text-xs leading-5 opacity-65">
                    {item.detail}
                  </span>
                </button>
              );
            })}
          </div>

          <label className="grid gap-2 text-sm font-bold">
            Motivo del cambio
            <textarea
              value={form.reason}
              onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value.slice(0, 500) }))}
              placeholder="Ejemplo: cambio solicitado por el usuario"
              required
              minLength={3}
              rows={2}
              disabled={saving}
              className="resize-none rounded-2xl border px-4 py-3 outline-none"
              style={{ background: 'var(--admin-input-bg)', borderColor: 'var(--admin-input-border)', color: 'var(--admin-input-text)' }}
            />
          </label>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-bold">
              Tu contraseña de propietario
              <input
                type="password"
                value={form.currentPassword}
                onChange={(event) => setForm((current) => ({ ...current, currentPassword: event.target.value }))}
                autoComplete="current-password"
                required
                disabled={saving}
                className="rounded-2xl border px-4 py-3 outline-none"
                style={{ background: 'var(--admin-input-bg)', borderColor: 'var(--admin-input-border)', color: 'var(--admin-input-text)' }}
              />
            </label>

            {ownerTwoFactorEnabled ? (
              <label className="grid gap-2 text-sm font-bold">
                Tu código 2FA o de recuperación
                <input
                  value={form.code}
                  onChange={(event) => setForm((current) => ({
                    ...current,
                    code: event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 11),
                  }))}
                  autoComplete="one-time-code"
                  required
                  disabled={saving}
                  className="rounded-2xl border px-4 py-3 outline-none"
                  style={{ background: 'var(--admin-input-bg)', borderColor: 'var(--admin-input-border)', color: 'var(--admin-input-text)' }}
                />
              </label>
            ) : null}
          </div>

          {ownerMustEnableTwoFactor ? (
            <p className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-950">
              Activa primero tu propio 2FA para administrar a otra persona.
            </p>
          ) : null}

          {error ? (
            <p className="rounded-2xl border border-rose-300 bg-rose-50 p-3 text-sm font-semibold text-rose-800">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              disabled={saving || !form.action || ownerMustEnableTwoFactor}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white disabled:opacity-50"
            >
              {saving ? <Loader2 className="animate-spin" size={17} /> : <KeyRound size={17} />}
              Confirmar cambio
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-2xl border px-5 py-3 text-sm font-bold disabled:opacity-50"
              style={{ borderColor: 'var(--admin-glass-border)' }}
            >
              Cancelar
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
