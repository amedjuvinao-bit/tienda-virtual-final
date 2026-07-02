// frontend/src/admin/dashboard/components/DashboardInventoryByBranch.jsx

import { Building2, ChevronRight, Store } from 'lucide-react';
import { dashboardStyles as styles } from '../dashboardStyles';

function formatNumber(value) {
  if (value === null || value === undefined) return '0';

  const number = Number(value);

  if (Number.isNaN(number)) return value;

  return number.toLocaleString('es-CO');
}

function clampPercentage(value) {
  return Math.min(Math.max(Number(value || 0), 0), 100);
}

function GlassIcon({ children, size = 'md' }) {
  const sizeClass =
    size === 'lg' ? 'h-11 w-11 rounded-[17px]' : 'h-9 w-9 rounded-[14px]';

  return (
    <span
      className={`inventory-glass-icon relative flex shrink-0 items-center justify-center overflow-hidden ${sizeClass}`}
      style={{
        border:
          '1px solid color-mix(in srgb, var(--admin-primary) 26%, rgba(255,255,255,0.42))',
        background: `
          linear-gradient(
            145deg,
            rgba(255,255,255,0.070) 0%,
            rgba(255,255,255,0.014) 50%,
            color-mix(in srgb, var(--admin-primary) 8%, transparent) 100%
          )
        `,
        color: 'var(--admin-primary)',
        boxShadow: `
          inset 0 1px 0 rgba(255,255,255,0.52),
          inset 0 -1px 0 rgba(15,23,42,0.16),
          0 9px 18px rgba(12,6,35,0.070),
          0 0 16px color-mix(in srgb, var(--admin-primary) 18%, transparent)
        `,
        backdropFilter: 'blur(18px) saturate(185%)',
        WebkitBackdropFilter: 'blur(18px) saturate(185%)',
      }}
    >
      <span
        className="pointer-events-none absolute inset-x-[8px] top-[4px] h-px"
        style={{
          background:
            'linear-gradient(90deg, transparent, rgba(255,255,255,0.90), transparent)',
        }}
      />

      <span
        className="pointer-events-none absolute right-[7px] top-[7px] h-[4px] w-[4px] rounded-full"
        style={{
          background: 'rgba(255,255,255,0.92)',
          boxShadow:
            '0 0 8px rgba(255,255,255,0.80), 0 0 14px color-mix(in srgb, var(--admin-primary) 28%, transparent)',
        }}
      />

      <span
        className="inventory-icon-shine pointer-events-none absolute -right-3 -top-7 h-16 w-[6px] rotate-[34deg]"
        style={{
          background:
            'linear-gradient(90deg, transparent, rgba(255,255,255,0.38), transparent)',
          opacity: 0.56,
        }}
      />

      <span className="relative z-10">{children}</span>
    </span>
  );
}

function GlassButton({ children }) {
  return (
    <button
      type="button"
      className="inventory-pro-button relative inline-flex h-9 shrink-0 items-center justify-center gap-1 overflow-hidden rounded-[14px] px-3 text-[11.5px] font-black"
      style={{
        border:
          '1px solid color-mix(in srgb, var(--admin-primary) 22%, rgba(255,255,255,0.40))',
        background: `
          linear-gradient(
            145deg,
            rgba(255,255,255,0.058) 0%,
            rgba(255,255,255,0.012) 54%,
            color-mix(in srgb, var(--admin-primary) 5%, transparent) 100%
          )
        `,
        color: 'var(--admin-card-text)',
        boxShadow: `
          inset 0 1px 0 rgba(255,255,255,0.44),
          inset 0 -1px 0 rgba(15,23,42,0.12),
          0 8px 16px rgba(12,6,35,0.055),
          0 0 12px color-mix(in srgb, var(--admin-primary) 12%, transparent)
        `,
        backdropFilter: 'blur(15px) saturate(170%)',
        WebkitBackdropFilter: 'blur(15px) saturate(170%)',
      }}
    >
      <span
        className="inventory-button-shine pointer-events-none absolute -left-8 top-[-16px] h-[58px] w-[13px]"
        style={{
          background:
            'linear-gradient(90deg, transparent, rgba(255,255,255,0.34), transparent)',
        }}
      />

      <span className="relative z-10">{children}</span>
      <ChevronRight size={13} className="relative z-10" />
    </button>
  );
}

