// frontend/src/admin/dashboard/components/HeroLightRibbon.jsx

function CrystalDot({ className = '', size = 10, opacity = 1 }) {
  return (
    <span
      className={`hero-ribbon-dot absolute ${className}`}
      style={{
        width: size,
        height: size,
        opacity,
      }}
    >
      <span
        className="absolute inset-[-8px] rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(255,255,255,0.42) 0%, color-mix(in srgb, var(--admin-primary) 16%, transparent) 34%, transparent 74%)',
          filter: 'blur(2.2px)',
        }}
      />

      <span
        className="absolute inset-0 rounded-full"
        style={{
          border: '1px solid rgba(255,255,255,0.72)',
          background:
            'radial-gradient(circle at 34% 28%, rgba(255,255,255,0.78) 0%, rgba(255,255,255,0.18) 22%, rgba(255,255,255,0.035) 54%, transparent 100%)',
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,0.86), inset 0 -2px 5px rgba(15,23,42,0.10), 0 0 8px rgba(255,255,255,0.34), 0 0 14px color-mix(in srgb, var(--admin-primary) 22%, transparent)',
          backdropFilter: 'blur(7px) saturate(150%)',
          WebkitBackdropFilter: 'blur(7px) saturate(150%)',
        }}
      />

      <span
        className="absolute left-1/2 top-1/2 h-[3px] w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background: 'rgba(255,255,255,0.9)',
          boxShadow:
            '0 0 8px rgba(255,255,255,0.72), 0 0 13px color-mix(in srgb, var(--admin-primary) 22%, transparent)',
        }}
      />

      <span
        className="absolute left-1/2 top-1/2 h-px w-7 -translate-x-1/2 -translate-y-1/2"
        style={{
          background:
            'linear-gradient(90deg, transparent, rgba(255,255,255,0.78), transparent)',
          opacity: 0.58,
        }}
      />

      <span
        className="absolute left-1/2 top-1/2 h-7 w-px -translate-x-1/2 -translate-y-1/2"
        style={{
          background:
            'linear-gradient(180deg, transparent, rgba(255,255,255,0.62), transparent)',
          opacity: 0.34,
        }}
      />
    </span>
  );
}

function CrystalIconChip({ children }) {
  return (
    <span
      className="hero-icon-chip relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-[14px]"
      style={{
        border: '1px solid rgba(255,255,255,0.42)',
        background: 'rgba(255,255,255,0.006)',
        color: 'var(--admin-primary)',
        boxShadow: `
          inset 0 1px 0 rgba(255,255,255,0.78),
          inset 0 -1px 0 rgba(15,23,42,0.15),
          inset 0 0 0 1px rgba(255,255,255,0.05),
          inset 6px 6px 12px rgba(255,255,255,0.03),
          inset -8px -8px 16px rgba(15,23,42,0.08),
          0 7px 16px rgba(12,6,35,0.10),
          0 0 14px rgba(255,255,255,0.17),
          0 0 16px color-mix(in srgb, var(--admin-primary) 15%, transparent)
        `,
        backdropFilter: 'blur(30px) saturate(200%)',
        WebkitBackdropFilter: 'blur(30px) saturate(200%)',
        transition: 'transform 240ms ease, filter 240ms ease',
        willChange: 'transform, filter',
      }}
    >
      <span
        className="pointer-events-none absolute left-[7px] right-[7px] top-[4px] h-px"
        style={{
          background:
            'linear-gradient(90deg, transparent, rgba(255,255,255,0.90), transparent)',
          opacity: 0.9,
        }}
      />

      <span
        className="pointer-events-none absolute bottom-[7px] left-[4px] top-[7px] w-px"
        style={{
          background:
            'linear-gradient(180deg, transparent, rgba(255,255,255,0.50), transparent)',
          opacity: 0.68,
        }}
      />

      <span
        className="hero-icon-chip-shine pointer-events-none absolute -right-3 -top-8 h-[56px] w-[5px] rotate-[34deg]"
        style={{
          background:
            'linear-gradient(90deg, transparent, rgba(255,255,255,0.62), transparent)',
          opacity: 0.54,
          filter: 'blur(0.2px)',
        }}
      />

      <span
        className="pointer-events-none absolute right-[6px] top-[6px] h-[4px] w-[4px] rounded-full"
        style={{
          background: 'rgba(255,255,255,0.86)',
          boxShadow:
            '0 0 8px rgba(255,255,255,0.82), 0 0 11px color-mix(in srgb, var(--admin-primary) 18%, transparent)',
          opacity: 0.82,
        }}
      />

      <span
        className="pointer-events-none absolute inset-[1px] rounded-[13px]"
        style={{
          border: '1px solid rgba(255,255,255,0.07)',
          boxShadow: `
            inset 0 0 10px rgba(255,255,255,0.035),
            inset 0 0 16px rgba(15,23,42,0.03)
          `,
        }}
      />

      <span
        className="relative z-10"
        style={{
          filter: `
            drop-shadow(0 0 6px color-mix(in srgb, var(--admin-primary) 48%, transparent))
            drop-shadow(0 1px 0 rgba(255,255,255,0.50))
          `,
        }}
      >
        {children}
      </span>
    </span>
  );
}

