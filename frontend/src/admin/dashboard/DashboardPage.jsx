// frontend/src/admin/dashboard/DashboardPage.jsx

import { useMemo, useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { getDashboardSales, getDashboardSummary } from './api/dashboardApi';
import DashboardModelOne from './layouts/DashboardModelOne';

const DASHBOARD_MODELS = {
  modelOne: DashboardModelOne,
};

const SALES_LOADING_MIN_MS = 750;

const SALES_RANGE_OPTIONS = [
  { value: 'this_week', label: 'Esta semana' },
  { value: 'last_7_days', label: 'Últimos 7 días' },
  { value: 'this_month', label: 'Este mes' },
  { value: 'previous_month', label: 'Mes anterior' },
];

function getSalesRangeOption(value) {
  return (
    SALES_RANGE_OPTIONS.find((item) => item.value === value) || SALES_RANGE_OPTIONS[0]
  );
}

function normalizeSalesRange(value) {
  return getSalesRangeOption(value).value;
}

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

const emptyDashboardData = {
  quickActions: [],
  kpis: [],
  salesChartData: [],
  comparisonSalesChartData: [],
  salesSummary: null,
  salesPeriod: {
    range: 'this_week',
    rangeLabel: 'Esta semana',
    compare: false,
    topProductsTitle: 'Top productos esta semana',
  },
  topProducts: [],
  alerts: [],
  monthlyGoal: null,
  inventoryByBranch: [],
  recentOrders: [],
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const selectedModel = 'modelOne';
  const SelectedDashboardModel = DASHBOARD_MODELS[selectedModel] || DashboardModelOne;

  const [dashboardData, setDashboardData] = useState(emptyDashboardData);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState(null);
  const [salesError, setSalesError] = useState(null);
  const [salesRange, setSalesRange] = useState('this_week');
  const [salesCompare, setSalesCompare] = useState(false);
  const [salesLoading, setSalesLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadDashboardSummary() {
      setDashboardLoading(true);
      setDashboardError(null);

      try {
        const data = await getDashboardSummary();

        if (!isMounted) return;
        if (!data) throw new Error('Respuesta vacía del backend');

        setDashboardData((prev) => ({
          ...prev,
          quickActions: Array.isArray(data.quickActions) ? data.quickActions : [],
          kpis: Array.isArray(data.kpis) ? data.kpis : [],
          salesChartData: Array.isArray(data.salesChartData) ? data.salesChartData : [],
          topProducts: Array.isArray(data.topProducts) ? data.topProducts : [],
          alerts: Array.isArray(data.alerts) ? data.alerts : [],
          monthlyGoal: data.monthlyGoal || null,
          inventoryByBranch: Array.isArray(data.inventoryByBranch) ? data.inventoryByBranch : [],
          recentOrders: Array.isArray(data.recentOrders) ? data.recentOrders : [],
        }));
      } catch (error) {
        console.error('No se pudo cargar el dashboard real:', error);
        if (isMounted) {
          setDashboardError(
            'No se pudo cargar el resumen principal del dashboard. No se mostrarán datos simulados.'
          );
        }
      } finally {
        if (isMounted) setDashboardLoading(false);
      }
    }

    loadDashboardSummary();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const activeRange = normalizeSalesRange(salesRange);
    const activeRangeOption = getSalesRangeOption(activeRange);

    async function loadSalesData() {
      const startedAt = Date.now();

      setSalesLoading(true);
      setSalesError(null);

      setDashboardData((prev) => ({
        ...prev,
        salesPeriod: {
          ...(prev.salesPeriod || {}),
          range: activeRange,
          rangeLabel: activeRangeOption.label,
          compare: salesCompare,
          topProductsTitle: `Top productos ${activeRangeOption.label.toLowerCase()}`,
        },
      }));

      try {
        const data = await getDashboardSales({
          range: activeRange,
          compare: salesCompare ? 'true' : 'false',
        });

        if (!isMounted) return;
        if (!data) throw new Error('Respuesta vacía del backend');

        setDashboardData((prev) => ({
          ...prev,
          salesChartData: Array.isArray(data.chartData) ? data.chartData : [],
          comparisonSalesChartData: Array.isArray(data.comparisonChartData)
            ? data.comparisonChartData
            : [],
          topProducts: Array.isArray(data.topProducts) ? data.topProducts : [],
          salesSummary: data.summary || null,
          salesPeriod: {
            range: data.range || activeRange,
            rangeLabel: data.rangeLabel || activeRangeOption.label,
            compare: Boolean(data.compare),
            topProductsTitle:
              data.topProductsTitle ||
              `Top productos ${String(data.rangeLabel || activeRangeOption.label).toLowerCase()}`,
          },
        }));
      } catch (error) {
        console.error('No se pudo cargar el gráfico de ventas:', error);
        if (isMounted) {
          setSalesError(
            `No se pudieron cargar las ventas de ${activeRangeOption.label.toLowerCase()}. Revisa la conexión con el backend.`
          );
        }
      } finally {
        const remainingMs = Math.max(0, SALES_LOADING_MIN_MS - (Date.now() - startedAt));
        if (remainingMs > 0) await wait(remainingMs);
        if (isMounted) setSalesLoading(false);
      }
    }

    loadSalesData();

    return () => {
      isMounted = false;
    };
  }, [salesRange, salesCompare]);

  const dashboardNavigation = useMemo(
    () => ({
      viewProducts: () => navigate('/admin/productos'),
      viewInventory: () => navigate('/admin/inventario'),
      viewOrders: () => navigate('/admin/ordenes'),
      reviewOrders: () => navigate('/admin/ordenes?status=pending,processing&source=dashboard-alerts'),
    }),
    [navigate]
  );

  const handleDashboardAction = useCallback((action) => {
    if (typeof action === 'function') {
      action();
    }
  }, []);

  const handleSalesRangeChange = useCallback((nextRange) => {
    setSalesRange(normalizeSalesRange(nextRange));
  }, []);

  const handleToggleSalesCompare = useCallback(() => {
    setSalesCompare((prev) => !prev);
  }, []);

  const handleMonthlyGoalUpdated = useCallback((updatedGoal) => {
    if (!updatedGoal) return;

    setDashboardData((prev) => ({
      ...prev,
      monthlyGoal: {
        ...(prev.monthlyGoal || {}),
        ...updatedGoal,
      },
    }));
  }, []);

  return (
    <section className="space-y-4 text-slate-950">
      <SelectedDashboardModel
        quickActions={dashboardData.quickActions}
        kpis={dashboardData.kpis}
        dashboardLoading={dashboardLoading}
        dashboardError={dashboardError}
        salesError={salesError}
        salesChartData={dashboardData.salesChartData}
        comparisonSalesChartData={dashboardData.comparisonSalesChartData}
        salesSummary={dashboardData.salesSummary}
        salesPeriod={dashboardData.salesPeriod}
        salesRange={salesRange}
        salesRangeOptions={SALES_RANGE_OPTIONS}
        salesCompare={salesCompare}
        salesLoading={salesLoading}
        onSalesRangeChange={handleSalesRangeChange}
        onSalesCompareToggle={handleToggleSalesCompare}
        topProducts={dashboardData.topProducts}
        alerts={dashboardData.alerts}
        monthlyGoal={dashboardData.monthlyGoal}
        onGoalUpdated={handleMonthlyGoalUpdated}
        inventoryByBranch={dashboardData.inventoryByBranch}
        recentOrders={dashboardData.recentOrders}
        navigation={dashboardNavigation}
        onDashboardAction={handleDashboardAction}
      />
    </section>
  );
}
