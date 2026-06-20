// frontend/src/admin/dashboard/components/DashboardSalesPanel.jsx

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, ImageIcon, LineChart, Loader2, Sparkles } from 'lucide-react';
import { dashboardStyles as styles } from '../dashboardStyles';

const SVG_WIDTH = 620;
const SVG_HEIGHT = 200;
const FALLBACK_RANGE_OPTIONS = [{ value: 'this_week', label: 'Esta semana' }];

const CHART_BOUNDS = {
  left: 58,
  right: 596,
  top: 86,
  bottom: 150,
};

function toSafeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function formatMoney(value) {
  const number = toSafeNumber(value, 0);

  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(number);
}

function formatAxisLabel(value) {
  const number = toSafeNumber(value, 0);

  if (number >= 1000000) {
    return `${Number((number / 1000000).toFixed(1)).toLocaleString('en-US')}M`;
  }

  if (number >= 1000) {
    return `${Number((number / 1000).toFixed(1)).toLocaleString('en-US')}K`;
  }

  return String(Math.round(number));
}

function getNiceChartMax(value) {
  const rawValue = Math.max(toSafeNumber(value, 0), 0);

  if (rawValue <= 0) return 1;

  const magnitude = 10 ** Math.floor(Math.log10(rawValue));
  const normalized = rawValue / magnitude;

  if (normalized <= 1) return magnitude;
  if (normalized <= 2) return 2 * magnitude;
  if (normalized <= 5) return 5 * magnitude;
  return 10 * magnitude;
}

function getChartMaxValue(...datasets) {
  const maxValue = Math.max(
    ...datasets
      .flat()
      .map((item) => Math.max(toSafeNumber(item?.value, 0), 0)),
    0
  );

  return getNiceChartMax(maxValue);
}