function CrystalMetricCard({
  className = '',
  title,
  value,
  helper,
  rotate = '0deg',
  icon,
}) {
  return (
    <div
      className={`hero-metric-card absolute z-20 overflow-hidden rounded-[24px] px-3.5 py-3 ${className}`}
      style={{
        transform: `translateY(var(--hero-card-y, 0px)) rotate(${rotate}) scale(var(--hero-card-scale, 1))`,
        border: '1px solid rgba(255,255,255,0.78)',
        background: `
          linear-gradient(
            145deg,
            rgba(255,255,255,0.28) 0%,
            rgba(255,255,255,0.14) 42%,
            color-mix(in srgb, var(--admin-primary) 6%, rgba(255,255,255,0.065)) 100%
          )
        `,
        boxShadow: `
          inset 0 1px 0 rgba(255,255,255,0.94),
          inset 0 0 0 1px rgba(15,23,42,0.035),
          inset 0 0 22px rgba(255,255,255,0.10),
          inset 0 -12px 24px rgba(255,255,255,0.055),
          0 15px 30px rgba(12,6,35,0.18),
          0 0 22px rgba(255,255,255,0.08)
        `,
        backdropFilter: 'blur(26px) saturate(190%)',
        WebkitBackdropFilter: 'blur(26px) saturate(190%)',
        transition: 'transform 280ms ease, filter 280ms ease, box-shadow 280ms ease',
        willChange: 'transform, filter',
      }}
    >
      <span
        className="pointer-events-none absolute inset-x-4 top-0 h-px"
        style={{
          background:
            'linear-gradient(90deg, transparent, rgba(255,255,255,0.92), transparent)',
        }}
      />

      <span
        className="pointer-events-none absolute inset-x-0 top-0 h-11"
        style={{
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0.045) 50%, transparent)',
        }}
      />

      <span
        className="pointer-events-none absolute inset-x-0 bottom-0 h-11"
        style={{
          background: 'linear-gradient(180deg, transparent, rgba(15,23,42,0.065))',
          opacity: 0.38,
        }}
      />

      <span
        className="hero-metric-card-shine pointer-events-none absolute -right-3 -top-10 h-28 w-9 rotate-[33deg]"
        style={{
          background:
            'linear-gradient(90deg, transparent, rgba(255,255,255,0.74), transparent)',
          opacity: 0.72,
          filter: 'blur(0.35px)',
        }}
      />

      <span
        className="pointer-events-none absolute right-4 top-4 h-[7px] w-[7px] rounded-full"
        style={{
          background: 'rgba(255,255,255,0.90)',
          boxShadow:
            '0 0 9px rgba(255,255,255,0.78), 0 0 14px color-mix(in srgb, var(--admin-primary) 18%, transparent)',
        }}
      />

      <div className="relative z-10 flex items-center gap-2">
        <CrystalIconChip>{icon}</CrystalIconChip>

        <div>
          <p
            className="text-[13px] font-black leading-none"
            style={{
              color: 'rgba(15,23,42,0.90)',
              textShadow: '0 1px 0 rgba(255,255,255,0.46)',
            }}
          >
            {title}
          </p>

          <p
            className="mt-1 text-[24px] font-black leading-none"
            style={{
              color: 'rgba(2,6,23,0.95)',
              textShadow: '0 1px 0 rgba(255,255,255,0.56)',
            }}
          >
            {value}
          </p>
        </div>
      </div>

      <p
        className="relative z-10 mt-2 text-[10.5px] font-black leading-[13px]"
        style={{
          color: '#10b981',
          textShadow: '0 1px 0 rgba(255,255,255,0.40)',
        }}
      >
        ↗ {helper}
      </p>

      <div
        className="relative z-10 mt-2 h-[3px] overflow-hidden rounded-full"
        style={{
          background: 'rgba(255,255,255,0.16)',
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,0.32), inset 0 -1px 0 rgba(15,23,42,0.09)',
        }}
      >
        <span
          className="block h-full w-[72%] rounded-full"
          style={{
            background:
              'linear-gradient(90deg, var(--admin-primary), color-mix(in srgb, var(--admin-primary) 42%, white))',
            boxShadow:
              '0 0 16px color-mix(in srgb, var(--admin-primary) 46%, transparent)',
          }}
        />
      </div>
    </div>
  );
}

