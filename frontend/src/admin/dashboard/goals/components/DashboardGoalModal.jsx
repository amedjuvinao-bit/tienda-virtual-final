// frontend/src/admin/dashboard/goals/components/DashboardGoalModal.jsx

import { AlertCircle, Check, Loader2, Target, X } from 'lucide-react';
import { dashboardStyles as styles } from '../../dashboardStyles';
import { formatAmountInput, formatCurrency } from '../utils/dashboardGoalFormatters';

function getFormattedCurrentAmount(goal) {
  return formatCurrency(goal?.currentAmount || 0, goal?.currency || 'COP');
}

function getFormattedTargetAmount(form) {
  return formatAmountInput(form?.targetAmount || '');
}

function FieldLabel({ children }) {
  return (
    <label
      className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.14em]"
      style={styles.muted}
    >
      {children}
    </label>
  );
}

function ModalButton({ children, type = 'button', variant = 'secondary', disabled = false, onClick }) {
  const isPrimary = variant === 'primary';

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className="relative inline-flex h-10 items-center justify-center gap-2 overflow-hidden rounded-[15px] px-4 text-[12px] font-black transition disabled:cursor-not-allowed disabled:opacity-55"
      style={{
        border: isPrimary
          ? '1px solid color-mix(in srgb, var(--admin-primary) 36%, rgba(255,255,255,0.44))'
          : '1px solid color-mix(in srgb, var(--admin-primary) 16%, rgba(255,255,255,0.34))',
        background: isPrimary
          ? 'linear-gradient(135deg, var(--admin-primary), color-mix(in srgb, var(--admin-primary) 72%, rgba(255,255,255,0.38)))'
          : `
            linear-gradient(
              145deg,
              rgba(255,255,255,0.048) 0%,
              rgba(255,255,255,0.012) 56%,
              color-mix(in srgb, var(--admin-primary) 4%, transparent) 100%
            )
          `,
        color: isPrimary ? '#fff' : 'var(--admin-card-text)',
        boxShadow: isPrimary
          ? `
            inset 0 1px 0 rgba(255,255,255,0.32),
            0 10px 20px color-mix(in srgb, var(--admin-primary) 24%, transparent)
          `
          : `
            inset 0 1px 0 rgba(255,255,255,0.34),
            inset 0 -1px 0 rgba(15,23,42,0.10),
            0 7px 14px rgba(12,6,35,0.050)
          `,
        backdropFilter: 'blur(14px) saturate(165%)',
        WebkitBackdropFilter: 'blur(14px) saturate(165%)',
      }}
    >
      {children}
    </button>
  );
}