function getChartPoints(data = [], chartMaxValue = 1) {
  const scale = Math.max(toSafeNumber(chartMaxValue, 1), 1);

  return data.map((item, index) => {
    const rawValue = Math.max(toSafeNumber(item?.value, 0), 0);
    const safeValue = Math.min(rawValue, scale);

    const x =
      CHART_BOUNDS.left +
      (index / Math.max(data.length - 1, 1)) *
        (CHART_BOUNDS.right - CHART_BOUNDS.left);

    const y =
      CHART_BOUNDS.bottom -
      (safeValue / scale) *
        (CHART_BOUNDS.bottom - CHART_BOUNDS.top);

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

  const baseline = CHART_BOUNDS.bottom;
  const line = getSmoothPath(points);

  return `${line} L ${points[points.length - 1].x} ${baseline} L ${points[0].x} ${baseline} Z`;
}

function getYAxisLabels(maxValue, hasSales) {
  if (!hasSales) {
    return [{ label: '0', y: CHART_BOUNDS.bottom }];
  }

  const scale = Math.max(toSafeNumber(maxValue, 1), 1);
  const step = (CHART_BOUNDS.bottom - CHART_BOUNDS.top) / 5;

  return [
    { label: formatAxisLabel(scale), y: CHART_BOUNDS.top },
    { label: formatAxisLabel(scale * 0.8), y: CHART_BOUNDS.top + step },
    { label: formatAxisLabel(scale * 0.6), y: CHART_BOUNDS.top + step * 2 },
    { label: formatAxisLabel(scale * 0.4), y: CHART_BOUNDS.top + step * 3 },
    { label: formatAxisLabel(scale * 0.2), y: CHART_BOUNDS.top + step * 4 },
    { label: '0', y: CHART_BOUNDS.bottom },
  ];
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

function getComparisonText(currentValue, previousValue) {
  const current = toSafeNumber(currentValue, 0);
  const previous = toSafeNumber(previousValue, 0);

  if (previous <= 0 && current > 0) return 'Nuevo vs anterior';
  if (previous <= 0) return 'Sin comparativo';

  const percent = ((current - previous) / previous) * 100;
  const sign = percent >= 0 ? '+' : '';

  return `${sign}${percent.toFixed(1)}% vs anterior`;
}

function getTooltipPlacement(point) {
  if (!point) return { left: 50, top: 50 };

  return {
    left: Math.min(Math.max((point.x / SVG_WIDTH) * 100, 17), 83),
    top: Math.min(Math.max((point.y / SVG_HEIGHT) * 100, 43), 78),
  };
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

function SalesRangeDropdown({ value, options = [], loading = false, buttonStyle, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const safeOptions = options.length ? options : FALLBACK_RANGE_OPTIONS;
  const selectedOption =
    safeOptions.find((option) => option.value === value) ||
    safeOptions[0] ||
    FALLBACK_RANGE_OPTIONS[0];

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event) => {
      if (!dropdownRef.current || dropdownRef.current.contains(event.target)) return;
      setIsOpen(false);
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={dropdownRef} className="relative z-40">
      <button
        type="button"
        disabled={loading}
        onClick={() => setIsOpen((current) => !current)}
        className="relative inline-flex h-9 min-w-[132px] items-center justify-between gap-2 overflow-hidden rounded-[12px] px-3.5 text-[11px] font-black transition duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
        style={buttonStyle}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="Rango de ventas"
      >
        <DiamondGlints small />
        <span className="relative z-10 truncate">{selectedOption.label}</span>
        <ChevronDown
          size={13}
          className="relative z-10 shrink-0 transition-transform duration-200"
          style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>

      {isOpen ? (
        <div
          className="absolute right-0 top-[calc(100%+8px)] z-[90] w-[178px] overflow-hidden rounded-[16px] p-[1px]"
          style={{
            border:
              '1px solid color-mix(in srgb, var(--admin-primary) 22%, rgba(255,255,255,0.56))',
            background: `
              linear-gradient(
                145deg,
                color-mix(in srgb, var(--admin-card-bg) 74%, rgba(255,255,255,0.22)) 0%,
                color-mix(in srgb, var(--admin-card-bg) 88%, var(--admin-primary) 7%) 100%
              )
            `,
            boxShadow: `
              inset 0 1px 0 rgba(255,255,255,0.40),
              0 18px 34px rgba(12,6,35,0.15),
              0 0 18px color-mix(in srgb, var(--admin-primary) 13%, transparent)
            `,
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          }}
        >
          <div
            role="listbox"
            className="rounded-[15px] p-1"
            style={{
              background: `
                linear-gradient(
                  145deg,
                  rgba(255,255,255,0.12) 0%,
                  rgba(255,255,255,0.035) 100%
                )
              `,
            }}
          >
            {safeOptions.map((option) => {
              const selected = option.value === selectedOption.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    if (option.value !== value) onChange?.(option.value);
                    setIsOpen(false);
                  }}
                  className="relative flex w-full items-center justify-between gap-2 rounded-[12px] px-3 py-2 text-left text-[11px] font-black transition duration-150 hover:-translate-y-[1px]"
                  style={{
                    color: selected ? 'var(--admin-primary)' : 'var(--admin-card-text)',
                    background: selected
                      ? 'color-mix(in srgb, var(--admin-primary) 12%, rgba(255,255,255,0.26))'
                      : 'transparent',
                    boxShadow: selected
                      ? 'inset 0 1px 0 rgba(255,255,255,0.32), 0 6px 14px rgba(12,6,35,0.055)'
                      : 'none',
                  }}
                >
                  <span className="truncate">{option.label}</span>
                  {selected ? <Check size={13} className="shrink-0" /> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ProductImage({ image, name }) {
  if (!image) {
    return (
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
        style={{
          border: '1px solid color-mix(in srgb, var(--admin-primary) 14%, rgba(255,255,255,0.24))',
          background: 'color-mix(in srgb, var(--admin-primary) 8%, rgba(255,255,255,0.12))',
          color: 'var(--admin-primary)',
        }}
      >
        <ImageIcon size={13} />
      </span>
    );
  }

  return <img src={image} alt={name} className="h-7 w-7 shrink-0 rounded-lg object-cover" />;
}

export default function DashboardSalesPanel({
  chartData = [],
  comparisonData = [],
  salesSummary = null,
  salesPeriod = null,
  range = 'this_week',
  rangeOptions = [],
  compareEnabled = false,
  loading = false,
  topProducts = [],
  onRangeChange,
  onToggleCompare,
  onViewProducts,
}) {
  const rangeLabel = salesPeriod?.rangeLabel || 'Esta semana';
  const topProductsTitle =
    salesPeriod?.topProductsTitle || `Top productos ${rangeLabel.toLowerCase()}`;

  const chartMaxValue = getChartMaxValue(chartData, comparisonData);
  const points = getChartPoints(chartData, chartMaxValue);
  const comparisonPoints = compareEnabled
    ? getChartPoints(comparisonData, chartMaxValue)
    : [];

  const linePath = getSmoothPath(points);
  const areaPath = getAreaPath(points);
  const comparisonPath = getSmoothPath(comparisonPoints);
  const hasRealSales = points.some((point) => point.rawValue > 0);
  const hasComparisonSales = comparisonPoints.some((point) => point.rawValue > 0);
  const yLabels = getYAxisLabels(chartMaxValue, hasRealSales || hasComparisonSales);

  const defaultPointIndex = useMemo(() => {
    if (!points.length) return 0;

    return points.reduce((bestIndex, point, index) => {
      const bestValue = toSafeNumber(points[bestIndex]?.rawValue, 0);
      const currentValue = toSafeNumber(point?.rawValue, 0);

      return currentValue > bestValue ? index : bestIndex;
    }, 0);
  }, [chartData, chartMaxValue]);

  const [activePointIndex, setActivePointIndex] = useState(defaultPointIndex);

  useEffect(() => {
    setActivePointIndex(defaultPointIndex);
  }, [defaultPointIndex, range, compareEnabled, chartData]);

  const activePoint = hasRealSales ? points[activePointIndex] || points[defaultPointIndex] : null;
  const activeComparisonPoint = compareEnabled
    ? comparisonPoints[activePointIndex] || comparisonPoints[defaultPointIndex]
    : null;
  const activeOrders = toSafeNumber(
    activePoint?.orders ?? activePoint?.ordersCount ?? activePoint?.orderCount,
    0
  );
  const tooltipPosition = getTooltipPlacement(activePoint);
  const selectedRangeOptions = useMemo(
    () => (rangeOptions.length ? rangeOptions : FALLBACK_RANGE_OPTIONS),
    [rangeOptions]
  );

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
      className="dashboard-sales-enter relative self-start overflow-visible rounded-[28px] p-[1px]"
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
            from { opacity: 0; transform: translateY(16px) scale(0.985); filter: blur(6px); }
            to { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
          }

          @keyframes dashboardLineDraw {
            from { stroke-dashoffset: 1; opacity: 0.2; }
            to { stroke-dashoffset: 0; opacity: 1; }
          }

          @keyframes dashboardAreaRise {
            from { opacity: 0; transform: translateY(14px); }
            to { opacity: 1; transform: translateY(0); }
          }

          @keyframes dashboardPointEnter {
            0% { opacity: 0; transform: scale(0.45); }
            70% { opacity: 1; transform: scale(1.18); }
            100% { opacity: 1; transform: scale(1); }
          }

          @keyframes dashboardTooltipIn {
            from { opacity: 0; transform: translate(-50%, calc(-100% - 5px)) scale(0.96); filter: blur(4px); }
            to { opacity: 1; transform: translate(-50%, calc(-100% - 8px)) scale(1); filter: blur(0); }
          }

          @keyframes dashboardGlassPulse {
            0%, 100% { filter: brightness(1); }
            50% { filter: brightness(1.025); }
          }

          .dashboard-sales-enter { animation: dashboardSalesEnter 520ms ease-out both; }
          .dashboard-sales-area-animated { transform-box: fill-box; transform-origin: center bottom; animation: dashboardAreaRise 760ms ease-out both; }
          .dashboard-sales-line-animated { stroke-dasharray: 1; stroke-dashoffset: 1; animation: dashboardLineDraw 1250ms cubic-bezier(.22,.9,.24,1) 140ms both; }
          .dashboard-sales-point { transform-box: fill-box; transform-origin: center; cursor: pointer; animation: dashboardPointEnter 460ms ease-out both; outline: none !important; }
          .dashboard-sales-point:focus,
          .dashboard-sales-point:focus-visible { outline: none !important; }
          .dashboard-sales-point .point-core,
          .dashboard-sales-point .point-halo { transition: transform 180ms ease, opacity 180ms ease, filter 180ms ease; transform-box: fill-box; transform-origin: center; }
          .dashboard-sales-point:hover .point-core,
          .dashboard-sales-point:focus-visible .point-core,
          .dashboard-sales-point.is-active .point-core { transform: scale(1.65); opacity: 1; filter: drop-shadow(0 0 6px rgba(255,255,255,0.86)) drop-shadow(0 0 12px color-mix(in srgb, var(--admin-primary) 34%, transparent)); }
          .dashboard-sales-point:hover .point-halo,
          .dashboard-sales-point:focus-visible .point-halo,
          .dashboard-sales-point.is-active .point-halo { transform: scale(1.55); opacity: 0.7; }
          .dashboard-sales-tooltip { animation: dashboardTooltipIn 180ms ease-out both; }
          .dashboard-glass-main-button { animation: dashboardGlassPulse 3.8s ease-in-out infinite; }
          .dashboard-glass-main-button:hover { transform: translateY(-1px); border-color: color-mix(in srgb, var(--admin-primary) 30%, rgba(255,255,255,0.42)) !important; }
          @media (prefers-reduced-motion: reduce) {
            .dashboard-sales-enter,
            .dashboard-sales-area-animated,
            .dashboard-sales-line-animated,
            .dashboard-sales-point,
            .dashboard-sales-tooltip,
            .dashboard-glass-main-button { animation: none !important; }
          }
        `}
      </style>

      <div
        className="relative overflow-visible rounded-[27px] px-5 pb-2 pt-4"
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

        <div className="relative z-30 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2.5">
            <span
              className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-[12px]"
              style={diamondChipStyle}
            >
              <DiamondGlints small />
              <LineChart size={17} strokeWidth={2.35} />
            </span>

            <div className="min-w-0">
              <h2 className="text-[17px] font-black leading-none" style={styles.title}>
                Ventas semanales
              </h2>
              <p className="mt-1 text-[10.5px] font-bold" style={styles.muted}>
                {rangeLabel}
                {compareEnabled && salesSummary?.trend
                  ? ` · ${salesSummary.trend} vs. periodo anterior`
                  : ''}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <SalesRangeDropdown
              value={range}
              options={selectedRangeOptions}
              loading={loading}
              buttonStyle={diamondButtonStyle}
              onChange={onRangeChange}
            />

            <button
              type="button"
              onClick={() => onToggleCompare?.()}
              disabled={loading}
              className="relative inline-flex h-9 items-center gap-2 overflow-hidden rounded-[12px] px-3.5 text-[11px] font-black transition duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
              style={{
                ...diamondButtonStyle,
                border: compareEnabled
                  ? '1px solid color-mix(in srgb, var(--admin-primary) 34%, rgba(255,255,255,0.42))'
                  : diamondButtonStyle.border,
                color: compareEnabled ? 'var(--admin-primary)' : 'var(--admin-card-text)',
              }}
            >
              <DiamondGlints small />
              {loading ? <Loader2 size={13} className="relative z-10 animate-spin" /> : null}
              <span className="relative z-10">{compareEnabled ? 'Comparando' : 'Comparar'}</span>
            </button>
          </div>
        </div>

        <div className="relative z-10 mt-3 overflow-visible rounded-[20px]">
          <svg
            viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
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
                <stop offset="0%" stopColor="color-mix(in srgb, var(--admin-primary) 72%, rgba(255,255,255,0.35))" />
                <stop offset="50%" stopColor="var(--admin-primary)" />
                <stop offset="100%" stopColor="color-mix(in srgb, var(--admin-primary) 78%, rgba(255,255,255,0.34))" />
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
            </defs>

            {yLabels.map((item) => (
              <g key={`y-label-${item.label}-${item.y}`}>
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

                <line
                  x1={CHART_BOUNDS.left}
                  x2={CHART_BOUNDS.right}
                  y1={item.y}
                  y2={item.y}
                  stroke={
                    item.label === '0'
                      ? 'rgba(15,23,42,0.08)'
                      : 'color-mix(in srgb, var(--admin-primary) 10%, transparent)'
                  }
                  strokeOpacity="0.14"
                  strokeDasharray={item.label === '0' ? undefined : '6 12'}
                />
              </g>
            ))}

            {hasRealSales ? (
              <>
                <path className="dashboard-sales-area-animated" d={areaPath} fill="url(#sales-area-clean)" />

                {compareEnabled && hasComparisonSales ? (
                  <path
                    d={comparisonPath}
                    fill="none"
                    stroke="color-mix(in srgb, var(--admin-primary) 44%, rgba(15,23,42,0.45))"
                    strokeWidth="1.45"
                    strokeDasharray="7 7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.72"
                  />
                ) : null}

                <path
                  className="dashboard-sales-line-animated"
                  d={linePath}
                  pathLength="1"
                  fill="none"
                  stroke="url(#sales-line-clean)"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="url(#sales-line-glow-clean)"
                />
              </>
            ) : (
              <g pointerEvents="none">
                <text
                  x="327"
                  y="92"
                  textAnchor="middle"
                  fontSize="13"
                  fontWeight="900"
                  fill="var(--admin-card-text)"
                  opacity="0.54"
                >
                  Sin ventas registradas en {rangeLabel.toLowerCase()}
                </text>
                <text
                  x="327"
                  y="111"
                  textAnchor="middle"
                  fontSize="10.5"
                  fontWeight="800"
                  fill="var(--admin-card-muted-text)"
                  opacity="0.58"
                >
                  El gráfico se actualizará cuando ingresen pedidos pagados o activos.
                </text>
              </g>
            )}

            {points.map((point, index) => {
              const active = index === activePointIndex;

              return (
                <g
                  key={`sales-point-${point.label}-${index}`}
                  className={`dashboard-sales-point${active ? ' is-active' : ''}`}
                  tabIndex={0}
                  role="button"
                  aria-label={`${point.label}: $${formatMoney(point.rawValue)} en ventas`}
                  onMouseEnter={() => setActivePointIndex(index)}
                  onFocus={() => setActivePointIndex(index)}
                  onClick={() => setActivePointIndex(index)}
                  style={{
                    animationDelay: `${260 + index * 70}ms`,
                    outline: 'none',
                  }}
                >
                  <circle
                    className="point-halo"
                    cx={point.x}
                    cy={point.y}
                    r="6.2"
                    fill="rgba(255,255,255,0.36)"
                    opacity="0.38"
                    filter="url(#sales-point-glow-clean)"
                  />
                  <circle
                    className="point-core"
                    cx={point.x}
                    cy={point.y}
                    r="2.9"
                    fill="rgba(255,255,255,0.98)"
                    filter="url(#sales-point-glow-clean)"
                  />
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
              );
            })}
          </svg>

          {activePoint ? (
            <div
              className="dashboard-sales-tooltip pointer-events-none absolute z-[80] w-[142px] rounded-[17px] p-[1px]"
              style={{
                left: `${tooltipPosition.left}%`,
                top: `${tooltipPosition.top}%`,
                transform: 'translate(-50%, calc(-100% - 8px))',
                border:
                  '1px solid color-mix(in srgb, var(--admin-primary) 24%, rgba(255,255,255,0.58))',
                background: `
                  linear-gradient(
                    145deg,
                    rgba(255,255,255,0.26) 0%,
                    color-mix(in srgb, var(--admin-card-bg) 45%, rgba(255,255,255,0.40)) 48%,
                    color-mix(in srgb, var(--admin-card-bg) 72%, var(--admin-primary) 10%) 100%
                  )
                `,
                boxShadow: `
                  inset 0 1px 0 rgba(255,255,255,0.68),
                  inset 0 -1px 0 rgba(15,23,42,0.10),
                  inset 0 0 18px rgba(255,255,255,0.060),
                  0 14px 28px rgba(12,6,35,0.15),
                  0 0 18px color-mix(in srgb, var(--admin-primary) 17%, transparent)
                `,
                backdropFilter: 'blur(20px) saturate(190%)',
                WebkitBackdropFilter: 'blur(20px) saturate(190%)',
              }}
            >
              <div
                className="relative overflow-hidden rounded-[16px] px-3 py-2 text-left"
                style={{
                  background: `
                    linear-gradient(
                      145deg,
                      rgba(255,255,255,0.16) 0%,
                      rgba(255,255,255,0.060) 62%,
                      color-mix(in srgb, var(--admin-primary) 5%, transparent) 100%
                    )
                  `,
                }}
              >
                <span
                  className="pointer-events-none absolute inset-x-4 top-0 h-px"
                  style={{
                    background:
                      'linear-gradient(90deg, transparent, rgba(255,255,255,0.86), transparent)',
                  }}
                />

                <span
                  className="pointer-events-none absolute right-[9px] top-[8px] h-[4px] w-[4px] rounded-full"
                  style={{
                    background: 'rgba(255,255,255,0.86)',
                    boxShadow:
                      '0 0 7px rgba(255,255,255,0.72), 0 0 12px color-mix(in srgb, var(--admin-primary) 24%, transparent)',
                  }}
                />

                <p
                  className="max-w-[108px] truncate text-[8.8px] font-black uppercase tracking-[0.13em]"
                  style={styles.muted}
                  title={activePoint.label}
                >
                  {activePoint.label}
                </p>

                <p
                  className="mt-1 text-[15px] font-black leading-none tracking-tight"
                  style={styles.title}
                >
                  ${formatMoney(activePoint.rawValue)}
                </p>

                <div className="mt-1 flex items-center justify-between gap-2">
                  <p
                    className="min-w-0 truncate text-[9px] font-black leading-[11px]"
                    style={{ color: 'var(--admin-primary)' }}
                    title={
                      compareEnabled && activeComparisonPoint
                        ? getComparisonText(activePoint.rawValue, activeComparisonPoint.rawValue)
                        : 'Ventas del periodo'
                    }
                  >
                    {compareEnabled && activeComparisonPoint
                      ? getComparisonText(activePoint.rawValue, activeComparisonPoint.rawValue)
                      : 'Ventas del periodo'}
                  </p>

                  {activeOrders > 0 ? (
                    <span
                      className="shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-black"
                      style={{
                        color: 'var(--admin-primary)',
                        background:
                          'color-mix(in srgb, var(--admin-primary) 10%, rgba(255,255,255,0.22))',
                        border:
                          '1px solid color-mix(in srgb, var(--admin-primary) 14%, rgba(255,255,255,0.28))',
                      }}
                    >
                      {activeOrders}p
                    </span>
                  ) : null}
                </div>

                {compareEnabled && activeComparisonPoint ? (
                  <p className="mt-0.5 truncate text-[8.5px] font-bold leading-[10px]" style={styles.muted}>
                    Ant: ${formatMoney(activeComparisonPoint.rawValue)}
                  </p>
                ) : null}

                <span
                  className="absolute left-1/2 top-full h-2.5 w-2.5 -translate-x-1/2 -translate-y-1.5 rotate-45"
                  style={{
                    background:
                      'color-mix(in srgb, var(--admin-card-bg) 48%, rgba(255,255,255,0.34))',
                    borderRight:
                      '1px solid color-mix(in srgb, var(--admin-primary) 16%, rgba(255,255,255,0.40))',
                    borderBottom:
                      '1px solid color-mix(in srgb, var(--admin-primary) 16%, rgba(255,255,255,0.40))',
                    boxShadow:
                      '2px 2px 8px color-mix(in srgb, var(--admin-primary) 8%, transparent)',
                  }}
                />
              </div>
            </div>
          ) : null}
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
              {topProductsTitle}
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
              {topProducts.slice(0, 3).map((product, index) => (
                <article
                  key={product.id || `${product.name}-${index}`}
                  className="grid grid-cols-[minmax(0,1fr)_70px_112px_92px] items-center gap-2 px-3.5 py-1"
                  style={{
                    borderBottom:
                      '1px solid color-mix(in srgb, var(--admin-primary) 7%, rgba(255,255,255,0.05))',
                    background: 'transparent',
                  }}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <ProductImage image={product.image} name={product.name} />

                    <p className="truncate text-[12px] font-bold leading-none" style={styles.title}>
                      {product.name || 'Producto sin nombre'}
                    </p>
                  </div>

                  <p className="text-[12px] font-bold leading-none" style={styles.title}>
                    {product.sales || 0}
                  </p>

                  <p className="text-[12px] font-bold leading-none" style={styles.title}>
                    {product.income || '$0.00'}
                  </p>

                  <svg viewBox="0 0 76 18" className="h-4.5 w-full">
                    <path
                      d={getSparklinePath(product.trend || [])}
                      fill="none"
                      stroke="var(--admin-primary)"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity="0.9"
                    />
                  </svg>
                </article>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => onViewProducts?.()}
            className="dashboard-glass-main-button relative mx-auto mt-1.5 flex items-center justify-center gap-2 overflow-hidden rounded-[13px] px-4 py-1.5 text-[12.5px] font-black transition duration-200"
            style={glassMainButtonStyle}
          >
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
