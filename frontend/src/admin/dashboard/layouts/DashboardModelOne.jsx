// frontend/src/admin/dashboard/layouts/DashboardModelOne.jsx

import DashboardAlertsPanel from '../components/DashboardAlertsPanel';
import DashboardGoalsPanel from '../components/DashboardGoalsPanel';
import DashboardHero from '../components/DashboardHero';
import DashboardInventoryByBranch from '../components/DashboardInventoryByBranch';
import DashboardKpiGrid from '../components/DashboardKpiGrid';
import DashboardRecentOrders from '../components/DashboardRecentOrders';
import DashboardSalesPanel from '../components/DashboardSalesPanel';

function getButtonText(target) {
  const button = target?.closest?.('button');
  return button ? String(button.textContent || '').replace(/\s+/g, ' ').trim() : '';
}

function isInsideSection(target, sectionTitle) {
  const section = target?.closest?.('section');
  if (!section) return false;
  return String(section.textContent || '').includes(sectionTitle);
}

export default function DashboardModelOne(props) {
  const navigation = props.navigation || {};

  const handleDashboardClick = (event) => {
    const text = getButtonText(event.target);
    if (!text) return;

    if (text.includes('Revisar')) {
      navigation.reviewOrders?.();
      return;
    }

    if (text.includes('Ver todos los productos')) {
      navigation.viewProducts?.();
      return;
    }

    if (text.includes('Ver detalle')) {
      navigation.viewInventory?.();
      return;
    }

    if (text.includes('Ver todas')) {
      if (isInsideSection(event.target, 'Alertas importantes')) {
        navigation.reviewOrders?.();
        return;
      }

      if (isInsideSection(event.target, 'Órdenes recientes')) {
        navigation.viewOrders?.();
      }
    }
  };

  return (
    <div className="space-y-2 xl:space-y-2" onClick={handleDashboardClick}>
      <DashboardHero actions={props.quickActions || []} />

      <div className="-mt-1">
        <DashboardKpiGrid items={props.kpis || []} />
      </div>

      <div
        className="
          -mt-1 grid items-start gap-3
          xl:grid-cols-[minmax(0,1.5fr)_minmax(315px,0.5fr)]
          xl:[--dashboard-sales-zone-height:475px]
        "
      >
        <div
          className="
            min-w-0 self-start
            xl:h-[var(--dashboard-sales-zone-height)]
            xl:[&>section]:h-full
            xl:[&>section>div]:h-full
          "
        >
          <DashboardSalesPanel
            chartData={props.salesChartData || []}
            topProducts={props.topProducts || []}
            onViewProducts={navigation.viewProducts}
          />
        </div>

        <aside
          className="
            grid min-w-0 self-start overflow-hidden
            gap-3
            xl:h-[var(--dashboard-sales-zone-height)]
            xl:grid-rows-[minmax(0,1fr)_minmax(0,0.72fr)]
          "
        >
          <div
            className="
              min-h-0 overflow-hidden
              xl:[&>section]:h-full
              xl:[&>section>div]:h-full
            "
          >
            <DashboardAlertsPanel
              alerts={props.alerts || []}
              onViewAlerts={navigation.reviewOrders || navigation.viewOrders}
              onReviewAlert={navigation.reviewOrders || navigation.viewOrders}
            />
          </div>

          <div
            className="
              min-h-0 overflow-hidden
              xl:[&>section]:h-full
              xl:[&>section>div]:h-full
            "
          >
            <DashboardGoalsPanel goal={props.monthlyGoal} />
          </div>
        </aside>
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)]">
        <DashboardInventoryByBranch
          items={props.inventoryByBranch || []}
          onViewInventory={navigation.viewInventory}
        />
        <DashboardRecentOrders
          orders={props.recentOrders || []}
          onViewOrders={navigation.viewOrders}
        />
      </div>
    </div>
  );
}