function ProgressBar({ percentage }) {
  return (
    <div
      className="relative h-2.5 overflow-hidden rounded-full"
      style={{
        border: '1px solid rgba(255,255,255,0.18)',
        background: 'rgba(255,255,255,0.060)',
        boxShadow: `
          inset 0 1px 0 rgba(255,255,255,0.26),
          inset 0 -1px 0 rgba(15,23,42,0.12)
        `,
      }}
    >
      <div
        className="inventory-progress-fill h-full rounded-full"
        style={{
          width: `${percentage}%`,
          background:
            'linear-gradient(90deg, var(--admin-primary), color-mix(in srgb, var(--admin-primary) 58%, rgba(255,255,255,0.45)))',
          boxShadow:
            '0 0 14px color-mix(in srgb, var(--admin-primary) 34%, transparent)',
        }}
      />

      <span
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.22) 48%, transparent 100%)',
          opacity: 0.34,
        }}
      />
    </div>
  );
}

function PercentageBadge({ totalProducts, totalBranches }) {
  return (
    <div
      className="inventory-object-animated inventory-percentage-badge relative overflow-hidden rounded-[22px] px-4 py-3"
      style={{
        border:
          '1px solid color-mix(in srgb, var(--admin-primary) 26%, rgba(255,255,255,0.36))',
        background: `
          linear-gradient(
            145deg,
            color-mix(in srgb, var(--admin-primary) 12%, rgba(255,255,255,0.050)) 0%,
            rgba(255,255,255,0.012) 54%,
            color-mix(in srgb, var(--admin-primary) 8%, transparent) 100%
          )
        `,
        boxShadow: `
          inset 0 1px 0 rgba(255,255,255,0.40),
          inset 0 -1px 0 rgba(15,23,42,0.12),
          0 10px 20px rgba(12,6,35,0.060),
          0 0 18px color-mix(in srgb, var(--admin-primary) 18%, transparent)
        `,
        backdropFilter: 'blur(16px) saturate(175%)',
        WebkitBackdropFilter: 'blur(16px) saturate(175%)',
      }}
    >
      <span
        className="pointer-events-none absolute inset-x-5 top-0 h-px"
        style={{
          background:
            'linear-gradient(90deg, transparent, rgba(255,255,255,0.72), transparent)',
        }}
      />

      <span
        className="pointer-events-none absolute -right-8 -top-10 h-[110px] w-[24px] rotate-[34deg]"
        style={{
          background:
            'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), rgba(255,255,255,0.26), rgba(255,255,255,0.08), transparent)',
          opacity: 0.34,
          filter: 'blur(0.4px)',
        }}
      />

      <span
        className="pointer-events-none absolute right-4 top-4 h-[6px] w-[6px] rounded-full"
        style={{
          background: 'rgba(255,255,255,0.92)',
          boxShadow:
            '0 0 9px rgba(255,255,255,0.82), 0 0 15px color-mix(in srgb, var(--admin-primary) 30%, transparent)',
        }}
      />

      <div className="relative z-10">
        <p className="text-[12px] font-black leading-none" style={styles.muted}>
          Inventario total
        </p>

        <p
          className="mt-1 text-[38px] font-black leading-none tracking-[-0.06em]"
          style={{
            color: 'var(--admin-primary)',
            textShadow:
              '0 0 12px color-mix(in srgb, var(--admin-primary) 28%, transparent)',
          }}
        >
          {formatNumber(totalProducts)}
        </p>

        <p
          className="mt-1 text-[10.5px] font-black leading-[12px]"
          style={{
            ...styles.muted,
            whiteSpace: 'nowrap',
          }}
        >
          en {totalBranches} sedes
        </p>
      </div>
    </div>
  );
}

