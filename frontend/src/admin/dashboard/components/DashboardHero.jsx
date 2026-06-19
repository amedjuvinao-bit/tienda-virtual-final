// frontend/src/admin/dashboard/components/DashboardHero.jsx

import HeroLightRibbon from './HeroLightRibbon';

function GlassTitle({ children }) {
  return (
    <h1 className="relative inline-block leading-none tracking-tight">
      <span
        className="absolute inset-0 block text-[30px] font-black md:text-[40px]"
        style={{
          fontFamily: '"Playfair Display", Georgia, serif',
          letterSpacing: '-0.035em',
          color: 'rgba(15,23,42,0.34)',
          transform: 'translate(2.5px, 3.5px)',
          filter: 'blur(1px)',
          opacity: 0.58,
        }}
      >
        {children}
      </span>

      <span
        className="absolute inset-0 block text-[30px] font-black md:text-[40px]"
        style={{
          fontFamily: '"Playfair Display", Georgia, serif',
          letterSpacing: '-0.035em',
          color: 'transparent',
          WebkitTextStroke:
            '1.3px color-mix(in srgb, var(--admin-primary) 34%, rgba(255,255,255,0.76))',
          textShadow: `
            0 0 8px color-mix(in srgb, var(--admin-primary) 22%, transparent),
            0 0 12px color-mix(in srgb, var(--admin-primary) 14%, transparent)
          `,
          opacity: 0.94,
        }}
      >
        {children}
      </span>

      <span
        className="relative block text-[30px] font-black md:text-[40px]"
        style={{
          fontFamily: '"Playfair Display", Georgia, serif',
          letterSpacing: '-0.035em',
          color: 'rgba(255,255,255,0.90)',
          WebkitTextStroke: '0.45px rgba(255,255,255,0.86)',
          textShadow: `
            0 1px 0 rgba(255,255,255,0.90),
            0 2px 6px rgba(15,23,42,0.22),
            0 6px 14px rgba(15,23,42,0.11),
            0 0 12px rgba(255,255,255,0.24),
            0 0 16px color-mix(in srgb, var(--admin-primary) 16%, transparent)
          `,
        }}
      >
        {children}
      </span>

      <span
        className="pointer-events-none absolute left-1 right-4 top-1 h-4 rounded-full"
        style={{
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.68), rgba(255,255,255,0.16) 45%, transparent)',
          filter: 'blur(5px)',
          opacity: 0.54,
          mixBlendMode: 'screen',
        }}
      />

      <span
        className="pointer-events-none absolute bottom-[-4px] left-3 h-px w-[72%]"
        style={{
          background:
            'linear-gradient(90deg, transparent, color-mix(in srgb, var(--admin-primary) 34%, rgba(255,255,255,0.58)), transparent)',
          opacity: 0.72,
        }}
      />
    </h1>
  );
}