export default function DashboardGoalModal({
  isOpen,
  form,
  currentGoal,
  loading,
  saving,
  error,
  formError,
  canSave,
  onClose,
  onChange,
  onSubmit,
}) {
  if (!isOpen) return null;

  const visibleError = error || formError;
  const formattedTargetAmount = getFormattedTargetAmount(form);
  const formattedCurrentAmount = getFormattedCurrentAmount(currentGoal);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!canSave || saving || loading) return;
    onSubmit?.();
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center px-4 py-6">
      <style>
        {`
          @keyframes dashboardGoalModalBackdropIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }

          @keyframes dashboardGoalModalIn {
            from {
              opacity: 0;
              transform: translateY(16px) scale(0.98);
              filter: blur(5px);
            }
            to {
              opacity: 1;
              transform: translateY(0) scale(1);
              filter: blur(0);
            }
          }

          .dashboard-goal-modal-backdrop {
            animation: dashboardGoalModalBackdropIn 180ms ease-out both;
          }

          .dashboard-goal-modal-card {
            animation: dashboardGoalModalIn 260ms ease-out both;
          }

          @media (prefers-reduced-motion: reduce) {
            .dashboard-goal-modal-backdrop,
            .dashboard-goal-modal-card {
              animation: none !important;
            }
          }
        `}
      </style>

      <button
        type="button"
        aria-label="Cerrar editor de meta"
        className="dashboard-goal-modal-backdrop absolute inset-0 cursor-default"
        style={{
          background:
            'radial-gradient(circle at 50% 28%, color-mix(in srgb, var(--admin-primary) 16%, transparent), rgba(15,23,42,0.36) 72%)',
          backdropFilter: 'blur(10px) saturate(150%)',
          WebkitBackdropFilter: 'blur(10px) saturate(150%)',
        }}
        onClick={onClose}
      />

      <section
        className="dashboard-goal-modal-card relative z-10 w-full max-w-[520px] overflow-hidden rounded-[28px] p-[1px]"
        style={{
          border:
            '1px solid color-mix(in srgb, var(--admin-primary) 24%, rgba(255,255,255,0.48))',
          background: `
            linear-gradient(
              145deg,
              rgba(255,255,255,0.070) 0%,
              rgba(255,255,255,0.018) 50%,
              color-mix(in srgb, var(--admin-primary) 7%, transparent) 100%
            )
          `,
          boxShadow: `
            inset 0 1px 0 rgba(255,255,255,0.54),
            inset 0 -1px 0 rgba(15,23,42,0.12),
            0 24px 60px rgba(12,6,35,0.22),
            0 0 26px color-mix(in srgb, var(--admin-primary) 15%, transparent)
          `,
          backdropFilter: 'blur(22px) saturate(180%)',
          WebkitBackdropFilter: 'blur(22px) saturate(180%)',
        }}
      >
        <form
          onSubmit={handleSubmit}
          className="relative overflow-hidden rounded-[27px] px-5 py-5"
          style={{
            background: `
              linear-gradient(
                145deg,
                rgba(255,255,255,0.050) 0%,
                rgba(255,255,255,0.014) 54%,
                color-mix(in srgb, var(--admin-primary) 4%, transparent) 100%
              )
            `,
            boxShadow: `
              inset 0 1px 0 rgba(255,255,255,0.36),
              inset 0 -1px 0 rgba(15,23,42,0.10)
            `,
          }}
        >
          <span
            className="pointer-events-none absolute inset-x-10 top-0 h-px"
            style={{
              background:
                'linear-gradient(90deg, transparent, rgba(255,255,255,0.82), color-mix(in srgb, var(--admin-primary) 20%, rgba(255,255,255,0.42)), transparent)',
            }}
          />

          <div className="relative z-10 mb-5 flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px]"
                style={{
                  border:
                    '1px solid color-mix(in srgb, var(--admin-primary) 24%, rgba(255,255,255,0.40))',
                  background:
                    'linear-gradient(145deg, rgba(255,255,255,0.052), color-mix(in srgb, var(--admin-primary) 7%, transparent))',
                  color: 'var(--admin-primary)',
                  boxShadow:
                    'inset 0 1px 0 rgba(255,255,255,0.42), 0 8px 18px rgba(12,6,35,0.070)',
                }}
              >
                <Target size={18} strokeWidth={2.6} />
              </span>

              <div className="min-w-0">
                <h2 className="text-[18px] font-black leading-6" style={styles.title}>
                  Editar meta mensual
                </h2>
                <p className="mt-1 text-[12px] font-semibold leading-5" style={styles.muted}>
                  Actualiza el objetivo de ingresos del mes actual.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                border:
                  '1px solid color-mix(in srgb, var(--admin-primary) 16%, rgba(255,255,255,0.34))',
                background: 'rgba(255,255,255,0.035)',
                color: 'var(--admin-card-text)',
              }}
              aria-label="Cerrar"
            >
              <X size={16} strokeWidth={2.5} />
            </button>
          </div>

          <div
            className="relative z-10 mb-4 grid grid-cols-2 gap-3 rounded-[20px] p-3"
            style={{
              border:
                '1px solid color-mix(in srgb, var(--admin-primary) 14%, rgba(255,255,255,0.30))',
              background:
                'linear-gradient(145deg, rgba(255,255,255,0.034), color-mix(in srgb, var(--admin-primary) 4%, transparent))',
            }}
          >
            <div className="min-w-0">
              <p className="text-[10.5px] font-black uppercase tracking-[0.12em]" style={styles.muted}>
                Ventas del mes
              </p>
              <p className="mt-1 truncate text-[15px] font-black" style={styles.title}>
                {loading ? 'Cargando...' : formattedCurrentAmount}
              </p>
            </div>

            <div className="min-w-0">
              <p className="text-[10.5px] font-black uppercase tracking-[0.12em]" style={styles.muted}>
                Meta actual
              </p>
              <p className="mt-1 truncate text-[15px] font-black" style={styles.title}>
                {loading ? 'Cargando...' : currentGoal?.goal || '$0'}
              </p>
            </div>
          </div>

          <div className="relative z-10 space-y-4">
            <div>
              <FieldLabel>Nueva meta de ingresos</FieldLabel>
              <div
                className="flex h-12 items-center gap-2 overflow-hidden rounded-[17px] px-3"
                style={{
                  border:
                    '1px solid color-mix(in srgb, var(--admin-primary) 18%, rgba(255,255,255,0.34))',
                  background: 'rgba(255,255,255,0.038)',
                  boxShadow:
                    'inset 0 1px 0 rgba(255,255,255,0.26), inset 0 -1px 0 rgba(15,23,42,0.10)',
                }}
              >
                <span className="text-[13px] font-black" style={styles.muted}>
                  $
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formattedTargetAmount}
                  onChange={(event) => onChange?.('targetAmount', event.target.value)}
                  disabled={loading || saving}
                  placeholder="500.000"
                  className="h-full min-w-0 flex-1 bg-transparent text-[16px] font-black outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
                  style={styles.title}
                />
                <span className="text-[11px] font-black" style={styles.muted}>
                  {form?.currency || currentGoal?.currency || 'COP'}
                </span>
              </div>
            </div>

            <div>
              <FieldLabel>Nota interna</FieldLabel>
              <textarea
                value={form?.notes || ''}
                onChange={(event) => onChange?.('notes', event.target.value)}
                disabled={loading || saving}
                rows={3}
                maxLength={220}
                placeholder="Ejemplo: meta definida para campaña del mes."
                className="min-h-[86px] w-full resize-none rounded-[17px] bg-transparent px-3 py-3 text-[12px] font-semibold leading-5 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                  ...styles.title,
                  border:
                    '1px solid color-mix(in srgb, var(--admin-primary) 18%, rgba(255,255,255,0.34))',
                  background: 'rgba(255,255,255,0.038)',
                  boxShadow:
                    'inset 0 1px 0 rgba(255,255,255,0.26), inset 0 -1px 0 rgba(15,23,42,0.10)',
                }}
              />
            </div>

            {visibleError ? (
              <div
                className="flex items-start gap-2 rounded-[16px] px-3 py-2 text-[11.5px] font-bold leading-5"
                style={{
                  border: '1px solid rgba(248,113,113,0.28)',
                  background: 'rgba(248,113,113,0.08)',
                  color: '#dc2626',
                }}
              >
                <AlertCircle size={15} className="mt-0.5 shrink-0" />
                <span>{visibleError}</span>
              </div>
            ) : null}
          </div>

          <div className="relative z-10 mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <ModalButton onClick={onClose} disabled={saving}>
              Cancelar
            </ModalButton>

            <ModalButton type="submit" variant="primary" disabled={!canSave}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {saving ? 'Guardando...' : 'Guardar meta'}
            </ModalButton>
          </div>
        </form>
      </section>
    </div>
  );
}
