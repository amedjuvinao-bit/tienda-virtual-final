// frontend/src/admin/dashboard/goals/components/DashboardGoalModal.jsx

import { useEffect } from 'react';
import { AlertCircle, Check, Loader2, Target, TrendingUp, X } from 'lucide-react';
import { dashboardStyles as styles } from '../../dashboardStyles';
import { formatCurrency } from '../utils/dashboardGoalFormatters';

function getFormattedCurrentAmount(goal) {
  return formatCurrency(goal?.currentAmount || 0, goal?.currency || 'COP');
}

function getFormattedTargetAmount(goal) {
  return formatCurrency(goal?.targetAmount || 0, goal?.currency || 'COP');
}

function MetricCard({ icon: Icon, label, value }) {
  return (
    <div
      className="relative overflow-hidden rounded-[20px] px-4 py-3"
      style={{
        border:
          '1px solid color-mix(in srgb, var(--admin-primary) 14%, rgba(255,255,255,0.48))',
        background: `
          linear-gradient(
            145deg,
            rgba(255,255,255,0.58) 0%,
            rgba(255,255,255,0.28) 56%,
            color-mix(in srgb, var(--admin-primary) 5%, rgba(255,255,255,0.10)) 100%
          )
        `,
        boxShadow: `
          inset 0 1px 0 rgba(255,255,255,0.72),
          inset 0 -1px 0 rgba(15,23,42,0.05),
          0 12px 24px rgba(12,6,35,0.055)
        `,
      }}
    >
      <span
        className="pointer-events-none absolute inset-x-5 top-0 h-px"
        style={{
          background:
            'linear-gradient(90deg, transparent, rgba(255,255,255,0.88), transparent)',
        }}
      />

      <div className="flex items-center gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px]"
          style={{
            border:
              '1px solid color-mix(in srgb, var(--admin-primary) 20%, rgba(255,255,255,0.58))',
            background: `
              linear-gradient(
                145deg,
                rgba(255,255,255,0.62) 0%,
                rgba(255,255,255,0.28) 58%,
                color-mix(in srgb, var(--admin-primary) 7%, rgba(255,255,255,0.12)) 100%
              )
            `,
            color: 'var(--admin-primary)',
            boxShadow: `
              inset 0 1px 0 rgba(255,255,255,0.88),
              0 8px 18px rgba(12,6,35,0.055)
            `,
          }}
        >
          <Icon size={17} strokeWidth={2.5} />
        </span>

        <div className="min-w-0">
          <p
            className="text-[10.5px] font-black uppercase tracking-[0.13em]"
            style={styles.muted}
          >
            {label}
          </p>

          <p
            className="mt-1 truncate text-[17px] font-black leading-none"
            style={styles.title}
            title={value}
          >
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

function FieldLabel({ children }) {
  return (
    <label
      className="mb-2 block text-[10.5px] font-black uppercase tracking-[0.14em]"
      style={styles.muted}
    >
      {children}
    </label>
  );
}

function GlassButton({ children, variant = 'secondary', disabled = false, onClick, type = 'button' }) {
  const isPrimary = variant === 'primary';

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className="relative inline-flex h-11 items-center justify-center gap-2 overflow-hidden rounded-[16px] px-5 text-[12px] font-black transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55"
      style={{
        border: isPrimary
          ? '1px solid color-mix(in srgb, var(--admin-primary) 38%, rgba(255,255,255,0.58))'
          : '1px solid color-mix(in srgb, var(--admin-primary) 16%, rgba(255,255,255,0.48))',
        background: isPrimary
          ? `
            linear-gradient(
              135deg,
              var(--admin-primary) 0%,
              color-mix(in srgb, var(--admin-primary) 72%, rgba(255,255,255,0.36)) 100%
            )
          `
          : `
            linear-gradient(
              145deg,
              rgba(255,255,255,0.54) 0%,
              rgba(255,255,255,0.24) 56%,
              color-mix(in srgb, var(--admin-primary) 5%, rgba(255,255,255,0.08)) 100%
            )
          `,
        color: isPrimary ? '#fff' : 'var(--admin-card-text)',
        boxShadow: isPrimary
          ? `
            inset 0 1px 0 rgba(255,255,255,0.36),
            0 12px 24px color-mix(in srgb, var(--admin-primary) 24%, transparent)
          `
          : `
            inset 0 1px 0 rgba(255,255,255,0.68),
            inset 0 -1px 0 rgba(15,23,42,0.05),
            0 9px 18px rgba(12,6,35,0.055)
          `,
      }}
    >
      {children}
    </button>
  );
}

export default function DashboardGoalModal({
  isOpen = false,
  form = {},
  currentGoal = null,
  loading = false,
  saving = false,
  error = '',
  formError = '',
  canSave = true,

  onClose,
  onChange,
  onSubmit,

  closeEditor,
  updateField,
  saveGoal,
}) {
  const handleClose = onClose || closeEditor;
  const handleChange = onChange || updateField;
  const handleSubmitAction = onSubmit || saveGoal;

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !saving) {
        handleClose?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, saving, handleClose]);

  if (!isOpen) return null;

  const visibleError = formError || error;
  const currentAmount = getFormattedCurrentAmount(currentGoal);
  const targetAmount = getFormattedTargetAmount(currentGoal);
  const currency = form?.currency || currentGoal?.currency || 'COP';

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!canSave || saving || loading) return;

    handleSubmitAction?.();
  };

  const handleTargetAmountChange = (event) => {
    const onlyNumbers = event.target.value.replace(/\D/g, '');
    handleChange?.('targetAmount', onlyNumbers);
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center px-4 py-6">
      <style>
        {`
          @keyframes goalModalBackdropIn {
            from {
              opacity: 0;
            }
            to {
              opacity: 1;
            }
          }

          @keyframes goalModalCardIn {
            from {
              opacity: 0;
              transform: translateY(18px) scale(0.982);
              filter: blur(8px);
            }
            to {
              opacity: 1;
              transform: translateY(0) scale(1);
              filter: blur(0);
            }
          }

          .goal-modal-backdrop {
            animation: goalModalBackdropIn 200ms ease-out both;
          }

          .goal-modal-card {
            animation: goalModalCardIn 280ms cubic-bezier(.22,.9,.24,1) both;
          }

          @media (prefers-reduced-motion: reduce) {
            .goal-modal-backdrop,
            .goal-modal-card {
              animation: none !important;
            }
          }
        `}
      </style>

      <button
        type="button"
        aria-label="Cerrar editor de meta"
        className="goal-modal-backdrop absolute inset-0 cursor-default"
        onClick={() => {
          if (!saving) handleClose?.();
        }}
        style={{
          background: `
            radial-gradient(circle at center, color-mix(in srgb, var(--admin-primary) 9%, transparent), transparent 42%),
            linear-gradient(
              180deg,
              rgba(255,255,255,0.34) 0%,
              rgba(248,242,248,0.58) 100%
            )
          `,
          backdropFilter: 'blur(13px) saturate(138%)',
          WebkitBackdropFilter: 'blur(13px) saturate(138%)',
        }}
      />

      <section
        className="goal-modal-card relative z-10 w-full max-w-[610px] overflow-hidden rounded-[30px] p-[1px]"
        style={{
          border:
            '1px solid color-mix(in srgb, var(--admin-primary) 22%, rgba(255,255,255,0.74))',
          background: `
            linear-gradient(
              145deg,
              rgba(255,255,255,0.72) 0%,
              rgba(255,255,255,0.34) 48%,
              color-mix(in srgb, var(--admin-primary) 7%, rgba(255,255,255,0.12)) 100%
            )
          `,
          boxShadow: `
            inset 0 1px 0 rgba(255,255,255,0.92),
            inset 0 -1px 0 rgba(15,23,42,0.06),
            0 28px 76px rgba(12,6,35,0.18),
            0 0 24px color-mix(in srgb, var(--admin-primary) 10%, transparent)
          `,
        }}
      >
        <form
          onSubmit={handleSubmit}
          className="relative overflow-hidden rounded-[29px] px-5 py-5 sm:px-6 sm:py-6"
          style={{
            background: `
              radial-gradient(circle at top right, rgba(255,255,255,0.42), transparent 34%),
              linear-gradient(
                145deg,
                rgba(255,255,255,0.60) 0%,
                rgba(255,255,255,0.24) 54%,
                color-mix(in srgb, var(--admin-primary) 5%, rgba(255,255,255,0.08)) 100%
              )
            `,
            backdropFilter: 'blur(24px) saturate(180%)',
            WebkitBackdropFilter: 'blur(24px) saturate(180%)',
            boxShadow: `
              inset 0 1px 0 rgba(255,255,255,0.72),
              inset 0 -1px 0 rgba(15,23,42,0.05)
            `,
          }}
        >
          <span
            className="pointer-events-none absolute inset-x-10 top-0 h-px"
            style={{
              background:
                'linear-gradient(90deg, transparent, rgba(255,255,255,0.88), transparent)',
            }}
          />

          <span
            className="pointer-events-none absolute -right-10 -top-12 h-[210px] w-[70px] rotate-[27deg]"
            style={{
              background:
                'linear-gradient(90deg, transparent, rgba(255,255,255,0.18), rgba(255,255,255,0.42), transparent)',
              opacity: 0.5,
              filter: 'blur(1px)',
            }}
          />

          <div className="relative z-10 flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[17px]"
                style={{
                  border:
                    '1px solid color-mix(in srgb, var(--admin-primary) 22%, rgba(255,255,255,0.64))',
                  background: `
                    linear-gradient(
                      145deg,
                      rgba(255,255,255,0.64) 0%,
                      rgba(255,255,255,0.28) 56%,
                      color-mix(in srgb, var(--admin-primary) 8%, rgba(255,255,255,0.12)) 100%
                    )
                  `,
                  color: 'var(--admin-primary)',
                  boxShadow: `
                    inset 0 1px 0 rgba(255,255,255,0.86),
                    0 9px 20px rgba(12,6,35,0.065)
                  `,
                }}
              >
                <Target size={20} strokeWidth={2.6} />
              </span>

              <div className="min-w-0">
                <h2
                  className="text-[21px] font-black leading-6 tracking-tight"
                  style={styles.title}
                >
                  Editar meta mensual
                </h2>

                <p className="mt-1.5 text-[12.5px] font-semibold leading-5" style={styles.muted}>
                  Define el objetivo de ingresos del mes actual.
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={saving}
              onClick={() => {
                if (!saving) handleClose?.();
              }}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[15px] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55"
              style={{
                border:
                  '1px solid color-mix(in srgb, var(--admin-primary) 15%, rgba(255,255,255,0.56))',
                background: `
                  linear-gradient(
                    145deg,
                    rgba(255,255,255,0.52) 0%,
                    rgba(255,255,255,0.22) 100%
                  )
                `,
                color: 'var(--admin-card-text)',
                boxShadow: `
                  inset 0 1px 0 rgba(255,255,255,0.72),
                  0 8px 18px rgba(12,6,35,0.05)
                `,
              }}
              aria-label="Cerrar"
            >
              <X size={17} strokeWidth={2.6} />
            </button>
          </div>

          <div className="relative z-10 mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <MetricCard icon={TrendingUp} label="Ventas del mes" value={loading ? 'Cargando...' : currentAmount} />
            <MetricCard icon={Target} label="Meta actual" value={loading ? 'Cargando...' : targetAmount} />
          </div>

          {visibleError ? (
            <div
              className="relative z-10 mt-4 flex items-start gap-2 rounded-[18px] px-4 py-3 text-[12px] font-bold leading-5"
              style={{
                border: '1px solid rgba(248,113,113,0.28)',
                background:
                  'linear-gradient(135deg, rgba(254,242,242,0.90), rgba(255,228,230,0.66))',
                color: '#dc2626',
                boxShadow: '0 8px 18px rgba(248,113,113,0.07)',
              }}
            >
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{visibleError}</span>
            </div>
          ) : null}

          <div className="relative z-10 mt-5 space-y-4">
            <div>
              <FieldLabel>Nueva meta de ingresos</FieldLabel>

              <div
                className="grid h-14 grid-cols-[48px_minmax(0,1fr)_64px] overflow-hidden rounded-[18px]"
                style={{
                  border:
                    '1px solid color-mix(in srgb, var(--admin-primary) 17%, rgba(255,255,255,0.62))',
                  background: `
                    linear-gradient(
                      145deg,
                      rgba(255,255,255,0.76) 0%,
                      rgba(255,255,255,0.46) 100%
                    )
                  `,
                  boxShadow: `
                    inset 0 1px 0 rgba(255,255,255,0.82),
                    inset 0 -1px 0 rgba(15,23,42,0.045),
                    0 10px 22px rgba(12,6,35,0.052)
                  `,
                }}
              >
                <div
                  className="flex items-center justify-center text-[17px] font-black"
                  style={{
                    color: 'var(--admin-primary)',
                    background:
                      'linear-gradient(145deg, rgba(255,255,255,0.35), rgba(255,255,255,0.10))',
                  }}
                >
                  $
                </div>

                <input
                  type="text"
                  inputMode="numeric"
                  value={form?.targetAmount ?? ''}
                  onChange={handleTargetAmountChange}
                  disabled={saving}
                  placeholder="500000"
                  className="min-w-0 border-0 bg-transparent px-2 text-[20px] font-black leading-none tracking-tight outline-none placeholder:text-slate-300 disabled:cursor-not-allowed disabled:opacity-55"
                  style={{
                    color: 'var(--admin-card-text)',
                  }}
                />

                <div
                  className="flex items-center justify-center text-[10.5px] font-black uppercase tracking-[0.12em]"
                  style={{
                    color: 'var(--admin-primary)',
                    background:
                      'linear-gradient(145deg, rgba(255,255,255,0.30), rgba(255,255,255,0.10))',
                  }}
                >
                  {currency}
                </div>
              </div>
            </div>

            <div>
              <FieldLabel>Nota interna</FieldLabel>

              <textarea
                value={form?.notes ?? ''}
                onChange={(event) => handleChange?.('notes', event.target.value)}
                disabled={saving}
                rows={3}
                maxLength={220}
                placeholder="Escribe una observación opcional sobre esta meta..."
                className="min-h-[92px] w-full resize-none rounded-[18px] border-0 px-4 py-3 text-[13px] font-semibold leading-5 outline-none placeholder:text-slate-300 disabled:cursor-not-allowed disabled:opacity-55"
                style={{
                  color: 'var(--admin-card-text)',
                  border:
                    '1px solid color-mix(in srgb, var(--admin-primary) 17%, rgba(255,255,255,0.62))',
                  background: `
                    linear-gradient(
                      145deg,
                      rgba(255,255,255,0.76) 0%,
                      rgba(255,255,255,0.46) 100%
                    )
                  `,
                  boxShadow: `
                    inset 0 1px 0 rgba(255,255,255,0.82),
                    inset 0 -1px 0 rgba(15,23,42,0.045),
                    0 10px 22px rgba(12,6,35,0.052)
                  `,
                }}
              />
            </div>
          </div>

          <div className="relative z-10 mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
            <GlassButton
              onClick={() => {
                if (!saving) handleClose?.();
              }}
              disabled={saving}
            >
              Cancelar
            </GlassButton>

            <GlassButton
              type="submit"
              variant="primary"
              disabled={!canSave || loading || saving}
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
              {saving ? 'Guardando...' : 'Guardar meta'}
            </GlassButton>
          </div>
        </form>
      </section>
    </div>
  );
}