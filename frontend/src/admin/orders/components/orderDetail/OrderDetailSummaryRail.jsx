import OrderDetailSummaryHero from './OrderDetailSummaryHero';
import {
  OrderDetailProgressPanel,
  OrderDetailQuickInfoPanel,
  OrderDetailTraceabilityPanel,
} from './OrderDetailSummaryPanels';
import { buildOrderSummaryRailModel } from './orderSummaryRailModel';

export default function OrderDetailSummaryRail({ order }) {
  const model = buildOrderSummaryRailModel(order);

  return (
    <aside
      className="order-detail-summary-rail"
      style={{
        position: 'sticky',
        top: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        minWidth: 0,
      }}
    >
      <OrderDetailSummaryHero
        breakdown={model.breakdown}
        exchange={model.exchange}
        invoice={model.invoice}
        payment={model.payment}
        status={model.status}
        statusLabel={model.statusLabel}
      />
      <OrderDetailProgressPanel
        progress={model.progress}
        statusLabel={model.statusLabel}
      />
      <OrderDetailQuickInfoPanel
        branchInfo={model.branchInfo}
        order={model.order}
        summary={model.summary}
      />
      <OrderDetailTraceabilityPanel
        admin={model.admin}
        branchInfo={model.branchInfo}
        order={model.order}
        sourceLabel={model.sourceLabel}
      />
    </aside>
  );
}
