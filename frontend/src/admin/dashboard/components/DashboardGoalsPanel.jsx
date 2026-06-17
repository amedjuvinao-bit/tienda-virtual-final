// frontend/src/admin/dashboard/components/DashboardGoalsPanel.jsx

import { Edit3, Target } from 'lucide-react';
import { dashboardStyles as styles } from '../dashboardStyles';

export default function DashboardGoalsPanel({ goal }) {
  const percentage = Math.min(Math.max(Number(goal?.percentage || 0), 0), 100);
  const circleSize = 108;
  const strokeWidth = 11;
  const radius = (circleSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progressOffset = circumference - (percentage / 100) * circumference;

  return (
    <section className="p-5" style={styles.card}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center" style={styles.kpiIcon}>
            <Target size={18} />
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

        <button type="button" className="inline-flex shrink-0 items-center gap-2 text-xs font-black transition hover:opacity-80" style={styles.eyebrow}>
          <Edit3 size={14} />
          Editar meta
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_118px] md:items-center">
        <div className="min-w-0">
          <p className="text-sm font-black" style={styles.muted}>
            {goal?.title}
          </p>

          <p className="mt-2 text-2xl font-black tracking-tight" style={styles.title}>
            {goal?.goal}
          </p>

          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between gap-3 text-xs font-black">
              <span style={styles.muted}>{goal?.detail}</span>
              <span style={styles.eyebrow}>{percentage}%</span>
            </div>

            <div className="h-3 overflow-hidden" style={styles.progressTrack}>
              <div className="h-full" style={{ ...styles.progressFill, width: `${percentage}%` }} />
            </div>
          </div>
        </div>

        <div className="flex justify-center">
          <div className="relative h-[118px] w-[118px]">
            <svg width="118" height="118" viewBox="0 0 118 118" className="-rotate-90" role="img" aria-label={`Meta completada ${percentage}%`}>
              <circle cx="59" cy="59" r={radius} fill="none" stroke="rgba(15,23,42,0.08)" strokeWidth={strokeWidth} />
              <circle
                cx="59"
                cy="59"
                r={radius}
                fill="none"
                stroke="var(--admin-primary)"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={progressOffset}
                style={{ filter: 'drop-shadow(0 10px 16px rgba(219,39,119,0.20))' }}
              />
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-2xl font-black" style={styles.title}>{percentage}%</p>
              <p className="text-xs font-black" style={styles.muted}>Completado</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