function PrimaryBranchCard({ item, totalProducts, totalBranches }) {
  const percentage = clampPercentage(item?.percentage);

  return (
    <article
      className="inventory-branch-card inventory-primary-card relative min-h-[220px] overflow-hidden rounded-[26px] p-5"
      style={{
        border:
          '1px solid color-mix(in srgb, var(--admin-primary) 24%, rgba(255,255,255,0.36))',
        background: `
          linear-gradient(
            145deg,
            color-mix(in srgb, var(--admin-primary) 7%, rgba(255,255,255,0.050)) 0%,
            rgba(255,255,255,0.010) 54%,
            color-mix(in srgb, var(--admin-primary) 6%, transparent) 100%
          )
        `,
        boxShadow: `
          inset 0 1px 0 rgba(255,255,255,0.42),
          inset 0 -1px 0 rgba(15,23,42,0.13),
          0 14px 28px rgba(12,6,35,0.075),
          0 0 20px color-mix(in srgb, var(--admin-primary) 14%, transparent)
        `,
        backdropFilter: 'blur(16px) saturate(175%)',
        WebkitBackdropFilter: 'blur(16px) saturate(175%)',
      }}
    >
      <span
        className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full"
        style={{
          background:
            'radial-gradient(circle, color-mix(in srgb, var(--admin-primary) 20%, transparent) 0%, transparent 64%)',
          opacity: 0.22,
          filter: 'blur(13px)',
        }}
      />

      <span
        className="pointer-events-none absolute inset-x-6 top-0 h-px"
        style={{
          background:
            'linear-gradient(90deg, transparent, rgba(255,255,255,0.76), transparent)',
        }}
      />

      <span
        className="inventory-card-accent pointer-events-none absolute left-0 top-6 h-[calc(100%-48px)] w-px"
        style={{
          background:
            'linear-gradient(180deg, transparent, color-mix(in srgb, var(--admin-primary) 72%, rgba(255,255,255,0.50)), transparent)',
          boxShadow:
            '0 0 12px color-mix(in srgb, var(--admin-primary) 34%, transparent)',
        }}
      />

      <div className="inventory-object-animated relative z-10 flex min-w-0 items-center gap-3">
        <GlassIcon size="lg">
          <Store size={20} strokeWidth={2.5} />
        </GlassIcon>

        <div className="min-w-0">
          <h3
            className="text-[16px] font-black leading-[19px]"
            style={{
              ...styles.title,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
            title={item?.branch}
          >
            {item?.branch}
          </h3>

          <p className="mt-1 text-[11.5px] font-bold leading-none" style={styles.muted}>
            Sede principal
          </p>
        </div>
      </div>

      <div className="inventory-object-animated relative z-10 mt-6">
        <p
          className="text-[39px] font-black leading-none tracking-[-0.06em]"
          style={{
            ...styles.title,
            textShadow:
              '0 1px 0 rgba(255,255,255,0.22), 0 0 18px color-mix(in srgb, var(--admin-primary) 12%, transparent)',
          }}
        >
          {formatNumber(item?.products)}
        </p>

        <p
          className="mt-1 text-[10.5px] font-black uppercase leading-[13px] tracking-[0.12em]"
          style={styles.muted}
        >
          Productos registrados
        </p>
      </div>

      <div className="inventory-object-animated relative z-10 mt-5">
        <div className="mb-2 flex items-center justify-between gap-2 text-[11.5px] font-black">
          <span className="leading-[14px]" style={styles.muted}>
            Avance de inventario
          </span>

          <span
            className="shrink-0"
            style={{
              color: 'var(--admin-primary)',
              textShadow:
                '0 0 8px color-mix(in srgb, var(--admin-primary) 20%, transparent)',
            }}
          >
            {percentage}%
          </span>
        </div>

        <ProgressBar percentage={percentage} />
      </div>

      <div className="relative z-10 mt-4">
        <PercentageBadge totalProducts={totalProducts} totalBranches={totalBranches} />
      </div>
    </article>
  );
}

function SecondaryBranchCard({ item, index }) {
  const percentage = clampPercentage(item?.percentage);

  return (
    <article
      className="inventory-branch-card relative min-h-[104px] overflow-hidden rounded-[22px] px-4 py-3"
      style={{
        border:
          '1px solid color-mix(in srgb, var(--admin-primary) 16%, rgba(255,255,255,0.30))',
        background: `
          linear-gradient(
            145deg,
            rgba(255,255,255,0.036) 0%,
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
        animationDelay: `${160 + index * 80}ms`,
      }}
    >
      <span
        className="pointer-events-none absolute inset-x-5 top-0 h-px"
        style={{
          background:
            'linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)',
        }}
      />

      <span
        className="pointer-events-none absolute -right-8 -top-10 h-[110px] w-[26px] rotate-[34deg]"
        style={{
          background:
            'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), rgba(255,255,255,0.22), rgba(255,255,255,0.07), transparent)',
          opacity: 0.32,
          filter: 'blur(0.45px)',
        }}
      />

      <div className="inventory-object-animated relative z-10 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <GlassIcon>
            <Store size={16} strokeWidth={2.5} />
          </GlassIcon>

          <div className="min-w-0">
            <h3
              className="truncate text-[13px] font-black leading-[16px]"
              style={styles.title}
              title={item?.branch}
            >
              {item?.branch}
            </h3>

            <p className="mt-0.5 text-[10.5px] font-bold leading-none" style={styles.muted}>
              Productos
            </p>
          </div>
        </div>

        <p
          className="shrink-0 text-[25px] font-black leading-none tracking-[-0.05em]"
          style={styles.title}
        >
          {formatNumber(item?.products)}
        </p>
      </div>

      <div className="inventory-object-animated relative z-10 mt-4">
        <div className="mb-1.5 flex items-center justify-between text-[10.5px] font-black">
          <span style={styles.muted}>Participación</span>
          <span
            style={{
              color: 'var(--admin-primary)',
              textShadow:
                '0 0 7px color-mix(in srgb, var(--admin-primary) 18%, transparent)',
            }}
          >
            {percentage}%
          </span>
        </div>

        <ProgressBar percentage={percentage} />
      </div>
    </article>
  );
}

export default function DashboardInventoryByBranch({ items = [] }) {
  const safeItems = items.slice(0, 4);
  const primaryItem = safeItems[0];
  const secondaryItems = safeItems.slice(1);

  const totalProducts = safeItems.reduce((total, item) => {
    const productValue = Number(String(item?.products ?? 0).replace(/[^\d.-]/g, ''));
    return total + (Number.isNaN(productValue) ? 0 : productValue);
  }, 0);
  const totalBranches = safeItems.length;

  return (
    <section
      className="inventory-panel-pro relative overflow-hidden rounded-[28px] p-[1px]"
      style={{
        border:
          '1px solid color-mix(in srgb, var(--admin-primary) 20%, rgba(255,255,255,0.46))',
        background: `
          linear-gradient(
            145deg,
            rgba(255,255,255,0.055) 0%,
            rgba(255,255,255,0.012) 48%,
            color-mix(in srgb, var(--admin-primary) 5%, transparent) 100%
          )
        `,
        boxShadow: `
          inset 0 1px 0 rgba(255,255,255,0.52),
          inset 0 -1px 0 rgba(15,23,42,0.12),
          0 16px 32px rgba(12,6,35,0.065),
          0 0 20px color-mix(in srgb, var(--admin-primary) 10%, transparent)
        `,
        backdropFilter: 'blur(18px) saturate(180%)',
        WebkitBackdropFilter: 'blur(18px) saturate(180%)',
      }}
    >
      <style>
        {`
          @keyframes inventoryPanelEnter {
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

          @keyframes inventoryCardEnter {
            from {
              opacity: 0;
              transform: translateY(10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes inventoryObjectEnter {
            from {
              opacity: 0;
              transform: translateY(8px) scale(0.985);
              filter: blur(4px);
            }
            to {
              opacity: 1;
              transform: translateY(0) scale(1);
              filter: blur(0);
            }
          }

          @keyframes inventoryShineMove {
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

          @keyframes inventoryEdgePulse {
            0%, 100% {
              opacity: 0.48;
            }
            50% {
              opacity: 0.9;
            }
          }

          .inventory-panel-pro {
            animation: inventoryPanelEnter 520ms ease-out both;
          }

          .inventory-branch-card {
            animation: inventoryCardEnter 460ms ease-out both;
            transition:
              transform 180ms ease,
              filter 180ms ease,
              border-color 180ms ease,
              box-shadow 180ms ease;
          }

          .inventory-branch-card:hover {
            transform: translateY(-3px);
            filter: brightness(1.03) saturate(1.06);
            border-color: color-mix(in srgb, var(--admin-primary) 36%, rgba(255,255,255,0.46)) !important;
            box-shadow:
              inset 0 1px 0 rgba(255,255,255,0.44),
              inset 0 -1px 0 rgba(15,23,42,0.13),
              0 14px 26px rgba(12,6,35,0.080),
              0 0 20px color-mix(in srgb, var(--admin-primary) 16%, transparent) !important;
          }

          .inventory-object-animated {
            animation: inventoryObjectEnter 540ms cubic-bezier(.22,.9,.24,1) both;
          }

          .inventory-primary-card .inventory-object-animated:nth-of-type(1) {
            animation-delay: 90ms;
          }

          .inventory-primary-card .inventory-object-animated:nth-of-type(2) {
            animation-delay: 170ms;
          }

          .inventory-primary-card .inventory-object-animated:nth-of-type(3) {
            animation-delay: 250ms;
          }

          .inventory-primary-card .inventory-object-animated:nth-of-type(4) {
            animation-delay: 330ms;
          }

          .inventory-percentage-badge {
            transition:
              transform 180ms ease,
              filter 180ms ease,
              border-color 180ms ease,
              box-shadow 180ms ease;
          }

          .inventory-branch-card:hover .inventory-percentage-badge {
            transform: translateY(-2px) scale(1.02);
            filter: brightness(1.05) saturate(1.08);
            border-color: color-mix(in srgb, var(--admin-primary) 38%, rgba(255,255,255,0.48)) !important;
            box-shadow:
              inset 0 1px 0 rgba(255,255,255,0.46),
              inset 0 -1px 0 rgba(15,23,42,0.12),
              0 12px 24px rgba(12,6,35,0.080),
              0 0 22px color-mix(in srgb, var(--admin-primary) 20%, transparent) !important;
          }

          .inventory-pro-button {
            transition:
              transform 180ms ease,
              filter 180ms ease,
              border-color 180ms ease,
              box-shadow 180ms ease;
          }

          .inventory-pro-button:hover {
            transform: translateY(-1px);
            filter: brightness(1.025) saturate(1.05);
            border-color: color-mix(in srgb, var(--admin-primary) 32%, rgba(255,255,255,0.46)) !important;
            box-shadow:
              inset 0 1px 0 rgba(255,255,255,0.48),
              inset 0 -1px 0 rgba(15,23,42,0.12),
              0 10px 20px rgba(12,6,35,0.075),
              0 0 16px color-mix(in srgb, var(--admin-primary) 15%, transparent) !important;
          }

          .inventory-button-shine {
            animation: inventoryShineMove 3.3s ease-in-out infinite;
          }

          .inventory-icon-shine,
          .inventory-panel-edge {
            animation: inventoryEdgePulse 3.8s ease-in-out infinite;
          }

          .inventory-progress-fill {
            transition: width 900ms cubic-bezier(.22,.9,.24,1);
          }

          @media (prefers-reduced-motion: reduce) {
            .inventory-panel-pro,
            .inventory-branch-card,
            .inventory-object-animated,
            .inventory-button-shine,
            .inventory-icon-shine,
            .inventory-panel-edge {
              animation: none !important;
              transition: none !important;
            }
          }
        `}
      </style>

      <div
        className="relative overflow-hidden rounded-[27px] px-5 py-4"
        style={{
          background: `
            linear-gradient(
              145deg,
              rgba(255,255,255,0.044) 0%,
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
          className="inventory-panel-edge pointer-events-none absolute left-0 top-12 h-[calc(100%-96px)] w-px"
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

        <div className="relative z-10 mb-4 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <GlassIcon>
              <Building2 size={18} strokeWidth={2.5} />
            </GlassIcon>

            <div className="min-w-0">
              <h2 className="text-[18px] font-black leading-[20px]" style={styles.title}>
                Resumen de inventario por sede
              </h2>

              <p
                className="mt-1 text-[13px] font-semibold leading-[18px]"
                style={{
                  ...styles.muted,
                  display: '-webkit-box',
                  WebkitLineClamp: 1,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                Distribución general de productos entre sedes.
              </p>
            </div>
          </div>

          <GlassButton>Ver detalle</GlassButton>
        </div>

        {primaryItem ? (
          <div className="relative z-10 grid gap-3 xl:grid-cols-[minmax(185px,0.92fr)_minmax(270px,1.08fr)]">
            <PrimaryBranchCard item={primaryItem} totalProducts={totalProducts} totalBranches={totalBranches} />

            <div className="grid gap-3">
              {secondaryItems.map((item, index) => (
                <SecondaryBranchCard key={item.id} item={item} index={index} />
              ))}
            </div>
          </div>
        ) : (
          <div
            className="relative z-10 rounded-[22px] px-4 py-8 text-center text-sm font-bold"
            style={styles.muted}
          >
            No hay sedes para mostrar.
          </div>
        )}
      </div>
    </section>
  );
}