// frontend/src/admin/dashboard/components/DashboardHero.jsx

import { Sparkles } from 'lucide-react';
import { dashboardStyles as styles } from '../dashboardStyles';

export default function DashboardHero() {
  return (
    <section
      className="relative overflow-hidden px-7 py-6 lg:px-10 lg:py-7"
      style={{
        ...styles.hero,
        minHeight: '150px',
      }}
    >
      <div className="relative z-10 grid min-h-[118px] gap-6 lg:grid-cols-[minmax(0,1fr)_390px] lg:items-center">
        <div className="max-w-3xl">
          <div className="flex items-center gap-4">
            <span
              className="flex h-12 w-12 shrink-0 items-center justify-center"
              style={{
                borderRadius: '18px',
                border: '1px solid rgba(255,255,255,0.72)',
                background:
                  'linear-gradient(135deg, rgba(255,255,255,0.88), color-mix(in srgb, var(--admin-primary) 13%, rgba(255,255,255,0.68)))',
                color: 'var(--admin-primary)',
                boxShadow:
                  '0 18px 38px color-mix(in srgb, var(--admin-primary) 14%, transparent), inset 0 1px 0 rgba(255,255,255,0.75)',
              }}
            >
              <Sparkles size={22} />
            </span>

            <div>
              <h1
                className="text-3xl font-black tracking-tight md:text-4xl"
                style={styles.title}
              >
                Panel de control
              </h1>

              <p
                className="mt-2 max-w-2xl text-sm leading-6 md:text-[15px]"
                style={styles.muted}
              >
                Resumen general de tu tienda. Revisa el rendimiento y toma decisiones inteligentes.
              </p>
            </div>
          </div>
        </div>

        <div className="relative hidden h-[126px] lg:block">
          <div
            className="absolute inset-0"
            style={{
              borderRadius: '28px',
              border: '1px solid rgba(255,255,255,0.70)',
              background:
                'linear-gradient(110deg, rgba(255,255,255,0.16), rgba(255,255,255,0.56)), radial-gradient(circle at 72% 48%, color-mix(in srgb, var(--admin-primary) 25%, transparent), transparent 36%)',
              boxShadow:
                'inset 0 1px 0 rgba(255,255,255,0.75), 0 24px 64px rgba(219,39,119,0.10)',
              backdropFilter: 'blur(18px)',
            }}
          />

          <div
            className="absolute right-12 top-4 h-28 w-28"
            style={{
              borderRadius: '999px 999px 48px 48px',
              border: '1px solid rgba(255,255,255,0.78)',
              background:
                'linear-gradient(145deg, rgba(255,255,255,0.74), rgba(255,255,255,0.22))',
              boxShadow:
                'inset 0 20px 44px rgba(255,255,255,0.46), 0 18px 46px rgba(190,24,93,0.13)',
              backdropFilter: 'blur(16px)',
            }}
          />

          <div
            className="absolute right-[82px] top-[48px] h-12 w-12"
            style={{
              borderRadius: '999px 999px 999px 8px',
              background:
                'radial-gradient(circle at 32% 26%, rgba(255,255,255,0.92), transparent 18%), linear-gradient(135deg, #f9a8d4, #db2777)',
              transform: 'rotate(-38deg)',
              boxShadow: '0 16px 32px rgba(219,39,119,0.22)',
            }}
          />

          <div
            className="absolute right-[93px] top-[88px] h-14 w-[6px]"
            style={{
              borderRadius: '999px',
              background: 'linear-gradient(180deg, #22c55e, #86efac)',
              transform: 'rotate(10deg)',
            }}
          />

          <div
            className="absolute bottom-5 right-9 h-5 w-40"
            style={{
              borderRadius: '999px',
              border: '1px solid rgba(255,255,255,0.72)',
              background:
                'linear-gradient(135deg, rgba(255,255,255,0.78), color-mix(in srgb, var(--admin-primary) 15%, rgba(255,255,255,0.52)))',
              boxShadow: '0 12px 28px rgba(15,23,42,0.07)',
            }}
          />

          <div
            className="absolute left-8 top-5 h-3 w-3 rounded-full"
            style={{
              background: 'rgba(255,255,255,0.95)',
              boxShadow:
                '0 0 22px rgba(255,255,255,0.95), 0 0 38px color-mix(in srgb, var(--admin-primary) 22%, transparent)',
            }}
          />

          <div
            className="absolute left-24 bottom-8 h-2 w-2 rounded-full"
            style={{
              background: 'rgba(255,255,255,0.88)',
              boxShadow: '0 0 20px rgba(255,255,255,0.9)',
            }}
          />
        </div>
      </div>
    </section>
  );
}