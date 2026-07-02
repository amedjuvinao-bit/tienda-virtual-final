// frontend/src/admin/dashboard/components/DashboardGoalsPanel.jsx

import { useEffect, useState } from 'react';
import { Edit3, Target } from 'lucide-react';
import { dashboardStyles as styles } from '../dashboardStyles';
import DashboardGoalModal from '../goals/components/DashboardGoalModal';
import useDashboardGoalEditor from '../goals/hooks/useDashboardGoalEditor';

function GlassIcon({ children }) {
  return (
    <span
      className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-[13px]"
      style={{
        border:
          '1px solid color-mix(in srgb, var(--admin-primary) 22%, rgba(255,255,255,0.38))',
        background: `
          linear-gradient(
            145deg,
            rgba(255,255,255,0.050) 0%,
            rgba(255,255,255,0.012) 52%,
            color-mix(in srgb, var(--admin-primary) 5%, transparent) 100%
          )
        `,
        color: 'var(--admin-primary)',
        boxShadow: `
          inset 0 1px 0 rgba(255,255,255,0.44),
          inset 0 -1px 0 rgba(15,23,42,0.14),
          0 7px 15px rgba(12,6,35,0.055),
          0 0 13px color-mix(in srgb, var(--admin-primary) 15%, transparent)
        `,
        backdropFilter: 'blur(16px) saturate(180%)',
        WebkitBackdropFilter: 'blur(16px) saturate(180%)',
      }}
    >
      <span
        className="pointer-events-none absolute inset-x-[7px] top-[3px] h-px"
        style={{
          background:
            'linear-gradient(90deg, transparent, rgba(255,255,255,0.82), transparent)',
          opacity: 0.9,
        }}
      />

      <span
        className="pointer-events-none absolute right-[6px] top-[6px] h-[4px] w-[4px] rounded-full"
        style={{
          background: 'rgba(255,255,255,0.90)',
          boxShadow:
            '0 0 7px rgba(255,255,255,0.75), 0 0 12px color-mix(in srgb, var(--admin-primary) 24%, transparent)',
        }}
      />

      <span
        className="goal-icon-shine pointer-events-none absolute -right-3 -top-6 h-14 w-[5px] rotate-[34deg]"
        style={{
          background:
            'linear-gradient(90deg, transparent, rgba(255,255,255,0.34), transparent)',
          opacity: 0.48,
        }}
      />

      <span className="relative z-10">{children}</span>
    </span>
  );
}

function GlassButton({ children, onClick, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="goal-pro-button relative inline-flex h-8 shrink-0 items-center justify-center gap-1 overflow-hidden rounded-[13px] px-2.5 text-[10.5px] font-black disabled:cursor-not-allowed disabled:opacity-60"
      style={{
        border:
          '1px solid color-mix(in srgb, var(--admin-primary) 18%, rgba(255,255,255,0.36))',
        background: `
          linear-gradient(
            145deg,
            rgba(255,255,255,0.046) 0%,
            rgba(255,255,255,0.010) 54%,
            color-mix(in srgb, var(--admin-primary) 4%, transparent) 100%
          )
        `,
        color: 'var(--admin-card-text)',
        boxShadow: `
          inset 0 1px 0 rgba(255,255,255,0.38),
          inset 0 -1px 0 rgba(15,23,42,0.12),
          0 7px 14px rgba(12,6,35,0.050),
          0 0 10px color-mix(in srgb, var(--admin-primary) 10%, transparent)
        `,
        backdropFilter: 'blur(14px) saturate(165%)',
        WebkitBackdropFilter: 'blur(14px) saturate(165%)',
      }}
    >
      <span
        className="goal-button-shine pointer-events-none absolute -left-8 top-[-16px] h-[54px] w-[12px]"
        style={{
          background:
            'linear-gradient(90deg, transparent, rgba(255,255,255,0.32), transparent)',
        }}
      />

      <Edit3 size={12} className="relative z-10" />
      <span className="relative z-10">{children}</span>
    </button>
  );
}

