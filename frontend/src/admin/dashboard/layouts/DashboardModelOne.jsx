// frontend/src/admin/dashboard/layouts/DashboardModelOne.jsx

import DashboardAlertsPanel from '../components/DashboardAlertsPanel';
import DashboardGoalsPanel from '../components/DashboardGoalsPanel';
import DashboardHero from '../components/DashboardHero';
import DashboardInventoryByBranch from '../components/DashboardInventoryByBranch';
import DashboardKpiGrid from '../components/DashboardKpiGrid';
import DashboardRecentOrders from '../components/DashboardRecentOrders';
import DashboardSalesPanel from '../components/DashboardSalesPanel';

function sanitizeCssContent(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, ' ')
    .trim();
}

function runSectionButtonAction(event, action) {
  const button = event.target?.closest?.('button');

  if (!button || typeof action !== 'function') return;

  event.stopPropagation();
  action();
}

export default function DashboardModelOne(props) {
  const navigation = props.navigation || {};
  const topProductsTitle =
    props.salesPeriod?.topProductsTitle ||
    `Top productos ${String(props.salesPeriod?.rangeLabel || 'esta semana').toLowerCase()}`;

  const reviewOrders = navigation.reviewOrders || navigation.viewOrders;
  const hasTopProducts = Array.isArray(props.topProducts) && props.topProducts.length > 0;
  const showTopProductsEmptyState = !props.salesLoading && !hasTopProducts;

  return (
    <div className="space-y-2 xl:space-y-2">
      <style>
        {`
          .dashboard-sales-dynamic-title h3 {
            font-size: 0 !important;
            line-height: 1 !important;
          }

          .dashboard-sales-dynamic-title h3::after {
            content: var(--dashboard-top-products-title);
            font-size: 15px;
            font-weight: 950;
            line-height: 1;
          }
        `}
      </style>

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
            dashboard-sales-dynamic-title relative min-w-0 self-start
            xl:h-[var(--dashboard-sales-zone-height)]
            xl:[&>section]:h-full
            xl:[&>section>div]:h-full
          "
          style={{
            '--dashboard-top-products-title': `"${sanitizeCssContent(topProductsTitle)}"`,
          }}
        >
          <DashboardSalesPanel
            key={`sales-${props.salesRange || 'this_week'}-${props.salesCompare ? 'compare' : 'single'}`}
            chartData={props.salesChartData || []}
            comparisonData={props.comparisonSalesChartData || []}
            salesSummary={props.salesSummary}
            salesPeriod={props.salesPeriod}
            range={props.salesRange}
            rangeOptions={props.salesRangeOptions || []}
            compareEnabled={props.salesCompare}
            loading={props.salesLoading}
            onRangeChange={props.onSalesRangeChange}
            onToggleCompare={props.onSalesCompareToggle}
            topProducts={props.topProducts || []}
            onViewProducts={navigation.viewProducts}
          />

          {showTopProductsEmptyState ? (
            <div className="pointer-events-none absolute inset-x-7 bottom-[48px] z-20 flex justify-center">
              <div
                className="max-w-[430px] rounded-[16px] px-4 py-2 text-center"
                style={{
                  border:
                    '1px solid color-mix(in srgb, var(--admin-primary) 16%, rgba(255,255,255,0.28))',
                  background: `
                    linear-gradient(
                      145deg,
                      rgba(255,255,255,0.040) 0%,
                      rgba(255,255,255,0.014) 55%,
                      color-mix(in srgb, var(--admin-primary) 4%, transparent) 100%
                    )
                  `,
                  boxShadow: `
                    inset 0 1px 0 rgba(255,255,255,0.28),
                    0 8px 18px rgba(12,6,35,0.040),
                    0 0 10px color-mix(in srgb, var(--admin-primary) 8%, transparent)
                  `,
                  backdropFilter: 'blur(12px) saturate(155%)',
                  WebkitBackdropFilter: 'blur(12px) saturate(155%)',
                }}
              >
                <p className="text-[12px] font-black leading-[15px]" style={styles.title}>
                  Sin productos vendidos en este periodo.
                </p>
                <p className="mt-1 text-[10.5px] font-bold leading-[13px]" style={styles.muted}>
                  Cuando existan ventas pagadas o activas, aparecerán aquí los productos más vendidos.
                </p>
              </div>
            </div>
          ) : null}
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
            onClickCapture={(event) => runSectionButtonAction(event, reviewOrders)}
          >
            <DashboardAlertsPanel
              alerts={props.alerts || []}
              onViewAlerts={reviewOrders}
              onReviewAlert={reviewOrders}
            />
          </div>

          <div
            className="
              min-h-0 overflow-hidden
              xl:[&>section]:h-full
              xl:[&>section>div]:h-full
            "
          >
            <DashboardGoalsPanel
              goal={props.monthlyGoal}
              onGoalUpdated={props.onGoalUpdated}
            />
          </div>
        </aside>
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)]">
        <div
          className="min-w-0"
          onClickCapture={(event) => runSectionButtonAction(event, navigation.viewInventory)}
        >
          <DashboardInventoryByBranch
            items={props.inventoryByBranch || []}
            onViewInventory={navigation.viewInventory}
          />
        </div>

        <DashboardRecentOrders
          orders={props.recentOrders || []}
          onViewOrders={navigation.viewOrders}
        />
      </div>
    </div>
  );
}
