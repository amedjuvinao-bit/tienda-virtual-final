// frontend/src/admin/dashboard/DashboardPage.jsx

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
import { dashboardStyles as styles } from './dashboardStyles';
import DashboardModelOne from './layouts/DashboardModelOne';

const DASHBOARD_MODELS = {
  modelOne: DashboardModelOne,
};

export default function DashboardPage() {
  const selectedModel = 'modelOne';
  const SelectedDashboardModel = DASHBOARD_MODELS[selectedModel] || DashboardModelOne;

  return (
    <section className="space-y-6" style={styles.page}>
      <SelectedDashboardModel
        quickActions={dashboardQuickActions}
        kpis={dashboardKpis}
        salesChartData={salesChartData}
        topProducts={topProducts}
        alerts={dashboardAlerts}
        monthlyGoal={monthlyGoal}
        inventoryByBranch={inventoryByBranch}
        recentOrders={recentOrders}
      />
    </section>
  );
}