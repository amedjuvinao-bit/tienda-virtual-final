// frontend/src/admin/dashboard/components/DashboardSalesPanel.jsx

import { ChevronDown, LineChart, Sparkles } from 'lucide-react';
import { dashboardStyles as styles } from '../dashboardStyles';

function getChartPoints(data = []) {
  const width = 620;
  const height = 168;
  const paddingX = 24;
  const paddingY = 18;
  const values = data.map((item) => Number(item.value || 0));
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;

  return data.map((item, index) => {
    const x = paddingX + (index / Math.max(data.length - 1, 1)) * (width - paddingX * 2);
    const y = height - paddingY - ((Number(item.value || 0) - min) / range) * (height - paddingY * 2);
    return { ...item, x, y };
  });
}

function getLinePath(points = []) {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
}

function getAreaPath(points = []) {
  if (!points.length) return '';
  const line = getLinePath(points);
  return `${line} L ${points[points.length - 1].x} 156 L ${points[0].x} 156 Z`;
}

function getSparklinePath(values = []) {
  if (!values.length) return '';
  const width = 76;
  const height = 22;
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

export default function DashboardSalesPanel({ chartData = [], topProducts = [] }) {
  const points = getChartPoints(chartData);
  const linePath = getLinePath(points);
  const areaPath = getAreaPath(points);
  const highlightPoint = points[3] || points[points.length - 1];

  return (
    <section className="p-5" style={styles.chartCard}>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center" style={styles.kpiIcon}>
            <LineChart size={18} />
          </span>

          <div>
            <h2 className="text-lg font-black" style={styles.title}>
              Ventas semanales
            </h2>
            <p className="mt-1 text-sm" style={styles.muted}>
              Evolución de ingresos durante la semana actual.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" className="inline-flex items-center gap-2 px-4 py-2 text-xs font-black" style={styles.actionButton}>
            Esta semana
            <ChevronDown size={14} />
          </button>
          <button type="button" className="inline-flex items-center gap-2 px-4 py-2 text-xs font-black" style={styles.actionButton}>
            Comparar
          </button>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-[22px]">
        <svg viewBox="0 0 620 168" className="h-[190px] w-full" preserveAspectRatio="none" role="img" aria-label="Gráfico de ventas semanales">
          <defs>
            <linearGradient id="dashboard-sales-area" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--admin-primary)" stopOpacity="0.30" />
              <stop offset="100%" stopColor="var(--admin-primary)" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {[0, 1, 2, 3].map((line) => (
            <line
              key={line}
              x1="24"
              x2="596"
              y1={24 + line * 34}
              y2={24 + line * 34}
              stroke="rgba(219,39,119,0.14)"
              strokeDasharray="8 10"
            />
          ))}

          <path d={areaPath} fill="url(#dashboard-sales-area)" />
          <path d={linePath} fill="none" stroke="var(--admin-primary)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />

          {points.map((point) => (
            <g key={point.label}>
              <circle cx={point.x} cy={point.y} r="7" fill="#fff" stroke="var(--admin-primary)" strokeWidth="4" />
              <text x={point.x} y="164" textAnchor="middle" fontSize="12" fontWeight="800" fill="var(--admin-card-muted-text)">
                {point.label}
              </text>
            </g>
          ))}

          {highlightPoint && (
            <g>
              <rect x={highlightPoint.x - 42} y={highlightPoint.y - 50} width="84" height="38" rx="14" fill="rgba(255,255,255,0.86)" stroke="rgba(255,255,255,0.78)" />
              <text x={highlightPoint.x} y={highlightPoint.y - 34} textAnchor="middle" fontSize="10" fontWeight="900" fill="var(--admin-card-muted-text)">
                {highlightPoint.label}
              </text>
              <text x={highlightPoint.x} y={highlightPoint.y - 18} textAnchor="middle" fontSize="11" fontWeight="900" fill="var(--admin-card-text)">
                $41,230
              </text>
            </g>
          )}
        </svg>
      </div>

      <div className="mt-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-black" style={styles.title}>
              Top productos
            </h3>
            <p className="mt-1 text-sm" style={styles.muted}>
              Productos con mejor rendimiento esta semana.
            </p>
          </div>
          <span className="inline-flex items-center gap-2 px-3 py-1 text-xs font-black" style={styles.primaryChip}>
            <Sparkles size={14} />
            Tendencia
          </span>
        </div>

        <div className="space-y-2">
          {topProducts.map((product) => (
            <article key={product.id} className="grid gap-3 p-3 md:grid-cols-[minmax(0,1fr)_62px_108px_84px] md:items-center" style={styles.alertItem}>
              <div className="flex min-w-0 items-center gap-3">
                <img src={product.image} alt={product.name} className="h-10 w-10 shrink-0 rounded-2xl object-cover" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-black" style={styles.title}>{product.name}</p>
                  <p className="mt-0.5 text-xs font-bold" style={styles.muted}>SKU: {product.sku}</p>
                </div>
              </div>
              <p className="text-sm font-black" style={styles.title}>{product.sales}</p>
              <p className="text-sm font-black" style={styles.title}>{product.income}</p>
              <svg viewBox="0 0 76 22" className="h-6 w-full">
                <path d={getSparklinePath(product.trend)} fill="none" stroke="var(--admin-primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </article>
          ))}
        </div>

        <button type="button" className="mt-3 w-full px-4 py-2.5 text-sm font-black transition hover:-translate-y-0.5" style={styles.actionButton}>
          Ver todos los productos →
        </button>
      </div>
    </section>
  );
}