export default function DashboardHero({
  title = 'Panel de control',
  subtitle = 'Resumen general de tu tienda. Revisa el rendimiento y toma decisiones inteligentes.',
}) {
  return (
    <>
      <style>
        {`
          @keyframes dashboardHeroEnter {
            0% {
              opacity: 0;
              transform: translateY(18px) scale(0.985);
              filter: blur(8px);
            }
            60% {
              opacity: 1;
              filter: blur(0);
            }
            100% {
              opacity: 1;
              transform: translateY(0) scale(1);
              filter: blur(0);
            }
          }

          @keyframes dashboardHeroTextEnter {
            0% {
              opacity: 0;
              transform: translateX(-18px);
              filter: blur(6px);
            }
            100% {
              opacity: 1;
              transform: translateX(0);
              filter: blur(0);
            }
          }

          @keyframes dashboardHeroRibbonEnter {
            0% {
              opacity: 0;
              transform: translateX(22px) scale(0.98);
              filter: blur(8px);
            }
            100% {
              opacity: 1;
              transform: translateX(0) scale(1);
              filter: blur(0);
            }
          }

          @keyframes dashboardHeroSoftPulse {
            0%, 100% {
              opacity: 0.36;
              transform: translateX(-18%) rotate(35deg);
            }
            50% {
              opacity: 0.62;
              transform: translateX(10%) rotate(35deg);
            }
          }

          .dashboard-hero-glass {
            animation: dashboardHeroEnter 720ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
            transform-origin: center top;
            transition:
              transform 260ms ease,
              filter 260ms ease;
            will-change: transform, filter;
          }

          .dashboard-hero-glass:hover {
            transform: translateY(-2px);
            filter: saturate(1.03) brightness(1.01);
          }

          .dashboard-hero-text {
            animation: dashboardHeroTextEnter 760ms cubic-bezier(0.2, 0.8, 0.2, 1) 110ms both;
          }

          .dashboard-hero-ribbon {
            animation: dashboardHeroRibbonEnter 840ms cubic-bezier(0.2, 0.8, 0.2, 1) 180ms both;
          }

          .dashboard-hero-hover-shine {
            opacity: 0;
            transition:
              opacity 260ms ease,
              transform 520ms ease;
          }

          .dashboard-hero-glass:hover .dashboard-hero-hover-shine {
            opacity: 1;
            animation: dashboardHeroSoftPulse 2.8s ease-in-out infinite;
          }

          .dashboard-hero-glass:hover .dashboard-hero-text {
            transform: translateY(-1px);
          }

          .dashboard-hero-glass:hover .dashboard-hero-ribbon {
            transform: translateY(-1px);
          }

          @media (prefers-reduced-motion: reduce) {
            .dashboard-hero-glass,
            .dashboard-hero-text,
            .dashboard-hero-ribbon,
            .dashboard-hero-hover-shine {
              animation: none !important;
              transition: none !important;
            }

            .dashboard-hero-glass:hover,
            .dashboard-hero-glass:hover .dashboard-hero-text,
            .dashboard-hero-glass:hover .dashboard-hero-ribbon {
              transform: none !important;
              filter: none !important;
            }
          }
        `}
      </style>

      <section
        className="dashboard-hero-glass relative overflow-hidden px-5 py-3 lg:px-6 lg:py-3"
        style={{
          borderRadius: '28px',
          border: '1px solid rgba(255,255,255,0.84)',
          background: `
            linear-gradient(
              135deg,
              rgba(255,255,255,0.26) 0%,
              rgba(255,255,255,0.13) 46%,
              color-mix(in srgb, var(--admin-primary) 8%, rgba(255,255,255,0.08)) 100%
            )
          `,
          boxShadow: `
            inset 0 1px 0 rgba(255,255,255,0.96),
            inset 0 0 28px rgba(255,255,255,0.09),
            inset 0 -12px 22px rgba(255,255,255,0.045),
            0 10px 24px rgba(12,6,35,0.10),
            0 0 20px color-mix(in srgb, var(--admin-primary) 8%, transparent)
          `,
          backdropFilter: 'blur(26px) saturate(180%)',
          WebkitBackdropFilter: 'blur(26px) saturate(180%)',
        }}
      >
        <span
          className="pointer-events-none absolute inset-x-10 top-0 h-px"
          style={{
            background:
              'linear-gradient(90deg, transparent, rgba(255,255,255,1), transparent)',
          }}
        />

        <span
          className="pointer-events-none absolute inset-0"
          style={{
            background: `
              linear-gradient(
                180deg,
                rgba(255,255,255,0.14) 0%,
                rgba(255,255,255,0.05) 28%,
                transparent 58%
              ),
              radial-gradient(circle at 18% 18%, rgba(255,255,255,0.12) 0%, transparent 20%),
              radial-gradient(circle at 80% 24%, rgba(255,255,255,0.08) 0%, transparent 18%)
            `,
          }}
        />

        <span
          className="pointer-events-none absolute -right-8 -top-12 h-48 w-12 rotate-[35deg]"
          style={{
            background:
              'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 22%, rgba(255,255,255,0.58) 48%, rgba(255,255,255,0.14) 70%, transparent 100%)',
            opacity: 0.56,
            filter: 'blur(0.3px)',
          }}
        />

        <span
          className="dashboard-hero-hover-shine pointer-events-none absolute -right-10 -top-12 h-56 w-14"
          style={{
            background:
              'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 22%, rgba(255,255,255,0.72) 48%, rgba(255,255,255,0.14) 70%, transparent 100%)',
            filter: 'blur(1px)',
          }}
        />

        <div className="relative z-10 min-h-[122px]">
          <div className="dashboard-hero-text relative z-30 max-w-[500px] pl-4 pt-3 md:pl-5 lg:pl-6">
            <GlassTitle>{title}</GlassTitle>

            <p
              className="mt-2.5 max-w-[470px] text-[13.5px] font-semibold leading-5 md:text-[14px]"
              style={{
                color:
                  'color-mix(in srgb, var(--admin-primary) 62%, rgba(255,255,255,0.92))',
                textShadow: `
                  0 1px 0 rgba(255,255,255,0.30),
                  0 2px 6px color-mix(in srgb, var(--admin-primary) 15%, transparent),
                  0 0 8px rgba(255,255,255,0.14)
                `,
              }}
            >
              {subtitle}
            </p>
          </div>

          <div className="dashboard-hero-ribbon pointer-events-none absolute right-[-18px] top-[0px] z-20 hidden h-[154px] w-[770px] overflow-visible lg:block">
            <div
              className="h-full w-full"
              style={{
                transform: 'scaleX(0.84) scaleY(0.76)',
                transformOrigin: 'top right',
              }}
            >
              <HeroLightRibbon />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}