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

import { getDashboardSummary } from './api/dashboardApi';
import DashboardModelOne from './layouts/DashboardModelOne';

const DASHBOARD_MODELS = {
  modelOne: DashboardModelOne,
};

const fallbackDashboardData = {
  quickActions: dashboardQuickActions,
  kpis: dashboardKpis,
  salesChartData,
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

  useEffect(() => {
    let isMounted = true;

    async function loadDashboardSummary() {
      try {
        const data = await getDashboardSummary();

        if (!isMounted || !data) return;

        setDashboardData({
          quickActions: data.quickActions || fallbackDashboardData.quickActions,
          kpis: data.kpis || fallbackDashboardData.kpis,
          salesChartData: data.salesChartData || fallbackDashboardData.salesChartData,
          topProducts: data.topProducts || fallbackDashboardData.topProducts,
          alerts: data.alerts || fallbackDashboardData.alerts,
          monthlyGoal: data.monthlyGoal || fallbackDashboardData.monthlyGoal,
          inventoryByBranch: data.inventoryByBranch || fallbackDashboardData.inventoryByBranch,
          recentOrders: data.recentOrders || fallbackDashboardData.recentOrders,
        });
      } catch (error) {
        console.error('No se pudo cargar el dashboard real:', error);
      }
    }

    loadDashboardSummary();

    return () => {
      isMounted = false;
    };
  }, []);

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

  return (
    <section className="space-y-4 text-slate-950">
      <SelectedDashboardModel
        quickActions={dashboardData.quickActions}
        kpis={dashboardData.kpis}
        salesChartData={dashboardData.salesChartData}
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