export default function HeroLightRibbon() {
  return (
    <>
      <style>
        {`
          @keyframes heroRibbonFadeIn {
            0% {
              opacity: 0;
              filter: blur(8px) saturate(0.96);
            }
            100% {
              opacity: 1;
              filter: blur(0) saturate(1);
            }
          }

          @keyframes heroRibbonDotIn {
            0% {
              opacity: 0;
              transform: scale(0.55);
              filter: blur(4px);
            }
            100% {
              opacity: 1;
              transform: scale(1);
              filter: blur(0);
            }
          }

          @keyframes heroRibbonShineDrift {
            0%, 100% {
              opacity: 0.50;
            }
            50% {
              opacity: 0.88;
            }
          }

          .hero-ribbon-root {
            animation: heroRibbonFadeIn 780ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
          }

          .hero-ribbon-ambient {
            animation: heroRibbonFadeIn 900ms cubic-bezier(0.2, 0.8, 0.2, 1) 120ms both;
          }

          .hero-ribbon-bar {
            animation: heroRibbonFadeIn 760ms cubic-bezier(0.2, 0.8, 0.2, 1) 180ms both;
            transition: filter 260ms ease, opacity 260ms ease;
          }

          .hero-ribbon-dot {
            animation: heroRibbonDotIn 620ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
          }

          .hero-ribbon-dot:nth-of-type(3) { animation-delay: 180ms; }
          .hero-ribbon-dot:nth-of-type(4) { animation-delay: 230ms; }
          .hero-ribbon-dot:nth-of-type(5) { animation-delay: 280ms; }
          .hero-ribbon-dot:nth-of-type(6) { animation-delay: 330ms; }

          .hero-metric-card {
            --hero-card-y: 0px;
            --hero-card-scale: 1;
            animation: heroRibbonFadeIn 780ms cubic-bezier(0.2, 0.8, 0.2, 1) 260ms both;
          }

          .hero-metric-card:nth-of-type(10) {
            animation-delay: 340ms;
          }

          .dashboard-hero-glass:hover .hero-ribbon-bar {
            filter: brightness(1.035) saturate(1.06);
          }

          .dashboard-hero-glass:hover .hero-metric-card {
            --hero-card-y: -2px;
            --hero-card-scale: 1.01;
            filter: brightness(1.035) saturate(1.06);
          }

          .dashboard-hero-glass:hover .hero-icon-chip {
            transform: translateY(-1px) scale(1.02);
            filter: brightness(1.06) saturate(1.08);
          }

          .dashboard-hero-glass:hover .hero-icon-chip-shine,
          .dashboard-hero-glass:hover .hero-metric-card-shine {
            animation: heroRibbonShineDrift 1.8s ease-in-out infinite;
          }

          .dashboard-hero-glass:hover .hero-ribbon-dot {
            filter: brightness(1.08);
          }

          @media (prefers-reduced-motion: reduce) {
            .hero-ribbon-root,
            .hero-ribbon-ambient,
            .hero-ribbon-bar,
            .hero-ribbon-dot,
            .hero-metric-card,
            .hero-icon-chip-shine,
            .hero-metric-card-shine {
              animation: none !important;
              transition: none !important;
            }

            .dashboard-hero-glass:hover .hero-metric-card,
            .dashboard-hero-glass:hover .hero-icon-chip {
              transform: none !important;
              filter: none !important;
            }
          }
        `}
      </style>

      <div className="hero-ribbon-root relative h-full w-full overflow-visible">
        <span
          className="hero-ribbon-ambient absolute right-[96px] top-[30px] h-[118px] w-[380px] rounded-full"
          style={{
            background: `
              radial-gradient(
                ellipse,
                rgba(255,255,255,0.12) 0%,
                color-mix(in srgb, var(--admin-primary) 7%, transparent) 34%,
                rgba(15,23,42,0.03) 62%,
                transparent 76%
              )
            `,
            filter: 'blur(20px)',
            opacity: 0.68,
          }}
        />

        <div className="hero-ribbon-bar absolute left-[326px] top-[2px] z-50 w-[248px] -rotate-[3deg] overflow-visible">
          <div className="flex items-center justify-between gap-5 pr-2">
            <p
              className="whitespace-nowrap text-[10.5px] font-black leading-none"
              style={{
                color: 'rgba(15,23,42,0.90)',
                textShadow: '0 1px 0 rgba(255,255,255,0.70)',
              }}
            >
              Rendimiento semanal
            </p>

            <p
              className="min-w-[28px] text-right text-[11.5px] font-black leading-none"
              style={{
                color: 'rgba(15,23,42,0.90)',
                textShadow: '0 1px 0 rgba(255,255,255,0.70)',
              }}
            >
              7%
            </p>
          </div>

          <div
            className="relative mt-2 h-[9px] w-[214px] overflow-hidden rounded-full"
            style={{
              border: '1px solid rgba(255,255,255,0.68)',
              background: `
                linear-gradient(
                  180deg,
                  rgba(255,255,255,0.40) 0%,
                  rgba(255,255,255,0.18) 46%,
                  rgba(255,255,255,0.08) 100%
                )
              `,
              boxShadow: `
                inset 0 1px 0 rgba(255,255,255,0.82),
                inset 0 -1px 0 rgba(15,23,42,0.09),
                inset 0 0 9px rgba(255,255,255,0.09),
                0 7px 16px rgba(12,6,35,0.09)
              `,
              backdropFilter: 'blur(14px) saturate(160%)',
              WebkitBackdropFilter: 'blur(14px) saturate(160%)',
            }}
          >
            <span
              className="absolute inset-x-2 top-0 h-px"
              style={{
                background:
                  'linear-gradient(90deg, transparent, rgba(255,255,255,0.88), transparent)',
              }}
            />

            <span
              className="absolute bottom-[2px] left-[2px] top-[2px] w-[76%] rounded-full"
              style={{
                background:
                  'linear-gradient(90deg, var(--admin-primary), color-mix(in srgb, var(--admin-primary) 42%, white))',
                boxShadow:
                  '0 0 15px color-mix(in srgb, var(--admin-primary) 50%, transparent), inset 0 1px 0 rgba(255,255,255,0.50)',
              }}
            />

            <span
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(110deg, transparent 0%, rgba(255,255,255,0.11) 42%, rgba(255,255,255,0.34) 50%, rgba(255,255,255,0.09) 58%, transparent 100%)',
                opacity: 0.60,
              }}
            />
          </div>
        </div>

        <CrystalDot className="left-[402px] top-[30px] z-40" size={9} opacity={0.9} />
        <CrystalDot className="right-[94px] top-[26px] z-40" size={9} opacity={0.86} />
        <CrystalDot className="left-[214px] top-[74px] z-30" size={7} opacity={0.68} />
        <CrystalDot className="left-[308px] top-[92px] z-30" size={7} opacity={0.68} />
        <CrystalDot className="right-[248px] top-[68px] z-30" size={7} opacity={0.72} />
        <CrystalDot className="left-[378px] top-[58px] z-30" size={8} opacity={0.80} />
        <CrystalDot className="right-[336px] top-[104px] z-30" size={6} opacity={0.62} />

        <CrystalMetricCard
          className="right-[244px] top-[50px] h-[98px] w-[154px]"
          rotate="-7deg"
          title="Ventas"
          value="18.5%"
          helper="18.5% vs. semana anterior"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M4 19V5M4 19H20M8 15L11 12L14 14L19 8"
                stroke="currentColor"
                strokeWidth="2.35"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          }
        />

        <CrystalMetricCard
          className="right-[96px] top-[36px] h-[98px] w-[154px]"
          rotate="6deg"
          title="Pedidos"
          value="243"
          helper="12.7% vs. semana anterior"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M6 6H21L19 14H8L6 3H3M9 19.5H9.01M18 19.5H18.01"
                stroke="currentColor"
                strokeWidth="2.35"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          }
        />
      </div>
    </>
  );
}