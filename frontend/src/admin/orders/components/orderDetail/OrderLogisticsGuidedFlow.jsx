import OrderLogisticsGuideManagement from './OrderLogisticsGuideManagement';
import {
  OrderLogisticsGuideStatus,
  OrderLogisticsHandoff,
} from './OrderLogisticsGuideHandoff';
import OrderLogisticsRateSelector from './OrderLogisticsRateSelector';
import OrderLogisticsShipmentAssistant from './OrderLogisticsShipmentAssistant';

export default function OrderLogisticsGuidedFlow({
  canManage,
  labelConfirmation,
  onRunProviderAction,
  onSetLabelConfirmation,
  onSetPickupConfirmation,
  onUpdateForm,
  pickupConfirmation,
  shipment,
  view,
}) {
  return (
    <div style={{ order: 2, marginTop: 12, border: '2px solid var(--admin-primary)', borderRadius: 22, padding: 16, background: 'color-mix(in srgb, var(--admin-primary-soft-bg) 32%, var(--admin-card-bg))', boxShadow: '0 12px 30px color-mix(in srgb, var(--admin-primary) 13%, transparent)' }}>
      <OrderLogisticsShipmentAssistant
        canManage={canManage}
        onRunProviderAction={onRunProviderAction}
        shipment={shipment}
        view={view}
      />
      <OrderLogisticsRateSelector
        canManage={canManage}
        onRunProviderAction={onRunProviderAction}
        onUpdateForm={onUpdateForm}
        shipment={shipment}
        view={view}
      />
      <OrderLogisticsGuideStatus shipment={shipment} view={view} />
      <OrderLogisticsHandoff
        canManage={canManage}
        onRunProviderAction={onRunProviderAction}
        onUpdateForm={onUpdateForm}
        shipment={shipment}
        view={view}
      />
      <OrderLogisticsGuideManagement
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
    </div>
  );
}
