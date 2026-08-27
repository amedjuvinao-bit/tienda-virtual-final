import OrderLogisticsGuidedFlow from './OrderLogisticsGuidedFlow';
import OrderLogisticsShipmentActions from './OrderLogisticsShipmentActions';
import {
  ShipmentHeader,
  ShipmentProgress,
} from './OrderLogisticsShipmentOverview';
import OrderLogisticsShipmentPlan from './OrderLogisticsShipmentPlan';
import { ORDER_DETAIL_THEME } from './orderDetailTheme';
import { buildShipmentCardViewModel } from './orderLogisticsShipmentCardModel';

export default function OrderLogisticsShipmentCard({
  shipment,
  providedForm,
  providedRates,
  providers,
  canManage,
  busy,
  labelConfirmation,
  pickupConfirmation,
  onUpdateForm,
  onRunAction,
  onRunProviderAction,
  onSetLabelConfirmation,
  onSetPickupConfirmation,
}) {
  const view = buildShipmentCardViewModel({
    shipment,
    providedForm,
    providedRates,
    providers,
    busy,
  });

  return (
    <article
      key={view.shipmentId}
      style={{
        border: `1px solid ${view.status === 'exception' ? '#fecdd3' : ORDER_DETAIL_THEME.cardBorder}`,
        borderRadius: 20,
        padding: 14,
        background: view.status === 'exception'
          ? 'color-mix(in srgb, #fff1f2 70%, var(--admin-card-bg))'
          : 'var(--admin-card-bg)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <ShipmentHeader shipment={shipment} view={view} />
      <ShipmentProgress shipment={shipment} view={view} />
      <OrderLogisticsShipmentPlan
        canManage={canManage}
        onRunAction={onRunAction}
        onUpdateForm={onUpdateForm}
        shipment={shipment}
        view={view}
      />
      <OrderLogisticsGuidedFlow
        canManage={canManage}
        labelConfirmation={labelConfirmation}
        onRunProviderAction={onRunProviderAction}
        onSetLabelConfirmation={onSetLabelConfirmation}
        onSetPickupConfirmation={onSetPickupConfirmation}
        onUpdateForm={onUpdateForm}
        pickupConfirmation={pickupConfirmation}
        shipment={shipment}
        view={view}
      />
      <OrderLogisticsShipmentActions
        canManage={canManage}
        onRunAction={onRunAction}
        onUpdateForm={onUpdateForm}
        shipment={shipment}
        view={view}
      />
    </article>
  );
}
