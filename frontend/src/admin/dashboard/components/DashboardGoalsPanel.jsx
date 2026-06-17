// frontend/src/admin/dashboard/components/DashboardGoalsPanel.jsx

import { Edit3, Target } from 'lucide-react';
import { dashboardStyles as styles } from '../dashboardStyles';

export default function DashboardGoalsPanel({ goal }) {
  const percentage = Math.min(Math.max(Number(goal?.percentage || 0), 0), 100);
  const circleSize = 116;
  const strokeWidth = 12;
  const radius = (circleSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progressOffset = circumference - (percentage / 100) * circumference;

  return (
    <section className="p-5 lg:p-6" style={styles.card}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            className="flex h-11 w-11 items-center justify-center"
            style={styles.kpiIcon}
          >
            <Target size={20} />
          </span>

          <div>
            <h2 className="text-lg font-black" style={styles.title}>
              Metas del mes
            </h2>

            <p className="mt-1 text-sm" style={styles.muted}>
              Seguimiento de objetivos comerciales.
            </p>
          </div>
        </div>

        <button
          type="button"
          className="inline-flex shrink-0 items-center gap-2 text-xs font-black transition hover:opacity-80"
          style={styles.eyebrow}
        >
          <Edit3 size={14} />
          Editar meta
        </button>
      </div>

      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_130px] md:items-center">
        <div>
          <p className="text-sm font-black" style={styles.muted}>
            {goal?.title}
          </p>

          <p className="mt-3 text-3xl font-black tracking-tight" style={styles.title}>
            {goal?.goal}
          </p>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between gap-3 text-xs font-black">
              <span style={styles.muted}>{goal?.detail}</span>
              <span style={styles.eyebrow}>{percentage}%</span>
            </div>

            <div className="h-3 overflow-hidden" style={styles.progressTrack}>
              <div
                className="h-full"
                style={{
                  ...styles.progressFill,
                  width: `${percentage}%`,
                }}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-center">
          <div className="relative h-[130px] w-[130px]">
            <svg
              width="130"
              height="130"
              viewBox="0 0 130 130"
              className="-rotate-90"
              role="img"
              aria-label={`Meta completada ${percentage}%`}
            >
              <circle
                cx="65"
                cy="65"
                r={radius}
                fill="none"
                stroke="var(--admin-card-border)"
                strokeWidth={strokeWidth}
              />

              <circle
                cx="65"
                cy="65"
                r={radius}
                fill="none"
                stroke="var(--admin-primary)"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={progressOffset}
                style={{
                  filter:
                    'drop-shadow(0 10px 18px color-mix(in srgb, var(--admin-primary) 28%, transparent))',
                }}
              />
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-2xl font-black" style={styles.title}>
                {percentage}%
              </p>

              <p className="text-xs font-black" style={styles.muted}>
                Completado
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}