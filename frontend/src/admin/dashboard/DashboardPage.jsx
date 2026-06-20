// frontend/src/admin/dashboard/DashboardPage.jsx

import { useMemo, useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  dashboardAlerts,
  dashboardKpis,
  dashboardQuickActions,
  inventoryByBranch,
  monthlyGoal,
  recentOrders,
  salesChartData,
  topProducts,
} from './dashboardMockData';

import { getDashboardSales, getDashboardSummary } from './api/dashboardApi';
import DashboardModelOne from './layouts/DashboardModelOne';

const DASHBOARD_MODELS = {
  modelOne: DashboardModelOne,
};

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

const fallbackDashboardData = {
  quickActions: dashboardQuickActions,
  kpis: dashboardKpis,
  salesChartData,
  comparisonSalesChartData: [],
  salesSummary: null,
  salesPeriod: {
    range: 'this_week',
    rangeLabel: 'Esta semana',
    compare: false,
  },
  topProducts,
  alerts: dashboardAlerts,
  monthlyGoal,
  inventoryByBranch,
  recentOrders,
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const selectedModel = 'modelOne';
  const SelectedDashboardModel = DASHBOARD_MODELS[selectedModel] || DashboardModelOne;

  const [dashboardData, setDashboardData] = useState(fallbackDashboardData);
  const [salesRange, setSalesRange] = useState('this_week');
  const [salesCompare, setSalesCompare] = useState(false);
  const [salesLoading, setSalesLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadDashboardSummary() {
      try {
        const data = await getDashboardSummary();

        if (!isMounted || !data) return;

        setDashboardData((prev) => ({
          ...prev,
          quickActions: data.quickActions || fallbackDashboardData.quickActions,
          kpis: data.kpis || fallbackDashboardData.kpis,
          salesChartData: data.salesChartData || fallbackDashboardData.salesChartData,
          topProducts: data.topProducts || fallbackDashboardData.topProducts,
          alerts: data.alerts || fallbackDashboardData.alerts,
          monthlyGoal: data.monthlyGoal || fallbackDashboardData.monthlyGoal,
          inventoryByBranch: data.inventoryByBranch || fallbackDashboardData.inventoryByBranch,
          recentOrders: data.recentOrders || fallbackDashboardData.recentOrders,
        }));
      } catch (error) {
        console.error('No se pudo cargar el dashboard real:', error);
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
      setSalesLoading(true);

      setDashboardData((prev) => ({
        ...prev,
        salesPeriod: {
          ...(prev.salesPeriod || {}),
          range: activeRange,
          rangeLabel: activeRangeOption.label,
          compare: salesCompare,
        },
      }));

      try {
        const data = await getDashboardSales({
          range: activeRange,
          compare: salesCompare ? 'true' : 'false',
        });

        if (!isMounted || !data) return;

        setDashboardData((prev) => ({
          ...prev,
          salesChartData: Array.isArray(data.chartData) ? data.chartData : [],
          comparisonSalesChartData: Array.isArray(data.comparisonChartData)
            ? data.comparisonChartData
            : [],
          salesSummary: data.summary || null,
          salesPeriod: {
            range: data.range || activeRange,
            rangeLabel: data.rangeLabel || activeRangeOption.label,
            compare: Boolean(data.compare),
          },
        }));
      } catch (error) {
        console.error('No se pudo cargar el gráfico de ventas:', error);
      } finally {
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

  return (
    <section className="space-y-4 text-slate-950">
      <SelectedDashboardModel
        quickActions={dashboardData.quickActions}
        kpis={dashboardData.kpis}
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
        inventoryByBranch={dashboardData.inventoryByBranch}
        recentOrders={dashboardData.recentOrders}
        navigation={dashboardNavigation}
        onDashboardAction={handleDashboardAction}
      />
    </section>
  );
}
