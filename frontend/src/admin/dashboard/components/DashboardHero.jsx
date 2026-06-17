// frontend/src/admin/dashboard/components/DashboardHero.jsx

import { Sparkles } from 'lucide-react';
import { dashboardStyles as styles } from '../dashboardStyles';

export default function DashboardHero() {
  return (
    <section className="relative overflow-hidden px-7 py-5 lg:px-9 lg:py-6" style={styles.hero}>
      <div className="relative z-10 grid min-h-[118px] gap-5 lg:grid-cols-[minmax(0,1fr)_390px] lg:items-center">
        <div className="flex items-center gap-5">
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center"
            style={{
              borderRadius: '18px',
              border: '1px solid rgba(255,255,255,0.78)',
              background: 'linear-gradient(135deg, rgba(255,255,255,0.88), rgba(255,238,245,0.72))',
              color: 'var(--admin-primary)',
              boxShadow: '0 16px 36px rgba(219,39,119,0.10), inset 0 1px 0 rgba(255,255,255,0.86)',
            }}
          >
            <Sparkles size={22} />
          </span>

          <div className="min-w-0">
            <h1 className="text-3xl font-black tracking-tight md:text-[40px]" style={styles.title}>
              Panel de control
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6" style={styles.muted}>
              Resumen general de tu tienda. Revisa el rendimiento y toma decisiones inteligentes.
            </p>
          </div>
        </div>

        <div className="relative hidden h-[118px] lg:block">
          <div
            className="absolute inset-0"
            style={{
              borderRadius: '26px',
              border: '1px solid rgba(255,255,255,0.76)',
              background:
                'linear-gradient(110deg, rgba(255,255,255,0.32), rgba(255,255,255,0.58)), radial-gradient(circle at 74% 50%, rgba(244,114,182,0.28), transparent 34%)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.84), 0 18px 42px rgba(219,39,119,0.10)',
              backdropFilter: 'blur(18px)',
            }}
          />

          <div
            className="absolute right-14 top-4 h-28 w-28"
            style={{
              borderRadius: '999px 999px 46px 46px',
              border: '1px solid rgba(255,255,255,0.82)',
              background: 'linear-gradient(145deg, rgba(255,255,255,0.75), rgba(255,255,255,0.22))',
              boxShadow: 'inset 0 20px 42px rgba(255,255,255,0.45), 0 16px 38px rgba(190,24,93,0.12)',
              backdropFilter: 'blur(16px)',
            }}
          />

          <div
            className="absolute right-[92px] top-[47px] h-12 w-12"
            style={{
              borderRadius: '999px 999px 999px 8px',
              background: 'radial-gradient(circle at 32% 26%, rgba(255,255,255,0.92), transparent 18%), linear-gradient(135deg, #f9a8d4, #db2777)',
              transform: 'rotate(-38deg)',
              boxShadow: '0 16px 32px rgba(219,39,119,0.22)',
            }}
          />

          <div
            className="absolute right-[102px] top-[86px] h-14 w-[6px]"
            style={{
              borderRadius: '999px',
              background: 'linear-gradient(180deg, #22c55e, #86efac)',
              transform: 'rotate(10deg)',
            }}
          />

          <div
            className="absolute bottom-4 right-11 h-5 w-40"
            style={{
              borderRadius: '999px',
              border: '1px solid rgba(255,255,255,0.78)',
              background: 'linear-gradient(135deg, rgba(255,255,255,0.78), rgba(255,240,246,0.58))',
              boxShadow: '0 12px 26px rgba(15,23,42,0.06)',
            }}
          />
        </div>
      </div>
    </section>
  );
}
