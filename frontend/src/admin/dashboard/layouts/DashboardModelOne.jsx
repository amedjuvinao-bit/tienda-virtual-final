// frontend/src/admin/dashboard/layouts/DashboardModelOne.jsx

import DashboardAlertsPanel from '../components/DashboardAlertsPanel';
import DashboardGoalsPanel from '../components/DashboardGoalsPanel';
import DashboardHero from '../components/DashboardHero';
import DashboardInventoryByBranch from '../components/DashboardInventoryByBranch';
import DashboardKpiGrid from '../components/DashboardKpiGrid';
import DashboardRecentOrders from '../components/DashboardRecentOrders';
import DashboardSalesPanel from '../components/DashboardSalesPanel';

export default function DashboardModelOne({
  quickActions = [],
  kpis = [],
  salesChartData = [],
  topProducts = [],
  alerts = [],
  monthlyGoal = null,
  inventoryByBranch = [],
  recentOrders = [],
}) {
  return (
    <div className="space-y-4 xl:space-y-5">
      <div className="overflow-hidden">
        <DashboardHero actions={quickActions} />
      </div>

      <DashboardKpiGrid items={kpis} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.45fr)] xl:items-start">
        <DashboardSalesPanel chartData={salesChartData} topProducts={topProducts} />

        <div className="grid gap-4">
          <DashboardAlertsPanel alerts={alerts} />
          <DashboardGoalsPanel goal={monthlyGoal} />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(420px,0.92fr)] xl:items-start">
        <DashboardInventoryByBranch items={inventoryByBranch} />
        <DashboardRecentOrders orders={recentOrders} />
      </div>
    </div>
  );
}