export default function DashboardGoalsPanel({ goal, onGoalUpdated }) {
  const [displayGoal, setDisplayGoal] = useState(goal || null);

  useEffect(() => {
    setDisplayGoal(goal || null);
  }, [goal]);

  const editor = useDashboardGoalEditor({
    goal: displayGoal || goal,
    onGoalUpdated: (updatedGoal) => {
      setDisplayGoal(updatedGoal || null);

      if (typeof onGoalUpdated === 'function') {
        onGoalUpdated(updatedGoal);
      }
    },
  });

  const currentGoal = displayGoal || goal || {};
  const percentage = Math.min(Math.max(Number(currentGoal?.percentage || 0), 0), 100);

  const circleSize = 82;
  const strokeWidth = 7.5;
  const center = circleSize / 2;
  const radius = (circleSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progressOffset = circumference - (percentage / 100) * circumference;

  return (
    <>
      <section
        className="goals-pro-panel relative h-full min-h-0 self-stretch overflow-hidden rounded-[27px] p-[1px]"
        style={{
          border:
            '1px solid color-mix(in srgb, var(--admin-primary) 20%, rgba(255,255,255,0.44))',
          background: `
            linear-gradient(
              145deg,
              rgba(255,255,255,0.052) 0%,
              rgba(255,255,255,0.012) 48%,
              color-mix(in srgb, var(--admin-primary) 5%, transparent) 100%
            )
          `,
          boxShadow: `
            inset 0 1px 0 rgba(255,255,255,0.50),
            inset 0 -1px 0 rgba(15,23,42,0.12),
            0 16px 32px rgba(12,6,35,0.070),
            0 0 18px color-mix(in srgb, var(--admin-primary) 10%, transparent)
          `,
          backdropFilter: 'blur(18px) saturate(180%)',
          WebkitBackdropFilter: 'blur(18px) saturate(180%)',
        }}
      >
        <style>
          {`
            @keyframes goalsPanelEnter {
              from {
                opacity: 0;
                transform: translateY(12px) scale(0.985);
                filter: blur(5px);
              }
              to {
                opacity: 1;
                transform: translateY(0) scale(1);
                filter: blur(0);
              }
            }

            @keyframes goalRingDraw {
              from {
                stroke-dashoffset: ${circumference};
                opacity: 0.35;
              }
              to {
                stroke-dashoffset: ${progressOffset};
                opacity: 1;
              }
            }

            @keyframes goalRingPulse {
              0%, 100% {
                filter:
                  drop-shadow(0 0 7px color-mix(in srgb, var(--admin-primary) 24%, transparent))
                  drop-shadow(0 8px 14px rgba(12,6,35,0.08));
              }
              50% {
                filter:
                  drop-shadow(0 0 13px color-mix(in srgb, var(--admin-primary) 38%, transparent))
                  drop-shadow(0 10px 18px rgba(12,6,35,0.11));
              }
            }

            @keyframes goalShine {
              0% {
                transform: translateX(-145%) rotate(28deg);
                opacity: 0;
              }
              36% {
                opacity: 0.42;
              }
              100% {
                transform: translateX(185%) rotate(28deg);
                opacity: 0;
              }
            }

            @keyframes goalEdgePulse {
              0%, 100% {
                opacity: 0.46;
              }
              50% {
                opacity: 0.88;
              }
            }

            .goals-pro-panel {
              animation: goalsPanelEnter 520ms ease-out both;
            }

            .goal-main-card {
              transition:
                transform 180ms ease,
                filter 180ms ease,
                border-color 180ms ease,
                box-shadow 180ms ease;
            }

            .goal-main-card:hover {
              transform: translateY(-2px);
              filter: brightness(1.025) saturate(1.05);
              border-color: color-mix(in srgb, var(--admin-primary) 32%, rgba(255,255,255,0.42)) !important;
              box-shadow:
                inset 0 1px 0 rgba(255,255,255,0.38),
                inset 0 -1px 0 rgba(15,23,42,0.12),
                0 11px 22px rgba(12,6,35,0.070),
                0 0 16px color-mix(in srgb, var(--admin-primary) 14%, transparent) !important;
            }

            .goal-pro-button {
              transition:
                transform 180ms ease,
                filter 180ms ease,
                border-color 180ms ease,
                box-shadow 180ms ease;
            }

            .goal-pro-button:hover:not(:disabled) {
              transform: translateY(-1px);
              filter: brightness(1.025) saturate(1.05);
              border-color: color-mix(in srgb, var(--admin-primary) 30%, rgba(255,255,255,0.42)) !important;
              box-shadow:
                inset 0 1px 0 rgba(255,255,255,0.46),
                inset 0 -1px 0 rgba(15,23,42,0.12),
                0 9px 18px rgba(12,6,35,0.070),
                0 0 15px color-mix(in srgb, var(--admin-primary) 14%, transparent) !important;
            }

            .goal-button-shine {
              animation: goalShine 3.3s ease-in-out infinite;
            }

            .goal-icon-shine,
            .goal-panel-edge {
              animation: goalEdgePulse 3.8s ease-in-out infinite;
            }

            .goal-progress-ring {
              animation:
                goalRingDraw 1050ms cubic-bezier(.22,.9,.24,1) 180ms both,
                goalRingPulse 3.8s ease-in-out 1.3s infinite;
            }

            @media (prefers-reduced-motion: reduce) {
              .goals-pro-panel,
              .goal-main-card,
              .goal-button-shine,
              .goal-icon-shine,
              .goal-panel-edge,
              .goal-progress-ring {
                animation: none !important;
                transition: none !important;
              }
            }
          `}
        </style>

        <div
          className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-[26px] px-4 py-3"
          style={{
            background: `
              linear-gradient(
                145deg,
                rgba(255,255,255,0.042) 0%,
                rgba(255,255,255,0.010) 52%,
                color-mix(in srgb, var(--admin-primary) 3%, transparent) 100%
              )
            `,
            boxShadow: `
              inset 0 1px 0 rgba(255,255,255,0.34),
              inset 0 -1px 0 rgba(15,23,42,0.10)
            `,
            backdropFilter: 'blur(14px) saturate(165%)',
            WebkitBackdropFilter: 'blur(14px) saturate(165%)',
          }}
        >
          <span
            className="pointer-events-none absolute inset-x-8 top-0 h-px"
            style={{
              background:
                'linear-gradient(90deg, transparent, rgba(255,255,255,0.78), color-mix(in srgb, var(--admin-primary) 18%, rgba(255,255,255,0.42)), transparent)',
            }}
          />

          <span
            className="goal-panel-edge pointer-events-none absolute left-0 top-12 h-[calc(100%-96px)] w-px"
            style={{
              background:
                'linear-gradient(180deg, transparent, color-mix(in srgb, var(--admin-primary) 56%, rgba(255,255,255,0.44)), transparent)',
              boxShadow:
                '0 0 12px color-mix(in srgb, var(--admin-primary) 26%, transparent)',
            }}
          />

          <span
            className="pointer-events-none absolute -right-12 -top-16 h-[230px] w-[48px] rotate-[34deg]"
            style={{
              background:
                'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), rgba(255,255,255,0.23), rgba(255,255,255,0.06), transparent)',
              opacity: 0.30,
              filter: 'blur(0.8px)',
            }}
          />

          <div className="relative z-10 mb-2.5 flex shrink-0 items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <GlassIcon>
                <Target size={16} strokeWidth={2.5} />
              </GlassIcon>

              <div className="min-w-0">
                <h2 className="text-[16px] font-black leading-[17px]" style={styles.title}>
                  Metas del mes
                </h2>

                <p
                  className="mt-0.5 text-[11.5px] font-semibold leading-[15px]"
                  style={{
                    ...styles.muted,
                    display: '-webkit-box',
                    WebkitLineClamp: 1,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  Seguimiento de objetivos comerciales.
                </p>
              </div>
            </div>

            <GlassButton onClick={editor.openEditor} disabled={editor.loading || editor.saving}>
              Editar meta
            </GlassButton>
          </div>

          <div
            className="goal-main-card relative z-10 grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_86px] items-center gap-3 overflow-hidden rounded-[20px] px-3 py-3"
            style={{
              border:
                '1px solid color-mix(in srgb, var(--admin-primary) 16%, rgba(255,255,255,0.30))',
              background: `
                linear-gradient(
                  145deg,
                  rgba(255,255,255,0.034) 0%,
                  rgba(255,255,255,0.008) 52%,
                  color-mix(in srgb, var(--admin-primary) 4%, transparent) 100%
                )
              `,
              boxShadow: `
                inset 0 1px 0 rgba(255,255,255,0.28),
                inset 0 -1px 0 rgba(15,23,42,0.10),
                0 8px 16px rgba(12,6,35,0.040),
                0 0 10px color-mix(in srgb, var(--admin-primary) 7%, transparent)
              `,
              backdropFilter: 'blur(13px) saturate(160%)',
              WebkitBackdropFilter: 'blur(13px) saturate(160%)',
            }}
          >
            <span
              className="pointer-events-none absolute left-0 top-3 h-[calc(100%-24px)] w-px"
              style={{
                background:
                  'linear-gradient(180deg, transparent, color-mix(in srgb, var(--admin-primary) 68%, rgba(255,255,255,0.48)), transparent)',
                boxShadow:
                  '0 0 10px color-mix(in srgb, var(--admin-primary) 28%, transparent)',
              }}
            />

            <span
              className="pointer-events-none absolute inset-x-5 top-0 h-px"
              style={{
                background:
                  'linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)',
              }}
            />

            <div className="min-w-0">
              <p className="text-[11.5px] font-black leading-none" style={styles.muted}>
                {currentGoal?.title || 'Meta de ingresos'}
              </p>

              <p
                className="mt-1.5 truncate text-[22px] font-black leading-none tracking-tight"
                style={styles.title}
                title={currentGoal?.goal || '$0.00'}
              >
                {currentGoal?.goal || '$0.00'}
              </p>

              <div className="mt-3">
                <div className="mb-1.5 flex items-center justify-between gap-2 text-[10.5px] font-black">
                  <span
                    className="min-w-0 leading-[13px]"
                    style={{
                      ...styles.muted,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                    title={currentGoal?.detail || '$0.00 / $0.00'}
                  >
                    {currentGoal?.detail || '$0.00 / $0.00'}
                  </span>

                  <span
                    className="shrink-0"
                    style={{
                      color: 'var(--admin-primary)',
                      textShadow:
                        '0 0 7px color-mix(in srgb, var(--admin-primary) 18%, transparent)',
                    }}
                  >
                    {percentage}%
                  </span>
                </div>

                <div
                  className="relative h-2.5 overflow-hidden rounded-full"
                  style={{
                    border: '1px solid rgba(255,255,255,0.18)',
                    background: 'rgba(255,255,255,0.055)',
                    boxShadow: `
                      inset 0 1px 0 rgba(255,255,255,0.24),
                      inset 0 -1px 0 rgba(15,23,42,0.10)
                    `,
                  }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${percentage}%`,
                      background:
                        'linear-gradient(90deg, var(--admin-primary), color-mix(in srgb, var(--admin-primary) 58%, rgba(255,255,255,0.42)))',
                      boxShadow:
                        '0 0 11px color-mix(in srgb, var(--admin-primary) 30%, transparent)',
                      transition: 'width 900ms cubic-bezier(.22,.9,.24,1)',
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <div className="relative h-[82px] w-[82px]">
                <svg
                  width={circleSize}
                  height={circleSize}
                  viewBox={`0 0 ${circleSize} ${circleSize}`}
                  className="-rotate-90"
                  role="img"
                  aria-label={`Meta completada ${percentage}%`}
                >
                  <circle
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="none"
                    stroke="rgba(255,255,255,0.10)"
                    strokeWidth={strokeWidth}
                  />

                  <circle
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="none"
                    stroke="rgba(15,23,42,0.055)"
                    strokeWidth={strokeWidth}
                    opacity="0.55"
                  />

                  <circle
                    className="goal-progress-ring"
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="none"
                    stroke="var(--admin-primary)"
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={progressOffset}
                  />
                </svg>

                <span
                  className="pointer-events-none absolute right-[14px] top-[8px] h-[5px] w-[5px] rounded-full"
                  style={{
                    background: 'rgba(255,255,255,0.88)',
                    boxShadow:
                      '0 0 8px rgba(255,255,255,0.76), 0 0 13px color-mix(in srgb, var(--admin-primary) 22%, transparent)',
                  }}
                />

                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-[20px] font-black leading-none" style={styles.title}>
                    {percentage}%
                  </p>
                  <p className="mt-0.5 text-[9.5px] font-black leading-none" style={styles.muted}>
                    Completado
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <DashboardGoalModal
        isOpen={editor.isOpen}
        form={editor.form}
        currentGoal={editor.currentGoal || currentGoal}
        loading={editor.loading}
        saving={editor.saving}
        error={editor.error}
        formError={editor.formError}
        canSave={editor.canSave}
        onClose={editor.closeEditor}
        onChange={editor.updateField}
        onSubmit={editor.saveGoal}
      />
    </>
  );
}
