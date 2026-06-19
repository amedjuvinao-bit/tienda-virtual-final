// frontend/src/admin/dashboard/components/DashboardSalesPanel.jsx

import { ChevronDown, LineChart, Sparkles } from 'lucide-react';
import { dashboardStyles as styles } from '../dashboardStyles';

function getChartPoints(data = []) {
  const chart = {
    left: 58,
    right: 596,
    top: 30,
    bottom: 148,
    maxValue: 50000,
  };

  return data.map((item, index) => {
    const rawValue = Number(item.value || 0);
    const safeValue = Math.min(rawValue, chart.maxValue);

    const x =
      chart.left +
      (index / Math.max(data.length - 1, 1)) * (chart.right - chart.left);

    const y =
      chart.bottom -
      (safeValue / chart.maxValue) * (chart.bottom - chart.top);

    return { ...item, x, y, rawValue };
  });
}

function getSmoothPath(points = []) {
  if (!points.length) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let i = 0; i < points.length - 1; i += 1) {
    const current = points[i];
    const next = points[i + 1];
    const previous = points[i - 1] || current;
    const following = points[i + 2] || next;

    const controlX1 = current.x + (next.x - previous.x) / 6;
    const controlY1 = current.y + (next.y - previous.y) / 6;
    const controlX2 = next.x - (following.x - current.x) / 6;
    const controlY2 = next.y - (following.y - current.y) / 6;

    path += ` C ${controlX1} ${controlY1}, ${controlX2} ${controlY2}, ${next.x} ${next.y}`;
  }

  return path;
}

function getAreaPath(points = []) {
  if (!points.length) return '';

  const baseline = 148;
  const line = getSmoothPath(points);

  return `${line} L ${points[points.length - 1].x} ${baseline} L ${points[0].x} ${baseline} Z`;
}

function getSparklinePath(values = []) {
  if (!values.length) return '';

  const width = 76;
  const height = 18;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;

  return values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
}

function formatMoney(value) {
  const number = Number(value || 0);

  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(number);
}

function DiamondGlints({ small = false }) {
  const size = small ? 4 : 5;

  return (
    <>
      <span
        className="pointer-events-none absolute right-[7px] top-[6px] rounded-full dashboard-diamond-dot"
        style={{
          width: size,
          height: size,
          background: 'rgba(255,255,255,0.82)',
          boxShadow: `
            0 0 4px rgba(255,255,255,0.70),
            0 0 7px color-mix(in srgb, var(--admin-primary) 20%, transparent)
          `,
        }}
      />

      <span
        className="pointer-events-none absolute right-[1px] top-[8px] h-px w-[16px]"
        style={{
          background:
            'linear-gradient(90deg, transparent, rgba(255,255,255,0.68), transparent)',
          opacity: 0.72,
        }}
      />

      <span
        className="pointer-events-none absolute right-[8px] top-[1px] h-[16px] w-px"
        style={{
          background:
            'linear-gradient(180deg, transparent, rgba(255,255,255,0.58), transparent)',
          opacity: 0.58,
        }}
      />

      <span
        className="pointer-events-none absolute inset-x-[7px] top-[3px] h-px"
        style={{
          background:
            'linear-gradient(90deg, transparent, rgba(255,255,255,0.44), color-mix(in srgb, var(--admin-primary) 14%, rgba(255,255,255,0.36)), transparent)',
          opacity: 0.78,
        }}
      />

      <span
        className="pointer-events-none absolute -right-3 -top-5 h-[46px] w-[4px] rotate-[34deg]"
        style={{
          background:
            'linear-gradient(90deg, transparent, rgba(255,255,255,0.30), transparent)',
          opacity: 0.42,
        }}
      />
    </>
  );
}

