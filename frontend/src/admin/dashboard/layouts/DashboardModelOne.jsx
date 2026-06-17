// frontend/src/admin/dashboard/layouts/DashboardModelOne.jsx

import DashboardAlertsPanel from '../components/DashboardAlertsPanel';
import DashboardGoalsPanel from '../components/DashboardGoalsPanel';
import DashboardHero from '../components/DashboardHero';
import DashboardInventoryByBranch from '../components/DashboardInventoryByBranch';
import DashboardKpiGrid from '../components/DashboardKpiGrid';
import DashboardRecentOrders from '../components/DashboardRecentOrders';
import DashboardSalesPanel from '../components/DashboardSalesPanel';

export default function DashboardModelOne(props) {
  return (
    <div className="space-y-3 xl:space-y-4">
      <DashboardHero actions={props.quickActions || []} />
      <DashboardKpiGrid items={props.kpis || []} />

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.5fr)_minmax(315px,0.5fr)]">
        <DashboardSalesPanel chartData={props.salesChartData || []} topProducts={props.topProducts || []} />
        <aside className="grid gap-3">
          <DashboardAlertsPanel alerts={props.alerts || []} />
          <DashboardGoalsPanel goal={props.monthlyGoal} />
        </aside>
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)]">
        <DashboardInventoryByBranch items={props.inventoryByBranch || []} />
        <DashboardRecentOrders orders={props.recentOrders || []} />
      </div>
    </div>
  );
}