export default function DashboardSalesPanel({ chartData = [], topProducts = [] }) {
  const points = getChartPoints(chartData);
  const linePath = getSmoothPath(points);
  const areaPath = getAreaPath(points);
  const highlightPoint = points[3] || points[points.length - 1];

  const tooltipBox = highlightPoint
    ? {
        x: highlightPoint.x - 34,
        y: Math.max(8, highlightPoint.y - 66),
        width: 68,
        height: 40,
        tipY: highlightPoint.y - 7,
      }
    : null;

  const yLabels = [
    { label: '50K', y: 30 },
    { label: '40K', y: 54 },
    { label: '30K', y: 78 },
    { label: '20K', y: 102 },
    { label: '10K', y: 126 },
    { label: '0', y: 150 },
  ];

  const diamondChipStyle = {
    border:
      '1px solid color-mix(in srgb, var(--admin-primary) 18%, rgba(255,255,255,0.32))',
    background: `
      linear-gradient(
        145deg,
        rgba(255,255,255,0.030) 0%,
        rgba(255,255,255,0.010) 52%,
        color-mix(in srgb, var(--admin-primary) 3%, transparent) 100%
      )
    `,
    color: 'var(--admin-primary)',
    boxShadow: `
      inset 0 1px 0 rgba(255,255,255,0.34),
      inset 0 -1px 0 rgba(15,23,42,0.10),
      inset 0 0 0 1px rgba(255,255,255,0.035),
      0 0 0 1px color-mix(in srgb, var(--admin-primary) 5%, transparent),
      0 6px 14px rgba(12,6,35,0.045),
      0 0 9px color-mix(in srgb, var(--admin-primary) 12%, transparent)
    `,
    backdropFilter: 'blur(14px) saturate(175%)',
    WebkitBackdropFilter: 'blur(14px) saturate(175%)',
  };

  const diamondButtonStyle = {
    ...styles.actionButton,
    border:
      '1px solid color-mix(in srgb, var(--admin-primary) 16%, rgba(255,255,255,0.32))',
    background: `
      linear-gradient(
        145deg,
        rgba(255,255,255,0.026) 0%,
        rgba(255,255,255,0.010) 54%,
        color-mix(in srgb, var(--admin-primary) 3%, transparent) 100%
      )
    `,
    boxShadow: `
      inset 0 1px 0 rgba(255,255,255,0.30),
      inset 0 -1px 0 rgba(15,23,42,0.10),
      inset 0 0 0 1px rgba(255,255,255,0.026),
      0 6px 14px rgba(12,6,35,0.040),
      0 0 8px color-mix(in srgb, var(--admin-primary) 10%, transparent)
    `,
    color: 'var(--admin-card-text)',
    textShadow: 'none',
    backdropFilter: 'blur(14px) saturate(165%)',
    WebkitBackdropFilter: 'blur(14px) saturate(165%)',
  };

  const glassMainButtonStyle = {
    border:
      '1px solid color-mix(in srgb, var(--admin-primary) 22%, rgba(255,255,255,0.36))',
    background: `
      linear-gradient(
        145deg,
        rgba(255,255,255,0.035) 0%,
        rgba(255,255,255,0.010) 48%,
        color-mix(in srgb, var(--admin-primary) 5%, transparent) 100%
      )
    `,
    color: 'var(--admin-card-text)',
    boxShadow: `
      inset 0 1px 0 rgba(255,255,255,0.34),
      inset 0 -1px 0 rgba(15,23,42,0.13),
      0 8px 18px rgba(12,6,35,0.060),
      0 0 10px color-mix(in srgb, var(--admin-primary) 12%, transparent)
    `,
    backdropFilter: 'blur(14px) saturate(170%)',
    WebkitBackdropFilter: 'blur(14px) saturate(170%)',
  };

  return (
    <section
      className="dashboard-sales-enter relative self-start overflow-hidden rounded-[28px] p-[1px]"
      style={{
        border: '1px solid rgba(255,255,255,0.44)',
        background: `
          linear-gradient(
            145deg,
            rgba(255,255,255,0.14) 0%,
            rgba(255,255,255,0.045) 46%,
            color-mix(in srgb, var(--admin-primary) 3%, rgba(255,255,255,0.030)) 100%
          )
        `,
        boxShadow: `
          inset 0 1px 0 rgba(255,255,255,0.60),
          inset 0 -1px 0 rgba(15,23,42,0.045),
          0 14px 30px rgba(12,6,35,0.045),
          0 0 16px color-mix(in srgb, var(--admin-primary) 4%, transparent)
        `,
        backdropFilter: 'blur(14px) saturate(165%)',
        WebkitBackdropFilter: 'blur(14px) saturate(165%)',
      }}
    >
      <style>
        {`
          @keyframes dashboardSalesEnter {
            0% {
              opacity: 0;
              transform: translateY(16px) scale(0.985);
              filter: blur(6px);
            }
            100% {
              opacity: 1;
              transform: translateY(0) scale(1);
              filter: blur(0);
            }
          }

          @keyframes dashboardLineDraw {
            0% {
              stroke-dashoffset: 1;
              opacity: 0.2;
            }
            100% {
              stroke-dashoffset: 0;
              opacity: 1;
            }
          }

          @keyframes dashboardAreaRise {
            0% {
              opacity: 0;
              transform: translateY(14px);
            }
            100% {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes dashboardPointEnter {
            0% {
              opacity: 0;
              transform: scale(0.45);
            }
            70% {
              opacity: 1;
              transform: scale(1.18);
            }
            100% {
              opacity: 1;
              transform: scale(1);
            }
          }

          @keyframes dashboardGlassPulse {
            0%, 100% {
              box-shadow:
                inset 0 1px 0 rgba(255,255,255,0.34),
                inset 0 -1px 0 rgba(15,23,42,0.13),
                0 8px 18px rgba(12,6,35,0.060),
                0 0 10px color-mix(in srgb, var(--admin-primary) 12%, transparent);
            }
            50% {
              box-shadow:
                inset 0 1px 0 rgba(255,255,255,0.42),
                inset 0 -1px 0 rgba(15,23,42,0.13),
                0 9px 20px rgba(12,6,35,0.070),
                0 0 16px color-mix(in srgb, var(--admin-primary) 18%, transparent);
            }
          }

          @keyframes dashboardShineSweep {
            0% {
              transform: translateX(-130%) rotate(28deg);
              opacity: 0;
            }
            35% {
              opacity: 0.55;
            }
            100% {
              transform: translateX(170%) rotate(28deg);
              opacity: 0;
            }
          }

          .dashboard-sales-enter {
            animation: dashboardSalesEnter 520ms ease-out both;
          }

          .dashboard-sales-area-animated {
            transform-box: fill-box;
            transform-origin: center bottom;
            animation: dashboardAreaRise 760ms ease-out both;
          }

          .dashboard-sales-line-animated {
            stroke-dasharray: 1;
            stroke-dashoffset: 1;
            animation: dashboardLineDraw 1250ms cubic-bezier(.22,.9,.24,1) 140ms both;
          }

          .dashboard-sales-point {
            transform-box: fill-box;
            transform-origin: center;
            cursor: pointer;
            animation: dashboardPointEnter 460ms ease-out both;
          }

          .dashboard-sales-point .point-core,
          .dashboard-sales-point .point-halo,
          .dashboard-sales-point .point-cross {
            transition:
              transform 180ms ease,
              opacity 180ms ease,
              filter 180ms ease;
            transform-box: fill-box;
            transform-origin: center;
          }

          .dashboard-sales-point:hover .point-core,
          .dashboard-sales-point:focus-visible .point-core {
            transform: scale(1.65);
            opacity: 1;
            filter:
              drop-shadow(0 0 6px rgba(255,255,255,0.86))
              drop-shadow(0 0 12px color-mix(in srgb, var(--admin-primary) 34%, transparent));
          }

          .dashboard-sales-point:hover .point-halo,
          .dashboard-sales-point:focus-visible .point-halo {
            transform: scale(1.55);
            opacity: 0.7;
          }

          .dashboard-sales-point:hover .point-cross,
          .dashboard-sales-point:focus-visible .point-cross {
            transform: scale(1.22);
            opacity: 0.95;
          }

          .dashboard-glass-main-button {
            animation: dashboardGlassPulse 3.8s ease-in-out infinite;
          }

          .dashboard-glass-main-button:hover {
            transform: translateY(-1px);
            border-color: color-mix(in srgb, var(--admin-primary) 30%, rgba(255,255,255,0.42)) !important;
            box-shadow:
              inset 0 1px 0 rgba(255,255,255,0.42),
              inset 0 -1px 0 rgba(15,23,42,0.13),
              0 10px 22px rgba(12,6,35,0.080),
              0 0 18px color-mix(in srgb, var(--admin-primary) 18%, transparent) !important;
          }

          .dashboard-glass-main-button .button-shine {
            animation: dashboardShineSweep 3.2s ease-in-out infinite;
          }

          .dashboard-diamond-dot {
            animation: dashboardGlassPulse 3.6s ease-in-out infinite;
          }

          @media (prefers-reduced-motion: reduce) {
            .dashboard-sales-enter,
            .dashboard-sales-area-animated,
            .dashboard-sales-line-animated,
            .dashboard-sales-point,
            .dashboard-glass-main-button,
            .dashboard-glass-main-button .button-shine,
            .dashboard-diamond-dot {
              animation: none !important;
            }
          }
        `}
      </style>

      <div
        className="relative overflow-hidden rounded-[27px] px-5 pb-2 pt-4"
        style={{
          background: `
            linear-gradient(
              145deg,
              rgba(255,255,255,0.075) 0%,
              rgba(255,255,255,0.022) 50%,
              color-mix(in srgb, var(--admin-primary) 2%, transparent) 100%
            )
          `,
          boxShadow: `
            inset 0 1px 0 rgba(255,255,255,0.42),
            inset 0 -1px 0 rgba(15,23,42,0.035),
            inset 0 0 18px rgba(255,255,255,0.018)
          `,
          backdropFilter: 'blur(12px) saturate(160%)',
          WebkitBackdropFilter: 'blur(12px) saturate(160%)',
        }}
      >
        <span
          className="pointer-events-none absolute inset-x-8 top-0 h-px"
          style={{
            background:
              'linear-gradient(90deg, transparent, rgba(255,255,255,0.82), transparent)',
          }}
        />

        <div className="relative z-10 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2.5">
            <span
              className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-[12px]"
              style={diamondChipStyle}
            >
              <DiamondGlints small />
              <LineChart
                size={17}
                strokeWidth={2.35}
                style={{
                  filter:
                    'drop-shadow(0 0 6px color-mix(in srgb, var(--admin-primary) 34%, transparent))',
                }}
              />
            </span>

            <h2 className="text-[17px] font-black leading-none" style={styles.title}>
              Ventas semanales
            </h2>
          </div>

          <div className="flex flex-wrap gap-2">
            {['Esta semana', 'Comparar'].map((label) => (
              <button
                key={label}
                type="button"
                className="relative inline-flex items-center gap-2 overflow-hidden rounded-[12px] px-3.5 py-1.5 text-[11px] font-black transition duration-200 hover:-translate-y-0.5"
                style={diamondButtonStyle}
              >
                <DiamondGlints small />
                <span className="relative z-10">{label}</span>
                <ChevronDown size={13} className="relative z-10" />
              </button>
            ))}
          </div>
        </div>

        <div className="relative z-10 mt-1 overflow-hidden rounded-[20px]">
          <svg
            viewBox="0 0 620 200"
            className="h-[200px] w-full"
            preserveAspectRatio="none"
            role="img"
            aria-label="Gráfico de ventas semanales"
          >
            <defs>
              <linearGradient id="sales-area-clean" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--admin-primary)" stopOpacity="0.18" />
                <stop offset="45%" stopColor="var(--admin-primary)" stopOpacity="0.09" />
                <stop offset="100%" stopColor="var(--admin-primary)" stopOpacity="0.010" />
              </linearGradient>

              <linearGradient id="sales-line-clean" x1="0" x2="1" y1="0" y2="0">
                <stop
                  offset="0%"
                  stopColor="color-mix(in srgb, var(--admin-primary) 72%, rgba(255,255,255,0.35))"
                />
                <stop offset="50%" stopColor="var(--admin-primary)" />
                <stop
                  offset="100%"
                  stopColor="color-mix(in srgb, var(--admin-primary) 78%, rgba(255,255,255,0.34))"
                />
              </linearGradient>

              <filter id="sales-line-glow-clean" x="-20%" y="-50%" width="140%" height="220%">
                <feGaussianBlur stdDeviation="0.85" result="blur1" />
                <feMerge>
                  <feMergeNode in="blur1" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              <filter id="sales-point-glow-clean" x="-500%" y="-500%" width="1000%" height="1000%">
                <feGaussianBlur stdDeviation="1.8" result="pointBlur" />
                <feMerge>
                  <feMergeNode in="pointBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              <filter id="sales-tooltip-shadow" x="-120%" y="-120%" width="300%" height="300%">
                <feDropShadow dx="0" dy="7" stdDeviation="4" floodColor="#0f172a" floodOpacity="0.14" />
                <feDropShadow dx="0" dy="0" stdDeviation="2.2" floodColor="var(--admin-primary)" floodOpacity="0.16" />
              </filter>

              <linearGradient id="sales-tooltip-glass" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="rgba(255,255,255,0.050)" />
                <stop
                  offset="52%"
                  stopColor="color-mix(in srgb, var(--admin-primary) 4%, rgba(255,255,255,0.018))"
                />
                <stop offset="100%" stopColor="rgba(255,255,255,0.008)" />
              </linearGradient>

              <linearGradient id="sales-star-horizontal-clean" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stopColor="rgba(255,255,255,0)" />
                <stop offset="50%" stopColor="rgba(255,255,255,0.88)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0)" />
              </linearGradient>

              <linearGradient id="sales-star-vertical-clean" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="rgba(255,255,255,0)" />
                <stop offset="50%" stopColor="rgba(255,255,255,0.78)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0)" />
              </linearGradient>
            </defs>

            {yLabels.map((item) => (
              <g key={item.label}>
                <text
                  x="18"
                  y={item.y + 4}
                  fontSize="11"
                  fontWeight="800"
                  fill="var(--admin-card-muted-text)"
                  opacity="0.72"
                >
                  {item.label}
                </text>

                {item.label !== '0' ? (
                  <line
                    x1="58"
                    x2="596"
                    y1={item.y}
                    y2={item.y}
                    stroke="color-mix(in srgb, var(--admin-primary) 10%, transparent)"
                    strokeOpacity="0.14"
                    strokeDasharray="6 12"
                  />
                ) : (
                  <line
                    x1="58"
                    x2="596"
                    y1={item.y}
                    y2={item.y}
                    stroke="rgba(15,23,42,0.08)"
                    strokeOpacity="0.14"
                  />
                )}
              </g>
            ))}

            {highlightPoint ? (
              <rect
                x={highlightPoint.x - 40}
                y="30"
                width="80"
                height="118"
                rx="0"
                fill="var(--admin-primary)"
                opacity="0.030"
              />
            ) : null}

            <path className="dashboard-sales-area-animated" d={areaPath} fill="url(#sales-area-clean)" />

            <path
              className="dashboard-sales-line-animated"
              d={linePath}
              pathLength="1"
              fill="none"
              stroke="var(--admin-primary)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.04"
              filter="url(#sales-line-glow-clean)"
            />

            <path
              className="dashboard-sales-line-animated"
              d={linePath}
              pathLength="1"
              fill="none"
              stroke="url(#sales-line-clean)"
              strokeWidth="1.65"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#sales-line-glow-clean)"
            />

            <path
              className="dashboard-sales-line-animated"
              d={linePath}
              pathLength="1"
              fill="none"
              stroke="rgba(255,255,255,0.42)"
              strokeWidth="0.55"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.34"
            />

            {tooltipBox ? (
              <g filter="url(#sales-tooltip-shadow)">
                <path
                  d={`
                    M ${tooltipBox.x + 12} ${tooltipBox.y}
                    H ${tooltipBox.x + tooltipBox.width - 12}
                    Q ${tooltipBox.x + tooltipBox.width} ${tooltipBox.y} ${tooltipBox.x + tooltipBox.width} ${tooltipBox.y + 12}
                    V ${tooltipBox.y + tooltipBox.height - 12}
                    Q ${tooltipBox.x + tooltipBox.width} ${tooltipBox.y + tooltipBox.height} ${tooltipBox.x + tooltipBox.width - 12} ${tooltipBox.y + tooltipBox.height}
                    H ${highlightPoint.x + 8}
                    L ${highlightPoint.x} ${tooltipBox.tipY}
                    L ${highlightPoint.x - 8} ${tooltipBox.y + tooltipBox.height}
                    H ${tooltipBox.x + 12}
                    Q ${tooltipBox.x} ${tooltipBox.y + tooltipBox.height} ${tooltipBox.x} ${tooltipBox.y + tooltipBox.height - 12}
                    V ${tooltipBox.y + 12}
                    Q ${tooltipBox.x} ${tooltipBox.y} ${tooltipBox.x + 12} ${tooltipBox.y}
                    Z
                  `}
                  fill="url(#sales-tooltip-glass)"
                  stroke="color-mix(in srgb, var(--admin-primary) 18%, rgba(255,255,255,0.36))"
                  strokeWidth="1"
                  opacity="0.98"
                />

                <text
                  x={highlightPoint.x}
                  y={tooltipBox.y + 16}
                  textAnchor="middle"
                  fontSize="9.5"
                  fontWeight="900"
                  fill="var(--admin-card-muted-text)"
                  opacity="0.98"
                >
                  {highlightPoint.label}
                </text>

                <text
                  x={highlightPoint.x}
                  y={tooltipBox.y + 32}
                  textAnchor="middle"
                  fontSize="11.5"
                  fontWeight="950"
                  fill="var(--admin-card-text)"
                >
                  ${formatMoney(highlightPoint.rawValue || 41230)}
                </text>
              </g>
            ) : null}

            {points.map((point, index) => (
              <g
                key={point.label}
                className="dashboard-sales-point"
                tabIndex={0}
                style={{
                  animationDelay: `${260 + index * 70}ms`,
                }}
              >
                <circle className="point-halo" cx={point.x} cy={point.y} r="6.2" fill="rgba(255,255,255,0.36)" opacity="0.38" filter="url(#sales-point-glow-clean)" />
                <circle className="point-halo" cx={point.x} cy={point.y} r="4.5" fill="color-mix(in srgb, var(--admin-primary) 18%, rgba(255,255,255,0.86))" opacity="0.34" filter="url(#sales-point-glow-clean)" />
                <line className="point-cross" x1={point.x - 10} x2={point.x + 10} y1={point.y} y2={point.y} stroke="url(#sales-star-horizontal-clean)" strokeWidth="1.05" opacity="0.72" strokeLinecap="round" />
                <line className="point-cross" x1={point.x} x2={point.x} y1={point.y - 10} y2={point.y + 10} stroke="url(#sales-star-vertical-clean)" strokeWidth="0.9" opacity="0.52" strokeLinecap="round" />
                <circle className="point-core" cx={point.x} cy={point.y} r="2.9" fill="rgba(255,255,255,0.98)" filter="url(#sales-point-glow-clean)" />
                <circle className="point-core" cx={point.x - 0.8} cy={point.y - 0.8} r="0.9" fill="rgba(255,255,255,1)" />
                <circle cx={point.x} cy={point.y} r="15" fill="transparent" pointerEvents="all" />

                <text
                  x={point.x}
                  y="182"
                  textAnchor="middle"
                  fontSize="12"
                  fontWeight="900"
                  fill="var(--admin-card-muted-text)"
                  opacity="0.84"
                  pointerEvents="none"
                >
                  {point.label}
                </text>
              </g>
            ))}
          </svg>
        </div>

        <div className="relative z-10 -mt-2">
          <div className="mb-1.5 flex items-center gap-2">
            <span
              className="relative flex h-7 w-7 items-center justify-center overflow-hidden rounded-[11px]"
              style={diamondChipStyle}
            >
              <DiamondGlints small />
              <Sparkles size={14} />
            </span>

            <h3 className="text-[15px] font-black leading-none" style={styles.title}>
              Top productos
            </h3>
          </div>

          <div
            className="overflow-hidden rounded-[17px]"
            style={{
              border:
                '1px solid color-mix(in srgb, var(--admin-primary) 14%, rgba(255,255,255,0.22))',
              background: `
                linear-gradient(
                  145deg,
                  rgba(255,255,255,0.028) 0%,
                  rgba(255,255,255,0.010) 52%,
                  color-mix(in srgb, var(--admin-primary) 2%, transparent) 100%
                )
              `,
              boxShadow: `
                inset 0 1px 0 rgba(255,255,255,0.24),
                inset 0 -1px 0 rgba(15,23,42,0.10),
                0 6px 14px rgba(12,6,35,0.035),
                0 0 8px color-mix(in srgb, var(--admin-primary) 8%, transparent)
              `,
              backdropFilter: 'blur(12px) saturate(155%)',
              WebkitBackdropFilter: 'blur(12px) saturate(155%)',
            }}
          >
            <div
              className="grid grid-cols-[minmax(0,1fr)_70px_112px_92px] gap-2 px-3.5 py-1.5 text-[11px] font-black"
              style={{
                color: 'var(--admin-card-muted-text)',
                borderBottom:
                  '1px solid color-mix(in srgb, var(--admin-primary) 10%, rgba(255,255,255,0.10))',
                background: 'rgba(255,255,255,0.018)',
              }}
            >
              <span>Producto</span>
              <span>Ventas</span>
              <span>Ingresos</span>
              <span
                style={{
                  color:
                    'color-mix(in srgb, var(--admin-primary) 42%, var(--admin-card-text))',
                  textShadow:
                    '0 0 6px color-mix(in srgb, var(--admin-primary) 14%, transparent)',
                }}
              >
                Tendencia
              </span>
            </div>

            <div>
              {topProducts.slice(0, 3).map((product) => (
                <article
                  key={product.id}
                  className="grid grid-cols-[minmax(0,1fr)_70px_112px_92px] items-center gap-2 px-3.5 py-1"
                  style={{
                    borderBottom:
                      '1px solid color-mix(in srgb, var(--admin-primary) 7%, rgba(255,255,255,0.05))',
                    background: 'transparent',
                  }}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <img
                      src={product.image}
                      alt={product.name}
                      className="h-7 w-7 shrink-0 rounded-lg object-cover"
                    />

                    <p
                      className="truncate text-[12px] font-bold leading-none"
                      style={styles.title}
                    >
                      {product.name}
                    </p>
                  </div>

                  <p className="text-[12px] font-bold leading-none" style={styles.title}>
                    {product.sales}
                  </p>

                  <p className="text-[12px] font-bold leading-none" style={styles.title}>
                    {product.income}
                  </p>

                  <svg viewBox="0 0 76 18" className="h-4.5 w-full">
                    <defs>
                      <linearGradient id={`trend-line-${product.id}`} x1="0" x2="1" y1="0" y2="0">
                        <stop
                          offset="0%"
                          stopColor="color-mix(in srgb, var(--admin-primary) 72%, rgba(255,255,255,0.18))"
                        />
                        <stop offset="100%" stopColor="var(--admin-primary)" />
                      </linearGradient>

                      <filter id={`trend-glow-${product.id}`} x="-40%" y="-140%" width="180%" height="300%">
                        <feGaussianBlur stdDeviation="0.75" result="glow" />
                        <feMerge>
                          <feMergeNode in="glow" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                    </defs>

                    <path
                      d={getSparklinePath(product.trend)}
                      fill="none"
                      stroke={`url(#trend-line-${product.id})`}
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      filter={`url(#trend-glow-${product.id})`}
                      opacity="0.9"
                    />
                  </svg>
                </article>
              ))}
            </div>
          </div>

          <button
            type="button"
            className="dashboard-glass-main-button relative mx-auto mt-1.5 flex items-center justify-center gap-2 overflow-hidden rounded-[13px] px-4 py-1.5 text-[12.5px] font-black transition duration-200"
            style={glassMainButtonStyle}
          >
            <span
              className="button-shine pointer-events-none absolute -left-10 top-[-18px] h-[70px] w-[16px]"
              style={{
                background:
                  'linear-gradient(90deg, transparent, rgba(255,255,255,0.34), transparent)',
              }}
            />

            <span
              className="pointer-events-none absolute inset-x-4 top-[3px] h-px"
              style={{
                background:
                  'linear-gradient(90deg, transparent, rgba(255,255,255,0.54), color-mix(in srgb, var(--admin-primary) 12%, rgba(255,255,255,0.36)), transparent)',
                opacity: 0.85,
              }}
            />

            <span
              className="pointer-events-none absolute right-[10px] top-[8px] h-[4px] w-[4px] rounded-full"
              style={{
                background: 'rgba(255,255,255,0.84)',
                boxShadow:
                  '0 0 6px rgba(255,255,255,0.70), 0 0 10px color-mix(in srgb, var(--admin-primary) 18%, transparent)',
              }}
            />

            <span className="relative z-10">Ver todos los productos</span>
            <span className="relative z-10" aria-hidden="true">
              →
            </span>
          </button>
        </div>
      </div>
    </section>
  );
}